'use strict';
/** Giao diện Bế Quan Treo Máy: nhập định · đang treo · xuất quan · lỗi nhẹ. Dữ liệu lấy từ game/treoquan.js. */
const R = require('../../game/realm');
const { createEmbed } = require('../components/baseEmbed');
const { progressBar } = require('../components/progressBar');
const { E } = require('../emojis');
const N = require('../notifications');
const { num, exp, dur } = require('../format');
const { COLORS } = require('../theme/colors');

const ICON = E.bequan || '🧘';
const pad2 = (n) => String(n).padStart(2, '0');
/** Thời lượng dài (treo nhiều ngày): ≥ 24h hiển thị "2 ngày 05 giờ 10 phút". */
const long = (sec) => {
  const s = Math.max(0, Math.trunc(Number(sec) || 0));
  if (s < 86400) return dur(s);
  return `${Math.floor(s / 86400)} ngày ${pad2(Math.floor((s % 86400) / 3600))} giờ ${pad2(Math.floor((s % 3600) / 60))} phút`;
};
const limitText = (s) => (Number.isFinite(s.maxSeconds) ? `tối đa ${long(s.maxSeconds)} mỗi lần` : 'không giới hạn giờ treo');
const HOUR = (rate) => `${num(Math.round(rate * 3600))} tu vi/giờ`;
const HINT = 'Dùng `/treoquan` chọn **Xuất quan** (hoặc `!treoquan xuatquan`) để nhận tu vi.';

function stats(s) {
  const f = [
    { name: `${ICON} Tốc độ treo`, value: `${HOUR(s.rate)}\n(≈${Math.round(s.efficiency * 100)}% Tu Luyện bấm tay)`, inline: true },
    { name: '⏳ Giới hạn giờ treo', value: Number.isFinite(s.maxSeconds) ? long(s.maxSeconds) : 'Không giới hạn', inline: true },
  ];
  return f;
}

function progressField(row, extra = 0) {
  const required = R.tuViRequired(row.realm_index, row.stage_index, row.world_tier);
  const cur = row.tu_vi + extra;
  return { name: `${E.tuvi || E.linhngo || '✨'} Tiến độ đột phá`, value: `${progressBar(cur, required, { kind: 'tuvi' })}\n**${exp(cur, required)}** EXP`, inline: false };
}

function view(r) {
  switch (r.kind) {
    case 'batdau':
      return createEmbed({
        cat: 'tuluyen', header: 'BẾ QUAN TREO', status: 'Nhập định thành công', color: COLORS.CULTIVATION,
        description: `${ICON} Đạo hữu đóng cửa động phủ, tĩnh tọa nhập định. Linh khí tự thấm vào kinh mạch — **không cần bấm**, rời đi lúc nào cũng được.\n\n${HINT}`,
        fields: stats(r), footer: 'Treo máy chậm hơn tu luyện bấm tay — bù lại không tốn công.',
      });
    case 'dang_treo':
      return createEmbed({
        cat: 'tuluyen', header: 'BẾ QUAN TREO', status: r.full ? 'Đã đầy — hãy xuất quan nhận tu vi' : 'Đang bế quan', color: COLORS.CULTIVATION,
        description: `${ICON} Đạo hữu đã nhập định **${long(r.elapsed)}**${r.full ? ` (chỉ tính tối đa ${long(r.maxSeconds)})` : ''}.\n✨ Tu vi tích lũy hiện tại: **+${num(r.pending)}**\n${r.full || r.remainToFull === null ? '' : `⌛ Còn **${long(Math.ceil(r.remainToFull))}** nữa là đầy.\n`}\n${HINT}`,
        fields: [...stats(r), progressField(r.row, r.pending)],
      });
    case 'chua_treo':
      return N.info(`${ICON} Bạn chưa bế quan treo. Dùng \`/treoquan\` để bắt đầu — tốc độ hiện tại khoảng **${HOUR(r.rate)}** (${limitText(r)}).`);
    case 'qua_som':
      return N.warning(`${ICON} Mới nhập định chưa lâu, hãy tĩnh tọa thêm khoảng **${dur(r.needWait)}** nữa rồi hãy xuất quan.`);
    case 'xuatquan': {
      const notes = [];
      if (r.capped) notes.push(`⏳ Bạn treo quá ${long(r.maxSeconds)} nên chỉ được tính tối đa ${long(r.maxSeconds)}. Lần sau nhớ xuất quan sớm hơn!`);
      if (r.sectBuff) notes.push('🏯 Đã gồm buff EXP Tông Môn Chiến.');
      if (r.after >= r.required) notes.push(`${E.dotpha || '⚡'} **Đã đủ tu vi — có thể Đột Phá!**`);
      return createEmbed({
        cat: 'tuluyen', header: 'BẾ QUAN TREO', status: 'Xuất quan thành công', color: COLORS.CULTIVATION,
        description: [`${ICON} Đạo hữu xuất quan sau **${long(r.counted)}** tĩnh tọa.`, `✦ Tu vi đã tăng trưởng\n${R.realmDisplay(r.row.realm_index, r.row.stage_index)} · ${num(r.before)} → ${num(r.after)} EXP`, ...notes].join('\n'),
        fields: [{ name: '✨ Tu vi nhận được', value: `+${num(r.gained)}`, inline: true }, { name: '⏱ Thời gian tính', value: long(r.counted), inline: true }, progressField(r.row)],
        footer: 'Dùng /treoquan để bế quan treo tiếp.',
      });
    }
    default:
      return N.info('Không rõ trạng thái bế quan treo.');
  }
}

module.exports = { view };
