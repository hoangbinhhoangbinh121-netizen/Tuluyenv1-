'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
/** v14.3: ghép các dòng vừa khít `max` ký tự (ô embed tối đa 1024) — cắt theo DÒNG, không cắt giữa emoji <:..:..>. */
function clipLines(lines, max) {
  const out = []; let len = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const more = `… và ${lines.length - i - 1} dòng nữa`;
    if (len + lines[i].length + 1 + (i < lines.length - 1 ? more.length + 1 : 0) > max && out.length) return `${out.join('\n')}\n… và ${lines.length - i} dòng nữa`;
    out.push(lines[i].length > max ? `${lines[i].slice(0, max - 2)}…` : lines[i]); len += lines[i].length + 1;
  }
  return out.join('\n');
}
const K = require('../game/constants');
const W = require('../game/sectwar');
const Cu = require('../game/cultivator');
const R = require('../game/realm');
const D = require('../db');
const { E } = require('../game/emoji');
const { getSectName } = require('../game/sectBase');
const { registerStatic, EPHEMERAL } = require('./kit');
const { toComponentEmoji } = require('../game/emoji');
const { sleep, fmtNum, now, int } = require('../util');

const ASSETS = path.join(__dirname, '..', '..', 'assets');
const LOADING = path.join(ASSETS, 'war_loading.jpg'); const MOUNTAIN = path.join(ASSETS, 'war_mountain.png');
const eph = (i, c) => i.reply({ content: c, flags: EPHEMERAL });
const isGuildAdmin = (i) => (i.memberPermissions && (i.memberPermissions.has('Administrator') || i.memberPermissions.has('ManageGuild'))) || K.ADMIN_DISCORD_IDS.some((x) => String(x) === String(i.user.id));

function buildKhotongEmbed(sectId) {
  const info = W.khotongInfo(sectId);
  const e = new EmbedBuilder().setTitle('🏛️ Kho Tông').setColor(0xf1c40f);
  if (!info) return e.setDescription('❌ Không tìm thấy tông môn.');
  const { sect, income } = info;
  e.addFields({ name: '💰 Linh Thạch', value: fmtNum(sect.treasury), inline: false }, { name: '📈 Thu nhập tuần', value: fmtNum(income), inline: false }, { name: '👤 Tông Chủ', value: `<@${sect.leader_id}>`, inline: false });
  if (sect.title) e.addFields({ name: '🎖️ Danh hiệu', value: sect.title, inline: false });
  return e.setFooter({ text: `Tông môn: ${sect.name} | Giới hạn rút/ngày của Tông Chủ: ${fmtNum(W.RUTKHO_DAILY_LIMIT)}` });
}

function buildRegistrationEmbed(warId) {
  const war0 = D.get('SELECT world FROM sect_wars WHERE war_id = ?', warId); const world = war0 ? (war0.world || 0) : 0;
  const rows = D.all('SELECT sect_id, COUNT(*) c FROM sect_war_participants WHERE war_id = ? GROUP BY sect_id', warId);
  const total = rows.reduce((s, r) => s + r.c, 0);
  const e = new EmbedBuilder().setTitle(`${E.tongmon} Tông Môn Chiến ${W.worldLabel(world)} — Đăng Ký Tham Gia`).setColor(world ? 0x5865f2 : 0xc27c0e)
    .setDescription(`Chiến trường **${W.worldLabel(world)}** đang mở đăng ký! Bấm **🙋 Tham Gia** để ghi danh cho tông môn của bạn.\n⚠️ Chỉ dành cho ${W.eligibilityText(world)}. Nhân Giới và Linh Giới có hai chiến trường riêng, tự chiến với nhau.\n🔒 Chỉ **Admin** mới có thể bấm **▶️ Bắt Đầu Trận** để chính thức khai chiến.`);
  e.addFields(rows.length
    ? { name: `📋 Danh sách ghi danh (${total} người)`, value: clipLines(rows.map((r) => `${E.tongmon} **${getSectName(r.sect_id)}** — ${r.c} người đã ghi danh`), 1000), inline: false }
    : { name: '📋 Danh sách ghi danh', value: 'Chưa có ai ghi danh.', inline: false });
  return e.setFooter({ text: 'Đăng ký không giới hạn số lượng tông môn tham chiến.' });
}
const buildLaunchEmbed = (pct, world = 0) => new EmbedBuilder().setTitle(`⚔️ Tông Môn Chiến ${W.worldLabel(world)} — Trận Pháp Đang Khởi Động`).setColor(0xc27c0e)
  .setDescription(`Trận pháp đang khởi động, các vị đạo hữu vui lòng chờ!\n\n${W.warbar(pct)}  **${pct}%**`).setImage('attachment://war_loading.jpg');
