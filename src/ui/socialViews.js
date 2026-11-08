'use strict';
/** Giao Dịch, Động Phủ, Đồng Hành (Linh Thú + Đạo Lữ), Xếp Hạng */
const { EmbedBuilder } = require('discord.js');
const K = require('../game/constants');
const CD = require('../game/cooldowns');
const R = require('../game/realm');
const Cu = require('../game/cultivator');
const T = require('../game/trade');
const Dp = require('../game/dongphu');
const Dl = require('../game/daolu');
const Dan = require('../game/dan');
const D = require('../db');
const F = require('../game/format');
const { E } = require('../game/emoji');
const { View, showModal, globalClickAllowed, EPHEMERAL } = require('./kit');
const { now, fmtNum } = require('../util');

const eph = (i, c, x = {}) => i.reply({ content: c, flags: EPHEMERAL, ...x });
const yesno = (raw) => ['có', 'co', 'yes', 'y', 'true', '1', 'ok'].includes(String(raw || '').trim().toLowerCase());
const parseIntField = (raw) => { raw = String(raw || '').trim(); if (!raw) return 0; if (!/^-?\d+$/.test(raw)) throw new Error('nan'); return Number(raw); };
const cleanId = (raw) => String(raw).trim().replace(/^<@!?/, '').replace(/>$/, '');

// ---------------- Giao Dịch ----------------
function tradeConfirmView(fromId, toId) {
  const v = new View({ ownerId: null, checkOwner: false, timeout: CD.TRADE_EXPIRE_SECONDS });
  const guard = (i) => {
    if (![String(fromId), String(toId)].includes(String(i.user.id))) { eph(i, 'Giao dịch này không liên quan tới bạn.'); return false; }
    if (!globalClickAllowed(i.user.id)) { eph(i, '⚠️ Bạn đang bấm quá nhanh, vui lòng chờ chút rồi thử lại.'); return false; }
    return true;
  };
  const finish = async (i, text) => { v.disableAll(); try { await i.update({ content: text, components: v.components() }); } catch (_) { await eph(i, text); } v.stop(); };
  v.button({ key: 'ok', label: 'Chấp Nhận', emoji: E.xacnhan, style: 'green' }, async (i) => {
    if (!guard(i)) return;
    if (String(i.user.id) !== String(toId)) return eph(i, '❌ Chỉ người NHẬN mới chấp nhận được giao dịch này.');
    return finish(i, T.acceptOffer(fromId, toId));
  });
  v.button({ key: 'no', label: 'Từ Chối / Huỷ', emoji: E.tuchoi, style: 'grey' }, async (i) => {
    if (!guard(i)) return;
    T.deleteOffer(fromId, toId);
    return finish(i, '❌ Đề xuất giao dịch đã bị huỷ.');
  });
  return v;
}
const offerAnnouncement = (fromId, toId, targetDisplay) => {
  const offer = T.getOffer(fromId, toId);
  const txt = T.formatOffer(offer, Cu.getCultivator(fromId), Cu.getCultivator(toId));
  return `${E.giaodich} <@${fromId}> đề xuất giao dịch tới ${targetDisplay}:\n${txt}\n⏳ Đề xuất có hiệu lực trong 15 phút — <@${toId}> hãy bấm nút bên dưới để phản hồi.`;
};

