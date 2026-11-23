'use strict';
/** v21.5 — Chủng Tộc. Chỉ THÊM bảng (không đụng dữ liệu cũ). Người chơi chưa chọn tộc = không có hàng race_state → mọi chỉ số y hệt V21.4. */
const CREATE_V215 = [
  // version: khoá lạc quan (mỗi lần ghi +1; UPDATE ... WHERE version = ?). evolved: 0/1. state_json: dành cho kỹ năng chủng tộc (V21.6, có schema_ver).
  `CREATE TABLE IF NOT EXISTS race_state (user_id TEXT PRIMARY KEY, race_id TEXT NOT NULL, bloodline_id TEXT NOT NULL DEFAULT '', bloodline_level INTEGER NOT NULL DEFAULT 0, awakening_stage INTEGER NOT NULL DEFAULT 0, bloodline_exp INTEGER NOT NULL DEFAULT 0, evolved INTEGER NOT NULL DEFAULT 0, state_json TEXT NOT NULL DEFAULT '{}', schema_ver INTEGER NOT NULL DEFAULT 1, version INTEGER NOT NULL DEFAULT 1, chosen_at REAL NOT NULL DEFAULT 0, changed_at REAL NOT NULL DEFAULT 0, created_at REAL NOT NULL DEFAULT 0, updated_at REAL NOT NULL DEFAULT 0)`,
  // event_type: choose | change | awaken | bloodline_pick | bloodline_up | evolve. cost = Linh Thạch đã trừ (ledger_ref dành cho EconomyEngine V21.7).
  `CREATE TABLE IF NOT EXISTS race_history (event_id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, event_type TEXT NOT NULL, from_state TEXT NOT NULL DEFAULT '', to_state TEXT NOT NULL DEFAULT '', cost INTEGER NOT NULL DEFAULT 0, ledger_ref TEXT NOT NULL DEFAULT '', created_at REAL NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS idx_race_history_user ON race_history (user_id, event_id)`,
  `CREATE INDEX IF NOT EXISTS idx_race_state_race ON race_state (race_id)`,
];
const V215_TABLES = ['race_state', 'race_history'];
module.exports = { CREATE_V215, V215_TABLES };
