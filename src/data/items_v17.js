'use strict';
/**
 * DANH MỤC VẬT PHẨM DÙNG CHUNG v17 — nguồn dữ liệu DUY NHẤT về vật phẩm.
 *  • item_id ổn định (không dùng tên hiển thị làm khoá). Tên/emoji/mô tả chỉ để hiển thị.
 *  • `store` nói vật phẩm nằm ở đâu: 'tbl' = bảng inv_items (mới) · 'col' = cột sẵn có của bảng cultivators (vật phẩm V16, GIỮ NGUYÊN số lượng, không chuyển/xoá)
 *    · 'pet' = bảng pet_items của Linh Thú. Mọi truy cập đi qua game/invsvc.js (Inventory Service).
 *  • Giá: nguyên liệu thô tính theo phẩm cấp (RARITY.mult × V0); sản phẩm/bán thành phẩm tính từ công thức (data/craft_v17.js) để KHÔNG thể lãi Linh Thạch khi chế rồi bán NPC.
 *  • source_ids / recipe_ids / usage_ids KHÔNG gõ tay — được suy ra từ bảng rơi, công thức, công dụng (xem game/catalog17.js) để luôn khớp.
 */
const V0 = 500;                 // giá trị gốc (Linh Thạch) của nguyên liệu Phổ thông
const NPC_RATE = 0.35;          // NPC thu mua = 35% giá trị

/** 7 phẩm cấp NGUYÊN LIỆU (tách biệt hẳn với phẩm chất SẢN PHẨM bên dưới). */
const RARITY = [
  { id: 1, name: 'Phổ thông', mult: 1, color: 0x9aa0a6, dot: '⚪' },
  { id: 2, name: 'Tốt', mult: 3, color: 0x2ecc71, dot: '🟢' },
  { id: 3, name: 'Hiếm', mult: 10, color: 0x3498db, dot: '🔵' },
  { id: 4, name: 'Quý hiếm', mult: 35, color: 0x9b59b6, dot: '🟣' },
  { id: 5, name: 'Cực phẩm', mult: 120, color: 0xf1c40f, dot: '🟡' },
  { id: 6, name: 'Truyền thuyết', mult: 400, color: 0xe67e22, dot: '🟠' },
  { id: 7, name: 'Tiên phẩm', mult: 1500, color: 0xe74c3c, dot: '🔴' },
];
/** 5 phẩm chất SẢN PHẨM (đan dược / trận pháp / trang bị). Hệ số hiệu lực (đã chặn trần ở fx17). */
const QUALITY = [
  null,
  { id: 1, name: 'Hạ Phẩm', mult: 0.75 }, { id: 2, name: 'Trung Phẩm', mult: 1.0 }, { id: 3, name: 'Thượng Phẩm', mult: 1.25 },
  { id: 4, name: 'Cực Phẩm', mult: 1.5 }, { id: 5, name: 'Thánh Phẩm', mult: 1.8 },
];
const qName = (q) => (QUALITY[q] ? QUALITY[q].name : '');
const qMult = (q) => (QUALITY[q] ? QUALITY[q].mult : 1);

/** 8 danh mục theo spec + các danh mục sản phẩm. */
const CATEGORIES = {
  LINH_DUOC: { label: 'Linh Dược', icon: '🌿', order: 1 },
  KHOANG_VAT: { label: 'Khoáng Vật', icon: '⛏️', order: 2 },
  YEU_THU_TAI_LIEU: { label: 'Yêu Thú Tài Liệu', icon: '🦴', order: 3 },
  TRAN_DAO_TAI_LIEU: { label: 'Trận Đạo Tài Liệu', icon: '🔯', order: 4 },
  LINH_THUC: { label: 'Linh Thực', icon: '🌱', order: 5 },
  THIEN_DIA_CHI_BAO: { label: 'Thiên Địa Chí Bảo', icon: '🌌', order: 6 },
  NGUYEN_LIEU_TRUNG_GIAN: { label: 'Nguyên Liệu Trung Gian', icon: '⚗️', order: 7 },
  DAN_DUOC: { label: 'Đan Dược', icon: '💊', order: 8, product: true },
  TRAN_PHAP: { label: 'Trận Pháp', icon: '🧿', order: 9, product: true },
  VAT_PHAM_KHAC: { label: 'Vật Phẩm Khác', icon: '🎁', order: 10, product: true },
};
// Spec liệt kê danh mục LINH_TINH_TAI_LIEU: dùng cho các TINH HOA (Ngũ Hành Nguyên Tinh, Phong/Lôi Linh Tủy).
CATEGORIES.LINH_TINH_TAI_LIEU = { label: 'Linh Tinh Tài Liệu (Tinh Hoa)', icon: '🌠', order: 4.5 };

