'use strict';
/** /chuoi — Chuỗi Đồng Tu: cùng một đạo hữu đồng tu mỗi ngày để giữ chuỗi (streak). */
const { defineCommand } = require('./framework');
const Ch = require('../game/chuoi');
const V = require('../ui/templates/chuoi');

const ALIAS = {
  dongtu: 'dongtu', dong: 'dongtu', tu: 'dongtu', checkin: 'dongtu',
  xem: 'xem', chuoi: 'xem', list: 'xem',
  bxh: 'bxh', top: 'bxh', bangxephang: 'bxh', xephang: 'bxh',
};

defineCommand({
  name: 'chuoi', description: 'Chuỗi Đồng Tu — cùng đạo hữu đồng tu mỗi ngày để giữ chuỗi, nhận tu vi', needsCultivator: true,
  options: [
    { name: 'hanh_dong', type: 'string', required: false, description: 'Đồng tu / Xem chuỗi / Bảng xếp hạng (bỏ trống: tự chọn)',
      choices: [{ name: 'Đồng tu hôm nay với đạo hữu', value: 'dongtu' }, { name: 'Xem các chuỗi của tôi', value: 'xem' }, { name: 'Bảng xếp hạng chuỗi', value: 'bxh' }] },
    { name: 'dao_huu', type: 'user', required: false, description: 'Đạo hữu cùng kết chuỗi' },
  ],
  async run(ctx) {
    const raw = String(ctx.args.hanh_dong || '').trim().toLowerCase();
    const target = ctx.args.dao_huu || null;
    let act = ALIAS[raw] || (raw ? null : (target ? 'dongtu' : 'xem'));
    if (!act) return ctx.send('❓ Hành động không hợp lệ. Dùng: `dongtu`, `xem` hoặc `bxh`.');
    if (act === 'bxh') return ctx.send({ embeds: [V.boardView(Ch.leaderboard(10))] });
    if (act === 'xem') return ctx.send({ embeds: [V.listView(ctx.user.id, Ch.listOf(ctx.user.id))] });
    if (!target) return ctx.send('❓ Hãy chọn đạo hữu để kết chuỗi: `/chuoi hanh_dong:Đồng tu dao_huu:@ai-đó` (hoặc `!chuoi @ai-đó`).');
    if (target.bot) return ctx.send('🤖 Không thể kết chuỗi với bot.');
    const r = Ch.dongTu(ctx.user.id, target.id);
    return ctx.send({ embeds: [V.view(r)] });
  },
});
