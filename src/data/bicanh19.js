'use strict';
/**
 * BÍ CẢNH TIÊN GIỚI V19.0 — 19 bí cảnh (Chân Tiên → Siêu Thoát), mỗi bí cảnh 5 tầng. DỮ LIỆU THUẦN (không logic): xem game/bicanh19.js.
 * Chỉ số quái/Boss KHÔNG ghi số tuyệt đối: là hệ số nhân với Công Kích / Sinh Mệnh của người chơi (spec §2.5) để bí cảnh luôn "vừa tầm" cảnh giới.
 */
const REALM0 = 10;   // bí cảnh số 0 yêu cầu Chân Tiên (chỉ số cảnh giới 10) … bí cảnh số 18 yêu cầu Siêu Thoát (28)

// [tên bí cảnh, Boss cuối, từ khoá kỹ năng, tiền tố quái, mini Boss, Boss canh cửa, hành tương khắc (Boss yếu hành này), hành Boss kháng, mô tả]
const RAW = [
  ['Chân Tiên Cổ Động', 'Cổ Động Tiên Tôn', 'Cổ Động', 'Cổ Động', 'Tiên Cốt Thống Lĩnh', 'Cổ Động Hộ Pháp', 'Hỏa', 'Mộc', 'Động phủ cổ của một vị Tiên Tôn đã vẫn lạc, tiên khí còn vương nơi vách đá.'],
  ['Kim Tiên Thần Khư', 'Kim Giáp Thần Tướng', 'Kim Giáp', 'Kim Giáp', 'Kim Quang Sứ Giả', 'Thần Khư Thủ Vệ', 'Hỏa', 'Mộc', 'Tàn tích thần khư dát vàng, nơi thần tướng cổ còn canh giữ.'],
  ['Thái Ất Hỗn Nguyên Giới', 'Hỗn Nguyên Ma Quân', 'Hỗn Nguyên', 'Hỗn Nguyên', 'Thái Ất Ma Tướng', 'Hỗn Nguyên Thủ Quan', 'Kim', 'Thổ', 'Tiểu giới hỗn nguyên, ma khí và tiên khí quyện vào nhau.'],
  ['Đại La Thiên Cung', 'Đại La Thiên Chủ', 'Đại La', 'Đại La', 'Thiên Cung Thị Vệ Trưởng', 'Đại La Thiên Tướng', 'Thủy', 'Hỏa', 'Thiên cung nguy nga treo giữa hư không, mỗi bậc thang là một thử thách.'],
  ['Vương Giả Cổ Mộ', 'Bất Diệt Vương Thi', 'Vương Thi', 'Vương Mộ', 'Vương Mộ Thủ Quan', 'Cổ Mộ Âm Tướng', 'Hỏa', 'Thủy', 'Cổ mộ của các Tiên Vương, thi khí bất diệt.'],
  ['Vạn Cổ Tiên Vương Điện', 'Vạn Cổ Tiên Vương', 'Vương', 'Vương Điện', 'Vương Điện Cấm Vệ', 'Điện Chủ Thủ Hộ', 'Kim', 'Mộc', 'Đại điện của Vạn Cổ Tiên Vương, vương uy trấn áp vạn đạo.'],
  ['Cửu U Tôn Giả Giới', 'Cửu U Tôn Chủ', 'Cửu U', 'Cửu U', 'Cửu U Tôn Giả', 'U Giới Chấp Pháp', 'Hỏa', 'Thủy', 'Giới vực u minh nơi các Tôn Giả ngủ say.'],
  ['Tôn Giả Thần Điện', 'Vô Thượng Tôn Giả', 'Tôn Giả', 'Tôn Điện', 'Thần Điện Hộ Pháp', 'Tôn Điện Chí Cường Giả', 'Mộc', 'Kim', 'Thần điện của Tôn Giả, mỗi tầng một đạo chướng.'],
  ['Đế Đạo Cổ Lộ', 'Đế Đạo Thủ Hộ Giả', 'Đế Đạo', 'Đế Lộ', 'Cổ Lộ Dẫn Đạo Giả', 'Đế Lộ Chấp Kiếm', 'Thủy', 'Hỏa', 'Con đường cổ dẫn tới Đế Cảnh, vô số kẻ bỏ mạng nơi đây.'],
  ['Vô Thượng Đế Cung', 'Bất Hủ Đế Linh', 'Bất Hủ', 'Đế Cung', 'Đế Cung Cấm Quân', 'Đế Cung Thái Giám Trưởng', 'Hỏa', 'Thổ', 'Đế cung vô thượng, Đế Linh bất hủ vẫn ngự trên ngai.'],
  ['Tiên Tổ Di Giới', 'Tiên Tổ Tàn Niệm', 'Tàn Niệm', 'Tổ Giới', 'Di Giới Thủ Hộ Linh', 'Tàn Niệm Phân Thân', 'Kim', 'Mộc', 'Di giới của Tiên Tổ, tàn niệm lưu lại qua vạn kỷ.'],
  ['Vạn Cổ Tiên Tổ Lăng', 'Vạn Cổ Tiên Tổ', 'Tiên Tổ', 'Tổ Lăng', 'Tổ Lăng Hộ Vệ', 'Lăng Chủ Tế Tư', 'Thủy', 'Hỏa', 'Lăng tẩm của Vạn Cổ Tiên Tổ, thời gian ngưng đọng.'],
  ['Đạo Nguyên Cấm Khu', 'Đạo Nguyên Thủ Hộ Thần', 'Đạo Nguyên', 'Đạo Nguyên', 'Cấm Khu Chấp Pháp', 'Đạo Nguyên Linh Thú', 'Hỏa', 'Thủy', 'Cấm khu nơi đạo nguyên trào ra, kẻ yếu hóa tro.'],
  ['Vạn Đạo Thiên Vực', 'Vạn Đạo Đạo Tổ', 'Vạn Đạo', 'Vạn Đạo', 'Thiên Vực Đạo Sứ', 'Đạo Vực Chí Tôn Vệ', 'Mộc', 'Kim', 'Thiên vực hội tụ vạn đạo, mỗi đạo một Boss.'],
  ['Thiên Đạo Chi Môn', 'Thiên Đạo Hóa Thân', 'Thiên Đạo', 'Thiên Môn', 'Thiên Môn Chấp Kiếm', 'Môn Hộ Pháp Tắc', 'Kim', 'Mộc', 'Cánh cửa dẫn tới Thiên Đạo — qua cửa là chấp nhận bị Thiên Đạo phán xét.'],
  ['Thiên Đạo Bản Nguyên', 'Cổ Thiên Đạo', 'Cổ Đạo', 'Bản Nguyên', 'Bản Nguyên Thần Sứ', 'Bản Nguyên Thủ Cổ', 'Thổ', 'Thủy', 'Nơi Thiên Đạo sinh ra, pháp tắc trần trụi.'],
  ['Đại Đạo Thần Khư', 'Đại Đạo Chi Linh', 'Đại Đạo', 'Đại Đạo', 'Thần Khư Đại Đạo Sứ', 'Đại Đạo Chấp Pháp', 'Hỏa', 'Thủy', 'Thần khư của Đại Đạo, mọi quy tắc đều bị bẻ cong.'],
  ['Chí Tôn Cấm Địa', 'Vô Thượng Chúa Tể', 'Chúa Tể', 'Chí Tôn', 'Cấm Địa Thủ Hộ Tôn', 'Chí Tôn Thân Vệ', 'Mộc', 'Kim', 'Cấm địa của các Chí Tôn, nơi chỉ kẻ vô thượng mới đặt chân.'],
  ['Siêu Thoát Chi Hải', 'Hư Vô Siêu Thoát Giả', 'Siêu Thoát', 'Hư Vô', 'Hải Vực Siêu Thoát Sứ', 'Chi Hải Thủ Hộ Giả', 'Thổ', 'Thủy', 'Biển hư vô bên ngoài mọi cảnh giới — đích đến cuối cùng.'],
];

