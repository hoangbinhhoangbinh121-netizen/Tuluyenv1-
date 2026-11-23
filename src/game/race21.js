'use strict';
/**
 * v21.5 — CHỦNG TỘC & HUYẾT MẠCH (logic + ghi DB). Dữ liệu/số liệu: data/race21.js. Bảng: race_state, race_history (schema_v215).
 *
 * LUỒNG DỮ LIỆU:  race_state ──fxOf(row)──▶ talent.bundle(row) (mục "Chủng Tộc", chung trần CAPS) ──▶ statMult/combatMods/tu/…
 *                 ──▶ stat21.snapshot (đối chiếu Cu.effective*) ──▶ PvP/Boss/Bí Cảnh/Đột phá (các nơi đã đọc bundle sẵn).
 * KHÔNG có đường tính chỉ số thứ hai. Chưa chọn tộc ⇒ fxOf = null ⇒ y hệt V21.4.
 * Mọi thao tác trả phí: trong 1 transaction — trừ Linh Thạch nguyên tử (Delta + guard) → ghi race_state theo khoá lạc quan (version) → ghi race_history.
 * Bất kỳ bước nào hỏng ⇒ ROLLBACK cả khối (không mất Linh Thạch mà không đổi trạng thái, không đổi trạng thái mà không trừ tiền).
 */
const D = require('../db');
const Cu = require('./cultivator');
const R = require('../data/race21');
const { E } = require('./emoji');
const { fmtNum, now: nowSec } = require('../util');

const sid = (x) => String(x);
const get = (userId) => D.get('SELECT * FROM race_state WHERE user_id = ?', sid(userId)) || null;
const raceOf = (st) => (st ? R.RACES[st.race_id] || null : null);
const icon = (r) => E[`race_${r.id}`] || r.icon;
const iconBl = (id) => E[`bl_${id}`] || '🩸';          // v21.5b: emoji pixel huyết mạch (bl_<id>)
const iconEv = (raceId) => E[`rev_${raceId}`] || '🌌';   // dạng tiến hóa (rev_<raceId>)
const iconAw = (n) => (n > 0 ? E[`aw_${Math.min(3, n)}`] || '🌟' : '▫️');
const iconOp = (k) => E[`race_${k}`] || ({ awaken: '🌟', bloodline: '🩸', evolve: '🌌', change: '🔁' })[k];
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.trunc(Number(v) || 0)));

/** Hiệu ứng tổng của 1 hàng race_state (thuần, không DB). */
function fxFromState(st) {
  const race = raceOf(st); if (!race) return null;
  const aw = clampInt(st.awakening_stage, 0, R.AW_MULT.length - 1);
  const lv = clampInt(st.bloodline_level, 0, R.LV_MULT.length - 1);
  const out = {}; const parts = [];
  const add = (fx, m, name) => { const f = {}; for (const [k, v] of Object.entries(fx)) { f[k] = v * m; out[k] = (out[k] || 0) + v * m; } parts.push({ name, mult: m, fx: f }); };
  add(race.passive.fx, R.AW_MULT[aw], race.passive.name);
  const bl = st.bloodline_id && race.bloodlines[st.bloodline_id];
  if (bl && lv > 0) add(bl.fx, R.LV_MULT[lv], `${bl.name} Lv.${lv}`);
  if (st.evolved && race.evolved) add(race.evolved.fx, 1, race.evolved.name);
  return { fx: out, parts, label: `${race.name}${st.evolved ? ` ✦ ${race.evolved.name}` : ''}` };
}
/** Dùng trong talent.bundle: row = hàng cultivators. */
function fxOf(row) {
  if (!row || !row.user_id) return null;
  const st = get(row.user_id); if (!st) return null;
  return fxFromState(st);
}