const ITEMS = []; const BY_ID = Object.create(null);
function def(o) {
  if (BY_ID[o.id]) throw new Error(`vật phẩm trùng ID: ${o.id}`);
  const it = {
    store: 'tbl', rarity: 1, can_trade: true, is_quest_item: false, quality: false, stack_limit: 999999, sub: '', desc: '', legacy_col: null, pet_key: null,
    price_mode: 'raw', ...o,
  };
  if (it.can_sell === undefined) it.can_sell = !it.is_quest_item;
  it.rarity_name = RARITY[it.rarity - 1].name;
  it.emoji_key = `i17_${it.id}`;
  ITEMS.push(it); BY_ID[it.id] = it; return it;
}
const raw = (id, name, cat, sub, rarity, desc, o = {}) => def({ id, name, cat, sub, rarity, desc, ...o });

// ===================================================================== A. LINH DƯỢC
raw('ld_thanh_linh_thao', 'Thanh Linh Thảo', 'LINH_DUOC', 'thao', 1, 'Linh thảo phổ biến nhất, nền của mọi loại Dược Dịch.');
raw('ld_tu_van_hoa', 'Tử Vân Hoa', 'LINH_DUOC', 'hoa', 2, 'Hoa tím nở trong sương linh khí, bổ dưỡng kinh mạch.');
raw('ld_ngoc_tuy_sam', 'Ngọc Tủy Sâm', 'LINH_DUOC', 'sam', 3, 'Sâm có tủy ngọc, tăng sinh khí huyết.');
raw('ld_han_nguyet_lien', 'Hàn Nguyệt Liên', 'LINH_DUOC', 'lien', 3, 'Sen nở dưới ánh trăng lạnh, mang hàn khí thanh lọc.');
raw('ld_xich_diem_hoa', 'Xích Diễm Hoa', 'LINH_DUOC', 'hoa', 3, 'Hoa đỏ như lửa, chứa dương khí cuồng liệt.');
raw('ld_dia_mach_chi', 'Địa Mạch Chi', 'LINH_DUOC', 'chi', 4, 'Chi thảo mọc theo địa mạch, nuôi dưỡng căn cơ.');
raw('ld_huyet_ngoc_qua', 'Huyết Ngọc Quả', 'LINH_DUOC', 'qua', 4, 'Quả đỏ như huyết ngọc, đại bổ khí huyết.');
raw('ld_cuu_diep_linh_chi', 'Cửu Diệp Linh Chi', 'LINH_DUOC', 'chi', 5, 'Linh chi chín lá ngàn năm, thánh dược bậc cao.');
raw('ld_bat_lao_tien_qua', 'Bất Lão Tiên Quả', 'LINH_DUOC', 'qua', 6, 'Tiên quả giữ tuổi xuân, chỉ nơi hiểm địa mới có.');
raw('ld_hon_nguyen_dao_qua', 'Hỗn Nguyên Đạo Quả', 'LINH_DUOC', 'qua', 7, 'Đạo quả hợp nhất âm dương, thiên địa chí bảo.');
raw('ld_dac_biet', 'Linh Dược Đặc Biệt', 'LINH_DUOC', 'dacbiet', 4, 'Linh dược hiếm từ Bí Cảnh — nguyên liệu luyện Đan Dược Phá Giới.',
  { store: 'col', legacy_col: 'linh_duoc_dac_biet' });

