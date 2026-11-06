'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const K = require('../game/constants');
const W = require('../game/sectwar');
const Cu = require('../game/cultivator');
const R = require('../game/realm');
const D = require('../db');
const { E } = require('../game/emoji');
const { getSectName } = require('../game/sectBase');
const { View, EPHEMERAL } = require('./kit');
const { sleep, fmtNum, now } = require('../util');

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
  const rows = D.all('SELECT sect_id, COUNT(*) c FROM sect_war_participants WHERE war_id = ? GROUP BY sect_id', warId);
  const total = rows.reduce((s, r) => s + r.c, 0);
  const e = new EmbedBuilder().setTitle(`${E.tongmon} Tông Môn Chiến — Đăng Ký Tham Gia`).setColor(0xc27c0e)
    .setDescription(`Trận chiến đang mở đăng ký! Bấm **🙋 Tham Gia** để ghi danh cho tông môn của bạn.\n⚠️ Chỉ dành cho tu vi **${W.eligibilityText()}**.\n🔒 Chỉ **Admin** mới có thể bấm **▶️ Bắt Đầu Trận** để chính thức khai chiến.`);
  e.addFields(rows.length
    ? { name: `📋 Danh sách ghi danh (${total} người)`, value: rows.map((r) => `${E.tongmon} **${getSectName(r.sect_id)}** — ${r.c} người đã ghi danh`).join('\n'), inline: false }
    : { name: '📋 Danh sách ghi danh', value: 'Chưa có ai ghi danh.', inline: false });
  return e.setFooter({ text: 'Đăng ký không giới hạn số lượng tông môn tham chiến.' });
}
const buildLaunchEmbed = (pct) => new EmbedBuilder().setTitle('⚔️ Tông Môn Chiến — Trận Pháp Đang Khởi Động').setColor(0xc27c0e)
  .setDescription(`Trận pháp đang khởi động, các vị đạo hữu vui lòng chờ!\n\n${W.warbar(pct)}  **${pct}%**`).setImage('attachment://war_loading.jpg');
const buildEnterEmbed = () => new EmbedBuilder().setTitle(`${E.tongmon} Tông Môn Chiến — Đã Vào Chiến Trường!`).setColor(0xf1c40f)
  .setDescription('Các đạo hữu đã tiến vào chiến trường Bát Hoang. Bấm **🗺️ Bản đồ** bên dưới để xem tình hình cứ điểm và tham chiến.').setImage('attachment://war_mountain.png');

function buildMapEmbed(warId) {
  const war = D.get('SELECT * FROM sect_wars WHERE war_id = ?', warId);
  const nodes = W.getWarNodes(warId); const scores = W.getWarScores(warId);
  const e = new EmbedBuilder().setTitle(`${E.tongmon} Bản Đồ Tông Môn Chiến`).setColor(0x992d22)
    .setDescription('```\n        🟥 Bắc Thành\n             ▲\n             │\n🟩 Tây Thành ◀─ 🏛️ Trung Tâm ─▶ 🟦 Đông Thành\n             │\n             ▼\n        🟨 Nam Thành\n```');
  for (const key of W.NODE_ORDER) {
    const n = nodes[key]; const info = W.NODES[key];
    const owner = n && n.owner_sect_id ? `👑 ${getSectName(n.owner_sect_id)}` : '⚪ Trung Lập';
    let contest = '';
    if (n && n.capture_sect_id && String(n.capture_sect_id) !== String(n.owner_sect_id)) contest = `\n⏳ ${getSectName(n.capture_sect_id)} đang chiếm... ${Math.min(100, Math.round(n.capture_progress / W.NODE_CAPTURE_SECONDS * 100))}%`;
    e.addFields({ name: `${info.emoji} ${info.name} (+${info.points}/10s)`, value: `${owner}${contest}`, inline: true });
  }
  const ranking = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  e.addFields({ name: `${E.cup} Bảng Xếp Hạng`, value: ranking.length ? ranking.slice(0, 10).map(([sid, pts], i) => `**${i + 1}.** ${getSectName(sid)} — ${fmtNum(pts)} điểm`).join('\n') : 'Chưa có tông môn nào ghi điểm.', inline: false });
  if (war) {
    if (war.status === 'active') e.setFooter({ text: `⏳ Thời gian còn lại: ${W.fmtTimeLeft(war.ends_at - now())} | Đạt ${fmtNum(W.WIN_SCORE)} điểm để thắng ngay.` });
    else if (war.status === 'finished') e.setFooter({ text: '🏁 Trận chiến đã kết thúc.' });
  }
  return e;
}

