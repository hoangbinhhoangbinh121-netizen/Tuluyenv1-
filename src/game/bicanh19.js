'use strict';
/**
 * BÍ CẢNH TIÊN GIỚI V19.0 — 19 bí cảnh × 5 tầng, chiến đấu theo lượt có trạng thái (solo hoặc tổ đội 2–5 người).
 *
 *  • Toàn bộ tiến trình nằm trong bảng bc19_runs (JSON) → bot khởi động lại KHÔNG mất tiến trình; nút bấm là nút tĩnh `b19|<run>|<hành động>`.
 *  • Phần LÕI chiến đấu (newState / step) là hàm thuần — không đụng DB — để mô phỏng/cân bằng bằng test. Phần vỏ (start/act/auto…) mới đọc/ghi DB.
 *  • Chỉ số quái/Boss = hệ số × Công Kích / Sinh Mệnh người chơi (spec §2.5). Sát thương: ATK × hệ số kỹ năng × ngẫu nhiên(0,9–1,1) × 100/(100+DEF%) — DEF% = DEF tính theo
 *    % Công Kích của bên tấn công (DEF tuyệt đối sẽ làm sát thương gần bằng 0 ở số lớn), xuyên giáp trừ vào DEF% trước khi tính.
 *  • Phần thưởng trao NGAY khi qua mỗi tầng (trong 1 transaction cùng lúc lưu trạng thái) → không thưởng 2 lần, không mất khi restart.
 */
const D = require('../db');
const K = require('./constants');
const R = require('./realm');
const Cu = require('./cultivator');
const T = require('./talent');
const TO = require('./talentOps');
const CPX = require('./cpfx');
const FX19 = require('./fx19');
const BM = require('./benmenh19');
const Inv = require('./invsvc');
const D16 = require('../data/congphap_v16');
const IT = require('../data/items_v17');
const B = require('../data/bicanh19');
const KN = require('./combatKernel');
const { now, int, random, randUniform, randInt, choice, clamp } = require('../util');

const { Delta } = Cu;
// ---------------------------------------------------------------- cấu hình cân bằng (chỉnh 1 chỗ; test mô phỏng đọc từ đây)
const CFG = {
  ENTRIES_PER_DAY: 3,         // số lần vào mỗi bí cảnh / người / ngày (giờ VN)
  LL_START: 100, LL_REGEN: 14, // Linh Lực (%): khởi đầu 100, hồi mỗi lượt của chính mình
  IDLE_SKIP: 90,              // giây: người tới lượt không phản hồi → thành viên khác được hành động thay
  BOSS_K: 0.42, MOB_K: 0.35,  // hệ số hiệu chỉnh sát thương quái → người chơi (Boss / quái thường & tinh anh)
  HP_EASE: 0.10, ATK_EASE: 0.10, // spec §2.7: hệ số độ khó bổ sung được hiệu chỉnh (1 + (hệ số − 1) × EASE)
  GUARD_CUT: 0.60, GUARD_TELE_EXTRA: 0.70, // Phòng Thủ: giảm 60% đòn kế; đòn tụ lực giảm thêm (×0,7)
  REST_HEAL: 0.22, REST_LL: 30, REST_CD: 2, REST_TAKE: 0.6, // Điều Tức
  FLOOR_HEAL: 0.35, FLOOR_LL: 40, REVIVE_HP: 0.30,           // giữa 2 tầng
  PARTY_HP: 0.65, PARTY_ACT: 0.5, // số lần kẻ địch ra đòn mỗi vòng = 1 + PARTY_ACT × (N−1) (sát thương Boss tăng chậm hơn HP — spec §2.8)
              // BossHP = Solo × (1 + 0.65 × (N − 1))
  DEF_CAP: 70, CRIT_BASE: 0.05, CRIT_BASE_MULT: 1.5, DMG_CAP: 9e17, LOG_KEEP: 9,   // v19.9: nâng trần 9e15 → 9e17 để Boss ×10–20 HP không bị chặn phẳng ở cảnh giới cao
  BOSS_CRIT: 0.08, AOE_SPLIT: 0.45,
  ITEMS_MAX: 3,               // Huyết Nguyên Đan tối đa mỗi lần vào
  AUTO_MAX: 30,               // "Tự Chiến" tối đa bấy nhiêu lượt / lần bấm (v19.9: 6 → 30 vì Boss trâu hơn)
  // v19.9: ĐƯỜNG CONG SỨC MẠNH BOSS theo bí cảnh (0..18): HP ×10 → ×20, sát thương ×1 → ×1,6 (tuyến tính, nên bí cảnh sau LUÔN mạnh hơn bí cảnh trước).
  POW_HP: [10, 20], POW_ATK: [1, 1.6],
  KIND_HP: { normal: 0.20, elite: 0.35, mini: 0.60, guard: 0.80, final: 1 },      // tỉ lệ so với Boss cuối (quái thường ×2–4, Boss cuối ×10–20)
  KIND_ATK: { normal: 0.40, elite: 0.60, mini: 0.80, guard: 0.90, final: 1 },
};
const FLOOR_TU = [0.012, 0.014, 0.018, 0.024, 0.040];   // % tu vi cần để qua Trung Kỳ của cảnh giới bí cảnh (tính theo bí cảnh, không theo người chơi → vào bí cảnh thấp không lợi hơn)
const FLOOR_LT = [1, 1.2, 1.5, 2, 4];
const LT_BASE = (i) => int(500000 * 1.3 ** i);
const BOSS_K_OF = (kind) => (B.BOSS_KINDS.has(kind) ? CFG.BOSS_K : CFG.MOB_K);
/** v19.9: hệ số sức mạnh theo bí cảnh + loại kẻ địch. { hp, atk } — nhân vào HP (so với Công Kích người chơi) và sát thương (so với Sinh Mệnh người chơi). */
function bossPower(bcIdx, kind) {
  const t = clamp((Number(bcIdx) || 0) / 18, 0, 1);
  const lerp = (a, b) => a + (b - a) * t;
  return { hp: lerp(CFG.POW_HP[0], CFG.POW_HP[1]) * (CFG.KIND_HP[kind] || 1) * (K.BC19_HP_MULT || 1), atk: lerp(CFG.POW_ATK[0], CFG.POW_ATK[1]) * (CFG.KIND_ATK[kind] || 1) * (K.BC19_ATK_MULT || 1) };
}

// ---------------------------------------------------------------- hành động người chơi (spec §2.5)
const ACT = {
  atk: { name: 'Đánh Thường', mult: 1.0, ll: 0, icon: '⚔️' },
  trong: { name: 'Trọng Kích', mult: 1.5, ll: 10, icon: '💢' },
  than: { name: 'Thần Thông', mult: 2.2, ll: 25, icon: '✨', unlock: 'Cần tiểu cảnh giới Trung Kỳ trở lên' },
  tuyet: { name: 'Tuyệt Kỹ', mult: 3.5, ll: 40, cd: 3, icon: '🌠', unlock: 'Cần trang bị 1 Công Pháp' },
  bi: { name: 'Bí Pháp Cấm Kỵ', mult: 5.0, ll: 60, cd: 5, recoil: 0.08, icon: '☠️', unlock: 'Cần Công Pháp + Hậu Kỳ trở lên (hoặc vượt cảnh giới bí cảnh); phản phệ 8% sinh mệnh' },
  sk: { name: 'Kỹ Công Pháp', mult: 2.0, ll: 15, cd: 3, icon: '📖', unlock: 'Cần trang bị 1 Công Pháp' },
  item: { name: 'Dùng Vật Phẩm', icon: '💊', unlock: 'Huyết Nguyên Đan: hồi sinh mệnh, tối đa 3 viên mỗi lần vào' },
  guard: { name: 'Phòng Thủ', icon: '🛡️' },
  rest: { name: 'Điều Tức', icon: '🧘' },
  race: { name: 'Kỹ Năng Tộc', mult: 1.0, ll: 0, icon: '🧬', unlock: 'v22.1: cần bật Combat Kernel Bí Cảnh + có Chủng Tộc' },
};
// Kỹ năng chủ động đặc trưng của công pháp V19 (spec §4.2): mult / hồi chiêu / hiệu ứng
const SIG = {
  1043: { name: 'Vạn Kiếm Quy Nhất', mult: 2.2, cd: 3 },
  1047: { name: 'Thiên Đế Trấn Thế', mult: 2.5, cd: 3, weaken: [0.20, 2], chance: 0.25 },
  1049: { name: 'Hư Không Trảm', mult: 2.8, cd: 3 },
};

const REALM_NAME = (i) => K.REALMS[B.BCS[i].realm].name;
const bcOf = (i) => B.BCS[i] || null;

