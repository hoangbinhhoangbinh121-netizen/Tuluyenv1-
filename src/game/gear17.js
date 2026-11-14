'use strict';
/**
 * TRANG BỊ (Pháp Khí) v17 — sản phẩm của Luyện Khí Sư. 7 ô: Binh Khí · Giáp · Ngọc Bội · Gương Hộ Tâm · Ngoa · Giới Chỉ · Linh.
 * Mỗi món là 1 dòng bảng `gear`: phẩm chất 1–5, cường hoá 0–10, tinh luyện 0–5, độ bền. Chỉ số = TỈ LỆ (%) cộng vào nhân vật qua fx17 (có TRẦN) —
 * KHÔNG cộng chỉ số vĩnh viễn như Luyện Khí cũ: tháo ra là hết, hỏng (độ bền 0) là hết, sửa lại là có.
 */
const D = require('../db');
const Cu = require('./cultivator');
const Inv = require('./invsvc');
const FX = require('./fx17');
const Cat = require('./catalog17');
const { I, C } = Cat;
const { now, int, random, randUniform, choice, fmtNum } = require('../util');
const { Delta } = Cu;

const uid = (u) => String(u);
const tpl = (id) => C.GEAR[id] || null;
const get = (user, gearId) => D.get('SELECT * FROM gear WHERE user_id = ? AND gear_id = ?', uid(user), int(gearId)) || null;
const listOf = (user) => D.all('SELECT * FROM gear WHERE user_id = ? ORDER BY equipped DESC, gear_id ASC', uid(user));
const equippedOf = (user) => D.all('SELECT * FROM gear WHERE user_id = ? AND equipped = 1', uid(user));
const sec = (row) => { try { const o = JSON.parse(row.sec || '{}'); return o && typeof o === 'object' ? o : {}; } catch (_) { return {}; } };
const name = (row) => { const t = tpl(row.tpl); return `${t ? t.name : row.tpl}${row.enh ? ` +${row.enh}` : ''}`; };

/** Chỉ số hiện tại của 1 món (đã nhân phẩm chất · cường hoá · tinh luyện). Món hỏng → {}. */
function statsOf(row) {
  const t = tpl(row.tpl); if (!t || row.dura <= 0) return {};
  const qm = I.qMult(row.q); const out = {};
  for (const [k, v] of Object.entries(t.pri)) out[k] = (out[k] || 0) + v * qm * C.enhMult(row.enh);
  const s = sec(row); const rm = C.refineMult(row.refine);
  for (const [k, v] of Object.entries(s)) out[k] = (out[k] || 0) + v * qm * rm;
  return out;
}
const fmtStats = (st) => Object.entries(st).map(([k, v]) => `${LABEL[k] || k} +${(v * 100).toFixed(v * 100 >= 10 ? 0 : 1)}%`).join(' · ') || '(không có chỉ số)';
const LABEL = { atk: 'Công', def: 'Thủ', spd: 'Thân Pháp', hp: 'Sinh Mệnh', tu: 'Tốc độ tu vi', crit: 'Bạo kích', dodge: 'Né tránh', dr: 'Giảm sát thương', pierce: 'Xuyên giáp', lifesteal: 'Hút máu',
  loot: 'Cơ duyên rơi đồ', regen: 'Hồi Sinh Mệnh', failKeep: 'Giữ tu vi khi đột phá hụt', bossDr: 'Giảm đòn Boss' };

// ------------------------------------------------------------------ tạo
function create(user, tplId, q, why = 'chế tạo') {
  const t = tpl(tplId); if (!t) throw new Error(`mẫu trang bị lạ: ${tplId}`);
  const key = choice(Object.keys(t.secPool)); const val = t.secPool[key] * randUniform(0.8, 1.2);
  const dm = Math.round(t.dur * (0.9 + 0.1 * q));
  const r = D.run('INSERT INTO gear (user_id, tpl, q, dura, dura_max, sec, created_at) VALUES (?,?,?,?,?,?,?)', uid(user), tplId, q, dm, dm, JSON.stringify({ [key]: +val.toFixed(4) }), now());
  return r.lastInsertRowid;
}

