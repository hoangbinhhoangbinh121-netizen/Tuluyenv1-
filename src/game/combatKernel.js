'use strict';
/**
 * v22.0 — COMBAT KERNEL: lớp "trong trận" dùng chung cho Boss Thế Giới, Bí Cảnh, Chứng Đạo và Tông Chiến.
 *
 * KHÔNG viết lại công thức sát thương của từng hệ thống (mỗi nơi giữ nguyên số liệu & chỉ số bền vững của mình — vốn đã đọc `talent.bundle`,
 * `Cu.effective*`, `fx17`). Kernel chỉ thêm những gì PvP (V21.6/21.7) đã có mà PvE chưa có:
 *   • EffectEngine theo hiệp (Trúng Độc / Xuất Huyết / Thiêu Đốt / Choáng / Băng Phong / Suy Nhược / Hộ Thể / Cuồng Huyết / Linh Thân)
 *   • Kỹ năng chủ động chủng tộc (raceSkill21) — PvE tự phát khi hồi chiêu xong (không thêm nút)
 *   • Một chuỗi nhân thống nhất: outMult / takeMult / foeOutMult / dodge (lấy từ EffectEngine, qua StatEngine)
 *
 * Công tắc: bot_settings `kernel_<hệ thống>` ∈ legacy | kernel (MẶC ĐỊNH legacy ⇒ hành vi y như V21.7).  `kernel_all = off` tắt tất cả (cắt khẩn cấp).
 * Hệ thống: boss · bicanh · chungdao · tongchien.
 *
 * Quy ước đơn vị: số liệu hiệu ứng/kỹ năng tộc tính theo "điểm thanh 100" (1 điểm = 1% sinh lực tối đa của chính bên đó).
 *   • Người chơi: 1 điểm = maxHp/100.
 *   • Kẻ địch PvE: 1 điểm = foe.unit (do adapter đưa vào; mặc định = kernel_foe_dot_pct % sát thương 1 đòn điển hình, xem foeUnit) — để Thiêu Đốt
 *     không thành "mất 2% HP Boss mỗi hiệp" (Boss có hàng nghìn tỉ HP). Đây là ĐỀ XUẤT chờ duyệt (xem docs 15).
 *   • Kẻ địch loại Boss/Thủ Lĩnh miễn nhiễm Choáng (ctrlImmune) — không thể khoá cứng Boss.
 */
const FXE = require('./effectEngine');
const RS = require('./raceSkill21');
const HB = require('./hpbar');
const ST = require('./settings');

const SYSTEMS = Object.freeze(['boss', 'bicanh', 'chungdao', 'tongchien']);
const SYS_NAME = Object.freeze({ boss: 'Boss Thế Giới', bicanh: 'Bí Cảnh', chungdao: 'Chứng Đạo', tongchien: 'Tông Chiến' });

/** 'kernel' | 'legacy' cho 1 hệ thống. */
function mode(sys) {
  if (!SYSTEMS.includes(sys)) return 'legacy';
  if (String(ST.get('kernel_all', 'on')) === 'off') return 'legacy';
  return String(ST.get(`kernel_${sys}`, 'legacy')) === 'kernel' ? 'kernel' : 'legacy';
}
const on = (sys) => mode(sys) === 'kernel';
/** Hệ số nhân hồi chiêu kỹ năng tộc trong PvE: 1 trận PvP ≈ 8 hiệp, còn 1 lượt Bí Cảnh ≈ hàng trăm thao tác → hồi chiêu tính theo THAO TÁC phải dài hơn (bench: ×1 làm Bí Cảnh thắng 7%→100%). Ghi đè: kernel_cd_<hệ thống>. */
const CD_MULT = Object.freeze({ boss: 6, bicanh: 10, chungdao: 1, tongchien: 3 });
const cdMult = (sys) => { const v = Number(ST.get(`kernel_cd_${sys}`, String(CD_MULT[sys] || 1))); return Number.isFinite(v) ? Math.max(1, Math.min(100, Math.trunc(v))) : (CD_MULT[sys] || 1); };
const foePct = () => { const v = Number(ST.get('kernel_foe_dot_pct', '5')); return Number.isFinite(v) ? Math.max(0, Math.min(50, v)) : 5; };
/** 1 điểm thanh của kẻ địch (tuyệt đối) = kernel_foe_dot_pct % của một đòn điển hình. */
const foeUnit = (typicalHit) => Math.max(0, Math.round((Number(typicalHit) || 0) * foePct() / 100));

