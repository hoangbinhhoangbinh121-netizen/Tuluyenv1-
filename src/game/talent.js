'use strict';
/**
 * HỆ THỐNG THỂ CHẤT & LINH CĂN (v13.6 — "BIG UPDATE") — LÕI THUẦN (không đụng DB).
 *
 *  Hai hệ thống ĐỘC LẬP, mỗi hệ có hồ sơ riêng nằm trong bảng `cultivators`:
 *    THỂ CHẤT : the_chat (phẩm cấp gốc, KHÔNG đổi) + the_chat_tier / the_chat_stage / the_chat_prog / the_chat_bien_di / the_chat_pity
 *    LINH CĂN : linh_can (phẩm cấp gốc, KHÔNG đổi) + linh_can_tier / linh_can_hanh / linh_can_purity / linh_can_awaken /
 *               linh_can_prog / linh_can_tienhoa / linh_can_pity
 *    Vật phẩm : bao_the_chat, bao_linh_can (Thiên Bảo), truyen_thua (Truyền Thừa Ngọc Giản)
 *  Bảng HỆ SỐ và TỈ LỆ xuất hiện (K.THE_CHAT / K.LINH_CAN) KHÔNG bị chạm tới. Hệ số vẫn là "hệ số tu luyện gốc";
 *  mọi hiệu ứng mới là mục RIÊNG, cộng dạng % nhỏ và bị CHẶN TRẦN (CAPS) nên không nhân dồn vô hạn.
 *
 *  `bundle(row)` gom mọi hiệu ứng đang hoạt động thành một gói số (tu, atk, def, hp, regen, crit, dodge, bt, ...), mỗi module gameplay
 *  chỉ đọc đúng khoá nó cần. Hồ sơ thiếu cột / lệch phẩm cấp (do Tẩy Tủy, giao dịch...) được suy ra XÁC ĐỊNH từ user_id nên
 *  người chơi cũ chạy ngay không cần migration, và không bao giờ đổi lung tung giữa các lần chạy.
 */
const K = require('./constants');

// ------------------------------------------------------------------ danh mục
const NGU_HANH = ['Kim', 'Mộc', 'Thủy', 'Hỏa', 'Thổ'];
const DI_THUOC_TINH = ['Phong', 'Lôi', 'Băng', 'Quang', 'Ám'];
const DAC_THU = ['Không Gian', 'Thời Gian', 'Sinh Mệnh', 'Hủy Diệt', 'Hỗn Độn'];
const ALL_ELEMENTS = [...NGU_HANH, ...DI_THUOC_TINH, ...DAC_THU];
const ELEMENT_KIND = (e) => (NGU_HANH.includes(e) ? 'Ngũ Hành' : DI_THUOC_TINH.includes(e) ? 'Dị Thuộc Tính' : 'Đặc Thù');
const SINH = { Kim: 'Thủy', Thủy: 'Mộc', Mộc: 'Hỏa', Hỏa: 'Thổ', Thổ: 'Kim' };      // X sinh Y
const KHAC = { Kim: 'Mộc', Mộc: 'Thổ', Thổ: 'Thủy', Thủy: 'Hỏa', Hỏa: 'Kim' };      // X khắc Y

const STAGE_NAMES = ['Sơ Khai', 'Thức Tỉnh', 'Tiểu Thành', 'Đại Thành', 'Viên Mãn'];
const STAGE_MULT = [0.5, 1.0, 1.4, 1.8, 2.3];          // hệ số hiệu lực của thiên phú theo giai đoạn thức tỉnh thể chất
const LC_AWAKEN_NAMES = ['Chưa thức tỉnh', 'Thức Tỉnh Lần I', 'Thức Tỉnh Lần II', 'Thức Tỉnh Lần III'];
const LC_AWAKEN_MULT = [0.5, 1.0, 1.15, 1.3];          // hệ số hiệu lực của thuộc tính linh căn theo cấp thức tỉnh
const DILUTION = { 1: 1.0, 2: 0.85, 3: 0.7, 4: 0.6, 5: 0.5 };   // linh căn nhiều hành: hiệu ứng từng hành bị loãng

