'use strict';
/** Giao diện Chuỗi Đồng Tu (streak giữa hai người chơi). Dữ liệu lấy từ game/chuoi.js. */
const { createEmbed } = require('../components/baseEmbed');
const { E } = require('../emojis');
const N = require('../notifications');
const { num } = require('../format');
const { COLORS } = require('../theme/colors');
const Ch = require('../../game/chuoi');

const icon = () => E.chuoi || '🔥';
const m = (id) => `<@${id}>`;
const STATUS = {
  xong: '✅ Hôm nay đã xong',
  cho_ho: '⏳ Chờ đối phương đồng tu',
  cho_ban: '👉 Đến lượt bạn — gõ `/chuoi` với họ',
  sap_dut: '⚠️ Sắp đứt — hôm nay chưa đồng tu!',
  dut: '💔 Đã đứt',
};
const bar = (streak) => {
  const nx = Ch.nextMilestone(streak);
  return nx ? `Mốc kế: **${nx}** ngày (còn ${nx - streak})` : 'Đã đạt mọi mốc 🏆';
};
const rewardText = (r) => (r.capped
  ? `Hôm nay bạn đã nhận thưởng từ đủ chuỗi tối đa — chuỗi này vẫn tăng nhưng không có thưởng.`
  : `✨ +**${num(r.tuVi)}** tu vi${r.milestone ? ` · 🎁 thưởng mốc +**${num(r.milestone)}** tu vi` : ''}`);

function view(r) {
  switch (r.kind) {
    case 'tu_minh': return N.warning('Chuỗi Đồng Tu cần **hai người** — hãy chọn một đạo hữu khác.');
    case 'chua_tu_tien': return N.error('Bạn chưa bắt đầu tu tiên, dùng `/batdau` trước.', 'E001');
    case 'doi_phuong_chua_tu_tien': return N.warning(`${m(r.targetId)} chưa bắt đầu tu tiên nên chưa thể kết chuỗi.`);
    case 'cho_doi_phuong':
      return createEmbed({
        cat: 'chuoi', header: 'CHUỖI ĐỒNG TU', status: 'Đã đồng tu — chờ đạo hữu', color: COLORS.CULTIVATION,
        description: `${icon()} Bạn đã đồng tu hôm nay với ${m(r.targetId)}.\nHãy nhắn họ gõ \`/chuoi\` với bạn **trước 00:00 (giờ VN)** để chuỗi tăng lên.${r.atRisk ? '\n⚠️ Chuỗi đang sống — bỏ lỡ hôm nay là đứt!' : ''}`,
        fields: [{ name: `${icon()} Chuỗi hiện tại`, value: `**${r.streak}** ngày`, inline: true }],
        footer: 'Cả hai cùng đồng tu trong ngày thì chuỗi mới +1.',
      });
    case 'da_xong':
      return N.info(`${icon()} Hôm nay bạn đã đồng tu với ${m(r.targetId)} rồi${r.waiting ? ' — đang chờ họ gõ `/chuoi` với bạn.' : '.'} Chuỗi hiện tại: **${r.streak}** ngày.`);
    case 'xong_ca_hai':
      return N.info(`${icon()} Chuỗi với ${m(r.targetId)} hôm nay đã hoàn thành (**${r.streak}** ngày). Mai quay lại nhé!`);
    case 'hoan_thanh':
      return createEmbed({
        cat: 'chuoi', header: 'CHUỖI ĐỒNG TU', status: r.milestone ? `Đạt mốc ${r.milestone} ngày!` : 'Chuỗi tăng lên', color: COLORS.CULTIVATION,
        description: [
          `${icon()} Bạn và ${m(r.targetId)} cùng đồng tu hôm nay — chuỗi tăng lên **${r.streak} ngày**!`,
          r.broke ? `💔 (Chuỗi cũ **${r.previous}** ngày đã đứt, bắt đầu lại từ đây.)` : '',
          r.streak > 0 && r.streak === r.best && r.streak > 1 ? '🏅 Đây là **kỷ lục** của hai người!' : '',
          '', rewardText(r.reward),
        ].filter((x) => x !== '').join('\n'),
        fields: [
          { name: `${icon()} Chuỗi`, value: `**${r.streak}** ngày`, inline: true },
          { name: '🏅 Kỷ lục', value: `**${r.best}** ngày`, inline: true },
          { name: '🎯 Tiến độ mốc', value: bar(r.streak), inline: false },
        ],
        footer: 'Mỗi ngày hai người cùng gõ /chuoi để giữ chuỗi.',
      });
    default: return N.info('Không rõ trạng thái chuỗi.');
  }
}

function listView(userId, list) {
  if (!list.length) {
    return N.info(`${icon()} Bạn chưa có Chuỗi Đồng Tu nào. Dùng \`/chuoi\` chọn **Đồng tu** và chọn một đạo hữu — cả hai cùng đồng tu mỗi ngày để giữ chuỗi.`);
  }
  const lines = list.slice(0, 10).map((x) => `${x.streak > 0 ? icon() : '💔'} ${m(x.other)} — **${x.streak}** ngày _(kỷ lục ${x.best})_\n　${STATUS[x.status]}`);
  return createEmbed({
    cat: 'chuoi', header: 'CHUỖI ĐỒNG TU', status: 'Chuỗi của bạn', color: COLORS.CULTIVATION,
    description: lines.join('\n'),
    footer: 'Hết ngày (00:00 giờ VN) mà chưa đủ cả hai thì chuỗi đứt.',
  });
}

function boardView(rows) {
  if (!rows.length) return N.info(`${icon()} Chưa có chuỗi nào đang sống. Hãy là cặp đầu tiên — \`/chuoi\`!`);
  const medal = ['🥇', '🥈', '🥉'];
  const lines = rows.map((x, i) => `${medal[i] || `**${i + 1}.**`} ${m(x.a)} ${icon()} ${m(x.b)} — **${x.streak}** ngày _(kỷ lục ${x.best})_`);
  return createEmbed({ cat: 'chuoi', header: 'CHUỖI ĐỒNG TU', status: 'Bảng xếp hạng', color: COLORS.CULTIVATION, description: lines.join('\n'), footer: 'Chỉ tính chuỗi đang còn sống.' });
}

module.exports = { view, listView, boardView, STATUS };
