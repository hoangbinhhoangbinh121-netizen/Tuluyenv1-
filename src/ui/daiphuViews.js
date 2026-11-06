'use strict';
const { EmbedBuilder } = require('discord.js');
const K = require('../game/constants');
const P = require('../game/daiphu');
const { E } = require('../game/emoji');
const { View, showModal, EPHEMERAL } = require('./kit');
const { now, int, fmtNum, pyRound } = require('../util');

const A = P.ASSETS; const J = P.J; const money = P.money;
const icon = (pct) => (pct > 0 ? E.sk_tang : pct < 0 ? E.sk_giam : '➖');
const pctText = (pct) => (pct ? `${icon(pct)} ${pct > 0 ? '+' : ''}${pct}%` : '➖ 0%');
const gid = (i) => (i.guildId || 0);
const eph = (i, c, x = {}) => i.reply({ content: c, flags: EPHEMERAL, ...x });

function rulesEmbed() {
  const f = (name, value) => ({ name, value, inline: false });
  return new EmbedBuilder().setTitle(`${E.sk_luat} LUẬT SỰ KIỆN — MỘT NGÀY ĐẠI PHÚ`).setColor(0xf1c40f).addFields(
    f(`${E.sk_thoigian} Mục tiêu`, `Event kéo dài 24 giờ, mỗi người bắt đầu với 💰 10.000.000 Linh Thạch Sự Kiện.\n${E.sk_xephang} Ai có 📊 tổng tài sản cao nhất khi hết giờ đứng 🥇 Top 1.\nBằng tài sản → ai đạt số đó ⏳ sớm hơn xếp trên.`),
    f(`${E.sk_tien} Luật vốn`, `Tiền event tách biệt hoàn toàn với Linh Thạch thật.\n${E.sk_camkhoa} Không nạp Linh Thạch thật · không chuyển tiền/tài sản event cho người khác · không rút tài sản event trước khi kết thúc.\nHết event, toàn bộ tài sản event bị xoá sau khi chốt kết quả.`),
    f(`${E.sk_thitruong} Luật đầu tư`, `6 tài sản: 💎 Linh Ngọc · 🌿 Linh Dược · ⚔️ Pháp Bảo · 📜 Công Pháp · 🪙 Tiên Tinh · 🩸 Yêu Hạch.\n${E.sk_mua} Mua, 💰 bán hoặc 📦 giữ tài sản — giá thay đổi định kỳ (${E.sk_tang} tăng / ${E.sk_giam} giảm giá trị).\n${E.sk_camkhoa} Giao dịch đã xác nhận không thể hoàn tác.`),
    f(`${E.sk_thienco} Thiên Cơ`, `Số lượt sử dụng giới hạn, cung cấp dự đoán về ${E.sk_tang}${E.sk_giam} thị trường.\n${E.sk_ngaunhien} Thông tin không đảm bảo chính xác 100%.`),
    f(`${E.sk_nganKho} Ngân Khố`, `Kỳ hạn 2h / 6h / 12h, tiền gửi bị khoá đến khi đáo hạn.\n${E.sk_camkhoa} Không rút trước hạn — đáo hạn mới nhận lợi nhuận.`),
    f(`${E.sk_thuongvu} Thương vụ mạo hiểm`, `Giới hạn lượt, phải xác nhận trước khi tham gia.\n${E.sk_ngaunhien} Kết quả do hệ thống quyết định — ${E.sk_camkhoa} không thể hoàn tác sau khi tham gia.`),
    f(`${E.sk_baohiem} Bảo hiểm`, `Có thể bảo hiểm một phần tài sản (phải trả phí).\n${E.sk_giam} Chỉ bồi thường khi đạt điều kiện sụt giảm, có giới hạn mức bồi thường.`),
    f(`${E.sk_nhiemvu} Nhiệm vụ`, `Xuất hiện ngẫu nhiên, có thể yêu cầu mua/bán/nắm giữ tài sản.\n${E.sk_phanthuong} Hoàn thành nhận thưởng — ${E.sk_camkhoa} không được lợi dụng để tạo tài sản vô hạn.`),
    f(`${E.sk_taisan} Rương Tài Vận`, `Có thể chứa: 💰 Tiền event · 🔮 Thiên Cơ · 📈 Vé tăng giá · 🛡️ Bảo hiểm · 🎰 Vé thương vụ · 🎁 Phần thưởng.\n${E.sk_ngaunhien} Nội dung được xác định ngẫu nhiên.`),
    f(`${E.sk_camkhoa} Luật gian lận`, `Nghiêm cấm: dùng nhiều tài khoản thao túng, lợi dụng bug, can thiệp dữ liệu/giao dịch, chuyển tài sản event giữa người chơi, tạo lợi nhuận bằng lỗi hệ thống.\n${E.sk_canhbao} Vi phạm có thể bị loại event, xoá kết quả và thu hồi phần thưởng.`),
    f(`${E.sk_thoigian} Khi event kết thúc`, 'Hệ thống tự động: khoá mua/bán → khoá Thiên Cơ → khoá thương vụ → chốt giá tài sản → tính tổng tài sản → xếp hạng → phát thưởng → xoá tài sản event.'),
  ).setFooter({ text: 'Nút "Coin Một Ngày Đại Phú" luôn hiển thị, kể cả trước khi event bắt đầu và sau khi event kết thúc.' });
}

