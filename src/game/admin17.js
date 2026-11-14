'use strict';
/**
 * QUẢN TRỊ v17.2 — lớp logic cho bảng /quantri (admin của bot). Giao diện KHÔNG tự sửa dữ liệu: mọi thay đổi đi qua đây,
 * mỗi thao tác đều ghi vào admin_log17.
 *  • Vật phẩm & nghề: cho/thu vật phẩm V17 (qua Inventory Service), cho trang bị, đặt cấp/EXP nghề, hoàn tất lò chế.
 *  • Nhân vật: đặt cảnh giới/tầng, tu vi, Linh Thạch/Linh Tinh, hồi phục.
 *  • Kinh tế (chỉnh lúc chạy, lưu bot_settings, có biên an toàn): EXP đột phá, hệ số Tiên, rơi đồ, giá NPC mua/bán.
 *  • Sự kiện: tăng tốc tu luyện (có sẵn), tăng tỉ lệ rơi theo thời hạn; thông báo toàn server.
 */
const D = require('../db');
const K = require('./constants');
const Cu = require('./cultivator');
const Inv = require('./invsvc');
const Cat = require('./catalog17');
const X = require('./craft17');
const G = require('./gear17');
const ST = require('./settings');
const { C } = Cat;
const { int, now, fmtNum } = require('../util');

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();

// ------------------------------------------------------------------ nhật ký
function log(admin, action, target, detail) {
  try { D.run('INSERT INTO admin_log17 (ts, admin_id, action, target, detail) VALUES (?,?,?,?,?)', now(), String(admin), action, target ? String(target) : '', String(detail || '').slice(0, 500)); } catch (_) { /* nhật ký lỗi không làm hỏng thao tác */ }
}
const recent = (n = 15) => D.all('SELECT * FROM admin_log17 ORDER BY id DESC LIMIT ?', Math.max(1, Math.min(500, n)));
function logText(n = 200) {
  return recent(n).map((r) => `${new Date((r.ts + 7 * 3600) * 1000).toISOString().replace('T', ' ').slice(0, 19)} | admin ${r.admin_id} | ${r.action} | ${r.target || '-'} | ${r.detail || ''}`).join('\n') || '(chưa có thao tác nào)';
}

// ------------------------------------------------------------------ chọn người chơi
function parseUser(text) { const m = /\d{15,}/.exec(String(text || '')); return m ? m[0] : null; }
function resolveUser(text) {
  const id = parseUser(text); if (!id) return { err: '❌ Cần ID hoặc @nhắc tên người chơi (dãy số 17–20 chữ số).' };
  const row = Cu.getCultivator(id); if (!row) return { err: `❌ <@${id}> chưa bắt đầu tu tiên.` };
  return { id, row };
}

// ------------------------------------------------------------------ vật phẩm
/** sign > 0: cho · sign < 0: thu. text: "Thanh Linh Thảo x5, Tụ Khí Đan (Thượng Phẩm) x2". */
function items(admin, userText, text, sign = 1) {
  const u = resolveUser(userText); if (u.err) return u.err;
  const p = Inv.parseList(text); if (!p.ok) return `❌ ${p.err}`;
  if (!p.items.length) return '❌ Chưa nhập vật phẩm nào.';
  const done = []; const bad = [];
  for (const x of p.items) {
    if (sign > 0) { const got = Inv.add(u.id, x.id, x.qty, { q: x.q, why: `admin ${admin}` }); (got ? done : bad).push(`${got || 0}/${x.qty} × ${Cat.I.BY_ID[x.id].name}${x.q ? ` (${Cat.I.qName(x.q)})` : ''}${got < x.qty ? ' — kho đầy' : ''}`); }
    else { const ok = Inv.take(u.id, x.id, x.qty, { q: x.q, why: `admin ${admin} thu` }); (ok ? done : bad).push(`${x.qty} × ${Cat.I.BY_ID[x.id].name}${x.q ? ` (${Cat.I.qName(x.q)})` : ''}${ok ? '' : ' — không đủ'}`); }
  }
  log(admin, sign > 0 ? 'cho_vat_pham' : 'thu_vat_pham', u.id, `${done.join(', ')}${bad.length ? ` | lỗi: ${bad.join(', ')}` : ''}`);
  return `${sign > 0 ? '🎁 Đã cho' : '🧺 Đã thu'} <@${u.id}>: ${done.join(', ') || '(không có)'}${bad.length ? `\n⚠️ Không xử lý được: ${bad.join(', ')}` : ''}`;
}
function gear(admin, userText, tplText, q) {
  const u = resolveUser(userText); if (u.err) return u.err;
  const f = fold(tplText); if (!f) return '❌ Nhập mã hoặc tên trang bị.';
  const ids = Object.keys(C.GEAR); let id = ids.find((k) => k === String(tplText).trim()) || ids.find((k) => fold(C.GEAR[k].name) === f);
  if (!id) { const c = ids.filter((k) => fold(C.GEAR[k].name).includes(f)); if (c.length === 1) [id] = c; else if (c.length > 1) return `❌ "${tplText}" khớp nhiều: ${c.map((k) => C.GEAR[k].name).join(', ')}.`; }
  if (!id) return `❌ Không có trang bị "${tplText}". Có: ${ids.map((k) => C.GEAR[k].name).join(', ')}.`;
  const qq = Math.max(1, Math.min(5, int(q) || 3));
  const gid = G.create(u.id, id, qq, `admin ${admin}`);
  log(admin, 'cho_trang_bi', u.id, `${C.GEAR[id].name} q${qq} #${gid}`);
  return `🛡️ Đã cho <@${u.id}> **${C.GEAR[id].name}** (phẩm chất ${qq}/5) — mã #${gid}.`;
}