// ------------------------------------------------------------------ mặc / tháo / thay
function equip(user, gearId) {
  const row = get(user, gearId); if (!row) return { ok: false, msg: 'Không tìm thấy trang bị này.' };
  const t = tpl(row.tpl); const me = Cu.getCultivator(user);
  if (!me) return { ok: false, msg: 'Bạn chưa bắt đầu tu tiên.' };
  if (row.equipped) return { ok: false, msg: `**${name(row)}** đang được mặc rồi.` };
  if (row.dura <= 0) return { ok: false, msg: `**${name(row)}** đã hỏng (độ bền 0) — hãy sửa chữa trước.` };
  if (me.realm_index < t.realm) return { ok: false, msg: `Cần đạt **${require('./constants').REALMS[t.realm].name}** mới mặc được **${t.name}**.` };
  const out = D.transaction(() => {
    const old = D.get('SELECT gear_id FROM gear WHERE user_id = ? AND equipped = 1 AND tpl IN (' + Object.keys(C.GEAR).filter((k) => C.GEAR[k].slot === t.slot).map(() => '?').join(',') + ')', uid(user), ...Object.keys(C.GEAR).filter((k) => C.GEAR[k].slot === t.slot));
    if (old) D.run('UPDATE gear SET equipped = 0 WHERE gear_id = ?', old.gear_id);
    D.run('UPDATE gear SET equipped = 1 WHERE gear_id = ? AND user_id = ?', row.gear_id, uid(user));
    FX.recompute(user);
    return { replaced: !!old };
  });
  return { ok: true, msg: `${C.SLOTS[t.slot].icon} Đã mặc **${name(row)}** (${I.qName(row.q)})${out.replaced ? ' — thay món cũ ở ô này' : ''}.\n${fmtStats(statsOf(row))}` };
}
function unequip(user, gearId) {
  const row = get(user, gearId); if (!row) return { ok: false, msg: 'Không tìm thấy trang bị này.' };
  if (!row.equipped) return { ok: false, msg: 'Món này đang không được mặc.' };
  D.run('UPDATE gear SET equipped = 0 WHERE gear_id = ? AND user_id = ?', row.gear_id, uid(user)); FX.recompute(user);
  return { ok: true, msg: `Đã tháo **${name(row)}** — chỉ số từ món này không còn.` };
}
function setLock(user, gearId, on) { D.run('UPDATE gear SET locked = ? WHERE gear_id = ? AND user_id = ?', on ? 1 : 0, int(gearId), uid(user)); return !!on; }

// ------------------------------------------------------------------ độ bền
/** Trừ độ bền món ĐANG MẶC sau PvP / Boss / Chiến Tông Môn. Món nào về 0 → mất hiệu lực ngay. */
function wear(user, kind) {
  const loss = C.DURA_LOSS[kind] || 1;
  const has = D.get('SELECT 1 AS x FROM gear WHERE user_id = ? AND equipped = 1 AND dura > 0 LIMIT 1', uid(user)); if (!has) return [];
  const broke = D.all('SELECT * FROM gear WHERE user_id = ? AND equipped = 1 AND dura > 0 AND dura <= ?', uid(user), loss).map(name);
  D.run('UPDATE gear SET dura = MAX(0, dura - ?) WHERE user_id = ? AND equipped = 1 AND dura > 0', loss, uid(user));
  if (broke.length) FX.recompute(user);
  return broke;
}
function repairCost(row) {
  const t = tpl(row.tpl); const miss = Math.ceil(row.dura_max - row.dura);
  return { miss, gold: miss * C.REPAIR.goldPerPoint * t.tier, mat: [C.REPAIR.mat[0], Math.ceil(miss / C.REPAIR.perMat)] };
}
function repair(user, gearId) {
  const row = get(user, gearId); if (!row) return { ok: false, msg: 'Không tìm thấy trang bị này.' };
  const c = repairCost(row); if (c.miss <= 0) return { ok: false, msg: 'Trang bị còn nguyên vẹn.' };
  return D.transaction(() => {
    const me = Cu.getCultivator(user);
    if (me.linh_thach < c.gold) return { ok: false, msg: `Cần ${fmtNum(c.gold)} Linh Thạch để sửa (hiện có ${fmtNum(me.linh_thach)}).` };
    if (Inv.qty(user, c.mat[0]) < c.mat[1]) return { ok: false, msg: `Cần ${c.mat[1]} × ${I.BY_ID[c.mat[0]].name}.` };
    if (!Cu.updateCultivator(user, { linh_thach: new Delta(-c.gold) }, { linh_thach: c.gold })) return { ok: false, msg: Cu.MSG_BALANCE_CHANGED };
    Inv.take(user, c.mat[0], c.mat[1], { why: 'sửa trang bị' });
    D.run('UPDATE gear SET dura = dura_max WHERE gear_id = ? AND user_id = ?', row.gear_id, uid(user));
    if (row.equipped) FX.recompute(user);
    return { ok: true, msg: `🔧 Đã sửa **${name(row)}** — độ bền ${row.dura_max}/${row.dura_max} (−${fmtNum(c.gold)} Linh Thạch, −${c.mat[1]} ${I.BY_ID[c.mat[0]].name}).` };
  });
}

