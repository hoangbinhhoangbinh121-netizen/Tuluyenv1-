'use strict';
// /linhthu — MỘT lệnh duy nhất quản lý toàn bộ Linh Thú (menu 8 mục). Các thao tác con nằm trong menu, không có lệnh riêng.
const { defineCommand } = require('./framework');
const PV = require('../ui/petViews');

defineCommand({
  name: 'linhthu', description: 'Linh Thú: tổng quan, khế ước, nuôi dưỡng, tiến hóa, kỹ năng, huyết mạch, xuất chiến', needsCultivator: true,
  async run(ctx) { return ctx.interaction ? PV.open(ctx.interaction, ctx.user.id) : ctx.send(PV.render(ctx.user.id, 'ov', 0, '')); },
});
