'use strict';
/** Cài đặt toàn bot do admin chỉnh lúc chạy (lưu trong bảng bot_settings, không cần khởi động lại). */
const D = require('../db');
const { now } = require('../util');

const cache = new Map();
function get(key, def = '') {
  if (cache.has(key)) return cache.get(key);
  const r = D.get('SELECT value FROM bot_settings WHERE key = ?', key);
  const v = r ? r.value : def; cache.set(key, v); return v;
}
function set(key, value) {
  D.run('INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, String(value));
  cache.set(key, String(value));
}

// ---- Tăng tốc tu luyện toàn server (sự kiện): hệ số nhân thêm lên Tu Luyện / Bế Quan / Bế Quan Treo, tuỳ chọn hết hạn
const SPEED_MIN = 0.1; const SPEED_MAX = 50;
function speedInfo() {
  const mult = Number(get('speed_mult', '1')) || 1; const until = Number(get('speed_until', '0')) || 0;
  const active = mult !== 1 && (until === 0 || until > now());
  return { mult: active ? mult : 1, stored: mult, until, active };
}
/** Hệ số nhân đang áp dụng (1 nếu không có sự kiện / đã hết hạn). Gọi ở đường nóng nên chỉ đọc cache. */
const speedMult = () => speedInfo().mult;
function setSpeed(mult, minutes = 0) {
  const m = Math.max(SPEED_MIN, Math.min(SPEED_MAX, Number(mult) || 1));
  set('speed_mult', m); set('speed_until', minutes > 0 ? now() + minutes * 60 : 0);
  return speedInfo();
}
module.exports = { get, set, speedInfo, speedMult, setSpeed, SPEED_MIN, SPEED_MAX };
