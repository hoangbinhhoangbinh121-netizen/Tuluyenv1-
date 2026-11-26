'use strict';
const E9 = require('./emo19');   // v19.1: emoji pixel riêng của V19
/**
 * Giao diện Chứng Đạo Thành Đế V19 + Đế Đạo / Đế Binh / Đế Hiệu + Công Pháp Bản Mệnh.
 * Nút tĩnh: `cd19|<uid>|<act>|<arg>` (Chứng Đạo / Đế) và `bm19|<uid>|<act>|<arg>` (Bản Mệnh) — sống sót qua restart; trạng thái nằm trong DB.
 */
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const K = require('../game/constants');
const R = require('../game/realm');
const Cu = require('../game/cultivator');
const CD = require('../game/chungdao19');
const FX = require('../game/fx19');
const CFX = require('./chungdaoFx');   // v19.3: hiệu ứng ảnh/GIF (thuần trình diễn, có dự phòng chữ)
const BM = require('../game/benmenh19');
const D16 = require('../data/congphap_v16');
const { registerStatic, showModal, safeReply } = require('./kit');
const { fmtTime } = require('../game/format');
const { now } = require('../util');

const EPH = MessageFlags.Ephemeral; const fmt = (n) => Number(n).toLocaleString('vi-VN');
const bar = (cur, max, n = 12) => { const f = Math.round(n * Math.max(0, Math.min(1, max ? cur / max : 0))); return `${'█'.repeat(f)}${'░'.repeat(n - f)}`; };
const btn = (id, label, emoji, style = ButtonStyle.Secondary, disabled = false) => { const b = new ButtonBuilder().setCustomId(id.slice(0, 100)).setLabel(String(label).slice(0, 80)).setStyle(style).setDisabled(!!disabled); if (emoji) b.setEmoji(emoji); return b; };
const rowOf = (...c) => new ActionRowBuilder().addComponents(...c);
const P = ButtonStyle.Primary; const DG = ButtonStyle.Danger; const SU = ButtonStyle.Success; const GR = ButtonStyle.Secondary;
const cid = (uid, act, arg = '') => `cd19|${uid}|${act}${arg !== '' ? `|${arg}` : ''}`;
const hieuName = (uid, name) => FX.withHieu(uid, name);