// ================================================================ LÕI THUẦN
const hasBook = (m) => m.eq.length > 0;
/** Kỹ công pháp của người chơi: dựa quyển ô 1. null nếu chưa trang bị. */
function sigOf(m) {
  if (!m.eq.length) return null;
  if (m.bm && m.bm.awaken >= 3) {   // Bản Mệnh Thần Thông (thức tỉnh 3): kỹ công pháp của quyển Bản Mệnh, mạnh hơn
    const b = D16.BY_TIER.get(m.bm.tier); const base = SIG[m.bm.tier] || { mult: 2.0, cd: 3 };
    if (b) return { ...base, name: `${(b.skills[3] || b.skills[0]).name} · Bản Mệnh`, mult: base.mult + 0.8, cd: Math.max(1, base.cd - 1), tier: m.bm.tier };
  }
  const t = m.eq[0];
  if (SIG[t]) return { ...SIG[t], tier: t };
  const b = D16.BY_TIER.get(t);
  if (b) return { name: b.skills[3].name, mult: 2.0, cd: 3, tier: t };
  return { name: 'Công Pháp Cổ Điển', mult: 1.8, cd: 3, tier: t };
}
const elemMultOf = (row, bc) => { try { return T.bossElemMult(row, bc.idx + 1); } catch (_) { return 1; } };
/** Ảnh chụp chỉ số 1 người chơi lúc vào bí cảnh (từ hàng cultivators). */
function snapMember(row, uid, name, bc) {
  const b = T.bundle(row); const eq = Cu.equippedCongphapTiers(row); const perks = FX19.combatPerks(row);
  const maxHp = Math.max(1, Cu.effectiveMaxHp(row));
  const m = {
    uid: String(uid), name: String(name || uid).slice(0, 32), atk: Math.max(1, Cu.effectiveAtk(row)), def: Math.max(0, Cu.effectiveDef(row)), spd: Cu.effectiveSpd(row),
    maxHp, hp: maxHp, ll: CFG.LL_START, shield: 0, realm: row.realm_index, stage: row.stage_index, eq,
    crit: clamp(CFG.CRIT_BASE + (b.crit || 0), 0, 0.5), critMult: 0.5 + (b.critMult || 0), pierce: clamp(b.pierce || 0, 0, 0.4), dodge: clamp(b.dodge || 0, 0, 0.30),
    dr: clamp(b.dr || 0, 0, 0.30), ls: clamp(b.lifesteal || 0, 0, 0.10), regen: b.regen || 0, boss: clamp(CPX.bossBonus(row), 0, 1.5), em: elemMultOf(row, bc),
    perks, cd: { tuyet: 0, bi: 0, sk: 0, rest: 0, p_shield: 0, p_surv: 0, p_stop: 0 }, guard: 0, weak: null, atkBuff: 0, t: 0, alive: true, dealt: 0, taken: 0, first: true,
    surv: 0, chuyen: 0, minHp: maxHp,
  };
  if (eq.includes(1055) || (perks.dao === 'luanhoi' && perks.awake >= 1)) m.surv = 1;      // sống sót 1 lần/bí cảnh
  if (perks.binh === 'ban') m.chuyen = 1;
  const bm = BM.get(uid); if (bm) { m.bm = { tier: bm.tier, awaken: bm.awaken }; }
    return m;
}
const alive = (st) => st.members.filter((m) => m.alive);
const meanAtk = (st) => st.members.reduce((s, m) => s + m.atk, 0) / Math.max(1, st.members.length);

function log(st, line) { st.log.push(line); if (st.log.length > 40) st.log.splice(0, st.log.length - 40); st.turnLog.push(line); }

/** Sinh kẻ địch cho "lượt" thứ st.wave của tầng st.floor. */
function spawnEnemy(st) {
  const bc = bcOf(st.bc); const kind = B.FLOORS[st.floor - 1].waves[st.wave]; const N = st.members.length;
  const KD = B.KINDS[kind]; let name; let hpMult; let atkPct = KD.atk; let defPct = KD.def * 100; let skill = null; let mobKey = null;
  if (kind === 'normal') {
    const mob = choice(bc.mobs); mobKey = mob.key; name = mob.name; skill = mob.skill;
    hpMult = 2 + (mob.hp - 0.8) / (2.5 - 0.8) * 2;      // 0,8..2,5 → 2..4 (spec §2.5: quái thường HP = P_ATK × 2–4)
    atkPct = mob.atk; defPct = mob.def * 100;
  } else {
    hpMult = randUniform(KD.hp[0], KD.hp[1]);
    name = { elite: choice(bc.elites), mini: bc.mini, guard: bc.guard, final: bc.final }[kind];
    if (kind === 'elite') skill = { name: 'Hợp Kích', mult: 1.5, pierce: 0.15, weaken: [0.10, 2] };
  }
  const hpE = 1 + (bc.diff.hp - 1) * CFG.HP_EASE; const atkE = 1 + (bc.diff.atk - 1) * CFG.ATK_EASE;
  const party = 1 + CFG.PARTY_HP * (N - 1);
  const pw = bossPower(st.bc, kind);   // v19.9
  const hp = Math.max(1, Math.min(CFG.DMG_CAP, Math.ceil(meanAtk(st) * hpMult * hpE * party * pw.hp)));
  const resBase = { normal: 0, elite: 0.03, mini: 0.05, guard: 0.07, final: 0.10 }[kind];
  const e = {
    kind, name, hp, maxHp: hp, atkPct: atkPct * atkE * pw.atk, defPct, counter: randUniform(KD.counter[0], KD.counter[1]) * atkE * pw.atk, res: resBase, skill, mobKey,
    phase: 1, phaseAtk: 1, rage: 1, rageT: 0, shield: 0, tele: null, et: 0, weak: null, lose: false, healed: {}, shieldUsed: {}, bc: st.bc,
  };
  if (kind === 'final') { e.skills = bc.skills; }
  return e;
}

/** Sát thương người → kẻ địch. */
function playerDamage(st, m, e, mult, opts = {}) {
  const lines = [];
  let d = m.atk * (1 - (m.weak ? m.weak.pct : 0)) * (1 + m.atkBuff) * mult * randUniform(0.9, 1.1);
  if (m.eq.includes(1054) === false && m.weak && m.weak.turns <= 0) m.weak = null;
  const crit = random() < clamp(m.crit + (opts.crit || 0), 0, 0.6);
  if (crit) { d *= CFG.CRIT_BASE_MULT + m.critMult + (m.perks.dao === 'satphat' && m.perks.awake >= 1 ? 0.10 : 0); }
  const isBoss = B.BOSS_KINDS.has(e.kind);
  const pierce = clamp(m.pierce + (opts.pierce || 0), 0, 0.6);
  d *= 100 / (100 + e.defPct * (1 - pierce));
  if (isBoss) { d *= 1 + m.boss; if (m.eq.includes(1046)) d *= 1.05; }
  let res = e.res; if (e.kind === 'final' && m.perks.dao === 'huydiet' && m.perks.awake >= 2) res = Math.max(0, res - 0.05);
  d *= 1 - res;
  d *= m.em;
  if (opts.heavy && m.perks.dao === 'huydiet' && m.perks.awake >= 1) d *= 1.08;
  if (m.first && m.perks.dao === 'satphat' && m.perks.awake >= 2) { d *= 1.30; lines.push('🗡️ **Sát Phạt** — đòn mở màn mạnh thêm 30%!'); }
  m.first = false;
  if (m.perks.binh === 'kiem' && random() < 0.10) { d *= 2; lines.push('🗡️ **Vạn Kiếm Diệt Thế** bộc phát — sát thương nhân đôi!'); }
  d = Math.max(1, Math.min(CFG.DMG_CAP, Math.floor(d)));
  return { dmg: d, crit, lines };
}
function hurtEnemy(e, dmg) {
  let rest = dmg;
  if (e.shield > 0) { const a = Math.min(e.shield, rest); e.shield -= a; rest -= a; }
  e.hp = Math.max(0, e.hp - rest);
}
/** Giai đoạn Boss cuối (spec §2.5): 100–70 / 70–35 / 35–0; ATK +15% / +30% (không cộng dồn qua lượt). */
function checkPhase(st, e) {
  if (e.kind !== 'final' || e.hp <= 0) return;
  const pct = e.hp / e.maxHp; const target = pct <= 0.35 ? 3 : pct <= 0.70 ? 2 : 1;
  while (e.phase < target) {
    e.phase += 1; e.phaseAtk = [1, 1, 1.15, 1.30][e.phase]; e.tele = null; e.et = 0;
    const ub = e.phase === 2 ? 0.70 : 0.35;
    const heal = Math.min(Math.floor(e.maxHp * 0.05), Math.max(0, Math.floor(e.maxHp * ub) - e.hp));
    if (heal > 0) e.hp += heal;
    log(st, `🔥 **${e.name}** bước vào **Giai đoạn ${e.phase}**${heal > 0 ? ` và hồi ${Math.floor(heal * 100 / e.maxHp)}% sinh mệnh nhờ **${e.skills[4]}**` : ''}! Sức mạnh +${e.phase === 2 ? 15 : 30}%.`);
    if (e.phase === 2) { e.shield += Math.floor(e.maxHp * 0.15); log(st, `🌫️ **${e.skills[2]}**: ${e.name} dựng khiên bằng 15% sinh mệnh tối đa!`); }
    if (e.phase === 3) log(st, `💀 **${e.skills[3]}** đã mở khóa — hãy đề phòng đòn tụ lực!`);
  }
}
const heal = (m, amount, st) => {
  const a = Math.max(0, Math.min(m.maxHp - m.hp, Math.floor(amount)));
  if (a > 0) m.hp += a; return a;
};
/** Sát thương kẻ địch → người chơi (đã tính DEF, né, Phòng Thủ, giảm sát thương, khiên, nội tại công pháp). Trả { dmg, miss, crit }. */
function enemyDamage(st, e, m, base, o = {}) {
  const lines = [];
  let raw = base * m.maxHp * e.phaseAtk * e.rage * BOSS_K_OF(e.kind) * randUniform(0.9, 1.1);
  const defPct = clamp(100 * m.def / (m.atk + m.def + 1), 0, CFG.DEF_CAP) * (1 - (o.pierce || 0));
  raw *= 100 / (100 + defPct);
  const KL = kLayer(m);                                                                  // v22.0 (chỉ khi kernel_bicanh = kernel): hiệu ứng trong trận của người bị đánh
  const CI = KL ? KN.cpIn(KL) : null;                                                     // v22.1: hiệu ứng chiêu công pháp (hộ thể / né / suy yếu) gộp vào kernel
  if (KL) raw *= KN.takeMult(KL) * KN.foeOutMult(KL) * (1 - clamp(CI.guard, 0, 0.6)) * (1 - clamp(CI.weak, 0, 0.6));
  if (!o.noDodge && random() < clamp(m.dodge + (KL ? KN.dodgeChance(KL) + CI.dodge : 0), 0, 0.6)) { if (KL) KN.cpTick(KL); log(st, `💨 **${m.name}** né được đòn của ${e.name}!`); return { dmg: 0, miss: true }; }
  if (KL) KN.cpTick(KL);
  if (m.guard > 0) { raw *= 1 - CFG.GUARD_CUT; if (o.tele) raw *= CFG.GUARD_TELE_EXTRA; }
  raw *= 1 - m.dr;
  if (e.weak) raw *= 1 - e.weak.pct;
  let crit = false;
  if (B.BOSS_KINDS.has(e.kind) && random() < CFG.BOSS_CRIT) {
    crit = true; raw *= 1.5;
    if (m.eq.includes(1053) && random() < 0.10) { raw = raw / 1.5 * 0.5; log(st, `🌌 **Thiên Đạo Hộ Thể** của ${m.name} hóa giải đòn chí mạng!`); }
  }
  let dmg = Math.max(1, Math.min(CFG.DMG_CAP, Math.floor(raw)));
  if (m.shield > 0) { const a = Math.min(m.shield, dmg); m.shield -= a; dmg -= a; }
  // nội tại khi sắp gục
  if (dmg >= m.hp) {
    const cdOk = (k) => (m.cd[k] || 0) <= 0;
    if (m.surv > 0) { m.surv -= 1; dmg = m.hp - 1; log(st, `♻️ **Bảo mệnh**: ${m.name} sống sót với 1 sinh mệnh!${m.perks.dao === 'luanhoi' && m.perks.awake >= 2 ? ' (hồi thêm 20%)' : ''}`); if (m.perks.dao === 'luanhoi' && m.perks.awake >= 2) m.pendingHeal = 0.20; }
    else if (m.eq.includes(1045) && m.hp / m.maxHp < 0.20 && cdOk('p_surv') && random() < 0.08 * (m.eq.includes(1052) ? 1.08 : 1)) { m.cd.p_surv = 10; dmg = m.hp - 1; log(st, `♾️ **Luân Hồi**: ${m.name} thoát chết với 1 sinh mệnh!`); }
  }
  if (dmg > 0 && m.hp / m.maxHp - dmg / m.maxHp < 0.25 && m.hp - dmg > 0 && m.eq.includes(1042) && (m.cd.p_shield || 0) <= 0 && random() < 0.10 * (m.eq.includes(1052) ? 1.08 : 1)) {
    m.shield += Math.floor(m.maxHp * 0.12 * (m.eq.includes(1052) ? 1.08 : 1)); m.cd.p_shield = 5; log(st, `🛡️ **Bất Diệt Chi Thể**: ${m.name} dựng khiên hấp thụ 12% sinh mệnh!`);
  }
  m.hp = Math.max(0, m.hp - dmg); m.taken += dmg; m.minHp = Math.min(m.minHp, m.hp);
  if (m.chuyen > 0 && m.hp > 0 && m.hp / m.maxHp < 0.15) { m.chuyen -= 1; const h = heal(m, m.maxHp * 0.30); log(st, `☯️ **Luân Hồi Chuyển Sinh**: ${m.name} hồi ${h.toLocaleString('vi-VN')} sinh mệnh!`); }
  if (m.hp <= 0) { m.alive = false; log(st, `☠️ **${m.name}** gục ngã!`); }
  return { dmg, crit };
}
const fmt = (n) => Number(n).toLocaleString('vi-VN');

