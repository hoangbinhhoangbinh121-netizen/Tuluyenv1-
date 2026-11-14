'use strict';
/**
 * GIAO DIỆN V17 — Nghề Nghiệp · Dùng Đan · Trang Bị · Trận Pháp · Linh Điền · Kho Đồ phân loại · NPC thu mua/bán.
 * Một bộ xử lý nút TĨNH ('ng') — customId `ng|<uid>|<act>|<a>|<b>` — nên còn hiệu lực sau khi bot khởi động lại.
 * Mọi thao tác đều gọi lớp game (craft17/dan17/gear17/tran17/field17/npc17/invsvc): giao diện KHÔNG tự trừ/cộng gì.
 */
const { ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { EmbedBuilder, fit, listFit, optEmoji, btn, rowOf } = require('./petViews');
const { registerStatic, EPHEMERAL } = require('./kit');
const Cu = require('../game/cultivator');
const Inv = require('../game/invsvc');
const Cat = require('../game/catalog17');
const X = require('../game/craft17');
const Dan = require('../game/dan17');
const G = require('../game/gear17');
const Tr = require('../game/tran17');
const Fd = require('../game/field17');
const Npc = require('../game/npc17');
const Emo = require('./emo17');
const K = require('../game/constants');
const { I, C } = Cat;
const { fmtNum, now, clamp } = require('../util');

const fmtT = (s) => require('../game/format').fmtTime(s);
const PAGE = 8;
const bar = (cur, max, n = 10) => { const f = Math.round(n * clamp(max ? cur / max : 0, 0, 1)); return `${'█'.repeat(f)}${'░'.repeat(n - f)}`; };
const cid = (uid, act, a = '', b = '') => `ng|${uid}|${act}|${a}|${b}`.replace(/\|+$/, '').slice(0, 100);
const qn = (q) => (q ? ` _(${I.qName(q)})_` : '');
const lineItem = (id, q, n) => `${Emo.item(id)} ${I.BY_ID[id].name}${qn(q)} ×${fmtNum(n)}`;
const pc = (v) => `${Math.round(v * 100)}%`;
const recName = (rid) => (C.RBY[rid] ? C.RBY[rid].name : rid);
const itName = (id) => (I.BY_ID[id] ? I.BY_ID[id].name : id);
/** Tên đan theo khoá buff (pill:<key>) — tra ngược từ bảng PILLS. */
const pillByKey = (key) => { const id = Object.keys(C.PILLS).find((k) => C.PILLS[k].key === key); return id ? itName(id) : key; };

// ---------------------------------------------------------------- khung chung (thanh điều hướng + nội dung)
const NAV = [
  ['home', 'Tổng Quan Nghề Nghiệp', '📜', 'Cấp nghề, lò đang chạy, thành phẩm chờ nhận'],
  ['hs.dan', 'Đan Sư', null, 'Luyện đan: 16 loại đan dược'],
  ['hs.khi', 'Luyện Khí Sư', null, 'Rèn 8 loại trang bị 7 ô'],
  ['hs.tran', 'Trận Pháp Sư', null, 'Khắc trận bàn, triển khai trận pháp'],
  ['hs.thuc', 'Linh Thực Sư', null, 'Linh Điền: gieo trồng Linh Dược'],
  ['pill', 'Dùng Đan Dược', '💊', 'Cắn đan, xem buff đang chạy'],
  ['gear', 'Trang Bị', '⚒️', 'Mặc · Cường hoá · Tinh luyện · Sửa · Phân giải'],
  ['tran', 'Trận Pháp', '🧿', 'Triển khai trận bàn, trận đang chạy'],
  ['field', 'Linh Điền', '🌱', 'Gieo · Tưới · Bón · Thu hoạch'],
  ['inv', 'Kho Đồ Phân Loại', '🎒', 'Vật phẩm theo danh mục / phẩm cấp'],
  ['npc', 'NPC Thu Mua & Bán', '🏪', 'Bán vật phẩm · mua nguyên liệu cơ bản'],
];
function groupOf(view) {
  const [v, p] = String(view).split('.');
  if (['hs', 'cg', 'kt', 'tt', 'ls'].includes(v)) return `hs.${p}`;
  if (v === 'rc') return null;
  if (['item', 'sellc', 'inv'].includes(v)) return 'inv';
  if (['npc', 'npcc', 'npcb'].includes(v)) return 'npc';
  if (v === 'gearc') return 'gear';
  return v;
}
function navRow(uid, cur) {
  const sm = new StringSelectMenuBuilder().setCustomId(cid(uid, 'nav')).setPlaceholder('Chọn mục…');
  sm.addOptions(NAV.map(([k, name, icon, desc]) => {
    const p = k.startsWith('hs.') ? k.slice(3) : null;
    return { label: name, value: k, description: desc.slice(0, 100), emoji: optEmoji(p ? Emo.prof(p) : icon), default: k === cur };
  }));
  return rowOf(sm);
}
const backBtn = (uid, view, a = '', b = '', label = 'Quay lại') => btn(cid(uid, 'v', view, [a, b].filter((x) => x !== '').join(':') || ''), label, '↩️');
function shell(uid, view, embed, rows = [], note = '') {
  const cur = groupOf(view);
  const comps = [navRow(uid, cur), ...rows.filter(Boolean)].slice(0, 5);
  const payload = { embeds: [embed], components: comps };
  payload.content = note ? fit(note, 1900, '') : '';
  return payload;
}
const E0 = (title, color = 0x5865f2) => new EmbedBuilder().setTitle(title).setColor(color);

// ---------------------------------------------------------------- TỔNG QUAN
function viewHome(uid) {
  const me = Cu.getCultivator(uid);
  const e = E0('📜 Nghề Nghiệp — Bách Nghề Tiên Giới', 0xf1c40f);
  const lines = [];
  for (const p of C.PROF_ORDER) {
    const st = X.state(uid, p); const nx = X.nextDef(st.level); const jobs = X.jobsOf(uid, p);
    const ready = jobs.filter((j) => j.left <= 0).length;
    lines.push(`${Emo.prof(p)} **${C.PROFS[p].name}** — ${X.levelName(st.level)} _(Lv.${st.level}/9)_ · EXP ${fmtNum(st.exp)}${nx ? `/${fmtNum(nx.exp)}` : ' (tối đa)'} · chế ${fmtNum(st.crafts)} lần${jobs.length ? ` · 🔥 ${jobs.length - ready} đang chạy${ready ? ` · 🎁 **${ready} chờ nhận**` : ''}` : ''}`);
  }
  e.setDescription(`${lines.join('\n')}\n\n_Chọn mục ở menu phía trên: nghề, Dùng Đan, Trang Bị, Trận Pháp, Linh Điền, Kho Đồ phân loại, NPC._`);
  const act = Dan.activeList(uid); const tr = Tr.active(uid);
  const bf = [...act.map((b) => `💊 ${pillByKey(b.key.split(':')[1])} — còn ${fmtT(b.left)}`), ...tr.personal.map((b) => `🧿 ${itName(b.id)} — còn ${fmtT(b.left)}`)];
  if (tr.sect) bf.push(`🏯 Hộ Tông ${itName(tr.sect.id)} — còn ${fmtT(tr.sect.left)}`);
  if (bf.length) e.addFields({ name: '✨ Hiệu ứng đang chạy', value: listFit(bf, 1000) });
  e.addFields({ name: '💰 Linh Thạch', value: fmtNum(me ? me.linh_thach : 0), inline: true });
  const rows = [rowOf(btn(cid(uid, 'claimall'), 'Nhận tất cả thành phẩm', '🎁', ButtonStyle.Success), btn(cid(uid, 'v', 'inv'), 'Kho Đồ', '🎒'), btn(cid(uid, 'v', 'npc'), 'NPC', '🏪'))];
  return shell(uid, 'home', e, rows);
}

// ---------------------------------------------------------------- HỒ SƠ NGHỀ
const subTabs = (uid, p, cur) => rowOf(
  btn(cid(uid, 'v', `hs.${p}`), 'Hồ Sơ', '📜', cur === 'hs' ? ButtonStyle.Primary : ButtonStyle.Secondary),
  btn(cid(uid, 'v', `cg.${p}`), 'Công Thức', '📖', cur === 'cg' ? ButtonStyle.Primary : ButtonStyle.Secondary),
  btn(cid(uid, 'v', `kt.${p}`), 'Kỹ Thuật', '🧠', cur === 'kt' ? ButtonStyle.Primary : ButtonStyle.Secondary),
  btn(cid(uid, 'v', `tt.${p}`), 'Thành Tựu', '🏅', cur === 'tt' ? ButtonStyle.Primary : ButtonStyle.Secondary),
  btn(cid(uid, 'v', `ls.${p}`), 'Lịch Sử', '🕘', cur === 'ls' ? ButtonStyle.Primary : ButtonStyle.Secondary),
);
function viewProfile(uid, p) {
  const P = C.PROFS[p]; const st = X.state(uid, p); const nx = X.nextDef(st.level); const pr = X.promoteInfo(uid, p); const tf = X.techFx(uid, p);
  const e = E0(`${Emo.prof(p)} ${P.name} — ${X.levelName(st.level)}`, 0xf1c40f);
  const rate = st.crafts ? Math.round((st.successes / Math.max(1, st.successes + st.fails)) * 100) : 0;
  e.setDescription(`${P.desc}\n\n**Cấp:** ${X.levelName(st.level)} _(Lv.${st.level}/9)_ · mỗi lần chế tối đa **${X.levelDef(st.level).batch}** · **${C.slotsOf(st.level)}** lò đồng thời\n**EXP:** ${nx ? `${bar(st.exp, nx.exp)} ${fmtNum(st.exp)}/${fmtNum(nx.exp)}` : `${fmtNum(st.exp)} (tối đa)`}\n**Đã chế:** ${fmtNum(st.crafts)} · thành công ${fmtNum(st.successes)} · thất bại ${fmtNum(st.fails)}${st.crafts ? ` (${rate}% thành công)` : ''}${st.best_q ? ` · phẩm cao nhất: ${I.qName(st.best_q)}` : ''}`);
  if (nx) e.addFields({ name: `⬆️ Thăng ${nx.name}`, value: pr.can ? `✅ Đủ điều kiện — phí **${fmtNum(nx.fee)}** Linh Thạch.` : `Còn thiếu: ${pr.miss.join(' · ')}\nPhí thăng cấp: ${fmtNum(nx.fee)} Linh Thạch.` });
  const techOn = C.TECHS[p].filter((t) => st.level >= t.lv).map((t) => t.name);
  e.addFields({ name: '🧠 Kỹ thuật đã mở', value: techOn.length ? techOn.join(', ') : 'Chưa có (mở từ cấp Sơ Cấp).', inline: false });
  const jobs = X.jobsOf(uid, p);
  const jl = jobs.map((j) => `${j.left <= 0 ? '🎁' : '🔥'} **${j.qty} × ${j.r.name}** — ${j.left <= 0 ? '**xong, chờ nhận**' : `còn ${fmtT(j.left)}`}`);
  e.addFields({ name: `🔥 Lò chế (${jobs.length}/${C.slotsOf(st.level)})`, value: jl.length ? listFit(jl, 1000) : 'Lò đang trống.' });
  if (Object.keys(tf).length) e.addFields({ name: 'Cộng dồn từ kỹ thuật', value: Object.entries(tf).map(([k, v]) => `${k} ${v}`).join(' · ').slice(0, 200) });
  const rows = [subTabs(uid, p, 'hs'), rowOf(
    btn(cid(uid, 'promote', p), nx ? `Thăng ${nx.name}` : 'Cấp tối đa', '⬆️', ButtonStyle.Success, !nx || !pr.can),
    btn(cid(uid, 'claim', p), 'Nhận thành phẩm', '🎁', ButtonStyle.Primary, !jobs.some((j) => j.left <= 0)),
    ...(p === 'dan' ? [btn(cid(uid, 'tanquyen'), 'Đọc Tàn Quyển', '📜')] : []),
    ...(p === 'thuc' ? [btn(cid(uid, 'v', 'field'), 'Linh Điền', '🌱')] : []),
    ...(p === 'khi' ? [btn(cid(uid, 'v', 'gear'), 'Trang Bị', '⚒️')] : []),
    ...(p === 'tran' ? [btn(cid(uid, 'v', 'tran'), 'Trận Pháp', '🧿')] : []),
  )];
  return { e, rows };
}
function viewCg(uid, p, page = 0) {
  const st = X.state(uid, p); const me = Cu.getCultivator(uid);
  const list = C.RECIPES.filter((r) => r.prof === p).sort((a, b) => a.lv - b.lv || a.realm - b.realm);
  const PG = 20; const pages = Math.max(1, Math.ceil(list.length / PG)); page = clamp(page, 0, pages - 1);
  const slice = list.slice(page * PG, page * PG + PG);
  const e = E0(`${Emo.prof(p)} ${C.PROFS[p].name} — Công Thức (${list.length})`, 0x3498db);
  const lines = slice.map((r) => {
    const unlocked = st.level >= r.lv && (!me || me.realm_index >= r.realm);
    const out = r.kind === 'gear' ? C.GEAR[r.out.item].name : I.BY_ID[r.out.item].name;
    const ic = r.kind === 'gear' ? Emo.slot(C.GEAR[r.out.item].slot) : Emo.item(r.out.item);
    return `${unlocked ? '✅' : '🔒'} ${ic} **${r.name}** → ${r.out.qty > 1 ? `${r.out.qty}× ` : ''}${out} _(${X.levelName(r.lv)}${r.realm ? `, ${K.REALMS[r.realm].name}+` : ''})_`;
  });
  e.setDescription(`${listFit(lines, 3600)}\n\n_Chọn công thức ở menu bên dưới để xem nguyên liệu, tỉ lệ, phẩm chất và bắt đầu chế._`);
  const sm = new StringSelectMenuBuilder().setCustomId(cid(uid, 'rsel')).setPlaceholder('Chọn công thức để xem / chế…');
  sm.addOptions(slice.map((r) => ({ label: r.name.slice(0, 100), value: r.id, description: `${X.levelName(r.lv)} · ${fmtT(r.time)} · thành công ~${pc(Math.min(1, r.rate))}`.slice(0, 100),
    emoji: optEmoji(r.kind === 'gear' ? Emo.slot(C.GEAR[r.out.item].slot) : Emo.item(r.out.item)) })));
  const rows = [subTabs(uid, p, 'cg'), rowOf(sm)];
  if (pages > 1) rows.push(rowOf(btn(cid(uid, 'v', `cg.${p}`, String(page - 1)), 'Trước', '⬅️', ButtonStyle.Secondary, page <= 0), btn(cid(uid, 'v', `cg.${p}`, String(page + 1)), 'Sau', '➡️', ButtonStyle.Secondary, page >= pages - 1)));
  return { e, rows };
}
function effectText(r) {
  if (r.kind === 'gear') { const t = C.GEAR[r.out.item]; return `${Emo.slot(t.slot)} Ô **${C.SLOTS[t.slot].name}** · cần cảnh giới ≥ ${K.REALMS[t.realm].name} để mặc\nChỉ số cơ bản (Trung Phẩm): ${G.fmtStats(G.statsOf({ tpl: r.out.item, q: 2, enh: 0, refine: 0, dura: 1, sec: '{}' }))}\nThuộc tính phụ: 1 trong ${Object.keys(t.secPool).map((k) => G.LABEL[k] || k).join(' / ')} (ngẫu nhiên lúc chế)\nĐộ bền ${t.dur}`; }
  const id = r.out.item; if (Dan.isPill(id)) return Dan.describe(id, 2); if (Tr.isTran(id)) return Tr.describe(id, 2);
  return I.BY_ID[id].desc || '';
}
function viewRc(uid, rid, boost = false) {
  const r = C.RBY[rid]; if (!r) return viewHome(uid);
  const p = r.prof; const cal = X.calc(uid, rid, { boost }); const st = cal.st; const c1 = X.check(uid, rid, 1, { boost });
  const e = E0(`${Emo.prof(p)} ${r.name}`, 0x3498db);
  const need = Object.entries(c1.need).map(([k, n]) => { const have = Inv.qtyAny(uid, k); return `${have >= n ? '✅' : '❌'} ${Emo.item(k)} ${I.BY_ID[k].name} **${have}/${n}**`; });
  if (r.gold) need.push(`${(Cu.getCultivator(uid)?.linh_thach || 0) >= r.gold ? '✅' : '❌'} 💎 Linh Thạch **${fmtNum(r.gold)}**`);
  const outName = r.kind === 'gear' ? C.GEAR[r.out.item].name : I.BY_ID[r.out.item].name;
  e.setDescription(`**Yêu cầu:** ${C.PROFS[p].name} cấp **${X.levelName(r.lv)}**${r.realm ? ` · cảnh giới ≥ ${K.REALMS[r.realm].name}` : ''}\n**Sản phẩm:** ${r.out.qty > 1 ? `${r.out.qty} × ` : ''}**${outName}**\n**Thời gian:** ${fmtT(cal.time)} · **Tỉ lệ thành công:** ~${pc(cal.rate)}${r.cd ? ` · hồi chiêu ${fmtT(r.cd)}` : ''}\n**Thất bại:** hoàn lại ~${pc(r.fail || 0)} nguyên liệu · EXP +${r.exp}${boost ? '\n🧪 **Có xúc tác:** +6% thành công, +10% dịch phẩm chất.' : ''}`);
  e.addFields({ name: 'Nguyên liệu (cho 1 lần)', value: listFit(need, 1000) });
  if (r.q) { const d = X.qualityDist(cal.shift); e.addFields({ name: 'Phân bố phẩm chất', value: d.map((v, i) => `${I.qName(i + 1)} ${pc(v)}`).join(' · ') }); }
  const eff = effectText(r); if (eff) e.addFields({ name: 'Tác dụng sản phẩm', value: eff });
  if (!c1.ok) e.addFields({ name: '⛔ Chưa chế được', value: listFit(c1.reasons.map((x) => `• ${x}`), 1000) });
  const batch = X.levelDef(st.level).batch; const cN = batch > 1 && !r.cd ? X.check(uid, rid, batch, { boost }) : null;
  const catalyst = { dan: 'tdc_dan_hoa_tinh', khi: 'nl_manh_phap_bao', tran: 'td_thien_dien_sa' }[p];
  const rows = [rowOf(
    btn(cid(uid, 'mk', rid, `1:${boost ? 1 : 0}`), 'Chế ×1', '🔥', ButtonStyle.Success, !c1.ok),
    ...(cN ? [btn(cid(uid, 'mk', rid, `${batch}:${boost ? 1 : 0}`), `Chế ×${batch}`, '🔥', ButtonStyle.Success, !cN.ok)] : []),
    ...(catalyst ? [btn(cid(uid, 'v', 'rc', `${rid}:${boost ? 0 : 1}`), boost ? 'Bỏ xúc tác' : 'Dùng xúc tác', '🧪', boost ? ButtonStyle.Primary : ButtonStyle.Secondary)] : []),
    btn(cid(uid, 'claim', p, rid), 'Nhận thành phẩm', '🎁', ButtonStyle.Primary),
    btn(cid(uid, 'v', `cg.${p}`), 'Danh sách', '↩️'),
  )];
  return { e, rows, view: `hs.${p}` };
}
function viewKt(uid, p) {
  const st = X.state(uid, p);
  const e = E0(`${Emo.prof(p)} ${C.PROFS[p].name} — Kỹ Thuật`, 0x9b59b6);
  const lines = C.TECHS[p].map((t) => `${st.level >= t.lv ? '✅' : '🔒'} **${t.name}** _(mở ở ${X.levelName(t.lv)})_\n   ${t.desc}`);
  const mt = C.RECIPES.filter((r) => r.prof === p && X.masteryN(uid, r.id) > 0).map((r) => `${r.name}: ${X.MASTERY_NAMES[X.masteryTier(X.masteryN(uid, r.id))] || ''} (${X.masteryN(uid, r.id)} lần)`);
  e.setDescription(lines.join('\n'));
  e.addFields({ name: '🎯 Thành thạo công thức', value: mt.length ? listFit(mt, 1000) : 'Chế nhiều lần một công thức để tăng thành thạo (nhanh hơn, dễ thành công hơn).' });
  return { e, rows: [subTabs(uid, p, 'kt')] };
}
function viewTt(uid, p) {
  const e = E0(`${Emo.prof(p)} ${C.PROFS[p].name} — Thành Tựu`, 0xe67e22);
  const L = X.achList(uid, p);
  e.setDescription(listFit(L.map((a) => `${a.done ? '✅' : '⬜'} **${a.name}** — ${a.desc}${a.done ? '' : ` _(thưởng ${fmtNum(a.lt || 0)} Linh Thạch${a.items ? `, ${Object.entries(a.items).map(([k, n]) => `${n} × ${I.BY_ID[k].name}`).join(', ')}` : ''})_`}`), 3800));
  e.setFooter({ text: `Hoàn thành ${L.filter((a) => a.done).length}/${L.length} · thưởng nhận một lần` });
  return { e, rows: [subTabs(uid, p, 'tt')] };
}
function viewLs(uid, p) {
  const e = E0(`${Emo.prof(p)} ${C.PROFS[p].name} — Lịch Sử Chế`, 0x95a5a6);
  const L = X.historyOf(uid, p, 12);
  e.setDescription(L.length ? listFit(L.map((l) => `<t:${Math.floor(l.ts)}:R> **${recName(l.recipe_id)}** ×${l.qty} — ✅ ${l.ok}${l.bad ? ` · 💥 ${l.bad}` : ''}${l.best_q ? ` · ${I.qName(l.best_q)}` : ''}`), 3800) : 'Chưa chế lần nào.');
  return { e, rows: [subTabs(uid, p, 'ls')] };
}

// ---------------------------------------------------------------- DÙNG ĐAN
const LEGACY_PILLS = ['dan_pha_gioi', 'dan_tay_tuy_ts'];
const pillOwned = (uid) => Inv.list(uid).filter((x) => Dan.isPill(x.id) || LEGACY_PILLS.includes(x.id) || x.item.cat === 'DAN_DUOC');
function viewPill(uid, sel = '') {
  const me = Cu.getCultivator(uid); const owned = pillOwned(uid);
  const e = E0('💊 Dùng Đan Dược', 0xe74c3c);
  const act = Dan.activeList(uid);
  e.setDescription(owned.length ? `Chọn đúng viên đang có để xem tác dụng và cắn. Buff **không cộng dồn** — dùng lại cùng loại là làm mới.\nĐan dùng nhiều trong ngày sẽ giảm hiệu lực rồi bị chặn (xem từng loại).` : 'Kho chưa có đan dược. Luyện ở **Đan Sư** hoặc mua ở Cửa Hàng Đan Dược.');
  e.addFields({ name: '✨ Buff đang chạy', value: act.length ? listFit(act.map((b) => `• **${pillByKey(b.key.split(':')[1])}** — còn ${fmtT(b.left)}${b.charges ? ` · ${b.charges} lượt` : ''}`), 1000) : 'Không có.' });
  let pick = null; if (sel) { const [id, q] = sel.split(':'); pick = owned.find((x) => x.id === id && String(x.q) === String(q)) || null; }
  if (pick) {
    const it = pick.item; const p = C.PILLS[pick.id];
    const txt = Dan.isPill(pick.id) ? Dan.describe(pick.id, pick.q || 2) : (it.desc || '');
    e.addFields({ name: `${Emo.item(pick.id)} ${it.name}${qn(pick.q)} ×${fmtNum(pick.qty)}`, value: `${txt}${p ? `\nĐã dùng hôm nay: **${Dan.usedToday(uid, pick.id)}**/${p.hard}` : ''}` });
  }
  const rows = [];
  if (owned.length) {
    const sm = new StringSelectMenuBuilder().setCustomId(cid(uid, 'psel')).setPlaceholder('Chọn đan dược…');
    sm.addOptions(owned.slice(0, 25).map((x) => ({ label: `${x.item.name}${x.q ? ` (${I.qName(x.q)})` : ''} ×${x.qty}`.slice(0, 100), value: `${x.id}:${x.q}`, emoji: optEmoji(Emo.item(x.id)), default: !!pick && pick.id === x.id && pick.q === x.q })));
    rows.push(rowOf(sm));
  }
  if (pick) {
    const can = Dan.isPill(pick.id) || LEGACY_PILLS.includes(pick.id); const s = `${pick.id}:${pick.q}`;
    rows.push(rowOf(btn(cid(uid, 'pu', s, '1'), 'Dùng ×1', '💊', ButtonStyle.Success, !can), btn(cid(uid, 'pu', s, '5'), 'Dùng ×5', '💊', ButtonStyle.Primary, !can || !Dan.isPill(pick.id) || pick.qty < 2),
      btn(cid(uid, 'pu', s, '10'), 'Dùng ×10', '💊', ButtonStyle.Primary, !can || !Dan.isPill(pick.id) || pick.qty < 2), btn(cid(uid, 'v', 'item', s), 'Chi tiết', 'ℹ️')));
  }
  return shell(uid, 'pill', e, rows);
}

// ---------------------------------------------------------------- TRANG BỊ
function gearLine(g) { const t = G.tpl(g.tpl); return `${g.equipped ? '✅' : '▫️'} ${Emo.slot(t.slot)} **${G.name(g)}** _(${I.qName(g.q)}${g.refine ? `, tinh luyện ${g.refine}` : ''})_ · độ bền ${Math.ceil(g.dura)}/${g.dura_max}${g.locked ? ' 🔒' : ''}${g.dura <= 0 ? ' ⚠️ hỏng' : ''}`; }
function viewGear(uid, sel = '') {
  const list = G.listOf(uid); const eq = G.equippedOf(uid);
  const e = E0('⚒️ Trang Bị (7 ô)', 0x95a5a6);
  const slotLines = C.SLOT_ORDER.map((s) => { const g = eq.find((x) => G.tpl(x.tpl).slot === s); return `${Emo.slot(s)} **${C.SLOTS[s].name}:** ${g ? `${G.name(g)} _(${I.qName(g.q)})_${g.dura <= 0 ? ' ⚠️ hỏng' : ''}` : '— trống'}`; });
  const total = {}; for (const g of eq) for (const [k, v] of Object.entries(G.statsOf(g))) total[k] = (total[k] || 0) + v;
  e.setDescription(`${slotLines.join('\n')}\n\n**Tổng cộng:** ${G.fmtStats(total)}\n_Trang bị hao mòn độ bền khi PvP/Boss/Bí Cảnh; hỏng thì mất chỉ số tới khi sửa._`);
  let g = sel ? G.get(uid, Number(sel)) : null; if (g && String(g.user_id) !== String(uid)) g = null;
  if (g) {
    const t = G.tpl(g.tpl); const ec = C.enhCost(g.enh, t.tier); const rc = C.refineCost(g.refine, t.tier); const rp = G.repairCost(g);
    e.addFields({ name: `${Emo.slot(t.slot)} ${G.name(g)} (${I.qName(g.q)})`, value: `${G.fmtStats(G.statsOf(g))}\nCường hoá +${g.enh}/${C.ENH_MAX} · Tinh luyện ${g.refine}/${C.REFINE_MAX} · Cảnh giới mặc ≥ ${K.REALMS[t.realm].name}\n⬆️ Cường hoá kế: ${g.enh >= C.ENH_MAX ? 'tối đa' : `${pc(ec.rate)} · ${fmtNum(ec.gold)} LT + ${ec.mat[1]} ${I.BY_ID[ec.mat[0]].name}${ec.cat ? ' + 1 Mảnh Pháp Bảo' : ''}${ec.downOnFail ? ' (hỏng có thể tụt 1 cấp)' : ''}`}\n✨ Tinh luyện kế: ${g.refine >= C.REFINE_MAX ? 'tối đa' : `${pc(rc.rate)} · ${fmtNum(rc.gold)} LT + ${Object.entries(rc.mats).map(([k, n]) => `${n} ${I.BY_ID[k].name}`).join(', ')}`}\n🔧 Sửa: ${rp.miss > 0 ? `${fmtNum(rp.gold)} LT + ${rp.mat[1]} ${I.BY_ID[rp.mat[0]].name}` : 'không cần'} · 💰 NPC mua ${fmtNum(G.sellValue(g))} LT` });
  }
  const rows = [];
  if (list.length) {
    const sm = new StringSelectMenuBuilder().setCustomId(cid(uid, 'gsel')).setPlaceholder(`Chọn trang bị (${list.length})…`);
    sm.addOptions(list.slice(0, 25).map((x) => { const t = G.tpl(x.tpl); return { label: `${x.equipped ? '✅ ' : ''}${G.name(x)} (${I.qName(x.q)})`.slice(0, 100), value: String(x.gear_id), description: `${C.SLOTS[t.slot].name} · bền ${Math.ceil(x.dura)}/${x.dura_max}${x.locked ? ' · khoá' : ''}`.slice(0, 100), emoji: optEmoji(Emo.slot(t.slot)), default: !!g && g.gear_id === x.gear_id }; }));
    rows.push(rowOf(sm));
    if (list.length > 25) e.setFooter({ text: `Hiện 25/${list.length} món đầu — phân giải/bán bớt món thừa để xem tiếp.` });
  } else e.addFields({ name: 'Chưa có trang bị', value: 'Chế ở **Luyện Khí Sư** (Công Thức).' });
  if (g) {
    rows.push(rowOf(g.equipped ? btn(cid(uid, 'gun', g.gear_id), 'Tháo', '⬇️') : btn(cid(uid, 'geq', g.gear_id), 'Mặc', '⬆️', ButtonStyle.Success),
      btn(cid(uid, 'gen', g.gear_id), 'Cường hoá', '🔨', ButtonStyle.Primary, g.enh >= C.ENH_MAX), btn(cid(uid, 'gre', g.gear_id), 'Tinh luyện', '✨', ButtonStyle.Primary, g.refine >= C.REFINE_MAX),
      btn(cid(uid, 'grp', g.gear_id), 'Sửa', '🔧', ButtonStyle.Secondary, g.dura >= g.dura_max), btn(cid(uid, 'glk', g.gear_id), g.locked ? 'Mở khoá' : 'Khoá', g.locked ? '🔓' : '🔒')));
    rows.push(rowOf(btn(cid(uid, 'v', 'gearc', `${g.gear_id}:dis`), 'Phân giải', '♻️', ButtonStyle.Danger, !!g.equipped || !!g.locked), btn(cid(uid, 'v', 'gearc', `${g.gear_id}:sell`), 'Bán NPC', '💰', ButtonStyle.Danger, !!g.equipped || !!g.locked)));
  }
  return shell(uid, 'gear', e, rows);
}
function viewGearConfirm(uid, arg) {
  const [gid, mode] = String(arg).split(':'); const g = G.get(uid, Number(gid)); if (!g) return viewGear(uid);
  const e = E0(mode === 'dis' ? '♻️ Xác nhận phân giải' : '💰 Xác nhận bán trang bị', 0xe74c3c);
  e.setDescription(mode === 'dis' ? `Phân giải **${G.name(g)}** (${I.qName(g.q)}) để lấy vật liệu? **Không thể hoàn tác.**` : `Bán **${G.name(g)}** (${I.qName(g.q)}) cho NPC với **${fmtNum(G.sellValue(g))}** Linh Thạch? **Không thể hoàn tác.**`);
  return shell(uid, 'gearc', e, [rowOf(btn(cid(uid, mode === 'dis' ? 'gdis' : 'gsell', gid), 'Xác nhận', '✅', ButtonStyle.Danger), btn(cid(uid, 'v', 'gear', gid), 'Huỷ', '↩️'))]);
}

// ---------------------------------------------------------------- TRẬN PHÁP
function viewTran(uid, sel = '') {
  const e = E0('🧿 Trận Pháp', 0x1abc9c); const act = Tr.active(uid);
  const lines = act.personal.map((b) => `🧿 **${itName(b.id)}** _(${I.qName(b.q)})_ — còn ${fmtT(b.left)}${b.charges ? ` · ${b.charges} lượt` : ''}`);
  if (act.sect) lines.push(`🏯 **Hộ Tông Đại Trận** _(${I.qName(act.sect.q)})_ — còn ${fmtT(act.sect.left)}`);
  e.setDescription(`Triển khai tiêu **1 trận bàn** + phí duy trì Linh Thạch. Tối đa **${C.TRAN_PERSONAL_MAX}** trận cá nhân cùng lúc; mỗi loại có giới hạn lần/ngày. Triển khai lại cùng trận = làm mới, không cộng dồn.`);
  e.addFields({ name: 'Đang chạy', value: lines.length ? listFit(lines, 1000) : 'Không có trận nào.' });
  const owned = Inv.list(uid).filter((x) => Tr.isTran(x.id));
  let pick = null; if (sel) { const [id, q] = sel.split(':'); pick = owned.find((x) => x.id === id && String(x.q) === String(q)) || null; }
  if (pick) e.addFields({ name: `${Emo.item(pick.id)} ${pick.item.name}${qn(pick.q)} ×${pick.qty}`, value: `${Tr.describe(pick.id, pick.q || 2)}\nPhí duy trì lần này: **${fmtNum(Tr.upkeepCost(uid, pick.id))}** Linh Thạch · hôm nay đã dùng ${Inv.dailyGet(uid, `tran:${pick.id}`)}/${C.TRANS[pick.id].daily}` });
  const rows = [];
  if (owned.length) {
    const sm = new StringSelectMenuBuilder().setCustomId(cid(uid, 'tsel')).setPlaceholder('Chọn trận bàn trong kho…');
    sm.addOptions(owned.slice(0, 25).map((x) => ({ label: `${x.item.name}${x.q ? ` (${I.qName(x.q)})` : ''} ×${x.qty}`.slice(0, 100), value: `${x.id}:${x.q}`, emoji: optEmoji(Emo.item(x.id)), default: !!pick && pick.id === x.id && pick.q === x.q })));
    rows.push(rowOf(sm));
  } else e.addFields({ name: 'Chưa có trận bàn', value: 'Chế ở **Trận Pháp Sư** (Công Thức).' });
  if (pick) rows.push(rowOf(btn(cid(uid, 'tdp', `${pick.id}:${pick.q}`), C.TRANS[pick.id].sect ? 'Dựng Hộ Tông (Tông Chủ)' : 'Triển khai', '🧿', ButtonStyle.Success), btn(cid(uid, 'v', 'item', `${pick.id}:${pick.q}`), 'Chi tiết', 'ℹ️')));
  return shell(uid, 'tran', e, rows);
}

// ---------------------------------------------------------------- LINH ĐIỀN
function viewField(uid) {
  const s = Fd.status(uid); const e = E0('🌱 Linh Điền', 0x2ecc71);
  const rows = [];
  if (!s.f) {
    const F = C.FIELD;
    e.setDescription(`Bạn chưa có Linh Điền.\n**Điều kiện mở:** Linh Thực Sư cấp **${X.levelName(F.open.plv)}** · ${fmtNum(F.open.gold)} Linh Thạch · ${Object.entries(F.open.mat).map(([k, n]) => `${n} × ${I.BY_ID[k].name}`).join(', ')}.\nLinh Thực Sư hiện tại: ${X.levelName(s.lv)}.`);
    rows.push(rowOf(btn(cid(uid, 'fopen'), 'Khai khẩn Linh Điền', '🌱', ButtonStyle.Success), btn(cid(uid, 'v', 'hs.thuc'), 'Hồ sơ nghề', '📜')));
    return shell(uid, 'field', e, rows);
  }
  const nx = C.FIELD.levels[s.f.level];
  e.setDescription(`**Cấp Linh Điền:** ${s.f.level}/${C.FIELD.levels.length} · **${s.max}** ô · Linh Thực Sư: ${X.levelName(s.lv)}${nx ? `\n⬆️ Nâng cấp: ${fmtNum(nx.up.gold)} LT + ${Object.entries(nx.up.mat).map(([k, n]) => `${n} × ${I.BY_ID[k].name}`).join(', ')} (cần ${X.levelName(nx.up.plv)})` : ''}`);
  const used = new Map(s.plots.map((p) => [p.slot, p])); const lines = [];
  for (let i = 1; i <= s.max; i += 1) {
    const p = used.get(i);
    if (!p) { lines.push(`⬜ Ô ${i}: trống`); continue; }
    const sd = C.SEEDS[p.seed]; const crop = sd ? I.BY_ID[sd.crop].name : p.seed;
    lines.push(`${p.withered ? '🥀' : p.ready ? '🌾' : '🌱'} Ô ${i}: **${crop}** — ${p.withered ? 'héo (thu hoạch vẫn được, giảm sản lượng)' : p.ready ? '**chín, thu hoạch được**' : `còn ${fmtT(p.left)}`} · tưới ${p.water}${p.fert ? ` · bón ${p.fert === 'duong_mach' ? 'Dưỡng Mạch' : 'Thúc Sinh'}` : ''}`);
  }
  e.addFields({ name: 'Các ô đất', value: listFit(lines, 1000) });
  const seeds = Object.keys(C.SEEDS).map((id) => ({ id, n: Inv.qty(uid, id) })).filter((x) => x.n > 0);
  const si = Object.keys(C.SEEDS).map((id) => { const d = Fd.seedInfo(uid, id); return `${Emo.item(id)} ${I.BY_ID[id].name} → ${d.cropName}: ${fmtT(d.growSec)}, ~${d.yAvg.toFixed(1)} cây${s.lv < d.plv ? ` 🔒${X.levelName(d.plv)}` : ''}`; });
  e.addFields({ name: 'Linh Chủng', value: listFit(si, 1000) });
  if (seeds.length) {
    const sm = new StringSelectMenuBuilder().setCustomId(cid(uid, 'fplant')).setPlaceholder('Gieo Linh Chủng vào ô trống…');
    sm.addOptions(seeds.map((x) => ({ label: `${I.BY_ID[x.id].name} ×${x.n}`, value: x.id, emoji: optEmoji(Emo.item(x.id)) })));
    rows.push(rowOf(sm));
  } else e.setFooter({ text: 'Chưa có Linh Chủng — mua ở NPC hoặc nhặt ở Bí Cảnh.' });
  rows.push(rowOf(btn(cid(uid, 'fwater'), 'Tưới tất cả', '💧', ButtonStyle.Primary, !s.plots.length), btn(cid(uid, 'ffert', 'thuc_sinh'), 'Bón Thúc Sinh', '🧪', ButtonStyle.Secondary, !s.plots.length), btn(cid(uid, 'ffert', 'duong_mach'), 'Bón Dưỡng Mạch', '🧪', ButtonStyle.Secondary, !s.plots.length),
    btn(cid(uid, 'fharv'), 'Thu hoạch', '🌾', ButtonStyle.Success, !s.plots.some((p) => p.ready)), btn(cid(uid, 'fup'), 'Nâng cấp', '⬆️', ButtonStyle.Secondary, !nx)));
  return shell(uid, 'field', e, rows);
}

// ---------------------------------------------------------------- KHO ĐỒ PHÂN LOẠI
const CAT_ORDER = Object.entries(I.CATEGORIES).sort((a, b) => a[1].order - b[1].order).map(([k]) => k);
function viewInv(uid, arg = '') {
  const [cat0, pg0] = String(arg).split(':'); const cat = cat0 || 'ALL'; let page = Number(pg0) || 0;
  const all = Inv.list(uid).sort((a, b) => (I.CATEGORIES[a.item.cat]?.order || 99) - (I.CATEGORIES[b.item.cat]?.order || 99) || b.item.rarity - a.item.rarity || a.item.name.localeCompare(b.item.name, 'vi'));
  const counts = {}; for (const x of all) counts[x.item.cat] = (counts[x.item.cat] || 0) + 1;
  const list = cat === 'ALL' ? all : all.filter((x) => x.item.cat === cat);
  const pages = Math.max(1, Math.ceil(list.length / PAGE)); page = clamp(page, 0, pages - 1);
  const slice = list.slice(page * PAGE, page * PAGE + PAGE);
  const e = E0(`🎒 Kho Đồ — ${cat === 'ALL' ? 'Tất cả' : I.CATEGORIES[cat].label}`, 0x3498db);
  const gearN = G.listOf(uid).length;
  e.setDescription(slice.length ? slice.map((x) => `${Emo.rar(x.item.rarity)} ${Emo.item(x.id)} **${x.item.name}**${qn(x.q)} ×${fmtNum(x.qty)}${Inv.isLocked(uid, x.id, x.q) ? ' 🔒' : ''}`).join('\n') : 'Danh mục này đang trống.');
  e.addFields({ name: 'Danh mục', value: listFit(CAT_ORDER.filter((c) => counts[c]).map((c) => `${Emo.cat(c)} ${I.CATEGORIES[c].label}: **${counts[c]}** loại`).concat(gearN ? [`⚒️ Trang bị: **${gearN}** món (mục Trang Bị)`] : []), 1000, (n) => `… +${n}`) || 'Kho trống.' });
  e.setFooter({ text: `Trang ${page + 1}/${pages} · ${list.length} loại · ${Emo.rar(1)}…${Emo.rar(7)} = phẩm cấp từ Phổ thông tới Tiên phẩm` });
  const rows = [];
  const cm = new StringSelectMenuBuilder().setCustomId(cid(uid, 'icat')).setPlaceholder('Lọc theo danh mục…');
  cm.addOptions([{ label: 'Tất cả', value: 'ALL', emoji: optEmoji('🎒'), default: cat === 'ALL' }, ...CAT_ORDER.filter((c) => counts[c] || c === cat).slice(0, 24).map((c) => ({ label: `${I.CATEGORIES[c].label} (${counts[c] || 0})`, value: c, emoji: optEmoji(Emo.cat(c)), default: c === cat }))]);
  rows.push(rowOf(cm));
  if (slice.length) {
    const im = new StringSelectMenuBuilder().setCustomId(cid(uid, 'isel')).setPlaceholder('Xem chi tiết vật phẩm…');
    im.addOptions(slice.map((x) => ({ label: `${x.item.name}${x.q ? ` (${I.qName(x.q)})` : ''} ×${x.qty}`.slice(0, 100), value: `${x.id}:${x.q}`, description: `${x.item.rarity_name} · NPC ${fmtNum(Cat.sellPrice(x.id, x.q))} LT`.slice(0, 100), emoji: optEmoji(Emo.item(x.id)) })));
    rows.push(rowOf(im));
  }
  rows.push(rowOf(btn(cid(uid, 'v', 'inv', `${cat}:${page - 1}`), 'Trước', '⬅️', ButtonStyle.Secondary, page <= 0), btn(cid(uid, 'v', 'inv', `${cat}:${page + 1}`), 'Sau', '➡️', ButtonStyle.Secondary, page >= pages - 1),
    btn(cid(uid, 'v', 'npc'), 'Bán NPC', '🏪'), btn(cid(uid, 'v', 'gear'), 'Trang bị', '⚒️')));
  return shell(uid, 'inv', e, rows);
}
function viewItem(uid, arg) {
  const [id, q0] = String(arg).split(':'); const it = I.BY_ID[id]; if (!it) return viewInv(uid);
  const q = Number(q0) || 0; const bq = Inv.byQuality(uid, id); const have = Inv.qty(uid, id, q);
  const e = E0(`${Emo.item(id)} ${it.name}${q ? ` (${I.qName(q)})` : ''}`, I.RARITY[it.rarity - 1].color);
  const qs = Object.entries(bq).map(([k, n]) => `${Number(k) ? I.qName(Number(k)) : 'Thường'} ×${fmtNum(n)}`).join(' · ') || '—';
  e.setDescription(`${Emo.rar(it.rarity)} **${it.rarity_name}** · ${Emo.cat(it.cat)} ${I.CATEGORIES[it.cat]?.label || it.cat}${it.is_quest_item ? ' · 📌 Vật phẩm nhiệm vụ' : ''}\n${it.desc || ''}`);
  e.addFields({ name: 'Đang có', value: `${qs}${Inv.isLocked(uid, id, q) ? '\n🔒 Đã khoá — không bán/chuyển được' : ''}` });
  const src = Cat.sources(id).map(Cat.srcLabel); const use = Cat.usages(id).map(Cat.useLabel);
  if (src.length) e.addFields({ name: '📥 Nguồn nhận', value: listFit(src.map((x) => `• ${x}`), 1000, (n) => `… +${n}`) });
  if (use.length) e.addFields({ name: '📤 Công dụng', value: listFit(use.map((x) => `• ${x}`), 1000, (n) => `… +${n}`) });
  const price = Cat.sellPrice(id, q); const block = Npc.blockReason(uid, id, q);
  e.addFields({ name: '🏪 NPC', value: `${block ? `⛔ ${block}` : `Thu mua **${fmtNum(price)}** Linh Thạch/viên`}${C.NPC_SHOP[id] ? `\nBán: **${fmtNum(Cat.buyPrice(id))}** LT (≤ ${C.NPC_SHOP[id]}/ngày)` : ''}` });
  const s = `${id}:${q}`; const rows = [];
  const useBtn = Dan.isPill(id) ? btn(cid(uid, 'pu', s, '1'), 'Dùng', '💊', ButtonStyle.Success, have < 1)
    : LEGACY_PILLS.includes(id) ? btn(cid(uid, 'pu', s, '1'), 'Dùng', '💊', ButtonStyle.Success, have < 1)
      : Tr.isTran(id) ? btn(cid(uid, 'v', 'tran', s), 'Triển khai', '🧿', ButtonStyle.Success, have < 1)
        : C.SEEDS[id] ? btn(cid(uid, 'v', 'field'), 'Linh Điền', '🌱', ButtonStyle.Success)
          : id === 'tdc_tan_quyen_dan_phuong' ? btn(cid(uid, 'tanquyen'), 'Đọc', '📜', ButtonStyle.Success, have < 1) : null;
  rows.push(rowOf(...[btn(cid(uid, 'ilock', s), Inv.isLocked(uid, id, q) ? 'Mở khoá' : 'Khoá', Inv.isLocked(uid, id, q) ? '🔓' : '🔒', ButtonStyle.Secondary, have < 1),
    btn(cid(uid, 'isell', s, '1'), 'Bán ×1', '💰', ButtonStyle.Danger, !!block || have < 1), btn(cid(uid, 'v', 'sellc', `${s}:10`), 'Bán ×10', '💰', ButtonStyle.Danger, !!block || have < 2),
    btn(cid(uid, 'v', 'sellc', `${s}:all`), 'Bán tất cả', '💰', ButtonStyle.Danger, !!block || have < 1), useBtn].filter(Boolean)));
  rows.push(rowOf(btn(cid(uid, 'v', 'inv', `${it.cat}:0`), 'Về danh mục', '↩️')));
  return shell(uid, 'item', e, rows);
}
function viewSellConfirm(uid, arg) {
  const [id, q0, n0] = String(arg).split(':'); const it = I.BY_ID[id]; if (!it) return viewInv(uid);
  const q = Number(q0) || 0; const have = Inv.qty(uid, id, q); const n = n0 === 'all' ? have : Math.min(have, Number(n0) || 1);
  const e = E0('💰 Xác nhận bán', 0xe74c3c);
  const total = Cat.sellPrice(id, q) * n;
  e.setDescription(`Bán **${fmtNum(n)} × ${it.name}**${q ? ` (${I.qName(q)})` : ''} cho NPC → nhận **${fmtNum(total)}** Linh Thạch.\n${it.rarity >= 4 ? `⚠️ Đây là vật phẩm **${it.rarity_name}** — chắc chắn muốn bán?\n` : ''}**Không thể hoàn tác.**`);
  return shell(uid, 'sellc', e, [rowOf(btn(cid(uid, 'isell', `${id}:${q}`, String(n)), 'Xác nhận bán', '✅', ButtonStyle.Danger, n < 1), btn(cid(uid, 'v', 'item', `${id}:${q}`), 'Huỷ', '↩️'))]);
}

// ---------------------------------------------------------------- NPC
function parseNpc(arg) { const [cat, mr, pr] = String(arg || '').split(':'); return { cat: cat && cat !== 'ALL' ? cat : null, maxR: clamp(Number(mr) || 3, 1, 7), prod: pr === '1' }; }
const npcArg = (o) => `${o.cat || 'ALL'}:${o.maxR}:${o.prod ? 1 : 0}`;
function viewNpc(uid, arg = '') {
  const o = parseNpc(arg); const pv = Npc.previewAll(uid, { cat: o.cat, maxRarity: o.maxR, products: o.prod });
  const e = E0('🏪 NPC Thu Mua', 0xf39c12);
  e.setDescription(`NPC mua **mọi vật phẩm được phép bán** (trừ đồ nhiệm vụ/Phi Thăng/Thiên Đạo, đồ đã 🔒 khoá, trang bị đang mặc). Đồ V16 cũ (Nguyên Liệu, Đan Dược, Huyền Thiết…) cũng bán được.\n\n**Bộ lọc bán hàng loạt:** ${o.cat ? I.CATEGORIES[o.cat].label : 'Tất cả danh mục'} · phẩm cấp ≤ **${I.RARITY[o.maxR - 1].name}** · ${o.prod ? 'gồm' : 'KHÔNG gồm'} sản phẩm chế (đan/trận)\n**Xem trước:** ${pv.list.length} loại → **${fmtNum(pv.total)}** Linh Thạch`);
  if (pv.list.length) e.addFields({ name: 'Sẽ bán', value: listFit(pv.list.slice(0, 40).map((x) => `${Emo.item(x.id)} ${x.item.name}${qn(x.q)} ×${fmtNum(x.qty)}`), 1000, (n) => `… +${n} loại`) });
  const cm = new StringSelectMenuBuilder().setCustomId(cid(uid, 'ncat', npcArg(o))).setPlaceholder('Danh mục cần bán…');
  cm.addOptions([{ label: 'Tất cả danh mục', value: 'ALL', emoji: optEmoji('🎒'), default: !o.cat }, ...CAT_ORDER.slice(0, 24).map((c) => ({ label: I.CATEGORIES[c].label, value: c, emoji: optEmoji(Emo.cat(c)), default: c === o.cat }))]);
  const rm = new StringSelectMenuBuilder().setCustomId(cid(uid, 'nrar', npcArg(o))).setPlaceholder('Phẩm cấp tối đa được bán…');
  rm.addOptions(I.RARITY.map((r) => ({ label: `≤ ${r.name}`, value: String(r.id), emoji: optEmoji(Emo.rar(r.id)), default: r.id === o.maxR })));
  const rows = [rowOf(cm), rowOf(rm), rowOf(btn(cid(uid, 'v', 'npc', npcArg({ ...o, prod: !o.prod })), o.prod ? 'Bỏ gồm sản phẩm' : 'Gồm sản phẩm chế', '🧪'),
    btn(cid(uid, 'v', 'npcc', npcArg(o)), `Bán ${pv.list.length} loại`, '💰', ButtonStyle.Danger, !pv.list.length), btn(cid(uid, 'v', 'npcb'), 'Mua nguyên liệu', '🛒', ButtonStyle.Success))];
  return shell(uid, 'npc', e, rows);
}
function viewNpcConfirm(uid, arg) {
  const o = parseNpc(arg); const pv = Npc.previewAll(uid, { cat: o.cat, maxRarity: o.maxR, products: o.prod });
  const e = E0('💰 Xác nhận bán hàng loạt', 0xe74c3c);
  e.setDescription(`Bán **${pv.list.length} loại vật phẩm** → **${fmtNum(pv.total)}** Linh Thạch.\n**Không thể hoàn tác.** Đồ khoá/nhiệm vụ/đang mặc được giữ nguyên.`);
  if (pv.list.length) e.addFields({ name: 'Danh sách', value: listFit(pv.list.slice(0, 40).map((x) => `${x.item.name}${qn(x.q)} ×${fmtNum(x.qty)}`), 1000, (n) => `… +${n} loại`) });
  return shell(uid, 'npcc', e, [rowOf(btn(cid(uid, 'nsell', npcArg(o)), 'Xác nhận bán', '✅', ButtonStyle.Danger, !pv.list.length), btn(cid(uid, 'v', 'npc', npcArg(o)), 'Huỷ', '↩️'))]);
}
function viewNpcBuy(uid, sel = '') {
  const me = Cu.getCultivator(uid); const sl = Npc.shopList(uid);
  const e = E0('🛒 NPC Bán Nguyên Liệu Cơ Bản', 0x2ecc71);
  e.setDescription(`${sl.map((x) => `${Emo.item(x.id)} **${x.item.name}** — ${fmtNum(x.price)} LT · hôm nay ${x.bought}/${x.limit}`).join('\n')}\n\n💰 Bạn có **${fmtNum(me ? me.linh_thach : 0)}** Linh Thạch.\n_NPC bán đắt hơn giá thu mua — món quý phải tự kiếm._`);
  const sm = new StringSelectMenuBuilder().setCustomId(cid(uid, 'nbsel')).setPlaceholder('Chọn vật phẩm cần mua…');
  sm.addOptions(sl.map((x) => ({ label: `${x.item.name} — ${fmtNum(x.price)} LT`.slice(0, 100), value: x.id, emoji: optEmoji(Emo.item(x.id)), default: x.id === sel })));
  const rows = [rowOf(sm)];
  if (sel && C.NPC_SHOP[sel]) rows.push(rowOf(btn(cid(uid, 'nbuy', sel, '1'), 'Mua ×1', '🛒', ButtonStyle.Success), btn(cid(uid, 'nbuy', sel, '5'), 'Mua ×5', '🛒', ButtonStyle.Success), btn(cid(uid, 'nbuy', sel, '10'), 'Mua ×10', '🛒', ButtonStyle.Success), btn(cid(uid, 'v', 'npc'), 'Về thu mua', '↩️')));
  else rows.push(rowOf(btn(cid(uid, 'v', 'npc'), 'Về thu mua', '↩️')));
  return shell(uid, 'npcb', e, rows);
}

// ---------------------------------------------------------------- bộ dựng trang
function render(uid, view = 'home', a = '', b = '', note = '') {
  const [v, p] = String(view).split('.');
  let out;
  switch (v) {
    case 'home': out = viewHome(uid); break;
    case 'hs': { const r = viewProfile(uid, p || 'dan'); out = shell(uid, view, r.e, r.rows); break; }
    case 'cg': { const r = viewCg(uid, p || 'dan', Number(a) || 0); out = shell(uid, view, r.e, r.rows); break; }
    case 'kt': { const r = viewKt(uid, p || 'dan'); out = shell(uid, view, r.e, r.rows); break; }
    case 'tt': { const r = viewTt(uid, p || 'dan'); out = shell(uid, view, r.e, r.rows); break; }
    case 'ls': { const r = viewLs(uid, p || 'dan'); out = shell(uid, view, r.e, r.rows); break; }
    case 'rc': { const [rid, bo] = String(a).split(':'); const r = viewRc(uid, rid, (b || bo) === '1'); out = shell(uid, r.view || 'hs.dan', r.e, r.rows); break; }
    case 'pill': out = viewPill(uid, a); break;
    case 'gear': out = viewGear(uid, a); break;
    case 'gearc': out = viewGearConfirm(uid, a); break;
    case 'tran': out = viewTran(uid, a); break;
    case 'field': out = viewField(uid); break;
    case 'inv': out = viewInv(uid, a); break;
    case 'item': out = viewItem(uid, a); break;
    case 'sellc': out = viewSellConfirm(uid, a); break;
    case 'npc': out = viewNpc(uid, a); break;
    case 'npcc': out = viewNpcConfirm(uid, a); break;
    case 'npcb': out = viewNpcBuy(uid, a); break;
    default: out = viewHome(uid);
  }
  if (note) out.content = fit(note, 1900, '');
  return out;
}
/** Mở bảng (lệnh/nút): trả lời riêng tư. */
function open(i, uid, view = 'home', arg = '') { return i.reply({ ...render(String(uid), view, arg), flags: EPHEMERAL }); }

// ---------------------------------------------------------------- xử lý bấm nút (tĩnh)
registerStatic('ng', async (i, parts) => {
  const [uid, act, a0, b0] = parts; const a = a0 === undefined ? '' : a0; const b = b0 === undefined ? '' : b0;
  if (String(i.user.id) !== String(uid)) return i.reply({ content: '❌ Đây không phải bảng của bạn — gõ `/nghenghiep` để mở bảng riêng.', flags: EPHEMERAL });
  if (!Cu.getCultivator(i.user.id)) return i.update({ content: '❌ Bạn chưa bắt đầu tu tiên.', embeds: [], components: [] });
  const u = String(uid); const sel = (i.values || [])[0];
  const go = (view, aa = '', bb = '', note = '') => i.update(render(u, view, aa, bb, note));
  // `v` có thể mang 'rid:boost' / 'cat:page' trong b — tách khi cần
  const vv = (view, arg) => { const s = String(arg || ''); if (view === 'rc') { const [r, bo] = s.split(':'); return go('rc', r, bo || ''); } if (view === 'cg.' || view.startsWith('cg.')) return go(view, s); return go(view, s); };
  switch (act) {
    case 'nav': return go(sel || 'home');
    case 'v': return vv(a, b);
    case 'claimall': { const m = X.claimAll(u); return go('home', '', '', m.length ? m.join('\n\n') : '🎁 Chưa có thành phẩm nào đến giờ nhận.'); }
    case 'claim': { const m = X.claimAll(u, a || null); return go(b ? 'rc' : `hs.${a || 'dan'}`, b, '', m.length ? m.join('\n\n') : '🎁 Chưa có thành phẩm nào đến giờ nhận.'); }
    case 'promote': { const r = X.promote(u, a); return go(`hs.${a}`, '', '', r.msg); }
    case 'tanquyen': { const r = X.useTanQuyen(u); return go('hs.dan', '', '', r.msg); }
    case 'rsel': return go('rc', sel, '');
    case 'mk': { const [qty, bo] = String(b).split(':'); const r = X.start(u, a, Number(qty) || 1, { boost: bo === '1' }); return go('rc', a, bo === '1' ? '1' : '', r.msg); }
    case 'psel': return go('pill', sel);
    case 'pu': { const [id, q] = a.split(':'); const n = Number(b) || 1; let r;
      if (Dan.isPill(id)) r = Dan.use(u, id, Number(q) || 0, n); else if (LEGACY_PILLS.includes(id)) r = Dan.useLegacy(u, id); else r = { msg: '❌ Vật phẩm này không dùng trực tiếp.' };
      return go('pill', a, '', r.msg); }
    case 'gsel': return go('gear', sel);
    case 'geq': { const r = G.equip(u, Number(a)); return go('gear', a, '', r.msg); }
    case 'gun': { const r = G.unequip(u, Number(a)); return go('gear', a, '', r.msg); }
    case 'gen': { const r = G.enhance(u, Number(a)); return go('gear', a, '', r.msg); }
    case 'gre': { const r = G.refine(u, Number(a)); return go('gear', a, '', r.msg); }
    case 'grp': { const r = G.repair(u, Number(a)); return go('gear', a, '', r.msg); }
    case 'glk': { const g = G.get(u, Number(a)); if (g) G.setLock(u, Number(a), !g.locked); return go('gear', a, '', g ? (g.locked ? '🔓 Đã mở khoá.' : '🔒 Đã khoá — không phân giải/bán được.') : '❌ Không tìm thấy trang bị.'); }
    case 'gdis': { const r = G.dismantle(u, Number(a)); return go('gear', '', '', r.msg); }
    case 'gsell': { const r = Npc.sellGear(u, Number(a)); return go('gear', '', '', r.msg); }
    case 'tsel': return go('tran', sel);
    case 'tdp': { const [id, q] = a.split(':'); const r = Tr.deploy(u, id, Number(q) || 2); return go('tran', a, '', r.msg); }
    case 'fopen': { const r = Fd.open(u); return go('field', '', '', r.msg); }
    case 'fup': { const r = Fd.upgrade(u); return go('field', '', '', r.msg); }
    case 'fplant': { const s = Fd.status(u); const used = new Set(s.plots.map((p) => p.slot)); let slot = -1; for (let k = 1; k <= s.max; k += 1) if (!used.has(k)) { slot = k; break; }
      const r = slot < 0 ? { msg: '❌ Không còn ô trống.' } : Fd.plant(u, slot, sel); return go('field', '', '', r.msg); }
    case 'fwater': { const s = Fd.status(u); const m = []; let okN = 0; for (const p of s.plots) { if (p.ready) continue; const r = Fd.water(u, p.slot); if (r.ok) okN += 1; else if (m.length < 1) m.push(r.msg); } return go('field', '', '', `💧 Đã tưới ${okN} ô.${m.length ? `\n${m[0]}` : ''}`); }
    case 'ffert': { const s = Fd.status(u); let okN = 0; let last = ''; for (const p of s.plots) { if (p.ready || p.fert) continue; const r = Fd.fertilize(u, p.slot, a); if (r.ok) okN += 1; else { last = r.msg; break; } } return go('field', '', '', okN ? `🧪 Đã bón ${okN} ô.${last ? `\n${last}` : ''}` : (last || 'Không có ô nào cần bón.')); }
    case 'fharv': { const m = Fd.harvestAll(u); return go('field', '', '', m.length ? m.join('\n') : '🌾 Chưa có ô nào chín.'); }
    case 'icat': return go('inv', `${sel}:0`);
    case 'isel': return go('item', sel);
    case 'ilock': { const [id, q] = a.split(':'); const on = !Inv.isLocked(u, id, Number(q) || 0); Inv.setLock(u, id, Number(q) || 0, on); return go('item', a, '', on ? '🔒 Đã khoá vật phẩm.' : '🔓 Đã mở khoá.'); }
    case 'isell': { const [id, q] = a.split(':'); const Nq = Number(q) || 0; const n = b === 'all' ? Inv.qty(u, id, Nq) : Number(b) || 1; const r = Npc.sell(u, id, Nq, n);
      return r.ok && Inv.qty(u, id, Nq) < 1 ? go('inv', `${I.BY_ID[id].cat}:0`, '', r.msg) : go('item', a, '', r.msg); }
    case 'ncat': { const o = parseNpc(a); o.cat = sel === 'ALL' ? null : sel; return go('npc', npcArg(o)); }
    case 'nrar': { const o = parseNpc(a); o.maxR = Number(sel) || 3; return go('npc', npcArg(o)); }
    case 'nsell': { const o = parseNpc(a); const r = Npc.sellAll(u, { cat: o.cat, maxRarity: o.maxR, products: o.prod }); return go('npc', npcArg(o), '', r.msg); }
    case 'nbsel': return go('npcb', sel);
    case 'nbuy': { const r = Npc.buy(u, a, Number(b) || 1); return go('npcb', a, '', r.msg); }
    default: return go('home');
  }
});

module.exports = { render, open };
