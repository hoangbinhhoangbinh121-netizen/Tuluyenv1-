'use strict';
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('node:path');
const fs = require('node:fs');
const K = require('../game/constants');
const CD = require('../game/cooldowns');
const R = require('../game/realm');
const Cu = require('../game/cultivator');
const F = require('../game/format');
const { E } = require('../game/emoji');
const { getSectName } = require('../game/sectBase');
const { daoLuTitle, daoLuBonus } = require('../game/daolu');
const BALN = require('../game/balance');
const { now, fmtNum } = require('../util');

const ASSETS = path.join(__dirname, '..', '..', 'assets');
const LINHGIOI_FILE = 'linhgioi_phithang.png';
const LINHGIOI_PATH = path.join(ASSETS, LINHGIOI_FILE);
const linhgioiAttachment = () => (fs.existsSync(LINHGIOI_PATH) ? new AttachmentBuilder(LINHGIOI_PATH, { name: LINHGIOI_FILE }) : null);
const COLOR = { blue: 0x3498db, gold: 0xf1c40f, greyple: 0x99aab5, dark_green: 0x1f8b4c, orange: 0xe67e22 };

function buildStatusEmbed(user, row0) {
  const userId = user.id;
  let row = row0;
  const { realm_index: realmIdx, stage_index: stageIdx, world_tier: worldTier } = row;
  const required = R.tuViRequired(realmIdx, stageIdx, worldTier);
  const curHp = Cu.syncHpRegen(userId, row);
  row = Cu.getCultivator(userId);
  const lucChien = Cu.calcLucChien(row);
  const lucChienMoc = Cu.lucChienMocAt(R.tuViRequiredLegacy(realmIdx, stageIdx, worldTier));
  const maxHp = Cu.effectiveMaxHp(row);
  const titlePrefix = row.title ? `「${row.title}」 ` : '';
  const emb = new EmbedBuilder()
    .setTitle(`🌌 ${titlePrefix}${user.displayName || user.username}`)
    .setDescription(`${E.thegioi} ${R.worldTierName(worldTier)}` + (worldTier ? ` (Phi Thăng lần ${worldTier})` : '') + (worldTier ? `\n${R.worldTierFlavor(worldTier)}` : ''))
    .setColor(COLOR.blue);
  const f = (name, value, inline = true) => emb.addFields({ name, value: String(value === '' ? '—' : value), inline });
  f('Cảnh giới', R.realmDisplay(realmIdx, stageIdx), false);
  f('✨ Tu Vi', `${F.emojiProgressBar(row.tu_vi, required, F.EMOJI_BAR_TUVI)}\n${row.tu_vi}/${required}`, false);
  f('❤️ Sinh Mệnh', `${F.emojiProgressBar(curHp, maxHp, F.EMOJI_BAR_HP)}\n${curHp}/${maxHp}`, false);
  f('🔥 Lực Chiến', `${F.emojiProgressBar(lucChien, lucChienMoc, F.EMOJI_BAR_LUCCHIEN)}\n${lucChien} (mốc: ${lucChienMoc})`, false);
  f(`${E.linhcan} Linh Căn`, row.linh_can);
  f(`${E.thechat} Thể Chất`, row.the_chat);
  const cpTiers = Cu.equippedCongphapTiers(row);
  f(`${E.congphap} Công Pháp (${cpTiers.length}/${K.CONGPHAP_MAX_EQUIP_SLOTS})`, row.cong_phap || 'Chưa chọn');
  const pbTier = Cu.equippedPhapbaoTier(row);
  const pb = K.PHAP_BAO_TIER_DEF.find((t) => t.tier === pbTier);
  f(`${E.phapbao} Pháp Bảo`, pb ? pb.name : 'Chưa trang bị');
  f(`${E.linhngo} Độ Lĩnh Ngộ`, row.ngo_tinh);
  f(`${E.congkich} Công Kích`, Cu.effectiveAtk(row));
  f(`${E.phongngu} Phòng Ngự`, Cu.effectiveDef(row));
  f(`${E.thanphap} Thân Pháp`, Cu.effectiveSpd(row));
  f(`${E.khivan} Khí Vận`, row.khi_van);
  f(`${E.nguyenlieu} Nguyên Liệu`, row.nguyen_lieu);
  f(`${E.danduoc} Đan Dược`, row.dan_duoc);
  f(`${E.dongthanh} Linh Thú`, require('../game/pets').profileLine(userId));
  if (row.partner_id) {
    const lv = parseInt(row.dao_lu_level || 1, 10);
    const need = K.DAO_LU_LEVEL_THRESHOLDS[lv + 1];
    const intim = parseInt(row.dao_lu_intimacy || 0, 10);
    f(`${E.daolu} Đạo Lữ`, `<@${row.partner_id}>\nCấp ${lv} — ${daoLuTitle(lv)}\n❤️ Thân Mật: ${intim}/${need ? need : 'MAX'}\n✨ Song Tu: +${(daoLuBonus(lv) * 100).toFixed(0)}%`, false);
  } else f(`${E.daolu} Đạo Lữ`, 'Chưa kết đạo');
  f(`${E.tongmon} Tông Môn`, row.sect_id ? getSectName(row.sect_id) : 'Chưa gia nhập');
  f(`${E.linhthach} Linh Thạch`, fmtNum(row.linh_thach));
  f(`${E.linhtinh} Linh Tinh`, fmtNum(row.linh_tinh));
  f(`${E.linhluc} Linh Lực`, `${row.linh_luc}%`);
  f(`${E.linhgioilenh} ${R.linhgioilenhLabel(row)}`, row[R.lenhCol(worldTier)]);
  f(`${E.linhphu} ${R.linhphuLabel(row)}`, `${row[R.phuCol(worldTier)]}/${K.PHITHANG_LINH_PHU_CAN}`);
  f(`${E.thienkiep} Thiên Kiếp`, row.vuot_thienkiep ? '✅ Đã vượt' : '❌ Chưa vượt');
  if (row.realm_index >= 6 || row.world_tier >= 1) {
    f(`${E.linhtinh} Vạn Linh Cốc`,
      `${E.linhtinh} ${row.linh_tinh}  ${E.hukhongtinhhoa} ${row.hu_khong_tinh_hoa}  ${E.huyenthiet} ${row.huyen_thiet}  ${E.manhphapbao} ${row.manh_phap_bao}\n` +
      `${E.tienkim} ${row.tien_kim}  ${E.tienngoc} ${row.tien_ngoc}  ${E.thienhoatinh} ${row.thien_hoa_tinh}  ${E.hukhongkettinh} ${row.hu_khong_ket_tinh}\n` +
      `${E.thiendaothach} ${row.thien_dao_thach}  ${E.manhtiengioilenh} ${row.manh_tien_gioi_lenh}  ${E.daonguyentinh} ${row.dao_nguyen_tinh}  ${E.thiendaoan} ${row.thien_dao_an}  ${E.thienkiepchiluc} ${row.thien_kiep_chi_luc}`, false);
  }
  if (user.displayAvatarURL) emb.setThumbnail(user.displayAvatarURL());
  if (fs.existsSync(LINHGIOI_PATH)) emb.setImage(`attachment://${LINHGIOI_FILE}`);
  return emb;
}

