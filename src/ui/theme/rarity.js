'use strict';
/** Phẩm chất vật phẩm — thống nhất cho kho đồ, cửa hàng, giao dịch, đấu giá, phần thưởng (spec §3.5). */
const RARITY = {
  pham: { id: 'pham', name: 'Phàm phẩm', color: 0xAAB2BD, emoji: 'rar_pham', order: 0 },
  phothong: { id: 'phothong', name: 'Phổ thông', color: 0x75C98B, emoji: 'rar_phothong', order: 1 },
  hiem: { id: 'hiem', name: 'Hiếm', color: 0x65BDEB, emoji: 'rar_hiem', order: 2 },
  suthi: { id: 'suthi', name: 'Sử thi', color: 0xB99AE8, emoji: 'rar_suthi', order: 3 },
  truyenthuyet: { id: 'truyenthuyet', name: 'Truyền thuyết', color: 0xD6B56D, emoji: 'rar_truyenthuyet', order: 4 },
  thanthoai: { id: 'thanthoai', name: 'Thần thoại', color: 0xE36C75, emoji: 'rar_thanthoai', order: 5 },
};
const LIST = Object.values(RARITY).sort((a, b) => a.order - b.order);

/** Tầng công pháp/pháp bảo (1..N) → phẩm chất theo vị trí tương đối. */
function rarityByTier(tier, maxTier = 20) {
  const t = Math.max(1, Number(tier) || 1) / Math.max(1, maxTier);
  if (t > 0.9) return RARITY.thanthoai;
  if (t > 0.7) return RARITY.truyenthuyet;
  if (t > 0.45) return RARITY.suthi;
  if (t > 0.25) return RARITY.hiem;
  if (t > 0.1) return RARITY.phothong;
  return RARITY.pham;
}
const get = (id) => RARITY[id] || RARITY.pham;
module.exports = { RARITY, LIST, rarityByTier, get };
