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

/**
 * Tự cứu lỗi hạ tầng DB rồi thử lại ĐÚNG 1 lần:
 *  - "no such column / no such table" → chạy lại migrate (thêm cột/bảng còn thiếu),
 *  - SQLITE_FULL "database or disk is full" → dọn bản sao lưu/log thừa + thu gọn WAL.
 */
let _lastMigrate = 0;
function withRescue(fn) {
  try { return fn(); }
  catch (e) {
    const msg = String(e && e.message || e);
    if (/no such (column|table)/i.test(msg) && Date.now() - _lastMigrate > 30000) {
      _lastMigrate = Date.now();
      console.warn(`🛠️ DB thiếu cột/bảng (${msg}) → tự migrate lại rồi thử lại.`);
      try { migrate(); return fn(); } catch (e2) { throw e2; }
    }
    if (/database or disk is full|SQLITE_FULL/i.test(msg) || (e && e.code === 'SQLITE_FULL')) {
      let did = false;
      try { did = require('./diskguard').emergencyCleanup(); } catch (_) { /* bỏ qua */ }
      if (did) return fn();
    }
    throw e;
  }
}
/** Tương đương conn.execute(...).fetchone() — trả undefined nếu không có dòng. */
const get = (sql, ...p) => withRescue(() => db().prepare(sql).get(...p));
/** Tương đương conn.execute(...).fetchall() */
const all = (sql, ...p) => withRescue(() => db().prepare(sql).all(...p));
/** Tương đương conn.execute(...) + commit — trả {changes, lastInsertRowid} (changes ≈ cur.rowcount). */
const run = (sql, ...p) => withRescue(() => db().prepare(sql).run(...p));

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

/** Tạo bảng thiếu + thêm cột thiếu (an toàn chạy lại nhiều lần). */
function migrate() {
  const d = db();
  for (const sql of CREATE_TABLES) d.exec(sql);
  for (const sql of CREATE_V7) d.exec(sql);
  for (const [table, cols] of Object.entries(ADD_COLUMNS)) {
    const existing = new Set(d.prepare(`PRAGMA table_info(${table})`).all().map((r) => r.name));
    for (const [col, decl] of Object.entries(cols)) {
      if (existing.has(col)) continue;
      try {
        d.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`);
        console.log(`🧩 Migration: đã thêm cột ${table}.${col}`);
      } catch (e) {
        if (!/duplicate column/i.test(String(e.message))) {
          console.error(`❌ Migration lỗi khi thêm cột '${table}.${col}':`, e.message);
        }
      }
    }
  }
}

function initDb() {
  const d = db();
  d.exec('PRAGMA journal_mode=WAL');
  // File WAL không được phình mãi: tự gộp về DB sau ~200 trang và cắt file về tối đa 16 MB.
  try { d.exec('PRAGMA wal_autocheckpoint=200'); d.exec('PRAGMA journal_size_limit=16777216'); } catch (_) { /* bỏ qua */ }
  // File tạm của SQLite (sắp xếp, VACUUM...) giữ trong RAM — tránh SQLITE_FULL khi /tmp của host nhỏ/đầy. Bỏ giới hạn số trang nếu bị đặt nhầm.
  try { d.exec('PRAGMA temp_store=MEMORY'); d.exec('PRAGMA max_page_count=4294967294'); } catch (_) { /* bỏ qua */ }
  // Dọn trước khi migrate: nếu ổ đĩa đang đầy thì migration (ALTER TABLE) mới có chỗ ghi.
  try {
    const G = require('./diskguard');
    G.pruneBackups();
    console.log(G.fullReport());
  } catch (_) { /* bỏ qua */ }
  try { migrate(); }
  catch (e) {
    if (/database or disk is full|SQLITE_FULL/i.test(String(e.message)) || e.code === 'SQLITE_FULL') {
      try { require('./diskguard').emergencyCleanup(); } catch (_) { /* bỏ qua */ }
      migrate();
    } else throw e;
  }
  return _driver;
}

function closeDb() {
  if (_db) { _db.close(); _db = null; }
}

module.exports = { DB_PATH, db, get, all, run, transaction, initDb, migrate, closeDb, driver: () => _driver };
