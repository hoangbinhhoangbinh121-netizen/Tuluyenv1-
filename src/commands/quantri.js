'use strict';
// v17.2 — /quantri: MỘT lệnh admin có menu + biểu mẫu (vật phẩm & nghề, nhân vật, kinh tế, sự kiện & thông báo, nhật ký). Chỉ admin của bot.
const { defineCommand } = require('./framework');
const QV = require('../ui/quantriViews');
defineCommand({ name: 'quantri', description: '[Admin] Bảng quản trị: vật phẩm & nghề, nhân vật, kinh tế, sự kiện, thông báo, nhật ký', admin: true, noDefer: true,
  async run(ctx) { return ctx.interaction ? QV.open(ctx.interaction, ctx.user.id) : ctx.send(QV.render(String(ctx.user.id))); } });
