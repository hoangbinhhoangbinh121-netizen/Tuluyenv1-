'use strict';
const { defineCommand } = require('./framework');
const A = require('../game/ascension');
const Cu = require('../game/cultivator');
const { buildAscensionStatusEmbed } = require('../ui/phithang');
const FX = require('../ui/ascendFx');

const c = (name, description, fn) => defineCommand({ name, description, needsCultivator: true, run: (ctx) => ctx.send(fn(ctx)) });
c('vuotthienkiep', 'Thử vượt qua Thiên Kiếp (Linh Giới hoặc Tiên Giới)', (x) => A.doVuotthienkiep(x.user.id));
c('danhphithangsugia', 'Khiêu chiến Sứ Giả (Linh Giới hoặc Tiên Giới) để nhận Lệnh Phi Thăng', (x) => A.doDanhPhithangSugia(x.user.id));
c('danhthuongcothuho', 'Khiêu chiến Thượng Cổ Thủ Hộ (điều kiện Phi Thăng Tiên Giới)', (x) => A.doDanhThuongcoThuho(x.user.id));
c('thiennhanngusuy', 'Đối mặt Thiên Nhân Ngũ Suy — 5 giai đoạn (Thọ/Thân/Hồn/Đạo/Thiên), chỉ mở ở Độ Kiếp Viên Mãn', (x) => A.doVuotThiennhanngusuy(x.user.id));
defineCommand({ name: 'phithang', description: 'Phi thăng sang thế giới cao hơn (lên Tiên Giới có hiệu ứng riêng)', needsCultivator: true,
  async run(ctx) {
    const res = A.doPhithangEx(ctx.user.id, ctx.guild ? ctx.guild.id : 0);
    if (FX.isTienGioi(res)) return FX.playForCtx(ctx, res);        // phi thăng Tiên Giới: chiếu hiệu ứng (kết quả đã commit từ trước)
    return ctx.send(res.text);
  } });
defineCommand({ name: 'dieukienphithang', description: 'Xem checklist điều kiện Phi Thăng (Linh Giới hoặc Tiên Giới)', needsCultivator: true,
  run: (ctx) => ctx.send({ embeds: [buildAscensionStatusEmbed(Cu.getCultivator(ctx.user.id))] }) });
