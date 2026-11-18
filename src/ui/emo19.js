'use strict';
/** Emoji pixel của V19 (assets/emoji/<khóa>.png, tải lên tự động như bộ cũ). Chưa tải được thì rơi về emoji Unicode dự phòng — không bao giờ trả chuỗi rỗng ở chỗ cần hiển thị. */
const { E, toComponentEmoji } = require('../game/emoji');
const FB = require('../data/emoji_fallback.json');

const k = (key, uni = '') => E[key] || FB[key] || uni;                       // chuỗi hiển thị trong embed/nội dung
const comp = (key, uni = '') => { try { const s = k(key, uni); const o = s ? toComponentEmoji(s) : undefined; return typeof o === 'string' ? { name: o } : o; } catch (_) { return undefined; } };   // luôn là đối tượng {id,name}/{name} — hợp lệ cho cả nút lẫn mục chọn   // cho nút/menu
const pad2 = (n) => String(n).padStart(2, '0');
const bc = (idx) => k(`bc19_${pad2(idx)}`, '🌌');                            // 19 bí cảnh
const bcComp = (idx) => comp(`bc19_${pad2(idx)}`, '🌌');
const DAO_KEY = { satphat: 'dd_satphat', sinhmenh: 'dd_sinhmenh', thoikhong: 'dd_thoikhong', luanhoi: 'dd_luanhoi', hunhdon: 'dd_hondon', hondon: 'dd_hondon', huydiet: 'dd_huydiet' };
const dao = (id, uni = '☯️') => k(DAO_KEY[id] || 'dedao', uni);
const daoComp = (id, uni = '☯️') => comp(DAO_KEY[id] || 'dedao', uni);
const binh = (id, uni = '🗡️') => k(`db_${id}`, uni);
const binhComp = (id, uni = '🗡️') => comp(`db_${id}`, uni);
const EV_KEY = { dibien: 'ev_dibien', dicanh: 'ev_dicanh', truyenthua: 'ev_truyenthua', sieuthoat: 'ev_sieuthoat' };
const ev = (kind, uni = '🌠') => k(EV_KEY[kind] || 'sukien19', uni);
const MOB_KEY = { normal: 'mob_thuong', elite: 'mob_tinhanh', mini: 'mob_mini', guard: 'mob_canh', final: 'boss19' };
const mob = (kind, uni = '👾') => k(MOB_KEY[kind] || 'mob_thuong', uni);

// v19.9: emoji pixel cho nút / nhật ký chiến đấu (a19_*) — thay emoji hệ thống xấu. Chưa tải lên được thì rơi về Unicode dự phòng.
const a = (key, uni = '') => k(`a19_${key}`, uni);
const aComp = (key, uni = '') => comp(`a19_${key}`, uni);
// Nhật ký chiến đấu lưu sẵn trong DB với emoji Unicode → đổi sang pixel LÚC HIỂN THỊ (log cũ cũng đẹp, không phải sửa dữ liệu).
const LOG_MAP = [['⚔️', 'atk'], ['💢', 'trong'], ['🌠', 'tuyet'], ['☠️', 'bi'], ['📖', 'sk'], ['🛡️', 'guard'], ['🧘', 'rest'], ['💊', 'item'], ['⚠️', 'warn'], ['⬇️', 'weak'], ['💀', 'dead'], ['🏆', 'win'], ['🎁', 'gift'], ['📜', 'log']];
const px = (text) => {
  let t = String(text == null ? '' : text);
  t = t.replace(/^✨ \*\*/gm, `${a('than', '✨')} **`);
  for (const [u, key] of LOG_MAP) if (t.includes(u)) t = t.split(u).join(a(key, u));
  return t;
};
/** Cắt chuỗi theo DÒNG (không cắt giữa thẻ emoji <:tên:id>) cho giới hạn field Discord. */
const clip = (text, n = 1020) => {
  const lines = String(text).split('\n'); let out = '';
  for (const ln of lines) { const nx = out ? `${out}\n${ln}` : ln; if (nx.length > n) break; out = nx; }
  return out || String(text).slice(0, n);
};

module.exports = { a, aComp, px, clip, k, comp, bc, bcComp, dao, daoComp, binh, binhComp, ev, mob, DAO_KEY, EV_KEY, MOB_KEY };