// ===================================================================== B. KHOÁNG VẬT
raw('kv_thanh_dong', 'Thanh Đồng Linh Quặng', 'KHOANG_VAT', 'quang', 1, 'Quặng đồng nhiễm linh khí, nền của luyện khí.');
raw('kv_huyen_tinh', 'Huyền Tinh Thạch', 'KHOANG_VAT', 'thach', 2, 'Đá đen óng ánh, bền và dẫn linh tốt.');
raw('kv_xich_huyet_thiet', 'Xích Huyết Thiết', 'KHOANG_VAT', 'thiet', 3, 'Sắt đỏ như máu, tăng sát khí cho binh khí.');
raw('kv_bang_phach_ngoc', 'Băng Phách Ngọc', 'KHOANG_VAT', 'ngoc', 3, 'Ngọc băng hàn ngàn năm, hộ thân tĩnh tâm.');
raw('kv_tu_kim_thach', 'Tử Kim Thạch', 'KHOANG_VAT', 'thach', 4, 'Kim thạch sắc tím, cứng và nhẹ.');
raw('kv_thien_ngoai_van_thiet', 'Thiên Ngoại Vẫn Thiết', 'KHOANG_VAT', 'thiet', 5, 'Thiên thạch từ ngoài trời rơi xuống, cực kỳ cứng.');
raw('kv_cuu_thien_kim_tinh', 'Cửu Thiên Kim Tinh', 'KHOANG_VAT', 'kim', 6, 'Tinh hoa kim loại chín tầng trời.');
raw('kv_hon_nguyen_kim_tinh', 'Hỗn Nguyên Kim Tinh', 'KHOANG_VAT', 'kim', 7, 'Kim tinh hỗn nguyên, vật liệu tối thượng của luyện khí.');
raw('kv_huyen_thiet', 'Huyền Thiết', 'KHOANG_VAT', 'thiet', 3, 'Sắt huyền từ Vạn Linh Cốc — nguyên liệu giáp trụ.', { store: 'col', legacy_col: 'huyen_thiet' });
raw('kv_tien_kim', 'Tiên Kim', 'KHOANG_VAT', 'kim', 5, 'Vàng tiên rơi từ Bí Cảnh cao — dùng rèn Phôi Khí Tiên.', { store: 'col', legacy_col: 'tien_kim' });
raw('kv_tien_ngoc', 'Tiên Ngọc', 'KHOANG_VAT', 'ngoc', 5, 'Ngọc tiên tinh khiết — dùng chế Ngọc Bội.', { store: 'col', legacy_col: 'tien_ngoc' });

// ===================================================================== C. YÊU THÚ TÀI LIỆU
raw('yt_yeu_dan', 'Yêu Đan', 'YEU_THU_TAI_LIEU', 'dan', 2, 'Nội đan của yêu thú, nguồn linh lực cô đặc. Linh Thú ăn được.');
raw('yt_tinh_huyet', 'Tinh Huyết Yêu Thú', 'YEU_THU_TAI_LIEU', 'huyet', 2, 'Máu tinh của yêu thú. Linh Thú ăn được.');
raw('yt_yeu_cot', 'Yêu Cốt', 'YEU_THU_TAI_LIEU', 'cot', 3, 'Xương yêu thú, cứng như thép.');
raw('yt_lan_giap', 'Lân Giáp', 'YEU_THU_TAI_LIEU', 'giap', 3, 'Vảy giáp của yêu thú, nguyên liệu giáp trụ.');
raw('yt_thu_hon', 'Thú Hồn', 'YEU_THU_TAI_LIEU', 'hon', 4, 'Tàn hồn yêu thú, dùng cho Linh/Chuông trấn hồn.');
raw('yt_hon_tinh', 'Hồn Tinh', 'YEU_THU_TAI_LIEU', 'hon', 5, 'Tinh hoa hồn phách, chất dẫn cho trận pháp.');
raw('yt_long_huyet', 'Long Huyết', 'YEU_THU_TAI_LIEU', 'huyet', 6, 'Máu rồng — đại bổ, luyện đan khí cấp cao.');
raw('yt_phuong_vu', 'Phượng Vũ', 'YEU_THU_TAI_LIEU', 'vu', 6, 'Lông phượng hoàng, bất diệt chi hỏa.');

// ===================================================================== D. TRẬN ĐẠO
raw('td_linh_mac', 'Linh Mặc', 'TRAN_DAO_TAI_LIEU', 'mac', 1, 'Mực pha linh khí để vẽ trận văn và phù chú.');
raw('td_phu_chi', 'Phù Chỉ', 'TRAN_DAO_TAI_LIEU', 'chi', 1, 'Giấy vẽ phù, nền của mọi lá bùa.');
raw('td_tran_van_thach', 'Trận Văn Thạch', 'TRAN_DAO_TAI_LIEU', 'thach', 2, 'Đá khắc được trận văn.');
raw('td_tran_ky', 'Trận Kỳ', 'TRAN_DAO_TAI_LIEU', 'ky', 2, 'Cờ trận trắng, chờ được khắc văn.');
raw('td_tran_ban_co_thach', 'Trận Bàn Cơ Thạch', 'TRAN_DAO_TAI_LIEU', 'thach', 3, 'Đá nền để dựng trận bàn.');
raw('td_thien_dien_sa', 'Thiên Diễn Sa', 'TRAN_DAO_TAI_LIEU', 'sa', 4, 'Cát diễn hoá thiên cơ, rắc vào trận để ổn định linh mạch.');
raw('td_khong_gian_phu_van', 'Không Gian Phù Văn', 'TRAN_DAO_TAI_LIEU', 'van', 5, 'Phù văn xé không gian — vật liệu của trận dịch chuyển.');

