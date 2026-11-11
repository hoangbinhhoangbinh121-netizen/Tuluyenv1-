'use strict';
// Sinh CAN_BANG_V16.txt (bảng thông số 40 công pháp) từ dữ liệu thật — chạy: node scripts/gen_report_v16.js
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_rep_${Date.now()}.db`);
const fs = require('node:fs'); const path = require('node:path');
const D = require('../src/db'); D.initDb();
const K = require('../src/game/constants'); const R = require('../src/game/realm'); const C = require('../src/game/congphapV16'); const CPX = require('../src/game/cpfx'); const D16 = require('../src/data/congphap_v16');
const fmt = (n) => Number(n).toLocaleString('en').replace(/,/g, '.');
const L = [];
L.push('CÂN BẰNG V16 (= V14.5 + Bế Quan Treo V15 + Công Pháp V16 + EXP giảm mạnh + nerf nhẹ tu luyện dồn dập)');
L.push('='.repeat(100), '');
L.push('1. THAY ĐỔI CHÍNH', '  • EXP đột phá GIẢM MẠNH: hệ số cổng tầng nhỏ 0,90 → 0,20; cổng đại cảnh giới 0,65 → 0,12 (≈ giảm 78–82% so với v14.x; v16.1 giảm thêm một nửa so với v16.0). Tốc độ tu luyện/treo/bế quan KHÔNG đổi (tính từ mốc gốc) nên số lần bấm để lên cảnh giới giảm tương ứng.',
  '    Lưu ý: nếu host có đặt biến môi trường EXP_GATE_MINOR_MULT / EXP_GATE_MAJOR_MULT / EXP_REQUIRED_MULT thì giá trị đó vẫn ĐÈ lên mặc định mới.',
  '  • NERF NHẸ khi Tu Luyện bấm tay dồn dập: trong 60 phút, ≤ 120 lần bấm → không giảm; từ lần 121 giảm dần tuyến tính, tối đa −15% ở mức bấm kín (360 lần/giờ). Bấm mỗi 30 giây không bao giờ bị giảm. Không áp cho Bế Quan, Bế Quan Treo, Bí Cảnh. Chỉnh ở balance.js: TULUYEN_FATIGUE_FREE / _MAX / _WINDOW.',
  '  • Bế Quan Treo V15 giữ nguyên: 10% tốc độ Tu Luyện bấm tay, không nhân đôi, không giới hạn giờ.',
  '  • 40 Công Pháp mới (xem mục 2–8). V16.2 TĂNG MẠNH: chỉ số ×1,9–2,2 (quyển cộng đều ≥3 chỉ số nhân thêm ×2,8), tu vi nhận được ×2,2–3,2 (quyển đa chỉ số ×3; quyển chuyên 1 chỉ số kèm tu vi ×1,6), buff/debuff Đấu Pháp ×2,2–2,6, chiêu thức +0,08 sức mạnh.',
  '    So với công pháp CŨ (chỉ số = bonus×0,4; tu vi = bonus): Tầng 7 = +44% chỉ số / +110% tu vi · Tầng 101 = +52% / +130% · Tầng 102 = +62% / +155% · Tầng 201 = +80% / +200%. Quyển Tiên Giới đa chỉ số (1025/1028/1030) vượt Tầng 101 ở MỌI chỉ số; 1040 vượt cả Tầng 201 (chỉ số lẫn tu vi); quyển Nhân Giới vượt Tầng 3 cũ; quyển Tu Luyện vượt công pháp cũ cùng bậc. Số liệu này nằm trong test_buff_v16_2.js.',
  '  • 5 KIỂU HIỆU ỨNG MỚI (đều có hook thật, tính qua talent.bundle nên dùng chung trần với Thể Chất/Linh Căn): Cơ hội Tu Luyện nhân đôi (proc, tối đa +8%) · Giữ tu vi khi Đột Phá thất bại (failKeep, tối đa +10%) · Giảm sát thương Lôi Kiếp (kiepDmg, tối đa 45%) · Né Lôi Kiếp (kiepDodge, tối đa +12%) · Linh Thạch thu từ Bí Cảnh thường & Linh Giới (thach, tối đa +60%).',
  '  • V16.3 — SÀN SỨC MẠNH (FLOORS trong congphap_v16.js): ĐỘC QUYỀN: mỗi chỉ số ≥ 0,88 + 0,05×phẩm + 0,03×thứ tự (> Tầng 201 = 0,80), tu vi ≥ 2,15 + 0,1×phẩm + 0,05×thứ tự (> 2,00), buff/debuff Đấu Pháp > 201 (0,55/0,42); 1040 mạnh nhất. TIÊN GIỚI: chỉ số ≥ 0,66 + 0,035×thứ tự (> Tầng 102; nửa trên ≥ Tầng 201), buff ≥ Tầng 7. LINH GIỚI phẩm Thiên trở lên: chỉ số > Tầng 6.',
  '  • V16.4 — NÂNG NHANH: trong Tàng Kinh Các (chi tiết 1 quyển) có thêm nút "Nâng +10 cấp" và "Nâng Tối Đa": nâng liên tục từng cấp (mỗi cấp 1 lần trừ tiền có bảo vệ số dư, y hệt nâng tay) tới khi HẾT Linh Thạch / Linh Tinh thì TỰ DỪNG ở cấp đạt được, hoặc tới Cấp 100. Nút hiện trước số cấp & tổng tiền sẽ tốn. Dùng được cho cả công pháp cũ lẫn mới. Bấm tiếp khi có thêm tiền sẽ nâng tiếp.',
  '  • V16.4 — LỰC CHIẾN: mỗi quyển mới có hiệu ứng "+% Lực Chiến" (≈ 0,5 × trung bình chỉ số quyển cộng; độc quyền ×1,25, Tiên Giới ×1,1; quyển Tu Luyện thuần tính theo tu vi). Tính đúng 1 lần ngay trong Cu.calcLucChien (chỉ số × (1 + luc)), tháo quyển là hết. Lực chiến được dùng cho mốc Thiên Kiếp và ước lượng sức mạnh Đấu Pháp.',
  '  • V16.4 — TẦNG CAO: hệ số theo cấp tăng từ ×2,2 lên ×2,8 ở Cấp 100 (nâng càng cao càng đã) và trần tổng nâng: Công/Thủ 4,5 · Sinh mệnh 5,4 · Tốc 4,0 · Tu vi 8,0 · Boss 2,5 · Lực Chiến 3,0.',
  '  • Trần tổng 3 quyển (v16.1 → v16.3): Công/Thủ 1,0→3,0 · Sinh mệnh 1,2→3,6 · Tốc 0,9→2,7 · Tu vi 2,5→7,0 · Boss 0,8→1,8. Chỉnh trong congphap_v16.js: GROUP_SCALE / MULTI_STAT_BONUS / FLOORS / FX_CAP.', '');
L.push('2. CÁCH TÍNH HIỆU ỨNG (đúng một lần, không cộng đôi)',
  '  • (Số trong bảng mục 6 đã gồm hệ số v16.2.)', '  • Công pháp CŨ: giữ nguyên (cong_phap_bonus → cpScale ×0,4 cho chỉ số; ×1 cho tu vi).',
  '  • Công pháp MỚI không ghi vào cong_phap_bonus. Hiệu ứng được TÍNH TỪ ô trang bị + cấp mỗi lần cần (game/cpfx.js):',
  '      atk/def/hp/spd → cộng vào hệ số chỉ số RIÊNG từng chỉ số (cùng ngoặc với cpScale, Cu.cpScaleFor)',
  '      tu → nhân tu vi nhận được (Tu Luyện, Bế Quan, Treo, Bí Cảnh) · boss → sát thương lên Boss Thế Giới',
  '      absorb/ngo/regen/loot/bt/dodge/dr/pierce/crit/critMult/lifesteal/proc/failKeep/kiepDmg/kiepDodge/thach → gộp vào talent.bundle (dùng chung trần với Thể Chất/Linh Căn)',
  '  • Tháo công pháp = hiệu ứng biến mất ngay (không lưu số dư). Trang bị 3 quyển: mỗi quyển cộng 1 lần rồi chặn trần tổng (FX_CAP). Không trang bị trùng 1 quyển.',
  `  • Nâng cấp: hiệu ứng × (1 + ${D16.LEVEL_FX_GROWTH} × cấp) → tối đa ×${(1 + D16.LEVEL_FX_GROWTH * 100).toFixed(1)} ở Cấp 100; buff/debuff Đấu Pháp +${D16.LEVEL_PVP_STEP}/cấp.`,
  '  • Tương hợp Linh Căn: nhân các hiệu ứng chính (chỉ số/tu vi/boss) theo hành của quyển (quyển Ngũ Hành khuếch đại ×2,5 chênh lệch). Hành cố định theo loại, không xoay vòng.',
  '  • Trần tổng hiệu ứng: ' + Object.entries(D16.FX_CAP).map(([k, v]) => `${k} ${v}`).join(' · '), '');
L.push('3. CHIÊU THỨC ĐẤU PHÁP (cùng vòng 5 hiệp của Đấu Pháp, KHÔNG có hệ thống chiến đấu riêng)',
  '  • 4 chiêu mỗi quyển, tên cố định. Chiêu thức lấy từ quyển ở Ô 1 (nút "Đặt ô 1" trong Tàng Kinh Các).',
  '  • Hiệu ứng thật: nhân sát thương đòn (dmg), xuyên giáp riêng đòn, bạo kích riêng đòn, hồi sinh lực (≈ heal×40 điểm trên thanh 100), hộ thể giảm sát thương nhận N đòn, suy yếu đối thủ N đòn, né thêm N đòn. Trạng thái theo từng trận.',
  '  • Hạn chế trung thực: chưa có hiệu ứng khống chế (choáng/đóng băng làm mất lượt) và chiêu chỉ lấy từ 1 quyển (ô 1), giống thiết kế cũ. Sát thương Boss Thế Giới dùng hệ số "boss", không dùng chiêu thức.', '');
L.push('4. NGUỒN THU THẬP',
  '  • Cửa Hàng (Tàng Kinh Các): 30 quyển Nhân/Linh/Tiên Giới (mua 1 lần, kiểm tra đủ tiền + giá không đổi + không mua trùng).',
  '  • Bí Cảnh thường (Sơ/Trung/Cao/Vạn Linh Cốc): rơi công pháp Nhân Giới — ' + D16.SOURCES.bicanh_thuong.chance.map((c) => `${c * 100}%`).join(' / ') + ' mỗi lần.',
  '  • Bí Cảnh Linh Giới: rơi công pháp Linh Giới 2,5%; Hư Thiên Độn Pháp 1,2% (từ Hợp Thể); Thiên Hà Tinh Thần 0,8% (từ Đại Thừa); mảnh Hư Thiên / Thiên Hà 18%.',
  '  • Bí Cảnh Thượng Cổ (= chuỗi Độ Kiếp của Linh Giới, bộ đếm "Bí Cảnh Thượng Cổ" có sẵn trong source): +4% công pháp Linh Giới, 2% Thái Cổ Long Tượng, 30% mảnh Long Tượng.',
  '  • Bí Cảnh Đặc Biệt (Vé): Cửu U Diệt Hồn 3%; mảnh Diệt Hồn 25%.',
  '  • Boss Thế Giới: người kết liễu — 201 giữ nguyên (0,5%), Cửu Tiêu 1,5%, Diệt Hồn 0,8%, Vô Thượng Kiếm Đạo 1,2% (Boss cấp ≥ 6). Người đóng góp ≥ 2% sát thương: mảnh Cửu Tiêu 30%, mảnh Diệt Hồn 10%, mảnh Vô Thượng 25% (cấp ≥ 6).',
  '  • Kỳ Ngộ: source cũ KHÔNG có module Kỳ Ngộ, nên V16 tạo module MỚI độc lập (congphapV16.rollKyNgo) kích hoạt mỗi lần Cảm Ngộ (hồi 30 phút): thường 2% (1 mảnh bí tịch), hiếm 0,5% (Vạn Cổ Trường Sinh, từ Linh Giới Nguyên Anh+), cấp cao 0,25% (Thái Sơ Hỗn Độn), cực hiếm 0,08% (Vô Cực Thiên Đạo, Tiên Giới). Đây là hệ thống mới, không phải tích hợp vào cái có sẵn.',
  '  • Sự Kiện Đặc Biệt: Càn Khôn Trấn Giới Kinh do admin phát bằng /phatcongphap (mặc định 1039) hoặc đặt "cong_phap": 1039 trong mã code đổi thưởng.',
  '  • Mảnh bí tịch (bảng congphap_fragments): ' + D16.FRAGMENTS.map((f) => `${f.name} ×${f.need}→${C.nameOf(f.book)}`).join(' · ') + '. Hợp thành trong Tàng Kinh Các → Mảnh; mảnh không rơi khi đã sở hữu quyển đó.', '');
L.push('5. NÂNG CẤP (Cấp 0 → 100)',
  '  • Chi phí cấp L = ceil(base × hệ số khung × (1 + 0,02 × vị trí trong khung)). Khung: ' + D16.UP_BRACKETS.map((b, i) => `${D16.BRACKET_LABEL[i]}: ×${b[1]}`).join(' · ') + ' (Linh Tinh dùng hệ số nhẹ hơn: ' + D16.UP_BRACKETS_LT.map((b) => `×${b[1]}`).join(' · ') + ').',
  '  • base = 6% giá mua (Linh Thạch) hoặc giá/12 (Linh Tinh); quyển độc quyền dùng giá tham chiếu tương đương cấp bậc.', '');
L.push('6. BẢNG 40 CÔNG PHÁP');
for (const b of D16.BOOKS) {
  L.push('-'.repeat(100));
  L.push(`[${b.tier}] ${b.name}  (id ${b.id})`);
  L.push(`  Nhóm: ${D16.GROUPS[b.group].label} · Loại: ${D16.CATS[b.cat].label} (hành ${b.element}) · ${b.phamName}`);
  L.push(`  Mô tả: ${b.desc}`);
  L.push(`  Yêu cầu: ${K.REALMS[b.require_realm].name} · ${R.worldTierName(b.require_world)}   Giá: ${b.shop ? `${fmt(b.cost)} ${b.currency === 'linh_tinh' ? 'Linh Tinh' : 'Linh Thạch'}` : 'KHÔNG bán'}`);
  L.push(`  Hiệu ứng Cấp 0: ${C.effectLines(b, 0).join(' · ')}`);
  L.push(`  Hiệu ứng Cấp 100 (trước trần): ${C.effectLines(b, 100).join(' · ')}`);
  L.push(`  Đấu Pháp: Cấp 0 ${C.pvpText(b, 0)} · Cấp 100 ${C.pvpText(b, 100)}`);
  L.push(`  Nâng cấp: ${fmt(C.upgradeCost(b, 0))} → ${fmt(C.upgradeCost(b, 99))} ${b.up_currency === 'linh_tinh' ? 'Linh Tinh' : 'Linh Thạch'}/cấp; tổng 0→100 = ${fmt(C.upgradeTotal(b))}`);
  b.skills.forEach((s, i) => L.push(`  Chiêu ${i + 1}: ${s.name} — ${CPX.skillEffectText(s.name)}`));
  L.push(`  Nguồn: ${D16.sourcesOf(b)}`);
}
L.push('-'.repeat(100), '');
const old = path.join(__dirname, '..', 'CAN_BANG_V14.5.txt');
L.push('7. ' + 'PHỤ LỤC — CÂN BẰNG V14.5 (giữ nguyên để tham chiếu)', '='.repeat(100));
if (fs.existsSync(old)) L.push(fs.readFileSync(old, 'utf8'));
fs.writeFileSync(path.join(__dirname, '..', 'CAN_BANG_V16.txt'), L.join('\n'));
console.log('Đã ghi CAN_BANG_V16.txt', L.length, 'dòng');
