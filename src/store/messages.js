'use strict';
/** TuTienStore — mọi embed hiển thị cho người chơi (đều gửi dạng tin nhắn ẨN / DM). */
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const CFG = require('./config');
const CAT = require('./catalog');
const Topup = require('./topup');
const Wallet = require('./wallet');
const O = require('./orders');
const { fmtNum } = require('../util');
const { vnd } = CAT;

const COLOR = { shop: 0xf1c40f, pay: 0x3498db, ok: 0x2ecc71, warn: 0xe67e22, bad: 0xe74c3c };
const STATUS = {
  pending: '⏳ Chờ thanh toán', expired: '⌛ Quá hạn QR (đã chuyển khoản thì vẫn được giao)', delivering: '📦 Đang giao',
  delivered: '✅ Đã giao', cancelled: '🚫 Đã huỷ', error: '⚠️ Lỗi giao hàng — admin đã được báo',
};
const ts = (sec) => Math.floor(Number(sec) || 0);

function qrUrl(order) {
  const c = CFG.get();
  return `https://img.vietqr.io/image/${encodeURIComponent(c.bank)}-${encodeURIComponent(c.account)}-compact2.png?amount=${order.amount}&addInfo=${encodeURIComponent(order.code)}&accountName=${encodeURIComponent(c.name)}`;
}

function home(userId) {
  const c = CFG.get();
  const e = new EmbedBuilder().setColor(COLOR.shop).setTitle('🏪 TuTienStore — Nạp Thiên Tệ, mua vật phẩm')
    .setDescription([
      `${Wallet.ICON} Số dư của bạn: **${fmtNum(Wallet.balance(userId))} ${Wallet.NAME}**`,
      `**Nạp** tiền thật để có ${Wallet.NAME} (nạp càng nhiều càng được thưởng) → chọn vật phẩm → **mua bằng ${Wallet.NAME}**.`,
      CFG.autoReady(c) ? '⚡ Tiền về là bot **tự cộng Thiên Tệ** và báo cho bạn ngay (không cần gửi ảnh chuyển khoản).' : '🕒 Nạp xong bấm **Tôi đã chuyển** — **admin xác nhận** rồi Thiên Tệ vào ví của bạn.',
      '🔒 Mọi tin nhắn của cửa hàng chỉ **riêng bạn** nhìn thấy.',
    ].join('\n'));
  if (!CFG.payReady(c)) e.addFields({ name: '⚠️ Cửa hàng chưa mở', value: 'Admin chưa cấu hình tài khoản nhận tiền nên chưa tạo đơn được.' });
  const lines = [`💰 **Nạp ${Wallet.NAME}** — nhập số tiền tuỳ ý, nạp càng nhiều thưởng càng cao`, ...CAT.cats().filter((x) => x.count).map((x) => `${x.icon} **${x.label}** — ${x.blurb}`)];
  e.addFields({ name: 'Danh mục', value: lines.join('\n').slice(0, 1024) || '—' });
  return e;
}

function category(catKey, row) {
  const cat = CAT.CATS.find((x) => x.key === catKey); const list = CAT.listCat(catKey);
  const lines = list.map((p) => { const m = CAT.ownedMark(p, row); return `${m === 'owned' ? '✅' : m === 'blocked' ? '🔒' : '▫️'} **${p.name}** — ${Wallet.ICON} ${fmtNum(Wallet.ttOf(p.price))}`; });
  return new EmbedBuilder().setColor(COLOR.shop).setTitle(`${cat.icon} ${cat.label}`)
    .setDescription(`${cat.blurb}\n\n${lines.join('\n') || '_Chưa có sản phẩm._'}`.slice(0, 4000))
    .setFooter({ text: '✅ đã sở hữu · 🔒 không bán cho bạn (bằng/thấp hơn phẩm hiện có)' });
}

function product(p, qty, row, userId) {
  const reason = CAT.blockReason(p, row); const q = p.unique ? 1 : qty; const cost = O.ttPrice(p, q); const bal = userId ? Wallet.balance(userId) : 0;
  const e = new EmbedBuilder().setColor(reason ? COLOR.warn : COLOR.shop).setTitle(`🛒 ${p.name}`).setDescription(p.desc)
    .addFields(
      { name: `Giá ${Wallet.NAME}`, value: `**${Wallet.label(cost)}**`, inline: true },
      { name: 'Số lượng', value: p.unique ? '1 (bán 1 lần)' : `${qty} (tối đa ${p.maxQty})`, inline: true },
      { name: 'Số dư của bạn', value: `${Wallet.label(bal)}${bal < cost ? '\n⚠️ chưa đủ — hãy nạp thêm' : ''}`, inline: true },
    );
  if (CFG.directBuy()) e.addFields({ name: 'Hoặc chuyển khoản trực tiếp', value: vnd(p.price * q), inline: true });
  if (p.dailyLimit) e.addFields({ name: 'Giới hạn', value: `Tối đa ${p.dailyLimit} gói/ngày/người`, inline: true });
  if (reason) e.addFields({ name: '🔒 Không thể mua', value: reason });
  return e;
}

