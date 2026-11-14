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
// V17: Luyện Đan / Luyện Khí chuyển sang bảng Nghề Nghiệp (Đan Sư · Luyện Khí Sư). Mẻ đan CŨ đang luyện vẫn thu được bằng /luyendan.
const NGHE = require('./nghe');
defineCommand({ name: 'luyendan', description: 'Luyện đan: mở bảng Đan Sư (thu mẻ đan cũ nếu còn)', needsCultivator: true,
  run: (ctx) => { const row = require('../game/cultivator').getCultivator(ctx.user.id); if (row && row.luyendan_start > 0) return ctx.send(Dan.doLuyendan(ctx.user.id)); return NGHE.openPanel(ctx, 'cg.dan'); } });
defineCommand({ name: 'luyenkhi', description: 'Luyện khí: mở bảng Luyện Khí Sư (rèn trang bị 7 ô)', needsCultivator: true, run: (ctx) => NGHE.openPanel(ctx, 'cg.khi') });
simple('quaycongphap', 'Quay ngẫu nhiên 1 Công Pháp (không chọn tầng, giá cố định)', (u) => CP.doRandomCongphap(u));
simple('taytuydan', 'Luyện Đan Tẩy Tủy Trọng Sinh — roll lại Linh Căn + Thể Chất', (u) => Dan.doTaytuyReroll(u));
defineCommand({
  name: 'doilinhtinh', description: `Đổi Linh Thạch lấy Linh Tinh (tỉ giá ${fmtNum(K.LINHTINH_EXCHANGE_RATE)} 💎 = 1 🌠)`, needsCultivator: true,
  options: [{ name: 'so_luong', type: 'int', description: 'Số Linh Tinh muốn đổi (mặc định 1)' }],
  run: (ctx) => ctx.send(Ec.doiLinhTinh(ctx.user.id, ctx.args.so_luong ?? 1)),
});
const danDuoc = (ctx) => NGHE.openPanel(ctx, 'pill');
defineCommand({ name: 'danduoc', description: 'Mở menu Dùng Đan Dược (chọn đúng viên đang sở hữu để cắn)', needsCultivator: true, run: danDuoc });
defineCommand({ name: 'dungdan', description: '(= /danduoc) Mở menu Dùng Đan Dược', needsCultivator: true, run: danDuoc });
defineCommand({
  name: 'muadanphuong', description: 'Mua Đan Phương (tăng tỉ lệ & phẩm chất khi luyện đan ở Đan Sư)', needsCultivator: true,
  run: (ctx) => {
    const v = new View({ ownerId: ctx.user.id, timeout: 120 });
    v.select({
      key: 'dp', placeholder: `Chọn Đan Phương muốn mua (${K.DAN_PHUONG.length} phẩm cấp)...`,
      options: Dan.getCurrentDanduocList().map((d) => ({ label: `${d.name} — ${fmtNum(d.cost)} 💎`, description: `${d.rolled_name}: ${d.rolled_desc} (thành công ${Math.trunc(d.success_rate * 100)}%)`, value: d.name })),
    }, (i, vals) => i.reply({ content: Dan.buyDanPhuong(ctx.user.id, vals[0]), flags: 64 }));
    return ctx.send({ content: `📖 **Mua Đan Phương** — bắt buộc phải có trước khi Luyện Đan (tối thiểu 10.000 ${E.linhthach} Linh Thạch):`, components: v.components() });
  },
});
