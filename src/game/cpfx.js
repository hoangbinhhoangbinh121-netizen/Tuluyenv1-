'use strict';
/**
 * HIỆU ỨNG CÔNG PHÁP V16 — nơi DUY NHẤT tính hiệu ứng của 40 công pháp mới (data/congphap_v16.js).
 * Chỉ ĐỌC cong_phap_slots / cong_phap_levels của hàng người chơi (không lưu lại kết quả) nên:
 *   · mỗi hiệu ứng chỉ được cộng đúng 1 lần (không cộng vào cong_phap_bonus / cpScale cũ);
 *   · tháo công pháp = hiệu ứng biến mất ngay (không có số dư cũ);
 *   · không nhân đôi khi trang bị 3 quyển (mỗi quyển được cộng 1 lần, rồi chặn trần FX_CAP).
 * Không require cultivator.js ở đầu file (tránh vòng lặp) — chỉ phân tích chuỗi lưu trong DB.
 */
const D = require('../data/congphap_v16');

const SLOT_MAX = 3;
function parseSlots(row) {
  const raw = String((row && row.cong_phap_slots) || '');
  let tiers = raw.split(',').map((x) => x.trim()).filter((x) => /^\d+$/.test(x)).map(Number);
  if (!tiers.length) { const m = /^\[Tầng (\d+)\]/.exec((row && row.cong_phap) || ''); if (m) tiers = [Number(m[1])]; }
  return [...new Set(tiers)].slice(0, SLOT_MAX);
}
function parseLevels(row) {
  const out = {};
  for (const part of String((row && row.cong_phap_levels) || '').split(',')) {
    const m = /^\s*(\d+)\s*:\s*(\d+)\s*$/.exec(part);
    if (m) out[Number(m[1])] = Number(m[2]);
  }
  return out;
}
const levelOf = (row, tier) => Math.min(D.MAX_LEVEL, parseLevels(row)[tier] || 0);

/** Giá trị fx của 1 quyển ở cấp `level` (chưa nhân tương hợp, chưa chặn trần tổng). */
function fxAt(book, level) {
  const g = 1 + D.LEVEL_FX_GROWTH * Math.max(0, Math.min(D.MAX_LEVEL, level));
  const out = {};
  for (const [k, v] of Object.entries(book.fx)) out[k] = v * g;
  return out;
}
const pvpBuffAt = (book, level) => book.pvp_buff + D.LEVEL_PVP_STEP * Math.max(0, level);
const pvpDebuffAt = (book, level) => book.pvp_debuff + D.LEVEL_PVP_STEP * Math.max(0, level);

/** Độ tương hợp Linh Căn của 1 quyển (1 = trung tính). Quyển Ngũ Hành khuếch đại chênh lệch ×2,5. */
function affinityOf(row, book) {
  const T = require('./talent');
  const f = T.cpAffinity(row, [book.tier]);
  const boost = (D.CATS[book.cat] && D.CATS[book.cat].affinityBoost) || 1;
  return Math.max(0.85, Math.min(1.25, 1 + (f - 1) * boost));
}

const cache = new WeakMap();
/** Tổng hợp tất cả quyển mới đang trang bị của `row`. */
function aggregate(row) {
  if (!row || typeof row !== 'object') return EMPTY;
  const hit = cache.get(row); if (hit) return hit;
  const tiers = parseSlots(row).filter((t) => D.BY_TIER.has(t));
  let res = EMPTY;
  if (tiers.length) {
    const lv = parseLevels(row);
    const sum = {}; let buff = 0; let debuff = 0; const books = [];
    for (const t of tiers) {
      const b = D.BY_TIER.get(t); const level = Math.min(D.MAX_LEVEL, lv[t] || 0);
      const aff = affinityOf(row, b);
      for (const [k, v] of Object.entries(fxAt(b, level))) {
        const scaled = (D.STAT_KEYS.includes(k) || k === 'tu' || k === 'boss') ? v * aff : v;   // tương hợp chỉ nhân các hiệu ứng chính
        sum[k] = (sum[k] || 0) + scaled;
      }
      buff += pvpBuffAt(b, level); debuff += pvpDebuffAt(b, level);
      books.push({ book: b, level, aff });
    }
    const cap = (k) => Math.min(D.FX_CAP[k], Math.max(0, sum[k] || 0));
    const stat = { atk: cap('atk'), def: cap('def'), hp: cap('hp'), spd: cap('spd') };
    const route = {}; for (const k of D.ROUTE_KEYS) if (sum[k]) route[k] = cap(k);
    res = { n: tiers.length, books, stat, tu: cap('tu'), boss: cap('boss'), route, buff, debuff };
  }
  cache.set(row, res);
  return res;
}
const EMPTY = Object.freeze({ n: 0, books: [], stat: Object.freeze({ atk: 0, def: 0, hp: 0, spd: 0 }), tu: 0, boss: 0, route: Object.freeze({}), buff: 0, debuff: 0 });

const statBonus = (row, stat) => (stat ? aggregate(row).stat[stat] || 0 : 0);
const tuBonus = (row) => aggregate(row).tu;
const bossBonus = (row) => aggregate(row).boss;
const routeFx = (row) => aggregate(row).route;

