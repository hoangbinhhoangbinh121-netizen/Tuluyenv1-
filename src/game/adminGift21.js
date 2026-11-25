'use strict';
/**
 * QUẢN TRỊ v21.6.4 — "Tặng & EXP" cho /quantri (mở rộng admin17, KHÔNG thay thế):
 *  • expGrant      : cộng EXP cho MỌI hệ thống có EXP (tu vi, 4 nghề, linh thú, tông môn + cống hiến, bản mệnh, dị hỏa, đạo duyên) — 1 người hoặc cả server.
 *  • phapBao       : tặng / thu / tặng-và-trang-bị Pháp Bảo (5 tầng, hoặc tất cả).
 *  • congPhap      : tặng Công Pháp (cũ 1–7/101/102/201 và V16 1001–1055, hoặc tất cả) kèm đặt cấp.
 *  • danDuoc       : tặng đan dược (tên x số, hoặc "tatca x5") — chỉ nhận vật phẩm thuộc danh mục Đan Dược.
 *  • gearMany      : tặng nhiều trang bị cùng lúc (tên x số, hoặc "tatca").
 *  • giveAll       : tặng vật phẩm cho TOÀN server (có chốt xác nhận).
 * Mọi thao tác đi qua lớp game sẵn có (Inventory Service, gear17, pets.addExpRaw, benmenh19, dihoa20 …) và ghi admin_log17.
 * Thao tác trên nhiều người chơi cần gõ DONGY và có trần số người/số lượng; mỗi người chơi xử lý trong 1 transaction riêng (lỗi một người không làm hỏng cả đợt).
 */
const D = require('../db');
const K = require('./constants');
const Cu = require('./cultivator');
const Inv = require('./invsvc');
const Cat = require('./catalog17');
const A = require('./admin17');
const { I, C } = Cat;
const { int, fmtNum } = require('../util');

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
const EXP_CAP_PER_CALL = 1e12;         // trần mỗi lần cộng (chống gõ nhầm thêm số 0)
const MAX_ITEM_QTY_ALL = 1000;         // trần số lượng mỗi loại khi tặng toàn server / "tatca"
const MAX_PLAYERS = 5000;
const isAllText = (t) => /^(all|tatca|tat ca|toanserver|toan server|moi nguoi|everyone)$/.test(fold(t));
const isConfirm = (t) => String(t || '').trim().toUpperCase() === 'DONGY';
const allIds = () => D.all('SELECT user_id FROM cultivators ORDER BY user_id LIMIT ?', MAX_PLAYERS).map((r) => String(r.user_id));
const num = (t) => { const s = String(t || '').replace(/[.,_\s]/g, ''); return /^\d+$/.test(s) ? Number(s) : null; };

// ------------------------------------------------------------------ cộng EXP
const PROF_KEYS = () => Object.keys(C.PROFS);
function sysOf(text) {
  const f = fold(text); if (!f) return null;
  if (f === 'all' || f === 'tatca' || f === 'tat ca') return { key: 'all' };
  const alias = { tuvi: 'tuvi', 'tu vi': 'tuvi', nghe: 'nghe', 'nghe nghiep': 'nghe', thu: 'thu', 'linh thu': 'thu', linhthu: 'thu', tongmon: 'tongmon', 'tong mon': 'tongmon',
    conghien: 'conghien', 'cong hien': 'conghien', benmenh: 'benmenh', 'ban menh': 'benmenh', dihoa: 'dihoa', 'di hoa': 'dihoa', daolu: 'daolu', 'dao lu': 'daolu', 'dao duyen': 'daolu' };
  if (alias[f]) return { key: alias[f] };                                  // bí danh trước (tránh "thu" khớp nhầm "Linh Thực Sư")
  const prof = PROF_KEYS().find((k) => k === f || fold(C.PROFS[k].name) === f) || (f.length >= 4 ? PROF_KEYS().find((k) => fold(C.PROFS[k].name).includes(f)) : null);
  if (prof) return { key: 'nghe', prof };
  return null;
}
const SYS_LABEL = { tuvi: '✨ Tu vi', nghe: '🎓 Nghề nghiệp', thu: '🐾 Linh Thú', tongmon: '🏯 Tông Môn (EXP)', conghien: '🏯 Cống hiến tông môn', benmenh: '📖 Công Pháp Bản Mệnh (lĩnh ngộ)', dihoa: '🔥 Dị Hỏa', daolu: '💞 Đạo Duyên (thân mật)' };
const ALL_ORDER = ['tuvi', 'nghe', 'thu', 'tongmon', 'conghien', 'benmenh', 'dihoa', 'daolu'];

