'use strict';
/**
 * MIGRATION v17.x → v18.0 (29 cảnh giới: Đại La Kim Tiên → Siêu Thoát). KHÔNG đặt lại dữ liệu, KHÔNG xoá người chơi.
 *
 *  Vấn đề: trước v18.0 "Tiên Đế" là cảnh giới CUỐI (realm_index 14, không có tiểu cảnh giới → stage_index luôn 0).
 *          Từ v18.0 index 14 là "Chuẩn Tiên Vương"; Tiên Đế mới nằm ở index 19 với 4 tiểu cảnh giới.
 *  Chuyển đổi: realm_index 14 (stage 0)  →  realm_index 19 (Tiên Đế), stage_index 3 (Viên Mãn).
 *              Index 0–13 KHÔNG đụng tới. Tu vi, chỉ số, linh căn, thể chất, vật phẩm, công pháp, pháp bảo, linh thú… giữ nguyên 100%.
 *
 *  An toàn:
 *   1) SAO LƯU NHẤT QUÁN (VACUUM INTO) db_backups/tutien_PRE_V18_<thời gian>.db và KIỂM TRA bản sao (mở lại, đếm số người) TRƯỚC khi làm gì.
 *      Không sao lưu / kiểm tra bản sao được (kể cả nơi dự phòng) → KHÔNG chạy migration, trả { aborted: true } (bot.js dừng khởi động để khỏi chạy trên dữ liệu chưa chuyển).
 *   2) Toàn bộ chuyển đổi nằm trong MỘT transaction; đối chiếu trước/sau (mọi cột trừ realm_index/stage_index của người được chuyển phải y hệt,
 *      người ở cảnh giới 0–13 phải y hệt hoàn toàn). Lệch → ROLLBACK transaction, không đặt cờ.
 *   3) Cờ `v18_migrated` (chạy đúng 1 lần, chống chạy lặp). Danh sách user_id đã chuyển lưu trong cờ để rollback() đảo ngược chính xác.
 *   4) Nếu mất cờ nhưng dữ liệu đã ở dạng mới (có người ở cảnh giới ≥15 hoặc cảnh giới 14 với tiểu cảnh giới > 0) → coi như đã chuyển, chỉ đặt lại cờ, không đổi dữ liệu.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const D = require('../db');
const K = require('./constants');

const FLAG = 'v18_migrated';
const OLD_IDX = K.OLD_TIENDE_REALM_IDX;        // 14
const NEW_IDX = K.TIEN_DE_REALM_IDX;           // 19
const NEW_STAGE = K.totalStageCount(NEW_IDX) - 1;   // 3 = Viên Mãn

const stamp = () => { const n = new Date(); const p = (x) => String(x).padStart(2, '0'); return `${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}_${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`; };
const flagGet = () => { try { return D.get('SELECT value FROM bot_flags WHERE key = ?', FLAG); } catch (_) { return null; } };
const cnt = (sql, ...a) => { try { const r = D.get(sql, ...a); return Number((r && Object.values(r)[0]) || 0); } catch (_) { return 0; } };

/** Sao lưu vào `dir`, rồi mở lại bản sao để kiểm tra (đủ số người chơi). Trả đường dẫn hoặc ném lỗi. */
function backupTo(dir, expectPlayers) {
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `tutien_PRE_V18_${stamp()}.db`);
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  D.db().exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  if (!fs.existsSync(dest) || fs.statSync(dest).size < 1) throw new Error('file sao lưu rỗng / không tồn tại');
  D.run(`ATTACH DATABASE '${dest.replace(/'/g, "''")}' AS bk18`);
  try {
    const n = cnt('SELECT COUNT(*) FROM bk18.cultivators');
    if (n !== expectPlayers) throw new Error(`bản sao có ${n} người chơi, dữ liệu gốc có ${expectPlayers}`);
  } finally { try { D.run('DETACH DATABASE bk18'); } catch (_) { /* bỏ qua */ } }
  return dest;
}
/** Sao lưu có kiểm tra: ưu tiên thư mục db_backups cạnh DB, dự phòng thư mục tạm của hệ điều hành. */
function backup(expectPlayers) {
  const errs = [];
  for (const dir of [path.join(path.dirname(D.DB_PATH), 'db_backups'), path.join(os.tmpdir(), 'tiengioi_db_backups')]) {
    try { return { path: backupTo(dir, expectPlayers), errs }; } catch (e) { errs.push(`${dir}: ${e.message}`); }
  }
  return { path: null, errs };
}

