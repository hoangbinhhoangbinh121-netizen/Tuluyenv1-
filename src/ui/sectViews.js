'use strict';
const { EmbedBuilder } = require('discord.js');
const K = require('../game/constants');
const S = require('../game/sect');
const { E } = require('../game/emoji');
const { View, showModal, EPHEMERAL } = require('./kit');
const Cu = require('../game/cultivator');
const { fmtNum } = require('../util');

const eph = (i, c) => i.reply({ content: c, flags: EPHEMERAL });

function buildSectEmbed(row) {
  if (!row.sect_id) return new EmbedBuilder().setTitle(`${E.tongmon} Tông Môn`).setDescription('Bạn chưa gia nhập tông môn nào.').setColor(0xe67e22);
  const s = S.getSect(row.sect_id);
  const e = new EmbedBuilder().setTitle(`${E.tongmon} ${s.name}`).setColor(0xe67e22).addFields(
    { name: '👑 Tông Chủ', value: `<@${s.leader_id}>`, inline: true }, { name: 'Cấp Tông Môn', value: String(s.level), inline: true },
    { name: 'Kinh Nghiệm', value: `${s.exp}/${s.level * 1000}`, inline: true }, { name: 'Thành Viên', value: String(S.memberCount(row.sect_id)), inline: true },
    { name: 'Cống Hiến Của Bạn', value: String(row.sect_contribution), inline: true });
  if (s.title) e.addFields({ name: '🏅 Danh Hiệu', value: s.title, inline: true });
  return e;
}
function buildMembersEmbed(sectId) {
  const s = S.getSect(sectId);
  if (!s) return new EmbedBuilder().setTitle('❌ Tông Môn').setDescription('Không tìm thấy tông môn.').setColor(0xe74c3c);
  const members = S.listMembers(sectId);
  const groups = Object.fromEntries(Object.keys(K.SECT_ROLES).map((k) => [k, []]));
  for (const m of members) {
    const role = String(m.user_id) === String(s.leader_id) ? 'tongchu' : (K.SECT_ROLES[m.sect_role] ? m.sect_role : 'detu');
    groups[role].push(m);
  }
  const e = new EmbedBuilder().setTitle(`👥 Thành Viên — ${s.name}`).setColor(0x3498db);
  for (const rk of S.ROLE_ORDER) {
    const lst = groups[rk]; if (!lst.length) continue;
    const info = K.SECT_ROLES[rk];
    const lines = lst.slice(0, 20).map((m) => `<@${m.user_id}> — ${fmtNum(m.sect_contribution)} cống hiến`);
    if (lst.length > 20) lines.push(`… và ${lst.length - 20} người khác`);
    e.addFields({ name: `${info.emoji} ${info.label} (${lst.length})`, value: lines.join('\n'), inline: false });
  }
  return e.setFooter({ text: `Tổng ${members.length} thành viên` });
}
function buildSectLeaderboardEmbed() {
  const sects = S.topSects();
  const e = new EmbedBuilder().setTitle(`${E.cup} Bảng Xếp Hạng Tông Môn`).setColor(0xf1c40f);
  if (!sects.length) return e.setDescription('Chưa có tông môn nào được lập.');
  const medal = ['🥇', '🥈', '🥉'];
  return e.setDescription(sects.map((s, i) => `${i < 3 ? medal[i] : `**${i + 1}.**`} **${s.name}** — Cấp ${s.level} (${fmtNum(s.exp)} EXP) | 👑 <@${s.leader_id}> | 👥 ${s.member_count} người${s.title ? ` | 🏅 ${s.title}` : ''}`).join('\n'));
}

const textModal = (title, label, ph, max = 50) => (i, onSubmit) => showModal(i, { title, fields: [{ id: 'v', label, placeholder: ph || '', maxLength: max }], onSubmit: (mi, get) => onSubmit(mi, get('v')) });

function sectMainView(userId) {
  const v = new View({ ownerId: userId, timeout: 120 });
  v.button({ key: 'lap', label: 'Lập Tông Môn', emoji: E.tongmon, style: 'blurple', row: 0 }, (i) =>
    textModal('Lập Tông Môn', 'Tên tông môn mới', 'VD: Thiên Đạo Tông')(i, (mi, val) => eph(mi, S.createSect(userId, val))));
  v.button({ key: 'gia', label: 'Gia Nhập', emoji: E.gianhap, style: 'green', row: 0 }, (i) =>
    textModal('Gia Nhập Tông Môn', 'Tên tông môn muốn gia nhập')(i, (mi, val) => eph(mi, S.joinSect(userId, val))));
  v.button({ key: 'conghien', label: 'Cống Hiến', emoji: E.conghien, style: 'blurple', row: 0 }, (i) =>
    textModal('Cống Hiến Tông Môn', 'Số tu vi muốn cống hiến', 'VD: 1000', 20)(i, (mi, val) => {
      const n = /^-?\d+$/.test(val.trim()) ? Number(val.trim()) : -1;
      return eph(mi, S.donateSect(userId, n));
    }));
  v.button({ key: 'bxh', label: 'BXH Tông Môn', emoji: E.cup, style: 'grey', row: 1 }, (i) => i.reply({ embeds: [buildSectLeaderboardEmbed()], flags: EPHEMERAL }));
  v.button({ key: 'tv', label: 'Thành Viên', emoji: E.thanhvien, style: 'grey', row: 1 }, (i) => {
    const row = Cu.getCultivator(userId);
    if (!row || !row.sect_id) return eph(i, '❌ Bạn chưa gia nhập tông môn nào.');
    return i.reply({ embeds: [buildMembersEmbed(row.sect_id)], flags: EPHEMERAL });
  });
  v.button({ key: 'roi', label: 'Rời Tông Môn', emoji: E.roitongmon, style: 'red', row: 1 }, (i) => eph(i, S.leaveSect(userId)));
  v.button({ key: 'ten', label: 'Đổi Tên', emoji: E.doiten, style: 'secondary', row: 2 }, (i) =>
    textModal('Đổi Tên Tông Môn', 'Tên tông môn mới')(i, (mi, val) => eph(mi, S.renameSect(userId, val))));
  v.button({ key: 'bn', label: 'Bổ Nhiệm', emoji: E.bonhiem, style: 'secondary', row: 2 }, (i) => showModal(i, {
    title: 'Bổ Nhiệm Chức Vụ',
    fields: [{ id: 'tv', label: 'ID hoặc @mention thành viên', placeholder: '123456789012345678', maxLength: 40 },
      { id: 'cv', label: 'Chức vụ (tongchu/pho_tongchu/truong_lao/...)', placeholder: 'pho_tongchu / truong_lao / tinh_anh / detu', maxLength: 20 }],
    onSubmit: (mi, get) => {
      const raw = get('tv').trim().replace(/^<@!?/, '').replace(/>$/, '');
      if (!/^\d+$/.test(raw)) return eph(mi, '❌ ID thành viên không hợp lệ.');
      return eph(mi, S.setSectRole(userId, raw, get('cv').trim().toLowerCase()));
    },
  }));
  return v;
}

module.exports = { buildSectEmbed, buildMembersEmbed, buildSectLeaderboardEmbed, sectMainView };
