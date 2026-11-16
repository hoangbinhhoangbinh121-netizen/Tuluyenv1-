'use strict';
/**
 * HIỆU ỨNG V19 — Đế Đạo (6 con đường) + Đế Binh. MỘT nơi duy nhất tính; chỉ ĐỌC bảng de19_state (không lưu kết quả) nên mỗi hiệu ứng cộng đúng 1 lần
 * và tháo/đổi Đế Binh, đổi Đế Đạo có hiệu lực ngay. Các hook (cùng chỗ với công pháp V16, KHÔNG nhân đôi):
 *   stat (atk/def/hp/spd) → cultivator.cpScaleFor · tu → cpTuMult · luc → calcLucChien · boss → bossBonus · route (crit/pierce/dodge/dr/regen/lifesteal/failKeep…) → talent.bundle (dùng chung trần CAPS).
 * Bộ nhớ đệm theo user (TTL 20s) — mọi thao tác ghi đều gọi invalidate().
 */
const D = require('../db');

// ---------------------------------------------------------------- Đế Đạo (spec §6.2) — giá trị gốc ở cấp 1; cấp n: ×(1 + 0.12×(n−1)); mỗi lần thức tỉnh (cấp 5, cấp 10): ×(1 + 0.10 mỗi lần)
const DE_DAO = {
  satphat: { name: 'Sát Phạt Đế Đạo', icon: '⚔️', fx: { atk: 0.12, crit: 0.05 }, desc: 'Công kích +12%, bạo kích +5%.',
    awaken: ['Thức tỉnh 1 (cấp 5): đòn chí mạng trong Bí Cảnh mạnh thêm 10%.', 'Thức tỉnh 2 (cấp 10): đòn đầu tiên mỗi trận gây thêm 30% sát thương.'] },
  sinhmenh: { name: 'Sinh Mệnh Đế Đạo', icon: '💚', fx: { hp: 0.20, regen: 0.08 }, desc: 'Sinh mệnh +20%, hồi phục +8%.',
    awaken: ['Thức tỉnh 1 (cấp 5): Điều Tức trong Bí Cảnh hồi thêm 5% sinh mệnh.', 'Thức tỉnh 2 (cấp 10): hồi 2% sinh mệnh mỗi lượt khi dưới 50% sinh mệnh.'] },
  thoikhong: { name: 'Thời Không Đế Đạo', icon: '🌀', fx: { spd: 0.15, dodge: 0.06 }, desc: 'Tốc độ +15%, né tránh +6%.',
    awaken: ['Thức tỉnh 1 (cấp 5): hồi Linh Lực thêm 3 mỗi lượt trong Bí Cảnh.', 'Thức tỉnh 2 (cấp 10): 10% cơ hội hành động hai lần.'] },
  luanhoi: { name: 'Luân Hồi Đế Đạo', icon: '♻️', fx: { regen: 0.10, failKeep: 0.05, kiepDmg: 0.05 }, desc: 'Hồi phục +10%, giữ thêm 5% tu vi khi đột phá thất bại, giảm 5% sát thương lôi kiếp.',
    awaken: ['Thức tỉnh 1 (cấp 5): mỗi trận Bí Cảnh sống sót 1 lần với 1 sinh mệnh khi bị đòn chí tử.', 'Thức tỉnh 2 (cấp 10): lần sống sót đó hồi thêm 20% sinh mệnh.'] },
  hunhdon: { name: 'Hỗn Độn Đế Đạo', icon: '🌌', fx: { atk: 0.08, def: 0.08, hp: 0.08 }, desc: 'Công/Thủ/Sinh mệnh +8%.',
    awaken: ['Thức tỉnh 1 (cấp 5): mọi hiệu ứng Đế Đạo +5%.', 'Thức tỉnh 2 (cấp 10): mọi hiệu ứng Đế Đạo +10%.'] },
  huydiet: { name: 'Hủy Diệt Đế Đạo', icon: '💥', fx: { boss: 0.15, pierce: 0.08 }, desc: 'Sát thương Boss +15%, xuyên giáp +8%.',
    awaken: ['Thức tỉnh 1 (cấp 5): Tuyệt Kỹ / Bí Pháp trong Bí Cảnh mạnh thêm 8%.', 'Thức tỉnh 2 (cấp 10): Boss cuối bí cảnh bị giảm 5% kháng sát thương.'] },
};
const DAO_ORDER = ['satphat', 'sinhmenh', 'thoikhong', 'luanhoi', 'hunhdon', 'huydiet'];
const DAO_MAX_LEVEL = 10; const DAO_AWAKEN_LEVELS = [5, 10];
/** Chi phí nâng Đế Đạo từ cấp n lên n+1 (n = 0 là lĩnh ngộ lần đầu). Vật phẩm + Linh Thạch. */
function daoCost(n) {
  const k = n + 1;
  return { lt: 20000000 * k * k, items: { tdc19_de_dao_ban_nguyen: 4 * k, ...(k >= 3 ? { tdc19_hon_nguyen_tien_tuy: 2 * k } : {}), ...(k >= 6 ? { tdc19_van_dao_nguyen_tinh: k, tdc19_thien_dao_phap_tac: k - 4 } : {}), ...(k >= 9 ? { tdc19_vinh_hang_dao_qua: k - 7 } : {}), ...(k >= 3 ? { tdc19_de_cung_co_an: Math.floor(k / 3) } : {}) } };
}
const daoScale = (lv, awake) => (1 + 0.12 * Math.max(0, lv - 1)) * (1 + 0.10 * Math.max(0, awake));

