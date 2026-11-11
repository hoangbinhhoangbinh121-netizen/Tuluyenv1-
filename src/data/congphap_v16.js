'use strict';
/**
 * CÔNG PHÁP V16 — 40 công pháp mới (dữ liệu CỐ ĐỊNH, không qua Gemini, không xoay vòng, không đổi sau khi khởi động lại).
 *
 * Tương thích kho cũ: sở hữu / trang bị / cấp nâng vẫn lưu ở cong_phap_owned / cong_phap_slots / cong_phap_levels dạng SỐ NGUYÊN,
 * nên công pháp mới dùng `tier` số nguyên 1001..1040 (không đụng 1–7, 101, 102, 201). `id` chuỗi (cp_...) là định danh phụ, duy nhất.
 *
 * Hiệu ứng (`fx`) tính ĐÚNG MỘT LẦN, KHÔNG cộng vào cong_phap_bonus/cpScale cũ (xem game/cpfx.js):
 *   atk/def/hp/spd  → cộng vào hệ số chỉ số theo từng chỉ số (Cu.cpScaleFor)
 *   tu              → nhân tu vi nhận được (Tu Luyện / Bế Quan / Treo / Bí Cảnh) — công pháp cũ vẫn dùng effectiveCongPhapBonus
 *   boss            → sát thương lên Boss Thế Giới
 *   absorb ngo regen loot bt dodge dr pierce crit critMult lifesteal → gộp vào talent.bundle (dùng chung trần với Thể Chất/Linh Căn)
 */

const GROUPS = {
  nhan: { key: 'nhan', label: 'Công Pháp Nhân Giới', short: 'Nhân Giới', icon: '🌱', world: 0 },
  linh: { key: 'linh', label: 'Công Pháp Linh Giới', short: 'Linh Giới', icon: '🔮', world: 1 },
  tien: { key: 'tien', label: 'Công Pháp Tiên Giới', short: 'Tiên Giới', icon: '☁️', world: 2 },
  doc: { key: 'doc', label: 'Công Pháp Đặc Biệt (độc quyền)', short: 'Đặc Biệt', icon: '🌟', world: 0 },
};
const GROUP_ORDER = ['nhan', 'linh', 'tien', 'doc'];

const CATS = {
  tu: { label: 'Tu luyện', icon: '🧘', element: 'Mộc' },
  luyenthe: { label: 'Luyện thể', icon: '💪', element: 'Thổ' },
  loi: { label: 'Lôi pháp', icon: '⚡', element: 'Kim' },
  bang: { label: 'Băng pháp', icon: '❄️', element: 'Thủy' },
  am: { label: 'Âm pháp', icon: '🌙', element: 'Thủy' },
  than: { label: 'Thân pháp', icon: '🌪️', element: 'Mộc' },
  nguhanh: { label: 'Ngũ Hành', icon: '☯️', element: 'Ngũ Hành', affinityBoost: 2.5 },
  hoa: { label: 'Hỏa pháp', icon: '🔥', element: 'Hỏa' },
  sinhco: { label: 'Sinh cơ', icon: '🌿', element: 'Mộc' },
  tho: { label: 'Thổ pháp', icon: '⛰️', element: 'Thổ' },
  kiem: { label: 'Kiếm đạo', icon: '🗡️', element: 'Kim' },
  toanien: { label: 'Toàn diện', icon: '🌀', element: 'Hỗn Nguyên' },
  phongngu: { label: 'Phòng ngự', icon: '🛡️', element: 'Thổ' },
};
const CAT_ORDER = Object.keys(CATS);

/** Phẩm cấp hiển thị (quy ước mới của V16). */
const PHAM = ['Hoàng Phẩm', 'Huyền Phẩm', 'Địa Phẩm', 'Thiên Phẩm', 'Tiên Phẩm', 'Thần Phẩm', 'Hỗn Độn Phẩm'];

const FX_LABEL = {
  atk: 'Công kích', def: 'Phòng ngự', hp: 'Sinh mệnh', spd: 'Thân pháp (tốc độ)', tu: 'Tu vi nhận được', boss: 'Sát thương lên Boss',
  absorb: 'Hấp thu linh khí', ngo: 'Tỉ lệ Ngộ đạo', regen: 'Hồi Sinh Mệnh', loot: 'Thu hoạch Bí Cảnh', bt: 'Tỉ lệ Đột Phá',
  dodge: 'Né tránh (Đấu Pháp)', dr: 'Giảm sát thương nhận (Đấu Pháp)', pierce: 'Xuyên giáp (Đấu Pháp)', crit: 'Bạo kích (Đấu Pháp)',
  critMult: 'Sát thương bạo kích', lifesteal: 'Hút máu (Đấu Pháp)',
  luc: 'Lực Chiến', proc: 'Cơ hội Tu Luyện nhân đôi', failKeep: 'Giữ tu vi khi Đột Phá thất bại', kiepDmg: 'Giảm sát thương Lôi Kiếp', kiepDodge: 'Né Lôi Kiếp', thach: 'Linh Thạch thu từ Bí Cảnh',
};
/** Khoá nào tính ở đâu (xem game/cpfx.js). */
const STAT_KEYS = ['atk', 'def', 'hp', 'spd'];
const ROUTE_KEYS = ['absorb', 'ngo', 'regen', 'loot', 'bt', 'dodge', 'dr', 'pierce', 'crit', 'critMult', 'lifesteal', 'proc', 'failKeep', 'kiepDmg', 'kiepDodge', 'thach'];
/** Trần của TỔNG hiệu ứng công pháp mới (cộng cả 3 quyển, đã nhân cấp). */
const FX_CAP = {   // v16.2: nâng trần chỉ số/tu vi (để 3 quyển mới thực sự vượt công pháp cũ); các hiệu ứng route còn bị chặn thêm bởi CAPS của talent.js
  atk: 4.5, def: 4.5, hp: 5.4, spd: 4.0, tu: 8.0, boss: 2.5, luc: 3.0,
  absorb: 0.30, ngo: 0.06, regen: 1.2, loot: 0.15, bt: 0.04, dodge: 0.08, dr: 0.08, pierce: 0.10, crit: 0.07, critMult: 0.15, lifesteal: 0.06,
  proc: 0.08, failKeep: 0.10, kiepDmg: 0.45, kiepDodge: 0.12, thach: 0.60,
};

// ----- nâng cấp -----
const MAX_LEVEL = 100;
const LEVEL_FX_GROWTH = 0.018;       // fx(level) = fx × (1 + 0.018 × level) → tối đa ×2,8 ở cấp 100 (v16.4: tầng cao mạnh hơn; v16.0–16.3 = 0,012) (rồi chặn bởi FX_CAP)
const LEVEL_PVP_STEP = 0.0025;       // buff/debuff đấu pháp cộng thêm mỗi cấp (công pháp cũ: 0,01/cấp)
/** Khung chi phí: [cấp tối đa của khung, hệ số khung] — chi phí cấp L = ceil(base × hệ số × (1 + 0,02 × vị trí trong khung)). */
const UP_BRACKETS = [[10, 1], [20, 1.6], [40, 2.6], [60, 4.2], [80, 6.8], [100, 11]];
const UP_BRACKETS_LT = [[10, 0.5], [20, 0.5], [40, 1], [60, 1.5], [80, 2], [100, 3]];   // Linh Tinh (hiếm) → hệ số nhẹ hơn
const BRACKET_LABEL = ['1–10', '11–20', '21–40', '41–60', '61–80', '81–100'];

