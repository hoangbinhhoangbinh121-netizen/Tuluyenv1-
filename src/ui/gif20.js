'use strict';
/** V20.0 — gắn GIF minh hoạ (túi trữ vật ở Kho Đồ, sách ở Công Pháp) làm ảnh nhỏ của embed đầu tiên. Thiếu file / lỗi → trả nguyên payload (chỉ là phần trình diễn). */
const fs = require('node:fs');
const path = require('node:path');
const { AttachmentBuilder } = require('discord.js');
const DIR = path.join(__dirname, '..', '..', 'assets', 'ui');
const KEYS = { kho: 'kho_tui', congphap: 'congphap_sach' };
function withGif(payload, which) {
  try {
    const k = KEYS[which]; const f = path.join(DIR, `${k}.gif`); const e = payload && payload.embeds && payload.embeds[0];
    if (!k || !e || !fs.existsSync(f)) return payload;
    const j = e.toJSON ? e.toJSON() : e; if (j.thumbnail || j.image) return payload;
    e.setThumbnail(`attachment://${k}.gif`);
    return { ...payload, files: [...(payload.files || []), new AttachmentBuilder(f, { name: `${k}.gif` })], attachments: [] };
  } catch (_) { return payload; }
}
module.exports = { withGif, KEYS };