const buildEnterEmbed = (world = 0) => new EmbedBuilder().setTitle(`${E.tongmon} Tông Môn Chiến ${W.worldLabel(world)} — Đã Vào Chiến Trường!`).setColor(0xf1c40f)
  .setDescription('Các đạo hữu đã tiến vào chiến trường Bát Hoang. Bấm **🗺️ Bản đồ** bên dưới để xem tình hình cứ điểm và tham chiến.').setImage('attachment://war_mountain.png');

function buildMapEmbed(warId) {
  const war = D.get('SELECT * FROM sect_wars WHERE war_id = ?', warId);
  const nodes = W.getWarNodes(warId); const scores = W.getWarScores(warId);
  const e = new EmbedBuilder().setTitle(`${E.tongmon} Bản Đồ Tông Môn Chiến — ${W.worldLabel(war ? (war.world || 0) : 0)}`).setColor(0x992d22)
    .setDescription('```\n        🟥 Bắc Thành\n             ▲\n             │\n🟩 Tây Thành ◀─ 🏛️ Trung Tâm ─▶ 🟦 Đông Thành\n             │\n             ▼\n        🟨 Nam Thành\n```');
  for (const key of W.NODE_ORDER) {
    const n = nodes[key]; const info = W.NODES[key];
    const owner = n && n.owner_sect_id ? `👑 ${getSectName(n.owner_sect_id)}` : '⚪ Trung Lập';
    let contest = '';
    if (n && n.capture_sect_id && String(n.capture_sect_id) !== String(n.owner_sect_id)) contest = `\n⏳ ${getSectName(n.capture_sect_id)} đang chiếm... ${Math.min(100, Math.round(n.capture_progress / W.NODE_CAPTURE_SECONDS * 100))}%`;
    e.addFields({ name: `${info.emoji} ${info.name} (+${info.points}/10s)`, value: `${owner}${contest}`, inline: true });
  }
  const ranking = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  e.addFields({ name: `${E.cup} Bảng Xếp Hạng`, value: ranking.length ? clipLines(ranking.slice(0, 10).map(([sid, pts], i) => `**${i + 1}.** ${getSectName(sid)} — ${fmtNum(pts)} điểm`), 1000) : 'Chưa có tông môn nào ghi điểm.', inline: false });
  const wlog = W.getWarLog(warId);
  if (wlog.length) e.addFields({ name: '📜 Chiến Báo', value: clipLines(wlog, 1000), inline: false });
  if (war) {
    if (war.status === 'active') e.setFooter({ text: `⏳ Thời gian còn lại: ${W.fmtTimeLeft(war.ends_at - now())} | Đạt ${fmtNum(W.WIN_SCORE)} điểm để thắng ngay.` });
    else if (war.status === 'finished') e.setFooter({ text: '🏁 Trận chiến đã kết thúc.' });
  }
  return e;
}

// ============ Giao diện TĨNH (sống sót qua restart/hết hạn; customId = "sw|<hành động>|<war_id>|<đối số>") ============
const btn = (id, label, emoji, style = ButtonStyle.Secondary, disabled = false) => {
  const b = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style).setDisabled(disabled);
  const em = toComponentEmoji(emoji); if (em) b.setEmoji(em);
  return b;
};
const rowOf = (...items) => new ActionRowBuilder().addComponents(...items);
const nameOf = (i, uid) => { try { const m = i.guild && i.guild.members.cache.get(String(uid)); if (m) return m.displayName; } catch (_) { /* bỏ qua */ } return `Đạo hữu …${String(uid).slice(-4)}`; };

function mapComponents(warId) {
  const nodeBtns = W.NODE_ORDER.map((key) => btn(`sw|mv|${warId}|${key}`, W.NODES[key].name, W.NODES[key].emoji));
  return [rowOf(...nodeBtns),
    rowOf(btn(`sw|ga|${warId}`, 'Giao Chiến', E.kiem, ButtonStyle.Danger), btn(`sw|mp|${warId}`, 'Bảng Chiến Trường', '🎯', ButtonStyle.Success), btn(`sw|rf|${warId}`, 'Làm Mới Bản Đồ', E.lammoi, ButtonStyle.Primary))];
}
const mapView = (warId) => ({ components: () => mapComponents(warId) });
const enterWarView = (warId) => ({ components: () => [rowOf(btn(`sw|en|${warId}`, 'Bản Đồ', E.bando, ButtonStyle.Success))] });
const registrationView = (warId) => ({ components: () => [rowOf(btn(`sw|jn|${warId}`, 'Tham Gia', E.thamgia, ButtonStyle.Success), btn(`sw|st|${warId}`, 'Bắt Đầu Trận', E.batdautran, ButtonStyle.Danger))] });