/** Cộng EXP một hệ thống cho 1 người. Trả { ok, text, got }  — ok=false khi hệ thống không áp dụng được cho người đó. */
function expOne(uid, sys, n) {
  const row = Cu.getCultivator(uid); if (!row) return { ok: false, text: 'chưa tu tiên' };
  switch (sys.key) {
    case 'tuvi': { const nv = Math.min(9e15, row.tu_vi + n); Cu.updateCultivator(uid, { tu_vi: nv }); return { ok: true, got: nv - row.tu_vi, text: `+${fmtNum(nv - row.tu_vi)} tu vi` }; }
    case 'nghe': {
      const X = require('./craft17'); const profs = sys.prof ? [sys.prof] : PROF_KEYS(); const parts = []; let tot = 0;
      for (const p of profs) { X.state(uid, p); const got = X.addExp(uid, p, n); tot += got; parts.push(`${C.PROFS[p].name} +${fmtNum(got)}${got < n ? ' (chạm ngưỡng cấp — cần thăng cấp nghề)' : ''}`); }
      return { ok: true, got: tot, text: parts.join(' · ') };
    }
    case 'thu': {
      const P = require('./pets'); const pets = P.listPets(uid); if (!pets.length) return { ok: false, text: 'chưa có linh thú' };
      let up = 0; let tot = 0; let capped = 0;
      for (const p of pets) { const r = P.addExpRaw(p.pet_id, n); tot += r.gained; up += r.levels; if (r.capped) capped += 1; }
      return { ok: true, got: tot, text: `${pets.length} thú: +${fmtNum(tot)} EXP, lên ${up} cấp${capped ? ` (${capped} thú chạm trần theo cảnh giới chủ)` : ''}` };
    }
    case 'tongmon': {
      if (!row.sect_id) return { ok: false, text: 'chưa vào tông môn' };
      return D.transaction(() => {
        D.run('UPDATE sects SET exp = exp + ? WHERE sect_id = ?', n, row.sect_id);
        let s = D.get('SELECT exp, level FROM sects WHERE sect_id = ?', row.sect_id); let lv = s.level;
        while (lv < 100 && s.exp >= lv * 1000) lv += 1;              // cùng ngưỡng với donateSect: exp tích luỹ ≥ cấp × 1000
        if (lv !== s.level) D.run('UPDATE sects SET level = ? WHERE sect_id = ?', lv, row.sect_id);
        return { ok: true, got: n, text: `+${fmtNum(n)} EXP tông môn${lv !== s.level ? `, thăng cấp ${s.level} → ${lv}` : ''} (tác động cả tông môn)` };
      });
    }
    case 'conghien': { if (!row.sect_id) return { ok: false, text: 'chưa vào tông môn' }; Cu.updateCultivator(uid, { sect_contribution: Math.min(9e15, row.sect_contribution + n) }); return { ok: true, got: n, text: `+${fmtNum(n)} cống hiến` }; }
    case 'benmenh': {
      const BM = require('./benmenh19'); if (!BM.get(uid)) return { ok: false, text: 'chưa có Công Pháp Bản Mệnh' };
      const got = BM.addInsight(uid, n); return { ok: true, got, text: got ? `+${got} lĩnh ngộ (tối đa ${BM.EXP_MAX})` : `thanh lĩnh ngộ đã đầy (${BM.EXP_MAX})` };
    }
    case 'dihoa': {
      const DH = require('./dihoa20'); const fires = DH.owned(uid); if (!fires.length) return { ok: false, text: 'chưa có Dị Hỏa' };
      const before = fires.map((f) => f.lv); fires.forEach((f) => DH.addExp(uid, n, f)); const after = DH.owned(uid).map((f) => f.lv);
      const ups = after.reduce((s, v, i) => s + (v - before[i]), 0); return { ok: true, got: n, text: `${fires.length} ngọn: +${fmtNum(n)} EXP, lên ${ups} cấp` };
    }
    case 'daolu': {
      if (!row.partner_id) return { ok: false, text: 'chưa có đạo lữ' };
      const L = require('./daolu'); const it = Math.min(9e9, int(row.dao_lu_intimacy || 0) + n); const lv = L.daoLuLevelFromIntimacy(it);
      D.run('UPDATE cultivators SET dao_lu_intimacy = ?, dao_lu_level = ? WHERE user_id IN (?, ?)', it, lv, String(uid), String(row.partner_id));
      return { ok: true, got: n, text: `+${fmtNum(n)} thân mật → Đạo Duyên cấp ${lv} (đồng bộ cả đạo lữ)` };
    }
    default: return { ok: false, text: 'hệ thống không hợp lệ' };
  }
}
const SYS_HELP = 'tuvi · nghe (hoặc tên nghề: Đan Sư/Luyện Khí Sư/Trận Pháp Sư/Linh Thực Sư) · thu · tongmon · conghien · benmenh · dihoa · daolu · all';

