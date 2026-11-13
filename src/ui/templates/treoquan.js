'use strict';
/** Giao diện Bế Quan Treo Máy: nhập định · đang treo · xuất quan · lỗi nhẹ. Dữ liệu lấy từ game/treoquan.js. */
const R = require('../../game/realm');
const { createEmbed } = require('../components/baseEmbed');
const { progressBar } = require('../components/progressBar');
const { E } = require('../emojis');
const N = require('../notifications');
const { num, exp, dur } = require('../format');
const { COLORS } = require('../theme/colors');

const icon = () => E.treoquan || '⏳';   // đọc lúc dùng (emoji pixel có thể sẵn sàng sau khi bot khởi động)
const pad2 = (n) => String(n).padStart(2, '0');
/** Thời lượng dài (treo nhiều ngày): ≥ 24h hiển thị "2 ngày 05 giờ 10 phút". */
const long = (sec) => {
  const s = Math.max(0, Math.trunc(Number(sec) || 0));
  if (s < 86400) return dur(s);
  return `${Math.floor(s / 86400)} ngày ${pad2(Math.floor((s % 86400) / 3600))} giờ ${pad2(Math.floor((s % 3600) / 60))} phút`;
};
const limitText = (s) => (Number.isFinite(s.maxSeconds) ? `tối đa ${long(s.maxSeconds)} mỗi lần` : 'không giới hạn giờ treo');
const HOUR = (rate) => `${num(Math.round(rate * 3600))} tu vi/giờ`;
const HINT = 'Dùng `/xuatquan` (hoặc `!xuatquan`) để **xuất quan & nhận tu vi** bất cứ lúc nào — không giới hạn thời gian treo.';
const ts = (sec) => `<t:${Math.floor(Number(sec) || 0)}:R>`;
/** Dòng nhắc: lần treo trước đã bị xuất quan cưỡng chế (do đủ hạn). */
const forcedLine = (n) => (n && n.forced
  ? `\n\n⛔ **Xuất quan cưỡng chế:** phiên treo trước đã đạt giới hạn và tự xuất quan ${n.endedAt ? ts(n.endedAt) : ''}, nhận **+${num(n.gained)}** tu vi.`
  : '');