const lines = (list) => list.map((l) => `${l.ok ? '✅' : '❌'} ${l.text}`);
const realmName = (i) => { try { return require('./constants').REALMS[i].name; } catch (_) { return `bậc ${i}`; } };
const reqLines = (row, st, r) => {
  const L = [];
  if (r.awaken !== undefined) L.push({ ok: (st.awakening_stage || 0) >= r.awaken, text: `Thức tỉnh ≥ **${R.AW_NAMES[r.awaken]}** (hiện ${R.AW_NAMES[st.awakening_stage || 0]})` });
  if (r.level !== undefined) L.push({ ok: (st.bloodline_level || 0) >= r.level, text: `Huyết mạch ≥ **Lv.${r.level}** (hiện Lv.${st.bloodline_level || 0})` });
  if (r.realm !== undefined) L.push({ ok: (row.realm_index || 0) >= r.realm, text: `Cảnh giới ≥ **${realmName(r.realm)}**` });
  if (r.thach) L.push({ ok: (row.linh_thach || 0) >= r.thach, text: `Linh Thạch: **${fmtNum(r.thach)}** (có ${fmtNum(row.linh_thach || 0)})` });
  return L;
};

/** Ghi 1 bước có thể trả phí. build(st,row) → { fields, event, cost, to } hoặc { err }. Mọi thứ trong 1 transaction. */
function apply(userId, build, t = nowSec()) {
  userId = sid(userId);
  const row = Cu.getCultivator(userId); if (!row) return { ok: false, msg: '❌ Bạn chưa bắt đầu tu tiên.' };
  try {
    return D.transaction(() => {
      const st = get(userId);
      const b = build(st, row, t);
      if (b.err) return { ok: false, msg: b.err, lines: b.lines };
      const cost = b.cost || 0;
      if (cost > 0 && !Cu.updateCultivator(userId, { linh_thach: new Cu.Delta(-cost) }, { linh_thach: cost })) return { ok: false, msg: Cu.MSG_BALANCE_CHANGED };
      if (b.create) {
        D.run('INSERT INTO race_state (user_id, race_id, chosen_at, created_at, updated_at) VALUES (?,?,?,?,?)', userId, b.create, t, t, t);
      } else {
        const keys = Object.keys(b.fields);
        const r = D.run(`UPDATE race_state SET ${keys.map((k) => `${k} = ?`).join(', ')}, version = version + 1, updated_at = ? WHERE user_id = ? AND version = ?`, ...keys.map((k) => b.fields[k]), t, userId, st.version);
        if (!r.changes) throw new Error('race_state: xung đột phiên bản (có thao tác khác xen vào)');
      }
      D.run('INSERT INTO race_history (user_id, event_type, from_state, to_state, cost, created_at) VALUES (?,?,?,?,?,?)', userId, b.event, JSON.stringify(st ? snap(st) : null), JSON.stringify(b.to), cost, t);
      return { ok: true, msg: b.msg, state: get(userId), cost };
    });
  } catch (e) {
    if (/xung đột phiên bản|UNIQUE/i.test(String(e.message))) return { ok: false, msg: '⚠️ Có thao tác khác vừa thay đổi hồ sơ chủng tộc của bạn — hãy thử lại.' };
    throw e;
  }
}
const snap = (st) => ({ race: st.race_id, bloodline: st.bloodline_id, level: st.bloodline_level, awaken: st.awakening_stage, evolved: st.evolved });

