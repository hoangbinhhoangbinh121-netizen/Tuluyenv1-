'use strict';
/** v22.2 — Ẩn / xoá người chơi khỏi bảng xếp hạng. Chỉ THÊM bảng. */
const CREATE_V221 = [
  // mode: 'an' (ẩn, giữ dữ liệu) | 'xoa' (ẩn + gỡ điểm xếp hạng đã lưu, có bản sao để khôi phục)
  `CREATE TABLE IF NOT EXISTS lb_hidden (user_id TEXT PRIMARY KEY, mode TEXT NOT NULL DEFAULT 'an', reason TEXT NOT NULL DEFAULT '', by_id TEXT NOT NULL DEFAULT '', ts INTEGER NOT NULL DEFAULT 0)`,
  // bản sao các dòng điểm xếp hạng bị gỡ khi 'xoa' (row_json) — khôi phục bằng !bxh hien
  `CREATE TABLE IF NOT EXISTS lb_removed (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, tbl TEXT NOT NULL, row_json TEXT NOT NULL, ts INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS idx_lb_removed_user ON lb_removed (user_id)`,
];
module.exports = { CREATE_V221 };
