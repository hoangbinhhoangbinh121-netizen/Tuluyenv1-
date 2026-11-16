'use strict';
/**
 * CÔNG PHÁP BẢN MỆNH V19 (spec §4.5) — mỗi người chỉ có MỘT quyển. Đặt lần đầu miễn phí; đổi quyển phải tốn tài nguyên (và mất tiến trình lĩnh ngộ/thức tỉnh).
 *  • Cộng hưởng: hiệu ứng của quyển Bản Mệnh được cộng thêm  +15% (nếu đang trang bị) hoặc +40% (nếu không trang bị) hiệu ứng gốc, +12% mỗi lần thức tỉnh — vẫn qua FX_CAP chung (cpfx.aggregate).
 *  • Lĩnh ngộ: thanh 0–100 cho từng mốc. Cộng bằng Bí Cảnh / Boss Thế Giới / nút Lĩnh Ngộ (3 lần/ngày, tốn Linh Thạch).
 *  • Thức tỉnh ở cấp quyển 30 / 60 / 90 (đủ thanh lĩnh ngộ + vật liệu giai đoạn):
 *      Thức tỉnh 1 — Bản Mệnh Hộ Thể: Bí Cảnh / Chứng Đạo khởi đầu mỗi tầng/kiếp với khiên 5% sinh mệnh.
 *      Thức tỉnh 2 — Bản Mệnh Cộng Minh: +6% Tu Vi nhận được (qua trần Tu Vi của công pháp).
 *      Thức tỉnh 3 — Bản Mệnh Thần Thông: Kỹ Công Pháp trong Bí Cảnh mạnh hơn (+0,8 hệ số, hồi chiêu −1).
 */
const D = require('../db');
const Cu = require('./cultivator');
const Inv = require('./invsvc');
const D16 = require('../data/congphap_v16');
const { now, int, clamp } = require('../util');

const AWAKEN_AT = [30, 60, 90];
const AWAKEN = [
  { n: 1, level: 30, name: 'Bản Mệnh Hộ Thể', desc: 'Bí Cảnh / Chứng Đạo: khởi đầu mỗi tầng (mỗi kiếp) với khiên bằng 5% sinh mệnh tối đa.' },
  { n: 2, level: 60, name: 'Bản Mệnh Cộng Minh', desc: '+6% Tu Vi nhận được (cộng vào trần Tu Vi chung của công pháp).' },
  { n: 3, level: 90, name: 'Bản Mệnh Thần Thông', desc: 'Kỹ Công Pháp trong Bí Cảnh mạnh thêm +0,8 hệ số sát thương và hồi chiêu giảm 1 lượt.' },
];
const FACTOR_SLOT = 0.15; const FACTOR_OFF = 0.40; const FACTOR_AWAKEN = 0.12;
const DAILY_INSIGHT = 3; const INSIGHT_GAIN = 6; const EXP_MAX = 100;
const awakenMat = (n) => ({ cp19_dao_van_co_ngoc: 5 * (n + 1), ...(n >= 1 ? { cp19_ban_nguyen_tinh: 4 * n } : {}), ...(n >= 2 ? { cp19_truyen_thua_co_dao: 3 } : {}) });
const awakenCost = (n) => ({ lt: 40000000 * (n + 1), items: awakenMat(n) });
const changeCost = (changes) => ({ lt: 30000000 * (changes + 1) ** 2, items: { cp19_tien_nguyen_tinh: 3 * (changes + 1) } });
const insightCost = (awaken) => 5000000 * (awaken + 1);

const cache = new Map();
function raw(userId) {
  const u = String(userId); const t = Date.now(); const c = cache.get(u); if (c && t - c.at < 20000) return c.v;
  let r = null; try { r = D.get('SELECT * FROM cp19_benmenh WHERE user_id = ?', u); } catch (_) { r = null; }
  const v = r && r.tier ? r : null; cache.set(u, { at: t, v }); return v;
}
const invalidate = (u) => { if (u === undefined) cache.clear(); else cache.delete(String(u)); };
/** Quyển Bản Mệnh của người chơi: { tier, awaken, exp, book } hoặc null. */
function get(userId) { const r = raw(userId); if (!r) return null; const book = D16.BY_TIER.get(r.tier); return book ? { tier: r.tier, awaken: r.awaken, exp: r.exp, changes: r.changes, book } : null; }
const levelOf = (row, tier) => Math.min(D16.MAX_LEVEL, Cu.congphapLevelsMap(row)[tier] || 0);
const fmt = (n) => Number(n).toLocaleString('vi-VN');
const itemName = (id) => { try { return require('../data/items_v17').BY_ID[id].name; } catch (_) { return id; } };
const costOk = (uid, c) => { if (Number(Cu.getCultivator(uid).linh_thach) < c.lt) return `Thiếu Linh Thạch (cần ${fmt(c.lt)}).`; const m = Inv.missing(uid, c.items); return m.length ? `Thiếu: ${m.map((x) => `${itemName(x.id)} ${x.have}/${x.need}`).join(' · ')}` : null; };
const pay = (uid, c, why) => { if (!Inv.takeMany(uid, c.items, why)) return false; Cu.updateCultivator(uid, { linh_thach: new Cu.Delta(-c.lt) }, { linh_thach: c.lt }); return true; };
const costText = (c) => `${fmt(c.lt)} Linh Thạch${Object.keys(c.items).length ? ' · ' : ''}${Object.entries(c.items).map(([id, n]) => `${n} ${itemName(id)}`).join(' · ')}`;