// ----- khuôn chiêu thức theo loại (4 chiêu / quyển; chiêu 1 nhẹ → chiêu 4 tuyệt kỹ) -----
// dmg = nhân sát thương đòn đó (công pháp cũ: 1,15) · pierce = xuyên giáp riêng đòn này · crit = bạo kích thêm đòn này
// heal = hồi sinh mệnh (≈ heal × 40 điểm trên thanh 100) · guard = [giảm sát thương nhận, số đòn] · weaken = [giảm sát thương đối thủ gây ra, số đòn] · dodge = [né thêm, số đòn]
const ARCH = {
  tu: [{ dmg: 1.15, heal: 0.10 }, { guard: [0.20, 2] }, { heal: 0.18, dmg: 1.15 }, { dmg: 1.25, heal: 0.15, guard: [0.15, 1] }],
  luyenthe: [{ guard: [0.20, 2] }, { guard: [0.25, 2], dmg: 1.15 }, { dmg: 1.20, heal: 0.12 }, { guard: [0.35, 2], heal: 0.20 }],
  loi: [{ dmg: 1.25 }, { crit: 0.15, dmg: 1.20 }, { dmg: 1.30, pierce: 0.10 }, { dmg: 1.45, pierce: 0.15, crit: 0.10 }],
  bang: [{ dmg: 1.15, weaken: [0.12, 2] }, { guard: [0.20, 2] }, { weaken: [0.20, 2], dmg: 1.15 }, { dmg: 1.30, weaken: [0.25, 3] }],
  am: [{ dmg: 1.20, heal: 0.08 }, { weaken: [0.15, 2] }, { dmg: 1.25, weaken: [0.18, 2], heal: 0.10 }, { dmg: 1.40, weaken: [0.25, 2], heal: 0.15 }],
  than: [{ dodge: [0.15, 2], dmg: 1.15 }, { crit: 0.15, dmg: 1.20 }, { dodge: [0.25, 2] }, { dmg: 1.35, dodge: [0.20, 2], crit: 0.10 }],
  nguhanh: [{ dmg: 1.20 }, { guard: [0.15, 2], heal: 0.08 }, { dmg: 1.25, pierce: 0.08 }, { dmg: 1.35, guard: [0.15, 1], weaken: [0.12, 1] }],
  hoa: [{ dmg: 1.25 }, { dmg: 1.20, crit: 0.12 }, { dmg: 1.30, pierce: 0.08 }, { dmg: 1.45, crit: 0.12, pierce: 0.10 }],
  sinhco: [{ heal: 0.15, dmg: 1.15 }, { guard: [0.15, 2], heal: 0.10 }, { heal: 0.22 }, { heal: 0.25, guard: [0.20, 2], dmg: 1.20 }],
  tho: [{ guard: [0.20, 2] }, { dmg: 1.15, guard: [0.20, 2] }, { guard: [0.30, 2], weaken: [0.10, 1] }, { dmg: 1.25, guard: [0.30, 2] }],
  kiem: [{ dmg: 1.25, pierce: 0.06 }, { dmg: 1.20, crit: 0.15 }, { dmg: 1.30, pierce: 0.12 }, { dmg: 1.45, pierce: 0.18, crit: 0.10 }],
  toanien: [{ dmg: 1.20, heal: 0.08 }, { guard: [0.18, 2], dodge: [0.10, 2] }, { dmg: 1.28, pierce: 0.08, crit: 0.08 }, { dmg: 1.38, heal: 0.12, guard: [0.18, 1], weaken: [0.12, 1] }],
  phongngu: [{ guard: [0.22, 2] }, { guard: [0.28, 2], heal: 0.10 }, { dmg: 1.18, guard: [0.28, 2], weaken: [0.12, 1] }, { guard: [0.38, 3], heal: 0.18 }],
};
/** Trần mỗi thông số chiêu (sau khi nhân hệ số sk của quyển). */
const SKILL_CAP = { dmg: 1.75, pierce: 0.25, crit: 0.25, heal: 0.30, guard: [0.45, 3], weaken: [0.30, 3], dodge: [0.30, 3] };

/**
 * Dòng dữ liệu: [tier, id, tên, mô tả, nhóm, loại, phẩm, require_realm, require_world, tiền, giá|null, pvp_buff, pvp_debuff, sk, fx, 4 tên chiêu, 4 lời dẫn chiêu]
 * Công Pháp Nhân Giới: require_world 0 (Phàm Giới) · Linh Giới: require_world 1 · Tiên Giới: require_world 2.
 */
