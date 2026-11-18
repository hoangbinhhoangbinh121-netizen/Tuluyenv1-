'use strict';
// V19.0 — Bí Cảnh Tiên Giới · Chứng Đạo Thành Đế · Đế Đạo/Đế Binh/Đế Hiệu · Công Pháp Bản Mệnh · Sự Kiện Thế Giới
const { defineCommand } = require('./framework');
const N = require('../ui/notifications');
const B19 = require('../ui/bicanh19Views');
const CDV = require('../ui/chungdaoViews');
const EVV = require('../ui/event19Views');
const CD = require('../game/chungdao19');
const EV = require('../game/event19');

defineCommand({ name: 'bicanhtiengioi', description: 'Bí Cảnh Tiên Giới (19 bí cảnh × 5 tầng, solo hoặc tổ đội 2–5 người)', needsCultivator: true, run: (c) => c.send(B19.menuView(c.user.id)) });
defineCommand({ name: 'huongdanchungdao', description: 'Hướng dẫn lụm vật phẩm Chứng Đạo (nơi rơi, số lượt cần)', needsCultivator: true, prefixOnly: true, run: (c) => c.send(CDV.guideView(c.user.id)) });
defineCommand({ name: 'chungdao', description: 'Chứng Đạo Thành Đế — vượt 12 đạo Đế Kiếp, mở Đế Đạo / Đế Binh / Đế Hiệu', needsCultivator: true, run: (c) => c.send(CDV.open(c.user.id)) });
defineCommand({ name: 'benmenh', description: 'Công Pháp Bản Mệnh — lĩnh ngộ & thức tỉnh ở cấp 30/60/90', needsCultivator: true, run: (c) => c.send(CDV.bmView(c.user.id)) });
defineCommand({
  name: 'dehieu', description: 'Đặt Đế Hiệu (chỉ Tiên Đế đã Chứng Đạo)', needsCultivator: true, prefixOnly: true,   // slash: dùng nút Đế Hiệu trong /chungdao (giới hạn 100 lệnh slash)
 
  options: [{ name: 'ten', type: 'string', description: 'Đế Hiệu 2–24 ký tự (bỏ trống để xem)' }],
  async run(c) {
    if (!CD.passed(c.user.id)) return c.send({ embeds: [N.error('Bạn chưa **Chứng Đạo Thành Đế** — dùng `/chungdao`.', 'E009')] });
    if (!c.args.ten) return c.send(CDV.deView(c.user.id, 'hieu'));
    const r = CD.setHieu(c.user.id, c.args.ten);
    return c.send({ embeds: [r.ok ? N.success(`Đế Hiệu của bạn: **${r.hieu}**`) : N.error(r.error, 'E009')] });
  },
});
defineCommand({
  name: 'sukienthegioi', description: 'Sự kiện thế giới: xem sự kiện đang diễn ra (Admin: thêm loại để mở sự kiện)',
  options: [{ name: 'khoi', type: 'string', description: '[Admin] Mở sự kiện: dibien | truyenthua | dicanh | sieuthoat' }, { name: 'phut', type: 'int', description: '[Admin] Số phút (bỏ trống = mặc định)' }],
  async run(c) {
    const kind = String(c.args.khoi || '').toLowerCase().trim();
    if (!kind) return c.send({ embeds: [EVV.listEmbed(c.guild && c.guild.id)] });
    const { isAdminApprover } = require('./framework');
    const perms = (c.interaction && c.interaction.memberPermissions) || (c.message && c.message.member && c.message.member.permissions);
    if (!isAdminApprover(c.user.id) && !(perms && perms.has('Administrator'))) return c.send({ embeds: [N.error('Chỉ Admin mới mở được sự kiện thế giới.', 'E006')] });
    if (!c.guild || !c.channel) return c.send({ embeds: [N.error('Lệnh này chỉ dùng trong kênh của server.', 'E009')] });
    if (!EV.KINDS[kind]) return c.send({ embeds: [N.error('Loại sự kiện: `dibien`, `truyenthua`, `dicanh`, `sieuthoat`.', 'E009')] });
    const client = (c.interaction || c.message).client;
    const r = await EVV.start(client, kind, { guildId: c.guild.id, channel: c.channel, by: c.user.id, minutes: c.args.phut || null });
    return c.send({ embeds: [r.ok ? N.success(r.text) : N.error(r.error, 'E009')] });
  },
});
