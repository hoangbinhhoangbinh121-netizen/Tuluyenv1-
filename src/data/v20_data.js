'use strict';
/**
 * V20.0 — BẢNG DỮ LIỆU THUẦN (không phụ thuộc module khác): 10 giai đoạn sản xuất, tên nguyên liệu, đặc tả đan dược / trận pháp / trang bị.
 * Dùng chung cho data/items_v20.js (định nghĩa vật phẩm) và data/craft_v20.js (công thức, bảng rơi, khai thác...).
 * Ba khái niệm GIỮ RIÊNG: phẩm cấp nguyên liệu (rarity 1–7) · phẩm chất thành phẩm (1–5) · giai đoạn sản xuất (1–10, file này).
 */

/** 10 giai đoạn. band = [cảnh giới thấp nhất, cao nhất] (index 0–28) → mỗi cảnh giới thuộc đúng 1 giai đoạn.
 *  lv = cấp nghề tối thiểu (1–9) · rar = phẩm cấp nguyên liệu (1–7) · base = giá trị gốc của nguyên liệu giai đoạn (Linh Thạch). */
const STAGES = [
  { n: 1, id: 'pham', name: 'Phàm Cấp', band: [0, 1], lv: 1, rar: 1, base: 600, duoc: 'Phàm Dược', chung: 'Phàm Chủng', hoa: 'Phàm Hỏa', hoaName: 'Thanh Mộc Phàm Hỏa' },
  { n: 2, id: 'linh', name: 'Linh Cấp', band: [2, 3], lv: 2, rar: 2, base: 1800, duoc: 'Linh Dược', chung: 'Linh Chủng', hoa: 'Linh Hỏa', hoaName: 'Xích Diễm Linh Hỏa' },
  { n: 3, id: 'huyen', name: 'Huyền Cấp', band: [4, 5], lv: 3, rar: 3, base: 6000, duoc: 'Huyền Dược', chung: 'Huyền Chủng', hoa: 'Huyền Hỏa', hoaName: 'U Minh Huyền Hỏa' },
  { n: 4, id: 'dia', name: 'Địa Cấp', band: [6, 8], lv: 4, rar: 4, base: 22000, duoc: 'Địa Dược', chung: 'Địa Chủng', hoa: 'Địa Hỏa', hoaName: 'Địa Tâm Nham Hỏa' },
  { n: 5, id: 'thien', name: 'Thiên Cấp', band: [9, 10], lv: 5, rar: 5, base: 80000, duoc: 'Thiên Dược', chung: 'Thiên Chủng', hoa: 'Thiên Hỏa', hoaName: 'Cửu Thiên Lôi Hỏa' },
  { n: 6, id: 'tien', name: 'Tiên Cấp', band: [11, 13], lv: 6, rar: 6, base: 300000, duoc: 'Thánh Dược', chung: 'Thánh Chủng', hoa: 'Tiên Hỏa', hoaName: 'Bạch Ngọc Tiên Hỏa' },
  { n: 7, id: 'de', name: 'Đế Cấp', band: [14, 19], lv: 7, rar: 6, base: 1200000, duoc: 'Tiên Dược', chung: 'Tiên Chủng', hoa: 'Đế Hỏa', hoaName: 'Hoàng Kim Đế Hỏa' },
  { n: 8, id: 'daoto', name: 'Đạo Tổ Cấp', band: [20, 23], lv: 8, rar: 7, base: 5000000, duoc: 'Thần Dược', chung: 'Thần Chủng', hoa: 'Đạo Tổ Chi Hỏa', hoaName: 'Hỗn Nguyên Đạo Hỏa' },
  { n: 9, id: 'thiendao', name: 'Thiên Đạo Cấp', band: [24, 26], lv: 9, rar: 7, base: 20000000, duoc: 'Đế Dược', chung: 'Đế Chủng', hoa: 'Thiên Đạo Chi Hỏa', hoaName: 'Vô Cực Thiên Đạo Hỏa' },
  { n: 10, id: 'sieuthoat', name: 'Siêu Thoát Cấp', band: [27, 28], lv: 9, rar: 7, base: 80000000, duoc: 'Siêu Thoát Dược', chung: 'Siêu Thoát Chủng', hoa: 'Siêu Thoát Chi Hỏa', hoaName: 'Siêu Thoát Hư Không Hỏa' },
];
const stage = (n) => STAGES[Math.max(1, Math.min(10, n)) - 1];
/** Giai đoạn của 1 cảnh giới (0–28). */
const stageOfRealm = (realm) => { for (const s of STAGES) if (realm >= s.band[0] && realm <= s.band[1]) return s.n; return 10; };