const RAW = [
  // ============ A. NHÂN GIỚI — mua bằng Linh Thạch ============
  [1001, 'cp_thanh_nguyen_duong_khi', 'Thanh Nguyên Dưỡng Khí Quyết', 'Dẫn khí trời đất vào đan điền, dễ nhập môn — tu vi nhận được tăng ổn định ở giai đoạn đầu.', 'nhan', 'tu', 0, 0, 0, 'linh_thach', 30000, 0.03, 0.02, 0.85,
    { tu: 0.18, absorb: 0.04 }, ['Thanh Nguyên Dẫn Khí', 'Dưỡng Khí Hộ Thân', 'Nguyên Khí Hồi Xuân', 'Thanh Nguyên Quy Tàng'], ['Dẫn thanh khí vào kinh mạch, đánh nhẹ rồi hồi sinh lực', 'Khí quanh thân thành màn chắn mỏng', 'Hấp khí hồi sinh lực giữa trận', 'Quy tụ nguyên khí, một đòn kèm hồi phục']],
  [1002, 'cp_huyen_duong_luyen_the', 'Huyền Dương Luyện Thể Công', 'Lấy dương khí tôi luyện xương thịt, thiên về sức chống chịu: HP và phòng ngự tăng vững chắc.', 'nhan', 'luyenthe', 0, 1, 0, 'linh_thach', 45000, 0.03, 0.02, 0.85,
    { hp: 0.12, def: 0.10, tu: 0.04 }, ['Huyền Dương Hộ Thể', 'Kim Thân Trấn Mạch', 'Bất Động Như Sơn', 'Huyền Dương Bất Diệt'], ['Dương khí bọc thân giảm sát thương', 'Kim thân vững mạch, vừa thủ vừa phản', 'Đứng yên như núi, đòn mạnh hồi sức', 'Dương khí bất diệt, hộ thân và hồi sinh lực']],
  [1003, 'cp_tu_tieu_dan_loi', 'Tử Tiêu Dẫn Lôi Quyết', 'Dẫn tử lôi từ chín tầng mây giáng xuống, thiên về công kích và hiệu quả đấu pháp.', 'nhan', 'loi', 0, 1, 0, 'linh_thach', 60000, 0.05, 0.02, 0.85,
    { atk: 0.12, crit: 0.01, tu: 0.04 }, ['Tử Tiêu Lôi Châm', 'Dẫn Lôi Nhập Thể', 'Cửu Thiên Lôi Động', 'Tử Tiêu Diệt Thế'], ['Lôi châm xuyên giáp tuyến mảnh', 'Lôi điện tụ vào kiếm chỉ, dễ bạo kích', 'Lôi động chín tầng, đòn xuyên giáp', 'Tử lôi giáng xuống, đòn mạnh nhất quyển']],
  [1004, 'cp_cuu_chuyen_nguong_khi', 'Cửu Chuyển Ngưng Khí Quyết', 'Chín lần vận chuyển ngưng tụ linh khí — tập trung vào tốc độ phát triển, tích lũy tu vi nhanh.', 'nhan', 'tu', 0, 2, 0, 'linh_thach', 90000, 0.03, 0.02, 0.9,
    { tu: 0.28, bt: 0.005 }, ['Cửu Chuyển Khai Mạch', 'Ngưng Khí Thành Cương', 'Chu Thiên Vận Hành', 'Cửu Chuyển Công Thành'], ['Chuyển khí khai mạch, đánh nhẹ hồi sức', 'Khí ngưng thành cương hộ thân', 'Chu thiên vận hành, hồi sinh lực mạnh', 'Chín chuyển đại thành, đòn mạnh kèm hộ thể']],
  [1005, 'cp_huyen_bang_ngoc_tam', 'Huyền Băng Ngọc Tâm Kinh', 'Tâm như băng ngọc: tăng phòng ngự và làm đối thủ chậm chạp, suy yếu trong đấu pháp.', 'nhan', 'bang', 1, 2, 0, 'linh_thach', 130000, 0.03, 0.06, 0.9,
    { def: 0.12, tu: 0.04 }, ['Huyền Băng Phong Thủ', 'Ngọc Tâm Hộ Pháp', 'Hàn Khí Tỏa Hồn', 'Băng Phong Vạn Lý'], ['Hàn khí đóng băng, đối thủ yếu đi', 'Ngọc tâm dựng màn băng giảm sát thương', 'Hàn khí tỏa hồn, đối thủ suy yếu sâu', 'Băng phong vạn lý, đòn mạnh làm đối thủ suy kiệt']],
  [1006, 'cp_thien_phong_than_phap', 'Thiên Phong Thân Pháp', 'Thân nhẹ như gió: tăng tốc độ và khả năng né tránh.', 'nhan', 'than', 1, 3, 0, 'linh_thach', 180000, 0.04, 0.03, 0.9,
    { spd: 0.16, dodge: 0.01, tu: 0.04 }, ['Phong Hành Bộ', 'Thiên Phong Ảnh', 'Loạn Phong Bộ', 'Thiên Phong Vô Ảnh'], ['Bước theo gió, né thêm và đánh nhanh', 'Ảnh thân khó bắt, đòn dễ bạo kích', 'Loạn phong bộ, né mạnh hơn', 'Vô ảnh vô hình, đòn mạnh kèm né tránh']],
  [1007, 'cp_ngu_hanh_quy_nguyen', 'Ngũ Hành Quy Nguyên Công', 'Quy nguyên ngũ hành: cộng đều các chỉ số, phát huy mạnh khi linh căn tương hợp.', 'nhan', 'nguhanh', 1, 3, 0, 'linh_thach', 260000, 0.05, 0.04, 0.9,
    { atk: 0.05, def: 0.05, hp: 0.05, spd: 0.05, tu: 0.08 }, ['Ngũ Hành Tương Sinh', 'Quy Nguyên Hộ Thể', 'Ngũ Hành Tương Khắc', 'Ngũ Hành Hợp Nhất'], ['Ngũ hành sinh nhau, đòn đều đặn', 'Quy nguyên hộ thể, hồi nhẹ', 'Ngũ hành tương khắc, đòn xuyên giáp', 'Hợp nhất ngũ hành, đòn mạnh kèm hộ thể']],
  [1008, 'cp_xich_viem_phan_thien', 'Xích Viêm Phần Thiên Quyết', 'Xích viêm thiêu đốt trời đất: tăng công kích và buff tự thân khi đấu pháp.', 'nhan', 'hoa', 1, 4, 0, 'linh_thach', 360000, 0.08, 0.03, 0.95,
    { atk: 0.16, tu: 0.04 }, ['Xích Viêm Phá', 'Phần Thiên Hỏa Vũ', 'Liệt Diễm Phần Tâm', 'Xích Viêm Phần Thiên'], ['Ngọn lửa đỏ mở màn', 'Hỏa vũ rơi, dễ bạo kích', 'Liệt diễm thiêu giáp', 'Phần thiên diệt địa, đòn mạnh nhất']],
  [1009, 'cp_thanh_moc_truong_sinh', 'Thanh Mộc Trường Sinh Kinh', 'Sinh cơ vô tận của cây xanh: tăng HP và khả năng hồi phục.', 'nhan', 'sinhco', 1, 4, 0, 'linh_thach', 480000, 0.04, 0.02, 0.95,
    { hp: 0.16, regen: 0.15, tu: 0.04 }, ['Thanh Mộc Hồi Xuân', 'Sinh Cơ Bất Tuyệt', 'Mộc Linh Trị Thương', 'Trường Sinh Đại Pháp'], ['Hồi xuân, đòn nhẹ kèm hồi sinh lực', 'Sinh cơ bọc thân', 'Mộc linh trị thương mạnh', 'Trường sinh đại pháp: hồi mạnh + hộ thể']],
  [1010, 'cp_dai_dia_tran_nguyen', 'Đại Địa Trấn Nguyên Công', 'Mượn sức đại địa trấn giữ nguyên khí: tăng phòng ngự và khả năng chống chịu.', 'nhan', 'tho', 1, 5, 0, 'linh_thach', 650000, 0.04, 0.03, 1.0,
    { def: 0.16, hp: 0.08, dr: 0.01, tu: 0.04 }, ['Đại Địa Hộ Thân', 'Thạch Giáp Thuật', 'Trấn Nguyên Chấn', 'Đại Địa Bất Động'], ['Đất đá bọc thân', 'Thạch giáp vừa thủ vừa phản', 'Chấn địa, thủ cứng và làm đối thủ yếu', 'Địa mạch bất động, đòn mạnh kèm thủ vững']],

  // ============ B. LINH GIỚI — mua bằng Linh Tinh ============
  [1011, 'cp_thai_hu_tu_linh', 'Thái Hư Tụ Linh Quyết', 'Thu nạp linh khí thiên địa chuyển hóa thành tu vi: tăng hiệu quả tu luyện rõ rệt.', 'linh', 'tu', 2, 2, 1, 'linh_tinh', 3, 0.05, 0.03, 1.0,
    { tu: 0.40, absorb: 0.06 }, ['Thái Hư Dẫn Khí', 'Tụ Linh Thành Hải', 'Vạn Khí Quy Nguyên', 'Thái Hư Vô Cực'], ['Dẫn khí thái hư, đòn nhẹ kèm hồi sức', 'Tụ linh thành màn khí', 'Vạn khí quy nguyên, hồi sinh lực mạnh', 'Thái hư vô cực, đòn mạnh kèm hộ thể']],
  [1012, 'cp_hu_khong_kiem_dien', 'Hư Không Kiếm Điển', 'Kiếm ý xé rách hư không: tăng mạnh công kích, có hiệu quả đặc biệt xuyên giáp trong đấu pháp.', 'linh', 'kiem', 2, 3, 1, 'linh_tinh', 5, 0.10, 0.05, 1.0,
    { atk: 0.22, pierce: 0.015, tu: 0.06 }, ['Hư Không Kiếm Khí', 'Liệt Không Trảm', 'Vạn Kiếm Xuyên Hư', 'Nhất Kiếm Phá Hư'], ['Kiếm khí xuyên hư không', 'Liệt không trảm, dễ bạo kích', 'Vạn kiếm xuyên hư, xuyên giáp mạnh', 'Nhất kiếm phá hư, tuyệt kỹ của quyển']],
  [1013, 'cp_cuu_u_minh_the', 'Cửu U Minh Thể Kinh', 'Lấy âm khí cửu u rèn thể: HP và phòng ngự dồi dào, thiên về sinh tồn.', 'linh', 'luyenthe', 2, 4, 1, 'linh_tinh', 8, 0.06, 0.04, 1.0,
    { hp: 0.22, def: 0.18, regen: 0.2, tu: 0.06 }, ['Minh Thể Hộ Thân', 'U Minh Bất Diệt', 'Cửu U Trấn Hồn', 'Cửu U Minh Thể'], ['Minh khí bọc thân giảm sát thương', 'Bất diệt: thủ vững, đòn kèm hồi sức', 'Trấn hồn: đòn mạnh kèm hồi sinh lực', 'Cửu u minh thể: hộ thể + hồi sinh mạnh']],
  [1014, 'cp_thien_loi_diet_the', 'Thiên Lôi Diệt Thế Kinh', 'Thiên lôi diệt thế: tăng công kích và đặc biệt tăng hiệu quả tấn công Boss Thế Giới.', 'linh', 'loi', 2, 5, 1, 'linh_tinh', 12, 0.10, 0.04, 1.05,
    { atk: 0.24, boss: 0.18, crit: 0.015, tu: 0.06 }, ['Thiên Lôi Hạ Phàm', 'Diệt Thế Lôi Ấn', 'Lôi Đình Vạn Quân', 'Thiên Lôi Diệt Thế'], ['Thiên lôi hạ phàm', 'Lôi ấn bạo kích', 'Lôi đình vạn quân, xuyên giáp', 'Diệt thế thiên lôi, đòn mạnh nhất quyển']],
  [1015, 'cp_van_linh_duong_than', 'Vạn Linh Dưỡng Thần Quyết', 'Nuôi dưỡng thần thức bằng vạn linh: tăng hiệu quả tu luyện, hấp thu linh khí và ngộ đạo.', 'linh', 'tu', 2, 6, 1, 'linh_tinh', 18, 0.05, 0.04, 1.0,
    { tu: 0.45, absorb: 0.10, ngo: 0.01 }, ['Vạn Linh Tụ Thần', 'Dưỡng Thần Hộ Thể', 'Linh Hải Quy Tâm', 'Vạn Linh Dưỡng Thần'], ['Tụ thần, đòn nhẹ kèm hồi sức', 'Dưỡng thần dựng màn hộ thể', 'Linh hải quy tâm, hồi sinh lực mạnh', 'Vạn linh dưỡng thần: đòn mạnh kèm hộ thể']],
  [1016, 'cp_thai_am_nguong_nguyet', 'Thái Âm Ngưng Nguyệt Công', 'Ánh nguyệt thái âm ngưng tụ: tăng phòng ngự và làm đối thủ suy yếu trong đấu pháp.', 'linh', 'am', 3, 6, 1, 'linh_tinh', 24, 0.06, 0.12, 1.05,
    { def: 0.20, hp: 0.08, tu: 0.06 }, ['Thái Âm Nguyệt Quang', 'Ngưng Nguyệt Phong Ấn', 'Âm Nguyệt Tỏa Hồn', 'Thái Âm Ngưng Nguyệt'], ['Nguyệt quang chiếu rọi, hút nhẹ sinh lực', 'Phong ấn nguyệt làm đối thủ suy yếu', 'Tỏa hồn, đòn mạnh kèm suy yếu và hồi sức', 'Ngưng nguyệt: đòn mạnh nhất, đối thủ suy kiệt']],
  [1017, 'cp_kim_o_phan_thien', 'Kim Ô Phần Thiên Kinh', 'Kim ô hóa thân đốt cháy bầu trời: tăng công kích và hiệu quả buff tự thân.', 'linh', 'hoa', 3, 7, 1, 'linh_tinh', 32, 0.14, 0.05, 1.05,
    { atk: 0.22, hp: 0.06, tu: 0.06 }, ['Kim Ô Hỏa Vũ', 'Thái Dương Chân Hỏa', 'Kim Ô Phần Thiên', 'Kim Ô Diệt Thế'], ['Hỏa vũ kim ô', 'Chân hỏa, dễ bạo kích', 'Phần thiên, xuyên giáp', 'Kim ô diệt thế, bạo kích và xuyên giáp']],
  [1018, 'cp_huyen_thien_tran_nguc', 'Huyền Thiên Trấn Ngục Quyết', 'Trấn áp thiên ngục: tăng mạnh phòng ngự và HP.', 'linh', 'phongngu', 3, 8, 1, 'linh_tinh', 45, 0.07, 0.05, 1.1,
    { def: 0.24, hp: 0.22, dr: 0.015, tu: 0.06 }, ['Huyền Thiên Hộ Giáp', 'Trấn Ngục Ấn', 'Thiên Ngục Phong Tỏa', 'Huyền Thiên Trấn Ngục'], ['Hộ giáp huyền thiên', 'Trấn ngục ấn, vừa thủ vừa hồi', 'Phong tỏa thiên ngục', 'Trấn ngục: hộ thể + hồi sinh lực mạnh']],
  [1019, 'cp_can_khon_na_di', 'Càn Khôn Na Di Công', 'Dời càn khôn đổi vị trí: tăng mạnh tốc độ và khả năng né tránh.', 'linh', 'than', 3, 8, 1, 'linh_tinh', 60, 0.07, 0.05, 1.1,
    { spd: 0.28, dodge: 0.02, tu: 0.06 }, ['Càn Khôn Na Di', 'Hư Ảnh Phân Thân', 'Nhất Bộ Thiên Lý', 'Càn Khôn Vô Tung'], ['Na di vị trí, né và đánh nhanh', 'Phân thân hư ảnh, dễ bạo kích', 'Nhất bộ thiên lý, né mạnh', 'Vô tung vô ảnh: đòn mạnh kèm né tránh']],
  [1020, 'cp_van_kiem_trieu_tong', 'Vạn Kiếm Triều Tông Điển', 'Vạn kiếm triều tông: tăng mạnh công kích, thiên về đấu pháp và sát thương.', 'linh', 'kiem', 3, 9, 1, 'linh_tinh', 80, 0.12, 0.06, 1.1,
    { atk: 0.28, pierce: 0.02, critMult: 0.03, tu: 0.06 }, ['Triều Tông Kiếm Ý', 'Vạn Kiếm Quy Tông', 'Kiếm Vũ Cửu Thiên', 'Vạn Kiếm Triều Tông'], ['Kiếm ý triều tông', 'Vạn kiếm quy tông, bạo kích', 'Kiếm vũ cửu thiên, xuyên giáp', 'Vạn kiếm triều tông, tuyệt kỹ sát thương']],

  // ============ C. TIÊN GIỚI — mua bằng Linh Tinh ============
  [1021, 'cp_dai_la_tien_kinh', 'Đại La Tiên Kinh', 'Công pháp tu luyện cao cấp của Tiên Giới: tăng mạnh hiệu quả tu vi.', 'tien', 'tu', 4, 0, 2, 'linh_tinh', 60, 0.08, 0.05, 1.1,
    { tu: 0.65, absorb: 0.12 }, ['Đại La Dẫn Khí', 'Tiên Khí Quán Đỉnh', 'Đại La Quy Nhất', 'Đại La Vô Thượng'], ['Dẫn tiên khí, đòn nhẹ kèm hồi sức', 'Tiên khí quán đỉnh hộ thể', 'Đại La quy nhất, hồi mạnh', 'Vô thượng đại la: đòn mạnh kèm hộ thể']],
  [1022, 'cp_thai_thuong_vo_cuc', 'Thái Thượng Vô Cực Quyết', 'Công pháp toàn diện: tăng đồng đều các chỉ số tổng hợp.', 'tien', 'toanien', 4, 1, 2, 'linh_tinh', 90, 0.10, 0.08, 1.1,
    { atk: 0.10, def: 0.10, hp: 0.10, spd: 0.08, tu: 0.12 }, ['Thái Thượng Hiển Hóa', 'Vô Cực Hộ Thể', 'Thái Thượng Phá Giáp', 'Thái Thượng Vô Cực'], ['Hiển hóa thái thượng, hồi nhẹ', 'Vô cực hộ thể, né thêm', 'Phá giáp, bạo kích', 'Thái thượng vô cực: đòn mạnh kèm hộ thể']],
  [1023, 'cp_cuu_thien_tien_loi', 'Cửu Thiên Tiên Lôi Kinh', 'Tiên lôi chín tầng trời: thiên về công kích, tăng mạnh hiệu quả đánh Boss.', 'tien', 'loi', 4, 2, 2, 'linh_tinh', 130, 0.16, 0.07, 1.15,
    { atk: 0.34, boss: 0.28, crit: 0.02, tu: 0.08 }, ['Cửu Thiên Lôi Dẫn', 'Tiên Lôi Phá Giáp', 'Lôi Thần Giáng Thế', 'Cửu Thiên Tiên Lôi'], ['Lôi dẫn cửu thiên', 'Tiên lôi bạo kích', 'Lôi thần giáng thế, xuyên giáp', 'Cửu thiên tiên lôi, tuyệt kỹ']],
  [1024, 'cp_bat_diet_tien_the', 'Bất Diệt Tiên Thể Kinh', 'Tiên thể bất diệt: thiên về sinh tồn, tăng mạnh HP và phòng ngự.', 'tien', 'luyenthe', 4, 3, 2, 'linh_tinh', 180, 0.10, 0.07, 1.15,
    { hp: 0.34, def: 0.28, dr: 0.02, regen: 0.3, tu: 0.08 }, ['Tiên Thể Hộ Thân', 'Bất Diệt Kim Thân', 'Thiên Địa Bất Hoại', 'Bất Diệt Tiên Thể'], ['Tiên thể hộ thân', 'Kim thân bất diệt, thủ và hồi', 'Bất hoại, đòn kèm hồi sức', 'Bất diệt: hộ thể + hồi sinh rất mạnh']],
  [1025, 'cp_hon_nguyen_vo_cuc', 'Hỗn Nguyên Vô Cực Công', 'Công pháp cân bằng: tăng hiệu quả tổng hợp mọi mặt.', 'tien', 'toanien', 5, 4, 2, 'linh_tinh', 240, 0.11, 0.08, 1.15,
    { atk: 0.12, def: 0.12, hp: 0.12, spd: 0.10, tu: 0.15 }, ['Hỗn Nguyên Nhất Khí', 'Vô Cực Tương Sinh', 'Hỗn Nguyên Phá Pháp', 'Hỗn Nguyên Vô Cực'], ['Nhất khí hỗn nguyên', 'Vô cực tương sinh, hộ thể và né', 'Phá pháp, bạo kích', 'Hỗn nguyên vô cực: toàn diện']],
  [1026, 'cp_thoi_khong_tien_dien', 'Thời Không Tiên Điển', 'Nắm giữ thời không: thiên về tốc độ, hỗ trợ né tránh và hiệu ứng chiến đấu.', 'tien', 'than', 5, 5, 2, 'linh_tinh', 320, 0.12, 0.08, 1.2,
    { spd: 0.40, dodge: 0.03, crit: 0.015, tu: 0.08 }, ['Thời Không Chuyển Dịch', 'Quang Âm Bộ', 'Thời Gian Đình Trệ', 'Thời Không Tiên Điển'], ['Chuyển dịch thời không, né và đánh nhanh', 'Quang âm bộ, bạo kích', 'Đình trệ thời gian, né rất mạnh', 'Tiên điển thời không: đòn mạnh kèm né tránh']],
  [1027, 'cp_sinh_tu_luan_hoi', 'Sinh Tử Luân Hồi Kinh', 'Nắm giữ vòng sinh tử: tăng khả năng sinh tồn, có hút máu và hồi phục đặc biệt trong chiến đấu.', 'tien', 'sinhco', 5, 6, 2, 'linh_tinh', 420, 0.09, 0.09, 1.2,
    { hp: 0.30, regen: 0.4, lifesteal: 0.02, dr: 0.015, tu: 0.08 }, ['Sinh Tử Luân Chuyển', 'Luân Hồi Hộ Thể', 'Tử Sinh Nghịch Chuyển', 'Sinh Tử Luân Hồi'], ['Luân chuyển sinh tử, đòn kèm hồi', 'Luân hồi hộ thể', 'Nghịch chuyển, hồi rất mạnh', 'Sinh tử luân hồi: hồi + hộ thể + đòn']],
  [1028, 'cp_van_dao_quy_nhat', 'Vạn Đạo Quy Nhất Kinh', 'Vạn đạo quy về một: công pháp toàn diện, tương hợp linh căn rất mạnh.', 'tien', 'nguhanh', 5, 7, 2, 'linh_tinh', 560, 0.12, 0.09, 1.2,
    { atk: 0.12, def: 0.12, hp: 0.12, spd: 0.12, tu: 0.18 }, ['Vạn Đạo Hội Tụ', 'Quy Nhất Hộ Thể', 'Vạn Đạo Phá Chướng', 'Vạn Đạo Quy Nhất'], ['Vạn đạo hội tụ', 'Quy nhất hộ thể, hồi nhẹ', 'Phá chướng, xuyên giáp', 'Quy nhất: đòn mạnh + hộ thể + suy yếu đối thủ']],
  [1029, 'cp_thai_so_tien_nguyen', 'Thái Sơ Tiên Nguyên Quyết', 'Khởi nguyên thái sơ: tăng hiệu quả tu luyện và hiệu suất tích lũy tu vi.', 'tien', 'tu', 6, 8, 2, 'linh_tinh', 760, 0.09, 0.06, 1.25,
    { tu: 0.80, absorb: 0.15, bt: 0.01 }, ['Thái Sơ Dẫn Nguyên', 'Tiên Nguyên Hộ Thể', 'Thái Sơ Hồi Nguyên', 'Thái Sơ Tiên Nguyên'], ['Dẫn nguyên thái sơ', 'Tiên nguyên hộ thể', 'Hồi nguyên, hồi mạnh', 'Thái sơ tiên nguyên: đòn mạnh + hộ thể']],
  [1030, 'cp_thien_dao_chi_ton', 'Thiên Đạo Chí Tôn Kinh', 'Công pháp cực hiếm của Tiên Giới: tăng chỉ số tổng hợp, điều kiện sử dụng rất cao.', 'tien', 'toanien', 6, 9, 2, 'linh_tinh', 1100, 0.16, 0.12, 1.25,
    { atk: 0.16, def: 0.16, hp: 0.16, spd: 0.12, tu: 0.22 }, ['Thiên Đạo Chí Tôn', 'Chí Tôn Hộ Thân', 'Thiên Đạo Diệt Pháp', 'Thiên Đạo Vô Thượng'], ['Chí tôn giáng thế', 'Chí tôn hộ thân, né thêm', 'Diệt pháp, xuyên giáp + bạo kích', 'Thiên đạo vô thượng: tuyệt kỹ toàn diện']],

  // ============ D. ĐỘC QUYỀN — không bán ở Cửa Hàng ============
  [1031, 'cp_cuu_tieu_than_loi', 'Cửu Tiêu Thần Lôi Quyết', 'Thần lôi cửu tiêu — rơi từ Boss Thế Giới. Thiên về công kích, đánh Boss cực mạnh.', 'doc', 'loi', 4, 4, 0, 'linh_thach', null, 0.14, 0.06, 1.05,
    { atk: 0.30, boss: 0.22, pierce: 0.02, crit: 0.02, tu: 0.06 }, ['Cửu Tiêu Lôi Động', 'Thần Lôi Phá Thiên', 'Lôi Hải Cuồng Triều', 'Cửu Tiêu Thần Lôi'], ['Lôi động cửu tiêu', 'Thần lôi bạo kích', 'Lôi hải cuồng triều, xuyên giáp', 'Cửu tiêu thần lôi, tuyệt kỹ']],
  [1032, 'cp_thai_co_long_tuong', 'Thái Cổ Long Tượng Công', 'Sức mạnh long tượng thái cổ — rơi từ Bí Cảnh Thượng Cổ. Thiên về luyện thể.', 'doc', 'luyenthe', 5, 6, 0, 'linh_thach', null, 0.10, 0.05, 1.1,
    { hp: 0.30, def: 0.22, atk: 0.10, dr: 0.02, tu: 0.06 }, ['Long Tượng Hộ Thể', 'Tượng Lực Chấn Sơn', 'Long Ngâm Chấn Địa', 'Thái Cổ Long Tượng'], ['Long tượng hộ thể', 'Tượng lực chấn sơn, thủ và đánh', 'Long ngâm chấn địa, đòn kèm hồi', 'Thái cổ long tượng: hộ thể + hồi mạnh']],
  [1033, 'cp_van_co_truong_sinh', 'Vạn Cổ Trường Sinh Kinh', 'Trường sinh vạn cổ — chỉ có thể gặp qua Kỳ Ngộ. Thiên về sinh tồn.', 'doc', 'sinhco', 5, 3, 1, 'linh_tinh', null, 0.10, 0.06, 1.1,
    { hp: 0.34, regen: 0.5, dr: 0.015, lifesteal: 0.02, tu: 0.08 }, ['Trường Sinh Hồi Xuân', 'Vạn Cổ Bất Hủ', 'Sinh Cơ Cuồn Cuộn', 'Vạn Cổ Trường Sinh'], ['Hồi xuân trường sinh', 'Bất hủ hộ thể', 'Sinh cơ cuồn cuộn, hồi rất mạnh', 'Vạn cổ trường sinh: hồi + hộ thể']],
  [1034, 'cp_hu_thien_don_phap', 'Hư Thiên Độn Pháp', 'Độn hư không thiên — rơi từ Bí Cảnh Linh Giới. Thiên về tốc độ.', 'doc', 'than', 5, 7, 1, 'linh_tinh', null, 0.12, 0.06, 1.15,
    { spd: 0.36, dodge: 0.03, crit: 0.015, tu: 0.08 }, ['Hư Thiên Độn Ảnh', 'Không Hành Thuật', 'Độn Thiên Vô Tung', 'Hư Thiên Độn Pháp'], ['Độn ảnh hư thiên', 'Không hành, bạo kích', 'Độn thiên vô tung, né mạnh', 'Hư thiên độn pháp: né + đòn mạnh']],
  [1035, 'cp_cuu_u_diet_hon', 'Cửu U Diệt Hồn Kinh', 'Diệt hồn cửu u — rơi từ Boss hoặc Bí Cảnh Đặc Biệt. Thiên về đấu pháp.', 'doc', 'am', 5, 6, 1, 'linh_tinh', null, 0.13, 0.13, 1.15,
    { atk: 0.26, pierce: 0.025, lifesteal: 0.02, tu: 0.08 }, ['Cửu U Hồn Trảo', 'Diệt Hồn Chú', 'U Minh Phệ Hồn', 'Cửu U Diệt Hồn'], ['Hồn trảo, hút nhẹ sinh lực', 'Diệt hồn chú, đối thủ suy yếu', 'Phệ hồn, đòn kèm suy yếu và hồi', 'Diệt hồn: đòn mạnh nhất, suy yếu và hồi']],
  [1036, 'cp_thai_so_hon_don', 'Thái Sơ Hỗn Độn Kinh', 'Hỗn độn thái sơ — chỉ gặp qua Kỳ Ngộ cấp cao. Công pháp tổng hợp.', 'doc', 'toanien', 6, 8, 1, 'linh_tinh', null, 0.14, 0.10, 1.2,
    { atk: 0.14, def: 0.14, hp: 0.14, spd: 0.12, tu: 0.20 }, ['Hỗn Độn Sơ Khai', 'Thái Sơ Hộ Thể', 'Hỗn Độn Phá Pháp', 'Thái Sơ Hỗn Độn'], ['Hỗn độn sơ khai', 'Thái sơ hộ thể, né thêm', 'Phá pháp, bạo kích', 'Thái sơ hỗn độn: toàn diện']],
  [1037, 'cp_vo_thuong_kiem_dao', 'Vô Thượng Kiếm Đạo Kinh', 'Kiếm đạo vô thượng — rơi từ Boss Thế Giới cấp cao. Thiên về công kích.', 'doc', 'kiem', 6, 2, 2, 'linh_tinh', null, 0.18, 0.08, 1.25,
    { atk: 0.38, pierce: 0.03, critMult: 0.05, boss: 0.15, tu: 0.08 }, ['Vô Thượng Kiếm Ý', 'Kiếm Đạo Chí Cao', 'Nhất Kiếm Đoạn Thiên', 'Vô Thượng Kiếm Đạo'], ['Kiếm ý vô thượng', 'Chí cao kiếm đạo, bạo kích', 'Nhất kiếm đoạn thiên, xuyên giáp', 'Vô thượng kiếm đạo, tuyệt kỹ']],
  [1038, 'cp_thien_ha_tinh_than', 'Thiên Hà Tinh Thần Quyết', 'Tinh thần thiên hà — rơi từ Bí Cảnh Linh Giới. Thiên về tu luyện.', 'doc', 'tu', 6, 3, 2, 'linh_tinh', null, 0.10, 0.07, 1.25,
    { tu: 0.90, absorb: 0.15, ngo: 0.02, loot: 0.05 }, ['Tinh Hà Dẫn Khí', 'Thiên Hà Hộ Thể', 'Tinh Thần Hồi Nguyên', 'Thiên Hà Tinh Thần'], ['Dẫn tinh hà, đòn kèm hồi', 'Thiên hà hộ thể', 'Tinh thần hồi nguyên, hồi mạnh', 'Thiên hà tinh thần: đòn mạnh + hộ thể']],
  [1039, 'cp_can_khon_tran_gioi', 'Càn Khôn Trấn Giới Kinh', 'Càn khôn trấn giới — phát trong Sự Kiện Đặc Biệt (admin). Thiên về phòng ngự.', 'doc', 'phongngu', 5, 0, 1, 'linh_tinh', null, 0.10, 0.10, 1.2,
    { def: 0.36, hp: 0.30, dr: 0.03, tu: 0.08 }, ['Càn Khôn Hộ Giới', 'Trấn Giới Ấn', 'Càn Khôn Phong Tỏa', 'Càn Khôn Trấn Giới'], ['Hộ giới càn khôn', 'Trấn giới ấn, thủ và hồi', 'Phong tỏa càn khôn', 'Trấn giới: hộ thể + hồi mạnh']],
  [1040, 'cp_vo_cuc_thien_dao', 'Vô Cực Thiên Đạo Kinh', 'Thiên đạo vô cực — chỉ có thể gặp qua Kỳ Ngộ cực hiếm. Công pháp độc quyền cấp cao nhất của nhóm mới.', 'doc', 'toanien', 6, 5, 2, 'linh_tinh', null, 0.18, 0.14, 1.3,
    { atk: 0.20, def: 0.20, hp: 0.20, spd: 0.15, tu: 0.28, boss: 0.10 }, ['Vô Cực Thiên Đạo', 'Thiên Đạo Hộ Thân', 'Vô Cực Phá Hư', 'Thiên Đạo Vô Cực'], ['Vô cực thiên đạo', 'Thiên đạo hộ thân, né thêm', 'Phá hư, xuyên giáp + bạo kích', 'Thiên đạo vô cực: tuyệt kỹ toàn diện']],
];