// ===================================================================== E. THIÊN ĐỊA TINH HOA
for (const [k, n, d] of [['kim', 'Kim', 'sắc bén'], ['moc', 'Mộc', 'sinh cơ'], ['thuy', 'Thủy', 'nhu hoà'], ['hoa', 'Hỏa', 'cuồng liệt'], ['tho', 'Thổ', 'vững chãi']]) {
  raw(`tdc_${k}_nguyen_tinh`, `${n} Nguyên Tinh`, 'LINH_TINH_TAI_LIEU', 'nguyentinh', 4, `Tinh hoa hành ${n} của trời đất, ${d}.`);
}
raw('tdc_phong_linh_tuy', 'Phong Linh Tủy', 'LINH_TINH_TAI_LIEU', 'tuy', 5, 'Tủy linh của gió, nhẹ và nhanh.');
raw('tdc_loi_linh_tuy', 'Lôi Linh Tủy', 'LINH_TINH_TAI_LIEU', 'tuy', 5, 'Tủy linh của sấm sét, giúp chống Thiên Kiếp.');
raw('tdc_hu_khong_toai_phien', 'Hư Không Toái Phiến', 'THIEN_DIA_CHI_BAO', 'phien', 6, 'Mảnh vỡ của hư không.');
raw('tdc_hon_don_nguyen_khi', 'Hỗn Độn Nguyên Khí', 'THIEN_DIA_CHI_BAO', 'khi', 7, 'Nguyên khí thuở hỗn độn sơ khai.');
// -- nguyên liệu đặc biệt (G)
raw('tdc_tan_quyen_dan_phuong', 'Tàn Quyển Đan Phương', 'THIEN_DIA_CHI_BAO', 'dacbiet', 4, 'Trang tàn của đan phương cổ — dùng được ngay để tăng thành thạo Đan Sư, hoặc làm nguyên liệu Tẩy Tủy Đan.');
raw('tdc_manh_ban_ve', 'Mảnh Bản Vẽ Pháp Bảo', 'THIEN_DIA_CHI_BAO', 'dacbiet', 4, 'Mảnh bản vẽ pháp bảo cổ — cần cho trang bị cao cấp và Tinh Luyện.');
raw('tdc_co_tran_do', 'Cổ Trận Đồ', 'THIEN_DIA_CHI_BAO', 'dacbiet', 5, 'Đồ hình trận pháp thượng cổ.');
raw('tdc_dan_hoa_tinh', 'Đan Hỏa Tinh', 'THIEN_DIA_CHI_BAO', 'dacbiet', 3, 'Tinh hoả dùng khống hoả hầu — tăng tỷ lệ thành công luyện đan khi dùng kèm.');
raw('tdc_khi_linh_hach', 'Khí Linh Hạch', 'THIEN_DIA_CHI_BAO', 'dacbiet', 4, 'Hạch khí linh — "linh hồn" của pháp khí.');
raw('tdc_thien_co_phu_van', 'Thiên Cơ Phù Văn', 'THIEN_DIA_CHI_BAO', 'dacbiet', 5, 'Phù văn thiên cơ, che giấu và phong ấn.');
// -- vật phẩm V16 chuyển danh mục (giữ nguyên cột & số lượng)
raw('tdc_hu_khong_tinh_hoa', 'Hư Không Tinh Hoa', 'THIEN_DIA_CHI_BAO', 'hukhong', 4, 'Tinh hoa hư không từ Vạn Linh Cốc — vật liệu trận Không Gian.', { store: 'col', legacy_col: 'hu_khong_tinh_hoa' });
raw('tdc_hu_khong_ket_tinh', 'Hư Không Kết Tinh', 'THIEN_DIA_CHI_BAO', 'hukhong', 6, 'Kết tinh hư không từ Bí Cảnh Hợp Thể.', { store: 'col', legacy_col: 'hu_khong_ket_tinh' });
raw('tdc_thien_hoa_tinh', 'Thiên Hỏa Tinh', 'THIEN_DIA_CHI_BAO', 'hoa', 5, 'Tinh hoả trời — nguyên liệu Tiên Nguyên Đan.', { store: 'col', legacy_col: 'thien_hoa_tinh' });
raw('tdc_thien_kiep_chi_luc', 'Thiên Kiếp Chi Lực', 'THIEN_DIA_CHI_BAO', 'kiep', 5, 'Dư lực của Thiên Kiếp — nguyên liệu Độ Kiếp Đan. (Vật phẩm tiến trình: không bán NPC)', { store: 'col', legacy_col: 'thien_kiep_chi_luc', can_sell: false });
raw('tdc_thien_dao_thach', 'Thiên Đạo Thạch', 'THIEN_DIA_CHI_BAO', 'daotien', 5, 'Đổi Thể Chất Bảo Thạch. (Vật phẩm tiến trình Thiên Đạo — không bán NPC)', { store: 'col', legacy_col: 'thien_dao_thach', can_sell: false, is_quest_item: true });
raw('tdc_dao_nguyen_tinh', 'Đạo Nguyên Tinh', 'THIEN_DIA_CHI_BAO', 'daotien', 6, 'Đổi Linh Căn Bảo Thạch. (Vật phẩm tiến trình Thiên Đạo — không bán NPC)', { store: 'col', legacy_col: 'dao_nguyen_tinh', can_sell: false, is_quest_item: true });
raw('tdc_thien_dao_an', 'Thiên Đạo Ấn', 'THIEN_DIA_CHI_BAO', 'daotien', 6, 'Ấn Thiên Đạo từ Thiên Kiếp Hóa Thân. (Vật phẩm tiến trình — không bán NPC)', { store: 'col', legacy_col: 'thien_dao_an', can_sell: false, is_quest_item: true });
raw('tdc_manh_tien_gioi_lenh', 'Mảnh Tiên Giới Lệnh', 'THIEN_DIA_CHI_BAO', 'phithang', 5, 'Mảnh ghép Tiên Giới Lệnh. (Vật phẩm tiến trình Phi Thăng — không bán NPC)', { store: 'col', legacy_col: 'manh_tien_gioi_lenh', can_sell: false, is_quest_item: true });
raw('tdc_manh_ghep_phithang', 'Mảnh ghép Phi Thăng Lệnh', 'THIEN_DIA_CHI_BAO', 'phithang', 4, 'Gom đủ để chế Phi Thăng Lệnh. (Vật phẩm tiến trình — không bán NPC)', { store: 'col', legacy_col: 'manh_ghep_phithang', can_sell: false, is_quest_item: true });
raw('tdc_linh_gioi_lenh', 'Linh Giới Lệnh', 'THIEN_DIA_CHI_BAO', 'phithang', 5, 'Lệnh bài Phi Thăng Linh Giới. (Vật phẩm tiến trình)', { store: 'col', legacy_col: 'linh_gioi_lenh', can_sell: false, is_quest_item: true, can_trade: false });
raw('tdc_tien_gioi_lenh', 'Tiên Giới Lệnh', 'THIEN_DIA_CHI_BAO', 'phithang', 6, 'Lệnh bài Phi Thăng Tiên Giới. (Vật phẩm tiến trình)', { store: 'col', legacy_col: 'tien_lenh', can_sell: false, is_quest_item: true, can_trade: false });
raw('tdc_linh_phu', 'Linh Phù', 'THIEN_DIA_CHI_BAO', 'phithang', 4, 'Phù cảm ngộ cho Con Đường Phi Thăng. (Vật phẩm tiến trình)', { store: 'col', legacy_col: 'linh_phu', can_sell: false, is_quest_item: true, can_trade: false });
raw('tdc_tien_phu', 'Tiên Phù', 'THIEN_DIA_CHI_BAO', 'phithang', 5, 'Phù cảm ngộ cho Phi Thăng Tiên Giới. (Vật phẩm tiến trình)', { store: 'col', legacy_col: 'tien_phu', can_sell: false, is_quest_item: true, can_trade: false });
raw('tdc_diem_linh_ngo', 'Điểm Linh Ngộ', 'THIEN_DIA_CHI_BAO', 'daotien', 4, 'Điểm cảm ngộ. (Vật phẩm tiến trình — không bán NPC)', { store: 'col', legacy_col: 'diem_linh_ngo', can_sell: false, is_quest_item: true, can_trade: false });

