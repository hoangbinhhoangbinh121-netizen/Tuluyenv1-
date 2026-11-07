'use strict';
/** Giao diện Thể Chất & Linh Căn (v13.6): hồ sơ · thức tỉnh · tiến hóa · cộng hưởng. Dữ liệu lấy từ game/talent.js + game/talentOps.js. */
const K = require('../../game/constants');
const T = require('../../game/talent');
const TO = require('../../game/talentOps');
const BAL = require('../../game/balance');
const { createEmbed } = require('../components/baseEmbed');
const { E } = require('../emojis');
const { num } = require('../format');
const { COLORS } = require('../theme/colors');

const HANH_KEY = { Kim: 'hanh_kim', Mộc: 'hanh_moc', Thủy: 'hanh_thuy', Hỏa: 'hanh_hoa', Thổ: 'hanh_tho' };
const hi = (n) => (HANH_KEY[n] ? `${E[HANH_KEY[n]]} ` : '');   // icon pixel ngũ hành (dị/đặc thù: không có)
const fx = (o) => T.fxLines(o).join('\n') || '—';
const track = (cur, total) => Array.from({ length: total }, (_, i) => (i < cur ? '🟩' : '⬜')).join('');
const f3 = (x) => (Math.round(x * 1000) / 1000).toString().replace('.', ',');
const items = (row) => `${TO.ITEM.bao_the_chat.icon} Thiên Bảo Thể Chất: **${num(row.bao_the_chat || 0)}**  ·  ${TO.ITEM.bao_linh_can.icon} Thiên Bảo Linh Căn: **${num(row.bao_linh_can || 0)}**\n${TO.ITEM.truyen_thua.icon} Truyền Thừa: **${num(row.truyen_thua || 0)}**  ·  ${E.linhthach || '💎'} Linh Thạch: **${num(row.linh_thach || 0)}**`;

function stepField(row, which) {
  const s = TO.nextStep(row, which);
  if (s.kind === 'done') return { name: '✅ Đã đạt đỉnh cao', value: which === 'tc' ? 'Thể Chất đã Biến Dị — không còn bước tiến hóa nào nữa.' : 'Linh Căn đã Tiến Hóa — không còn bước tiến hóa nào nữa.', inline: false };
  const rate = s.rate !== undefined ? `\nTỉ lệ thành công: **${Math.round(s.rate * 100)}%**` : '';
  return { name: `🎯 Bước kế tiếp — ${s.title}`, value: `${s.lines.map((l) => l.text).join('\n')}${rate}`, inline: false };
}
function resonanceField(row) {
  const p = T.profile(row);
  const act = T.RESONANCES.filter((r) => r.test(p));
  const lines = act.map((r) => `${E.conghuong} **${r.name}** — ${r.desc}\n${fx(r.fx)}`);
  const hint = T.RESONANCES.filter((r) => !r.test(p)).slice(0, 3).map((r) => `🔒 **${r.name}**: ${r.cond}`);
  return { name: `${E.conghuong} Cộng hưởng Thể Chất × Linh Căn`, value: [...lines, ...(act.length ? [] : hint)].join('\n') || 'Chưa có cộng hưởng nào.', inline: false };
}
const tuText = (row) => {
  const base = BAL.talentBase(row); const eff = BAL.talentMult(row);
  return `Hệ số gốc **×${f3(base)}** (Linh Căn ${f3(T.mult(K.LINH_CAN, row.linh_can))} × Thể Chất ${f3(T.mult(K.THE_CHAT, row.the_chat))}) → tốc độ tu luyện hiệu dụng **×${f3(eff)}**\nĐộ tinh khiết nhân thêm ×${f3(T.tuluyenPurity(row))}, hiệu ứng thiên phú +${Math.round(T.bundle(row).tu * 100)}%.`;
};

/** Hồ sơ Thể Chất. */
function theChat(row, note) {
  const p = T.profile(row); const b = T.bundle(row);
  const tal = T.THECHAT_TALENTS[p.tc.idx];
  const mine = b.sources.filter((s) => s.kind === 'Thiên phú' || s.kind === 'Biến dị');
  const fields = [
    { name: `${E.thechat || '🧬'} Phẩm cấp`, value: `**${row.the_chat}** (${T.TC_RANK(p.tc.idx)}) — hệ số ×${f3(T.mult(K.THE_CHAT, row.the_chat))}${p.tc.variant ? `\n✦ Biến dị: **${p.tc.variant}**` : ''}`, inline: false },
    { name: `${E.thuctinh} Thức tỉnh`, value: `${track(p.tc.stage, 4)} **${T.STAGE_NAMES[p.tc.stage]}** (hiệu lực thiên phú ×${f3(T.STAGE_MULT[p.tc.stage])})\nTiến độ tích lũy: **${num(p.tc.prog)}** _(Đột Phá, Thiên Kiếp, Bí Cảnh, Boss)_`, inline: false },
    { name: `📖 Thiên phú — ${tal ? tal.name : '—'}`, value: tal ? tal.desc : '—', inline: false },
    { name: '⚙️ Hiệu ứng đang hoạt động', value: mine.map((s) => `**${s.name}**\n${fx(s.fx)}`).join('\n') || '—', inline: false },
    resonanceField(row),
    stepField(row, 'tc'),
    { name: '🎒 Tài nguyên', value: items(row), inline: false },
  ];
  return createEmbed({
    cat: 'nhanvat', header: 'THỂ CHẤT', status: `${T.shortTheChat(row)}`, color: COLORS.INFO,
    description: `${note ? `${note}\n\n` : ''}${tuText(row)}\n_Hiệu ứng thể chất được chặn trần, không nhân dồn vô hạn._`,
    fields, footer: '/thechat thuctinh · tienhoa · doi',
  });
}