// Hệ số độ khó (spec §2.7) — được HIỆU CHỈNH nhẹ khi áp dụng (xem game/bicanh19.js DIFF_EASE) để Boss vẫn đánh được trong 15–30 lượt tấn công.
const DIFF = [[1.00, 1.00], [1.08, 1.05], [1.16, 1.10], [1.25, 1.15], [1.35, 1.20], [1.48, 1.28], [1.62, 1.35], [1.78, 1.43], [1.95, 1.52], [2.15, 1.62],
  [2.38, 1.73], [2.63, 1.85], [2.90, 1.98], [3.20, 2.12], [3.55, 2.28], [3.95, 2.45], [4.40, 2.65], [4.90, 2.88], [5.50, 3.15]];

// 5 loại quái thường (spec §2.4): hp/atk/def là hệ số tương đối; skill = cơ chế
const MOB_KINDS = [
  { key: 'lang', suffix: 'Tiên Lang', hp: 1.0, atk: 0.12, def: 0.10, skill: { name: 'Xé Rách', mult: 1.3 } },
  { key: 'cot', suffix: 'Cốt Chiến Binh', hp: 1.4, atk: 0.10, def: 0.25, skill: { name: 'Cốt Giáp', mult: 1.0, shield: 0.10 } },
  { key: 'hon', suffix: 'U Hồn', hp: 0.8, atk: 0.16, def: 0.08, skill: { name: 'Hồn Kích', mult: 1.4, pierce: 0.25 } },
  { key: 'thu', suffix: 'Thái Cổ Thú', hp: 1.8, atk: 0.14, def: 0.18, skill: { name: 'Cuồng Bạo', mult: 1.2, rage: 0.20 } },
  { key: 'thuho', suffix: 'Thủ Hộ Giả', hp: 2.5, atk: 0.18, def: 0.30, skill: { name: 'Trấn Áp', mult: 1.2, weaken: [0.10, 2] } },
];
const SPEC_MOBS_0 = ['Cổ Động Tiên Lang', 'Tiên Cốt Chiến Binh', 'U Minh Tiên Hồn', 'Thái Cổ Tiên Thú', 'Cổ Động Thủ Hộ Giả'];   // đúng tên spec §2.4 cho bí cảnh đầu
const ELITE_SUFFIX = ['Thống Lĩnh', 'Tinh Anh Vệ'];

