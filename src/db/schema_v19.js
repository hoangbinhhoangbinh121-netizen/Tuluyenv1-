'use strict';
/** Bảng mới của v19.0 (CREATE IF NOT EXISTS — an toàn khi mở DB cũ). Không đụng bảng/cột cũ. */
const CREATE_V19 = [
  // Bí Cảnh Tiên Giới: mỗi lần vào (solo hoặc tổ đội) = 1 dòng; state = JSON toàn bộ tiến trình → bot restart không mất.
  `CREATE TABLE IF NOT EXISTS bc19_runs (
     run_id INTEGER PRIMARY KEY AUTOINCREMENT, bc_idx INTEGER NOT NULL, leader TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'lobby',
     state TEXT NOT NULL DEFAULT '{}', channel_id TEXT, message_id TEXT, created_at REAL NOT NULL, updated_at REAL NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS bc19_members (run_id INTEGER NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (run_id, user_id))`,
  `CREATE INDEX IF NOT EXISTS idx_bc19_members_user ON bc19_members (user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_bc19_runs_status ON bc19_runs (status)`,
  // Tiến độ chinh phục từng bí cảnh + thành tựu khám phá
  `CREATE TABLE IF NOT EXISTS bc19_prog (
     user_id TEXT NOT NULL, bc_idx INTEGER NOT NULL, clears INTEGER NOT NULL DEFAULT 0, best_floor INTEGER NOT NULL DEFAULT 0, first_at REAL,
     ach TEXT NOT NULL DEFAULT '[]', PRIMARY KEY (user_id, bc_idx))`,
  // Chứng Đạo / Đế Đạo / Đế Binh / Đế Hiệu
  `CREATE TABLE IF NOT EXISTS de19_state (
     user_id TEXT PRIMARY KEY, kiep TEXT, fail_until REAL NOT NULL DEFAULT 0, injured_until REAL NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
     passed_at REAL, grand INTEGER NOT NULL DEFAULT 0, de_hieu TEXT, de_dao TEXT, de_dao_lv INTEGER NOT NULL DEFAULT 0, de_dao_awake INTEGER NOT NULL DEFAULT 0,
     binh TEXT NOT NULL DEFAULT '{}', binh_eq TEXT)`,
  `CREATE TABLE IF NOT EXISTS de19_history (id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL NOT NULL, user_id TEXT NOT NULL, kind TEXT NOT NULL, detail TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_de19_history_user ON de19_history (user_id, id)`,
  // Công Pháp Bản Mệnh (spec §4.5): mỗi người 1 quyển; exp lĩnh ngộ 0–100 cho mỗi mốc; thức tỉnh ở cấp 30/60/90
  `CREATE TABLE IF NOT EXISTS cp19_benmenh (user_id TEXT PRIMARY KEY, tier INTEGER, exp INTEGER NOT NULL DEFAULT 0, awaken INTEGER NOT NULL DEFAULT 0, changes INTEGER NOT NULL DEFAULT 0, changed_at REAL NOT NULL DEFAULT 0)`,
  // Sự kiện thế giới (spec §8): Thiên Địa Dị Biến / Vạn Cổ Truyền Thừa lưu ở đây; Đế Cảnh Xuất Thế / Siêu Thoát Chi Môn dùng bảng Boss Thế Giới (wb7_boss, tier 10/11)
  `CREATE TABLE IF NOT EXISTS ev19 (
     id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, guild_id TEXT, channel_id TEXT, message_id TEXT, status TEXT NOT NULL DEFAULT 'active',
     started_at REAL NOT NULL, ends_at REAL NOT NULL, data TEXT NOT NULL DEFAULT '{}')`,
  `CREATE INDEX IF NOT EXISTS idx_ev19_status ON ev19 (status, kind)`,
  `CREATE TABLE IF NOT EXISTS ev19_part (ev_id INTEGER NOT NULL, user_id TEXT NOT NULL, score REAL NOT NULL DEFAULT 0, joined_at REAL NOT NULL, PRIMARY KEY (ev_id, user_id))`,
  // Bảng thành tích Siêu Thoát Chi Môn (riêng, theo spec §8.4)
  `CREATE TABLE IF NOT EXISTS ev19_hall (user_id TEXT PRIMARY KEY, wins INTEGER NOT NULL DEFAULT 0, best_damage INTEGER NOT NULL DEFAULT 0, total_damage INTEGER NOT NULL DEFAULT 0, last_at REAL NOT NULL DEFAULT 0)`,
];
module.exports = { CREATE_V19 };
