'use strict';
/**
 * THỂ CHẤT & LINH CĂN — các thao tác GHI DB (v13.6).  Lõi tính toán thuần nằm ở talent.js.
 *
 *  • ensure / migrateAll : đồng bộ hồ sơ lưu trong DB với phẩm cấp hiện có (người chơi cũ, sau Tẩy Tủy / giao dịch).
 *  • progFields / addProg : cộng "tiến độ tích lũy" (điều kiện thức tỉnh / tiến hóa).
 *  • awaken* / evolve*   : thức tỉnh & tiến hóa — trừ tài nguyên NGUYÊN TỬ (Delta + guard) rồi mới ghi kết quả.
 *  • exchange            : đổi Thiên Đạo Thạch / Đạo Nguyên Tinh → Thiên Bảo (đường kiếm Thiên Bảo ổn định, chậm).
 *  • drops               : Thiên Bảo & Truyền Thừa rơi từ Bí Cảnh / Boss / Đột Phá đại cảnh giới / Thiên Kiếp.
 */
const D = require('../db');
const Cu = require('./cultivator');
const T = require('./talent');
const { random, int, fmtNum } = require('../util');

const { E } = require('./emoji');   // v13.9: icon pixel (tự rơi về Unicode 🧿 🔮 📜 nếu chưa tải lên)
const ITEM = {
  bao_the_chat: { get icon() { return E.bao_thechat; }, name: 'Thiên Bảo · Thể Chất' },
  bao_linh_can: { get icon() { return E.bao_linhcan; }, name: 'Thiên Bảo · Linh Căn' },
  truyen_thua: { get icon() { return E.truyenthua; }, name: 'Truyền Thừa Ngọc Giản' },
};
const itemText = (k, n = 1) => `${ITEM[k].icon} **${n}** ${ITEM[k].name}`;
const pct = (x) => `${Math.round(x * 100)}%`;

// ------------------------------------------------------------------ đồng bộ hồ sơ
/** Ghi hồ sơ suy ra (nếu chưa khớp) rồi trả hàng mới. */
function ensure(userId, row = null) {
  row = row || Cu.getCultivator(userId);
  if (!row) return null;
  const f = T.syncFields(row);
  if (Object.keys(f).length) { Cu.updateCultivator(userId, f); row = Cu.getCultivator(userId); }
  return row;
}
/** Chạy khi bot khởi động: người chơi cũ nhận hồ sơ xác định (không đổi giữa các lần chạy). Trả số hàng đã ghi. */
function migrateAll() {
  const rows = D.all('SELECT * FROM cultivators');
  let n = 0;
  for (const row of rows) {
    const f = T.syncFields(row);
    if (Object.keys(f).length) { Cu.updateCultivator(row.user_id, f); n++; }
  }
  return { total: rows.length, written: n };
}
/** Đặt lại hồ sơ khi đổi phẩm cấp (Tẩy Tủy): tiến độ thức tỉnh/tiến hóa của phẩm cấp cũ mất. */
const resetTheChat = (userId, name) => Cu.updateCultivator(userId, T.tcFields(name));
const resetLinhCan = (userId, name) => Cu.updateCultivator(userId, T.lcFields(name));

// ------------------------------------------------------------------ tiến độ
/** Trường cần ghi để cộng tiến độ (đã gồm đồng bộ hồ sơ nếu cần) — gộp vào updateCultivator có sẵn của tính năng gọi, khỏi ghi thêm 1 lần. */
function progFields(row, { tc = 0, lc = 0 } = {}) {
  const p = T.profile(row); const f = T.syncFields(row);
  if (tc) f.the_chat_prog = p.tc.prog + tc;
  if (lc) f.linh_can_prog = p.lc.prog + lc;
  return f;
}
function addProg(userId, inc, row = null) {
  row = row || Cu.getCultivator(userId);
  if (!row) return;
  Cu.updateCultivator(userId, progFields(row, inc));
}
function grant(userId, items) {
  const f = {};
  for (const [k, n] of Object.entries(items)) if (n > 0 && ITEM[k]) f[k] = new Cu.Delta(n);
  if (Object.keys(f).length) Cu.updateCultivator(userId, f);
}