/** Kẻ địch ra đòn sau hành động của người chơi. */
function enemyTurn(st) {
  const e = st.enemy; const live = alive(st); if (!live.length) return;
  if (e.lose) { e.lose = false; log(st, `⏳ **${e.name}** bị đóng băng thời gian — mất lượt!`); return; }
  e.et += 1;
  const target = () => choice(alive(st));
  const hit = (m, base, o, label) => {
    const r = enemyDamage(st, e, m, base, o);
    if (r.miss) return r;
    log(st, `${label} **${m.name}** −${fmt(r.dmg)} sinh mệnh${r.crit ? ' (chí mạng)' : ''} → còn ${fmt(m.hp)}/${fmt(m.maxHp)}`); return r;
  };
  const counter = () => { const m = target(); if (m) hit(m, e.counter, {}, `💥 ${e.name} phản công`); };
  // ---- tụ lực đang chờ → tung đòn
  if (e.tele) {
    const t = e.tele; e.tele = null;
    if (t.aoe) {
      log(st, `🌋 **${e.name}** tung **${t.name}** — đòn diện rộng!`);
      for (const m of alive(st)) hit(m, e.atkPct * t.mult * (live.length > 1 ? CFG.AOE_SPLIT : 1), { pierce: t.pierce || 0, tele: true }, '💢');
    } else { const m = target(); log(st, `🌋 **${e.name}** tung **${t.name}**!`); hit(m, e.atkPct * t.mult, { pierce: t.pierce || 0, tele: true }, '💢'); }
    return;
  }
  const announce = (name, mult, pierce, aoe) => {
    e.tele = { name, mult, pierce, aoe };
    log(st, `⚠️ **${e.name}** đang tụ lực **${name}**${aoe ? ' (diện rộng)' : ''} — đòn kế tiếp rất nặng! Hãy 🛡️ **Phòng Thủ**.`);
  };
  if (e.kind === 'final') {
    const sk = e.skills; const ph = e.phase; const k = ph === 1 ? e.et % 4 : e.et % 3;
    if (ph === 1) {
      if (k === 1) { const m = target(); log(st, `👑 **${e.name}** thi triển **${sk[0]}**!`); hit(m, e.atkPct * 1.4, {}, '💢'); applyWeakPlayer(st, m, 0.10, 2); }
      else if (k === 3) { counter(); announce(sk[1], 1.8, 0.20, false); } else counter();
    } else if (ph === 2) {
      if (k === 1) { const m = target(); log(st, `👑 **${e.name}** thi triển **${sk[0]}**!`); hit(m, e.atkPct * 1.4, {}, '💢'); applyWeakPlayer(st, m, 0.10, 2); }
      else if (k === 2) { counter(); announce(sk[1], 1.8, 0.20, st.members.length > 1); } else counter();
    } else {
      if (k === 0) { const m = target(); log(st, `👑 **${e.name}** thi triển **${sk[0]}**!`); hit(m, e.atkPct * 1.4, {}, '💢'); applyWeakPlayer(st, m, 0.10, 2); }
      else if (k === 2) { counter(); announce(sk[3], 2.5, 0, st.members.length > 1); } else counter();
    }
    return;
  }
  if (e.kind === 'mini' || e.kind === 'guard') {
    if (e.kind === 'guard' && !e.shieldUsed.half && e.hp / e.maxHp <= 0.5) { e.shieldUsed.half = 1; e.shield += Math.floor(e.maxHp * 0.10); log(st, `🛡️ **${e.name}** dựng khiên bằng 10% sinh mệnh!`); }
    if (e.et % 4 === 3) { counter(); announce(e.kind === 'mini' ? `${bcOf(st.bc).theme} Trọng Kích` : `${bcOf(st.bc).theme} Phong Tỏa`, e.kind === 'mini' ? 1.7 : 2.0, e.kind === 'guard' ? 0.15 : 0, false); } else counter();
    return;
  }
  // quái thường / tinh anh: kỹ năng mỗi 3 lượt, không báo trước
  if (e.skill && e.et % 3 === 0) {
    const m = target(); const s = e.skill;
    if (s.shield) { e.shield += Math.floor(e.maxHp * s.shield); log(st, `🛡️ **${e.name}** dùng **${s.name}** — dựng khiên ${Math.round(s.shield * 100)}% sinh mệnh.`); counter(); return; }
    if (s.rage) { e.rage = 1 + s.rage; e.rageT = 3; log(st, `😡 **${e.name}** dùng **${s.name}** — công kích +${Math.round(s.rage * 100)}% trong 3 lượt.`); counter(); return; }
    log(st, `🩸 **${e.name}** dùng **${s.name}**!`); hit(m, e.atkPct * s.mult, { pierce: s.pierce || 0 }, '💢');
    if (s.weaken) applyWeakPlayer(st, m, s.weaken[0], s.weaken[1]);
    return;
  }
  counter();
}
function applyWeakPlayer(st, m, pct, turns) {
  if (!m.alive) return;
  if (m.eq.includes(1054) && random() < 0.05) { log(st, `🌟 **Vô Cực Chi Thể**: ${m.name} miễn nhiễm hiệu ứng khống chế!`); return; }
  if (m.perks.effRes > 0 && random() < m.perks.effRes) { log(st, `🔱 **Thiên Đạo Bất Xâm**: ${m.name} kháng được hiệu ứng xấu!`); return; }
  m.weak = { pct, turns }; log(st, `⬇️ **${m.name}** bị suy yếu: công kích −${Math.round(pct * 100)}% trong ${turns} lượt.`);
}

