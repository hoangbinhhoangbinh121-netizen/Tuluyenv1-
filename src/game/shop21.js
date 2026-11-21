'use strict';
/**
 * V21.0 — CỬA HÀNG NGUYÊN BẢO + ĐƠN NẠP.
 *  • Nguyên Bảo (💠) là tiền nạp. Nạp = tạo đơn → chuyển khoản → ADMIN xác nhận ("done đơn") → cộng Nguyên Bảo. Bot KHÔNG tự biết tiền đã vào tài khoản.
 *  • Cửa hàng bán MỌI vật phẩm có thể nhận được trong game (kho đồ, Thiên Bảo/Truyền Thừa Ngọc Giản, vật phẩm Linh Thú, trang bị) TRỪ vật phẩm nhiệm vụ
 *    (is_quest_item: Thiên Đạo Thạch, Linh/Tiên Giới Lệnh, Mảnh Phi Thăng, Đế Đạo Chứng Nhận…) và những thứ admin ẩn đi.
 *  • Mọi thao tác tiền chạy trong 1 transaction; xác nhận đơn idempotent (chỉ 'pending' → 'done' một lần); mọi cộng/trừ ví ghi v21_ledger.
 */
const fs = require('node:fs');
const nodePath = require('node:path');
const D = require('../db');
const Cu = require('./cultivator');
const Inv = require('./invsvc');
const Cat = require('./catalog17');
const ST = require('./settings');
const { I, C } = Cat;
const { now, int, fmtNum } = require('../util');

const uid = (u) => String(u);
const DAY = 86400;

// ---------------------------------------------------------------- cấu hình
/** Gói nạp: vnd = tiền thật (VNĐ); nb = Nguyên Bảo gốc (1 NB = 100đ); bonus = tặng thêm. */
const PACKAGES = [
  { vnd: 10000, nb: 100, bonus: 0 },
  { vnd: 20000, nb: 200, bonus: 10 },
  { vnd: 50000, nb: 500, bonus: 50 },
  { vnd: 100000, nb: 1000, bonus: 150 },
];
const pkgNb = (p) => p.nb + p.bonus;
const pkgOf = (vnd) => PACKAGES.find((p) => p.vnd === int(vnd)) || null;
const ORDER_TTL = 24 * 3600;       // đơn chờ quá 24 giờ tự hết hạn
const MAX_PENDING = 3;             // mỗi người tối đa 3 đơn chờ
const MAX_QTY = { inv: 999, talent: 99, pet: 99, gear: 10 };
const vnd = (n) => `${fmtNum(n)}đ`;

