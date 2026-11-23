'use strict';
/**
 * v21.5 — DỮ LIỆU CHỦNG TỘC (một nguồn duy nhất, versioned). Mọi con số cân bằng nằm ở đây — logic không chứa số.
 * Khoá hiệu ứng DÙNG CHUNG với talent.CAPS (tu absorb ngo atk def hp regen crit critMult dodge bt failKeep kiepDmg kiepDodge loot dr pierce lifesteal proc thach)
 * → chủng tộc cộng vào đúng "gói hiệu ứng" talent.bundle và chịu chung trần CAPS với Thể Chất/Linh Căn/Công Pháp; không có đường tính chỉ số thứ hai.
 *
 * Quy tắc thiết kế (xem docs/audit_v21_3/10_RACE_DESIGN_V21_5.md): mỗi tộc có điểm mạnh + nhược điểm rõ (trừ Nhân Tộc: nhỏ nhưng đều);
 * không tộc nào thắng ≥ ngưỡng benchmark (scripts/bench_race21.js). Số liệu là ĐỀ XUẤT đã benchmark — chờ người thiết kế duyệt, chỉnh bằng sửa file này.
 */
const VERSION = 1;
// hệ số hiệu lực nội tại theo giai đoạn thức tỉnh (0..3) và theo cấp huyết mạch (0..5)
const AW_MULT = [1.0, 1.15, 1.3, 1.5];
const LV_MULT = [0, 0.4, 0.6, 0.8, 1.0, 1.2];
const AW_NAMES = ['Chưa thức tỉnh', 'Thức Tỉnh Sơ Giai', 'Thức Tỉnh Trung Giai', 'Thức Tỉnh Viên Mãn'];

// điều kiện (realm_index tối thiểu: 5 = Hóa Thần là trần khi chưa Phi Thăng; 6 Luyện Hư, 7 Hợp Thể, 8 Đại Thừa) — bám mốc TC_AWAKEN/TC_EVOLVE hiện có (cao nhất 8) + Linh Thạch. Mốc Linh Thạch bám bảng thức tỉnh Thể Chất/Linh Căn hiện có (100k…20M).
const AWAKEN = [
  { realm: 2, thach: 100000 },      // → giai đoạn 1
  { realm: 4, thach: 500000 },      // → giai đoạn 2
  { realm: 6, thach: 3000000 },     // → giai đoạn 3
];
const BLOODLINE_PICK = { awaken: 1, realm: 3, thach: 200000 };           // chọn nhánh huyết mạch → cấp 1
const BLOODLINE_LEVEL = [   // index = cấp ĐÍCH − 2 (cấp 2..5)
  { awaken: 1, realm: 4, thach: 300000 },
  { awaken: 2, realm: 6, thach: 1000000 },
  { awaken: 2, realm: 7, thach: 3000000 },
  { awaken: 3, realm: 8, thach: 8000000 },
];
const EVOLVE = { awaken: 3, level: 5, realm: 8, thach: 30000000 };      // tất định (không xác suất) → không có khe exploit/reroll
const CHANGE = { thach: 1000000, cooldownSec: 7 * 86400 };               // đổi tộc: mất toàn bộ thức tỉnh/huyết mạch/tiến hóa; có hồi chiêu

