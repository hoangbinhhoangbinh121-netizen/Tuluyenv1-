'use strict';
/**
 * SỰ KIỆN THẾ GIỚI V19 (spec §8). Mọi sự kiện có thời gian, giới hạn người tham gia và chống khai thác phần thưởng.
 *   1. Thiên Địa Dị Biến   — ngẫu nhiên, 15–30 phút, phần thưởng Bí Cảnh Tiên Giới ×1,5 Tu Vi/Linh Thạch và +30% tỉ lệ rơi nguyên liệu (toàn bot).
 *   2. Đế Cảnh Xuất Thế    — Boss Đế Cấp (Boss Thế Giới cấp 10): từ Chân Tiên trở lên, tối đa 60 người; thưởng chia theo sát thương (≥ 2% mới rơi vật phẩm).
 *   3. Vạn Cổ Truyền Thừa  — truyền thừa xuất hiện 5 phút, tối đa 20 người tranh đoạt, 1 người nhận phần chính (mỗi người chỉ thắng 1 lần / ngày); còn lại nhận phần an ủi.
 *   4. Siêu Thoát Chi Môn  — Boss Thế Giới cấp 11: chỉ từ Đại Đạo Chí Tôn, tối đa 25 người, phần thưởng cực hiếm + bảng thành tích riêng (ev19_hall).
 * Boss (2, 4) dùng lại bảng/giao diện Boss Thế Giới (wb7_*) → phần chia thưởng nằm trong 1 transaction, không thể chia hai lần.
 */
const D = require('../db');
const K = require('./constants');
const Cu = require('./cultivator');
const Inv = require('./invsvc');
const D16 = require('../data/congphap_v16');
const IT = require('../data/items_v17');
const { now, int, random, randInt, randUniform, choice, clamp } = require('../util');

const KINDS = {
  dibien: { name: 'Thiên Địa Dị Biến', icon: '🌠', min: 15, max: 30, desc: 'Thiên địa dị biến, linh khí cuộn trào — phần thưởng **Bí Cảnh Tiên Giới** tăng mạnh trong thời gian ngắn.' },
  dicanh: { name: 'Đế Cảnh Xuất Thế', icon: '👑', tier: 10, minutes: 40, desc: 'Một **Boss Đế Cấp** phá không xuất thế — toàn server từ Chân Tiên trở lên có thể vây đánh.' },
  truyenthua: { name: 'Vạn Cổ Truyền Thừa', icon: '📜', minutes: 5, cap: 20, minRealm: 10, desc: 'Một truyền thừa Vạn Cổ hiện ra — người đủ điều kiện có thể **tranh đoạt**.' },
  sieuthoat: { name: 'Siêu Thoát Chi Môn', icon: '🌌', tier: 11, minutes: 45, desc: 'Cánh cửa Siêu Thoát hé mở — chỉ người đứng trên đỉnh Đại Đạo mới dám bước vào.' },
};
const KIND_ORDER = ['dibien', 'dicanh', 'truyenthua', 'sieuthoat'];
const DIBIEN = { reward: 1.5, drop: 1.3 };
const AUTO_ON = process.env.EVENT19_AUTO !== '0';
const AUTO_MIN_GAP = 45 * 60;      // giây giữa 2 sự kiện tự động trong 1 server
const AUTO_P = { dibien: 1 / 150, truyenthua: 1 / 300, dicanh: 1 / 600, sieuthoat: 1 / 1200 };   // xác suất mỗi phút khi đủ điều kiện

const fmt = (n) => Number(n).toLocaleString('vi-VN');
const dataOf = (ev) => { try { return JSON.parse(ev.data || '{}') || {}; } catch (_) { return {}; } };
const byId = (id) => D.get('SELECT * FROM ev19 WHERE id = ?', id);
const activeOf = (kind, guildId = null) => (guildId ? D.get("SELECT * FROM ev19 WHERE kind = ? AND status = 'active' AND guild_id = ? ORDER BY id DESC LIMIT 1", kind, String(guildId)) : D.get("SELECT * FROM ev19 WHERE kind = ? AND status = 'active' ORDER BY id DESC LIMIT 1", kind));

