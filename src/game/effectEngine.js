'use strict';
/**
 * v21.6 — EFFECT ENGINE: hiệu ứng có thời hạn + chính sách chồng + nhiều nguồn, dùng chung cho PvP (và các chế độ khác sau này).
 *
 * Quan hệ với code cũ (KHÔNG xoá, KHÔNG nhân đôi):
 *   • fx_buffs / fx17.js  = buff BỀN VỮNG (đan dược, trận pháp) đã được cộng vào Cu.effective* → EffectEngine chỉ ĐỌC qua persistent() để hiển thị/đối chiếu, không tính lại chỉ số.
 *   • cpfx.battleState    = guard/dodge/weak của Công Pháp mới (đếm theo ĐÒN) — giữ nguyên; trùng chức năng sẽ gộp ở V22.0 (Combat Kernel).
 *   • EffectEngine        = hiệu ứng THEO HIỆP trong 1 trận (DoT, khống chế, tăng/giảm tạm). Trạng thái nằm trong store (toJSON/fromJSON để khôi phục trận ở V21.7).
 * Chính sách chồng (policy): refresh · stackDuration · stackIntensity · strongest · replace · unique.
 * Quy ước thời gian: dur = số hiệp CÒN LẠI sau hiệp bị áp. DoT tính ở ĐẦU hiệp kế; hiệu ứng áp trong hiệp r không bị trừ thời hạn ở cuối hiệp r (fresh).
 * Choáng (ctrl/stun): mất ĐÚNG 1 hành động kế tiếp (có thể là chính hiệp này nếu mục tiêu chưa ra đòn), rồi miễn nhiễm `immuneRounds` hiệp.
 */
const { EFFECTS } = require('../data/effects21');

const MAX_DUR = 6;                                     // chốt chặn cho stackDuration
const sides = ['A', 'B'];
const createStore = () => ({ v: 1, fx: { A: [], B: [] }, immune: { A: {}, B: {} }, stunned: { A: false, B: false }, round: 0 });

const defOf = (id) => EFFECTS[id] || null;
const find = (st, side, id) => st.fx[side].find((e) => e.id === id) || null;
const powerOf = (def, power) => (power !== undefined && power !== null ? power : (def.power !== undefined ? def.power : 1));

/** Áp 1 hiệu ứng. Trả { applied, action, effect, line } — action ∈ new|refresh|stack|duration|replace|ignored|immune|stronger. */
function apply(st, target, id, { dur, power, source = null } = {}) {
  const def = defOf(id); if (!def) return { applied: false, action: 'unknown', effect: null, line: '' };
  const d = Math.max(1, Math.min(MAX_DUR, Math.trunc(dur === undefined ? def.dur : dur)));
  const p = powerOf(def, power);
  const label = `${def.icon} **${def.name}**`;
  if (def.kind === 'ctrl') {                                         // choáng: unique + miễn nhiễm sau khi tỉnh
    if (st.immune[target][id] > 0) return { applied: false, action: 'immune', effect: null, line: `🛡️ miễn nhiễm ${label} (vừa hồi phục).` };
    if (st.stunned[target]) return { applied: false, action: 'ignored', effect: null, line: '' };
    st.stunned[target] = true; return { applied: true, action: 'new', effect: { id, dur: 1 }, line: `${label} — mất lượt hành động kế tiếp.` };
  }
  const cur = find(st, target, id);
  if (!cur) { const e = { id, dur: d, power: p, stacks: 1, fresh: true, source }; st.fx[target].push(e); return { applied: true, action: 'new', effect: e, line: `${label} (${d} hiệp).` }; }
  switch (def.policy) {
    case 'refresh': cur.dur = Math.max(cur.dur, d); cur.fresh = true; return { applied: true, action: 'refresh', effect: cur, line: `${label} được làm mới (${cur.dur} hiệp).` };
    case 'stackDuration': cur.dur = Math.min(MAX_DUR, cur.dur + d); cur.fresh = true; return { applied: true, action: 'duration', effect: cur, line: `${label} kéo dài (${cur.dur} hiệp).` };
    case 'stackIntensity': { const max = def.maxStacks || 1; const was = cur.stacks; cur.stacks = Math.min(max, cur.stacks + 1); cur.dur = Math.max(cur.dur, d); cur.fresh = true; return { applied: true, action: was < cur.stacks ? 'stack' : 'refresh', effect: cur, line: `${label} ×${cur.stacks} (${cur.dur} hiệp).` }; }
    case 'strongest':
      if (p > cur.power) { cur.power = p; cur.dur = Math.max(cur.dur, d); cur.fresh = true; return { applied: true, action: 'stronger', effect: cur, line: `${label} mạnh hơn thay thế (${cur.dur} hiệp).` }; }
      if (p === cur.power) { cur.dur = Math.max(cur.dur, d); cur.fresh = true; return { applied: true, action: 'refresh', effect: cur, line: `${label} được làm mới (${cur.dur} hiệp).` }; }
      return { applied: false, action: 'ignored', effect: cur, line: '' };
    case 'replace': cur.dur = d; cur.power = p; cur.stacks = 1; cur.fresh = true; return { applied: true, action: 'replace', effect: cur, line: `${label} bị thay mới (${d} hiệp).` };
    case 'unique': return { applied: false, action: 'ignored', effect: cur, line: '' };
    default: return { applied: false, action: 'ignored', effect: cur, line: '' };
  }
}

