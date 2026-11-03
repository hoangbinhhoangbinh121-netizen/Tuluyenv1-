'use strict';
/** PvP theo hiệp: khiêu chiến (Chấp Nhận/Từ Chối) + mỗi hiệp 2 bên tự chọn hành động — port từ engine round-by-round */
const crypto = require('node:crypto');
const { EmbedBuilder } = require('discord.js');
const K = require('./constants');
const R = require('./realm');
const CD = require('./cooldowns');
const Cu = require('./cultivator');
const P = require('./pvpCore');
const BAL = require('./balance');
const F = require('./format');
const { E } = require('./emoji');
const { View, globalClickAllowed, EPHEMERAL } = require('../ui/kit');
const { now, int, random, choice } = require('../util');

const { ATTACK_NORMAL, PVP_ACTION_DEFEND, PVP_ACTION_KILLMOVE, PVP_ROUNDS } = P;
const SESSIONS = new Map();
const BUSY = new Map();
const sid = (x) => String(x);

function buildSession(guildId, channelId, aId, bId) {
  aId = sid(aId); bId = sid(bId);
  const a = Cu.getCultivator(aId); const b = Cu.getCultivator(bId);
  const atkA = Cu.effectiveAtk(a); const defA = Cu.effectiveDef(a); const spdA = Cu.effectiveSpd(a);
  const atkB = Cu.effectiveAtk(b); const defB = Cu.effectiveDef(b); const spdB = Cu.effectiveSpd(b);
  const PW = BAL.pvpPowers(a, b, Cu); const powerA = PW.powerA; const powerB = PW.powerB;
  const selfBuff = PW.buffA; const enemyDebuff = PW.debuffA;
  const buffNote = (selfBuff || enemyDebuff || PW.buffB || PW.debuffB) ? `\n🌀 Công pháp phát động: 🅰️ +${int(PW.buffA * 100)}%/-${int(PW.debuffA * 100)}% · 🅱️ +${int(PW.buffB * 100)}%/-${int(PW.debuffB * 100)}% (buff / debuff đối thủ).` : '';
  const realmA = R.realmDisplay(a.realm_index, a.stage_index); const realmB = R.realmDisplay(b.realm_index, b.stage_index);
  const [mAtkA, mAtkB] = P.statArrow(atkA, atkB); const [mDefA, mDefB] = P.statArrow(defA, defB);
  const [mSpdA, mSpdB] = P.statArrow(spdA, spdB); const [mPowA, mPowB] = P.statArrow(powerA, powerB);
  const header = `🅰️ <@${aId}> (${realmA}) — Công ${atkA}${mAtkA} | Thủ ${defA}${mDefA} | Tốc ${spdA}${mSpdA} | Lực Chiến ${powerA}${mPowA}\n🅱️ <@${bId}> (${realmB}) — Công ${atkB}${mAtkB} | Thủ ${defB}${mDefB} | Tốc ${spdB}${mSpdB} | Lực Chiến ${powerB}${mPowB}${buffNote}`;
  const hpMax = 100;
  const s = {
    id: crypto.randomBytes(6).toString('hex'), guild_id: guildId, channel_id: channelId, a_id: aId, b_id: bId,
    atk: { A: atkA, B: atkB }, def_: { A: defA, B: defB }, spd: { A: spdA, B: spdB }, power: { A: powerA, B: powerB },
    skills: { A: P.pvpActionListFor(a), B: P.pvpActionListFor(b) }, pet: { A: a.linh_thu || '', B: b.linh_thu || '' },
    tag: { A: `<@${aId}>`, B: `<@${bId}>` }, hp_max: hpMax, hp_pool: { A: hpMax, B: hpMax }, round: 1,
    actions: { A: null, B: null }, acted: { A: false, B: false }, resolving: false, round_token: 0, active_view: null,
    round_blocks: [], battle_data_rounds: [], header, realm_line: `🅰️ <@${aId}>: ${realmA}\n🅱️ <@${bId}>: ${realmB}`,
    rowA: a, rowB: b, stake_cap: Math.max(10, int(Math.min(a.tu_vi, b.tu_vi) * 0.05)), cur_hp_a: a.cur_hp, cur_hp_b: b.cur_hp, message: null, settled: false, created_at: now(),
  };
  SESSIONS.set(s.id, s); BUSY.set(aId, s.id); BUSY.set(bId, s.id);
  return s;
}
const statusLine = (s) => `${s.acted.A ? '✅' : '⏳'} ${s.tag.A} đã chọn  —  ${s.acted.B ? '✅' : '⏳'} ${s.tag.B} đã chọn`;
function roundEmbed(s) {
  const e = new EmbedBuilder().setTitle('⚔️ ĐẤU PHÁP').setDescription(s.header).setColor(0xf1c40f);
  for (const [rnd, text] of s.round_blocks) e.addFields({ name: `⏱️ Hiệp ${rnd}/${PVP_ROUNDS}`, value: text, inline: false });
  e.addFields({ name: `⏱️ Hiệp ${s.round}/${PVP_ROUNDS} — Chọn hành động`, value: `❤️ ${s.tag.A}: ${Math.max(0, s.hp_pool.A)}/${s.hp_max}  |  ${s.tag.B}: ${Math.max(0, s.hp_pool.B)}/${s.hp_max}\n${statusLine(s)}`, inline: false });
  return e;
}
const sideOf = (s, uid) => (sid(uid) === s.a_id ? 'A' : sid(uid) === s.b_id ? 'B' : null);
const eph = (i, c, x = {}) => i.reply({ content: c, flags: EPHEMERAL, ...x });