// ---------------------------------------------------------------- chiêu thức
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** Hiệu ứng thật của 1 chiêu (null nếu không phải chiêu công pháp mới). Đã nhân hệ số sk của quyển và chặn trần. */
function skillEffect(name) {
  const hit = D.BY_SKILL.get(name); if (!hit) return null;
  const { book, skill } = hit; const b = skill.base; const sk = book.sk; const C = D.SKILL_CAP; const e = {};
  e.dmg = b.dmg ? clamp(1 + (b.dmg - 1) * sk, 1, C.dmg) : 1;
  if (b.pierce) e.pierce = clamp(b.pierce * sk, 0, C.pierce);
  if (b.crit) e.crit = clamp(b.crit * sk, 0, C.crit);
  if (b.heal) e.heal = clamp(b.heal * sk, 0, C.heal);
  for (const k of ['guard', 'weaken', 'dodge']) if (b[k]) e[k] = [clamp(b[k][0] * sk, 0, C[k][0]), Math.min(C[k][1], b[k][1])];
  return e;
}
const round1 = (v) => Math.round(v * 1000) / 10;
/** Mô tả hiệu quả thật của chiêu (dùng ở kho / chi tiết). */
function skillEffectText(name) {
  const e = skillEffect(name); if (!e) return '';
  const p = [];
  if (e.dmg > 1.0001) p.push(`sát thương ×${e.dmg.toFixed(2)}`); else p.push('sát thương ×1,00');
  if (e.pierce) p.push(`xuyên giáp +${round1(e.pierce)}%`);
  if (e.crit) p.push(`bạo kích +${round1(e.crit)}%`);
  if (e.heal) p.push(`hồi ~${Math.max(1, Math.round(e.heal * HEAL_SCALE))} sinh lực`);
  if (e.guard) p.push(`giảm ${round1(e.guard[0])}% sát thương nhận (${e.guard[1]} đòn)`);
  if (e.weaken) p.push(`đối thủ gây ít hơn ${round1(e.weaken[0])}% (${e.weaken[1]} đòn)`);
  if (e.dodge) p.push(`né +${round1(e.dodge[0])}% (${e.dodge[1]} đòn)`);
  return p.join(', ');
}
const HEAL_SCALE = 40;   // heal 0,10 ≈ +4 điểm trên thanh sinh mệnh 100 của đấu pháp

/** Trạng thái chiêu theo từng trận: gắn vào hpPool (không liệt kê được → không lẫn vào vòng lặp hp). */
function battleState(hpPool) {
  if (!hpPool.__cp) Object.defineProperty(hpPool, '__cp', { value: { A: {}, B: {} }, enumerable: false });
  return hpPool.__cp;
}
const num = (v) => v || 0;
/** Hệ số tác động lên 1 đòn: { dodge, guard, weak } — chỉ đọc, chưa trừ lượt. */
function incomingBuffs(st) { return { dodge: st.dodgeN > 0 ? num(st.dodge) : 0, guard: st.guardN > 0 ? num(st.guard) : 0 }; }
const outgoingWeak = (st) => (st.weakN > 0 ? num(st.weak) : 0);
/** Trừ lượt sau khi 1 đòn đã xử lý xong. */
function tickDefender(st) { if (st.dodgeN > 0) st.dodgeN -= 1; if (st.guardN > 0) st.guardN -= 1; }
function tickAttacker(st) { if (st.weakN > 0) st.weakN -= 1; }
/** Áp hiệu ứng tự thân/đối thủ của chiêu vừa dùng (gọi cả khi đòn bị né). Trả mảng dòng nhật ký. */
function applySkill(eff, selfSt, enemySt, hpPool, selfKey, tag) {
  const lines = [];
  if (!eff) return lines;
  if (eff.guard) { selfSt.guard = eff.guard[0]; selfSt.guardN = eff.guard[1]; lines.push(`🔰 ${tag} hộ thể: giảm ${round1(eff.guard[0])}% sát thương nhận trong ${eff.guard[1]} đòn.`); }
  if (eff.dodge) { selfSt.dodge = eff.dodge[0]; selfSt.dodgeN = eff.dodge[1]; lines.push(`🌬️ ${tag} thân pháp: né +${round1(eff.dodge[0])}% trong ${eff.dodge[1]} đòn.`); }
  if (eff.weaken) { enemySt.weak = eff.weaken[0]; enemySt.weakN = eff.weaken[1]; lines.push(`❄️ Đối thủ của ${tag} bị suy yếu: gây ít hơn ${round1(eff.weaken[0])}% sát thương trong ${eff.weaken[1]} đòn.`); }
  if (eff.heal && hpPool[selfKey] > 0) {
    const h = Math.max(1, Math.round(eff.heal * HEAL_SCALE));
    const before = hpPool[selfKey]; hpPool[selfKey] = Math.min(100, before + h);
    if (hpPool[selfKey] > before) lines.push(`💚 ${tag} hồi ${hpPool[selfKey] - before} sinh lực.`);
  }
  return lines;
}

module.exports = {
  D, parseSlots, parseLevels, levelOf, fxAt, pvpBuffAt, pvpDebuffAt, affinityOf, aggregate, statBonus, tuBonus, bossBonus, routeFx,
  skillEffect, skillEffectText, battleState, incomingBuffs, outgoingWeak, tickDefender, tickAttacker, applySkill, HEAL_SCALE, EMPTY,
};