const HERB = [['Phàm Căn Thảo', 'Sương Mai Hoa'], ['Linh Tâm Thảo', 'Ngưng Lộ Quả'], ['Huyền Âm Chi', 'Hắc Diệp Sâm'], ['Địa Long Sâm', 'Hậu Thổ Linh Chi'], ['Thiên Tuyền Hoa', 'Ngũ Sắc Linh Chi'],
  ['Thánh Quang Thảo', 'Bạch Ngọc Liên'], ['Tiên Lộ Kỳ Hoa', 'Vạn Niên Tiên Sâm'], ['Thần Hồn Thảo', 'Hỗn Linh Quả'], ['Đế Vương Hoa', 'Bất Tử Linh Chi'], ['Siêu Thoát Hư Liên', 'Vô Cực Đạo Quả']];
const ORE = [['Phàm Thiết Quặng', 'Sơn Thạch Tinh'], ['Linh Thiết Quặng', 'Thanh Ngọc Thạch'], ['Huyền Thiết Tinh', 'Ô Kim Thạch'], ['Địa Tâm Kim', 'Hậu Thổ Tinh Thạch'], ['Thiên Ngoại Thiết Tinh', 'Lôi Kích Thạch'],
  ['Tiên Kim Quặng', 'Tiên Ngọc Tủy'], ['Đế Kim Tinh', 'Huyền Hoàng Thạch'], ['Đạo Tổ Kim Hạch', 'Hỗn Nguyên Tinh Thạch'], ['Thiên Đạo Kim Tinh', 'Vô Cực Thần Thạch'], ['Siêu Thoát Hư Kim', 'Hỗn Độn Tinh Thạch']];
const BEAST = ['Nanh Sói Phàm', 'Linh Lang Giác', 'Huyền Quy Giáp', 'Địa Long Lân', 'Thiên Bằng Vũ', 'Tiên Hạc Cốt', 'Chân Long Giác', 'Đạo Tổ Thú Hồn', 'Thiên Đạo Thú Hạch', 'Siêu Thoát Thú Tinh'];
const TRANMAT = ['Phù Chỉ Phàm Văn', 'Linh Văn Thạch', 'Huyền Văn Sa', 'Địa Mạch Trận Thạch', 'Thiên Cơ Trận Tinh', 'Tiên Văn Ngọc', 'Đế Văn Kim Tủy', 'Đạo Tổ Văn Hạch', 'Thiên Đạo Văn Tinh', 'Siêu Thoát Văn Hạch'];
const KL = ['Phàm Thiết Tinh Luyện', 'Linh Thiết Tinh Luyện', 'Huyền Thiết Hợp Kim', 'Địa Tâm Hợp Kim', 'Thiên Ngoại Hợp Kim', 'Tiên Kim Tinh Luyện', 'Đế Kim Tinh Luyện', 'Đạo Tổ Kim Tinh Luyện', 'Thiên Đạo Kim Tinh Luyện', 'Siêu Thoát Kim Tinh Luyện'];
const PK = ['Phôi Phàm Khí', 'Phôi Linh Khí', 'Phôi Huyền Khí', 'Phôi Địa Khí', 'Phôi Thiên Khí', 'Phôi Tiên Khí Thượng', 'Phôi Đế Khí', 'Phôi Đạo Tổ Khí', 'Phôi Thiên Đạo Khí', 'Phôi Siêu Thoát Khí'];

/** Trận văn / dược dịch theo giai đoạn (id có sẵn ở V17 dùng lại, id mới ở V20). */
const TV_OF = ['tv_so', 'tv_so', 'tv_trung', 'tv_trung', 'tv_cao', 'tv_tien', 'tv_than', 'tv_de', 'tv_thiendao', 'tv_sieuthoat'];
const DD_OF = ['dd_so', 'dd_trung', 'dd_cao', 'dd_cao', 'dd_tien', 'dd_than', 'dd_than', 'dd_de', 'dd_de', 'dd_sieuthoat'];

