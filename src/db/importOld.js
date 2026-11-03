'use strict';
/**
 * Nhập dữ liệu từ 1 file .db cũ VÀO database đang chạy (không cần dừng/khởi động lại bot).
 *  - chedo 'ghep'   : dòng cũ ĐÈ lên dòng cùng khoá trong DB hiện tại; dòng chỉ có ở DB hiện tại được giữ.
 *  - chedo 'bosung' : chỉ THÊM dòng chưa có (dòng đang có trong DB hiện tại luôn được giữ).
 * Chỉ nhập các cột có ở cả hai bên; cột mới (chỉ có ở DB hiện tại) giữ giá trị mặc định.
 * Bảng của boss v7 (wb7_*) và v7_settings không bị đụng tới.
 */
const fs = require('node:fs');
const D = require('./index');

const SKIP = /^(sqlite_|wb7_|v7_)/;
const q = (n) => `"${String(n).replace(/"/g, '""')}"`;

function mergeOldDb(srcPath, mode = 'ghep') {
  const verb = mode === 'bosung' ? 'INSERT OR IGNORE' : 'INSERT OR REPLACE';
  const db = D.db();
  const quoted = srcPath.replace(/'/g, "''");
  db.exec(`ATTACH DATABASE '${quoted}' AS old`);
  const report = { tables: [], rows: 0, failed: [], skipped: [] };
  try {
    const oldTables = D.all("SELECT name FROM old.sqlite_master WHERE type='table'").map((r) => r.name);
    const mainTables = new Set(D.all("SELECT name FROM main.sqlite_master WHERE type='table'").map((r) => r.name));
    D.transaction(() => {
      for (const t of oldTables) {
        if (SKIP.test(t)) continue;
        if (!mainTables.has(t)) { report.skipped.push(t); continue; }
        const oc = new Set(D.all(`PRAGMA old.table_info(${q(t)})`).map((c) => c.name));
        const cols = D.all(`PRAGMA main.table_info(${q(t)})`).map((c) => c.name).filter((c) => oc.has(c));
        if (!cols.length) { report.skipped.push(t); continue; }
        const list = cols.map(q).join(',');
        try {
          db.exec('SAVEPOINT imp');
          const before = D.get(`SELECT COUNT(*) c FROM main.${q(t)}`).c;
          db.exec(`${verb} INTO main.${q(t)} (${list}) SELECT ${list} FROM old.${q(t)}`);
          db.exec('RELEASE imp');
          const after = D.get(`SELECT COUNT(*) c FROM main.${q(t)}`).c;
          const n = D.get(`SELECT COUNT(*) c FROM old.${q(t)}`).c;
          report.tables.push({ name: t, rows: n, added: after - before });
          report.rows += n;
        } catch (e) {
          try { db.exec('ROLLBACK TO imp'); db.exec('RELEASE imp'); } catch (_) { /* bỏ qua */ }
          report.failed.push(`${t}: ${e.message}`);
        }
      }
    });
  } finally {
    try { db.exec('DETACH DATABASE old'); } catch (_) { /* bỏ qua */ }
  }
  return report;
}

const isSqlite = (buf) => buf.length >= 16 && buf.subarray(0, 16).toString('latin1') === 'SQLite format 3\u0000';
module.exports = { mergeOldDb, isSqlite };
