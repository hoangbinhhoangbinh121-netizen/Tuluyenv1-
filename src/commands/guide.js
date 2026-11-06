'use strict';
const { EmbedBuilder } = require('discord.js');
const { defineCommand } = require('./framework');
const { View } = require('../ui/kit');
const CATS = require('../data/guide.json');

const GOLD = 0xf1c40f;
function overviewEmbed() {
  const total = CATS.reduce((s, c) => s + c.commands.length, 0);
  const e = new EmbedBuilder().setTitle('📖 Hướng Dẫn Tu Tiên').setColor(GOLD)
    .setDescription(`Tổng cộng **${total}** lệnh, chia làm **${CATS.length}** nhóm bên dưới.\nChọn 1 nhóm trong dropdown để xem hướng dẫn chi tiết từng lệnh.`);
  for (const c of CATS) {
    let preview = c.commands.slice(0, 4).map(([n]) => `\`/${n}\``).join(', ');
    if (c.commands.length > 4) preview += ', ...';
    e.addFields({ name: `${c.label} (${c.commands.length} lệnh)`, value: preview, inline: false });
  }
  return e.setFooter({ text: 'Gõ /huongdan bất cứ lúc nào để mở lại menu này.' });
}
function categoryEmbed(cat) {
  const e = new EmbedBuilder().setTitle(cat.label).setDescription(cat.desc).setColor(GOLD);
  const lines = cat.commands.map(([n, d]) => `**/${n}** — ${d}`); const joined = lines.join('\n');
  if (joined.length <= 1024) e.addFields({ name: 'Danh sách lệnh', value: joined, inline: false });
  else { const mid = Math.floor(lines.length / 2); e.addFields({ name: 'Danh sách lệnh (1/2)', value: lines.slice(0, mid).join('\n'), inline: false }, { name: 'Danh sách lệnh (2/2)', value: lines.slice(mid).join('\n'), inline: false }); }
  return e.setFooter({ text: 'Chọn nhóm khác trong dropdown bên dưới, hoặc gõ /huongdan để mở lại từ đầu.' });
}
function guideView() {
  const v = new View({ ownerId: null, checkOwner: false, timeout: 180 });
  v.select({
    key: 'g', placeholder: '📚 Chọn nhóm lệnh để xem chi tiết...',
    options: CATS.map((c) => ({ label: c.label, description: `${c.commands.length} lệnh — ${c.desc}`.slice(0, 100), value: c.key })),
  }, (i, values) => {
    const cat = CATS.find((c) => c.key === values[0]);
    if (!cat) return i.reply({ content: '❌ Không tìm thấy nhóm lệnh này.', flags: 64 });
    return i.update({ embeds: [categoryEmbed(cat)], components: v.components() });
  });
  v.onTimeout = () => v.disableAll();
  return v;
}
defineCommand({ name: 'huongdan', description: 'Hướng dẫn chi tiết các lệnh, chia theo nhóm', run: (c) => c.send({ embeds: [overviewEmbed()], components: guideView().components() }) });

// ---------------------------------------------------------------- Hướng dẫn lệnh chữ (tiền tố ! và ?)
const { createEmbed } = require('../ui/components/baseEmbed');
function prefixList() { return String(process.env.COMMAND_PREFIX || '?,!').split(/[,\s]+/).filter(Boolean); }
function prefixEmbed() {
  const p = prefixList(); const a = p[0] || '?'; const b = p[1] || a;
  return createEmbed({
    cat: 'thiendao', header: 'HƯỚNG DẪN LỆNH CHỮ', title: 'Dùng lệnh bằng tiền tố (prefix)',
    description: `Ngoài lệnh gạch chéo \`/\`, mọi lệnh đều gõ được như tin nhắn thường với tiền tố **${p.map((x) => `\`${x}\``).join(' hoặc ')}**.\nTên lệnh giống hệt lệnh \`/\`, viết liền, không phân biệt hoa thường.`,
    fields: [
      { name: '1) Gõ lệnh', value: `\`${a}tuluyen\` · \`${b}dongquan\` · \`${a}dotpha\` · \`${b}danhboss\` · \`${a}huongdan\`\nBot trả lời ngay dưới tin nhắn của bạn.` },
      { name: '2) Lệnh có tham số', value: `Gõ các giá trị **theo đúng thứ tự** của lệnh \`/\`, cách nhau bằng dấu cách.\nVí dụ: \`${a}usedb 1\` · \`${a}nhapdb\` (đính kèm file .db trong **cùng tin nhắn**).\nNgười được chọn: \`@tag\` hoặc dán ID. Số lớn viết được \`1.000.000\` hoặc \`1000000\`.` },
      { name: '3) Lệnh nhập file', value: `\`${a}nhapdb\` / \`${a}restore_db\`: bấm dấu **+** để đính kèm file \`.db\`, ghi lệnh vào ô chat rồi gửi một lần. (Chỉ admin được chỉ định.)` },
      { name: '4) Lệnh admin', value: 'Lệnh admin (`trieuhoiboss`, `huyboss`, `datkenhthegioi`, `backupdb`, `listdb`...) cũng gõ được bằng tiền tố nhưng chỉ admin dùng được. Admin gõ `!hoang` để nhận danh sách lệnh admin ẩn của Tông Môn Chiến (bot nhắn riêng).' },
      { name: '5) Không thấy bot trả lời?', value: '• Bật **Message Content Intent** trong Discord Developer Portal → Bot.\n• Host phải đặt `ENABLE_PREFIX_COMMANDS=1` (mặc định bật) và `COMMAND_PREFIX` đúng.\n• Bot cần quyền **Xem kênh · Gửi tin nhắn · Nhúng liên kết** trong kênh đó.\n• Gõ sát tiền tố: `!tuluyen` (không phải `! tuluyen`).\nKhông chắc thì cứ dùng `/` — luôn hoạt động.' },
    ],
  });
}
defineCommand({ name: 'lenhchu', description: 'Hướng dẫn dùng lệnh bằng tiền tố ! và ? (prefix)', run: (c) => c.send({ embeds: [prefixEmbed()] }) });

// ---------------------------------------------------------------- Bảng hệ số Linh Căn / Thể Chất
defineCommand({
  name: 'tuchat',
  description: 'Xem bảng hệ số tu luyện của Linh Căn và Thể Chất',
  run: (c) => {
    const BAL = require('../game/balance');
    const T = BAL.talentTables();
    const f = (arr) => arr.map((t) => `**${t.name}** — ×${t.mult} _(tỉ lệ ${t.pct.toFixed(1)}%)_`).join('\n');
    const e = new EmbedBuilder().setTitle('🌿 Linh Căn & Thể Chất — Hệ số tu luyện').setColor(GOLD)
      .setDescription(`Tốc độ tu luyện/bế quan nhân với **(Linh Căn × Thể Chất)^${BAL.B.TALENT_EXP}** — Thiên Linh Căn ≈ ×${BAL.effectiveTalent(2).toFixed(1)}, Hỗn Độn ≈ ×${BAL.effectiveTalent(6).toFixed(1)}, trần ≈ ×${BAL.effectiveTalent(BAL.B.TALENT_CAP).toFixed(1)} (bảng dưới là hệ số gốc).\nXem hồ sơ thiên phú/thức tỉnh/tiến hóa bằng \`/thechat\` và \`/linhcan\`.`)
      .addFields({ name: 'Linh Căn', value: f(T.linhCan) }, { name: 'Thể Chất', value: f(T.theChat) });
    return c.send({ embeds: [e] });
  },
});
