'use strict';
const { E } = require('../emojis');
const { num, safe } = require('../format');

/** Field chỉ số: tên có icon pixel, giá trị in đậm. */
function statField(emojiKey, label, value, { inline = true, raw = false } = {}) {
  const v = raw ? safe(value) : (typeof value === 'number' ? num(value) : safe(value));
  return { name: `${E[emojiKey] || ''} ${label}`.trim(), value: `**${v}**`, inline };
}
/** Dòng chỉ số trong description: "<icon> Nhãn: **giá trị**" */
const statLine = (emojiKey, label, value) => `${E[emojiKey] || ''} ${label}: **${typeof value === 'number' ? num(value) : safe(value)}**`.trim();
module.exports = { statField, statLine };
