'use strict';
/** TuTienStore — giao diện cửa hàng (menu chọn danh mục → vật phẩm → tạo đơn → QR). Mọi tin nhắn đều ẨN (ephemeral). */
const { MessageFlags } = require('discord.js');
const { View, showModal } = require('./kit');
const Cu = require('../game/cultivator');
const CAT = require('../store/catalog');
const O = require('../store/orders');
const M = require('../store/messages');
const CFG = require('../store/config');
const Topup = require('../store/topup');
const Wallet = require('../store/wallet');
const S = require('../store');

const EPH = MessageFlags.Ephemeral;
const eph = (i, content) => i.reply({ content, flags: EPH });

/** Dựng payload (embed + components) và dừng view cũ để khỏi tồn đọng bộ nhớ. */
const swap = (i, view, embeds, next, files = []) => { try { view.stop(); } catch (_) { /* bỏ qua */ } return i.update({ embeds, components: next.components(), attachments: [], ...(files.length ? { files } : {}) }); };

function homeView(root, userId) {
  const v = new View({ ownerId: userId, timeout: 900 });
  v.select({
    key: 'cat', row: 0, placeholder: '🏪 Chọn danh mục hàng...',
    options: [{ label: `Nạp ${Wallet.NAME} (thưởng theo mức nạp)`, description: 'Nhập số tiền tuỳ ý — nạp càng nhiều thưởng càng cao', value: 'topup', emoji: Wallet.ICON },
      ...CAT.cats().filter((c) => c.count).map((c) => ({ label: `${c.label} (${c.count})`, description: c.blurb, value: c.key, emoji: c.icon }))],
  }, (i, values, view) => (values[0] === 'topup'
    ? swap(i, view, [M.topupPanel()], topupView(root, userId))
    : swap(i, view, [M.category(values[0], Cu.getCultivator(userId))], categoryView(root, userId, values[0]))));
  v.button({ key: 'wallet', label: `Ví ${Wallet.NAME}`, emoji: Wallet.ICON, style: 'blurple', row: 1 }, (i) => i.reply({ embeds: [M.walletEmbed(userId)], flags: EPH }));
  v.button({ key: 'orders', label: 'Đơn của tôi', emoji: '📒', style: 'grey', row: 1 }, (i) => i.reply({ embeds: [M.orderList(O.ordersOf(userId))], flags: EPH }));
  v.embeds = [M.home(userId)]; return v;
}

function categoryView(root, userId, catKey) {
  const row = Cu.getCultivator(userId); const list = CAT.listCat(catKey);
  const v = new View({ ownerId: userId, timeout: 900 });
  v.select({
    key: 'prod', row: 0, placeholder: 'Chọn vật phẩm để xem chi tiết...',
    options: list.slice(0, 25).map((p) => { const m = CAT.ownedMark(p, row); return { label: `${m === 'owned' ? '✅ ' : m === 'blocked' ? '🔒 ' : ''}${p.name} — ${CAT.vnd(p.price)}`, description: p.short || p.name, value: p.id }; }),
  }, (i, values, view) => swap(i, view, [M.product(CAT.get(values[0]), 1, Cu.getCultivator(userId), userId)], productView(root, userId, values[0], 1, catKey)));
  v.button({ key: 'back', label: 'Về cửa hàng', emoji: '↩️', style: 'grey', row: 1 }, (i, _v, view) => swap(i, view, [M.home(userId)], homeView(root, userId)));
  return v;
}

