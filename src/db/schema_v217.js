'use strict';
/** v21.7 — Khôi phục trận PvP + Sổ cái. Chỉ THÊM bảng. */
const CREATE_V217 = [
  // Ảnh chụp trạng thái 1 trận đang dở (ghi sau MỖI hiệp). Xoá khi trận chốt/huỷ. state = JSON (combat21.serialize).
  `CREATE TABLE IF NOT EXISTS v217_battle_state (battle_id TEXT PRIMARY KEY, a_id TEXT NOT NULL, b_id TEXT NOT NULL, round INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL, saved_at INTEGER NOT NULL)`,
  // Sổ cái tiền tệ (chỉ GHI THÊM). idem_key UNIQUE = khoá chống ghi/trừ đôi: cùng khoá chạy lần 2 → không đổi số dư.
  `CREATE TABLE IF NOT EXISTS ledger_entries (entry_id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'linh_thach', delta INTEGER NOT NULL, balance_after INTEGER NOT NULL, reason TEXT NOT NULL DEFAULT '', ref TEXT NOT NULL DEFAULT '', idem_key TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_idem ON ledger_entries (idem_key)`,
  `CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger_entries (user_id, entry_id)`,
];
module.exports = { CREATE_V217, V217_TABLES: ['v217_battle_state', 'ledger_entries'] };
