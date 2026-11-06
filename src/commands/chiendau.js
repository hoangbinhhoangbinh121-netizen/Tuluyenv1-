'use strict';
const { defineCommand } = require('./framework');
const Cu = require('../game/cultivator');
const B = require('../game/bicanh');
const Boss = require('../game/boss');
const { E } = require('../game/emoji');
const { bicanhAllView, buildLinhgioiEmbed } = require('../ui/chienDau');

const openBicanh = async (ctx) => {
  const row = Cu.getCultivator(ctx.user.id);
  const p = { content: `${E.bicanh} Chọn Bí Cảnh muốn khám phá (Bí Cảnh thường + Bí Cảnh Linh Giới):`, components: bicanhAllView(ctx.user.id, row).components() };
  if (row.world_tier >= 1) p.embeds = [buildLinhgioiEmbed(row)];
  return ctx.send(p);
};
defineCommand({ name: 'bicanh', description: 'Khám phá bí cảnh (gồm cả Bí Cảnh thường & Bí Cảnh Linh Giới)', needsCultivator: true, run: openBicanh });
defineCommand({ name: 'bicanhlinhgioi', description: 'Khám phá Bí Cảnh (đã gộp chung với /bicanh)', needsCultivator: true, run: openBicanh });
// ---------------- Boss Thế Giới v7 ----------------
const BV = require('../ui/bossViews');
const BossG = require('../game/boss');
const WC = require('../ui/worldChannel');
const N = require('../ui/notifications');
const { createEmbed } = require('../ui/components/baseEmbed');

defineCommand({
  name: 'danhboss', description: 'Tấn công Boss Thế Giới (đòn đánh thường)', needsCultivator: true,
  async run(ctx) {
    if (!ctx.guild) return ctx.send({ embeds: [N.error('Lệnh này chỉ dùng trong server.', 'E009')] });
    if (ctx.interaction) return BV.doAction(ctx.interaction, 'atk', ctx.guild.id);
    const res = BossG.attack(ctx.guild.id, ctx.user.id, 'atk');            // lệnh tiền tố (?danhboss)
    if (!res.ok) return ctx.send({ embeds: [res.cooldown ? N.cooldown(res.error) : N.error(res.error, res.code)] });
    if (res.finished) await BV.concludeBoss(ctx.message.client, res.boss.boss_id, 'killed', res.killerId);
    else BV.schedulePanelRefresh(ctx.message.client, res.boss.boss_id);
    return ctx.send({ embeds: [BV.panelResultFor ? BV.panelResultFor(res, ctx.user) : N.success(`Gây **${res.dmg}** sát thương lên Boss.`)] });
  },
});
defineCommand({
  name: 'trangthaiboss', description: 'Xem bảng Boss Thế Giới đang hoạt động',
  async run(ctx) {
    const boss = ctx.guild && BossG.getAliveBoss(ctx.guild.id);
    if (!boss) return ctx.send({ embeds: [N.info('Hiện không có Boss Thế Giới nào — chờ admin triệu hồi.')] });
    return ctx.send(BV.panelPayload(boss));
  },
});
defineCommand({
  name: 'trieuhoiboss', description: '[Admin] Triệu hồi Boss Thế Giới (cấp 1-9, HP, số phút tồn tại)', anyAdmin: true,
  options: [
    { name: 'capdo', type: 'int', description: 'Cấp độ boss 1-9 (mặc định 1)' },
    { name: 'hp', type: 'int', description: 'Sinh mệnh boss (bỏ trống = tự tính theo sức mạnh server)' },
    { name: 'phut', type: 'int', description: 'Số phút tồn tại (mặc định 30)' },
  ],
  async run(ctx) {
    if (!ctx.guild || !ctx.channel) return ctx.send({ embeds: [N.error('Lệnh này chỉ dùng trong kênh của server.', 'E009')] });
    const client = (ctx.interaction || ctx.message).client;
    const r = await BV.summonAndPost({ client, guildId: ctx.guild.id, channel: ctx.channel, by: ctx.user.id, capdo: ctx.args.capdo || 1, hp: ctx.args.hp || null, minutes: ctx.args.phut || BossG.DEFAULT_MINUTES });
    if (!r.ok) return ctx.send({ embeds: [N.error(r.error, 'E009')] });
    return ctx.send({ embeds: [N.success(`Đã triệu hồi **${r.boss.name}** (cấp ${r.boss.tier}). Mọi người bấm nút trên bảng Boss để giao chiến!`)] });
  },
});
defineCommand({
  name: 'huyboss', description: '[Admin] Hủy Boss Thế Giới đang hoạt động (không chia thưởng)', anyAdmin: true,
  async run(ctx) {
    const boss = ctx.guild && BossG.getAliveBoss(ctx.guild.id);
    if (!boss) return ctx.send({ embeds: [N.info('Không có Boss nào đang hoạt động.')] });
    await BV.concludeBoss((ctx.interaction || ctx.message).client, boss.boss_id, 'cancelled');
    return ctx.send({ embeds: [N.success(`Đã hủy **${boss.name}**.`)] });
  },
});
defineCommand({
  name: 'datkenhthegioi', description: '[Admin] Đặt kênh này làm nơi nhận thông báo toàn thế giới', anyAdmin: true,
  async run(ctx) {
    if (!ctx.guild || !ctx.channel) return ctx.send({ embeds: [N.error('Lệnh này chỉ dùng trong kênh của server.', 'E009')] });
    WC.set(ctx.guild.id, ctx.channel.id);
    return ctx.send({ embeds: [N.success(`Kênh <#${ctx.channel.id}> sẽ nhận thông báo toàn thế giới (boss xuất thế, đột phá đại cảnh giới...).`)] });
  },
});
defineCommand({ name: 'chephithanglenh', description: 'Chế 1 Linh Giới Lệnh từ 100 mảnh ghép nhặt được ở Bí Cảnh', needsCultivator: true, run: (ctx) => ctx.send(B.doChePhithangLenh(ctx.user.id)) });