/** Discord KHÔNG cho mở modal ngay sau khi gửi modal → bước 1 xong thì hiện nút "Tiếp tục bước 2" để mở modal thứ hai. */
function openTradeGive(i, userId, targetId, display) {
  return showModal(i, {
    title: 'Giao Dịch (Bước 1/2) — GỬI',
    fields: [
      { id: 'lt', label: 'Linh Thạch muốn GỬI', placeholder: '0 nếu không gửi', required: false, maxLength: 20 },
      { id: 'dd', label: 'Đan Dược muốn GỬI', placeholder: '0 nếu không gửi', required: false, maxLength: 12 },
      { id: 'lc', label: 'Đổi Linh Căn của mình? (có/không)', placeholder: 'có / không', required: false, maxLength: 6 },
      { id: 'tc', label: 'Đổi Thể Chất của mình? (có/không)', placeholder: 'có / không', required: false, maxLength: 6 },
    ],
    onSubmit: async (mi, get) => {
      let lt; let dd;
      try { lt = parseIntField(get('lt')); dd = parseIntField(get('dd')); } catch (_) { return eph(mi, '❌ Linh Thạch/Đan Dược phải là số nguyên.'); }
      const lc = yesno(get('lc')); const tc = yesno(get('tc'));
      const v2 = new View({ ownerId: userId, timeout: 300 });
      v2.button({ key: 'step2', label: 'Tiếp tục — Bước 2/2 (MUỐN NHẬN)', emoji: E.giaodich, style: 'green' }, (bi) => showModal(bi, {
        title: 'Giao Dịch (Bước 2/2) — MUỐN NHẬN',
        fields: [
          { id: 'lt', label: 'Linh Thạch muốn NHẬN', placeholder: '0 nếu không nhận', required: false, maxLength: 20 },
          { id: 'dd', label: 'Đan Dược muốn NHẬN', placeholder: '0 nếu không nhận', required: false, maxLength: 12 },
          { id: 'lc', label: 'Nhận Linh Căn của đối phương? (có/không)', placeholder: 'có / không', required: false, maxLength: 6 },
          { id: 'tc', label: 'Nhận Thể Chất của đối phương? (có/không)', placeholder: 'có / không', required: false, maxLength: 6 },
        ],
        onSubmit: async (m2, get2) => {
          let wlt; let wdd;
          try { wlt = parseIntField(get2('lt')); wdd = parseIntField(get2('dd')); } catch (_) { return eph(m2, '❌ Linh Thạch/Đan Dược phải là số nguyên.'); }
          const res = T.createOffer(userId, targetId, lt, dd, lc, tc, wlt, wdd, yesno(get2('lc')), yesno(get2('tc')));
          if (res !== 'ok') return eph(m2, res);
          v2.stop();
          return m2.reply({ content: offerAnnouncement(userId, targetId, display), components: tradeConfirmView(userId, targetId).components() });
        },
      }));
      return mi.reply({ content: `✅ Bước 1/2 đã ghi nhận: gửi **${fmtNum(lt)}** 💎, **${fmtNum(dd)}** Đan Dược${lc ? ', đổi Linh Căn' : ''}${tc ? ', đổi Thể Chất' : ''}.\nBấm nút bên dưới để nhập phần **MUỐN NHẬN**:`, components: v2.components(), flags: EPHEMERAL });
    },
  });
}

function tradeTargetView(userId) {
  const v = new View({ ownerId: userId, timeout: 120 });
  v.userSelect({ key: 'who', placeholder: 'Chọn người muốn giao dịch...', row: 0 }, (i) => {
    const target = i.users.first();
    if (String(target.id) === String(userId)) return eph(i, '❌ Không thể giao dịch với chính mình.');
    if (target.bot) return eph(i, '❌ Không thể giao dịch với bot.');
    return openTradeGive(i, userId, target.id, `<@${target.id}>`);
  });
  v.button({ key: 'manual', label: 'Nhập ID thủ công', emoji: E.nhapid, style: 'grey', row: 1 }, (i) => showModal(i, {
    title: 'Giao Dịch — Chọn Người', fields: [{ id: 'id', label: 'ID Discord người nhận', placeholder: 'VD: 123456789012345678', maxLength: 40 }],
    onSubmit: (mi, get) => {
      const raw = cleanId(get('id'));
      if (!/^\d+$/.test(raw)) return eph(mi, '❌ ID người nhận không hợp lệ.');
      if (raw === String(userId)) return eph(mi, '❌ Không thể giao dịch với chính mình.');
      if (!Cu.getCultivator(raw)) return eph(mi, '❌ Người này chưa bắt đầu tu tiên.');
      return openTradeGive(mi, userId, raw, `<@${raw}>`);
    },
  }));
  return v;
}

