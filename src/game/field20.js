'use strict';
/**
 * V20.3 — LINH ĐIỀN MỞ RỘNG: Linh Thổ (nâng đất) · Ghép Giống · Lai Tạo (chồng lên field17).
 *  • Linh Thổ cấp 0–5: mỗi cấp +0,04 sản lượng trung bình mỗi lần thu hoạch (cộng vào yAvg → test kinh tế "trồng không có lời" vẫn áp dụng). Nâng cấp tốn Linh Thạch + Linh Dược giai đoạn tương ứng; cần Linh Điền cấp ≥ cấp mới.
 *  • Ghép Giống: 4 Linh Chủng (a) cùng giai đoạn + Linh Thạch → 1 Linh Chủng (b) cùng giai đoạn. Luôn lỗ về giá trị — chỉ để gom hạt.
 *  • Lai Tạo: 1 Linh Chủng (a) + 1 (b) + 1 Linh Dược (b) cùng giai đoạn + Linh Thạch → 25% (+2%/cấp Linh Thực Sư) ra Linh Chủng (a) giai đoạn kế; thất bại mất hết.
 */
const D = require('../db');
const Cu = require('./cultivator');
const Inv = require('./invsvc');
const Cat = require('./catalog17');
const V = require('../data/v20_data');
const { I, C } = Cat;
const { random, fmtNum } = require('../util');
const { Delta } = Cu;

const uid = (u) => String(u);
const SOIL_MAX = 5; const SOIL_YIELD = 0.04;
const soil = (user) => { const r = D.get('SELECT soil FROM v20_field WHERE user_id = ?', uid(user)); return r ? r.soil : 0; };
const soilYield = (user) => SOIL_YIELD * soil(user);
/** xác suất +1 sản phẩm mỗi lần thu hoạch (kì vọng = soilYield). */
const soilChance = (user) => soilYield(user);
const fieldLv = (user) => { const f = D.get('SELECT level FROM linh_dien WHERE user_id = ?', uid(user)); return f ? f.level : 0; };
const soilCost = (L) => ({ gold: Math.round(200000 * 6 ** L), mats: { [V.ID.herb(L + 1, 'a')]: 10, [V.ID.herb(L + 1, 'b')]: 5 } });
const matsText = (m) => Object.entries(m).map(([k, n]) => `${n} × ${I.BY_ID[k].name}`).join(', ');
function pay(user, c, why) {
  const me = Cu.getCultivator(user);
  if (me.linh_thach < c.gold) return `Cần ${fmtNum(c.gold)} Linh Thạch (hiện có ${fmtNum(me.linh_thach)}).`;
  if (!Inv.hasAll(user, c.mats)) return `Thiếu nguyên liệu: ${matsText(c.mats)}.`;
  if (!Cu.updateCultivator(user, { linh_thach: new Delta(-c.gold) }, { linh_thach: c.gold })) return Cu.MSG_BALANCE_CHANGED;
  Inv.takeMany(user, c.mats, why); return null;
}
function upgradeSoil(user) {
  return D.transaction(() => {
    const L = soil(user); if (L >= SOIL_MAX) return { ok: false, msg: 'Linh Thổ đã đạt cấp tối đa.' };
    if (!fieldLv(user)) return { ok: false, msg: 'Bạn chưa có Linh Điền.' };
    if (fieldLv(user) < L + 1) return { ok: false, msg: `Cần Linh Điền cấp ≥ ${L + 1} (hiện ${fieldLv(user)}).` };
    const err = pay(user, soilCost(L), 'nâng Linh Thổ'); if (err) return { ok: false, msg: err };
    D.run('INSERT INTO v20_field (user_id, soil) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET soil = excluded.soil', uid(user), L + 1);
    return { ok: true, msg: `🟫 **Linh Thổ cấp ${L + 1}/${SOIL_MAX}**: sản lượng thu hoạch +${(SOIL_YIELD * (L + 1)).toFixed(2)} cây/lần (trung bình).` };
  });
}
const seedGate = (user, id, s) => { const X = require('./craft17'); const L = X.state(user, 'thuc').level; if (L < s.plv) return `Cần Linh Thực Sư cấp ${C.LEVELS[s.plv - 1].name} để dùng ${I.BY_ID[id].name}.`; return null; };
function fuse(user, n) {
  n = Number(n); const S = V.stage(n); if (!S) return { ok: false, msg: 'Giai đoạn không hợp lệ.' };
  const a = V.ID.seed(n, 'a'); const b = V.ID.seed(n, 'b'); const gold = Math.round(S.base * 3);
  return D.transaction(() => {
    const g = seedGate(user, b, C.SEEDS[b]); if (g) return { ok: false, msg: g };
    const err = pay(user, { gold, mats: { [a]: 4 } }, 'ghép giống'); if (err) return { ok: false, msg: err };
    Inv.add(user, b, 1, { why: 'ghép giống' });
    return { ok: true, msg: `🌱 Ghép 4 × ${I.BY_ID[a].name} → 1 × **${I.BY_ID[b].name}** (−${fmtNum(gold)} Linh Thạch).` };
  });
}
const breedRate = (user) => { const L = require('./craft17').state(user, 'thuc').level; return Math.min(0.5, 0.25 + 0.02 * L); };
const breedCost = (n) => { const S = V.stage(n); return { gold: Math.round(S.base * 6), mats: { [V.ID.seed(n, 'a')]: 1, [V.ID.seed(n, 'b')]: 1, [V.ID.herb(n, 'b')]: 1 } }; };
function breed(user, n) {
  n = Number(n); if (!(n >= 1 && n < 10)) return { ok: false, msg: 'Chỉ lai tạo được giai đoạn 1–9 (ra giống giai đoạn kế).' };
  const to = V.ID.seed(n + 1, 'a');
  return D.transaction(() => {
    const g = seedGate(user, to, C.SEEDS[to]); if (g) return { ok: false, msg: g };
    if (fieldLv(user) < (C.SEEDS[to].fieldLv || 1)) return { ok: false, msg: `Cần Linh Điền cấp ≥ ${C.SEEDS[to].fieldLv} để lai ra ${I.BY_ID[to].name}.` };
    const err = pay(user, breedCost(n), 'lai tạo'); if (err) return { ok: false, msg: err };
    const rate = breedRate(user); const win = random() < rate;
    if (win) Inv.add(user, to, 1, { why: 'lai tạo' });
    return { ok: true, win, msg: win ? `🧬 **Lai tạo thành công!** Nhận 1 × **${I.BY_ID[to].name}** (tỉ lệ ${Math.round(rate * 100)}%).` : `💨 Lai tạo **thất bại** (tỉ lệ ${Math.round(rate * 100)}%) — mất vật liệu.` };
  });
}
module.exports = { SOIL_MAX, SOIL_YIELD, soil, soilYield, soilChance, soilCost, upgradeSoil, fuse, breed, breedCost, breedRate, matsText };
