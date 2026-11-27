'use strict';
/**
 * COMBAT AI CHUNG V22.4.2 — "bộ não" của quái / Boss cho CẢ BA Bí Cảnh (Nhân Giới · Linh Giới · Tiên Giới).
 *
 *  Lõi chiến đấu vẫn là game/bicanh19.js (spawnEnemy / playerDamage / enemyDamage / stepCore). File này CHỈ thêm:
 *    • bộ đặc tính AI (`build`) gắn vào kẻ địch lúc tạo trận (lưu trong state JSON → khôi phục chính xác sau restart);
 *    • các hàm quyết định thuần: né (`tryDodge`), phòng thủ / hồi phục / khiên / phản kích (`planDefense`), quan sát người chơi (`observe`).
 *  Mọi hành vi đều có GIỚI HẠN SỐ LẦN (cap) và HỒI CHIÊU (cd, tính theo lượt hành động của người chơi) — AI không né / hồi vô hạn.
 *  Công tắc khẩn cấp: ST `bcai` = off → kẻ địch quay về hành vi V22.4.1 (không gắn `ai`).
 *
 *  Cấp AI theo thế giới (spec §IV): nhân = 1 (cơ bản) · linh = 2 (nâng cao) · tien = 3 (đầy đủ).
 */
const { random, randUniform, clamp } = require('../util');

const LVL = { nhan: 1, linh: 2, tien: 3 };
const lvlOf = (world) => LVL[world] || 3;
const enabled = () => { try { return String(require('./settings').get('bcai', 'on')) !== 'off'; } catch (_) { return true; } };

// ---- bảng đặc tính: chỉ số [cấp1, cấp2, cấp3]
const DODGE = { normal: [0.04, 0.05, 0.06], elite: [0.05, 0.07, 0.08], mini: [0.06, 0.08, 0.10], guard: [0.07, 0.09, 0.11], final: [0.08, 0.10, 0.12] };
const DODGE_CAP = { normal: [1, 1, 1], elite: [1, 2, 2], mini: [2, 2, 3], guard: [2, 3, 3], final: [3, 4, 5] };
const DODGE_CD = [3, 3, 2];                       // số lượt hành động của người chơi giữa 2 lần né
const DODGE_HEAVY_MUL = 1.5;                      // Boss (mini trở lên) né "kỹ năng nguy hiểm" tốt hơn
const DODGE_MAX = 0.30;
// hồi phục [phần trăm sinh mệnh tối đa, số lần tối đa, hồi chiêu, ngưỡng HP kích hoạt]
const HEAL = {
  elite: [null, [0.08, 1, 4, 0.45], [0.08, 1, 4, 0.45]],
  mini: [null, [0.08, 1, 4, 0.45], [0.08, 2, 4, 0.45]],
  guard: [[0.08, 1, 4, 0.45], [0.08, 2, 4, 0.45], [0.08, 2, 4, 0.45]],
  final: [[0.07, 2, 4, 0.55], [0.07, 2, 4, 0.55], [0.07, 2, 4, 0.55]],
};
const MOB_HEAL = { thu: [0.10, 1, 3, 0.40], thuho: [0.08, 1, 3, 0.40], hon: [0.08, 1, 3, 0.40] };   // quái thường có thể tự hồi (hon: chỉ cấp 3, thuho: cấp 2+)
const MOB_HEAL_MIN_LVL = { thu: 1, thuho: 2, hon: 3 };
const MOB_DODGE_BONUS = { lang: 0.03, hon: 0.04, cot: -0.02, thuho: -0.03, thu: 0 };
// khiên [phần trăm, số lần, hồi chiêu, ngưỡng HP]
const SHIELD = {
  elite: [null, [0.08, 1, 5, 0.60], [0.10, 1, 5, 0.60]],
  mini: [null, [0.10, 1, 5, 0.60], [0.10, 1, 5, 0.60]],
  guard: [[0.10, 1, 5, 0.55], [0.10, 1, 5, 0.60], [0.12, 2, 5, 0.60]],
  final: [[0.10, 1, 5, 0.60], [0.12, 1, 5, 0.60], [0.12, 2, 5, 0.60]],
};
// Kim Thân (giảm sát thương nhận vào) [giảm, số lượt hành động kéo dài, số lần, hồi chiêu]
const DEFST = {
  mini: [null, [0.30, 2, 1, 6], [0.35, 2, 2, 6]],
  guard: [null, [0.30, 2, 1, 6], [0.35, 2, 2, 6]],
  final: [[0.30, 2, 1, 6], [0.35, 2, 2, 6], [0.35, 2, 3, 6]],
};
// Lập thế phản kích [hệ số sát thương so với đòn thường, số lần, hồi chiêu]
const CTR = {
  guard: [null, [1.2, 1, 6], [1.3, 2, 6]],
  final: [[1.2, 1, 6], [1.3, 2, 6], [1.4, 3, 6]],
  elite: [null, null, [1.1, 1, 6]],
};
const RES_EFF = { normal: [0, 0.05, 0.08], elite: [0.05, 0.10, 0.12], mini: [0.10, 0.15, 0.18], guard: [0.12, 0.18, 0.22], final: [0.15, 0.22, 0.28] };
const ENRAGE = { mini: [false, true, true], guard: [false, true, true], final: [false, false, false] };   // Boss cuối đã có đổi giai đoạn riêng
const LOW_HP = 0.30;                              // dưới ngưỡng này kẻ địch ưu tiên phòng thủ (spec §III.4)
const DEF_GAP = 2;                                // sau 1 hành động phòng thủ, bắt buộc tấn công ít nhất bấy nhiêu lượt (chống co cụm vô hạn)
const CFG = { dodgeMul: 1, healMul: 1, shieldP: 1, defstP: 1, ctrP: 1, tienMul: 1 };   // núm cân bằng nhanh (test mô phỏng đọc): *P = nhân xác suất chọn hành động phòng thủ

