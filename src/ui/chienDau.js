'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const K = require('../game/constants');
const Cu = require('../game/cultivator');
const B = require('../game/bicanh');
const Boss = require('../game/boss');
const { E } = require('../game/emoji');
const { View, EPHEMERAL } = require('./kit');
const { COLOR } = require('./embeds');
const R = require('../game/realm');

const ASSETS = path.join(__dirname, '..', '..', 'assets');

function buildLinhgioiEmbed(row) {
  const progress = B.loadLinhgioiProgress(row);
  const e = new EmbedBuilder().setTitle(`${E.bicanhlinhgioi} Bí Cảnh Linh Giới`).setColor(0x9b59b6)
    .setDescription(`${R.worldTierFlavor(row.world_tier)}\n\n${E.linhngothiendao} Lĩnh Ngộ Thiên Đạo: **${row.diem_linh_ngo}/${B.DIEM_LINH_NGO_MAX}%**\nHoàn thành cả 12 cấp lần đầu để đạt 100% và mở khóa lộ trình Phi Thăng Tiên Giới.`);
  for (const chain of B.CHAINS) {
    const locked = row.realm_index < chain.require_realm;
    const lines = chain.sub_names.map((name, i) => {
      const info = progress[`${chain.key}_${i + 1}`] || { count: 0, first: false };
      return `${info.first ? '✅' : locked ? '🔒' : '⬜'} ${name} — đã khám phá ${info.count || 0} lần`;
    });
    e.addFields({ name: chain.name, value: lines.join('\n'), inline: false });
  }
  return e;
}

/** Menu Bí Cảnh gộp: 4 cấp thường + 12 cấp con Linh Giới trong 1 select. */
function bicanhAllView(userId, row) {
  const v = new View({ ownerId: userId, timeout: 180 });
  const ri = row.realm_index; const options = [];
  K.BICANH_TIERS.forEach((tier, i) => {
    const locked = ri < tier.require_realm;
    const desc = tier.require_realm > 0 ? `Yêu cầu ${K.REALMS[tier.require_realm].name} trở lên` : 'Không giới hạn cảnh giới';
    options.push({ label: tier.name, description: (locked ? '🔒 ' : '') + desc, value: `std:${i}`, emoji: E.bicanh });
  });
  const worldLocked = row.world_tier < 1;
  for (const en of B.allLinhgioiSubtiers()) {
    const { chain, sub_idx: si, sub_name: sn } = en;
    const locked = worldLocked || ri < chain.require_realm || (ri === chain.require_realm && row.stage_index < si);
    const desc = worldLocked ? 'Cần Phi Thăng Linh Giới trước' : `Yêu cầu ${K.REALMS[chain.require_realm].name} - ${K.SUB_4[si]} trở lên`;
    options.push({ label: `${chain.name.replace(E.bicanh, '').trim()} — ${sn}`.slice(0, 100), description: (locked ? `🔒 ${desc}` : desc).slice(0, 100), value: `lg:${en.sub_key}`, emoji: E.bicanh });
  }
  // Discord giới hạn 25 lựa chọn/select: 4 + 12 = 16 nên vừa đủ.
  v.select({ key: 'bc', placeholder: 'Chọn Bí Cảnh muốn khám phá...', options }, async (i, values) => {
    await i.deferReply({ flags: EPHEMERAL });
    const [kind, payload] = [values[0].split(':')[0], values[0].split(':').slice(1).join(':')];
    const result = kind === 'std' ? B.doBicanh(userId, Number(payload)) : B.doBicanhLinhgioi(userId, payload);
    await i.followUp({ embeds: [require('./templates/dungeon').result(result)], flags: EPHEMERAL });
  });
  return v;
}

async function sendDacBietResult(i, userId, group) {
  const msg = B.doBicanhDacBiet(userId, group);
  const g = B.DACBIET_GROUPS[group] || {};
  const p = g.image && path.join(ASSETS, g.image);
  if (msg.startsWith('❌') || msg.startsWith('🔒') || !p || !fs.existsSync(p)) return i.reply({ content: msg, flags: EPHEMERAL });
  const emb = new EmbedBuilder().setDescription(msg).setColor(group === 'linh_gioi' ? 0x9b59b6 : 0xf1c40f).setImage(`attachment://${g.image}`);
  return i.reply({ embeds: [emb], files: [new AttachmentBuilder(p, { name: g.image })], flags: EPHEMERAL });
}
function bicanhDacBietView(userId) {
  const v = new View({ ownerId: userId, timeout: 120 });
  v.button({ key: 'ng', label: 'Nhân Giới (Luyện Khí - Hóa Thần)', emoji: E.nhangioi, style: 'green' }, (i) => sendDacBietResult(i, userId, 'nhan_gioi'));
  v.button({ key: 'lg', label: 'Linh Giới (Luyện Hư - Độ Kiếp Viên Mãn)', emoji: E.bicanh, style: 'blurple' }, (i) => sendDacBietResult(i, userId, 'linh_gioi'));
  return v;
}

function chienDauGroupView(userId) {
  const v = new View({ ownerId: userId, timeout: 120 });
  v.button({ key: 'bicanh', label: 'Bí Cảnh', emoji: E.bicanh, style: 'green' }, async (i) => {
    const row = Cu.getCultivator(userId);
    const payload = { content: `${E.bicanh} Chọn Bí Cảnh muốn khám phá (Bí Cảnh thường + Bí Cảnh Linh Giới):`, components: bicanhAllView(userId, row).components(), flags: EPHEMERAL };
    if (row.world_tier >= 1) payload.embeds = [buildLinhgioiEmbed(row)];
    await i.reply(payload);
  });
  v.button({ key: 'dacbiet', label: 'Bí Cảnh Đặc Biệt', emoji: E.vebicanhdacbiet, style: 'blurple' }, (i) => {
    const ve = Cu.getCultivator(userId).ve_bicanh_dac_biet || 0;
    return i.reply({ content: `${E.vebicanhdacbiet} **Bí Cảnh Đặc Biệt** — hiện có **${ve}** Vé (rơi 10% khi kết liễu Boss Thế Giới). Chọn nhánh phù hợp cảnh giới của bạn:`, components: bicanhDacBietView(userId).components(), flags: EPHEMERAL });
  });
  v.button({ key: 'boss', label: 'Boss Thế Giới', emoji: E.bosstg, style: 'red' }, async (i) => {
    const boss = i.guildId && Boss.getAliveBoss(i.guildId);
    if (!boss) return i.reply({ content: '❌ Hiện không có Boss Thế Giới nào — chờ admin triệu hồi.', flags: EPHEMERAL });
    return i.reply({ ...require('./bossViews').panelPayload(boss), flags: EPHEMERAL });
  });
  v.button({ key: 'thuongco', label: 'Thượng Cổ Thủ Hộ', emoji: E.thuongcothuho, style: 'red' }, (i) =>
    i.reply({ content: require('../game/ascension').doDanhThuongcoThuho(userId), flags: EPHEMERAL }));
  return v;
}

module.exports = { chienDauGroupView, bicanhAllView, buildLinhgioiEmbed };
