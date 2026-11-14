'use strict';
/**
 * MIGRATION v16 → v17 (Bách Nghề · Vật Phẩm Hợp Nhất). KHÔNG đặt lại, KHÔNG chuyển đổi, KHÔNG xoá dữ liệu người chơi.
 *  1) Sao lưu NHẤT QUÁN (VACUUM INTO) db_backups/tutien_PRE_V17_<thời gian>.db TRƯỚC khi làm gì.
 *  2) Bảng mới (inv_items, gear, prof_state, craft_jobs, linh dien...) do schema_v17 tạo (CREATE TABLE IF NOT EXISTS); cột mới cultivators.fx17 / sects.tran_*.
 *  3) Vật phẩm V16 (Nguyên Liệu, Đan Dược, Huyền Thiết, Linh Dược Đặc Biệt...) vẫn nằm NGUYÊN trong cột cũ — danh mục V17 chỉ "ánh xạ" sang các cột đó.
 *  4) Đối chiếu TRƯỚC / SAU: Linh Thạch, vật phẩm theo từng loại, số người, số Linh Thú, mảnh bí tịch, công pháp... — phải bằng nhau tuyệt đối; lệch thì ghi cảnh báo lớn.
 *  5) Cờ `v17_migrated` (chạy 1 lần). rollback(): gỡ cờ + xoá bộ nhớ đệm hiệu ứng; dữ liệu V17 mới (nghề, trang bị...) chỉ xoá khi { dropV17Data: true };
 *     khôi phục TOÀN BỘ về V16 → dùng bản sao lưu với /restoredb.
 */
const fs = require('node:fs');
const path = require('node:path');
const D = require('../db');
const Inv = require('./invsvc');

const FLAG = 'v17_migrated';
const stamp = () => { const n = new Date(); const p = (x) => String(x).padStart(2, '0'); return `${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}_${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`; };
const flagGet = () => { try { return D.get('SELECT value FROM bot_flags WHERE key = ?', FLAG); } catch (_) { return null; } };
const V17_TABLES = ['inv_items', 'inv_lock', 'inv_daily', 'inv_log', 'prof_state', 'prof_mastery', 'prof_ach', 'craft_jobs', 'craft_cd', 'craft_log', 'gear', 'fx_buffs', 'linh_dien_plot', 'linh_dien'];

function backup() {
  const dir = path.join(path.dirname(D.DB_PATH), 'db_backups'); fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `tutien_PRE_V17_${stamp()}.db`);
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  D.db().exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  return dest;
}
const tableOk = (t) => { try { return !!D.get("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", t); } catch (_) { return false; } };
const cnt = (sql) => { try { const r = D.get(sql); return Number((r && Object.values(r)[0]) || 0); } catch (_) { return 0; } };

/** Ảnh chụp số liệu để đối chiếu (chỉ đọc). */
function snapshot() {
  const s = { players: cnt('SELECT COUNT(*) FROM cultivators'), linh_thach: cnt('SELECT COALESCE(SUM(linh_thach),0) FROM cultivators'),
    pets: tableOk('pets') ? cnt('SELECT COUNT(*) FROM pets') : 0, pet_items: tableOk('pet_items') ? cnt('SELECT COALESCE(SUM(qty),0) FROM pet_items') : 0,
    congphap_frag: tableOk('congphap_fragments') ? cnt('SELECT COALESCE(SUM(qty),0) FROM congphap_fragments') : 0,
    atk: cnt('SELECT COALESCE(SUM(atk),0) FROM cultivators'), def: cnt('SELECT COALESCE(SUM(def_),0) FROM cultivators'), tu_vi: cnt('SELECT COALESCE(SUM(tu_vi),0) FROM cultivators'),
    sects: tableOk('sects') ? cnt('SELECT COUNT(*) FROM sects') : 0 };
  s.items = {}; for (const [k, v] of Object.entries(Inv.totals())) s.items[k] = v.qty;
  return s;
}
/** So hai ảnh chụp. Trả danh sách khác biệt (rỗng = khớp). Cho phép `inv_items` mới (V17 chưa có gì trước migration → luôn bằng 0). */
function diff(a, b) {
  const out = [];
  for (const k of ['players', 'linh_thach', 'pets', 'pet_items', 'congphap_frag', 'atk', 'def', 'tu_vi', 'sects']) if (a[k] !== b[k]) out.push(`${k}: ${a[k]} → ${b[k]}`);
  for (const k of new Set([...Object.keys(a.items), ...Object.keys(b.items)])) if ((a.items[k] || 0) !== (b.items[k] || 0)) out.push(`vật phẩm ${k}: ${a.items[k] || 0} → ${b.items[k] || 0}`);
  return out;
}

