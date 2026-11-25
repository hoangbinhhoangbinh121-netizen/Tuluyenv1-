'use strict';
/** Quy chuẩn chữ & phân cách của Embed v7. */
const DIVIDER = '━━━━━━━━━━━━━━━━━━━━';
const MARK = '✦';
const FOOTER_TEXT = `${MARK} Thiên Tông Bot v${require('../../../package.json').version} · Thiên Đạo`;   // v21.6.3: hiện đúng phiên bản đang chạy (trước đây ghi cứng v21.4) — nhìn footer biết bản nào đã trả lời
const bold = (s) => `**${s}**`;
const sub = (s) => `*${s}*`;
const quote = (s) => String(s).split('\n').map((l) => `> ${l}`).join('\n');
const code = (s) => `\`${s}\``;
const bullet = (lines) => lines.filter(Boolean).map((l) => `• ${l}`).join('\n');
module.exports = { DIVIDER, MARK, FOOTER_TEXT, bold, sub, quote, code, bullet };