const ID = {
  herb: (n, k) => `v20_ld_${n}${k}`, ore: (n, k) => `v20_kv_${n}${k}`, beast: (n) => `v20_yt_${n}`, tran: (n) => `v20_td_${n}`, seed: (n, k) => `v20_ch_${n}${k}`,
  kl: (n) => `v20_kl_${n}`, pk: (n) => `v20_pk_${n}`, tv: (n) => TV_OF[n - 1], dd: (n) => DD_OF[n - 1], hoachung: (n) => `v20_hc_${n}`, bv: (n) => `v20_bv_${n}`, scroll: (rid) => `v20_ct_${rid}`,
  phe: 'v20_phe_dan', hoatinh: 'v20_hoa_tinh',
};

// ===================================================================== ĐAN DƯỢC (11 nhóm theo spec; mỗi viên có hiệu ứng thật qua dan17/fx17)
const N_HP = ['Hồi Xuân Đan', 'Linh Sinh Đan', 'Huyền Sinh Đan', 'Địa Nguyên Hồi Đan', 'Thiên Sinh Đan', 'Tiên Lộ Hồi Đan', 'Đế Sinh Đan', 'Đạo Tổ Hồi Sinh Đan', 'Thiên Đạo Sinh Đan', 'Siêu Thoát Hồi Sinh Đan'];
const N_TU = ['Dưỡng Khí Đan', 'Tụ Linh Đan', 'Huyền Tu Đan', 'Địa Tâm Tu Đan', 'Thiên Tu Đan', 'Tiên Tu Đan', 'Đế Tu Đan', 'Đạo Tổ Tu Đan', 'Thiên Đạo Tu Đan', 'Siêu Thoát Tu Đan'];
const N_PHA = ['Phá Chướng Đan', 'Huyền Phá Đan', 'Địa Phá Đan', 'Thiên Phá Đan', 'Tiên Phá Đan', 'Đế Phá Đan', 'Đạo Tổ Phá Đan', 'Thiên Đạo Phá Đan', 'Siêu Thoát Phá Đan'];
const N_TAM = ['Ninh Thần Đan', 'Định Hồn Đan', 'Địa Hồn Đan', 'Thiên Hồn Đan', 'Tiên Hồn Đan', 'Đế Hồn Đan', 'Đạo Hồn Đan', 'Thiên Đạo Hồn Đan', 'Siêu Thoát Hồn Đan'];
const N_ATTR = ['Cường Thân Đan', 'Linh Lực Đan', 'Huyền Cương Đan', 'Địa Hộ Đan', 'Thiên Lực Đan', 'Tiên Thể Đan', 'Đế Thể Đan', 'Đạo Thể Đan', 'Thiên Đạo Thể Đan', 'Siêu Thoát Thể Đan'];
const N_BAN = ['Huyền Bản Nguyên Đan', 'Địa Bản Nguyên Đan', 'Thiên Bản Nguyên Đan', 'Tiên Bản Nguyên Đan', 'Đế Bản Nguyên Đan', 'Đạo Tổ Bản Nguyên Đan', 'Thiên Đạo Bản Nguyên Đan', 'Siêu Thoát Bản Nguyên Đan'];
const N_KIEP = ['Thiên Kiếp Hộ Đan', 'Tiên Kiếp Hộ Đan', 'Đế Kiếp Hộ Đan', 'Đạo Kiếp Hộ Đan', 'Thiên Đạo Kiếp Hộ Đan', 'Siêu Thoát Kiếp Hộ Đan'];
const ATTR_KEY = ['atk', 'def', 'hp', 'spd'];
const SPECIAL = {
  6: { type: 'tg', name: 'Tiên Giới Linh Đan', fx: { tu: 0.08 }, desc: 'Đan dược Tiên Giới: tăng tốc độ tu vi.' },
  7: { type: 'dc', name: 'Đế Cảnh Chiến Đan', fx: { atk: 0.08, def: 0.08, dr: 0.03 }, desc: 'Đan dược Đế Cảnh: tăng chiến lực toàn diện.' },
  10: { type: 'st', name: 'Siêu Thoát Chí Đan', fx: { tu: 0.10, ngo: 3, bt: 0.04 }, desc: 'Đan dược Siêu Thoát: tu vi, ngộ tính và đột phá.' },
};
const TYPE_LABEL = { hp: 'Hồi phục', tu: 'Tu luyện', pha: 'Đột phá', tam: 'Bảo vệ tâm thần', attr: 'Tăng thuộc tính', ban: 'Bản nguyên', kiep: 'Hỗ trợ độ kiếp', tg: 'Đan dược Tiên Giới', dc: 'Đan dược Đế Cảnh', st: 'Đan dược Siêu Thoát', tt: 'Thất truyền' };
const r4 = (x) => Math.round(x * 1e4) / 1e4;