// ------------------------------------------------------------------ kho tạm trong bộ nhớ (Boss / Tông Chiến) — Bí Cảnh & Chứng Đạo lưu JSON trong trạng thái của chúng
const MEM = new Map(); const MEM_MAX = 4000; const MEM_TTL = 3 * 3600;
function memGet(key, make) {
  const t = Math.floor(Date.now() / 1000); const e = MEM.get(key);
  if (e && t - e.t < MEM_TTL) { e.t = t; return e.v; }
  if (MEM.size >= MEM_MAX) for (const [k, v] of MEM) if (t - v.t >= MEM_TTL || MEM.size >= MEM_MAX) { MEM.delete(k); if (MEM.size < MEM_MAX * 0.9) break; }
  const v = make(); MEM.set(key, { v, t }); return v;
}
const memPeek = (key) => { const e = MEM.get(key); return e ? e.v : null; };
const memDrop = (prefix) => { for (const k of [...MEM.keys()]) if (k.startsWith(prefix)) MEM.delete(k); };

// ------------------------------------------------------------------ layer
/** Mở 1 lớp trận cho 1 người chơi vs 1 kẻ địch. saved = JSON từ toJSON (hoặc null). */
function open(sys, row, foe = {}, saved = null) {
  const sv = saved && typeof saved === 'object' ? saved : null;
  return {
    sys, uid: String(row.user_id), race: row.__lite ? null : RS.forRow(row), foe: { name: foe.name || 'Kẻ địch', unit: Math.max(0, Number(foe.unit) || 0), ctrlImmune: foe.ctrlImmune !== false },
    name: foe.me || `<@${row.user_id}>`,
    fx: sv && sv.fx ? FXE.fromJSON(sv.fx) : FXE.createStore(), cd: { race: sv && sv.cd ? Math.max(0, Number(sv.cd.race) || 0) : 0 }, round: sv ? Number(sv.round) || 0 : 0,
  };
}
const toJSON = (L) => ({ v: 1, fx: L.fx, cd: { race: L.cd.race }, round: L.round });
/** Làm mới thông tin kẻ địch (đổi quái) mà giữ hiệu ứng của người chơi; hiệu ứng lên kẻ địch cũ bị xoá. */
function resetFoe(L, foe = {}) {
  L.fx.fx.B = []; L.fx.stunned.B = false; L.fx.immune.B = {};
  L.foe = { name: foe.name || L.foe.name, unit: Math.max(0, Number(foe.unit) || 0), ctrlImmune: foe.ctrlImmune !== false };
}
const unitA = (maxHp) => Math.max(1e-9, Number(maxHp) / 100);
const noCtrlOnFoe = (L) => { if (L.foe.ctrlImmune) L.fx.stunned.B = false; };

/** Đầu hiệp của người chơi: sát thương theo thời gian (tuyệt đối) + choáng. */
function begin(L, maxHp) {
  L.round += 1; const s = FXE.startRound(L.fx); const lines = [];
  const dotA = Math.round(s.dmg.A * unitA(maxHp)); const dotB = Math.round(s.dmg.B * L.foe.unit);
  if (s.dmg.A > 0) lines.push(`${L.name}: ${s.lines.A.join(' ')}`);
  if (s.dmg.B > 0 && dotB > 0) lines.push(`${L.foe.name}: ${s.lines.B.join(' ')}`);
  noCtrlOnFoe(L);
  const stunned = FXE.consumeStun(L.fx, 'A');
  if (stunned) lines.push(`💫 ${L.name} bị **Choáng Váng** — mất lượt.`);
  return { dotA, dotB: s.dmg.B > 0 ? dotB : 0, stunned, lines };
}
const mods = (L) => ({ A: FXE.modifiers(L.fx, 'A'), B: FXE.modifiers(L.fx, 'B') });
/** Nhân sát thương người chơi gây ra (Cuồng Huyết / Suy Nhược). */
const outMult = (L) => { const m = FXE.modifiers(L.fx, 'A'); return Math.max(0.05, m.atkMult * (1 + m.dmgOut)); };
/** Nhân sát thương người chơi NHẬN (Hộ Thể). */
const takeMult = (L) => 1 - FXE.modifiers(L.fx, 'A').dr;
/** Nhân sát thương kẻ địch gây ra (Suy Nhược do kỹ năng tộc lên kẻ địch). */
const foeOutMult = (L) => { const m = FXE.modifiers(L.fx, 'B'); return Math.max(0.05, m.atkMult * (1 + m.dmgOut)); };
/** Xác suất người chơi né đòn nhờ hiệu ứng (Linh Thân / Băng Phong) — chỉ phần TRONG TRẬN, né bền vững do hệ thống gốc tự tính. */
const dodgeChance = (L) => Math.max(0, Math.min(0.5, FXE.modifiers(L.fx, 'A').dodge));