const rowKey = (r, skipRealm) => { const o = { ...r }; if (skipRealm) { delete o.realm_index; delete o.stage_index; } return JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]])); };
const hash = (arr) => crypto.createHash('sha256').update(arr.join('\n')).digest('hex');

/** Ảnh chụp để đối chiếu: băm mọi hàng (trừ realm/stage của người được chuyển), băm riêng nhóm cảnh giới 0–13, tổng tu vi/linh thạch... */
function snapshot() {
  const rows = D.all('SELECT * FROM cultivators ORDER BY user_id');
  const moved = rows.filter((r) => r.realm_index === OLD_IDX);
  return {
    players: rows.length, moved: moved.map((r) => r.user_id),
    low: rows.filter((r) => r.realm_index < OLD_IDX).length,
    lowHash: hash(rows.filter((r) => r.realm_index < OLD_IDX).map((r) => rowKey(r, false))),
    restHash: hash(rows.filter((r) => r.realm_index >= OLD_IDX).map((r) => rowKey(r, true))),   // mọi cột trừ realm/stage
    tu_vi: cnt('SELECT COALESCE(SUM(tu_vi),0) FROM cultivators'), linh_thach: cnt('SELECT COALESCE(SUM(linh_thach),0) FROM cultivators'),
    atk: cnt('SELECT COALESCE(SUM(atk),0) FROM cultivators'), hp: cnt('SELECT COALESCE(SUM(hp),0) FROM cultivators'),
    pets: cnt("SELECT COUNT(*) FROM sqlite_master WHERE name='pets'") ? cnt('SELECT COUNT(*) FROM pets') : 0,
  };
}
function diff(a, b, expectMoved) {
  const out = [];
  for (const k of ['players', 'low', 'lowHash', 'restHash', 'tu_vi', 'linh_thach', 'atk', 'hp', 'pets']) if (a[k] !== b[k]) out.push(`${k}: ${a[k]} → ${b[k]}`);
  const nowNew = D.all('SELECT user_id FROM cultivators WHERE realm_index = ? AND stage_index = ?', NEW_IDX, NEW_STAGE).map((r) => r.user_id);
  const miss = a.moved.filter((id) => !nowNew.includes(id));
  if (miss.length) out.push(`người chưa sang Tiên Đế mới: ${miss.length}`);
  if (D.all('SELECT user_id FROM cultivators WHERE realm_index = ?', OLD_IDX).length) out.push('vẫn còn người ở cảnh giới 14 sau khi chuyển');
  if (expectMoved !== undefined && a.moved.length !== expectMoved) out.push(`số người cần chuyển ${a.moved.length} ≠ ${expectMoved}`);
  return out;
}

/** Dữ liệu đã ở dạng v18 (mất cờ nhưng đã chuyển rồi)? */
const looksMigrated = () => cnt('SELECT COUNT(*) FROM cultivators WHERE realm_index > ? OR (realm_index = ? AND stage_index > 0)', OLD_IDX, OLD_IDX) > 0;

