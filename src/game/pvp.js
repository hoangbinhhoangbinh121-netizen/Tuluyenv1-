'use strict';
const HX = (id) => { try { const h = require('./fx19').hieuOf(id); return h ? ` 「${h}」` : ''; } catch (_) { return ''; } };   // v19.0: Đế Hiệu hiển thị khi PvP
/**
 * PvP theo hiệp (v21.3): khiêu chiến (Chấp Nhận/Từ Chối) + mỗi hiệp 2 bên tự chọn hành động.
 * Vòng đấu do game/combat21.js điều khiển: KHÔNG giới hạn hiệp; AFK = bỏ lượt (không tự đánh); hòa/đầu hàng/bế tắc có luật rõ;
 * chốt trận 1 lần trong DB (v213_battles); nhật ký đầy đủ lưu lại; bot khởi động lại → trận đang dở bị huỷ (không ai mất gì).
 */
const { EmbedBuilder } = require('discord.js');
const CD = require('./cooldowns');
const Cu = require('./cultivator');
const P = require('./pvpCore');
const C21 = require('./combat21');
const PetC = require('./petCombat');
const F = require('./format');
const { E } = require('./emoji');
const { View, globalClickAllowed, EPHEMERAL } = require('../ui/kit');
const { now } = require('../util');

const { ATTACK_NORMAL, PVP_ACTION_DEFEND, PVP_ACTION_KILLMOVE } = P;
const SESSIONS = new Map();
const BUSY = new Map();
const sid = (x) => String(x);

