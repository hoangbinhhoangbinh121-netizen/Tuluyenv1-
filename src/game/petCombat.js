'use strict';
/**
 * LINH THÚ TRONG PVP v14.0 — gắn vào mô hình "thanh sinh mệnh 100, 5 hiệp" sẵn có của pvpCore.roundAction.
 *
 * Mỗi bên có 1 "Sân" (side): trạng thái trận (khiên, DoT, choáng, suy yếu, cường hóa…) — luôn tồn tại, kể cả khi bên đó KHÔNG có thú —
 * và (nếu có thú xuất chiến) thú với rating/thiên phú/kỹ năng. Thú KHÔNG cộng chỉ số cho chủ; nó tác động bằng:
 *   • trợ chiến mỗi lượt (sát thương nhỏ),  • kỹ năng chủ động (phát động theo tỉ lệ, có hồi chiêu),  • bị động & thiên phú (đã chặn trần),
 *   • 1 lần "Hộ Chủ" của Bản Mệnh Khế.
 * Mọi hệ số lấy từ petBalance.js.
 */
const PB = require('./petBalance');
const PD = require('./petData');
const P = require('./pets');
const D = require('../db');
const { random, int, clamp, randUniform } = require('../util');

const U = PB.COMBAT;
const KHAC = { Kim: 'Mộc', Mộc: 'Thổ', Thổ: 'Thủy', Thủy: 'Hỏa', Hỏa: 'Kim' };       // X khắc Y

const newState = () => ({ shield: 0, dots: [], weaken: null, buff: null, evade: null, thorn: null, stun: false, stunImmune: 0, lastStandUsed: false, turn: 0, carry: 0, regenCarry: 0, cds: { a1: 0, a2: 0, inh: 0 }, used: [] });

/** Tổng hợp hiệu ứng bị động + thiên phú (đã nhân giai đoạn huyết mạch, khế ước, bậc kỹ năng, hệ số theo rating, rồi chặn trần). */
function fxOf(v, rating) {
  const out = {};
  const add = (fx, m) => { for (const [k, x] of Object.entries(fx || {})) out[k] = (out[k] || 0) + x * m; };
  add(v.sp.thienphu.fx, PB.STAGE_TALENT[v.stage] * (v.contractInfo ? v.contractInfo.talent : 0.9));
  const p1 = v.skills.find((s) => s.key === 'p1');
  if (p1 && p1.unlocked) add(v.sp.skills.p1.fx, PB.skillRankMult(p1.rank));
  if (v.inheritSkill && v.inheritSkill.kind === 'passive') add(v.inheritSkill.def.fx, 0.8 * PB.skillRankMult(v.inheritSkill.rank));
  const sc = PB.passiveScale(rating === undefined ? v.rating : rating);
  for (const k of Object.keys(out)) out[k] = Math.min(PB.PASSIVE_CAPS[k] === undefined ? 1 : PB.PASSIVE_CAPS[k], out[k] * sc);
  return out;
}
/** Danh sách kỹ năng CHỦ ĐỘNG đã mở khóa. */
function activesOf(v) {
  const o = [];
  for (const s of v.skills) if (s.kind === 'active' && s.unlocked) o.push({ key: s.key, def: s.def, rank: s.rank, name: s.def.n });
  if (v.inheritSkill && v.inheritSkill.kind === 'active') o.push({ key: 'inh', def: v.inheritSkill.def, rank: v.inheritSkill.rank, name: v.inheritSkill.def.n });
  return o;
}

