'use strict';
const { E } = require('./emoji');
const K = require('./constants');
const { int, pyRound, fmtNum } = require('../util');

// Emoji thanh tiến trình: mặc định là emoji tuỳ chỉnh; nếu bot không dùng được thì tự đổi sang ô vuông màu (xem applyEmojiFallbacks).
const { BAR } = require('./emoji');
const BAR_LENGTH = 10;

function progressBar(current, required, length = 12) {
  const ratio = required ? Math.min(current / required, 1.0) : 1.0;
  const filled = int(ratio * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

/** Thời gian chuẩn v7: "02 giờ 30 phút" | "05 phút 03 giây" | "9 giây". */
const fmtTime = (seconds) => require('../ui/format').dur(seconds);

function emojiProgressBar(current, maximum, emoji, length = BAR_LENGTH) {
  const ratio = maximum <= 0 ? 1.0 : Math.max(0, Math.min(1, current / maximum));
  let filled = pyRound(ratio * length);
  filled = Math.max(0, Math.min(length, filled));
  return `${emoji.repeat(filled)}${module.exports.BAR_EMPTY.repeat(length - filled)} \`${require('../ui/format').pct(ratio)}\``;
}

/** Dòng "💳 Số dư còn lại" đọc LẠI từ DB sau giao dịch. */
const BALANCE_LABELS = K.BALANCE_LABELS;
function balanceLine(row, ...cols) {
  if (!row) return '';
  const parts = cols.map((c) => {
    const [emoKey, name] = BALANCE_LABELS[c];
    return `${E[emoKey]} **${fmtNum(row[c] || 0)}** ${name}`;
  });
  return parts.length ? `\n💳 Số dư còn lại: ${parts.join(' · ')}` : '';
}

module.exports = { progressBar, fmtTime, emojiProgressBar, balanceLine, BAR_LENGTH };
for (const [name, key] of [['EMOJI_BAR_TUVI', 'tuvi'], ['EMOJI_BAR_HP', 'hp'], ['EMOJI_BAR_LUCCHIEN', 'lucchien'], ['EMOJI_BAR_GREEN', 'green'], ['BAR_EMPTY', 'empty']]) {
  Object.defineProperty(module.exports, name, { enumerable: true, get: () => BAR[key] });
}