function swapActiveView(s, nv) {
  const old = s.active_view;
  if (old && old !== nv) { try { old.stop(); } catch (_) { /* bỏ qua */ } }
  s.active_view = nv;
}
function cleanupSession(s) { BUSY.delete(s.a_id); BUSY.delete(s.b_id); SESSIONS.delete(s.id); }

async function recordAction(s, side, action) {
  if (s.settled || s.acted[side]) return;
  s.actions[side] = action; s.acted[side] = true;
  if (s.acted.A && s.acted.B && !s.resolving) { s.resolving = true; await resolveRound(s); return; }
  if (s.message) { try { await s.message.edit({ embeds: [roundEmbed(s)] }); } catch (_) { /* bỏ qua */ } }
}

function skillChoiceView(s, side, userId, token) {
  const v = new View({ ownerId: userId, timeout: P.PVP_ROUND_TIMEOUT });
  const all = P.pvpActionListFor(Cu.getCultivator(userId));
  const skills = P.pad4(all.slice(1)).filter(Boolean);
  const options = skills.length ? skills.map((x) => ({ label: x.slice(0, 100), value: x.slice(0, 100) })) : [{ label: '(Chưa trang bị Công Pháp — dùng Đánh Thường)', value: ATTACK_NORMAL }];
  v.select({ key: 'sk', placeholder: '📖 Chọn 1 trong 4 chiêu Công Pháp...', options }, async (i, values) => {
    const chosen = values[0];
    if (s.settled || s.round_token !== token || s.acted[side]) {
      return i.update({ content: `⌛ Lựa chọn **${chosen}** đã muộn (hiệp này đã qua), không được tính.`, components: [] });
    }
    await i.update({ content: `📖 Bạn đã chọn **${chosen}**. Đang chờ đối thủ...`, components: [] });
    await recordAction(s, side, chosen);
  });
  return v;
}

function roundView(s) {
  const token = s.round_token;
  const v = new View({ ownerId: null, checkOwner: false, timeout: P.PVP_ROUND_TIMEOUT });
  const guard = (i) => {
    const side = sideOf(s, i.user.id);
    if (!side) { eph(i, 'Đây không phải trận đấu pháp của bạn.'); return null; }
    if (s.settled) { eph(i, 'Trận đấu pháp này đã kết thúc.'); return null; }
    if (s.acted[side]) { eph(i, 'Bạn đã chọn hành động ở hiệp này rồi, vui lòng chờ đối thủ.'); return null; }
    if (!globalClickAllowed(i.user.id)) { eph(i, '⚠️ Bạn đang bấm quá nhanh, vui lòng chờ chút rồi thử lại.'); return null; }
    return side;
  };
  const act = (action, label) => async (i) => {
    const side = guard(i); if (!side) return;
    await eph(i, `${label} Bạn chọn **${action}**. Đang chờ đối thủ...`);
    await recordAction(s, side, action);
  };
  v.button({ key: 'atk', label: 'Đánh Thường', emoji: E.kiem, style: 'red' }, act(ATTACK_NORMAL, '⚔️'));
  v.button({ key: 'cp', label: 'Công Pháp', emoji: E.congphap, style: 'blurple' }, async (i) => {
    const side = guard(i); if (!side) return;
    await i.reply({ content: '📖 Chọn 1 trong 4 chiêu Công Pháp đang trang bị:', components: skillChoiceView(s, side, i.user.id, token).components(), flags: EPHEMERAL });
  });
  v.button({ key: 'def', label: 'Phòng Thủ', emoji: E.phongngu, style: 'grey' }, act(PVP_ACTION_DEFEND, '🛡️'));
  v.button({ key: 'kill', label: 'Sát Chiêu', emoji: E.satchieu, style: 'danger' }, act(PVP_ACTION_KILLMOVE, '💢'));
  v.onTimeout = async () => {
    if (s.round_token !== token || s.settled || s.resolving) return;
    s.resolving = true;
    for (const side of ['A', 'B']) if (!s.acted[side]) { s.actions[side] = ATTACK_NORMAL; s.acted[side] = true; }
    await resolveRound(s);
  };
  return v;
}