/** Hồ sơ Linh Căn. */
function linhCan(row, note) {
  const p = T.profile(row); const b = T.bundle(row);
  const trait = T.ELEMENT_TRAITS[p.lc.primary];
  const ev = T.evolvedOf(p.lc); const pot = T.EVOLUTIONS[p.lc.primary];
  const sTrait = b.sources.find((s) => s.kind === 'Thuộc tính'); const sEvo = b.sources.find((s) => s.kind === 'Tiến hóa');
  const KHAC_OF = Object.entries(T.KHAC).find(([, v]) => v === p.lc.primary);
  const adv = T.KHAC[p.lc.primary];
  const fields = [
    { name: `${E.linhcan || '🌿'} Phẩm cấp`, value: `**${row.linh_can}** (${T.LC_RANK(p.lc.idx)}) — hệ số ×${f3(T.mult(K.LINH_CAN, row.linh_can))}`, inline: false },
    { name: '🌈 Hành (thuộc tính)', value: `${p.lc.roots.map((r, i) => `${hi(r)}${i === 0 ? '**' : ''}${r}${i === 0 ? '**' : ''}`).join(' · ')}\n_${T.ELEMENT_KIND(p.lc.primary)}${p.lc.roots.length > 1 ? ` — ${p.lc.roots.length} hành nên mỗi hành bị loãng ×${f3(p.lc.dilution)}` : ''}_`, inline: true },
    { name: `${E.tinhkhiet} Độ tinh khiết`, value: `**${p.lc.purity}%**\n_tu luyện ×${f3(T.tuluyenPurity(row))}, hấp thu ×${f3(T.purityAbsorb(p.lc.purity))}_`, inline: true },
    { name: `${E.thuctinh} Thức tỉnh`, value: `${track(p.lc.awaken, 3)} **${T.LC_AWAKEN_NAMES[p.lc.awaken]}** (hiệu lực thuộc tính ×${f3(T.LC_AWAKEN_MULT[p.lc.awaken])})\nTiến độ tích lũy: **${num(p.lc.prog)}** _(Tu Luyện, Bế Quan, Bí Cảnh, Boss)_`, inline: false },
    { name: `${hi(p.lc.primary) || '🔥 '}Thuộc tính ${p.lc.primary}`, value: `${trait ? trait.desc : '—'}\n${sTrait ? fx(sTrait.fx) : '—'}`, inline: false },
    ev
      ? { name: `${E.tienhoa} Tiến hóa — ${ev[1].name}`, value: `${ev[1].mech}\n${sEvo ? fx(sEvo.fx) : fx(ev[1].fx)}`, inline: false }
      : { name: `${E.tienhoa} Tiềm năng tiến hóa`, value: `**${pot ? pot.name : '—'}** — ${pot ? pot.mech : ''}\n_Cần Thức Tỉnh Lần III và độ tinh khiết ≥ ${T.LC_EVOLVE.purity}%._`, inline: false },
    { name: '⚔️ Tương khắc', value: `Khắc **${adv || '—'}** (+4% sức mạnh khi đấu pháp, +5% sát thương Boss hành đó) · bị **${KHAC_OF ? KHAC_OF[0] : '—'}** khắc.\nBoss hiện tại đối ứng theo nguyên tố từng cấp.`, inline: false },
    resonanceField(row),
    stepField(row, 'lc'),
    { name: '🎒 Tài nguyên', value: items(row), inline: false },
  ];
  return createEmbed({
    cat: 'nhanvat', header: 'LINH CĂN', status: `${T.shortLinhCan(row)}`, color: COLORS.CULTIVATION,
    description: `${note ? `${note}\n\n` : ''}${tuText(row)}\n_Công pháp hợp hành linh căn sẽ phát huy tốt hơn (×${f3(T.cpAffinity(row, require('../../game/cultivator').equippedCongphapTiers(row)))})._`,
    fields, footer: '/linhcan thuctinh · tienhoa · doi',
  });
}

/** Kết quả một thao tác (thức tỉnh / tiến hóa / đổi) kèm hồ sơ mới. */
function result(which, r, row) {
  const color = r.ok && r.success !== false ? COLORS.SUCCESS : (r.ok ? COLORS.DANGER : COLORS.SYSTEM);
  const head = createEmbed({ cat: 'nhanvat', header: which === 'tc' ? 'THỂ CHẤT' : 'LINH CĂN', status: r.ok ? (r.success === false ? 'Thất bại' : 'Thành công') : 'Chưa thực hiện được', color, description: r.msg });
  if (!r.ok) return [head];
  const fresh = r.row || row;
  return [head, which === 'tc' ? theChat(fresh) : linhCan(fresh)];
}

module.exports = { theChat, linhCan, result };