function expForUser(uid, sys, n) {
  const keys = sys.key === 'all' ? ALL_ORDER : [sys.key]; const lines = [];
  for (const k of keys) {
    let r; try { r = expOne(uid, k === sys.key ? sys : { key: k }, n); } catch (e) { r = { ok: false, text: `lỗi: ${e.message}` }; }
    lines.push({ k, ...r });
  }
  return lines;
}
function parseExpInput(sysText, amtText) {
  const sys = sysOf(sysText); if (!sys) return { err: `❌ Hệ thống không hợp lệ. Có: ${SYS_HELP}.` };
  const n = num(String(amtText || '').replace(/^\+/, '')); if (!n || n <= 0) return { err: '❌ Số EXP phải là số nguyên dương (vd 50000).' };
  if (n > EXP_CAP_PER_CALL) return { err: `❌ Tối đa ${fmtNum(EXP_CAP_PER_CALL)} mỗi lần.` };
  return { sys, n };
}
/** Cộng EXP cho 1 người. */
function expGrant(admin, userText, sysText, amtText) {
  const u = A.resolveUser(userText); if (u.err) return u.err;
  const p = parseExpInput(sysText, amtText); if (p.err) return p.err;
  const lines = expForUser(u.id, p.sys, p.n);
  const okN = lines.filter((l) => l.ok).length;
  A.log(admin, 'cong_exp', u.id, `${p.sys.key}${p.sys.prof ? `:${p.sys.prof}` : ''} ${p.n} → ${lines.map((l) => `${l.k}:${l.ok ? 'ok' : 'bỏ'}`).join(',')}`);
  return `📈 Cộng **${fmtNum(p.n)}** EXP cho <@${u.id}>:\n${lines.map((l) => `${l.ok ? '✅' : '▫️'} ${SYS_LABEL[l.k]}: ${l.text}`).join('\n')}${okN ? '' : '\n⚠️ Không hệ thống nào áp dụng được.'}`;
}
/** Cộng EXP cho CẢ SERVER (cần gõ DONGY). */
function expAll(admin, sysText, amtText, confirm) {
  const p = parseExpInput(sysText, amtText); if (p.err) return p.err;
  if (!isConfirm(confirm)) return '❌ Chưa xác nhận (cần gõ đúng DONGY) — không có gì thay đổi.';
  const ids = allIds(); const tally = {}; let touched = 0;
  for (const id of ids) {
    let any = false;
    for (const l of expForUser(id, p.sys, p.n)) { if (l.ok) { tally[l.k] = (tally[l.k] || 0) + 1; any = true; } }
    if (any) touched += 1;
  }
  A.log(admin, 'cong_exp_toan_server', '', `${p.sys.key}${p.sys.prof ? `:${p.sys.prof}` : ''} ${p.n} · ${touched}/${ids.length} người`);
  return `📈 Đã cộng **${fmtNum(p.n)}** EXP (${p.sys.key === 'all' ? 'mọi hệ thống' : (SYS_LABEL[p.sys.key] || p.sys.key)}) cho **${touched}/${ids.length}** người chơi.\n${Object.entries(tally).map(([k, c]) => `▫️ ${SYS_LABEL[k]}: ${c} người`).join('\n') || '(không ai nhận được)'}`;
}