// ================================================================ Chứng Đạo — trước / trong kiếp
function preView(uid) {
  const row = Cu.getCultivator(uid); const why = CD.whyCannot(row);
  const need = R.tuViRequiredFor(row);
  const list = Object.entries(CD.REQ).map(([id, n]) => { const h = require('../game/invsvc').qty(uid, id); return `${h >= n ? '✅' : '❌'} **${CD.itemName(id)}** ${fmt(h)}/${fmt(n)}`; }).join('\n');
  const emb = new EmbedBuilder().setColor(0xf1c40f).setTitle(`${E9.k('chungdao', '👑')} CON ĐƯỜNG CHỨNG ĐẠO`)
    .setDescription(`Tại **${K.REALMS[CD.GATE_REALM].name} · Viên Mãn**, phải vượt **Chứng Đạo Đại Kiếp** — **12 đạo Đế Kiếp** — mới thành **Tiên Đế**. Không thể bỏ qua Chuẩn Tiên Tôn → Tiên Tôn → Chuẩn Tiên Đế.`)
    .addFields(
      { name: '📜 Điều kiện', value: `Cảnh giới: **${R.realmDisplay(row.realm_index, row.stage_index)}** ${row.realm_index === CD.GATE_REALM && row.stage_index === CD.GATE_STAGE ? '✅' : '❌'}\nTu vi: ${fmt(row.tu_vi)}/${fmt(need)} ${row.tu_vi >= need ? '✅' : '❌'}\n${list}` },
      { name: `${E9.k('dekiep', '⚡')} 12 đạo lôi`, value: CD.STAGE_NAMES.map((n, s) => `**${n}:** ${CD.LOI.filter((l) => l.stage === s).map((l) => `${l.n}.${l.name} (${Math.round(l.pct * 100)}%)`).join(' · ')}`).join('\n').slice(0, 1020) },
      { name: '⚠️ Rủi ro', value: 'Thất bại: giữ cảnh giới, mất **10–20% tu vi**, nhận **Thiên Kiếp Trọng Thương**, khóa **24 giờ**, hoàn 50% tài nguyên (trừ Chứng Nhận). Mỗi đạo lôi bạn chọn cách ứng phó — đan dược, pháp bảo, công pháp, kỹ năng hoặc dốc toàn lực; không thể spam một nút.' },
      { name: '🌟 Khi thành công', value: 'Tiên Đế Sơ Kỳ · **Đế Ấn** · mở **Đế Đạo**, **Đế Binh**, **Đế Hiệu** · ghi lịch sử · thông báo toàn server.' },
    ).setFooter({ text: why ? why.replace(/\*\*/g, '').slice(0, 200) : 'Đủ điều kiện — bắt đầu sẽ trừ tài nguyên ngay' });
  return CFX.dressPre({ embeds: [emb], components: [rowOf(btn(cid(uid, 'begin'), 'Bắt Đầu Đại Kiếp', E9.comp('dekiep', '⚡'), DG, !!why), btn(cid(uid, 'hist'), 'Lịch Sử Chứng Đạo', '📖', GR), btn(cid(uid, 'rf'), 'Làm mới', '🔄', GR)), rowOf(btn(cid(uid, 'guide', 'ov'), 'Hướng dẫn lụm vật phẩm', E9.comp('chungdao', '📘'), SU))] });
}
/** v19.10: Bản hướng dẫn lụm vật phẩm Chứng Đạo (dữ liệu thật từ game/chungdaoGuide.js). */
function guideView(uid, page = 'ov') {
  const G = require('../game/chungdaoGuide'); const all = G.pages(uid); const key = G.PAGE_KEYS.some(([k]) => k === page) ? page : 'ov'; const pg = all[key];
  const emb = new EmbedBuilder().setColor(0xf1c40f).setTitle(pg.title.slice(0, 250)).addFields(...(pg.fields || []).map((f) => ({ name: f.name.slice(0, 250), value: String(f.value).slice(0, 1020) })))
    .setFooter({ text: 'Số liệu ~ là kỳ vọng solo (không tính sự kiện); tổ đội & Dị Biến nhặt nhiều hơn. Gõ /chungdao để quay lại.' });
  if (pg.description) emb.setDescription(pg.description.slice(0, 3900));
  const sel = new StringSelectMenuBuilder().setCustomId(cid(uid, 'gpick')).setPlaceholder('Chọn vật phẩm cần xem chỗ lụm…').addOptions(G.PAGE_KEYS.map(([k, l, ic]) => ({ label: l, value: k, emoji: { name: ic }, default: k === key })));
  return { content: '', embeds: [emb], components: [rowOf(sel), rowOf(btn(cid(uid, 'rf'), 'Quay lại /chungdao', '↩️', GR), btn(cid(uid, 'guide', key), 'Làm mới', '🔄', GR))] };
}
function kiepView(uid, k, note = '') {
  const n = Math.min(12, k.step); const L = CD.LOI[n - 1]; const pv = CD.loiPreview(k, n); const row = Cu.getCultivator(uid);
  const emb = new EmbedBuilder().setColor(0xe74c3c).setTitle(`${E9.k('dekiep', '⚡')} CHỨNG ĐẠO ĐẠI KIẾP — Đạo ${n}/12`)
    .setDescription(`**${CD.STAGE_NAMES[L.stage]}** · sắp giáng: **${L.name}**\nUy lực dự báo: ~**${fmt(pv.eff)}** (${Math.round(L.pct * 100)}% sinh mệnh gốc, đã trừ phòng ngự)${L.pierce ? '\n🔥 **Phá Giáp Thiên Kiếp:** bỏ qua 25% phòng ngự!' : ''}`)
    .addFields(
      { name: '❤️ Sinh mệnh', value: `${bar(k.hp, k.maxHp)} **${fmt(k.hp)}/${fmt(k.maxHp)}**${k.shield ? `  🔰 ${fmt(k.shield)}` : ''}`, inline: false },
      { name: '✨ Linh Lực', value: `${bar(k.ll, 100, 10)} ${Math.floor(k.ll)}%`, inline: true },
      { name: '💊 Đan dược', value: `${CD.DAN_MAX - k.danUsed}/${CD.DAN_MAX} viên`, inline: true },
      { name: '⏳ Hồi chiêu', value: ['dan', 'bao', 'cp', 'sk'].map((x) => `${CD.RESP[x].icon}${k.cd[x] > 0 ? k.cd[x] : '✔'}`).join('  '), inline: true })
    .setFooter({ text: `Hết hạn ứng kiếp sau ${fmtTime(Math.max(0, k.expireAt - now()))} không thao tác (coi như thất bại)${note ? ` · ${note}` : ''}` });
  if (k.log.length) emb.addFields({ name: '📜 Diễn biến', value: k.log.slice(-7).join('\n').slice(0, 1020) });
  const b = (a, st = GR) => { const bad = CD.canResp({ ...k, uid }, a, row); return btn(cid(uid, 'r', a), CD.RESP[a].name, CD.RESP[a].icon, st, !!bad); };
  return CFX.dressKiep({ content: '', embeds: [emb], components: [rowOf(b('none', P), b('dan', SU), b('bao')), rowOf(b('cp'), b('sk'), b('race'), b('dok', DG)), rowOf(btn(cid(uid, 'info'), 'Giải thích lựa chọn', '❓', GR), btn(cid(uid, 'rf'), 'Làm mới', '🔄', GR), btn(cid(uid, 'giveup'), 'Bỏ cuộc', '🏳️', DG))] }, n);
}
// ================================================================ Đế (sau khi chứng đạo)
const tabRow = (uid, cur) => rowOf(...[['ov', 'Tổng Quan', E9.comp('dean', '👑')], ['dao', 'Đế Đạo', E9.comp('dedao', '☯️')], ['binh', 'Đế Binh', E9.comp('debinh', '🗡️')], ['hieu', 'Đế Hiệu', E9.comp('dehieu', '🏷️')]].map(([k, l, e]) => btn(cid(uid, 'tab', k), l, e, k === cur ? P : GR)));
const fxText = (fx) => Object.entries(fx).map(([k, v]) => `${({ atk: 'ATK', def: 'DEF', hp: 'HP', spd: 'SPD', crit: 'Bạo kích', pierce: 'Xuyên giáp', dodge: 'Né tránh', regen: 'Hồi phục', boss: 'ST Boss', effRes: 'Kháng hiệu ứng', failKeep: 'Giữ tu vi', kiepDmg: 'Giảm lôi' })[k] || k} +${Math.round(v * 100)}%`).join(', ');
function deView(uid, tab = 'ov', note = '') {
  const s = CD.stateRow(uid); const row = Cu.getCultivator(uid); const binh = CD.binhOf(uid); const emb = new EmbedBuilder().setColor(0xf39c12);
  const rows = [tabRow(uid, tab)];
  if (tab === 'ov') {
    const hieu = FX.hieuOf(uid); const dao = s.de_dao ? FX.DE_DAO[s.de_dao] : null; const eq = s.binh_eq ? FX.DE_BINH[s.binh_eq] : null;
    emb.setTitle(`${E9.k('dean', '👑')} ${hieu ? `「${hieu}」` : 'Tiên Đế'}`).setDescription(`**${R.realmDisplay(row.realm_index, row.stage_index, true)}** ${s.grand ? '_(Tiên Đế từ trước V19)_' : `· Chứng Đạo lúc <t:${Math.floor(s.passed_at)}:D>`}`)
      .addFields({ name: `${E9.k('dedao', '☯️')} Đế Đạo chính`, value: dao ? `${E9.dao(s.de_dao, dao.icon)} **${dao.name}** · cấp **${s.de_dao_lv}/${FX.DAO_MAX_LEVEL}** · thức tỉnh ${s.de_dao_awake}/2\n${dao.desc}` : '_Chưa lĩnh ngộ — vào tab **Đế Đạo**_' },
        { name: `${E9.k('debinh', '🗡️')} Đế Binh đang mang`, value: eq ? `${E9.binh(s.binh_eq, eq.icon)} **${eq.name}** +${binh[s.binh_eq] || 0}\n${fxText(eq.fx)}\n_${eq.skill}: ${eq.skillDesc}_` : '_Chưa có — vào tab **Đế Binh** để chế tạo_' },
        { name: `${E9.k('dehieu', '🏷️')} Đế Hiệu`, value: hieu || '_Chưa đặt — tab **Đế Hiệu**_' });
  } else if (tab === 'dao') {
    emb.setTitle(`${E9.k('dedao', '☯️')} ĐẾ ĐẠO — 6 con đường`).setDescription(`Mỗi người chỉ có **một** Đế Đạo chính. Đổi Đế Đạo tốn gấp 3 và mất cấp/thức tỉnh.\n\n${FX.DAO_ORDER.map((k) => { const d = FX.DE_DAO[k]; return `${E9.dao(k, d.icon)} **${d.name}** — ${d.desc}`; }).join('\n')}`);
    if (s.de_dao) { const d = FX.DE_DAO[s.de_dao]; const nx = s.de_dao_lv < FX.DAO_MAX_LEVEL ? FX.daoCost(s.de_dao_lv) : null; const wn = FX.DAO_AWAKEN_LEVELS[s.de_dao_awake];
      emb.addFields({ name: `Hiện tại: ${E9.dao(s.de_dao, d.icon)} ${d.name} — cấp ${s.de_dao_lv}/${FX.DAO_MAX_LEVEL}`, value: `${fxText(Object.fromEntries(Object.entries(d.fx).map(([k, v]) => [k, v * FX.daoScale(s.de_dao_lv, s.de_dao_awake)])))}\n${d.awaken.map((a, i) => `${s.de_dao_awake > i ? '✅' : '🔒'} ${a}`).join('\n')}\n**Nâng cấp:** ${nx ? CD.costText(nx) : 'đã tối đa'}${wn ? `\n**Thức tỉnh ${s.de_dao_awake + 1}** (cần cấp ${wn}): ${CD.costText(CD.awakenCost(s.de_dao_awake))}` : ''}`.slice(0, 1020) }); }
    else emb.addFields({ name: 'Lĩnh ngộ lần đầu', value: CD.costText(FX.daoCost(0)) });
    rows.push(rowOf(new StringSelectMenuBuilder().setCustomId(cid(uid, 'pickdao')).setPlaceholder(s.de_dao ? 'Đổi Đế Đạo (tốn gấp 3)…' : 'Chọn Đế Đạo để lĩnh ngộ…').addOptions(FX.DAO_ORDER.map((k) => ({ label: FX.DE_DAO[k].name, description: FX.DE_DAO[k].desc.slice(0, 100), value: k, emoji: E9.daoComp(k, FX.DE_DAO[k].icon), default: s.de_dao === k })))));
    rows.push(rowOf(btn(cid(uid, 'daoup'), 'Nâng Cấp', '⬆️', SU, !s.de_dao || s.de_dao_lv >= FX.DAO_MAX_LEVEL), btn(cid(uid, 'daoaw'), 'Thức Tỉnh', '🌟', P, !s.de_dao || s.de_dao_awake >= 2)));
  } else if (tab === 'binh') {
    emb.setTitle(`${E9.k('debinh', '🗡️')} ĐẾ BINH`).setDescription('Mỗi người **mang 1** Đế Binh (hiệu ứng không cộng dồn). Cường hóa tối đa +10, mỗi cấp +8% hiệu ứng gốc.\n\n' + Object.entries(FX.DE_BINH).map(([k, d]) => `${E9.binh(k, d.icon)} **${d.name}** ${binh[k] !== undefined ? `· **+${binh[k]}**${s.binh_eq === k ? ' (đang mang)' : ''}` : '· _chưa có_'}\n　${fxText(d.fx)} · ${d.skill}: ${d.skillDesc}\n　${binh[k] === undefined ? `Chế tạo: ${CD.costText(d.craft)}` : binh[k] < FX.BINH_MAX_LEVEL ? `Cường hóa: ${CD.costText(FX.binhUpCost(binh[k]))}` : 'Đã tối đa'}`).join('\n').slice(0, 3900));
    rows.push(rowOf(new StringSelectMenuBuilder().setCustomId(cid(uid, 'pickbinh')).setPlaceholder('Chọn Đế Binh…').addOptions(Object.entries(FX.DE_BINH).map(([k, d]) => ({ label: `${d.name}${binh[k] !== undefined ? ` +${binh[k]}` : ''}`, description: (binh[k] !== undefined ? 'Đã sở hữu' : 'Chưa chế tạo'), value: k, emoji: E9.binhComp(k, d.icon) })))));
  } else if (tab === 'hieu') {
    const h = FX.hieuOf(uid); emb.setTitle(`${E9.k('dehieu', '🏷️')} ĐẾ HIỆU`).setDescription(`Đế Hiệu hiển thị ở **menu, hồ sơ, bảng xếp hạng, thông tin, PvP** và **thông báo toàn server**.\nĐộ dài **2–24 ký tự**, chỉ chữ cái/số/khoảng trắng.\n\nVí dụ: _Vĩnh Hằng Đế Quân · Hỗn Độn Đế Tôn · Vô Cực Tiên Đế · Luân Hồi Đại Đế · Thiên Đạo Đế Chủ · Bất Hủ Đế Quân_\n\nHiện tại: ${h ? `**${h}**` : '_chưa đặt_'}`);
    rows.push(rowOf(btn(cid(uid, 'sethieu'), h ? 'Đổi Đế Hiệu' : 'Đặt Đế Hiệu', E9.comp('dehieu', '🏷️'), P)));
  }
  if (note) emb.setFooter({ text: note.replace(/\*\*/g, '').slice(0, 200) });
  return CFX.dressTab({ content: '', embeds: [emb], components: rows }, tab);
}
/** Mở /chungdao: trả payload phù hợp tình trạng. */
function open(uid) {
  const sw = CD.sweepIdle(uid); const s = CD.ensureState(uid); const k = CD.kiepOf(s);
  if (sw && sw.result) return CFX.dress({ embeds: [resultEmbed(sw.result)], components: [] }, { image: sw.result.win ? 'win_d.jpg' : 'fail.jpg' });
  if (CD.passed(uid)) return deView(uid, 'ov');
  if (k) return kiepView(uid, k);
  return preView(uid);
}
const resultEmbed = (r) => new EmbedBuilder().setColor(r.win ? 0x2ecc71 : 0xe74c3c).setTitle(r.win ? `${E9.k('dean', '👑')} CHỨNG ĐẠO THÀNH ĐẾ!` : '💥 CHỨNG ĐẠO THẤT BẠI').setDescription(r.text + (!r.win && r.refund && Object.keys(r.refund).length ? `\n\n♻️ Hoàn: ${Object.entries(r.refund).map(([id, n]) => `${n} ${CD.itemName(id)}`).join(' · ')}` : ''));
async function announceWin(i, r) {
  try {
    const gid = i.guildId; if (!gid || !require('./worldChannel').get(gid)) return;
    const hieu = FX.hieuOf(i.user.id);
    const emb = new EmbedBuilder().setColor(0xf1c40f).setTitle(`${E9.k('chungdao', '👑')} ĐẠI ĐẠO CHẤN ĐỘNG — CHỨNG ĐẠO THÀNH ĐẾ!`).setDescription(`<@${i.user.id}> vượt qua **12 đạo Đế Kiếp**, bước lên **${R.realmDisplay(r.after.realm_index, r.after.stage_index, true)}**!\nThiên địa cộng hưởng, vạn đạo triều bái${hieu ? ` — Đế Hiệu **${hieu}**` : ''}.`).setTimestamp();
    const dressed = CFX.dress({ embeds: [emb] }, { image: 'win_d.jpg', thumb: 'de_an.png' });   // ảnh Đế Tọa + Đế Ấn (thiếu file → chỉ chữ)
    await require('./worldChannel').announceWorld(i.client, gid, emb, { files: dressed.files || null });
  } catch (e) { console.error('⚠️ thông báo Chứng Đạo:', e.message); }
}