// ---------------- Động Phủ ----------------
function buildDongphuEmbed(user, row) {
  const e = new EmbedBuilder().setColor(0x1f8b4c);
  if (row.dongphu_level <= 0) return e.setTitle(`${E.dongphu} Động Phủ của ${user.displayName || user.username}`).setDescription('Bạn chưa có động phủ riêng nào. Hãy khai phá một nơi để tu luyện riêng tư!');
  const remain = CD.COOLDOWN_DONGPHU - (now() - row.last_dongphu);
  e.setTitle(`${E.dongphu} ${row.dongphu_ten || 'Động Phủ'}`).setDescription(row.dongphu_mota || Dp.randomFlavor()).addFields(
    { name: 'Cấp Động Phủ', value: String(row.dongphu_level), inline: true },
    { name: 'Thu Hoạch Linh Khí', value: remain <= 0 ? '✅ Sẵn sàng thu hoạch' : `⏳ Còn ${F.fmtTime(remain)}`, inline: true },
    { name: 'Nâng Cấp Kế Tiếp', value: `${fmtNum(Dp.upgradeCost(row.dongphu_level))} ${E.linhthach} Linh Thạch`, inline: true },
    { name: 'Kênh Riêng', value: row.dongphu_channel_id ? `<#${row.dongphu_channel_id}>` : '⚠️ Chưa có — bấm nút **Kênh Riêng**', inline: true });
  if (user.displayAvatarURL) e.setThumbnail(user.displayAvatarURL());
  return e;
}
function dongphuView(userId) {
  const v = new View({ ownerId: userId, timeout: 120 });
  const channelMsg = (ch) => (ch ? `📌 Kênh tu luyện riêng của bạn: <#${ch.id}> (chỉ mình bạn thấy được).` : '⚠️ Không tạo được kênh riêng (bot thiếu quyền **Manage Channels**, hoặc lệnh này không được dùng trong server).');
  v.button({ key: 'tao', label: 'Khai Phá Động Phủ', emoji: E.bando, style: 'green' }, async (i) => {
    await i.deferReply({ flags: EPHEMERAL });
    const r = await Dp.doTaodongphu(userId);
    if (!r.ok) return i.followUp({ content: r.msg, flags: EPHEMERAL });
    const ch = await Dp.getOrCreateChannel(i.guild, i.user, r.ten);
    return i.followUp({ content: `${r.msg}\n${channelMsg(ch)}`, flags: EPHEMERAL });
  });
  v.button({ key: 'kenh', label: 'Kênh Riêng', emoji: E.kenhrieng, style: 'blurple' }, async (i) => {
    const row = Cu.getCultivator(userId);
    if (row.dongphu_level <= 0) return eph(i, '❌ Bạn chưa có động phủ. Bấm **Khai Phá Động Phủ** trước đã.');
    await i.deferReply({ flags: EPHEMERAL });
    const ch = await Dp.getOrCreateChannel(i.guild, i.user, row.dongphu_ten || 'Động Phủ');
    return i.followUp({ content: channelMsg(ch), flags: EPHEMERAL });
  });
  v.button({ key: 'thu', label: 'Thu Hoạch', emoji: E.thuhoach, style: 'blurple' }, (i) => eph(i, Dp.doThuhoach(userId)));
  v.button({ key: 'nc', label: 'Nâng Cấp', emoji: E.nangcap, style: 'secondary' }, (i) => eph(i, Dp.doNangcap(userId)));
  return v;
}