const mult = () => { const v = Number(ST.get('shop21_mult', '1')); return Number.isFinite(v) && v >= 0.1 && v <= 20 ? v : 1; };
const shopOn = () => ST.get('shop21_on', '1') !== '0';
const hidden = () => { try { return new Set(JSON.parse(ST.get('shop21_hidden', '[]'))); } catch (_) { return new Set(); } };
function setHidden(set) { ST.set('shop21_hidden', JSON.stringify([...set])); }
/** Tài khoản nhận tiền: cài bằng /quantri (ưu tiên) hoặc biến môi trường SHOP_BANK_ID / SHOP_BANK_ACC / SHOP_BANK_NAME. */
function bank() {
  const id = (ST.get('shop21_bank_id', '') || process.env.SHOP_BANK_ID || '').trim();
  const acc = (ST.get('shop21_bank_acc', '') || process.env.SHOP_BANK_ACC || '').trim();
  const name = (ST.get('shop21_bank_name', '') || process.env.SHOP_BANK_NAME || '').trim();
  return { id, acc, name, ready: !!(id && acc && name) };
}
function setBank(admin, id, acc, name) {
  id = String(id || '').trim().replace(/[^A-Za-z0-9]/g, '').slice(0, 20); acc = String(acc || '').trim().replace(/[^0-9A-Za-z]/g, '').slice(0, 30);
  name = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (!id || !acc || !name) return { ok: false, msg: '❌ Cần đủ: mã ngân hàng (VD MB, VCB, TCB), số tài khoản, tên chủ tài khoản.' };
  ST.set('shop21_bank_id', id); ST.set('shop21_bank_acc', acc); ST.set('shop21_bank_name', name);
  log(admin, 'shop_bank', '', `${id} ${acc.slice(0, 3)}…${acc.slice(-2)}`);
  return { ok: true, msg: `✅ Đã lưu tài khoản nhận tiền: **${id}** · ${acc} · ${name}.` };
}
/** Mã QR nhận tiền TĨNH (ảnh chủ shop cung cấp: assets/ui/qr_nap.jpg, hoặc biến SHOP_QR_FILE). Dùng khi chưa cài tài khoản VietQR động. */
const QR_OWNER = 'HOANG SAO AN BINH';
const qrFile = () => { const f = process.env.SHOP_QR_FILE || nodePath.join(__dirname, '..', '..', 'assets', 'ui', 'qr_nap.jpg'); try { return fs.existsSync(f) ? f : null; } catch (_) { return null; } };
const payReady = () => bank().ready || !!qrFile();
const ownerName = () => bank().name || (qrFile() ? QR_OWNER : '');
/** Ảnh VietQR (dịch vụ img.vietqr.io) — chỉ là đường dẫn ảnh cho Discord tải, bot không gọi mạng. */
const qrUrl = (order) => { const b = bank(); return b.ready ? `https://img.vietqr.io/image/${b.id}-${b.acc}-compact2.png?amount=${order.vnd}&addInfo=${encodeURIComponent(code(order.id))}&accountName=${encodeURIComponent(b.name)}` : null; };
const code = (id) => `TG${id}`;

function log(admin, action, target, detail) { try { require('./admin17').log(admin, action, target, detail); } catch (_) { /* nhật ký không được làm hỏng thao tác */ } }

// ---------------------------------------------------------------- danh mục cửa hàng
const GROUPS = [
  ['DAN_DUOC', 'Đan Dược', '💊'], ['LINH_DUOC', 'Linh Dược', '🌿'], ['LINH_THUC', 'Linh Thực', '🍚'], ['KHOANG_VAT', 'Khoáng Vật', '⛏️'],
  ['YEU_THU_TAI_LIEU', 'Tài Liệu Yêu Thú', '🐺'], ['TRAN_DAO_TAI_LIEU', 'Tài Liệu Trận Đạo', '🔯'], ['LINH_TINH_TAI_LIEU', 'Linh Tinh Tài Liệu', '🌠'],
  ['THIEN_DIA_CHI_BAO', 'Thiên Địa Chí Bảo', '💎'], ['NGUYEN_LIEU_TRUNG_GIAN', 'Nguyên Liệu Trung Gian', '🧪'], ['TRAN_PHAP', 'Trận Pháp', '🧿'],
  ['VAT_PHAM_KHAC', 'Vật Phẩm Khác', '📦'], ['TALENT', 'Thiên Bảo & Truyền Thừa Ngọc Giản', '📜'], ['PET', 'Vật Phẩm Linh Thú', '🐉'], ['GEAR', 'Trang Bị', '⚔️'],
];
const GROUP_BY = Object.fromEntries(GROUPS.map(([k, n, e]) => [k, { key: k, name: n, emoji: e }]));
/** Giá cố định (Nguyên Bảo) cho vật phẩm Thiên Bảo / Truyền Thừa — chúng không có "giá trị" trong danh mục. */
const TALENT_NB = { bao_the_chat: 150, bao_linh_can: 150, truyen_thua: 400 };
const QMULT = [1, 0.7, 1, 1.6, 2.8, 5];   // Hạ / Trung / Thượng / Cực / Thánh phẩm
/** Công thức giá: tăng theo căn bậc hai của giá trị gốc (để đồ ở giai đoạn 10 không đắt gấp triệu lần đồ giai đoạn 1). */
const nbFromBase = (base) => Math.max(1, Math.ceil(2 * Math.sqrt(Math.max(0, base) / 1000)));

