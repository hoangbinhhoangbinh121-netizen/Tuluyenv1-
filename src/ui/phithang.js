'use strict';
const { EmbedBuilder } = require('discord.js');
const K = require('../game/constants');
const R = require('../game/realm');
const Cu = require('../game/cultivator');
const B = require('../game/bicanh');
const A = require('../game/ascension');
const { E } = require('../game/emoji');
const { View, EPHEMERAL } = require('./kit');
const { fmtNum } = require('../util');

const tick = (ok) => (ok ? '✅' : '❌');

function buildTiengioiEmbed(row) {
  const e = new EmbedBuilder().setTitle(`${E.phithang} Điều Kiện Phi Thăng Tiên Giới`).setColor(0xf1c40f);
  for (const [, ok, label] of A.tiengioiChecklist(row)) e.addFields({ name: `${ok ? '✅ ' : '❌ '}${label}`.slice(0, 256), value: '\u200b', inline: true });
  e.addFields({ name: `${E.linhluc} Linh Lực`, value: `${tick(row.linh_luc >= 100)} ${row.linh_luc}%/100%`, inline: true });
  return e.setFooter({ text: 'Đủ mọi điều kiện thì bấm Phi Thăng hoặc dùng /phithang.' });
}
function buildAscensionStatusEmbed(row) {
  if (row.world_tier >= 1) return buildTiengioiEmbed(row);
  const gateOk = A.isAtAscensionGate(row);
  const lc = Cu.calcLucChien(row); const lcol = R.lenhCol(row.world_tier); const pcol = R.phuCol(row.world_tier);
  return new EmbedBuilder().setTitle(`${E.phithang} Điều Kiện Phi Thăng Linh Giới`).setColor(0x9b59b6).addFields(
    { name: '🏯 Cảnh giới', value: `${gateOk ? '✅ ' : '❌ '}Hóa Thần Viên Mãn (hiện: ${R.realmDisplay(row.realm_index, row.stage_index)})`, inline: false },
    { name: `${E.thienkiep} Thiên Kiếp`, value: row.vuot_thienkiep ? '✅ Đã vượt' : '❌ Chưa vượt (`/vuotthienkiep`)', inline: true },
    { name: '🔥 Lực Chiến tối thiểu (Thiên Kiếp)', value: `${lc >= K.THIENKIEP_MIN_LUC_CHIEN ? '✅' : '⚠️'} ${lc}/${K.THIENKIEP_MIN_LUC_CHIEN} — dưới mốc thì tỉ lệ thành công chỉ còn ${Math.trunc(K.THIENKIEP_RATE_KHONG_DU_LUC_CHIEN * 100)}%`, inline: true },
    { name: `${E.linhluc} Linh Lực`, value: `${tick(row.linh_luc >= 100)} ${row.linh_luc}%/100%`, inline: true },
    { name: `${E.linhthach} Linh Thạch`, value: `${tick(row.linh_thach >= K.PHITHANG_LINH_THACH_COST)} ${fmtNum(row.linh_thach)}/${fmtNum(K.PHITHANG_LINH_THACH_COST)}`, inline: true },
    { name: `${E.linhgioilenh} ${R.linhgioilenhLabel(row)}`, value: `${row[lcol] >= 1 ? '✅ ' : '❌ '}${row[lcol]} (chỉ nhận qua đánh \`/danhphithangsugia\`)`, inline: true },
    { name: '🧩 Mảnh Ghép Phi Thăng Lệnh', value: `${row.manh_ghep_phithang}/${K.MANHGHEP_PHITHANG_CAN} (chưa dùng được ở Phàm Giới — để dành chế Tiên Lệnh sau khi Phi Thăng Linh Giới)`, inline: true },
    { name: `${E.linhphu} Con Đường Phi Thăng`, value: `${row[pcol] >= K.PHITHANG_LINH_PHU_CAN ? '✅ ' : '❌ '}${row[pcol]}/${K.PHITHANG_LINH_PHU_CAN} ${R.linhphuLabel(row)} (rơi ra ở Bí Cảnh)`, inline: true },
  ).setFooter({ text: 'Đủ mọi điều kiện thì bấm Phi Thăng hoặc dùng /phithang.' });
}