// ---------------- Đồng Hành: Linh Thú + Đạo Lữ ----------------
function themDaoLuView(userId) {
  const v = new View({ ownerId: userId, timeout: 120 });
  const idModal = (title, label, fn) => (i) => showModal(i, { title, fields: [{ id: 'id', label, maxLength: 40 }], onSubmit: (mi, get) => {
    const raw = cleanId(get('id'));
    if (!/^\d+$/.test(raw)) return eph(mi, '❌ ID đạo lữ không hợp lệ.');
    return eph(mi, fn(raw));
  } });
  v.button({ key: 'moi', label: 'Mời Kết Đạo', emoji: E.daolu, style: 'blurple' }, (i) => {
    const row = Cu.getCultivator(userId);
    if (row && (row.nhan_cau_hon || 0) < 1) return eph(i, `${E.daolu} Bạn cần có **Nhẫn Cầu Hôn** mới gửi được lời mời kết đạo lữ — hãy mua ở **Cửa Hàng** (Khí Vận Các).`);
    return idModal('Mời Kết Đạo Lữ', 'ID hoặc @mention người muốn mời', (id) => Dl.requestSongtu(userId, id))(i);
  });
  v.button({ key: 'nhan', label: 'Chấp Nhận', emoji: E.daolu_ketdoi, style: 'blurple' }, idModal('Chấp Nhận Đạo Lữ', 'ID hoặc @mention người đã mời bạn', (id) => Dl.acceptSongtu(userId, id)));
  v.button({ key: 'xem', label: 'Xem Đạo Lữ', emoji: E.daolu, style: 'grey', row: 1 }, (i) => eph(i, Dl.daoLuStatus(userId)));
  v.button({ key: 'vun', label: 'Vun Đắp', emoji: E.vundap, style: 'green', row: 1 }, (i) => eph(i, Dl.daoLuDaily(userId)));
  v.button({ key: 'chia', label: 'Chia Tay', emoji: E.daolu_chiatay, style: 'red', row: 1 }, (i) => eph(i, Dl.breakSongtu(userId)));
  return v;
}
function donghanhGroupView(userId) {
  const v = new View({ ownerId: userId, timeout: 120 });
  v.button({ key: 'thu', label: 'Linh Thú', emoji: E.dongthanh, style: 'blurple' }, (i) => require('./petViews').open(i, userId));
  v.button({ key: 'dl', label: 'Đạo Lữ', emoji: E.daolu, style: 'blurple' }, (i) => {
    const row = Cu.getCultivator(userId);
    const status = row ? Dl.daoLuStatus(userId) : '❌ Bạn chưa bắt đầu tu tiên.';
    return i.reply({ content: `${status}\n\n${E.daolu} **Nhẫn Cầu Hôn:** ${row ? (row.nhan_cau_hon || 0) : 0} chiếc (mua thêm ở Cửa Hàng — cần để gửi lời mời Song Tu)`, components: themDaoLuView(userId).components(), flags: EPHEMERAL });
  });
  return v;
}

// ---------------- Xếp Hạng ----------------
function buildLeaderboardEmbed() {
  const rows = D.all('SELECT user_id, world_tier, realm_index, stage_index, tu_vi FROM cultivators ORDER BY world_tier DESC, realm_index DESC, stage_index DESC, tu_vi DESC LIMIT 10');
  const e = new EmbedBuilder().setTitle(`${E.cup} Thiên Kiêu Bảng`).setColor(0xf1c40f);
  if (!rows.length) return e.setDescription('Chưa có ai bắt đầu tu tiên.');
  return e.setDescription(rows.map((r, i) => `**#${i + 1}** <@${r.user_id}> — ${r.world_tier ? `[${R.worldTierName(r.world_tier)}] ` : ''}${R.realmDisplay(r.realm_index, r.stage_index)} (${r.tu_vi} tu vi)`).join('\n'));
}

module.exports = { tradeConfirmView, offerAnnouncement, tradeTargetView, buildDongphuEmbed, dongphuView, donghanhGroupView, buildLeaderboardEmbed };
