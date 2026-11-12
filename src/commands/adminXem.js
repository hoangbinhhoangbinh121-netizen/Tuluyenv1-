'use strict';
/** v16.7 — [Admin] /xemnguoichoi: xem toàn bộ hồ sơ / bảng thuộc tính của 1 người chơi (chỉ đọc). */
const { EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const { defineCommand } = require('./framework');
const Cu = require('../game/cultivator');
const IN = require('../game/inspect');
const { View } = require('../ui/kit');

function embedOf(userId, tab) {
  const p = IN.page(userId, tab);
  if (!p) return null;
  const e = new EmbedBuilder().setTitle(p.title).setColor(0x8e44ad).setFooter({ text: `ID ${userId} · chỉ đọc — không ghi vào dữ liệu người chơi` });
  if (p.description) e.setDescription(p.description);
  e.addFields(p.fields);
  return e;
}
function viewFor(adminId, userId, tab) {
  const v = new View({ ownerId: adminId, timeout: 600 });
  v.select({ key: 'tab', placeholder: '🔎 Chọn mục muốn xem...', row: 0, options: IN.TABS.map(([k, label, emoji]) => ({ label, value: k, emoji, default: k === tab })) }, async (i) => {
    const t = i.values[0]; const e = embedOf(userId, t);
    if (!e) return i.update({ content: '❌ Người chơi này không còn dữ liệu.', embeds: [], components: [] });
    v.stop(); const nv = viewFor(adminId, userId, t);
    return i.update({ embeds: [e], components: nv.components() });
  });
  v.button({ key: 'file', label: 'Xuất file đầy đủ (.txt)', emoji: '📎', style: 'grey', row: 1 }, async (i) => {
    const text = IN.fullText(userId);
    if (!text) return i.reply({ content: '❌ Người chơi này không còn dữ liệu.', flags: MessageFlags.Ephemeral });
    return i.reply({ content: `📎 Hồ sơ đầy đủ của \`${userId}\``, files: [new AttachmentBuilder(Buffer.from(text, 'utf8'), { name: `nguoichoi_${userId}.txt` })], flags: MessageFlags.Ephemeral });
  });
  return v;
}

defineCommand({
  name: 'xemnguoichoi', description: '[Admin] Xem toàn bộ thuộc tính / hồ sơ của 1 người chơi (chỉ đọc)', admin: true, noDefer: true,
  options: [{ name: 'thanh_vien', type: 'user', description: 'Người chơi cần xem' }, { name: 'id', type: 'string', description: 'Hoặc nhập ID Discord (nếu người đó đã rời server)' }],
  async run(ctx) {
    const raw = ctx.args.thanh_vien ? ctx.args.thanh_vien.id : String(ctx.args.id || '').replace(/[^\d]/g, '');
    const reply = (p) => (ctx.interaction ? ctx.interaction.reply({ ...p, flags: MessageFlags.Ephemeral }) : ctx.send(p));
    if (!raw) return reply({ content: '❌ Hãy chọn `thanh_vien` hoặc nhập `id`.' });
    if (!Cu.getCultivator(raw)) return reply({ content: `❌ Không có dữ liệu tu tiên của \`${raw}\`.` });
    const e = embedOf(raw, 'tq'); const v = viewFor(ctx.user.id, raw, 'tq');
    return reply({ embeds: [e], components: v.components() });
  },
});
module.exports = { embedOf, viewFor };