const pick = (tbl, kind, lv) => { const r = tbl[kind]; return r ? r[lv - 1] || null : null; };

/** Dựng bộ đặc tính AI cho 1 kẻ địch. world: 'nhan' | 'linh' | 'tien'. Trả null nếu AI bị tắt. */
function build(kind, world, mobKey = null) {
  if (!enabled()) return null;
  const lv = lvlOf(world);
  const dodge = clamp((DODGE[kind][lv - 1] + (kind === 'normal' ? (MOB_DODGE_BONUS[mobKey] || 0) : 0)) * CFG.dodgeMul, 0, DODGE_MAX);
  const ai = {
    v: 1, lv, dodge, dodgeCap: DODGE_CAP[kind][lv - 1], dodgeCd: DODGE_CD[lv - 1], dodgeN: 0, dodgeT: 0,
    heal: null, shield: null, defst: null, ctr: null, resEff: RES_EFF[kind][lv - 1], lowHp: LOW_HP, enrage: !!(ENRAGE[kind] && ENRAGE[kind][lv - 1]), enraged: 0,
    gap: 0, st: { def: 0, ctr: 0 }, mem: { n: 0, avg: 0, last: 0, guard: 0, heavy: 0 }, lastCharge: 0, lastFinish: -9,
  };
  let h = pick(HEAL, kind, lv);
  if (!h && kind === 'normal' && mobKey && MOB_HEAL[mobKey] && lv >= MOB_HEAL_MIN_LVL[mobKey]) h = MOB_HEAL[mobKey];
  if (h) ai.heal = { pct: h[0] * CFG.healMul, cap: h[1], cd: h[2], below: h[3], n: 0, t: 0 };
  const s = pick(SHIELD, kind, lv); if (s) ai.shield = { pct: s[0], cap: s[1], cd: s[2], below: s[3], n: 0, t: 0 };
  const d = pick(DEFST, kind, lv); if (d) ai.defst = { red: d[0], turns: d[1], cap: d[2], cd: d[3], n: 0, t: 0 };
  const c = pick(CTR, kind, lv); if (c) ai.ctr = { mult: c[0], cap: c[1], cd: c[2], n: 0, t: 0 };
  return ai;
}

/** Cuối MỖI hành động của người chơi: giảm hồi chiêu / thời lượng thế phòng thủ của kẻ địch. */
function tick(e) {
  const ai = e && e.ai; if (!ai) return;
  if (ai.dodgeT > 0) ai.dodgeT -= 1;
  for (const k of ['heal', 'shield', 'defst', 'ctr']) if (ai[k] && ai[k].t > 0) ai[k].t -= 1;
  if (ai.st.def > 0) ai.st.def -= 1;
  if (ai.st.ctr > 0) ai.st.ctr -= 1;               // thế phản kích: lập ở lượt địch (=2) → tick cuối hành động đó (=1) → còn hiệu lực đúng 1 hành động kế của người chơi
  if (ai.mem.heavy > 0 && ai.mem.n % 3 === 0) ai.mem.heavy -= 1;
}

/** Ghi nhận hành động người chơi (để Boss thích nghi). dmg = sát thương thực gây ra (0 nếu né / hành động phụ trợ). */
function observe(e, a, dmg) {
  const ai = e && e.ai; if (!ai) return;
  const m = ai.mem; m.n += 1;
  if (a === 'guard') m.guard += 1; else if (a !== 'rest' && a !== 'item') m.guard = 0;
  if (a === 'tuyet' || a === 'bi' || a === 'than') m.heavy = Math.min(3, m.heavy + 1);
  if (dmg > 0) { m.last = dmg; m.avg = m.avg ? m.avg * 0.7 + dmg * 0.3 : dmg; }
}
/** Người chơi vừa tung 1 đòn bùng nổ (≥ 1,6 × trung bình)? */
const burst = (e) => { const m = e.ai.mem; return m.n >= 3 && m.avg > 0 && m.last >= 1.6 * m.avg; };

