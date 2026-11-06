'use strict';
const { defineCommand } = require('./framework');
const Cu = require('../game/cultivator');
const T = require('../game/trade');
const Dl = require('../game/daolu');
const SV = require('../ui/socialViews');

const needs = { needsCultivator: true };
const user = (name, description) => ({ name, type: 'user', required: true, description });
defineCommand({ name: 'songtu', description: 'Mời một người chơi song tu', ...needs, options: [user('doi_luong', 'Người muốn mời')], run: (c) => c.send(Dl.requestSongtu(c.user.id, c.args.doi_luong.id)) });
defineCommand({ name: 'chapnhansongtu', description: 'Chấp nhận lời mời song tu', ...needs, options: [user('doi_luong', 'Người đã mời bạn')], run: (c) => c.send(Dl.acceptSongtu(c.user.id, c.args.doi_luong.id)) });
defineCommand({ name: 'daolu', description: 'Xem trạng thái đạo lữ và đạo duyên', ...needs, run: (c) => c.send(Dl.daoLuStatus(c.user.id)) });
defineCommand({ name: 'dao_lu_tangthan', description: 'Mỗi ngày vun đắp đạo duyên với đạo lữ', ...needs, run: (c) => c.send(Dl.daoLuDaily(c.user.id)) });
defineCommand({ name: 'chiataysongtu', description: 'Kết thúc quan hệ song tu', run: (c) => c.send(Dl.breakSongtu(c.user.id)) });
defineCommand({
  name: 'dongphu', description: 'Xem/khai phá/thu hoạch động phủ riêng', ...needs,
  run: (c) => c.send({ embeds: [SV.buildDongphuEmbed(c.user, Cu.getCultivator(c.user.id))], components: SV.dongphuView(c.user.id).components() }),
});
defineCommand({ name: 'bangxephang', description: 'Xem Thiên Kiêu Bảng', run: (c) => c.send({ embeds: [SV.buildLeaderboardEmbed()] }) });
defineCommand({
  name: 'giaodich', description: 'Đề xuất giao dịch 2 chiều (Linh Thạch/Đan Dược/Linh Căn/Thể Chất) với người chơi khác', ...needs,
  options: [user('nguoi_nhan', 'Người nhận'),
    { name: 'linh_thach_gui', type: 'int', description: 'Linh Thạch muốn gửi' }, { name: 'dan_duoc_gui', type: 'int', description: 'Đan Dược muốn gửi' },
    { name: 'doi_linh_can', type: 'string', description: 'Đổi chéo Linh Căn? (có/không)' }, { name: 'doi_the_chat', type: 'string', description: 'Đổi chéo Thể Chất? (có/không)' },
    { name: 'linh_thach_nhan', type: 'int', description: 'Linh Thạch muốn nhận' }, { name: 'dan_duoc_nhan', type: 'int', description: 'Đan Dược muốn nhận' }],
  async run(c) {
    const a = c.args; const yn = (s) => ['có', 'co', 'yes', 'y', 'true', '1', 'ok'].includes(String(s || '').trim().toLowerCase());
    const lc = yn(a.doi_linh_can); const tc = yn(a.doi_the_chat);
    const res = T.createOffer(c.user.id, a.nguoi_nhan.id, a.linh_thach_gui || 0, a.dan_duoc_gui || 0, lc, tc, a.linh_thach_nhan || 0, a.dan_duoc_nhan || 0, lc, tc);
    if (res !== 'ok') return c.send(res);
    return c.send({ content: SV.offerAnnouncement(c.user.id, a.nguoi_nhan.id, `<@${a.nguoi_nhan.id}>`), components: SV.tradeConfirmView(c.user.id, a.nguoi_nhan.id).components() });
  },
});
