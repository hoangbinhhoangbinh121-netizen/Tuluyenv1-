'use strict';
/**
 * Hằng số & dữ liệu game.
 * Phần lớn được TỰ TRÍCH từ tuluyenbot.py sang src/data/constants.json (không gõ lại tay → không sai số liệu).
 * Ở đây chỉ bổ sung các hằng số mà bản Python tính bằng biểu thức (REALMS, mốc Hóa Thần...).
 */
const C = require('../data/constants.json');

const TANG_20 = Array.from({ length: 20 }, (_, i) => `Tầng ${i + 1}`);
const TANG_23 = Array.from({ length: 23 }, (_, i) => `Tầng ${i + 1}`);
const SUB_4 = C.SUB_4;
const mkRealm = (name, stages) => ({ name, emoji: '', stages }); // emoji cảnh giới: lấy động từ game/emoji.js (realmEmoji)

const REALMS = [
  mkRealm('Phàm Nhân', null),
  mkRealm('Luyện Khí', TANG_20), mkRealm('Trúc Cơ', TANG_20), mkRealm('Kết Đan', TANG_20),
  mkRealm('Nguyên Anh', TANG_20), mkRealm('Hóa Thần', TANG_20),
  mkRealm('Luyện Hư', TANG_23), mkRealm('Hợp Thể', TANG_23), mkRealm('Đại Thừa', TANG_23), mkRealm('Độ Kiếp', TANG_23),
  mkRealm('Chân Tiên', SUB_4), mkRealm('Kim Tiên', SUB_4), mkRealm('Thái Ất Kim Tiên', SUB_4),
  mkRealm('Đại La Kim Tiên', SUB_4),
  // v18.0: 15 đại cảnh giới mới (14–28), mỗi cái đúng 4 tiểu cảnh giới Sơ Kỳ / Trung Kỳ / Hậu Kỳ / Viên Mãn. Đây là NGUỒN DỮ LIỆU DUY NHẤT của cảnh giới.
  mkRealm('Chuẩn Tiên Vương', SUB_4), mkRealm('Tiên Vương', SUB_4),
  mkRealm('Chuẩn Tiên Tôn', SUB_4), mkRealm('Tiên Tôn', SUB_4),
  mkRealm('Chuẩn Tiên Đế', SUB_4), mkRealm('Tiên Đế', SUB_4),
  mkRealm('Chuẩn Tiên Tổ', SUB_4), mkRealm('Tiên Tổ', SUB_4),
  mkRealm('Chuẩn Đạo Tổ', SUB_4), mkRealm('Đạo Tổ', SUB_4),
  mkRealm('Chuẩn Thiên Đạo', SUB_4), mkRealm('Thiên Đạo', SUB_4),
  mkRealm('Đại Đạo Chí Tôn', SUB_4), mkRealm('Vô Thượng Chí Tôn', SUB_4),
  mkRealm('Siêu Thoát', SUB_4),
];
const MAX_REALM_IDX = REALMS.length - 1;                 // 28 = Siêu Thoát (Viên Mãn = đỉnh cao nhất hiện tại)
const DAILA_REALM_IDX = 13;                              // Đại La Kim Tiên: mốc bắt đầu công thức tăng tu vi chậm hơn (xem game/realm.js)
const OLD_TIENDE_REALM_IDX = 14;                         // (trước v18.0) Tiên Đế cũ — cảnh giới cuối, không có tiểu cảnh giới → migrateV18 chuyển sang TIEN_DE_REALM_IDX Viên Mãn
const TIEN_DE_REALM_IDX = REALMS.findIndex((r) => r.name === 'Tiên Đế');   // 19

// v18.0: với 29 cảnh giới, công thức ×3 / đại cảnh giới (và ×1,35 hệ số tốc độ) sẽ TRÀN số nguyên khi lên tới Siêu Thoát (3^28 × 50^tier > 2^63).
// Từ SAU Đại La Kim Tiên (idx 13) tăng chậm hơn: mỗi đại cảnh giới ×3^(1/6) mốc tu vi, ×1,35^(1/6) hệ số tốc độ — nên 6 bậc sau Đại La Kim Tiên (tức Tiên Đế mới, idx 19)
// ra ĐÚNG mức 1 bậc cũ (Tiên Đế cũ, idx 14) → người chơi Tiên Đế cũ không bị lạm phát/thiếu hụt tu vi, linh thạch khi chuyển sang cảnh giới mới.
const HIGH_REALM_GROWTH = 3 ** (1 / 6);
const HIGH_REALM_SPEED_STEP = 1.35 ** (1 / 6);
// Trần an toàn của mốc tu vi: 9×10^15 < Number.MAX_SAFE_INTEGER (2^53-1) — số lớn hơn không còn chính xác trong JS / cột INTEGER đọc về bằng number.
const TU_VI_REQUIRED_CAP = 9e15;

const totalStageCount = (realmIdx) => {
  const st = REALMS[realmIdx].stages;
  return st ? st.length : 1;
};