// ------------------------------------------------------------------ điều kiện
function reqLines(row, req) {
  const p = T.profile(row); const K = require('./constants');
  const out = [];
  const add = (label, have, need, fmt = (x) => fmtNum(x)) => out.push({ label, have, need, ok: have >= need, text: `${have >= need ? '✅' : '❌'} ${label}: ${fmt(have)}/${fmt(need)}` });
  if (req.realm !== undefined) {
    const nm = (x) => K.REALMS[Math.min(x, K.REALMS.length - 1)].name; const ok = row.realm_index >= req.realm;
    out.push({ label: 'Đại cảnh giới', have: row.realm_index, need: req.realm, ok, text: `${ok ? '✅' : '❌'} Đại cảnh giới: cần **${nm(req.realm)}** (hiện ${nm(row.realm_index)})` });
  }
  if (req.prog !== undefined) add('Tiến độ tích lũy', req._prog, req.prog);
  if (req.purity !== undefined) add('Độ tinh khiết', p.lc.purity, req.purity, (x) => `${x}%`);
  if (req.bao) add(ITEM[req._baoKey].name, row[req._baoKey] || 0, req.bao);
  if (req.truyen) add(ITEM.truyen_thua.name, row.truyen_thua || 0, req.truyen);
  if (req.thach) add('Linh Thạch', row.linh_thach || 0, req.thach);
  return out;
}
const missing = (lines) => lines.filter((l) => !l.ok);

/** Điều kiện của bước KẾ TIẾP (thức tỉnh hoặc tiến hóa) để hiển thị trên /thechat, /linhcan. which = 'tc' | 'lc'. */
function nextStep(row, which) {
  const p = T.profile(row);
  if (which === 'tc') {
    if (p.tc.stage < 4) { const r = T.TC_AWAKEN[p.tc.stage]; return { kind: 'awaken', title: `Thức tỉnh → ${T.STAGE_NAMES[p.tc.stage + 1]}`, rate: r.rate, lines: reqLines(row, { realm: r.realm, prog: r.prog, bao: r.bao, truyen: r.truyen, thach: r.thach, _prog: p.tc.prog, _baoKey: 'bao_the_chat' }) }; }
    if (p.tc.variant) return { kind: 'done', title: 'Đã Biến Dị', lines: [] };
    const r = T.TC_EVOLVE;
    return { kind: 'evolve', title: 'Tiến hóa (Biến Dị)', rate: evolveRate(r.rate, p.tc.pity, r.pityStep, r.pityCap), lines: reqLines(row, { realm: r.realm, bao: r.bao, truyen: r.truyen, thach: r.thach, _baoKey: 'bao_the_chat' }) };
  }
  if (p.lc.awaken < 3) { const r = T.LC_AWAKEN[p.lc.awaken]; return { kind: 'awaken', title: `Thức tỉnh → ${T.LC_AWAKEN_NAMES[p.lc.awaken + 1]}`, rate: r.rate, lines: reqLines(row, { realm: r.realm, prog: r.prog, bao: r.bao, truyen: r.truyen, thach: r.thach, _prog: p.lc.prog, _baoKey: 'bao_linh_can' }) }; }
  if (p.lc.evolution) return { kind: 'done', title: 'Đã Tiến Hóa', lines: [] };
  const r = T.LC_EVOLVE;
  return { kind: 'evolve', title: 'Tiến hóa Linh Căn', rate: evolveRate(r.rate, p.lc.pity, r.pityStep, r.pityCap), lines: reqLines(row, { realm: r.realm, prog: r.prog, purity: r.purity, bao: r.bao, truyen: r.truyen, thach: r.thach, _prog: p.lc.prog, _baoKey: 'bao_linh_can' }) };
}
const evolveRate = (base, pity, step, cap) => Math.min(cap, base + pity * step);

/** Trừ tài nguyên nguyên tử + ghi kết quả. spend = phần tài nguyên bị trừ (đã tính thành/bại). */
function commit(userId, baoKey, spend, extra) {
  const fields = { ...extra };
  if (spend.thach) fields.linh_thach = new Cu.Delta(-spend.thach);
  if (spend.bao) fields[baoKey] = new Cu.Delta(-spend.bao);
  if (spend.truyen) fields.truyen_thua = new Cu.Delta(-spend.truyen);
  const guard = {};
  if (spend.fullThach) guard.linh_thach = spend.fullThach;
  if (spend.fullBao) guard[baoKey] = spend.fullBao;
  if (spend.fullTruyen) guard.truyen_thua = spend.fullTruyen;
  return Cu.updateCultivator(userId, fields, guard);
}

