'use strict';
const K = require('./constants');
const { int, weightedChoice } = require('../util');
const { realmEmoji } = require('./emoji');

const realmSpeedMult = (realmIdx) => {
  if (Object.prototype.hasOwnProperty.call(K.REALM_SPEED_MULT, realmIdx)) return K.REALM_SPEED_MULT[realmIdx];
  const extra = realmIdx - K._REALM_SPEED_MAX_KNOWN;
  return K.REALM_SPEED_MULT[K._REALM_SPEED_MAX_KNOWN] * (K._REALM_SPEED_EXTRAPOLATE_STEP ** extra);
};

/** "Nguyên Anh · Tầng 5" (chuẩn v7) kèm emoji pixel của đại cảnh giới. plain=true → không emoji. */
const realmDisplay = (realmIdx, stageIdx, plain = false) => {
  const r = K.REALMS[realmIdx];
  const ico = plain ? '' : `${realmEmoji(realmIdx)} `;
  if (!r.stages) return `${ico}${r.name}`;
  return `${ico}${r.name} · ${r.stages[stageIdx]}`;
};

/**
 * Tu vi GỐC (chưa nhân hệ số tăng exp) để lên tiểu cảnh giới kế tiếp.
 * CHỈ dùng để TÍNH TỐC ĐỘ / PHẦN THƯỞNG tu vi (Tu Luyện, Bế Quan, hệ số đồng bộ, Boss...) → các nguồn này giữ nguyên như trước.
 */
function tuViRequiredBase(realmIdx, stageIdx, worldTier = 0) {
  const override = K.REALM_STAGE_EXP_OVERRIDE[realmIdx];
  if (override !== undefined && override !== null) {
    const base = override[Math.min(stageIdx, override.length - 1)];
    const extraTier = Math.max(0, worldTier - 1);
    const worldScale = 50 ** extraTier;
    return int(base * K.REALM_STAGE_EXP_REDUCTION_MULT * worldScale);
  }
  const base = 100 * (3 ** realmIdx);
  const worldScale = 50 ** worldTier;
  return int(base * (1 + stageIdx * 0.4) * worldScale);
}

/**
 * Tu vi cần để đột phá lên tiểu cảnh giới kế tiếp = mốc gốc × K.EXP_REQUIRED_MULT.
 * Dùng cho: điều kiện/trừ tu vi khi đột phá, thanh tiến độ & mọi chỗ hiển thị, trần Hóa Thần, mốc lực chiến Thiên Kiếp.
 */
const tuViRequired = (realmIdx, stageIdx, worldTier = 0) => int(tuViRequiredBase(realmIdx, stageIdx, worldTier) * K.EXP_REQUIRED_MULT);

/** [realmIdx, stageIdx] kế tiếp, hoặc null nếu đã ở Tiên Đế. */
function nextStage(realmIdx, stageIdx) {
  const maxStage = K.totalStageCount(realmIdx);
  if (stageIdx + 1 < maxStage) return [realmIdx, stageIdx + 1];
  if (realmIdx + 1 < K.REALMS.length) return [realmIdx + 1, 0];
  return null;
}

const rollWeighted = (table) => weightedChoice(table, table.map((t) => t.weight));
const getMult = (table, name) => {
  for (const t of table) if (t.name === name) return t.mult;
  return 1.0;
};

// ---- Thế giới ----
const worldTierName = (idx) => K.WORLD_TIERS[Math.max(0, Math.min(idx, K.WORLD_TIERS.length - 1))];
const worldMult = (wt) => (wt <= 0 ? 1.0 : Math.max(0.35, 1 - wt * 0.15));
const worldTierFlavor = (wt) => (wt <= 0 ? '' : (K.WORLD_TIER_FLAVOR[wt] || K.WORLD_TIER_FLAVOR[2]));
const lenhCol = (wt) => (wt > 0 ? 'tien_lenh' : 'linh_gioi_lenh');
const phuCol = (wt) => (wt > 0 ? 'tien_phu' : 'linh_phu');
const linhgioilenhLabel = (row) => (row.world_tier > 0 ? 'Tiên Lệnh' : 'Linh Giới Lệnh');
const linhphuLabel = (row) => (row.world_tier > 0 ? 'Tiên Phù' : 'Linh Phù');

module.exports = {
  realmSpeedMult, realmDisplay, tuViRequired, tuViRequiredBase, nextStage, rollWeighted, getMult,
  worldTierName, worldMult, worldTierFlavor, lenhCol, phuCol, linhgioilenhLabel, linhphuLabel,
};