async function resolveRound(s) {
  try { await resolveRoundImpl(s); }
  catch (e) {
    console.error(`⚠️ Lỗi khi resolve hiệp PvP (session ${s.id}):`, e);
    if (!s.settled) {
      s.settled = true; cleanupSession(s);
      if (s.active_view) { try { s.active_view.stop(); } catch (_) { /* bỏ qua */ } }
      if (s.message) { try { await s.message.edit({ content: '❌ Có lỗi xảy ra khi xử lý hiệp đấu, trận này đã bị huỷ. Vui lòng khiêu chiến lại. Nếu còn lặp lại hãy báo admin.', embeds: [], components: [] }); } catch (_) { /* bỏ qua */ } }
    }
  }
}

async function resolveRoundImpl(s) {
  const hp = s.hp_pool; const rnd = s.round; const block = []; const recs = [];
  const sa = s.spd.A; const sb = s.spd.B;
  const first = sa === sb ? choice(['A', 'B']) : (sa > sb ? 'A' : 'B');
  const second = first === 'A' ? 'B' : 'A';
  for (const [ak, dk] of [[first, second], [second, first]]) {
    if (hp[ak] <= 0 || hp[dk] <= 0) continue;
    const action = s.actions[ak];
    if (action === PVP_ACTION_DEFEND) {
      block.push(`${s.tag[ak]} thi triển **${PVP_ACTION_DEFEND}**, không ra đòn hiệp này.`);
      recs.push({ attacker: s.tag[ak], target: s.tag[dk], selected_action: PVP_ACTION_DEFEND, dodge: false, damage: null, is_crit: false, counter_damage: null, effect: null, effect_duration: null, spirit_beast_triggered: null, heal_amount: null, hp_a: hp.A, hp_b: hp.B });
      continue;
    }
    const r = P.roundAction(s.tag[ak], s.tag[dk], s.atk[ak], s.def_[dk], s.power[ak], s.power[dk], s.skills[ak], s.pet[ak], hp, dk, action, s.actions[dk] === PVP_ACTION_DEFEND, action === PVP_ACTION_KILLMOVE);
    block.push(...r.lines); recs.push(r.record);
  }
  block.push(`❤️ ${s.tag.A}: ${Math.max(0, hp.A)}/${s.hp_max}  |  ${s.tag.B}: ${Math.max(0, hp.B)}/${s.hp_max}`);
  s.round_blocks.push([rnd, block.join('\n').slice(0, 1000)]);
  s.battle_data_rounds.push({ round: rnd, actions: recs, hp_a_after: Math.max(0, hp.A), hp_b_after: Math.max(0, hp.B) });
  if (!(hp.A <= 0 || hp.B <= 0 || rnd >= PVP_ROUNDS)) {
    s.round += 1; s.actions = { A: null, B: null }; s.acted = { A: false, B: false }; s.resolving = false; s.round_token += 1;
    const nv = roundView(s);
    if (s.message) { try { await s.message.edit({ embeds: [roundEmbed(s)], components: nv.components() }); } catch (_) { /* bỏ qua */ } }
    swapActiveView(s, nv);
    return;
  }
  await finishSession(s);
}

