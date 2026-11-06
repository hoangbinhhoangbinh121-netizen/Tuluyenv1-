'use strict';
const { defineCommand } = require('./framework');
const S = require('../game/sect');
const Cu = require('../game/cultivator');
const { buildMembersEmbed, buildSectLeaderboardEmbed } = require('../ui/sectViews');

const str = (name, description) => ({ name, type: 'string', required: true, description });
defineCommand({ name: 'laptongmon', description: 'Lập tông môn mới', needsCultivator: true, options: [str('ten', 'Tên tông môn')], run: (c) => c.send(S.createSect(c.user.id, c.args.ten)) });
defineCommand({ name: 'giatongmon', description: 'Gia nhập một tông môn', needsCultivator: true, options: [str('ten', 'Tên tông môn')], run: (c) => c.send(S.joinSect(c.user.id, c.args.ten)) });
defineCommand({ name: 'roitongmon', description: 'Rời khỏi tông môn hiện tại', needsCultivator: true, run: (c) => c.send(S.leaveSect(c.user.id)) });
defineCommand({ name: 'conghientongmon', description: 'Cống hiến tu vi cho tông môn', needsCultivator: true, options: [{ name: 'so_tu_vi', type: 'int', required: true, description: 'Số tu vi' }], run: (c) => c.send(S.donateSect(c.user.id, c.args.so_tu_vi)) });
defineCommand({ name: 'doitentongmon', description: '[Tông Chủ] Đổi tên tông môn', needsCultivator: true, options: [str('ten_moi', 'Tên mới')], run: (c) => c.send(S.renameSect(c.user.id, c.args.ten_moi)) });
defineCommand({
  name: 'thanhvientongmon', description: 'Xem danh sách thành viên tông môn theo chức vụ', needsCultivator: true,
  run: (c) => { const r = Cu.getCultivator(c.user.id); if (!r.sect_id) return c.send('❌ Bạn chưa gia nhập tông môn nào.'); return c.send({ embeds: [buildMembersEmbed(r.sect_id)] }); },
});
defineCommand({
  name: 'bonhiemtongmon', description: '[Tông Chủ] Bổ nhiệm chức vụ cho thành viên', needsCultivator: true,
  options: [{ name: 'thanh_vien', type: 'user', required: true, description: 'Thành viên' }, str('chuc_vu', 'pho_tongchu / truong_lao / tinh_anh / detu / tongchu')],
  run: (c) => c.send(S.setSectRole(c.user.id, c.args.thanh_vien.id, String(c.args.chuc_vu).trim().toLowerCase())),
});
defineCommand({ name: 'bxhtongmon', description: 'Xem Bảng Xếp Hạng Tông Môn', run: (c) => c.send({ embeds: [buildSectLeaderboardEmbed()] }) });
