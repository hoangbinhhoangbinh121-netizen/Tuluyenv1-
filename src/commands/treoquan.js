'use strict';
/** /treoquan — Bế Quan Treo Máy (tu luyện tự động). Không đối số: đang rảnh → bắt đầu treo, đang treo → xem trạng thái. */
const { defineCommand } = require('./framework');
const T = require('../game/treoquan');
const V = require('../ui/templates/treoquan');

const ALIAS = {
  batdau: 'batdau', bat: 'batdau', start: 'batdau', treo: 'batdau',
  xuatquan: 'xuatquan', xuat: 'xuatquan', nhan: 'xuatquan', claim: 'xuatquan',
  xem: 'xem', trangthai: 'xem', status: 'xem',
};

defineCommand({
  name: 'treoquan', description: 'Bế quan treo máy — tu luyện tự động (chậm hơn bấm tay), xuất quan để nhận tu vi', needsCultivator: true,
  options: [{
    name: 'hanh_dong', type: 'string', required: false, description: 'Bắt đầu / Xuất quan / Xem (bỏ trống: tự chọn)',
    choices: [
      { name: 'Bắt đầu bế quan treo', value: 'batdau' },
      { name: 'Xuất quan — nhận tu vi', value: 'xuatquan' },
      { name: 'Xem trạng thái', value: 'xem' },
    ],
  }],
  async run(ctx) {
    const raw = String(ctx.args.hanh_dong || '').trim().toLowerCase();
    const act = ALIAS[raw] || (raw ? null : 'auto');
    if (!act) return ctx.send('❓ Hành động không hợp lệ. Dùng: `batdau`, `xuatquan` hoặc `xem`.');
    let r;
    if (act === 'xuatquan') r = T.xuatQuan(ctx.user.id);
    else if (act === 'xem') r = T.xem(ctx.user.id);
    else r = T.batDau(ctx.user.id);   // 'batdau' hoặc bỏ trống: đang rảnh → bắt đầu; đã treo rồi → tự trả về trạng thái hiện tại
    return ctx.send({ embeds: [V.view(r)] });
  },
});