/** Sinh đặc tả đan dược: { id, name, stage, type, rar, pill: {k, ...effect}, desc }. */
function pillSpecs() {
  const out = [];
  for (const S of STAGES) {
    const n = S.n; const rar = Math.min(7, S.rar);
    const add = (type, name, pill, desc, extra = {}) => out.push({ id: `v20_dp_${type}_${n}`, name, stage: n, type, rar, pill, desc, ...extra });
    add('hp', N_HP[n - 1], { k: 'heal', pct: Math.min(0.5, 0.3 + 0.02 * n), max: 0.6, soft: 10, hard: 20 }, `Đan dược hồi phục ${S.name}: hồi Sinh Mệnh tức thì.`);
    add('tu', N_TU[n - 1], { k: 'tuvi', lo: Math.round(80 * 2.2 ** (n - 1)), hi: Math.round(130 * 2.2 ** (n - 1)), soft: n <= 3 ? 4 : n <= 6 ? 3 : 2, hard: n <= 3 ? 8 : n <= 6 ? 6 : 4, realm: S.band[0] }, `Đan dược tu luyện ${S.name}: cộng tu vi ngay.`);
    if (n >= 2) add('pha', N_PHA[n - 2], { k: 'buff', key: `v20_pha_${n}`, dur: 3600, fx: { bt: r4(0.02 + 0.003 * n) }, soft: 2, hard: 4 }, `Đan dược đột phá ${S.name}: tăng tỉ lệ Đột Phá trong 1 giờ.`);
    if (n >= 2) add('tam', N_TAM[n - 2], { k: 'buff', key: `v20_tam_${n}`, dur: 3600, fx: { ngo: Math.min(3, 1 + Math.floor(n / 3)), fatigueCut: 0.15 }, soft: 2, hard: 4 }, `Đan dược bảo vệ tâm thần ${S.name}: tăng Ngộ Tính, giảm mệt tu luyện, dưỡng hồn.`);
    const ak = ATTR_KEY[(n - 1) % 4];
    add('attr', N_ATTR[n - 1], { k: 'buff', key: `v20_attr_${n}`, dur: 3600, fx: { [ak]: r4(0.06 + 0.008 * n) }, soft: 3, hard: 6 }, `Đan dược tăng thuộc tính ${S.name}: tăng ${({ atk: 'Công Kích', def: 'Phòng Ngự', hp: 'Sinh Mệnh', spd: 'Tốc Độ' })[ak]}.`);
    if (n >= 3) add('ban', N_BAN[n - 3], { k: 'buff', key: `v20_ban_${n}`, dur: 3600, fx: { hp: r4(0.05 + 0.006 * n), regen: 0.1 }, soft: 2, hard: 4 }, `Đan dược bản nguyên ${S.name}: nuôi dưỡng bản nguyên, tăng Sinh Mệnh và hồi phục.`);
    if (n >= 5) add('kiep', N_KIEP[n - 5], { k: 'buff', key: `v20_kiep_${n}`, dur: 7200, fx: { tk: r4(0.02 + 0.004 * n), kiep: r4(0.04 + 0.01 * (n - 4)) }, soft: 1, hard: 2 }, `Đan dược hỗ trợ độ kiếp ${S.name}: tăng tỉ lệ vượt Thiên Kiếp, giảm sát thương kiếp.`);
    if (SPECIAL[n]) add(SPECIAL[n].type, SPECIAL[n].name, { k: 'buff', key: `v20_${SPECIAL[n].type}_${n}`, dur: 3600, fx: SPECIAL[n].fx, soft: 2, hard: 3 }, SPECIAL[n].desc);
  }
  // Đan THẤT TRUYỀN (cần học công thức): hiệu ứng tổng hợp mạnh nhất giai đoạn từ Thiên Cấp
  const TT = ['Thiên Đạo Phục Sinh Đan', 'Tiên Thiên Tạo Hóa Đan', 'Đế Vương Bất Hủ Đan', 'Đạo Tổ Hỗn Nguyên Đan', 'Thiên Đạo Vô Cực Đan', 'Siêu Thoát Hư Không Đan'];
  for (let n = 5; n <= 10; n += 1) {
    const S = stage(n); const k = n - 4;
    out.push({ id: `v20_dp_tt_${n}`, name: TT[k - 1], stage: n, type: 'tt', rar: Math.min(7, S.rar), rare: true,
      pill: { k: 'buff', key: `v20_tt_${n}`, dur: 3600, fx: { atk: r4(0.05 + 0.006 * k), def: r4(0.05 + 0.006 * k), hp: r4(0.05 + 0.006 * k), tu: r4(0.03 + 0.004 * k) }, soft: 1, hard: 2 },
      desc: `Đan phương THẤT TRUYỀN ${S.name}: tăng đồng thời Công, Thủ, Sinh Mệnh và tốc độ tu vi (mỗi ngày dùng rất ít).` });
  }
  return out;
}

