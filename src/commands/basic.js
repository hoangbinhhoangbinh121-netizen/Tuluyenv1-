'use strict';
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { defineCommand } = require('./framework');
const Cu = require('../game/cultivator');
const A = require('../game/actionsBasic');
const { doDotpha } = require('../game/dotpha');
const { E } = require('../game/emoji');
const { mainComponents } = require('../ui/menus');
const CHAR = require('../ui/templates/character');
const CULT = require('../ui/templates/cultivation');
const BT = require('../ui/templates/breakthrough');
const { tryUserLock } = require('../ui/kit');

const BUSY = '⚠️ Bạn đang thao tác quá nhanh, vui lòng chờ lượt trước xử lý xong rồi thử lại.';

defineCommand({
  name: 'batdau', description: 'Bắt đầu con đường tu tiên của bạn',
  async run(ctx) {
    if (Cu.getCultivator(ctx.user.id)) return ctx.send('Bạn đã bước lên con đường tu tiên rồi, dùng `/tutien` để xem menu.');
    const [linhCan, theChat] = Cu.createCultivator(ctx.user.id);
    const { createEmbed } = require('../ui/components/baseEmbed');
    const { statField } = require('../ui/components/statField');
    const emb = createEmbed({
      cat: 'thiendao', header: 'KHAI MỞ ĐẠO NGHIỆP', status: 'Con đường tu tiên bắt đầu',
      description: `<@${ctx.user.id}> đã bước chân vào con đường tu tiên.`,
      fields: [statField('linhcan', 'Linh căn', linhCan, { raw: true }), statField('thechat', 'Thể chất', theChat, { raw: true })],
      footer: 'Dùng /tutien để mở menu tu luyện.',
    });
    return ctx.send({ embeds: [emb] });
  },
});

defineCommand({
  name: 'tutien', description: 'Mở menu tu tiên', needsCultivator: true,
  async run(ctx) {
    const row = Cu.getCultivator(ctx.user.id);
    const user = ctx.guild?.members?.cache?.get(ctx.user.id) || ctx.user;
    // (v7) menu chính là nút TĨNH: sống qua restart; không đính kèm file nên không phụ thuộc quyền "Attach Files".
    return ctx.send({ embeds: [CHAR.build(user, row, 'tongquan')], components: mainComponents('tongquan') });
  },
});

const locked = (fn) => async (ctx) => {
  const unlock = tryUserLock(ctx.user.id);
  if (!unlock) return ctx.send({ embeds: [require('../ui/notifications').warning(BUSY, { footer: 'E008 · Dữ liệu đang được xử lý' })] });
  try { return await ctx.send(fn(ctx.user.id)); } finally { unlock(); }
};
const cultRun = (kind, run) => locked((id) => { const r = run(id); return { embeds: [r.ok ? CULT.result(r) : r.kind === 'locked' ? CULT.locked(r.lock) : CULT.cooldown(kind, r.remain)] }; });
defineCommand({ name: 'tuluyen', description: 'Tu luyện nhanh nhận tu vi', needsCultivator: true, run: cultRun('tuluyen', A.tuluyenR) });
defineCommand({ name: 'dongquan', description: 'Bế quan tu luyện lượng lớn tu vi', needsCultivator: true, run: cultRun('dongquan', A.dongquanR) });
defineCommand({
  name: 'dotpha', description: 'Đột phá cảnh giới', needsCultivator: true,
  async run(ctx) {
    const d = require('../game/dotpha').dotphaR(ctx.user.id);
    await ctx.send({ embeds: [BT.result(d)] });
    if (d.kind === 'success' && d.major && ctx.guild) require('../ui/worldAnnounce').announceBreakthrough((ctx.interaction || ctx.message).client, ctx.guild.id, ctx.user, d).catch(() => {});
  },
});
defineCommand({ name: 'canngo', description: 'Cảm ngộ đạo pháp', needsCultivator: true, run: (ctx) => ctx.send({ embeds: [CULT.simple(A.doCanngo(ctx.user.id), 'CẢM NGỘ')] }) });
defineCommand({ name: 'linhmach', description: 'Hấp thụ linh khí từ linh mạch', needsCultivator: true, run: (ctx) => ctx.send({ embeds: [CULT.simple(A.doLinhmach(ctx.user.id), 'LINH MẠCH')] }) });
defineCommand({ name: 'hoihp', description: 'Xem tiến trình hồi Sinh Mệnh theo thời gian', needsCultivator: true, run: (ctx) => ctx.send({ embeds: [CULT.simple(A.doHoiHp(ctx.user.id), 'HỒI PHỤC')] }) });