function buildSide(row) {
  const st = { st: newState(), pet: null, fx: {}, actives: [], name: '', label: '', hanh: '', rating: 0, bias: { hp: 1, atk: 1, def: 1, spd: 1 }, owner: row ? String(row.user_id) : '', banMenh: false };
  if (!row) return st;
  const f = P.getFighter(st.owner); if (!f) return st;
  const v = P.view(f, row.realm_index); if (!v) return st;
  st.pet = v; st.hanh = v.sp.hanh; st.rating = v.rating * U.GLOBAL * (U.LINE_TUNE[v.sp.hanh] || 1) * (U.SPECIES_TUNE[v.sp.id] || 1); st.fx = fxOf(v, st.rating); st.actives = activesOf(v); st.name = v.name; st.bias = v.sp.bias;
  st.label = `${P.emojiOf(v.sp)} **${v.name}**`; st.banMenh = v.contract === 'ban_menh';
  // khiên mở màn (thiên phú "guard")
  if (st.fx.guard) st.st.shield += Math.min(30, U.HIT * U.GUARD_FRAC * st.fx.guard * Math.max(0.3, v.rating));
  return st;
}
function buildArena(rowA, rowB) {
  try { if (rowA) P.ensureMigrated(rowA.user_id); if (rowB) P.ensureMigrated(rowB.user_id); } catch (_) { /* bỏ qua */ }
  return { A: buildSide(rowA), B: buildSide(rowB) };
}
/** Hợp nhất bị động của thú vào bộ hiệu ứng talent.combatMods (cùng dạng, vẫn chặn trần). */
function mergeMods(base, side) {
  const m = { ...(base || {}) }; const fx = side.fx || {};
  const addc = (k, x, cap) => { if (x) m[k] = Math.min(cap, (m[k] || 0) + x); };
  addc('crit', fx.crit, 0.35); addc('critMult', fx.critMult, 0.8); addc('pierce', fx.pierce, 0.4); addc('lifesteal', fx.lifesteal, 0.25);
  addc('dodge', fx.dodge, 0.30); addc('dr', fx.dr, 0.40);
  return m;
}

const other = (k) => (k === 'A' ? 'B' : 'A');
const elemMult = (me, en) => (!me.pet || !en.pet ? 1 : KHAC[me.hanh] === en.hanh ? 1 + U.ELEMENT_ADV : KHAC[en.hanh] === me.hanh ? 1 - U.ELEMENT_ADV : 1);
const R1 = (x) => Math.round(x * 10) / 10;

/** Trừ máu 1 bên (qua khiên, Hộ Chủ). Trả sát thương THỰC vào sinh mệnh. */
function hurt(arena, key, amount, hp, lines, opts = {}) {
  const sd = arena[key]; const st = sd.st; let amt = Math.max(0, amount);
  if (amt <= 0) return 0;
  if (!opts.pierce && st.shield > 0) { const ab = Math.min(st.shield, amt); st.shield -= ab; amt -= ab; if (ab >= 1 && opts.say) lines.push(`🛡️ Khiên chặn ${Math.round(ab)} sát thương.`); }
  let real = Math.round(amt);
  if (real >= hp[key] && sd.banMenh && !st.lastStandUsed) {
    st.lastStandUsed = true; real = Math.max(0, hp[key] - U.LAST_STAND_HP);
    lines.push(`🔮 **Hộ Chủ!** ${sd.label} liều mình đỡ đòn chí mạng — chủ nhân còn ${Math.min(U.LAST_STAND_HP, hp[key])} sinh lực.`);
  }
  real = Math.min(real, Math.max(0, hp[key]));
  hp[key] = Math.max(0, hp[key] - real);
  return real;
}

/** Đầu lượt của bên `ak`: hồi sinh, DoT lên chính mình, hết hạn choáng. Trả { skip, lines } (skip = bị choáng/ngã xuống). */
function pre(arena, ak, hp) {
  const sd = arena[ak]; const st = sd.st; const lines = [];
  st.turn += 1;
  if (sd.pet && sd.fx.regen && hp[ak] > 0 && hp[ak] < 100) { st.regenCarry += sd.fx.regen; const whole = Math.floor(st.regenCarry); st.regenCarry -= whole; const h = Math.min(100 - hp[ak], whole); if (h > 0) { hp[ak] += h; lines.push(`🌿 ${sd.label} hồi **${h}** sinh lực cho chủ nhân.`); } }
  if (st.dots.length) {
    let tot = 0; const names = [];
    for (const d of st.dots) { tot += d.amt; names.push(d.k); d.left -= 1; }
    st.dots = st.dots.filter((d) => d.left > 0);
    const real = hurt(arena, ak, tot, hp, lines);          // DoT xuyên khiên? — không: khiên chặn DoT là hợp lý, nhưng hurt() đã trừ khiên
    if (real > 0) lines.push(`🔥 ${[...new Set(names)].join(' + ')} gây **${real}** sát thương theo thời gian.`);
  }
  if (st.stunImmune > 0) st.stunImmune -= 1;
  if (hp[ak] <= 0) return { skip: true, lines };
  if (st.stun) { st.stun = false; lines.push('💫 Bị **choáng**, mất lượt ra đòn!'); return { skip: true, lines, stunned: true }; }
  return { skip: false, lines };
}