/** Đầu hiệp: tính sát thương DoT cho từng bên. Trả { dmg:{A,B}, lines:{A:[],B:[]} } — KHÔNG tự trừ sinh lực (người gọi trừ). */
function startRound(st) {
  st.round += 1; const dmg = { A: 0, B: 0 }; const lines = { A: [], B: [] };
  for (const s of sides) for (const e of st.fx[s]) {
    const def = defOf(e.id); if (!def || def.kind !== 'dot' || e.dur <= 0) continue;
    const d = Math.max(1, Math.round((e.power || def.power || 1) * (e.stacks || 1)));
    dmg[s] += d; lines[s].push(`${def.icon} ${def.name}${(e.stacks || 1) > 1 ? ` ×${e.stacks}` : ''}: −${d} sinh lực.`);
  }
  return { dmg, lines };
}
/** Bên `side` sắp hành động: nếu đang choáng → tiêu choáng, trả true (mất lượt). */
function consumeStun(st, side) {
  if (!st.stunned[side]) return false;
  st.stunned[side] = false; const def = defOf('stun'); st.immune[side].stun = ((def && def.immuneRounds) || 1) + 1; return true;      // +1: endRound của chính hiệp này trừ đi 1 ⇒ miễn nhiễm trọn `immuneRounds` hiệp KẾ TIẾP
}
/** Cuối hiệp: giảm thời hạn (bỏ qua hiệu ứng vừa áp trong hiệp này), hạ miễn nhiễm, xoá hiệu ứng hết hạn. Trả danh sách hiệu ứng vừa hết hạn. */
function endRound(st) {
  const expired = [];
  for (const s of sides) {
    for (const e of st.fx[s]) { if (e.fresh) { e.fresh = false; continue; } e.dur -= 1; }
    const keep = []; for (const e of st.fx[s]) { if (e.dur > 0) keep.push(e); else expired.push({ side: s, id: e.id }); } st.fx[s] = keep;
    for (const k of Object.keys(st.immune[s])) { if (st.immune[s][k] > 0) st.immune[s][k] -= 1; if (st.immune[s][k] <= 0) delete st.immune[s][k]; }
  }
  return expired;
}
/** Xoá hiệu ứng XẤU (dot/ctrl/mod giảm) của 1 bên. Trả số hiệu ứng đã xoá. */
function cleanse(st, side) {
  const isBad = (e) => { const d = defOf(e.id); if (!d) return false; if (d.kind === 'dot') return true; if (d.kind === 'mod') { const m = d.mod || {}; return (m.spdMult !== undefined && m.spdMult < 1) || (m.dmgOut < 0) || (m.dodge < 0 && d.power === undefined) || (m.dr < 0); } return false; };
  const before = st.fx[side].length + (st.stunned[side] ? 1 : 0);
  st.fx[side] = st.fx[side].filter((e) => !isBad(e)); st.stunned[side] = false;
  return before - (st.fx[side].length);
}
/** Tổng hợp mô-đun chỉ số/chiến đấu của 1 bên từ các hiệu ứng 'mod'. */
function modifiers(st, side) {
  const m = { atkMult: 1, defMult: 1, spdMult: 1, dmgOut: 0, dr: 0, dodge: 0, crit: 0 };
  for (const e of st.fx[side]) {
    const def = defOf(e.id); if (!def || def.kind !== 'mod' || e.dur <= 0) continue;
    const mod = def.mod || {};
    for (const [k, v] of Object.entries(mod)) {
      const val = def.scale ? v * (e.power !== undefined ? e.power : 1) : v;          // scale: hệ số (±1) × sức mạnh
      if (k === 'atkMult' || k === 'defMult' || k === 'spdMult') m[k] *= val; else m[k] += val;
    }
  }
  m.dr = Math.min(0.6, Math.max(0, m.dr)); m.dodge = Math.max(-0.3, Math.min(0.5, m.dodge)); m.dmgOut = Math.max(-0.6, Math.min(1.5, m.dmgOut));
  return m;
}
const list = (st, side) => st.fx[side].filter((e) => e.dur > 0).map((e) => ({ ...e, def: defOf(e.id) }));
const describe = (st, side) => {
  const parts = list(st, side).map((e) => `${e.def.icon}${e.def.name}${e.stacks > 1 ? `×${e.stacks}` : ''}(${e.dur})`); if (st.stunned[side]) parts.push('💫Choáng');
  return parts.join(' ');
};
const toJSON = (st) => JSON.stringify(st);
const fromJSON = (s) => { try { const o = typeof s === 'string' ? JSON.parse(s) : s; if (o && o.v === 1 && o.fx) return o; } catch (_) { /* hỏng */ } return createStore(); };

/** Buff bền vững (fx_buffs) → danh sách chuẩn hoá chỉ-đọc, để hiển thị/đối chiếu (không tính lại chỉ số). */
function persistent(userId) {
  try { const FX = require('./fx17'); const t = require('../util').now(); return FX.listBuffs(userId).map((b) => ({ id: b.key, kind: b.kind, fx: b.fxo, remaining: Math.max(0, Math.round(b.until - t)), charges: b.charges, source: 'fx_buffs' })); } catch (_) { return []; }
}
module.exports = { MAX_DUR, createStore, apply, startRound, consumeStun, endRound, cleanse, modifiers, list, describe, toJSON, fromJSON, persistent, defOf };