// ---------------------------------------------------------------- Đế Binh (5 món theo spec §7; mỗi người trang bị 1 món) — cấp 0–10, mỗi cấp +8% hiệu ứng gốc
const BINH_MAX_LEVEL = 10;
const DE_BINH = {
  kiem: { name: 'Vạn Cổ Đế Kiếm', icon: '🗡️', fx: { atk: 0.20, pierce: 0.08 }, skill: 'Vạn Kiếm Diệt Thế', skillDesc: 'Trong Bí Cảnh/Chứng Đạo: 10% cơ hội mỗi đòn gây thêm 100% sát thương.',
    craft: { lt: 60000000, items: { tdc19_kim_tien_ban_nguyen: 20, tdc19_vuong_dao_chan_huyet: 15, tdc19_de_cung_co_an: 5, tdc19_tien_to_chan_huyet: 3 } } },
  chung: { name: 'Hỗn Độn Chung', icon: '🔔', fx: { def: 0.20, hp: 0.15 }, skill: 'Hỗn Độn Trấn Áp', skillDesc: 'Trong Bí Cảnh: Phòng Thủ còn trấn áp đối thủ, làm yếu đi 15% trong 2 lượt.',
    craft: { lt: 60000000, items: { tdc19_dai_la_dao_thach: 20, tdc19_bat_hu_de_cot: 3, tdc19_de_cung_co_an: 5, tdc19_hon_nguyen_tien_tuy: 10 } } },
  ban: { name: 'Luân Hồi Thiên Bàn', icon: '☯️', fx: { hp: 0.15, regen: 0.08 }, skill: 'Luân Hồi Chuyển Sinh', skillDesc: 'Trong Bí Cảnh: một lần mỗi trận, khi xuống dưới 15% sinh mệnh sẽ chuyển sinh, hồi 30% sinh mệnh.',
    craft: { lt: 80000000, items: { tdc19_thien_dao_phap_tac: 8, tdc19_dai_dao_ban_nguyen: 6, tdc19_bat_hu_de_cot: 4, tdc19_de_cung_co_an: 4 } } },
  an: { name: 'Thiên Đạo Thần Ấn', icon: '🔱', fx: { atk: 0.12, def: 0.15, effRes: 0.10 }, skill: 'Thiên Đạo Bất Xâm', skillDesc: 'Kháng hiệu ứng +10%: giảm xác suất dính hiệu ứng xấu của Boss và giảm 10% sát thương lôi kiếp.',
    craft: { lt: 70000000, items: { tdc19_vuong_dao_chan_huyet: 20, tdc19_van_dao_nguyen_tinh: 10, tdc19_de_cung_co_an: 6, tdc19_thien_dao_phap_tac: 4 } } },
  thap: { name: 'Vĩnh Hằng Thần Tháp', icon: '🗼', fx: { hp: 0.25, def: 0.20 }, skill: 'Vĩnh Hằng Hộ Thể', skillDesc: 'Trong Bí Cảnh: mỗi tầng khởi đầu với khiên bằng 8% sinh mệnh tối đa.',
    craft: { lt: 120000000, items: { tdc19_chung_cuc_ban_nguyen: 3, tdc19_sieu_thoat_co_an: 2, tdc19_vinh_hang_dao_qua: 4, tdc19_hu_vo_nguyen_thach: 10 } } },
};
const BINH_ORDER = Object.keys(DE_BINH);
const binhScale = (lv) => 1 + 0.08 * Math.max(0, lv);
function binhUpCost(lv) { const k = lv + 1; return { lt: 8000000 * k * k, items: { tdc19_de_cung_co_an: Math.ceil(k / 2), tdc19_tien_to_chan_huyet: k, ...(k >= 5 ? { tdc19_chung_cuc_ban_nguyen: Math.floor(k / 3) } : {}) } }; }