async function finishSession(s) {
  if (s.settled) return;
  s.settled = true;
  if (s.active_view) { try { s.active_view.stop(); } catch (_) { /* bỏ qua */ } s.active_view = null; }
  const hp = s.hp_pool; const pA = s.power.A; const pB = s.power.B;
  let aWins;
  if (hp.A !== hp.B) aWins = hp.A > hp.B; else if (pA !== pB) aWins = pA > pB; else aWins = random() < 0.5;
  const winnerId = aWins ? s.a_id : s.b_id;
  const loserNewHp = aWins ? Math.max(1, int((s.cur_hp_b || 0) * 0.85)) : Math.max(1, int((s.cur_hp_a || 0) * 0.85));
  const real = P.settlePvpAtomic(s.a_id, s.b_id, winnerId, BAL.pvpStake(s.rowA, s.rowB, aWins), loserNewHp, s.round_blocks.length, now());
  cleanupSession(s);
  const m = s.message;
  if (real === null) {
    if (m) { try { await m.edit({ content: '⏳ Một trong hai bên vừa đấu pháp ở nơi khác trước đó rất gần đây, trận này không được tính.', embeds: [], components: [] }); } catch (_) { /* bỏ qua */ } }
    return;
  }
  const resultLine = aWins
    ? `${E.cup} ${s.tag.A} chiến thắng đấu pháp! ${real > 0 ? `Đoạt được **${real}** tu vi từ đối thủ.` : 'Đối thủ không còn tu vi để đoạt.'}`
    : `💥 ${s.tag.B} chiến thắng đấu pháp! ${s.tag.A} ${real > 0 ? `mất **${real}** tu vi.` : 'nhưng không mất tu vi (đã cạn).'}`;
  const emb = new EmbedBuilder().setTitle('⚔️ ĐẤU PHÁP — KẾT THÚC').setDescription(s.header).setColor(aWins ? 0xf1c40f : 0xe74c3c);
  for (const [rnd, text] of s.round_blocks) emb.addFields({ name: `⏱️ Hiệp ${rnd}/${PVP_ROUNDS}`, value: text, inline: false });
  emb.addFields({ name: `${E.cup} Kết Quả`, value: `${resultLine}\n${s.realm_line}`, inline: false });
  if (m) { try { await m.edit({ embeds: [emb], components: [] }); } catch (_) { /* bỏ qua */ } }
  if (process.env.GEMINI_API_KEY && m) {
    const s4a = P.pad4(s.skills.A.slice(1)); const s4b = P.pad4(s.skills.B.slice(1));
    const ra = Cu.getCultivator(s.a_id); const rb = Cu.getCultivator(s.b_id);
    const ctx = {
      ally_cultivation: (ra && ra.cong_phap) || 'Chưa trang bị công pháp', enemy_cultivation: (rb && rb.cong_phap) || 'Chưa trang bị công pháp',
      ally_spirit_beast: s.pet.A || '(không có)', enemy_spirit_beast: s.pet.B || '(không có)',
      ally_skill_1: s4a[0], ally_skill_2: s4a[1], ally_skill_3: s4a[2], ally_skill_4: s4a[3],
      enemy_skill_1: s4b[0], enemy_skill_2: s4b[1], enemy_skill_3: s4b[2], enemy_skill_4: s4b[3],
      battle_data: JSON.stringify({ ally_tag: s.tag.A, enemy_tag: s.tag.B, ally_max_hp: s.hp_max, enemy_max_hp: s.hp_max, rounds: s.battle_data_rounds, winner: aWins ? s.tag.A : s.tag.B }),
    };
    try { const fe = await P.narratePvpViaAi(ctx, emb); await m.edit({ embeds: [fe], components: [] }); }
    catch (e) { console.error('⚠️ Lỗi AI narrate PvP (đã settle DB, giữ embed Python):', e.message); }
  }
}

// ---------- khiêu chiến ----------
function challengePrecheck(cId, tId) {
  if (P.pvpIsLocked()) return P.PVP_LOCK_MESSAGE;
  if (sid(cId) === sid(tId)) return '❌ Không thể tự đấu với chính mình.';
  if (BUSY.has(sid(cId)) || BUSY.has(sid(tId))) return '⏳ Một trong hai bên đang có lời khiêu chiến/trận đấu pháp khác chưa xong.';
  const a = Cu.getCultivator(cId); const b = Cu.getCultivator(tId);
  if (!a || !b) return '❌ Cả hai bên đều phải bắt đầu tu tiên (`/batdau`) trước khi đấu pháp.';
  const remain = CD.COOLDOWN_PVP - (now() - (a.last_pvp || 0));
  if (remain > 0) return `⏳ Còn ${F.fmtTime(remain)} nữa mới có thể khiêu chiến tiếp.`;
  return '';
}
const challengeEmbed = (c, t) => new EmbedBuilder().setTitle('⚔️ LỜI KHIÊU CHIẾN ĐẤU PHÁP').setColor(0xe67e22)
  .setDescription(`<@${c}> khiêu chiến <@${t}>!\n<@${t}> có ${P.PVP_CHALLENGE_TIMEOUT}s để **Chấp Nhận** hoặc **Từ Chối**.`);

