'use strict';
/**
 * TuTienStore — đơn hàng, đối soát thanh toán, giao hàng.
 * Nguyên tắc an toàn:
 *  • Chỉ tin giao dịch ngân hàng thật (webhook SePay có API key) hoặc admin xác nhận tay — KHÔNG tin ảnh chuyển khoản.
 *  • Mỗi giao dịch (tx_id) xử lý đúng 1 lần; mỗi đơn chỉ "chiếm" để giao đúng 1 lần (UPDATE có điều kiện trạng thái).
 *  • Giao hàng theo từng bước, ghi lại grant_step trong cùng transaction với việc cộng đồ → lỗi giữa chừng thì giao lại không bị cộng đôi.
 */
const crypto = require('node:crypto');
const D = require('../db');
const K = require('../game/constants');
const Cu = require('../game/cultivator');
const { Delta } = Cu;
const CFG = require('./config');
const CAT = require('./catalog');
const Schema = require('./schema');
const Wallet = require('./wallet');
const { now, fmtNum } = require('../util');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // bỏ O/0/I/1 cho khỏi gõ nhầm
const CODE_BODY = 7;
const MIN_AMOUNT = 2000;
const MAX_AMOUNT = 500000000;

const fail = (msg) => ({ ok: false, msg });
const getOrder = (code) => { Schema.ensure(); return D.get('SELECT * FROM store_orders WHERE code = ?', String(code || '').toUpperCase()) || null; };

function newCode(prefix) {
  for (let n = 0; n < 50; n += 1) {
    let s = prefix; for (let i = 0; i < CODE_BODY; i += 1) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
    if (!D.get('SELECT 1 AS x FROM store_orders WHERE code = ?', s)) return s;
  }
  throw new Error('Không tạo được mã đơn duy nhất');
}
/** 00:00 hôm nay theo giờ Việt Nam (UTC+7), dạng giây. */
function startOfDayVN() { const d = new Date(Date.now() + 7 * 3600e3); d.setUTCHours(0, 0, 0, 0); return d.getTime() / 1000 - 7 * 3600; }

function dailyLimitMsg(uid, p, qty) {
  if (!p.dailyLimit) return '';
  const used = D.get("SELECT COALESCE(SUM(qty), 0) AS q FROM store_orders WHERE user_id = ? AND product_id = ? AND created_at >= ? AND status IN ('pending','delivering','delivered','error')", String(uid), p.id, startOfDayVN()).q;
  return used + qty > p.dailyLimit ? `**${p.name}** chỉ mua tối đa ${p.dailyLimit} gói/ngày (hôm nay bạn đã đặt ${used}).` : '';
}