// ------------------------------------------------------------------ cường hoá / tinh luyện
const techBonus = (user, key) => { try { return require('./craft17').techFx(user, 'khi')[key] || 0; } catch (_) { return 0; } };
function enhance(user, gearId) {
  const row = get(user, gearId); if (!row) return { ok: false, msg: 'Không tìm thấy trang bị này.' };
  if (row.enh >= C.ENH_MAX) return { ok: false, msg: `**${name(row)}** đã đạt cấp cường hoá tối đa (+${C.ENH_MAX}).` };
  const t = tpl(row.tpl); const c = C.enhCost(row.enh, t.tier);
  const mats = { [c.mat[0]]: c.mat[1] }; if (c.cat) mats[c.cat] = 1;
  return D.transaction(() => {
    const me = Cu.getCultivator(user);
    if (me.linh_thach < c.gold) return { ok: false, msg: `Cần ${fmtNum(c.gold)} Linh Thạch (hiện có ${fmtNum(me.linh_thach)}).` };
    if (!Inv.hasAll(user, mats)) return { ok: false, msg: `Thiếu nguyên liệu: ${Object.entries(mats).map(([k, n]) => `${n} × ${I.BY_ID[k].name}`).join(', ')}.` };
    if (!Cu.updateCultivator(user, { linh_thach: new Delta(-c.gold) }, { linh_thach: c.gold })) return { ok: false, msg: Cu.MSG_BALANCE_CHANGED };
    Inv.takeMany(user, mats, 'cường hoá');
    const rate = Math.min(0.97, c.rate + techBonus(user, 'enh'));
    const win = random() < rate;
    let msg;
    if (win) { D.run('UPDATE gear SET enh = enh + 1 WHERE gear_id = ?', row.gear_id); msg = `🔨 **Cường hoá thành công!** ${t.name} lên **+${row.enh + 1}** (tỉ lệ ${Math.round(rate * 100)}%).`; }
    else if (c.downOnFail && row.enh > 0) { D.run('UPDATE gear SET enh = enh - 1 WHERE gear_id = ?', row.gear_id); msg = `💥 Cường hoá **thất bại** — ${t.name} tụt về **+${row.enh - 1}** (tỉ lệ ${Math.round(rate * 100)}%).`; }
    else msg = `💨 Cường hoá **thất bại** — mất nguyên liệu, trang bị giữ nguyên **+${row.enh}** (tỉ lệ ${Math.round(rate * 100)}%).`;
    if (row.equipped) FX.recompute(user);
    try { const X = require('./craft17'); X.addExp(user, 'khi', win ? 12 + row.enh * 6 : 4); if (win) X.bumpExtra(user, 'khi', 'maxEnh', row.enh + 1, 'max'); X.checkAch(user, 'khi'); } catch (e) { console.warn('⚠️ exp cường hoá:', e.message); }
    return { ok: true, win, msg };
  });
}
function refine(user, gearId) {
  const row = get(user, gearId); if (!row) return { ok: false, msg: 'Không tìm thấy trang bị này.' };
  if (row.refine >= C.REFINE_MAX) return { ok: false, msg: `**${name(row)}** đã tinh luyện tối đa (${C.REFINE_MAX}).` };
  const t = tpl(row.tpl); const c = C.refineCost(row.refine, t.tier);
  return D.transaction(() => {
    const me = Cu.getCultivator(user);
    if (me.linh_thach < c.gold) return { ok: false, msg: `Cần ${fmtNum(c.gold)} Linh Thạch (hiện có ${fmtNum(me.linh_thach)}).` };
    if (!Inv.hasAll(user, c.mats)) return { ok: false, msg: `Thiếu nguyên liệu: ${Object.entries(c.mats).map(([k, n]) => `${n} × ${I.BY_ID[k].name}`).join(', ')}.` };
    if (!Cu.updateCultivator(user, { linh_thach: new Delta(-c.gold) }, { linh_thach: c.gold })) return { ok: false, msg: Cu.MSG_BALANCE_CHANGED };
    Inv.takeMany(user, c.mats, 'tinh luyện');
    const rate = Math.min(0.95, c.rate + techBonus(user, 'enh'));
    const win = random() < rate;
    let msg;
    if (win) {
      const s = sec(row);
      if (row.refine + 1 === 3 && Object.keys(t.secPool).length >= 1) {   // tinh luyện 3 mở thêm 1 thuộc tính phụ nhỏ
        const pool = Object.keys(C.GEAR).length ? ['dr', 'dodge', 'crit', 'regen'].filter((k) => !(k in s)) : [];
        const k = pool.length ? choice(pool) : null; if (k) s[k] = { dr: 0.015, dodge: 0.012, crit: 0.012, regen: 0.06 }[k];
      }
      D.run('UPDATE gear SET refine = refine + 1, sec = ? WHERE gear_id = ?', JSON.stringify(s), row.gear_id);
      msg = `✨ **Tinh luyện thành công!** ${t.name} đạt **tinh luyện ${row.refine + 1}/${C.REFINE_MAX}** (thuộc tính phụ ×${C.refineMult(row.refine + 1).toFixed(1)}).`;
    } else msg = `💨 Tinh luyện **thất bại** — mất nguyên liệu (tỉ lệ ${Math.round(rate * 100)}%), trang bị không đổi.`;
    if (row.equipped) FX.recompute(user);
    try { const X = require('./craft17'); X.addExp(user, 'khi', win ? 20 + row.refine * 10 : 6); X.checkAch(user, 'khi'); } catch (e) { console.warn('⚠️ exp tinh luyện:', e.message); }
    return { ok: true, win, msg };
  });
}