/** → { embed, ev } (ev = null nếu chưa từng mở) */
function buildEventEmbed(guildId, user) {
  const ev = P.getEvent(guildId);
  if (!ev) return { embed: new EmbedBuilder().setTitle(`${E.sk_coin} MỘT NGÀY ĐẠI PHÚ`).setDescription('Server chưa có sự kiện nào được mở. Admin dùng `/mosukienphu` để mở.').setColor(0x99aab5), ev: null };
  if (ev.status === 'NOT_STARTED') {
    const e = new EmbedBuilder().setTitle(`${E.sk_thoigian} EVENT CHƯA BẮT ĐẦU`).setColor(0xf1c40f).addFields(
      { name: '📊 Thời gian bắt đầu', value: `<t:${int(ev.start_time)}:F>`, inline: false },
      { name: `${E.sk_thoigian} Còn lại`, value: P.formatCountdown(ev.start_time - now()), inline: false },
      { name: `${E.sk_tien} Vốn khởi điểm`, value: fmtNum(K.EVENT_DAIPHU_STARTING_CASH), inline: false }).setFooter({ text: 'Bạn có thể xem thông tin nhưng chưa thể đầu tư.' });
    return { embed: e, ev };
  }
  if (ev.status === 'RUNNING') {
    const p = P.getOrJoinPlayer(guildId, user.id); const prices = J(ev.market_prices, {}); const changes = J(ev.market_changes, {});
    const assets = J(p.assets, {}); const deps = J(p.bank_deposits, []); const total = P.totalAssets(p.cash, assets, prices, deps);
    const [, scored] = P.leaderboard(guildId, prices, 10000); const idx = scored.findIndex((s) => String(s[0]) === String(user.id));
    const [label, value] = P.formatMarketCountdown(P.nextMarketSeconds(ev));
    const e = new EmbedBuilder().setTitle(`${E.sk_coin} MỘT NGÀY ĐẠI PHÚ`).setColor(0x2ecc71).addFields(
      { name: `${E.sk_thoigian} Còn lại`, value: P.formatCountdown(ev.end_time - now()), inline: false }, { name: label, value, inline: false },
      { name: `${E.sk_tien} Tiền mặt`, value: money(p.cash), inline: true }, { name: `${E.sk_thitruong} Tổng tài sản`, value: money(total), inline: true },
      { name: `${E.sk_xephang} Xếp hạng`, value: `#${idx >= 0 ? idx + 1 : '?'}`, inline: true });
    if (deps.length) e.addFields({ name: `${E.sk_nganKho} Ngân Khố`, value: deps.map((d) => `${money(d.amount)} — đáo hạn <t:${int(d.maturity_time)}:R>`).join('\n'), inline: false });
    const lines = Object.entries(A).map(([k, a]) => { const pc = changes[k] || 0; return `${a.emoji} **${a.name}**\n${money(prices[k] !== undefined ? prices[k] : a.base_price)}  ${pctText(pc)}  (đang giữ: ${assets[k] || 0})`; });
    e.addFields({ name: `${E.sk_thitruong} THỊ TRƯỜNG`, value: lines.join('\n\n'), inline: false }).setFooter({ text: 'Mua thấp — bán cao. Giá cập nhật mỗi 10 phút.' });
    return { embed: e, ev };
  }
  const fr = J(ev.final_rankings, []);
  const e = new EmbedBuilder().setTitle(`${E.sk_xephang} MỘT NGÀY ĐẠI PHÚ — ĐÃ KẾT THÚC`).setColor(0xe74c3c)
    .setDescription(`📊 Kết quả đã chốt.\n${E.sk_phanthuong} Phần thưởng đã được phát cho Top 1–10.`)
    .addFields({ name: `${E.sk_xephang} BẢNG XẾP HẠNG CHUNG CUỘC`, value: fr.slice(0, 10).map((x, i) => `**#${i + 1}** — <@${x.user_id}> — ${money(x.total)} 💰`).join('\n') || 'Chưa có ai tham gia.', inline: false });
  if (fr.length) e.addFields({ name: `${E.sk_danhhieu} PHÚ HỘ THIÊN HẠ`, value: `<@${fr[0].user_id}> — ${money(fr[0].total)} 💰`, inline: false });
  return { embed: e, ev };
}
function assetDetailEmbed(guildId, user, key) {
  const ev = P.getEvent(guildId); const a = A[key]; const prices = J(ev.market_prices, {}); const changes = J(ev.market_changes, {});
  const price = prices[key] !== undefined ? prices[key] : a.base_price; const pc = changes[key] || 0;
  const qty = J(P.getOrJoinPlayer(guildId, user.id).assets, {})[key] || 0;
  return new EmbedBuilder().setTitle(`${a.emoji} ${a.name.toUpperCase()}`).setColor(0x5865f2).addFields(
    { name: `${E.sk_thitruong} Giá hiện tại`, value: money(price), inline: true }, { name: '📈 Biến động', value: pctText(pc), inline: true },
    { name: `${E.sk_taisan} Đang sở hữu`, value: String(qty), inline: true }, { name: `${E.sk_tien} Giá trị`, value: money(qty * price), inline: true });
}
function historyEmbed(guildId, count = 5) {
  const ev = P.getEvent(guildId); const e = new EmbedBuilder().setTitle(`${E.sk_thitruong} LỊCH SỬ THỊ TRƯỜNG`).setColor(0x5865f2);
  if (!ev) return e.setDescription('Server chưa có sự kiện nào được mở.');
  const h = J(ev.market_history, []); if (!h.length) return e.setDescription('Thị trường chưa có lần cập nhật nào — quay lại sau.');
  const recent = h.slice(-count); const base = Object.fromEntries(Object.entries(A).map(([k, a]) => [k, a.base_price]));
  recent.forEach((entry, i) => {
    const fi = h.length - recent.length + i; const prev = fi > 0 ? h[fi - 1].prices : base;
    const lines = Object.entries(A).map(([k, a]) => {
      const o = prev[k] !== undefined ? prev[k] : a.base_price; const n = entry.prices[k] !== undefined ? entry.prices[k] : a.base_price; const pc = o ? pyRound((n - o) / o * 100, 1) : 0;
      return `${a.emoji} ${a.name} ${money(o)} → ${money(n)} ${pctText(pc)}`;
    });
    e.addFields({ name: `${E.sk_thoigian} Chu kỳ #${entry.cycle} — <t:${int(entry.time)}:R>`, value: lines.join('\n'), inline: false });
  });
  return e.setFooter({ text: `Hiển thị ${recent.length}/${h.length} chu kỳ gần nhất — giá cập nhật mỗi 10 phút.` });
}