/** Điều kiện dùng 1 hành động. Trả chuỗi lỗi hoặc null. */
function canAct(st, m, a) {
  const e = st.enemy; const bc = bcOf(st.bc);
  if (!ACT[a]) return 'Hành động không hợp lệ.';
  if (a === 'race') { const K0 = CUR && CUR.m === m ? CUR.L : null; if (!K0) return 'Kỹ năng chủng tộc chưa bật ở Bí Cảnh (Combat Kernel đang tắt).'; return KN.raceCheck(K0) || (e ? null : 'Không có kẻ địch.'); }
  if (a === 'item') { if ((m.items || 0) >= CFG.ITEMS_MAX) return `Đã dùng đủ ${CFG.ITEMS_MAX} vật phẩm trong lần vào này.`; if (!(st.itemHeal > 0)) return 'Bạn không có Huyết Nguyên Đan.'; if (m.hp >= m.maxHp) return 'Sinh mệnh đang đầy.'; return null; }
  if (a === 'guard' || a === 'rest') { if (a === 'rest' && m.cd.rest > 0) return `Điều Tức còn hồi chiêu ${m.cd.rest} lượt.`; return null; }
  const A = ACT[a]; if (m.ll < (A.ll || 0)) return `Không đủ Linh Lực (cần ${A.ll}%, còn ${Math.floor(m.ll)}%).`;
  if (a === 'than' && !(m.stage >= 1 || m.realm > bc.realm)) return 'Thần Thông cần tiểu cảnh giới Trung Kỳ trở lên.';
  if (['tuyet', 'bi', 'sk'].includes(a) && !hasBook(m)) return `${A.name} cần trang bị ít nhất 1 Công Pháp.`;
  if (a === 'bi' && !(m.stage >= 2 || m.realm > bc.realm)) return 'Bí Pháp Cấm Kỵ cần Hậu Kỳ trở lên (hoặc cảnh giới cao hơn bí cảnh).';
  const key = { tuyet: 'tuyet', bi: 'bi', sk: 'sk' }[a];
  if (key && m.cd[key] > 0) return `${A.name} còn hồi chiêu ${m.cd[key]} lượt.`;
  if (!e) return 'Không có kẻ địch.';
  return null;
}
/** Thực hiện hành động của thành viên idx. Trả { ok, error } — đã xử lý cả lượt kẻ địch, chuyển tầng, thắng/thua. */
let LITE = null;                                                                         // v22.1: lớp nhẹ của các thành viên bị đánh trong lượt này (để ghi lại số lượt hiệu ứng cpfx)
let CUR = null;                                                                          // v22.0: ngữ cảnh kernel của lượt đang chạy (đồng bộ, 1 lượt tại 1 thời điểm)
const BOSSLIKE = (e) => B.BOSS_KINDS.has(e.kind);
/** Lớp kernel của 1 thành viên (đang hành động → bản đầy đủ; người khác → bản nhẹ từ m.kx); null nếu tắt / chưa có. */
function kLayer(m) {
  if (!KN.on('bicanh')) return null;
  if (CUR && CUR.m === m) return CUR.L;
  if (LITE && LITE.has(m)) return LITE.get(m);
  if (!m.kx) return null; const Lx = KN.open('bicanh', { user_id: m.uid, __lite: true }, {}, m.kx); if (LITE) LITE.set(m, Lx); return Lx;
}
function step(st, uid, a) {
  if (!KN.on('bicanh') || st.over) return stepCore(st, uid, a);
  const m = st.members.find((x) => x.uid === String(uid)); const row = m && m.alive ? Cu.getCultivator(uid) : null;
  if (!row || !st.enemy) return stepCore(st, uid, a);
  const e = st.enemy; const fk = `${st.floor}:${st.wave}:${e.name}`;
  const L = KN.open('bicanh', row, { name: e.name, unit: KN.foeUnit(m.atk), ctrlImmune: BOSSLIKE(e), me: `**${m.name}**` }, m.kx || null);
  if (m.kx && m.kx.fk !== fk) KN.resetFoe(L, { name: e.name, unit: KN.foeUnit(m.atk), ctrlImmune: BOSSLIKE(e) });
  const r0 = L.round; CUR = { L, m }; LITE = new Map();
  let r; try { r = stepCore(st, uid, a); } finally { for (const [m2, L2] of LITE) if (m2 !== m) m2.kx = { ...KN.toJSON(L2), fk: (m2.kx || {}).fk }; CUR = null; LITE = null; }
  if (L.round !== r0) KN.end(L);
  m.kx = { ...KN.toJSON(L), fk };
  return r;
}
function stepCore(st, uid, a) {
  if (st.over) return { ok: false, error: 'Bí cảnh đã kết thúc.' };
  const mi = st.members.findIndex((x) => x.uid === String(uid)); if (mi < 0) return { ok: false, error: 'Bạn không thuộc đội này.' };
  const m = st.members[mi]; if (!m.alive) return { ok: false, error: 'Bạn đã gục — chờ qua tầng kế tiếp để hồi sinh.' };
  const bad = canAct(st, m, a); if (bad) return { ok: false, error: bad };
  st.turnLog = []; const e = st.enemy;
  const KL = CUR && CUR.m === m ? CUR.L : null; let kStun = false;
  if (KL) {                                                                              // v22.0: sát thương theo thời gian / choáng ở ĐẦU lượt của người chơi
    const bk = KN.begin(KL, m.maxHp); for (const l of bk.lines) log(st, l);
    m.hp = Math.max(1, m.hp - bk.dotA); kStun = bk.stunned;
    if (bk.dotB > 0) { hurtEnemy(e, bk.dotB); m.dealt += bk.dotB; log(st, `🔥 Hiệu ứng gây thêm **${fmt(bk.dotB)}** sát thương lên ${e.name}.`); }
  }
  // ---- thực hiện hành động
  if (kStun) { /* Choáng Váng: mất lượt */ }
  else if (a === 'guard') {
    m.guard = 1; m.ll = Math.min(100, m.ll + 10);
    if (m.perks.binh === 'chung') { e.weak = { pct: 0.15, turns: 2 }; log(st, `🔔 **Hỗn Độn Chấn Hồn**: ${e.name} yếu đi 15% trong 2 lượt!`); }
    log(st, `🛡️ **${m.name}** thủ thế — đòn kế tiếp giảm ${Math.round(CFG.GUARD_CUT * 100)}%, hồi 10% Linh Lực.`);
  } else if (a === 'item') {
    const got = heal(m, m.maxHp * st.itemHeal); m.items = (m.items || 0) + 1; st.itemHeal = 0;
    log(st, `💊 **${m.name}** uống Huyết Nguyên Đan: hồi ${fmt(got)} sinh mệnh.`);
  } else if (a === 'rest') {
    let h = CFG.REST_HEAL * (1 + m.regen + (m.eq.includes(1041) ? 0.05 : 0)) + (m.perks.dao === 'sinhmenh' && m.perks.awake >= 1 ? 0.05 : 0);
    h = Math.min(0.5, h); const got = heal(m, m.maxHp * h); m.ll = Math.min(100, m.ll + CFG.REST_LL); m.cd.rest = CFG.REST_CD;
    log(st, `🧘 **${m.name}** điều tức: hồi ${fmt(got)} sinh mệnh (+${CFG.REST_LL}% Linh Lực).`);
  } else {
    const A = ACT[a]; let mult = A.mult; let sig = null; let opts = {};
    m.ll -= A.ll || 0;
    if (a === 'sk') { sig = sigOf(m); mult = sig.mult; m.cd.sk = sig.cd; }
    if (KL && a === 'sk' && sig) { const cpr = KN.cp(KL, String(sig.name).split(' · ')[0], m.hp, m.maxHp); for (const l of cpr.lines) log(st, l); if (cpr.heal > 0) heal(m, cpr.heal); }   // v22.1
    if (a === 'tuyet') { m.cd.tuyet = A.cd; opts.heavy = true; }
    if (a === 'bi') { m.cd.bi = A.cd; opts.heavy = true; }
    let kRace = null;
    if (KL) {                                                                            // v22.0: kỹ năng tộc tự phát + chuỗi nhân hiệu ứng
      kRace = KN.race(KL, m.hp, m.maxHp, { request: a === 'race' });
      if (kRace) { for (const l of kRace.lines) log(st, l); if (kRace.kind === 'self') { if (kRace.heal >= 0) heal(m, kRace.heal); else m.hp = Math.max(1, m.hp + kRace.heal); } else mult *= kRace.mult; }
    }
    const selfRace = a === 'race' && kRace && kRace.kind === 'self';          // v22.1: kỹ năng tự thân thay cho đòn đánh
    if (selfRace) log(st, `🧬 **${m.name}** dùng **${kRace.name}**.`);
    else {
      const r = playerDamage(st, m, e, mult, opts);
      if (KL) { r.dmg = Math.max(1, Math.floor(r.dmg * KN.outMult(KL))); for (const l of KN.after(KL, { damage: r.dmg, is_crit: r.crit })) log(st, l); }
      hurtEnemy(e, r.dmg); m.dealt += r.dmg;
      log(st, `${A.icon} **${m.name}** dùng **${sig ? sig.name : A.name}**: −${fmt(r.dmg)} sinh lực ${e.name}${r.crit ? ' 💥 chí mạng' : ''}`);
      for (const l of r.lines) log(st, l);
      if (m.ls > 0) { const h = heal(m, Math.min(r.dmg * m.ls, m.maxHp * 0.10)); if (h > 0) log(st, `🩸 Hút máu: **${m.name}** hồi ${fmt(h)}.`); }
      if (sig && sig.weaken && random() < sig.chance) { e.weak = { pct: sig.weaken[0], turns: sig.weaken[1] }; log(st, `⬇️ **${sig.name}** làm ${e.name} suy yếu ${Math.round(sig.weaken[0] * 100)}% trong ${sig.weaken[1]} lượt!`); }
      if (A.recoil) { const rc = Math.min(m.hp - 1, Math.floor(m.maxHp * A.recoil)); m.hp -= rc; log(st, `☠️ Phản phệ: **${m.name}** mất ${fmt(rc)} sinh mệnh.`); }
      checkPhase(st, e);
    }
  }
  m.t += 1;
  if (m.pendingHeal) { heal(m, m.maxHp * m.pendingHeal); m.pendingHeal = 0; }
  // ---- kẻ địch gục?
  if (e.hp <= 0) { log(st, `🏆 Hạ gục **${e.name}**!`); endTurnTicks(st, m); return advance(st); }
  // ---- 10% đóng băng thời gian
  if (m.eq.includes(1050) && (m.cd.p_stop || 0) <= 0 && random() < 0.08) { e.lose = true; m.cd.p_stop = 6; log(st, `⏳ **Thời Gian Tĩnh Chỉ** của ${m.name} phát động!`); }
  // ---- 10% hành động hai lần (Thời Không awaken 2)
  const extra = m.perks.dao === 'thoikhong' && m.perks.awake >= 2 && a !== 'guard' && a !== 'rest' && random() < 0.10;
  if (extra) log(st, `🌀 **Thời Không** — ${m.name} hành động thêm một lượt (kẻ địch không kịp phản ứng)!`);
  else {
    // Tổ đội: kẻ địch KHÔNG ra đòn sau mỗi hành động của từng người (sẽ nhân sát thương theo số người) — dùng "tín dụng hành động": mỗi hành động cộng (1+0,5(N−1))/N, đủ 1 mới ra đòn
    const N = st.members.length; e.credit = (e.credit || 0) + (1 + CFG.PARTY_ACT * (N - 1)) / N;
    if (e.credit >= 0.999) { e.credit -= 1; enemyTurn(st); }
  }
  endTurnTicks(st, m);
  if (!alive(st).length) { st.over = 'lost'; log(st, '💀 Cả đội đã gục ngã — bí cảnh thất bại.'); return { ok: true }; }
  return { ok: true };
}
/** Cuối lượt của m: hồi Linh Lực, giảm hồi chiêu, hết hiệu ứng, nội tại; chuyển lượt. */
function endTurnTicks(st, m) {
  if (m.alive) {
    m.ll = Math.min(100, m.ll + CFG.LL_REGEN + (m.perks.dao === 'thoikhong' && m.perks.awake >= 1 ? 3 : 0));
    if (m.eq.includes(1048) && m.t % 5 === 0) { const h = heal(m, m.maxHp * 0.04 * (m.eq.includes(1052) ? 1.08 : 1)); if (h > 0) log(st, `♾️ **Vĩnh Hằng Bất Hủ**: ${m.name} hồi ${fmt(h)} sinh mệnh.`); }
    if (m.perks.dao === 'sinhmenh' && m.perks.awake >= 2 && m.hp / m.maxHp < 0.5) heal(m, m.maxHp * 0.02);
  }
  for (const k of Object.keys(m.cd)) if (m.cd[k] > 0) m.cd[k] -= 1;
  m.guard = 0;
  if (m.weak) { m.weak.turns -= 1; if (m.weak.turns <= 0) m.weak = null; }
  const e = st.enemy;
  if (e) { if (e.weak) { e.weak.turns -= 1; if (e.weak.turns <= 0) e.weak = null; } if (e.rageT > 0) { e.rageT -= 1; if (e.rageT <= 0) e.rage = 1; } }
  // chuyển lượt cho người còn sống kế tiếp
  const n = st.members.length;
  for (let k = 1; k <= n; k += 1) { const j = (st.turn + k) % n; if (st.members[j].alive) { st.turn = j; break; } }
  st.turnAt = now();
}

