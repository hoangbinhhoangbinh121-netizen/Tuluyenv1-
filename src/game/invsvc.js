'use strict';
/**
 * INVENTORY SERVICE v17 — nơi DUY NHẤT nhận / trừ / kiểm tra / chuyển / bán / dùng vật phẩm.
 *  • Vật phẩm mới nằm ở bảng inv_items; vật phẩm V16 vẫn nằm ở cột cũ của bảng cultivators (KHÔNG chuyển, KHÔNG xoá — chỉ được "ánh xạ" sang item_id mới);
 *    vật phẩm Linh Thú nằm ở pet_items (adapter `pet`). Mọi module gọi đúng 1 API này, không tự cộng/trừ số lượng nữa.
 *  • Mọi hàm là ĐỒNG BỘ (Node chạy 1 luồng + node:sqlite đồng bộ) và take/takeMany kiểm tra-trừ trong cùng 1 lệnh UPDATE có điều kiện ⇒ bấm dồn / gửi
 *    request đồng thời không thể trừ 2 lần hay âm kho.
 *  • Mỗi lần đổi ghi inv_log (kiểm toán). Khoá vật phẩm (inv_lock) chặn bán/giao dịch.
 */
const D = require('../db');
const Cu = require('./cultivator');
const Cat = require('./catalog17');
const { I } = Cat;
const { now, int } = require('../util');

const uid = (u) => String(u);
const dayKey = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);   // ngày theo giờ VN
const weekKey = () => { const d = new Date(Date.now() + 7 * 3600 * 1000); const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); return `W${Math.floor((t / 86400000 + 3) / 7)}`; };
const Delta = Cu.Delta;

function norm(it, q) {
  if (!it) return 0;
  if (!it.quality) return 0;
  if (it.store === 'col' && it.legacy_q !== undefined && (!q || q === it.legacy_q)) return it.legacy_q;
  return int(q) || 0;
}
const isCol = (it, q) => it.store === 'col' && (!it.quality || q === it.legacy_q);
const need = (id) => { const it = I.BY_ID[id]; if (!it) throw new Error(`vật phẩm không tồn tại: ${id}`); return it; };

function log(user, id, q, delta, why) {
  try { D.run('INSERT INTO inv_log (ts, user_id, item_id, q, delta, why) VALUES (?,?,?,?,?,?)', now(), uid(user), id, q, delta, String(why || '').slice(0, 60)); } catch (_) { /* nhật ký không được làm hỏng giao dịch */ }
}

// ------------------------------------------------------------------ số lượng
function qty(user, id, q = 0) {
  const it = need(id); q = norm(it, q);
  if (isCol(it, q)) { const r = D.get(`SELECT ${it.legacy_col} AS n FROM cultivators WHERE user_id = ?`, user); return r ? Math.max(0, int(r.n || 0)) : 0; }
  const r = D.get('SELECT qty FROM inv_items WHERE user_id = ? AND item_id = ? AND q = ?', uid(user), id, q);
  return r ? Math.max(0, r.qty) : 0;
}
/** Tổng mọi phẩm chất của 1 vật phẩm. */
function qtyAny(user, id) { const m = byQuality(user, id); return Object.values(m).reduce((s, n) => s + n, 0); }
function byQuality(user, id) {
  const it = need(id); const out = {};
  if (it.store === 'col') { const n = qty(user, id, it.legacy_q || 0); if (n > 0) out[it.legacy_q || 0] = n; }
  for (const r of D.all('SELECT q, qty FROM inv_items WHERE user_id = ? AND item_id = ? AND qty > 0', uid(user), id)) out[r.q] = (out[r.q] || 0) + r.qty;
  return out;
}