const assetOptions = () => Object.entries(A).map(([k, a]) => ({ label: a.name, value: k, emoji: a.emoji }));
const NUM = (raw) => (/^-?\d+$/.test(String(raw).trim()) ? Number(String(raw).trim()) : null);

async function refreshInto(i, view, msg, user) {
  const { embed, ev } = buildEventEmbed(gid(i), user);
  const v = ev && ev.status === 'RUNNING' ? tradeView(user.id) : infoView(user.id);
  const payload = { content: msg, embeds: [embed], components: v.components() };
  try { if (i.isFromMessage && i.isFromMessage()) return await i.update(payload); } catch (_) { /* thử reply */ }
  return i.reply({ ...payload, flags: EPHEMERAL });
}

function assetDetailView(userId, key) {
  const v = new View({ ownerId: userId, timeout: 120 });
  const qtyModal = (isBuy) => (i) => showModal(i, {
    title: `${isBuy ? 'Mua' : 'Bán'} ${A[key].name}`.slice(0, 45), fields: [{ id: 'q', label: 'Số lượng', placeholder: 'Ví dụ: 5', maxLength: 10 }],
    onSubmit: async (mi, get) => {
      const q = NUM(get('q')); if (q === null) return eph(mi, `${E.sk_canhbao} Số lượng phải là số nguyên.`);
      return refreshInto(mi, null, P.trade(gid(mi), userId, key, q, isBuy), mi.user);
    },
  });
  v.button({ key: 'buy', label: 'Mua', emoji: E.sk_mua, style: 'green' }, qtyModal(true));
  v.button({ key: 'sell', label: 'Bán', emoji: E.sk_tien, style: 'red' }, qtyModal(false));
  return v;
}
function assetPickView(userId, isBuy) {
  const v = new View({ ownerId: userId, timeout: 120 });
  v.select({ key: 'a', placeholder: isBuy ? 'Chọn tài sản muốn mua...' : 'Chọn tài sản muốn bán...', options: assetOptions() }, (i, vals) =>
    i.update({ content: null, embeds: [assetDetailEmbed(gid(i), i.user, vals[0])], components: assetDetailView(userId, vals[0]).components() }));
  return v;
}
function oracleView(userId) {
  const v = new View({ ownerId: userId, timeout: 120 });
  v.select({ key: 'o', placeholder: 'Chọn tài sản muốn xem Thiên Cơ...', options: assetOptions() }, (i, vals) => i.update({ content: P.oracleUse(gid(i), userId, vals[0]), embeds: [], components: [] }));
  return v;
}
function insuranceView(userId, held) {
  const v = new View({ ownerId: userId, timeout: 120 });
  v.select({ key: 'b', placeholder: 'Chọn tài sản muốn mua bảo hiểm...', options: held.map((k) => ({ label: A[k].name, value: k, emoji: A[k].emoji })) },
    (i, vals) => i.update({ content: P.insuranceBuy(gid(i), userId, vals[0]), embeds: [], components: [] }));
  return v;
}

