'use strict';
/** Thanh tiến trình pixel DUY NHẤT của bot: <ô đầy><ô rỗng> `65%` */
const { BAR } = require('../emojis');
const { BAR_LENGTH } = require('../theme/spacing');
const { pct } = require('../format');

/** kind: tuvi | hp | mp | lucchien | green | gold | purple */
function progressBar(current, max, { kind = 'tuvi', length = BAR_LENGTH, showPct = true } = {}) {
  const cur = Number(current) || 0; const mx = Number(max) || 0;
  const ratio = mx <= 0 ? 1 : Math.max(0, Math.min(1, cur / mx));
  let filled = Math.round(ratio * length);
  if (ratio > 0 && filled === 0) filled = 1;            // còn một chút thì vẫn hiện 1 ô
  if (ratio < 1 && filled === length) filled = length - 1; // chưa đầy thì không hiện đầy
  const cell = BAR[kind] || BAR.tuvi;
  return `${cell.repeat(filled)}${BAR.empty.repeat(length - filled)}${showPct ? ` \`${pct(ratio)}\`` : ''}`;
}
module.exports = { progressBar };
