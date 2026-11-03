'use strict';
/**
 * Chống đầy đĩa (SQLITE_FULL "database or disk is full"):
 *  - báo cáo dung lượng DB / WAL / backup / log / ổ đĩa trống,
 *  - dọn bản sao lưu cũ theo số lượng + tổng dung lượng,
 *  - dọn khẩn cấp (xoá backup thừa, log cũ, thu gọn file WAL) rồi cho lệnh ghi thử lại.
 * Dùng `require('./index')` kiểu lười để tránh vòng lặp import.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : d; };
const KEEP_AUTO = () => num(process.env.AUTO_BACKUP_KEEP, 1);      // mặc định chỉ giữ bản MỚI NHẤT
const KEEP_MANUAL = () => num(process.env.BACKUP_KEEP_MANUAL, 1);
const KEEP_PRE = () => num(process.env.BACKUP_KEEP_PRE, 1);
const MAX_TOTAL_MB = () => num(process.env.BACKUP_MAX_MB, 200);

const D = () => require('./index');
const backupDir = () => path.join(path.dirname(D().DB_PATH), 'db_backups');
const logDir = () => path.join(__dirname, '..', '..', 'logs');
const size = (p) => { try { return fs.statSync(p).size; } catch (_) { return 0; } };
const mtime = (p) => { try { return fs.statSync(p).mtimeMs; } catch (_) { return 0; } };
const fmt = (b) => (b >= 1073741824 ? `${(b / 1073741824).toFixed(2)} GB` : b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(1)} KB`);

function listFiles(dir) {
  try { return fs.readdirSync(dir).map((f) => path.join(dir, f)).filter((p) => { try { return fs.statSync(p).isFile(); } catch (_) { return false; } }); }
  catch (_) { return []; }
}
function dirSize(dir) { return listFiles(dir).reduce((s, p) => s + size(p), 0); }

/** Dung lượng ổ đĩa còn trống (byte) — null nếu hệ điều hành/host không cho đọc. */
function freeBytes() {
  try { const s = fs.statfsSync(path.dirname(D().DB_PATH)); return Number(s.bavail) * Number(s.bsize); }
  catch (_) { return null; }
}

function report() {
  const p = D().DB_PATH;
  const free = freeBytes();
  const bk = dirSize(backupDir());
  return {
    db: size(p), wal: size(`${p}-wal`), shm: size(`${p}-shm`),
    backups: bk, backupCount: listFiles(backupDir()).length,
    logs: dirSize(logDir()), free,
    text: `🗄️ DB ${fmt(size(p))} · WAL ${fmt(size(`${p}-wal`))} · backup ${fmt(bk)} (${listFiles(backupDir()).length} file) · log ${fmt(dirSize(logDir()))} · ổ đĩa trống ${free == null ? 'không rõ' : fmt(free)}`,
  };
}

/** Xoá bản sao lưu thừa. aggressive=true: chỉ giữ 1 bản mỗi loại. Trả về số byte giải phóng. */
function pruneBackups({ aggressive = false } = {}) {
  const dir = backupDir();
  const files = listFiles(dir).filter((p) => p.endsWith('.db'));
  const byAge = (a, b) => mtime(b) - mtime(a);
  let freed = 0;
  const drop = (p) => { const s = size(p); try { fs.unlinkSync(p); freed += s; } catch (_) { /* bỏ qua */ } };

  // file tạm bị bỏ dở (upload/import) → xoá hết
  for (const p of files.filter((f) => /^_(upload|import)_/.test(path.basename(f)))) drop(p);

  const groups = [
    [/^tutien_auto_/, aggressive ? 1 : KEEP_AUTO()],
    [/^tutien_PRE_/, aggressive ? 1 : KEEP_PRE()],
    [/^tutien_\d{8}_/, aggressive ? 1 : KEEP_MANUAL()],
  ];
  for (const [re, keep] of groups) {
    const g = files.filter((f) => re.test(path.basename(f)) && fs.existsSync(f)).sort(byAge);
    for (const old of g.slice(keep)) drop(old);
  }
  // vẫn quá tổng dung lượng cho phép → xoá bản cũ nhất cho tới khi vừa (luôn giữ bản mới nhất)
  const cap = (aggressive ? 50 : MAX_TOTAL_MB()) * 1048576;
  const rest = listFiles(dir).filter((p) => p.endsWith('.db')).sort(byAge);
  let total = rest.reduce((s, p) => s + size(p), 0);
  for (let i = rest.length - 1; i > 0 && total > cap; i--) { total -= size(rest[i]); drop(rest[i]); }
  return freed;
}