/** Bảng Chiến Trường — 1 tin nhắn riêng của mỗi người, mọi thao tác đều CẬP NHẬT tại chỗ nên không bị trôi. */
function panelPayload(i, war, userId, note) {
  const warId = war.war_id; const part = W.getParticipant(warId, userId);
  const here = part && part.node_key ? part.node_key : null;
  const maxHp = part ? (part.max_hp || 0) : 0; const hp = part ? (part.hp || maxHp) : 0;
  const down = W.isDown(part);
  const lines = [`⚔️ **Bảng Chiến Trường — ${W.worldLabel(war.world || 0)}**`];
  if (!part) lines.push('Bạn chưa ghi danh trận này — dùng `/tongmonchien` để tham gia.');
  else {
    lines.push(`📍 ${here ? `**${W.NODES[here].name}**` : '_chưa tiến quân_'} · ❤️ ${down ? `☠️ trọng thương ${int(Math.max(0, part.revive_at - now()))}s` : `${fmtNum(hp)}/${fmtNum(maxHp)}`} · 🗡️ Hạ gục: ${part.kills || 0} · 🏷️ ${getSectName(part.sect_id)}`);
  }
  let enemies = [];
  if (here && !down) {
    enemies = D.all('SELECT * FROM sect_war_participants WHERE war_id = ? AND node_key = ? AND sect_id != ? AND user_id != ? AND (revive_at IS NULL OR revive_at <= ?)', warId, here, part.sect_id, userId, now());
    lines.push(enemies.length ? `👥 **Địch tại đây (${enemies.length}):**\n${enemies.slice(0, 8).map((x) => { const mx = x.max_hp || 1; return `• ${nameOf(i, x.user_id)} _(${getSectName(x.sect_id)})_ — ${fmtNum(x.hp ? x.hp : mx)}/${fmtNum(mx)}`; }).join('\n')}${enemies.length > 8 ? `\n… và ${enemies.length - 8} người nữa` : ''}` : '👥 Không có địch ở cứ điểm này.');
  }
  const log = W.getUserLog(warId, userId);
  if (log.length) lines.push(`📜 **Nhật ký:**\n${log.join('\n')}`);
  if (note) lines.push(note);
  if (war.status === 'active') lines.push(`⏳ Còn ${W.fmtTimeLeft(war.ends_at - now())}`);
  const rows = [rowOf(btn(`sw|pk|${warId}`, 'Đánh Tiếp', E.kiem, ButtonStyle.Danger), btn(`sw|pr|${warId}`, 'Làm Mới', E.lammoi, ButtonStyle.Primary), btn(`sw|pl|${warId}`, 'Rời Cứ Điểm', E.roicudiem))];
  rows.push(rowOf(...W.NODE_ORDER.map((key) => btn(`sw|pv|${warId}|${key}`, W.NODES[key].name, W.NODES[key].emoji, key === here ? ButtonStyle.Success : ButtonStyle.Secondary))));
  if (enemies.length) {
    rows.push(rowOf(new StringSelectMenuBuilder().setCustomId(`sw|ps|${warId}`).setPlaceholder('🎯 Chọn mục tiêu cụ thể...')
      .addOptions(enemies.slice(0, 25).map((x) => { const mx = x.max_hp || 1; return { label: String(nameOf(i, x.user_id)).slice(0, 100), description: `${getSectName(x.sect_id)} — HP ${fmtNum(x.hp ? x.hp : mx)}/${fmtNum(mx)}`.slice(0, 100), value: String(x.user_id) }; }))));
  }
  return { content: lines.join('\n').slice(0, 1900), components: rows, embeds: [] };
}
const sendPanel = (i, war, note, mode) => { const p = panelPayload(i, war, i.user.id, note); return mode === 'update' ? i.update(p) : i.reply({ ...p, flags: EPHEMERAL }); };