// Spec §2.5: các khoảng hệ số theo loại (HP × P_ATK, ATK × P_HP, DEF × P_ATK) và sát thương phản công (% P_HP)
const KINDS = {
  normal: { hp: [2, 4], atk: 0.12, def: 0.08, counter: [0.02, 0.04] },
  elite: { hp: [6, 9], atk: 0.17, def: 0.15, counter: [0.03, 0.05] },
  mini: { hp: [12, 16], atk: 0.23, def: 0.22, counter: [0.04, 0.06] },
  guard: { hp: [22, 28], atk: 0.27, def: 0.28, counter: [0.05, 0.07] },
  final: { hp: [35, 45], atk: 0.30, def: 0.32, counter: [0.06, 0.09] },
};
const BOSS_KINDS = new Set(['mini', 'guard', 'final']);

// Cấu trúc 5 tầng (spec §2.3). waves: danh sách "lượt" quái; chest = tỉ lệ rương
const FLOORS = [
  { n: 1, name: 'Ngoại Vi', waves: ['normal', 'normal', 'normal', 'normal', 'normal'], chest: 0.10, commonRate: 0.70, rareMult: 1.0, fragRate: 0, desc: 'Vùng rìa — quái phổ thông, tài nguyên phổ thông dễ nhặt.' },
  { n: 2, name: 'Cổ Địa', waves: ['normal', 'normal', 'elite', 'normal', 'elite'], chest: 0.15, commonRate: 0.65, rareMult: 1.0, fragRate: 1, desc: 'Có quái tinh anh, bắt đầu rơi mảnh công pháp.' },
  { n: 3, name: 'Thâm Uyên', waves: ['normal', 'elite', 'normal', 'elite', 'mini'], chest: 0.20, commonRate: 0.65, rareMult: 1.4, fragRate: 1, desc: '4 lượt quái và 1 mini Boss; nguyên liệu hiếm tăng, có sự kiện truyền thừa.', legacy: true },
  { n: 4, name: 'Cấm Khu', waves: ['elite', 'elite', 'elite', 'guard'], chest: 0.25, commonRate: 0.65, rareMult: 1.5, fragRate: 1.2, desc: '3 lượt tinh anh và Boss canh cửa — không thể bỏ qua.', treasure: true },
  { n: 5, name: 'Chung Cực Chi Địa', waves: ['final'], chest: 0, commonRate: 0.65, rareMult: 1.8, fragRate: 1.5, desc: 'Boss cuối độc quyền, 3 giai đoạn. Hạ gục để ghi nhận chinh phục.', final: true },
];

// Sự kiện ngẫu nhiên giữa các lượt (tự áp dụng, hiển thị trong nhật ký)
const EVENTS = [
  { key: 'suoi', text: '⛲ Gặp **suối linh khí** — cả đội hồi 20% sinh mệnh.', fx: { heal: 0.20 } },
  { key: 'dan', text: '🧘 Gặp **tàn ý tu sĩ cổ** — hồi đầy Linh Lực.', fx: { ll: 100 } },
  { key: 'bay', text: '🪤 Giẫm phải **cấm chế cổ** — mỗi người mất 8% sinh mệnh.', fx: { dmg: 0.08 } },
  { key: 'phu', text: '📜 Nhặt được **phù lục** — +10% công kích cho cả tầng.', fx: { atk: 0.10 } },
  { key: 'khien', text: '🛡️ Được **khí tức cổ bảo** che chở — nhận khiên 10% sinh mệnh.', fx: { shield: 0.10 } },
  { key: 'thuong', text: '🧳 Gặp **thương nhân hư không** — nhận thêm 10% Linh Thạch của tầng.', fx: { lt: 0.10 } },
  { key: 'yen', text: '🌫️ Không có gì xảy ra — bí cảnh yên tĩnh.', fx: {} },
];

