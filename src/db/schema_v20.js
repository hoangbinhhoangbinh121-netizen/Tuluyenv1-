'use strict';
/** Bảng mới của v20.0 (CREATE IF NOT EXISTS — an toàn khi mở DB cũ). KHÔNG đụng bảng/cột cũ: cấp nghề, công thức đã học, Linh Điền, trang bị, lệnh chế giữ nguyên 100%. */
const CREATE_V20 = [
  // Công thức thất truyền đã học (học bằng cuộn; học vĩnh viễn)
  `CREATE TABLE IF NOT EXISTS v20_learned (user_id TEXT NOT NULL, recipe_id TEXT NOT NULL, at REAL NOT NULL, PRIMARY KEY (user_id, recipe_id))`,
  // Thuộc tính riêng của đan dược (Đan Văn / Đan Hương / Đan Linh / Dị Biến) — lưu RIÊNG, không đổi hệ thống phẩm chất 1–5
  `CREATE TABLE IF NOT EXISTS v20_marks (user_id TEXT NOT NULL, item_id TEXT NOT NULL, q INTEGER NOT NULL DEFAULT 0, mark TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, item_id, q, mark))`,
  // Dị Hỏa sở hữu (mỗi giai đoạn tối đa 1 ngọn); active = 1 là ngọn đang dùng
  `CREATE TABLE IF NOT EXISTS v20_dihoa (user_id TEXT NOT NULL, fire_n INTEGER NOT NULL, lv INTEGER NOT NULL DEFAULT 1, exp INTEGER NOT NULL DEFAULT 0, evo INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 0, at REAL, PRIMARY KEY (user_id, fire_n))`,
  // Khai thác: mỗi lượt = 1 dòng (nguyên tử: 'run' → 'done' bằng 1 UPDATE có điều kiện)
  `CREATE TABLE IF NOT EXISTS v20_gather (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, zone TEXT NOT NULL, started_at REAL NOT NULL, ready_at REAL NOT NULL, state TEXT NOT NULL DEFAULT 'run', result TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_v20_gather_user ON v20_gather (user_id, state)`,
  // Đơn hàng nghề nghiệp theo ngày (mỗi đơn chỉ nhận thưởng 1 lần)
  `CREATE TABLE IF NOT EXISTS v20_orders (user_id TEXT NOT NULL, day TEXT NOT NULL, idx INTEGER NOT NULL, kind TEXT NOT NULL, spec TEXT NOT NULL DEFAULT '{}', progress INTEGER NOT NULL DEFAULT 0, need INTEGER NOT NULL DEFAULT 1, state TEXT NOT NULL DEFAULT 'open', PRIMARY KEY (user_id, day, idx))`,
  // Danh hiệu nghề nghiệp + bộ đếm trọn đời
  `CREATE TABLE IF NOT EXISTS v20_titles (user_id TEXT NOT NULL, title TEXT NOT NULL, at REAL NOT NULL, PRIMARY KEY (user_id, title))`,
  `CREATE TABLE IF NOT EXISTS v20_stats (user_id TEXT NOT NULL, key TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, key))`,
];
const V20_TABLES = ['v20_learned', 'v20_marks', 'v20_dihoa', 'v20_gather', 'v20_orders', 'v20_titles', 'v20_stats'];
module.exports = { CREATE_V20, V20_TABLES };