// ---------------------------------------------------------------- 1. Thiên Địa Dị Biến (buff toàn cục)
function dibienActive() { const ev = D.get("SELECT * FROM ev19 WHERE kind = 'dibien' AND status = 'active' AND ends_at > ? ORDER BY id DESC LIMIT 1", now()); return ev || null; }
/** Hệ số thưởng Bí Cảnh hiện tại: { reward, drop } (1/1 khi không có sự kiện). */
function bcBoost() { const ev = dibienActive(); return ev ? { reward: DIBIEN.reward, drop: DIBIEN.drop, ev } : { reward: 1, drop: 1, ev: null }; }

// ---------------------------------------------------------------- tạo / kết thúc sự kiện lưu trong ev19
function create(kind, { guildId = null, channelId = null, minutes = null, data = {} } = {}) {
  const k = KINDS[kind]; if (!k || !['dibien', 'truyenthua'].includes(kind)) return { ok: false, error: 'Loại sự kiện không hợp lệ.' };
  if (activeOf(kind, kind === 'dibien' ? null : guildId)) return { ok: false, error: `**${k.name}** đang diễn ra.` };
  const t = now(); const mins = minutes || (k.min ? randInt(k.min, k.max) : k.minutes);
  const payload = kind === 'truyenthua' ? { ...data, legacy: data.legacy || pickLegacy() } : data;
  const r = D.run('INSERT INTO ev19 (kind, guild_id, channel_id, status, started_at, ends_at, data) VALUES (?,?,?,?,?,?,?)', kind, guildId ? String(guildId) : null, channelId ? String(channelId) : null, 'active', t, t + mins * 60, JSON.stringify(payload));
  return { ok: true, ev: byId(r.lastInsertRowid), minutes: mins };
}
const LEGACIES = [
  { key: 'kiem', name: 'Vạn Cổ Kiếm Ý', frag: 'manh19_thoi_gian' }, { key: 'than', name: 'Vạn Cổ Thần Thể', frag: 'manh19_tran_the' }, { key: 'dao', name: 'Vạn Cổ Đạo Vận', frag: 'manh19_hu_khong' },
  { key: 'hoi', name: 'Vạn Cổ Luân Hồi Ấn', frag: 'manh19_bat_hu' }, { key: 'de', name: 'Vạn Cổ Đế Kinh', frag: 'manh19_de_kinh' },
];
const pickLegacy = () => choice(LEGACIES).key;
const legacyOf = (key) => LEGACIES.find((x) => x.key === key) || LEGACIES[0];