// ---------------------------------------------------------------- tiến trình tầng / bí cảnh
function newFloor(st) {
  const F = B.FLOORS[st.floor - 1]; st.wave = 0; st.event = null; st.eventAtk = 0;
  const ev = st.floor === 1 ? null : choice(B.EVENTS);
  if (ev) {
    st.event = ev.key; log(st, ev.text);
    for (const m of alive(st)) {
      const f = ev.fx;
      if (f.heal) heal(m, m.maxHp * f.heal); if (f.ll) m.ll = Math.min(100, m.ll + f.ll); if (f.dmg) m.hp = Math.max(1, m.hp - Math.floor(m.maxHp * f.dmg));
      if (f.atk) m.atkBuff = f.atk; if (f.shield) m.shield += Math.floor(m.maxHp * f.shield);
    }
    if (ev.fx.lt) st.ltBonus = ev.fx.lt;
  }
  for (const m of st.members) if (m.alive) { if (m.perks.binh === 'thap') m.shield += Math.floor(m.maxHp * 0.08); if (m.bm && m.bm.awaken >= 1) m.shield += Math.floor(m.maxHp * 0.05); }
  st.enemy = spawnEnemy(st);
  for (const m of st.members) m.first = true;
  log(st, `🗺️ **Tầng ${F.n} — ${F.name}**: ${F.desc}`);
  log(st, `👾 Gặp **${st.enemy.name}** (${B.FLOORS[st.floor - 1].waves[st.wave] === 'normal' ? 'quái thường' : kindName(st.enemy.kind)})!`);
}
const kindName = (k) => ({ normal: 'quái thường', elite: 'tinh anh', mini: 'mini Boss', guard: 'Boss canh cửa', final: 'BOSS CUỐI' })[k];
/** Gọi khi kẻ địch hiện tại chết: sang lượt kế / hoàn tất tầng / thắng. Trả { ok, floorClear?, won? }. */
function advance(st) {
  const F = B.FLOORS[st.floor - 1]; st.wave += 1;
  if (st.wave < F.waves.length) { st.enemy = spawnEnemy(st); for (const m of st.members) m.first = true; log(st, `👾 Gặp **${st.enemy.name}** (${kindName(st.enemy.kind)})!`); return { ok: true }; }
  st.cleared = st.floor; st.pendingReward = st.floor;       // UI/vỏ sẽ trao thưởng rồi gọi nextFloor
  if (st.floor >= 5) { st.over = 'won'; log(st, `🎉 **CHINH PHỤC ${bcOf(st.bc).name.toUpperCase()}!**`); return { ok: true, won: true, floorClear: true }; }
  log(st, `✅ Hoàn thành **Tầng ${F.n} — ${F.name}**!`);
  return { ok: true, floorClear: true };
}
function nextFloor(st) {
  if (st.over || st.floor >= 5) return;
  st.floor += 1;
  for (const m of st.members) {
    if (!m.alive) { m.alive = true; m.hp = Math.max(1, Math.floor(m.maxHp * CFG.REVIVE_HP)); m.ll = Math.max(m.ll, 40); log(st, `✨ **${m.name}** được hồi sinh với ${Math.round(CFG.REVIVE_HP * 100)}% sinh mệnh.`); }
    else { heal(m, m.maxHp * CFG.FLOOR_HEAL); m.ll = Math.min(100, m.ll + CFG.FLOOR_LL); }
    m.atkBuff = 0; m.guard = 0; m.weak = null; m.shield = 0; m.cd = { tuyet: 0, bi: 0, sk: 0, rest: 0, p_shield: 0, p_surv: m.cd.p_surv, p_stop: 0 };
  }
  st.ltBonus = 0; st.pendingReward = 0; newFloor(st);
}
/** Trạng thái khởi tạo từ danh sách ảnh chụp thành viên. */
function newState(bcIdx, members) {
  const st = { v: 1, bc: bcIdx, floor: 1, wave: 0, members, turn: 0, turnAt: now(), enemy: null, log: [], turnLog: [], over: null, event: null, ltBonus: 0, pendingReward: 0, cleared: 0, rewards: {}, startedAt: now(), turns: 0 };
  log(st, `🌌 Bước vào **${bcOf(bcIdx).name}** — ${bcOf(bcIdx).desc}`);
  newFloor(st); return st;
}

// ================================================================ AI mẫu (dùng cho Tự Chiến + mô phỏng cân bằng)
/** Chọn hành động hợp lý: né tụ lực bằng Phòng Thủ, hồi khi thấp máu, dùng kỹ năng mạnh khi đủ Linh Lực. */
function autoPick(st, m) {
  const e = st.enemy; const hpPct = m.hp / m.maxHp; const ok = (a) => !canAct(st, m, a);
  if (e.tele && ok('guard') && hpPct < 0.9) return 'guard';
  if (hpPct < 0.38 && ok('rest')) return 'rest';
  const boss = B.BOSS_KINDS.has(e.kind);
  const order = boss ? ['bi', 'tuyet', 'sk', 'than', 'trong', 'atk'] : ['tuyet', 'than', 'trong', 'atk'];
  for (const a of order) {
    if (!ok(a)) continue;
    if (a === 'bi' && hpPct < 0.55) continue;                          // Bí Pháp có phản phệ: chỉ khi còn khỏe
    if (!boss && a !== 'atk' && e.hp < m.atk * 1.6) continue;          // quái sắp chết: tiết kiệm Linh Lực
    if (a === 'trong' && m.ll < 30) continue;                            // giữ Linh Lực cho kỹ năng lớn
    return a;
  }
  return 'atk';
}

