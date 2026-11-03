'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const K = require('../game/constants');
const R = require('../game/realm');
const Cu = require('../game/cultivator');
const CP = require('../game/congphap');
const Inv = require('../game/inventory');
const { E, toComponentEmoji } = require('../game/emoji');
const { View, showModal, registerStatic, EPHEMERAL } = require('./kit');
const SV = require('./shopViews');
const { isAdminApprover } = require('../commands/framework');
const { fmtNum } = require('../util');

function buildKhodoEmbed(user, row) {
  const e = new EmbedBuilder().setTitle(`${E.khodo} Kho Đồ — ${user.displayName || user.username}`)
    .setDescription('Toàn bộ tiền tệ, vật phẩm & công pháp/pháp bảo sở hữu.').setColor(0x11806a);
  const f = (n, v, inline = true) => e.addFields({ name: n, value: String(v), inline });
  f(`${E.linhthach} Linh Thạch`, fmtNum(row.linh_thach)); f(`${E.linhtinh} Linh Tinh`, fmtNum(row.linh_tinh));
  f(`${E.nguyenlieu} Nguyên Liệu`, row.nguyen_lieu); f(`${E.danduoc} Đan Dược`, row.dan_duoc); f(`${E.linhluc} Linh Lực`, `${row.linh_luc}%`);
  f(`${E.linhgioilenh} ${R.linhgioilenhLabel(row)}`, row[R.lenhCol(row.world_tier)]);
  f(`${E.linhphu} ${R.linhphuLabel(row)}`, `${row[R.phuCol(row.world_tier)]}/${K.PHITHANG_LINH_PHU_CAN}`);
  f(`${E.ruong} Rương Thần Bí`, row.ruong_than_bi || 0); f(`${E.vebicanhdacbiet} Vé Bí Cảnh Đặc Biệt`, row.ve_bicanh_dac_biet || 0);
  f(`${E.taytuydan} Đan Tẩy Tủy Trọng Sinh`, `${row.dan_taytuy_trongsinh || 0} (dùng miễn phí trước, hết mới trừ ${fmtNum(K.TAYTUY_LINH_THACH_COST)} ${E.linhthach})`);
  f(`${E.taytuydan} Đan Tẩy Tủy Nửa Tác Dụng`, `${row.dan_taytuy_nuaban || 0} (chỉ reroll ${E.linhcan} Linh Căn, miễn phí trước, hết mới trừ ${fmtNum(K.TAYTUY_NUABAN_LINH_THACH_COST)} ${E.linhthach})`);
  f(`${E.phagioidan} Đan Dược Phá Giới`, `${row.dan_pha_gioi || 0} (mỗi viên bỏ tối đa 5 phút chờ, mua ${fmtNum(K.DAN_PHA_GIOI_COST_LINH_THACH)} ${E.linhthach} hoặc luyện chế)`);
  f(`${E.linhduocdacbiet} Linh Dược Đặc Biệt`, `${row.linh_duoc_dac_biet || 0} (nguyên liệu luyện Đan Dược Phá Giới, cần ${K.DAN_PHA_GIOI_CRAFT_COST}/viên — rơi từ Bí Cảnh)`);
  if (row.realm_index >= 6 || row.world_tier >= 1) {
    f(`${E.linhtinh} Vạn Linh Cốc`,
      `${E.linhtinh} ${row.linh_tinh}  ${E.hukhongtinhhoa} ${row.hu_khong_tinh_hoa}  ${E.huyenthiet} ${row.huyen_thiet}  ${E.manhphapbao} ${row.manh_phap_bao}\n` +
      `${E.tienkim} ${row.tien_kim}  ${E.tienngoc} ${row.tien_ngoc}  ${E.thienhoatinh} ${row.thien_hoa_tinh}  ${E.hukhongkettinh} ${row.hu_khong_ket_tinh}\n` +
      `${E.thiendaothach} ${row.thien_dao_thach}  ${E.manhtiengioilenh} ${row.manh_tien_gioi_lenh}  ${E.daonguyentinh} ${row.dao_nguyen_tinh}  ${E.thiendaoan} ${row.thien_dao_an}\n${E.thienkiepchiluc} ${row.thien_kiep_chi_luc}`, false);
  }
  const owned = [...Cu.ownedCongphapTiers(row)].sort((a, b) => a - b);
  if (owned.length) {
    const names = Object.fromEntries(CP.getCurrentCongphapList().map((c) => [c.tier, c.name]));
    let v = owned.map((t) => `Tầng ${t} — ${names[t] || '???'}`).join('\n');
    const stars = row.ruong_star_count || 0;
    if (stars > 0) v += `\n${Inv.starIconLine(stars, row.ruong_bonus_lucchien, row.ruong_bonus_hp, row.ruong_bonus_atk)}`;
    f(`${E.congphap} Công Pháp sở hữu`, v.slice(0, 1024), false);
  } else f(`${E.congphap} Công Pháp sở hữu`, 'Chưa sở hữu — mua ở Cửa Hàng.', false);
  const sp = Cu.specialCongphapCurrent(row);
  if (sp) f('🌟 Công Pháp Đặc Quyền (Rương Thần Bí)', `**${sp.name}** — chiêu 「${sp.move}」 (+${Math.trunc(sp.bonus * 100)}% chỉ số/HP)`, false);
  const ownedPb = [...Cu.ownedPhapbaoTiers(row)].sort((a, b) => a - b);
  f(`${E.phapbao} Pháp Bảo sở hữu`, ownedPb.length ? ownedPb.map((t) => K.PHAP_BAO_TIER_DEF.find((x) => x.tier === t).name).join(', ') : 'Chưa sở hữu — mua ở Cửa Hàng.', false);
  if (user.displayAvatarURL) e.setThumbnail(user.displayAvatarURL());
  e.setFooter({ text: 'Bấm 🔑 Nhập Code để đổi thưởng, hoặc 📦 Mở Rương nếu có Rương Thần Bí.' });
  return e;
}

