'use strict';
/** /huongdantuchat — hướng dẫn đầy đủ Thể Chất & Linh Căn: tiến độ, Thiên Bảo, Truyền Thừa, thức tỉnh, tiến hóa. Số liệu lấy thẳng từ game/talent.js nên luôn khớp. */
const { EmbedBuilder } = require('discord.js');
const { defineCommand } = require('./framework');
const { View } = require('../ui/kit');
const K = require('../game/constants');
const T = require('../game/talent');
const TO = require('../game/talentOps');
const BAL = require('../game/balance');
const { fmtNum } = require('../util');
const { E } = require('../ui/emojis');
const BC = require('../game/bicanh');
const ST = require('../game/settings');

const COLOR = 0x9b59b6;
const realm = (i) => (K.REALMS[Math.min(i, K.REALMS.length - 1)] || {}).name || `#${i}`;
const pct = (x) => `${Math.round(x * 100)}%`;
const D = TO.DROPS;
const tcRows = T.TC_AWAKEN.map((r, i) => `**${T.STAGE_NAMES[i]} → ${T.STAGE_NAMES[i + 1]}**: ${realm(r.realm)}+ · tiến độ ${r.prog} · ${r.bao} Thiên Bảo${r.truyen ? ` · ${r.truyen} Truyền Thừa` : ''} · ${fmtNum(r.thach)} Linh Thạch · tỉ lệ ${pct(r.rate)}`);
const lcRows = T.LC_AWAKEN.map((r, i) => `**${T.LC_AWAKEN_NAMES[i]} → ${T.LC_AWAKEN_NAMES[i + 1]}**: ${realm(r.realm)}+ · tiến độ ${r.prog} · ${r.bao} Thiên Bảo${r.truyen ? ` · ${r.truyen} Truyền Thừa` : ''} · ${fmtNum(r.thach)} Linh Thạch · tỉ lệ ${pct(r.rate)} · tinh khiết +${r.purity}`);
const E1 = T.TC_EVOLVE; const E2 = T.LC_EVOLVE;
const ex1 = T.EXCHANGE.thien_dao_thach; const ex2 = T.EXCHANGE.dao_nguyen_tinh;