/** Điều chỉnh sát thương CHÍNH của `ak` (cường hóa/suy yếu/mở màn/chém tàn) trước khi trừ vào đối thủ. */
function outgoing(arena, ak, damage, hp) {
  const sd = arena[ak]; const st = sd.st; let m = 1;
  if (st.buff) m *= 1 + st.buff.v;
  if (st.weaken) m *= 1 - st.weaken.v;
  if (sd.pet) {
    if (st.turn === 1 && sd.fx.opening) m *= 1 + sd.fx.opening;
    if (sd.fx.execute && hp[other(ak)] <= 35) m *= 1 + sd.fx.execute;
  }
  return Math.max(1, Math.round(damage * m));
}
/** Sát thương CHÍNH đi vào `dk`: khiên → Hộ Chủ → phản thương. Trả sát thương thực (có thể 0). */
function incoming(arena, dk, ak, damage, hp, lines) {
  const sd = arena[dk]; const st = sd.st;
  const real = hurt(arena, dk, damage, hp, lines, { say: true });
  const th = (sd.pet ? (sd.fx.thorns || 0) : 0) + (st.thorn ? st.thorn.v : 0);
  if (th > 0 && real > 0 && hp[ak] > 0) {
    const back = Math.max(0, Math.round(real * Math.min(0.7, th)));
    if (back > 0) { hp[ak] = Math.max(0, hp[ak] - back); lines.push(`🌵 Phản thương **${back}** lên kẻ ra đòn.`); }
  }
  return real;
}
/** Né tránh động (kỹ năng "evade"). */
const dynDodge = (arena, dk) => (arena[dk].st.evade ? arena[dk].st.evade.v : 0);