// ================================================================ VỎ DB
const dayKey = () => `bc19:${new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)}`;
const entriesToday = (uid, idx) => Inv.dailyGet(uid, `${dayKey()}:${idx}`);
const rowOf = (runId) => D.get('SELECT * FROM bc19_runs WHERE run_id = ?', runId);
const parse = (r) => { try { return JSON.parse(r.state || '{}'); } catch (_) { return {}; } };
function save(runId, st, status = null) {
  D.run('UPDATE bc19_runs SET state = ?, status = COALESCE(?, status), updated_at = ? WHERE run_id = ?', JSON.stringify(st), status, now(), runId);
}
const activeRunId = (uid) => { const r = D.get("SELECT r.run_id FROM bc19_members m JOIN bc19_runs r ON r.run_id = m.run_id WHERE m.user_id = ? AND r.status IN ('lobby','active') ORDER BY r.run_id DESC LIMIT 1", String(uid)); return r ? r.run_id : null; };
/** Dọn các lần vào treo quá lâu (không ai bấm 6 giờ) để người chơi không bị kẹt. */
function sweepStale(maxIdle = 6 * 3600) {
  const t = now() - maxIdle;
  const rows = D.all("SELECT run_id FROM bc19_runs WHERE status IN ('lobby','active') AND updated_at < ?", t);
  for (const r of rows) D.run("UPDATE bc19_runs SET status = 'abandoned' WHERE run_id = ?", r.run_id);
  return rows.length;
}
/** v19.3: giải thích RÕ vì sao chưa vào được dù cảnh giới có thể đã đủ — Bí Cảnh Tiên Giới cần ĐÃ Phi Thăng Tiên Giới (thế giới 2), không chỉ cảnh giới. */
function notAscendedMsg(row, bc) {
  const base = 'Bí Cảnh Tiên Giới chỉ mở sau khi **Phi Thăng Tiên Giới**';
  const realmOk = row.realm_index >= bc.realm;
  const head = `${base}${realmOk ? ` — cảnh giới của bạn (${K.REALMS[row.realm_index].name}) đã đủ nhưng bạn vẫn đang ở **${K.WORLD_TIERS[row.world_tier] || '?'}**.` : '.'}`;
  if (row.world_tier < 1) return `${head}\nHãy Phi Thăng Linh Giới trước (\`/dieukienphithang\`), rồi Phi Thăng Tiên Giới.`;
  let missing = [];
  try { const A = require('./ascension'); missing = A.tiengioiChecklist(row).filter(([, ok]) => !ok).map(([, , l]) => l); } catch (_) { /* chỉ mất phần liệt kê */ }
  const list = missing.length ? `\nCòn thiếu ${missing.length} điều kiện Phi Thăng Tiên Giới:\n${missing.map((m) => `❌ ${m}`).join('\n')}` : '\nĐủ điều kiện rồi — dùng `/phithang` để Phi Thăng Tiên Giới.';
  return `${head}${list}\n_(xem tiến độ: \`/dieukienphithang\`)_`.slice(0, 1000);
}
function whyCannotEnter(row, idx) {
  const bc = bcOf(idx); if (!bc) return 'Bí cảnh không tồn tại.';
  if (!row) return 'Bạn chưa bắt đầu tu tiên.';
  if (row.world_tier < 2) return notAscendedMsg(row, bc);
  if (!row.thiennhanngusuy_passed) return require('./ascension').tienGateMsg(row, bc.name);
  if (row.realm_index < bc.realm) return `**${bc.name}** yêu cầu cảnh giới **${K.REALMS[bc.realm].name}** trở lên (hiện: ${K.REALMS[row.realm_index].name}). Dùng \`/dotpha\` để tiến lên.`;
  if (D.get('SELECT 1 AS x FROM bc19_runs r JOIN bc19_members m ON m.run_id = r.run_id WHERE m.user_id = ? AND r.status IN (\'lobby\',\'active\')', String(row.user_id))) return 'Bạn đang ở trong một lần thám hiểm bí cảnh khác — hãy hoàn thành hoặc rút lui trước.';
  if (entriesToday(row.user_id, idx) >= CFG.ENTRIES_PER_DAY) return `Hôm nay bạn đã vào **${bc.name}** đủ ${CFG.ENTRIES_PER_DAY} lần.`;
  return null;
}
/** v21.4: người chơi bị kẹt trong PHÒNG CHỜ cũ (đội chưa bắt đầu) thì tự rời/đóng để lập hoặc vào đội mới. Không đụng lần thám hiểm đang chạy. */
function releaseLobbies(userId) {
  const uid = String(userId);
  const rows = D.all("SELECT r.run_id, r.leader FROM bc19_members m JOIN bc19_runs r ON r.run_id = m.run_id WHERE m.user_id = ? AND r.status = 'lobby'", uid);
  for (const r of rows) {
    if (r.leader === uid) D.run("UPDATE bc19_runs SET status = 'abandoned', updated_at = ? WHERE run_id = ?", now(), r.run_id);
    else D.run('DELETE FROM bc19_members WHERE run_id = ? AND user_id = ?', r.run_id, uid);
  }
  return rows.length;
}
/** Phòng chờ bỏ quên quá lâu (mặc định 30 phút không ai bấm) → đóng, để không ai bị kẹt. */
function sweepLobbies(ttl = 1800) {
  const rows = D.all("SELECT run_id FROM bc19_runs WHERE status = 'lobby' AND updated_at < ?", now() - ttl);
  for (const r of rows) D.run("UPDATE bc19_runs SET status = 'abandoned' WHERE run_id = ?", r.run_id);
  return rows.length;
}
/** Tạo phòng chờ (đội trưởng tự động là thành viên). */
function createLobby(userId, idx, { channelId = null, solo = false, name = null } = {}) {
  releaseLobbies(userId);
  const row = Cu.getCultivator(userId); const bad = whyCannotEnter(row, idx); if (bad) return { ok: false, error: bad };
  return D.transaction(() => {
    const t = now(); const st = { lobby: true, bc: idx, names: { [String(userId)]: name || String(userId) } };
    const r = D.run("INSERT INTO bc19_runs (bc_idx, leader, status, state, channel_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?)", idx, String(userId), 'lobby', JSON.stringify(st), channelId ? String(channelId) : null, t, t);
    D.run('INSERT INTO bc19_members (run_id, user_id) VALUES (?,?)', r.lastInsertRowid, String(userId));
    const runId = r.lastInsertRowid;
    if (solo) return startRun(runId, userId);
    return { ok: true, runId };
  });
}
function join(runId, userId, name = null) {
  const r = rowOf(runId); if (!r || r.status !== 'lobby') return { ok: false, error: 'Phòng chờ không còn tồn tại.' };
  const members = D.all('SELECT user_id FROM bc19_members WHERE run_id = ?', runId);
  if (members.some((x) => x.user_id === String(userId))) return { ok: false, error: 'Bạn đã ở trong đội.' };
  if (members.length >= 5) return { ok: false, error: 'Đội đã đủ 5 người.' };
  releaseLobbies(userId);                                                 // v21.4: đang kẹt ở phòng chờ khác thì tự rời
  const row = Cu.getCultivator(userId); const bad = whyCannotEnter(row, r.bc_idx); if (bad) return { ok: false, error: bad };
  D.run('INSERT INTO bc19_members (run_id, user_id) VALUES (?,?)', runId, String(userId));
  const st = parse(r); st.names = st.names || {}; st.names[String(userId)] = name || String(userId); save(runId, st);
  return { ok: true };
}
function leave(runId, userId) {
  const r = rowOf(runId); if (!r || r.status !== 'lobby') return { ok: false, error: 'Phòng chờ không còn tồn tại.' };
  if (r.leader === String(userId)) { D.run("UPDATE bc19_runs SET status = 'abandoned', updated_at = ? WHERE run_id = ?", now(), runId); return { ok: true, closed: true }; }
  D.run('DELETE FROM bc19_members WHERE run_id = ? AND user_id = ?', runId, String(userId)); return { ok: true };
}
/** Bắt đầu: chụp chỉ số, trừ 1 lượt vào/ngày của mỗi người. */
function startRun(runId, userId) {
  const r = rowOf(runId); if (!r || r.status !== 'lobby') return { ok: false, error: 'Phòng chờ không còn tồn tại.' };
  if (r.leader !== String(userId)) return { ok: false, error: 'Chỉ đội trưởng mới bắt đầu được.' };
  const old = parse(r); const ids = D.all('SELECT user_id FROM bc19_members WHERE run_id = ? ORDER BY rowid', runId).map((x) => x.user_id);
  const bc = bcOf(r.bc_idx); const members = [];
  for (const uid of ids) {
    const row = Cu.getCultivator(uid); if (!row) return { ok: false, error: `Thành viên ${uid} không hợp lệ.` };
    if (row.realm_index < bc.realm) return { ok: false, error: `Thành viên ${(old.names || {})[uid] || uid} chưa đủ cảnh giới.` };
    if (entriesToday(uid, r.bc_idx) >= CFG.ENTRIES_PER_DAY) return { ok: false, error: `Thành viên ${(old.names || {})[uid] || uid} đã hết lượt vào hôm nay.` };
    members.push(snapMember(row, uid, (old.names || {})[uid], bc));
  }
  return D.transaction(() => {
    for (const uid of ids) Inv.dailyAdd(uid, `${dayKey()}:${r.bc_idx}`, 1);
    const st = newState(r.bc_idx, members); st.names = old.names || {};
    save(runId, st, 'active'); return { ok: true, runId, state: st };
  });
}
function load(runId) { const r = rowOf(runId); if (!r) return null; return { run: r, st: parse(r) }; }

