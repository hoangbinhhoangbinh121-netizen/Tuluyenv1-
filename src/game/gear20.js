'use strict';
/**
 * V20.3 — KHẢM & THỨC TỈNH trang bị (chồng lên hệ trang bị V17: cường hoá / tinh luyện / sửa chữa vẫn do gear17 lo, KHÔNG đổi).
 *  • Ô khảm: mở bằng Linh Thạch + Kim Loại tinh luyện (tối đa 1 ô với trang bị bậc ≤5, 2 ô với bậc ≥6). Khảm Yêu Hạch (nguyên liệu yêu thú giai đoạn ≤ bậc trang bị): cộng 1 chỉ số cố định theo giai đoạn của hạch.
 *    Khảm đè = mất hạch cũ. Trang bị bị phân giải thì hạch trong ô mất.
 *  • Thức tỉnh (bậc ≥ 6, tinh luyện ≥ 3, tối đa 3 lần): tốn Linh Thạch + Bản Vẽ Hiếm + Kim Loại; tỉ lệ 70% / 50% / 30%, thất bại mất vật liệu nhưng trang bị an toàn. Mỗi lần: chỉ số chính ×(1 + 5%).
 * Độ bền = 0 (hỏng) thì statsOf trả {} như cũ → khảm/thức tỉnh cũng không có tác dụng đến khi sửa.
 */
const D = require('../db');
const Cu = require('./cultivator');
const Inv = require('./invsvc');
const Cat = require('./catalog17');
const V = require('../data/v20_data');
const { I } = Cat;
const { random, fmtNum } = require('../util');
const { Delta } = Cu;