// ------------------------------------------------------------------ nhận
function add(user, id, n, { q = 0, why = '' } = {}) {
  n = int(n); if (!(n > 0)) return 0;
  const it = need(id); q = norm(it, q);
  const have = qty(user, id, q); const room = Math.max(0, it.stack_limit - have); const got = Math.min(n, room);
  if (got <= 0) { log(user, id, q, 0, `${why}|đầy kho`); return 0; }
  if (isCol(it, q)) { if (!Cu.updateCultivator(user, { [it.legacy_col]: new Delta(got) })) return 0; }
  else D.run('INSERT INTO inv_items (user_id, item_id, q, qty) VALUES (?,?,?,?) ON CONFLICT(user_id, item_id, q) DO UPDATE SET qty = qty + excluded.qty', uid(user), id, q, got);
  log(user, id, q, got, why);
  return got;
}
/** items: { id: n } hoặc [{id, qty, q}] → trả bảng đã nhận thực tế. */
function addMany(user, items, why = '') {
  const out = {};
  for (const x of normList(items)) { const g = add(user, x.id, x.qty, { q: x.q, why }); if (g) out[x.id] = (out[x.id] || 0) + g; }
  return out;
}

// ------------------------------------------------------------------ trừ
function take(user, id, n, { q = 0, why = '' } = {}) {
  n = int(n); if (!(n > 0)) return false;
  const it = need(id); q = norm(it, q);
  let ok;
  if (isCol(it, q)) ok = Cu.updateCultivator(user, { [it.legacy_col]: new Delta(-n) }, { [it.legacy_col]: n });
  else ok = D.run('UPDATE inv_items SET qty = qty - ? WHERE user_id = ? AND item_id = ? AND q = ? AND qty >= ?', n, uid(user), id, q, n).changes > 0;
  if (ok) log(user, id, q, -n, why);
  return !!ok;
}
const normList = (items) => (Array.isArray(items) ? items.map((x) => ({ id: x.id, qty: x.qty, q: x.q || 0 })) : Object.entries(items).map(([id, n]) => ({ id, qty: n, q: 0 })));
/** Tất cả hoặc không gì cả: kiểm tra đủ rồi trừ — chạy trong 1 transaction. */
function takeMany(user, items, why = '') {
  const list = normList(items);
  return D.transaction(() => {
    const merged = {};
    for (const x of list) { const it = need(x.id); const q = norm(it, x.q); const k = `${x.id}|${q}`; merged[k] = merged[k] || { id: x.id, q, qty: 0 }; merged[k].qty += int(x.qty); }
    for (const x of Object.values(merged)) if (qty(user, x.id, x.q) < x.qty) return false;
    for (const x of Object.values(merged)) if (!take(user, x.id, x.qty, { q: x.q, why })) throw new Error('takeMany: không trừ được sau khi đã kiểm tra');   // không bao giờ xảy ra (đồng bộ) — nếu có sẽ ROLLBACK
    return true;
  });
}
const hasAll = (user, items) => normList(items).every((x) => qty(user, x.id, x.q) >= int(x.qty));
/** Danh sách còn thiếu: [{id, need, have}] */
function missing(user, items) {
  const out = [];
  for (const x of normList(items)) { const have = qty(user, x.id, x.q); if (have < int(x.qty)) out.push({ id: x.id, need: int(x.qty), have }); }
  return out;
}

// ------------------------------------------------------------------ khoá
const isLocked = (user, id, q = 0) => !!D.get('SELECT 1 AS x FROM inv_lock WHERE user_id = ? AND item_id = ? AND q = ?', uid(user), id, norm(need(id), q));
function setLock(user, id, q, on) {
  q = norm(need(id), q);
  if (on) D.run('INSERT OR IGNORE INTO inv_lock (user_id, item_id, q) VALUES (?,?,?)', uid(user), id, q);
  else D.run('DELETE FROM inv_lock WHERE user_id = ? AND item_id = ? AND q = ?', uid(user), id, q);
  return !!on;
}

// ------------------------------------------------------------------ chuyển (giao dịch / tặng)
const tradeBlock = (it) => (!it.can_trade || it.is_quest_item ? 'Vật phẩm này không thể giao dịch.' : null);
function transfer(from, to, id, n, q = 0, why = 'giao dịch') {
  const it = need(id); q = norm(it, q);
  if (tradeBlock(it)) return { ok: false, msg: tradeBlock(it) };
  if (isLocked(from, id, q)) return { ok: false, msg: `${it.name} đang bị khoá.` };
  return D.transaction(() => {
    if (!take(from, id, n, { q, why: `${why}→${to}` })) return { ok: false, msg: `Không đủ ${it.name}.` };
    const g = add(to, id, n, { q, why: `${why}←${from}` });
    if (g < n) throw new Error(`kho người nhận đầy: ${it.name}`);
    return { ok: true };
  });
}

