'use strict';
/**
 * v14.2 — Bế Quan Treo Máy được TÁCH thành 2 lệnh riêng (cùng một engine game/treoquan.js, dùng chung dữ liệu):
 *   /treoquan — bắt đầu treo (đang treo rồi thì xem trạng thái). Không giới hạn thời gian.
 *   /xuatquan — xuất quan, nhận toàn bộ tu vi tích lũy (= 5% tốc độ Tu Luyện bấm tay).
 */
const { defineCommand } = require('./framework');
const T = require('../game/treoquan');
const V = require('../ui/templates/treoquan');

defineCommand({
  name: 'treoquan', description: 'Bế quan treo máy — tu luyện tự động, không giới hạn giờ (dùng /xuatquan để nhận tu vi)', needsCultivator: true,
  async run(ctx) {
    // đang rảnh → bắt đầu; đã treo rồi → tự trả về trạng thái hiện tại (kind 'dang_treo')
    return ctx.send({ embeds: [V.view(T.batDau(ctx.user.id))] });
  },
});

defineCommand({
  name: 'xuatquan', description: 'Xuất quan — kết thúc bế quan treo và nhận toàn bộ tu vi đã tích lũy', needsCultivator: true,
  async run(ctx) {
    return ctx.send({ embeds: [V.view(T.xuatQuan(ctx.user.id))] });
  },
});
