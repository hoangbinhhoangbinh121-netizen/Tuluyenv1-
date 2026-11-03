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
const pad4 = (skills) => { const o = skills.slice(0, 4); while (o.length < 4) o.push(''); return o; };
const statArrow = (a, b) => (a > b ? ['🔺', ''] : b > a ? ['', '🔺'] : ['', '']);

/** Mô phỏng 1 lượt ra chiêu → { lines, record } (mutates hpPool) */
function roundAction(attackerTag, defenderTag, atkStat, defStat, powerAtk, powerDef, skills, petName, hpPool, defenderKey, action = null, isDefending = false, forceCrit = false) {
  const lines = [];
  action = action !== null && action !== undefined ? action : choice(skills);
  const record = { attacker: attackerTag, target: defenderTag, selected_action: action, dodge: false, damage: null, is_crit: false, counter_damage: null, effect: null, effect_duration: null, spirit_beast_triggered: null, heal_amount: null };
  if (action === ATTACK_NORMAL) lines.push(`${attackerTag} tung ra ${action}.`);
  else if (action === PVP_ACTION_KILLMOVE) lines.push(`${attackerTag} tung ra đòn **${action}** quyết định!`);
  else lines.push(`${attackerTag} sử dụng **${action}**.`);

  let ratio = powerAtk / Math.max(1.0, powerDef);
  ratio = Math.min(2.2, Math.max(0.5, ratio));
  let dodge = 0.08 + Math.max(0.0, ((powerDef - powerAtk) / Math.max(1.0, powerAtk)) * 0.15);
  dodge = Math.min(0.35, dodge);
  if (random() < dodge) {
    lines.push(`🌪️ ${defenderTag} né tránh thành công.`);
    record.dodge = true; record.hp_a = hpPool.A; record.hp_b = hpPool.B;
    return { lines, record };
  }
  const base = Math.max(3, int(atkStat * randUniform(0.85, 1.15) - defStat * 0.35));
  let damage = Math.max(1, int(base * ratio));
  if (isDefending) { damage = Math.max(1, int(damage * randUniform(0.5, 0.6))); record.defended = true; }
  const isCrit = forceCrit ? true : random() < Math.min(0.35, 0.12 + Math.max(0.0, ratio - 1) * 0.15);
  if (isCrit) damage = int(damage * 1.6);
  hpPool[defenderKey] = Math.max(0, hpPool[defenderKey] - damage);
  lines.push(`💥 Gây ${damage} sát thương lên ${defenderTag}.`);
  if (isDefending) lines.push(`🛡️ ${defenderTag} đang phòng thủ, sát thương giảm đáng kể.`);
  record.damage = damage;
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
    lines.push(`✨ ${defenderTag} nhận **${effect}** (${dur} hiệp).`);
    record.effect = effect; record.effect_duration = dur;
  }
  if (petName && random() < 0.2) { lines.push(`🐉 ${petName} phát động hiệu quả.`); record.spirit_beast_triggered = petName; }
  record.hp_a = hpPool.A; record.hp_b = hpPool.B;
  return { lines, record };
}

/** Chốt kết quả trong 1 transaction → real_stake hoặc null (cooldown đã bị trận khác tiêu mất) */
function settlePvpAtomic(userId, targetId, winnerId, stake, loserNewHp, roundsPlayed, t) {
  const loserId = String(winnerId) === String(userId) ? targetId : userId;
  return D.transaction(() => {
    const ch = D.get('SELECT last_pvp FROM cultivators WHERE user_id = ?', userId);
    if (!ch || CD.COOLDOWN_PVP - (t - (ch.last_pvp || 0)) > 0.5) return null;
    const w = D.get('SELECT sect_id FROM cultivators WHERE user_id = ?', winnerId);
    const l = D.get('SELECT tu_vi, sect_id FROM cultivators WHERE user_id = ?', loserId);
    if (!w || !l) return null;
    const real = Math.max(0, Math.min(stake, l.tu_vi));
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
    return real;
  });
}

function pvpActionListFor(row) { return CP.pvpActionListFor(row); }

