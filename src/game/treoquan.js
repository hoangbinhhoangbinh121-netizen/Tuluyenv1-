'use strict';
/**
 * BẾ QUAN TREO MÁY (v12.4.2) — tu luyện tự động, không cần bấm.
 *  - Bắt đầu: ghi mốc `treo_start` vào DB (còn nguyên khi bot khởi động lại).
 *  - Xuất quan: tu vi nhận = tốc độ Tu Luyện bấm tay × BAL.B.TREO_EFFICIENCY (10%) × thời gian treo.
 *    Mặc định KHÔNG giới hạn giờ (TREO_MAX_HOURS = 0); đặt TREO_MAX_HOURS > 0 để giới hạn số giờ được tính mỗi lần.
 *  - Tốc độ tính từ mốc GỐC (R.tuViRequiredBase) và hệ số tư chất/buff dùng CHUNG với Tu Luyện (A.tuluyenMultFor)
 *    → đồng bộ với hệ cân bằng, không phụ thuộc hệ số tăng exp đột phá. Không cộng Linh Thạch (tránh lạm phát).
 */
const K = require('./constants');
const CD = require('./cooldowns');
const R = require('./realm');
const Cu = require('./cultivator');
const BAL = require('./balance');
const A = require('./actionsBasic');
const { now, int } = require('../util');

const B = BAL.B;
const maxSeconds = () => (B.TREO_MAX_HOURS > 0 ? int(B.TREO_MAX_HOURS * 3600) : Infinity);   // Infinity = không giới hạn

/** Tu vi / giây khi treo ở cảnh giới & tư chất hiện tại. */
function rateOf(userId, row) {
  const needBase = R.tuViRequiredBase(row.realm_index, row.stage_index, row.world_tier);
  const perClick = BAL.tuluyenBase(needBase, row.realm_index, row.stage_index, CD.COOLDOWN_TULUYEN);
  const { mult, sectBuff, buff } = A.tuluyenMultFor(userId, row);
  return { rate: (perClick / CD.COOLDOWN_TULUYEN) * B.TREO_EFFICIENCY * mult, mult, sectBuff: sectBuff > 1, buff: buff > 1 };
}

/** Trạng thái treo hiện tại (không ghi DB). */
function stateOf(userId, row = Cu.getCultivator(userId), t = now()) {
  const start = Number(row.treo_start) || 0;
  const base = { row, maxSeconds: maxSeconds(), efficiency: B.TREO_EFFICIENCY };
  const r = rateOf(userId, row);
  if (!(start > 0)) return { ...base, active: false, ...r };
  const elapsed = Math.max(0, t - start);
  const counted = Math.min(elapsed, maxSeconds());
  return {
    ...base, ...r, active: true, start, elapsed, counted, full: elapsed >= maxSeconds(),
    remainToFull: Number.isFinite(maxSeconds()) ? Math.max(0, maxSeconds() - elapsed) : null, pending: Math.max(0, int(r.rate * counted)),
  };
}

/** Bắt đầu bế quan treo. */
function batDau(userId) {
  const row = Cu.getCultivator(userId);
  if (Number(row.treo_start) > 0) return { ok: false, kind: 'dang_treo', ...stateOf(userId, row) };
  Cu.updateCultivator(userId, { treo_start: now() });
  return { ok: true, kind: 'batdau', ...stateOf(userId) };
}

/** Xem trạng thái. */
function xem(userId) {
  const s = stateOf(userId);
  return { ok: true, kind: s.active ? 'dang_treo' : 'chua_treo', ...s };
}

/** Xuất quan: cộng tu vi và kết thúc phiên treo. */
function xuatQuan(userId) {
  const row = Cu.getCultivator(userId);
  const s = stateOf(userId, row);
  if (!s.active) return { ok: false, kind: 'chua_treo', ...s };
  if (s.elapsed < B.TREO_MIN_SECONDS) return { ok: false, kind: 'qua_som', ...s, needWait: Math.ceil(B.TREO_MIN_SECONDS - s.elapsed) };
  const gained = Math.max(1, s.pending);
  Cu.updateCultivator(userId, { tu_vi: row.tu_vi + gained, treo_start: 0 });
  const after = Cu.getCultivator(userId);
  return {
    ok: true, kind: 'xuatquan', ...s, gained, before: row.tu_vi, after: after.tu_vi, row: after,
    required: R.tuViRequired(after.realm_index, after.stage_index, after.world_tier), capped: s.elapsed > s.maxSeconds,
  };
}

module.exports = { rateOf, stateOf, batDau, xem, xuatQuan };