// ------------------------------------------------------------------ Pháp Bảo
function tiersOf(text) {
  const f = fold(text); const all = K.PHAP_BAO_TIER_DEF;
  if (isAllText(text)) return all.map((t) => t.tier);
  if (/^\d+$/.test(f)) { const t = all.find((x) => x.tier === Number(f)); return t ? [t.tier] : null; }
  const c = all.filter((t) => fold(t.name) === f || fold(t.name).includes(f)); return f.length >= 3 && c.length === 1 ? [c[0].tier] : null;
}
/** mode: 'tang' (mặc định) · 'thu' · 'trangbi' (tặng + trang bị tầng cao nhất vừa chọn). */
function phapBao(admin, userText, tierText, modeText) {
  const u = A.resolveUser(userText); if (u.err) return u.err;
  const tiers = tiersOf(tierText); if (!tiers) return `❌ Pháp Bảo không hợp lệ. Nhập số tầng 1–${K.PHAP_BAO_TIER_DEF.length}, tên, hoặc "tatca". Có: ${K.PHAP_BAO_TIER_DEF.map((t) => `${t.tier}=${t.name}`).join(', ')}.`;
  const m = fold(modeText); const mode = /^(thu|xoa|bo)/.test(m) ? 'thu' : /^(trang|mac|equip)/.test(m) ? 'trangbi' : 'tang';
  const def = (t) => K.PHAP_BAO_TIER_DEF.find((x) => x.tier === t);
  const row = Cu.getCultivator(u.id); const owned = Cu.ownedPhapbaoTiers(row); const up = {}; const lines = [];
  if (mode === 'thu') {
    for (const t of tiers) { if (owned.delete(t)) lines.push(`🧺 thu ${def(t).name}`); else lines.push(`▫️ không có ${def(t).name}`); }
    if (tiers.includes(Cu.equippedPhapbaoTier(row)) && !owned.has(Cu.equippedPhapbaoTier(row))) { up.phap_bao_equipped = 0; up.phap_bao_bonus = 0; lines.push('⬇️ đã tháo pháp bảo đang trang bị'); }
  } else {
    for (const t of tiers) { if (owned.has(t)) lines.push(`▫️ đã có ${def(t).name}`); else { owned.add(t); lines.push(`🎁 tặng ${def(t).name} (+${int(def(t).bonus * 100)}%)`); } }
    if (mode === 'trangbi') { const best = Math.max(...tiers); up.phap_bao_equipped = best; up.phap_bao_bonus = def(best).bonus; lines.push(`⚔️ trang bị ${def(best).name}`); }
  }
  up.phap_bao_owned = [...owned].sort((a, b) => a - b).join(',');
  Cu.updateCultivator(u.id, up);
  A.log(admin, `phap_bao_${mode}`, u.id, `${tiers.join(',')}`);
  return `🔮 Pháp Bảo của <@${u.id}>:\n${lines.join('\n')}`;
}

// ------------------------------------------------------------------ Công Pháp
const D16 = () => require('../data/congphap_v16');
function allBookTiers() { const CP = require('./congphap'); return [...CP.getCurrentCongphapList().map((c) => c.tier), ...D16().BOOKS.map((b) => b.tier)]; }
function bookOf(text) {
  const CPX = require('./congphapV16'); const f = fold(text); const tiers = allBookTiers();
  if (isAllText(text)) return { tiers };
  if (/^\d+$/.test(f)) return tiers.includes(Number(f)) ? { tiers: [Number(f)] } : { err: `❌ Không có công pháp mã ${f}.` };
  const nm = CPX.nameMap(); const hit = tiers.filter((t) => fold(nm[t]) === f); const part = tiers.filter((t) => fold(nm[t]).includes(f));
  const c = hit.length ? hit : part; if (c.length === 1) return { tiers: c }; if (c.length > 1) return { err: `❌ "${text}" khớp nhiều: ${c.slice(0, 8).map((t) => `${t}=${nm[t]}`).join(', ')}.` };
  return { err: `❌ Không tìm thấy công pháp "${text}". Dùng mã (1–7, 101, 102, 201, 1001–1055), tên hoặc "tatca".` };
}
/** Tặng công pháp (+ đặt cấp nếu có levelText). */
function congPhap(admin, userText, bookText, levelText) {
  const u = A.resolveUser(userText); if (u.err) return u.err;
  const b = bookOf(bookText); if (b.err) return b.err;
  const lvl = String(levelText || '').trim() === '' ? null : Math.max(1, Math.min(K.CONGPHAP_MAX_UPGRADE_LEVEL, int(levelText) || 1));
  const CPX = require('./congphapV16'); const nm = CPX.nameMap();
  const row = Cu.getCultivator(u.id); const up = {}; const given = []; const had = [];
  for (const t of b.tiers) { if (CPX.grantInto(up, row, t)) given.push(nm[t]); else had.push(nm[t]); }
  if (Object.keys(up).length) Cu.updateCultivator(u.id, up);
  let lvTxt = '';
  if (lvl) {
    const fresh = Cu.getCultivator(u.id); const map = { ...Cu.congphapLevelsMap(fresh) };
    for (const t of b.tiers) map[t] = Math.max(map[t] || 0, lvl);       // chỉ nâng, không hạ cấp đã có
    Cu.saveCongphapLevels(u.id, map); lvTxt = `\n🔺 Đặt cấp tối thiểu **${lvl}** cho ${b.tiers.length} công pháp.`;
  }
  A.log(admin, 'cho_cong_phap', u.id, `${b.tiers.length > 5 ? `${b.tiers.length} quyển` : b.tiers.join(',')}${lvl ? ` cấp ${lvl}` : ''}`);
  const short = (a) => (a.length > 8 ? `${a.slice(0, 8).join(', ')}… (+${a.length - 8})` : a.join(', '));
  return `📜 Công Pháp của <@${u.id}>: tặng **${given.length}** quyển${given.length ? ` (${short(given)})` : ''}${had.length ? ` · đã có ${had.length}` : ''}.${lvTxt}`;
}