function chooserView(userId, kind) {
  const v = new View({ ownerId: userId, timeout: 120 });
  const isTk = kind === 'thienkiep';
  const fn = isTk ? A.doVuotthienkiep : A.doDanhPhithangSugia;
  v.select({
    key: 'c', placeholder: isTk ? 'Chọn Thiên Kiếp muốn vượt...' : 'Chọn Sứ Giả muốn khiêu chiến...',
    options: isTk
      ? [{ label: 'Vượt Thiên Kiếp Linh Giới', value: 'linhgioi', description: 'Yêu cầu tối thiểu Hóa Thần Viên Mãn', emoji: E.thienkiep },
        { label: 'Vượt Thiên Kiếp Tiên Giới', value: 'tiengioi', description: 'Yêu cầu Độ Kiếp Viên Mãn + đã Phi Thăng Linh Giới', emoji: E.thienkiep }]
      : [{ label: 'Sứ Giả Linh Giới', value: 'linhgioi', description: 'Đánh để nhận Linh Giới Lệnh', emoji: E.linhgioilenh },
        { label: 'Sứ Giả Tiên Giới', value: 'tiengioi', description: 'Lực Chiến mạnh vượt trội, nhận Tiên Giới Lệnh', emoji: E.thuongcothuho }],
  }, (i, values) => {
    const row = Cu.getCultivator(userId); const title = row.title || 'Người Phi Thăng';
    const reply = (c) => i.reply({ content: c, flags: EPHEMERAL });
    if (values[0] === 'linhgioi') {
      if (row.world_tier >= 1) return reply(isTk ? `✅ Bạn đã **Phi Thăng Linh Giới** rồi (danh hiệu hiện tại: 「${title}」). Hãy chọn **Vượt Thiên Kiếp Tiên Giới** nếu muốn tiếp tục con đường tu tiên.` : '✅ Bạn đã **Phi Thăng Linh Giới** rồi, không cần đánh Sứ Giả Linh Giới nữa. Hãy chọn **Sứ Giả Tiên Giới**.');
      return reply(fn(userId));
    }
    if (row.world_tier === 0) return reply(isTk ? '🔒 Cần **Phi Thăng Linh Giới** trước khi vượt Thiên Kiếp Tiên Giới.' : '🔒 Cần **Phi Thăng Linh Giới** trước khi khiêu chiến Sứ Giả Tiên Giới.');
    if (row.world_tier >= 2) return reply(`✅ Bạn đã **Phi Thăng Tiên Giới** rồi (danh hiệu hiện tại: 「${title}」).`);
    return reply(fn(userId));
  });
  return v;
}

function phiThangGroupView(userId) {
  const v = new View({ ownerId: userId, timeout: 120 });
  const eph = (i, c) => i.reply({ content: c, flags: EPHEMERAL });
  v.button({ key: 'dk', label: 'Điều Kiện', emoji: E.dieukien, style: 'grey' }, (i) => i.reply({ embeds: [buildAscensionStatusEmbed(Cu.getCultivator(userId))], flags: EPHEMERAL }));
  v.button({ key: 'pt', label: 'Phi Thăng', emoji: E.phithang, style: 'blurple' }, async (i) => {
    const res = A.doPhithangEx(userId, i.guildId || 0);
    if (require('./ascendFx').isTienGioi(res)) return require('./ascendFx').playForButton(i, res);   // v17.2: hiệu ứng phi thăng Tiên Giới
    return eph(i, res.text);
  });
  v.button({ key: 'tk', label: 'Vượt Thiên Kiếp', emoji: E.thienkiep, style: 'red' }, (i) => i.reply({ content: `${E.thienkiep} Chọn Thiên Kiếp muốn vượt:`, components: chooserView(userId, 'thienkiep').components(), flags: EPHEMERAL }));
  v.button({ key: 'sg', label: 'Sứ Giả', emoji: E.linhgioilenh, style: 'secondary' }, (i) => i.reply({ content: '👺 Chọn Sứ Giả muốn khiêu chiến:', components: chooserView(userId, 'sugia').components(), flags: EPHEMERAL }));
  v.button({ key: 'ns', label: 'Thiên Nhân Ngũ Suy', emoji: E.thiennhanngusuy, style: 'grey' }, (i) => eph(i, A.doVuotThiennhanngusuy(userId)));
  return v;
}

module.exports = { buildAscensionStatusEmbed, phiThangGroupView, chooserView };