function buildSettingsEmbed(user, row) {
  const t = now();
  const status = (last, cd) => { const r = cd - (t - last); return r <= 0 ? '✅ Sẵn sàng' : `⏳ Còn ${F.fmtTime(r)}`; };
  const emb = new EmbedBuilder().setTitle(`${E.caidat} Trạng Thái — ${user.displayName || user.username}`).setColor(COLOR.greyple);
  const f = (n, v, inline = true) => emb.addFields({ name: n, value: String(v), inline });
  f(`${E.tuluyen} Tu Luyện`, status(row.last_tuluyen, CD.COOLDOWN_TULUYEN));
  f(`${E.bequan} Bế Quan`, status(row.last_dongquan, CD.COOLDOWN_DONGQUAN));
  {
    const maxS = (BALN.B.TREO_MAX_HOURS > 0) ? BALN.B.TREO_MAX_HOURS * 3600 : Infinity;
    const el = row.treo_start > 0 ? Math.max(0, t - row.treo_start) : 0;
    let tv;
    if (row.treo_start > 0 && el >= maxS) tv = '⛔ Đã đủ hạn — sắp xuất quan cưỡng chế, `/treoquan` để nhận & làm mới';
    else if (row.treo_start > 0) tv = `🧘 Đang treo ${F.fmtTime(el)}${Number.isFinite(maxS) ? ` (còn ${F.fmtTime(maxS - el)} thì xuất quan cưỡng chế)` : ''} — \`/treoquan\``;
    else if (row.treo_forced) tv = '⛔ Phiên trước đã xuất quan cưỡng chế — `/treoquan` để làm mới & treo tiếp';
    else tv = '💤 Chưa treo — `/treoquan` để bắt đầu';
    f(`${E.treoquan || E.bequan} Bế Quan Treo`, tv);
  }
  {
    const top = require('../game/chuoi').topOf(row.user_id);
    f(`${E.chuoi || '🔥'} Chuỗi Đồng Tu`, top ? `${E.chuoi || '🔥'} **${top.streak}** ngày với <@${top.other}> — \`/chuoi\`` : 'Chưa có chuỗi — `/chuoi` để kết chuỗi với đạo hữu');
  }
  f(`${E.linhngo} Cảm Ngộ`, status(row.last_canngo, CD.COOLDOWN_CANNGO));
  f(`${E.linhmach} Linh Mạch`, status(row.last_linhmach, CD.COOLDOWN_LINHMACH));
  const brewing = row.luyendan_start || 0;
  let ld;
  if (brewing > 0) {
    const rb = CD.LUYENDAN_BREW_SECONDS - (t - brewing);
    ld = rb > 0 ? `🔥 Đang luyện, còn ${F.fmtTime(rb)}` : '✅ Đan đã xong, vào thu đan!';
  } else ld = status(row.last_luyendan, CD.COOLDOWN_LUYENDAN);
  f(`${E.luyendan} Luyện Đan`, ld);
  const n = Cu.equippedCongphapTiers(row).length;
  f(`${E.congphap} Công Pháp hiện tại (${n}/${K.CONGPHAP_MAX_EQUIP_SLOTS})`, row.cong_phap || 'Chưa chọn', false);
  return emb;
}

module.exports = { buildStatusEmbed, buildSettingsEmbed, linhgioiAttachment, COLOR };