function pseudo(L, curHp, maxHp) {
  const u = unitA(maxHp); const pool = HB.attach({ A: Math.max(0, curHp) / u, B: 100 }, { A: 100, B: 100 });
  const cd = { A: { race: L.cd.race, kill: 0 }, B: { race: 0, kill: 0 } };
  return { b: { race: { A: L.race }, cd, tag: { A: L.name, B: L.foe.name }, hp: pool, fx: L.fx, totals: { A: { heal: 0 }, B: { heal: 0 } } }, pool, u };
}
/**
 * Kỹ năng tộc tự phát khi sẵn sàng (không thêm nút). Trả null nếu không có/đang hồi.
 *  • kind 'self'  : { kind, lines, heal (+hồi / −hiến tế, tuyệt đối) } — người chơi VẪN ra đòn thường nếu `free`.
 *  • kind 'attack': { kind, lines, mult, critAdd } — adapter nhân `mult` vào đòn và gọi after() sau đòn.
 */
function race(L, curHp, maxHp, { selfOnly = false } = {}) {
  if (!L.race || L.cd.race > 0 || String(ST.get('kernel_race_auto', 'on')) === 'off') return null;
  if (selfOnly && L.race.def.kind !== 'self') return null;                  // vd Chứng Đạo: không có đòn tấn công → chỉ dùng kỹ năng tự thân
  const { b, pool, u } = pseudo(L, curHp, maxHp); const def = L.race.def; L.cd.race = L.race.cd * cdMult(L.sys);
  if (def.kind === 'self') {
    const before = pool.A; const lines = RS.castSelf(b, 'A', 'B'); noCtrlOnFoe(L);
    return { kind: 'self', name: L.race.action, free: !!def.free, lines, heal: Math.round((pool.A - before) * u) };
  }
  const p = RS.params(b, 'A');
  return { kind: 'attack', name: L.race.action, lines: [`${L.name} thi triển **${L.race.action}**!`], mult: p.skillDmg, critAdd: p.critAdd };
}
/** Sau đòn tấn công của kỹ năng tộc: áp hiệu ứng lên kẻ địch (Thiêu Đốt / Xuất Huyết). rec = { damage, is_crit }. */
function after(L, rec) {
  if (!L.race || L.race.def.kind !== 'attack') return [];
  const b = { race: { A: L.race }, cd: { A: { race: 0 }, B: {} }, tag: { A: L.name, B: L.foe.name }, fx: L.fx };
  const lines = RS.after(b, 'A', 'B', { dodge: false, damage: rec.damage, is_crit: !!rec.is_crit }); noCtrlOnFoe(L); return lines;
}
/** Cuối hiệp: giảm hiệu ứng + hồi chiêu. */
function end(L) { FXE.endRound(L.fx); if (L.cd.race > 0) L.cd.race -= 1; }
/** Mô tả hiệu ứng đang có (cho nhật ký/UI). */
const describe = (L) => ({ me: FXE.describe(L.fx, 'A'), foe: FXE.describe(L.fx, 'B') });

module.exports = { SYSTEMS, SYS_NAME, CD_MULT, cdMult, mode, on, foePct, foeUnit, open, toJSON, resetFoe, begin, mods, outMult, takeMult, foeOutMult, dodgeChance, race, after, end, describe, memGet, memPeek, memDrop };