// ===================================================================== F. LINH THỰC
raw('lt_chung_thanh_linh', 'Linh Chủng Thanh Linh', 'LINH_THUC', 'chung', 1, 'Hạt giống Thanh Linh Thảo. Gieo ở Linh Điền.');
raw('lt_chung_tu_van', 'Linh Chủng Tử Vân', 'LINH_THUC', 'chung', 2, 'Hạt giống Tử Vân Hoa. Gieo ở Linh Điền.');
raw('lt_chung_han_nguyet', 'Linh Chủng Hàn Nguyệt', 'LINH_THUC', 'chung', 3, 'Hạt giống Hàn Nguyệt Liên. Gieo ở Linh Điền.');
raw('lt_chung_xich_diem', 'Linh Chủng Xích Diễm', 'LINH_THUC', 'chung', 3, 'Hạt giống Xích Diễm Hoa. Gieo ở Linh Điền.');
raw('lt_linh_tho', 'Linh Thổ', 'LINH_THUC', 'dat', 1, 'Đất linh — mỗi lần gieo hạt tiêu 1.');
raw('lt_linh_tuyen_thuy', 'Linh Tuyền Thủy', 'LINH_THUC', 'nuoc', 2, 'Nước suối linh — tưới Linh Điền, pha Dược Dịch.');
raw('lt_thuc_sinh_dich', 'Thúc Sinh Dịch', 'LINH_THUC', 'phan', 3, 'Dịch thúc sinh: giảm 30% thời gian sinh trưởng của 1 ô.', { price_mode: 'recipe' });
raw('lt_duong_mach_dich', 'Dưỡng Mạch Dịch', 'LINH_THUC', 'phan', 4, 'Dịch dưỡng mạch: tăng phẩm chất thu hoạch và tỉ lệ biến dị của 1 ô.', { price_mode: 'recipe' });

