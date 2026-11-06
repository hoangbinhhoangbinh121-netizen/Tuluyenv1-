'use strict';
/** Thông báo thành công / lỗi / cảnh báo / thông tin — 4 mẫu chuẩn (spec §6). */
const { createEmbed } = require('../components/baseEmbed');
const { COLORS } = require('../theme/colors');
const { E } = require('../emojis');
const { ERRORS, guessCode } = require('./errors');

const base = (rawTitle, color, icon, text, extra = {}) => createEmbed({
  cat: 'hethong', rawTitle: `✦ ${rawTitle}`, color, description: `${E[icon]} ${text}`, ...extra,
});

const success = (text, o) => base('Thao tác thành công', COLORS.SUCCESS, 'xacnhan', text, o);
const info = (text, o) => base('Thông tin', COLORS.INFO, 'thongtin', text, o);
const warning = (text, o) => base('Cảnh báo', COLORS.WARNING, 'sk_canhbao', text, o);
function error(text, code) {
  code = code || guessCode(text);
  return base('Không thể thực hiện', COLORS.DANGER, 'tuchoi', text, { footer: `${code} · ${ERRORS[code] || ''}`.trim() });
}
const cooldown = (text) => base('Đang trong thời gian chờ', COLORS.WARNING, 'sk_thoigian', text, { footer: `E005 · ${ERRORS.E005}` });
const expired = (text = 'Menu này đã hết hạn — hãy gõ lại lệnh để mở menu mới.') => base('Tương tác đã hết hạn', COLORS.WARNING, 'sk_thoigian', text, { footer: `E007 · ${ERRORS.E007}` });
const systemError = (code) => base('Lỗi hệ thống', COLORS.DANGER, 'tuchoi', `Có lỗi xảy ra khi xử lý. Vui lòng thử lại; nếu còn lặp lại hãy báo admin kèm mã \`${code}\`.`, { footer: `E010 · ${ERRORS.E010} · ${code}` });

module.exports = { success, info, warning, error, cooldown, expired, systemError, ERRORS };
