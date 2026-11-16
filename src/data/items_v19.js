'use strict';
/**
 * VẬT PHẨM V19.0 — 25 vật phẩm Bí Cảnh Tiên Giới (spec §3.2) + 2 vật phẩm tiến trình Chứng Đạo + 5 vật liệu nâng cấp công pháp (spec §4.4).
 * Mỗi vật phẩm có ID, mô tả, nguồn rơi, công dụng, giá trị (catalog17.validate() kiểm tra: không vật phẩm nào mồ côi).
 * install(def) được gọi từ data/items_v17.js; SRC / USES / SRC_LABEL / USE_LABEL được catalog17.js gộp vào bảng nguồn/công dụng.
 */
// [id, tên, bậc nguyên liệu, mô tả, nguồn (chỉ số bí cảnh bắt đầu..kết thúc), công dụng]
const MATS = [
  ['tdc19_chan_tien_ngoc_tuy', 'Chân Tiên Ngọc Tủy', 5, 'Tủy ngọc kết tinh trong Cổ Động Chân Tiên. Nguyên liệu nâng cấp Công Pháp (Nhập Môn → Tiểu Thành).', [0, 3], ['cp_up', 'debinh']],
  ['tdc19_kim_tien_ban_nguyen', 'Kim Tiên Bản Nguyên', 5, 'Bản nguyên kim quang của Thần Khư Kim Tiên. Nguyên liệu nâng cấp Công Pháp và chế Đế Binh.', [1, 4], ['cp_up', 'debinh']],
  ['tdc19_thai_at_tien_tinh', 'Thái Ất Tiên Tinh', 5, 'Tinh thể tiên khí của Hỗn Nguyên Giới. Nguyên liệu nâng cấp Công Pháp.', [2, 5], ['cp_up']],
  ['tdc19_dai_la_dao_thach', 'Đại La Đạo Thạch', 6, 'Đá chứa đạo vận Đại La. Nguyên liệu nâng cấp Công Pháp (Tiểu Thành → Đại Thành) và chế Đế Binh.', [3, 6], ['cp_up', 'debinh']],
  ['tdc19_hon_nguyen_tien_tuy', 'Hỗn Nguyên Tiên Tủy', 6, 'Tiên tủy hỗn nguyên từ Thiên Cung Đại La. Dùng nâng cấp Công Pháp, Đế Đạo.', [3, 7], ['cp_up', 'dedao']],
  ['tdc19_vuong_dao_chan_huyet', 'Vương Đạo Chân Huyết', 6, 'Máu thật của Tiên Vương cổ. Dùng chế Đế Binh và nâng Đế Đạo.', [4, 7], ['debinh', 'dedao']],
  ['tdc19_tien_ton_dao_qua', 'Tiên Tôn Đạo Quả', 6, 'Đạo quả của Tiên Tôn. Điều kiện Chứng Đạo (cần 10 quả) và nâng cấp Công Pháp.', [6, 9], ['chungdao', 'cp_up']],
  ['tdc19_de_dao_ban_nguyen', 'Đế Đạo Bản Nguyên', 7, 'Bản nguyên của Đế Đạo. Điều kiện Chứng Đạo (cần 100) và nâng Đế Đạo.', [8, 11], ['chungdao', 'dedao']],
  ['tdc19_bat_hu_de_cot', 'Bất Hủ Đế Cốt', 7, 'Xương của Đế Linh bất hủ. Điều kiện Chứng Đạo (cần 5) và chế Đế Binh.', [9, 12], ['chungdao', 'debinh']],
  ['tdc19_de_cung_co_an', 'Đế Cung Cổ Ấn', 7, 'Cổ ấn từ Vô Thượng Đế Cung. Chế Đế Binh và nâng Đế Đạo.', [9, 12], ['debinh', 'dedao']],
  ['tdc19_tien_to_chan_huyet', 'Tiên Tổ Chân Huyết', 7, 'Máu thật của Tiên Tổ. Nâng cấp Công Pháp (Đại Thành → Viên Mãn) và Đế Binh.', [10, 13], ['cp_up', 'debinh']],
  ['tdc19_van_dao_nguyen_tinh', 'Vạn Đạo Nguyên Tinh', 7, 'Nguyên tinh của vạn đạo. Nâng cấp Công Pháp và Đế Đạo.', [11, 14], ['cp_up', 'dedao']],
  ['tdc19_dao_to_dao_qua', 'Đạo Tổ Đạo Quả', 7, 'Đạo quả của Đạo Tổ. Nâng cấp Công Pháp (Viên Mãn → Hóa Cảnh).', [12, 15], ['cp_up']],
  ['tdc19_thien_dao_phap_tac', 'Thiên Đạo Pháp Tắc', 7, 'Mảnh pháp tắc Thiên Đạo. Nâng Đế Đạo và chế Đế Binh.', [14, 16], ['dedao', 'debinh']],
  ['tdc19_dai_dao_ban_nguyen', 'Đại Đạo Bản Nguyên', 7, 'Bản nguyên Đại Đạo. Nâng cấp Công Pháp và Đế Đạo.', [15, 17], ['cp_up', 'dedao']],
  ['tdc19_hu_vo_nguyen_thach', 'Hư Vô Nguyên Thạch', 7, 'Thạch nguyên từ Chí Tôn Cấm Địa. Chế Đế Binh cấp cao.', [16, 18], ['debinh']],
  ['tdc19_sieu_thoat_chan_tuy', 'Siêu Thoát Chân Tủy', 7, 'Chân tủy từ Siêu Thoát Chi Hải. Nâng cấp Công Pháp (Hóa Cảnh → Đăng Phong).', [17, 18], ['cp_up']],
  ['tdc19_vinh_hang_dao_qua', 'Vĩnh Hằng Đạo Quả', 7, 'Đạo quả vĩnh hằng. Nâng Đế Đạo (mốc thức tỉnh).', [17, 18], ['dedao']],
  ['tdc19_chung_cuc_ban_nguyen', 'Chung Cực Bản Nguyên', 7, 'Bản nguyên chung cực. Chế Đế Binh cấp cuối.', [18, 18], ['debinh']],
  ['tdc19_sieu_thoat_co_an', 'Siêu Thoát Cổ Ấn', 7, 'Cổ ấn siêu thoát. Nâng Đế Đạo và chế Đế Binh cấp cuối.', [18, 18], ['dedao', 'debinh']],
];
// 5 vật liệu nâng cấp Công Pháp theo giai đoạn (spec §4.4)
const STAGE_MATS = [
  ['cp19_tien_nguyen_tinh', 'Tiên Nguyên Tinh', 5, 'Nguyên liệu nâng Công Pháp Nhập Môn → Tiểu Thành (cấp 10 → 11).', [0, 8]],
  ['cp19_dao_van_co_ngoc', 'Đạo Văn Cổ Ngọc', 6, 'Nguyên liệu nâng Công Pháp Tiểu Thành → Đại Thành (cấp 30 → 31).', [3, 12]],
  ['cp19_ban_nguyen_tinh', 'Bản Nguyên Tinh', 6, 'Nguyên liệu nâng Công Pháp Đại Thành → Viên Mãn (cấp 50 → 51).', [6, 15]],
  ['cp19_cong_phap_chan_giai', 'Công Pháp Chân Giải', 7, 'Nguyên liệu nâng Công Pháp Viên Mãn → Hóa Cảnh (cấp 70 → 71).', [9, 18]],
  ['cp19_truyen_thua_co_dao', 'Truyền Thừa Cổ Đạo', 7, 'Nguyên liệu nâng Công Pháp Hóa Cảnh → Đăng Phong (cấp 90 → 91).', [12, 18]],
];
const QUEST = [
  ['tdc19_de_dao_chung_nhan', 'Đế Đạo Chứng Nhận', 7, 'Chứng nhận được Đế Đạo công nhận — điều kiện Chứng Đạo (cần 1). Rơi từ Boss cuối bí cảnh Chuẩn Tiên Đế trở lên (lần đầu chắc chắn).', [8, 18]],
  ['tdc19_de_an', 'Đế Ấn', 7, 'Đế Ấn nhận được khi Chứng Đạo thành Đế — mở khóa Đế Đạo, Đế Binh, Đế Hiệu. (Vật phẩm tiến trình)', null],
];

