'use strict';
/**
 * v21.7 — Thanh sinh lực PvP theo "HP thật có giới hạn" (xem docs/audit_v21_3/13_HP_THAT_PVP_V21_7.md).
 * hpPool vẫn là { A, B } (đơn vị = điểm thanh) nhưng mỗi bên có TRẦN riêng, gắn vào hpPool dưới thuộc tính không liệt kê `max`.
 * Mọi chỗ hồi sinh lực dùng cap(hp, side) thay cho số 100 cố định. Chế độ cũ ('norm') → cả hai trần = 100 (hành vi y như trước).
 */
const cap = (hp, side) => { const m = hp && hp.max && hp.max[side]; return m > 0 ? m : 100; };
function attach(hp, max) {
  if (Object.prototype.hasOwnProperty.call(hp, 'max')) hp.max = max; else Object.defineProperty(hp, 'max', { value: max, enumerable: false, writable: true });
  return hp;
}
/** Trần thanh theo HP thật: factor = clamp((maxHp / trungBình)^exp, lo, hi) × 100. */
function bars(maxA, maxB, { mode = 'real', exp = 0.5, lo = 0.6, hi = 1.6 } = {}) {
  if (mode !== 'real' || !(maxA > 0) || !(maxB > 0)) return { A: 100, B: 100 };
  const ref = (maxA + maxB) / 2; const f = (m) => Math.max(lo, Math.min(hi, (m / ref) ** exp));
  return { A: Math.round(100 * f(maxA)), B: Math.round(100 * f(maxB)) };
}
module.exports = { cap, attach, bars };
