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
  mkRealm('Đại La Kim Tiên', SUB_4), mkRealm('Tiên Đế', null),
];

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
const EXP_GATE_MINOR_MULT = _gm('EXP_GATE_MINOR_MULT', 0.40)   // v16: giảm mạnh (v14.x: 0.90);
const EXP_GATE_MAJOR_MULT = _gm('EXP_GATE_MAJOR_MULT', 0.25)   // v16: giảm mạnh (v14.x: 0.65);

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
  HOATHAN_REALM_IDX, HOATHAN_VIENMAN_STAGE, DOKIEP_REALM_IDX, DOKIEP_VIENMAN_STAGE, EXP_REQUIRED_MULT, EXP_GATE_MINOR_MULT, EXP_GATE_MAJOR_MULT,
  _REALM_SPEED_MAX_KNOWN: Math.max(...Object.keys(C.REALM_SPEED_MULT).map(Number)),
};