const EV_MATS = new Set(['tdc19_de_dao_ban_nguyen', 'tdc19_van_dao_nguyen_tinh', 'tdc19_de_cung_co_an', 'tdc19_bat_hu_de_cot', 'tdc19_tien_ton_dao_qua', 'tdc19_sieu_thoat_chan_tuy', 'tdc19_vinh_hang_dao_qua', 'tdc19_chung_cuc_ban_nguyen', 'tdc19_hu_vo_nguyen_thach', 'tdc19_sieu_thoat_co_an']);
const SRC = {}; const USES = {};
const SRC_LABEL = {}; const USE_LABEL = {
  cp_up: 'Nâng cấp Công Pháp (mốc giai đoạn)', chungdao: 'Chứng Đạo Thành Đế (điều kiện)', dedao: 'Nâng / thức tỉnh Đế Đạo', debinh: 'Chế / cường hóa Đế Binh',
  bm_awaken: 'Thức tỉnh Công Pháp Bản Mệnh', cp_stage: 'Qua mốc giai đoạn Công Pháp (cấp 10/30/50/70/90)', de_lenh: 'Mở khóa Đế Đạo · Đế Binh · Đế Hiệu',
};
const bcKeys = (a, b) => { const out = []; for (let i = a; i <= b; i += 1) out.push(`bc19_${i}`); return out; };