const PAGES = [
  { key: 'tong', label: '🌟 Tổng quan', desc: 'Thể Chất & Linh Căn là gì, tăng tốc ra sao',
    build: () => ({ d: 'Mỗi nhân vật có **2 hồ sơ độc lập**. Tiến độ, thức tỉnh, tiến hóa của bên này không ảnh hưởng bên kia (chỉ **Cộng Hưởng** cần cả hai).',
      f: [
        ['🧬 Thể Chất', `Quyết định **thiên phú** (hiệu ứng riêng cho từng phẩm cấp). Mạnh dần qua **5 giai đoạn thức tỉnh**: ${T.STAGE_NAMES.join(' → ')}. Cuối cùng có thể **Biến Dị**.\nXem: \`/thechat\``],
        ['🌿 Linh Căn', `Có **hành** (${E.hanh_kim} Kim · ${E.hanh_moc} Mộc · ${E.hanh_thuy} Thủy · ${E.hanh_hoa} Hỏa · ${E.hanh_tho} Thổ, hoặc Dị/Đặc thù…) và **độ tinh khiết** 1–100%. Thức tỉnh **3 lần**, rồi **Tiến Hóa** thành nhánh riêng theo hành chủ đạo.\nXem: \`/linhcan\``],
        [`${E.tangtoc} Tốc độ tu luyện`, `Hệ số gốc (bảng \`/tuchat\`) được nâng lũy thừa **${BAL.B.TALENT_EXP}**: Thiên Linh Căn ≈ ×${BAL.effectiveTalent(2).toFixed(1)}, Hỗn Độn ≈ ×${BAL.effectiveTalent(6).toFixed(1)}, trần ≈ ×${BAL.effectiveTalent(BAL.B.TALENT_CAP).toFixed(1)}. Ngũ Linh Căn + Phàm Thể vẫn ×1.\nĐộ tinh khiết còn nhân tu luyện ×0,85–1,15.`],
        ['🛡️ Có giới hạn', 'Mọi hiệu ứng đều bị **chặn trần** (vd công/thủ/sinh mệnh tối đa +15%, tu luyện +35%) nên không nhân dồn vô hạn.'],
        ['📌 Gợi ý', 'Gõ `/thechat` và `/linhcan` để xem **bước kế tiếp cần gì** — bảng điều kiện có ✅/❌ cho từng mục.'],
      ] }) },
  { key: 'tiendo', label: '📈 Tiến độ tích lũy', desc: 'Cách cộng điểm tiến độ (điều kiện thức tỉnh)',
    build: () => ({ d: 'Mỗi thức tỉnh/tiến hóa đòi một mức **tiến độ tích lũy**. Tiến độ chỉ tăng, **không mất** khi thức tỉnh thất bại.',
      f: [
        ['🧬 Tiến độ Thể Chất', '• Đột Phá thành công: **+1** (đột phá **đại cảnh giới**: **+5**)\n• Vượt Thiên Kiếp phi thăng: **+10**\n• Bí Cảnh: **+1** · Bí Cảnh Đặc Biệt: **+2**\n• Hạ Boss Thế Giới (đóng góp ≥2%): **+2**'],
        ['🌿 Tiến độ Linh Căn', '• Tu Luyện: **+1** mỗi lần\n• Bế Quan: **+3** mỗi lần\n• Bí Cảnh: **+2** · Bí Cảnh Đặc Biệt: **+3**\n• Đánh Boss: **+1** mỗi đòn, **+5** khi Boss bị hạ'],
        ['ℹ️ Lưu ý', 'Bế Quan **Treo** không cộng tiến độ. Tiến độ gắn với phẩm cấp hiện tại — đổi phẩm cấp bằng Đan Tẩy Tủy thì **đặt lại**.'],
      ] }) },
  { key: 'bao', ico: () => E.bao_thechat, label: '🎁 Thiên Bảo & Truyền Thừa', desc: 'Nguồn vật phẩm thức tỉnh',
    build: () => ({ d: 'Thức tỉnh/tiến hóa tốn **Thiên Bảo** (riêng cho Thể Chất hoặc Linh Căn) và **Truyền Thừa Ngọc Giản** (dùng cho cả hai, chỉ mất khi thành công).',
      f: [
        ['🗺️ Bí Cảnh', `Mỗi lần: **${pct(D.bicanh.bao)}** Thiên Bảo (Thể Chất hoặc Linh Căn, ngẫu nhiên) + **${(D.bicanh.truyen * 100).toFixed(1)}%** Truyền Thừa. Bí Cảnh Đặc Biệt: gấp đôi tỉ lệ.`],
        ['👹 Boss Thế Giới', `Khi Boss bị hạ, ai đóng góp ≥2% sát thương: **${pct(D.boss.bao)}** Thiên Bảo + **${pct(D.boss.truyen)}** Truyền Thừa.`],
        ['👑 Đột phá & Thiên Kiếp', `Đột phá đại cảnh giới: **${pct(D.majorBreak.bao)}** Thiên Bảo.\nVượt Thiên Kiếp phi thăng: **chắc chắn 1 Truyền Thừa**.`],
        ['🔁 Đổi vật phẩm (ổn định, chậm)', `\`/thechat doi\`: **${ex1.per} Thiên Đạo Thạch → 1 Thiên Bảo Thể Chất**\n\`/linhcan doi\`: **${ex2.per} Đạo Nguyên Tinh → 1 Thiên Bảo Linh Căn**\nThêm \`so_luong\` để đổi nhiều (tối đa 50).`],
        ['🍀 Tăng tỉ lệ rơi', 'Thiên phú/thuộc tính "Thu hoạch" của Thể Chất & Linh Căn nhân thêm tỉ lệ rơi (tối đa +30%).'],
      ] }) },
  { key: 'tc', ico: () => E.thuctinh, label: '🧬 Thức tỉnh Thể Chất', desc: '4 bước: Sơ Khai → Viên Mãn',
    build: () => ({ d: `Dùng \`/thechat thuctinh\` (thành công tự nâng 1 giai đoạn). Mỗi giai đoạn tăng hiệu lực thiên phú: ${T.STAGE_MULT.map((m, i) => `${T.STAGE_NAMES[i]} ×${m}`).join(' · ')}.`,
      f: [
        ['📋 Điều kiện từng bước', tcRows.join('\n')],
        ['🏔️ Cảnh giới cao', `Chưa phi thăng thì cảnh giới tối đa là **${realm(K.HOATHAN_REALM_IDX)}** — các bước đòi **${realm(6)}** trở lên (từ Đại Thành) cần **Phi Thăng** trước.`],
        ['💥 Thất bại', 'Mất **đủ số Linh Thạch của bước đó** và **một nửa Thiên Bảo** (làm tròn lên). **Truyền Thừa và tiến độ được giữ.** Có thể thử lại ngay khi đủ tài nguyên.'],
      ] }) },
  { key: 'lc', ico: () => E.thuctinh, label: '🌿 Thức tỉnh Linh Căn', desc: '3 lần thức tỉnh + độ tinh khiết',
    build: () => ({ d: `Dùng \`/linhcan thuctinh\`. Mỗi lần thành công: hiệu lực thuộc tính tăng (${T.LC_AWAKEN_MULT.map((m, i) => `${T.LC_AWAKEN_NAMES[i]} ×${m}`).join(' · ')}) và **độ tinh khiết** tăng.`,
      f: [
        ['📋 Điều kiện từng lần', lcRows.join('\n')],
        ['💥 Thất bại', 'Giống Thể Chất: mất Linh Thạch + nửa Thiên Bảo, giữ Truyền Thừa & tiến độ.'],
        [`${E.tinhkhiet} Độ tinh khiết`, 'Tăng tu luyện (×0,85–1,15), hấp thu linh khí, tỉ lệ đột phá ±2% và độ mạnh thuộc tính. Trung bình (50%) = ×1.'],
      ] }) },
  { key: 'tienhoa', ico: () => E.tienhoa, label: '🌌 Tiến hóa & Biến Dị', desc: 'Bước cuối — hiếm, tốn kém, có bảo hiểm',
    build: () => ({ d: 'Bước cuối của mỗi hồ sơ, chỉ làm được **1 lần**. Dùng `/thechat tienhoa` hoặc `/linhcan tienhoa`.',
      f: [
        [`${E.tienhoa} Biến Dị Thể Chất`, `Cần: thức tỉnh **${T.STAGE_NAMES[E1.stage]}** · cảnh giới **${realm(E1.realm)}+** (phải đã phi thăng) · ${E1.bao} Thiên Bảo · ${E1.truyen} Truyền Thừa · ${fmtNum(E1.thach)} Linh Thạch.\nKết quả: ngẫu nhiên 1 trong các **dạng Biến Dị** phù hợp phẩm cấp (${T.VARIANTS.map((v) => v.name).join(', ')}).`],
        [`${E.tienhoa} Tiến Hóa Linh Căn`, `Cần: **${T.LC_AWAKEN_NAMES[E2.awaken]}** · tinh khiết **≥${E2.purity}%** · tiến độ **${E2.prog}** · cảnh giới **${realm(E2.realm)}+** · ${E2.bao} Thiên Bảo · ${E2.truyen} Truyền Thừa · ${fmtNum(E2.thach)} Linh Thạch.\nKết quả: tiến hóa theo **hành chủ đạo** (vd Kim → ${T.EVOLUTIONS['Kim'] ? T.EVOLUTIONS['Kim'].name : 'Canh Kim'}), mở cơ chế riêng.`],
        ['🎲 Tỉ lệ & bảo hiểm', `Tỉ lệ gốc **${pct(E1.rate)}** (Thể Chất) / **${pct(E2.rate)}** (Linh Căn). Mỗi lần thất bại **+${pct(E1.pityStep)}** cho lần sau, tối đa **${pct(E1.pityCap)}** — tích lũy này **được giữ** đến khi thành công.`],
        ['💥 Thất bại', 'Mất Linh Thạch + nửa Thiên Bảo; **giữ Truyền Thừa**. Thành công thì trừ đủ mọi thứ.'],
      ] }) },
  { key: 'chien', ico: () => E.conghuong, label: '⚔️ Chiến đấu & Cộng Hưởng', desc: 'Tương khắc, cộng hưởng, quy tắc đặc biệt',
    build: () => ({ d: 'Ngoài tốc độ tu luyện, Thể Chất/Linh Căn còn tác động tới chiến đấu — nhưng luôn có **trần**.',
      f: [
        ['🔥 Tương khắc', 'Hành khắc hành chủ đạo của đối thủ: **+4% lực chiến** Đấu Pháp (giảm theo số hành, tăng theo thức tỉnh). Mỗi cấp Boss có 1 nguyên tố: ±5% sát thương.'],
        [`${E.conghuong} Cộng Hưởng (cần cả Thể Chất lẫn Linh Căn)`, T.RESONANCES.map((r) => `**${r.name}**: ${r.cond}`).join('\n').slice(0, 1000)],
        ['📘 Công pháp', 'Công pháp hợp hành với Linh Căn: bonus công pháp ×0,92–1,12.'],
        ['⚠️ Đổi phẩm cấp', '• **Đan Tẩy Tủy**: hồ sơ phẩm cấp mới, thức tỉnh/tiến hóa **đặt lại** (hành & tinh khiết roll mới).\n• **Giao dịch** Thể Chất/Linh Căn: hồ sơ thức tỉnh **đi cùng** phẩm cấp.'],
        ['🎯 Cân bằng', 'Tổ hợp mạnh nhất (đầu tư tối đa) thắng khoảng 75% khi đấu cùng chỉ số — rất mạnh nhưng không bất bại.'],
      ] }) },
  { key: 'nguon', ico: () => E.hanh_kim, label: '🪨 Nguồn Thiên Đạo Thạch & Linh Phù', desc: 'Lấy ở đâu, tỉ lệ rơi bao nhiêu',
    build: () => {
      const hop = BC.CHAINS.find((c) => c.key === 'hopthe'); const [lo, hi] = hop.extra.thiendaothach; const sc = BC.BICANH_LINHGIOI_SCALE;
      const rng = sc.map((s, i) => { const a = Math.max(1, Math.floor(lo * s)); const b = Math.max(1, Math.floor(hi * s)); return `${hop.sub_names[i]}: **${a}–${b}**`; });
      const cap = K.PHITHANG_LINH_PHU_CAN;
      return { d: `Hai vật phẩm hay bị hỏi nhất. Số liệu lấy thẳng từ code nên luôn đúng.`,
        f: [
          ['🪨 Thiên Đạo Thạch', `Chỉ rơi ở **Bí Cảnh Hợp Thể** (nhánh Bí Cảnh Linh Giới): cần **đã Phi Thăng** và đạt **${realm(7)}** trở lên. **Rơi chắc chắn** mỗi lượt (không có tỉ lệ may rủi), hồi chiêu ${require('../game/cooldowns').COOLDOWN_BICANH_LINHGIOI}s.\n${rng.join('\n')}\nBậc II cần tiểu cảnh Trung Kỳ, bậc III cần Hậu Kỳ (khi đang đứng đúng cảnh giới Hợp Thể).`],
          [`${E.bao_thechat} Dùng làm gì`, `\`/thechat doi\`: **${ex1.per} Thiên Đạo Thạch → 1 Thiên Bảo Thể Chất**. Cày Hợp Thể III khoảng 9–10 lượt cho mỗi Thiên Bảo.`],
          [`${E.linhphu || '📿'} Linh Phù (Tiên Phù sau Phi Thăng)`, `Cần **${cap}** cái cho Phi Thăng; đủ ${cap}/${cap} thì **không rơi thêm**. Mỗi lượt rơi tối đa 1 cái.\n• **Bí Cảnh thường** (Sơ/Trung/Cao Cấp, Vạn Linh Cốc): **${pct(BC.LINHPHU_RATE.thuong)}** / lượt — chỉ khi đã đạt **${realm(K.HOATHAN_REALM_IDX)} Viên Mãn** (tầng ${K.HOATHAN_VIENMAN_STAGE + 1}) hoặc đã Phi Thăng.\n• **Bí Cảnh Linh Giới** (mọi chuỗi, mọi bậc): **${pct(BC.LINHPHU_RATE.linhgioi)}** / lượt — cần đã Phi Thăng.\nTrung bình ≈ 3,3 lượt Bí Cảnh thường cho 1 Linh Phù.`],
          ['⚠️ Lưu ý', 'Linh Phù cũng bị tiêu khi chống Cửu Lôi Kiếp (mỗi đạo lôi 1 cái) và khi Phi Thăng. Nếu dùng hết, phải cày lại đủ trước khi Phi Thăng.'],
        ] };
    } },
  { key: 'sukien', ico: () => E.tangtoc, label: '⚡ Sự kiện tăng tốc & Admin', desc: 'Sự kiện tăng tốc tu luyện toàn server, lệnh Admin',
    build: () => {
      const i = ST.speedInfo();
      return { d: 'Admin có thể mở **sự kiện tăng tốc tu luyện** cho toàn bộ người chơi và hỗ trợ Thể Chất/Linh Căn.',
        f: [
          [`${E.tangtoc} Sự kiện tăng tốc`, `${i.active ? `**Đang diễn ra: ×${i.mult}**${i.until ? ` (còn ${Math.max(1, Math.ceil((i.until - require('../util').now()) / 60))} phút)` : ''}` : 'Hiện **không** có sự kiện (×1).'}\nNhân thêm lên tốc độ **Tu Luyện, Bế Quan, Bế Quan Treo** của mọi người (tu vi kiếm được). **Không** đổi lượng exp cần để đột phá, không tăng Linh Thạch. Khi bật/tắt, bot thông báo ở kênh thế giới.`],
          ['🛠️ Lệnh Admin (cần quyền)', '`/fullexp` đầy tu vi · `/tangthechat` · `/tanglinhcan` tặng phẩm cấp · `/thuhoituchat` thu hồi (khôi phục phẩm cấp cũ) · `/rolltuchat` roll lại · `/tangtoctuluyen` mở/tắt sự kiện.'],
          ['👤 Với người chơi', 'Phẩm cấp admin tặng/roll vẫn có hồ sơ thức tỉnh riêng. Thu hồi sẽ trả về phẩm cấp trước đó và đặt lại hồ sơ.'],
        ] };
    } },
  { key: 'lotrinh', label: '🧭 Lộ trình gợi ý', desc: 'Nên làm gì trước, từng bước',
    build: () => ({ d: 'Một lộ trình thực tế để lên **Thức tỉnh Thể Chất I** và **Linh Căn I** sớm nhất.',
      f: [
        ['1️⃣ Tích tiến độ', 'Cứ tu luyện/bế quan đều (Linh Căn), đột phá, đi Bí Cảnh (cả hai), đánh Boss. Dùng `/thechat` / `/linhcan` xem % đã đủ chưa.'],
        ['2️⃣ Gom Thiên Bảo', `Đi Bí Cảnh & đánh Boss để rơi; dư **Thiên Đạo Thạch / Đạo Nguyên Tinh** thì đổi (${ex1.per} → 1).`],
        ['3️⃣ Gom Linh Thạch', `Thức tỉnh đầu chỉ cần ${fmtNum(T.TC_AWAKEN[0].thach)} (Thể Chất) / ${fmtNum(T.LC_AWAKEN[0].thach)} (Linh Căn) Linh Thạch.`],
        ['4️⃣ Thức tỉnh', 'Khi bảng điều kiện toàn ✅ → `/thechat thuctinh` hoặc `/linhcan thuctinh`. Thất bại cứ thử lại (không mất tiến độ).'],
        ['5️⃣ Giữ Truyền Thừa', 'Truyền Thừa rất hiếm (chắc chắn có từ Thiên Kiếp phi thăng) — để dành cho thức tỉnh cấp cao & tiến hóa.'],
        ['6️⃣ Đừng Tẩy Tủy bừa', 'Nếu đã thức tỉnh nhiều, đổi phẩm cấp sẽ **mất hết** tiến độ thức tỉnh của phẩm cấp đó.'],
      ] }) },
];

