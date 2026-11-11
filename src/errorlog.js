'use strict';
/** Ghi lỗi ra file logs/error.log + giữ 20 lỗi gần nhất trong bộ nhớ để admin xem bằng /loigannhat. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'error.log');
const recent = [];
let reporter = null;   // (code, where, msg) => void — bot.js gắn để gửi lỗi vào kênh/DM admin

/** v14.5: lượt bấm đã hết hạn (Discord chỉ cho 3 giây để phản hồi lần đầu) — KHÔNG phải lỗi code, chỉ do bot/host trả lời chậm. */
const stale = { count: 0, last: 0 };
const isStale = (err) => !!err && (err.code === 10062 || err.code === 40060 || /Unknown interaction|already been acknowledged/i.test(String(err.message || '')));
const getStale = () => ({ ...stale });

/** @returns mã lỗi ngắn (hiện cho người dùng để báo admin) */
function logError(where, err) {
  if (isStale(err)) {            // không sinh mã lỗi/không báo vào kênh admin → tránh spam; chỉ đếm + cảnh báo gọn
    stale.count += 1; stale.last = Date.now();
    console.warn(`⏱️ Lượt bấm hết hạn tại ${where} (${err.code || ''} ${String(err.message || '').slice(0, 40)}) — bot trả lời chậm >3s. Tổng ${stale.count} lần từ lúc khởi động.`);
    return 'het-han';
  }
  const code = crypto.randomBytes(2).toString('hex');
  const msg = String((err && err.stack) || err);
  recent.push({ code, where, msg: msg.slice(0, 1500), at: Date.now() });
  if (recent.length > 20) recent.shift();
  console.error(`⚠️ [${code}] Lỗi tại ${where}:`, err);
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] [${code}] ${where}\n${msg}\n\n`);
    if (fs.statSync(LOG_FILE).size > 2 * 1024 * 1024) fs.renameSync(LOG_FILE, `${LOG_FILE}.old`); // chống phình file
  } catch (_) { /* không ghi được file thì thôi, vẫn có console */ }
  try { if (reporter) reporter(code, where, msg); } catch (_) { /* bỏ qua */ }
  return code;
}
const setReporter = (fn) => { reporter = fn; };
const getRecent = () => recent.slice().reverse();
module.exports = { logError, getRecent, setReporter, isStale, getStale, LOG_FILE };