// ===================================================================== NGUYÊN LIỆU TRUNG GIAN
raw('nl_tap', 'Nguyên Liệu Tạp', 'NGUYEN_LIEU_TRUNG_GIAN', 'tap', 1, 'Nguyên liệu tạp từ Bí Cảnh (cột "Nguyên Liệu" của V16): làm chất đốt/phụ liệu, và thức ăn cơ bản của Linh Thú.',
  { store: 'col', legacy_col: 'nguyen_lieu' });
raw('nl_manh_phap_bao', 'Mảnh Pháp Bảo', 'NGUYEN_LIEU_TRUNG_GIAN', 'manh', 3, 'Mảnh pháp bảo vỡ từ Vạn Linh Cốc — chất xúc tác Cường Hoá / Tinh Luyện trang bị.', { store: 'col', legacy_col: 'manh_phap_bao' });
for (const [id, n, r] of [['so', 'Sơ Cấp', 2], ['trung', 'Trung Cấp', 3], ['cao', 'Cao Cấp', 4], ['tien', 'Tiên', 6]]) {
  raw(`dd_${id}`, `Dược Dịch ${n}`, 'NGUYEN_LIEU_TRUNG_GIAN', 'duocdich', r, `Dược dịch ${n.toLowerCase()} — bán thành phẩm của Đan Sư, nền để luyện đan.`, { price_mode: 'recipe' });
}
for (const [id, n, r] of [['dong', 'Đồng Linh Tinh Luyện', 2], ['huyen', 'Huyền Thiết Tinh Luyện', 3], ['tu', 'Tử Kim Tinh Luyện', 4], ['hon', 'Hỗn Nguyên Kim Tinh Luyện', 6]]) {
  raw(`kl_${id}`, n, 'NGUYEN_LIEU_TRUNG_GIAN', 'kimloai', r, 'Kim loại đã tinh luyện — bán thành phẩm của Luyện Khí Sư.', { price_mode: 'recipe' });
}
for (const [id, n, r] of [['tho', 'Phôi Khí Thô', 1], ['trung', 'Phôi Khí Trung', 3], ['cao', 'Phôi Khí Cao', 4], ['tien', 'Phôi Khí Tiên', 6]]) {
  raw(`pk_${id}`, n, 'NGUYEN_LIEU_TRUNG_GIAN', 'phoikhi', r, 'Phôi để đúc pháp khí — bán thành phẩm của Luyện Khí Sư.', { price_mode: 'recipe' });
}
for (const [id, n, r] of [['so', 'Trận Văn Sơ Cấp', 2], ['trung', 'Trận Văn Trung Cấp', 3], ['cao', 'Trận Văn Cao Cấp', 4]]) {
  raw(`tv_${id}`, n, 'NGUYEN_LIEU_TRUNG_GIAN', 'tranvan', r, 'Trận văn đã khắc — bán thành phẩm của Trận Pháp Sư.', { price_mode: 'recipe' });
}