/** do_pvp (đấu tự động 5 hiệp) → { embed, aiContext } | string(lỗi) */
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
  const atkA = Cu.effectiveAtk(a); const defA = Cu.effectiveDef(a); const spdA = Cu.effectiveSpd(a);
  const atkB = Cu.effectiveAtk(b); const defB = Cu.effectiveDef(b); const spdB = Cu.effectiveSpd(b);
  let powerA = Cu.calcLucChien(a); let powerB = Cu.calcLucChien(b);
  const selfBuff = Cu.pvpBuffPct(a); const enemyDebuff = Cu.pvpDebuffPct(a);
  powerA = int(powerA * (1 + selfBuff)); powerB = int(powerB * (1 - enemyDebuff));
  const buffNote = (selfBuff || enemyDebuff) ? `\n🌀 Công pháp phát động: Tự Buff +${int(selfBuff * 100)}%, Debuff đối thủ -${int(enemyDebuff * 100)}%.` : '';
  const realmA = R.realmDisplay(a.realm_index, a.stage_index); const realmB = R.realmDisplay(b.realm_index, b.stage_index);
  const [mAtkA, mAtkB] = statArrow(atkA, atkB); const [mDefA, mDefB] = statArrow(defA, defB); const [mSpdA, mSpdB] = statArrow(spdA, spdB); const [mPowA, mPowB] = statArrow(powerA, powerB);
  const header = `🅰️ <@${userId}> (${realmA}) — Công ${atkA}${mAtkA} | Thủ ${defA}${mDefA} | Tốc ${spdA}${mSpdA} | Lực Chiến ${powerA}${mPowA}\n🅱️ <@${targetId}> (${realmB}) — Công ${atkB}${mAtkB} | Thủ ${defB}${mDefB} | Tốc ${spdB}${mSpdB} | Lực Chiến ${powerB}${mPowB}${buffNote}`;
  const skillsA = pvpActionListFor(a); const skillsB = pvpActionListFor(b);
  const petA = a.linh_thu || ''; const petB = b.linh_thu || '';
  const hpMax = 100; const hp = { A: hpMax, B: hpMax };
  const tagA = `<@${userId}>`; const tagB = `<@${targetId}>`;
  const blocks = []; const battleRounds = [];
  for (let rnd = 1; rnd <= PVP_ROUNDS; rnd++) {
    if (hp.A <= 0 || hp.B <= 0) break;
    const block = []; const recs = [];
    const first = spdA === spdB ? choice(['A', 'B']) : (spdA > spdB ? 'A' : 'B');
    const second = first === 'A' ? 'B' : 'A';
    for (const [ak, dk] of [[first, second], [second, first]]) {
      if (hp[ak] <= 0 || hp[dk] <= 0) continue;
      const r = ak === 'A'
        ? roundAction(tagA, tagB, atkA, defB, powerA, powerB, skillsA, petA, hp, 'B')
        : roundAction(tagB, tagA, atkB, defA, powerB, powerA, skillsB, petB, hp, 'A');
      block.push(...r.lines); recs.push(r.record);
    }
    block.push(`❤️ ${tagA}: ${Math.max(0, hp.A)}/${hpMax}  |  ${tagB}: ${Math.max(0, hp.B)}/${hpMax}`);
    blocks.push([rnd, block.join('\n').slice(0, 1000)]);
    battleRounds.push({ round: rnd, actions: recs, hp_a_after: Math.max(0, hp.A), hp_b_after: Math.max(0, hp.B) });
  }
  let aWins;
  if (hp.A !== hp.B) aWins = hp.A > hp.B; else if (powerA !== powerB) aWins = powerA > powerB; else aWins = random() < 0.5;
  const stakeCap = Math.max(10, int(Math.min(a.tu_vi, b.tu_vi) * 0.05));
  const winnerId = aWins ? userId : targetId;
  const loserNewHp = aWins ? Math.max(1, int(b.cur_hp * 0.85)) : Math.max(1, int(a.cur_hp * 0.85));
  const real = settlePvpAtomic(userId, targetId, winnerId, stakeCap, loserNewHp, blocks.length, t);
  if (real === null) return '⏳ Bạn vừa đấu pháp ở nơi khác trước đó rất gần đây, trận này không được tính. Vui lòng thử lại.';
  const resultLine = aWins
    ? `${E.cup} <@${userId}> chiến thắng đấu pháp! ${real > 0 ? `Đoạt được **${real}** tu vi từ đối thủ.` : 'Đối thủ không còn tu vi để đoạt.'}`
    : `💥 <@${targetId}> chiến thắng đấu pháp! <@${userId}> ${real > 0 ? `mất **${real}** tu vi.` : 'nhưng không mất tu vi (đã cạn).'}`;
  const embed = new EmbedBuilder().setTitle('⚔️ ĐẤU PHÁP').setDescription(header).setColor(aWins ? 0xf1c40f : 0xe74c3c);
  for (const [rnd, text] of blocks) embed.addFields({ name: `⏱️ Hiệp ${rnd}/${PVP_ROUNDS}`, value: text, inline: false });
  embed.addFields({ name: `${E.cup} Kết Quả`, value: `${resultLine}\n🅰️ <@${userId}>: ${realmA}\n🅱️ <@${targetId}>: ${realmB}`, inline: false });
  const s4a = pad4(skillsA.slice(1)); const s4b = pad4(skillsB.slice(1));
  const aiContext = {
    ally_cultivation: a.cong_phap || 'Chưa trang bị công pháp', enemy_cultivation: b.cong_phap || 'Chưa trang bị công pháp',
    ally_spirit_beast: petA || '(không có)', enemy_spirit_beast: petB || '(không có)',
    ally_skill_1: s4a[0], ally_skill_2: s4a[1], ally_skill_3: s4a[2], ally_skill_4: s4a[3],
    enemy_skill_1: s4b[0], enemy_skill_2: s4b[1], enemy_skill_3: s4b[2], enemy_skill_4: s4b[3],
    battle_data: JSON.stringify({ ally_tag: tagA, enemy_tag: tagB, ally_max_hp: hpMax, enemy_max_hp: hpMax, rounds: battleRounds, winner: aWins ? tagA : tagB }),
  };
  return { embed, aiContext, winnerId, stake: real };
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
  ATTACK_NORMAL, PVP_ACTION_DEFEND, PVP_ACTION_KILLMOVE, PVP_ROUNDS, PVP_CHALLENGE_TIMEOUT, PVP_ROUND_TIMEOUT, PVP_LOCK_MESSAGE,
  pvpIsLocked, pvpSetLocked, hpBar, pad4, statArrow, roundAction, settlePvpAtomic, pvpActionListFor, doPvp, narratePvpViaAi, safeSubstitute,
};