// ------------------------------------------------------------------ THỂ CHẤT
function awakenTheChat(userId) {
  const row = ensure(userId); const p = T.profile(row);
  if (p.tc.stage >= 4) return { ok: false, msg: '✨ Thể Chất đã **Viên Mãn** — có thể thử **Tiến Hóa (Biến Dị)**.' };
  const r = T.TC_AWAKEN[p.tc.stage];
  const lines = reqLines(row, { ...r, _prog: p.tc.prog, _baoKey: 'bao_the_chat' });
  const miss = missing(lines);
  if (miss.length) return { ok: false, msg: `❌ Chưa đủ điều kiện **${T.STAGE_NAMES[p.tc.stage + 1]}**:\n${lines.map((l) => l.text).join('\n')}`, lines };
  const success = random() < r.rate;
  const spend = { thach: r.thach, bao: success ? r.bao : Math.ceil(r.bao / 2), truyen: success ? r.truyen : 0, fullThach: r.thach, fullBao: r.bao, fullTruyen: r.truyen };
  const extra = success ? { the_chat_stage: p.tc.stage + 1 } : {};
  if (!commit(userId, 'bao_the_chat', spend, extra)) return { ok: false, msg: Cu.MSG_BALANCE_CHANGED };
  const after = Cu.getCultivator(userId);
  if (success) {
    return { ok: true, success: true, row: after, msg: `🌟 **THỨC TỈNH THÀNH CÔNG!** ${p.tc.name} bước vào giai đoạn **${T.STAGE_NAMES[p.tc.stage + 1]}** — thiên phú mạnh lên (hiệu lực ×${T.STAGE_MULT[p.tc.stage + 1]}).\nĐã tiêu: ${fmtNum(r.thach)} Linh Thạch, ${itemText('bao_the_chat', r.bao)}${r.truyen ? `, ${itemText('truyen_thua', r.truyen)}` : ''}.` };
  }
  return { ok: true, success: false, row: after, msg: `💢 **Thức tỉnh thất bại** (tỉ lệ ${pct(r.rate)}). Mất ${fmtNum(r.thach)} Linh Thạch và ${itemText('bao_the_chat', spend.bao)}; ${r.truyen ? 'Truyền Thừa được giữ lại; ' : ''}tiến độ tích lũy không mất. Thử lại khi đủ tài nguyên.` };
}
function evolveTheChat(userId) {
  const row = ensure(userId); const p = T.profile(row); const r = T.TC_EVOLVE;
  if (p.tc.variant) return { ok: false, msg: `✦ Thể Chất đã **Biến Dị** thành **${p.tc.variant}** — không thể tiến hóa thêm.` };
  if (p.tc.stage < r.stage) return { ok: false, msg: `❌ Cần thức tỉnh Thể Chất đến **${T.STAGE_NAMES[r.stage]}** trước (hiện: ${T.STAGE_NAMES[p.tc.stage]}).` };
  const lines = reqLines(row, { realm: r.realm, prog: undefined, bao: r.bao, truyen: r.truyen, thach: r.thach, _baoKey: 'bao_the_chat' });
  const miss = missing(lines);
  if (miss.length) return { ok: false, msg: `❌ Chưa đủ điều kiện **Biến Dị**:\n${lines.map((l) => l.text).join('\n')}`, lines };
  const rate = evolveRate(r.rate, p.tc.pity, r.pityStep, r.pityCap);
  const success = random() < rate;
  if (success) {
    const pool = T.VARIANTS.filter((v) => v.minIdx <= p.tc.idx);
    const v = pool[Math.floor(random() * pool.length)];
    if (!commit(userId, 'bao_the_chat', { thach: r.thach, bao: r.bao, truyen: r.truyen, fullThach: r.thach, fullBao: r.bao, fullTruyen: r.truyen }, { the_chat_bien_di: v.name, the_chat_pity: 0 })) return { ok: false, msg: Cu.MSG_BALANCE_CHANGED };
    return { ok: true, success: true, variant: v, row: Cu.getCultivator(userId), msg: `🧬 **BIẾN DỊ THÀNH CÔNG!** Thể Chất của bạn tiến hóa thành **${v.name}**!\n_${v.desc}_` };
  }
  const bao = Math.ceil(r.bao / 2);
  if (!commit(userId, 'bao_the_chat', { thach: r.thach, bao, truyen: 0, fullThach: r.thach, fullBao: r.bao, fullTruyen: r.truyen }, { the_chat_pity: p.tc.pity + 1 })) return { ok: false, msg: Cu.MSG_BALANCE_CHANGED };
  const nextRate = evolveRate(r.rate, p.tc.pity + 1, r.pityStep, r.pityCap);
  return { ok: true, success: false, row: Cu.getCultivator(userId), msg: `💢 **Biến Dị thất bại** (tỉ lệ ${pct(rate)}). Mất ${fmtNum(r.thach)} Linh Thạch và ${itemText('bao_the_chat', bao)}, Truyền Thừa được giữ lại.\n🍀 Tích lũy vận may: lần sau tỉ lệ **${pct(nextRate)}** (tối đa ${pct(r.pityCap)}).` };
}