// ---------- duyệt code (nút tĩnh — còn hiệu lực sau khi restart) ----------
function approvalRow(requestId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`codeappr|ok|${requestId}`).setLabel('Xác Nhận').setStyle(ButtonStyle.Success).setEmoji(toComponentEmoji(E.xacnhan)).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`codeappr|no|${requestId}`).setLabel('Từ Chối').setStyle(ButtonStyle.Danger).setEmoji(toComponentEmoji(E.tuchoi)).setDisabled(disabled),
  );
}
registerStatic('codeappr', async (i, [action, requestId]) => {
  if (!isAdminApprover(i.user.id)) return i.reply({ content: '❌ Chỉ admin mới được duyệt yêu cầu này.', flags: EPHEMERAL });
  await i.deferReply({ flags: EPHEMERAL });
  const lock = async () => { try { await i.message.edit({ components: [approvalRow(requestId, true)] }); } catch (_) { /* bỏ qua */ } };
  const req = Inv.getPendingCodeRequest(requestId);
  if (!req || req.status !== 'pending') { await i.followUp({ content: '⚠️ Yêu cầu này không còn hiệu lực (đã xử lý hoặc không tồn tại).', flags: EPHEMERAL }); return lock(); }
  const notify = async (payload) => { try { const u = await i.client.users.fetch(String(req.user_id)); await u.send(payload); } catch (_) { /* DM đóng */ } };
  if (action === 'ok') {
    const c = Inv.CODES[req.code];
    if (!c) return i.followUp({ content: '⚠️ Mã code này không còn tồn tại trong hệ thống.', flags: EPHEMERAL });
    Inv.setPendingStatus(requestId, 'approved');
    if (c.max_uses !== null && c.max_uses !== undefined) Inv.codeIncrementUse(req.code);
    Inv.grantCodeRewards(req.user_id, req.code, c);
    await notify({ embeds: [new EmbedBuilder().setTitle(`${E.taytuydan} Yêu cầu đổi mã đã được admin xác nhận!`).setColor(0xf1c40f)
      .setDescription(`Yêu cầu đổi mã **${req.code}** (${c.label}) của bạn đã được duyệt.\n\n${Inv.rewardLinesForCode(c).join('\n')}\n\nVào ${E.khodo} **Kho Đồ** (\`/khodo\`) để xem lại vật phẩm.`)] });
    await lock();
    return i.followUp({ content: `✅ Đã duyệt & cộng thưởng mã **${req.code}** cho <@${req.user_id}>.`, flags: EPHEMERAL });
  }
  Inv.setPendingStatus(requestId, 'rejected');
  await notify({ content: `❌ Yêu cầu đổi mã **${req.code}** của bạn đã bị admin **từ chối**.` });
  await lock();
  return i.followUp({ content: `❌ Đã từ chối yêu cầu của <@${req.user_id}>.`, flags: EPHEMERAL });
});