// ------------------------------------------------------------------ thao tác
/** Chọn tộc LẦN ĐẦU: miễn phí. (Đổi tộc về sau: change()). */
function choose(userId, raceId, t) {
  const race = R.RACES[raceId]; if (!race) return { ok: false, msg: '❌ Chủng tộc không tồn tại.' };
  return apply(userId, (st) => {
    if (st) return { err: `❌ Bạn đã là **${raceOf(st).name}**. Muốn đổi hãy dùng **Đổi Tộc** (mất toàn bộ thức tỉnh/huyết mạch).` };
    return { create: raceId, event: 'choose', cost: 0, to: { race: raceId }, msg: `${icon(race)} Bạn đã chọn **${race.name}** — ${race.passive.name}.` };
  }, t);
}
function change(userId, raceId, t) {
  const race = R.RACES[raceId]; if (!race) return { ok: false, msg: '❌ Chủng tộc không tồn tại.' };
  return apply(userId, (st, row, now) => {
    if (!st) return { err: '❌ Bạn chưa chọn chủng tộc — hãy **chọn** (miễn phí lần đầu).' };
    if (st.race_id === raceId) return { err: `❌ Bạn đang là **${race.name}** rồi.` };
    const wait = (st.changed_at || 0) + R.CHANGE.cooldownSec - now;
    if (wait > 0) return { err: `⏳ Mới đổi tộc gần đây — chờ thêm **${Math.ceil(wait / 3600)} giờ** nữa.` };
    const L = reqLines(row, st, { thach: R.CHANGE.thach }); if (L.some((l) => !l.ok)) return { err: `❌ Chưa đủ điều kiện **Đổi Tộc**:\n${lines(L).join('\n')}`, lines: L };
    return { fields: { race_id: raceId, bloodline_id: '', bloodline_level: 0, awakening_stage: 0, bloodline_exp: 0, evolved: 0, changed_at: now, state_json: '{}' }, event: 'change', cost: R.CHANGE.thach, to: { race: raceId },
      msg: `🔁 Đổi sang **${race.name}**. Đã trừ ${fmtNum(R.CHANGE.thach)} Linh Thạch; thức tỉnh / huyết mạch / tiến hóa cũ đã mất.` };
  }, t);
}
function awaken(userId, t) {
  return apply(userId, (st, row) => {
    if (!st) return { err: '❌ Hãy chọn chủng tộc trước.' };
    if (st.awakening_stage >= R.AWAKEN.length) return { err: `✨ Đã **${R.AW_NAMES[st.awakening_stage]}** — không còn bước thức tỉnh nào nữa.` };
    const r = R.AWAKEN[st.awakening_stage]; const L = reqLines(row, st, r);
    if (L.some((l) => !l.ok)) return { err: `❌ Chưa đủ điều kiện **${R.AW_NAMES[st.awakening_stage + 1]}**:\n${lines(L).join('\n')}`, lines: L };
    return { fields: { awakening_stage: st.awakening_stage + 1 }, event: 'awaken', cost: r.thach, to: { ...snap(st), awaken: st.awakening_stage + 1 },
      msg: `🌟 **${R.AW_NAMES[st.awakening_stage + 1]}!** Nội tại **${raceOf(st).passive.name}** mạnh lên (hiệu lực ×${R.AW_MULT[st.awakening_stage + 1]}; ưu điểm lẫn nhược điểm đều tăng). Đã trừ ${fmtNum(r.thach)} Linh Thạch.` };
  }, t);
}
function pickBloodline(userId, bloodId, t) {
  return apply(userId, (st, row) => {
    if (!st) return { err: '❌ Hãy chọn chủng tộc trước.' };
    const race = raceOf(st); const bl = race.bloodlines[bloodId];
    if (!bl) return { err: '❌ Nhánh huyết mạch không thuộc chủng tộc của bạn.' };
    if (st.bloodline_id) return { err: `❌ Bạn đã mang **${race.bloodlines[st.bloodline_id].name}**. Huyết mạch chỉ đổi được khi **Đổi Tộc**.` };
    const r = R.BLOODLINE_PICK; const L = reqLines(row, st, r);
    if (L.some((l) => !l.ok)) return { err: `❌ Chưa đủ điều kiện **thức tỉnh huyết mạch**:\n${lines(L).join('\n')}`, lines: L };
    return { fields: { bloodline_id: bloodId, bloodline_level: 1, bloodline_exp: (st.bloodline_exp || 0) + r.thach }, event: 'bloodline_pick', cost: r.thach, to: { ...snap(st), bloodline: bloodId, level: 1 },
      msg: `🩸 Huyết mạch **${bl.name}** thức tỉnh (Lv.1). Đã trừ ${fmtNum(r.thach)} Linh Thạch.` };
  }, t);
}
function upgradeBloodline(userId, t) {
  return apply(userId, (st, row) => {
    if (!st) return { err: '❌ Hãy chọn chủng tộc trước.' };
    if (!st.bloodline_id) return { err: '❌ Hãy thức tỉnh một nhánh huyết mạch trước.' };
    if (st.bloodline_level >= 5) return { err: '✨ Huyết mạch đã **Lv.5** (tối đa).' };
    const r = R.BLOODLINE_LEVEL[st.bloodline_level - 1]; const L = reqLines(row, st, r);
    if (L.some((l) => !l.ok)) return { err: `❌ Chưa đủ điều kiện **Huyết mạch Lv.${st.bloodline_level + 1}**:\n${lines(L).join('\n')}`, lines: L };
    return { fields: { bloodline_level: st.bloodline_level + 1, bloodline_exp: (st.bloodline_exp || 0) + r.thach }, event: 'bloodline_up', cost: r.thach, to: { ...snap(st), level: st.bloodline_level + 1 },
      msg: `🩸 Huyết mạch lên **Lv.${st.bloodline_level + 1}** (hiệu lực ×${R.LV_MULT[st.bloodline_level + 1]}). Đã trừ ${fmtNum(r.thach)} Linh Thạch.` };
  }, t);
}
function evolve(userId, t) {
  return apply(userId, (st, row) => {
    if (!st) return { err: '❌ Hãy chọn chủng tộc trước.' };
    if (st.evolved) return { err: '✦ Đã **Tiến Hóa** — không còn bước nào nữa.' };
    const r = R.EVOLVE; const L = reqLines(row, st, r);
    if (L.some((l) => !l.ok)) return { err: `❌ Chưa đủ điều kiện **Tiến Hóa**:\n${lines(L).join('\n')}`, lines: L };
    const ev = raceOf(st).evolved;
    return { fields: { evolved: 1, bloodline_exp: (st.bloodline_exp || 0) + r.thach }, event: 'evolve', cost: r.thach, to: { ...snap(st), evolved: 1 },
      msg: `🌌 **TIẾN HÓA!** ${raceOf(st).name} hóa thành **${ev.name}** — ${ev.desc} Đã trừ ${fmtNum(r.thach)} Linh Thạch.` };
  }, t);
}