function loadWar(warId) { return D.get('SELECT * FROM sect_wars WHERE war_id = ?', warId); }
/** Kiểm tra người chơi hợp lệ cho trận → { row, war } | { err } */
function checkPlayer(i, warId) {
  const war = loadWar(warId);
  if (!war || war.status !== 'active') return { err: '🏁 Trận Tông Môn Chiến này không còn diễn ra.' };
  const row = Cu.getCultivator(i.user.id);
  if (!row || !row.sect_id) return { err: '❌ Bạn cần đã `/batdau` và gia nhập 1 tông môn (`/giatongmon`) để tham chiến.' };
  if (!W.isEligible(row, war.world || 0)) {
    return { err: W.worldOf(row) !== (war.world || 0) ? `❌ Đây là chiến trường **${W.worldName(war.world || 0)}**, còn bạn đang ở **${W.worldName(W.worldOf(row))}** — hãy dùng \`/tongmonchien\` để vào đúng chiến trường của mình.` : `❌ Tu vi của bạn không đủ điều kiện tham chiến (chỉ dành cho ${W.eligibilityText(war.world || 0)}).` };
  }
  return { row, war };
}
/** Tiến quân. Trả chuỗi ghi chú. */
function doMove(i, war, row, nodeKey) {
  const remain = W.checkActionCooldown(i.user.id);
  if (remain > 0) return `⏳ Thao tác quá nhanh, chờ ${remain.toFixed(1)}s.`;
  if (W.moveToNode(war.war_id, i.user.id, row.sect_id, nodeKey) === 'down') return '☠️ Bạn đang trọng thương, chưa thể tiến quân — chờ hồi sinh.';
  const line = nodeKey ? `🚩 Tiến quân tới **${W.NODES[nodeKey].name}**.` : '🏳️ Đã rời khỏi cứ điểm.';
  W.pushUserLog(war.war_id, i.user.id, line);
  return null;
}
/** Đánh: target = null → tự chọn địch yếu máu nhất. Trả ghi chú. */
function doFight(i, war, targetId) {
  const remain = W.checkActionCooldown(i.user.id);
  if (remain > 0) return `⏳ Thao tác quá nhanh, chờ ${remain.toFixed(1)}s.`;
  const r = W.getAttackableEnemies(war.war_id, i.user.id);
  if (r.error) return r.error;
  const tgt = targetId ? r.enemies.find((x) => String(x.user_id) === String(targetId)) : W.pickAutoTarget(r.enemies);
  if (!tgt) return '❌ Mục tiêu không còn ở cứ điểm này nữa (đã di chuyển/bị hạ) — hãy chọn lại.';
  const msg = W.doAttack(war.war_id, i.user.id, tgt.user_id, { admin: isGuildAdmin(i) });
  W.pushUserLog(war.war_id, i.user.id, msg.replace(/\*\*/g, '').slice(0, 220));
  return null;
}