function buildSession(guildId, channelId, aId, bId) {
  aId = sid(aId); bId = sid(bId);
  const s = C21.createBattle(Cu.getCultivator(aId), Cu.getCultivator(bId), { guildId, channelId, mode: 'duel', now: now() });
  Object.assign(s, { a_id: aId, b_id: bId, actions: { A: null, B: null }, acted: { A: false, B: false }, resolving: false, round_token: 0, active_view: null, message: null, settled: false, created_at: now() });
  C21.record(s);
  SESSIONS.set(s.id, s); BUSY.set(aId, s.id); BUSY.set(bId, s.id);
  return s;
}
const FXE = require('./effectEngine');
/** v21.6: hồi chiêu Sát Chiêu / Kỹ Năng Tộc + hiệu ứng đang có (rỗng nếu không có gì để hiện). */
function fxLine(s) {
  const out = [];
  for (const k of ['A', 'B']) {
    const bits = [];
    if (s.cd && s.cd[k].kill > 0) bits.push(`Sát Chiêu hồi ${s.cd[k].kill}`);
    if (s.cd && s.race && s.race[k] && s.cd[k].race > 0) bits.push(`Kỹ Năng Tộc hồi ${s.cd[k].race}`);
    const d = s.fx ? FXE.describe(s.fx, k) : ''; if (d) bits.push(d);
    if (bits.length) out.push(`${s.tag[k]}: ${bits.join(' · ')}`);
  }
  return out.length ? `\n🌀 ${out.join('  |  ')}` : '';
}
const statusLine = (s) => `${s.acted.A ? '✅' : '⏳'} ${s.tag.A} đã chọn  —  ${s.acted.B ? '✅' : '⏳'} ${s.tag.B} đã chọn`;
function roundEmbed(s) {
  return C21.embed(s, { live: `❤️ ${s.tag.A}: ${Math.max(0, s.hp.A)}/${s.hp_max}  |  ${s.tag.B}: ${Math.max(0, s.hp.B)}/${s.hp_max}\n${statusLine(s)}${fxLine(s)}\n⏱️ ${P.PVP_ROUND_TIMEOUT}s — quá giờ = bỏ lượt (${s.policy.afkForfeit} lần liên tiếp = xử thua).` });
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
  if (action === C21.SURRENDER) {                                  // đầu hàng: chốt ngay, không chờ đối thủ
    if (!s.resolving) { s.resolving = true; for (const k of ['A', 'B']) if (!s.acted[k]) s.acted[k] = true; await resolveRound(s); }
    return;
  }
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

function surrenderView(s, side, userId, token) {
  const v = new View({ ownerId: userId, timeout: 30 });
  v.button({ key: 'yes', label: 'Xác nhận đầu hàng', emoji: E.tuchoi, style: 'red' }, async (i) => {
    if (s.settled || s.round_token !== token || s.acted[side]) return i.update({ content: '⌛ Đã muộn — hiệp này đã qua hoặc bạn đã chọn hành động.', components: [] });
    await i.update({ content: '🏳️ Bạn đã đầu hàng.', components: [] });
    await recordAction(s, side, C21.SURRENDER);
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
    if (s.round_token !== token) { eph(i, '⌛ Nút này thuộc hiệp cũ, không được tính.'); return null; }
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
  v.button({ key: 'kill', label: 'Sát Chiêu', emoji: E.satchieu, style: 'danger' }, async (i) => {
    const side = guard(i); if (!side) return;
    const cd = (s.cd && s.cd[side] && s.cd[side].kill) || 0;                                  // v21.6 (F-2): Sát Chiêu có hồi chiêu
    if (cd > 0) return eph(i, `💢 Sát Chiêu còn hồi **${cd}** hiệp — hãy chọn hành động khác.`);
    await eph(i, `💢 Bạn chọn **${PVP_ACTION_KILLMOVE}**. Đang chờ đối thủ...`);
    await recordAction(s, side, PVP_ACTION_KILLMOVE);
  });
  if (s.race && (s.race.A || s.race.B)) {                                                       // v21.6: kỹ năng chủ động của Chủng Tộc (ai có thì nút hiện, bấm kiểm tra theo bên)
    v.button({ key: 'race', label: 'Kỹ Năng Tộc', emoji: E.race_awaken, style: 'blurple', row: 1 }, async (i) => {
      const side = guard(i); if (!side) return;
      const rs = s.race[side];
      if (!rs) return eph(i, '🧬 Bạn chưa mở khoá kỹ năng tộc (cần Thức Tỉnh ≥ 1 ở /race).');
      const cd = (s.cd && s.cd[side] && s.cd[side].race) || 0;
      if (cd > 0) return eph(i, `${rs.action} còn hồi **${cd}** hiệp — hãy chọn hành động khác.`);
      await eph(i, `🧬 Bạn chọn **${rs.action}**. Đang chờ đối thủ...`);
      await recordAction(s, side, rs.action);
    });
  }
  v.button({ key: 'sur', label: 'Đầu Hàng', emoji: E.tuchoi, style: 'grey' }, async (i) => {
    const side = guard(i); if (!side) return;
    await i.reply({ content: '🏳️ Đầu hàng = **thua trận** (mất tu vi cược như thua thường). Xác nhận?', components: surrenderView(s, side, i.user.id, token).components(), flags: EPHEMERAL });
  });
  v.onTimeout = async () => {
    if (s.round_token !== token || s.settled || s.resolving) return;
    s.resolving = true;
    for (const side of ['A', 'B']) if (!s.acted[side]) { s.actions[side] = null; s.acted[side] = true; }       // AFK = bỏ lượt (KHÔNG tự đánh thường)
    await resolveRound(s);
  };
  return v;
}

async function resolveRound(s) {
  try { await resolveRoundImpl(s); }
  catch (e) {
    console.error(`⚠️ Lỗi khi resolve hiệp PvP (session ${s.id}):`, e);
    if (!s.settled) {
      s.settled = true; cleanupSession(s); C21.abort(s.id, 'error');
      if (s.active_view) { try { s.active_view.stop(); } catch (_) { /* bỏ qua */ } }
      if (s.message) { try { await s.message.edit({ content: '❌ Có lỗi xảy ra khi xử lý hiệp đấu, trận này đã bị huỷ (không ai mất gì). Vui lòng khiêu chiến lại. Nếu còn lặp lại hãy báo admin.', embeds: [], components: [] }); } catch (_) { /* bỏ qua */ } }
    }
  }
}

async function resolveRoundImpl(s) {
  const { verdict } = C21.playRound(s, s.actions);
  if (!verdict.over) {
    s.actions = { A: null, B: null }; s.acted = { A: false, B: false }; s.resolving = false; s.round_token += 1;
    const nv = roundView(s);
    if (s.message) { try { await s.message.edit({ embeds: [roundEmbed(s)], components: nv.components() }); } catch (_) { /* bỏ qua */ } }
    swapActiveView(s, nv);
    return;
  }
  await finishSession(s, verdict);
}

async function finishSession(s, verdict) {
  if (s.settled) return;
  s.settled = true;
  if (s.active_view) { try { s.active_view.stop(); } catch (_) { /* bỏ qua */ } s.active_view = null; }
  const real = P.settleBattle(s, verdict, now());
  cleanupSession(s);
  const m = s.message;
  if (real === null || real === 'dup') {
    if (real === null) C21.abort(s.id, 'cooldown');
    if (m) { try { await m.edit({ content: '⏳ Một trong hai bên vừa đấu pháp ở nơi khác trước đó rất gần đây, trận này không được tính (không ai mất gì).', embeds: [], components: [] }); } catch (_) { /* bỏ qua */ } }
    return;
  }
  const petSettle = PetC.settle(s.arena, verdict.result === 'draw' ? 'D' : verdict.result);
  const extra = [{ name: '🧾 Mã trận', value: `\`${s.id}\` — xem nhật ký đầy đủ: \`/lichsupvp\``, inline: false }];
  const petNotes = [petSettle.A && `🅰️ ${petSettle.A}`, petSettle.B && `🅱️ ${petSettle.B}`].filter(Boolean).join('\n');
  if (petNotes) extra.push({ name: '🐾 Linh Thú', value: petNotes.slice(0, 1000), inline: false });
  const emb = C21.embed(s, { title: '⚔️ ĐẤU PHÁP — KẾT THÚC', verdict, extra, real });
  if (m) { try { await m.edit({ embeds: [emb], components: [] }); } catch (_) { /* bỏ qua */ } }
  if (process.env.GEMINI_API_KEY && m && s.round <= P.PVP_ROUNDS && verdict.result !== 'draw') {
    const s4a = P.pad4(s.skills.A.slice(1)); const s4b = P.pad4(s.skills.B.slice(1));
    const ra = Cu.getCultivator(s.a_id); const rb = Cu.getCultivator(s.b_id);
    const ctx = {
      ally_cultivation: (ra && ra.cong_phap) || 'Chưa trang bị công pháp', enemy_cultivation: (rb && rb.cong_phap) || 'Chưa trang bị công pháp',
      ally_spirit_beast: PetC.describe(s.arena.A), enemy_spirit_beast: PetC.describe(s.arena.B),
      ally_skill_1: s4a[0], ally_skill_2: s4a[1], ally_skill_3: s4a[2], ally_skill_4: s4a[3],
      enemy_skill_1: s4b[0], enemy_skill_2: s4b[1], enemy_skill_3: s4b[2], enemy_skill_4: s4b[3],
      battle_data: JSON.stringify({ ally_tag: s.tag.A, enemy_tag: s.tag.B, ally_max_hp: s.hp_max, enemy_max_hp: s.hp_max, rounds: s.recs, winner: verdict.result === 'A' ? s.tag.A : s.tag.B }), _rounds: s.round,
    };
    try { const fe = await P.narratePvpViaAi(ctx, emb); await m.edit({ embeds: [fe], components: [] }); }
    catch (e) { console.error('⚠️ Lỗi AI narrate PvP (đã settle DB, giữ embed nhật ký):', e.message); }
  }
}

/** Khởi động lại bot: huỷ mọi trận 'active' còn sót (chưa chốt → không ai mất/được gì) + báo vào tin nhắn trận nếu sửa được. */
async function recoverStale(client) {
  let rows = [];
  try { rows = C21.abortStale(); } catch (e) { console.warn('⚠️ recoverStale:', e.message); return 0; }
  for (const r of rows) {
    if (!client || !r.channel_id || !r.message_id || r.message_id === '0') continue;
    try {
      const ch = await client.channels.fetch(r.channel_id); const msg = ch && await ch.messages.fetch(r.message_id);
      if (msg) await msg.edit({ content: '🔄 Bot vừa khởi động lại nên trận đấu pháp này **bị huỷ** — không ai mất hay được tu vi. Hãy khiêu chiến lại.', embeds: [], components: [] });
    } catch (_) { /* tin nhắn đã xoá / không có quyền */ }
  }
  return rows.length;
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
  .setDescription(`<@${c}>${HX(c)} khiêu chiến <@${t}>${HX(t)}!\n<@${t}> có ${P.PVP_CHALLENGE_TIMEOUT}s để **Chấp Nhận** hoặc **Từ Chối**.`);

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
      try { if (s.message && s.message.id) C21.setMessage(s.id, s.message.id); } catch (_) { /* chỉ phục vụ báo khi khởi động lại */ }
      swapActiveView(s, rv);
    } catch (e) { if (!s.settled) { s.settled = true; cleanupSession(s); C21.abort(s.id, 'error'); } throw e; }
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

module.exports = { sendChallenge, challengePrecheck, recoverStale, SESSIONS, BUSY, _test: { buildSession, recordAction, roundView, resolveRound, finishSession } };