const SHOP_CAP = 0;   // (giữ chỗ) không giới hạn số lượng mua — mỗi quyển chỉ mua được 1 lần (không mua trùng)

function upBase(price, currency) {
  if (!price) return currency === 'linh_tinh' ? 2 : 20000;
  return currency === 'linh_tinh' ? Math.max(1, Math.round(price / 12)) : Math.max(1500, Math.round(price * 0.06));
}

// Công pháp độc quyền không có giá bán → chi phí nâng cấp tính theo "giá tham chiếu" tương đương cấp bậc của nó (không để quyển hiếm nâng cấp rẻ hơn quyển thường).
const EXCL_REF = { 1031: 800000, 1032: 1000000, 1033: 90, 1034: 100, 1035: 110, 1036: 200, 1037: 400, 1038: 500, 1039: 90, 1040: 1200 };
// ----- v16.2: tăng chỉ số / tốc độ tu luyện / thêm loại hiệu ứng -----
// Bảng RAW giữ số gốc; hệ số dưới đây nhân lên khi dựng sách (đổi 1 chỗ, không phải sửa 40 dòng). stat = atk/def/hp/spd · tu = tu vi nhận được · route = các hiệu ứng khác.
const GROUP_SCALE = {
  nhan: { stat: 2.2, tu: 2.8, route: 1.5, pvp: 2.2 },
  linh: { stat: 2.0, tu: 3.2, route: 1.5, pvp: 2.2 },
  tien: { stat: 1.9, tu: 2.9, route: 1.4, pvp: 2.6 },
  doc: { stat: 2.0, tu: 2.6, route: 1.4, pvp: 2.6 },
};
const MULTI_STAT_BONUS = 2.8;      // quyển cộng đều ≥ 3 chỉ số (Ngũ Hành / Toàn diện): nhân thêm để vượt các công pháp cũ cộng đều (Tầng 7, 101, 102, 201)
const MULTI_TU_BONUS = 3.0;        // …và tu vi nhận được của quyển đa chỉ số
const SIDE_TU_BONUS = 1.6;         // quyển chuyên 1 chỉ số: phần tu vi kèm theo
const SKILL_POWER_BONUS = 0.08;    // chiêu thức mạnh hơn nhẹ (sk += 0,08)
/** Hiệu ứng "kiểu mới" theo loại công pháp (ở phẩm Hoàng; nhân (1 + 0,3 × phẩm)). Tất cả đều có hook thật trong game (xem talent.js / dotpha.js / actionsBasic.js / bicanh.js). */
const CAT_EXTRA = {
  tu: { proc: 0.012, thach: 0.06 }, luyenthe: { kiepDmg: 0.04, failKeep: 0.012 }, loi: { kiepDmg: 0.03, thach: 0.05 },
  bang: { kiepDodge: 0.012, kiepDmg: 0.03 }, am: { proc: 0.010, lifesteal: 0.008 }, than: { kiepDodge: 0.015, thach: 0.04 },
  nguhanh: { thach: 0.06, failKeep: 0.012, bt: 0.004 }, hoa: { thach: 0.04, proc: 0.008 }, sinhco: { failKeep: 0.012, kiepDmg: 0.03 },
  tho: { kiepDmg: 0.05, thach: 0.05 }, kiem: { thach: 0.04, kiepDodge: 0.010 }, toanien: { thach: 0.06, failKeep: 0.012, proc: 0.008 },
  phongngu: { kiepDmg: 0.05, failKeep: 0.012 },
};
const r3 = (v) => Math.round(v * 1000) / 1000;
function buffFx(fx, cat, group, pham) {
  const g = GROUP_SCALE[group]; const out = {};
  const statN = STAT_KEYS.filter((k) => fx[k]).length;
  const multi = statN >= 3 ? MULTI_STAT_BONUS : 1;
  for (const [k, v] of Object.entries(fx)) {
    if (STAT_KEYS.includes(k)) out[k] = r3(v * g.stat * multi);
    else if (k === 'tu') out[k] = r3(v * g.tu * (statN >= 3 ? MULTI_TU_BONUS : (cat === 'tu' ? 1 : SIDE_TU_BONUS)));
    else if (k === 'boss') out[k] = r3(v * g.stat);
    else out[k] = r3(v * g.route);
  }
  const lv = 1 + 0.3 * pham;
  for (const [k, v] of Object.entries(CAT_EXTRA[cat] || {})) out[k] = r3((out[k] || 0) + v * lv * g.route);
  return out;
}
// ----- v16.2b: SÀN SỨC MẠNH — quyển độc quyền & Tiên Giới ("xịn") luôn vượt công pháp cũ, bất kể loại -----
// Công pháp cũ (chỉ số = bonus × 0,4; tu vi = bonus): Tầng 7 = 0,44 / 1,10 · 101 = 0,52 / 1,30 · 102 = 0,62 / 1,55 · 201 = 0,80 / 2,00 · buff Đấu Pháp tối đa 0,55 / 0,42.
// stat = sàn cho MỖI chỉ số mà quyển có cộng · tu = sàn tu vi (quyển Tu Luyện đã cao hơn nên không bị ảnh hưởng) · buff/debuff = sàn Đấu Pháp · sk = cộng thêm sức mạnh chiêu.
const FLOORS = {
  linh: { stat: () => 0.54, tu: () => 0, buff: () => 0, debuff: () => 0, sk: 0 },
  tien: { stat: (i) => 0.66 + 0.035 * i, tu: (i) => 0.60 + 0.12 * i, buff: (i) => 0.36 + 0.01 * i, debuff: (i) => 0.26 + 0.01 * i, sk: 0.05 },
  doc: { stat: (i, ph) => 0.88 + 0.05 * ph + 0.03 * i, tu: (i, ph) => 2.15 + 0.1 * ph + 0.05 * i, buff: (i, ph) => 0.60 + 0.02 * ph, debuff: (i, ph) => 0.45 + 0.02 * ph, sk: 0.12 },
};
const idxInGroup = {};
const BOOKS = RAW.map((r) => {
  const [tier, id, name, desc, group, cat, pham, require_realm, require_world, currency, cost, pvp_buff0, pvp_debuff0, sk0, fx0, sn, sd] = r;
  const arch = ARCH[cat];
  const gi = idxInGroup[group] = (idxInGroup[group] === undefined ? 0 : idxInGroup[group] + 1);
  const fx = buffFx(fx0, cat, group, pham);
  let sk = r3(sk0 + SKILL_POWER_BONUS);
  let pvp_buff = r3(pvp_buff0 * GROUP_SCALE[group].pvp); let pvp_debuff = r3(pvp_debuff0 * GROUP_SCALE[group].pvp);
  const F = FLOORS[group];
  if (F) {
    for (const k of STAT_KEYS) if (fx[k]) fx[k] = r3(Math.max(fx[k], F.stat(gi, pham)));
    if (F.tu(gi, pham) && fx.tu !== undefined) fx.tu = r3(Math.max(fx.tu, F.tu(gi, pham)));
    pvp_buff = r3(Math.max(pvp_buff, F.buff(gi, pham))); pvp_debuff = r3(Math.max(pvp_debuff, F.debuff(gi, pham)));
    sk = r3(sk + F.sk);
  }
  // v16.4: hiệu ứng LỰC CHIẾN (+% vào Lực Chiến tổng, tính 1 lần trong calcLucChien) — theo trung bình các chỉ số quyển cộng (quyển Tu Luyện thuần: theo tu vi)
  { const sv = STAT_KEYS.filter((k) => fx[k]).map((k) => fx[k]); const mean = sv.length ? sv.reduce((x, y) => x + y, 0) / sv.length : 0;
    fx.luc = r3((mean > 0 ? 0.5 * mean : 0.18 * (fx.tu || 0)) * (group === 'doc' ? 1.25 : group === 'tien' ? 1.1 : 1)); }
  return Object.freeze({
    tier, id, name, desc, group, cat, pham, phamName: PHAM[pham], require_realm, require_world, currency, cost, shop: cost !== null,
    pvp_buff, pvp_debuff, fx: Object.freeze({ ...fx }), sk, element: CATS[cat].element,
    up_base: upBase(cost === null ? EXCL_REF[tier] : cost, currency), up_currency: currency,
    skills: Object.freeze(sn.map((n, i) => Object.freeze({ name: n, flavor: sd[i], pos: i + 1, base: arch[i] }))),
  });
});
const BY_TIER = new Map(BOOKS.map((b) => [b.tier, b]));
const BY_ID = new Map(BOOKS.map((b) => [b.id, b]));
const BY_SKILL = new Map();
for (const b of BOOKS) for (const s of b.skills) BY_SKILL.set(s.name, { book: b, skill: s });

