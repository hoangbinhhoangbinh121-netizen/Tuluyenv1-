'use strict';
/**
 * TuTienStore — Ví THIÊN TỆ. Nạp tiền thật → cộng Thiên Tệ → dùng Thiên Tệ mua vật phẩm.
 *  • Số dư nằm trong bảng store_wallet (CHECK balance >= 0 — DB không bao giờ cho âm), mọi biến động ghi sổ cái store_ledger.
 *  • Trừ tiền bằng UPDATE có điều kiện (balance >= n) nên 2 lượt mua cùng lúc không thể tiêu quá số dư.
 *  • credit/debit phải gọi bên trong D.transaction của nơi dùng nếu cần "trừ tiền + tạo đơn" cùng lúc.
 */
const D = require('../db');
const Schema = require('./schema');
const { now } = require('../util');

const NAME = 'Thiên Tệ';
const ICON = '🪙';
const label = (n) => `${ICON} ${Number(n).toLocaleString('en-US').replace(/,/g, '.')} ${NAME}`;

// 1 Thiên Tệ = VND_PER_TT đồng (theo tỉ lệ gốc, chưa tính thưởng nạp). Mặc định 10 Thiên Tệ / 1.000đ → 1 Thiên Tệ = 100đ.
const TT_PER_1000 = Math.max(1, Math.round(Number(process.env.STORE_TT_PER_1K) || 10));
const VND_PER_TT = 1000 / TT_PER_1000;
/** Giá vật phẩm (VNĐ) → giá bằng Thiên Tệ theo tỉ lệ gốc. */
const ttOf = (vnd) => Math.max(1, Math.round(Number(vnd) / VND_PER_TT));

function ensureRow(uid) { Schema.ensure(); D.run('INSERT OR IGNORE INTO store_wallet (user_id) VALUES (?)', String(uid)); }
function balance(uid) { Schema.ensure(); const r = D.get('SELECT balance FROM store_wallet WHERE user_id = ?', String(uid)); return r ? Number(r.balance) : 0; }
function summary(uid) { Schema.ensure(); return D.get('SELECT balance, total_topup, total_spent FROM store_wallet WHERE user_id = ?', String(uid)) || { balance: 0, total_topup: 0, total_spent: 0 }; }

function log(uid, delta, reason, ref, note) {
  D.run('INSERT INTO store_ledger (user_id, delta, balance_after, reason, ref, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', String(uid), delta, balance(uid), reason, ref || '', String(note || '').slice(0, 200), now());
}
/** Cộng Thiên Tệ. reason: topup | refund | admin. Trùng (reason, ref) → ném lỗi để transaction bên ngoài huỷ (chống cộng đôi). */
function credit(uid, n, reason, ref = '', note = '') {
  n = Math.round(Number(n)); if (!(n > 0)) throw new Error('Số Thiên Tệ cộng phải > 0');
  ensureRow(uid);
  D.run(`UPDATE store_wallet SET balance = balance + ?, total_topup = total_topup + ? WHERE user_id = ?`, n, reason === 'topup' ? n : 0, String(uid));
  log(uid, n, reason, ref, note);
  return balance(uid);
}
/** Trừ Thiên Tệ. Thiếu số dư → trả false (không đổi gì). reason: buy | admin. */
function debit(uid, n, reason, ref = '', note = '') {
  n = Math.round(Number(n)); if (!(n > 0)) throw new Error('Số Thiên Tệ trừ phải > 0');
  ensureRow(uid);
  const changed = D.run('UPDATE store_wallet SET balance = balance - ?, total_spent = total_spent + ? WHERE user_id = ? AND balance >= ?', n, reason === 'buy' ? n : 0, String(uid), n).changes;
  if (changed !== 1) return false;
  log(uid, -n, reason, ref, note);
  return true;
}
const ledger = (uid, limit = 8) => { Schema.ensure(); return D.all('SELECT * FROM store_ledger WHERE user_id = ? ORDER BY id DESC LIMIT ?', String(uid), limit); };
const totals = () => { Schema.ensure(); return D.get('SELECT COUNT(*) AS wallets, COALESCE(SUM(balance), 0) AS outstanding, COALESCE(SUM(total_topup), 0) AS topup, COALESCE(SUM(total_spent), 0) AS spent FROM store_wallet'); };

module.exports = { NAME, ICON, label, TT_PER_1000, VND_PER_TT, ttOf, balance, summary, credit, debit, ledger, totals };