function joinContest(evId, userId) {
  return D.transaction(() => {
    const ev = byId(evId); if (!ev || ev.kind !== 'truyenthua' || ev.status !== 'active' || ev.ends_at <= now()) return { ok: false, error: 'Truyền thừa đã biến mất.' };
    const row = Cu.getCultivator(userId); const k = KINDS.truyenthua;
    if (!row) return { ok: false, error: 'Bạn chưa bắt đầu tu tiên.' };
    if (!require('./ascension').tienUnlocked(row) || row.realm_index < k.minRealm) return { ok: false, error: `Chỉ người từ **${K.REALMS[k.minRealm].name}** trở lên (đã phi thăng Tiên Giới) mới tranh đoạt được.` };
    if (D.get('SELECT 1 AS x FROM ev19_part WHERE ev_id = ? AND user_id = ?', evId, String(userId))) return { ok: false, error: 'Bạn đã tham gia tranh đoạt rồi.' };
    const n = D.get('SELECT COUNT(*) AS n FROM ev19_part WHERE ev_id = ?', evId).n; if (n >= k.cap) return { ok: false, error: `Đã đủ **${k.cap}** người tranh đoạt.` };
    const luc = Math.max(1, Cu.calcLucChien(row)); const score = Math.sqrt(luc) * randUniform(0.6, 1.4);   // sức mạnh (căn bậc hai — không áp đảo) × may mắn
    D.run('INSERT INTO ev19_part (ev_id, user_id, score, joined_at) VALUES (?,?,?,?)', evId, String(userId), score, now());
    return { ok: true, n: n + 1, cap: k.cap };
  });
}
/** Chốt Vạn Cổ Truyền Thừa: người điểm cao nhất (chưa thắng hôm nay) nhận phần chính, còn lại phần an ủi. */
function settleContest(ev) {
  return D.transaction(() => {
    const cur = byId(ev.id); if (!cur || cur.status !== 'active') return null;
    D.run("UPDATE ev19 SET status = 'ended' WHERE id = ?", ev.id);
    const list = D.all('SELECT * FROM ev19_part WHERE ev_id = ? ORDER BY score DESC', ev.id); const dat = dataOf(cur); const lg = legacyOf(dat.legacy);
    const out = { ev: cur, legacy: lg, winner: null, lines: [], n: list.length };
    if (!list.length) return out;
    const win = list.find((p) => Inv.dailyGet(p.user_id, 'ev19:win') < 1) || null;
    for (const p of list) {
      const row = Cu.getCultivator(p.user_id); if (!row) continue;
      if (win && p.user_id === win.user_id) {
        Inv.dailyAdd(p.user_id, 'ev19:win', 1); out.winner = p.user_id;
        const f = D16.FRAG_BY_ID.get(lg.frag); const C16 = require('./congphapV16'); const g = randInt(6, 12);
        if (f && !Cu.ownedCongphapTiers(row).has(f.book)) { const tot = C16.addFrag(p.user_id, lg.frag, g); out.lines.push(`🏆 <@${p.user_id}> đoạt **${lg.name}**: ${f.icon} **${g}** ${f.name} (${tot}/${f.need})`); }
        else { const n = randInt(8, 16); Inv.add(p.user_id, 'tdc19_de_dao_ban_nguyen', n, { why: 'ev19 truyen thua' }); out.lines.push(`🏆 <@${p.user_id}> đoạt **${lg.name}**: **${n}** ${IT.BY_ID.tdc19_de_dao_ban_nguyen.name}`); }
        if (random() < 0.5) { Inv.add(p.user_id, 'tdc19_de_cung_co_an', 1, { why: 'ev19 truyen thua' }); out.lines.push('　+ 1 Đế Cung Cổ Ấn'); }
      } else {
        const need = require('./realm').tuViRequiredBase(row.realm_index, row.stage_index, row.world_tier);
        const tu = Math.max(1, int(need * 0.01)); const lt = Math.max(1, int(need * 0.004));
        Cu.updateCultivator(p.user_id, { tu_vi: new Cu.Delta(tu), linh_thach: new Cu.Delta(lt) }); out.lines.push(`🎁 <@${p.user_id}>: +${fmt(tu)} tu vi, +${fmt(lt)} Linh Thạch (phần an ủi)`);
      }
    }
    return out;
  });
}
function endDibien(ev) { D.run("UPDATE ev19 SET status = 'ended' WHERE id = ? AND status = 'active'", ev.id); }