// ----- Mảnh bí tịch (hợp thành công pháp độc quyền) -----
const FRAGMENTS = [
  { id: 'manh_cuu_tieu', name: 'Mảnh Cửu Tiêu Thần Lôi Quyết', book: 1031, need: 20, icon: '⚡' },
  { id: 'manh_long_tuong', name: 'Mảnh Thái Cổ Long Tượng Công', book: 1032, need: 20, icon: '🐉' },
  { id: 'manh_hu_thien', name: 'Mảnh Hư Thiên Độn Pháp', book: 1034, need: 20, icon: '🌪️' },
  { id: 'manh_diet_hon', name: 'Mảnh Cửu U Diệt Hồn Kinh', book: 1035, need: 20, icon: '🌙' },
  { id: 'manh_vo_thuong', name: 'Mảnh Vô Thượng Kiếm Đạo Kinh', book: 1037, need: 30, icon: '🗡️' },
  { id: 'manh_thien_ha', name: 'Mảnh Thiên Hà Tinh Thần Quyết', book: 1038, need: 25, icon: '🌌' },
];
const FRAG_BY_ID = new Map(FRAGMENTS.map((f) => [f.id, f]));

/**
 * Bảng nguồn rơi (xem game/cpSources.js). chance = xác suất mỗi lần.
 *  book: rơi thẳng công pháp · pool: bốc ngẫu nhiên 1 quyển chưa sở hữu, đủ điều kiện, trong nhóm đó · frag: [id, chance, [min,max]]
 */
