'use strict';
/**
 * DỮ LIỆU NGHỀ NGHIỆP v17 — 4 nghề · 9 cấp · công thức · sản phẩm · trận pháp · trang bị · Linh Điền · bảng rơi · NPC bán.
 * Mọi con số cân bằng nằm ở đây. Tất cả hiệu ứng sản phẩm đi vào game/fx17.js (có TRẦN) rồi mới chạm chỉ số nhân vật.
 */
const K = require('../game/constants');

// ===================================================================== NGHỀ & CẤP BẬC
const PROFS = {
  dan: { id: 'dan', name: 'Đan Sư', icon: '💊', desc: 'Luyện Dược Dịch và 16 loại đan dược: tu vi, hồi phục, đột phá, buff chiến đấu, Độ Kiếp.' },
  khi: { id: 'khi', name: 'Luyện Khí Sư', icon: '⚒️', desc: 'Tinh luyện khoáng vật, đúc Phôi Khí rồi rèn 8 loại pháp khí 7 ô trang bị. Cường hoá · Tinh luyện · Phân giải · Sửa chữa.' },
  tran: { id: 'tran', name: 'Trận Pháp Sư', icon: '🔯', desc: 'Khắc Trận Văn rồi dựng 7 loại trận pháp triển khai thật ở tu luyện, Bí Cảnh, Boss, PvP, Tông Môn.' },
  thuc: { id: 'thuc', name: 'Linh Thực Sư', icon: '🌱', desc: 'Mở Linh Điền, gieo Linh Chủng, tưới, bón, thu hoạch Linh Dược (có biến dị) — nguồn dược liệu ổn định cho Đan Sư.' },
};
const PROF_ORDER = ['dan', 'khi', 'tran', 'thuc'];

/** 9 cấp. exp: EXP nghề tối thiểu · crafts: số lần chế tối thiểu · fee: Linh Thạch thăng cấp · realm: cảnh giới tối thiểu (điều kiện PHỤ cho cấp cao). */
const LEVELS = [
  { lv: 1, name: 'Học Đồ', exp: 0, crafts: 0, fee: 0, realm: 0, batch: 1 },
  { lv: 2, name: 'Sơ Cấp', exp: 100, crafts: 8, fee: 5000, realm: 0, batch: 2 },
  { lv: 3, name: 'Trung Cấp', exp: 450, crafts: 25, fee: 30000, realm: 1, batch: 3 },
  { lv: 4, name: 'Cao Cấp', exp: 1400, crafts: 60, fee: 150000, realm: 2, batch: 3 },
  { lv: 5, name: 'Đại Sư', exp: 4000, crafts: 120, fee: 700000, realm: 3, batch: 4 },
  { lv: 6, name: 'Tông Sư', exp: 10000, crafts: 220, fee: 3000000, realm: 5, batch: 4 },
  { lv: 7, name: 'Đại Tông Sư', exp: 25000, crafts: 380, fee: 12000000, realm: 6, batch: 5 },
  { lv: 8, name: 'Thánh Sư', exp: 60000, crafts: 600, fee: 50000000, realm: 8, batch: 5 },
  { lv: 9, name: 'Đế Sư', exp: 140000, crafts: 900, fee: 200000000, realm: 9, batch: 5 },
];
/** Số ô chế tạo đồng thời của 1 nghề theo cấp. */
const slotsOf = (lv) => (lv >= 7 ? 3 : lv >= 4 ? 2 : 1);

// ===================================================================== KỸ THUẬT (mở theo cấp, hiệu ứng thật trong engine chế tạo)
// fx: succ = +tỉ lệ thành công · time = −thời gian chế · qup = dịch phẩm chất lên · dbl = xác suất ×2 sản phẩm · save = xác suất hoàn 1 nguyên liệu mỗi loại
//     enh = +tỉ lệ cường hoá/tinh luyện · upk = −chi phí duy trì trận · grow = −thời gian sinh trưởng · mut = +biến dị · seed = +thu hồi hạt giống · yield = +sản lượng
const TECHS = {
  dan: [
    { id: 'dan_hoa_hau', name: 'Hỏa Hầu Tinh Thông', lv: 2, fx: { succ: 0.02 }, desc: '+2% tỉ lệ thành công mọi công thức Đan Sư.' },
    { id: 'dan_nhanh_lo', name: 'Cấp Hỏa Tốc Luyện', lv: 4, fx: { time: 0.10 }, desc: '−10% thời gian luyện.' },
    { id: 'dan_van_hoa', name: 'Vân Hóa Đan Văn', lv: 6, fx: { qup: 0.06, succ: 0.02 }, desc: 'Dễ ra phẩm chất cao hơn, +2% thành công.' },
    { id: 'dan_song_dan', name: 'Song Đan Hợp Nhất', lv: 8, fx: { dbl: 0.08 }, desc: '8% ra gấp đôi số đan.' },
  ],
  khi: [
    { id: 'khi_luyen_kim', name: 'Luyện Kim Thuật', lv: 2, fx: { succ: 0.02 }, desc: '+2% tỉ lệ thành công mọi công thức Luyện Khí.' },
    { id: 'khi_tiet_kiem', name: 'Tiết Liệu Thuật', lv: 4, fx: { save: 0.10 }, desc: '10% hoàn lại 1 nguyên liệu mỗi loại khi chế.' },
    { id: 'khi_cuong_hoa', name: 'Cường Hoá Bí Pháp', lv: 6, fx: { enh: 0.05, qup: 0.06 }, desc: '+5% cường hoá/tinh luyện, dễ ra phẩm chất cao.' },
    { id: 'khi_thanh_khi', name: 'Thiên Công Khai Vật', lv: 8, fx: { time: 0.15, succ: 0.03 }, desc: '−15% thời gian, +3% thành công.' },
  ],
  tran: [
    { id: 'tran_van_dao', name: 'Khắc Văn Thuật', lv: 2, fx: { succ: 0.02 }, desc: '+2% tỉ lệ thành công mọi công thức Trận Pháp.' },
    { id: 'tran_tiet_kiem', name: 'Tụ Linh Tiết Kiệm', lv: 4, fx: { upk: 0.15 }, desc: '−15% chi phí duy trì trận khi triển khai.' },
    { id: 'tran_van_hoa', name: 'Trận Văn Hoàn Mỹ', lv: 6, fx: { qup: 0.06, time: 0.10 }, desc: 'Dễ ra phẩm chất cao, −10% thời gian.' },
    { id: 'tran_thien_co', name: 'Thiên Cơ Diễn Toán', lv: 8, fx: { upk: 0.15, dbl: 0.06 }, desc: '−15% duy trì thêm, 6% ra gấp đôi.' },
  ],
  thuc: [
    { id: 'thuc_thuy_mach', name: 'Thuỷ Mạch Thuật', lv: 2, fx: { grow: 0.08 }, desc: '−8% thời gian sinh trưởng Linh Điền.' },
    { id: 'thuc_hoi_chung', name: 'Thu Chủng Thuật', lv: 4, fx: { seed: 0.10, yield: 0.5 }, desc: '+10% thu hồi hạt giống, +0,5 sản lượng trung bình.' },
    { id: 'thuc_bien_di', name: 'Biến Dị Dẫn Linh', lv: 6, fx: { mut: 0.03, qup: 0.06 }, desc: '+3% xác suất biến dị, dễ ra phẩm chất cao.' },
    { id: 'thuc_thien_dia', name: 'Thiên Địa Dưỡng Sinh', lv: 8, fx: { grow: 0.10, yield: 1 }, desc: '−10% thời gian thêm, +1 sản lượng.' },
  ],
};

