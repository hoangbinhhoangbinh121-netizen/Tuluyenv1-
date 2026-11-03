'use strict';
const K = require('../game/constants');
const Cu = require('../game/cultivator');
const A = require('../game/actionsBasic');
const { doDotpha } = require('../game/dotpha');
const F = require('../game/format');
const { E } = require('../game/emoji');
const { View, safeReply, tryUserLock, EPHEMERAL } = require('./kit');
const { buildStatusEmbed, buildSettingsEmbed, linhgioiAttachment } = require('./embeds');
const { sleep } = require('../util');
const CD = require('../game/cooldowns');
const { now } = require('../util');
const SV = require('./shopViews');
const CHAR = require('./templates/character');
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { registerStatic } = require('./kit');
const { toComponentEmoji } = require('../game/emoji');
const Dan = require('../game/dan');
const { doDotpha: _dd } = require('../game/dotpha');

const ANIM_STEPS = K.TULUYEN_ANIM_STEPS; const ANIM_DELAY = K.TULUYEN_ANIM_DELAY * 1000;
const BUSY = '⚠️ Bạn đang thao tác quá nhanh, vui lòng chờ lượt trước xử lý xong rồi thử lại.';
const COMING = '🚧 Mục này đang được chuyển sang bản Node.js — sẽ có ở bản cập nhật kế tiếp.';

/** Tu Luyện / Bế Quan: khung "đang tu luyện" chạy dần rồi hiện kết quả (Embed chuẩn v7). Bọc khoá theo người chơi. */
const CULT = require('./templates/cultivation');
const N = require('./notifications');
async function animate(interaction, userId, { kind, cooldown, lastCol, run }) {
  const unlock = tryUserLock(userId);
  if (!unlock) return interaction.reply({ embeds: [N.warning('Bạn đang thao tác quá nhanh, vui lòng chờ lượt trước xử lý xong rồi thử lại.', { footer: 'E008 · Dữ liệu đang được xử lý' })], flags: EPHEMERAL });
  try {
    const row = Cu.getCultivator(userId);
    const remain = cooldown - (now() - row[lastCol]);
    if (remain > 0) return await interaction.reply({ embeds: [CULT.cooldown(kind, remain)], flags: EPHEMERAL });
    await interaction.reply({ embeds: [CULT.inProgress(kind, 0, ANIM_STEPS)], flags: EPHEMERAL });
    for (let st = 1; st <= ANIM_STEPS; st++) {
      await sleep(ANIM_DELAY);
      await interaction.editReply({ embeds: [CULT.inProgress(kind, st, ANIM_STEPS)] }).catch(() => {});
    }
    const res = run(userId);
    const emb = res.ok ? CULT.result(res) : CULT.cooldown(kind, res.remain);
    try { await interaction.editReply({ embeds: [emb] }); }
    catch (_) { await interaction.followUp({ embeds: [emb], flags: EPHEMERAL }).catch(() => {}); }  // kết quả không bao giờ bị nuốt
  } finally { unlock(); }
}
const animateTuluyen = (i, u) => animate(i, u, { kind: 'tuluyen', cooldown: CD.COOLDOWN_TULUYEN, lastCol: 'last_tuluyen', run: A.tuluyenR });
const animateDongquan = (i, u) => animate(i, u, { kind: 'dongquan', cooldown: CD.COOLDOWN_DONGQUAN, lastCol: 'last_dongquan', run: A.dongquanR });

function tuLuyenGroupView(userId) {
  const v = new View({ ownerId: userId, timeout: 120 });
  v.button({ key: 'tuluyen', label: 'Tu Luyện', emoji: E.tuluyen, style: 'green' }, (i) => animateTuluyen(i, userId));
  v.button({ key: 'bequan', label: 'Bế Quan', emoji: E.bequan, style: 'blurple' }, (i) => animateDongquan(i, userId));
  v.button({ key: 'canngo', label: 'Cảm Ngộ', emoji: E.linhngo, style: 'grey' }, (i) => i.reply({ embeds: [CULT.simple(A.doCanngo(userId), 'CẢM NGỘ')], flags: EPHEMERAL }));
  v.button({ key: 'danduoc', label: 'Dùng Đan Dược', emoji: E.danduoc, style: 'grey' }, (i) => SV.open(i, `${E.danduoc} Chọn Đan Dược muốn dùng:`, SV.danDuocView(userId)));
  v.button({ key: 'hoihp', label: 'Hồi HP', emoji: E.hoihp, style: 'green' }, (i) => i.reply({ embeds: [CULT.simple(A.doHoiHp(userId), 'HỒI PHỤC')], flags: EPHEMERAL }));
  return v;
}

