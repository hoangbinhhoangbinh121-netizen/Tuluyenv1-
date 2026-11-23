'use strict';
/** PvP: công tắc khoá, công thức 1 lượt ra chiêu, chốt trận nguyên tử, đấu tự động (do_pvp), kể chuyện AI */
const fs = require('node:fs');
const path = require('node:path');
const { EmbedBuilder } = require('discord.js');
const K = require('./constants');
const CD = require('./cooldowns');
const R = require('./realm');
const Cu = require('./cultivator');
const CP = require('./congphap');
const D = require('../db');
const F = require('./format');
const { E } = require('./emoji');
const { geminiGenerate } = require('./ai');
const { now, int, random, randUniform, randInt, choice } = require('../util');
const BAL = require('./balance');
const T = require('./talent');
const PetC = require('./petCombat');

const ATTACK_NORMAL = K.ATTACK_NORMAL;
const PVP_ACTION_DEFEND = '🛡️ Phòng Thủ';
const PVP_ACTION_KILLMOVE = '💢 Sát Chiêu';
const PVP_EFFECT_LIST = ['Trúng Độc', 'Choáng Váng', 'Xuất Huyết', 'Băng Phong', 'Thiêu Đốt', 'Suy Nhược'];
const PVP_ROUNDS = 5;
const PVP_CHALLENGE_TIMEOUT = 120;
const PVP_ROUND_TIMEOUT = 60;
const PVP_SECT_EXP_REWARD = 20;
const PVP_LOCK_MESSAGE = '🔒 PvP đang tạm khoá để bảo trì/cân bằng lại, sẽ mở lại sau. Hẹn gặp lại các đạo hữu trên chiến trường sớm!';
const PVP_LOCKED_DEFAULT = ['1', 'true', 'yes', 'on'].includes((process.env.TULUYEN_PVP_LOCKED || '0').trim().toLowerCase());

function pvpIsLocked() {
  try {
    D.run('CREATE TABLE IF NOT EXISTS bot_flags (key TEXT PRIMARY KEY, value TEXT)');
    const r = D.get("SELECT value FROM bot_flags WHERE key = 'pvp_locked'");
    if (r) return r.value === '1';
  } catch (_) { /* dùng mặc định */ }
  return PVP_LOCKED_DEFAULT;
}
function pvpSetLocked(locked) {
  D.run('CREATE TABLE IF NOT EXISTS bot_flags (key TEXT PRIMARY KEY, value TEXT)');
  D.run("INSERT INTO bot_flags (key, value) VALUES ('pvp_locked', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", locked ? '1' : '0');
}

const hpBar = (cur, max, width = 10) => {
  cur = Math.max(0, cur); max = Math.max(1, max);
  const f = Math.round(width * Math.min(1, cur / max));
  return '█'.repeat(f) + '░'.repeat(width - f);
};
/** Giữ khối 1 hiệp ≤ 1000 ký tự (giới hạn field embed) nhưng LUÔN giữ dòng sinh lực cuối cùng. */
const fitBlock = (block, max = 1000) => {
  const text = block.join('\n'); if (text.length <= max) return text;
  const last = block[block.length - 1]; const head = block.slice(0, -1).join('\n');
  return `${head.slice(0, Math.max(0, max - last.length - 2))}…\n${last}`;
};
const pad4 = (skills) => { const o = skills.slice(0, 4); while (o.length < 4) o.push(''); return o; };
const statArrow = (a, b) => (a > b ? ['🔺', ''] : b > a ? ['', '🔺'] : ['', '']);