/** File đính kèm cho tin nhắn đơn (chế độ QR tĩnh cần gửi kèm ảnh QR). */
function orderFiles() {
  const c = CFG.get();
  return CFG.mode(c) === 'static' ? [new AttachmentBuilder(c.qrImage, { name: 'store_qr.jpg' })] : [];
}

function order(o) {
  const c = CFG.get(); const stat = CFG.mode(c) === 'static';
  const e = new EmbedBuilder().setColor(COLOR.pay).setTitle(`🧾 Đơn ${o.code}`)
    .setDescription(stat
      ? ['Quét QR bên dưới bằng app ngân hàng / ví điện tử (ZaloPay...). QR này **không có sẵn số tiền**, hãy làm đủ 3 việc:',
        `1️⃣ Nhập **đúng số tiền**: **${vnd(o.amount)}**`, `2️⃣ Ghi **lời nhắn / nội dung** là: \`${o.code}\``, '3️⃣ Chuyển xong bấm **✅ Tôi đã chuyển** để admin duyệt.'].join('\n')
      : 'Quét QR bằng app ngân hàng. **Giữ nguyên số tiền và nội dung chuyển khoản.**')
    .addFields(
      { name: 'Sản phẩm', value: `${o.product_name}${o.qty > 1 ? ` ×${o.qty}` : ''}`, inline: true },
      { name: 'Số tiền', value: `**${vnd(o.amount)}**`, inline: true },
      { name: stat ? 'Lời nhắn (bắt buộc)' : 'Nội dung chuyển khoản', value: `\`${o.code}\``, inline: false },
    );
  if (stat) { if (c.name) e.addFields({ name: 'Người nhận', value: c.name, inline: true }); e.setImage('attachment://store_qr.jpg'); }
  else e.addFields({ name: 'Nhận tiền', value: `${c.name}\n${c.bank} · ${c.account}`, inline: false }).setImage(qrUrl(o));
  e.addFields({ name: 'Hiệu lực', value: `<t:${ts(o.expires_at)}:R>`, inline: true })
    .setFooter({ text: stat ? 'Admin sẽ đối chiếu lịch sử nhận tiền rồi duyệt — không cần gửi ảnh chuyển khoản.' : (CFG.autoReady(c) ? 'Tiền về là bot tự giao — bạn sẽ nhận thông báo riêng.' : 'Chuyển xong hãy chờ admin xác nhận.') });
  if ((o.paid_amount || 0) > 0 && o.status === 'pending') e.addFields({ name: 'Đã nhận', value: `${vnd(o.paid_amount)} — còn thiếu **${vnd(o.amount - o.paid_amount)}** (chuyển bù cùng nội dung \`${o.code}\`)` });
  return e;
}

function topupPanel() {
  return new EmbedBuilder().setColor(COLOR.shop).setTitle(`💰 Nạp ${Wallet.NAME} — nạp càng nhiều, thưởng càng cao`)
    .setDescription([`Chọn mức nạp nhanh hoặc **nhập số tiền tuỳ ý** (tối thiểu 10.000đ, tròn nghìn). ${Wallet.NAME} vào ví của bạn, dùng để mua mọi vật phẩm trong shop.`, '', ...Topup.tierLines()].join('\n'))
    .addFields({ name: 'Ví dụ', value: Topup.PRESETS.slice(0, 6).map((a) => { const q = Topup.quote(a); return `${vnd(a)} → **${fmtNum(q.total)}** ${Wallet.NAME}`; }).join('\n') });
}
function topupQuote(q) {
  return new EmbedBuilder().setColor(COLOR.shop).setTitle(`💰 Nạp ${vnd(q.amount)}`)
    .addFields(
      { name: `${Wallet.NAME} gốc`, value: fmtNum(q.base), inline: true },
      { name: `Thưởng +${q.pct}%`, value: fmtNum(q.bonus), inline: true },
      { name: 'Tổng nhận', value: `**${Wallet.label(q.total)}**`, inline: true },
      { name: 'Tỉ lệ', value: `${Topup.rate(q.perK)} ${Wallet.NAME} / 1.000đ`, inline: true },
    ).setFooter({ text: 'Nạp mức cao hơn để có tỉ lệ thưởng tốt hơn.' });
}