/** Giữ tên cũ cho module khác: Embed Nhân vật (tab Tổng quan). */
async function statusPayload(user, userId) { return CHAR.build(user, Cu.getCultivator(userId), 'tongquan'); }

function khacGroupView(userId, mainMessage) {
  const v = new View({ ownerId: userId, timeout: 120 });
  v.button({ key: 'shop', label: 'Cửa Hàng', emoji: E.shop, style: 'secondary' }, (i) => SV.open(i, `${E.shop} **Cửa Hàng**`, SV.shopView(userId)));
  v.button({ key: 'settings', label: 'Cài Đặt', emoji: E.caidat, style: 'secondary' }, (i) =>
    i.reply({ embeds: [buildSettingsEmbed(i.user, Cu.getCultivator(userId))], flags: EPHEMERAL }));
  v.button({ key: 'taytuy', label: 'Đan Tẩy Tủy', emoji: E.taytuydan, style: 'secondary' }, (i) => i.reply({ content: Dan.doTaytuyReroll(userId), flags: EPHEMERAL }));
  v.button({ key: 'taytuy_nb', label: 'Đan Tẩy Tủy (Nửa)', emoji: E.taytuydan, style: 'secondary' }, (i) => SV.taytuyNuabanPrompt(i, userId));
  v.button({ key: 'refresh', label: 'Làm Mới', emoji: E.lammoi, style: 'secondary' }, async (i) => {
    try { await mainMessage.edit({ embeds: [CHAR.build(i.user, Cu.getCultivator(userId), 'tongquan')], components: mainComponents('tongquan') }); } catch (_) { /* hết hạn */ }
    await i.reply({ content: '🔄 Đã làm mới menu chính.', flags: EPHEMERAL });
  });
  return v;
}

const MENU_OPTIONS = [
  ['Tu Luyện', 'tuluyen', 'tuluyen', 'Tu luyện / Bế quan / Cảm ngộ'], ['Tu Hành', 'tuhanh', 'caidat', 'Công pháp & linh mạch'],
  ['Nghề Nghiệp', 'nghenghiep', 'nghenghiep', 'Luyện đan & luyện khí'], ['Chiến Đấu', 'chiendau', 'kiem', 'Bí cảnh & boss thế giới'],
  ['Đồng Hành', 'donghanh', 'dongthanh', 'Linh thú & đạo lữ (song tu)'], ['Phi Thăng', 'phithang', 'phithang', 'Điều kiện & thực hiện Phi Thăng'],
  ['Tông Môn', 'tongmon', 'tongmon'], ['PvP', 'pvp', 'kiem', 'Đấu pháp với người chơi khác'],
  ['Vượt Thiên Kiếp', 'thienkiep', 'thienkiep'], ['Sứ Giả', 'sugia', 'linhgioilenh'], ['Động Phủ', 'dongphu', 'dongphu'],
  ['Xếp Hạng', 'xephang', 'cup'], ['Giao Dịch', 'giaodich', 'giaodich'], ['Kho Đồ', 'khodo', 'khodo'],
  ['Coin Một Ngày Đại Phú', 'event_daiphu', 'sukiendaiphu'], ['Khác', 'khac', 'khac', 'Cửa hàng / cài đặt / làm mới'],
];