// ------------------------------------------------------------------ LINH CĂN
function awakenLinhCan(userId) {
  const row = ensure(userId); const p = T.profile(row);
  if (p.lc.awaken >= 3) return { ok: false, msg: '✨ Linh Căn đã thức tỉnh **Lần III** — có thể thử **Tiến Hóa** (cần độ tinh khiết cao).' };
  const r = T.LC_AWAKEN[p.lc.awaken];
  const lines = reqLines(row, { ...r, purity: undefined, _prog: p.lc.prog, _baoKey: 'bao_linh_can' });
  const miss = missing(lines);
  if (miss.length) return { ok: false, msg: `❌ Chưa đủ điều kiện **${T.LC_AWAKEN_NAMES[p.lc.awaken + 1]}**:\n${lines.map((l) => l.text).join('\n')}`, lines };
  const success = random() < r.rate;
  const spend = { thach: r.thach, bao: success ? r.bao : Math.ceil(r.bao / 2), truyen: success ? r.truyen : 0, fullThach: r.thach, fullBao: r.bao, fullTruyen: r.truyen };
  const extra = success ? { linh_can_awaken: p.lc.awaken + 1, linh_can_purity: Math.min(100, p.lc.purity + r.purity) } : {};
  if (!commit(userId, 'bao_linh_can', spend, extra)) return { ok: false, msg: Cu.MSG_BALANCE_CHANGED };
  if (success) {
    return { ok: true, success: true, row: Cu.getCultivator(userId), msg: `🌟 **THỨC TỈNH THÀNH CÔNG!** Linh Căn đạt **${T.LC_AWAKEN_NAMES[p.lc.awaken + 1]}** — thuộc tính phát huy mạnh hơn, độ tinh khiết +${r.purity}% (${p.lc.purity}% → ${Math.min(100, p.lc.purity + r.purity)}%).\nĐã tiêu: ${fmtNum(r.thach)} Linh Thạch, ${itemText('bao_linh_can', r.bao)}${r.truyen ? `, ${itemText('truyen_thua', r.truyen)}` : ''}.` };
  }
  return { ok: true, success: false, row: Cu.getCultivator(userId), msg: `💢 **Thức tỉnh thất bại** (tỉ lệ ${pct(r.rate)}). Mất ${fmtNum(r.thach)} Linh Thạch và ${itemText('bao_linh_can', spend.bao)}; ${r.truyen ? 'Truyền Thừa được giữ lại; ' : ''}tiến độ tích lũy không mất.` };
}
function evolveLinhCan(userId) {
  const row = ensure(userId); const p = T.profile(row); const r = T.LC_EVOLVE;
  if (p.lc.evolution) return { ok: false, msg: `✦ Linh Căn đã tiến hóa thành **${p.lc.evolution}** — không thể tiến hóa thêm.` };
  if (p.lc.awaken < r.awaken) return { ok: false, msg: `❌ Cần thức tỉnh Linh Căn đến **${T.LC_AWAKEN_NAMES[r.awaken]}** trước (hiện: ${T.LC_AWAKEN_NAMES[p.lc.awaken]}).` };
  const lines = reqLines(row, { realm: r.realm, prog: r.prog, purity: r.purity, bao: r.bao, truyen: r.truyen, thach: r.thach, _prog: p.lc.prog, _baoKey: 'bao_linh_can' });
  const miss = missing(lines);
  if (miss.length) return { ok: false, msg: `❌ Chưa đủ điều kiện **Tiến Hóa Linh Căn**:\n${lines.map((l) => l.text).join('\n')}`, lines };
  const rate = evolveRate(r.rate, p.lc.pity, r.pityStep, r.pityCap);
  const success = random() < rate;
  const ev = T.EVOLUTIONS[p.lc.primary];
  if (success) {
    if (!commit(userId, 'bao_linh_can', { thach: r.thach, bao: r.bao, truyen: r.truyen, fullThach: r.thach, fullBao: r.bao, fullTruyen: r.truyen }, { linh_can_tienhoa: ev.name, linh_can_pity: 0 })) return { ok: false, msg: Cu.MSG_BALANCE_CHANGED };
    return { ok: true, success: true, evolution: ev, row: Cu.getCultivator(userId), msg: `🌌 **TIẾN HÓA THÀNH CÔNG!** Linh Căn hành **${p.lc.primary}** hóa thành **${ev.name}**!\n_${ev.mech}_` };
  }
  const bao = Math.ceil(r.bao / 2);
  if (!commit(userId, 'bao_linh_can', { thach: r.thach, bao, truyen: 0, fullThach: r.thach, fullBao: r.bao, fullTruyen: r.truyen }, { linh_can_pity: p.lc.pity + 1 })) return { ok: false, msg: Cu.MSG_BALANCE_CHANGED };
  const nextRate = evolveRate(r.rate, p.lc.pity + 1, r.pityStep, r.pityCap);
  return { ok: true, success: false, row: Cu.getCultivator(userId), msg: `💢 **Tiến hóa thất bại** (tỉ lệ ${pct(rate)}). Mất ${fmtNum(r.thach)} Linh Thạch và ${itemText('bao_linh_can', bao)}, Truyền Thừa được giữ lại.\n🍀 Tích lũy vận may: lần sau tỉ lệ **${pct(nextRate)}** (tối đa ${pct(r.pityCap)}).` };
}

