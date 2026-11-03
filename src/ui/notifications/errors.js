'use strict';
/** Mã lỗi chuẩn hóa (spec §6). Không bao giờ lộ stack trace/SQL cho người chơi. */
const ERRORS = {
  E001: 'Không tìm thấy nhân vật',
  E002: 'Không đủ linh thạch',
  E003: 'Không đủ cảnh giới',
  E004: 'Vật phẩm không tồn tại',
  E005: 'Thao tác đang trong cooldown',
  E006: 'Không đủ quyền hạn',
  E007: 'Tương tác đã hết hạn',
  E008: 'Dữ liệu đang được xử lý',
  E009: 'Thao tác không hợp lệ',
  E010: 'Lỗi hệ thống',
};
/** Đoán mã lỗi từ nội dung thông báo cũ. */
function guessCode(text) {
  const t = String(text).toLowerCase();
  if (/chưa bắt đầu tu tiên|không tìm thấy nhân vật|chưa có nhân vật/.test(t)) return 'E001';
  if (/không đủ linh thạch|thiếu linh thạch|không đủ .{0,20}linh thạch/.test(t)) return 'E002';
  if (/cảnh giới|chưa đủ tu vi|trở lên|chưa đạt/.test(t)) return 'E003';
  if (/không tồn tại|không có (vật phẩm|đan|công pháp|pháp bảo)|không sở hữu/.test(t)) return 'E004';
  if (/còn .{0,30}nữa|cooldown|hồi chiêu|vừa .{0,15}xong/.test(t)) return 'E005';
  if (/quyền|chỉ dành|admin|không phải nhân vật của bạn/.test(t)) return 'E006';
  if (/hết hạn|expired/.test(t)) return 'E007';
  if (/quá nhanh|đang xử lý|thao tác quá/.test(t)) return 'E008';
  if (/lỗi|mã lỗi/.test(t)) return 'E010';
  return 'E009';
}
module.exports = { ERRORS, guessCode };
