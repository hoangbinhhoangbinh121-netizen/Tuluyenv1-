'use strict';
/**
 * v21.7 — SỔ CÁI tiền tệ (Linh Thạch / Linh Tinh). Chỉ GHI THÊM; mỗi dòng có `idem_key` DUY NHẤT.
 *   apply(user, delta, o) : đổi số dư + ghi sổ trong 1 transaction; cùng idem_key chạy lần 2 ⇒ KHÔNG đổi số dư (trả dup:true); trừ quá số dư ⇒ short:true.
 *   note(user, delta, o)  : chỉ ghi sổ SAU khi nơi gọi đã tự đổi số dư (trong cùng transaction); khoá trùng ⇒ ném lỗi ⇒ transaction ngoài ROLLBACK (chặn xử lý lặp).
 * KHÔNG phải mọi dòng tiền của bot đều qua sổ cái — danh sách phần đã nối ở docs/audit_v21_3/14_SO_CAI_V21_7.md. summary()/recent() chỉ phản ánh phần đã nối.
 */
const crypto = require('node:crypto');
const D = require('../db');
const Cu = require('./cultivator');
const { now } = require('../util');

const CURRENCIES = ['linh_thach', 'linh_tinh'];
/** Khoá ngẫu nhiên cho thao tác không có định danh tự nhiên (đã được bảo vệ bằng điều kiện DB khác). */
const nonce = (prefix) => `${prefix}:${crypto.randomBytes(8).toString('hex')}`;
const bad = (c) => !CURRENCIES.includes(c);
const clean = (o) => ({ currency: (o && o.currency) || 'linh_thach', reason: String((o && o.reason) || '').slice(0, 80), ref: String((o && o.ref) || '').slice(0, 120), key: String((o && o.key) || '') });

function insert(user, c, delta, balance, o) {
  D.run('INSERT INTO ledger_entries (user_id, currency, delta, balance_after, reason, ref, idem_key, created_at) VALUES (?,?,?,?,?,?,?,?)', String(user), c, delta, balance, o.reason, o.ref, o.key, now());
}
const exists = (key) => !!D.get('SELECT 1 AS x FROM ledger_entries WHERE idem_key = ?', key);

function apply(user, delta, opts = {}) {
  const o = clean(opts); delta = Math.trunc(Number(delta));
  if (!Number.isFinite(delta) || delta === 0) return { ok: false, msg: 'Số tiền không hợp lệ.' };
  if (bad(o.currency)) return { ok: false, msg: 'Loại tiền không hợp lệ.' };
  if (!o.key) return { ok: false, msg: 'Thiếu khoá chống ghi đôi (idem_key).' };
  return D.transaction(() => {
    const row = Cu.getCultivator(user); if (!row) return { ok: false, msg: 'Người chơi chưa tu tiên.' };
    if (exists(o.key)) return { ok: true, dup: true, balance: row[o.currency] || 0 };
    const have = row[o.currency] || 0;
    if (delta < 0 && have + delta < 0) return { ok: false, short: true, need: -delta, have, msg: 'Không đủ số dư.' };
    const guard = delta < 0 ? { [o.currency]: -delta } : undefined;                 // khoá lạc quan: số dư phải còn ≥ số trừ lúc ghi
    if (!Cu.updateCultivator(user, { [o.currency]: new Cu.Delta(delta) }, guard)) return { ok: false, short: true, need: -delta, have, msg: Cu.MSG_BALANCE_CHANGED };
    const after = Cu.getCultivator(user)[o.currency] || 0; insert(user, o.currency, delta, after, o);
    return { ok: true, dup: false, balance: after };
  });
}
function note(user, delta, opts = {}) {
  const o = clean(opts); delta = Math.trunc(Number(delta));
  if (!delta) return null;                                                             // không có thay đổi ⇒ không ghi
  if (bad(o.currency) || !o.key) throw new Error('ledger.note: thiếu khoá/loại tiền');
  if (exists(o.key)) throw new Error(`ledger: trùng khoá ${o.key} — thao tác đã được ghi trước đó`);
  const row = D.get(`SELECT ${o.currency} AS b FROM cultivators WHERE user_id = ?`, String(user));
  insert(user, o.currency, delta, row ? row.b || 0 : 0, o); return true;
}
const recent = (user, n = 15, currency = null) => D.all(`SELECT * FROM ledger_entries WHERE user_id = ? ${currency ? 'AND currency = ?' : ''} ORDER BY entry_id DESC LIMIT ?`, ...[String(user), ...(currency ? [currency] : []), Math.max(1, Math.min(100, n))]);
function summary(user, currency = 'linh_thach') {
  const r = D.get('SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN delta > 0 THEN delta END), 0) AS inn, COALESCE(SUM(CASE WHEN delta < 0 THEN -delta END), 0) AS out FROM ledger_entries WHERE user_id = ? AND currency = ?', String(user), currency);
  return { count: r.n, in: r.inn, out: r.out, net: r.inn - r.out };
}
module.exports = { CURRENCIES, nonce, apply, note, recent, summary, exists };