/** Mô phỏng 1 lượt ra chiêu → { lines, record } (mutates hpPool) */
function roundAction(attackerTag, defenderTag, atkStat, defStat, powerAtk, powerDef, skills, petName, hpPool, defenderKey, action = null, isDefending = false, forceCrit = false, mods = null) {
  // v13.6 `mods` = { att, def } từ talent.combatMods(): Xuyên giáp / Hút máu / Bạo kích của bên ra đòn; Né tránh / Giảm sát thương của bên đỡ (đều đã chặn trần)
  const am = (mods && mods.att) || {}; const dm = (mods && mods.def) || {};
  const lines = [];
  action = action !== null && action !== undefined ? action : choice(skills);
  const record = { attacker: attackerTag, target: defenderTag, selected_action: action, dodge: false, damage: null, is_crit: false, counter_damage: null, effect: null, effect_duration: null, spirit_beast_triggered: null, heal_amount: null };
  // v14.0: Linh Thú — mods.pet = { arena } (xem game/petCombat.js). Không có arena → hành vi cũ.
  const pc = mods && mods.pet ? mods.pet : null; const PC = pc ? require('./petCombat') : null;
  const atkKey = defenderKey === 'B' ? 'A' : 'B';
  if (pc) {
    const pr = PC.pre(pc.arena, atkKey, hpPool);
    lines.push(...pr.lines);
    if (pr.skip) { record.skipped = pr.stunned ? 'stun' : 'down'; record.hp_a = hpPool.A; record.hp_b = hpPool.B; return { lines, record }; }
  }
  // v16: chiêu của công pháp mới có hiệu ứng thật (game/cpfx.js) — cùng vòng 5 hiệp, không phải hệ thống chiến đấu riêng
  const CPX = require('./cpfx'); const eff = CPX.skillEffect(action);
  const cpSt = CPX.battleState(hpPool); const stAtk = cpSt[atkKey]; const stDef = cpSt[defenderKey];
  if (eff) record.cp_skill = action;
  if (action === ATTACK_NORMAL) lines.push(`${attackerTag} tung ra ${action}.`);
  else if (action === PVP_ACTION_KILLMOVE) lines.push(`${attackerTag} tung ra đòn **${action}** quyết định!`);
  else lines.push(`${attackerTag} sử dụng **${action}**.`);

  // ---- v12.3: sát thương tính theo % thanh sinh mệnh (100), không còn one-shot theo chỉ số tuyệt đối ----
  const rp = Math.min(3, Math.max(0.33, powerAtk / Math.max(1.0, powerDef)));       // sức mạnh tổng (đã gồm chênh cảnh giới + công pháp)
  let dodge = 0.07 + Math.min(0.18, Math.max(0.0, ((powerDef - powerAtk) / Math.max(1.0, powerAtk)) * 0.10));
  dodge = Math.max(0.02, Math.min(0.30, dodge) + (dm.dodge || 0) + (pc ? PC.dynDodge(pc.arena, defenderKey) : 0) + CPX.incomingBuffs(stDef).dodge);
  const inBuff = CPX.incomingBuffs(stDef); const outWeak = CPX.outgoingWeak(stAtk);     // đọc TRƯỚC khi trừ lượt
  if (random() < dodge) {
    lines.push(`🌪️ ${defenderTag} né tránh thành công.`);
    record.dodge = true;
    CPX.tickDefender(stDef); CPX.tickAttacker(stAtk);
    lines.push(...CPX.applySkill(eff, stAtk, stDef, hpPool, atkKey, attackerTag));
    if (pc) PC.post(pc.arena, atkKey, hpPool, lines, record);
    record.hp_a = hpPool.A; record.hp_b = hpPool.B;
    return { lines, record };
  }
  const armor = atkStat / (atkStat + defStat * (1 - Math.min(0.6, (am.pierce || 0) + ((eff && eff.pierce) || 0))) * 0.7 + 1);                              // 0..1 (ngang nhau ≈ 0.588)
  let pct = BAL.B.PVP_BASE_HIT * ((armor / 0.588) ** BAL.B.PVP_ARMOR_EXP) * (rp ** BAL.B.PVP_POWER_EXP) * randUniform(1 - BAL.B.PVP_ROLL, 1 + BAL.B.PVP_ROLL);
  if (action !== ATTACK_NORMAL && action !== PVP_ACTION_DEFEND) pct *= action === PVP_ACTION_KILLMOVE ? 1.5 : (am.skillDmg || (eff ? eff.dmg : 1.15));   // v21.6: am.skillDmg = kỹ năng chủng tộc
  let damage = Math.max(1, Math.round(pct));
  if (isDefending) { damage = Math.max(1, int(damage * randUniform(0.5, 0.6))); record.defended = true; }
  if (dm.dr) damage = Math.max(1, Math.round(damage * (1 - dm.dr)));
  if (inBuff.guard) damage = Math.max(1, Math.round(damage * (1 - inBuff.guard)));        // v16: chiêu hộ thể của bên đỡ
  if (outWeak) damage = Math.max(1, Math.round(damage * (1 - outWeak)));                   // v16: bên ra đòn đang bị suy yếu
  const isCrit = forceCrit ? true : random() < Math.min(0.32, 0.10 + Math.max(0.0, rp - 1) * 0.10) + (am.crit || 0) + ((eff && eff.crit) || 0);
  if (isCrit) damage = Math.max(1, Math.round(damage * 1.5 * (1 + (am.critMult || 0))));
  if (am.dmgMult && am.dmgMult !== 1) damage = Math.max(1, Math.round(damage * am.dmgMult));          // v21.6: EffectEngine (Cuồng Huyết / Suy Nhược …)
  if (pc) {
    damage = PC.outgoing(pc.arena, atkKey, damage, hpPool);
    damage = PC.incoming(pc.arena, defenderKey, atkKey, damage, hpPool, lines);   // khiên → Hộ Chủ → phản thương; tự trừ sinh lực, trả sát thương thực
  } else {
    damage = Math.min(damage, Math.ceil(hpPool[defenderKey]));
    hpPool[defenderKey] = Math.max(0, hpPool[defenderKey] - damage);
  }
  lines.push(`💥 Gây ${damage} sát thương lên ${defenderTag}.`);
  if (isDefending) lines.push(`🛡️ ${defenderTag} đang phòng thủ, sát thương giảm đáng kể.`);
  record.damage = damage;
  if (am.lifesteal) {
    const atkKey0 = defenderKey === 'B' ? 'A' : 'B';
    const heal = Math.round(damage * am.lifesteal);
    if (heal > 0 && hpPool[atkKey0] > 0 && hpPool[atkKey0] < 100) { hpPool[atkKey0] = Math.min(100, hpPool[atkKey0] + heal); lines.push(`🩸 ${attackerTag} hút ${heal} sinh lực.`); record.heal_amount = heal; }
  }
  if (isCrit) { lines.push('💥 Bạo kích!'); record.is_crit = true; }
  if (random() < 0.18) {
    const counter = Math.max(1, int(damage * randUniform(0.25, 0.5)));
    lines.push(`⚔️ ${defenderTag} phản kích gây ${counter} sát thương.`);
    const atkKey = defenderKey === 'B' ? 'A' : 'B';
    hpPool[atkKey] = Math.max(0, hpPool[atkKey] - counter);
    record.counter_damage = counter;
  }
  if (random() < 0.22) {
    const effect = choice(PVP_EFFECT_LIST); const dur = randInt(1, 3);
    if (mods && mods.effects) {                                                      // v21.6: hiệu ứng THẬT (EffectEngine) — sửa F-1
      const rr = mods.effects.proc(effect, dur);
      if (rr.applied) { lines.push(`✨ ${defenderTag} nhận ${rr.line}`); record.effect = effect; record.effect_duration = dur; }
      else if (rr.line) lines.push(`✨ ${defenderTag} ${rr.line}`);
    } else {
      lines.push(`✨ ${defenderTag} nhận **${effect}** (${dur} hiệp).`);
      record.effect = effect; record.effect_duration = dur;
    }
  }
  if (pc) PC.post(pc.arena, atkKey, hpPool, lines, record);
  else if (petName && random() < 0.2) { lines.push(`🐉 ${petName} phát động hiệu quả.`); record.spirit_beast_triggered = petName; }
  CPX.tickDefender(stDef); CPX.tickAttacker(stAtk);
  if (eff) lines.push(...CPX.applySkill(eff, stAtk, stDef, hpPool, atkKey, attackerTag));
  record.hp_a = hpPool.A; record.hp_b = hpPool.B;
  return { lines, record };
}

