'use strict';
/** Bảng màu CHÍNH THỨC của Tiên Giới UI v7.0 — không module nào được tự chọn màu mới. */
const COLORS = {
  PRIMARY: 0xD6B56D,     // Thiên Đạo Kim — tiêu đề, danh hiệu
  BACKGROUND: 0x151A23,  // Hắc Ngọc
  SURFACE: 0x202B3B,     // Mặc Lam
  CULTIVATION: 0x63D6C2, // Linh Ngọc — tu luyện, linh lực
  INFO: 0x65BDEB,        // Thiên Thanh — thông tin, trung tính
  DANGER: 0xE36C75,      // Huyết Ngọc — cảnh báo, nguy hiểm, thất bại
  SUCCESS: 0x75C98B,     // Sinh Cơ — thành công, hồi phục
  SPECIAL: 0xB99AE8,     // Tử Tinh — hiếm, truyền thừa, thần thông
  SYSTEM: 0x8B9BB4,      // Hệ thống
  WARNING: 0xD6B56D,
};
const PALETTE = [...new Set(Object.values(COLORS))];

/** Nhóm giao diện → màu + biểu tượng pixel (key trong game/emoji.js) + tên header. */
const CATEGORY = {
  thiendao: { color: COLORS.PRIMARY, emoji: 'loa', mark: '✦', name: 'THIÊN ĐẠO' },
  nhanvat: { color: COLORS.INFO, emoji: 'thanhvien', mark: '👤', name: 'NHÂN VẬT' },
  tuluyen: { color: COLORS.CULTIVATION, emoji: 'tuluyen', mark: '☯', name: 'TU LUYỆN' },
  dotpha: { color: COLORS.PRIMARY, emoji: 'dotpha', mark: '✦', name: 'ĐỘT PHÁ' },
  chiendau: { color: COLORS.DANGER, emoji: 'kiem', mark: '⚔', name: 'CHIẾN ĐẤU' },
  tongmon: { color: COLORS.PRIMARY, emoji: 'tongmon', mark: '🏯', name: 'TÔNG MÔN' },
  bicanh: { color: COLORS.SPECIAL, emoji: 'bicanh', mark: '🌌', name: 'BÍ CẢNH' },
  kinhte: { color: COLORS.SUCCESS, emoji: 'linhthach', mark: '💎', name: 'KINH TẾ' },
  vatpham: { color: COLORS.INFO, emoji: 'khodo', mark: '🎒', name: 'TÚI TRỮ VẬT' },
  nhiemvu: { color: COLORS.PRIMARY, emoji: 'linhphu', mark: '📜', name: 'NHIỆM VỤ' },
  hethong: { color: COLORS.SYSTEM, emoji: 'caidat', mark: '⚙', name: 'HỆ THỐNG' },
  boss: { color: COLORS.DANGER, emoji: 'bosstg', mark: '🐉', name: 'THẾ GIỚI' },
};

/** Màu cũ (v6) → màu mới gần nhất, để mọi Embed cũ tự đồng bộ bảng màu. */
const LEGACY_MAP = new Map([
  [0x3498db, COLORS.INFO], [0xf1c40f, COLORS.PRIMARY], [0x99aab5, COLORS.SYSTEM], [0x1f8b4c, COLORS.SUCCESS], [0xe67e22, COLORS.PRIMARY],
  [0x9b59b6, COLORS.SPECIAL], [0x11806a, COLORS.CULTIVATION], [0x5865f2, COLORS.INFO], [0xe74c3c, COLORS.DANGER], [0x2ecc71, COLORS.SUCCESS],
  [0xed4245, COLORS.DANGER], [0x57f287, COLORS.SUCCESS], [0xfee75c, COLORS.PRIMARY], [0xeb459e, COLORS.SPECIAL], [0xffffff, COLORS.INFO],
  [0x2b2d31, COLORS.SYSTEM], [0x1abc9c, COLORS.CULTIVATION], [0x95a5a6, COLORS.SYSTEM], [0xe91e63, COLORS.SPECIAL],
]);
const nearest = (c) => {
  const r = (c >> 16) & 255; const g = (c >> 8) & 255; const b = c & 255;
  let best = COLORS.INFO; let bd = Infinity;
  for (const p of PALETTE) {
    const d = (((p >> 16) & 255) - r) ** 2 + (((p >> 8) & 255) - g) ** 2 + ((p & 255) - b) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
};
function normalizeColor(c) {
  if (c === undefined || c === null) return COLORS.INFO;
  if (typeof c === 'string') c = parseInt(c.replace('#', ''), 16);
  if (!Number.isFinite(c)) return COLORS.INFO;
  if (PALETTE.includes(c)) return c;
  return LEGACY_MAP.get(c) ?? nearest(c);
}

module.exports = { COLORS, CATEGORY, PALETTE, normalizeColor };
