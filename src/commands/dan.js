'use strict';
const { defineCommand } = require('./framework');
const Dan = require('../game/dan');
const CP = require('../game/congphap');
const Ec = require('../game/economy');
const K = require('../game/constants');
const { E } = require('../game/emoji');
const SV = require('../ui/shopViews');
const { View } = require('../ui/kit');
const { fmtNum } = require('../util');

const simple = (name, description, fn) => defineCommand({ name, description, needsCultivator: true, run: (ctx) => ctx.send(fn(ctx.user.id, ctx)) });
simple('luyendan', 'Luyện đan dược từ nguyên liệu', (u) => Dan.doLuyendan(u));
simple('luyenkhi', 'Luyện pháp bảo từ nguyên liệu', (u) => Dan.doLuyenkhi(u));
simple('linhthu', 'Nuôi dưỡng linh thú của bạn', (u) => Dan.doNuoiduong(u));
simple('quaycongphap', 'Quay ngẫu nhiên 1 Công Pháp (không chọn tầng, giá cố định)', (u) => CP.doRandomCongphap(u));
simple('taytuydan', 'Luyện Đan Tẩy Tủy Trọng Sinh — roll lại Linh Căn + Thể Chất', (u) => Dan.doTaytuyReroll(u));
defineCommand({
  name: 'doilinhtinh', description: `Đổi Linh Thạch lấy Linh Tinh (tỉ giá ${fmtNum(K.LINHTINH_EXCHANGE_RATE)} 💎 = 1 🌠)`, needsCultivator: true,
  options: [{ name: 'so_luong', type: 'int', description: 'Số Linh Tinh muốn đổi (mặc định 1)' }],
  run: (ctx) => ctx.send(Ec.doiLinhTinh(ctx.user.id, ctx.args.so_luong ?? 1)),
});
const danDuoc = (ctx) => ctx.send({ content: `${E.danduoc} **Dùng Đan Dược** — chọn đúng viên bạn đang sở hữu để cắn:`, components: SV.danDuocView(ctx.user.id).components() });
defineCommand({ name: 'danduoc', description: 'Mở menu Dùng Đan Dược (chọn đúng viên đang sở hữu để cắn)', needsCultivator: true, run: danDuoc });
defineCommand({ name: 'dungdan', description: '(= /danduoc) Mở menu Dùng Đan Dược', needsCultivator: true, run: danDuoc });
defineCommand({
  name: 'muadanphuong', description: 'Mua Đan Phương (bắt buộc trước khi Luyện Đan)', needsCultivator: true,
  run: (ctx) => {
    const v = new View({ ownerId: ctx.user.id, timeout: 120 });
    v.select({
      key: 'dp', placeholder: `Chọn Đan Phương muốn mua (${K.DAN_PHUONG.length} phẩm cấp)...`,
      options: Dan.getCurrentDanduocList().map((d) => ({ label: `${d.name} — ${fmtNum(d.cost)} 💎`, description: `${d.rolled_name}: ${d.rolled_desc} (thành công ${Math.trunc(d.success_rate * 100)}%)`, value: d.name })),
    }, (i, vals) => i.reply({ content: Dan.buyDanPhuong(ctx.user.id, vals[0]), flags: 64 }));
    return ctx.send({ content: `📖 **Mua Đan Phương** — bắt buộc phải có trước khi Luyện Đan (tối thiểu 10.000 ${E.linhthach} Linh Thạch):`, components: v.components() });
  },
});