let CACHE = null;
function build() {
  if (CACHE) return CACHE;
  const list = [];
  for (const it of I.ITEMS) {
    if (it.is_quest_item || !GROUP_BY[it.cat]) continue;
    const special = !it.can_sell;   // hàng "không bán lại NPC" (Đan Tẩy Tủy, vật liệu Chứng Đạo…) → giá ×3 vì chỉ rơi từ nội dung khó
    list.push({ key: `i:${it.id}`, kind: 'inv', ref: it.id, name: it.name, group: it.cat, rarity: it.rarity || 1, hasQ: !!it.quality, base: nbFromBase(it.base_value) * (special ? 3 : 1), desc: it.desc || '' });
  }
  try {
    const TO = require('./talentOps');
    for (const [k, v] of Object.entries(TO.ITEM)) list.push({ key: `t:${k}`, kind: 'talent', ref: k, name: v.name, group: 'TALENT', rarity: 5, hasQ: false, base: TALENT_NB[k] || 200, desc: k === 'truyen_thua' ? 'Truyền Thừa Ngọc Giản — dùng để thức tỉnh / tiến hoá Thể Chất & Linh Căn.' : 'Thiên Bảo — dùng để thức tỉnh / tiến hoá.' });
  } catch (_) { /* talentOps lỗi → bỏ nhóm */ }
  try {
    const PB = require('./petBalance');
    for (const [k, v] of Object.entries(PB.ITEMS)) list.push({ key: `p:${k}`, kind: 'pet', ref: k, name: v.name, group: 'PET', rarity: 2, hasQ: false, base: nbFromBase(v.price), desc: v.desc || '' });
  } catch (_) { /* petBalance lỗi → bỏ nhóm */ }
  for (const [tid, t] of Object.entries(C.GEAR)) {
    const gv = Cat.GEAR_VALUE[tid]; if (!gv) continue;
    list.push({ key: `g:${tid}`, kind: 'gear', ref: tid, name: t.name, group: 'GEAR', rarity: Math.min(6, 1 + Math.ceil(t.tier / 2)), hasQ: true, base: nbFromBase(gv.base_value), desc: `Bậc ${t.tier} · ${t.slot} · yêu cầu cảnh giới #${t.realm}` });
  }
  const by = new Map(); list.forEach((e) => by.set(e.key, e));
  CACHE = { list, by };
  return CACHE;
}
const entry = (key) => build().by.get(key) || null;
/** Giá 1 đơn vị (Nguyên Bảo) — đã nhân hệ số admin. q = phẩm chất (chỉ với hàng có phẩm). */
function price(e, q = 2) {
  const qm = e.hasQ ? (QMULT[q] || 1) : 1;
  return Math.max(1, Math.ceil(e.base * qm * mult()));
}
const defaultQ = (e) => (e.hasQ ? 2 : 0);
/** Danh sách theo nhóm (đã bỏ hàng bị ẩn), lọc tên, sắp theo giá tăng dần. */
function listGroup(group, filter = '') {
  const hid = hidden(); const f = String(filter || '').trim().toLowerCase();
  const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  const fn = strip(f);
  return build().list.filter((e) => (!group || e.group === group) && !hid.has(e.key) && (!fn || strip(e.name.toLowerCase()).includes(fn))).sort((a, b) => a.base - b.base || a.name.localeCompare(b.name));
}
const countGroup = (group) => build().list.filter((e) => e.group === group && !hidden().has(e.key)).length;
const isHidden = (key) => hidden().has(key);
function toggleHide(admin, key) {
  const e = entry(key); if (!e) return { ok: false, msg: '❌ Không tìm thấy mặt hàng (dùng mã như `i:dan_tu_khi`, `g:gx_thanh_phong`, `t:truyen_thua`, `p:bat_phu`).' };
  const h = hidden(); const off = !h.has(key); if (off) h.add(key); else h.delete(key); setHidden(h);
  log(admin, off ? 'shop_hide' : 'shop_show', '', key);
  return { ok: true, msg: off ? `🙈 Đã **ẩn** ${e.name} khỏi cửa hàng.` : `👁️ Đã **hiện** lại ${e.name} trong cửa hàng.` };
}
/** Tìm mặt hàng theo mã hoặc tên (cho admin). */
function findEntry(text) {
  const t = String(text || '').trim(); if (!t) return null;
  if (entry(t)) return entry(t);
  const l = build().list; const lo = t.toLowerCase();
  return l.find((e) => e.ref === t) || l.find((e) => e.name.toLowerCase() === lo) || l.find((e) => e.name.toLowerCase().includes(lo)) || null;
}