/**
 * Né đòn: chỉ khi không đang tụ lực (đang tụ lực = lộ sơ hở), còn lượt né, hết hồi chiêu. Trả true nếu né.
 * heavy: đòn của người chơi là kỹ năng nguy hiểm (Boss né khéo hơn).
 */
function tryDodge(e, heavy = false, rnd = random) {
  const ai = e && e.ai; if (!ai || e.tele || ai.dodgeN >= ai.dodgeCap || ai.dodgeT > 0 || e.hp <= 0) return false;
  let p = ai.dodge; if (heavy && e.kind !== 'normal' && e.kind !== 'elite') p *= DODGE_HEAVY_MUL;
  if (rnd() < clamp(p, 0, DODGE_MAX)) { ai.dodgeN += 1; ai.dodgeT = ai.dodgeCd; return true; }
  return false;
}
/** Kháng hiệu ứng xấu của người chơi (suy yếu…). true = kháng được. */
const resists = (e, rnd = random) => !!(e && e.ai && rnd() < e.ai.resEff);
/** Hệ số sát thương nhận vào do Kim Thân. */
const takeMult = (e) => (e && e.ai && e.ai.st.def > 0 && e.ai.defst ? 1 - e.ai.defst.red : 1);
/** Đang lập thế phản kích? */
const counterStance = (e) => (e && e.ai && e.ai.st.ctr > 0 && e.ai.ctr ? e.ai.ctr : null);

/**
 * Chọn hành động phòng thủ cho lượt này của kẻ địch (thay cho đòn đánh). Trả null | 'heal' | 'shield' | 'defst' | 'ctr'.
 * Đã kiểm tra: số lần, hồi chiêu, ngưỡng HP, đang tụ lực, khoảng nghỉ bắt buộc. Có xác suất → trận không lặp y hệt nhau.
 * Ưu tiên: dưới 30% HP → hồi > khiên > Kim Thân; thích nghi: bị đánh bùng nổ → Kim Thân; người chơi dùng nhiều chiêu nặng → phản kích.
 */
function planDefense(e, rnd = random) {
  const ai = e && e.ai; if (!ai || e.tele || e.hp <= 0) return null;
  if (ai.gap > 0) { ai.gap -= 1; return null; }
  const hp = e.hp / e.maxHp; const low = hp <= ai.lowHp;
  const ok = (x) => x && x.n < x.cap && x.t <= 0;
  const go = (k, p) => (rnd() < p ? k : null);
  let r = null;
  if (ok(ai.heal) && hp <= ai.heal.below) r = go('heal', clamp(0.45 + (ai.heal.below - hp), 0.3, 0.9));
  if (!r && ok(ai.shield) && e.shield <= 0 && hp <= ai.shield.below) r = go('shield', (low ? 0.6 : 0.4) * CFG.shieldP);
  if (!r && ok(ai.defst) && ai.st.def <= 0 && (low || burst(e) || ai.mem.heavy >= 2)) r = go('defst', (low ? 0.6 : 0.5) * CFG.defstP);
  if (!r && ok(ai.ctr) && ai.st.ctr <= 0 && ai.mem.heavy >= 1 && ai.mem.guard < 2) r = go('ctr', (hp <= 0.5 ? 0.40 : 0.30) * CFG.ctrP);
  if (r) ai.gap = DEF_GAP;
  return r;
}
/** Thực thi hồi phục: trả lượng hồi (đã áp trần số lần). */
function doHeal(e, rnd = random) {
  const h = e.ai.heal; h.n += 1; h.t = h.cd;
  const a = Math.min(e.maxHp - e.hp, Math.max(1, Math.floor(e.maxHp * h.pct * (0.9 + 0.2 * rnd()))));
  e.hp += a; return a;
}
function doShield(e) { const s = e.ai.shield; s.n += 1; s.t = s.cd; const a = Math.floor(e.maxHp * s.pct); e.shield += a; return a; }
function doDefst(e) { const d = e.ai.defst; d.n += 1; d.t = d.cd; e.ai.st.def = d.turns + 1; return d; }   // +1 vì tick() chạy ngay cuối hành động hiện tại → còn đúng `turns` hành động của người chơi
function doCtr(e) { const c = e.ai.ctr; c.n += 1; c.t = c.cd; e.ai.st.ctr = 2; return c; }
/** Boss cấp ≥ 2 nổi giận 1 lần khi dưới ngưỡng HP thấp: công kích +15% trong 3 lượt (tái dùng cơ chế rage của bicanh19). */
function shouldEnrage(e) { const ai = e.ai; return !!(ai && ai.enrage && !ai.enraged && e.hp / e.maxHp <= ai.lowHp && e.hp > 0); }

module.exports = { build, tick, observe, tryDodge, resists, takeMult, counterStance, planDefense, doHeal, doShield, doDefst, doCtr, shouldEnrage, burst, enabled, lvlOf, CFG, LOW_HP, DEF_GAP, DODGE_HEAVY_MUL, DODGE_MAX };