function productView(root, userId, productId, qty, catKey) {
  const p = CAT.get(productId); const v = new View({ ownerId: userId, timeout: 900 });
  const again = (i, view, q) => swap(i, view, [M.product(CAT.get(productId), q, Cu.getCultivator(userId), userId)], productView(root, userId, productId, q, catKey));
  if (!p.unique) {
    v.button({ key: 'minus', label: '−', style: 'grey', row: 0, disabled: qty <= 1 }, (i, _v, view) => again(i, view, Math.max(1, qty - 1)));
    v.button({ key: 'plus', label: '+', style: 'grey', row: 0, disabled: qty >= p.maxQty }, (i, _v, view) => again(i, view, Math.min(p.maxQty, qty + 1)));
  }
  v.button({ key: 'buytt', label: `Mua bằng ${Wallet.NAME}`, emoji: Wallet.ICON, style: 'green', row: 0 }, async (i, _v, view) => {
    const r = O.buyWithWallet(userId, productId, qty);
    if (r.order && r.order.pay_by === 'wallet' && !r.ok) S.alertAdmin(`🚨 Mua bằng Thiên Tệ gặp lỗi giao hàng — đơn \`${r.order.code}\` (${r.order.product_name}) khách <@${userId}>: ${r.error}${r.refunded ? ' (đã tự hoàn Thiên Tệ)' : ' — CHƯA hoàn, xử lý bằng /storeadmin giaolai hoặc hoantien'}`);
    if (!r.ok) return eph(i, `❌ ${r.msg}`);
    return swap(i, view, [M.purchased(r.order, r.lines, r.balance)], purchasedView(root, userId, catKey));
  });
  if (CFG.directBuy()) {
    v.button({ key: 'buy', label: 'Chuyển khoản trực tiếp', emoji: '🛒', style: 'grey', row: 0 }, async (i, _v, view) => {
      const r = O.createOrder(userId, productId, qty);
      if (!r.ok) return eph(i, `❌ ${r.msg}`);
      S.registerSession(r.order.code, root);                    // để báo "thanh toán thành công" bằng tin nhắn ẩn
      return swap(i, view, [M.order(r.order)], orderView(root, userId, r.order.code, catKey), M.orderFiles());
    });
  }
  v.button({ key: 'back', label: 'Quay lại', emoji: '↩️', style: 'grey', row: 1 }, (i, _v, view) => swap(i, view, [M.category(catKey, Cu.getCultivator(userId))], categoryView(root, userId, catKey)));
  return v;
}

function purchasedView(root, userId, catKey) {
  const v = new View({ ownerId: userId, timeout: 900 });
  v.button({ key: 'more', label: 'Mua tiếp', emoji: '🛒', style: 'green', row: 0 }, (i, _v, view) => swap(i, view, [M.category(catKey, Cu.getCultivator(userId))], categoryView(root, userId, catKey)));
  v.button({ key: 'home', label: 'Về cửa hàng', emoji: '🏪', style: 'grey', row: 0 }, (i, _v, view) => swap(i, view, [M.home(userId)], homeView(root, userId)));
  return v;
}

function orderView(root, userId, code, catKey) {
  const v = new View({ ownerId: userId, timeout: 900 });
  if (CFG.mode() === 'static') {
    v.button({ key: 'paid', label: 'Tôi đã chuyển', emoji: '✅', style: 'green', row: 0 }, async (i) => {
      const o = O.getOrder(code);
      if (!o || !['pending', 'expired'].includes(o.status)) return eph(i, '❌ Đơn này không còn ở trạng thái chờ thanh toán.');
      const sent = await S.claimPaid(o);
      return eph(i, sent ? '✅ Đã báo admin. Admin đối chiếu và duyệt xong, vật phẩm sẽ vào nhân vật và bạn nhận thông báo riêng.' : '⏳ Bạn vừa báo rồi — vui lòng đợi admin duyệt.');
    });
  }
  v.button({ key: 'check', label: 'Kiểm tra thanh toán', emoji: '🔄', style: 'blurple', row: 0 }, (i, _v, view) => {
    const o = O.getOrder(code);
    if (!o) return eph(i, '❌ Không tìm thấy đơn.');
    if (o.status === 'delivered') return swap(i, view, [M.success(o, JSON.parse(o.grants || '[]').map((g) => g.label))], new View({ ownerId: userId, timeout: 60 }));
    if (o.status === 'error') return eph(i, '⚠️ Đã nhận tiền nhưng giao hàng gặp sự cố — admin đã được báo, bạn không cần chuyển lại.');
    if (o.status === 'cancelled') return eph(i, '🚫 Đơn này đã huỷ.');
    return eph(i, `⏳ Chưa thấy tiền về cho đơn \`${code}\`${(o.paid_amount || 0) > 0 ? ` (mới nhận ${CAT.vnd(o.paid_amount)}/${CAT.vnd(o.amount)})` : ''}. Ngân hàng đôi khi trễ 10–60 giây — thử lại sau nhé.`);
  });
  v.button({ key: 'cancel', label: 'Huỷ đơn', emoji: '❌', style: 'red', row: 0 }, (i, _v, view) => {
    const r = O.cancelOrder(userId, code);
    if (!r.ok) return eph(i, `❌ ${r.msg}`);
    if (catKey === 'topup') return swap(i, view, [M.topupPanel()], topupView(root, userId));
    return swap(i, view, [M.category(catKey, Cu.getCultivator(userId))], categoryView(root, userId, catKey));
  });
  v.button({ key: 'back', label: 'Về cửa hàng', emoji: '🏪', style: 'grey', row: 1 }, (i, _v, view) => swap(i, view, [M.home(userId)], homeView(root, userId)));
  return v;
}