// ===================================================================== TRẬN PHÁP MỚI (công thức thất truyền — cần học)
const TRAN_SPECS = [
  { id: 'tp20_tran_ap', name: 'Trấn Áp Đại Trận', stage: 4, group: 'Trấn Áp', rar: 4, dur: 3600, upkeep: 14000, fx: { foe: 0.07, bossDr: 0.25 }, daily: 4, desc: 'Triển khai: trấn áp đối thủ, giảm đòn Boss.' },
  { id: 'tp20_tu_linh_tien', name: 'Tiên Tụ Linh Trận', stage: 6, group: 'Tụ Linh', rar: 6, dur: 7200, upkeep: 40000, fx: { tu: 0.14 }, daily: 4, desc: 'Triển khai: tăng tốc độ tu vi mạnh hơn Tụ Linh Trận thường.' },
  { id: 'tp20_ho_than_de', name: 'Đế Hộ Thân Trận', stage: 7, group: 'Phòng Ngự', rar: 6, dur: 3600, upkeep: 90000, fx: { def: 0.15, dr: 0.07 }, daily: 4, desc: 'Triển khai: Phòng Ngự và giảm sát thương cấp Đế.' },
  { id: 'tp20_sat_phat_de', name: 'Đế Sát Phạt Trận', stage: 8, group: 'Hỗ Trợ', rar: 7, dur: 2700, upkeep: 220000, fx: { atk: 0.15, pierce: 0.07 }, daily: 4, desc: 'Triển khai: Công Kích và Xuyên Giáp cấp Đạo Tổ.' },
  { id: 'tp20_dao_to', name: 'Đạo Tổ Hộ Tông Trận', stage: 8, group: 'Hộ Tông', rar: 7, dur: 14400, upkeep: 300000, fx: { sectDr: 0.08, sectTu: 0.06 }, daily: 2, sect: true, desc: 'Tông chủ triển khai: Tông Môn giảm sát thương và tăng tu vi mạnh hơn Hộ Tông Đại Trận.' },
  { id: 'tp20_thien_dia', name: 'Thiên Địa Đại Trận', stage: 9, group: 'Thiên Địa', rar: 7, dur: 3600, upkeep: 600000, fx: { tu: 0.12, loot: 0.12 }, daily: 3, desc: 'Triển khai: tăng tu vi và cơ duyên rơi đồ.' },
  { id: 'tp20_khong_gian_de', name: 'Đế Không Gian Trận Bàn', stage: 9, group: 'Không Gian', rar: 7, dur: 10800, upkeep: 600000, charges: 5, fx: { teleport: 1 }, daily: 1, desc: 'Triển khai: 5 lượt dịch chuyển thay Vé Bí Cảnh Đặc Biệt.' },
  { id: 'tp20_chung_cuc', name: 'Chung Cực Trận', stage: 10, group: 'Chung Cực', rar: 7, dur: 2700, upkeep: 1500000, fx: { atk: 0.12, def: 0.12, dr: 0.08 }, daily: 2, desc: 'Triển khai: tăng đồng thời Công, Thủ và giảm sát thương.' },
];