// ============================================================ TẠO / HUỶ ĐƠN
function createOrder(userId, productId, qty = 1) {
  Schema.ensure();
  const cfg = CFG.get();
  if (!CFG.payReady(cfg)) return fail('Cửa hàng chưa cấu hình tài khoản nhận tiền — vui lòng liên hệ admin.');
  const row = Cu.getCultivator(userId);
  if (!row) return fail('Bạn chưa bắt đầu tu tiên, dùng `/batdau` trước.');
  const p = CAT.get(productId);
  if (!p || !p.enabled) return fail('Sản phẩm này hiện không còn bán.');
  qty = p.unique ? 1 : Math.max(1, Math.min(p.maxQty, Math.floor(Number(qty) || 1)));
  const blocked = CAT.blockReason(p, row); if (blocked) return fail(blocked);

  const uid = String(userId);
  const pend = D.all("SELECT code, product_id FROM store_orders WHERE user_id = ? AND status = 'pending'", uid);
  if (pend.length >= cfg.maxPending) return fail(`Bạn đang có ${pend.length} đơn chờ thanh toán (tối đa ${cfg.maxPending}). Hãy thanh toán hoặc huỷ bớt trong \`/donhang\`.`);
  if (p.unique && pend.some((o) => o.product_id === p.id)) return fail('Bạn đã có đơn chờ thanh toán cho sản phẩm này — xem `/donhang`.');
  const lim = dailyLimitMsg(uid, p, qty); if (lim) return fail(lim);
  const amount = Math.round(p.price * qty);
  if (!(amount >= MIN_AMOUNT) || amount > MAX_AMOUNT) return fail(`Giá trị đơn không hợp lệ (${CAT.vnd(amount)}). Liên hệ admin.`);

  const code = newCode(cfg.prefix);
  const t = now();
  D.run('INSERT INTO store_orders (code, user_id, product_id, product_name, qty, amount, status, grants, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    code, uid, p.id, p.name, qty, amount, 'pending', JSON.stringify(CAT.expand(p, qty)), t, t + cfg.ttlMin * 60);
  return { ok: true, order: getOrder(code), product: p };
}

/** Đơn NẠP Thiên Tệ theo số tiền tuỳ ý (có thưởng theo bậc). */
function createTopupOrder(userId, amount) {
  Schema.ensure();
  const cfg = CFG.get();
  if (!CFG.payReady(cfg)) return fail('Cửa hàng chưa cấu hình tài khoản nhận tiền — vui lòng liên hệ admin.');
  if (!Cu.getCultivator(userId)) return fail('Bạn chưa bắt đầu tu tiên, dùng `/batdau` trước.');
  const q = require('./topup').quote(amount); if (!q.ok) return fail(q.msg);
  const uid = String(userId);
  const pend = D.all("SELECT code FROM store_orders WHERE user_id = ? AND status = 'pending'", uid);
  if (pend.length >= cfg.maxPending) return fail(`Bạn đang có ${pend.length} đơn chờ thanh toán (tối đa ${cfg.maxPending}). Hãy thanh toán hoặc huỷ bớt trong \`/donhang\`.`);
  const code = newCode(cfg.prefix); const t = now();
  const label = `${Wallet.ICON} ${Wallet.NAME} ×${fmtNum(q.total)}${q.pct ? ` (đã gồm +${q.pct}% thưởng nạp)` : ''}`;
  D.run('INSERT INTO store_orders (code, user_id, product_id, product_name, qty, amount, status, grants, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    code, uid, 'topup', `Nạp ${CAT.vnd(q.amount)} → ${Wallet.NAME}`, 1, q.amount, 'pending', JSON.stringify([{ t: 'tt', n: q.total, label }]), t, t + cfg.ttlMin * 60);
  return { ok: true, order: getOrder(code), quote: q };
}

/** Người chơi huỷ đơn của mình (chỉ khi chưa trả tiền). Admin: truyền byAdmin=true để huỷ đơn bất kỳ. */
function cancelOrder(userId, code, byAdmin = false) {
  const o = getOrder(code);
  if (!o || (!byAdmin && String(o.user_id) !== String(userId))) return fail('Không tìm thấy đơn này.');
  const changed = D.run("UPDATE store_orders SET status = 'cancelled', note = ? WHERE code = ? AND status IN ('pending','expired')", byAdmin ? `huỷ bởi admin ${userId}` : 'khách tự huỷ', o.code).changes;
  if (!changed) return fail(`Đơn \`${o.code}\` đang ở trạng thái **${o.status}** nên không huỷ được.`);
  return { ok: true, order: getOrder(o.code) };
}
const ordersOf = (userId, limit = 8) => { Schema.ensure(); return D.all('SELECT * FROM store_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', String(userId), limit); };
/** Đơn chờ/lỗi để admin xử lý. */
const openOrders = (limit = 15) => { Schema.ensure(); return D.all("SELECT * FROM store_orders WHERE status IN ('pending','expired','error','delivering') ORDER BY created_at DESC LIMIT ?", limit); };
function sweepExpired() { Schema.ensure(); return D.run("UPDATE store_orders SET status = 'expired' WHERE status = 'pending' AND expires_at < ?", now()).changes; }

// ============================================================ MUA BẰNG THIÊN TỆ
/** Giá vật phẩm bằng Thiên Tệ cho số lượng qty (theo giá VNĐ hiện hành × tỉ lệ gốc). */
const ttPrice = (p, qty = 1) => Wallet.ttOf(p.price) * (p.unique ? 1 : qty);

/**
 * Mua ngay bằng Thiên Tệ: trừ ví + tạo đơn trong 1 transaction → giao hàng. Giao lỗi mà chưa giao gì thì TỰ HOÀN Thiên Tệ.
 * Trả { ok, order, lines, balance } hoặc { ok:false, msg }.
 */
function buyWithWallet(userId, productId, qty = 1) {
  Schema.ensure();
  const cfg = CFG.get();
  const row = Cu.getCultivator(userId);
  if (!row) return fail('Bạn chưa bắt đầu tu tiên, dùng `/batdau` trước.');
  const p = CAT.get(productId);
  if (!p || !p.enabled) return fail('Sản phẩm này hiện không còn bán.');
  qty = p.unique ? 1 : Math.max(1, Math.min(p.maxQty, Math.floor(Number(qty) || 1)));
  const blocked = CAT.blockReason(p, row); if (blocked) return fail(blocked);
  const lim = dailyLimitMsg(userId, p, qty); if (lim) return fail(lim);

  const cost = ttPrice(p, qty); const bal = Wallet.balance(userId);
  if (bal < cost) return fail(`Không đủ ${Wallet.NAME}: cần **${fmtNum(cost)}**, bạn có **${fmtNum(bal)}** (thiếu ${fmtNum(cost - bal)}). Nạp thêm trong mục 💰 Nạp ${Wallet.NAME}.`);
  const code = newCode(cfg.prefix); const t = now();
  try {
    D.transaction(() => {
      if (!Wallet.debit(userId, cost, 'buy', code, p.name)) throw new Error('NOFUNDS');
      D.run("INSERT INTO store_orders (code, user_id, product_id, product_name, qty, amount, status, grants, created_at, expires_at, paid_at, pay_by, tt_cost) VALUES (?, ?, ?, ?, ?, 0, 'delivering', ?, ?, ?, ?, 'wallet', ?)",
        code, String(userId), p.id, p.name, qty, JSON.stringify(CAT.expand(p, qty)), t, t, t, cost);
    });
  } catch (e) { return fail(String(e && e.message) === 'NOFUNDS' ? `Không đủ ${Wallet.NAME} (số dư vừa thay đổi), thử lại.` : 'Không tạo được đơn, thử lại sau.'); }

  const r = deliver(code);
  if (r.ok) return { ok: true, order: r.order, lines: r.lines, cost, balance: Wallet.balance(userId) };
  if ((r.order && r.order.grant_step) === 0) {                     // chưa giao gì → hoàn tiền ảo, đóng đơn
    refundWalletOrder(code, 'tự hoàn: giao lỗi — ' + r.error);
    return { ok: false, refunded: true, order: getOrder(code), error: r.error, msg: `Giao hàng thất bại nên đã **hoàn ${fmtNum(cost)} ${Wallet.NAME}** cho bạn. Lý do: ${r.error}` };
  }
  return { ok: false, refunded: false, order: r.order, error: r.error, msg: 'Đã trừ Thiên Tệ nhưng giao hàng gặp sự cố — admin đã được báo và sẽ xử lý.' };
}

/** Hoàn Thiên Tệ của 1 đơn mua-bằng-ví (đơn lỗi / admin quyết định) và đóng đơn. Hoàn tối đa 1 lần/đơn (UNIQUE sổ cái). */
function refundWalletOrder(code, note = '') {
  const o = getOrder(code);
  if (!o || o.pay_by !== 'wallet' || !(o.tt_cost > 0)) return fail('Đơn này không phải đơn mua bằng Thiên Tệ.');
  if (!['error', 'delivering'].includes(o.status)) return fail(`Đơn đang ở trạng thái **${o.status}** — chỉ hoàn được đơn lỗi.`);
  try {
    D.transaction(() => {
      Wallet.credit(o.user_id, o.tt_cost, 'refund', o.code, note || 'admin hoàn');
      D.run("UPDATE store_orders SET status = 'cancelled', note = ? WHERE code = ?", `đã hoàn ${o.tt_cost} Thiên Tệ — ${note}`.slice(0, 250), o.code);
    });
  } catch (_) { return fail('Đơn này đã được hoàn Thiên Tệ trước đó.'); }
  return { ok: true, order: getOrder(o.code), refunded: o.tt_cost, balance: Wallet.balance(o.user_id) };
}

/** Admin cộng / trừ Thiên Tệ thủ công (số âm = trừ). Luôn ghi sổ cái. */
function adminAdjust(adminId, userId, delta, note = '') {
  delta = Math.round(Number(delta)); if (!delta) return fail('Số Thiên Tệ phải khác 0.');
  if (Math.abs(delta) > 1e9) return fail('Số quá lớn.');
  Schema.ensure();
  try {
    D.transaction(() => {
      if (delta > 0) Wallet.credit(userId, delta, 'admin', '', `admin ${adminId}: ${note}`);
      else if (!Wallet.debit(userId, -delta, 'admin', '', `admin ${adminId}: ${note}`)) throw new Error('NOFUNDS');
    });
  } catch (e) { return fail(String(e && e.message) === 'NOFUNDS' ? 'Số dư người này không đủ để trừ.' : 'Không ghi được.'); }
  return { ok: true, balance: Wallet.balance(userId) };
}

// ============================================================ GIAO HÀNG
const _busy = new Set();

function grantOne(userId, g, code) {
  switch (g.t) {
    case 'col': {
      if (!CAT.COLS.has(g.col) || !(g.n > 0)) throw new Error(`Gói cộng không hợp lệ (${g.col})`);
      if (!Cu.updateCultivator(userId, { [g.col]: new Delta(Math.round(g.n)) })) throw new Error('Nhân vật không còn tồn tại.');
      return;
    }
    case 'tt': {
      if (!(g.n > 0)) throw new Error('Gói Thiên Tệ không hợp lệ');
      Wallet.credit(userId, g.n, 'topup', code, `nạp đơn ${code}`);   // trùng (topup, mã đơn) → UNIQUE chặn, transaction huỷ
      return;
    }
    case 'phapbao': {
      const row = Cu.getCultivator(userId); if (!row) throw new Error('Nhân vật không còn tồn tại.');
      const owned = Cu.ownedPhapbaoTiers(row);
      if (owned.has(g.tier)) throw new Error(`Người chơi đã sở hữu Pháp Bảo tầng ${g.tier} (cần admin đền bù/hoàn tiền).`);
      owned.add(g.tier);
      Cu.updateCultivator(userId, { phap_bao_owned: [...owned].sort((a, b) => a - b).join(',') });
      return;
    }
    case 'congphap': {
      const CP16 = require('../game/congphapV16');
      if (!CP16.grantDirect(userId, Number(g.tier))) throw new Error(`Không cấp được Công Pháp ${g.tier} (đã sở hữu hoặc nhân vật không tồn tại — cần admin xử lý).`);
      return;
    }
    case 'pet_item': {
      const PB = require('../game/petBalance'); const Pets = require('../game/pets');
      if (!PB.ITEMS[g.item] || !(g.n > 0)) throw new Error(`Vật phẩm Linh Thú không hợp lệ (${g.item})`);
      Pets.addItem(userId, g.item, Math.round(g.n));
      return;
    }
    case 'talent': {
      const row = Cu.getCultivator(userId); if (!row) throw new Error('Nhân vật không còn tồn tại.');
      const cur = CAT.talentMult(g.kind, row[g.kind]); const want = CAT.talentMult(g.kind, g.name);
      if (want <= cur) throw new Error(`${CAT.TALENT_LABEL[g.kind]} hiện tại (${row[g.kind]}) đã bằng/cao hơn ${g.name} — không cấp để tránh tụt phẩm (cần admin hoàn tiền/đền bù).`);
      const r = require('../game/adminTalent').give(userId, g.kind, g.name, `store:${code}`);
      if (!r.ok) throw new Error(String(r.msg || 'Không đặt được phẩm cấp.'));
      return;
    }
    default: throw new Error(`Loại quà không hỗ trợ: ${g.t}`);
  }
}

/** Giao hàng cho đơn đã được "chiếm" (status delivering) hoặc đang lỗi. Đồng bộ, an toàn gọi lại (tiếp tục từ grant_step). */
function deliver(code) {
  const o = getOrder(code); if (!o) return { ok: false, error: 'Không có đơn này.' };
  if (!['delivering', 'error'].includes(o.status)) return { ok: false, order: o, error: `Đơn đang ở trạng thái ${o.status}, không giao.` };
  if (_busy.has(o.code)) return { ok: false, order: o, error: 'Đơn đang được xử lý, thử lại sau giây lát.' };
  _busy.add(o.code);
  try {
    D.run("UPDATE store_orders SET status = 'delivering' WHERE code = ?", o.code);
    const grants = JSON.parse(o.grants || '[]'); const lines = [];
    for (let i = 0; i < grants.length; i += 1) {
      const g = grants[i]; lines.push(g.label);
      if (i < o.grant_step) continue;                                  // bước đã giao ở lần trước
      const mark = () => D.run('UPDATE store_orders SET grant_step = ? WHERE code = ?', i + 1, o.code);
      if (g.t === 'talent') { grantOne(o.user_id, g, o.code); mark(); }           // adminTalent.give tự có transaction riêng
      else D.transaction(() => { grantOne(o.user_id, g, o.code); mark(); });        // cộng đồ + ghi bước cùng 1 transaction
    }
    D.run("UPDATE store_orders SET status = 'delivered', delivered_at = ?, note = '' WHERE code = ?", now(), o.code);
    return { ok: true, order: getOrder(o.code), lines };
  } catch (e) {
    const msg = String((e && e.message) || e).slice(0, 300);
    D.run("UPDATE store_orders SET status = 'error', note = ? WHERE code = ?", msg, o.code);
    return { ok: false, order: getOrder(o.code), error: msg };
  } finally { _busy.delete(o.code); }
}

// ============================================================ ĐỐI SOÁT THANH TOÁN
function parseCode(content, prefix) {
  const s = String(content || '').toUpperCase().replace(/[^A-Z0-9]/g, '');   // ngân hàng hay chèn dấu cách/gạch vào nội dung
  const m = new RegExp(`${prefix}[${ALPHABET}]{${CODE_BODY}}`).exec(s);
  return m ? m[0] : null;
}

/**
 * Một giao dịch tiền VÀO tài khoản (từ webhook). Luôn trả object { kind, ... }:
 *  delivered | delivery_error | underpaid | double_paid | paid_cancelled | no_order | no_code | duplicate | ignored
 */
function handlePayment({ txId, amount, content, account }) {
  Schema.ensure();
  const cfg = CFG.get();
  if (account && cfg.account && String(account).replace(/\D/g, '') !== cfg.account.replace(/\D/g, '')) return { kind: 'ignored', reason: 'khác tài khoản nhận' };
  txId = String(txId === undefined || txId === null ? '' : txId).trim();
  if (!txId) return { kind: 'ignored', reason: 'thiếu mã giao dịch' };
  amount = Math.round(Number(amount) || 0);
  if (!(amount > 0)) return { kind: 'ignored', reason: 'số tiền không hợp lệ' };

  const ins = D.run('INSERT OR IGNORE INTO store_tx (tx_id, code, amount, content, result, created_at) VALUES (?, ?, ?, ?, ?, ?)', txId, '', amount, String(content || '').slice(0, 300), 'received', now());
  if (ins.changes === 0) return { kind: 'duplicate' };
  const code = parseCode(content, cfg.prefix);
  const mark = (result) => D.run('UPDATE store_tx SET code = ?, result = ? WHERE tx_id = ?', code || '', result, txId);

  if (!code) { mark('no_code'); return { kind: 'no_code', amount, content }; }
  const o = getOrder(code);
  if (!o) { mark('no_order'); return { kind: 'no_order', code, amount }; }
  if (['delivered', 'delivering', 'error'].includes(o.status)) { mark('double_paid'); return { kind: 'double_paid', order: o, amount }; }
  if (o.status === 'cancelled') { mark('paid_cancelled'); return { kind: 'paid_cancelled', order: o, amount }; }

  const total = (o.paid_amount || 0) + amount;       // cộng dồn nếu khách chuyển thiếu rồi chuyển bù
  if (total < o.amount) {
    D.run('UPDATE store_orders SET paid_amount = ? WHERE code = ?', total, o.code);
    mark('underpaid');
    return { kind: 'underpaid', order: o, amount, total, missing: o.amount - total };
  }
  const claimed = D.run("UPDATE store_orders SET status = 'delivering', paid_at = ?, paid_amount = ?, pay_tx = ?, pay_by = 'sepay' WHERE code = ? AND status IN ('pending','expired')", now(), total, txId, o.code).changes;
  if (claimed !== 1) { mark('race'); return { kind: 'double_paid', order: getOrder(o.code), amount }; }
  mark('paid');
  const r = deliver(o.code);
  return r.ok ? { kind: 'delivered', order: r.order, lines: r.lines, amount, total, over: total - o.amount } : { kind: 'delivery_error', order: r.order, error: r.error, amount, total };
}

/** Admin xác nhận tay (webhook lỗi / khách chuyển khoản sai nội dung đã kiểm tra sao kê). */
function confirmManual(code, adminId, amountOverride = null) {
  const o = getOrder(code); if (!o) return { kind: 'invalid', msg: 'Không tìm thấy mã đơn.' };
  if (!['pending', 'expired', 'cancelled'].includes(o.status)) return { kind: 'invalid', msg: `Đơn đang ở trạng thái **${o.status}** — ${o.status === 'error' ? 'dùng hành động giaolai để giao lại' : 'không thể duyệt'}.` };
  const paid = amountOverride && amountOverride > 0 ? Math.round(amountOverride) : o.amount;
  const claimed = D.run("UPDATE store_orders SET status = 'delivering', paid_at = ?, paid_amount = ?, pay_by = ?, note = '' WHERE code = ? AND status IN ('pending','expired','cancelled')", now(), paid, `admin:${adminId}`, o.code).changes;
  if (claimed !== 1) return { kind: 'invalid', msg: 'Đơn vừa đổi trạng thái, thử lại.' };
  const r = deliver(o.code);
  return r.ok ? { kind: 'delivered', order: r.order, lines: r.lines, amount: paid, manual: true } : { kind: 'delivery_error', order: r.order, error: r.error, amount: paid, manual: true };
}
/** Admin giao lại đơn lỗi (sau khi sửa nguyên nhân). */
function retryDelivery(code) {
  const o = getOrder(code); if (!o) return { kind: 'invalid', msg: 'Không tìm thấy mã đơn.' };
  if (o.status !== 'error') return { kind: 'invalid', msg: `Chỉ giao lại được đơn **error** (đơn này: ${o.status}).` };
  const r = deliver(o.code);
  return r.ok ? { kind: 'delivered', order: r.order, lines: r.lines, amount: o.paid_amount, manual: true } : { kind: 'delivery_error', order: r.order, error: r.error, amount: o.paid_amount, manual: true };
}
/** Giao dịch bị kẹt ở 'received' (bot sập giữa chừng) → xử lý lại. Trả danh sách kết quả. */
function reprocessStuck() {
  Schema.ensure();
  const out = [];
  for (const r of D.all("SELECT tx_id, amount, content FROM store_tx WHERE result = 'received' AND created_at < ?", now() - 120)) {
    D.run('DELETE FROM store_tx WHERE tx_id = ?', r.tx_id);
    out.push(handlePayment({ txId: r.tx_id, amount: r.amount, content: r.content }));
  }
  return out;
}

function stats() {
  Schema.ensure();
  const t0 = startOfDayVN();
  const sum = (since) => D.get("SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS v FROM store_orders WHERE status = 'delivered' AND amount > 0 AND delivered_at >= ?", since);
  return {
    today: sum(t0), week: sum(t0 - 6 * 86400), all: sum(0),
    open: D.get("SELECT COUNT(*) AS n FROM store_orders WHERE status IN ('pending','expired')").n,
    errors: D.get("SELECT COUNT(*) AS n FROM store_orders WHERE status = 'error'").n,
    wallet: Wallet.totals(),
    top: D.all("SELECT user_id, COUNT(*) AS n, SUM(amount) AS v FROM store_orders WHERE status = 'delivered' AND amount > 0 GROUP BY user_id ORDER BY v DESC LIMIT 5"),
  };
}

module.exports = { createOrder, createTopupOrder, buyWithWallet, refundWalletOrder, adminAdjust, ttPrice, cancelOrder, getOrder, ordersOf, openOrders, sweepExpired, deliver, handlePayment, confirmManual, retryDelivery, reprocessStuck, parseCode, stats, ADMINS: () => K.ADMIN_CODE_APPROVER_IDS };
