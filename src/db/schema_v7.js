'use strict';
/** Bảng mới của v7 (CREATE IF NOT EXISTS — an toàn khi mở DB cũ). ID Discord lưu TEXT để không mất chính xác. */
const CREATE_V7 = [
  `CREATE TABLE IF NOT EXISTS v7_settings (
     guild_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT,
     PRIMARY KEY (guild_id, key))`,
  // Boss Thế Giới v7: mỗi server tối đa 1 boss đang sống (status='alive'); lịch sử giữ lại để xem.
  `CREATE TABLE IF NOT EXISTS wb7_boss (
     boss_id INTEGER PRIMARY KEY AUTOINCREMENT,
     guild_id TEXT NOT NULL, channel_id TEXT, message_id TEXT,
     name TEXT NOT NULL, tier INTEGER NOT NULL, realm_name TEXT,
     hp REAL NOT NULL, max_hp REAL NOT NULL,
     status TEXT NOT NULL DEFAULT 'alive',
     spawned_at REAL NOT NULL, expires_at REAL NOT NULL, ended_at REAL,
     summoned_by TEXT, killer_id TEXT)`,
  `CREATE TABLE IF NOT EXISTS wb7_damage (
     boss_id INTEGER NOT NULL, user_id TEXT NOT NULL,
     damage REAL NOT NULL DEFAULT 0, hits INTEGER NOT NULL DEFAULT 0, last_hit REAL DEFAULT 0,
     PRIMARY KEY (boss_id, user_id))`,
  'CREATE INDEX IF NOT EXISTS wb7_boss_alive ON wb7_boss (guild_id, status)',
];
module.exports = { CREATE_V7 };