function install(def) {
  for (const [id, name, rarity, desc, range, uses] of MATS) {
    def({ id, name, cat: 'THIEN_DIA_CHI_BAO', sub: 'bc19', rarity, desc, can_sell: false, can_trade: id !== 'tdc19_de_dao_ban_nguyen' && id !== 'tdc19_bat_hu_de_cot' && id !== 'tdc19_tien_ton_dao_qua' });
    SRC[id] = [...bcKeys(range[0], range[1]), ...(EV_MATS.has(id) ? ['ev19'] : [])]; USES[id] = uses;
  }
  for (const [id, name, rarity, desc, range] of STAGE_MATS) {
    def({ id, name, cat: 'NGUYEN_LIEU_TRUNG_GIAN', sub: 'cp19', rarity, desc, can_sell: false, can_trade: false });
    SRC[id] = [...bcKeys(range[0], range[1]), 'ev19']; USES[id] = ['cp_stage', 'bm_awaken'];
  }
  for (const [id, name, rarity, desc, range] of QUEST) {
    def({ id, name, cat: 'THIEN_DIA_CHI_BAO', sub: 'quest19', rarity, desc, can_sell: false, can_trade: false, is_quest_item: true });
    if (range) { SRC[id] = [...bcKeys(range[0], range[1]), 'ev19']; USES[id] = ['chungdao']; } else { SRC[id] = ['chungdao_done']; USES[id] = ['de_lenh']; }
  }
}
for (let i = 0; i <= 18; i += 1) SRC_LABEL[`bc19_${i}`] = `Bí Cảnh Tiên Giới #${i + 1}`;
SRC_LABEL.ev19 = 'Sự Kiện Thế Giới (Đế Cảnh Xuất Thế · Siêu Thoát Chi Môn · Vạn Cổ Truyền Thừa)';
SRC_LABEL.chungdao_done = 'Chứng Đạo thành công (Tiên Đế)';
const IDS = [...MATS, ...STAGE_MATS, ...QUEST].map((x) => x[0]);
const STAGE_MAT_AT = { 10: 'cp19_tien_nguyen_tinh', 30: 'cp19_dao_van_co_ngoc', 50: 'cp19_ban_nguyen_tinh', 70: 'cp19_cong_phap_chan_giai', 90: 'cp19_truyen_thua_co_dao' };   // cấp hiện tại → vật liệu cần để lên cấp kế
module.exports = { install, SRC, USES, SRC_LABEL, USE_LABEL, IDS, STAGE_MAT_AT };