const RACES = {
  nhan: {
    id: 'nhan', name: 'Nhân Tộc', icon: '🧑', role: 'Thích nghi — đa năng',
    lore: 'Sinh ra không có thiên phú trời ban, nhân tộc lấy ngộ tính và ý chí để đi đường riêng: ít điểm yếu, nhiều hướng đi.',
    passive: { name: 'Vạn Pháp Thích Ứng', desc: 'Mọi mặt đều nhỉnh hơn một chút, không có nhược điểm — nhưng không có điểm nào vượt trội.', fx: { tu: 0.03, ngo: 0.02, bt: 0.01, loot: 0.02, atk: 0.02, def: 0.02, hp: 0.01 } },
    bloodlines: {
      nhan_hoang: { name: 'Nhân Hoàng Huyết', desc: 'Hướng tu luyện: tốc độ tu, ngộ đạo, đột phá.', fx: { tu: 0.03, ngo: 0.03, bt: 0.02, absorb: 0.04 } },
      chien_than: { name: 'Chiến Thần Huyết', desc: 'Hướng chiến đấu: công, thủ, bạo kích cân bằng.', fx: { atk: 0.035, crit: 0.02, def: 0.02, hp: 0.02 } },
    },
    evolved: { name: 'Nhân Đạo Chí Tôn', desc: 'Đạo của nhân tộc viên mãn.', fx: { tu: 0.02, atk: 0.02, def: 0.02, hp: 0.015, dr: 0.015 } },
    counter: 'Không có điểm bùng nổ: thua tộc chuyên biệt cùng cấp ở mặt chúng chuyên sâu.',
  },
  long: {
    id: 'long', name: 'Long Tộc', icon: '🐉', role: 'Chống chịu — long uy',
    lore: 'Huyết long cổ xưa ban thân thể cứng cáp và uy áp cận chiến, đổi lại tâm tính kiêu ngạo, tu hành chậm và thân pháp nặng nề.',
    passive: { name: 'Long Uy Hộ Thể', desc: 'Sinh mệnh, phòng ngự và giảm sát thương cao; tu luyện chậm hơn và khó né đòn.', fx: { hp: 0.05, def: 0.04, dr: 0.02, atk: 0.015, tu: -0.02, dodge: -0.03 } },
    bloodlines: {
      thuong_long: { name: 'Thương Long Huyết', desc: 'Bền bỉ: hồi sinh mệnh, chịu Lôi Kiếp tốt.', fx: { hp: 0.04, regen: 0.30, kiepDmg: 0.08, def: 0.01 } },
      hac_long: { name: 'Hắc Long Huyết', desc: 'Hung bạo: xuyên giáp, bạo kích mạnh.', fx: { atk: 0.03, pierce: 0.03, critMult: 0.05, dr: 0.01 } },
    },
    evolved: { name: 'Chân Long', desc: 'Long tộc hóa chân long.', fx: { hp: 0.03, def: 0.02, atk: 0.02, dr: 0.015, kiepDmg: 0.06 } },
    counter: 'Khó né tránh; kẻ xuyên giáp / đánh chậm (tu thấp) rút ngắn được ưu thế.',
  },
  phuong: {
    id: 'phuong', name: 'Phượng Tộc', icon: '🔥', role: 'Hỏa lực — hồi phục',
    lore: 'Lửa niết bàn sinh ra từ tro tàn: đánh mạnh, hồi nhanh, nhưng thân xác mỏng manh.',
    passive: { name: 'Niết Bàn Chi Hỏa', desc: 'Công kích, hồi sinh mệnh và hút máu; phòng ngự và sinh mệnh thấp.', fx: { atk: 0.045, regen: 0.40, lifesteal: 0.015, crit: 0.015, def: -0.03, hp: -0.02 } },
    bloodlines: {
      chu_tuoc: { name: 'Chu Tước Huyết', desc: 'Bùng nổ: bạo kích và sát thương bạo kích.', fx: { atk: 0.03, crit: 0.025, critMult: 0.08, lifesteal: 0.01 } },
      niet_ban: { name: 'Niết Bàn Phượng Huyết', desc: 'Tái sinh: hồi mạnh, giữ tu vi khi đột phá thất bại.', fx: { regen: 0.50, failKeep: 0.04, kiepDmg: 0.06, hp: 0.02 } },
    },
    evolved: { name: 'Thần Phượng', desc: 'Phượng hoàng viên mãn.', fx: { atk: 0.02, regen: 0.30, lifesteal: 0.01, kiepDodge: 0.03 } },
    counter: 'Mỏng thủ: bị đánh dồn dập, hoặc kẻ cắt hồi phục/cho chịu đòn sớm.',
  },
  ma: {
    id: 'ma', name: 'Ma Tộc', icon: '😈', role: 'Áp chế — bạo phát',
    lore: 'Ma khí đổi lấy sức mạnh: đánh rất đau, xuyên giáp, nhưng tâm ma làm đột phá khó và thân thể trống.',
    passive: { name: 'Ma Khí Áp Chế', desc: 'Công, bạo kích, xuyên giáp cao; phòng ngự thấp, đột phá khó hơn và dễ mất tu vi khi thất bại.', fx: { atk: 0.045, critMult: 0.08, crit: 0.02, pierce: 0.03, def: -0.04, bt: -0.02, failKeep: -0.01 } },
    bloodlines: {
      huyet_ma: { name: 'Huyết Ma Huyết', desc: 'Hút máu: đổi sát thương thành sinh mệnh.', fx: { lifesteal: 0.02, atk: 0.025, hp: 0.02 } },
      co_ma: { name: 'Cổ Ma Huyết', desc: 'Cổ xưa: xuyên giáp sâu, bớt sát thương nhận.', fx: { pierce: 0.03, dr: 0.015, critMult: 0.06 } },
    },
    evolved: { name: 'Ma Tôn', desc: 'Ma đạo viên mãn.', fx: { atk: 0.02, pierce: 0.02, crit: 0.01, lifesteal: 0.01 } },
    counter: 'Thủ yếu: kẻ giảm sát thương / né tránh tốt kéo dài trận, hoặc đòn phản.',
  },
  linh: {
    id: 'linh', name: 'Linh Tộc', icon: '✨', role: 'Thân pháp — linh lực',
    lore: 'Sinh ra từ linh khí trời đất: nhẹ như gió, hấp thu linh khí rất nhanh, nhưng thân xác mong manh.',
    passive: { name: 'Linh Khí Tương Thân', desc: 'Né tránh, hấp thu linh khí, ngộ đạo; sinh mệnh và phòng ngự thấp.', fx: { dodge: 0.035, absorb: 0.10, ngo: 0.03, tu: 0.02, hp: -0.04, def: -0.02 } },
    bloodlines: {
      phong_linh: { name: 'Phong Linh Huyết', desc: 'Thân pháp: né, bạo kích, né Lôi Kiếp.', fx: { dodge: 0.025, crit: 0.015, kiepDodge: 0.05 } },
      moc_linh: { name: 'Mộc Linh Huyết', desc: 'Sinh khí: hấp thu, hồi phục, thu hoạch.', fx: { absorb: 0.08, regen: 0.30, loot: 0.03, ngo: 0.02 } },
    },
    evolved: { name: 'Thiên Linh', desc: 'Linh thể viên mãn.', fx: { dodge: 0.015, tu: 0.02, absorb: 0.05, dr: 0.01 } },
    counter: 'Mỏng máu: dính đòn là đau; kẻ đánh chắc trúng / diện rộng khắc chế.',
  },
  yeu: {
    id: 'yeu', name: 'Yêu Tộc', icon: '🦊', role: 'Bản năng — biến hóa',
    lore: 'Bản năng hoang dã và khứu giác cơ duyên: săn mồi giỏi, thu hoạch nhiều, nhưng tâm tính thất thường.',
    passive: { name: 'Hoang Dã Bản Năng', desc: 'Thu hoạch Bí Cảnh, bạo kích, sinh mệnh; phòng ngự thấp, đột phá hơi khó.', fx: { loot: 0.05, crit: 0.02, hp: 0.03, atk: 0.02, def: -0.02, bt: -0.01 } },
    bloodlines: {
      ho_yeu: { name: 'Hồ Yêu Huyết', desc: 'Linh hoạt: né, ngộ đạo, cơ duyên.', fx: { dodge: 0.03, ngo: 0.03, loot: 0.04, crit: 0.01 } },
      ho_vuong: { name: 'Hổ Vương Huyết', desc: 'Hung mãnh: công, bạo kích, sinh mệnh.', fx: { atk: 0.025, crit: 0.02, hp: 0.03 } },
    },
    evolved: { name: 'Đại Yêu', desc: 'Yêu đạo viên mãn.', fx: { atk: 0.02, hp: 0.02, loot: 0.03, crit: 0.01 } },
    counter: 'Thủ thấp: bị khắc bởi đối thủ đánh nhanh dứt điểm.',
  },
};
const ORDER = ['nhan', 'long', 'phuong', 'ma', 'linh', 'yeu'];
module.exports = { VERSION, AW_MULT, LV_MULT, AW_NAMES, AWAKEN, BLOODLINE_PICK, BLOODLINE_LEVEL, EVOLVE, CHANGE, RACES, ORDER };