// ---------------------------------------------------------------- ví
const wallet = (user) => D.get('SELECT * FROM v21_wallet WHERE user_id = ?', uid(user)) || { user_id: uid(user), nb: 0, topped: 0, spent: 0, vnd: 0 };
const balance = (user) => wallet(user).nb;
function addLedger(user, delta, why, admin = '') { D.run('INSERT INTO v21_ledger (user_id, delta, why, admin_id, at) VALUES (?,?,?,?,?)', uid(user), int(delta), String(why).slice(0, 200), String(admin || ''), now()); }
function credit(user, n, why, admin = '', { topped = false, vndPaid = 0 } = {}) {
  n = int(n); if (!(n > 0)) return false;
  D.run('INSERT INTO v21_wallet (user_id, nb, topped, spent, vnd) VALUES (?,?,?,0,?) ON CONFLICT(user_id) DO UPDATE SET nb = nb + excluded.nb, topped = topped + ?, vnd = vnd + ?', uid(user), n, topped ? n : 0, vndPaid, topped ? n : 0, vndPaid);
  addLedger(user, n, why, admin); return true;
}
/** Trừ có điều kiện (không bao giờ âm). */
function spend(user, n, why) {
  n = int(n); if (!(n > 0)) return false;
  const r = D.run('UPDATE v21_wallet SET nb = nb - ?, spent = spent + ? WHERE user_id = ? AND nb >= ?', n, n, uid(user), n);
  if (!r.changes) return false; addLedger(user, -n, why); return true;
}

// ---------------------------------------------------------------- mua hàng
function give(user, e, q, n) {
  switch (e.kind) {
    case 'inv': return Inv.add(user, e.ref, n, { q, why: 'cửa hàng' });
    case 'talent': { require('./talentOps').grant(user, { [e.ref]: n }); return n; }
    case 'pet': { const P = require('./pets'); P.addItem(user, e.ref, n); return n; }
    case 'gear': { const G = require('./gear17'); for (let k = 0; k < n; k += 1) G.create(user, e.ref, q, 'cửa hàng'); return n; }
    default: return 0;
  }
}
function buy(user, key, q, n) {
  if (!shopOn()) return { ok: false, msg: '🚧 Cửa hàng đang tạm đóng.' };
  const e = entry(key); if (!e || isHidden(key)) return { ok: false, msg: '❌ Mặt hàng không tồn tại hoặc không còn bán.' };
  n = int(n); if (!(n > 0)) return { ok: false, msg: '❌ Số lượng không hợp lệ.' };
  n = Math.min(n, MAX_QTY[e.kind] || 1);
  q = e.hasQ ? Math.min(5, Math.max(1, int(q) || 2)) : 0;
  if (!Cu.getCultivator(user)) return { ok: false, msg: '❌ Bạn chưa bắt đầu tu tiên.' };
  return D.transaction(() => {
    const unit = price(e, q); const total = unit * n;
    if (balance(user) < total) return { ok: false, msg: `❌ Cần **${fmtNum(total)}** 💠 Nguyên Bảo (bạn có ${fmtNum(balance(user))}). Dùng nút **Nạp** để nạp thêm.` };
    const got = give(user, e, q, n);
    if (!(got > 0)) return { ok: false, msg: `❌ Kho đã đầy — không nhận thêm **${e.name}** được. (Không bị trừ Nguyên Bảo.)` };
    const cost = unit * got;
    if (!spend(user, cost, `mua ${key}×${got}`)) throw new Error('trừ Nguyên Bảo thất bại');
    D.run('INSERT INTO v21_buys (user_id, key, q, qty, cost, at) VALUES (?,?,?,?,?,?)', uid(user), key, q, got, cost, now());
    const part = got < n ? ` _(kho chỉ chứa thêm được ${got}/${n}, chỉ tính tiền ${got})_` : '';
    return { ok: true, got, cost, msg: `🛒 Đã mua **${e.name}${e.hasQ ? ` (${I.qName(q)})` : ''} ×${fmtNum(got)}** — −${fmtNum(cost)} 💠. Số dư còn **${fmtNum(balance(user))}** 💠.${part}` };
  });
}

