'use strict';
/**
 * V20.0 — DẤU ẤN ĐAN DƯỢC (Đan Văn · Đan Hương · Đan Linh · Dị Biến). Lưu RIÊNG trong v20_marks theo (vật phẩm, phẩm chất) — KHÔNG đổi hệ thống phẩm chất 1–5.
 * Chỉ đan dược phẩm chất ≥ 3 chế thành công mới có xác suất mang dấu ấn. Khi DÙNG đan, mỗi viên tiêu 1 dấu ấn (mạnh nhất trước) và nhân hiệu lực.
 * Số dấu ấn luôn bị chặn ≤ số viên đang có (tự dọn khi dùng/xem) nên bán/giao dịch/vứt đan không để lại dấu ấn "ma".
 */
const D = require('../db');
const Inv = require('./invsvc');
const { random } = require('../util');

const uid = (u) => String(u);
const MARKS = {
  van: { name: 'Đan Văn', bonus: 0.06, icon: 'n20_van', desc: 'Vân đan rõ nét: hiệu lực +6%.' },
  huong: { name: 'Đan Hương', bonus: 0.09, icon: 'n20_huong', desc: 'Hương đan nồng: hiệu lực +9%.' },
  linh: { name: 'Đan Linh', bonus: 0.12, icon: 'n20_linh', desc: 'Đan đã sinh linh: hiệu lực +12%.' },
  tuyet: { name: 'Tuyệt Phẩm', bonus: 0.30, icon: 'n20_dibien', desc: 'Thành phẩm đặc biệt (chỉ đan phẩm 5): hiệu lực +30%.' },
  dibien: { name: 'Dị Biến', bonus: 0.20, icon: 'n20_dibien', desc: 'Đan dị biến cực hiếm: hiệu lực +20%.' },
};
const ORDER = ['tuyet', 'dibien', 'linh', 'huong', 'van'];
/** Xác suất mang dấu ấn theo phẩm chất q (q<3 → 0). */
const chance = (q) => (q >= 5 ? 0.14 : q === 4 ? 0.08 : q === 3 ? 0.03 : 0);
function pick() { const u = random(); return u < 0.03 ? 'dibien' : u < 0.18 ? 'linh' : u < 0.52 ? 'huong' : 'van'; }
/** Gọi khi chế xong 1 mẻ: `made` = [{item, q}] mỗi viên. Trả số dấu ấn mới theo loại. */
function roll(user, made) {
  const got = {};
  for (const { item, q } of made) {
    const m = q >= 5 && random() < 0.015 ? 'tuyet' : (random() < chance(q) ? pick() : null);   // Tuyệt Phẩm: thành phẩm đặc biệt 1,5% với đan phẩm 5
    if (!m) continue;
    D.run('INSERT INTO v20_marks (user_id, item_id, q, mark, n) VALUES (?,?,?,?,1) ON CONFLICT(user_id, item_id, q, mark) DO UPDATE SET n = n + 1', uid(user), item, q, m);
    got[m] = (got[m] || 0) + 1;
  }
  return got;
}
/** Dấu ấn đang có của (đan, phẩm) sau khi chặn ≤ số viên. */
function marksOf(user, item, q) {
  const held = Inv.qty(user, item, q);
  const rows = D.all('SELECT mark, n FROM v20_marks WHERE user_id = ? AND item_id = ? AND q = ? AND n > 0', uid(user), item, q);
  const by = {}; for (const r of rows) by[r.mark] = r.n;
  let total = ORDER.reduce((s, k) => s + (by[k] || 0), 0);
  // chặn: bỏ dấu ấn yếu trước
  for (const k of [...ORDER].reverse()) { while (total > held && by[k] > 0) { by[k] -= 1; total -= 1; } }
  return by;
}
/** Dấu ấn sẽ dùng cho viên kế tiếp (không tiêu) → { mark, bonus } hoặc null. */
function peek(user, item, q) {
  if (!q) return null; const by = marksOf(user, item, q);
  for (const k of ORDER) if (by[k] > 0) return { mark: k, bonus: MARKS[k].bonus };
  return null;
}
/** Tiêu 1 dấu ấn (sau khi đã take viên đan thành công). */
function consume(user, item, q, pk) {
  if (!pk) return;
  D.run('UPDATE v20_marks SET n = MAX(0, n - 1) WHERE user_id = ? AND item_id = ? AND q = ? AND mark = ?', uid(user), item, q, pk.mark);
  D.run('DELETE FROM v20_marks WHERE user_id = ? AND item_id = ? AND q = ? AND n <= 0', uid(user), item, q);
}
/** Dọn dấu ấn thừa so với số viên còn trong kho (gọi mỗi khi lấy đan ra: bán/dùng/giao dịch/vứt). */
function trim(user, item, q) {
  const rows = D.all('SELECT mark, n FROM v20_marks WHERE user_id = ? AND item_id = ? AND q = ? AND n > 0', uid(user), item, q); if (!rows.length) return;
  const by = marksOf(user, item, q);
  for (const r of rows) { const keep = by[r.mark] || 0; if (keep <= 0) D.run('DELETE FROM v20_marks WHERE user_id = ? AND item_id = ? AND q = ? AND mark = ?', uid(user), item, q, r.mark); else if (keep < r.n) D.run('UPDATE v20_marks SET n = ? WHERE user_id = ? AND item_id = ? AND q = ? AND mark = ?', keep, uid(user), item, q, r.mark); }
}
const summary = (user, item, q) => { const by = marksOf(user, item, q); return ORDER.filter((k) => by[k] > 0).map((k) => `${MARKS[k].name} ×${by[k]}`).join(', '); };
module.exports = { MARKS, ORDER, chance, roll, marksOf, peek, consume, trim, summary };
