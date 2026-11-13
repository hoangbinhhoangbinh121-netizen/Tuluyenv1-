'use strict';
/**
 * KHÓA TU LUYỆN (v16.8) — admin khóa tu luyện của 1 người chơi bằng /khoatuluyen (tạm thời hoặc vô thời hạn).
 * Bị khóa: Tu Luyện, Bế Quan, Cảm Ngộ, Linh Mạch, Bế Quan Treo (bắt đầu / xuất quan) — và Đột Phá nếu admin chọn kèm.
 * Chặn ở các hàm game gốc nên cả lệnh gõ lẫn nút bấm/menu đều bị chặn. Khóa lưu trong DB (sống qua restart), hết hạn tự gỡ.
 * Khi khóa, phiên treo đang chạy bị HỦY và không nhận tu vi (tránh khóa rồi mở để nhận trọn phần tích lũy).
 */
const D = require('../db');
const { now } = require('../util');

let ready = false;
function ensure() {
  if (ready) return;
  D.run(`CREATE TABLE IF NOT EXISTS cult_locks (
    user_id TEXT PRIMARY KEY, until REAL NOT NULL DEFAULT 0, reason TEXT DEFAULT '', by TEXT DEFAULT '',
    created_at REAL DEFAULT 0, block_dotpha INTEGER DEFAULT 0)`);
  ready = true;
}

/** Khóa đang còn hiệu lực của người chơi (hoặc null). Khóa hết hạn bị xóa ngay khi kiểm tra. */
function get(userId) {
  ensure();
  const r = D.get('SELECT * FROM cult_locks WHERE user_id = ?', String(userId));
  if (!r) return null;
  if (Number(r.until) > 0 && Number(r.until) <= now()) { D.run('DELETE FROM cult_locks WHERE user_id = ?', String(userId)); return null; }
  return r;
}

/** hours = 0 → vô thời hạn. Trả { lock, cancelledTreo }. */
function lock(userId, { hours = 0, reason = '', by = '', dotpha = false } = {}) {
  ensure();
  const h = Math.max(0, Math.min(24 * 365, Number(hours) || 0));
  const t = now();
  D.run('INSERT OR REPLACE INTO cult_locks (user_id, until, reason, by, created_at, block_dotpha) VALUES (?, ?, ?, ?, ?, ?)',
    String(userId), h > 0 ? t + h * 3600 : 0, String(reason || '').slice(0, 200), String(by || ''), t, dotpha ? 1 : 0);
  let cancelledTreo = false;
  try {
    const Cu = require('./cultivator'); const row = Cu.getCultivator(userId);
    if (row && Number(row.treo_start) > 0) { Cu.updateCultivator(userId, { treo_start: 0 }); cancelledTreo = true; }
  } catch (e) { console.error('⚠️ khoatuluyen: không hủy được phiên treo:', e.message); }
  return { lock: get(userId), cancelledTreo };
}
function unlock(userId) { ensure(); return D.run('DELETE FROM cult_locks WHERE user_id = ?', String(userId)).changes > 0; }
function list() {
  ensure();
  D.run('DELETE FROM cult_locks WHERE until > 0 AND until <= ?', now());
  return D.all('SELECT * FROM cult_locks ORDER BY created_at DESC LIMIT 50');
}

const until = (l) => (Number(l.until) > 0 ? `đến <t:${Math.floor(l.until)}:f> (<t:${Math.floor(l.until)}:R>)` : '**vô thời hạn**');
/** Thông báo cho người bị khóa (bắt đầu bằng 🔒 để các màn hình text hiển thị nguyên văn, không nhầm với "⏳ hồi chiêu"). */
function text(l) {
  return `🔒 **Tu luyện của bạn đang bị khóa** ${until(l)}.${l.reason ? `\n📝 Lý do: ${l.reason}` : ''}\n${Number(l.block_dotpha) ? 'Tu Luyện, Bế Quan, Cảm Ngộ, Linh Mạch, Bế Quan Treo và **Đột Phá** đều tạm dừng.' : 'Tu Luyện, Bế Quan, Cảm Ngộ, Linh Mạch và Bế Quan Treo tạm dừng.'} Liên hệ admin nếu bạn cho rằng đây là nhầm lẫn.`;
}

module.exports = { get, lock, unlock, list, text, until };