// ---------------------------------------------------------------- 2 & 4: thưởng Boss Đế Cảnh / Siêu Thoát (gọi từ boss.finish — cùng transaction)
const BOSS_LOOT = {
  10: { mats: [['tdc19_de_dao_ban_nguyen', 0.9, 2, 6], ['tdc19_van_dao_nguyen_tinh', 0.5, 1, 3], ['tdc19_de_cung_co_an', 0.35, 1, 2], ['tdc19_bat_hu_de_cot', 0.2, 1, 1], ['tdc19_tien_ton_dao_qua', 0.3, 1, 2], ['cp19_dao_van_co_ngoc', 0.4, 1, 3], ['cp19_ban_nguyen_tinh', 0.25, 1, 2]], cert: 0.25, frags: ['manh19_de_kinh', 'manh19_tran_the', 'manh19_bat_hu', 'manh19_hu_khong', 'manh19_thoi_gian'] },
  11: { mats: [['tdc19_sieu_thoat_chan_tuy', 0.9, 1, 3], ['tdc19_vinh_hang_dao_qua', 0.5, 1, 2], ['tdc19_chung_cuc_ban_nguyen', 0.18, 1, 1], ['tdc19_hu_vo_nguyen_thach', 0.7, 2, 5], ['cp19_truyen_thua_co_dao', 0.35, 1, 2], ['cp19_cong_phap_chan_giai', 0.4, 1, 3]], cert: 0.3, frags: ['manh19_quy_nguyen', 'manh19_ban_nguyen', 'manh19_khai_thien'], killerBooks: [[1054, 0.008], [1055, 0.004]], rareMat: ['tdc19_sieu_thoat_co_an', 0.12] },
};
function bossRewards(boss, out, reason, killerId) {
  const L = BOSS_LOOT[boss.tier]; if (!L || reason === 'cancelled') return;
  const factor = reason === 'killed' ? 1 : 0.5; const total = out.contributors.reduce((s, c) => s + c.damage, 0) || 1;
  const C16 = require('./congphapV16');
  for (const c of out.contributors) {
    if (c.share < 0.02) continue;
    const row = Cu.getCultivator(c.user_id); if (!row) continue; const lines = [];
    const sm = 0.5 + Math.min(1.5, c.share * 8);   // đóng góp lớn → nhiều hơn (tối đa ×2)
    for (const [id, p, lo, hi] of L.mats) if (random() < p * factor) { const n = Math.max(1, int(randInt(lo, hi) * sm * factor)); const g = Inv.add(c.user_id, id, n, { why: `ev19 boss ${boss.tier}` }); if (g) lines.push(`${g}× ${IT.BY_ID[id].name}`); }
    if (random() < 0.3 * factor && L.frags.length) { const fid = choice(L.frags); const f = D16.FRAG_BY_ID.get(fid); if (f && !Cu.ownedCongphapTiers(row).has(f.book)) { const g = randInt(1, 3); C16.addFrag(c.user_id, fid, g); lines.push(`${g}× ${f.name}`); } }
    if (c.rank === 1 && reason === 'killed' && random() < L.cert) { Inv.add(c.user_id, 'tdc19_de_dao_chung_nhan', 1, { why: `ev19 boss ${boss.tier}` }); lines.push('1× Đế Đạo Chứng Nhận'); }
    if (L.rareMat && c.user_id === String(killerId) && random() < L.rareMat[1]) { Inv.add(c.user_id, L.rareMat[0], 1, { why: 'ev19 boss' }); lines.push(`1× ${IT.BY_ID[L.rareMat[0]].name}`); }
    try { const v = require('./drops17').roll(c.user_id, 'v20_event', { noText: true, row }); for (const [id, n] of Object.entries(v.got)) lines.push(`${n}× ${IT.BY_ID[id].name}`); } catch (_) { /* V20: nguyên liệu nghề — lỗi không chặn thưởng */ }
    try { require('./benmenh19').addInsight(c.user_id, 3); } catch (_) { /* bỏ qua */ }
    if (lines.length) out.drops.push({ user_id: c.user_id, kind: 'ev19', text: `nhận **${lines.join(', ')}** từ ${KINDS[boss.tier === 10 ? 'dicanh' : 'sieuthoat'].name}!` });
    if (boss.tier === 11) D.run('INSERT INTO ev19_hall (user_id, wins, best_damage, total_damage, last_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET wins = wins + excluded.wins, best_damage = MAX(best_damage, excluded.best_damage), total_damage = total_damage + excluded.total_damage, last_at = excluded.last_at', c.user_id, reason === 'killed' ? 1 : 0, c.damage, c.damage, now());
  }
  if (L.killerBooks && reason === 'killed' && killerId) {
    const row = Cu.getCultivator(killerId);
    for (const [tier, p] of L.killerBooks) if (random() < p && row && !Cu.ownedCongphapTiers(row).has(tier) && row.realm_index >= D16.BY_TIER.get(tier).require_realm) {
      const up = {}; if (C16.grantInto(up, row, tier)) { Cu.updateCultivator(killerId, up); out.drops.push({ user_id: String(killerId), kind: 'congphap', text: `cảm ngộ **${D16.BY_TIER.get(tier).name}** — công pháp Siêu Thoát cực hiếm!` }); break; }
    }
  }
}
const hallTop = (n = 10) => D.all('SELECT * FROM ev19_hall ORDER BY wins DESC, best_damage DESC LIMIT ?', n);

// ---------------------------------------------------------------- bộ tạo ngẫu nhiên (gọi mỗi phút từ background)
function autoCandidates(guildId, tNow = now()) {
  if (!AUTO_ON) return [];
  const last = D.get('SELECT MAX(started_at) AS t FROM ev19 WHERE guild_id = ?', String(guildId)).t || 0;
  const lastBoss = D.get('SELECT MAX(spawned_at) AS t FROM wb7_boss WHERE guild_id = ? AND tier >= 10', String(guildId)).t || 0;
  if (tNow - Math.max(last, lastBoss) < AUTO_MIN_GAP) return [];
  const out = []; for (const kind of KIND_ORDER) { if (random() < AUTO_P[kind]) out.push(kind); } return out;
}
module.exports = { KINDS, KIND_ORDER, DIBIEN, LEGACIES, AUTO_P, AUTO_MIN_GAP, dataOf, byId, activeOf, dibienActive, bcBoost, create, joinContest, settleContest, endDibien, legacyOf, bossRewards, hallTop, autoCandidates, BOSS_LOOT };