/** Các mục menu đã port xong. Mục còn lại tự trả "COMING" — thêm handler vào đây khi port module mới. */
const GROUP_HANDLERS = {
  async tuluyen(i, userId) {
    await i.reply({ content: '🧘 **Tu Luyện** — chọn cách tu luyện:', components: tuLuyenGroupView(userId).components(), flags: EPHEMERAL });
  },
  async tuhanh(i, userId) {
    await SV.open(i, '🧘 **Tu Hành** — Công Pháp / Pháp Bảo / Linh Mạch:', SV.tuHanhGroupView(userId));
  },
  async nghenghiep(i, userId) {
    await SV.open(i, '⚒️ **Nghề Nghiệp** — Luyện Đan / Luyện Khí:', SV.ngheNghiepGroupView(userId));
  },
  async phithang(i, userId) {
    const { phiThangGroupView } = require('./phithang');
    await SV.open(i, '🌌 **Phi Thăng** — điều kiện / phi thăng / thiên kiếp / sứ giả / ngũ suy:', phiThangGroupView(userId));
  },
  async tongmon(i, userId) {
    const sv = require('./sectViews');
    await i.reply({ embeds: [sv.buildSectEmbed(Cu.getCultivator(userId))], components: sv.sectMainView(userId).components(), flags: EPHEMERAL });
  },
  async xephang(i) { await i.reply({ embeds: [require('./socialViews').buildLeaderboardEmbed()], flags: EPHEMERAL }); },
  async donghanh(i, userId) { await SV.open(i, '🐾 **Đồng Hành** — Linh Thú / Đạo Lữ:', require('./socialViews').donghanhGroupView(userId)); },
  async giaodich(i, userId) { await SV.open(i, `${E.giaodich} **Giao Dịch** — chọn người muốn giao dịch:`, require('./socialViews').tradeTargetView(userId)); },
  async dongphu(i, userId) {
    const sv = require('./socialViews');
    await i.reply({ embeds: [sv.buildDongphuEmbed(i.user, Cu.getCultivator(userId))], components: sv.dongphuView(userId).components(), flags: EPHEMERAL });
  },
  async thienkiep(i, userId) { await i.reply({ content: require('../game/ascension').doVuotthienkiep(userId), flags: EPHEMERAL }); },
  async sugia(i, userId) { await i.reply({ content: require('../game/ascension').doDanhPhithangSugia(userId), flags: EPHEMERAL }); },
  async pvp(i, userId) {
    await SV.open(i, '⚔️ **PvP** — chọn đối thủ để gửi lời khiêu chiến đấu pháp:', require('./pvpViews').pvpTargetView(userId));
  },
  async event_daiphu(i, userId) {
    await i.reply({ ...require('./daiphuViews').mainPayload(i.guildId || 0, i.user), flags: EPHEMERAL });
  },
  async chiendau(i, userId) {
    const { chienDauGroupView } = require('./chienDau');
    await SV.open(i, '⚔️ **Chiến Đấu** — Bí Cảnh / Boss Thế Giới:', chienDauGroupView(userId));
  },
  async khodo(i, userId) {
    const { buildKhodoEmbed, khoDoView } = require('./khodo');
    await i.reply({ embeds: [buildKhodoEmbed(i.user, Cu.getCultivator(userId))], components: khoDoView(userId).components(), flags: EPHEMERAL });
  },
  async khac(i, userId) {
    const v = khacGroupView(userId, i.message);
    await i.reply({ content: '📦 **Khác** — cửa hàng / cài đặt / làm mới:', components: v.components(), flags: EPHEMERAL });
  },
};
const registerGroup = (key, fn) => { GROUP_HANDLERS[key] = fn; };

