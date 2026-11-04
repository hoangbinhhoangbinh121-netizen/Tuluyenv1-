'use strict';
/**
 * CÂN BẰNG v12.4 — mọi con số "cảnh giới → sức mạnh / tốc độ tu luyện" nằm ở đây để chỉnh một chỗ.
 *
 *  1) Chỉ số cộng mỗi tiểu cảnh giới TỶ LỆ THEO ĐẠI CẢNH GIỚI và THỂ CHẤT (càng lên cao / thể chất càng tốt càng nhiều).
 *  2) PvP: sát thương tính theo % thanh sinh mệnh (không còn one-shot theo chỉ số tuyệt đối), chênh lệch cảnh giới
 *     quyết định thế trận một cách có kiểm soát, buff/debuff công pháp áp dụng cho CẢ HAI bên.
 *  3) Tu luyện: tốc độ tính theo "số lần bấm / tầng" ở tư chất chuẩn rồi nhân Linh Căn × Thể Chất × buff.
 *  4) Phần thưởng tu vi PvP giảm khi "đánh kẻ yếu hơn", tăng khi "đánh vượt cấp" → chống cày người mới.
 */
const K = require('./constants');
const { int } = require('../util');

const B = {
  // ---- chỉ số theo cảnh giới ----
  GROWTH_PER_REALM: 0.30,        // mỗi đại cảnh giới, chỉ số cộng thêm mỗi tầng tăng +30% so với Phàm Nhân
  BASE_GAIN: { hp: 20, atk: 5, def: 5, spd: 3 },
  // ---- PvP ----
  PVP_REALM_GAP: 0.03,           // mỗi 1 đại cảnh giới chênh = ±3% sức mạnh (bù cho dữ liệu cũ; chỉ số mới đã tăng theo cảnh giới)
  PVP_GAP_CAP: 3,
  PVP_POWER_EXP: 0.15,           // nén tỷ lệ sức mạnh tổng → sát thương
  PVP_ARMOR_EXP: 0.3,            // độ ảnh hưởng của Công/Thủ lên sát thương
  PVP_ROLL: 0.4,                 // biên độ ngẫu nhiên mỗi đòn (±40%)
  WAR_BASE_HIT: 10,              // % sinh mệnh tối đa mỗi đòn ở Chiến Tông Môn (ngang chỉ số)
  PVP_BASE_HIT: 12,              // % sinh mệnh (thanh 100) mất cho 1 đòn khi hai bên ngang nhau
  PVP_CP_BUFF_SCALE: 0.5,        // buff/debuff công pháp còn 50% hiệu lực (trước đây cộng thẳng 100%, chỉ bên khiêu chiến được hưởng)
  PVP_STAKE_PCT: 0.05,
  // ---- tốc độ tu luyện ----
  PACE_BASE_MIN: 5,              // phút bấm liên tục để lên tầng đầu tiên (tư chất chuẩn ×1.0)
  PACE_PER_REALM_MIN: 2.4,       // mỗi đại cảnh giới cao hơn: +2,4 phút / tầng
  PACE_PER_STAGE_MIN: 0.2,       // mỗi tầng cao hơn trong cùng cảnh giới: +0,2 phút
  DONGQUAN_PCT: 0.12,            // một lần Bế Quan = 12% tu vi cần cho tầng kế (tư chất chuẩn)
  // ---- Bế Quan Treo Máy (v12.4.2) ----
  TREO_EFFICIENCY: 0.10,         // treo máy chỉ bằng 10% tốc độ Tu Luyện bấm tay (cùng tư chất & buff) → lên cảnh giới lâu hơn hẳn
  TREO_MAX_HOURS: 0,             // 0 = KHÔNG giới hạn giờ treo. Đặt số > 0 (vd 8) để giới hạn: quá hạn không tích thêm, phải xuất quan nhận rồi treo lại
  TREO_MIN_SECONDS: 60,          // treo tối thiểu 1 phút mới xuất quan được
  TALENT_CAP: 9.0,               // trần Linh Căn × Thể Chất (Hỗn Độn 6.0 × Vô Cực 1.5)
};

// ------------------------------------------------------------------ chỉ số theo cảnh giới
const growthMult = (realmIdx) => 1 + Math.max(0, realmIdx) * B.GROWTH_PER_REALM;
const mult = (table, name) => { for (const t of table || []) if (t.name === name) return t.mult; return 1.0; };
/** Hệ số thể chất lên chỉ số cộng mỗi tầng (Phàm Thể ×1.0 … Vô Cực Đạo Thể ×1.5). */
const physiqueStatMult = (row) => mult(K.THE_CHAT, row && row.the_chat);

function stageGain(realmIdx, worldTier = 0, row = null) {
  const scale = (worldTier <= 0 ? 1.0 : 0.4) * growthMult(realmIdx) * physiqueStatMult(row);
  const g = (v) => Math.max(1, int(v * scale));
  return { hp: g(B.BASE_GAIN.hp), atk: g(B.BASE_GAIN.atk), def: g(B.BASE_GAIN.def), spd: g(B.BASE_GAIN.spd) };
}
const scaledFlat = (value, realmIdx) => Math.max(1, int(value * growthMult(realmIdx)));

function realmProgress(row) {
  const r = Math.max(0, row.realm_index || 0);
  const maxStage = Math.max(1, K.totalStageCount(r));
  return r + Math.min(1, (row.stage_index || 0) / maxStage);
}