const CAPS = {   // trần của TỔNG hiệu ứng mới (không tính hệ số gốc). Số âm tối đa -0.10 (regen -0.50).
  tu: 0.35, absorb: 0.40, ngo: 0.12, atk: 0.15, def: 0.15, hp: 0.15, regen: 1.5, crit: 0.10, critMult: 0.25, dodge: 0.10,
  bt: 0.08, failKeep: 0.10, kiepDmg: 0.45, kiepDodge: 0.12, loot: 0.30, dr: 0.12, pierce: 0.15, lifesteal: 0.10, proc: 0.08, thach: 0.60,
};
const LABEL = {
  tu: 'Tốc độ tu luyện', absorb: 'Hấp thu linh khí (Cảm Ngộ / Linh Mạch)', ngo: 'Tỉ lệ Ngộ đạo', atk: 'Công kích', def: 'Phòng ngự', hp: 'Sinh mệnh',
  regen: 'Hồi Sinh Mệnh', crit: 'Bạo kích (Đấu Pháp)', critMult: 'Sát thương bạo kích', dodge: 'Né tránh (Đấu Pháp)', bt: 'Tỉ lệ Đột Phá',
  failKeep: 'Giữ tu vi khi Đột Phá thất bại', kiepDmg: 'Giảm sát thương Lôi Kiếp', kiepDodge: 'Né Lôi Kiếp', loot: 'Thu hoạch Bí Cảnh / Cơ duyên',
  dr: 'Giảm sát thương nhận (Đấu Pháp)', pierce: 'Xuyên giáp (Đấu Pháp)', lifesteal: 'Hút máu (Đấu Pháp)', proc: 'Cơ hội Tu Luyện nhân đôi', thach: 'Linh Thạch thu từ Bí Cảnh',
};
const PCT_KEYS = new Set(Object.keys(CAPS));
const fmtFx = (k, v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(v * 100 % 1 === 0 ? 0 : 1)}% ${LABEL[k] || k}`;

// ------------------------------------------------------------------ THỂ CHẤT: thiên phú độc quyền (giá trị gốc tại S = 1, nhân STAGE_MULT)
const THECHAT_TALENTS = [
  { name: 'Phàm Nhân Chi Tâm', desc: 'Càng lên đại cảnh giới càng thuận đạo: tốc độ tu luyện +0.5%/đại cảnh giới (tối đa +6%), dễ đột phá hơn và hao tu vi ít hơn khi thất bại. Bù lại cho Phàm Thể con đường tu hành dài hạn.',
    fx: (S, c) => ({ tu: Math.min(0.06, 0.005 * Math.max(0, c.realm)) * S, bt: 0.015 * S, failKeep: 0.01 * S }) },
  { name: 'Linh Khí Thân Hòa', desc: 'Thân thể thân hòa linh khí: hấp thu linh khí (Cảm Ngộ, Linh Mạch) tốt hơn và tu luyện nhanh hơn.',
    fx: (S) => ({ absorb: 0.10 * S, tu: 0.03 * S }) },
  { name: 'Huyền Nguyên Hộ Thể', desc: 'Huyền khí hộ thân: tăng Phòng ngự, giảm sát thương nhận trong Đấu Pháp và chịu Lôi Kiếp tốt hơn.',
    fx: (S) => ({ def: 0.04 * S, dr: 0.02 * S, kiepDmg: 0.05 * S }) },
  { name: 'Thánh Huyết Bất Diệt', desc: 'Huyết mạch thánh cổ: Sinh mệnh cao hơn và hồi phục nhanh hơn hẳn.',
    fx: (S) => ({ hp: 0.05 * S, regen: 0.40 * S }) },
  { name: 'Thiên Nhân Hợp Nhất', desc: 'Hòa làm một với thiên đạo: dễ Ngộ đạo, Cảm Ngộ thu được nhiều hơn, đột phá thuận lợi hơn.',
    fx: (S) => ({ ngo: 0.05 * S, absorb: 0.06 * S, bt: 0.02 * S, tu: 0.02 * S }) },
  { name: 'Hồng Mông Sơ Khai', desc: 'Khí vận Hồng Mông: thu hoạch Bí Cảnh/cơ duyên nhiều hơn, hấp thu linh khí tốt hơn, đột phá thuận lợi hơn.',
    fx: (S) => ({ loot: 0.06 * S, absorb: 0.08 * S, bt: 0.015 * S }) },
  { name: 'Hỗn Độn Diễn Sinh', desc: 'Hỗn Độn diễn hóa vạn vật: mỗi lần Tu Luyện có cơ hội nhận gấp đôi tu vi, thêm chút công/thủ/sinh mệnh.',
    fx: (S) => ({ proc: 0.02 * S, tu: 0.02 * S, atk: 0.015 * S, def: 0.015 * S, hp: 0.015 * S }) },
  { name: 'Vô Cực Vô Tận', desc: 'Vô cực vô tận: công/thủ/sinh mệnh đều nhỉnh hơn, tu luyện nhanh hơn, thêm bạo kích và giữ tu vi khi đột phá thất bại.',
    fx: (S) => ({ atk: 0.025 * S, def: 0.025 * S, hp: 0.025 * S, tu: 0.03 * S, crit: 0.01 * S, failKeep: 0.01 * S }) },
];

// ------------------------------------------------------------------ THỂ CHẤT: biến dị (tiến hóa) — giá trị ĐÃ là giá trị cuối (cần Viên Mãn mới tiến hóa được)
const VARIANTS = [
  { name: 'Bất Diệt Chiến Thể', minIdx: 0, desc: 'Chiến thể bất diệt: Sinh mệnh dày và hồi phục rất nhanh.', fx: { hp: 0.06, regen: 0.50, dr: 0.02 } },
  { name: 'Thiên Sát Chiến Thể', minIdx: 0, desc: 'Sát khí ngút trời: công kích cao, bạo kích mạnh.', fx: { atk: 0.06, crit: 0.03, critMult: 0.10 } },
  { name: 'Cửu Âm Tuyệt Thể', minIdx: 1, desc: 'Âm hàn tuyệt đối: thủ vững, bớt sát thương Lôi Kiếp.', fx: { def: 0.06, dr: 0.03, kiepDmg: 0.12 } },
  { name: 'Cửu Dương Thần Thể', minIdx: 1, desc: 'Dương khí cuồn cuộn: công kích và hồi phục tốt.', fx: { atk: 0.05, regen: 0.30, lifesteal: 0.02 } },
  { name: 'Thái Sơ Đạo Thể', minIdx: 4, desc: 'Đạo thể sơ khai: tu luyện nhanh, đột phá dễ.', fx: { tu: 0.06, bt: 0.03, ngo: 0.03 } },
  { name: 'Luân Hồi Tiên Thể', minIdx: 4, desc: 'Luân hồi bất tận: thất bại đột phá/Thiên Kiếp ít tổn thất hơn.', fx: { failKeep: 0.05, kiepDmg: 0.10, regen: 0.20 } },
  { name: 'Không Gian Đạo Thể', minIdx: 5, desc: 'Xuyên toa không gian: né tránh tốt, thu hoạch Bí Cảnh nhiều hơn.', fx: { dodge: 0.05, loot: 0.08, dr: 0.01 } },
  { name: 'Thời Gian Thần Thể', minIdx: 6, desc: 'Thời gian chậm lại với ta: tu luyện nhanh hơn, hấp thu tốt hơn.', fx: { tu: 0.08, absorb: 0.10, proc: 0.01 } },
];

// ------------------------------------------------------------------ LINH CĂN: đặc tính từng thuộc tính (ưu thế + HẠN CHẾ) tại thức tỉnh Lần I, độ tinh khiết 100%
const ELEMENT_TRAITS = {
  'Kim': { fx: { atk: 0.04, hp: -0.02 }, desc: 'Sắc bén: công kích cao, đổi lại sinh mệnh mỏng hơn.' },
  'Mộc': { fx: { regen: 0.30, atk: -0.015 }, desc: 'Sinh cơ dồi dào: hồi sinh mệnh nhanh, nhưng sát thương nhẹ hơn.' },
  'Thủy': { fx: { tu: 0.03, def: -0.015 }, desc: 'Thuận dòng linh khí: tu luyện nhanh hơn, phòng ngự lỏng lẻo hơn.' },
  'Hỏa': { fx: { crit: 0.03, regen: -0.15 }, desc: 'Bùng nổ: bạo kích tốt, đổi lại hồi phục kém.' },
  'Thổ': { fx: { def: 0.04, dodge: -0.015 }, desc: 'Vững chãi: phòng ngự cao, kém linh hoạt.' },
  'Phong': { fx: { dodge: 0.04, def: -0.015 }, desc: 'Nhanh nhẹn: né tránh tốt, mỏng manh.' },
  'Lôi': { fx: { kiepDmg: 0.12, crit: 0.015, hp: -0.015 }, desc: 'Thân cận lôi đình: giảm sát thương Lôi Kiếp, bạo kích nhẹ; sinh mệnh nhỉnh thấp.' },
  'Băng': { fx: { def: 0.03, dodge: 0.01, tu: -0.02 }, desc: 'Băng giá: thủ chắc, tu luyện chậm hơn một chút.' },
  'Quang': { fx: { bt: 0.02, regen: 0.15, atk: -0.015 }, desc: 'Thanh tịnh: dễ đột phá, hồi phục tốt, kém sát thương.' },
  'Ám': { fx: { atk: 0.03, crit: 0.02, bt: -0.01 }, desc: 'Âm u: sát thương, bạo kích; đột phá khó hơn chút.' },
  'Không Gian': { fx: { dodge: 0.03, loot: 0.05, hp: -0.02 }, desc: 'Xuyên không: né tránh, thu hoạch Bí Cảnh; thân thể mỏng.' },
  'Thời Gian': { fx: { tu: 0.04, atk: -0.02 }, desc: 'Thời gian lưu chuyển: tu luyện nhanh, sát thương kém.' },
  'Sinh Mệnh': { fx: { hp: 0.04, regen: 0.35, atk: -0.02 }, desc: 'Sức sống tràn trề: sinh mệnh và hồi phục vượt trội, sát thương thấp.' },
  'Hủy Diệt': { fx: { atk: 0.05, crit: 0.03, def: -0.03 }, desc: 'Phá hoại: sát thương lớn, phòng ngự kém.' },
  'Hỗn Độn': { fx: { atk: 0.02, def: 0.02, hp: 0.02, tu: 0.02, bt: -0.01 }, desc: 'Toàn diện: mọi mặt nhỉnh hơn, đột phá khó hơn một chút.' },
};

// LINH CĂN: nhánh tiến hóa — mỗi nhánh có CƠ CHẾ RIÊNG (khoá hiệu ứng khác nhau), không chỉ đổi tên và tăng hệ số
const EVOLUTIONS = {
  'Kim': { name: 'Canh Kim Linh Căn', fx: { atk: 0.08, pierce: 0.10 }, mech: 'Xuyên giáp: bỏ qua 10% Phòng ngự đối thủ trong Đấu Pháp.' },
  'Mộc': { name: 'Thanh Đế Mộc Linh Căn', fx: { regen: 0.60, lifesteal: 0.06 }, mech: 'Hút máu: hồi 6% sát thương gây ra trong Đấu Pháp.' },
  'Thủy': { name: 'Cửu U Hàn Thủy Linh Căn', fx: { tu: 0.06, dr: 0.05 }, mech: 'Hàn khí hộ thể: giảm 5% sát thương nhận trong Đấu Pháp.' },
  'Hỏa': { name: 'Thái Dương Linh Căn', fx: { crit: 0.06, atk: 0.04, critMult: 0.15 }, mech: 'Liệt hỏa: bạo kích mạnh hơn (+15% sát thương bạo kích).' },
  'Thổ': { name: 'Hậu Thổ Linh Căn', fx: { def: 0.05, hp: 0.08 }, mech: 'Đại địa vững chãi: Sinh mệnh và Phòng ngự cùng tăng.' },
  'Phong': { name: 'Cửu Thiên Cương Phong Linh Căn', fx: { dodge: 0.08, crit: 0.02 }, mech: 'Cương phong: né tránh vượt trội.' },
  'Lôi': { name: 'Tử Tiêu Thần Lôi Linh Căn', fx: { kiepDmg: 0.30, kiepDodge: 0.06, crit: 0.03 }, mech: 'Lôi Kiếp: giảm 30% sát thương và né thêm Lôi Kiếp khi đột phá đại cảnh giới.' },
  'Băng': { name: 'Huyền Băng Linh Căn', fx: { dr: 0.06, failKeep: 0.04 }, mech: 'Đóng băng tu vi: giữ thêm 4% tu vi khi đột phá thất bại.' },
  'Quang': { name: 'Thánh Quang Linh Căn', fx: { bt: 0.04, regen: 0.30, failKeep: 0.03 }, mech: 'Thánh quang soi đường: tăng tỉ lệ đột phá và giữ tu vi.' },
  'Ám': { name: 'Minh Ám Linh Căn', fx: { atk: 0.06, lifesteal: 0.04, crit: 0.02 }, mech: 'Hút hồn: hồi 4% sát thương gây ra trong Đấu Pháp.' },
  'Không Gian': { name: 'Hư Không Linh Căn', fx: { dodge: 0.06, loot: 0.10 }, mech: 'Hư không: né tránh và thu hoạch Bí Cảnh lớn hơn.' },
  'Thời Gian': { name: 'Thời Quang Linh Căn', fx: { tu: 0.08, proc: 0.03 }, mech: 'Thời quang: tu luyện nhanh hơn và có cơ hội nhân đôi tu vi.' },
  'Sinh Mệnh': { name: 'Thương Sinh Linh Căn', fx: { hp: 0.08, regen: 0.80 }, mech: 'Thương sinh: hồi sinh mệnh cực nhanh.' },
  'Hủy Diệt': { name: 'Diệt Thế Linh Căn', fx: { atk: 0.08, critMult: 0.20, def: -0.02 }, mech: 'Diệt thế: bạo kích gây sát thương khủng khiếp, đổi lại phòng ngự giảm.' },
  'Hỗn Độn': { name: 'Hỗn Độn Nguyên Linh Căn', fx: { atk: 0.04, def: 0.04, hp: 0.04, tu: 0.04, loot: 0.05 }, mech: 'Nguyên sơ: mọi mặt cùng nhỉnh hơn.' },
};

// ------------------------------------------------------------------ cộng hưởng Thể Chất × Linh Căn (hiếm, có điều kiện rõ ràng)
const RESONANCES = [
  { id: 'thiennhan', name: 'Thiên Nhân Cộng Hưởng', cond: 'Tiên Thiên Đạo Thể (≥ Đại Thành) + Thiên Linh Căn (đã thức tỉnh)', desc: 'Dễ lĩnh ngộ đạo pháp.',
    test: (p) => p.tc.idx === 4 && p.lc.idx === 4 && p.tc.stage >= 3 && p.lc.awaken >= 1, fx: { ngo: 0.05, absorb: 0.06, bt: 0.02 } },
  { id: 'kimthan', name: 'Kim Thân Bất Hoại', cond: 'Hoang Cổ Thánh Thể (≥ Đại Thành) + linh căn hành Kim (đã thức tỉnh)', desc: 'Phòng ngự và sức mạnh thân thể tăng.',
    test: (p) => p.tc.idx === 3 && p.lc.roots.includes('Kim') && p.tc.stage >= 3 && p.lc.awaken >= 1, fx: { def: 0.04, hp: 0.03 } },
  { id: 'hondon', name: 'Hỗn Độn Cộng Hưởng', cond: 'Hỗn Độn Thần Thể (≥ Đại Thành) + Hỗn Độn Linh Căn (đã thức tỉnh)', desc: 'Mở khóa diễn sinh hỗn độn.',
    test: (p) => p.tc.idx === 6 && p.lc.idx === 8 && p.tc.stage >= 3 && p.lc.awaken >= 1, fx: { proc: 0.03, tu: 0.04 } },
  { id: 'hongmong', name: 'Hồng Mông Tiên Duyên', cond: 'Hồng Mông Đạo Thể (≥ Đại Thành) + Tiên Linh Căn (đã thức tỉnh)', desc: 'Cơ duyên đầy mình.',
    test: (p) => p.tc.idx === 5 && p.lc.idx === 7 && p.tc.stage >= 3 && p.lc.awaken >= 1, fx: { loot: 0.06, bt: 0.02 } },
  { id: 'vocuc', name: 'Vô Cực Hỗn Nguyên', cond: 'Vô Cực Đạo Thể (Viên Mãn) + Hỗn Độn Linh Căn (thức tỉnh Lần III)', desc: 'Cộng hưởng tối thượng — rất khó đạt.',
    test: (p) => p.tc.idx === 7 && p.lc.idx === 8 && p.tc.stage >= 4 && p.lc.awaken >= 3, fx: { atk: 0.02, def: 0.02, hp: 0.02, tu: 0.04 } },
  { id: 'phamthien', name: 'Phàm Tâm Thiên Căn', cond: 'Phàm Thể (≥ Tiểu Thành) + Thiên Linh Căn (đã thức tỉnh)', desc: 'Tâm phàm mà căn thiên: đại khí vãn thành.',
    test: (p) => p.tc.idx === 0 && p.lc.idx === 4 && p.tc.stage >= 2 && p.lc.awaken >= 1, fx: { tu: 0.03, bt: 0.01 } },
];

// ------------------------------------------------------------------ điều kiện thức tỉnh / tiến hóa
const TC_AWAKEN = [   // index 0 = lên giai đoạn 1 (Thức Tỉnh) ...
  { realm: 2, prog: 10, bao: 1, truyen: 0, thach: 100000, rate: 0.90 },
  { realm: 4, prog: 40, bao: 2, truyen: 0, thach: 500000, rate: 0.75 },
  { realm: 6, prog: 100, bao: 3, truyen: 1, thach: 3000000, rate: 0.60 },
  { realm: 8, prog: 200, bao: 5, truyen: 2, thach: 10000000, rate: 0.45 },
];
const LC_AWAKEN = [
  { realm: 1, prog: 20, bao: 1, truyen: 0, thach: 50000, rate: 0.95, purity: 10 },
  { realm: 3, prog: 80, bao: 2, truyen: 0, thach: 300000, rate: 0.80, purity: 12 },
  { realm: 5, prog: 200, bao: 3, truyen: 1, thach: 2000000, rate: 0.65, purity: 15 },
];
const TC_EVOLVE = { stage: 4, realm: 7, bao: 10, truyen: 5, thach: 20000000, rate: 0.15, pityStep: 0.03, pityCap: 0.30 };
const LC_EVOLVE = { awaken: 3, purity: 85, realm: 7, prog: 500, bao: 8, truyen: 3, thach: 10000000, rate: 0.20, pityStep: 0.03, pityCap: 0.30 };
const EXCHANGE = { thien_dao_thach: { per: 40, gives: 'bao_the_chat', label: 'Thiên Đạo Thạch' }, dao_nguyen_tinh: { per: 40, gives: 'bao_linh_can', label: 'Đạo Nguyên Tinh' } };

// ------------------------------------------------------------------ tiện ích ngẫu nhiên xác định
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
function seeded(str) { let a = hashStr(str) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const tierIndex = (list, name) => Math.max(0, list.findIndex((t) => t.name === name));
const tcIdx = (name) => tierIndex(K.THE_CHAT, name);
const lcIdx = (name) => tierIndex(K.LINH_CAN, name);
function shuffle(arr, rng) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** Sinh danh sách hành theo phẩm cấp linh căn: số gốc giảm dần từ Ngũ (5) → Thiên (1); Dị/Thánh/Tiên/Hỗn Độn có hành đặc biệt. */
function rollRoots(idx, rng) {
  if (idx <= 4) return shuffle(NGU_HANH, rng).slice(0, [5, 4, 3, 2, 1][idx]);
  if (idx === 5) return [DI_THUOC_TINH[Math.floor(rng() * DI_THUOC_TINH.length)]];
  if (idx === 6) { const pool = [...NGU_HANH, ...DI_THUOC_TINH]; return [pool[Math.floor(rng() * pool.length)]]; }
  if (idx === 7) { const pool = DAC_THU.filter((e) => e !== 'Hỗn Độn'); return [pool[Math.floor(rng() * pool.length)]]; }
  return ['Hỗn Độn'];
}
/** Độ tinh khiết 1–100, phân phối tam giác (đỉnh ở 50) — ĐỘC LẬP với phẩm cấp linh căn và thể chất. */
const rollPurity = (rng) => clamp(Math.round((rng() + rng()) * 50), 1, 100);
function rollLinhCan(tierName, rng = Math.random) { const idx = lcIdx(tierName); return { hanh: rollRoots(idx, rng), purity: rollPurity(rng) }; }

// ------------------------------------------------------------------ hồ sơ
const parseRoots = (s) => String(s || '').split(',').map((x) => x.trim()).filter((x) => ALL_ELEMENTS.includes(x));
const cache = new WeakMap();

/** Hồ sơ chuẩn hoá của một hàng cultivators. Thiếu dữ liệu / lệch phẩm cấp → suy ra xác định từ user_id (không ghi DB). */
function profile(row) {
  if (!row) return null;
  const hit = cache.get(row); if (hit) return hit;
  const uid = String(row.user_id);
  const tcName = row.the_chat; const lcName = row.linh_can;
  const tcOk = row.the_chat_tier === tcName;
  const lcOk = row.linh_can_tier === lcName;
  const tc = { name: tcName, idx: tcIdx(tcName), stage: 0, prog: 0, variant: '', pity: 0 };
  if (tcOk) {
    tc.stage = clamp(Number(row.the_chat_stage) || 0, 0, 4); tc.prog = Math.max(0, Number(row.the_chat_prog) || 0);
    tc.pity = Math.max(0, Number(row.the_chat_pity) || 0);
    tc.variant = VARIANTS.some((v) => v.name === row.the_chat_bien_di) ? row.the_chat_bien_di : '';
  }
  const lc = { name: lcName, idx: lcIdx(lcName), roots: [], purity: 50, awaken: 0, prog: 0, evolution: '', pity: 0 };
  const stored = parseRoots(row.linh_can_hanh);
  if (lcOk && stored.length) {
    lc.roots = stored; lc.purity = clamp(Number(row.linh_can_purity) || 50, 1, 100);
    lc.awaken = clamp(Number(row.linh_can_awaken) || 0, 0, 3); lc.prog = Math.max(0, Number(row.linh_can_prog) || 0);
    lc.pity = Math.max(0, Number(row.linh_can_pity) || 0);
    lc.evolution = Object.values(EVOLUTIONS).some((e) => e.name === row.linh_can_tienhoa) ? row.linh_can_tienhoa : '';
  } else {
    const d = rollLinhCan(lcName, seeded(`${uid}|${lcName}|lc`));
    lc.roots = d.hanh; lc.purity = d.purity;
  }
  lc.primary = lc.roots[0] || 'Hỗn Độn';
  lc.dilution = DILUTION[Math.min(5, Math.max(1, lc.roots.length))];
  const p = { tc, lc, realm: Math.max(0, Number(row.realm_index) || 0) };
  cache.set(row, p);
  return p;
}


// ------------------------------------------------------------------ cột DB của hồ sơ (dùng khi tạo mới / đồng bộ / đổi phẩm cấp)
const tcFields = (name) => ({ the_chat_tier: name, the_chat_stage: 0, the_chat_prog: 0, the_chat_bien_di: '', the_chat_pity: 0 });
const lcFields = (name, rng = Math.random) => {
  const d = rollLinhCan(name, rng);
  return { linh_can_tier: name, linh_can_hanh: d.hanh.join(','), linh_can_purity: d.purity, linh_can_awaken: 0, linh_can_prog: 0, linh_can_tienhoa: '', linh_can_pity: 0 };
};
const TC_COLS = ['the_chat_tier', 'the_chat_stage', 'the_chat_prog', 'the_chat_bien_di', 'the_chat_pity'];
const LC_COLS = ['linh_can_tier', 'linh_can_hanh', 'linh_can_purity', 'linh_can_awaken', 'linh_can_prog', 'linh_can_tienhoa', 'linh_can_pity'];
/** Cột cần ghi để hồ sơ lưu trong DB khớp phẩm cấp hiện tại ({} nếu đã khớp). Giá trị lấy từ profile() nên KHỚP đúng thứ người chơi đang thấy. */
function syncFields(row) {
  const p = profile(row); const out = {};
  if (row.the_chat_tier !== row.the_chat) Object.assign(out, tcFields(row.the_chat));
  if (row.linh_can_tier !== row.linh_can || !parseRoots(row.linh_can_hanh).length) {
    Object.assign(out, { linh_can_tier: row.linh_can, linh_can_hanh: p.lc.roots.join(','), linh_can_purity: p.lc.purity, linh_can_awaken: 0, linh_can_prog: 0, linh_can_tienhoa: '', linh_can_pity: 0 });
  }
  return out;
}

// ------------------------------------------------------------------ gói hiệu ứng
const purityScale = (p) => 0.6 + 0.4 * (p / 100);               // 0.6 .. 1.0  (nhân hiệu ứng thuộc tính)
const purityTu = (p) => 0.85 + 0.30 * (p / 100);                // 0.85 .. 1.15 (trung bình 1.0 — không phá cân bằng)
const purityAbsorb = (p) => 0.8 + 0.4 * (p / 100);              // 0.8 .. 1.2

function evolvedOf(lc) { return Object.entries(EVOLUTIONS).find(([, e]) => e.name === lc.evolution) || null; }
function add(out, src, fx, scale = 1) { for (const [k, v] of Object.entries(fx)) out[k] = (out[k] || 0) + v * scale; if (src) src.push(fx); }

/** Gói hiệu ứng đang hoạt động (đã chặn trần) + danh sách mô tả từng nguồn. */
function bundle(row) {
  const hit = cache.get(row); if (hit && hit.bundle) return hit.bundle;
  const p = profile(row);
  const out = {}; const sources = [];
  const cpx = require('./cpfx').routeFx(row);      // v16: hiệu ứng công pháp mới (absorb/ngo/regen/loot/bt/dodge/dr/pierce/crit/critMult/lifesteal) — dùng chung trần với Thể Chất/Linh Căn
  if (!p) {
    const z = { sources, raw: {}, ...Object.fromEntries(Object.keys(CAPS).map((k) => [k, 0])) };
    for (const [k, v] of Object.entries(cpx)) if (k in CAPS) z[k] = Math.min(CAPS[k], v);
    return z;
  }
  const S = STAGE_MULT[p.tc.stage]; const awF = LC_AWAKEN_MULT[p.lc.awaken]; const pS = purityScale(p.lc.purity);
  // 1) thiên phú thể chất
  const talent = THECHAT_TALENTS[p.tc.idx];
  if (talent) { const fx = talent.fx(S, { realm: p.realm }); add(out, null, fx); sources.push({ kind: 'Thiên phú', name: talent.name, fx }); }
  // 2) biến dị thể chất
  if (p.tc.variant) { const v = VARIANTS.find((x) => x.name === p.tc.variant); if (v) { add(out, null, v.fx); sources.push({ kind: 'Biến dị', name: v.name, fx: v.fx }); } }
  // 3) thuộc tính linh căn (ưu thế + hạn chế) — chỉ hành chủ đạo, loãng theo số hành, nhân độ tinh khiết & thức tỉnh
  const tr = ELEMENT_TRAITS[p.lc.primary];
  if (tr) { const fx = {}; for (const [k, v] of Object.entries(tr.fx)) fx[k] = v * p.lc.dilution * awF * pS; add(out, null, fx); sources.push({ kind: 'Thuộc tính', name: `${p.lc.primary} (${ELEMENT_KIND(p.lc.primary)})`, fx }); }
  // 4) nhánh tiến hóa linh căn
  const ev = evolvedOf(p.lc);
  if (ev) { const fx = {}; for (const [k, v] of Object.entries(ev[1].fx)) fx[k] = v * pS; add(out, null, fx); sources.push({ kind: 'Tiến hóa', name: ev[1].name, fx }); }
  // 5) cộng hưởng
  for (const r of RESONANCES) if (r.test(p)) { add(out, null, r.fx); sources.push({ kind: 'Cộng hưởng', name: r.name, fx: r.fx }); }
  // 5b) v16: công pháp mới đang trang bị
  if (Object.keys(cpx).length) { add(out, null, cpx); sources.push({ kind: 'Công Pháp', name: 'Công Pháp V16 đang trang bị', fx: { ...cpx } }); }
  // 6) độ tinh khiết: dùng trực tiếp ở tuluyenFactor / absorb — không cộng vào mọi chỉ số.
  const b = { sources, raw: { ...out } };
  for (const k of Object.keys(CAPS)) {
    const lo = k === 'regen' ? -0.5 : -0.10;
    b[k] = clamp(out[k] || 0, lo, CAPS[k]);
  }
  const entry = cache.get(row) || {}; entry.bundle = b; cache.set(row, Object.assign(p, { bundle: b }));
  return b;
}

/** Nhân độ tinh khiết lên tốc độ tu luyện (trung bình 1.0). */
const tuluyenPurity = (row) => { const p = profile(row); return p ? purityTu(p.lc.purity) : 1; };
const absorbMult = (row) => { const p = profile(row); if (!p) return 1; return purityAbsorb(p.lc.purity) * (1 + bundle(row).absorb); };

// ------------------------------------------------------------------ chiến đấu / công pháp / boss
/** Hệ số nhân chỉ số chiến đấu (đã chặn trần) từ Thể Chất + Linh Căn. */
const statMult = (row, stat) => 1 + bundle(row)[stat];
/** Lợi thế tương khắc: attacker có hành khắc hành chủ đạo của defender → +4% sức mạnh (loãng theo số hành, nhân thức tỉnh). */
function elementAdv(rowX, rowY) {
  const x = profile(rowX); const y = profile(rowY); if (!x || !y) return 0;
  const target = y.lc.primary;
  return x.lc.roots.some((r) => KHAC[r] === target) ? 0.04 * x.lc.dilution * LC_AWAKEN_MULT[x.lc.awaken] : 0;
}
/** Thành phần chiến đấu cho Đấu Pháp / Chiến Tông Môn (roundAction). */
function combatMods(row) {
  const b = bundle(row);
  const x = require('./fx17').get(row);   // v17: trang bị / đan / trận pháp (đã chặn trần)
  return { crit: b.crit + x.crit, critMult: b.critMult, dodge: b.dodge + x.dodge, dr: b.dr + x.dr, pierce: b.pierce + x.pierce, lifesteal: b.lifesteal + x.lifesteal };
}
// v16: công pháp mới (tier ≥ 1001) có hành CỐ ĐỊNH theo loại (data/congphap_v16.js); công pháp cũ giữ công thức cũ.
const congphapElement = (tier) => {
  const nb = require('../data/congphap_v16').BY_TIER.get(Number(tier));
  if (nb) return nb.element;
  return NGU_HANH[((Number(tier) || 1) - 1 + 5) % 5];
};
/** Độ hợp công pháp đang trang bị với linh căn: nhân lên tổng bonus công pháp (0.92 – 1.12). */
function cpAffinity(row, tiers) {
  const p = profile(row); if (!p) return 1;
  let m = 0;
  if (tiers && tiers.length) {
    let s = 0;
    for (const t of tiers) {
      const e = congphapElement(t); let best = -0.5;
      for (const r of p.lc.roots) {
        let sc = 0;
        if (e === 'Ngũ Hành') sc = 0.7; else if (e === 'Hỗn Nguyên') sc = 0.3;     // v16: quyển Ngũ Hành hợp mọi linh căn, quyển Toàn diện hợp vừa phải
        else if (r === e) sc = 1; else if (SINH[r] === e || SINH[e] === r) sc = 0.5; else if (KHAC[e] === r) sc = -0.5;
        else if (r === 'Hỗn Độn') sc = 0.3;
        if (sc > best) best = sc;
      }
      s += (p.lc.roots.length ? best : 0);
    }
    m = s / tiers.length;
  }
  const f = 1 + 0.12 * m * p.lc.dilution * purityScale(p.lc.purity) + ((p.lc.purity - 50) / 50) * 0.03;
  return clamp(f, 0.92, 1.12);
}
/** Nguyên tố của Boss Thế Giới theo cấp độ (xác định). */
const bossElement = (tier) => ALL_ELEMENTS[((Number(tier) || 1) * 3) % ALL_ELEMENTS.length];
/** Hệ số sát thương lên Boss: hành mình khắc hành boss +5%, bị boss khắc −5% (chỉ Ngũ Hành). */
function bossElemMult(row, tier) {
  const p = profile(row); if (!p) return 1;
  const be = bossElement(tier);
  if (p.lc.roots.some((r) => KHAC[r] === be)) return 1 + 0.05 * p.lc.dilution;
  if (p.lc.roots.some((r) => KHAC[be] === r)) return 1 - 0.05 * p.lc.dilution;
  return 1;
}

// ------------------------------------------------------------------ mô tả hiển thị
const TC_RANK = (idx) => `${idx + 1}/${K.THE_CHAT.length}`;
const LC_RANK = (idx) => `${idx + 1}/${K.LINH_CAN.length}`;
const mult = (list, name) => { const t = list.find((x) => x.name === name); return t ? t.mult : 1; };
const fxLines = (fx) => Object.entries(fx).filter(([, v]) => Math.abs(v) > 1e-9).map(([k, v]) => `• ${fmtFx(k, v)}`);
/** Dòng ngắn cho màn hình Tổng Quan. */
const shortTheChat = (row) => { const p = profile(row); return `${row.the_chat}${p.tc.variant ? ` ✦ ${p.tc.variant}` : ''} · ${STAGE_NAMES[p.tc.stage]}`; };
const shortLinhCan = (row) => { const p = profile(row); const nm = p.lc.evolution || row.linh_can; return `${nm} · ${p.lc.roots.length > 1 ? `${p.lc.roots.length} hành` : p.lc.primary} · ${p.lc.purity}%`; };

module.exports = {
  NGU_HANH, DI_THUOC_TINH, DAC_THU, ALL_ELEMENTS, ELEMENT_KIND, SINH, KHAC, STAGE_NAMES, STAGE_MULT, LC_AWAKEN_NAMES, LC_AWAKEN_MULT, DILUTION, CAPS, LABEL,
  THECHAT_TALENTS, VARIANTS, ELEMENT_TRAITS, EVOLUTIONS, RESONANCES, TC_AWAKEN, LC_AWAKEN, TC_EVOLVE, LC_EVOLVE, EXCHANGE,
  seeded, rollLinhCan, rollPurity, rollRoots, tcIdx, lcIdx, profile, bundle, tuluyenPurity, purityScale, purityTu, purityAbsorb, absorbMult, statMult, elementAdv, combatMods,
  tcFields, lcFields, syncFields, TC_COLS, LC_COLS, congphapElement, cpAffinity, bossElement, bossElemMult, TC_RANK, LC_RANK, mult, fxLines, fmtFx, shortTheChat, shortLinhCan, evolvedOf,
};
