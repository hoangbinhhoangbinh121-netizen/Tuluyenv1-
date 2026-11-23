'use strict';
/**
 * v21.6 — STAT ENGINE: chồng "chỉ số trong trận" lên nguồn sự thật có sẵn, KHÔNG tính lại công thức đã có.
 *
 *   Giai đoạn 1  BỀN VỮNG   = stat21.snapshot(row)  (công pháp, pháp bảo, trang bị/đan/trận, Ngũ Suy, thể chất, rương, CHỦNG TỘC qua talent.bundle) — đã gồm
 *                             Cu.effective*; `check.ok` đối chiếu hai đường. StatEngine KHÔNG cộng lại bất cứ thứ gì ở giai đoạn này (tránh double-count).
 *   Giai đoạn 2  TRONG TRẬN = EffectEngine.modifiers(store, side) (Hộ Thể, Suy Nhược, Băng Phong, Cuồng Huyết, Linh Thân…) — theo hiệp, có hạn.
 *   Giai đoạn 3  CHỐT CHẶN  = trần/sàn từng đại lượng (đã nằm trong effectEngine.modifiers; ở đây chỉ gộp với chỉ số bền vững của combatMods).
 *
 * Thứ tự nhân/cộng được ghi lại trong `stages` để hiện cho người chơi/admin (vì sao Công hiệp này là X). combat21.playRound dùng `applyBattle`; mã cũ gọi Cu.effective* vẫn chạy
 * y hệt (sẽ chuyển dần ở V22.0 khi có Combat Kernel).
 */
const FXE = require('./effectEngine');
const { int } = require('../util');

/** Pure: gộp chỉ số bền vững (`base` = {atk,def,spd}, `mods` = combatMods của talent {crit,dodge,dr,…}) với hiệu ứng trong trận `fm` (FXE.modifiers hoặc null). */
function applyBattle(base, mods, fm) {
  const m = mods || {};
  if (!fm) return { atk: base.atk, def: base.def, spd: base.spd, mods: { ...m }, stages: [{ stage: 'persistent', atk: base.atk, def: base.def, spd: base.spd }] };
  const atk = Math.max(1, int(base.atk * fm.atkMult)); const def = Math.max(1, int(base.def * fm.defMult)); const spd = base.spd * fm.spdMult;
  const out = { ...m, crit: (m.crit || 0) + fm.crit, dodge: (m.dodge || 0) + fm.dodge, dr: 1 - (1 - (m.dr || 0)) * (1 - fm.dr), dmgMult: 1 + fm.dmgOut };
  return { atk, def, spd, mods: out, stages: [{ stage: 'persistent', atk: base.atk, def: base.def, spd: base.spd }, { stage: 'effects', atkMult: fm.atkMult, defMult: fm.defMult, spdMult: fm.spdMult, dmgOut: fm.dmgOut, dr: fm.dr, dodge: fm.dodge, crit: fm.crit }] };
}

/** Đọc đầy đủ cho 1 người chơi: snapshot bền vững + hiệu ứng trong trận (store có thể null). */
function forUser(row, store, side) {
  const SS = require('./stat21'); const snap = SS.snapshot(row);
  const r = applyBattle({ atk: snap.atk, def: snap.def, spd: snap.spd }, snap.combat, store ? FXE.modifiers(store, side) : null);
  return { ...r, maxHp: snap.maxHp, lucChien: snap.lucChien, check: snap.check, snapshot: snap };
}

/** Dòng chữ giải thích các giai đoạn. */
function explain(r) {
  const e = r.stages.find((s) => s.stage === 'effects'); const p = r.stages[0];
  const parts = [`Bền vững: Công ${p.atk} · Thủ ${p.def} · Tốc ${p.spd}`];
  if (e) { const t = []; if (e.atkMult !== 1) t.push(`Công ×${e.atkMult}`); if (e.defMult !== 1) t.push(`Thủ ×${e.defMult}`); if (e.spdMult !== 1) t.push(`Tốc ×${e.spdMult}`); if (e.dmgOut) t.push(`Sát thương gây ${e.dmgOut > 0 ? '+' : ''}${Math.round(e.dmgOut * 100)}%`); if (e.dr) t.push(`Giảm sát thương +${Math.round(e.dr * 100)}%`); if (e.dodge) t.push(`Né ${e.dodge > 0 ? '+' : ''}${Math.round(e.dodge * 100)}%`); if (e.crit) t.push(`Bạo kích +${Math.round(e.crit * 100)}%`); if (t.length) parts.push(`Hiệu ứng: ${t.join(', ')}`); }
  return parts.join(' → ');
}
module.exports = { applyBattle, forUser, explain };
