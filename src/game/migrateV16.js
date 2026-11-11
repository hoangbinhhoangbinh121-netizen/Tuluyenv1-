'use strict';
/**
 * MIGRATION v15 → v16 (Công Pháp). KHÔNG đặt lại người chơi.
 *  1) Sao lưu NHẤT QUÁN (VACUUM INTO) vào db_backups/tutien_PRE_V16_<thời gian>.db TRƯỚC khi đụng dữ liệu.
 *  2) Bảng mới `congphap_fragments` / `bot_flags` do schema tạo (CREATE TABLE IF NOT EXISTS) — công pháp mới dùng chính các cột cũ
 *     (cong_phap_owned / cong_phap_slots / cong_phap_levels / cong_phap_bonus / cong_phap_pvp_buff / cong_phap_pvp_debuff) nên không đổi schema người chơi.
 *  3) Chuẩn hoá trang bị: bỏ quyển trang bị mà chưa sở hữu, bỏ trùng, tối đa 3 ô, tính lại bonus/buff/debuff (công pháp cũ tính ra đúng như cũ).
 *  4) Ghi cờ `cp16_migrated` (chạy 1 lần). Rollback: rollback() trả 6 cột công pháp từ bản sao lưu (hoặc /restoredb để khôi phục toàn bộ).
 */
const fs = require('node:fs');
const path = require('node:path');
const D = require('../db');
const Cu = require('./cultivator');
const CP = require('./congphap');
const K = require('./constants');

const FLAG = 'cp16_migrated';
const COLS = ['cong_phap', 'cong_phap_owned', 'cong_phap_slots', 'cong_phap_levels', 'cong_phap_bonus', 'cong_phap_pvp_buff', 'cong_phap_pvp_debuff'];
const stamp = () => { const n = new Date(); const p = (x) => String(x).padStart(2, '0'); return `${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}_${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`; };
const flagGet = () => { try { return D.get('SELECT value FROM bot_flags WHERE key = ?', FLAG); } catch (_) { return null; } };

function backup() {
  const dir = path.join(path.dirname(D.DB_PATH), 'db_backups'); fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `tutien_PRE_V16_${stamp()}.db`);
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  D.db().exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  return dest;
}

function run({ force = false } = {}) {
  D.run('CREATE TABLE IF NOT EXISTS bot_flags (key TEXT PRIMARY KEY, value TEXT)');
  D.run('CREATE TABLE IF NOT EXISTS congphap_fragments (user_id TEXT NOT NULL, frag_id TEXT NOT NULL, qty INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, frag_id))');
  if (!force && flagGet()) return { skipped: true };
  let bk = null; let bkErr = null;
  try { bk = backup(); } catch (e) { bkErr = e.message; console.error('⚠️ Không sao lưu được trước migration v16:', e.message); }
  const rows = D.all("SELECT user_id FROM cultivators WHERE (cong_phap_slots IS NOT NULL AND cong_phap_slots != '') OR (cong_phap IS NOT NULL AND cong_phap != '')");
  let fixed = 0; let cleaned = 0;
  for (const { user_id } of rows) {
    try {
      const row = Cu.getCultivator(user_id); if (!row) continue;
      const owned = Cu.ownedCongphapTiers(row);
      const eq = Cu.equippedCongphapTiers(row);
      const keep = [...new Set(eq)].filter((t) => owned.has(t)).slice(0, K.CONGPHAP_MAX_EQUIP_SLOTS);
      if (keep.length !== eq.length) cleaned += 1;
      Cu.updateCultivator(user_id, { cong_phap_slots: keep.join(',') });
      CP.recomputeEquippedCongphap(user_id); fixed += 1;
    } catch (e) { console.error(`⚠️ migration v16 người ${user_id}:`, e.message); }
  }
  D.run('INSERT OR REPLACE INTO bot_flags (key, value) VALUES (?, ?)', FLAG, JSON.stringify({ at: Math.floor(Date.now() / 1000), backup: bk, backupError: bkErr, players: rows.length, fixed, cleaned }));
  return { skipped: false, backup: bk, players: rows.length, fixed, cleaned };
}

/** Trả 7 cột công pháp của MỌI người chơi về đúng như bản sao lưu (không động đến phần còn lại). Bảng mảnh bí tịch được xoá. */
function rollback(backupPath) {
  const f = flagGet(); let p = backupPath;
  if (!p && f) { try { p = JSON.parse(f.value).backup; } catch (_) { p = null; } }
  if (!p || !fs.existsSync(p)) throw new Error('Không tìm thấy bản sao lưu trước migration v16.');
  const db = D.db(); const q = (s) => s.replace(/'/g, "''");
  db.exec(`ATTACH DATABASE '${q(p)}' AS bk16`);
  try {
    db.exec('BEGIN IMMEDIATE');
    db.exec(`UPDATE cultivators SET ${COLS.map((c) => `${c} = (SELECT b.${c} FROM bk16.cultivators b WHERE b.user_id = cultivators.user_id)`).join(', ')} WHERE user_id IN (SELECT user_id FROM bk16.cultivators)`);
    db.exec('DELETE FROM congphap_fragments');
    db.exec(`DELETE FROM bot_flags WHERE key = '${FLAG}'`);
    db.exec('COMMIT');
  } catch (e) { try { db.exec('ROLLBACK'); } catch (_) { /* không có giao dịch */ } throw e; } finally { db.exec('DETACH DATABASE bk16'); }
  return { restoredFrom: p };
}

module.exports = { run, rollback, backup, FLAG, COLS };
