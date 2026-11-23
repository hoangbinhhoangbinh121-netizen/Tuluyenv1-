'use strict';
/** v21.3 — nhật ký trận PvP (kể cả hòa/huỷ) + khoá chốt trận 1 lần. Chỉ THÊM bảng; không đụng pvp_history cũ. */
const CREATE_V213 = [
  // status: active → done | aborted. result: A | B | draw | aborted. Chốt trận = UPDATE ... WHERE status='active' (đúng 1 lần).
  `CREATE TABLE IF NOT EXISTS v213_battles (id TEXT PRIMARY KEY, a_id TEXT NOT NULL, b_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', result TEXT NOT NULL DEFAULT '', reason TEXT NOT NULL DEFAULT '', rounds INTEGER NOT NULL DEFAULT 0, stake INTEGER NOT NULL DEFAULT 0, mode TEXT NOT NULL DEFAULT 'duel', channel_id TEXT NOT NULL DEFAULT '', message_id TEXT NOT NULL DEFAULT '', snap TEXT NOT NULL DEFAULT '', summary TEXT NOT NULL DEFAULT '', log TEXT NOT NULL DEFAULT '', started_at REAL NOT NULL DEFAULT 0, ended_at REAL NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS idx_v213_battles_a ON v213_battles (a_id, ended_at)`,
  `CREATE INDEX IF NOT EXISTS idx_v213_battles_b ON v213_battles (b_id, ended_at)`,
  `CREATE INDEX IF NOT EXISTS idx_v213_battles_status ON v213_battles (status)`,
];
const V213_TABLES = ['v213_battles'];
module.exports = { CREATE_V213, V213_TABLES };