function targetSelectView(warId, attackerId, nodeKey, enemies) {
  const v = new View({ ownerId: attackerId, timeout: 60 });
  v.select({
    key: 'tg', placeholder: `Chọn mục tiêu tại ${W.NODES[nodeKey].name}...`,
    options: enemies.slice(0, 25).map((x) => { const maxHp = x.max_hp || 1; const hp = x.hp ? x.hp : maxHp; return { label: `Đạo hữu ${x.user_id}`, description: `${getSectName(x.sect_id)} — HP ${hp}/${maxHp}`, value: String(x.user_id) }; }),
  }, async (i, values) => {
    const msg = W.doAttack(warId, attackerId, values[0]);
    await i.update({ content: msg, components: [] });
    try { await i.followUp({ content: msg }); } catch (_) { /* bỏ qua */ }
  });
  return v;
}

function mapView(warId) {
  const v = new View({ ownerId: null, checkOwner: false, timeout: 600 });
  for (const key of W.NODE_ORDER) {
    const info = W.NODES[key];
    v.button({ key: `mv_${key}`, label: info.name, emoji: info.emoji, style: 'secondary', row: key === 'trungtam' ? 1 : 0 }, async (i) => {
      const row = Cu.getCultivator(i.user.id);
      if (!row || !row.sect_id) return eph(i, '❌ Bạn cần đã `/batdau` và gia nhập 1 tông môn (`/giatongmon`) để tham chiến.');
      if (!W.isEligible(row)) return eph(i, `❌ Tu vi của bạn không đủ điều kiện tham chiến (chỉ dành cho ${W.eligibilityText()}).`);
      const remain = W.checkActionCooldown(i.user.id);
      if (remain > 0) return eph(i, `⏳ Thao tác quá nhanh, chờ ${remain.toFixed(1)}s.`);
      if (W.moveToNode(warId, i.user.id, row.sect_id, key) === 'down') return eph(i, '☠️ Bạn đang trọng thương, chưa thể tiến quân — chờ hồi sinh tại đại bản doanh.');
      return eph(i, `🚩 <@${i.user.id}> đã tiến quân tới **${info.name}**.`);
    });
  }
  v.button({ key: 'atk', label: 'Giao Chiến', emoji: E.kiem, style: 'danger', row: 2 }, async (i) => {
    const remain = W.checkActionCooldown(i.user.id);
    if (remain > 0) return eph(i, `⏳ Thao tác quá nhanh, chờ ${remain.toFixed(1)}s.`);
    const r = W.getAttackableEnemies(warId, i.user.id);
    if (r.error) return eph(i, r.error);
    return i.reply({ content: '🎯 Chọn mục tiêu để giao chiến (đối phương không có quyền từ chối):', components: targetSelectView(warId, i.user.id, r.nodeKey, r.enemies).components(), flags: EPHEMERAL });
  });
  v.button({ key: 'rf', label: 'Làm Mới Bản Đồ', emoji: E.lammoi, style: 'blurple', row: 2 }, (i) => i.update({ embeds: [buildMapEmbed(warId)], components: v.components() }));
  v.button({ key: 'lv', label: 'Rời Cứ Điểm', emoji: E.roicudiem, style: 'secondary', row: 2 }, (i) => {
    const row = Cu.getCultivator(i.user.id);
    if (!row) return eph(i, '❌ Bạn chưa `/batdau`.');
    W.moveToNode(warId, i.user.id, row.sect_id || 0, null);
    return eph(i, '🏳️ Bạn đã rời khỏi cứ điểm hiện tại.');
  });
  return v;
}
function enterWarView(warId) {
  const v = new View({ ownerId: null, checkOwner: false, timeout: 600 });
  v.button({ key: 'map', label: 'Bản Đồ', emoji: E.bando, style: 'green' }, (i) => i.reply({ embeds: [buildMapEmbed(warId)], components: mapView(warId).components() }));
  return v;
}

