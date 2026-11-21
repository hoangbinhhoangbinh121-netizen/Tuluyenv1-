'use strict';
/**
 * GIAO DIỆN V21 — Cửa Hàng Nguyên Bảo + Nạp. Một bộ xử lý nút TĨNH ('sp'): customId `sp|<uid>|<act>|<a>|<b>` (sống sót khởi động lại).
 * Giao diện KHÔNG tự cộng/trừ gì: mọi thao tác gọi game/shop21.js (transaction). Người chơi KHÔNG thể tự xác nhận đơn nạp — chỉ admin (qua /quantri).
 */
const nodePath = require('node:path');
const { ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const { EmbedBuilder, fit, listFit, optEmoji, btn, rowOf } = require('./petViews');
const { registerStatic, showModal, EPHEMERAL } = require('./kit');
const Cu = require('../game/cultivator');
const S = require('../game/shop21');
const Cat = require('../game/catalog17');
const { I } = Cat;
const { fmtNum } = require('../util');

const NB = '💠';
const PAGE = 8;
const cid = (uid, act, a = '', b = '') => `sp|${uid}|${act}|${a}|${b}`.replace(/\|+$/, '').slice(0, 100);
const clean = (s) => String(s || '').replace(/[|:]/g, ' ').trim().slice(0, 24);
const emo = (e) => { try { return e.kind === 'inv' ? require('./emo17').item(e.ref) : (e.kind === 'gear' ? '⚔️' : (S.GROUP_BY[e.group] || {}).emoji || '📦'); } catch (_) { return '📦'; } };
const stars = (r) => '★'.repeat(Math.max(1, Math.min(6, r || 1)));
const stLabel = { pending: '⏳ Chờ xác nhận', done: '✅ Đã cộng Nguyên Bảo', cancelled: '🚫 Đã huỷ', expired: '⌛ Hết hạn' };
const ago = (t) => `<t:${Math.floor(t)}:R>`;

function groupSelect(uid, cur) {
  return new StringSelectMenuBuilder().setCustomId(cid(uid, 'nav')).setPlaceholder('Chọn danh mục hàng…')
    .addOptions(S.GROUPS.map(([k, n, e]) => ({ label: n.slice(0, 100), value: k, description: `${S.countGroup(k)} mặt hàng`, emoji: optEmoji(e), default: k === cur })));
}
const header = (uid) => `${NB} **${fmtNum(S.balance(uid))}** Nguyên Bảo`;

// ---------------------------------------------------------------- màn hình
function viewHome(uid) {
  const e = new EmbedBuilder().setTitle(`🏪 Cửa Hàng Nguyên Bảo`).setColor(0xf1c40f);
  const total = S.GROUPS.reduce((s, [k]) => s + S.countGroup(k), 0);
  e.setDescription(fit(`Số dư: ${header(uid)}\n\nCửa hàng bán **${fmtNum(total)} mặt hàng**: mọi vật phẩm kho đồ, **Thiên Bảo & Truyền Thừa Ngọc Giản**, vật phẩm Linh Thú và trang bị. Chỉ **vật phẩm nhiệm vụ** (Thiên Đạo Thạch, Linh/Tiên Giới Lệnh, Mảnh Phi Thăng, Đế Đạo Chứng Nhận…) không bán.\n${S.shopOn() ? '' : '\n🔴 **Cửa hàng đang đóng.**'}`, 1200));
  e.addFields(
    { name: '💳 Gói nạp', value: fit(S.PACKAGES.map((p) => `**${S.vnd(p.vnd)}** → ${NB} **${fmtNum(S.pkgNb(p))}**${p.bonus ? ` _(tặng +${p.bonus})_` : ''}`).join('\n'), 1000), inline: false },
    { name: 'Cách nạp', value: 'Bấm **Nạp** → chọn gói → chuyển khoản đúng **nội dung** → bấm "Tôi đã chuyển" → admin xác nhận, Nguyên Bảo vào ví.', inline: false });
  return { embeds: [e], components: [rowOf(groupSelect(uid, '')), rowOf(btn(cid(uid, 'topv'), 'Nạp Nguyên Bảo', '💳', ButtonStyle.Success), btn(cid(uid, 'ords'), 'Đơn của tôi', '🧾'), btn(cid(uid, 'find'), 'Tìm kiếm', '🔎'), btn(cid(uid, 'home'), 'Làm mới', '🔄'))] };
}
function stateOf(arg) { const [g = '', p = '0', f = ''] = String(arg || '').split(':'); return { group: g === 'ALL' ? '' : g, page: Math.max(0, Number(p) || 0), filter: f }; }
const stateStr = (group, page, filter) => `${group || 'ALL'}:${page}:${clean(filter)}`;
function viewList(uid, arg) {
  const { group, page: p0, filter } = stateOf(arg);
  const all = S.listGroup(group, filter); const pages = Math.max(1, Math.ceil(all.length / PAGE)); const page = Math.min(p0, pages - 1);
  const rows = all.slice(page * PAGE, page * PAGE + PAGE);
  const g = group ? S.GROUP_BY[group] : null;
  const e = new EmbedBuilder().setTitle(`${g ? g.emoji : '🔎'} ${g ? g.name : 'Kết quả tìm kiếm'}${filter ? ` — “${filter}”` : ''}`).setColor(0xf39c12);
  e.setDescription(fit(`${header(uid)} · ${fmtNum(all.length)} mặt hàng · trang ${page + 1}/${pages}\n\n${rows.length ? listFit(rows.map((x, i) => `**${page * PAGE + i + 1}.** ${emo(x)} ${x.name} ${stars(x.rarity)}${x.hasQ ? ' _(chọn phẩm)_' : ''}\n　${NB} **${fmtNum(S.price(x, S.defaultQ(x)))}**${x.hasQ ? ' (Trung Phẩm)' : ''}`), 3500) : '_Không có mặt hàng phù hợp._'}`, 4000));
  const st = (pg) => stateStr(group, pg, filter);
  const comps = [];
  if (rows.length) comps.push(rowOf(new StringSelectMenuBuilder().setCustomId(cid(uid, 'it', st(page))).setPlaceholder('Chọn món để xem & mua…').addOptions(rows.map((x) => ({ label: x.name.slice(0, 100), value: x.key, description: `${fmtNum(S.price(x, S.defaultQ(x)))} Nguyên Bảo${x.hasQ ? ' (Trung Phẩm)' : ''}`.slice(0, 100), emoji: optEmoji(emo(x)) })))));
  comps.push(rowOf(groupSelect(uid, group)));
  comps.push(rowOf(btn(cid(uid, 'pg', st(page - 1)), '◀', null, ButtonStyle.Secondary, page <= 0), btn(cid(uid, 'pg', st(page + 1)), '▶', null, ButtonStyle.Secondary, page >= pages - 1), btn(cid(uid, 'find'), 'Tìm', '🔎'), btn(cid(uid, 'topv'), 'Nạp', '💳', ButtonStyle.Success), btn(cid(uid, 'home'), 'Trang chủ', '🏠')));
  return { embeds: [e], components: comps };
}
function viewItem(uid, key, q0) {
  const x = S.entry(key); if (!x || S.isHidden(key)) return { ...viewHome(uid), content: '❌ Mặt hàng không còn bán.' };
  const q = x.hasQ ? Math.min(5, Math.max(1, Number(q0) || 2)) : 0; const unit = S.price(x, q); const bal = S.balance(uid);
  const e = new EmbedBuilder().setTitle(`${emo(x)} ${x.name}${x.hasQ ? ` — ${I.qName(q)}` : ''}`).setColor(0xe67e22);
  const lines = [`${stars(x.rarity)} · ${S.GROUP_BY[x.group].name}`, x.desc ? fit(x.desc, 500) : '', `Giá: ${NB} **${fmtNum(unit)}** / cái`, `Số dư: ${header(uid)}`];
  if (x.kind === 'inv') {
    try { const src = Cat.sources(x.ref).map((s) => Cat.srcLabel(s)).slice(0, 4); if (src.length) lines.push(`📍 Nguồn trong game: ${src.join(' · ')}`); } catch (_) { /* không có nguồn */ }
  }
  if (x.hasQ) lines.push(`Giá theo phẩm: ${[1, 2, 3, 4, 5].map((k) => `${I.qName(k)} ${fmtNum(S.price(x, k))}`).join(' · ')}`);
  e.setDescription(fit(lines.filter(Boolean).join('\n'), 3800));
  const qtys = x.kind === 'gear' ? [1, 3, 5, 10] : [1, 5, 10, 50];
  const comps = [];
  if (x.hasQ) comps.push(rowOf(new StringSelectMenuBuilder().setCustomId(cid(uid, 'qs', key)).setPlaceholder('Chọn phẩm chất…').addOptions([1, 2, 3, 4, 5].map((k) => ({ label: I.qName(k), value: String(k), description: `${fmtNum(S.price(x, k))} Nguyên Bảo / cái`, default: k === q })))));
  comps.push(rowOf(...qtys.map((n) => btn(cid(uid, 'buy', `${key}:${q}`, String(n)), `Mua ×${n}`, NB, ButtonStyle.Success, bal < unit * n)), btn(cid(uid, 'topv'), 'Nạp', '💳')));
  comps.push(rowOf(btn(cid(uid, 'pg', stateStr(x.group, 0, '')), 'Về danh mục', '◀'), btn(cid(uid, 'home'), 'Trang chủ', '🏠')));
  return { embeds: [e], components: comps };
}
function viewTopup(uid) {
  const b = { ready: S.payReady() }; const e = new EmbedBuilder().setTitle('💳 Nạp Nguyên Bảo').setColor(0x2ecc71);
  e.setDescription(fit(`Số dư: ${header(uid)}\n\nChọn gói để tạo **đơn nạp**. Sau khi chuyển khoản, bấm **Tôi đã chuyển** — admin kiểm tra và **xác nhận đơn** thì Nguyên Bảo vào ví.\n${b.ready ? '' : '\n🚧 **Admin chưa cài cách nhận tiền** nên chưa nạp được.'}\n⚠️ Chỉ chuyển khoản đúng số tiền của gói và ghi đúng **nội dung (mã đơn)**. Bot không tự biết tiền đã vào; chỉ khi admin xác nhận mới được cộng.`, 1500));
  e.addFields({ name: 'Gói nạp', value: fit(S.PACKAGES.map((p) => `**${S.vnd(p.vnd)}** → ${NB} **${fmtNum(S.pkgNb(p))}**${p.bonus ? ` _(tặng +${p.bonus})_` : ''}`).join('\n'), 1000) });
  return { embeds: [e], components: [rowOf(...S.PACKAGES.map((p) => btn(cid(uid, 'top', String(p.vnd)), S.vnd(p.vnd), '💳', ButtonStyle.Success, !b.ready))), rowOf(btn(cid(uid, 'ords'), 'Đơn của tôi', '🧾'), btn(cid(uid, 'home'), 'Trang chủ', '🏠'))] };
}
/** Thẻ đơn dùng chung cho màn "Đơn của tôi" và lệnh `.od`: thông tin đơn + cách chuyển khoản (QR). */
function orderCard(o) {
  const b = S.bank(); let files = null; const isItem = o.kind === 'item';
  const e = new EmbedBuilder().setTitle(`🧾 ${isItem ? 'Đơn mua' : 'Đơn nạp'} #${o.id} — ${stLabel[o.status] || o.status}`).setColor(o.status === 'done' ? 0x2ecc71 : 0xf39c12);
  const lines = [isItem ? `Mua: **${S.orderText(o).replace(/^🛒 /, '').replace(/ — .*$/, '')}**\nKhách: <@${o.user_id}>` : `Gói: **${S.vnd(o.vnd)}** → ${NB} **${fmtNum(o.nb)}**`, `Tạo lúc: ${ago(o.created_at)}`];
  if (o.status === 'pending') {
    if (b.ready) lines.push('', '**Thông tin chuyển khoản**', `🏦 Ngân hàng: **${b.id}**`, `🔢 Số tài khoản: **${b.acc}**`, `👤 Chủ tài khoản: **${b.name}**`);
    else lines.push('', '**Quét mã QR bên dưới** bằng app ngân hàng hoặc ví (Zalopay…)', `👤 Chủ tài khoản: **${S.ownerName()}**`);
    lines.push(`💵 Số tiền: **${S.vnd(o.vnd)}**  _(nhập đúng số tiền)_`, `📝 Nội dung / lời nhắn: **${S.code(o.id)}**  _(ghi đúng mã này; nếu app không cho ghi nội dung, hãy gửi biên lai cho admin)_`, '', o.claimed ? '✅ Khách đã báo đã chuyển — đang chờ admin xác nhận.' : `Chuyển xong hãy bấm **Tôi đã chuyển khoản**. Đơn tự hết hạn sau 24 giờ nếu chưa được xác nhận.${isItem ? ' Admin xác nhận xong, vật phẩm được giao thẳng vào túi.' : ''}`);
    const u = b.ready ? S.qrUrl(o) : null; if (u) e.setImage(u); else if (S.qrFile()) { e.setImage('attachment://qr_nap.jpg'); files = [new AttachmentBuilder(S.qrFile(), { name: 'qr_nap.jpg' })]; }
  } else if (o.note) lines.push(`Ghi chú: ${fit(o.note, 200)}`);
  e.setDescription(fit(lines.join('\n'), 3800));
  return { e, files };
}
function viewOrder(uid, id) {
  const o = S.order(id); if (!o || String(o.user_id) !== String(uid)) return { ...viewTopup(uid), content: '❌ Không tìm thấy đơn.' };
  const { e, files } = orderCard(o);
  const row = [];
  if (o.status === 'pending') { row.push(btn(cid(uid, 'paid', String(o.id)), 'Tôi đã chuyển khoản', '✅', ButtonStyle.Success, !!o.claimed)); row.push(btn(cid(uid, 'ocx', String(o.id)), 'Huỷ đơn', '🚫', ButtonStyle.Danger, !!o.claimed)); }
  row.push(btn(cid(uid, 'ords'), 'Đơn của tôi', '🧾'), btn(cid(uid, 'home'), 'Trang chủ', '🏠'));
  return files ? { embeds: [e], components: [rowOf(...row)], files, attachments: [] } : { embeds: [e], components: [rowOf(...row)] };
}
function viewOrders(uid) {
  const os = S.ordersOf(uid, 10); const w = S.wallet(uid);
  const e = new EmbedBuilder().setTitle('🧾 Đơn nạp của bạn').setColor(0x3498db);
  e.setDescription(fit(`${header(uid)} · đã nạp tổng ${NB} ${fmtNum(w.topped)} · đã tiêu ${NB} ${fmtNum(w.spent)}\n\n${os.length ? listFit(os.map((o) => `**#${o.id}** · ${o.kind === 'item' ? S.orderText(o) : `${S.vnd(o.vnd)} → ${NB} ${fmtNum(o.nb)}`} · ${stLabel[o.status] || o.status}${o.status === 'pending' && o.claimed ? ' (đã báo chuyển)' : ''} · ${ago(o.created_at)}`), 3500) : '_Bạn chưa có đơn nào._'}`, 4000));
  const pend = os.filter((o) => o.status === 'pending');
  const comps = [];
  if (pend.length) comps.push(rowOf(new StringSelectMenuBuilder().setCustomId(cid(uid, 'osel')).setPlaceholder('Mở đơn đang chờ…').addOptions(pend.slice(0, 25).map((o) => ({ label: `#${o.id} · ${S.vnd(o.vnd)}`, value: String(o.id), description: o.claimed ? 'Đã báo chuyển — chờ admin' : 'Chưa báo chuyển' })))));
  comps.push(rowOf(btn(cid(uid, 'topv'), 'Nạp thêm', '💳', ButtonStyle.Success), btn(cid(uid, 'home'), 'Trang chủ', '🏠')));
  return { embeds: [e], components: comps };
}
function render(uid, view = 'home', a = '', b = '', note = '') {
  uid = String(uid);
  let out;
  switch (view) {
    case 'list': out = viewList(uid, a); break;
    case 'item': out = viewItem(uid, a, b); break;
    case 'topup': out = viewTopup(uid); break;
    case 'order': out = viewOrder(uid, a); break;
    case 'orders': out = viewOrders(uid); break;
    default: out = viewHome(uid);
  }
  if (note) out.content = fit(note, 1900, '');
  return out;
}
const open = (i, uid, view = 'home') => i.reply({ ...render(String(uid), view), flags: EPHEMERAL });

// ---------------------------------------------------------------- thông báo (DM, cố gắng hết sức)
async function dm(client, userId, payload) { try { const u = await client.users.fetch(String(userId)); await u.send(payload); return true; } catch (_) { return false; } }
async function notifyAdmins(client, text) {
  const ids = require('../game/constants').ADMIN_CODE_APPROVER_IDS || []; let n = 0;
  for (const id of ids) if (await dm(client, id, { content: fit(text, 1900, '') })) n += 1;
  return n;
}

// ---------------------------------------------------------------- xử lý bấm nút (tĩnh)
registerStatic('sp', async (i, parts) => {
  const [uid, act, a0, b0] = parts; const a = a0 === undefined ? '' : a0; const b = b0 === undefined ? '' : b0;
  if (String(i.user.id) !== String(uid)) return i.reply({ content: '❌ Đây không phải bảng của bạn — gõ `/cuahang` để mở cửa hàng riêng.', flags: EPHEMERAL });
  if (!Cu.getCultivator(i.user.id)) return i.update({ content: '❌ Bạn chưa bắt đầu tu tiên.', embeds: [], components: [] });
  const u = String(uid); const sel = (i.values || [])[0];
  const go = (view, aa = '', bb = '', note = '') => { const p = render(u, view, aa, bb, note); if (!p.files) p.attachments = []; return i.update(p); };   // attachments: [] gỡ ảnh QR cũ khi rời màn đơn
  switch (act) {
    case 'home': return go('home');
    case 'nav': return go('list', stateStr(sel, 0, ''));
    case 'pg': return go('list', a);
    case 'it': return go('item', sel);
    case 'qs': return go('item', a, sel);
    case 'buy': { const cut = a.lastIndexOf(':'); const key = a.slice(0, cut); const q = a.slice(cut + 1); const r = S.buy(u, key, Number(q) || 0, Number(b) || 1); return go('item', key, q, r.msg); }
    case 'topv': return go('topup');
    case 'top': { const r = S.createOrder(u, Number(a)); return r.ok ? go('order', String(r.id), '', `🧾 Đã tạo đơn **#${r.id}** — hãy chuyển khoản đúng thông tin bên dưới.`) : go('topup', '', '', r.msg); }
    case 'ords': return go('orders');
    case 'osel': return go('order', sel);
    case 'paid': {
      const r = S.claim(u, Number(a)); if (!r.ok) return go('orders', '', '', r.msg);
      notifyAdmins(i.client, `💳 **Đơn nạp #${r.order.id}** — <@${u}> báo đã chuyển **${S.vnd(r.order.vnd)}** (nội dung \`${S.code(r.order.id)}\`). Kiểm tra tài khoản rồi **/quantri → Cửa Hàng & Đơn Nạp → Done đơn**.`).catch(() => {});
      return go('order', a, '', '✅ Đã báo admin. Khi admin xác nhận, Nguyên Bảo sẽ vào ví (bạn sẽ nhận tin nhắn nếu bot nhắn riêng được).');
    }
    case 'ocx': { const r = S.cancelOwn(u, Number(a)); return go('orders', '', '', r.ok ? '🚫 Đã huỷ đơn.' : r.msg); }
    case 'find':
      return showModal(i, { title: 'Tìm mặt hàng', fields: [{ id: 'q', label: 'Tên vật phẩm (không cần dấu)', maxLength: 24, placeholder: 'ngọc giản / đan / kiếm…' }], onSubmit: async (mi, get) => {
        const panel = render(u, 'list', stateStr('', 0, get('q'))); panel.attachments = [];
        if (typeof mi.isFromMessage === 'function' && mi.isFromMessage() && typeof mi.update === 'function') { try { return await mi.update(panel); } catch (_) { /* rơi xuống reply */ } }
        return mi.reply({ ...panel, flags: EPHEMERAL });
      } });
    default: return go('home');
  }
});

// ---------------------------------------------------------------- `.od` — thẻ đơn trong kênh (khách + admin cùng thấy)
/** Nút: khách báo chuyển / admin Done / huỷ. customId `od|<đơn>|<hành động>` — quyền kiểm TRONG bộ xử lý (khách chỉ báo chuyển, chỉ admin Done). */
function renderOd(id, note = '') {
  const o = S.order(id); if (!o) return { content: '❌ Không tìm thấy đơn.', embeds: [], components: [], attachments: [] };
  const { e, files } = orderCard(o);
  const comps = o.status === 'pending' ? [rowOf(btn(`od|${o.id}|paid`, 'Tôi đã chuyển khoản', '✅', ButtonStyle.Success, !!o.claimed), btn(`od|${o.id}|done`, 'Done đơn (admin)', '🛒', ButtonStyle.Primary), btn(`od|${o.id}|cancel`, 'Huỷ', '🚫', ButtonStyle.Danger))] : [];
  const out = { content: note ? fit(note, 1900, '') : (o.status === 'pending' ? `<@${o.user_id}>` : ''), embeds: [e], components: comps };
  if (files && o.status === 'pending') { out.files = files; out.attachments = []; } else out.attachments = [];
  return out;
}
/** Tin nhắn riêng báo khách khi admin done đơn. */
const doneDm = (o) => (o.kind === 'item' ? `✅ **Đơn mua #${o.id}** đã xác nhận — vật phẩm đã vào túi của bạn! Dùng \`/khodo\` để xem.` : `✅ **Đơn nạp #${o.id}** đã được xác nhận: +**${fmtNum(o.nb)}** 💠 Nguyên Bảo. Dùng \`/cuahang\` để mua sắm!`);
registerStatic('od', async (i, parts) => {
  const [oid, act] = parts; const o = S.order(Number(oid));
  const isAdmin = require('../commands/framework').isAdminApprover(i.user.id);
  if (!o) return i.reply({ content: '❌ Không tìm thấy đơn.', flags: EPHEMERAL });
  const mine = String(o.user_id) === String(i.user.id);
  if (act === 'paid') {
    if (!mine && !isAdmin) return i.reply({ content: '❌ Chỉ khách của đơn này mới báo đã chuyển được.', flags: EPHEMERAL });
    const r = S.claim(o.user_id, o.id); if (!r.ok) return i.update(renderOd(o.id, r.msg));
    notifyAdmins(i.client, `💳 **Đơn #${o.id}** — <@${o.user_id}> báo đã chuyển **${S.vnd(o.vnd)}** (${S.orderText(o).replace(/ — .*$/, '')}), nội dung \`${S.code(o.id)}\`. Kiểm tra tài khoản rồi bấm **Done đơn** (trong kênh hoặc /quantri).`).catch(() => {});
    return i.update(renderOd(o.id));
  }
  if (act === 'done') {
    if (!isAdmin) return i.reply({ content: '❌ Chỉ admin mới xác nhận (done) đơn được.', flags: EPHEMERAL });
    const r = S.confirm(i.user.id, o.id); if (!r.ok) return i.update(renderOd(o.id, r.msg));
    const sent = await dm(i.client, r.order.user_id, { content: doneDm(r.order) });
    return i.update(renderOd(o.id, `${r.msg}${sent ? '' : '\nℹ️ Không nhắn riêng được cho khách (họ tắt DM) — hãy báo họ.'}`));
  }
  if (act === 'cancel') {
    if (isAdmin) { const r = S.adminCancel(i.user.id, o.id); return i.update(renderOd(o.id, r.msg)); }
    if (!mine) return i.reply({ content: '❌ Bạn không huỷ được đơn của người khác.', flags: EPHEMERAL });
    const r = S.cancelOwn(i.user.id, o.id); return i.update(renderOd(o.id, r.ok ? '🚫 Khách đã huỷ đơn.' : r.msg));
  }
  return i.reply({ content: '❌ Thao tác không hợp lệ.', flags: EPHEMERAL });
});

module.exports = { render, open, dm, notifyAdmins, renderOd, orderCard, doneDm };
