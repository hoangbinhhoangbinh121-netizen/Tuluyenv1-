'use strict';
/**
 * TuTienStore — lệnh:
 *   /tutienstore  mở cửa hàng (tin nhắn ẨN)          /donhang  xem đơn của mình (ẨN)
 *   /storeadmin   quản trị: xem, ds, duyet, huy, giaolai, gia, bat, tat, sp, thongke, kiemtra (ẨN, chỉ admin của bot)
 * Cả 3 chỉ chạy bằng slash (noDefer + trả lời ephemeral) để mọi thứ đều riêng tư.
 */
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { defineCommand, isAdminApprover } = require('./framework');
const Cu = require('../game/cultivator');
const CAT = require('../store/catalog');
const CFG = require('../store/config');
const O = require('../store/orders');
const M = require('../store/messages');
const S = require('../store');
const V = require('../ui/storeViews');
const Wallet = require('../store/wallet');
const { vnd } = CAT;

const EPH = MessageFlags.Ephemeral;
const reply = (ctx, p) => ctx.interaction.reply({ ...(typeof p === 'string' ? { content: p } : p), flags: EPH });
const slashOnly = (ctx) => ctx.send('🏪 Hãy dùng lệnh slash — cửa hàng chỉ hoạt động bằng tin nhắn ẩn (riêng tư).');
const when = (sec) => (sec ? `<t:${Math.floor(sec)}:f>` : '—');

defineCommand({
  name: 'tutienstore', description: '🏪 TuTienStore — nạp tiền thật, nhận vật phẩm vào nhân vật (tin nhắn riêng tư)', noDefer: true,
  async run(ctx) {
    if (!ctx.interaction) return slashOnly(ctx);
    if (!Cu.getCultivator(ctx.user.id)) return reply(ctx, '❌ Bạn chưa bắt đầu tu tiên, dùng `/batdau` trước.');
    return reply(ctx, V.open(ctx.interaction, ctx.user.id));
  },
});

defineCommand({
  name: 'donhang', description: '📒 Xem đơn hàng TuTienStore của bạn (tin nhắn riêng tư)', noDefer: true,
  async run(ctx) {
    if (!ctx.interaction) return slashOnly(ctx);
    const list = O.ordersOf(ctx.user.id);
    // Đơn đang chờ: gắn lại phiên để khi tiền về vẫn được báo bằng tin nhắn ẩn.
    for (const o of list) if (o.status === 'pending' || o.status === 'expired') S.registerSession(o.code, ctx.interaction);
    return reply(ctx, { embeds: [M.orderList(list).setFooter({ text: `Số dư: ${Wallet.balance(ctx.user.id)} ${Wallet.NAME}` })] });
  },
});

const ACTIONS = [
  ['xem', 'xem <mã đơn> — chi tiết 1 đơn'], ['ds', 'ds — đơn đang chờ / lỗi'], ['duyet', 'duyet <mã đơn> [số tiền] — xác nhận đã nhận tiền và giao'],
  ['giaolai', 'giaolai <mã đơn> — giao lại đơn lỗi'], ['huy', 'huy <mã đơn> — huỷ đơn chưa trả tiền'], ['gia', 'gia <mã sp> <giá> — đổi giá (gõ "mac_dinh" để về giá gốc)'],
  ['bat', 'bat <mã sp> — mở bán'], ['tat', 'tat <mã sp> — ngừng bán'], ['sp', 'sp [danh mục] — liệt kê mã sản phẩm & giá'], ['thongke', 'thongke — doanh thu'], ['vi', 'vi <ID người chơi> — xem ví Thiên Tệ'], ['congtt', 'congtt <ID người chơi> <số> — cộng Thiên Tệ (số âm = trừ)'], ['hoantien', 'hoantien <mã đơn> — hoàn Thiên Tệ cho đơn mua-bằng-ví bị lỗi'], ['kiemtra', 'kiemtra — kiểm tra cấu hình thanh toán'],
];
const orderDetail = (o) => new EmbedBuilder().setColor(0x3498db).setTitle(`🧾 Đơn ${o.code}`).addFields(
  { name: 'Khách', value: `<@${o.user_id}> (\`${o.user_id}\`)`, inline: true },
  { name: 'Sản phẩm', value: `${o.product_name} ×${o.qty}\n\`${o.product_id}\``, inline: true },
  { name: 'Giá trị', value: o.pay_by === 'wallet' ? Wallet.label(o.tt_cost) : vnd(o.amount), inline: true },
  { name: 'Trạng thái', value: `${M.STATUS[o.status] || o.status}${o.note ? `\n_${o.note}_` : ''}`, inline: false },
  { name: 'Thanh toán', value: `Đã nhận ${vnd(o.paid_amount || 0)} · ${o.pay_by || '—'} · tx \`${o.pay_tx || '—'}\`\nTạo: ${when(o.created_at)} · Trả: ${when(o.paid_at)} · Giao: ${when(o.delivered_at)}`, inline: false },
  { name: 'Quà', value: JSON.parse(o.grants || '[]').map((g, n) => `${n < o.grant_step ? '✅' : '▫️'} ${g.label}`).join('\n').slice(0, 1000) || '—', inline: false },
);