// ------------------------------------------------------------------ đổi vật phẩm → Thiên Bảo
function exchange(userId, key, qty = 1) {
  const ex = T.EXCHANGE[key];
  if (!ex) return { ok: false, msg: '❌ Vật phẩm này không dùng để đổi Thiên Bảo.' };
  qty = Math.max(1, Math.min(50, int(Number(qty) || 1)));
  const cost = ex.per * qty;
  const row = Cu.getCultivator(userId);
  if ((row[key] || 0) < cost) return { ok: false, msg: `❌ Cần **${cost}** ${ex.label} để đổi ${qty} ${ITEM[ex.gives].name} (hiện có ${row[key] || 0}).` };
  if (!Cu.updateCultivator(userId, { [key]: new Cu.Delta(-cost), [ex.gives]: new Cu.Delta(qty) }, { [key]: cost })) return { ok: false, msg: Cu.MSG_BALANCE_CHANGED };
  return { ok: true, msg: `🔁 Đã đổi **${cost}** ${ex.label} → ${itemText(ex.gives, qty)}.`, row: Cu.getCultivator(userId) };
}

// ------------------------------------------------------------------ rơi vật phẩm
const DROPS = {
  bicanh: { bao: 0.03, truyen: 0.004 },       // mỗi lần vào Bí Cảnh thành công: 3% Thiên Bảo (Thể Chất hoặc Linh Căn), 0.4% Truyền Thừa
  boss: { bao: 0.12, truyen: 0.04 },          // mỗi lần tham gia diệt Boss Thế Giới thành công
  majorBreak: { bao: 0.10, truyen: 0 },       // đột phá đại cảnh giới thành công
  thienkiep: { bao: 0, truyen: 1 },           // vượt Thiên Kiếp phi thăng thành công: chắc chắn 1 Truyền Thừa
};
/** Thử rơi vật phẩm và GHI luôn vào kho. Trả { got, text } — text '' nếu không rơi gì. lootMult: thu hoạch từ Thể Chất/Linh Căn. */
function rollDropItems(userId, kind, lootMult = 1) {
  const d = DROPS[kind]; if (!d) return { got: {}, text: '' };
  const got = {};
  if (d.bao && random() < Math.min(1, d.bao * lootMult)) got[random() < 0.5 ? 'bao_the_chat' : 'bao_linh_can'] = 1;
  if (d.truyen && random() < Math.min(1, d.truyen * lootMult)) got.truyen_thua = 1;
  if (!Object.keys(got).length) return { got, text: '' };
  grant(userId, got);
  return { got, text: Object.entries(got).map(([k, n]) => itemText(k, n)).join(', ') };
}
/** Bản có tiền tố cho phản hồi lệnh: '' hoặc "\n🎁 **Cơ duyên!** Nhận được ...". */
function rollDrops(userId, kind, lootMult = 1) { const r = rollDropItems(userId, kind, lootMult); return r.text ? `\n🎁 **Cơ duyên!** Nhận được ${r.text}.` : ''; }
const lootMultOf = (row) => 1 + T.bundle(row).loot;

module.exports = {
  ITEM, itemText, DROPS, ensure, migrateAll, resetTheChat, resetLinhCan, progFields, addProg, grant, reqLines, missing,
  nextStep, evolveRate, awakenTheChat, evolveTheChat, awakenLinhCan, evolveLinhCan, exchange, rollDrops, rollDropItems, lootMultOf,
};