/** Đặt / đổi Bản Mệnh. Chỉ quyển V16/V19 đã sở hữu. */
function set(userId, tier) {
  return D.transaction(() => {
    const u = String(userId); tier = Number(tier); const row = Cu.getCultivator(u); if (!row) return { ok: false, error: 'Bạn chưa bắt đầu tu tiên.' };
    if (!D16.BY_TIER.has(tier)) return { ok: false, error: 'Chỉ đặt được Công Pháp mới (V16/V19) làm Bản Mệnh.' };
    if (!Cu.ownedCongphapTiers(row).has(tier)) return { ok: false, error: 'Bạn chưa sở hữu công pháp này.' };
    const cur = D.get('SELECT * FROM cp19_benmenh WHERE user_id = ?', u);
    if (cur && cur.tier === tier) return { ok: false, error: 'Đó đã là Công Pháp Bản Mệnh của bạn.' };
    if (!cur || !cur.tier) {
      D.run('INSERT INTO cp19_benmenh (user_id, tier, exp, awaken, changes, changed_at) VALUES (?,?,0,0,0,?) ON CONFLICT(user_id) DO UPDATE SET tier = excluded.tier, exp = 0, awaken = 0, changed_at = excluded.changed_at', u, tier, now());
      invalidate(u); return { ok: true, first: true };
    }
    const c = changeCost(cur.changes); const bad = costOk(u, c); if (bad) return { ok: false, error: `Đổi Bản Mệnh tốn **${costText(c)}**. ${bad}`, cost: c };
    if (!pay(u, c, 'ban menh: doi')) return { ok: false, error: 'Không đủ tài nguyên.' };
    D.run('UPDATE cp19_benmenh SET tier = ?, exp = 0, awaken = 0, changes = changes + 1, changed_at = ? WHERE user_id = ?', tier, now(), u);
    invalidate(u); return { ok: true, changed: true, cost: c };
  });
}
/** Cộng EXP lĩnh ngộ (từ Bí Cảnh/Boss). Không vượt 100. Trả số thực cộng. */
function addInsight(userId, n) {
  const r = D.get('SELECT * FROM cp19_benmenh WHERE user_id = ?', String(userId)); if (!r || !r.tier || r.awaken >= 3) return 0;
  const add = Math.max(0, Math.min(EXP_MAX - r.exp, int(n))); if (!add) return 0;
  D.run('UPDATE cp19_benmenh SET exp = exp + ? WHERE user_id = ?', add, String(userId)); invalidate(userId); return add;
}
/** Nút Lĩnh Ngộ: tốn Linh Thạch, tối đa 3 lần/ngày. */
function meditate(userId) {
  return D.transaction(() => {
    const u = String(userId); const r = D.get('SELECT * FROM cp19_benmenh WHERE user_id = ?', u); if (!r || !r.tier) return { ok: false, error: 'Bạn chưa đặt Công Pháp Bản Mệnh.' };
    if (r.awaken >= 3) return { ok: false, error: 'Bản Mệnh đã thức tỉnh tối đa.' };
    if (r.exp >= EXP_MAX) return { ok: false, error: 'Thanh lĩnh ngộ đã đầy — hãy **Thức Tỉnh** (cần đủ cấp công pháp và vật liệu).' };
    if (Inv.dailyGet(u, 'bm19:insight') >= DAILY_INSIGHT) return { ok: false, error: `Hôm nay bạn đã lĩnh ngộ đủ ${DAILY_INSIGHT} lần.` };
    const lt = insightCost(r.awaken); if (Number(Cu.getCultivator(u).linh_thach) < lt) return { ok: false, error: `Cần ${fmt(lt)} Linh Thạch để tĩnh tâm lĩnh ngộ.` };
    Cu.updateCultivator(u, { linh_thach: new Cu.Delta(-lt) }, { linh_thach: lt }); Inv.dailyAdd(u, 'bm19:insight', 1);
    const g = addInsight(u, INSIGHT_GAIN); return { ok: true, gain: g, cost: lt };
  });
}
function awaken(userId) {
  return D.transaction(() => {
    const u = String(userId); const r = D.get('SELECT * FROM cp19_benmenh WHERE user_id = ?', u); if (!r || !r.tier) return { ok: false, error: 'Bạn chưa đặt Công Pháp Bản Mệnh.' };
    if (r.awaken >= 3) return { ok: false, error: 'Đã thức tỉnh tối đa.' };
    const need = AWAKEN_AT[r.awaken]; const row = Cu.getCultivator(u); const lv = levelOf(row, r.tier);
    if (lv < need) return { ok: false, error: `Thức tỉnh lần ${r.awaken + 1} cần công pháp đạt **cấp ${need}** (hiện ${lv}).` };
    if (r.exp < EXP_MAX) return { ok: false, error: `Thanh lĩnh ngộ chưa đầy (${r.exp}/${EXP_MAX}).` };
    const c = awakenCost(r.awaken); const bad = costOk(u, c); if (bad) return { ok: false, error: bad, cost: c };
    if (!pay(u, c, 'ban menh: thuc tinh')) return { ok: false, error: 'Không đủ tài nguyên.' };
    D.run('UPDATE cp19_benmenh SET awaken = awaken + 1, exp = 0 WHERE user_id = ?', u); invalidate(u);
    return { ok: true, n: r.awaken + 1, info: AWAKEN[r.awaken] };
  });
}
module.exports = { AWAKEN_AT, AWAKEN, FACTOR_SLOT, FACTOR_OFF, FACTOR_AWAKEN, DAILY_INSIGHT, INSIGHT_GAIN, EXP_MAX, awakenCost, changeCost, insightCost, costText, get, raw, invalidate, levelOf, set, addInsight, meditate, awaken };