const ioOf = (i) => ({ first: (p) => i.update(p), edit: (p) => i.editReply(p) });
const nameOf = (i) => (i.user && (i.user.displayName || i.user.username)) || 'Đạo hữu';
/** Cảnh kết quả (có ảnh; o.plain = dự phòng chỉ chữ). */
function winFinal(res, lines, o = {}) {
  const logE = lines && lines.length ? new EmbedBuilder().setColor(0x95a5a6).setDescription(lines.join('\n').slice(0, 3500)) : null;
  const p = { content: '', embeds: [resultEmbed(res)].concat(logE ? [logE] : []), components: [] };
  return o.plain ? Object.assign(p, { attachments: [] }) : CFX.dress(p, { image: 'win_d.jpg', thumb: 'de_an.png' });
}
function failFinal(res, lines, o = {}) {
  const logE = lines && lines.length ? new EmbedBuilder().setColor(0x95a5a6).setDescription(lines.join('\n').slice(0, 3500)) : null;
  const p = { content: '', embeds: [resultEmbed(res)].concat(logE ? [logE] : []), components: [] };
  return o.plain ? Object.assign(p, { attachments: [] }) : CFX.dress(p, { image: 'fail.jpg' });
}

registerStatic('cd19', async (i, parts) => {
  const [uid, act, arg] = parts;
  if (String(i.user.id) !== String(uid)) return safeReply(i, { content: '❌ Đây không phải bảng Chứng Đạo của bạn — gõ `/chungdao`.', flags: EPH });
  const upd = (v) => i.update(v);
  const bad = (m) => safeReply(i, { content: `❌ ${m}`, flags: EPH });
  switch (act) {
    case 'rf': return upd(open(uid));
    case 'guide': return upd(guideView(uid, arg));
    case 'gpick': return upd(guideView(uid, (i.values || [])[0]));
    case 'hist': { const h = CD.historyOf(uid, 8); return safeReply(i, { flags: EPH, content: h.length ? h.map((x) => `<t:${Math.floor(x.ts)}:f> — **${({ begin: 'Bắt đầu Đại Kiếp', win: '👑 Chứng đạo thành công', fail: '💥 Thất bại', dao_pick: 'Lĩnh ngộ Đế Đạo', dao_up: 'Nâng Đế Đạo', dao_awake: 'Thức tỉnh Đế Đạo', dao_switch: 'Đổi Đế Đạo', binh_craft: 'Chế Đế Binh', binh_up: 'Cường hóa Đế Binh', hieu: 'Đặt Đế Hiệu' })[x.kind] || x.kind}**`).join('\n') : 'Chưa có lịch sử Chứng Đạo.' }); }
    case 'begin': { const r = CD.begin(uid); if (!r.ok) return bad(r.error); return upd(kiepView(uid, r.k, 'Tài nguyên đã được trừ')); }
    case 'info': return safeReply(i, { flags: EPH, content: Object.values(CD.RESP).map((x) => `${x.icon} **${x.name}** — ${x.desc}`).join('\n') });
    case 'giveup': { const r = CD.giveUp(uid); if (!r.ok) return bad(r.error); return CFX.playFail(ioOf(i), nameOf(i), (o = {}) => failFinal(r.result, null, o)); }
    case 'r': {
      const r = CD.respond(uid, arg); if (!r.ok) return bad(r.error);
      if (r.ended === 'win') { await CFX.playWin(ioOf(i), nameOf(i), (o = {}) => winFinal(r.result, r.lines, o)); await announceWin(i, r.result); return null; }
      if (r.ended) { await CFX.playFail(ioOf(i), nameOf(i), (o = {}) => failFinal(r.result, r.lines, o)); return null; }
      const hn = Math.max(1, Math.min(12, r.k.step - 1));
      await CFX.playHit(ioOf(i), hn, CD.LOI[hn - 1].name, r.lines, () => kiepView(uid, r.k));
      return null;
    }
    case 'tab': return upd(deView(uid, arg));
    case 'pickdao': { const r = CD.chooseDao(uid, (i.values || [])[0]); if (!r.ok) return bad(r.error); return upd(deView(uid, 'dao', 'Đã lĩnh ngộ Đế Đạo')); }
    case 'daoup': { const r = CD.upgradeDao(uid); if (!r.ok) return bad(r.error); return upd(deView(uid, 'dao', `Đế Đạo lên cấp ${r.lv}`)); }
    case 'daoaw': { const r = CD.awakenDao(uid); if (!r.ok) return bad(r.error); return upd(deView(uid, 'dao', `Thức tỉnh lần ${r.n} thành công`)); }
    case 'pickbinh': {
      const k = (i.values || [])[0]; const d = FX.DE_BINH[k]; const have = CD.binhOf(uid)[k] !== undefined; const eq = CD.stateRow(uid).binh_eq === k;
      return i.reply({ flags: EPH, content: `${d.icon} **${d.name}** — ${have ? 'đã sở hữu' : 'chưa chế tạo'}`, components: [rowOf(btn(cid(uid, 'bcraft', k), 'Chế Tạo', '🔨', SU, have), btn(cid(uid, 'bequip', k), 'Trang Bị', '🛡️', P, !have || eq), btn(cid(uid, 'bup', k), 'Cường Hóa', '⬆️', GR, !have))] });
    }
    case 'bcraft': { const r = CD.craftBinh(uid, arg); return r.ok ? i.update({ content: `✅ Đã chế tạo **${FX.DE_BINH[arg].name}**!`, components: [] }) : bad(r.error); }
    case 'bequip': { const r = CD.equipBinh(uid, arg); return r.ok ? i.update({ content: `✅ Đang mang **${FX.DE_BINH[arg].name}**.`, components: [] }) : bad(r.error); }
    case 'bup': { const r = CD.upgradeBinh(uid, arg); return r.ok ? i.update({ content: `✅ **${FX.DE_BINH[arg].name}** lên +${r.lv}.`, components: [] }) : bad(r.error); }
    case 'sethieu': return showModal(i, { title: 'Đặt Đế Hiệu', fields: [{ id: 'h', label: 'Đế Hiệu (2–24 ký tự)', placeholder: 'Vĩnh Hằng Đế Quân', maxLength: 24 }], onSubmit: async (mi, get) => { const r = CD.setHieu(mi.user.id, get('h')); return mi.reply({ content: r.ok ? `✅ Đế Hiệu của bạn: **${r.hieu}**` : `❌ ${r.error}`, flags: EPH }); } });
    default: return null;
  }
});