function run({ force = false } = {}) {
  D.run('CREATE TABLE IF NOT EXISTS bot_flags (key TEXT PRIMARY KEY, value TEXT)');
  try { Inv.prune(); } catch (_) { /* bỏ qua */ }
  if (!force && flagGet()) return { skipped: true };
  let bk = null; let bkErr = null;
  try { bk = backup(); } catch (e) { bkErr = e.message; console.error('⚠️ Không sao lưu được trước migration v17:', e.message); }
  const before = snapshot();
  // Chỉ buộc tính lại bộ nhớ đệm hiệu ứng (V17 chưa có hiệu ứng nào) — không đụng dữ liệu người chơi.
  let reset = 0; try { reset = D.run("UPDATE cultivators SET fx17 = '' WHERE fx17 IS NOT NULL AND fx17 != ''").changes; } catch (_) { /* cột chưa có → không sao */ }
  const after = snapshot(); const bad = diff(before, after);
  if (bad.length) console.error(`🚨 MIGRATION V17 LỆCH SỐ LIỆU (${bad.length}): ${bad.slice(0, 10).join(' | ')} — khôi phục từ ${bk}`);
  const info = { at: Math.floor(Date.now() / 1000), backup: bk, backupError: bkErr, players: before.players, fxReset: reset, ok: bad.length === 0, diff: bad.slice(0, 50), totals: { linh_thach: after.linh_thach, pets: after.pets, itemKinds: Object.keys(after.items).length, itemQty: Object.values(after.items).reduce((s, x) => s + x, 0) } };
  D.run('INSERT OR REPLACE INTO bot_flags (key, value) VALUES (?, ?)', FLAG, JSON.stringify(info));
  return { skipped: false, ...info };
}
function status() { const f = flagGet(); if (!f) return null; try { return JSON.parse(f.value); } catch (_) { return null; } }

/** Rollback an toàn: gỡ cờ + bộ nhớ đệm. { dropV17Data: true } xoá luôn dữ liệu nghề/trang bị/vật phẩm V17 (KHÔNG đụng cột cũ). Khôi phục toàn bộ: /restoredb với file sao lưu. */
function rollback({ dropV17Data = false } = {}) {
  const f = status();
  D.transaction(() => {
    try { D.run("UPDATE cultivators SET fx17 = ''"); } catch (_) { /* bỏ qua */ }
    try { D.run("UPDATE sects SET tran_key = '', tran_until = 0, tran_q = 2"); } catch (_) { /* bỏ qua */ }
    if (dropV17Data) for (const t of V17_TABLES) if (tableOk(t)) D.run(`DELETE FROM ${t}`);
    D.run('DELETE FROM bot_flags WHERE key = ?', FLAG);
  });
  return { backup: f && f.backup, dropped: dropV17Data };
}
/** Bảng đối chiếu thực tế trên máy chủ (admin): mỗi vật phẩm — kho lưu, số người giữ, tổng số lượng — + tình trạng migration. */
function reportText() {
  const { I } = require('./catalog17'); const T = Inv.totals(); const st = status(); const L = [];
  L.push(`MIGRATION V17: ${st ? `đã chạy ${new Date(st.at * 1000).toISOString()} · ${st.ok ? 'đối chiếu KHỚP' : `LỆCH ${st.diff.length} mục`} · sao lưu ${st.backup || '—'}` : 'CHƯA chạy'}`);
  const snap = snapshot(); L.push(`Người chơi ${snap.players} · Linh Thạch ${snap.linh_thach} · Linh Thú ${snap.pets} · Mảnh bí tịch ${snap.congphap_frag}`);
  L.push('', 'id | tên | danh mục | kho lưu | số người giữ | tổng');
  for (const it of I.ITEMS) { const rows = Object.values(T).filter((x) => x.id === it.id); const q = rows.reduce((a, x) => a + x.qty, 0); const h = rows.reduce((a, x) => a + x.holders, 0);
    L.push(`${it.id} | ${it.name} | ${it.cat} | ${it.store === 'col' ? `cột cũ ${it.legacy_col}` : it.store} | ${h} | ${q}`); }
  L.push('', `Trang bị: ${cnt('SELECT COUNT(*) FROM gear')} · Lò đang chạy: ${cnt('SELECT COUNT(*) FROM craft_jobs')} · Linh Điền: ${cnt('SELECT COUNT(*) FROM linh_dien')}`);
  return L.join('\n');
}
module.exports = { reportText, run, rollback, status, snapshot, diff, backup, FLAG };