// v12.4.1: hệ số nhân MỐC TU VI cần để đột phá (mọi cảnh giới/tầng/thế giới) — chỉ cần đổi con số này (hoặc đặt biến môi trường
// EXP_REQUIRED_MULT trong .env / Startup của host). TỐC ĐỘ tu luyện & phần thưởng tu vi KHÔNG đổi: chúng được tính từ mốc GỐC
// (R.tuViRequiredBase), còn mốc đã nhân hệ số (R.tuViRequired) chỉ dùng để đột phá / hiển thị / trần. Xem game/realm.js.
const EXP_REQUIRED_MULT_DEFAULT = 240;   // v13.4: giảm từ 1200 xuống 240 (÷5); gốc ban đầu x1
const _envMult = Number(process.env.EXP_REQUIRED_MULT);
const EXP_REQUIRED_MULT = Number.isFinite(_envMult) && _envMult > 0 ? _envMult : EXP_REQUIRED_MULT_DEFAULT;

// v14.0: giảm mốc tu vi cần để đột phá — ĐẠI cảnh giới (tầng cuối của mỗi cảnh giới → cảnh giới kế) giảm nhiều hơn, TIỂU cảnh giới (các tầng trong cảnh giới) chỉ giảm nhẹ.
// Chỉ tác động tới R.tuViRequired (điều kiện đột phá/hiển thị); R.tuViRequiredBase (tốc độ & phần thưởng tu vi) KHÔNG đổi. Có thể chỉnh bằng env EXP_GATE_MAJOR_MULT / EXP_GATE_MINOR_MULT.
const _gm = (name, def) => { const v = Number(process.env[name]); return Number.isFinite(v) && v > 0 ? v : def; };
const EXP_GATE_MINOR_MULT = _gm('EXP_GATE_MINOR_MULT', 0.20)   // v16.1: giảm tiếp (v16.0: 0.40; v14.x: 0.90);
const EXP_GATE_MAJOR_MULT = _gm('EXP_GATE_MAJOR_MULT', 0.12)   // v16.1: giảm tiếp (v16.0: 0.25; v14.x: 0.65);

// v17.1: mốc tu vi để đột phá TRÊN Độ Kiếp Viên Mãn (tức bước vào & đi trong các cảnh giới Tiên) nhân thêm hệ số này (mặc định x7).
// Chỉ tác động R.tuViRequired (điều kiện đột phá/hiển thị); tốc độ & phần thưởng tu vi tính từ mốc GỐC nên KHÔNG đổi. Env TIEN_EXP_MULT để chỉnh.
const TIEN_EXP_MULT = _gm('TIEN_EXP_MULT', 7);

const HOATHAN_REALM_IDX = 5;
const HOATHAN_VIENMAN_STAGE = totalStageCount(HOATHAN_REALM_IDX) - 1;
const DOKIEP_REALM_IDX = 9;
const DOKIEP_VIENMAN_STAGE = totalStageCount(DOKIEP_REALM_IDX) - 1;

// Admin: ID mặc định lấy từ bản Python + thêm bằng biến môi trường ADMIN_IDS="id1,id2" (trong .env / Startup của host).
const EXTRA_ADMINS = String(process.env.ADMIN_IDS || '').split(/[,\s]+/).filter((x) => /^\d{15,}$/.test(x));
const mergeIds = (arr) => [...new Set([...(arr || []).map(String), ...EXTRA_ADMINS])];

const ADMIN_CODE_APPROVER_IDS = mergeIds(C.ADMIN_CODE_APPROVER_IDS);
const ADMIN_DISCORD_IDS = mergeIds(C.ADMIN_DISCORD_IDS);
/** Thêm admin lúc đang chạy (vd chủ bot tự dò được sau khi đăng nhập). Hai mảng được dùng chung nên có hiệu lực ngay. */
function addAdmin(id) {
  const s = String(id || '');
  if (!/^\d{15,}$/.test(s)) return false;
  if (!ADMIN_CODE_APPROVER_IDS.includes(s)) ADMIN_CODE_APPROVER_IDS.push(s);
  if (!ADMIN_DISCORD_IDS.includes(s)) ADMIN_DISCORD_IDS.push(s);
  return true;
}

module.exports = {
  ...C,
  ADMIN_CODE_APPROVER_IDS, ADMIN_DISCORD_IDS, addAdmin, REALMS, TANG_20, TANG_23, totalStageCount,
  MAX_REALM_IDX, DAILA_REALM_IDX, HIGH_REALM_GROWTH, HIGH_REALM_SPEED_STEP, TU_VI_REQUIRED_CAP, OLD_TIENDE_REALM_IDX, TIEN_DE_REALM_IDX,
  HOATHAN_REALM_IDX, HOATHAN_VIENMAN_STAGE, DOKIEP_REALM_IDX, DOKIEP_VIENMAN_STAGE, EXP_REQUIRED_MULT, EXP_GATE_MINOR_MULT, EXP_GATE_MAJOR_MULT, TIEN_EXP_MULT,
  _REALM_SPEED_MAX_KNOWN: Math.max(...Object.keys(C.REALM_SPEED_MULT).map(Number)),
};
