'use strict';
const { E } = require('../emojis');
const { DIVIDER } = require('../theme/typography');
const { LIMITS } = require('../theme/spacing');
const { clip } = require('../format');

/** Một nhóm dữ liệu → Field (inline=false) có tiêu đề in HOA + icon pixel. */
function section(title, lines, { emoji, inline = false } = {}) {
  const value = Array.isArray(lines) ? lines.filter(Boolean).join('\n') : String(lines ?? '');
  return { name: `${emoji ? `${E[emoji] || emoji} ` : ''}${String(title).toUpperCase()}`, value: clip(value || '—', LIMITS.fieldValue), inline };
}
const divider = () => DIVIDER;
module.exports = { section, divider };