// ===================================================================== SẢN PHẨM: ĐAN DƯỢC (có phẩm chất 1..5)
const pill = (id, name, desc, o = {}) => def({ id, name, cat: 'DAN_DUOC', sub: 'dan', rarity: 2, desc, quality: true, price_mode: 'recipe', ...o });
pill('dan_tu_khi', 'Tụ Khí Đan', 'Cắn nhận tu vi. (Chính là "Đan Dược" của V16 — số cũ nằm ở phẩm Trung Phẩm.)', { store: 'col', legacy_col: 'dan_duoc', legacy_q: 2, rarity: 1 });
pill('dan_ngung_nguyen', 'Ngưng Nguyên Đan', 'Nhận lượng tu vi lớn hơn Tụ Khí Đan (có giới hạn mỗi ngày).', { rarity: 3 });
pill('dan_huyet_nguyen', 'Huyết Nguyên Đan', 'Hồi phục Sinh Mệnh tức thì (không dùng khi Sinh Mệnh đã đầy).', { rarity: 1 });
pill('dan_thanh_tam', 'Thanh Tâm Đan', 'Giải trạng thái "tu luyện dồn dập" (mệt mỏi) và giảm mệt trong 30 phút.', { rarity: 2 });
pill('dan_ho_mach', 'Hộ Mạch Đan', 'Lần Đột Phá kế tiếp: giữ thêm tu vi khi thất bại và bị khoá ngắn hơn.', { rarity: 4 });
pill('dan_pha_canh', 'Phá Cảnh Đan', 'Tăng tỉ lệ Đột Phá cho đúng 1 lần thử kế tiếp.', { rarity: 4 });
pill('dan_ngung_than', 'Ngưng Thần Đan', 'Tăng Ngộ Tính tạm thời (ảnh hưởng tỉ lệ Đột Phá & Thiên Kiếp).', { rarity: 3 });
pill('dan_cuong_the', 'Cường Thể Đan', 'Tăng Sinh Mệnh tối đa tạm thời.', { rarity: 2 });
pill('dan_kim_cuong', 'Kim Cương Đan', 'Tăng Phòng Ngự tạm thời.', { rarity: 3 });
pill('dan_long_luc', 'Long Lực Đan', 'Tăng Công Kích tạm thời.', { rarity: 3 });
pill('dan_tat_phong', 'Tật Phong Đan', 'Tăng Thân Pháp (tốc độ) tạm thời.', { rarity: 3 });
pill('dan_han_ngoc', 'Hàn Ngọc Đan', 'Kháng Hỏa: giảm sát thương từ đối thủ/Boss hệ Hỏa.', { rarity: 4 });
pill('dan_liet_duong', 'Liệt Dương Đan', 'Kháng Hàn: giảm sát thương từ đối thủ/Boss hệ Thủy · Băng.', { rarity: 4 });
pill('dan_do_kiep', 'Độ Kiếp Đan', 'Hỗ trợ Thiên Kiếp: tăng tỉ lệ vượt Thiên Kiếp và giảm sát thương Cửu Lôi Kiếp.', { rarity: 5 });
pill('dan_tien_nguyen', 'Tiên Nguyên Đan', 'Đan dược tu vi cấp cao (giới hạn mỗi ngày, cần cảnh giới).', { rarity: 5 });
// -- đan V16 giữ nguyên (cột cũ)
def({ id: 'dan_pha_gioi', name: 'Đan Dược Phá Giới', cat: 'DAN_DUOC', sub: 'dan', rarity: 5, desc: 'Cắn để bỏ bớt 5 phút khoá Đột Phá khi thất bại.', store: 'col', legacy_col: 'dan_pha_gioi', price_mode: 'recipe' });
def({ id: 'dan_tay_tuy_ts', name: 'Đan Tẩy Tủy Trọng Sinh', cat: 'DAN_DUOC', sub: 'taytuy', rarity: 7, desc: 'Reroll Linh Căn + Thể Chất (vật phẩm hiếm, không chế được, không bán NPC).',
  store: 'col', legacy_col: 'dan_taytuy_trongsinh', can_sell: false, price_mode: 'fixed', base_value: 1e9 });