// ------------------------------------------------------------------ Đan dược / vật phẩm theo danh mục
const Q_BY_NAME = new Map(I.QUALITY.map((q, i) => [fold(q && q.name), i]).filter(([k]) => k));
const isDan = (id) => I.BY_ID[id] && I.BY_ID[id].cat === 'DAN_DUOC';
/** Mở rộng "tatca [(Phẩm)] [x N]" thành danh sách thật cho danh mục cat (mặc định DAN_DUOC). */
function expandAll(text, cat, defaultQ = 3) {
  const m = /^\s*(all|tat ?ca)\s*(?:\(([^)]+)\))?\s*(?:[x×*]\s*(\d+))?\s*$/i.exec(fold(text));
  if (!m) return null;
  const q = m[2] ? Q_BY_NAME.get(fold(m[2])) : defaultQ; if (!q) return { err: `❌ Phẩm chất "${m[2]}" không hợp lệ.` };
  const qty = Math.max(1, Math.min(MAX_ITEM_QTY_ALL, int(m[3]) || 1));
  const items = I.ITEMS.filter((it) => it.cat === cat).map((it) => ({ id: it.id, q: it.quality ? q : 0, qty }));
  return { items };
}
function giveList(admin, uid, items, action) {
  const done = []; const bad = [];
  for (const x of items) {
    const got = Inv.add(uid, x.id, x.qty, { q: x.q, why: `admin ${admin}` }); const nm = `${I.BY_ID[x.id].name}${x.q ? ` (${I.qName(x.q)})` : ''}`;
    if (got > 0) done.push({ nm, got }); if (got < x.qty) bad.push(`${nm} ${got}/${x.qty}`);
  }
  return { done, bad };
}
function danDuoc(admin, userText, text) {
  const u = A.resolveUser(userText); if (u.err) return u.err;
  let items; const ex = expandAll(text, 'DAN_DUOC');
  if (ex) { if (ex.err) return ex.err; items = ex.items; }
  else { const p = Inv.parseList(text); if (!p.ok) return `❌ ${p.err}`; items = p.items; const wrong = items.filter((x) => !isDan(x.id)); if (wrong.length) return `❌ Không phải đan dược: ${wrong.map((x) => I.BY_ID[x.id].name).join(', ')}. (Muốn cho vật phẩm khác dùng "Cho vật phẩm".)`; }
  if (!items.length) return '❌ Chưa nhập đan dược nào. Ví dụ: `Tụ Khí Đan (Thượng Phẩm) x5` hoặc `tatca (Thượng Phẩm) x3`.';
  const r = giveList(admin, u.id, items);
  const total = r.done.reduce((s, d) => s + d.got, 0);
  A.log(admin, 'cho_dan_duoc', u.id, `${r.done.length} loại, ${total} viên${r.bad.length ? ` | thiếu chỗ: ${r.bad.slice(0, 5).join('; ')}` : ''}`.slice(0, 480));
  return `💊 Đã cho <@${u.id}> **${fmtNum(total)}** đan dược (${r.done.length} loại${r.done.length <= 6 ? `: ${r.done.map((d) => `${d.got} × ${d.nm}`).join(', ')}` : ''}).${r.bad.length ? `\n⚠️ Kho đầy/đạt trần: ${r.bad.slice(0, 6).join('; ')}${r.bad.length > 6 ? '…' : ''}` : ''}`;
}

