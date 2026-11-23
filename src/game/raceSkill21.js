'use strict';
/**
 * v21.6 — KỸ NĂNG CHỦ ĐỘNG CỦA CHỦNG TỘC (PvP). Dữ liệu: data/effects21.js RACE_SKILLS. Hiệu ứng: game/effectEngine.js.
 * Mở khoá khi thức tỉnh ≥ unlockAwaken. Hồi chiêu (cd) tính theo hiệp, tiến hóa −1. Tiêu hao: sinh lực (Ma Tộc — không bao giờ tự giết).
 * Luồng: combat21.playRound → RS.isAction? → self: castSelf() (cờ `free` = vẫn ra đòn thường trong hiệp, mặc định cho mọi kỹ năng tự thân ở v21.6 — benchmark: tốn cả lượt thì 4 tộc tự thân thua nặng) | attack: params() cho roundAction + after() áp hiệu ứng lên đối thủ.
 */
const RC = require('./race21');
const FXE = require('./effectEngine');
const { RACE_SKILLS } = require('../data/effects21');
const { random } = require('../util');

/** Kỹ năng của 1 hàng nhân vật, hoặc null (chưa chọn tộc / chưa mở khoá). */
function forRow(row) {
  if (!row || !row.user_id) return null;
  const st = RC.get(row.user_id); if (!st) return null;
  const def = RACE_SKILLS[st.race_id]; if (!def || st.awakening_stage < def.unlockAwaken) return null;
  return { def, action: `${RC.icon(RC.raceOf(st))} ${def.name}`, cd: Math.max(1, def.cd - (st.evolved ? 1 : 0)), raceId: st.race_id };
}
const of = (b, side) => (b.race && b.race[side]) || null;
const isAction = (b, side, action) => { const s = of(b, side); return !!s && action === s.action; };
const available = (b, side) => { const s = of(b, side); return !!s && (b.cd[side].race || 0) <= 0; };
/** Bộ chọn của đấu tự động: có kỹ năng sẵn sàng → dùng với xác suất 70%. */
const autoPick = (b, side) => (available(b, side) && random() < 0.7 ? of(b, side).action : null);

function castSelf(b, side, foe) {
  const s = of(b, side); const d = s.def; const lines = []; const tag = b.tag[side]; const hp = b.hp;
  lines.push(`${tag} thi triển **${s.action}**!`);
  if (d.costHp) { const pay = Math.max(0, Math.min(d.costHp, hp[side] - 1)); hp[side] -= pay; lines.push(`🩸 ${tag} hiến tế ${pay} sinh lực.`); }
  if (d.heal && hp[side] > 0) { const before = hp[side]; hp[side] = Math.min(100, before + d.heal); if (hp[side] > before) { lines.push(`💚 ${tag} hồi ${hp[side] - before} sinh lực.`); b.totals[side].heal += hp[side] - before; } }
  if (d.cleanse) { const n = FXE.cleanse(b.fx, side); if (n > 0) lines.push(`✨ ${tag} xoá ${n} hiệu ứng xấu.`); }
  for (const e of d.applySelf || []) { const r = FXE.apply(b.fx, side, e.id, { dur: e.dur, power: e.power, source: side }); if (r.line) lines.push(`${tag}: ${r.line}`); }
  for (const e of d.applyFoe || []) { const r = FXE.apply(b.fx, foe, e.id, { dur: e.dur, power: e.power, source: side }); if (r.line) lines.push(`${b.tag[foe]}: ${r.line}`); }
  return lines;
}
/** Tham số cho roundAction khi là kỹ năng tấn công. */
const params = (b, side) => { const d = of(b, side).def; return { skillDmg: d.dmg || 1.15, critAdd: d.critAdd || 0 }; };
/** Sau đòn: áp hiệu ứng lên đối thủ khi trúng / bạo kích. */
function after(b, side, foe, rec) {
  const d = of(b, side).def; const lines = [];
  const hit = rec && !rec.dodge && rec.damage > 0;
  const go = (list) => { for (const e of list || []) { const r = FXE.apply(b.fx, foe, e.id, { dur: e.dur, power: e.power, source: side }); if (r.line) lines.push(`${b.tag[foe]}: ${r.line}`); } };
  if (hit) go(d.applyFoeOnHit);
  if (hit && rec.is_crit) go(d.applyFoeOnCrit);
  return lines;
}
module.exports = { forRow, of, isAction, available, autoPick, castSelf, params, after, RACE_SKILLS };