function run({ force = false } = {}) {
  D.run('CREATE TABLE IF NOT EXISTS bot_flags (key TEXT PRIMARY KEY, value TEXT)');
  if (!force && flagGet()) return { skipped: true };
  const at = Math.floor(Date.now() / 1000);
  const before = snapshot();
  if (!force && looksMigrated()) {
    const info = { at, assumed: true, backup: null, moved: 0, movedIds: [], ok: true, note: 'Dữ liệu đã ở dạng v18 (mất cờ) — chỉ đặt lại cờ, không đổi dữ liệu.' };
    D.run('INSERT OR REPLACE INTO bot_flags (key, value) VALUES (?, ?)', FLAG, JSON.stringify(info));
    return { skipped: false, ...info };
  }
  const bk = backup(before.players);
  if (!bk.path) {
    const msg = `🚨 MIGRATION V18 BỊ HUỶ: không sao lưu/kiểm tra được bản sao → KHÔNG đổi dữ liệu. Lỗi: ${bk.errs.join(' | ')}`;
    console.error(msg);
    return { skipped: false, aborted: true, ok: false, backup: null, error: msg, moved: 0 };
  }
  let bad = [];
  try {
    D.transaction(() => {
      if (before.moved.length) D.run(`UPDATE cultivators SET realm_index = ?, stage_index = ? WHERE realm_index = ?`, NEW_IDX, NEW_STAGE, OLD_IDX);
      const after = snapshot();
      bad = diff(before, after, before.moved.length);
      if (bad.length) throw new Error(`đối chiếu lệch: ${bad.slice(0, 8).join(' | ')}`);
    });
  } catch (e) {
    const msg = `🚨 MIGRATION V18 THẤT BẠI & ĐÃ ROLLBACK (dữ liệu giữ nguyên như cũ, chưa đặt cờ): ${e.message}. Bản sao lưu: ${bk.path}`;
    console.error(msg);
    return { skipped: false, aborted: true, ok: false, backup: bk.path, error: msg, moved: 0 };
  }
  const info = { at, backup: bk.path, backupWarnings: bk.errs, moved: before.moved.length, movedIds: before.moved, players: before.players, ok: true, from: `${OLD_IDX}/0`, to: `${NEW_IDX}/${NEW_STAGE}` };
  D.run('INSERT OR REPLACE INTO bot_flags (key, value) VALUES (?, ?)', FLAG, JSON.stringify(info));
  return { skipped: false, ...info };
}
function status() { const f = flagGet(); if (!f) return null; try { return JSON.parse(f.value); } catch (_) { return null; } }

/**
 * Rollback: đưa những người ĐÃ chuyển (còn đứng ở Tiên Đế Viên Mãn) về Tiên Đế cũ (14/0) rồi gỡ cờ. KHÔNG dùng khi đã chạy bản v18 một thời gian
 * (người đã đột phá tiếp thì không đảo ngược được — hãy /restoredb từ bản sao lưu PRE_V18). Trả về danh sách người không thể đảo ngược.
 */
function rollback() {
  const st = status(); const ids = (st && st.movedIds) || []; let reverted = 0; const stuck = [];
  D.transaction(() => {
    for (const id of ids) {
      const ch = D.run('UPDATE cultivators SET realm_index = ?, stage_index = 0 WHERE user_id = ? AND realm_index = ? AND stage_index = ?', OLD_IDX, id, NEW_IDX, NEW_STAGE).changes;
      if (ch) reverted += 1; else stuck.push(id);
    }
    D.run('DELETE FROM bot_flags WHERE key = ?', FLAG);
  });
  return { reverted, stuck, backup: st && st.backup };
}
function reportText() {
  const st = status();
  return st ? `MIGRATION V18: ${st.assumed ? 'dữ liệu đã ở dạng v18' : `đã chạy ${new Date(st.at * 1000).toISOString()} · chuyển ${st.moved} người Tiên Đế cũ (14) → Tiên Đế (19) Viên Mãn`} · ${st.ok ? 'đối chiếu KHỚP' : 'LỖI'} · sao lưu ${st.backup || '—'}` : 'MIGRATION V18: CHƯA chạy';
}
module.exports = { run, rollback, status, snapshot, diff, backup, reportText, FLAG, OLD_IDX, NEW_IDX, NEW_STAGE };
