'use strict';
/**
 * V20.0 — ĐƠN HÀNG NGHỀ NGHIỆP: mỗi ngày 3 đơn (sinh theo ngày + người chơi, ổn định trong ngày), làm theo giai đoạn cao nhất bạn đã đạt.
 * Loại đơn: chế N sản phẩm · khai thác N lượt · thu hoạch N cây · giao nguyên liệu. Mỗi đơn nhận thưởng đúng 1 lần. Thưởng là Linh Thạch + EXP nghề (+ nguyên liệu); trần cố định 3 đơn/ngày.
 */
const crypto = require('crypto');
const D = require('../db');
const Cu = require('./cultivator');
const Inv = require('./invsvc');
const Cat = require('./catalog17');
const X = require('./craft17');
const V = require('../data/v20_data');
const { I, C } = Cat;
const { now, int, fmtNum } = require('../util');
const { Delta } = Cu;

const uid = (u) => String(u);
const PER_DAY = 3;
const rng = (seed) => { let h = crypto.createHash('sha256').update(seed).digest(); let i = 0; return () => { if (i + 4 > h.length) { h = crypto.createHash('sha256').update(h).digest(); i = 0; } const v = h.readUInt32BE(i) / 4294967296; i += 4; return v; }; };
/** Giai đoạn cao nhất theo cảnh giới (để đơn phù hợp sức người chơi). */
const stageNow = (user) => { const me = Cu.getCultivator(user); return me ? V.stageOfRealm(me.realm_index) : 1; };
const PROF_PICK = ['dan', 'khi', 'tran', 'thuc'];
function gen(user, day) {
  const me = Cu.getCultivator(user); if (!me) return [];
  const R = rng(`${uid(user)}|${day}`); const sn = stageNow(user); const S = V.stage(sn); const out = [];
  const kinds = ['craft', 'gather', 'harvest', 'deliver', 'craft', 'deliver'];
  for (let i = 0; i < PER_DAY; i += 1) {
    const kind = kinds[Math.floor(R() * kinds.length)];
    if (kind === 'craft') { const prof = PROF_PICK[Math.floor(R() * 3)]; const need = 2 + Math.floor(R() * 3); out.push({ kind, spec: { prof, stage: Math.max(1, sn - (R() < 0.5 ? 1 : 0)) }, need, rw: Math.round(S.base * need * 0.9), ex: Math.round(S.base * 0.08 * need) }); }
    else if (kind === 'gather') { const need = 1 + Math.floor(R() * 2); out.push({ kind, spec: {}, need, rw: Math.round(S.base * need * 1.2), ex: Math.round(S.base * 0.1 * need) }); }
    else if (kind === 'harvest') { const need = 3 + Math.floor(R() * 4); out.push({ kind, spec: {}, need, rw: Math.round(S.base * need * 0.5), ex: Math.round(S.base * 0.05 * need) }); }
    else { const pool = [V.ID.herb(sn, 'a'), V.ID.ore(sn, 'a'), V.ID.beast(sn), V.ID.tran(sn), V.ID.herb(sn, 'b'), V.ID.ore(sn, 'b')]; const item = pool[Math.floor(R() * pool.length)]; const need = 3 + Math.floor(R() * 4); const unit = Cat.nominal(item); out.push({ kind: 'deliver', spec: { item }, need, rw: Math.round(unit * need * 1.6), ex: Math.round(S.base * 0.06 * need) }); }
  }
  return out;
}
function ensure(user) {
  const day = Inv.dayKey(); const have = D.all('SELECT * FROM v20_orders WHERE user_id = ? AND day = ? ORDER BY idx', uid(user), day);
  if (have.length >= PER_DAY) return have.map(dec);
  return D.transaction(() => {
    gen(user, day).forEach((o, i) => D.run('INSERT OR IGNORE INTO v20_orders (user_id, day, idx, kind, spec, progress, need, state) VALUES (?,?,?,?,?,0,?,?)', uid(user), day, i, o.kind, JSON.stringify({ ...o.spec, rw: o.rw, ex: o.ex }), o.need, 'open'));
    D.run('DELETE FROM v20_orders WHERE user_id = ? AND day < ?', uid(user), day);
    return D.all('SELECT * FROM v20_orders WHERE user_id = ? AND day = ? ORDER BY idx', uid(user), day).map(dec);
  });
}
const dec = (r) => ({ ...r, spec: (() => { try { return JSON.parse(r.spec); } catch (_) { return {}; } })() });
function label(o) {
  const sp = o.spec;
  if (o.kind === 'craft') return `Chế ${o.need} sản phẩm ${C.PROFS[sp.prof].name} (giai đoạn ≥ ${V.stage(sp.stage).name})`;
  if (o.kind === 'gather') return `Hoàn thành ${o.need} lượt khai thác`;
  if (o.kind === 'harvest') return `Thu hoạch ${o.need} cây Linh Điền`;
  return `Giao ${o.need} × ${I.BY_ID[sp.item].name}`;
}
/** Tăng tiến độ đơn (craft/gather/harvest). Trả chuỗi thông báo khi vừa đạt mục tiêu. */
function bump(user, kind, n, ctx = {}) {
  let msg = '';
  for (const o of ensure(user)) {
    if (o.state !== 'open' || o.kind !== kind) continue;
    if (kind === 'craft' && (o.spec.prof !== ctx.prof || (ctx.stage || 1) < o.spec.stage)) continue;
    const np = Math.min(o.need, o.progress + n); D.run('UPDATE v20_orders SET progress = ? WHERE user_id = ? AND day = ? AND idx = ?', np, uid(user), o.day, o.idx);
    if (np >= o.need && o.progress < o.need) msg += `\n📋 Đơn hàng **${label(o)}** đã đủ — vào **Đơn Hàng** để nhận thưởng.`;
  }
  return msg;
}
function claim(user, idx) {
  return D.transaction(() => {
    const day = Inv.dayKey(); ensure(user);
    const o = D.get('SELECT * FROM v20_orders WHERE user_id = ? AND day = ? AND idx = ?', uid(user), day, int(idx)); if (!o) return { ok: false, msg: 'Không có đơn này.' };
    const d = dec(o); if (d.state !== 'open') return { ok: false, msg: 'Đơn này đã nhận thưởng rồi.' };
    if (d.kind === 'deliver') { if (!Inv.take(user, d.spec.item, d.need, { why: 'giao đơn hàng' })) return { ok: false, msg: `Thiếu ${d.need} × ${I.BY_ID[d.spec.item].name}.` }; }
    else if (d.progress < d.need) return { ok: false, msg: `Chưa đủ tiến độ (${d.progress}/${d.need}).` };
    if (D.run("UPDATE v20_orders SET state = 'done', progress = need WHERE user_id = ? AND day = ? AND idx = ? AND state = 'open'", uid(user), day, d.idx).changes === 0) return { ok: false, msg: 'Đơn này đã nhận thưởng rồi.' };
    Cu.updateCultivator(user, { linh_thach: new Delta(d.spec.rw) });
    const prof = d.kind === 'craft' ? d.spec.prof : d.kind === 'gather' ? 'khi' : d.kind === 'harvest' ? 'thuc' : 'dan';
    const g = X.addExp(user, prof, d.spec.ex);
    const S = require('./so20'); S.addStat(user, 'orders', 1);
    return { ok: true, msg: `📋 Hoàn thành đơn hàng: +**${fmtNum(d.spec.rw)}** Linh Thạch, +${fmtNum(g)} EXP ${C.PROFS[prof].name}.${S.checkTitles(user)}` };
  });
}
module.exports = { PER_DAY, ensure, label, bump, claim };
