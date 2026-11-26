'use strict';
/**
 * v22.3 — Hệ số tu vi RIÊNG cho từng người chơi (admin đặt bằng `!tangexp`).
 * Nhân thêm lên tu vi của Tu Luyện, Bế Quan và Bế Quan Treo (cùng chỗ với sự kiện tăng tốc toàn server `ST.speedMult()`); nhân CHỒNG với nó.
 * KHÔNG áp: tu vi từ Boss/Bí Cảnh/Chứng Đạo/nhiệm vụ, EXP Nghề, Linh Thạch. Công tắc tổng `pboost` (on|off): off ⇒ mọi hệ số riêng ngưng hiệu lực (giữ nguyên dữ liệu).
 */
const D = require('../db');
const ST = require('./settings');
const now = () => Math.floor(Date.now() / 1000);
const MIN = 0.1; const MAX = 100;
const cache = new Map();   // user_id -> { mult, until } | null   (xoá cache khi ghi; hạn dùng tính lúc đọc)
const sid = (u) => String(u && u.id !== undefined ? u.id : u).replace(/[^\d]/g, '');
const enabled = () => String(ST.get('pboost', 'on')) !== 'off';
const setEnabled = (on) => ST.set('pboost', on ? 'on' : 'off');

function raw(uid) {
  if (cache.has(uid)) return cache.get(uid);
  const r = D.get('SELECT mult, until FROM player_exp_boost WHERE user_id = ?', uid); const v = r ? { mult: Number(r.mult) || 1, until: Number(r.until) || 0 } : null;
  cache.set(uid, v); return v;
}
/** Hệ số đang áp dụng cho người này (1 nếu không có / hết hạn / công tắc tắt). Gọi ở đường nóng: có cache. */
function mult(userId) {
  if (!enabled()) return 1; const r = raw(sid(userId)); if (!r) return 1;
  return r.until === 0 || r.until > now() ? r.mult : 1;
}
function set(user, m, minutes = 0, by = '') {
  const uid = sid(user); const x = Number(m);
  if (!uid) return { ok: false, error: 'Thiếu người chơi.' };
  if (!Number.isFinite(x) || x < MIN || x > MAX) return { ok: false, error: `Hệ số phải trong khoảng ${MIN}–${MAX}.` };
  const mins = Math.max(0, Math.min(60 * 24 * 365, Math.floor(Number(minutes) || 0)));
  D.run('INSERT OR REPLACE INTO player_exp_boost (user_id, mult, until, by_id, ts) VALUES (?,?,?,?,?)', uid, x, mins > 0 ? now() + mins * 60 : 0, String(by || ''), now()); cache.delete(uid);
  try { require('./admin17').log(by, 'tangexp_set', uid, `x${x}${mins ? ` ${mins}p` : ''}`); } catch (_) { /* nhật ký phụ */ }
  return { ok: true, mult: x, until: mins > 0 ? now() + mins * 60 : 0 };
}
function clear(user, by = '') {
  const uid = sid(user); const had = !!D.get('SELECT 1 x FROM player_exp_boost WHERE user_id = ?', uid);
  D.run('DELETE FROM player_exp_boost WHERE user_id = ?', uid); cache.delete(uid);
  if (had) try { require('./admin17').log(by, 'tangexp_clear', uid, ''); } catch (_) { /* nhật ký phụ */ }
  return { ok: had, error: had ? undefined : 'Người này không có hệ số riêng.' };
}
const list = () => D.all('SELECT * FROM player_exp_boost ORDER BY ts DESC LIMIT 60').map((r) => ({ ...r, active: enabled() && (r.until === 0 || r.until > now()) }));

// ---- v22.4: hạ YÊU CẦU tu vi đột phá riêng cho 1 người (chia cho div). Dùng chung công tắc `pboost`.
const NMIN = 0.1; const NMAX = 1000;
const ncache = new Map();
function nraw(uid) {
  if (ncache.has(uid)) return ncache.get(uid);
  const r = D.get('SELECT div, until FROM player_need_cut WHERE user_id = ?', uid); const v = r ? { div: Number(r.div) || 1, until: Number(r.until) || 0 } : null;
  ncache.set(uid, v); return v;
}
/** Số chia yêu cầu đột phá đang áp dụng (1 = bình thường). */
function needDiv(userId) {
  if (!enabled()) return 1; const r = nraw(sid(userId)); if (!r) return 1;
  return r.until === 0 || r.until > now() ? r.div : 1;
}
function setNeed(user, d, minutes = 0, by = '') {
  const uid = sid(user); const x = Number(d);
  if (!uid) return { ok: false, error: 'Thiếu người chơi.' };
  if (!Number.isFinite(x) || x < NMIN || x > NMAX) return { ok: false, error: `Số chia phải trong khoảng ${NMIN}–${NMAX}.` };
  const mins = Math.max(0, Math.min(60 * 24 * 365, Math.floor(Number(minutes) || 0)));
  D.run('INSERT OR REPLACE INTO player_need_cut (user_id, div, until, by_id, ts) VALUES (?,?,?,?,?)', uid, x, mins > 0 ? now() + mins * 60 : 0, String(by || ''), now()); ncache.delete(uid);
  try { require('./admin17').log(by, 'tangexp_need', uid, `/${x}${mins ? ` ${mins}p` : ''}`); } catch (_) { /* nhật ký phụ */ }
  return { ok: true, div: x, until: mins > 0 ? now() + mins * 60 : 0 };
}
function clearNeed(user, by = '') {
  const uid = sid(user); const had = !!D.get('SELECT 1 x FROM player_need_cut WHERE user_id = ?', uid);
  D.run('DELETE FROM player_need_cut WHERE user_id = ?', uid); ncache.delete(uid);
  if (had) try { require('./admin17').log(by, 'tangexp_need_clear', uid, ''); } catch (_) { /* nhật ký phụ */ }
  return { ok: had, error: had ? undefined : 'Người này không có giảm yêu cầu đột phá.' };
}
const listNeed = () => D.all('SELECT * FROM player_need_cut ORDER BY ts DESC LIMIT 60').map((r) => ({ ...r, active: enabled() && (r.until === 0 || r.until > now()) }));
const _resetCache = () => { cache.clear(); ncache.clear(); };
module.exports = { MIN, MAX, NMIN, NMAX, enabled, setEnabled, mult, set, clear, list, needDiv, setNeed, clearNeed, listNeed, _resetCache };