// ------------------------------------------------------------------ Trang bị (nhiều món)
function gearIds(text) {
  const ids = Object.keys(C.GEAR); const f = fold(text);
  if (/^(all|tat ?ca)$/.test(f)) return { ids };
  let id = ids.find((k) => k === String(text).trim()) || ids.find((k) => fold(C.GEAR[k].name) === f);
  if (!id) { const c = ids.filter((k) => fold(C.GEAR[k].name).includes(f)); if (c.length === 1) [id] = c; else if (c.length > 1) return { err: `❌ "${text}" khớp nhiều: ${c.map((k) => C.GEAR[k].name).join(', ')}.` }; }
  return id ? { ids: [id] } : { err: `❌ Không có trang bị "${text}".` };
}
/** "Thanh Phong Kiếm x2, Áo Giáp" hoặc "tatca" (mỗi mẫu 1 món); q = phẩm chất 1–5. Tối đa 60 món/lần. */
function gearMany(admin, userText, text, q) {
  const u = A.resolveUser(userText); if (u.err) return u.err;
  const G = require('./gear17'); const qq = Math.max(1, Math.min(5, int(q) || 3)); const made = []; let total = 0;
  for (const part of String(text || '').split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean)) {
    const m = /^(.*?)(?:\s*[x×*]\s*(\d+))?$/i.exec(part); const gi = gearIds(m[1].trim()); if (gi.err) return gi.err;
    const n = Math.max(1, Math.min(60, int(m[2]) || 1)); total += n * gi.ids.length;
    if (total > 60) return '❌ Tối đa 60 món mỗi lần.';
    for (const id of gi.ids) for (let k = 0; k < n; k += 1) made.push({ id, gid: G.create(u.id, id, qq, `admin ${admin}`) });
  }
  if (!made.length) return '❌ Nhập mã hoặc tên trang bị (có thể nhiều món: `Tên x2, Tên khác`, hoặc `tatca`).';
  const by = {}; for (const x of made) by[x.id] = (by[x.id] || 0) + 1;
  A.log(admin, 'cho_trang_bi_nhieu', u.id, `${made.length} món q${qq}: ${Object.entries(by).map(([k, c]) => `${C.GEAR[k].name}×${c}`).join(',')}`.slice(0, 480));
  return `🛡️ Đã cho <@${u.id}> **${made.length}** trang bị phẩm chất ${qq}/5: ${Object.entries(by).slice(0, 10).map(([k, c]) => `${C.GEAR[k].name}${c > 1 ? ` ×${c}` : ''}`).join(', ')}${Object.keys(by).length > 10 ? '…' : ''}.`;
}

// ------------------------------------------------------------------ tặng vật phẩm TOÀN server
function giveAll(admin, text, confirm) {
  const ex = expandAll(text, 'DAN_DUOC'); let items;
  if (ex) { if (ex.err) return ex.err; items = ex.items; } else { const p = Inv.parseList(text); if (!p.ok) return `❌ ${p.err}`; items = p.items; }
  if (!items.length) return '❌ Chưa nhập vật phẩm nào.';
  if (items.some((x) => x.qty > MAX_ITEM_QTY_ALL)) return `❌ Tối đa ${MAX_ITEM_QTY_ALL} mỗi loại khi tặng toàn server.`;
  if (!isConfirm(confirm)) return '❌ Chưa xác nhận (cần gõ đúng DONGY) — không có gì thay đổi.';
  const ids = allIds(); let ok = 0; let full = 0;
  for (const id of ids) {
    try { const r = giveList(admin, id, items); if (r.done.length) ok += 1; if (r.bad.length) full += 1; } catch (_) { /* người chơi này lỗi → bỏ qua, tiếp tục */ }
  }
  A.log(admin, 'cho_vat_pham_toan_server', '', `${items.length} loại × ${ids.length} người`.slice(0, 480));
  return `🎁 Đã tặng ${items.length} loại vật phẩm cho **${ok}/${ids.length}** người chơi${full ? ` (${full} người bị đầy kho/trần một phần)` : ''}.`;
}

module.exports = { expGrant, expAll, expOne, sysOf, SYS_HELP, phapBao, congPhap, danDuoc, gearMany, giveAll, tiersOf, bookOf, expandAll, isDan, MAX_PLAYERS };
