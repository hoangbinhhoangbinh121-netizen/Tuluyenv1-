'use strict';
/** Bảng mới của v21.0 — Cửa Hàng Nguyên Bảo + đơn nạp (CREATE IF NOT EXISTS; không đụng bảng/cột cũ). */
const CREATE_V21 = [
  // Ví Nguyên Bảo (tiền nạp): nb = số dư; topped = tổng đã nạp (Nguyên Bảo); spent = tổng đã tiêu; vnd = tổng tiền thật đã được admin xác nhận
  `CREATE TABLE IF NOT EXISTS v21_wallet (user_id TEXT PRIMARY KEY, nb INTEGER NOT NULL DEFAULT 0, topped INTEGER NOT NULL DEFAULT 0, spent INTEGER NOT NULL DEFAULT 0, vnd INTEGER NOT NULL DEFAULT 0)`,
  // Đơn nạp: pending → done | cancelled | expired. claimed = người chơi bấm "Tôi đã chuyển khoản"
  `CREATE TABLE IF NOT EXISTS v21_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, vnd INTEGER NOT NULL, nb INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', claimed INTEGER NOT NULL DEFAULT 0, created_at REAL NOT NULL, done_at REAL NOT NULL DEFAULT 0, admin_id TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT 'topup', item_key TEXT NOT NULL DEFAULT '', item_q INTEGER NOT NULL DEFAULT 0, item_qty INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS idx_v21_orders_user ON v21_orders (user_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_v21_orders_status ON v21_orders (status, created_at)`,
  // Nhật ký mua hàng
  `CREATE TABLE IF NOT EXISTS v21_buys (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, key TEXT NOT NULL, q INTEGER NOT NULL DEFAULT 0, qty INTEGER NOT NULL, cost INTEGER NOT NULL, at REAL NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_v21_buys_user ON v21_buys (user_id, at)`,
  // Nhật ký ví (cộng/trừ Nguyên Bảo): để đối soát
  `CREATE TABLE IF NOT EXISTS v21_ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, delta INTEGER NOT NULL, why TEXT NOT NULL DEFAULT '', admin_id TEXT NOT NULL DEFAULT '', at REAL NOT NULL)`,
];
/** v21.2: đơn mua trực tiếp (.od) — thêm cột cho DB đã tạo bởi v21.0/v21.1 (initDb tự ALTER nếu thiếu). */
const ADD_COLUMNS_V21 = { v21_orders: { kind: "TEXT NOT NULL DEFAULT 'topup'", item_key: "TEXT NOT NULL DEFAULT ''", item_q: 'INTEGER NOT NULL DEFAULT 0', item_qty: 'INTEGER NOT NULL DEFAULT 0' } };
const V21_TABLES = ['v21_wallet', 'v21_orders', 'v21_buys', 'v21_ledger'];
module.exports = { CREATE_V21, ADD_COLUMNS_V21, V21_TABLES };