registerStatic('sw', async (i, parts) => {
  const [action, warIdRaw, arg] = parts; const warId = Number(warIdRaw);
  if (!Number.isFinite(warId)) return;
  // ----- đăng ký -----
  if (action === 'jn') {
    const war = loadWar(warId);
    if (!war || war.status !== 'registration') return eph(i, '❌ Trận này không còn ở trạng thái đăng ký.');
    const row = Cu.getCultivator(i.user.id);
    if (!row || !row.sect_id) return eph(i, '❌ Bạn cần `/batdau` và gia nhập 1 tông môn trước khi tham chiến.');
    if (!W.isEligible(row, war.world || 0)) {
      return eph(i, W.worldOf(row) !== (war.world || 0)
        ? `❌ Đây là chiến trường **${W.worldName(war.world || 0)}**; bạn đang ở **${W.worldName(W.worldOf(row))}** — hãy dùng \`/tongmonchien\` để ghi danh đúng chiến trường.`
        : `❌ Tu vi của bạn không đủ điều kiện tham chiến (chỉ dành cho ${W.eligibilityText(war.world || 0)}). Hiện tại: ${R.realmDisplay(row.realm_index, row.stage_index)}.`);
    }
    if (W.getOtherActiveWarForUser(i.user.id, i.guildId)) return eph(i, '❌ Bạn đang tham gia 1 Tông Môn Chiến khác rồi, không thể ghi danh 2 trận cùng lúc.');
    W.joinWar(warId, i.user.id, row.sect_id);
    await i.update({ embeds: [buildRegistrationEmbed(warId)], components: registrationView(warId).components() });
    try { await i.followUp({ content: `🙋 <@${i.user.id}> đã ghi danh cho **${getSectName(row.sect_id)}**.`, flags: EPHEMERAL }); } catch (_) { /* bỏ qua */ }
    return;
  }
  if (action === 'st') {
    if (!isGuildAdmin(i)) return eph(i, '🔒 Chỉ **Admin** mới có thể bắt đầu Tông Môn Chiến.');
    const war = loadWar(warId);
    const n = D.get('SELECT COUNT(*) c FROM sect_war_participants WHERE war_id = ?', warId).c;
    if (!war || war.status !== 'registration') return eph(i, '❌ Trận này không còn ở trạng thái đăng ký.');
    if (n < 2) return eph(i, '❌ Cần ít nhất 2 người ghi danh mới có thể bắt đầu trận.');
    const world = war.world || 0;
    D.run("UPDATE sect_wars SET status = 'launching' WHERE war_id = ?", warId);
    const payload = { embeds: [buildLaunchEmbed(0, world)], components: [] };
    if (fs.existsSync(LOADING)) payload.files = [new AttachmentBuilder(LOADING, { name: 'war_loading.jpg' })];
    await i.update(payload);
    const msg = i.message;
    for (const pct of [20, 40, 60, 80, 100]) { await sleep(1100); try { await msg.edit({ embeds: [buildLaunchEmbed(pct, world)] }); } catch (_) { /* bỏ qua */ } }
    W.activateWar(warId);
    try {
      const p2 = { embeds: [buildEnterEmbed(world)], components: enterWarView(warId).components() };
      if (fs.existsSync(MOUNTAIN)) { p2.files = [new AttachmentBuilder(MOUNTAIN, { name: 'war_mountain.png' })]; p2.attachments = []; }
      await msg.edit(p2);
    } catch (_) { /* bỏ qua */ }
    try { await i.followUp({ content: `⚔️ **<@${i.user.id}> đã khai chiến chiến trường ${W.worldLabel(world)}!** Các đạo hữu đã ghi danh hãy bấm **🗺️ Bản đồ** phía trên để tham chiến.` }); } catch (_) { /* bỏ qua */ }
    return;
  }
  if (action === 'en') return i.reply({ embeds: [buildMapEmbed(warId)], components: mapComponents(warId) });
  // ----- bản đồ công khai -----
  if (action === 'rf') return i.update({ embeds: [buildMapEmbed(warId)], components: mapComponents(warId) });
  if (action === 'mp' || action === 'ga' || action === 'mv') {
    const c = checkPlayer(i, warId); if (c.err) return eph(i, c.err);
    let note = null;
    if (action === 'mv') note = doMove(i, c.war, c.row, arg);
    else if (action === 'ga') note = doFight(i, c.war, null);
    return sendPanel(i, c.war, note, 'reply');
  }
  // ----- bảng chiến trường (cập nhật tại chỗ) -----
  const c = checkPlayer(i, warId);
  if (c.err) return i.update({ content: c.err, components: [], embeds: [] });
  let note = null;
  if (action === 'pk') note = doFight(i, c.war, null);
  else if (action === 'ps') note = doFight(i, c.war, (i.values || [])[0]);
  else if (action === 'pv') note = doMove(i, c.war, c.row, arg);
  else if (action === 'pl') note = doMove(i, c.war, c.row, null);
  // 'pr' = chỉ làm mới
  return sendPanel(i, c.war, note, 'update');
});

/** Gửi kết quả trận vào kênh (gọi từ vòng lặp nền) */
async function announceFinished(client, f) {
  const { war, winner, mvp } = f;
  const ch = war.channel_id ? await client.channels.fetch(String(war.channel_id)).catch(() => null) : null;
  if (!ch) return;
  let text = winner
    ? `🏁 **Tông Môn Chiến ${W.worldLabel(war.world || 0)} kết thúc!** ${E.tongmon} Tông môn chiến thắng: **${getSectName(winner)}** 👑 (danh hiệu **${W.REWARD_WIN_TITLE}**, +${fmtNum(W.REWARD_WIN_LINHTHACH)} Linh Thạch kho tông, buff +5% EXP 24 giờ cho toàn tông).`
    : `🏁 **Tông Môn Chiến ${W.worldLabel(war.world || 0)} kết thúc** — không có tông môn nào ghi điểm.`;
  if (mvp) text += `\n👑 **MVP:** <@${mvp[0]}> — **${mvp[1]}** lần hạ gục.`;
  try { await ch.send(text); } catch (_) { /* bỏ qua */ }
}

module.exports = { buildKhotongEmbed, buildRegistrationEmbed, buildMapEmbed, registrationView, mapView, enterWarView, announceFinished, isGuildAdmin };