// ===================================================================== THÀNH TỰU (thưởng 1 lần, nhỏ & có giới hạn)
// test(st): st = { crafts, successes, fails, bestQ, level, extra }
const ACH = {
  dan: [
    { id: 'dan_a1', name: 'Nhập Môn Đan Đạo', desc: 'Luyện thành công 1 lần.', test: (s) => s.successes >= 1, lt: 2000 },
    { id: 'dan_a2', name: 'Đan Lô Bất Tức', desc: 'Luyện 50 lần.', test: (s) => s.crafts >= 50, lt: 30000, items: { tdc_dan_hoa_tinh: 1 } },
    { id: 'dan_a3', name: 'Thượng Phẩm Đan Sư', desc: 'Luyện ra đan Thượng Phẩm.', test: (s) => s.bestQ >= 3, lt: 50000 },
    { id: 'dan_a4', name: 'Thánh Phẩm Truyền Kỳ', desc: 'Luyện ra đan Thánh Phẩm.', test: (s) => s.bestQ >= 5, lt: 500000, items: { tdc_tan_quyen_dan_phuong: 1 } },
  ],
  khi: [
    { id: 'khi_a1', name: 'Nhập Môn Luyện Khí', desc: 'Chế thành công 1 lần.', test: (s) => s.successes >= 1, lt: 2000 },
    { id: 'khi_a2', name: 'Lò Rèn Không Tắt', desc: 'Chế 50 lần.', test: (s) => s.crafts >= 50, lt: 30000, items: { tdc_khi_linh_hach: 1 } },
    { id: 'khi_a3', name: 'Cường Hoá Đại Sư', desc: 'Cường hoá một trang bị đến +5.', test: (s) => (s.extra.maxEnh || 0) >= 5, lt: 80000 },
    { id: 'khi_a4', name: 'Thần Binh Xuất Thế', desc: 'Chế ra trang bị Thánh Phẩm.', test: (s) => s.bestQ >= 5, lt: 500000, items: { tdc_manh_ban_ve: 1 } },
  ],
  tran: [
    { id: 'tran_a1', name: 'Nhập Môn Trận Đạo', desc: 'Chế thành công 1 lần.', test: (s) => s.successes >= 1, lt: 2000 },
    { id: 'tran_a2', name: 'Bày Trận Thành Thạo', desc: 'Triển khai trận pháp 20 lần.', test: (s) => (s.extra.deploys || 0) >= 20, lt: 40000 },
    { id: 'tran_a3', name: 'Trận Văn Đại Sư', desc: 'Chế ra trận pháp Thượng Phẩm.', test: (s) => s.bestQ >= 3, lt: 60000 },
    { id: 'tran_a4', name: 'Hộ Tông Chi Chủ', desc: 'Triển khai Hộ Tông Đại Trận.', test: (s) => (s.extra.hoTong || 0) >= 1, lt: 300000, items: { tdc_co_tran_do: 1 } },
  ],
  thuc: [
    { id: 'thuc_a1', name: 'Mở Mang Linh Điền', desc: 'Thu hoạch lần đầu.', test: (s) => (s.extra.harvests || 0) >= 1, lt: 2000 },
    { id: 'thuc_a2', name: 'Ruộng Linh Bội Thu', desc: 'Thu hoạch 40 lần.', test: (s) => (s.extra.harvests || 0) >= 40, lt: 30000, items: { lt_linh_tuyen_thuy: 3 } },
    { id: 'thuc_a3', name: 'Biến Dị Kỳ Duyên', desc: 'Gặp biến dị 3 lần.', test: (s) => (s.extra.mutations || 0) >= 3, lt: 60000 },
    { id: 'thuc_a4', name: 'Tiên Điền Chủ', desc: 'Nâng Linh Điền lên cấp 5.', test: (s) => (s.extra.fieldLv || 0) >= 5, lt: 400000, items: { tdc_moc_nguyen_tinh: 1 } },
  ],
};

// ===================================================================== CÔNG THỨC
// ing: { item_id: số lượng }  ·  out: [item_id, số lượng]  ·  gold: Linh Thạch · time: giây · rate: tỉ lệ thành công gốc · exp: EXP nghề
// fail: tỉ lệ nguyên liệu hoàn lại khi thất bại (0..1)  ·  q: sản phẩm có phẩm chất (1..5)  ·  cd: hồi chiêu riêng (giây)  ·  realm: cảnh giới tối thiểu (điều kiện phụ)
const RECIPES = []; const RBY = Object.create(null);
function R(id, prof, lv, name, ing, out, o = {}) {
  if (RBY[id]) throw new Error(`công thức trùng: ${id}`);
  const r = { id, prof, lv, name, ing, out: { item: out[0], qty: out[1] || 1 }, gold: 0, time: 120, rate: 0.9, exp: 10, fail: 0.5, q: false, cd: 0, realm: 0, kind: 'item', ...o };
  RECIPES.push(r); RBY[id] = r; return r;
}
const DCOST = K.LUYENDAN_COST || 5; const KCOST = K.LUYENKHI_COST || 8; const PCOST = K.DAN_PHA_GIOI_CRAFT_COST || 5;