// ---------------------------------------------------------------- kỹ năng
function dmgUnit(sd, rank, other) { return U.HIT * U.SKILL_FRAC * sd.rating * PB.skillRankMult(rank) * sd.bias.atk * elemMult(sd, other); }
function castEffect(arena, ak, dk, hp, def, rank, lines, depth = 0) {
  const sd = arena[ak]; const en = arena[dk]; const st = sd.st; const est = en.st; const fx = sd.fx; const R = sd.rating; const rk = PB.skillRankMult(rank);
  const nm = def.n ? `**${def.n}**` : '';
  switch (def.t) {
    case 'dmg': case 'drain': {
      const hits = def.multi || 1; let total = dmgUnit(sd, rank, en) * def.p * (1 + 0.12 * (hits - 1));
      if (hp[dk] <= 35 && (def.exec || fx.execute)) total *= 1 + (def.exec || 0) + (fx.execute || 0);
      if (def.vsDot && est.dots.length) total *= 1 + def.vsDot;
      const crit = random() < 0.10 + (def.crit || 0) + (fx.crit || 0);
      if (crit) total *= 1.5 * (1 + (fx.critMult || 0));
      if (st.buff) total *= 1 + st.buff.v; if (st.weaken) total *= 1 - st.weaken.v;
      total = Math.min(total, U.HIT * U.ROUNDS_MAX_MULT * 2.5);
      let real = 0; const per = total / hits;
      for (let i = 0; i < hits && hp[dk] > 0; i += 1) real += hurt(arena, dk, per, hp, lines, { pierce: !!def.pierce });
      lines.push(`${nm ? `${sd.label} thi triển ${nm}: ` : ''}gây **${real}** sát thương${crit ? ' 💥 bạo kích' : ''}${hits > 1 ? ` (${hits} đòn)` : ''}.`);
      if (def.t === 'drain' && real > 0 && hp[ak] > 0) { const h = Math.min(100 - hp[ak], Math.round(real * 0.5)); if (h > 0) { hp[ak] += h; lines.push(`🩸 Hút lại **${h}** sinh lực.`); } }
      break;
    }
    case 'dot': {
      const amt = U.HIT * U.DOT_FRAC * R * def.p * rk * (1 + (fx.dotAmp || 0)) * elemMult(sd, en);
      const cur = est.dots.find((d) => d.k === (def.k || 'Thiêu Đốt'));
      if (cur) { cur.amt = Math.max(cur.amt, amt); cur.left = Math.max(cur.left, def.d); } else est.dots.push({ k: def.k || 'Thiêu Đốt', amt, left: def.d });
      lines.push(`${nm ? `${sd.label} thi triển ${nm}: ` : ''}đối thủ dính **${def.k || 'Thiêu Đốt'}** (~${R1(amt)}/hiệp, ${def.d} hiệp).`);
      break;
    }
    case 'shield': {
      const amt = U.HIT * U.SHIELD_FRAC * R * def.p * rk * (1 + (fx.shieldAmp || 0));
      st.shield = Math.min(40, st.shield + amt);
      lines.push(`${nm ? `${sd.label} thi triển ${nm}: ` : ''}tạo khiên **${Math.round(amt)}**.`);
      break;
    }
    case 'heal': {
      const amt = Math.min(20, U.HIT * U.HEAL_FRAC * R * def.p * rk * Math.sqrt(sd.bias.hp));
      const h = Math.min(100 - hp[ak], Math.round(amt));
      if (h > 0 && hp[ak] > 0) { hp[ak] += h; lines.push(`${nm ? `${sd.label} thi triển ${nm}: ` : ''}hồi **${h}** sinh lực cho chủ nhân.`); }
      break;
    }
    case 'stun': {
      const ch = Math.min(0.4, (def.c || 0) * U.STUN_BASE * (0.6 + 0.4 * Math.min(R, 1.5)) / 0.6);
      if (est.stunImmune > 0 || est.stun) break;
      if (random() < ch) { est.stun = true; est.stunImmune = 3; lines.push('💫 Đối thủ bị **choáng**!'); }
      break;
    }
    case 'weaken': {
      const v = Math.min(0.25, def.v * (0.7 + 0.3 * Math.min(R, 1.5)));
      est.weaken = { v, left: def.d + 1 }; lines.push(`${nm ? `${sd.label} thi triển ${nm}: ` : ''}đối thủ **suy yếu** −${Math.round(v * 100)}% sát thương (${def.d} hiệp).`);
      break;
    }
    case 'buff': {
      const v = Math.min(0.25, def.v * (0.7 + 0.3 * Math.min(R, 1.5)));
      st.buff = { v, left: def.d + 1 }; lines.push(`${nm ? `${sd.label} thi triển ${nm}: ` : ''}bạn **cường hóa** +${Math.round(v * 100)}% sát thương (${def.d} hiệp).`);
      break;
    }
    case 'cleanse': {
      st.dots = []; st.weaken = null; st.stun = false;
      const h = Math.min(100 - hp[ak], Math.round(Math.min(10, U.HIT * U.HEAL_FRAC * R * (def.p || 0.4))));
      if (h > 0 && hp[ak] > 0) hp[ak] += h;
      lines.push(`${nm ? `${sd.label} thi triển ${nm}: ` : ''}thanh tẩy mọi hiệu ứng xấu${h > 0 ? `, hồi ${h} sinh lực` : ''}.`);
      break;
    }
    case 'thorn': {
      const v = Math.min(0.30, 0.5 * def.v * (0.7 + 0.3 * Math.min(R, 1.5)));
      st.thorn = { v, left: def.d + 1 }; lines.push(`${nm ? `${sd.label} thi triển ${nm}: ` : ''}phản **${Math.round(v * 100)}%** sát thương nhận (${def.d} hiệp).`);
      break;
    }
    case 'evade': {
      const v = Math.min(0.18, def.v * (0.7 + 0.3 * Math.min(R, 1.5)));
      st.evade = { v, left: def.d + 1 }; lines.push(`${nm ? `${sd.label} thi triển ${nm}: ` : ''}+${Math.round(v * 100)}% né tránh (${def.d} hiệp).`);
      break;
    }
    default: break;
  }
  if (def.then && depth < 1 && hp[ak] > 0) castEffect(arena, ak, dk, hp, def.then, rank, lines, depth + 1);
}

