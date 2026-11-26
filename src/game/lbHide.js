'use strict';
/**
 * v22.2 — Ẩn / xoá một người khỏi các bảng xếp hạng (do admin).
 *  • 'an'  = ẩn: không hiện ở bảng, mọi dữ liệu giữ nguyên. Bỏ ẩn bằng `hien`.
 *  • 'xoa' = xoá: ẩn + GỠ điểm xếp hạng đã lưu riêng (Bảng thành tích Siêu Thoát; sát thương của các Boss ĐÃ kết thúc),
 *            bản sao lưu ở lb_removed, `hien` sẽ khôi phục đủ. KHÔNG đụng sát thương Boss đang sống (còn dùng chia thưởng).
 *  Công tắc tổng `lb_hide` (on|off): off ⇒ mọi người hiện lại như chưa ẩn (dữ liệu ẩn/xoá vẫn nguyên; chưa khôi phục dòng đã gỡ).
 *  Phạm vi bảng: Thiên Kiêu Bảng, sát thương Boss, Bảng thành tích Siêu Thoát, Bảng Chuỗi Đồng Tu (cặp có 1 người bị ẩn thì cả cặp ẩn).
 *  KHÔNG áp: bảng Tông Môn / Tông Chiến (xếp theo tông, không theo người) và Đại Phú Đường (sự kiện riêng).
 */
const D = require('../db');
const ST = require('./settings');
const now = () => Math.floor(Date.now() / 1000);
const MODES = ['an', 'xoa'];
const PURGE = [   // bảng lưu điểm xếp hạng riêng có thể gỡ
  { tbl: 'ev19_hall', sel: 'SELECT * FROM ev19_hall WHERE user_id = ?', del: 'DELETE FROM ev19_hall WHERE user_id = ?' },
  { tbl: 'wb7_damage', sel: "SELECT * FROM wb7_damage WHERE user_id = ? AND boss_id IN (SELECT boss_id FROM wb7_boss WHERE status != 'alive')", del: "DELETE FROM wb7_damage WHERE user_id = ? AND boss_id IN (SELECT boss_id FROM wb7_boss WHERE status != 'alive')" },
];
const sid = (u) => String(u && u.id !== undefined ? u.id : u).replace(/[^\d]/g, '');

const enabled = () => String(ST.get('lb_hide', 'on')) !== 'off';
const setEnabled = (on) => ST.set('lb_hide', on ? 'on' : 'off');
const hiddenIds = () => (enabled() ? D.all('SELECT user_id FROM lb_hidden').map((r) => String(r.user_id)) : []);
const isHidden = (uid) => enabled() && !!D.get('SELECT 1 AS x FROM lb_hidden WHERE user_id = ?', sid(uid));
/** Đoạn SQL ` AND col NOT IN (...)` (rỗng nếu không ai bị ẩn). ID chỉ gồm chữ số nên nhúng thẳng an toàn. */
const sqlNot = (col) => { const ids = hiddenIds().filter((x) => /^\d+$/.test(x)); return ids.length ? ` AND ${col} NOT IN (${ids.map((x) => `'${x}'`).join(',')})` : ''; };
/** Lọc mảng dòng bảng xếp hạng; get(row) trả 1 id hoặc mảng id. */
function filter(rows, get = (r) => r.user_id) {
  const h = new Set(hiddenIds()); if (!h.size) return rows;
  return rows.filter((r) => { const v = get(r); return !(Array.isArray(v) ? v : [v]).some((x) => h.has(String(x))); });
}

function restoreRows(uid) {
  let n = 0;
  for (const r of D.all('SELECT * FROM lb_removed WHERE user_id = ? ORDER BY id', uid)) {
    const o = JSON.parse(r.row_json); const cols = Object.keys(o);
    try { D.run(`INSERT OR REPLACE INTO ${r.tbl} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, ...cols.map((c) => o[c])); n += 1; } catch (_) { /* bảng đã đổi cấu trúc: bỏ qua dòng này */ }
  }
  D.run('DELETE FROM lb_removed WHERE user_id = ?', uid); return n;
}

/** Ẩn/xoá. Trả { ok, mode, purged, restored } hoặc { ok:false, error }. */
function set(user, mode, by, reason = '') {
  const uid = sid(user); if (!uid) return { ok: false, error: 'Thiếu người chơi.' };
  if (!MODES.includes(mode)) return { ok: false, error: 'Chế độ: an | xoa.' };
  let purged = 0; let restored = 0;
  D.transaction(() => {
    const prev = D.get('SELECT mode FROM lb_hidden WHERE user_id = ?', uid);
    if (mode === 'an' && prev && prev.mode === 'xoa') restored = restoreRows(uid);          // xoa → an: trả lại điểm đã gỡ, chỉ còn ẩn
    if (mode === 'xoa') {
      for (const p of PURGE) for (const row of D.all(p.sel, uid)) { D.run('INSERT INTO lb_removed (user_id, tbl, row_json, ts) VALUES (?,?,?,?)', uid, p.tbl, JSON.stringify(row), now()); purged += 1; }
      for (const p of PURGE) D.run(p.del, uid);
    }
    D.run('INSERT OR REPLACE INTO lb_hidden (user_id, mode, reason, by_id, ts) VALUES (?,?,?,?,?)', uid, mode, String(reason || '').slice(0, 200), String(by || ''), now());
  });
  try { require('./admin17').log(by, 'bxh_' + mode, uid, reason); } catch (_) { /* nhật ký phụ */ }
  return { ok: true, mode, purged, restored };
}
/** Hiện lại (bỏ ẩn/xoá) + khôi phục dòng đã gỡ. */
function unset(user, by) {
  const uid = sid(user); const prev = D.get('SELECT mode FROM lb_hidden WHERE user_id = ?', uid);
  if (!prev) return { ok: false, error: 'Người này không bị ẩn/xoá khỏi bảng xếp hạng.' };
  let restored = 0; D.transaction(() => { restored = restoreRows(uid); D.run('DELETE FROM lb_hidden WHERE user_id = ?', uid); });
  try { require('./admin17').log(by, 'bxh_hien', uid, ''); } catch (_) { /* nhật ký phụ */ }
  return { ok: true, restored, was: prev.mode };
}
const list = () => D.all('SELECT * FROM lb_hidden ORDER BY ts DESC LIMIT 60');

module.exports = { MODES, enabled, setEnabled, hiddenIds, isHidden, sqlNot, filter, set, unset, list };