// ================================================================ Công Pháp Bản Mệnh
const bmid = (uid, act, arg = '') => `bm19|${uid}|${act}${arg !== '' ? `|${arg}` : ''}`;
function bmView(uid, note = '') {
  const row = Cu.getCultivator(uid); const bm = BM.get(uid); const owned = [...Cu.ownedCongphapTiers(row)].filter((t) => D16.BY_TIER.has(t));
  const emb = new EmbedBuilder().setColor(0x16a085).setTitle(`${E9.k('benmenh', '🧿')} CÔNG PHÁP BẢN MỆNH`).setDescription('Mỗi người chỉ có **một** Công Pháp Bản Mệnh: cộng hưởng thêm hiệu ứng (+15% nếu đang trang bị, +40% nếu không), có thanh **lĩnh ngộ** và **thức tỉnh** ở cấp **30 / 60 / 90**. Đổi quyển phải tốn tài nguyên.');
  if (bm) {
    const lv = BM.levelOf(row, bm.tier); const next = BM.AWAKEN[bm.awaken];
    emb.addFields({ name: `${bm.book.icon || '📖'} ${bm.book.name} — cấp ${lv}`, value: `Phẩm: ${bm.book.phamName || ''} · thức tỉnh **${bm.awaken}/3**\nLĩnh ngộ: ${bar(bm.exp, 100, 12)} **${bm.exp}/100**${next ? '' : ' _(đã tối đa)_'}` },
      { name: `${E9.k('thucngo19', '🌟')} Thức tỉnh`, value: BM.AWAKEN.map((a, i) => `${bm.awaken > i ? '✅' : '🔒'} **Cấp ${a.level} — ${a.name}:** ${a.desc}`).join('\n') },
      { name: '💰 Chi phí', value: `Lĩnh ngộ: ${fmt(BM.insightCost(bm.awaken))} Linh Thạch (+${BM.INSIGHT_GAIN}, tối đa ${BM.DAILY_INSIGHT} lần/ngày)\n${next ? `Thức tỉnh ${bm.awaken + 1}: ${BM.costText(BM.awakenCost(bm.awaken))}` : ''}\nĐổi Bản Mệnh: ${BM.costText(BM.changeCost(bm.changes))}` });
  } else emb.addFields({ name: 'Chưa có Bản Mệnh', value: 'Chọn một công pháp mới (V16/V19) đã sở hữu bên dưới. **Lần đầu miễn phí.**' });
  emb.addFields({ name: `${E9.k('linhngo19', '🪷')} Nguồn lĩnh ngộ`, value: 'Bí Cảnh Tiên Giới (+1/tầng, +4 tầng cuối), Boss Thế Giới Đế Cấp (+3), nút Lĩnh Ngộ.' });
  if (note) emb.setFooter({ text: note.replace(/\*\*/g, '').slice(0, 200) });
  const rows = [];
  if (owned.length) rows.push(rowOf(new StringSelectMenuBuilder().setCustomId(bmid(uid, 'set')).setPlaceholder(bm ? 'Đổi Công Pháp Bản Mệnh (tốn tài nguyên)…' : 'Chọn Công Pháp Bản Mệnh…').addOptions(owned.slice(0, 25).map((t) => { const b = D16.BY_TIER.get(t); return { label: b.name.slice(0, 100), description: `Cấp ${BM.levelOf(row, t)}`, value: String(t), default: !!(bm && bm.tier === t) }; }))));
  rows.push(rowOf(btn(bmid(uid, 'med'), 'Lĩnh Ngộ', E9.comp('linhngo19', '🧘'), P, !bm || bm.awaken >= 3), btn(bmid(uid, 'awk'), 'Thức Tỉnh', E9.comp('thucngo19', '🌟'), SU, !bm || bm.awaken >= 3), btn(bmid(uid, 'rf'), 'Làm mới', '🔄', GR)));
  return { content: '', embeds: [emb], components: rows };
}
registerStatic('bm19', async (i, parts) => {
  const [uid, act] = parts; if (String(i.user.id) !== String(uid)) return safeReply(i, { content: '❌ Đây không phải bảng Bản Mệnh của bạn — gõ `/benmenh`.', flags: EPH });
  const bad = (m) => safeReply(i, { content: `❌ ${m}`, flags: EPH });
  if (act === 'rf') return i.update(bmView(uid));
  if (act === 'set') { const r = BM.set(uid, Number((i.values || [])[0])); return r.ok ? i.update(bmView(uid, r.first ? 'Đã đặt Bản Mệnh (miễn phí)' : 'Đã đổi Bản Mệnh')) : bad(r.error); }
  if (act === 'med') { const r = BM.meditate(uid); return r.ok ? i.update(bmView(uid, `Tĩnh tâm lĩnh ngộ +${r.gain}`)) : bad(r.error); }
  if (act === 'awk') { const r = BM.awaken(uid); return r.ok ? i.update(bmView(uid, `Thức tỉnh ${r.n}: ${r.info.name}`)) : bad(r.error); }
  return null;
});
module.exports = { open, guideView, preView, kiepView, deView, bmView, resultEmbed };