async function sendCodeApprovalRequest(client, requestId, requester) {
  const req = Inv.getPendingCodeRequest(requestId); if (!req) return;
  const c = Inv.CODES[req.code]; if (!c) return;
  const emb = new EmbedBuilder().setTitle(`${E.taytuydan} Yêu cầu đổi mã cần xác nhận`).setColor(0xe67e22)
    .setDescription(`👤 Người chơi: <@${requester.id}> (\`${requester.id}\` — ${requester.username})\n🔑 Mã: **${req.code}** — ${c.label}\n\n**Phần thưởng nếu Xác Nhận:**\n${Inv.rewardLinesForCode(c).join('\n')}`)
    .setFooter({ text: `Request ID: ${requestId}` });
  for (const id of K.ADMIN_CODE_APPROVER_IDS) {
    try { const u = await client.users.fetch(String(id)); await u.send({ embeds: [emb], components: [approvalRow(requestId)] }); } catch (_) { /* DM đóng */ }
  }
}

function codeModal(i, userId) {
  return showModal(i, {
    title: 'Nhập Code Nhận Thưởng', fields: [{ id: 'code', label: 'Mã Code', placeholder: 'VD: TYSVTOP1', maxLength: 50 }],
    onSubmit: async (mi, get) => {
      const [msg, rid] = Inv.redeemCode(userId, mi.member, get('code'));
      await mi.reply({ content: msg, flags: EPHEMERAL });
      if (rid) await sendCodeApprovalRequest(mi.client, rid, mi.user);
    },
  });
}

function khoDoView(userId) {
  const v = new View({ ownerId: userId, timeout: 120 });
  const eph = (i, c) => i.reply({ content: c, flags: EPHEMERAL });
  v.button({ key: 'code', label: 'Nhập Code', emoji: E.nhapcode, style: 'green', row: 0 }, (i) => codeModal(i, userId));
  v.button({ key: 'ruong', label: 'Mở Rương', emoji: E.ruong, style: 'blurple', row: 0 }, (i) => eph(i, Inv.openRuongThanBi(userId)));
  v.button({ key: 'cp', label: 'Công Pháp', emoji: E.congphap, style: 'secondary', row: 0 }, (i) =>
    i.reply({ content: `${E.congphap} Chọn Công Pháp muốn trang bị (mua ở **Cửa Hàng** nếu chưa có):`, components: SV.congPhapView(userId).components(), flags: EPHEMERAL }));
  v.button({ key: 'pb', label: 'Pháp Bảo', emoji: E.phapbao, style: 'secondary', row: 0 }, (i) =>
    i.reply({ content: `${E.phapbao} Chọn Pháp Bảo muốn trang bị (mua ở **Cửa Hàng** nếu chưa có):`, components: SV.phapBaoView(userId).components(), flags: EPHEMERAL }));
  v.button({ key: 'tt', label: 'Đan Tẩy Tủy', emoji: E.taytuydan, style: 'secondary', row: 0 }, (i) => eph(i, require('../game/dan').doTaytuyReroll(userId)));
  v.button({ key: 'ttn', label: 'Đan Tẩy Tủy (Nửa)', emoji: E.taytuydan, style: 'secondary', row: 1 }, (i) => SV.taytuyNuabanPrompt(i, userId));
  return v;
}

module.exports = { buildKhodoEmbed, khoDoView, sendCodeApprovalRequest, codeModal };
