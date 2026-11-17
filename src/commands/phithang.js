'use strict';
const { defineCommand } = require('./framework');
const A = require('../game/ascension');
const Cu = require('../game/cultivator');
const { buildAscensionStatusEmbed } = require('../ui/phithang');
const FX = require('../ui/ascendFx');
const { MessageFlags } = require('discord.js');

const c = (name, description, fn) => defineCommand({ name, description, needsCultivator: true, run: (ctx) => ctx.send(fn(ctx)) });
c('vuotthienkiep', 'Thử vượt qua Thiên Kiếp (Linh Giới hoặc Tiên Giới)', (x) => A.doVuotthienkiep(x.user.id));
c('danhphithangsugia', 'Khiêu chiến Sứ Giả (Linh Giới hoặc Tiên Giới) để nhận Lệnh Phi Thăng', (x) => A.doDanhPhithangSugia(x.user.id));
c('danhthuongcothuho', 'Khiêu chiến Thượng Cổ Thủ Hộ (điều kiện Phi Thăng Tiên Giới)', (x) => A.doDanhThuongcoThuho(x.user.id));
c('thiennhanngusuy', 'Đối mặt Thiên Nhân Ngũ Suy — 5 giai đoạn (Thọ/Thân/Hồn/Đạo/Thiên), chỉ mở ở Độ Kiếp Viên Mãn', (x) => A.doVuotThiennhanngusuy(x.user.id));
/** v19.7: gửi kết quả CHỈ cho người chơi (Phi Thăng âm thầm). Slash → ephemeral; tiền tố → nhắn riêng, không được thì mới đăng công khai để không mất kết quả. */
async function sendQuiet(ctx, text) {
  if (ctx.interaction) { const i = ctx.interaction; const p = { content: text, flags: MessageFlags.Ephemeral }; return (i.deferred || i.replied) ? i.followUp(p) : i.reply(p); }
  try { await ctx.user.send(text); return ctx.message.react('🤫').catch(() => null); }
  catch (_) { return ctx.send(`${text}\n\n_(Không nhắn riêng được cho bạn nên kết quả hiện ở đây — hãy mở nhận tin nhắn riêng để dùng đầy đủ chế độ âm thầm.)_`); }
}
defineCommand({ name: 'phithang', description: 'Phi thăng sang thế giới cao hơn (lên Tiên Giới có hiệu ứng riêng)', needsCultivator: true, noDefer: true,
  async run(ctx) {
    const quiet = A.isQuiet(ctx.user.id);
    const res = A.doPhithangEx(ctx.user.id, ctx.guild ? ctx.guild.id : 0);
    if (quiet) {                                                    // âm thầm: kết quả (cả khi thất bại) chỉ người chơi thấy
      if (FX.isTienGioi(res) && ctx.interaction) return FX.playForCtx(ctx, res, { quiet: true });
      return sendQuiet(ctx, res.text);
    }
    if (ctx.interaction && !ctx.interaction.deferred && !ctx.interaction.replied && !FX.isTienGioi(res)) { try { await ctx.interaction.deferReply(); } catch (_) { return null; } }
    if (FX.isTienGioi(res)) return FX.playForCtx(ctx, res);        // phi thăng Tiên Giới: chiếu hiệu ứng (kết quả đã commit từ trước)
    return ctx.send(res.text);
  } });
defineCommand({ name: 'phithangamtham', description: 'Bật/tắt Phi Thăng âm thầm (Linh Giới / Tiên Giới chỉ mình bạn thấy)', needsCultivator: true, prefixOnly: true,
  async run(ctx) { return sendQuiet(ctx, A.quietText(A.toggleQuiet(ctx.user.id))); } });
defineCommand({ name: 'dieukienphithang', description: 'Xem checklist điều kiện Phi Thăng (Linh Giới hoặc Tiên Giới)', needsCultivator: true,
  run: (ctx) => ctx.send({ embeds: [buildAscensionStatusEmbed(Cu.getCultivator(ctx.user.id))] }) });