// ================= MENU CHÍNH — BỀN VỮNG (không phụ thuộc bộ nhớ, sống sót qua restart) =================
// customId tĩnh: tg|menu · tg|tab · tg|dotpha|<tab> · tg|lammoi|<tab> · tg|dong
// Chủ menu = người đã gõ /tutien (đọc từ metadata của tin nhắn). Người KHÁC bấm vào menu công khai của người khác
// sẽ không bị từ chối nữa: bot mở BẢNG RIÊNG (ẩn) của chính họ — họ vẫn tu luyện, đánh boss... bình thường.
function mainComponents(tab = 'tongquan') {
  const menu = new StringSelectMenuBuilder().setCustomId('tg|menu').setPlaceholder('📋 Chọn chức năng...')
    .addOptions(MENU_OPTIONS.map(([label, value, emo, description]) => {
      const o = { label, value }; if (description) o.description = description;
      const em = toComponentEmoji(E[emo]); if (em) o.emoji = em; return o;
    }));
  const tabs = new StringSelectMenuBuilder().setCustomId('tg|tab').setPlaceholder('🗂️ Xem thông tin nhân vật...')
    .addOptions(CHAR.TABS.map(([value, label, emo]) => {
      const o = { label, value, default: value === tab }; const em = toComponentEmoji(E[emo]); if (em) o.emoji = em; return o;
    }));
  const mk = (id, label, emo, style) => { const b = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style); const em = toComponentEmoji(E[emo]); if (em) b.setEmoji(em); return b; };
  return [
    new ActionRowBuilder().addComponents(menu),
    new ActionRowBuilder().addComponents(tabs),
    new ActionRowBuilder().addComponents(
      mk(`tg|dotpha|${tab}`, 'Đột Phá', 'dotpha', ButtonStyle.Danger),
      mk(`tg|lammoi|${tab}`, 'Làm Mới', 'lammoi', ButtonStyle.Secondary),
      mk('tg|dong', 'Đóng', 'dongmenu', ButtonStyle.Secondary),
    ),
  ];
}
const ownerOf = (i) => { const m = i.message; const id = (m && m.interactionMetadata && m.interactionMetadata.user && m.interactionMetadata.user.id) || (m && m.interaction && m.interaction.user && m.interaction.user.id); return id ? String(id) : null; };

registerStatic('tg', async (i, parts) => {
  const action = parts[0]; const uid = String(i.user.id);
  const owner = ownerOf(i); const isOwner = owner === null || owner === uid;
  if (!Cu.getCultivator(uid)) {
    return i.reply({ embeds: [N.error('Bạn chưa bắt đầu tu tiên — dùng `/batdau` để bước lên con đường tu tiên, rồi `/tutien` để mở menu.', 'E001')], flags: EPHEMERAL });
  }
  if (action === 'menu') {
    const fn = GROUP_HANDLERS[i.values[0]];
    return fn ? fn(i, uid) : i.reply({ content: COMING, flags: EPHEMERAL });
  }
  if (action === 'tab') {
    const tab = CHAR.TAB_KEYS.includes(i.values[0]) ? i.values[0] : 'tongquan';
    const emb = CHAR.build(i.user, Cu.getCultivator(uid), tab);
    if (isOwner) return i.update({ embeds: [emb], components: mainComponents(tab) });
    return i.reply({ embeds: [emb], flags: EPHEMERAL });
  }
  if (action === 'dotpha') {
    const tab = parts[1] || 'tongquan';
    const d = require('../game/dotpha').dotphaR(uid);
    const result = require('./templates/breakthrough').result(d);
    if (isOwner) {
      await i.update({ embeds: [CHAR.build(i.user, Cu.getCultivator(uid), tab)], components: mainComponents(tab) });
      await i.followUp({ embeds: [result], flags: EPHEMERAL });
    } else await i.reply({ embeds: [result], flags: EPHEMERAL });
    if (d.kind === 'success' && d.major) require('./worldAnnounce').announceBreakthrough(i.client, i.guildId, i.user, d).catch(() => {});
    return null;
  }
  if (action === 'lammoi') {
    const tab = parts[1] || 'tongquan';
    const emb = CHAR.build(i.user, Cu.getCultivator(uid), tab);
    if (isOwner) return i.update({ embeds: [emb], components: mainComponents(tab) });
    return i.reply({ embeds: [emb], flags: EPHEMERAL });
  }
  if (action === 'dong') {
    if (!isOwner) return i.reply({ embeds: [N.warning('Chỉ chủ menu mới đóng được menu này. Hãy gõ `/tutien` để mở menu riêng của bạn.')], flags: EPHEMERAL });
    return i.update({ content: 'Đã đóng menu tu tiên.', embeds: [], components: [] });
  }
  return null;
});

/** Tương thích mã cũ: trả đối tượng có .components(). */
function tuTienMenuView(userId, tab = 'tongquan') { return { components: () => mainComponents(tab) }; }

module.exports = { mainComponents, tuTienMenuView, tuLuyenGroupView, registerGroup, linhgioiAttachment, animateTuluyen, animateDongquan, statusPayload, COMING };