const uid = (u) => String(u);
const GEM_STAT = ['atk', 'def', 'hp', 'crit', 'dodge', 'dr'];
const GEM_BASE = { atk: 0.012, def: 0.012, hp: 0.015, crit: 0.006, dodge: 0.006, dr: 0.004 };
const AWAKEN_MAX = 3; const AWAKEN_RATE = [0.7, 0.5, 0.3]; const AWAKEN_PCT = 0.05;
const gearGet = (user, gid) => D.get('SELECT * FROM gear WHERE user_id = ? AND gear_id = ?', uid(user), Number(gid));
const tierOf = (row) => { const t = require('./gear17').tpl(row.tpl); return t ? t.tier : 1; };
const maxSockets = (tier) => (tier >= 6 ? 2 : 1);
function rec(gid) { const r = D.get('SELECT * FROM v20_gear WHERE gear_id = ?', Number(gid)); if (!r) return { sockets: 0, gems: [], awaken: 0 }; let g = []; try { g = JSON.parse(r.gems || '[]'); } catch (_) { g = []; } return { sockets: r.sockets, gems: g, awaken: r.awaken }; }
function save(user, gid, r) { D.run('INSERT INTO v20_gear (gear_id, user_id, sockets, gems, awaken) VALUES (?,?,?,?,?) ON CONFLICT(gear_id) DO UPDATE SET sockets = excluded.sockets, gems = excluded.gems, awaken = excluded.awaken', Number(gid), uid(user), r.sockets, JSON.stringify(r.gems), r.awaken); }
const gemStage = (id) => { const m = /^v20_yt_(\d+)$/.exec(id || ''); return m ? Number(m[1]) : 0; };
const gemFx = (id) => { const n = gemStage(id); if (!n) return {}; const k = GEM_STAT[(n - 1) % GEM_STAT.length]; return { [k]: Math.round(GEM_BASE[k] * (0.6 + 0.2 * n) * 1e4) / 1e4 }; };
/** Cộng thêm cho statsOf (đã có chỉ số `out` của gear17): khảm + thức tỉnh. */
function bonus(row, out) {
  const r = rec(row.gear_id); const add = {};
  if (r.awaken > 0) for (const [k, v] of Object.entries(out)) add[k] = (add[k] || 0) + v * AWAKEN_PCT * r.awaken;
  for (const g of r.gems) for (const [k, v] of Object.entries(gemFx(g))) add[k] = (add[k] || 0) + v;
  return add;
}
const openCost = (row, r) => { const t = tierOf(row); const S = V.stage(t); return { gold: Math.round(S.base * 40 * (r.sockets + 1)), mats: { [V.ID.kl(t)]: 2 * (r.sockets + 1) } }; };
const awakenCost = (row, r) => { const t = tierOf(row); const a = r.awaken + 1; return { gold: Math.round(V.FIRE_EVOLVE_GOLD(t) * 0.5 * a), mats: { [V.ID.bv(t)]: a, [V.ID.kl(t)]: 6 * a } }; };
const matsText = (m) => Object.entries(m).map(([k, n]) => `${n} × ${I.BY_ID[k].name}`).join(', ');
function pay(user, c, why) {
  const me = Cu.getCultivator(user);
  if (me.linh_thach < c.gold) return `Cần ${fmtNum(c.gold)} Linh Thạch (hiện có ${fmtNum(me.linh_thach)}).`;
  if (!Inv.hasAll(user, c.mats)) return `Thiếu nguyên liệu: ${matsText(c.mats)}.`;
  if (!Cu.updateCultivator(user, { linh_thach: new Delta(-c.gold) }, { linh_thach: c.gold })) return Cu.MSG_BALANCE_CHANGED;
  Inv.takeMany(user, c.mats, why); return null;
}
function info(user, gid) {
  const row = gearGet(user, gid); if (!row) return null; const r = rec(gid); const t = tierOf(row);
  return { row, tier: t, ...r, max: maxSockets(t), canAwaken: t >= 6 && row.refine >= 3 && r.awaken < AWAKEN_MAX, openCost: r.sockets < maxSockets(t) ? openCost(row, r) : null, awakenCost: t >= 6 && r.awaken < AWAKEN_MAX ? awakenCost(row, r) : null };
}
function openSocket(user, gid) {
  return D.transaction(() => {
    const row = gearGet(user, gid); if (!row) return { ok: false, msg: 'Không tìm thấy trang bị này.' };
    const r = rec(gid); const t = tierOf(row); if (r.sockets >= maxSockets(t)) return { ok: false, msg: `Trang bị bậc ${t} chỉ có tối đa ${maxSockets(t)} ô khảm.` };
    const err = pay(user, openCost(row, r), 'mở ô khảm'); if (err) return { ok: false, msg: err };
    r.sockets += 1; save(user, gid, r); if (row.equipped) require('./fx17').recompute(user);
    return { ok: true, msg: `🔹 Đã mở **ô khảm ${r.sockets}/${maxSockets(t)}** cho ${require('./gear17').name(row)}.` };
  });
}
function socket(user, gid, idx, gemId) {
  return D.transaction(() => {
    const row = gearGet(user, gid); if (!row) return { ok: false, msg: 'Không tìm thấy trang bị này.' };
    const r = rec(gid); const t = tierOf(row); idx = Number(idx);
    if (!(idx >= 0 && idx < r.sockets)) return { ok: false, msg: 'Ô khảm này chưa được mở.' };
    const gs = gemStage(gemId); if (!gs) return { ok: false, msg: 'Chỉ khảm được Nguyên liệu yêu thú (Yêu Hạch).' };
    if (gs > t) return { ok: false, msg: `Trang bị bậc ${t} chỉ khảm được hạch giai đoạn ≤ ${t}.` };
    if (!Inv.take(user, gemId, 1, { why: 'khảm trang bị' })) return { ok: false, msg: `Bạn không có ${I.BY_ID[gemId].name}.` };
    const old = r.gems[idx]; r.gems[idx] = gemId; r.gems = Array.from({ length: r.sockets }, (_, i) => r.gems[i] || null);
    save(user, gid, r); if (row.equipped) require('./fx17').recompute(user);
    const fx = Object.entries(gemFx(gemId)).map(([k, v]) => `${require('./gear17').LABEL[k] || k} +${(v * 100).toFixed(1)}%`).join(', ');
    return { ok: true, msg: `💎 Khảm **${I.BY_ID[gemId].name}** vào ô ${idx + 1}: ${fx}.${old ? ` (hạch cũ ${I.BY_ID[old].name} đã mất)` : ''}` };
  });
}
function awaken(user, gid) {
  return D.transaction(() => {
    const row = gearGet(user, gid); if (!row) return { ok: false, msg: 'Không tìm thấy trang bị này.' };
    const r = rec(gid); const t = tierOf(row);
    if (t < 6) return { ok: false, msg: 'Chỉ trang bị **bậc 6 trở lên** mới thức tỉnh được.' };
    if (row.refine < 3) return { ok: false, msg: `Cần tinh luyện ≥ 3 (hiện ${row.refine}).` };
    if (r.awaken >= AWAKEN_MAX) return { ok: false, msg: 'Trang bị đã thức tỉnh tối đa.' };
    const rate = AWAKEN_RATE[r.awaken]; const err = pay(user, awakenCost(row, r), 'thức tỉnh'); if (err) return { ok: false, msg: err };
    const win = random() < rate; const nm = require('./gear17').name(row);
    if (win) { r.awaken += 1; save(user, gid, r); if (row.equipped) require('./fx17').recompute(user); }
    return { ok: true, win, msg: win ? `🌟 **Thức tỉnh thành công!** ${nm} đạt **thức tỉnh ${r.awaken}/${AWAKEN_MAX}** (chỉ số chính ×${(1 + AWAKEN_PCT * r.awaken).toFixed(2)}).` : `💨 Thức tỉnh **thất bại** (tỉ lệ ${Math.round(rate * 100)}%) — mất vật liệu, trang bị vẫn nguyên.` };
  });
}
module.exports = { GEM_STAT, AWAKEN_MAX, AWAKEN_RATE, AWAKEN_PCT, maxSockets, rec, bonus, gemFx, gemStage, info, openSocket, socket, awaken, openCost, awakenCost, matsText };
