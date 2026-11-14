'use strict';
/** Emoji của V17 — mọi nơi hiển thị vật phẩm/danh mục/phẩm cấp/nghề lấy từ đây (E tự rơi về Unicode nếu emoji pixel chưa tải). */
const { E, toComponentEmoji } = require('../game/emoji');
const C = require('../data/craft_v17');

const CAT_FALLBACK = { LINH_DUOC: '🌿', KHOANG_VAT: '⛏️', YEU_THU_TAI_LIEU: '🦴', TRAN_DAO_TAI_LIEU: '🔯', LINH_TINH_TAI_LIEU: '🌠', LINH_THUC: '🌱', THIEN_DIA_CHI_BAO: '🌌', NGUYEN_LIEU_TRUNG_GIAN: '⚗️', DAN_DUOC: '💊', TRAN_PHAP: '🧿', VAT_PHAM_KHAC: '🎁' };
const Items = require('../data/items_v17');
const item = (id) => { const it = Items.BY_ID[id]; if (!it) return '❔'; return E[it.emoji_key] || CAT_FALLBACK[it.cat] || '📦'; };
const cat = (c) => E[`c17_${c}`] || CAT_FALLBACK[c] || '📦';
const rar = (r) => E[`r17_${r}`] || Items.RARITY[r - 1].dot;
const prof = (p) => E[`p17_${p}`] || C.PROFS[p].icon;
const slot = (s) => E[`s17_${s}`] || C.SLOTS[s].icon;
/** Emoji cho select-option / button: luôn trả về đối tượng hợp lệ hoặc undefined. */
const comp = (s) => { try { return s ? toComponentEmoji(s) : undefined; } catch (_) { return undefined; } };
module.exports = { item, cat, rar, prof, slot, comp, CAT_FALLBACK };