// ---------- ĐAN SƯ ----------
R('rc_dd_so', 'dan', 1, 'Dược Dịch Sơ Cấp', { ld_thanh_linh_thao: 4, lt_linh_tuyen_thuy: 1 }, ['dd_so', 2], { gold: 100, time: 90, rate: 0.95, exp: 6, fail: 0.5 });
R('rc_dan_tu_khi', 'dan', 1, 'Tụ Khí Đan', { nl_tap: DCOST, dd_so: 1 }, ['dan_tu_khi', 1], { gold: 200, time: 300, rate: 0.9, exp: 10, q: true });
R('rc_dan_huyet_nguyen', 'dan', 1, 'Huyết Nguyên Đan', { dd_so: 2, yt_tinh_huyet: 1 }, ['dan_huyet_nguyen', 2], { gold: 300, time: 240, rate: 0.9, exp: 12, q: true });
R('rc_dd_trung', 'dan', 2, 'Dược Dịch Trung Cấp', { ld_tu_van_hoa: 3, ld_ngoc_tuy_sam: 1, lt_linh_tuyen_thuy: 1 }, ['dd_trung', 2], { gold: 600, time: 180, rate: 0.92, exp: 20 });
R('rc_dan_thanh_tam', 'dan', 2, 'Thanh Tâm Đan', { dd_trung: 1, ld_han_nguyet_lien: 1 }, ['dan_thanh_tam', 2], { gold: 800, time: 300, rate: 0.9, exp: 28, q: true });
R('rc_dan_cuong_the', 'dan', 2, 'Cường Thể Đan', { dd_so: 2, ld_ngoc_tuy_sam: 1, yt_tinh_huyet: 1 }, ['dan_cuong_the', 1], { gold: 900, time: 360, rate: 0.88, exp: 30, q: true });
R('rc_dan_ngung_nguyen', 'dan', 3, 'Ngưng Nguyên Đan', { dd_trung: 2, yt_yeu_dan: 1, ld_dia_mach_chi: 1 }, ['dan_ngung_nguyen', 1], { gold: 2500, time: 600, rate: 0.85, exp: 60, q: true });
R('rc_dan_kim_cuong', 'dan', 3, 'Kim Cương Đan', { dd_trung: 2, yt_lan_giap: 1, kv_huyen_tinh: 1 }, ['dan_kim_cuong', 1], { gold: 2000, time: 480, rate: 0.86, exp: 55, q: true });
R('rc_dan_long_luc', 'dan', 3, 'Long Lực Đan', { dd_trung: 2, yt_yeu_cot: 1, ld_xich_diem_hoa: 1 }, ['dan_long_luc', 1], { gold: 2000, time: 480, rate: 0.86, exp: 55, q: true });
R('rc_dd_cao', 'dan', 4, 'Dược Dịch Cao Cấp', { dd_trung: 2, ld_dia_mach_chi: 1, ld_huyet_ngoc_qua: 1, lt_linh_tuyen_thuy: 1 }, ['dd_cao', 1], { gold: 3000, time: 300, rate: 0.9, exp: 70 });
R('rc_dan_tat_phong', 'dan', 4, 'Tật Phong Đan', { dd_cao: 1, tdc_phong_linh_tuy: 1, yt_yeu_dan: 1 }, ['dan_tat_phong', 1], { gold: 5000, time: 600, rate: 0.84, exp: 110, q: true });
R('rc_dan_ho_mach', 'dan', 4, 'Hộ Mạch Đan', { dd_cao: 1, ld_dia_mach_chi: 1, yt_tinh_huyet: 1 }, ['dan_ho_mach', 1], { gold: 6000, time: 720, rate: 0.82, exp: 120, q: true });
R('rc_dan_ngung_than', 'dan', 4, 'Ngưng Thần Đan', { dd_cao: 1, yt_thu_hon: 1, ld_ngoc_tuy_sam: 1 }, ['dan_ngung_than', 1], { gold: 6000, time: 720, rate: 0.82, exp: 120, q: true });
R('rc_dan_pha_canh', 'dan', 5, 'Phá Cảnh Đan', { dd_cao: 1, ld_cuu_diep_linh_chi: 1, tdc_dan_hoa_tinh: 1, yt_yeu_dan: 1 }, ['dan_pha_canh', 1], { gold: 20000, time: 1200, rate: 0.75, exp: 260, q: true });
R('rc_dan_han_ngoc', 'dan', 5, 'Hàn Ngọc Đan', { dd_cao: 1, ld_han_nguyet_lien: 2, kv_bang_phach_ngoc: 1, tdc_thuy_nguyen_tinh: 1 }, ['dan_han_ngoc', 1], { gold: 15000, time: 900, rate: 0.78, exp: 220, q: true });
R('rc_dan_liet_duong', 'dan', 5, 'Liệt Dương Đan', { dd_cao: 1, ld_xich_diem_hoa: 2, tdc_dan_hoa_tinh: 1, tdc_hoa_nguyen_tinh: 1 }, ['dan_liet_duong', 1], { gold: 15000, time: 900, rate: 0.78, exp: 220, q: true });
R('rc_dan_pha_gioi', 'dan', 5, 'Đan Dược Phá Giới', { ld_dac_biet: PCOST }, ['dan_pha_gioi', 1], { gold: 0, time: 0, rate: 1, exp: 40, fail: 1 });
R('rc_dd_tien', 'dan', 6, 'Dược Dịch Tiên', { ld_bat_lao_tien_qua: 1, yt_phuong_vu: 1, dd_cao: 2, lt_linh_tuyen_thuy: 2 }, ['dd_tien', 1], { gold: 60000, time: 900, rate: 0.85, exp: 400, realm: 5 });
R('rc_dan_do_kiep', 'dan', 6, 'Độ Kiếp Đan', { dd_cao: 2, tdc_loi_linh_tuy: 1, ld_cuu_diep_linh_chi: 1, yt_hon_tinh: 1 }, ['dan_do_kiep', 1], { gold: 120000, time: 1800, rate: 0.7, exp: 700, q: true, realm: 4 });
R('rc_dan_tien_nguyen', 'dan', 7, 'Tiên Nguyên Đan', { dd_tien: 1, ld_hon_nguyen_dao_qua: 1, yt_long_huyet: 1, tdc_thien_hoa_tinh: 1 }, ['dan_tien_nguyen', 1], { gold: 400000, time: 3600, rate: 0.65, exp: 1500, q: true, realm: 6 });
R('rc_dan_tay_tuy_nua', 'dan', 8, 'Tẩy Tủy Đan (Nửa Tác Dụng)', { tdc_tan_quyen_dan_phuong: 3, dd_tien: 2, ld_hon_nguyen_dao_qua: 1, tdc_hon_don_nguyen_khi: 1 }, ['dan_tay_tuy_nua', 1],
  { gold: 5000000, time: 7200, rate: 0.30, exp: 5000, fail: 0, cd: 86400, realm: 8 });

// ---------- LUYỆN KHÍ SƯ ----------
R('rc_kl_dong', 'khi', 1, 'Tinh Luyện Đồng Linh', { kv_thanh_dong: 4, nl_tap: 4 }, ['kl_dong', 2], { gold: 200, time: 90, rate: 0.95, exp: 6 });
R('rc_pk_tho', 'khi', 1, 'Đúc Phôi Khí Thô', { kl_dong: 2, nl_tap: KCOST }, ['pk_tho', 1], { gold: 300, time: 150, rate: 0.92, exp: 10 });
R('rc_kl_huyen', 'khi', 2, 'Tinh Luyện Huyền Thiết', { kv_huyen_tinh: 3, kv_huyen_thiet: 2 }, ['kl_huyen', 2], { gold: 800, time: 180, rate: 0.92, exp: 20 });
R('rc_gx_thanh_phong', 'khi', 2, 'Thanh Phong Kiếm', { pk_tho: 2, yt_yeu_cot: 1 }, ['gx_thanh_phong', 1], { gold: 3000, time: 900, rate: 0.85, exp: 60, q: true, kind: 'gear', fail: 0.4 });
R('rc_pk_trung', 'khi', 3, 'Đúc Phôi Khí Trung', { kl_huyen: 2, yt_yeu_cot: 1 }, ['pk_trung', 1], { gold: 1500, time: 300, rate: 0.9, exp: 35 });
R('rc_gx_tat_phong_ngoa', 'khi', 3, 'Tật Phong Ngoa', { pk_trung: 1, yt_lan_giap: 1, yt_tinh_huyet: 2 }, ['gx_tat_phong_ngoa', 1], { gold: 6000, time: 1200, rate: 0.82, exp: 120, q: true, kind: 'gear', fail: 0.4 });
R('rc_gx_ho_tam_kinh', 'khi', 3, 'Hộ Tâm Kính', { pk_trung: 1, kv_bang_phach_ngoc: 2, tdc_khi_linh_hach: 1 }, ['gx_ho_tam_kinh', 1], { gold: 8000, time: 1200, rate: 0.8, exp: 130, q: true, kind: 'gear', fail: 0.4 });
R('rc_kl_tu', 'khi', 4, 'Tinh Luyện Tử Kim', { kv_tu_kim_thach: 2, kv_xich_huyet_thiet: 2 }, ['kl_tu', 2], { gold: 4000, time: 300, rate: 0.9, exp: 60 });
R('rc_gx_huyen_thiet_giap', 'khi', 4, 'Huyền Thiết Giáp', { pk_trung: 2, kv_huyen_thiet: 3, yt_lan_giap: 3, tdc_khi_linh_hach: 1 }, ['gx_huyen_thiet_giap', 1], { gold: 20000, time: 1800, rate: 0.8, exp: 260, q: true, kind: 'gear', fail: 0.4 });
R('rc_pk_cao', 'khi', 5, 'Đúc Phôi Khí Cao', { kl_tu: 2, yt_lan_giap: 1, kv_bang_phach_ngoc: 1, tdc_kim_nguyen_tinh: 1 }, ['pk_cao', 1], { gold: 10000, time: 600, rate: 0.88, exp: 120 });
R('rc_gx_tu_linh_boi', 'khi', 5, 'Tụ Linh Ngọc Bội', { pk_cao: 1, kv_tien_ngoc: 2, td_linh_mac: 2, tdc_khi_linh_hach: 1 }, ['gx_tu_linh_boi', 1], { gold: 60000, time: 2400, rate: 0.78, exp: 420, q: true, kind: 'gear', fail: 0.4, realm: 6 });
R('rc_gx_tran_hon_linh', 'khi', 5, 'Trấn Hồn Linh', { pk_cao: 1, yt_thu_hon: 2, yt_hon_tinh: 1, tdc_khi_linh_hach: 1 }, ['gx_tran_hon_linh', 1], { gold: 60000, time: 2400, rate: 0.78, exp: 420, q: true, kind: 'gear', fail: 0.4, realm: 3 });
R('rc_kl_hon', 'khi', 6, 'Tinh Luyện Hỗn Nguyên', { kv_hon_nguyen_kim_tinh: 1, kv_cuu_thien_kim_tinh: 1, kv_thien_ngoai_van_thiet: 2 }, ['kl_hon', 2], { gold: 100000, time: 900, rate: 0.85, exp: 400, realm: 5 });
R('rc_gx_tru_vat_gioi', 'khi', 6, 'Trữ Vật Giới Chỉ', { pk_cao: 1, td_khong_gian_phu_van: 2, kv_tu_kim_thach: 2, tdc_khi_linh_hach: 2 }, ['gx_tru_vat_gioi', 1], { gold: 200000, time: 3000, rate: 0.75, exp: 800, q: true, kind: 'gear', fail: 0.4, realm: 6 });
R('rc_pk_tien', 'khi', 7, 'Đúc Phôi Khí Tiên', { kl_hon: 2, kv_tien_kim: 1, tdc_hu_khong_toai_phien: 1 }, ['pk_tien', 1], { gold: 300000, time: 1800, rate: 0.8, exp: 1000, realm: 6 });
R('rc_gx_pha_thien_thuong', 'khi', 7, 'Phá Thiên Thương', { pk_tien: 1, kv_thien_ngoai_van_thiet: 2, yt_long_huyet: 1, tdc_khi_linh_hach: 2, tdc_manh_ban_ve: 1, tdc_thien_kiep_chi_luc: 1 }, ['gx_pha_thien_thuong', 1],
  { gold: 600000, time: 4200, rate: 0.7, exp: 2000, q: true, kind: 'gear', fail: 0.3, realm: 6 });

