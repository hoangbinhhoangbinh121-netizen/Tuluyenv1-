'use strict';
/**
 * Lớp DB dùng chung — SQLite dạng file (data/tutien.db), ĐỒNG BỘ như bản Python cũ.
 * - Ưu tiên `better-sqlite3` (nhanh, ổn định, chạy tốt trên mọi hosting Node 18+).
 * - Nếu chưa cài được better-sqlite3 thì tự dùng `node:sqlite` có sẵn trong Node >= 22.5.
 * Một kết nối dùng chung toàn bot (SQLite ghi tuần tự nên không cần pool).
 */
const fs = require('node:fs');
const path = require('node:path');
const { CREATE_TABLES, ADD_COLUMNS } = require('./schema');
const { CREATE_V7 } = require('./schema_v7');

const DB_PATH = process.env.TULUYEN_DB_PATH
  ? path.resolve(process.env.TULUYEN_DB_PATH)
  : path.join(__dirname, '..', '..', 'data', 'tutien.db');

/**
 * ID Discord (snowflake) vượt 2^53 nên KHÔNG thể giữ bằng number của JS.
 * Quy ước: đọc INTEGER dưới dạng BigInt rồi đổi → number nếu an toàn, ngược lại → string
 * (đúng kiểu discord.js dùng cho ID). Truyền ID dạng string vào tham số SQL vẫn khớp cột INTEGER.
 */
const MAXS = BigInt(Number.MAX_SAFE_INTEGER);
const ID_COL = /(^|_)(id|ids)$|^guild|channel/;
function normVal(v, key) {
  if (typeof v === 'bigint') {
    if (v <= MAXS && v >= -MAXS) return Number(v);
    // Chỉ cột ID (snowflake) mới giữ dạng chuỗi; số liệu game quá lớn → Number để phép cộng/so sánh không bị nối chuỗi.
    return ID_COL.test(key || '') ? v.toString() : Number(v);
  }
  return v;
}
function normRow(r) {
  if (r === undefined || r === null) return undefined;
  const o = {};
  for (const k of Object.keys(r)) o[k] = normVal(r[k], k);
  return o;
}
const normParams = (p) => p.map((x) => (typeof x === 'boolean' ? (x ? 1 : 0) : x === undefined ? null : x));

let _db = null;
let _driver = '';

/** better-sqlite3: nhanh nhưng cần file biên dịch sẵn — trên một số host/Node mới (VD Node 24) có thể không tải được. */
function _openBetterSqlite() {
  const Database = require('better-sqlite3');
  const d = new Database(DB_PATH, { timeout: 10000 });
  _driver = 'better-sqlite3';
  return {
    exec: (sql) => d.exec(sql),
    prepare: (sql) => {
      const st = d.prepare(sql);
      if (st.reader) st.safeIntegers(true);
      return {
        get: (...p) => normRow(st.get(...normParams(p))),
        all: (...p) => st.all(...normParams(p)).map(normRow),
        run: (...p) => {
          const r = st.run(...normParams(p));
          return { changes: r.changes, lastInsertRowid: Number(r.lastInsertRowid) };
        },
      };
    },
    close: () => d.close(),
  };
}

/** node:sqlite có sẵn trong Node >= 22.5 — không cần cài/biên dịch gì. */
function _openNodeSqlite() {
  let DatabaseSync;
  try { ({ DatabaseSync } = require('node:sqlite')); }
  catch (e) {
    throw new Error(`Không mở được SQLite: better-sqlite3 không dùng được và Node ${process.version} chưa có node:sqlite (cần Node >= 22.5). Hãy nâng Node lên 22 trở lên. Chi tiết: ${e.message}`);
  }
  const d = new DatabaseSync(DB_PATH);
  d.exec('PRAGMA busy_timeout = 10000');
  _driver = 'node:sqlite';
  return {
    exec: (sql) => d.exec(sql),
    prepare: (sql) => {
      const st = d.prepare(sql);
      st.setReadBigInts(true);
      return {
        get: (...p) => normRow(st.get(...normParams(p))),
        all: (...p) => st.all(...normParams(p)).map(normRow),
        run: (...p) => {
          const r = st.run(...normParams(p));
          return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
        },
      };
    },
    close: () => d.close(),
  };
}

function _open() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const want = (process.env.TULUYEN_SQLITE_DRIVER || 'auto').trim().toLowerCase();
  if (want !== 'node') {
    try { return _openBetterSqlite(); }
    catch (e) {
      // Bất kỳ lỗi nào khi nạp better-sqlite3 (thiếu thư viện, thiếu file .node, sai phiên bản Node...) → dùng node:sqlite.
      if (want === 'better-sqlite3') throw e;
      const first = String(e && e.message || e).split('\n')[0].slice(0, 120);
      console.warn(`ℹ️ better-sqlite3 không dùng được (${first}) → chuyển sang SQLite có sẵn của Node (node:sqlite).`);
    }
  }
  return _openNodeSqlite();
}

function db() {
  if (!_db) _db = _open();
  return _db;
}

/** Tương đương conn.execute(...).fetchone() — trả undefined nếu không có dòng. */
const get = (sql, ...p) => db().prepare(sql).get(...p);
/** Tương đương conn.execute(...).fetchall() */
const all = (sql, ...p) => db().prepare(sql).all(...p);
/** Tương đương conn.execute(...) + commit — trả {changes, lastInsertRowid} (changes ≈ cur.rowcount). */
const run = (sql, ...p) => db().prepare(sql).run(...p);

/** Chạy fn trong 1 transaction (BEGIN IMMEDIATE ... COMMIT / ROLLBACK khi lỗi). */
function transaction(fn) {
  const d = db();
  d.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    d.exec('COMMIT');
    return r;
  } catch (e) {
    try { d.exec('ROLLBACK'); } catch (_) { /* bỏ qua */ }
    throw e;
  }
}

function initDb() {
  const d = db();
  d.exec('PRAGMA journal_mode=WAL');
  for (const sql of CREATE_TABLES) d.exec(sql);
  for (const sql of CREATE_V7) d.exec(sql);
  for (const [table, cols] of Object.entries(ADD_COLUMNS)) {
    const existing = new Set(all(`PRAGMA table_info(${table})`).map((r) => r.name));
    for (const [col, decl] of Object.entries(cols)) {
      if (existing.has(col)) continue;
      try {
        d.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`);
      } catch (e) {
        if (!/duplicate column/i.test(String(e.message))) {
          console.error(`❌ Migration lỗi khi thêm cột '${table}.${col}':`, e.message);
        }
      }
    }
  }
  return _driver;
}

function closeDb() {
  if (_db) { _db.close(); _db = null; }
}

module.exports = { DB_PATH, db, get, all, run, transaction, initDb, closeDb, driver: () => _driver };