function success(o, lines, extra = '') {
  const top = o.product_id === 'topup';
  const e = new EmbedBuilder().setColor(COLOR.ok).setTitle('✅ Thanh toán thành công')
    .setDescription(top
      ? `Đơn \`${o.code}\` đã xong — ${Wallet.NAME} đã vào ví của bạn. Mở \`/tutienstore\` để chọn vật phẩm.${extra}`
      : `Đơn \`${o.code}\` đã được giao vào nhân vật của bạn. Mở **/khodo** để xem lại.${extra}`)
    .addFields(
      { name: top ? 'Gói nạp' : 'Sản phẩm', value: `${o.product_name}${o.qty > 1 ? ` ×${o.qty}` : ''}`, inline: true },
      { name: 'Đã thanh toán', value: vnd(o.paid_amount || o.amount), inline: true },
      { name: top ? 'Bạn nhận được' : 'Vật phẩm nhận được', value: lines.map((l) => `• ${l}`).join('\n').slice(0, 1024) || '—' },
    );
  if (top) e.addFields({ name: 'Số dư hiện tại', value: `**${Wallet.label(Wallet.balance(o.user_id))}**`, inline: true });
  return e;
}
function purchased(o, lines, bal) {
  return new EmbedBuilder().setColor(COLOR.ok).setTitle('✅ Mua thành công')
    .setDescription(`Đã giao vào nhân vật của bạn. Mở **/khodo** để xem lại.`)
    .addFields(
      { name: 'Sản phẩm', value: `${o.product_name}${o.qty > 1 ? ` ×${o.qty}` : ''}`, inline: true },
      { name: 'Đã trả', value: Wallet.label(o.tt_cost), inline: true },
      { name: 'Số dư còn lại', value: Wallet.label(bal), inline: true },
      { name: 'Vật phẩm nhận được', value: lines.map((l) => `• ${l}`).join('\n').slice(0, 1024) || '—' },
    ).setFooter({ text: `Mã đơn ${o.code}` });
}
function walletEmbed(userId) {
  const w = Wallet.summary(userId);
  const rows = Wallet.ledger(userId, 8).map((r) => `${r.delta > 0 ? '➕' : '➖'} **${fmtNum(Math.abs(r.delta))}** · ${({ topup: 'nạp tiền', buy: 'mua hàng', refund: 'hoàn lại', admin: 'admin điều chỉnh' })[r.reason] || r.reason} · <t:${ts(r.created_at)}:R>`);
  return new EmbedBuilder().setColor(COLOR.shop).setTitle(`${Wallet.ICON} Ví ${Wallet.NAME}`)
    .addFields({ name: 'Số dư', value: `**${Wallet.label(w.balance)}**`, inline: true }, { name: 'Đã nạp', value: Wallet.label(w.total_topup), inline: true }, { name: 'Đã tiêu', value: Wallet.label(w.total_spent), inline: true },
      { name: 'Giao dịch gần đây', value: rows.join('\n') || '_Chưa có giao dịch._' });
}
function underpaid(o, r) {
  return new EmbedBuilder().setColor(COLOR.warn).setTitle('⚠️ Đã nhận nhưng còn thiếu tiền')
    .setDescription(`Đơn \`${o.code}\`: đã nhận **${vnd(r.total)}** / **${vnd(o.amount)}**.\nHãy chuyển bù **${vnd(r.missing)}** với **cùng nội dung** \`${o.code}\` — bot sẽ cộng dồn và giao ngay.`);
}
function deliveryError(o) {
  return new EmbedBuilder().setColor(COLOR.bad).setTitle('⚠️ Đã nhận tiền nhưng giao hàng gặp sự cố')
    .setDescription(`Đơn \`${o.code}\` đã ghi nhận thanh toán. Hệ thống đã báo admin xử lý — bạn **không cần chuyển lại**. Vật phẩm sẽ được giao hoặc hoàn tiền.`);
}
function orderList(list) {
  const lines = list.map((o) => `\`${o.code}\` — ${o.product_name}${o.qty > 1 ? ` ×${o.qty}` : ''} — ${o.pay_by === 'wallet' ? Wallet.label(o.tt_cost) : vnd(o.amount)}\n↳ ${STATUS[o.status] || o.status} · <t:${ts(o.created_at)}:R>`);
  return new EmbedBuilder().setColor(COLOR.shop).setTitle('📒 Đơn hàng của bạn').setDescription(lines.join('\n\n').slice(0, 4000) || '_Bạn chưa có đơn nào._');
}

module.exports = { purchased, walletEmbed, orderFiles, topupPanel, topupQuote, home, category, product, order, success, underpaid, deliveryError, orderList, qrUrl, STATUS, COLOR };