// ---------- TRẬN PHÁP SƯ ----------
R('rc_tv_so', 'tran', 1, 'Khắc Trận Văn Sơ Cấp', { td_tran_van_thach: 2, td_linh_mac: 2 }, ['tv_so', 2], { gold: 150, time: 90, rate: 0.95, exp: 6 });
R('rc_tp_tu_linh', 'tran', 1, 'Tụ Linh Trận Bàn', { tv_so: 2, td_tran_ban_co_thach: 1, td_tran_ky: 1 }, ['tp_tu_linh', 1], { gold: 1000, time: 600, rate: 0.88, exp: 30, q: true });
R('rc_tv_trung', 'tran', 3, 'Khắc Trận Văn Trung Cấp', { td_tran_van_thach: 2, td_thien_dien_sa: 1, td_linh_mac: 2, td_phu_chi: 1 }, ['tv_trung', 2], { gold: 2000, time: 240, rate: 0.9, exp: 45 });
R('rc_tp_ho_than', 'tran', 3, 'Hộ Thân Trận Kỳ', { tv_so: 2, td_tran_ky: 2, yt_yeu_dan: 1 }, ['tp_ho_than', 1], { gold: 4000, time: 900, rate: 0.85, exp: 90, q: true });
R('rc_tp_sat_phat', 'tran', 4, 'Sát Phạt Trận Bàn', { tv_trung: 2, td_tran_ban_co_thach: 2, yt_thu_hon: 1 }, ['tp_sat_phat', 1], { gold: 12000, time: 1200, rate: 0.82, exp: 200, q: true });
R('rc_tv_cao', 'tran', 5, 'Khắc Trận Văn Cao Cấp', { td_tran_ban_co_thach: 2, td_thien_dien_sa: 1, tdc_thien_co_phu_van: 1, td_linh_mac: 2 }, ['tv_cao', 2], { gold: 15000, time: 480, rate: 0.88, exp: 150 });
R('rc_tp_me_tung', 'tran', 5, 'Mê Tung Trận', { tv_trung: 2, td_tran_ky: 2, tdc_thien_co_phu_van: 1, yt_hon_tinh: 1 }, ['tp_me_tung', 1], { gold: 30000, time: 1500, rate: 0.78, exp: 330, q: true });
R('rc_tp_phong_an', 'tran', 5, 'Phong Ấn Phù', { tv_trung: 1, td_phu_chi: 3, td_linh_mac: 2, tdc_thien_co_phu_van: 1, yt_hon_tinh: 1 }, ['tp_phong_an', 1], { gold: 30000, time: 1500, rate: 0.78, exp: 330, q: true });
R('rc_tp_ho_tong', 'tran', 7, 'Hộ Tông Đại Trận', { tv_cao: 3, td_tran_ban_co_thach: 3, tdc_co_tran_do: 1, yt_hon_tinh: 2, tdc_tho_nguyen_tinh: 1 }, ['tp_ho_tong', 1], { gold: 400000, time: 3600, rate: 0.68, exp: 1400, q: true, realm: 6 });
R('rc_tp_khong_gian', 'tran', 8, 'Không Gian Trận Bàn', { tv_cao: 2, td_khong_gian_phu_van: 2, tdc_hu_khong_toai_phien: 1, tdc_hu_khong_ket_tinh: 2, tdc_co_tran_do: 1, tdc_hu_khong_tinh_hoa: 3 }, ['tp_khong_gian', 1],
  { gold: 800000, time: 5400, rate: 0.62, exp: 2800, q: true, realm: 8 });

// ---------- LINH THỰC SƯ ----------
R('rc_thuc_sinh_dich', 'thuc', 2, 'Pha Thúc Sinh Dịch', { lt_linh_tuyen_thuy: 2, ld_thanh_linh_thao: 2, lt_linh_tho: 1 }, ['lt_thuc_sinh_dich', 1], { gold: 500, time: 300, rate: 0.92, exp: 25 });
R('rc_duong_mach_dich', 'thuc', 4, 'Pha Dưỡng Mạch Dịch', { lt_linh_tuyen_thuy: 2, ld_tu_van_hoa: 2, yt_tinh_huyet: 1 }, ['lt_duong_mach_dich', 1], { gold: 3000, time: 600, rate: 0.88, exp: 90 });

// ===================================================================== SẢN PHẨM: ĐAN DƯỢC — hiệu ứng thật
// k: tuvi (cộng tu vi) · heal (hồi % sinh mệnh tối đa) · tamcanh (xoá mệt tu luyện) · buff (buff có thời hạn, đi qua fx17)
// soft/hard: số viên/ngày hưởng đủ hiệu lực / tối đa (soft < n ≤ hard: hiệu lực giảm dần)
const PILLS = {
  dan_tu_khi: { k: 'tuvi', lo: 60, hi: 120, hard: 60, soft: 30 },
  dan_ngung_nguyen: { k: 'tuvi', lo: 260, hi: 420, soft: 6, hard: 12 },
  dan_tien_nguyen: { k: 'tuvi', lo: 1800, hi: 2800, soft: 2, hard: 4, realm: 5 },
  dan_huyet_nguyen: { k: 'heal', pct: 0.35, max: 0.60, hard: 20, soft: 10 },
  dan_thanh_tam: { k: 'tamcanh', dur: 1800, fx: { fatigueCut: 0.5 }, hard: 6, soft: 3 },
  dan_ho_mach: { k: 'buff', key: 'ho_mach', dur: 3600, charges: 1, fx: { failKeep: 0.06, lockCut: 0.4 }, hard: 4, soft: 2 },
  dan_pha_canh: { k: 'buff', key: 'pha_canh', dur: 3600, charges: 1, fx: { bt: 0.05 }, hard: 4, soft: 2 },
  dan_ngung_than: { k: 'buff', key: 'ngung_than', dur: 3600, fx: { ngo: 4 }, hard: 4, soft: 2 },
  dan_cuong_the: { k: 'buff', key: 'cuong_the', dur: 3600, fx: { hp: 0.10 }, hard: 6, soft: 3 },
  dan_kim_cuong: { k: 'buff', key: 'kim_cuong', dur: 3600, fx: { def: 0.10 }, hard: 6, soft: 3 },
  dan_long_luc: { k: 'buff', key: 'long_luc', dur: 3600, fx: { atk: 0.10 }, hard: 6, soft: 3 },
  dan_tat_phong: { k: 'buff', key: 'tat_phong', dur: 3600, fx: { spd: 0.10 }, hard: 6, soft: 3 },
  dan_han_ngoc: { k: 'buff', key: 'han_ngoc', dur: 3600, fx: { res_hoa: 0.12 }, hard: 4, soft: 2 },
  dan_liet_duong: { k: 'buff', key: 'liet_duong', dur: 3600, fx: { res_han: 0.12 }, hard: 4, soft: 2 },
  dan_do_kiep: { k: 'buff', key: 'do_kiep', dur: 7200, charges: 1, fx: { tk: 0.06, kiep: 0.10 }, hard: 2, soft: 1 },
};