const SOURCES = {
  bicanh_thuong: { chance: [0.012, 0.018, 0.026, 0.035], pool: 'nhan' },                       // theo bậc Bí Cảnh (Sơ/Trung/Cao/Vạn Linh Cốc)
  bicanh_dacbiet: { book: [[1035, 0.03]], frag: [['manh_diet_hon', 0.25, [1, 2]]] },           // Bí Cảnh Đặc Biệt (Vé)
  bicanh_thuongco: { pool: ['linh', 0.04], book: [[1032, 0.02]], frag: [['manh_long_tuong', 0.30, [1, 2]]] },   // Bí Cảnh Thượng Cổ = chuỗi Độ Kiếp của Linh Giới
  bicanh_linhgioi: { pool: ['linh', 0.025], book: [[1034, 0.012, 'hopthe'], [1038, 0.008, 'daithua']], frag: [['manh_hu_thien', 0.18, [1, 1], 'hopthe'], ['manh_thien_ha', 0.18, [1, 1], 'daithua']] },
  boss_killer: { book: [[1031, 0.015], [1035, 0.008], [1037, 0.012, 6]] },                     // người kết liễu (số thứ ba = cấp Boss tối thiểu)
  boss_contrib: { frag: [['manh_cuu_tieu', 0.30, [1, 2]], ['manh_diet_hon', 0.10, [1, 1]], ['manh_vo_thuong', 0.25, [1, 2], 6]] },   // người đóng góp ≥ 2% sát thương
  kyngo: { thuong: { chance: 0.02 }, hiem: { chance: 0.005 }, cao: { chance: 0.0025 }, cuc_hiem: { chance: 0.0008 } },   // mỗi lần Cảm Ngộ (hồi 30 phút)
  event: { book: [1039] },
};
const KYNGO_BOOK = { hiem: 1033, cao: 1036, cuc_hiem: 1040 };
const CHAIN_ORDER = ['luyenhu', 'hopthe', 'daithua', 'dokiep'];

