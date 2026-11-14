'use strict';
// V17 — Nghề Nghiệp · Trang Bị · Linh Điền · NPC · Kho Đồ phân loại. Mọi thao tác con nằm trong bảng (không thêm lệnh lẻ).
const { defineCommand } = require('./framework');
const NV = require('../ui/ngheViews');

/** Mở bảng từ lệnh: slash → trả lời riêng tư (ephemeral); tiền tố → gửi thường. */
function openPanel(ctx, view = 'home', arg = '') {
  return ctx.interaction ? NV.open(ctx.interaction, ctx.user.id, view, arg) : ctx.send(NV.render(String(ctx.user.id), view, arg));
}
const cmd = (name, description, view, arg = '') => defineCommand({ name, description, needsCultivator: true, run: (ctx) => openPanel(ctx, view, arg) });
cmd('nghenghiep', 'Nghề Nghiệp: Đan Sư · Luyện Khí Sư · Trận Pháp Sư · Linh Thực Sư (chế tạo, trang bị, trận pháp, Linh Điền)', 'home');
cmd('trangbi', 'Trang Bị 7 ô: mặc, cường hoá, tinh luyện, sửa, phân giải', 'gear');
cmd('linhdien', 'Linh Điền: gieo, tưới, bón, thu hoạch Linh Dược', 'field');
cmd('khophanloai', 'Kho Đồ phân loại: vật phẩm theo danh mục & phẩm cấp, chi tiết, bán NPC', 'inv');
cmd('npcthumua', 'NPC thu mua / bán: bán 1 món, theo số lượng, hàng loạt có xem trước', 'npc');

defineCommand({ name: 'doichieuv17', description: '[Admin] Bảng đối chiếu V16→V17: tình trạng migration, tổng vật phẩm theo từng loại (chỉ đọc)', admin: true, noDefer: true,
  async run(ctx) {
    const { AttachmentBuilder, MessageFlags } = require('discord.js'); const M = require('../game/migrateV17'); const text = M.reportText();
    const p = { content: `📋 ${text.split('\n')[0].slice(0, 1800)}`, files: [new AttachmentBuilder(Buffer.from(text, 'utf8'), { name: 'doichieu_v17.txt' })] };
    return ctx.interaction ? ctx.interaction.reply({ ...p, flags: MessageFlags.Ephemeral }) : ctx.send(p);
  } });
module.exports = { openPanel };