// ------------------------------------------------------------------ PvP
/** Sức mạnh PvP đã hiệu chỉnh cho 2 bên (đối xứng: mỗi bên được buff của mình và làm yếu bên kia bằng debuff của mình). */
function pvpPowers(a, b, Cu) {
  const gap = Math.max(-B.PVP_GAP_CAP, Math.min(B.PVP_GAP_CAP, realmProgress(a) - realmProgress(b)));
  const fa = Math.max(0.5, 1 + B.PVP_REALM_GAP * gap);
  const fb = Math.max(0.5, 1 - B.PVP_REALM_GAP * gap);
  const bA = Cu.pvpBuffPct(a) * B.PVP_CP_BUFF_SCALE; const dA = Cu.pvpDebuffPct(a) * B.PVP_CP_BUFF_SCALE;
  const bB = Cu.pvpBuffPct(b) * B.PVP_CP_BUFF_SCALE; const dB = Cu.pvpDebuffPct(b) * B.PVP_CP_BUFF_SCALE;
  const powerA = Math.max(1, Cu.calcLucChien(a) * fa * (1 + bA) * (1 - dB));
  const powerB = Math.max(1, Cu.calcLucChien(b) * fb * (1 + bB) * (1 - dA));
  return { powerA: int(powerA), powerB: int(powerB), gap, buffA: bA, debuffA: dA, buffB: bB, debuffB: dB };
}
/** Chiến Tông Môn: sát thương 1 đòn = % sinh mệnh tối đa của mục tiêu, cùng mô hình armor/power với PvP (không còn atk - def tuyệt đối). */
function warHitFrac(atkRow, defRow, Cu) {
  const { powerA, powerB } = pvpPowers(atkRow, defRow, Cu);
  const rp = Math.min(3, Math.max(0.33, powerA / Math.max(1, powerB)));
  const atk = Cu.effectiveAtk(atkRow); const def = Cu.effectiveDef(defRow);
  const armor = atk / (atk + def * 0.7 + 1);
  return (B.WAR_BASE_HIT / 100) * ((armor / 0.588) ** B.PVP_ARMOR_EXP) * (rp ** B.PVP_POWER_EXP);
}
/** Tu vi cược: giảm khi bên mạnh hơn thắng, tăng khi bên yếu hơn thắng (upset). */
function pvpStake(a, b, winnerIsA) {
  const base = Math.max(10, int(Math.min(a.tu_vi, b.tu_vi) * B.PVP_STAKE_PCT));
  const gap = realmProgress(a) - realmProgress(b);
  const winnerAdv = winnerIsA ? gap : -gap;
  const m = winnerAdv >= 0 ? Math.max(0.2, 1 - 0.3 * winnerAdv) : Math.min(2, 1 + 0.25 * -winnerAdv);
  return Math.max(10, int(base * m));
}

// ------------------------------------------------------------------ tốc độ tu luyện
/** Số phút bấm liên tục (tư chất chuẩn ×1.0) để lên tầng kế. */
const paceMinutes = (realmIdx, stageIdx) => B.PACE_BASE_MIN + B.PACE_PER_REALM_MIN * Math.max(0, realmIdx - 1) + B.PACE_PER_STAGE_MIN * Math.max(0, stageIdx);
/** Tu vi mỗi lần Tu Luyện ở tư chất chuẩn: tu vi cần cho tầng kế / số lần bấm (cooldown mỗi lần = cdSeconds). */
function tuluyenBase(need, realmIdx, stageIdx, cdSeconds) {
  const clicks = Math.max(1, (paceMinutes(realmIdx, stageIdx) * 60) / Math.max(1, cdSeconds));
  return need / clicks;
}
const dongquanBase = (need) => need * B.DONGQUAN_PCT;
/**
 * Hệ số đồng bộ (>= 1): tu luyện mới nhanh gấp bao nhiêu so với công thức cũ ở cảnh giới/tầng của người chơi.
 * Các nguồn tu vi khác (bí cảnh, động phủ, đan dược…) nhân hệ số này để TỈ LỆ giữa các tính năng giữ y như thiết kế cũ.
 */
function paceFactor(row) {
  const R = require('./realm');
  const need = R.tuViRequiredBase(row.realm_index, row.stage_index, row.world_tier); // mốc GỐC: tăng exp đột phá không làm tăng phần thưởng
  const oldBase = 11.5 * 14 * R.realmSpeedMult(row.realm_index);
  return Math.max(1, tuluyenBase(need, row.realm_index, row.stage_index, K.COOLDOWN_TULUYEN || 10) / oldBase);
}
/** Linh Căn × Thể Chất (đã giới hạn bởi TALENT_CAP). */
const talentMult = (row) => Math.min(mult(K.LINH_CAN, row.linh_can) * mult(K.THE_CHAT, row.the_chat), B.TALENT_CAP);

/** Bảng Linh Căn / Thể Chất kèm tỉ lệ rơi (%) để hiển thị. */
function talentTables() {
  const rate = (tbl) => { const sum = tbl.reduce((s, t) => s + t.weight, 0); return tbl.map((t) => ({ name: t.name, mult: t.mult, pct: (t.weight / sum) * 100 })); };
  return { linhCan: rate(K.LINH_CAN), theChat: rate(K.THE_CHAT) };
}

module.exports = {
  B, growthMult, physiqueStatMult, stageGain, scaledFlat, realmProgress, pvpPowers, pvpStake, warHitFrac,
  paceMinutes, tuluyenBase, dongquanBase, paceFactor, talentMult, talentTables,
};
