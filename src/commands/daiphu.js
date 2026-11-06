'use strict';
const { defineCommand } = require('./framework');
const P = require('../game/daiphu');
const K = require('../game/constants');
const { E } = require('../game/emoji');
const { mainPayload } = require('../ui/daiphuViews');
const { fmtNum, int } = require('../util');

defineCommand({
  name: 'mosukienphu', description: '[Admin] Mở sự kiện MỘT NGÀY ĐẠI PHÚ cho server (đếm ngược 24 giờ)', guildAdmin: true,
  options: [{ name: 'phut_cho', type: 'int', description: 'Số phút chờ trước khi bắt đầu (0 = mở ngay)' }],
  run(ctx) {
    if (!ctx.guild) return ctx.send('❌ Lệnh này chỉ dùng được trong server.');
    const [status, start, end] = P.adminOpen(ctx.guild.id, ctx.args.phut_cho || 0);
    if (status === 'RUNNING') return ctx.send(`${E.sukiendaiphu} 🟢 Sự kiện **MỘT NGÀY ĐẠI PHÚ** đã mở cho toàn server!\n⏳ Kết thúc <t:${int(end)}:R> (<t:${int(end)}:F>).\n💰 Mỗi người chơi bắt đầu với **${fmtNum(K.EVENT_DAIPHU_STARTING_CASH)}** tiền mặt — bấm nút ${E.sukiendaiphu} **Coin Một Ngày Đại Phú** ở menu \`/tutien\` để tham gia!`);
    return ctx.send(`${E.sukiendaiphu} 🟡 Sự kiện **MỘT NGÀY ĐẠI PHÚ** sẽ bắt đầu lúc <t:${int(start)}:F> (<t:${int(start)}:R>), kéo dài 24 giờ kể từ lúc bắt đầu.`);
  },
});
defineCommand({
  name: 'sukienphu', description: 'Xem/tham gia sự kiện MỘT NGÀY ĐẠI PHÚ', needsCultivator: true,
  run: (ctx) => ctx.send(mainPayload(ctx.guild ? ctx.guild.id : 0, ctx.user)),
});