// ===================================================================== TRẬN PHÁP — hiệu ứng thật
// dur: giây · upkeep: Linh Thạch / giờ (nhân hệ số cảnh giới) · charges: số lần dùng (nếu có) · fx: xem fx17 · daily: số lần triển khai/ngày
const TRANS = {
  tp_tu_linh: { dur: 7200, upkeep: 3000, fx: { tu: 0.08 }, daily: 6 },
  tp_ho_than: { dur: 3600, upkeep: 4000, fx: { def: 0.10, dr: 0.04 }, daily: 6 },
  tp_sat_phat: { dur: 2700, upkeep: 5000, fx: { atk: 0.10, pierce: 0.04 }, daily: 6 },
  tp_me_tung: { dur: 3600, upkeep: 6000, fx: { dodge: 0.04, loot: 0.10 }, daily: 6 },
  tp_phong_an: { dur: 3600, upkeep: 4000, charges: 3, fx: { foe: 0.06, bossDr: 0.20 }, daily: 6 },
  tp_ho_tong: { dur: 14400, upkeep: 8000, fx: { sectDr: 0.06, sectTu: 0.05 }, daily: 2, sect: true },
  tp_khong_gian: { dur: 10800, upkeep: 8000, charges: 3, fx: { teleport: 1 }, daily: 1 },
};
const TRAN_PERSONAL_MAX = 3;       // tối đa 3 trận cá nhân cùng lúc (khác loại)

// ===================================================================== TRANG BỊ (7 ô)
const SLOTS = {
  weapon: { name: 'Binh Khí', icon: '⚔️' }, armor: { name: 'Giáp', icon: '🛡️' }, jade: { name: 'Ngọc Bội', icon: '📿' },
  mirror: { name: 'Gương Hộ Tâm', icon: '🪞' }, boots: { name: 'Ngoa', icon: '👢' }, ring: { name: 'Giới Chỉ', icon: '💍' }, bell: { name: 'Linh', icon: '🔔' },
};
const SLOT_ORDER = ['weapon', 'armor', 'jade', 'mirror', 'boots', 'ring', 'bell'];
// pri: chỉ số CƠ BẢN (tỉ lệ cộng, nhân hệ số phẩm chất & cường hoá) · secPool: thuộc tính PHỤ (rút 1 lúc chế, giá trị ± ngẫu nhiên) · dur: độ bền
const GEAR = {
  gx_thanh_phong: { name: 'Thanh Phong Kiếm', slot: 'weapon', tier: 1, pri: { atk: 0.05 }, secPool: { crit: 0.02, spd: 0.02 }, dur: 150, realm: 0 },
  gx_pha_thien_thuong: { name: 'Phá Thiên Thương', slot: 'weapon', tier: 5, pri: { atk: 0.09 }, secPool: { pierce: 0.05, crit: 0.03 }, dur: 300, realm: 6 },
  gx_huyen_thiet_giap: { name: 'Huyền Thiết Giáp', slot: 'armor', tier: 2, pri: { def: 0.07, hp: 0.04 }, secPool: { dr: 0.03 }, dur: 200, realm: 2 },
  gx_tu_linh_boi: { name: 'Tụ Linh Ngọc Bội', slot: 'jade', tier: 3, pri: { tu: 0.05, hp: 0.03 }, secPool: { regen: 0.15, loot: 0.02 }, dur: 250, realm: 3 },
  gx_ho_tam_kinh: { name: 'Hộ Tâm Kính', slot: 'mirror', tier: 2, pri: { def: 0.03, hp: 0.03 }, secPool: { failKeep: 0.02, dr: 0.02, dodge: 0.02 }, dur: 200, realm: 2 },
  gx_tat_phong_ngoa: { name: 'Tật Phong Ngoa', slot: 'boots', tier: 2, pri: { spd: 0.07 }, secPool: { dodge: 0.03 }, dur: 180, realm: 1 },
  gx_tru_vat_gioi: { name: 'Trữ Vật Giới Chỉ', slot: 'ring', tier: 4, pri: { loot: 0.04, hp: 0.03 }, secPool: { tu: 0.02, regen: 0.10 }, dur: 300, realm: 5 },
  gx_tran_hon_linh: { name: 'Trấn Hồn Linh', slot: 'bell', tier: 3, pri: { hp: 0.05, dr: 0.03 }, secPool: { bossDr: 0.06, lifesteal: 0.02 }, dur: 250, realm: 3 },
};
const ENH_MAX = 10; const REFINE_MAX = 5;
const enhMult = (lv) => 1 + 0.03 * lv;                 // +3% chỉ số cơ bản mỗi cấp (tối đa ×1,30)
const refineMult = (lv) => 1 + 0.20 * lv;              // +20% thuộc tính phụ mỗi cấp tinh luyện
/** Cường hoá +n → +n+1: tỉ lệ, kim loại tinh luyện cần, Linh Thạch. Thất bại ≥ +7: hạ 1 cấp. */
function enhCost(lvNow, tier) {
  const kl = lvNow < 3 ? ['kl_dong', 2] : lvNow < 6 ? ['kl_huyen', 2] : lvNow < 8 ? ['kl_tu', 2] : ['kl_hon', 1];
  return { rate: [0.95, 0.9, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25, 0.2][lvNow] || 0.2, mat: kl, gold: Math.floor(1500 * (lvNow + 1) ** 1.8 * tier), cat: lvNow >= 6 ? 'nl_manh_phap_bao' : null, downOnFail: lvNow >= 6 };
}
function refineCost(lvNow, tier) {
  return { rate: [0.85, 0.7, 0.55, 0.4, 0.3][lvNow] || 0.3, mats: { tdc_manh_ban_ve: 1, nl_manh_phap_bao: 2 + lvNow }, gold: Math.floor(20000 * (lvNow + 1) ** 1.6 * tier) };
}
const REPAIR = { goldPerPoint: 40, mat: ['kl_dong', 1], perMat: 60 };   // sửa: 40 LT/điểm độ bền · +1 Đồng Linh Tinh Luyện mỗi 60 điểm
const DURA_LOSS = { pvp: 3, boss: 1, war: 2 };                          // độ bền mất mỗi trận PvP / đòn Boss / đòn Chiến Tông Môn (chỉ trang bị đang mặc)