const SOURCE_TEXT = {
  1031: 'Boss Thế Giới (người kết liễu 1,5%) · Mảnh Cửu Tiêu (người đóng góp ≥ 2% sát thương)',
  1032: 'Bí Cảnh Thượng Cổ (chuỗi Độ Kiếp Linh Giới, 2%/lần) · Mảnh Thái Cổ Long Tượng',
  1033: 'Kỳ Ngộ hiếm (Cảm Ngộ)',
  1034: 'Bí Cảnh Linh Giới từ Hợp Thể (1,2%/lần) · Mảnh Hư Thiên Độn Pháp',
  1035: 'Boss Thế Giới (người kết liễu 0,8%) · Bí Cảnh Đặc Biệt (3%/lần) · Mảnh Cửu U Diệt Hồn',
  1036: 'Kỳ Ngộ cấp cao (Cảm Ngộ)',
  1037: 'Boss Thế Giới cấp cao (cấp 6+, người kết liễu 1,2%) · Mảnh Vô Thượng Kiếm Đạo',
  1038: 'Bí Cảnh Linh Giới từ Đại Thừa (0,8%/lần) · Mảnh Thiên Hà Tinh Thần',
  1039: 'Sự Kiện Đặc Biệt (admin phát / mã code)',
  1040: 'Kỳ Ngộ cực hiếm (Cảm Ngộ)',
};
function sourcesOf(b) {
  if (b.shop) {
    const s = ['Cửa Hàng'];
    if (b.group === 'nhan') s.push('Bí Cảnh thường (rơi ngẫu nhiên)');
    if (b.group === 'linh') s.push('Bí Cảnh Linh Giới / Thượng Cổ (rơi ngẫu nhiên)');
    return s.join(' · ');
  }
  return SOURCE_TEXT[b.tier] || '—';
}

module.exports = {
  GROUPS, GROUP_ORDER, CATS, CAT_ORDER, PHAM, FX_LABEL, STAT_KEYS, ROUTE_KEYS, FX_CAP, MAX_LEVEL, LEVEL_FX_GROWTH, LEVEL_PVP_STEP,
  UP_BRACKETS, UP_BRACKETS_LT, BRACKET_LABEL, ARCH, SKILL_CAP, BOOKS, BY_TIER, BY_ID, BY_SKILL, FRAGMENTS, FRAG_BY_ID, SOURCES,
  KYNGO_BOOK, CHAIN_ORDER, SOURCE_TEXT, sourcesOf, SHOP_CAP,
};