// ---------------------------------------------------------------- đơn nạp
function expireOld() { D.run("UPDATE v21_orders SET status = 'expired', note = 'Quá 24 giờ chưa xác nhận' WHERE status = 'pending' AND created_at < ?", now() - ORDER_TTL); }
const order = (id) => D.get('SELECT * FROM v21_orders WHERE id = ?', int(id)) || null;
const ordersOf = (user, n = 8) => { expireOld(); return D.all('SELECT * FROM v21_orders WHERE user_id = ? ORDER BY id DESC LIMIT ?', uid(user), n); };
function createOrder(user, vndAmount) {
  if (!shopOn()) return { ok: false, msg: '🚧 Cửa hàng đang tạm đóng.' };
  const p = pkgOf(vndAmount); if (!p) return { ok: false, msg: '❌ Gói nạp không hợp lệ.' };
  if (!payReady()) return { ok: false, msg: '🚧 Admin chưa cài cách nhận tiền (mã QR hoặc tài khoản) nên chưa nạp được. Hãy báo admin.' };
  if (!Cu.getCultivator(user)) return { ok: false, msg: '❌ Bạn chưa bắt đầu tu tiên.' };
  return D.transaction(() => {
    expireOld();
    const open = D.get("SELECT COUNT(*) AS n FROM v21_orders WHERE user_id = ? AND status = 'pending'", uid(user)).n;
    if (open >= MAX_PENDING) return { ok: false, msg: `❌ Bạn đang có ${open} đơn chờ xác nhận (tối đa ${MAX_PENDING}). Hãy huỷ bớt hoặc chờ admin xử lý.` };
    const r = D.run('INSERT INTO v21_orders (user_id, vnd, nb, created_at) VALUES (?,?,?,?)', uid(user), p.vnd, pkgNb(p), now());
    return { ok: true, id: Number(r.lastInsertRowid), order: order(Number(r.lastInsertRowid)) };
  });
}
/** Người chơi báo "đã chuyển khoản" (chỉ để admin ưu tiên — KHÔNG cộng tiền). */
function claim(user, id) {
  const r = D.run("UPDATE v21_orders SET claimed = 1 WHERE id = ? AND user_id = ? AND status = 'pending'", int(id), uid(user));
  return r.changes ? { ok: true, order: order(id) } : { ok: false, msg: '❌ Đơn không còn ở trạng thái chờ.' };
}
function cancelOwn(user, id) {
  const r = D.run("UPDATE v21_orders SET status = 'cancelled', note = 'Người chơi huỷ' WHERE id = ? AND user_id = ? AND status = 'pending' AND claimed = 0", int(id), uid(user));
  return r.changes ? { ok: true } : { ok: false, msg: '❌ Không huỷ được (đơn đã báo chuyển khoản hoặc không còn chờ — hãy hỏi admin).' };
}
const pendingOrders = (n = 25) => { expireOld(); return D.all("SELECT * FROM v21_orders WHERE status = 'pending' ORDER BY claimed DESC, id ASC LIMIT ?", n); };
const pendingCount = () => { expireOld(); return D.get("SELECT COUNT(*) AS n FROM v21_orders WHERE status = 'pending'").n; };
/** DONE ĐƠN — chỉ admin gọi. Idempotent: một đơn chỉ được cộng đúng 1 lần. */
function confirm(admin, id, note = '') {
  return D.transaction(() => {
    const o = order(id); if (!o) return { ok: false, msg: '❌ Không có đơn này.' };
    if (o.status === 'done') return { ok: false, msg: `ℹ️ Đơn #${o.id} đã được xác nhận trước đó — không cộng lần nữa.` };
    // cho phép xác nhận đơn "expired" (khách chuyển muộn) nhưng không cho đơn đã huỷ
    if (o.status === 'cancelled') return { ok: false, msg: `❌ Đơn #${o.id} đã bị huỷ.` };
    const r = D.run("UPDATE v21_orders SET status = 'done', done_at = ?, admin_id = ?, note = ? WHERE id = ? AND status IN ('pending','expired')", now(), uid(admin), String(note).slice(0, 200), o.id);
    if (!r.changes) return { ok: false, msg: '❌ Đơn đã thay đổi trạng thái.' };
    if (o.kind === 'item') {   // đơn mua trực tiếp: giao hàng, KHÔNG cộng ví
      const e = entry(o.item_key); let got = 0;
      if (e) { try { got = give(o.user_id, e, o.item_q, o.item_qty) || 0; } catch (err) { throw new Error(`giao hàng lỗi: ${err.message}`); } }
      const rest = o.item_qty - got; const unit = e ? price(e, o.item_q) : 0;
      // phần không nhận được (kho đầy / mặt hàng không còn) → hoàn thành Nguyên Bảo vào ví, không để khách mất tiền
      if (rest > 0) credit(o.user_id, e ? unit * rest : o.nb, `hoàn phần chưa giao đơn #${o.id}`, admin);
      D.run('INSERT INTO v21_buys (user_id, key, q, qty, cost, at) VALUES (?,?,?,?,?,?)', uid(o.user_id), o.item_key, o.item_q, got, o.nb, now());
      log(admin, 'shop_done', o.user_id, `đơn #${o.id} ${vnd(o.vnd)} → giao ${o.item_key}×${got}`);
      return { ok: true, order: order(o.id), delivered: got, refunded: rest > 0, msg: `✅ Đã **done đơn #${o.id}**: giao **${e ? e.name : o.item_key} ×${fmtNum(got)}** cho <@${o.user_id}> (${vnd(o.vnd)}).${rest > 0 ? `\n⚠️ Kho khách chỉ nhận được ${got}/${o.item_qty} — phần còn lại đã hoàn thành 💠 vào ví.` : ''}` };
    }
    credit(o.user_id, o.nb, `nạp đơn #${o.id} (${vnd(o.vnd)})`, admin, { topped: true, vndPaid: o.vnd });
    log(admin, 'shop_done', o.user_id, `đơn #${o.id} ${vnd(o.vnd)} → +${o.nb} NB`);
    return { ok: true, order: order(o.id), msg: `✅ Đã **done đơn #${o.id}**: <@${o.user_id}> +**${fmtNum(o.nb)}** 💠 (${vnd(o.vnd)}). Số dư mới **${fmtNum(balance(o.user_id))}** 💠.` };
  });
}
/** v21.2 — ĐƠN MUA TRỰC TIẾP (`.od`): khách trả tiền thật cho ĐÚNG 1 món (không qua ví). Admin Done → bot giao hàng. 1 Nguyên Bảo = 100đ, tối thiểu 1.000đ. */
const NB_VND = 100; const MIN_ITEM_VND = 1000;
function createItemOrder(customer, key, q, qty, { bypassLimit = false, by = '' } = {}) {
  if (!shopOn()) return { ok: false, msg: '🚧 Cửa hàng đang tạm đóng.' };
  const e = entry(key); if (!e || isHidden(key)) return { ok: false, msg: '❌ Mặt hàng không tồn tại hoặc không còn bán.' };
  if (!payReady()) return { ok: false, msg: '🚧 Admin chưa cài cách nhận tiền (mã QR hoặc tài khoản) nên chưa tạo đơn được.' };
  if (!Cu.getCultivator(customer)) return { ok: false, msg: '❌ Khách chưa bắt đầu tu tiên (`/batdau`).' };
  qty = Math.min(MAX_QTY[e.kind] || 1, Math.max(1, int(qty) || 1)); q = e.hasQ ? Math.min(5, Math.max(1, int(q) || 2)) : 0;
  const nb = price(e, q) * qty; const money = Math.max(MIN_ITEM_VND, nb * NB_VND);
  return D.transaction(() => {
    expireOld();
    const open = D.get("SELECT COUNT(*) AS n FROM v21_orders WHERE user_id = ? AND status = 'pending'", uid(customer)).n;
    if (open >= (bypassLimit ? 10 : MAX_PENDING)) return { ok: false, msg: `❌ Khách đang có ${open} đơn chờ xác nhận (tối đa ${bypassLimit ? 10 : MAX_PENDING}). Hãy xử lý/huỷ bớt.` };
    const r = D.run("INSERT INTO v21_orders (user_id, vnd, nb, created_at, kind, item_key, item_q, item_qty, note) VALUES (?,?,?,?,'item',?,?,?,?)", uid(customer), money, nb, now(), key, q, qty, by ? `Tạo bởi ${by}` : '');
    return { ok: true, id: Number(r.lastInsertRowid), order: order(Number(r.lastInsertRowid)), entry: e };
  });
}
/** Mô tả ngắn của đơn (nạp hoặc mua trực tiếp). */
function orderText(o) {
  if (o.kind !== 'item') return `Nạp ${vnd(o.vnd)} → ${fmtNum(o.nb)} 💠`;
  const e = entry(o.item_key);
  return `🛒 ${e ? e.name : o.item_key}${e && e.hasQ ? ` (${I.qName(o.item_q)})` : ''} ×${fmtNum(o.item_qty)} — ${vnd(o.vnd)}`;
}
const ALIAS = { truyenthua: 't:truyen_thua', tt: 't:truyen_thua', ngocgian: 't:truyen_thua', truyenthuangocgian: 't:truyen_thua', thienbaothechat: 't:bao_the_chat', baothechat: 't:bao_the_chat', thienbaolinhcan: 't:bao_linh_can', baolinhcan: 't:bao_linh_can' };
/** Tìm mặt hàng từ chữ gõ trong `.od`: mã (i:/t:/p:/g:), tên không dấu; trả {entry} | {many:[...]} | {none:true}. */
function resolveItem(text) {
  const t = String(text || '').trim(); if (!t) return { none: true };
  if (/^[itpg]:/i.test(t)) { const e = entry(t.replace(/^(.)/, (m) => m.toLowerCase())); return e && !isHidden(e.key) ? { entry: e } : { none: true }; }
  const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
  const f = strip(t);
  const al = ALIAS[f.replace(/ /g, '')]; if (al && entry(al) && !isHidden(al)) return { entry: entry(al) };   // gõ tắt (VD "truyền thừa" → Truyền Thừa Ngọc Giản, không lẫn với vật phẩm cùng chữ)
  const all = listGroup('', t);
  const exact = all.filter((e) => strip(e.name) === f); if (exact.length === 1) return { entry: exact[0] };
  if (all.length === 1) return { entry: all[0] };
  return all.length ? { many: all.slice(0, 10), total: all.length } : { none: true };
}
function adminCancel(admin, id, note = '') {
  const o = order(id); if (!o) return { ok: false, msg: '❌ Không có đơn này.' };
  const r = D.run("UPDATE v21_orders SET status = 'cancelled', admin_id = ?, note = ? WHERE id = ? AND status = 'pending'", uid(admin), String(note || 'Admin huỷ').slice(0, 200), o.id);
  if (!r.changes) return { ok: false, msg: `❌ Đơn #${o.id} không ở trạng thái chờ (${o.status}).` };
  log(admin, 'shop_cancel', o.user_id, `đơn #${o.id}`);
  return { ok: true, order: order(o.id), msg: `🚫 Đã huỷ đơn #${o.id}.` };
}
/** Cộng/trừ Nguyên Bảo thủ công (admin). delta có thể âm; không cho số dư âm. */
function adminGrant(admin, user, delta, why = '') {
  delta = int(delta); if (!delta) return { ok: false, msg: '❌ Số lượng phải khác 0.' };
  if (!Cu.getCultivator(user)) return { ok: false, msg: '❌ Người chơi chưa bắt đầu tu tiên.' };
  return D.transaction(() => {
    if (delta > 0) credit(user, delta, `admin cộng${why ? `: ${why}` : ''}`, admin);
    else { if (balance(user) < -delta) return { ok: false, msg: `❌ Người này chỉ có ${fmtNum(balance(user))} 💠.` }; if (!spend(user, -delta, `admin trừ${why ? `: ${why}` : ''}`)) return { ok: false, msg: '❌ Trừ thất bại.' }; }
    log(admin, 'shop_grant', user, `${delta > 0 ? '+' : ''}${delta} NB ${why}`);
    return { ok: true, msg: `✅ ${delta > 0 ? 'Cộng' : 'Trừ'} **${fmtNum(Math.abs(delta))}** 💠 ${delta > 0 ? 'cho' : 'của'} <@${user}>. Số dư **${fmtNum(balance(user))}** 💠.` };
  });
}
function setMult(admin, v) {
  const x = Number(String(v).replace(',', '.')); if (!(x >= 0.1 && x <= 20)) return { ok: false, msg: '❌ Hệ số giá phải từ 0.1 đến 20.' };
  ST.set('shop21_mult', x); log(admin, 'shop_mult', '', String(x)); return { ok: true, msg: `✅ Hệ số giá cửa hàng = **×${x}**.` };
}
function setOpen(admin, on) { ST.set('shop21_on', on ? '1' : '0'); log(admin, on ? 'shop_open' : 'shop_close', '', ''); return { ok: true, msg: on ? '🟢 Đã MỞ cửa hàng.' : '🔴 Đã ĐÓNG cửa hàng (không mua/nạp được).' }; }
/** Thống kê cho admin: doanh thu đã xác nhận hôm nay / 30 ngày / tổng. */
function stats() {
  const t = now(); const day = t - ((t + 7 * 3600) % DAY);   // 0h giờ Việt Nam
  const sum = (since) => D.get("SELECT COALESCE(SUM(vnd),0) AS v, COUNT(*) AS n FROM v21_orders WHERE status = 'done' AND done_at >= ?", since);
  return { today: sum(day), d30: sum(t - 30 * DAY), all: sum(0), pending: pendingCount(), buys: D.get('SELECT COUNT(*) AS n, COALESCE(SUM(cost),0) AS c FROM v21_buys').n };
}

module.exports = {
  PACKAGES, pkgNb, pkgOf, vnd, ORDER_TTL, MAX_PENDING, MAX_QTY, GROUPS, GROUP_BY, QMULT,
  bank, setBank, qrUrl, qrFile, payReady, ownerName, QR_OWNER, code, mult, shopOn, setMult, setOpen, nbFromBase,
  build, entry, price, defaultQ, listGroup, countGroup, isHidden, toggleHide, findEntry,
  wallet, balance, credit, spend, buy,
  order, ordersOf, createOrder, createItemOrder, orderText, resolveItem, NB_VND, MIN_ITEM_VND, claim, cancelOwn, pendingOrders, pendingCount, confirm, adminCancel, adminGrant, stats,
};