// ===================================================================== LINH ĐIỀN
const FIELD = {
  open: { gold: 20000, mat: { lt_linh_tho: 5 }, plv: 1 },
  levels: [   // chỉ số = cấp - 1
    { plots: 2 },
    { plots: 3, up: { gold: 80000, mat: { lt_linh_tho: 10, lt_linh_tuyen_thuy: 5 }, plv: 2 } },
    { plots: 4, up: { gold: 400000, mat: { lt_linh_tho: 20, lt_linh_tuyen_thuy: 10 }, plv: 4 } },
    { plots: 5, up: { gold: 2000000, mat: { lt_linh_tho: 30, lt_linh_tuyen_thuy: 20, tdc_moc_nguyen_tinh: 1 }, plv: 6 } },
    { plots: 6, up: { gold: 10000000, mat: { lt_linh_tho: 50, lt_linh_tuyen_thuy: 30, tdc_moc_nguyen_tinh: 2, ld_dia_mach_chi: 3 }, plv: 8 } },
  ],
  waterMax: 3, waterCd: 1200, waterCut: 0.10, thucSinhCut: 0.30,
  waterMat: 'lt_linh_tuyen_thuy', soilMat: 'lt_linh_tho', plantGold: 100, seedBack: 0.25,
  duongMachQup: 0.30, duongMachMut: 0.04, wither: 86400,    // thu hoạch trễ quá 24h sau khi chín → héo (mất 50% sản lượng, không biến dị)
};
const SEEDS = {
  lt_chung_thanh_linh: { crop: 'ld_thanh_linh_thao', time: 3600, yield: [3, 5], plv: 1, mut: { to: 'ld_ngoc_tuy_sam', p: 0.05, qty: 1 }, exp: 6 },
  lt_chung_tu_van: { crop: 'ld_tu_van_hoa', time: 7200, yield: [2, 4], plv: 2, mut: { to: 'ld_dia_mach_chi', p: 0.04, qty: 1 }, exp: 14 },
  lt_chung_han_nguyet: { crop: 'ld_han_nguyet_lien', time: 14400, yield: [2, 3], plv: 4, mut: { to: 'ld_cuu_diep_linh_chi', p: 0.015, qty: 1 }, exp: 40 },
  lt_chung_xich_diem: { crop: 'ld_xich_diem_hoa', time: 14400, yield: [2, 3], plv: 4, mut: { to: 'ld_huyet_ngoc_qua', p: 0.03, qty: 1 }, exp: 40 },
};
const LINHDIEN_PLOT_MAX = 6;

// ===================================================================== NPC BÁN (money sink) — giá mua = 1,5 × giá trị; giới hạn mua/ngày
const NPC_BUY_MULT = 1.5;
const NPC_SHOP = {
  lt_chung_thanh_linh: 100, lt_chung_tu_van: 60, lt_chung_han_nguyet: 20, lt_chung_xich_diem: 20, lt_linh_tho: 150, lt_linh_tuyen_thuy: 80,
  td_phu_chi: 100, td_linh_mac: 100, td_tran_ky: 40, nl_tap: 200,
};