// ------------------------------------------------------------------ nghề
function profLevel(admin, userText, profText, level, exp) {
  const u = resolveUser(userText); if (u.err) return u.err;
  const f = fold(profText); const prof = Object.keys(C.PROFS).find((k) => k === f || fold(C.PROFS[k].name) === f || fold(C.PROFS[k].name).includes(f));
  if (!prof) return `❌ Nghề không hợp lệ. Có: ${Object.values(C.PROFS).map((p) => `${p.name}`).join(', ')}.`;
  const lv = Math.max(1, Math.min(9, int(level) || 1)); X.state(u.id, prof);
  let ex = exp === '' || exp === undefined || exp === null ? null : Math.max(0, int(exp));
  const lowExp = C.LEVELS[lv - 1].exp; if (ex === null || ex < lowExp) ex = lowExp;       // EXP không thấp hơn ngưỡng của cấp đó
  D.run('UPDATE prof_state SET level = ?, exp = ? WHERE user_id = ? AND prof_id = ?', lv, ex, u.id, prof);
  log(admin, 'dat_cap_nghe', u.id, `${C.PROFS[prof].name} cấp ${lv} exp ${ex}`);
  return `🎓 <@${u.id}> — **${C.PROFS[prof].name}** nay là cấp **${lv}** (${C.LEVELS[lv - 1].name}), EXP nghề ${fmtNum(ex)}.`;
}
function finishJobs(admin, userText) {
  const u = resolveUser(userText); if (u.err) return u.err;
  const r = D.run("UPDATE craft_jobs SET ready_at = ? WHERE user_id = ? AND state = 'brewing' AND ready_at > ?", now() - 1, u.id, now());
  log(admin, 'hoan_tat_lo', u.id, `${r.changes} lò`);
  return `⏩ Đã hoàn tất **${r.changes}** lò chế đang chạy của <@${u.id}> — họ có thể nhận thành phẩm ngay.`;
}