// ------------------------------------------------------------------ liệt kê
/** Mọi vật phẩm có trong kho: [{id, q, qty, item}] (cột cũ + bảng mới), sắp theo danh mục → phẩm cấp ↓ → tên. */
function list(user) {
  const out = [];
  const row = Cu.getCultivator(user);
  for (const it of I.ITEMS) {
    if (it.store === 'col' && row) { const n = Math.max(0, int(row[it.legacy_col] || 0)); if (n > 0) out.push({ id: it.id, q: it.quality ? it.legacy_q : 0, qty: n, item: it }); }
  }
  for (const r of D.all('SELECT item_id, q, qty FROM inv_items WHERE user_id = ? AND qty > 0', uid(user))) {
    const it = I.BY_ID[r.item_id]; if (it) out.push({ id: r.item_id, q: r.q, qty: r.qty, item: it });
  }
  const co = (c) => (I.CATEGORIES[c] ? I.CATEGORIES[c].order : 99);
  out.sort((a, b) => co(a.item.cat) - co(b.item.cat) || b.item.rarity - a.item.rarity || a.item.name.localeCompare(b.item.name, 'vi') || a.q - b.q);
  return out;
}

// ------------------------------------------------------------------ bộ đếm theo ngày/tuần (giới hạn mua, dùng, rơi)
function dailyGet(user, key) { const r = D.get('SELECT n FROM inv_daily WHERE user_id = ? AND day = ? AND key = ?', uid(user), dayKey(), key); return r ? r.n : 0; }
function dailyAdd(user, key, n = 1) { D.run('INSERT INTO inv_daily (user_id, day, key, n) VALUES (?,?,?,?) ON CONFLICT(user_id, day, key) DO UPDATE SET n = n + excluded.n', uid(user), dayKey(), key, n); }
function weeklyGet(user, key) { const r = D.get('SELECT n FROM inv_daily WHERE user_id = ? AND day = ? AND key = ?', uid(user), weekKey(), key); return r ? r.n : 0; }
function weeklyAdd(user, key, n = 1) { D.run('INSERT INTO inv_daily (user_id, day, key, n) VALUES (?,?,?,?) ON CONFLICT(user_id, day, key) DO UPDATE SET n = n + excluded.n', uid(user), weekKey(), key, n); }
function prune() {
  try {
    const d = new Date(Date.now() + 7 * 3600 * 1000 - 3 * 86400 * 1000).toISOString().slice(0, 10);
    D.run("DELETE FROM inv_daily WHERE day LIKE '____-__-__' AND day < ?", d);
    D.run('DELETE FROM inv_log WHERE ts < ?', now() - 30 * 86400);
    D.run('DELETE FROM craft_log WHERE ts < ?', now() - 60 * 86400);
  } catch (e) { console.warn('⚠️ prune inv:', e.message); }
}

// ------------------------------------------------------------------ kiểm kê toàn máy chủ (đối chiếu migration / admin)
function totals() {
  const out = {};
  for (const it of I.ITEMS) {
    if (it.store === 'col') { const r = D.get(`SELECT COALESCE(SUM(${it.legacy_col}),0) AS n, SUM(CASE WHEN COALESCE(${it.legacy_col},0) > 0 THEN 1 ELSE 0 END) AS p FROM cultivators`); out[`${it.id}|${it.legacy_q || 0}`] = { id: it.id, q: it.legacy_q || 0, qty: Number(r.n || 0), holders: Number(r.p || 0) }; }
  }
  for (const r of D.all('SELECT item_id, q, SUM(qty) AS n, COUNT(*) AS p FROM inv_items WHERE qty > 0 GROUP BY item_id, q')) {
    const k = `${r.item_id}|${r.q}`; out[k] = { id: r.item_id, q: r.q, qty: Number(r.n), holders: Number(r.p) };
  }
  return out;
}
const sumTotals = (t) => Object.values(t).reduce((s, x) => s + x.qty, 0);