/** Thực hiện hành động trong DB. Trả { ok, error?, st, rewardText? } */
function act(runId, userId, a) {
  return D.transaction(() => {
    const L = load(runId); if (!L || L.run.status !== 'active') return { ok: false, error: 'Lần thám hiểm này đã kết thúc.' };
    const st = L.st; const uid = String(userId);
    if (!st.members.some((m) => m.uid === uid)) return { ok: false, error: 'Bạn không thuộc đội này.' };
    if (st.pendingReward) return { ok: false, error: 'Hãy bấm **Sang tầng kế** để nhận thưởng và tiếp tục.', st };
    const cur = st.members[st.turn];
    if (cur.uid !== uid) {
      if (now() - (st.turnAt || 0) < CFG.IDLE_SKIP && cur.alive) return { ok: false, error: `Chưa tới lượt bạn — đang chờ **${cur.name}** (nếu họ im lặng ${CFG.IDLE_SKIP}s, bạn được hành động thay).`, st };
      st.turn = st.members.findIndex((m) => m.uid === uid);
    }
    let itemQ = null;
    if (a === 'item') {   // trừ vật phẩm TRONG transaction; nếu bước chiến đấu từ chối thì rollback toàn bộ
      const qs = Object.keys(Inv.byQuality(uid, 'dan_huyet_nguyen')).map(Number); if (qs.length) { itemQ = Math.max(...qs); st.itemHeal = Math.min(0.60, 0.35 * IT.qMult(itemQ)); } else st.itemHeal = 0;
    }
    const res = step(st, uid, a);
    if (!res.ok) { st.itemHeal = 0; return { ...res, st }; }
    if (a === 'item' && itemQ !== null && !Inv.take(uid, 'dan_huyet_nguyen', 1, { q: itemQ, why: 'bicanh19 item' })) throw new Error('không trừ được vật phẩm');
    st.turns += 1;
    let status = null; let rewardText = '';
    if (st.pendingReward) { rewardText = payFloor(st); }
    if (st.over) { status = st.over === 'won' ? 'won' : 'lost'; if (st.over === 'won') finishWin(st); else recordBest(st); }
    save(runId, st, status);
    return { ok: true, st, rewardText };
  });
}
/** Sang tầng kế (sau khi nhận thưởng). */
function next(runId, userId) {
  return D.transaction(() => {
    const L = load(runId); if (!L || L.run.status !== 'active') return { ok: false, error: 'Lần thám hiểm này đã kết thúc.' };
    const st = L.st; if (!st.members.some((m) => m.uid === String(userId))) return { ok: false, error: 'Bạn không thuộc đội này.' };
    if (!st.pendingReward || st.over) return { ok: false, error: 'Chưa hoàn thành tầng hiện tại.' };
    st.turnLog = []; nextFloor(st); save(runId, st); return { ok: true, st };
  });
}
/** Rút lui: kết thúc, giữ phần thưởng các tầng đã qua. Đội trưởng rút → cả đội; thành viên rút → chỉ mình họ (coi như gục). */
function retreat(runId, userId) {
  return D.transaction(() => {
    const L = load(runId); if (!L || !['lobby', 'active'].includes(L.run.status)) return { ok: false, error: 'Lần thám hiểm này đã kết thúc.' };
    if (L.run.status === 'lobby') return leave(runId, userId);
    const st = L.st; const uid = String(userId); const m = st.members.find((x) => x.uid === uid); if (!m) return { ok: false, error: 'Bạn không thuộc đội này.' };
    if (L.run.leader === uid || st.members.length === 1) { st.over = 'retreat'; log(st, `🏃 **${m.name}** ra lệnh rút lui.`); recordBest(st); save(runId, st, 'abandoned'); return { ok: true, st, ended: true }; }
    m.alive = false; m.hp = 0; m.left = true; log(st, `🏃 **${m.name}** rút lui khỏi bí cảnh.`);
    D.run('DELETE FROM bc19_members WHERE run_id = ? AND user_id = ?', runId, uid);
    if (st.turn === st.members.indexOf(m)) endTurnTicks(st, m);
    if (!alive(st).length) { st.over = 'lost'; recordBest(st); save(runId, st, 'lost'); return { ok: true, st, ended: true }; }
    save(runId, st); return { ok: true, st, ended: false };
  });
}
/** Tự Chiến: tối đa n lượt hành động theo AI cho người đang tới lượt; dừng khi kẻ địch tụ lực (để người chơi tự Phòng Thủ), qua tầng, hoặc kết thúc. */
function auto(runId, userId, n = 3) {
  n = clamp(int(n) || 1, 1, CFG.AUTO_MAX); let last = null; let done = 0; const texts = [];
  for (let i = 0; i < n; i += 1) {
    const L = load(runId); if (!L || L.run.status !== 'active') break;
    const st = L.st; if (st.pendingReward) break;
    const cur = st.members[st.turn]; const me = st.members.find((m) => m.uid === String(userId));
    if (!me || !me.alive) break;
    if (cur.uid !== String(userId)) { if (done === 0) { last = act(runId, userId, 'atk'); done += 1; } break; }
    if (i > 0 && st.enemy.tele) break;       // dừng trước đòn nặng: để người chơi chọn Phòng Thủ
    last = act(runId, userId, autoPick(st, me)); done += 1;
    if (!last.ok) break; if (last.rewardText) texts.push(last.rewardText); if (last.st.over) break;
  }
  if (last && texts.length) last.rewardText = texts.join('\n');
  return last || { ok: false, error: 'Không thể Tự Chiến lúc này.' };
}