// ===================================================================== TRANG BỊ GIAI ĐOẠN TIÊN → SIÊU THOÁT (7 ô × 5 giai đoạn = 35 mẫu)
const GEAR_ADJ = ['Tiên Quang', 'Đế Uy', 'Đạo Tổ', 'Thiên Đạo', 'Siêu Thoát'];
const GEAR_NOUN = { weapon: 'Kiếm', armor: 'Giáp', jade: 'Ngọc Bội', mirror: 'Hộ Tâm Kính', boots: 'Ngoa', ring: 'Giới Chỉ', bell: 'Linh' };
const GEAR_ORDER = ['weapon', 'armor', 'jade', 'mirror', 'boots', 'ring', 'bell'];
function gearSpecs() {
  const out = [];
  for (let n = 6; n <= 10; n += 1) {
    const k = n - 5; const S = stage(n); const adj = GEAR_ADJ[k - 1];
    const pri = {
      weapon: { atk: r4(0.09 + 0.008 * k) }, armor: { def: r4(0.07 + 0.006 * k), hp: r4(0.04 + 0.004 * k) }, jade: { tu: r4(0.05 + 0.004 * k), hp: 0.03 },
      mirror: { def: 0.03, hp: r4(0.03 + 0.003 * k) }, boots: { spd: r4(0.07 + 0.006 * k) }, ring: { loot: r4(0.04 + 0.003 * k), hp: 0.03 }, bell: { hp: 0.05, dr: r4(0.03 + 0.003 * k) },
    };
    const sec = {
      weapon: { pierce: 0.05, crit: 0.03 }, armor: { dr: 0.03 }, jade: { regen: 0.15, loot: 0.02 }, mirror: { failKeep: 0.02, dr: 0.02, dodge: 0.02 }, boots: { dodge: 0.03 },
      ring: { tu: 0.02, regen: 0.10 }, bell: { bossDr: 0.06, lifesteal: 0.02 },
    };
    for (const slot of GEAR_ORDER) out.push({ id: `gx20_${slot}_${n}`, name: `${adj} ${GEAR_NOUN[slot]}`, slot, tier: n, pri: pri[slot], secPool: sec[slot], dur: 300 + 50 * k, realm: S.band[0] });
  }
  return out;
}

// ===================================================================== DỊ HỎA (10 loại) — hệ thống hỗ trợ Đan Sư; Đan Hỏa Tinh (tdc_dan_hoa_tinh) vẫn chỉ là nguyên liệu xúc tác
const FIRE_SKILLS = [{ lv: 3, name: 'Hỏa Văn', fx: { qup: 0.03 }, desc: '+3% dịch phẩm chất' }, { lv: 6, name: 'Dưỡng Hỏa', fx: { save: 0.05 }, desc: '+5% hoàn nguyên liệu khi chế' }, { lv: 9, name: 'Hỏa Tâm', fx: { dbl: 0.03 }, desc: '+3% ra gấp đôi' }];
const FIRE_MAXLV = 10;
const fireExpNeed = (lv) => 20 * lv * lv;     // EXP để từ cấp lv → lv+1
const FIRE_EVOLVE_GOLD = (n) => Math.round(30000 * 4 ** (n - 1));

module.exports = {
  STAGES, stage, stageOfRealm, HERB, ORE, BEAST, TRANMAT, KL, PK, TV_OF, DD_OF, ID, TYPE_LABEL, pillSpecs, TRAN_SPECS, gearSpecs, GEAR_ORDER, GEAR_NOUN, FIRE_SKILLS, FIRE_MAXLV, fireExpNeed, FIRE_EVOLVE_GOLD, r4,
};