// ---------------------------------------------------------------- NẠP LINH THẠCH
const quoteScreen = (i, view, root, userId, amount) => {
  const q = Topup.quote(amount);
  if (!q.ok) return eph(i, `❌ ${q.msg}`);
  return swap(i, view, [M.topupQuote(q)], topupQuoteView(root, userId, q.amount));
};

function topupView(root, userId) {
  const v = new View({ ownerId: userId, timeout: 900 });
  v.select({
    key: 'preset', row: 0, placeholder: '💰 Chọn mức nạp nhanh...',
    options: Topup.PRESETS.map((a) => { const q = Topup.quote(a); return { label: `Nạp ${CAT.vnd(a)}${q.pct ? ` (+${q.pct}%)` : ''}`, description: `Nhận ${q.total.toLocaleString('en-US').replace(/,/g, '.')} ${Wallet.NAME}`, value: String(a) }; }),
  }, (i, values, view) => quoteScreen(i, view, root, userId, Number(values[0])));
  v.button({ key: 'custom', label: 'Nhập số tiền khác', emoji: '✏️', style: 'blurple', row: 1 }, (i) => showModal(i, {
    title: `Nạp ${Wallet.NAME}`,
    fields: [{ id: 'amount', label: 'Số tiền muốn nạp (VNĐ)', placeholder: 'vd: 75000 hoặc 75k hoặc 1tr', maxLength: 14 }],
    onSubmit: async (mi) => {
      const amount = Topup.parseAmount(mi.fields.getTextInputValue('amount'));
      const q = Topup.quote(amount);
      if (!q.ok) return mi.reply({ content: `❌ ${Number.isNaN(amount) ? 'Không hiểu số tiền — gõ ví dụ 75000, 75k hoặc 1tr.' : q.msg}`, flags: EPH });
      const payload = { embeds: [M.topupQuote(q)], components: topupQuoteView(root, userId, q.amount).components(), attachments: [] };
      return typeof mi.update === 'function' ? mi.update(payload) : mi.reply({ ...payload, flags: EPH });
    },
  }));
  v.button({ key: 'back', label: 'Về cửa hàng', emoji: '↩️', style: 'grey', row: 1 }, (i, _v, view) => swap(i, view, [M.home(userId)], homeView(root, userId)));
  return v;
}

function topupQuoteView(root, userId, amount) {
  const v = new View({ ownerId: userId, timeout: 900 });
  v.button({ key: 'buy', label: 'Tạo đơn nạp', emoji: '🛒', style: 'green', row: 0 }, (i, _v, view) => {
    const r = O.createTopupOrder(userId, amount);
    if (!r.ok) return eph(i, `❌ ${r.msg}`);
    S.registerSession(r.order.code, root);
    return swap(i, view, [M.order(r.order)], orderView(root, userId, r.order.code, 'topup'), M.orderFiles());
  });
  v.button({ key: 'back', label: 'Chọn mức khác', emoji: '↩️', style: 'grey', row: 0 }, (i, _v, view) => swap(i, view, [M.topupPanel()], topupView(root, userId)));
  return v;
}

/** Payload mở cửa hàng cho lệnh /tutienstore. */
function open(root, userId) { const v = homeView(root, userId); return { embeds: v.embeds, components: v.components() }; }

module.exports = { open };