function challengeView(cId, tId) {
  cId = sid(cId); tId = sid(tId);
  const v = new View({ ownerId: null, checkOwner: false, timeout: P.PVP_CHALLENGE_TIMEOUT });
  const st = { done: false, message: null };
  v.state = st;
  const guard = (i) => {
    if (sid(i.user.id) !== tId) { eph(i, 'Lời khiêu chiến này không dành cho bạn.'); return false; }
    if (!globalClickAllowed(i.user.id)) { eph(i, '⚠️ Bạn đang bấm quá nhanh, vui lòng chờ chút rồi thử lại.'); return false; }
    return true;
  };
  const cleanBusy = () => { BUSY.delete(cId); BUSY.delete(tId); };
  v.onTimeout = async () => {
    if (st.done) return; st.done = true; cleanBusy();
    if (st.message) { try { v.disableAll(); await st.message.edit({ content: `⌛ Lời khiêu chiến của <@${cId}> tới <@${tId}> đã hết hạn.`, embeds: [], components: v.components() }); } catch (_) { /* bỏ qua */ } }
  };
  v.button({ key: 'ok', label: 'Chấp Nhận', emoji: E.xacnhan, style: 'green' }, async (i) => {
    if (!guard(i)) return;
    if (st.done) return eph(i, 'Lời khiêu chiến này đã kết thúc.');
    st.done = true; v.disableAll();
    const a = Cu.getCultivator(cId); const b = Cu.getCultivator(tId);
    const fail = async (msg) => { cleanBusy(); await i.update({ content: msg, embeds: [], components: v.components() }); };
    if (!a || !b) return fail('❌ Một trong hai bên không còn dữ liệu tu tiên hợp lệ.');
    const g = i.guild;
    if (!g || !g.members.cache.get(cId) || !g.members.cache.get(tId)) {
      // cache có thể thiếu nếu không bật intent Members → thử fetch trước khi kết luận
      try { await Promise.all([g.members.fetch(cId), g.members.fetch(tId)]); }
      catch (_) { return fail('❌ Một trong hai bên không còn ở server này.'); }
    }
    const remain = CD.COOLDOWN_PVP - (now() - (a.last_pvp || 0));
    if (remain > 0) return fail(`⏳ Lời khiêu chiến đã hết hiệu lực (cooldown còn ${F.fmtTime(remain)}).`);
    Cu.syncHpRegen(cId, a); Cu.syncHpRegen(tId, b);
    const s = buildSession(g.id, i.channelId, cId, tId);
    try {
      const rv = roundView(s);
      await i.update({ content: null, embeds: [roundEmbed(s)], components: rv.components() });
      s.message = await i.fetchReply();
      swapActiveView(s, rv);
    } catch (e) { if (!s.settled) { s.settled = true; cleanupSession(s); } throw e; }
    v.stop();
  });
  v.button({ key: 'no', label: 'Từ Chối', emoji: E.tuchoi, style: 'red' }, async (i) => {
    if (!guard(i)) return;
    if (st.done) return eph(i, 'Lời khiêu chiến này đã kết thúc.');
    st.done = true; cleanBusy(); v.disableAll();
    await i.update({ content: `❌ <@${tId}> đã từ chối lời khiêu chiến của <@${cId}>.`, embeds: [], components: v.components() });
    v.stop();
  });
  return v;
}

/** Gửi lời khiêu chiến. `send(payload)` trả Message. */
async function sendChallenge(cId, tId, send) {
  const err = challengePrecheck(cId, tId);
  if (err) return err;
  BUSY.set(sid(cId), 'challenge'); BUSY.set(sid(tId), 'challenge');
  try {
    const view = challengeView(cId, tId);
    view.state.message = await send({ content: `<@${tId}>`, embeds: [challengeEmbed(cId, tId)], components: view.components() });
    return '';
  } catch (e) { BUSY.delete(sid(cId)); BUSY.delete(sid(tId)); throw e; }
}

module.exports = { sendChallenge, challengePrecheck, SESSIONS, BUSY, _test: { buildSession, recordAction, roundView } };