// ------------------------------------------------------------------ nhân vật
const rel = (cur, text, lo = 0, hi = 9e15) => {
  const t = String(text || '').replace(/[.,_\s]/g, ''); if (!/^[+\-=]?\d+$/.test(t)) return null;
  const n = Number(t.replace('=', '')); const v = t[0] === '+' || t[0] === '-' ? cur + n : n;
  return Math.max(lo, Math.min(hi, Math.trunc(v)));
};
function realm(admin, userText, realmText, stageText) {
  const u = resolveUser(userText); if (u.err) return u.err;
  const f = fold(realmText); let ri = /^\d+$/.test(f) ? int(f) : K.REALMS.findIndex((r) => fold(r.name) === f);
  if (ri < 0 || ri >= K.REALMS.length || (/^\d+$/.test(f) && ri < 0)) return `❌ Cảnh giới không hợp lệ (0–${K.REALMS.length - 1} hoặc tên). Có: ${K.REALMS.map((r, i) => `${i}=${r.name}`).join(', ')}.`;
  const cnt = K.totalStageCount(ri); let si = int(stageText) - 1; if (!(si >= 0)) si = 0; si = Math.min(si, cnt - 1);
  const want = ri > K.DOKIEP_REALM_IDX ? 2 : ri > K.HOATHAN_REALM_IDX ? 1 : 0; const wt = Math.max(u.row.world_tier, want);
  Cu.updateCultivator(u.id, { realm_index: ri, stage_index: si, world_tier: wt });
  log(admin, 'dat_canh_gioi', u.id, `${K.REALMS[ri].name} tầng ${si + 1} (thế giới ${wt})`);
  return `🏔️ <@${u.id}> nay ở **${K.REALMS[ri].name}${K.REALMS[ri].stages ? ` · ${K.REALMS[ri].stages[si]}` : ''}**${wt !== u.row.world_tier ? ` — tự nâng thế giới lên bậc ${wt} cho khớp cảnh giới` : ''}. Tu vi hiện có giữ nguyên.`;
}
function tuvi(admin, userText, text) {
  const u = resolveUser(userText); if (u.err) return u.err; const t = fold(text);
  let nv; if (t === 'full' || t === 'day') { const R = require('./realm'); nv = Math.max(u.row.tu_vi, R.tuViRequired(u.row.realm_index, u.row.stage_index, u.row.world_tier)); }
  else nv = rel(u.row.tu_vi, text); if (nv === null) return '❌ Nhập số (vd 5000000), +số / −số để cộng trừ, hoặc `full` để đầy tu vi đột phá.';
  Cu.updateCultivator(u.id, { tu_vi: nv }); log(admin, 'dat_tu_vi', u.id, `${u.row.tu_vi} → ${nv}`);
  return `✨ Tu vi của <@${u.id}>: ${fmtNum(u.row.tu_vi)} → **${fmtNum(nv)}**.`;
}
const CUR = { linh_thach: 'Linh Thạch', linh_tinh: 'Linh Tinh' };
function currency(admin, userText, col, text) {
  const u = resolveUser(userText); if (u.err) return u.err; if (!CUR[col]) return '❌ Loại tiền không hợp lệ.';
  const nv = rel(u.row[col] || 0, text); if (nv === null) return '❌ Nhập số (vd 1000000), +số / −số để cộng trừ.';
  Cu.updateCultivator(u.id, { [col]: nv }); log(admin, `dat_${col}`, u.id, `${u.row[col] || 0} → ${nv}`);
  return `💰 ${CUR[col]} của <@${u.id}>: ${fmtNum(u.row[col] || 0)} → **${fmtNum(nv)}**.`;
}
function heal(admin, userText) {
  const u = resolveUser(userText); if (u.err) return u.err;
  Cu.updateCultivator(u.id, { cur_hp: Cu.effectiveMaxHp(u.row), last_hp_regen: now(), last_dotpha_fail: 0 });
  log(admin, 'hoi_phuc', u.id, 'đầy HP + xoá khoá đột phá hụt');
  return `💖 Đã hồi đầy Sinh Mệnh cho <@${u.id}> và xoá thời gian dưỡng thương sau đột phá hụt.`;
}

// ------------------------------------------------------------------ kinh tế (chỉnh lúc chạy)
const ORIG = { exp: K.EXP_REQUIRED_MULT, minor: K.EXP_GATE_MINOR_MULT, major: K.EXP_GATE_MAJOR_MULT, tien: K.TIEN_EXP_MULT, drop: 1, sell: 1, buy: 1 };
const ECO = {
  exp: { label: 'EXP cần đột phá (gốc)', prop: 'EXP_REQUIRED_MULT', min: 1, max: 100000 },
  minor: { label: 'Hệ số tiểu cảnh giới', prop: 'EXP_GATE_MINOR_MULT', min: 0.01, max: 10 },
  major: { label: 'Hệ số đại cảnh giới', prop: 'EXP_GATE_MAJOR_MULT', min: 0.01, max: 10 },
  tien: { label: 'Hệ số cảnh giới Tiên', prop: 'TIEN_EXP_MULT', min: 1, max: 1000 },
  drop: { label: 'Tỉ lệ rơi nguyên liệu', min: 0, max: 5 },
  sell: { label: 'Giá NPC thu mua', min: 0.1, max: 3 },
  buy: { label: 'Giá NPC bán', min: 0.1, max: 5 },
};
function ecoGet(key) { const v = ST.get(`eco_${key}`, ''); const n = Number(v); return v !== '' && Number.isFinite(n) ? n : ORIG[key]; }
function applyEco() { for (const k of ['exp', 'minor', 'major', 'tien']) K[ECO[k].prop] = ecoGet(k); }
/** Đặt 1 hệ số. value rỗng/'mac_dinh' = về mặc định. Trả { ok, msg }. */
function ecoSet(admin, key, value) {
  const d = ECO[key]; if (!d) return { ok: false, msg: '❌ Hệ số lạ.' };
  const t = fold(value); if (t === '') return { ok: true, skip: true, msg: '' };
  if (['mac dinh', 'macdinh', 'reset', 'default'].includes(t)) { ST.set(`eco_${key}`, ''); applyEco(); log(admin, 'eco_mac_dinh', key, `→ ${ORIG[key]}`); return { ok: true, msg: `↩️ ${d.label}: về mặc định **${ORIG[key]}**.` }; }
  const n = Number(String(value).replace(',', '.').replace(/[\s_]/g, '').replace(/^x/i, ''));
  if (!Number.isFinite(n) || n < d.min || n > d.max) return { ok: false, msg: `❌ ${d.label} phải trong khoảng ${d.min}–${d.max}.` };
  const old = ecoGet(key); ST.set(`eco_${key}`, n); applyEco(); log(admin, 'eco_dat', key, `${old} → ${n}`);
  return { ok: true, msg: `✅ ${d.label}: ${old} → **${n}**.` };
}
function ecoReset(admin) { for (const k of Object.keys(ECO)) ST.set(`eco_${k}`, ''); ST.set('ev_drop_mult', '1'); ST.set('ev_drop_until', '0'); applyEco(); log(admin, 'eco_mac_dinh_tat_ca', '', 'đưa mọi hệ số kinh tế về mặc định'); }
const sellMult = () => ecoGet('sell');
const buyMult = () => ecoGet('buy');