// ---------------------------------------------------------------- phần thưởng
const poolOf = (idx) => IT.ITEMS.filter((it) => require('../data/items_v19').SRC[it.id] && require('../data/items_v19').SRC[it.id].includes(`bc19_${idx}`) && !it.is_quest_item);
const rr = (a, b) => randInt(a, b);
/** v19.10: KỲ VỌNG số vật phẩm `id` nhặt được sau MỘT lượt thông 5 tầng bí cảnh `idx` (solo, không Dị Biến, không tính truyền thừa/mảnh) — dùng cho bản hướng dẫn lụm đồ Chứng Đạo; cùng công thức với rollMember. */
function expectedDrop(id, idx) {
  const pool = poolOf(idx); const rare = pool.filter((it) => it.rarity >= 7); const common = pool.filter((it) => it.rarity <= 6 || it.id.startsWith('cp19_'));
  const b = B.MAT_BOOST[id]; const avg = b ? (b[0] + b[1]) / 2 : 1.5; let e = 0;
  const inR = rare.some((it) => it.id === id); const inC = common.some((it) => it.id === id);
  for (const F of B.FLOORS) {
    if (inR) { const p0 = 0.25 * F.rareMult; e += (p0 + F.chest * p0 * 1.6) / rare.length * avg; }
    if (inC) e += F.commonRate / common.length * avg;
  }
  if (id === 'tdc19_bat_hu_de_cot' && idx === 8) e += B.DE_COT_BOSS8 * 1;
  if (id === 'tdc19_de_dao_chung_nhan' && idx >= 8) e += 0.20;
  return e;
}
const ownedBook = (row, tier) => Cu.ownedCongphapTiers(row).has(tier);
function rollMember(st, uid, mult, floor, share) {
  const idx = st.bc; const bc = bcOf(idx); const row = Cu.getCultivator(uid); if (!row) return { lines: [] };
  const F = B.FLOORS[floor - 1]; const lines = []; const lootM = TO.lootMultOf(row);
  const boost = require('./event19').bcBoost();   // Thiên Địa Dị Biến: thưởng ×1,5 · rơi ×1,3
  const up = {}; const got = {};
  // Tu Vi + Linh Thạch (100%)
  const baseTu = Math.min(R.tuViRequired(bc.realm, 1, 2), R.tuViRequired(row.realm_index, row.stage_index, row.world_tier));
  const tu = Math.max(1, int(baseTu * FLOOR_TU[floor - 1] * lootM * mult * boost.reward));
  const lt = Math.max(1, int(LT_BASE(idx) * FLOOR_LT[floor - 1] * mult * (1 + (st.ltBonus || 0)) * (1 + (T.bundle(row).thach || 0)) * boost.reward));
  const isFirst = floor === 5 && share.first;
  const fm = isFirst ? 2 : 1;
  up.tu_vi = new Delta(tu * fm); up.linh_thach = new Delta(lt * fm);
  lines.push(`+${fmt(tu * fm)} tu vi, +${fmt(lt * fm)} Linh Thạch${isFirst ? ' (×2 lần đầu chinh phục)' : ''}${boost.ev ? ' 🌠 _Thiên Địa Dị Biến ×1,5_' : ''}`);
  const items = {};
  const addItem = (id, n) => { if (n > 0) items[id] = (items[id] || 0) + n; };
  const pool = poolOf(idx); const common = pool.filter((it) => it.rarity <= 6 || it.id.startsWith('cp19_')); const rare = pool.filter((it) => it.rarity >= 7);
  const pickQty = (it, lo, hi) => { const b = B.MAT_BOOST[it.id]; return b ? rr(b[0], b[1]) : rr(lo, hi); };
  if (common.length && random() < F.commonRate * boost.drop) { const it = choice(common); addItem(it.id, Math.max(1, int(pickQty(it, 1, 2 + (floor >= 4 ? 1 : 0)) * mult))); }
  const rareRolls = 1 + (share.chest ? 1 : 0);
  for (let k = 0; k < rareRolls; k += 1) if (rare.length && random() < 0.25 * F.rareMult * (k ? 1.6 : 1) * boost.drop) { const it = choice(rare); addItem(it.id, Math.max(1, int(pickQty(it, 1, 2) * mult))); }
  // v20: nguyên liệu nghề của bí cảnh Tiên Giới (giai đoạn ≥ Tiên Cấp), từ tầng 3 — có trần ngày/tuần trong bảng rơi
  try { const sn = require('../data/v20_data').stageOfRealm(bc.realm); if (sn >= 6 && floor >= 3) { const v = require('./drops17').roll(uid, `v20_bc19_s${sn}`, { noText: true, row }); for (const [id, n] of Object.entries(v.got)) { lines.push(`${I19ItemEmoji(id)} **${n}** ${IT.BY_ID[id].name}`); } } } catch (_) { /* không để V20 làm hỏng thưởng bí cảnh */ }
  // mảnh công pháp 18% (từ tầng 2)
  const frags = B.FRAG_BY_BC[idx];
  if (frags && F.fragRate && random() < 0.18 * F.fragRate) {
    const fid = choice(frags); const f = D16.FRAG_BY_ID.get(fid);
    if (f && !ownedBook(row, f.book)) { const g = rr(1, floor === 5 ? 5 : 3); const C16 = require('./congphapV16'); const tot = C16.addFrag(uid, fid, g); lines.push(`${f.icon} **${g}** ${f.name} (${tot}/${f.need})`); }
  }
  // mảnh pháp bảo 12%
  if (random() < 0.12) { const g = rr(1, 2 + int(idx / 6)); up.manh_phap_bao = new Delta(g); lines.push(`🧩 **${g}** Mảnh Pháp Bảo`); }
  // bảo vật bí cảnh 5% (tầng 4–5 ×2)
  if (random() < 0.05 * (floor >= 4 ? 2 : 1)) { const g = rr(1, 2 + int(idx / 5)); up.linh_tinh = new Delta(g); lines.push(`💎 Bảo vật bí cảnh: **${g}** Linh Tinh`); }
  // rương
  if (share.chest) { up.linh_thach = new Delta(lt * fm + lt); lines.push(`🎁 Mở **rương bảo vật** — thêm ${fmt(lt)} Linh Thạch và 1 lượt nguyên liệu hiếm`); }
  // truyền thừa 1% (tầng 3 và 5: ×3)
  if (random() < 0.01 * (floor === 3 || floor === 5 ? 3 : 1)) {
    const tier = B.LEGACY_BOOK[idx];
    if (tier && !ownedBook(row, tier)) { const C16 = require('./congphapV16'); if (C16.grantInto(up, row, tier)) lines.push(`📜✨ **TRUYỀN THỪA ĐẶC BIỆT** — cảm ngộ **${D16.BY_TIER.get(tier).name}**!`); }
    else if (rare.length) { const it = choice(rare); addItem(it.id, 3); lines.push('📜 **Truyền thừa đặc biệt**: nhận bộ nguyên liệu quý.'); }
  }
  // Boss cuối: công pháp + Chứng Nhận Đế Đạo
  if (floor === 5) {
    for (const [tier, ch] of B.BOOK_BY_BC[idx] || []) {
      const bk = D16.BY_TIER.get(tier);
      if (bk && random() < ch * (isFirst ? 2 : 1) && !ownedBook(row, tier) && row.realm_index >= bk.require_realm) { const C16 = require('./congphapV16'); if (C16.grantInto(up, row, tier)) lines.push(`📜✨ **${bk.name}** hiện ra từ thi hài Boss!`); }
    }
    if (idx >= 8 && (isFirst || random() < 0.20)) addItem('tdc19_de_dao_chung_nhan', 1);
    if (idx === 8 && (isFirst || random() < B.DE_COT_BOSS8)) addItem('tdc19_bat_hu_de_cot', 1);   // v19.10: đường gom Đế Cốt cho người chưa Chứng Đạo
  }
  Cu.updateCultivator(uid, up);
  { const LG = require('./ledger'); for (const [cur, d] of [['linh_thach', up.linh_thach], ['linh_tinh', up.linh_tinh]]) if (d && d.n) LG.noteOnce(uid, d.n, { currency: cur, reason: 'thưởng Bí Cảnh', ref: `bc${idx} tầng ${floor}`, key: LG.nonce('bc19') }); }   // v22.1
  for (const [id, n] of Object.entries(items)) { const g = Inv.add(uid, id, n, { why: `bicanh19:${idx}:${floor}` }); if (g) lines.push(`${I19ItemEmoji(id)} **${g}** ${IT.BY_ID[id].name}`); }
  return { lines, tu: tu * fm, lt: lt * fm };
}
const I19ItemEmoji = (id) => { try { return require('../ui/emo17').item(id); } catch (_) { return '📦'; } };
/** Trao thưởng 1 tầng cho cả đội. Trả chuỗi tóm tắt (cũng lưu st.rewards). */
function payFloor(st) {
  const floor = st.pendingReward; st.pendingReward = floor; // giữ để chờ "Sang tầng kế"
  const N = st.members.length; const totalDealt = Math.max(1, st.members.reduce((s, m) => s + (m.dealt || 0), 0)); const out = [];
  const F = B.FLOORS[floor - 1];
  for (const m of st.members) {
    if (m.left) continue;
    const share = (m.dealt || 0) / totalDealt;
    const mult = N === 1 ? 1 : clamp(0.6 + 0.4 * Math.min(2, share * N), 0.6, 1.4) * (m.alive ? 1 : 0.5);
    const prog = D.get('SELECT clears FROM bc19_prog WHERE user_id = ? AND bc_idx = ?', m.uid, st.bc);
    const chest = random() < F.chest;
    const r = rollMember(st, m.uid, mult, floor, { first: !prog || prog.clears === 0, chest });
    st.rewards[m.uid] = st.rewards[m.uid] || { tu: 0, lt: 0, lines: [] };
    st.rewards[m.uid].tu += r.tu || 0; st.rewards[m.uid].lt += r.lt || 0; st.rewards[m.uid].lines.push(...r.lines.map((x) => `T${floor}: ${x}`));
    try { const g = BM.addInsight(m.uid, floor === 5 ? 4 : 1); if (g) r.lines.push(`🧿 Lĩnh ngộ Bản Mệnh +${g}`); } catch (_) { /* không để Bản Mệnh làm hỏng thưởng */ }
    out.push(`**${m.name}**${N > 1 ? ` (×${mult.toFixed(2)})` : ''}: ${r.lines.join(' · ')}`);
  }
  st.pendingReward = floor; st.rewardFloor = floor;
  const txt = `🎁 **Phần thưởng Tầng ${floor}**\n${out.join('\n')}`;
  st.lastReward = txt; return txt;
}
const ACH = { first: '🏅 Chinh phục lần đầu', c5: '🔁 Chinh phục 5 lần', c20: '♾️ Chinh phục 20 lần', flawless: '✨ Toàn thắng không ai gục', solo: '🗡️ Độc hành chinh phục', all19: '👑 Chinh phục cả 19 bí cảnh' };
function finishWin(st) {
  const idx = st.bc; const flawless = st.members.every((m) => m.alive && !m.left); const solo = st.members.length === 1;
  const ids = st.members.filter((m) => !m.left).map((m) => m.uid);
  for (const uid of ids) {
    const p = D.get('SELECT * FROM bc19_prog WHERE user_id = ? AND bc_idx = ?', uid, idx);
    const clears = (p ? p.clears : 0) + 1; let ach = []; try { ach = JSON.parse((p && p.ach) || '[]'); } catch (_) { ach = []; }
    const add = (k) => { if (!ach.includes(k)) ach.push(k); };
    add('first'); if (clears >= 5) add('c5'); if (clears >= 20) add('c20'); if (flawless) add('flawless'); if (solo) add('solo');
    D.run('INSERT INTO bc19_prog (user_id, bc_idx, clears, best_floor, first_at, ach) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id, bc_idx) DO UPDATE SET clears = ?, best_floor = 5, ach = ?',
      uid, idx, clears, 5, now(), JSON.stringify(ach), clears, JSON.stringify(ach));
    const all = D.get('SELECT COUNT(*) AS n FROM bc19_prog WHERE user_id = ? AND clears > 0', uid);
    if (all && all.n >= 19) { const p2 = D.get('SELECT ach FROM bc19_prog WHERE user_id = ? AND bc_idx = ?', uid, idx); let a2 = []; try { a2 = JSON.parse(p2.ach); } catch (_) { a2 = []; } if (!a2.includes('all19')) { a2.push('all19'); D.run('UPDATE bc19_prog SET ach = ? WHERE user_id = ? AND bc_idx = ?', JSON.stringify(a2), uid, idx); } }
  }
}
/** Ghi nhận tầng cao nhất đã qua khi thua/rút lui (để hiển thị tiến độ). */
function recordBest(st) {
  for (const m of st.members) if (st.cleared > 0) D.run('INSERT INTO bc19_prog (user_id, bc_idx, clears, best_floor) VALUES (?,?,0,?) ON CONFLICT(user_id, bc_idx) DO UPDATE SET best_floor = MAX(best_floor, ?)', m.uid, st.bc, st.cleared, st.cleared);
}
function progOf(uid) {
  const out = {}; for (const r of D.all('SELECT * FROM bc19_prog WHERE user_id = ?', String(uid))) { let ach = []; try { ach = JSON.parse(r.ach || '[]'); } catch (_) { ach = []; } out[r.bc_idx] = { clears: r.clears, best: r.best_floor, ach }; }
  return out;
}

module.exports = {
  bossPower, expectedDrop,
  CFG, ACT, SIG, ACH, FLOOR_TU, FLOOR_LT, LT_BASE, bcOf, REALM_NAME, sigOf, snapMember, newState, step, nextFloor, autoPick, canAct, spawnEnemy, alive, kindName,
  whyCannotEnter, createLobby, join, leave, startRun, load, act, next, retreat, auto, activeRunId, sweepStale, sweepLobbies, releaseLobbies, entriesToday, progOf, recordBest, payFloor, rollMember, save, rowOf,
};