/** Bước kế tiếp để hiển thị: { title, lines } hoặc null. */
function nextSteps(row) {
  const st = get(row.user_id); if (!st) return [];
  const out = [];
  if (st.awakening_stage < R.AWAKEN.length) out.push({ title: `Thức tỉnh → ${R.AW_NAMES[st.awakening_stage + 1]}`, lines: lines(reqLines(row, st, R.AWAKEN[st.awakening_stage])) });
  if (!st.bloodline_id) out.push({ title: 'Thức tỉnh Huyết Mạch', lines: lines(reqLines(row, st, R.BLOODLINE_PICK)) });
  else if (st.bloodline_level < 5) out.push({ title: `Huyết mạch → Lv.${st.bloodline_level + 1}`, lines: lines(reqLines(row, st, R.BLOODLINE_LEVEL[st.bloodline_level - 1])) });
  if (!st.evolved) out.push({ title: 'Tiến Hóa', lines: lines(reqLines(row, st, R.EVOLVE)) });
  return out;
}
const historyOf = (userId, n = 8) => D.all('SELECT event_id, event_type, from_state, to_state, cost, created_at FROM race_history WHERE user_id = ? ORDER BY event_id DESC LIMIT ?', sid(userId), n);
const shortOf = (row) => { const st = get(row.user_id); const race = raceOf(st); if (!race) return ''; const bl = st.bloodline_id && race.bloodlines[st.bloodline_id]; return `${icon(race)} ${race.name}${st.evolved ? ` ${iconEv(race.id)} ${race.evolved.name}` : ''}${bl ? ` · ${iconBl(st.bloodline_id)} ${bl.name} Lv.${st.bloodline_level}` : ''} · ${iconAw(st.awakening_stage)} ${R.AW_NAMES[st.awakening_stage]}`; };

module.exports = { R, get, raceOf, icon, iconBl, iconEv, iconAw, iconOp, fxFromState, fxOf, choose, change, awaken, pickBloodline, upgradeBloodline, evolve, nextSteps, reqLines, historyOf, shortOf, realmName };