function stats(s) {
  const f = [
    { name: `${icon()} Tốc độ treo`, value: `${HOUR(s.rate)}\n(≈${Math.round(s.efficiency * 100)}% Tu Luyện bấm tay)`, inline: true },
    { name: '⏳ Giới hạn mỗi phiên', value: Number.isFinite(s.maxSeconds) ? `${long(s.maxSeconds)}\n(đủ hạn → xuất quan cưỡng chế, /treoquan để làm mới)` : 'Không giới hạn', inline: true },
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
    case 'locked':
      return N.warning(require('../../game/cultLock').text(r.lock), { footer: 'Tu luyện đang bị khóa' });
    case 'batdau':
      return createEmbed({
        cat: 'treoquan', header: 'BẾ QUAN TREO', status: 'Nhập định thành công', color: COLORS.CULTIVATION,
        description: `${icon()} Đạo hữu đóng cửa động phủ, tĩnh tọa nhập định. Linh khí tự thấm vào kinh mạch — **không cần bấm**, rời đi lúc nào cũng được.${Number.isFinite(r.maxSeconds) ? `\n⏳ Phiên này kéo dài tối đa **${long(r.maxSeconds)}**, đủ hạn sẽ tự xuất quan lúc ${ts(r.start + r.maxSeconds)}.` : ''}${forcedLine(r.notice)}\n\n${HINT}`,
        fields: stats(r), footer: 'Treo = 10% tốc độ Tu Luyện bấm tay (không nhân đôi), tu vi tích lũy dần theo thời gian.',
      });
    case 'dang_treo':
      return createEmbed({
        cat: 'treoquan', header: 'BẾ QUAN TREO', status: r.full ? 'Đã đầy — hãy xuất quan nhận tu vi' : 'Đang bế quan', color: COLORS.CULTIVATION,
        description: `${icon()} Đạo hữu đã nhập định **${long(r.elapsed)}**${r.full ? ` (chỉ tính tối đa ${long(r.maxSeconds)})` : ''}.\n✨ Tu vi tích lũy hiện tại: **+${num(r.pending)}**\n${r.full || r.remainToFull === null ? '' : `⌛ Còn **${long(Math.ceil(r.remainToFull))}** nữa sẽ **xuất quan cưỡng chế** (${ts(r.start + r.maxSeconds)}).\n`}\n${HINT}`,
        fields: [...stats(r), progressField(r.row, r.pending)],
      });
    case 'chua_treo':
      return N.info(`${icon()} Bạn chưa bế quan treo. Dùng \`/treoquan\` để bắt đầu — tốc độ hiện tại khoảng **${HOUR(r.rate)}** (${limitText(r)}).${forcedLine(r.notice)}`);
    case 'cuong_che': {
      const notes = [];
      if (r.after >= r.required) notes.push(`${E.dotpha || '⚡'} **Đã đủ tu vi — có thể Đột Phá!**`);
      return createEmbed({
        cat: 'treoquan', header: 'BẾ QUAN TREO', status: 'Xuất quan cưỡng chế', color: COLORS.CULTIVATION,
        description: [`${icon()} Phiên bế quan treo đã đạt giới hạn **${long(r.maxSeconds)}** — đạo hữu bị **xuất quan cưỡng chế** ${r.endedAt ? ts(r.endedAt) : ''}.`, `✨ Đã tự cộng **+${num(r.gained)}** tu vi.`, ...notes, '', '🔄 Dùng `/treoquan` để **làm mới** và bế quan treo tiếp.'].join('\n'),
        fields: [{ name: '✨ Tu vi nhận được', value: `+${num(r.gained)}`, inline: true }, { name: '⏱ Thời gian tính', value: long(r.maxSeconds), inline: true }, progressField(r.row)],
        footer: `Mỗi phiên treo tối đa ${long(r.maxSeconds)} — nhớ làm mới để tiếp tục tích tu vi.`,
      });
    }
    case 'qua_som':
      return N.warning(`${icon()} Mới nhập định chưa lâu, hãy tĩnh tọa thêm khoảng **${dur(r.needWait)}** nữa rồi hãy xuất quan.`);
    case 'xuatquan': {
      const notes = [];
      if (r.capped) notes.push(`⏳ Bạn treo quá ${long(r.maxSeconds)} nên chỉ được tính tối đa ${long(r.maxSeconds)}. Lần sau nhớ xuất quan sớm hơn!`);
      if (r.sectBuff) notes.push('🏯 Đã gồm buff EXP Tông Môn Chiến.');
      if (r.after >= r.required) notes.push(`${E.dotpha || '⚡'} **Đã đủ tu vi — có thể Đột Phá!**`);
      return createEmbed({
        cat: 'treoquan', header: 'BẾ QUAN TREO', status: 'Xuất quan thành công', color: COLORS.CULTIVATION,
        description: [`${icon()} Đạo hữu xuất quan sau **${long(r.counted)}** tĩnh tọa.`, `✦ Tu vi đã tăng trưởng\n${R.realmDisplay(r.row.realm_index, r.row.stage_index)} · ${num(r.before)} → ${num(r.after)} EXP`, ...notes].join('\n'),
        fields: [{ name: '✨ Tu vi nhận được', value: `+${num(r.gained)}`, inline: true }, { name: '⏱ Thời gian tính', value: long(r.counted), inline: true }, progressField(r.row)],
        footer: 'Dùng /treoquan để bế quan treo tiếp.',
      });
    }
    default:
      return N.info('Không rõ trạng thái bế quan treo.');
  }
}

module.exports = { view };