// ------------------------------------------------------------------ sự kiện rơi đồ
function evDrop() { const mult = Number(ST.get('ev_drop_mult', '1')) || 1; const until = Number(ST.get('ev_drop_until', '0')) || 0; const active = mult !== 1 && (until === 0 || until > now()); return { mult: active ? mult : 1, stored: mult, until, active }; }
/** Hệ số rơi đang áp dụng = hệ số kinh tế × sự kiện. Gọi ở đường nóng (drops17.roll). */
const dropMult = () => ecoGet('drop') * evDrop().mult;
function setEvDrop(admin, mult, minutes = 0) {
  const m = Math.max(0.1, Math.min(5, Number(mult) || 1)); ST.set('ev_drop_mult', m); ST.set('ev_drop_until', minutes > 0 ? now() + minutes * 60 : 0);
  log(admin, 'su_kien_roi_do', '', `x${m}${minutes > 0 ? ` ${minutes} phút` : ''}`); return evDrop();
}

/** Sự kiện tăng tốc tu luyện (dùng lại bộ nhớ của /tangtoctuluyen). mult = 1 hoặc 'tat' → tắt. */
function setSpeedEvent(admin, mult, minutes = 0) {
  const off = String(mult).toLowerCase() === 'tat' || Number(mult) === 1; const m = off ? 1 : Number(mult);
  if (!off && !(m >= ST.SPEED_MIN && m <= ST.SPEED_MAX)) return { ok: false, msg: `❌ Hệ số tăng tốc phải từ ${ST.SPEED_MIN} đến ${ST.SPEED_MAX} (hoặc "tat").` };
  const was = ST.speedInfo().active; const info = ST.setSpeed(off ? 1 : m, off ? 0 : Math.max(0, int(minutes)));
  log(admin, off ? 'tat_tang_toc' : 'su_kien_tang_toc', '', off ? 'tắt' : `x${m}${minutes > 0 ? ` ${minutes} phút` : ''}`);
  return { ok: true, off, was, info };
}
function overview() {
  const R = require('./realm'); const sp = ST.speedInfo(); const ev = evDrop();
  const total = (D.get('SELECT COUNT(*) AS n FROM cultivators') || {}).n || 0;
  const today = (D.get('SELECT COUNT(*) AS n FROM admin_log17 WHERE ts >= ?', now() - 86400) || {}).n || 0;
  return { total, today, speed: sp, evDrop: ev, maint: (() => { try { return require('./maintenance').isOn(); } catch (_) { return false; } })(),
    gates: { tuvi0: R.tuViRequired(0, 0, 0), hoathan: R.tuViRequired(K.HOATHAN_REALM_IDX, K.HOATHAN_VIENMAN_STAGE, 0), dokiep: R.tuViRequired(K.DOKIEP_REALM_IDX, K.DOKIEP_VIENMAN_STAGE, 2), chantien: R.tuViRequired(K.DOKIEP_REALM_IDX + 1, 0, 2) } };
}

module.exports = { setSpeedEvent, overview, log, recent, logText, parseUser, resolveUser, items, gear, profLevel, finishJobs, realm, tuvi, currency, heal, ECO, ORIG, ecoGet, ecoSet, ecoReset, applyEco, sellMult, buyMult, evDrop, dropMult, setEvDrop, CUR };