def({ id: 'dan_tay_tuy_nua', name: 'Đan Tẩy Tủy Nửa Tác Dụng', cat: 'DAN_DUOC', sub: 'taytuy', rarity: 6, desc: 'Reroll Linh Căn HOẶC Thể Chất (tự chọn). Đan Sư Thánh Sư chế được — rất đắt, 1 lần/ngày.',
  store: 'col', legacy_col: 'dan_taytuy_nuaban', can_sell: false, price_mode: 'fixed', base_value: 5e8 });

// ===================================================================== SẢN PHẨM: TRẬN PHÁP (có phẩm chất)
const tran = (id, name, desc, o = {}) => def({ id, name, cat: 'TRAN_PHAP', sub: 'tran', rarity: 3, desc, quality: true, price_mode: 'recipe', ...o });
tran('tp_tu_linh', 'Tụ Linh Trận Bàn', 'Triển khai: tăng tốc độ tu vi (Tu Luyện / Bế Quan / Bí Cảnh / Động Phủ) trong thời gian hiệu lực.', { rarity: 2 });
tran('tp_ho_than', 'Hộ Thân Trận Kỳ', 'Triển khai: tăng Phòng Ngự và giảm sát thương nhận ở PvP / Boss / Chiến Tông Môn.', { rarity: 3 });
tran('tp_sat_phat', 'Sát Phạt Trận Bàn', 'Triển khai: tăng Công Kích và Xuyên Giáp ở PvP / Boss / Chiến Tông Môn.', { rarity: 3 });
tran('tp_me_tung', 'Mê Tung Trận', 'Triển khai: tăng Né Tránh và tăng tỉ lệ rơi nguyên liệu ở Bí Cảnh / Boss / Chiến Tông Môn.', { rarity: 4 });
tran('tp_phong_an', 'Phong Ấn Phù', 'Dán lên đối thủ: trong số trận PvP/đòn Boss còn lại, đối thủ bị yếu đi và Boss phản đòn nhẹ hơn.', { rarity: 4 });
tran('tp_ho_tong', 'Hộ Tông Đại Trận', 'Tông chủ triển khai: cả Tông Môn được giảm sát thương trong Chiến Tông Môn và tăng tốc tu vi.', { rarity: 5 });
tran('tp_khong_gian', 'Không Gian Trận Bàn', 'Triển khai: mỗi lượt dịch chuyển thay cho 1 Vé Bí Cảnh Đặc Biệt (3 lượt trong thời gian hiệu lực).', { rarity: 5 });

// ===================================================================== VẬT PHẨM KHÁC (V16)
def({ id: 'vp_ruong_than_bi', name: 'Rương Thần Bí', cat: 'VAT_PHAM_KHAC', sub: 'ruong', rarity: 5, desc: 'Mở nhận Sao Công Pháp hoặc Đặc Quyền (1%).', store: 'col', legacy_col: 'ruong_than_bi', can_sell: false, price_mode: 'fixed', base_value: 2e6 });
def({ id: 'vp_ve_bicanh_db', name: 'Vé Bí Cảnh Đặc Biệt', cat: 'VAT_PHAM_KHAC', sub: 've', rarity: 5, desc: 'Vào Bí Cảnh Đặc Biệt 1 lần.', store: 'col', legacy_col: 've_bicanh_dac_biet', can_sell: false, price_mode: 'fixed', base_value: 1e6 });

// ===================================================================== TRANG BỊ (mẫu — thể hiện ở bảng gear, không phải stack)
const GEAR_TEMPLATE_IDS = ['gx_thanh_phong', 'gx_huyen_thiet_giap', 'gx_tu_linh_boi', 'gx_ho_tam_kinh', 'gx_tat_phong_ngoa', 'gx_tru_vat_gioi', 'gx_tran_hon_linh', 'gx_pha_thien_thuong'];

// ===================================================================== TIỆN ÍCH
const get = (id) => BY_ID[id] || null;
const byCat = (cat) => ITEMS.filter((i) => i.cat === cat);
const legacyItems = () => ITEMS.filter((i) => i.store === 'col');
const rarityOf = (id) => (BY_ID[id] ? RARITY[BY_ID[id].rarity - 1] : null);
const rawValue = (it) => (it.base_value !== undefined ? it.base_value : V0 * RARITY[it.rarity - 1].mult);

module.exports = { V0, NPC_RATE, RARITY, QUALITY, qName, qMult, CATEGORIES, ITEMS, BY_ID, GEAR_TEMPLATE_IDS, get, byCat, legacyItems, rarityOf, rawValue };
