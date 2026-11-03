'use strict';
/**
 * Embed nền của v7 — cấu trúc cố định 5 phần (spec §2):
 *   Header (title) · Description · Fields · Footer · Timestamp
 * Tự xử lý trường rỗng, giới hạn ký tự Discord, dữ liệu không hợp lệ (undefined/null/NaN).
 */
const { EmbedBuilder } = require('discord.js');
const { COLORS, CATEGORY, normalizeColor } = require('../theme/colors');
const { FOOTER_TEXT, MARK } = require('../theme/typography');
const { LIMITS } = require('../theme/spacing');
const { safe, clip } = require('../format');
const { E, skinEmojiText } = require('../emojis');

const t = (s) => skinEmojiText(String(safe(s, '')));

/** Header chuẩn: "<icon pixel> THIÊN ĐẠO · TU LUYỆN" */
function headerText(cat = 'thiendao', label) {
  const c = CATEGORY[cat] || CATEGORY.thiendao;
  const icon = cat === 'thiendao' ? c.mark : (E[c.emoji] || c.mark);
  const name = label || c.name;
  return cat === 'thiendao' && !label ? `${icon} THIÊN ĐẠO` : `${icon} THIÊN ĐẠO · ${name}`;
}

function cleanFields(fields) {
  const out = [];
  for (const f of fields || []) {
    if (!f) continue;
    const name = clip(t(f.name) || '​', LIMITS.fieldName);
    const value = clip(t(f.value) || '—', LIMITS.fieldValue);
    out.push({ name, value, inline: !!f.inline });
    if (out.length >= LIMITS.fields) break;
  }
  return out;
}

/** Tổng ký tự một embed (Discord tính title+description+fields+footer+author). */
function embedLength(d) {
  let n = (d.title || '').length + (d.description || '').length + ((d.footer && d.footer.text) || '').length + ((d.author && d.author.name) || '').length;
  for (const f of d.fields || []) n += (f.name || '').length + (f.value || '').length;
  return n;
}

/** Ép embed (EmbedBuilder hoặc JSON) về trong giới hạn Discord. Trả về chính nó. */
function enforceLimits(embed) {
  const d = embed.data || embed;
  if (d.title) d.title = clip(d.title, LIMITS.title);
  if (d.description) d.description = clip(d.description, LIMITS.description);
  if (d.fields) {
    d.fields = d.fields.slice(0, LIMITS.fields).map((f) => ({ ...f, name: clip(f.name || '​', LIMITS.fieldName), value: clip(f.value || '—', LIMITS.fieldValue) }));
  }
  while (d.fields && d.fields.length && embedLength(d) > LIMITS.total - 100) d.fields.pop();
  if (embedLength(d) > LIMITS.total - 100 && d.description) d.description = clip(d.description, Math.max(200, d.description.length - (embedLength(d) - (LIMITS.total - 100))));
  return embed;
}

/**
 * @param {object} o
 *  cat: nhóm giao diện (xem theme/colors CATEGORY)
 *  header: ghi đè phần tên sau "THIÊN ĐẠO ·"
 *  status: dòng trạng thái nhỏ phía trên (vd "Đang hoạt động")
 *  title: tiêu đề nội dung (in đậm, dòng đầu description)
 *  description / lines: nội dung chính
 *  color: ghi đè màu (phải nằm trong bảng màu)
 */
function createEmbed({ cat = 'thiendao', header, status, title, description, lines, color, fields = [], thumbnail, image, footer, timestamp = true, authorName, rawTitle } = {}) {
  const c = CATEGORY[cat] || CATEGORY.thiendao;
  const emb = new EmbedBuilder().setColor(normalizeColor(color ?? c.color)).setTitle(clip(t(rawTitle || headerText(cat, header)), LIMITS.title));
  const parts = [];
  if (status) parts.push(`*${t(status)}*`);
  if (title) parts.push(`**${t(title)}**`);
  const body = [description, ...(Array.isArray(lines) ? lines : [])].filter((x) => x !== undefined && x !== null && x !== '').map(t).join('\n');
  if (body) parts.push(body);
  if (parts.length) emb.setDescription(clip(parts.join('\n'), LIMITS.description));
  const fs = cleanFields(fields);
  if (fs.length) emb.addFields(fs);
  if (thumbnail) emb.setThumbnail(thumbnail);
  if (image) emb.setImage(image);
  if (authorName) emb.setAuthor({ name: clip(String(authorName), 256) });
  emb.setFooter({ text: clip(footer ? `${FOOTER_TEXT} · ${footer}` : FOOTER_TEXT, LIMITS.footer) });
  if (timestamp) emb.setTimestamp(timestamp === true ? undefined : timestamp);
  return enforceLimits(emb);
}

module.exports = { createEmbed, enforceLimits, embedLength, headerText, cleanFields, COLORS, MARK };
