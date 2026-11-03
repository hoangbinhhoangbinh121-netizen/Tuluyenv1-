'use strict';
const { EmbedBuilder } = require('discord.js');
const { defineCommand } = require('./framework');
const Cu = require('../game/cultivator');
const Inv = require('../game/inventory');
const { E } = require('../game/emoji');
const { buildKhodoEmbed, khoDoView, sendCodeApprovalRequest } = require('../ui/khodo');

defineCommand({
  name: 'khodo', description: 'Mở Kho Đồ — xem vật phẩm, nhập code, mở Rương Thần Bí', needsCultivator: true,
  run: (ctx) => ctx.send({ embeds: [buildKhodoEmbed(ctx.user, Cu.getCultivator(ctx.user.id))], components: khoDoView(ctx.user.id).components() }),
});
defineCommand({
  name: 'nhapcode', description: 'Nhập mã code nhận thưởng', needsCultivator: true,
  options: [{ name: 'ma_code', type: 'string', required: true, description: 'Mã code' }],
  async run(ctx) {
    const member = ctx.guild ? (ctx.interaction?.member || ctx.message?.member) : null;
    const [msg, rid] = Inv.redeemCode(ctx.user.id, member, ctx.args.ma_code);
    await ctx.send(msg);
    if (rid) await sendCodeApprovalRequest((ctx.interaction || ctx.message).client, rid, ctx.user);
  },
});
defineCommand({ name: 'moruong', description: 'Mở 1 Rương Thần Bí', needsCultivator: true, run: (ctx) => ctx.send(Inv.openRuongThanBi(ctx.user.id)) });
defineCommand({
  name: 'mokhoacode', description: '[Admin] Gỡ khoá nhập code cho 1 thành viên bị khoá', guildAdmin: true,
  options: [{ name: 'thanh_vien', type: 'user', required: true, description: 'Thành viên' }],
  async run(ctx) {
    const u = ctx.args.thanh_vien; const row = u && Cu.getCultivator(u.id);
    if (!row) return ctx.send(`❌ <@${u?.id}> chưa bắt đầu tu tiên.`);
    if (!row.code_locked) return ctx.send(`ℹ️ <@${u.id}> hiện KHÔNG bị khoá nhập code.`);
    Cu.updateCultivator(u.id, { code_locked: 0 });
    return ctx.send(`🔓 Đã mở khoá nhập code cho <@${u.id}>.`);
  },
});
defineCommand({
  name: 'thientongcode', description: '[Admin] Thiên Tông Bảo Điển — liệt kê toàn bộ mã code hiện có', guildAdmin: true,
  run(ctx) {
    const e = new EmbedBuilder().setTitle(`${E.taytuydan} Thiên Tông Bảo Điển — Danh Sách Code`).setColor(0xf1c40f)
      .setDescription('Toàn bộ mã code hiện đang mở, dùng `/nhapcode <mã>` để đổi thưởng.');
    for (const [code, c] of Object.entries(Inv.CODES)) {
      const lines = [...Inv.rewardLinesForCode(c)];
      if (c.booster_only) lines.push('🔒 Chỉ dành cho **Server Booster**');
      if (c.max_uses !== null && c.max_uses !== undefined) lines.push(`🎟️ Đã dùng: **${c.requires_admin_approval ? Inv.countPendingOrApproved(code) : Inv.codeUseCount(code)}/${c.max_uses}**`);
      else lines.push('🎟️ Không giới hạn lượt dùng');
      if (c.requires_admin_approval) lines.push('✋ Cần Admin xác nhận thủ công trước khi nhận thưởng');
      e.addFields({ name: `\`${code}\` — ${c.label}`, value: lines.join('\n') || '\u200b', inline: false });
    }
    e.setFooter({ text: `Tổng cộng ${Object.keys(Inv.CODES).length} mã code đang có trong hệ thống.` });
    return ctx.send({ embeds: [e] });
  },
});