defineCommand({
  name: 'storeadmin', description: '[Admin] Quản trị TuTienStore: đơn hàng, giá, doanh thu (tin nhắn riêng tư)', noDefer: true,
  options: [
    { name: 'hanh_dong', type: 'string', required: true, description: 'Hành động', choices: ACTIONS.map(([value, name]) => ({ name, value })) },
    { name: 'gia_tri', type: 'string', description: 'Mã đơn / mã sản phẩm / danh mục (tuỳ hành động)' },
    { name: 'gia_tri_2', type: 'string', description: 'Giá hoặc số tiền (tuỳ hành động)' },
  ],
  async run(ctx) {
    if (!ctx.interaction) return slashOnly(ctx);
    if (!isAdminApprover(ctx.user.id)) return reply(ctx, '❌ Lệnh này chỉ dành riêng cho admin được chỉ định.');   // báo ẨN, không lộ ra kênh
    const act = ctx.args.hanh_dong; const a = String(ctx.args.gia_tri || '').trim(); const b = String(ctx.args.gia_tri_2 || '').trim();
    const need = (what) => reply(ctx, `❌ Thiếu ${what}. Cú pháp: \`${ACTIONS.find((x) => x[0] === act)[1]}\``);
    const money = (s) => Number(String(s).replace(/[.,_\sđd]/gi, ''));

    switch (act) {
      case 'xem': { if (!a) return need('mã đơn'); const o = O.getOrder(a); return o ? reply(ctx, { embeds: [orderDetail(o)] }) : reply(ctx, '❌ Không thấy mã đơn.'); }
      case 'ds': {
        const list = O.openOrders(20);
        const lines = list.map((o) => `\`${o.code}\` ${M.STATUS[o.status] ? M.STATUS[o.status].split(' ')[0] : ''} ${o.product_name}${o.qty > 1 ? ` ×${o.qty}` : ''} — ${vnd(o.amount)} — <@${o.user_id}> — <t:${Math.floor(o.created_at)}:R>${o.note ? `\n   ↳ ${o.note}` : ''}`);
        return reply(ctx, { embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle('📋 Đơn đang chờ / lỗi').setDescription(lines.join('\n').slice(0, 4000) || '_Không có đơn nào._')] });
      }
      case 'duyet': {
        if (!a) return need('mã đơn'); const amt = b ? money(b) : null;
        if (b && !(amt > 0)) return reply(ctx, '❌ Số tiền không hợp lệ.');
        const r = O.confirmManual(a, ctx.user.id, amt);
        if (r.kind === 'invalid') return reply(ctx, `❌ ${r.msg}`);
        await S.settle(r);
        return reply(ctx, r.kind === 'delivered' ? `✅ Đã giao đơn \`${r.order.code}\` cho <@${r.order.user_id}>.` : `⚠️ Đã ghi nhận thanh toán nhưng giao lỗi: ${r.error}`);
      }
      case 'giaolai': {
        if (!a) return need('mã đơn');
        const r = O.retryDelivery(a); if (r.kind === 'invalid') return reply(ctx, `❌ ${r.msg}`);
        await S.settle(r);
        return reply(ctx, r.kind === 'delivered' ? `✅ Đã giao lại đơn \`${r.order.code}\`.` : `⚠️ Vẫn lỗi: ${r.error}`);
      }
      case 'huy': { if (!a) return need('mã đơn'); const r = O.cancelOrder(ctx.user.id, a, true); return reply(ctx, r.ok ? `🚫 Đã huỷ đơn \`${r.order.code}\`.` : `❌ ${r.msg}`); }
      case 'gia': {
        if (!a || !b) return need('mã sản phẩm và giá');
        const p = CAT.get(a); if (!p) return reply(ctx, '❌ Không có mã sản phẩm này (xem `sp`).');
        if (/^mac_?dinh$/i.test(b)) { CAT.setPrice(a, null); return reply(ctx, `↩️ **${p.name}** về giá gốc ${vnd(p.basePrice)}.`); }
        const price = money(b); if (!(price >= 2000 && price <= 500000000)) return reply(ctx, '❌ Giá phải từ 2.000đ đến 500.000.000đ.');
        CAT.setPrice(a, price); return reply(ctx, `✅ **${p.name}**: ${vnd(p.price)} → **${vnd(price)}** (giá gốc ${vnd(p.basePrice)}).`);
      }
      case 'bat': case 'tat': {
        if (!a) return need('mã sản phẩm'); const p = CAT.get(a); if (!p) return reply(ctx, '❌ Không có mã sản phẩm này (xem `sp`).');
        CAT.setEnabled(a, act === 'bat'); return reply(ctx, `${act === 'bat' ? '🟢 Đã mở bán' : '🔴 Đã ngừng bán'} **${p.name}**.`);
      }
      case 'sp': {
        const list = CAT.all().filter((p) => !a || p.cat === a);
        if (!list.length) return reply(ctx, `❌ Không có sản phẩm. Danh mục hợp lệ: ${CAT.CATS.map((c) => `\`${c.key}\``).join(', ')}`);
        const lines = list.map((p) => `${p.enabled ? '🟢' : '🔴'} \`${p.id}\` ${p.name} — ${vnd(p.price)}${p.price !== p.basePrice ? ` _(gốc ${vnd(p.basePrice)})_` : ''}`);
        const chunks = []; let cur = '';
        for (const l of lines) { if ((cur + l).length > 3800) { chunks.push(cur); cur = ''; } cur += `${l}\n`; }
        if (cur) chunks.push(cur);
        await reply(ctx, { embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle(`📦 Sản phẩm${a ? ` · ${a}` : ''} (${list.length})`).setDescription(chunks[0])] });
        for (const c of chunks.slice(1, 4)) await ctx.interaction.followUp({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setDescription(c)], flags: EPH });
        return null;
      }
      case 'vi': {
        const id = a.replace(/\D/g, ''); if (!id) return need('ID người chơi');
        return reply(ctx, { embeds: [M.walletEmbed(id)] });
      }
      case 'congtt': {
        const id = a.replace(/\D/g, ''); if (!id || !b) return need('ID người chơi và số Thiên Tệ');
        if (!Cu.getCultivator(id)) return reply(ctx, '❌ ID này chưa có nhân vật (gõ sai ID?).');
        const delta = Number(b.replace(/[.,_\s]/g, '')); if (!Number.isFinite(delta)) return reply(ctx, '❌ Số không hợp lệ.');
        const r = O.adminAdjust(ctx.user.id, id, delta, 'lệnh /storeadmin congtt');
        return reply(ctx, r.ok ? `✅ ${delta > 0 ? 'Đã cộng' : 'Đã trừ'} ${Wallet.label(Math.abs(delta))} cho <@${id}> — số dư mới ${Wallet.label(r.balance)}.` : `❌ ${r.msg}`);
      }
      case 'hoantien': {
        if (!a) return need('mã đơn');
        const r = O.refundWalletOrder(a, `admin ${ctx.user.id}`); if (!r.ok) return reply(ctx, `❌ ${r.msg}`);
        await S.tellUser(r.order.user_id, r.order.code, { embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle('↩️ Đã hoàn Thiên Tệ').setDescription(`Đơn \`${r.order.code}\` gặp sự cố giao hàng nên admin đã hoàn **${Wallet.label(r.refunded)}** vào ví của bạn. Số dư hiện tại: **${Wallet.label(r.balance)}**.`)] });
        return reply(ctx, `✅ Đã hoàn ${Wallet.label(r.refunded)} cho <@${r.order.user_id}>.`);
      }
      case 'thongke': {
        const s = O.stats(); const row = (x) => `${x.n} đơn · **${vnd(x.v)}**`;
        const top = s.top.map((t, n) => `${n + 1}. <@${t.user_id}> — ${t.n} đơn · ${vnd(t.v)}`).join('\n') || '—';
        return reply(ctx, { embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle('📊 Doanh thu TuTienStore').addFields(
          { name: 'Hôm nay', value: row(s.today), inline: true }, { name: '7 ngày', value: row(s.week), inline: true }, { name: 'Tổng', value: row(s.all), inline: true },
          { name: 'Đang chờ thanh toán', value: String(s.open), inline: true }, { name: 'Đơn lỗi cần xử lý', value: String(s.errors), inline: true },
          { name: `${Wallet.NAME} đang lưu hành`, value: `${s.wallet.wallets} ví · **${Wallet.label(s.wallet.outstanding)}**\nĐã nạp ${Wallet.label(s.wallet.topup)} · đã tiêu ${Wallet.label(s.wallet.spent)}` },
          { name: 'Top khách (tiền thật)', value: top.slice(0, 1000) }).setFooter({ text: 'Doanh thu = tiền thật đã nhận (đơn nạp / chuyển khoản trực tiếp). Mua bằng Thiên Tệ không tính lại.' })] });
      }
      case 'kiemtra': {
        const c = CFG.get(); const yes = (x) => (x ? '✅' : '❌');
        const md = CFG.mode(c);
        const lines = [
          `**Chế độ thanh toán:** ${md === 'vietqr' ? '🟢 VietQR động (có sẵn số tiền + nội dung)' : md === 'static' ? '🟡 QR tĩnh từ `assets/store/qr.jpg` — khách tự nhập tiền, **admin duyệt tay**' : '🔴 Chưa cấu hình'}`,
          `${yes(c.qrImage)} Ảnh QR tĩnh: ${c.qrImage ? 'có' : '_không có_'}`,
          `${yes(c.bank)} STORE_BANK_ID: ${c.bank || '_chưa đặt_'}`, `${yes(c.account)} STORE_ACCOUNT_NO: ${c.account ? `…${c.account.slice(-4)}` : '_chưa đặt_'}`, `${yes(c.name)} STORE_ACCOUNT_NAME: ${c.name || '_chưa đặt_'}`,
          `${yes(c.sepayKey)} STORE_SEPAY_API_KEY: ${c.sepayKey ? 'đã đặt' : '_chưa đặt_ → không nhận tiền tự động'}`, `${yes(c.port)} Cổng webhook: ${c.port || '_chưa có (STORE_WEBHOOK_PORT / SERVER_PORT)_'}`,
          `ℹ️ Tỉ lệ gốc: ${Wallet.TT_PER_1000} ${Wallet.NAME} / 1.000đ (1 ${Wallet.NAME} = ${Wallet.VND_PER_TT}đ) · chuyển khoản trực tiếp mua vật phẩm: ${CFG.directBuy() ? 'BẬT' : 'TẮT (chỉ bán bằng Thiên Tệ)'}`, `ℹ️ Tiền tố mã đơn: \`${c.prefix}\` · hiệu lực QR: ${c.ttlMin} phút · tối đa ${c.maxPending} đơn chờ/người`, `ℹ️ Kênh báo admin: ${c.adminChannel ? `<#${c.adminChannel}>` : 'nhắn riêng admin'}`,
          '', `**Webhook SePay:** \`POST https://<tên-miền-hoặc-IP>:${c.port || '<cổng>'}/sepay\` · xác thực kiểu API Key = giá trị STORE_SEPAY_API_KEY`,
        ];
        return reply(ctx, { embeds: [new EmbedBuilder().setColor(CFG.payReady(c) ? 0x2ecc71 : 0xe74c3c).setTitle('🔧 Cấu hình TuTienStore').setDescription(lines.join('\n'))] });
      }
      default: return reply(ctx, '❌ Hành động không hợp lệ.');
    }
  },
});