// Vật phẩm rơi: lấy từ items_v19 theo nguồn bc19_<i>; nhóm hiếm = bậc 7; riêng vật phẩm Chứng Đạo được ưu tiên số lượng
// v19.10: Bất Hủ Đế Cốt trước đây chỉ rơi ở bí cảnh 9–12 (yêu cầu Tiên Đế — cảnh giới chỉ có SAU khi Chứng Đạo) nên người chưa Chứng Đạo không thể gom đủ 5 → mở thêm ở bí cảnh 8 (Đế Đạo Cổ Lộ, Chuẩn Tiên Đế); Bản Nguyên tăng [3,7]→[5,10] để bù vì bí cảnh 8 nay có 2 vật phẩm hiếm.
const MAT_BOOST = { tdc19_de_dao_ban_nguyen: [5, 10], tdc19_tien_ton_dao_qua: [1, 2], tdc19_bat_hu_de_cot: [1, 2], tdc19_tien_nguyen_tinh: [1, 3] };
// Boss cuối bí cảnh 8: Bất Hủ Đế Cốt — lần đầu chinh phục chắc chắn có 1, các lần sau xác suất này
const DE_COT_BOSS8 = 0.30;
// Mảnh công pháp theo bí cảnh (id mảnh → chỉ số bí cảnh có thể rơi)
const FRAG_BY_BC = {
  8: ['manh19_tran_the', 'manh19_bat_hu'], 9: ['manh19_de_kinh', 'manh19_tran_the', 'manh19_bat_hu'], 10: ['manh19_hu_khong', 'manh19_thoi_gian'],
  11: ['manh19_khai_thien'], 13: ['manh19_quy_nguyen'], 15: ['manh19_ban_nguyen'],
};
// Rơi thẳng công pháp từ Boss cuối: [tier, xác suất]
const BOOK_BY_BC = {
  0: [[1041, 0.05]], 4: [[1042, 0.05]], 5: [[1043, 0.05]], 6: [[1044, 0.05]], 7: [[1045, 0.05]], 8: [[1047, 0.03], [1048, 0.03]], 9: [[1046, 0.04], [1047, 0.02], [1048, 0.02]],
  10: [[1049, 0.03], [1050, 0.03]], 11: [[1051, 0.03]], 13: [[1052, 0.03]], 15: [[1053, 0.03]], 17: [[1054, 0.02]], 18: [[1055, 0.01], [1054, 0.01]],
};
// Truyền thừa đặc biệt (1%/lần ở tầng 3, 5): rơi Công Pháp cực hiếm (nếu có) hoặc bộ vật liệu lớn
const LEGACY_BOOK = { 9: 1046, 11: 1051, 13: 1052, 15: 1053, 17: 1054, 18: 1055 };

const BCS = RAW.map((r, i) => {
  const [name, finalBoss, T, prefix, mini, guard, weak, resist, desc] = r;
  const mobs = MOB_KINDS.map((k, j) => ({ ...k, name: i === 0 ? SPEC_MOBS_0[j] : `${prefix} ${k.suffix}` }));
  const elites = ELITE_SUFFIX.map((s) => `${prefix} ${s}`);
  // Bộ kỹ năng Boss cuối (spec §2.6). Bí cảnh Vạn Cổ Tiên Vương dùng đúng tên trong spec.
  const skills = i === 5
    ? ['Vương Uy Trấn Áp', 'Vạn Đạo Quy Nhất', 'Tiên Vương Pháp Tướng', 'Vương Đạo Phá Diệt', 'Bất Diệt Vương Thể']
    : [`${T} Uy Trấn Áp`, `${T} Quy Nhất`, `${T} Pháp Tướng`, `${T} Phá Diệt`, `Bất Diệt ${T} Thể`];
  return Object.freeze({
    idx: i, realm: REALM0 + i, name, final: finalBoss, theme: T, mini, guard, mobs, elites, weak, resist, desc, skills, diff: { hp: DIFF[i][0], atk: DIFF[i][1] },
    requireName: null,
  });
});

module.exports = { REALM0, BCS, DIFF, MOB_KINDS, KINDS, BOSS_KINDS, FLOORS, EVENTS, MAT_BOOST, FRAG_BY_BC, BOOK_BY_BC, LEGACY_BOOK, ELITE_SUFFIX, DE_COT_BOSS8 };
