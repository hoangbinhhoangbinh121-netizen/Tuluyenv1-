'use strict';
/**
 * Bảng của TuTienStore (v16.8). Nằm cùng nhóm schema của DB để D.migrate() / initDb() / "tự cứu" (withRescue)
 * luôn tạo đủ — kể cả sau /restore_db, import DB cũ hay khi file DB bị thay.
 * (Trước đây các bảng này chỉ được tạo 1 lần bởi store/schema.js rồi nhớ cờ `ready` → đổi DB là mất bảng mà bot vẫn tưởng còn.)
 */
const CREATE_STORE = [
  `CREATE TABLE IF NOT EXISTS store_orders (
     code TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     product_id TEXT NOT NULL,
     product_name TEXT NOT NULL,
     qty INTEGER NOT NULL DEFAULT 1,
     amount INTEGER NOT NULL,
     status TEXT NOT NULL DEFAULT 'pending',
     grants TEXT NOT NULL DEFAULT '[]',
     grant_step INTEGER NOT NULL DEFAULT 0,
     created_at REAL DEFAULT 0, expires_at REAL DEFAULT 0, paid_at REAL DEFAULT 0, delivered_at REAL DEFAULT 0,
     paid_amount INTEGER DEFAULT 0, pay_tx TEXT DEFAULT '', pay_by TEXT DEFAULT '',
     note TEXT DEFAULT '', tt_cost INTEGER DEFAULT 0)`,
  // Mỗi giao dịch ngân hàng chỉ được xử lý 1 lần (chống webhook gửi lặp / chống tính tiền 2 lần).
  `CREATE TABLE IF NOT EXISTS store_tx (
     tx_id TEXT PRIMARY KEY, code TEXT DEFAULT '', amount INTEGER DEFAULT 0,
     content TEXT DEFAULT '', result TEXT DEFAULT '', created_at REAL DEFAULT 0)`,
  // Admin chỉnh giá / bật tắt từng sản phẩm mà không cần sửa code.
  `CREATE TABLE IF NOT EXISTS store_product_cfg (
     product_id TEXT PRIMARY KEY, price INTEGER, enabled INTEGER DEFAULT 1)`,
  // Ví Thiên Tệ (tiền ảo của shop, nạp bằng tiền thật, dùng để mua vật phẩm).
  `CREATE TABLE IF NOT EXISTS store_wallet (
     user_id TEXT PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
     total_topup INTEGER NOT NULL DEFAULT 0, total_spent INTEGER NOT NULL DEFAULT 0)`,
  // Sổ cái: mọi biến động số dư đều có dòng ở đây (để đối soát / khiếu nại).
  `CREATE TABLE IF NOT EXISTS store_ledger (
     id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, delta INTEGER NOT NULL, balance_after INTEGER NOT NULL,
     reason TEXT NOT NULL, ref TEXT NOT NULL DEFAULT '', note TEXT DEFAULT '', created_at REAL DEFAULT 0)`,
];

/** Index tạo SAU khi bảng + cột đã đủ. */
const INDEX_STORE = [
  'CREATE INDEX IF NOT EXISTS store_orders_user ON store_orders (user_id, status)',
  'CREATE INDEX IF NOT EXISTS store_orders_status ON store_orders (status, created_at)',
  'CREATE INDEX IF NOT EXISTS store_ledger_user ON store_ledger (user_id, id)',
  // Mỗi (lý do, mã đơn) chỉ ghi sổ 1 lần: nạp / mua / hoàn cho cùng một đơn không thể bị cộng-trừ hai lần.
  "CREATE UNIQUE INDEX IF NOT EXISTS store_ledger_ref ON store_ledger (reason, ref) WHERE ref <> ''",
];

/** DB cũ (bản v16.8 đầu) thiếu cột → thêm khi migrate. */
const ADD_COLUMNS_STORE = {
  store_orders: { tt_cost: 'INTEGER DEFAULT 0' },
};

module.exports = { CREATE_STORE, INDEX_STORE, ADD_COLUMNS_STORE };
