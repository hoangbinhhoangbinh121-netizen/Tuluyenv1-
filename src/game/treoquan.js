'use strict';
/**
 * BẾ QUAN TREO MÁY (v12.4.2) — tu luyện tự động, không cần bấm.
 *  - Bắt đầu: ghi mốc `treo_start` vào DB (còn nguyên khi bot khởi động lại).
 *  - Xuất quan: tu vi nhận = tốc độ Tu Luyện bấm tay × BAL.B.TREO_EFFICIENCY (10%) × thời gian treo.
 *  - v14.2: KHÔNG còn giới hạn 4 giờ (TREO_MAX_HOURS = 0); Xuất Quan tách thành lệnh /xuatquan riêng (cùng engine). Treo = đúng 5% Tu Luyện bấm tay.
 *  - (cũ, v12.5) mỗi phiên treo tối đa TREO_MAX_HOURS (4 giờ). Đủ hạn → XUẤT QUAN CƯỠNG CHẾ: tự cộng tu vi của 4 giờ và kết thúc phiên
 *    (vòng nền quét mỗi phút + xử lý ngay khi người chơi mở /treoquan). Dùng /treoquan để LÀM MỚI và treo phiên tiếp theo.
 *  - Tốc độ tính từ mốc GỐC (R.tuViRequiredBase) và hệ số tư chất/buff dùng CHUNG với Tu Luyện (A.tuluyenMultFor)
 *    → đồng bộ với hệ cân bằng, không phụ thuộc hệ số tăng exp đột phá. Không cộng Linh Thạch (tránh lạm phát).
 */
const K = require('./constants');
const CD = require('./cooldowns');
const R = require('./realm');
const Cu = require('./cultivator');
const BAL = require('./balance');
const A = require('./actionsBasic');
const D = require('../db');
const { now, int } = require('../util');

const B = BAL.B;
const maxSeconds = () => (B.TREO_MAX_HOURS > 0 ? int(B.TREO_MAX_HOURS * 3600) : Infinity);   // Infinity = không giới hạn

/** Tu vi / giây khi treo ở cảnh giới & tư chất hiện tại. */
function rateOf(userId, row) {
  // v14.2: = tu vi kỳ vọng của Tu Luyện bấm tay (cùng công thức, gồm ×TULUYEN_SPEED_MULT & sàn) ÷ cooldown × TREO_EFFICIENCY (5%).
  const { mult, sectBuff, buff } = A.tuluyenMultFor(userId, row);
  const handPerSec = A.tuluyenExpectedPerClick(userId, row) / CD.COOLDOWN_TULUYEN;
  return { rate: handPerSec * B.TREO_EFFICIENCY, handRate: handPerSec, mult, sectBuff: sectBuff > 1, buff: buff > 1 };
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

/**
 * Xuất quan cưỡng chế nếu phiên treo đã đủ hạn. Trả thông tin kết toán, hoặc null nếu chưa đủ hạn / không treo.
 * Idempotent: chỉ kết toán khi treo_start còn > 0 (đọc lại ngay trước khi ghi).
 */
function settleIfExpired(userId, t = now()) {
  const limit = maxSeconds();
  if (!Number.isFinite(limit)) return null;
  const row = Cu.getCultivator(userId);
  const start = row ? Number(row.treo_start) || 0 : 0;
  if (!(start > 0) || t - start < limit) return null;
  const s = stateOf(userId, row, t);
  const gained = Math.max(1, s.pending);
  Cu.updateCultivator(userId, { tu_vi: row.tu_vi + gained, treo_start: 0, treo_last_gain: gained, treo_last_end: start + limit, treo_forced: 1 });
  return { gained, endedAt: start + limit, before: row.tu_vi, counted: limit, forced: true };
}

/** Quét toàn bộ người chơi đang treo đã đủ hạn (vòng nền). Trả số người bị xuất quan cưỡng chế. */
function sweepExpired(t = now()) {
  const limit = maxSeconds();
  if (!Number.isFinite(limit)) return 0;
  let n = 0;
  for (const r of D.all('SELECT user_id FROM cultivators WHERE treo_start > 0 AND treo_start <= ?', t - limit)) {
    try { if (settleIfExpired(r.user_id, t)) n++; } catch (e) { console.error('⚠️ treo_sweep lỗi:', e.message); }
  }
  return n;
}

/** Thông báo "đã bị xuất quan cưỡng chế" chưa đọc (do vòng nền xử lý lúc người chơi vắng mặt). Đọc xong là xoá cờ. */
function takeForcedNotice(userId) {
  const row = Cu.getCultivator(userId);
  if (!row || !row.treo_forced) return null;
  Cu.updateCultivator(userId, { treo_forced: 0 });
  return { gained: row.treo_last_gain || 0, endedAt: row.treo_last_end || 0, forced: true };
}

/** Bắt đầu bế quan treo (cũng là LÀM MỚI sau khi bị xuất quan cưỡng chế). */
function batDau(userId) {
  const fresh = settleIfExpired(userId);
  if (fresh) Cu.updateCultivator(userId, { treo_forced: 0 });
  const notice = fresh || takeForcedNotice(userId);
  const row = Cu.getCultivator(userId);
  if (Number(row.treo_start) > 0) return { ok: false, kind: 'dang_treo', ...stateOf(userId, row) };
  Cu.updateCultivator(userId, { treo_start: now() });
  return { ok: true, kind: 'batdau', notice, ...stateOf(userId) };
}

/** Xem trạng thái. */
function xem(userId) {
  const fresh = settleIfExpired(userId);
  if (fresh) Cu.updateCultivator(userId, { treo_forced: 0 });   // đã hiển thị ngay → không nhắc lại lần sau
  const notice = fresh || takeForcedNotice(userId);
  const s = stateOf(userId);
  if (notice && !s.active) return { ok: true, kind: 'cuong_che', ...s, ...notice };
  return { ok: true, kind: s.active ? 'dang_treo' : 'chua_treo', notice, ...s };
}

/** Xuất quan: cộng tu vi và kết thúc phiên treo. */
function xuatQuan(userId) {
  const fresh = settleIfExpired(userId);
  if (fresh) { Cu.updateCultivator(userId, { treo_forced: 0 }); const s0 = stateOf(userId); const row0 = Cu.getCultivator(userId); return { ok: true, kind: 'cuong_che', ...s0, ...fresh, after: row0.tu_vi, required: R.tuViRequired(row0.realm_index, row0.stage_index, row0.world_tier) }; }
  const notice = takeForcedNotice(userId);
  if (notice && !(Number(Cu.getCultivator(userId).treo_start) > 0)) { const s0 = stateOf(userId); const row0 = Cu.getCultivator(userId); return { ok: true, kind: 'cuong_che', ...s0, ...notice, after: row0.tu_vi, required: R.tuViRequired(row0.realm_index, row0.stage_index, row0.world_tier) }; }
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

module.exports = { rateOf, stateOf, batDau, xem, xuatQuan, settleIfExpired, sweepExpired, takeForcedNotice };
