'use strict';
/** Pháp Bảo, Đổi Linh Tinh, Cửa Hàng Khí Vận */
const K = require('./constants');
const Cu = require('./cultivator');
const F = require('./format');
const { E } = require('./emoji');
const { int, fmtNum } = require('../util');
const { Delta } = Cu;

const pbDef = (t) => K.PHAP_BAO_TIER_DEF.find((x) => x.tier === t);
const bal = (uid, ...c) => F.balanceLine(Cu.getCultivator(uid), ...c);

function buyPhapBao(userId, tier) {
  const row = Cu.getCultivator(userId);
  const tdef = pbDef(tier);
  if (!tdef) return '❌ Pháp Bảo Tầng này không tồn tại.';
  const owned = Cu.ownedPhapbaoTiers(row);
  if (owned.has(tier)) return `❌ Bạn đã sở hữu **${tdef.name}** rồi.`;
  if (row.realm_index < tdef.require_realm) return `🔒 Cần đạt ${K.REALMS[tdef.require_realm].name} trở lên mới mua được **${tdef.name}**.`;
  const cost = tdef.cost;
  if (row.linh_thach < cost) return `❌ Không đủ ${E.linhthach} Linh Thạch để mua **${tdef.name}** (cần ${fmtNum(cost)}, hiện có ${fmtNum(row.linh_thach)}).`;
  owned.add(tier);
  if (!Cu.updateCultivator(userId, { linh_thach: new Delta(-cost), phap_bao_owned: [...owned].sort((a, b) => a - b).join(',') }, { linh_thach: cost })) return Cu.MSG_BALANCE_CHANGED;
  return `${E.phapbao} Đã mua **${tdef.name}** với giá ${fmtNum(cost)} ${E.linhthach} Linh Thạch! Vào menu **Tu Hành** để trang bị (+${int(tdef.bonus * 100)}% chỉ số/HP, áp dụng mọi nơi).` + bal(userId, 'linh_thach');
}

function equipPhapBao(userId, tier) {
  const row = Cu.getCultivator(userId);
  if (tier === 0) { Cu.updateCultivator(userId, { phap_bao_equipped: 0, phap_bao_bonus: 0 }); return `${E.phapbao} Đã tháo Pháp Bảo đang trang bị.`; }
  const tdef = pbDef(tier);
  if (!tdef) return '❌ Pháp Bảo Tầng này không tồn tại.';
  if (!Cu.ownedPhapbaoTiers(row).has(tier)) return `🔒 Bạn chưa MUA **${tdef.name}** — hãy mua ở **Cửa Hàng** trước.`;
  Cu.updateCultivator(userId, { phap_bao_equipped: tier, phap_bao_bonus: tdef.bonus });
  return `${E.phapbao} Đã trang bị **${tdef.name}** (+${int(tdef.bonus * 100)}% chỉ số/HP) — áp dụng ngay cho Lực Chiến, PvP, Bí Cảnh, Boss Thế Giới, Thiên Kiếp...`;
}

function doiLinhTinh(userId, soLuong) {
  if (!(soLuong > 0)) return '❌ Số lượng muốn đổi phải lớn hơn 0.';
  const row = Cu.getCultivator(userId);
  const cost = soLuong * K.LINHTINH_EXCHANGE_RATE;
  if (row.linh_thach < cost) return `❌ Không đủ ${E.linhthach} Linh Thạch để đổi ${soLuong} ${E.linhtinh} Linh Tinh (cần ${fmtNum(cost)}, hiện có ${fmtNum(row.linh_thach)}). Tỉ giá: ${fmtNum(K.LINHTINH_EXCHANGE_RATE)} ${E.linhthach} = 1 ${E.linhtinh}.`;
  if (!Cu.updateCultivator(userId, { linh_thach: new Delta(-cost), linh_tinh: new Delta(soLuong) }, { linh_thach: cost })) return Cu.MSG_BALANCE_CHANGED;
  return `✨ Đã đổi thành công **${soLuong}** ${E.linhtinh} Linh Tinh (tốn ${fmtNum(cost)} ${E.linhthach} Linh Thạch). Dùng Linh Tinh để mua công pháp ở **Chợ Vạn Linh** (Cửa Hàng).` + bal(userId, 'linh_thach', 'linh_tinh');
}

function applyShopItem(userId, itemName) {
  const row = Cu.getCultivator(userId);
  const item = K.SHOP_ITEMS.find((i) => i.name === itemName);
  if (!item) return '❌ Vật phẩm không tồn tại.';
  if (row.khi_van < item.cost) return `❌ Không đủ Khí Vận (cần ${item.cost}, hiện có ${row.khi_van}).`;
  const cost = item.cost;
  const effects = {
    'Đan Tăng Tu Vi (Nhỏ)': { tu_vi: new Delta(50) }, 'Đan Tăng Tu Vi (Vừa)': { tu_vi: new Delta(150) },
    'Đan Tốc Luyện': { last_tuluyen: 0 }, 'Đan Hồi Khí': { last_dongquan: 0 }, 'Nhẫn Cầu Hôn': { nhan_cau_hon: new Delta(1) },
  };
  const effect = effects[item.name];
  if (!effect) return '❌ Vật phẩm không tồn tại.';
  if (!Cu.updateCultivator(userId, { khi_van: new Delta(-cost), ...effect }, { khi_van: cost })) return Cu.MSG_BALANCE_CHANGED;
  return `${E.shop} Đã mua **${item.name}** (-${cost} ${E.khivan} Khí Vận).` + bal(userId, 'khi_van');
}

module.exports = { pbDef, buyPhapBao, equipPhapBao, doiLinhTinh, applyShopItem };
