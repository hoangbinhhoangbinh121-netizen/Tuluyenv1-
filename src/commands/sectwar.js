'use strict';
const { defineCommand } = require('./framework');
const W = require('../game/sectwar');
const Cu = require('../game/cultivator');
const V = require('../ui/sectWarViews');

defineCommand({ name: 'khotong', description: 'Xem Kho Tông (Linh Thạch, thu nhập tuần, Tông Chủ)', needsCultivator: true,
  run: (c) => { const r = Cu.getCultivator(c.user.id); if (!r.sect_id) return c.send('❌ Bạn chưa gia nhập tông môn nào.'); return c.send({ embeds: [V.buildKhotongEmbed(r.sect_id)] }); } });
defineCommand({ name: 'rutkho', description: '[Tông Chủ] Rút Linh Thạch từ Kho Tông', needsCultivator: true, options: [{ name: 'so_luong', type: 'int', required: true, description: 'Số Linh Thạch' }], run: (c) => c.send(W.doRutkho(c.user.id, c.args.so_luong)) });
defineCommand({ name: 'nopkho', description: 'Đóng góp Linh Thạch vào Kho Tông', needsCultivator: true, options: [{ name: 'so_luong', type: 'int', required: true, description: 'Số Linh Thạch' }], run: (c) => c.send(W.doNopkho(c.user.id, c.args.so_luong)) });
defineCommand({
  name: 'tongmonchien', description: 'Tham gia Tông Môn Chiến — Nhân Giới / Linh Giới tự chiến riêng, tranh đoạt 5 cứ điểm', needsCultivator: true,
  async run(ctx) {
    const row = Cu.getCultivator(ctx.user.id);
    if (!row.sect_id) return ctx.send('❌ Bạn cần gia nhập 1 tông môn trước (`/giatongmon` hoặc `/laptongmon`) mới có thể tham gia Tông Môn Chiến.');
    if (!ctx.guild) return ctx.send('❌ Lệnh này chỉ dùng được trong server.');
    const world = W.worldOf(row);                               // v14.0: mỗi thế giới một chiến trường riêng
    if (W.getOtherActiveWarForUser(ctx.user.id, ctx.guild.id)) return ctx.send('❌ Bạn đang tham gia 1 Tông Môn Chiến khác ở server khác rồi, không thể tham chiến 2 trận cùng lúc. Hãy đợi trận đó kết thúc trước.');
    const war = W.getActiveWar(ctx.guild.id, world);
    if (war && war.status === 'active') {
      if (!W.isEligible(row, world)) return ctx.send(`❌ Tu vi của bạn không đủ điều kiện tham chiến (chỉ dành cho ${W.eligibilityText(world)}).`);
      W.joinWar(war.war_id, ctx.user.id, row.sect_id);
      return ctx.send({ content: `🌐 Chiến trường **${W.worldLabel(world)}** — bấm **Giao Chiến** để đánh ngay, hoặc **Bảng Chiến Trường** để chọn cứ điểm / mục tiêu.`, embeds: [V.buildMapEmbed(war.war_id)], components: V.mapView(war.war_id).components() });
    }
    if (war && war.status === 'launching') return ctx.send('⏳ Trận pháp đang khởi động, vui lòng chờ trong giây lát rồi thử lại.');
    if (war && war.status === 'registration') return ctx.send({ embeds: [V.buildRegistrationEmbed(war.war_id)], components: V.registrationView(war.war_id).components() });
    if (!W.isEligible(row, world)) return ctx.send(`❌ Tu vi của bạn không đủ điều kiện tham chiến (chỉ dành cho ${W.eligibilityText(world)}).`);
    const id = W.createWar(ctx.guild.id, ctx.channel ? ctx.channel.id : 0, 'registration', world);
    return ctx.send({ embeds: [V.buildRegistrationEmbed(id)], components: V.registrationView(id).components() });
  },
});
defineCommand({
  name: 'tongmonchien_bando', description: 'Xem lại bản đồ Tông Môn Chiến của thế giới bạn đang ở', needsCultivator: true,
  run(ctx) {
    if (!ctx.guild) return ctx.send('❌ Lệnh này chỉ dùng được trong server.');
    const row = Cu.getCultivator(ctx.user.id);
    const war = W.getActiveWar(ctx.guild.id, W.worldOf(row));
    if (!war || war.status !== 'active') return ctx.send(`❌ Hiện không có Tông Môn Chiến ${W.worldLabel(W.worldOf(row))} nào đang diễn ra. Dùng \`/tongmonchien\` để khởi động.`);
    return ctx.send({ embeds: [V.buildMapEmbed(war.war_id)], components: V.mapView(war.war_id).components() });
  },
});
