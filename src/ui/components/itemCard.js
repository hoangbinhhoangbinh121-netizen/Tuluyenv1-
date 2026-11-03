'use strict';
const { E } = require('../emojis');
const rarityLib = require('../theme/rarity');
const { num } = require('../format');

/** "💎 **Trúc Cơ Đan** · Hiếm · x10" — một dòng vật phẩm, dùng chung cho kho/cửa hàng/giao dịch/thưởng. */
function itemLine({ name, rarity = 'pham', qty, emoji }) {
  const r = rarityLib.get(rarity);
  const q = qty === undefined || qty === null ? '' : ` · x${String(Math.max(0, Math.trunc(Number(qty) || 0))).padStart(2, '0')}`;
  return `${E[emoji || r.emoji]} **${name}** · ${r.name}${q}`;
}
/** Danh sách nhiều vật phẩm, sắp theo phẩm chất cao → thấp. */
function itemList(items, { max = 12 } = {}) {
  const sorted = [...items].sort((a, b) => rarityLib.get(b.rarity).order - rarityLib.get(a.rarity).order);
  const shown = sorted.slice(0, max).map(itemLine);
  if (sorted.length > max) shown.push(`*…và ${num(sorted.length - max)} vật phẩm khác*`);
  return shown.join('\n') || '*Trống*';
}
module.exports = { itemLine, itemList };