// ------------------------------------------------------------------ adapter Linh Thú (bảng pet_items) — pets.js gọi qua đây
const pet = {
  qty: (owner, item) => { const r = D.get('SELECT qty FROM pet_items WHERE owner = ? AND item = ?', uid(owner), item); return r ? r.qty : 0; },
  add: (owner, item, n) => { n = int(n); if (n > 0) D.run('INSERT INTO pet_items (owner, item, qty) VALUES (?, ?, ?) ON CONFLICT(owner, item) DO UPDATE SET qty = qty + excluded.qty', uid(owner), item, n); },
  take: (owner, item, n) => D.run('UPDATE pet_items SET qty = qty - ? WHERE owner = ? AND item = ? AND qty >= ?', int(n), uid(owner), item, int(n)).changes > 0,
  map: (owner) => { const o = {}; for (const r of D.all('SELECT item, qty FROM pet_items WHERE owner = ? AND qty > 0', uid(owner))) o[r.item] = r.qty; return o; },
};

// ------------------------------------------------------------------ nhập/hiển thị danh sách vật phẩm (Giao Dịch, lệnh gõ tay)
const fold = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
const BY_NAME = (() => { const m = new Map(); for (const it of I.ITEMS) m.set(fold(it.name), it); return m; })();
const Q_BY_NAME = (() => { const m = new Map(); for (let q = 1; q <= 5; q += 1) m.set(fold(I.qName(q)), q); return m; })();
/** "Thanh Linh Thảo x5, Tụ Khí Đan (Thượng Phẩm) x2" → { ok, items:[{id,q,qty}], err } */
function parseList(text) {
  const items = [];
  for (const part of String(text || '').split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean)) {
    const m = /^(.*?)(?:\s*[x×*]\s*(\d+))?$/i.exec(part); let name = m[1].trim(); const qty = m[2] ? int(m[2]) : 1; let q = 0;
    const qm = /\(([^)]+)\)\s*$/.exec(name);
    if (qm) { q = Q_BY_NAME.get(fold(qm[1])) || 0; if (!q) return { ok: false, err: `Phẩm chất "${qm[1]}" không hợp lệ.` }; name = name.slice(0, qm.index).trim(); }
    let it = BY_NAME.get(fold(name));
    if (!it) { const f = fold(name); const c = I.ITEMS.filter((x) => fold(x.name).includes(f)); if (f.length >= 3 && c.length === 1) [it] = c; else if (c.length > 1) return { ok: false, err: `"${name}" khớp nhiều vật phẩm (${c.slice(0, 4).map((x) => x.name).join(', ')}…) — hãy ghi đủ tên.` }; }
    if (!it) return { ok: false, err: `Không có vật phẩm tên "${name}".` };
    if (!(qty > 0) || qty > 999999) return { ok: false, err: `Số lượng của ${it.name} không hợp lệ.` };
    if (it.quality && !q) { if (it.store === 'col' && it.legacy_q) q = it.legacy_q; else return { ok: false, err: `${it.name} có phẩm chất — ghi rõ, ví dụ: ${it.name} (Thượng Phẩm) x${qty}.` }; }
    if (!it.quality) q = 0;
    const ex = items.find((x) => x.id === it.id && x.q === q); if (ex) ex.qty += qty; else items.push({ id: it.id, q, qty });
  }
  return { ok: true, items };
}
const fmtItems = (items) => (items || []).map((x) => `**${x.qty}** × ${I.BY_ID[x.id] ? I.BY_ID[x.id].name : x.id}${x.q ? ` (${I.qName(x.q)})` : ''}`).join(', ');

module.exports = {
  parseList, fmtItems, dayKey, weekKey, norm, qty, qtyAny, byQuality, add, addMany, take, takeMany, hasAll, missing, isLocked, setLock, transfer, tradeBlock, list,
  dailyGet, dailyAdd, weeklyGet, weeklyAdd, prune, totals, sumTotals, pet,
};
