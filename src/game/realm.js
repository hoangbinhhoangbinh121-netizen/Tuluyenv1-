'use strict';
const K = require('./constants');
const { int, weightedChoice } = require('../util');
const { realmEmoji } = require('./emoji');

const realmSpeedMult = (realmIdx) => {
  if (Object.prototype.hasOwnProperty.call(K.REALM_SPEED_MULT, realmIdx)) return K.REALM_SPEED_MULT[realmIdx];
  // v18.0: tới Đại La Kim Tiên (13) giữ nguyên ×1,35/bậc như v17; sau đó chậm hơn (K.HIGH_REALM_SPEED_STEP) để 29 cảnh giới không lạm phát linh thạch/tu vi.
  const lowTop = Math.min(realmIdx, K.DAILA_REALM_IDX);
  const atDaila = K.REALM_SPEED_MULT[K._REALM_SPEED_MAX_KNOWN] * (K._REALM_SPEED_EXTRAPOLATE_STEP ** (lowTop - K._REALM_SPEED_MAX_KNOWN));
  return realmIdx <= K.DAILA_REALM_IDX ? atDaila : atDaila * (K.HIGH_REALM_SPEED_STEP ** (realmIdx - K.DAILA_REALM_IDX));
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
  // v18.0: tới Đại La Kim Tiên giữ ×3/bậc như v17; các đại cảnh giới sau đó tăng ×K.HIGH_REALM_GROWTH/bậc (xem constants.js). Chặn trần để không tràn số.
  const base = realmIdx <= K.DAILA_REALM_IDX ? 100 * (3 ** realmIdx) : 100 * (3 ** K.DAILA_REALM_IDX) * (K.HIGH_REALM_GROWTH ** (realmIdx - K.DAILA_REALM_IDX));
  const worldScale = 50 ** worldTier;
  return Math.min(K.TU_VI_REQUIRED_CAP, int(base * (1 + stageIdx * 0.4) * worldScale));
}

/**
 * Tu vi cần để đột phá lên tiểu cảnh giới kế tiếp = mốc gốc × K.EXP_REQUIRED_MULT.
 * Dùng cho: điều kiện/trừ tu vi khi đột phá, thanh tiến độ & mọi chỗ hiển thị, trần Hóa Thần, mốc lực chiến Thiên Kiếp.
 */
/** Mốc cũ (trước v14.0, chưa áp hệ số ĐẠI/TIỂU cảnh giới) — chỉ dùng để tính mốc Lực Chiến Thiên Kiếp cho khỏi lệch. */
const tuViRequiredLegacy = (realmIdx, stageIdx, worldTier = 0) => int(tuViRequiredBase(realmIdx, stageIdx, worldTier) * K.EXP_REQUIRED_MULT);
const isMajorGate = (realmIdx, stageIdx) => stageIdx >= K.totalStageCount(realmIdx) - 1;      // tầng cuối của cảnh giới = cửa ải sang ĐẠI cảnh giới kế
/** v17.1: đột phá TRÊN Độ Kiếp Viên Mãn (cửa ải Độ Kiếp Viên Mãn → Chân Tiên và mọi tiểu cảnh giới của Chân Tiên … Siêu Thoát) cần tu vi x K.TIEN_EXP_MULT (7). v18.2: từ Chuẩn Tiên Vương (idx ≥ 14) nhân thêm K.HIGH_TIEN_EXP_MULT (5) → tổng x35. */
const tienExpMult = (realmIdx, stageIdx) => {
  if (!(realmIdx > K.DOKIEP_REALM_IDX || (realmIdx === K.DOKIEP_REALM_IDX && stageIdx >= K.DOKIEP_VIENMAN_STAGE))) return 1;
  const extra = realmIdx >= K.HIGH_TIEN_START_IDX ? K.TIEN_HIGH_EXTRA_MULT : (realmIdx >= K.TIEN_START_IDX ? K.TIEN_MID_EXTRA_MULT : 1);   // v19.5: Chân Tiên→Đại La ×3, Tiên cao ×4 (nhân chồng)
  return K.TIEN_EXP_MULT * (realmIdx >= K.HIGH_TIEN_START_IDX ? K.HIGH_TIEN_EXP_MULT : 1) * extra;   // v18.2: Tiên cao (từ Chuẩn Tiên Vương) thêm x5 nhân chồng
};
/** v19.5: trần mềm. Mốc ≤ SOFT_START giữ nguyên; trên đó tăng dần nhưng TIỆM CẬN K.TU_VI_REQUIRED_CAP (9e15, sát giới hạn số nguyên an toàn của JS) → các cảnh giới đỉnh vẫn LUÔN tăng dần, không bị phẳng bằng nhau dù đã nhân ×4. */
const SOFT_START = 6e15;
function softCap(x) {
  const cap = K.TU_VI_REQUIRED_CAP;
  if (!(x > SOFT_START)) return x;
  const room = cap - SOFT_START;
  return Math.min(cap, SOFT_START + int(room * (1 - Math.exp(-(x - SOFT_START) / room))));
}
const tuViRequired = (realmIdx, stageIdx, worldTier = 0) => softCap(int(tuViRequiredBase(realmIdx, stageIdx, worldTier) * K.EXP_REQUIRED_MULT * (isMajorGate(realmIdx, stageIdx) ? K.EXP_GATE_MAJOR_MULT : K.EXP_GATE_MINOR_MULT) * tienExpMult(realmIdx, stageIdx)));
/** v22.4: yêu cầu tu vi đột phá THEO NGƯỜI (admin chia riêng cho 1 người: `!tangexp yeucau`). Không đặt gì = đúng bằng tuViRequired. */
function tuViRequiredFor(row, realmIdx = row.realm_index, stageIdx = row.stage_index, worldTier = row.world_tier) {
  const base = tuViRequired(realmIdx, stageIdx, worldTier);
  const d = row && row.user_id ? require('./playerBoost').needDiv(row.user_id) : 1;
  return d === 1 ? base : Math.max(1, Math.ceil(base / d));
}

/** [realmIdx, stageIdx] kế tiếp, hoặc null nếu đã ở Siêu Thoát Viên Mãn (đỉnh cao nhất hiện tại). */
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
  realmSpeedMult, realmDisplay, tuViRequired, tuViRequiredFor, softCap, tienExpMult, tuViRequiredBase, tuViRequiredLegacy, isMajorGate, nextStage, rollWeighted, getMult,
  worldTierName, worldMult, worldTierFlavor, lenhCol, phuCol, linhgioilenhLabel, linhphuLabel,
};