function tradeView(userId) {
  const v = new View({ ownerId: userId, timeout: 180 });
  const amountModal = (title, label, ph, fn) => (i) => showModal(i, { title, fields: [{ id: 'n', label, placeholder: ph, maxLength: 20 }], onSubmit: async (mi, get) => {
    const n = NUM(get('n')); if (n === null) return eph(mi, `${E.sk_canhbao} Số tiền phải là số nguyên.`);
    return refreshInto(mi, null, fn(gid(mi), userId, n), mi.user);
  } });
  v.button({ key: 'buy', label: 'Mua', emoji: E.sk_mua, style: 'green', row: 0 }, (i) => i.reply({ content: '🛒 Chọn tài sản muốn mua:', components: assetPickView(userId, true).components(), flags: EPHEMERAL }));
  v.button({ key: 'sell', label: 'Bán', emoji: E.sk_tien, style: 'red', row: 0 }, (i) => i.reply({ content: '💰 Chọn tài sản muốn bán:', components: assetPickView(userId, false).components(), flags: EPHEMERAL }));
  v.button({ key: 'bank', label: 'Ngân Khố', emoji: E.sk_nganKho, style: 'blurple', row: 0 }, amountModal('Gửi Ngân Khố', 'Số tiền muốn gửi', `Tối thiểu ${fmtNum(K.EVENT_DAIPHU_BANK_MIN_DEPOSIT)}`, P.bankDeposit));
  v.button({ key: 'oracle', label: 'Thiên Cơ', emoji: E.sk_thienco, style: 'blurple', row: 1 }, (i) => i.reply({ content: `${E.sk_thienco} Chọn tài sản muốn xem Thiên Cơ:`, components: oracleView(userId).components(), flags: EPHEMERAL }));
  v.button({ key: 'mission', label: 'Nhiệm Vụ', emoji: E.sk_nhiemvu, style: 'grey', row: 1 }, (i) => {
    const md = J(P.getOrJoinPlayer(gid(i), userId).mission_data, {});
    const lines = Object.entries(P.MISSIONS).map(([k, m]) => `${md[k] ? '✅' : '❌'} ${m.desc} — thưởng ${fmtNum(m.reward)}`);
    return i.reply({ embeds: [new EmbedBuilder().setTitle(`${E.sk_nhiemvu} Nhiệm Vụ Một Ngày Đại Phú`).setDescription(lines.join('\n')).setColor(0x1abc9c).setFooter({ text: 'Thưởng tự động cộng vào tiền mặt ngay khi đủ điều kiện.' })], flags: EPHEMERAL });
  });
  v.button({ key: 'risk', label: 'Thương Vụ', emoji: E.sk_thuongvu, style: 'red', row: 1 }, amountModal('Thương Vụ Mạo Hiểm', 'Số tiền mạo hiểm', `Tối thiểu ${fmtNum(K.EVENT_DAIPHU_RISK_MIN_STAKE)}`, P.riskTrade));
  v.button({ key: 'ins', label: 'Bảo Hiểm', emoji: E.sk_baohiem, style: 'blurple', row: 2 }, (i) => {
    const held = Object.entries(J(P.getOrJoinPlayer(gid(i), userId).assets, {})).filter(([, q]) => q > 0).map(([k]) => k);
    if (!held.length) return eph(i, `${E.sk_canhbao} Bạn chưa nắm giữ tài sản nào để mua bảo hiểm.`);
    return i.reply({ content: `${E.sk_baohiem} Chọn tài sản muốn mua bảo hiểm:`, components: insuranceView(userId, held).components(), flags: EPHEMERAL });
  });
  v.button({ key: 'ruong', label: 'Rương', emoji: E.sk_taisan, style: 'green', row: 2 }, (i) => eph(i, P.openRuong(gid(i), userId)));
  v.button({ key: 'hist', label: 'Lịch Sử', emoji: E.sk_thitruong, style: 'grey', row: 2 }, (i) => i.reply({ embeds: [historyEmbed(gid(i))], flags: EPHEMERAL }));
  v.button({ key: 'rank', label: 'Xếp Hạng', emoji: E.sk_xephang, style: 'grey', row: 2 }, (i) => {
    const ev = P.getEvent(gid(i)); if (!ev) return eph(i, 'Chưa có sự kiện nào.');
    const [top] = P.leaderboard(gid(i), J(ev.market_prices, {}), 10);
    return i.reply({ embeds: [new EmbedBuilder().setTitle(`${E.sk_xephang} BXH Một Ngày Đại Phú`).setDescription(top.map(([u, t], n) => `**#${n + 1}** — <@${u}> — ${money(t)} 💰`).join('\n') || 'Chưa có ai tham gia.').setColor(0xf1c40f)], flags: EPHEMERAL });
  });
  v.button({ key: 'refresh', label: 'Làm Mới', emoji: E.lammoi, style: 'blurple', row: 3 }, (i) => refreshInto(i, v, null, i.user));
  v.button({ key: 'close', label: 'Đóng', emoji: E.dongmenu, style: 'secondary', row: 3 }, async (i) => { await i.update({ content: 'Đã đóng Một Ngày Đại Phú.', embeds: [], components: [] }); v.stop(); });
  v.button({ key: 'rules', label: 'Luật', emoji: E.sk_luat, style: 'grey', row: 3 }, (i) => i.reply({ embeds: [rulesEmbed()], flags: EPHEMERAL }));
  return v;
}
function infoView(userId) {
  const v = new View({ ownerId: userId, timeout: 180 });
  v.button({ key: 'refresh', label: 'Làm Mới', emoji: E.lammoi, style: 'blurple' }, (i) => refreshInto(i, v, null, i.user));
  v.button({ key: 'close', label: 'Đóng', emoji: E.dongmenu, style: 'secondary' }, async (i) => { await i.update({ content: 'Đã đóng Một Ngày Đại Phú.', embeds: [], components: [] }); v.stop(); });
  v.button({ key: 'rules', label: 'Luật', emoji: E.sk_luat, style: 'grey' }, (i) => i.reply({ embeds: [rulesEmbed()], flags: EPHEMERAL }));
  return v;
}

/** payload mở màn chính (dùng cho menu & /sukienphu) */
function mainPayload(guildId, user) {
  const { embed, ev } = buildEventEmbed(guildId, user);
  return { embeds: [embed], components: (ev && ev.status === 'RUNNING' ? tradeView(user.id) : infoView(user.id)).components() };
}
module.exports = { mainPayload, rulesEmbed, buildEventEmbed, historyEmbed };
