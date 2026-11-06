'use strict';
/** /thechat và /linhcan (v13.6) — xem hồ sơ, thức tỉnh, tiến hóa, đổi Thiên Bảo. Không đối số: xem hồ sơ. */
const { defineCommand } = require('./framework');
const Cu = require('../game/cultivator');
const TO = require('../game/talentOps');
const V = require('../ui/templates/talent');

const ALIAS = {
  xem: 'xem', hoso: 'xem', info: 'xem',
  thuctinh: 'thuctinh', thuc: 'thuctinh', awaken: 'thuctinh',
  tienhoa: 'tienhoa', tien: 'tienhoa', bienduy: 'tienhoa', biendi: 'tienhoa', evolve: 'tienhoa',
  doi: 'doi', doibao: 'doi', exchange: 'doi',
};
const options = (doiText) => [
  {
    name: 'hanh_dong', type: 'string', required: false, description: 'Xem hồ sơ / Thức tỉnh / Tiến hóa / Đổi Thiên Bảo (bỏ trống: xem)',
    choices: [
      { name: 'Xem hồ sơ', value: 'xem' },
      { name: 'Thức tỉnh (nâng giai đoạn)', value: 'thuctinh' },
      { name: 'Tiến hóa (cần thức tỉnh tối đa)', value: 'tienhoa' },
      { name: doiText, value: 'doi' },
    ],
  },
  { name: 'so_luong', type: 'int', required: false, description: 'Số Thiên Bảo muốn đổi (mặc định 1, tối đa 50)' },
];

function make(which) {
  const isTc = which === 'tc';
  defineCommand({
    name: isTc ? 'thechat' : 'linhcan',
    description: isTc ? 'Thể Chất: xem thiên phú, thức tỉnh, biến dị, cộng hưởng' : 'Linh Căn: xem hành, độ tinh khiết, thức tỉnh, tiến hóa',
    needsCultivator: true,
    options: options(isTc ? 'Đổi Thiên Đạo Thạch → Thiên Bảo Thể Chất' : 'Đổi Đạo Nguyên Tinh → Thiên Bảo Linh Căn'),
    async run(ctx) {
      const uid = ctx.user.id;
      const raw = String(ctx.args.hanh_dong || '').trim().toLowerCase();
      const act = ALIAS[raw] || (raw ? null : 'xem');
      if (!act) return ctx.send('❓ Hành động không hợp lệ. Dùng: `xem`, `thuctinh`, `tienhoa` hoặc `doi`.');
      let row = TO.ensure(uid);
      if (act === 'xem') return ctx.send({ embeds: [isTc ? V.theChat(row) : V.linhCan(row)] });
      let r;
      if (act === 'thuctinh') r = isTc ? TO.awakenTheChat(uid) : TO.awakenLinhCan(uid);
      else if (act === 'tienhoa') r = isTc ? TO.evolveTheChat(uid) : TO.evolveLinhCan(uid);
      else r = TO.exchange(uid, isTc ? 'thien_dao_thach' : 'dao_nguyen_tinh', Number(ctx.args.so_luong) || 1);
      row = Cu.getCultivator(uid);
      return ctx.send({ embeds: V.result(which, r, row) });
    },
  });
}
make('tc');
make('lc');