// ===================================================================== BẢNG RƠI (mỗi nguồn một bảng) — [item, xác suất mỗi lần, min, max, {cap: tối đa/ngày}]
// ltBase: Linh Thạch tối thiểu nguồn đó cho mỗi lượt (để kiểm tra tổng giá trị NPC của rơi ≤ ~10%). lootM (kỹ năng/ công pháp) chỉ nhân XÁC SUẤT ≤ +30%.
const DROPS = {
  bc0: { label: 'Bí Cảnh Sơ Cấp', ltBase: 13000, rolls: [
    ['ld_thanh_linh_thao', 0.45, 1, 3], ['kv_thanh_dong', 0.40, 1, 3], ['td_linh_mac', 0.22, 1, 2], ['td_phu_chi', 0.22, 1, 2], ['lt_linh_tho', 0.20, 1, 1],
    ['ld_tu_van_hoa', 0.10, 1, 1], ['kv_huyen_tinh', 0.06, 1, 1], ['yt_yeu_dan', 0.04, 1, 1], ['td_tran_van_thach', 0.06, 1, 1], ['lt_chung_thanh_linh', 0.08, 1, 1],
    ['lt_linh_tuyen_thuy', 0.05, 1, 1]] },
  bc1: { label: 'Bí Cảnh Trung Cấp', ltBase: 47000, rolls: [
    ['ld_thanh_linh_thao', 0.40, 1, 3], ['ld_tu_van_hoa', 0.30, 1, 2], ['ld_ngoc_tuy_sam', 0.10, 1, 1], ['kv_huyen_tinh', 0.25, 1, 2], ['kv_thanh_dong', 0.25, 1, 2],
    ['yt_yeu_dan', 0.15, 1, 1], ['yt_tinh_huyet', 0.15, 1, 1], ['td_tran_van_thach', 0.15, 1, 2], ['td_tran_ky', 0.10, 1, 1], ['td_linh_mac', 0.20, 1, 2],
    ['lt_chung_tu_van', 0.06, 1, 1], ['lt_linh_tuyen_thuy', 0.12, 1, 1], ['kv_xich_huyet_thiet', 0.05, 1, 1], ['kv_bang_phach_ngoc', 0.04, 1, 1],
    ['yt_yeu_cot', 0.05, 1, 1], ['ld_han_nguyet_lien', 0.04, 1, 1], ['ld_xich_diem_hoa', 0.04, 1, 1]] },
  bc2: { label: 'Bí Cảnh Cao Cấp', ltBase: 100000, rolls: [
    ['ld_tu_van_hoa', 0.25, 1, 2], ['ld_ngoc_tuy_sam', 0.15, 1, 1], ['ld_han_nguyet_lien', 0.10, 1, 1], ['ld_xich_diem_hoa', 0.10, 1, 1], ['ld_dia_mach_chi', 0.04, 1, 1],
    ['kv_xich_huyet_thiet', 0.12, 1, 1], ['kv_bang_phach_ngoc', 0.10, 1, 1], ['kv_tu_kim_thach', 0.03, 1, 1], ['yt_yeu_dan', 0.20, 1, 1], ['yt_yeu_cot', 0.12, 1, 1],
    ['yt_lan_giap', 0.10, 1, 1], ['yt_thu_hon', 0.03, 1, 1], ['td_tran_ban_co_thach', 0.08, 1, 1], ['td_thien_dien_sa', 0.03, 1, 1], ['lt_chung_han_nguyet', 0.04, 1, 1],
    ['lt_chung_xich_diem', 0.04, 1, 1], ['tdc_dan_hoa_tinh', 0.04, 1, 1], ['tdc_khi_linh_hach', 0.02, 1, 1],
    ['tdc_kim_nguyen_tinh', 0.02, 1, 1], ['tdc_moc_nguyen_tinh', 0.02, 1, 1], ['tdc_thuy_nguyen_tinh', 0.02, 1, 1], ['tdc_hoa_nguyen_tinh', 0.02, 1, 1], ['tdc_tho_nguyen_tinh', 0.02, 1, 1]] },
  vlc: { label: 'Vạn Linh Cốc', ltBase: 185000, rolls: [
    ['ld_ngoc_tuy_sam', 0.15, 1, 2], ['ld_dia_mach_chi', 0.10, 1, 1], ['ld_huyet_ngoc_qua', 0.06, 1, 1], ['ld_cuu_diep_linh_chi', 0.008, 1, 1, { cap: 2 }],
    ['kv_tu_kim_thach', 0.08, 1, 1], ['kv_xich_huyet_thiet', 0.12, 1, 2], ['kv_thien_ngoai_van_thiet', 0.006, 1, 1, { cap: 2 }], ['yt_yeu_cot', 0.15, 1, 2],
    ['yt_lan_giap', 0.15, 1, 2], ['yt_thu_hon', 0.08, 1, 1], ['yt_hon_tinh', 0.01, 1, 1, { cap: 2 }], ['td_thien_dien_sa', 0.06, 1, 1], ['tdc_tho_nguyen_tinh', 0.04, 1, 1],
    ['tdc_kim_nguyen_tinh', 0.04, 1, 1], ['tdc_moc_nguyen_tinh', 0.04, 1, 1], ['tdc_thuy_nguyen_tinh', 0.04, 1, 1], ['tdc_hoa_nguyen_tinh', 0.04, 1, 1],
    ['tdc_phong_linh_tuy', 0.008, 1, 1, { cap: 2 }], ['tdc_khi_linh_hach', 0.05, 1, 1], ['tdc_manh_ban_ve', 0.03, 1, 1], ['tdc_tan_quyen_dan_phuong', 0.03, 1, 1],
    ['tdc_thien_co_phu_van', 0.008, 1, 1, { cap: 2 }]] },
  vlc_boss: { label: 'Boss Vạn Linh Cốc', ltBase: 300000, rolls: [
    ['yt_thu_hon', 0.30, 1, 2], ['yt_hon_tinh', 0.05, 1, 1, { cap: 3 }], ['ld_cuu_diep_linh_chi', 0.04, 1, 1, { cap: 2 }], ['tdc_phong_linh_tuy', 0.04, 1, 1, { cap: 2 }],
    ['tdc_loi_linh_tuy', 0.04, 1, 1, { cap: 2 }], ['tdc_khi_linh_hach', 0.15, 1, 1], ['tdc_co_tran_do', 0.02, 1, 1, { cap: 1 }], ['kv_thien_ngoai_van_thiet', 0.03, 1, 1, { cap: 2 }],
    ['td_khong_gian_phu_van', 0.015, 1, 1, { cap: 1 }], ['tdc_thien_co_phu_van', 0.04, 1, 1, { cap: 2 }]] },
  bc_nhan: { label: 'Bí Cảnh Đặc Biệt (Nhân Giới)', ltBase: 60000, rolls: [
    ['ld_ngoc_tuy_sam', 0.20, 1, 2], ['ld_dia_mach_chi', 0.08, 1, 1], ['kv_tu_kim_thach', 0.06, 1, 1], ['yt_yeu_dan', 0.30, 1, 2], ['yt_thu_hon', 0.06, 1, 1],
    ['tdc_dan_hoa_tinh', 0.06, 1, 1], ['tdc_khi_linh_hach', 0.05, 1, 1], ['tdc_tan_quyen_dan_phuong', 0.05, 1, 1], ['tdc_manh_ban_ve', 0.04, 1, 1],
    ['tdc_phong_linh_tuy', 0.03, 1, 1], ['tdc_loi_linh_tuy', 0.03, 1, 1], ['tdc_thien_co_phu_van', 0.03, 1, 1, { cap: 2 }]] },
  bc_linh: { label: 'Bí Cảnh Đặc Biệt (Linh Giới)', ltBase: 70000000, rolls: [
    ['ld_cuu_diep_linh_chi', 0.05, 1, 1], ['kv_thien_ngoai_van_thiet', 0.05, 1, 1], ['yt_hon_tinh', 0.06, 1, 1], ['tdc_phong_linh_tuy', 0.05, 1, 1], ['tdc_loi_linh_tuy', 0.05, 1, 1],
    ['tdc_co_tran_do', 0.03, 1, 1], ['td_khong_gian_phu_van', 0.03, 1, 1], ['tdc_manh_ban_ve', 0.06, 1, 1], ['tdc_thien_co_phu_van', 0.05, 1, 1], ['tdc_khi_linh_hach', 0.08, 1, 1]] },
  chain_luyenhu: { label: 'Bí Cảnh Luyện Hư (Linh Giới)', ltBase: 40000, rolls: [
    ['ld_cuu_diep_linh_chi', 0.03, 1, 1], ['kv_thien_ngoai_van_thiet', 0.04, 1, 1], ['yt_thu_hon', 0.06, 1, 1], ['yt_hon_tinh', 0.03, 1, 1], ['tdc_phong_linh_tuy', 0.03, 1, 1],
    ['tdc_loi_linh_tuy', 0.03, 1, 1], ['tdc_manh_ban_ve', 0.04, 1, 1], ['tdc_khi_linh_hach', 0.05, 1, 1]] },
  chain_hopthe: { label: 'Bí Cảnh Hợp Thể (Linh Giới)', ltBase: 80000, rolls: [
    ['ld_cuu_diep_linh_chi', 0.04, 1, 1], ['kv_thien_ngoai_van_thiet', 0.05, 1, 1], ['yt_hon_tinh', 0.05, 1, 1], ['tdc_co_tran_do', 0.02, 1, 1], ['td_khong_gian_phu_van', 0.025, 1, 1],
    ['tdc_hu_khong_toai_phien', 0.01, 1, 1, { cap: 1 }], ['kv_cuu_thien_kim_tinh', 0.005, 1, 1, { cap: 1 }], ['ld_bat_lao_tien_qua', 0.004, 1, 1, { cap: 1 }], ['tdc_thien_co_phu_van', 0.04, 1, 1]] },
  chain_daithua: { label: 'Bí Cảnh Đại Thừa (Linh Giới)', ltBase: 150000, rolls: [
    ['ld_bat_lao_tien_qua', 0.01, 1, 1, { cap: 1 }], ['kv_cuu_thien_kim_tinh', 0.01, 1, 1, { cap: 1 }], ['yt_long_huyet', 0.008, 1, 1, { cap: 1 }], ['yt_phuong_vu', 0.008, 1, 1, { cap: 1 }],
    ['tdc_hu_khong_toai_phien', 0.02, 1, 1, { cap: 1 }], ['yt_hon_tinh', 0.06, 1, 2], ['tdc_co_tran_do', 0.03, 1, 1], ['tdc_manh_ban_ve', 0.05, 1, 1]] },
  chain_dokiep: { label: 'Bí Cảnh Thượng Cổ (Độ Kiếp)', ltBase: 300000, rolls: [
    ['ld_bat_lao_tien_qua', 0.015, 1, 1, { cap: 1 }], ['kv_cuu_thien_kim_tinh', 0.015, 1, 1, { cap: 1 }], ['yt_long_huyet', 0.012, 1, 1, { cap: 1 }], ['yt_phuong_vu', 0.012, 1, 1, { cap: 1 }],
    ['tdc_hu_khong_toai_phien', 0.03, 1, 1, { cap: 1 }], ['tdc_hon_don_nguyen_khi', 0.002, 1, 1, { cap: 1, week: 1 }], ['ld_hon_nguyen_dao_qua', 0.002, 1, 1, { cap: 1, week: 1 }],
    ['kv_hon_nguyen_kim_tinh', 0.002, 1, 1, { cap: 1, week: 1 }], ['tdc_co_tran_do', 0.04, 1, 1]] },
  chain_dokiep_boss: { label: 'Thiên Kiếp Hóa Thân', ltBase: 600000, rolls: [
    ['tdc_hon_don_nguyen_khi', 0.01, 1, 1, { cap: 1, week: 1 }], ['ld_hon_nguyen_dao_qua', 0.01, 1, 1, { cap: 1, week: 1 }], ['kv_hon_nguyen_kim_tinh', 0.01, 1, 1, { cap: 1, week: 1 }],
    ['yt_long_huyet', 0.10, 1, 1], ['yt_phuong_vu', 0.10, 1, 1], ['tdc_hu_khong_toai_phien', 0.15, 1, 1]] },
  boss_lo: { label: 'Boss Thế Giới (cấp 1–3)', ltBase: 100000, rolls: [
    ['yt_yeu_dan', 0.60, 2, 4], ['yt_tinh_huyet', 0.60, 2, 4], ['yt_yeu_cot', 0.35, 1, 2], ['yt_lan_giap', 0.35, 1, 2], ['yt_thu_hon', 0.12, 1, 1],
    ['tdc_khi_linh_hach', 0.12, 1, 1], ['tdc_manh_ban_ve', 0.06, 1, 1], ['tdc_dan_hoa_tinh', 0.10, 1, 1]] },
  boss_mid: { label: 'Boss Thế Giới (cấp 4–6)', ltBase: 400000, rolls: [
    ['yt_yeu_dan', 0.60, 3, 6], ['yt_thu_hon', 0.35, 1, 2], ['yt_hon_tinh', 0.12, 1, 1], ['yt_long_huyet', 0.01, 1, 1, { cap: 1 }], ['yt_phuong_vu', 0.01, 1, 1, { cap: 1 }],
    ['tdc_khi_linh_hach', 0.20, 1, 1], ['tdc_manh_ban_ve', 0.12, 1, 1], ['tdc_co_tran_do', 0.04, 1, 1], ['tdc_phong_linh_tuy', 0.05, 1, 1], ['tdc_loi_linh_tuy', 0.05, 1, 1],
    ['tdc_tan_quyen_dan_phuong', 0.10, 1, 1], ['kv_thien_ngoai_van_thiet', 0.03, 1, 1], ['tdc_thien_co_phu_van', 0.04, 1, 1, { cap: 2 }]] },
  boss_hi: { label: 'Boss Thế Giới (cấp 7–9)', ltBase: 1500000, rolls: [
    ['yt_hon_tinh', 0.30, 1, 2], ['yt_long_huyet', 0.06, 1, 1, { cap: 1 }], ['yt_phuong_vu', 0.06, 1, 1, { cap: 1 }], ['tdc_hu_khong_toai_phien', 0.06, 1, 1, { cap: 1 }],
    ['tdc_khi_linh_hach', 0.30, 1, 2], ['tdc_manh_ban_ve', 0.20, 1, 1], ['tdc_co_tran_do', 0.10, 1, 1], ['kv_cuu_thien_kim_tinh', 0.02, 1, 1, { cap: 1 }],
    ['ld_bat_lao_tien_qua', 0.02, 1, 1, { cap: 1 }], ['tdc_hon_don_nguyen_khi', 0.004, 1, 1, { cap: 1, week: 1 }]] },
  linhthu_lo: { label: 'Linh Thú đồng hành (nguồn ≤ 3)', ltBase: 13000, rolls: [
    ['yt_yeu_dan', 0.20, 1, 1], ['yt_tinh_huyet', 0.20, 1, 1], ['yt_yeu_cot', 0.06, 1, 1], ['yt_lan_giap', 0.06, 1, 1]] },
  linhthu_hi: { label: 'Linh Thú đồng hành (nguồn ≥ 4)', ltBase: 100000, rolls: [
    ['yt_yeu_dan', 0.20, 1, 2], ['yt_tinh_huyet', 0.20, 1, 2], ['yt_thu_hon', 0.06, 1, 1], ['yt_hon_tinh', 0.01, 1, 1, { cap: 1 }], ['yt_yeu_cot', 0.10, 1, 1], ['yt_lan_giap', 0.10, 1, 1]] },
  chuoi: { label: 'Chuỗi Đồng Tu (mỗi mốc)', ltBase: 100000, rolls: [
    ['ld_ngoc_tuy_sam', 1, 1, 2], ['tdc_dan_hoa_tinh', 1, 1, 1], ['kv_huyen_tinh', 1, 2, 4], ['lt_linh_tuyen_thuy', 1, 2, 4]] },
  event: { label: 'Rương Sự Kiện Đại Phú', ltBase: 200000, rolls: [
    ['ld_dia_mach_chi', 0.5, 1, 1], ['kv_tu_kim_thach', 0.5, 1, 1], ['tdc_khi_linh_hach', 0.3, 1, 1], ['tdc_tan_quyen_dan_phuong', 0.3, 1, 1], ['tdc_manh_ban_ve', 0.2, 1, 1]] },
  dongphu: { label: 'Thu hoạch Động Phủ (mỗi giờ)', ltBase: 400, rolls: [
    ['lt_linh_tho', 0.20, 1, 1], ['ld_thanh_linh_thao', 0.20, 1, 2], ['lt_linh_tuyen_thuy', 0.05, 1, 1], ['kv_thanh_dong', 0.10, 1, 2]] },
  sectwar_win: { label: 'Chiến Tông Môn (thắng)', ltBase: 5000000, rolls: [
    ['kv_tu_kim_thach', 1, 2, 4], ['ld_huyet_ngoc_qua', 1, 1, 2], ['yt_hon_tinh', 0.5, 1, 2], ['tdc_khi_linh_hach', 0.6, 1, 2], ['tdc_manh_ban_ve', 0.4, 1, 1], ['tdc_co_tran_do', 0.15, 1, 1, { cap: 1 }]] },
  sectwar_lose: { label: 'Chiến Tông Môn (thua)', ltBase: 2000000, rolls: [
    ['kv_huyen_tinh', 1, 2, 4], ['ld_ngoc_tuy_sam', 1, 1, 2], ['yt_thu_hon', 0.5, 1, 1], ['tdc_khi_linh_hach', 0.2, 1, 1]] },
};
/** Nguồn rơi → nơi gọi trong source (để bảng đối chiếu). */
const SOURCE_NOTES = {
  bc0: 'game/bicanh.js · doBicanh (tier 0)', bc1: 'game/bicanh.js · doBicanh (tier 1)', bc2: 'game/bicanh.js · doBicanh (tier 2)', vlc: 'game/bicanh.js · doBicanh (Vạn Linh Cốc)',
  vlc_boss: 'game/bicanh.js · Boss Vạn Linh Cốc', bc_nhan: 'game/bicanh.js · doBicanhDacBiet (Nhân Giới)', bc_linh: 'game/bicanh.js · doBicanhDacBiet (Linh Giới)',
  chain_luyenhu: 'game/bicanh.js · doBicanhLinhgioi', chain_hopthe: 'game/bicanh.js · doBicanhLinhgioi', chain_daithua: 'game/bicanh.js · doBicanhLinhgioi',
  chain_dokiep: 'game/bicanh.js · doBicanhLinhgioi (Thượng Cổ)', chain_dokiep_boss: 'game/bicanh.js · Thiên Kiếp Hóa Thân', boss_lo: 'game/boss.js · finish', boss_mid: 'game/boss.js · finish',
  boss_hi: 'game/boss.js · finish', linhthu_lo: 'game/pets.js · onBicanh', linhthu_hi: 'game/pets.js · onBicanh', chuoi: 'game/chuoi.js · milestone', event: 'game/daiphu.js · openRuong',
  dongphu: 'game/dongphu.js · doThuhoach', sectwar_win: 'game/sectwar.js · kết thúc trận', sectwar_lose: 'game/sectwar.js · kết thúc trận',
};
const CAP_DAY_GLOBAL = { 5: 6, 6: 3, 7: 1 };      // tối đa số vật phẩm phẩm cấp 5/6/7 nhận từ BẤT KỲ nguồn rơi trong 1 ngày (chặn cày vô hạn)

module.exports = {
  PROFS, PROF_ORDER, LEVELS, slotsOf, TECHS, ACH, RECIPES, RBY, PILLS, TRANS, TRAN_PERSONAL_MAX, SLOTS, SLOT_ORDER, GEAR, ENH_MAX, REFINE_MAX, enhMult, refineMult, enhCost, refineCost,
  REPAIR, DURA_LOSS, FIELD, SEEDS, LINHDIEN_PLOT_MAX, NPC_BUY_MULT, NPC_SHOP, DROPS, SOURCE_NOTES, CAP_DAY_GLOBAL,
};