/** Cuối lượt của `ak`: thú trợ chiến + phát động kỹ năng, rồi giảm bộ đếm hiệu ứng. record ghi thêm cho nhật ký AI. */
function post(arena, ak, hp, lines, record) {
  const dk = other(ak); const sd = arena[ak]; const st = sd.st;
  if (sd.pet && hp[ak] > 0 && hp[dk] > 0) {
    // trợ chiến (cộng dồn phần lẻ để thú yếu vẫn có tác dụng nhỏ theo thời gian)
    let assist = U.HIT * U.ASSIST_FRAC * sd.rating * sd.bias.atk * (1 + (sd.fx.assist || 0)) * elemMult(sd, arena[dk]);
    if (st.buff) assist *= 1 + st.buff.v; if (st.weaken) assist *= 1 - st.weaken.v;
    if (st.turn === 1 && sd.fx.opening) assist *= 1 + sd.fx.opening;
    assist = Math.min(assist, U.HIT * U.ROUNDS_MAX_MULT);
    st.carry += assist; const whole = Math.floor(st.carry); st.carry -= whole;
    if (whole > 0) { const real = hurt(arena, dk, whole, hp, lines, {}); if (real > 0) lines.push(`🐾 ${sd.label} trợ chiến, gây **${real}** sát thương.`); }
    // kỹ năng chủ động
    const ready = sd.actives.filter((a) => (st.cds[a.key] || 0) <= 0);
    if (ready.length && hp[dk] > 0 && random() < PB.procChance(sd.rating, sd.bias.spd, sd.pet.bond, sd.fx.proc)) {
      const a = choice0(ready);
      castEffect(arena, ak, dk, hp, a.def, a.rank, lines);
      st.cds[a.key] = a.def.cd || 2; st.used.push(a.name);
      if (record) { record.spirit_beast_triggered = sd.pet.name; record.pet_skill = a.name; }
    }
  }
  for (const k of Object.keys(st.cds)) if (st.cds[k] > 0) st.cds[k] -= 1;
  for (const k of ['buff', 'weaken', 'evade', 'thorn']) if (st[k]) { st[k].left -= 1; if (st[k].left <= 0) st[k] = null; }
}
const choice0 = (a) => a[Math.floor(random() * a.length)];

/** Lượt "Phòng Thủ" (không ra đòn): vẫn chịu DoT, thú dựng 1 lớp khiên nhỏ. Trả lines. */
function idle(arena, ak, hp) {
  const r = pre(arena, ak, hp); const lines = [...r.lines]; const sd = arena[ak];
  if (!r.skip && sd.pet) { const s = U.HIT * U.GUARD_FRAC * 0.6 * Math.max(0.3, sd.rating); sd.st.shield = Math.min(40, sd.st.shield + s); lines.push(`🛡️ ${sd.label} dựng lá chắn **${Math.round(s)}** bảo vệ chủ nhân.`); }
  for (const k of Object.keys(sd.st.cds)) if (sd.st.cds[k] > 0) sd.st.cds[k] -= 1;
  for (const k of ['buff', 'weaken', 'evade', 'thorn']) if (sd.st[k]) { sd.st[k].left -= 1; if (sd.st[k].left <= 0) sd.st[k] = null; }
  return lines;
}

/** Chốt trận: EXP/thân mật/thống kê cho thú xuất chiến. Trả { A: line, B: line } (chuỗi có thể rỗng). */
function settle(arena, winnerKey) {
  const out = { A: '', B: '' };
  for (const k of ['A', 'B']) {
    const sd = arena[k]; if (!sd.pet) continue;
    try {
      const won = k === winnerKey;
      D.run('UPDATE pets SET battles = battles + 1, wins = wins + ? WHERE pet_id = ? AND owner = ?', won ? 1 : 0, sd.pet.pet_id, sd.owner);
      if (won) P.addBond(sd.pet.pet_id, PB.BOND_PER_PVP_WIN);
      const line = P.shareExp(sd.owner, PB.expPvp(won, sd.pet.level), won ? 'chiến thắng' : 'tham chiến');
      out[k] = line;
    } catch (e) { console.error('⚠️ petCombat.settle:', e.message); }
  }
  return out;
}
/** Mô tả thú cho trình kể chuyện AI. */
function describe(side) {
  if (!side.pet) return '(không có)';
  const v = side.pet;
  return `${v.name} (${v.tierInfo.name} · hành ${v.sp.hanh} · Lv.${v.level} · ${v.contractInfo ? v.contractInfo.short : 'chưa khế ước'}) — kỹ năng: ${side.actives.map((a) => a.name).join(', ') || 'chưa mở'}`;
}

module.exports = { buildSide, buildArena, mergeMods, pre, outgoing, incoming, dynDodge, post, idle, settle, describe, fxOf, activesOf, hurt, castEffect, elemMult };