/**
 * Chốt kết quả trong 1 transaction → real_stake (số) | null (cooldown đã bị trận khác tiêu mất) | 'dup' (trận này đã chốt rồi).
 * v21.3: winnerId = null → HÒA (không ai mất/được tu vi; vẫn tiêu cooldown + hao độ bền + Phong Ấn như trận thường).
 * meta = { battleId, result, reason, summary, log } → cập nhật v213_battles ('active' → 'done') TRONG CÙNG transaction: chốt đúng 1 lần.
 */
function settlePvpAtomic(userId, targetId, winnerId, stake, loserNewHp, roundsPlayed, t, meta = null) {
  const draw = winnerId === null || winnerId === undefined;
  const loserId = draw ? null : (String(winnerId) === String(userId) ? targetId : userId);
  return D.transaction(() => {
    if (meta && meta.battleId) {
      const bt = D.get('SELECT status FROM v213_battles WHERE id = ?', meta.battleId);
      if (bt && bt.status !== 'active') return 'dup';
    }
    const ch = D.get('SELECT last_pvp FROM cultivators WHERE user_id = ?', userId);
    if (!ch || CD.COOLDOWN_PVP - (t - (ch.last_pvp || 0)) > 0.5) return null;
    let real = 0;
    if (!draw) {
      const w = D.get('SELECT sect_id FROM cultivators WHERE user_id = ?', winnerId);
      const l = D.get('SELECT tu_vi, sect_id FROM cultivators WHERE user_id = ?', loserId);
      if (!w || !l) return null;
      real = Math.max(0, Math.min(stake, l.tu_vi));
      D.run('UPDATE cultivators SET tu_vi = tu_vi + ? WHERE user_id = ?', real, winnerId);
      D.run('UPDATE cultivators SET tu_vi = MAX(0, tu_vi - ?), cur_hp = ? WHERE user_id = ?', real, loserNewHp, loserId);
      D.run('UPDATE cultivators SET last_pvp = ? WHERE user_id = ?', t, userId);
      D.run('UPDATE cultivators SET pvp_wins = pvp_wins + 1 WHERE user_id = ?', winnerId);
      D.run('UPDATE cultivators SET pvp_losses = pvp_losses + 1 WHERE user_id = ?', loserId);
      D.run('INSERT INTO pvp_history (winner_id, loser_id, stake, winner_sect_id, loser_sect_id, rounds, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?)', winnerId, loserId, real, w.sect_id, l.sect_id, roundsPlayed, t);
      if (w.sect_id !== null && w.sect_id !== undefined) {
        D.run('UPDATE sects SET exp = exp + ? WHERE sect_id = ?', PVP_SECT_EXP_REWARD, w.sect_id);
        const s = D.get('SELECT exp, level FROM sects WHERE sect_id = ?', w.sect_id);
        if (s && s.exp >= s.level * 1000) D.run('UPDATE sects SET level = level + 1 WHERE sect_id = ?', w.sect_id);
      }
    } else {
      if (!D.get('SELECT 1 AS x FROM cultivators WHERE user_id = ?', targetId)) return null;
      D.run('UPDATE cultivators SET last_pvp = ? WHERE user_id = ?', t, userId);
    }
    // v17: Phong Ấn tiêu 1 lượt · trang bị đang mặc hao độ bền (trong cùng transaction)
    for (const id of [userId, targetId]) {
      try {
        const FXm = require('./fx17'); const r = D.get('SELECT fx17 FROM cultivators WHERE user_id = ?', id);
        if (r && FXm.stat(r, 'foe') > 0) require('./tran17').consumeSeal(id);
        require('./gear17').wear(id, 'pvp');
      } catch (e) { console.warn('⚠️ hook v17 PvP:', e.message); }
    }
    if (meta && meta.battleId) {
      D.run("UPDATE v213_battles SET status = 'done', result = ?, reason = ?, rounds = ?, stake = ?, summary = ?, log = ?, ended_at = ? WHERE id = ? AND status = 'active'",
        meta.result || (draw ? 'draw' : ''), meta.reason || '', roundsPlayed, real, meta.summary || '', meta.log || '', t, meta.battleId);
    }
    return real;
  });
}

