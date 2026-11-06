'use strict';
/** Mẫu Đột phá (spec §3.3 + §3.2): thành công · thất bại · tẩu hỏa nhập ma · bị áp chế · chưa đủ điều kiện. */
const R = require('../../game/realm');
const { createEmbed } = require('../components/baseEmbed');
const { COLORS } = require('../theme/colors');
const N = require('../notifications');
const { E } = require('../emojis');
const { safe } = require('../format');

/** d: kết quả từ dotpha.dotphaR */
function result(d) {
  const from = R.realmDisplay(d.before.realm_index, d.before.stage_index);
  const to = R.realmDisplay(d.after.realm_index, d.after.stage_index);
  const body = String(safe(d.text, ''));
  switch (d.kind) {
    case 'success':
      return createEmbed({
        cat: 'dotpha', status: d.major ? 'Đột phá đại cảnh giới' : 'Đột phá thành công', title: 'Cảnh Giới Đột Phá', color: COLORS.SUCCESS, description: body,
        fields: [{ name: 'Cảnh giới hiện tại', value: `**${from}**`, inline: true }, { name: 'Cảnh giới tiếp theo', value: `**${to}**`, inline: true }],
      });
    case 'fail':
      return createEmbed({
        cat: 'dotpha', status: d.kiepFail ? 'Tẩu hỏa nhập ma' : 'Đột phá thất bại', title: d.kiepFail ? 'Thiên Kiếp Giáng Xuống' : 'Bình Cảnh Chưa Phá', color: COLORS.DANGER, description: body,
        fields: [{ name: 'Cảnh giới hiện tại', value: `**${from}**`, inline: true }],
      });
    case 'suppressed':
      return createEmbed({ cat: 'dotpha', status: 'Bị thiên địa áp chế', title: 'Đột Phá Bị Áp Chế', color: COLORS.WARNING, description: body });
    case 'cooldown': return N.cooldown(body.replace(/^⏳\s*/, ''));
    default: return createEmbed({ cat: 'dotpha', status: 'Chưa thể đột phá', title: 'Điều Kiện Chưa Đủ', color: COLORS.INFO, description: body.replace(/^(?:❌|♾️|🌪️)\s*/u, '') });
  }
}

/** Danh sách điều kiện (✓/✕) hiển thị ở tab Cảnh giới của nhân vật. */
function checklist(row) {
  const required = R.tuViRequired(row.realm_index, row.stage_index, row.world_tier);
  const nxt = R.nextStage(row.realm_index, row.stage_index);
  const line = (ok, text) => `${ok ? E.xacnhan : E.tuchoi} ${text}`;
  return [
    line(row.tu_vi >= required, 'Tu vi đạt yêu cầu'),
    line(!!nxt, nxt ? 'Còn cảnh giới phía trên' : 'Đã đạt cảnh giới tối cao'),
    line(!(row.last_dotpha_fail && (Date.now() / 1000 - row.last_dotpha_fail) < 600), 'Không còn bị khóa dưỡng thương'),
  ].join('\n');
}
module.exports = { result, checklist };