// ---------------------------------------------------------------- đọc trạng thái (có đệm)
const cache = new Map();
function raw(userId) {
  const u = String(userId); const t = Date.now(); const c = cache.get(u);
  if (c && t - c.at < 20000) return c.v;
  let r = null; try { r = D.get('SELECT * FROM de19_state WHERE user_id = ?', u); } catch (_) { r = null; }
  let binh = {}; if (r) { try { binh = JSON.parse(r.binh || '{}') || {}; } catch (_) { binh = {}; } }
  const v = r ? { ...r, binhObj: binh } : null;
  cache.set(u, { at: t, v }); return v;
}
const invalidate = (userId) => { if (userId === undefined) cache.clear(); else cache.delete(String(userId)); };
const EMPTY = Object.freeze({ stat: Object.freeze({ atk: 0, def: 0, hp: 0, spd: 0 }), tu: 0, boss: 0, luc: 0, route: Object.freeze({}) });
const ROUTE_KEYS = ['crit', 'critMult', 'pierce', 'dodge', 'dr', 'regen', 'lifesteal', 'failKeep'];   // effRes & kiepDmg KHÔNG đưa vào talent.bundle — chỉ dùng trong Bí Cảnh/Chứng Đạo (combatPerks)
const STAT_KEYS = ['atk', 'def', 'hp', 'spd'];
const wm = new WeakMap();
/** Gói hiệu ứng V19 của 1 hàng cultivators. */
function get(row) {
  if (!row || typeof row !== 'object' || !row.user_id) return EMPTY;
  const hit = wm.get(row); if (hit) return hit;
  const s = raw(row.user_id); let res = EMPTY;
  if (s && (s.passed_at || s.grand) && ((s.de_dao && DE_DAO[s.de_dao]) || (s.binh_eq && DE_BINH[s.binh_eq]))) {
    const sum = {};
    if (s.de_dao && DE_DAO[s.de_dao]) {
      const d = DE_DAO[s.de_dao]; let sc = daoScale(s.de_dao_lv || 1, s.de_dao_awake || 0);
      if (s.de_dao === 'hunhdon') sc *= 1 + 0.05 * (s.de_dao_awake >= 1 ? 1 : 0) + 0.10 * (s.de_dao_awake >= 2 ? 1 : 0);
      for (const [k, v] of Object.entries(d.fx)) sum[k] = (sum[k] || 0) + v * sc;
    }
    if (s.binh_eq && DE_BINH[s.binh_eq] && s.binhObj[s.binh_eq] !== undefined) {
      const b = DE_BINH[s.binh_eq]; const sc = binhScale(s.binhObj[s.binh_eq] || 0);
      for (const [k, v] of Object.entries(b.fx)) sum[k] = (sum[k] || 0) + v * sc;
    }
    const stat = {}; for (const k of STAT_KEYS) stat[k] = Math.min(2.0, sum[k] || 0);
    const route = {}; for (const k of ROUTE_KEYS) if (sum[k]) route[k] = sum[k];
    const mean = STAT_KEYS.filter((k) => stat[k]).map((k) => stat[k]);
    res = { stat, tu: Math.min(1.0, sum.tu || 0), boss: Math.min(1.0, sum.boss || 0), luc: 0.5 * (mean.length ? mean.reduce((a, b) => a + b, 0) / mean.length : 0) * 0.3, route };
  }
  wm.set(row, res); return res;
}
/** Đế Hiệu (chuỗi đã chuẩn hoá) hoặc null — chỉ hiện với người đã Chứng Đạo. */
function hieuOf(userId) { const s = raw(userId); return s && (s.passed_at || s.grand) && s.de_hieu ? String(s.de_hieu) : null; }
/** Tên hiển thị kèm Đế Hiệu: «Đế Hiệu» Tên. */
const withHieu = (userId, name) => { const h = hieuOf(userId); return h ? `「${h}」${name}` : name; };
const statBonus = (row, k) => (k ? get(row).stat[k] || 0 : 0);
const tuBonus = (row) => get(row).tu;
const bossBonus = (row) => get(row).boss;
const lucBonus = (row) => get(row).luc;
const routeFx = (row) => get(row).route;
/** Cấp thức tỉnh Đế Đạo + khoá bí cảnh (hook chiến đấu). */
function combatPerks(row) {
  const s = row && row.user_id ? raw(row.user_id) : null; const out = { dao: null, awake: 0, daoLv: 0, binh: null, binhLv: 0, effRes: 0, kiepDmg: 0 };
  if (!s || !(s.passed_at || s.grand)) return out;
  if (s.de_dao && DE_DAO[s.de_dao]) { out.dao = s.de_dao; out.awake = s.de_dao_awake || 0; out.daoLv = s.de_dao_lv || 1; }
  if (s.binh_eq && DE_BINH[s.binh_eq] && s.binhObj[s.binh_eq] !== undefined) { out.binh = s.binh_eq; out.binhLv = s.binhObj[s.binh_eq] || 0; }
  out.effRes = out.binh === 'an' ? Math.min(0.30, 0.10 * binhScale(out.binhLv)) : 0;        // kháng hiệu ứng (Thiên Đạo Thần Ấn)
  out.kiepDmg = Math.min(0.30, (out.effRes ? out.effRes : 0) + (out.dao === 'luanhoi' ? 0.05 * daoScale(out.daoLv || 1, out.awake) : 0));   // giảm sát thương lôi kiếp
  return out;
}
module.exports = { DE_DAO, DAO_ORDER, DAO_MAX_LEVEL, DAO_AWAKEN_LEVELS, daoCost, daoScale, DE_BINH, BINH_ORDER, BINH_MAX_LEVEL, binhScale, binhUpCost, raw, invalidate, get, statBonus, tuBonus, bossBonus, lucBonus, routeFx, combatPerks, hieuOf, withHieu, EMPTY };