/** v21.3: chốt 1 trận do combat21 điều khiển (thắng/thua/hòa) — dùng chung cho đấu tương tác và đấu tự động. */
function settleBattle(b, verdict, t) {
  const C21 = require('./combat21');
  const meta = { battleId: b.id, result: verdict.result, reason: verdict.reason, summary: C21.summaryPayload(b), log: C21.logPayload(b) };
  if (verdict.result === 'draw') return settlePvpAtomic(b.ids.A, b.ids.B, null, 0, 0, b.round, t, meta);
  const aWins = verdict.result === 'A';
  const loserNewHp = aWins ? Math.max(1, int((b.cur_hp.B || 0) * 0.85)) : Math.max(1, int((b.cur_hp.A || 0) * 0.85));
  return settlePvpAtomic(b.ids.A, b.ids.B, aWins ? b.ids.A : b.ids.B, BAL.pvpStake(b.rowA, b.rowB, aWins), loserNewHp, b.round, t, meta);
}

function pvpActionListFor(row) { return CP.pvpActionListFor(row); }

/** do_pvp (đấu tự động, KHÔNG giới hạn hiệp — dùng chung combat21 với đấu tương tác) → { embed, aiContext, winnerId, stake, result } | string(lỗi) */
function doPvp(userId, targetId) {
  if (pvpIsLocked()) return PVP_LOCK_MESSAGE;
  if (String(userId) === String(targetId)) return '❌ Không thể tự đấu với chính mình.';
  let a = Cu.getCultivator(userId); let b = Cu.getCultivator(targetId);
  if (!a || !b) return '❌ Cả hai bên đều phải bắt đầu tu tiên (`/batdau`) trước khi đấu pháp.';
  const t = now();
  const remain = CD.COOLDOWN_PVP - (t - (a.last_pvp || 0));
  if (remain > 0) return `⏳ Còn ${F.fmtTime(remain)} nữa mới có thể khiêu chiến tiếp.`;
  Cu.syncHpRegen(userId, a); Cu.syncHpRegen(targetId, b);
  a = Cu.getCultivator(userId); b = Cu.getCultivator(targetId);
  const C21 = require('./combat21');
  const bt = C21.createBattle(a, b, { mode: 'auto', now: t });
  C21.record(bt);
  const verdict = C21.simulate(bt);
  const real = settleBattle(bt, verdict, t);
  if (real === null || real === 'dup') { C21.abort(bt.id, 'cooldown', t); return '⏳ Bạn vừa đấu pháp ở nơi khác trước đó rất gần đây, trận này không được tính. Vui lòng thử lại.'; }
  const petSettle = PetC.settle(bt.arena, verdict.result === 'A' ? 'A' : verdict.result === 'B' ? 'B' : 'D');
  const extra = [{ name: '🧾 Mã trận', value: `\`${bt.id}\` — xem nhật ký đầy đủ: \`/lichsupvp\``, inline: false }];
  const petNotes = [petSettle.A && `🅰️ ${petSettle.A}`, petSettle.B && `🅱️ ${petSettle.B}`].filter(Boolean).join('\n');
  if (petNotes) extra.push({ name: '🐾 Linh Thú', value: petNotes.slice(0, 1000), inline: false });
  const embed = C21.embed(bt, { verdict, extra, real });
  const s4a = pad4(bt.skills.A.slice(1)); const s4b = pad4(bt.skills.B.slice(1));
  const aiContext = {
    ally_cultivation: a.cong_phap || 'Chưa trang bị công pháp', enemy_cultivation: b.cong_phap || 'Chưa trang bị công pháp',
    ally_spirit_beast: PetC.describe(bt.arena.A), enemy_spirit_beast: PetC.describe(bt.arena.B),
    ally_skill_1: s4a[0], ally_skill_2: s4a[1], ally_skill_3: s4a[2], ally_skill_4: s4a[3],
    enemy_skill_1: s4b[0], enemy_skill_2: s4b[1], enemy_skill_3: s4b[2], enemy_skill_4: s4b[3],
    battle_data: JSON.stringify({ ally_tag: bt.tag.A, enemy_tag: bt.tag.B, ally_max_hp: bt.hp_max, enemy_max_hp: bt.hp_max, rounds: bt.recs, winner: verdict.result === 'A' ? bt.tag.A : verdict.result === 'B' ? bt.tag.B : 'hòa' }),
    _rounds: bt.round,
  };
  return { embed, aiContext, winnerId: verdict.result === 'A' ? userId : verdict.result === 'B' ? targetId : null, stake: real, result: verdict.result, battleId: bt.id };
}

