'use strict';
/**
 * MIGRATION v19.x → v20.0 (Đại Hoàn Thiện Nghề Nghiệp). THUẦN CỘNG THÊM: chỉ tạo 7 bảng `v20_*` (đã tạo ở initDb bằng IF NOT EXISTS) — KHÔNG sửa/xoá dữ liệu cũ.
 * Vẫn làm đủ quy trình an toàn như V18:
 *  1) SAO LƯU NHẤT QUÁN (VACUUM INTO) db_backups/tutien_PRE_V20_<thời gian>.db và mở lại kiểm tra (đủ số người chơi) TRƯỚC khi đặt cờ. Không sao lưu được → không đặt cờ, trả { aborted: true }
 *     (bot KHÔNG dừng — V20 chỉ thêm bảng nên an toàn chạy tiếp; chỉ cảnh báo).
 *  2) Đối chiếu băm dữ liệu cũ (cultivators, inv_items, prof_state, inv_log) trước/sau: lệch → báo lỗi, không đặt cờ.
 *  3) Cờ `v20_migrated` (chạy 1 lần). rollback() chỉ XOÁ dữ liệu 7 bảng v20_* và gỡ cờ; dữ liệu V17–V19 không bao giờ bị đụng. (Vật phẩm V20 đã nhận vẫn nằm trong inv_items — vô hại, chỉ là vật phẩm
 *     không còn nguồn mới; muốn dọn sạch hãy /restoredb từ bản PRE_V20.)
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const D = require('../db');
const { CREATE_V20, V20_TABLES } = require('../db/schema_v20');

const FLAG = 'v20_migrated';
const stamp = () => { const n = new Date(); const p = (x) => String(x).padStart(2, '0'); return `${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}_${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`; };
const flagGet = () => { try { return D.get('SELECT value FROM bot_flags WHERE key = ?', FLAG); } catch (_) { return null; } };
const cnt = (sql, ...a) => { try { const r = D.get(sql, ...a); return Number((r && Object.values(r)[0]) || 0); } catch (_) { return 0; } };
const hashTable = (t) => { const h = crypto.createHash('sha256'); try { for (const r of D.all(`SELECT * FROM ${t}`)) h.update(JSON.stringify(Object.keys(r).sort().map((k) => [k, r[k]]))); } catch (_) { h.update('∅'); } return h.digest('hex'); };
const WATCH = ['cultivators', 'inv_items', 'prof_state', 'inv_log', 'inv_lock', 'inv_daily'];
const snapshot = () => ({ players: cnt('SELECT COUNT(*) FROM cultivators'), hashes: Object.fromEntries(WATCH.map((t) => [t, hashTable(t)])) });
const diff = (a, b) => { const out = []; if (a.players !== b.players) out.push(`players: ${a.players} → ${b.players}`); for (const t of WATCH) if (a.hashes[t] !== b.hashes[t]) out.push(`bảng ${t} bị đổi`); return out; };

function backupTo(dir, expectPlayers) {
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `tutien_PRE_V20_${stamp()}.db`);
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  D.db().exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  if (!fs.existsSync(dest) || fs.statSync(dest).size < 1) throw new Error('file sao lưu rỗng / không tồn tại');
  D.run(`ATTACH DATABASE '${dest.replace(/'/g, "''")}' AS bk20`);
  try { const n = cnt('SELECT COUNT(*) FROM bk20.cultivators'); if (n !== expectPlayers) throw new Error(`bản sao có ${n} người chơi, dữ liệu gốc có ${expectPlayers}`); }
  finally { try { D.run('DETACH DATABASE bk20'); } catch (_) { /* bỏ qua */ } }
  return dest;
}
function backup(expectPlayers) {
  const errs = [];
  for (const dir of [path.join(path.dirname(D.DB_PATH), 'db_backups'), path.join(os.tmpdir(), 'tiengioi_db_backups')]) {
    try { return { path: backupTo(dir, expectPlayers), errs }; } catch (e) { errs.push(`${dir}: ${e.message}`); }
  }
  return { path: null, errs };
}
function run({ force = false } = {}) {
  D.run('CREATE TABLE IF NOT EXISTS bot_flags (key TEXT PRIMARY KEY, value TEXT)');
  if (!force && flagGet()) return { skipped: true };
  const at = Math.floor(Date.now() / 1000); const before = snapshot();
  const bk = backup(before.players);
  if (!bk.path) { const msg = `⚠️ MIGRATION V20: không sao lưu được (${bk.errs.join(' | ')}) — chưa đặt cờ; V20 chỉ thêm bảng mới nên bot vẫn chạy.`; console.error(msg); return { skipped: false, aborted: true, ok: false, backup: null, error: msg }; }
  try { D.transaction(() => { for (const sql of CREATE_V20) D.run(sql); }); } catch (e) { const msg = `⚠️ MIGRATION V20: tạo bảng lỗi — ${e.message}`; console.error(msg); return { skipped: false, aborted: true, ok: false, backup: bk.path, error: msg }; }
  const bad = diff(before, snapshot());
  const missing = V20_TABLES.filter((t) => !cnt("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name = ?", t));
  if (bad.length || missing.length) { const msg = `🚨 MIGRATION V20: đối chiếu lệch (${[...bad, ...missing.map((t) => `thiếu bảng ${t}`)].join(' | ')}). Bản sao: ${bk.path}`; console.error(msg); return { skipped: false, aborted: true, ok: false, backup: bk.path, error: msg }; }
  const info = { at, backup: bk.path, backupWarnings: bk.errs, players: before.players, tables: V20_TABLES, ok: true };
  D.run('INSERT OR REPLACE INTO bot_flags (key, value) VALUES (?, ?)', FLAG, JSON.stringify(info));
  return { skipped: false, ...info };
}
function status() { const f = flagGet(); if (!f) return null; try { return JSON.parse(f.value); } catch (_) { return null; } }
/** Rollback: xoá DỮ LIỆU các bảng v20_* (giữ bảng rỗng) + gỡ cờ. Không đụng dữ liệu V17–V19. */
function rollback() { const st = status(); let cleared = 0; D.transaction(() => { for (const t of V20_TABLES) cleared += D.run(`DELETE FROM ${t}`).changes; D.run('DELETE FROM bot_flags WHERE key = ?', FLAG); }); return { cleared, backup: st && st.backup }; }
const reportText = () => { const st = status(); return st ? `MIGRATION V20: đã chạy ${new Date(st.at * 1000).toISOString()} · ${st.players} người chơi giữ nguyên · ${st.tables.length} bảng mới · sao lưu ${st.backup}` : 'MIGRATION V20: chưa chạy'; };
module.exports = { run, rollback, status, snapshot, diff, backup, reportText, FLAG };