function pageEmbed(p) {
  const { d, f } = p.build();
  const title = p.ico ? `${p.ico()} ${p.label.replace(/^\S+\s/, '')}` : p.label;   // v13.9: icon pixel ở tiêu đề (menu giữ emoji Unicode)
  const e = new EmbedBuilder().setTitle(title).setColor(COLOR).setDescription(d.slice(0, 4000));
  for (const [n, v] of f) e.addFields({ name: String(n).slice(0, 256), value: String(v).slice(0, 1024), inline: false });
  return e.setFooter({ text: 'Chọn trang khác trong menu · /thechat · /linhcan · /huongdantuchat' });
}
function view() {
  const v = new View({ ownerId: null, checkOwner: false, timeout: 240 });
  v.select({ key: 'p', placeholder: '📚 Chọn trang hướng dẫn…', options: PAGES.map((p) => ({ label: p.label, description: p.desc, value: p.key })) }, (i, values) => {
    const p = PAGES.find((x) => x.key === values[0]);
    if (!p) return i.reply({ content: '❌ Không tìm thấy trang này.', flags: 64 });
    return i.update({ embeds: [pageEmbed(p)], components: v.components() });
  });
  v.onTimeout = () => v.disableAll();
  return v;
}
defineCommand({
  name: 'huongdantuchat', description: 'Hướng dẫn Thể Chất & Linh Căn: thức tỉnh, tiến hóa, Thiên Bảo, Truyền Thừa',
  run: (c) => c.send({ embeds: [pageEmbed(PAGES[0])], components: view().components() }),
});
module.exports = { PAGES, pageEmbed };
