'use strict';
/** Bảng mới của v17 (CREATE IF NOT EXISTS — an toàn khi mở DB cũ). ID người chơi lưu TEXT. Vật phẩm V16 (cột trong cultivators) KHÔNG đụng tới. */
const CREATE_V17 = [
  // Kho vật phẩm mới: (người, vật phẩm, phẩm chất sản phẩm) → số lượng. q = 0 với nguyên liệu/vật phẩm không phân phẩm.
  `CREATE TABLE IF NOT EXISTS inv_items (
     user_id TEXT NOT NULL, item_id TEXT NOT NULL, q INTEGER NOT NULL DEFAULT 0, qty INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (user_id, item_id, q))`,
  `CREATE TABLE IF NOT EXISTS inv_lock (user_id TEXT NOT NULL, item_id TEXT NOT NULL, q INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, item_id, q))`,
  `CREATE TABLE IF NOT EXISTS inv_daily (user_id TEXT NOT NULL, day TEXT NOT NULL, key TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, day, key))`,
  `CREATE TABLE IF NOT EXISTS inv_log (
     id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL NOT NULL, user_id TEXT NOT NULL, item_id TEXT NOT NULL, q INTEGER NOT NULL DEFAULT 0, delta INTEGER NOT NULL, why TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_inv_log_user ON inv_log (user_id, id)`,
  // Nghề nghiệp
  `CREATE TABLE IF NOT EXISTS prof_state (
     user_id TEXT NOT NULL, prof_id TEXT NOT NULL, exp INTEGER NOT NULL DEFAULT 0, level INTEGER NOT NULL DEFAULT 1, crafts INTEGER NOT NULL DEFAULT 0,
     successes INTEGER NOT NULL DEFAULT 0, fails INTEGER NOT NULL DEFAULT 0, best_q INTEGER NOT NULL DEFAULT 0, extra TEXT NOT NULL DEFAULT '{}', created_at REAL,
     PRIMARY KEY (user_id, prof_id))`,
  `CREATE TABLE IF NOT EXISTS prof_mastery (user_id TEXT NOT NULL, recipe_id TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, recipe_id))`,
  `CREATE TABLE IF NOT EXISTS prof_ach (user_id TEXT NOT NULL, ach_id TEXT NOT NULL, at REAL, PRIMARY KEY (user_id, ach_id))`,
  `CREATE TABLE IF NOT EXISTS craft_jobs (
     job_id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, prof_id TEXT NOT NULL, recipe_id TEXT NOT NULL, qty INTEGER NOT NULL DEFAULT 1, boost INTEGER NOT NULL DEFAULT 0,
     started_at REAL NOT NULL, ready_at REAL NOT NULL, state TEXT NOT NULL DEFAULT 'brewing', result TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_craft_jobs_user ON craft_jobs (user_id, state)`,
  `CREATE TABLE IF NOT EXISTS craft_cd (user_id TEXT NOT NULL, recipe_id TEXT NOT NULL, until REAL NOT NULL, PRIMARY KEY (user_id, recipe_id))`,
  `CREATE TABLE IF NOT EXISTS craft_log (
     id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL NOT NULL, user_id TEXT NOT NULL, prof_id TEXT NOT NULL, recipe_id TEXT NOT NULL, qty INTEGER, ok INTEGER, bad INTEGER, best_q INTEGER, note TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_craft_log_user ON craft_log (user_id, id)`,
  // Trang bị (mỗi món là 1 dòng riêng — có phẩm chất, cường hoá, tinh luyện, độ bền)
  `CREATE TABLE IF NOT EXISTS gear (
     gear_id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, tpl TEXT NOT NULL, q INTEGER NOT NULL DEFAULT 1, enh INTEGER NOT NULL DEFAULT 0, refine INTEGER NOT NULL DEFAULT 0,
     dura REAL NOT NULL DEFAULT 100, dura_max REAL NOT NULL DEFAULT 100, equipped INTEGER NOT NULL DEFAULT 0, locked INTEGER NOT NULL DEFAULT 0, sec TEXT NOT NULL DEFAULT '{}', created_at REAL)`,
  `CREATE INDEX IF NOT EXISTS idx_gear_user ON gear (user_id)`,
  // Hiệu ứng tạm thời: buff đan dược + trận pháp cá nhân (mỗi loại 1 dòng — dùng lại = làm mới, KHÔNG cộng dồn)
  `CREATE TABLE IF NOT EXISTS fx_buffs (
     user_id TEXT NOT NULL, key TEXT NOT NULL, fx TEXT NOT NULL, until REAL NOT NULL, charges INTEGER NOT NULL DEFAULT 0, q INTEGER NOT NULL DEFAULT 2, kind TEXT NOT NULL DEFAULT 'pill',
     PRIMARY KEY (user_id, key))`,
  // Linh Điền
  `CREATE TABLE IF NOT EXISTS linh_dien (user_id TEXT PRIMARY KEY, level INTEGER NOT NULL DEFAULT 1, created_at REAL)`,
  `CREATE TABLE IF NOT EXISTS linh_dien_plot (
     user_id TEXT NOT NULL, slot INTEGER NOT NULL, seed TEXT NOT NULL, planted_at REAL NOT NULL, ready_at REAL NOT NULL, total REAL NOT NULL DEFAULT 0, water INTEGER NOT NULL DEFAULT 0,
     last_water REAL NOT NULL DEFAULT 0, fert TEXT NOT NULL DEFAULT '', PRIMARY KEY (user_id, slot))`,
];
const ADD_COLUMNS_V17 = {
  cultivators: { fx17: "TEXT DEFAULT ''" },     // bộ nhớ đệm hiệu ứng V17 (trang bị + buff + trận) — tính lại mỗi khi đổi; không phải dữ liệu gốc
  sects: { tran_key: "TEXT DEFAULT ''", tran_until: 'REAL DEFAULT 0', tran_q: 'INTEGER DEFAULT 2' },
  trade_pending: { items_give: "TEXT DEFAULT ''", items_want: "TEXT DEFAULT ''" },
};
module.exports = { CREATE_V17, ADD_COLUMNS_V17 };