// ------------------------------------------------------------------ phân giải
const PHOI_BY_TIER = { 1: 'pk_tho', 2: 'pk_trung', 3: 'pk_trung', 4: 'pk_cao', 5: 'pk_tien' };
function dismantle(user, gearId) {
  const row = get(user, gearId); if (!row) return { ok: false, msg: 'Không tìm thấy trang bị này.' };
  if (row.equipped) return { ok: false, msg: 'Hãy tháo trang bị ra trước khi phân giải.' };
  if (row.locked) return { ok: false, msg: 'Trang bị đang bị khoá — mở khoá trước.' };
  const t = tpl(row.tpl);
  return D.transaction(() => {
    if (D.run('DELETE FROM gear WHERE gear_id = ? AND user_id = ? AND equipped = 0 AND locked = 0', row.gear_id, uid(user)).changes === 0) return { ok: false, msg: 'Không phân giải được (trang bị vừa thay đổi).' };
    const got = {};
    const phoi = PHOI_BY_TIER[t.tier]; if (random() < Cat.DISMANTLE[phoi] + 0.05 * (row.q - 1)) got[phoi] = 1;
    if (random() < Cat.DISMANTLE.tdc_khi_linh_hach + 0.05 * (row.q - 1)) got.tdc_khi_linh_hach = 1;
    if (t.tier >= 4 && random() < Cat.DISMANTLE.tdc_manh_ban_ve) got.tdc_manh_ban_ve = 1;
    const klId = row.enh >= 8 ? 'kl_tu' : row.enh >= 4 ? 'kl_huyen' : 'kl_dong'; const klN = Math.floor(row.enh / 2); if (klN > 0) got[klId] = (got[klId] || 0) + klN;
    const real = Inv.addMany(user, got, 'phân giải');
    try { const X = require('./craft17'); X.addExp(user, 'khi', 6 * t.tier); } catch (_) { /* bỏ qua */ }
    const txt = Object.entries(real).map(([k, n]) => `${n} × ${I.BY_ID[k].name}`).join(', ');
    return { ok: true, msg: `🧰 Đã phân giải **${name(row)}**${txt ? ` → nhận ${txt}` : ' → không thu được gì'}.` };
  });
}

// ------------------------------------------------------------------ giá bán NPC cho trang bị
function sellValue(row) {
  const gv = Cat.GEAR_VALUE[row.tpl]; if (!gv) return 0;
  const qf = [0, 0.7, 1.0, 1.2, 1.4, 1.6][row.q] || 1; const wearF = 0.5 + 0.5 * (row.dura / row.dura_max);
  return Math.max(1, Math.floor(gv.npc * qf * wearF));
}

module.exports = { tpl, get, listOf, equippedOf, statsOf, fmtStats, LABEL, name, create, equip, unequip, setLock, wear, repairCost, repair, enhance, refine, dismantle, sellValue, sec };