// ---- kể chuyện qua Gemini (tuỳ chọn, luôn fallback) ----
let _tpl = null;
const template = () => (_tpl === null ? (_tpl = fs.readFileSync(path.join(__dirname, '..', 'data', 'pvp_log_prompt.txt'), 'utf8')) : _tpl);
/** string.Template.safe_substitute: thay $name / ${name} đã biết, giữ nguyên phần còn lại */
function safeSubstitute(tpl, ctx) {
  return tpl.replace(/\$\$|\$\{(\w+)\}|\$(\w+)/g, (m, a, b) => {
    if (m === '$$') return '$';
    const k = a || b; return Object.prototype.hasOwnProperty.call(ctx, k) ? String(ctx[k]) : m;
  });
}
async function narratePvpViaAi(aiContext, fallbackEmbed) {
  if (!process.env.GEMINI_API_KEY) return fallbackEmbed;
  if (aiContext && aiContext._rounds > PVP_ROUNDS) return fallbackEmbed;   // v21.3: prompt kể chuyện chỉ thiết kế cho ≤5 hiệp; trận dài giữ nhật ký có sẵn
  const text = await geminiGenerate(safeSubstitute(template(), aiContext), '', { timeout: 12, maxTokens: 1600, temperature: 0.9 });
  if (!text.trim()) return fallbackEmbed;
  const chunks = text.split(/(?=⏱️\s*Hiệp\s*\d+\/5)/).map((c) => c.trim()).filter((c) => c.startsWith('⏱️'));
  if (!chunks.length) return fallbackEmbed;
  const fb = fallbackEmbed.toJSON();
  const out = new EmbedBuilder().setTitle(fb.title).setDescription(fb.description).setColor(fb.color);
  let n = 0;
  for (const chunk of chunks) {
    const m = /^⏱️\s*Hiệp\s*(\d+)\/5\s*(?:━+)?\s*/.exec(chunk);
    const rnd = m ? m[1] : '?';
    let body = (m ? chunk.slice(m[0].length) : chunk).trim();
    body = body.split('KẾT QUẢ')[0].trim();
    if (!body) continue;
    out.addFields({ name: `⏱️ Hiệp ${rnd}/${PVP_ROUNDS}`, value: body.slice(0, 1000), inline: false }); n++;
  }
  if (!n) return fallbackEmbed;
  for (const f of fb.fields || []) if ((f.name || '').includes('Kết Quả')) out.addFields({ name: f.name, value: f.value, inline: f.inline });
  return out;
}

module.exports = {
  fitBlock,
  ATTACK_NORMAL, PVP_ACTION_DEFEND, PVP_ACTION_KILLMOVE, PVP_ROUNDS, PVP_CHALLENGE_TIMEOUT, PVP_ROUND_TIMEOUT, PVP_LOCK_MESSAGE,
  pvpIsLocked, pvpSetLocked, hpBar, pad4, statArrow, roundAction, settlePvpAtomic, settleBattle, pvpActionListFor, doPvp, narratePvpViaAi, safeSubstitute,
};