function registrationView(warId) {
  const v = new View({ ownerId: null, checkOwner: false, timeout: 900 });
  v.button({ key: 'join', label: 'Tham Gia', emoji: E.thamgia, style: 'green' }, async (i) => {
    const row = Cu.getCultivator(i.user.id);
    if (!row || !row.sect_id) return eph(i, '❌ Bạn cần `/batdau` và gia nhập 1 tông môn trước khi tham chiến.');
    if (!W.isEligible(row)) return eph(i, `❌ Tu vi của bạn không đủ điều kiện tham chiến (chỉ dành cho ${W.eligibilityText()}). Hiện tại: ${R.realmDisplay(row.realm_index, row.stage_index)}.`);
    if (W.getOtherActiveWarForUser(i.user.id, i.guildId)) return eph(i, '❌ Bạn đang tham gia 1 Tông Môn Chiến khác rồi, không thể ghi danh 2 trận cùng lúc.');
    W.joinWar(warId, i.user.id, row.sect_id);
    await i.update({ embeds: [buildRegistrationEmbed(warId)], components: v.components() });
    try { await i.followUp({ content: `🙋 <@${i.user.id}> đã ghi danh cho **${getSectName(row.sect_id)}**.`, flags: EPHEMERAL }); } catch (_) { /* bỏ qua */ }
  });
  v.button({ key: 'start', label: 'Bắt Đầu Trận', emoji: E.batdautran, style: 'danger' }, async (i) => {
    if (!isGuildAdmin(i)) return eph(i, '🔒 Chỉ **Admin** mới có thể bắt đầu Tông Môn Chiến.');
    const war = D.get('SELECT * FROM sect_wars WHERE war_id = ?', warId);
    const n = D.get('SELECT COUNT(*) c FROM sect_war_participants WHERE war_id = ?', warId).c;
    if (!war || war.status !== 'registration') return eph(i, '❌ Trận này không còn ở trạng thái đăng ký.');
    if (n < 2) return eph(i, '❌ Cần ít nhất 2 người ghi danh mới có thể bắt đầu trận.');
    D.run("UPDATE sect_wars SET status = 'launching' WHERE war_id = ?", warId);
    const payload = { embeds: [buildLaunchEmbed(0)], components: [] };
    if (fs.existsSync(LOADING)) payload.files = [new AttachmentBuilder(LOADING, { name: 'war_loading.jpg' })];
    await i.update(payload);
    const msg = i.message;
    for (const pct of [20, 40, 60, 80, 100]) { await sleep(1100); try { await msg.edit({ embeds: [buildLaunchEmbed(pct)] }); } catch (_) { /* bỏ qua */ } }
    W.activateWar(warId);
    try {
      const p2 = { embeds: [buildEnterEmbed()], components: enterWarView(warId).components() };
      if (fs.existsSync(MOUNTAIN)) { p2.files = [new AttachmentBuilder(MOUNTAIN, { name: 'war_mountain.png' })]; p2.attachments = []; }
      await msg.edit(p2);
    } catch (_) { /* bỏ qua */ }
    try { await i.followUp({ content: `⚔️ **<@${i.user.id}> đã khai chiến!** Các đạo hữu đã ghi danh hãy bấm **🗺️ Bản đồ** phía trên để tham chiến.` }); } catch (_) { /* bỏ qua */ }
  });
  return v;
}

/** Gửi kết quả trận vào kênh (gọi từ vòng lặp nền) */
async function announceFinished(client, f) {
  const { war, winner, mvp } = f;
  const ch = war.channel_id ? await client.channels.fetch(String(war.channel_id)).catch(() => null) : null;
  if (!ch) return;
  let text = winner
    ? `🏁 **Tông Môn Chiến kết thúc!** ${E.tongmon} Tông môn chiến thắng: **${getSectName(winner)}** 👑 (danh hiệu **${W.REWARD_WIN_TITLE}**, +${fmtNum(W.REWARD_WIN_LINHTHACH)} Linh Thạch kho tông, buff +5% EXP 24 giờ cho toàn tông).`
    : '🏁 **Tông Môn Chiến kết thúc** — không có tông môn nào ghi điểm.';
  if (mvp) text += `\n👑 **MVP:** <@${mvp[0]}> — **${mvp[1]}** lần hạ gục.`;
  try { await ch.send(text); } catch (_) { /* bỏ qua */ }
}

module.exports = { buildKhotongEmbed, buildRegistrationEmbed, buildMapEmbed, registrationView, mapView, enterWarView, announceFinished, isGuildAdmin };