/** Đủ chỗ để tạo thêm 1 bản sao lưu (cần ~2× kích thước DB + 50 MB đệm)? */
function canBackup() {
  const free = freeBytes();
  if (free == null) return true;
  return free > (size(D().DB_PATH) + size(`${D().DB_PATH}-wal`)) * 2 + 50 * 1048576;
}

/** Các file/thư mục chiếm nhiều chỗ nhất trong thư mục bot (quét tối đa ~30.000 file, bỏ qua symlink). */
function topFiles(n = 8) {
  const root = path.join(__dirname, '..', '..');
  const out = []; let seen = 0;
  const walk = (d, depth) => {
    if (depth > 8 || seen > 30000) return 0;
    let total = 0;
    let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return 0; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) total += walk(p, depth + 1);
      else if (e.isFile()) { seen++; const s = size(p); total += s; out.push({ p, s }); }
    }
    return total;
  };
  walk(root, 0);
  return out.sort((a, b) => b.s - a.s).slice(0, n).map((x) => ({ file: path.relative(root, x.p), bytes: x.s }));
}

/** Thử GHI THẬT 1 MB vào thư mục DB và thư mục tạm → biết ổ đĩa có thật sự đầy/bị giới hạn hay không. */
function probe() {
  const res = [];
  const test = (label, dir) => {
    const f = path.join(dir, `.writetest_${process.pid}`);
    try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(f, Buffer.alloc(1048576, 1)); res.push(`${label}: ghi 1 MB OK`); }
    catch (e) { res.push(`${label}: GHI LỖI ${e.code || ''} ${String(e.message).slice(0, 60)}`); }
    finally { try { fs.unlinkSync(f); } catch (_) { /* bỏ qua */ } }
  };
  test('thư mục DB', path.dirname(D().DB_PATH));
  test('thư mục tạm', os.tmpdir());
  return res;
}

/** Thông số nội bộ của SQLite: số trang, trang trống, giới hạn trang. */
function pageStats() {
  try {
    const d = D();
    const pc = Number(d.get('PRAGMA page_count').page_count); const ps = Number(d.get('PRAGMA page_size').page_size);
    const fl = Number(d.get('PRAGMA freelist_count').freelist_count); const mx = Number(d.get('PRAGMA max_page_count').max_page_count);
    return `SQLite: ${pc} trang × ${ps} B (trang trống ${fl}) · giới hạn ${mx} trang (~${fmt(mx * ps)})`;
  } catch (e) { return `SQLite: không đọc được thông số (${e.message})`; }
}

/** Báo cáo đầy đủ để dán vào console / Discord. */
function fullReport() {
  const lines = [report().text, pageStats(), ...probe()];
  const top = topFiles(6).map((t) => `  • ${t.file} — ${fmt(t.bytes)}`);
  if (top.length) lines.push('File lớn nhất:', ...top);
  return lines.join('\n');
}

let lastEmergency = 0;
/** Dọn khẩn cấp khi gặp SQLITE_FULL. Trả về true nếu có làm gì đó (đáng để thử ghi lại). */
function emergencyCleanup() {
  if (Date.now() - lastEmergency < 30000) return false;   // chống lặp liên tục
  lastEmergency = Date.now();
  const before = report();
  let freed = pruneBackups({ aggressive: true });
  for (const p of listFiles(logDir())) {
    if (p.endsWith('.old')) { freed += size(p); try { fs.unlinkSync(p); } catch (_) { /* bỏ qua */ } }
    else if (size(p) > 512 * 1024) { freed += size(p); try { fs.truncateSync(p, 0); } catch (_) { /* bỏ qua */ } }
  }
  try { D().db().exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (_) { /* đang bận thì thôi */ }
  console.warn(`🧹 SQLITE_FULL → dọn khẩn cấp, giải phóng ~${fmt(freed)}. Trước khi dọn: ${before.text}`);
  console.warn(`   Sau khi dọn: ${report().text}`);
  return true;
}

module.exports = { report, fullReport, probe, topFiles, pageStats, pruneBackups, emergencyCleanup, canBackup, freeBytes, fmt, backupDir };
