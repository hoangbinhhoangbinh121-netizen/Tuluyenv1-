'use strict';
const E9 = require('./emo19');   // v19.1: emoji pixel riêng của V19
/**
 * Giao diện Bí Cảnh Tiên Giới V19. Nút TĨNH `b19|…` — sống sót qua restart vì mọi trạng thái nằm trong bảng bc19_runs.
 *   b19|m|<uid>|<act>|<arg>   menu chọn bí cảnh (act: pick | solo | party | boss | prog)
 *   b19|j|<run> · b19|l|<run> · b19|s|<run>   vào đội / rời đội / bắt đầu (đội trưởng)
 *   b19|r|<run>|<act>         hành động trong trận (atk trong than tuyet bi sk guard rest item auto retreat next refresh boss)
 */
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const K = require('../game/constants');
const Cu = require('../game/cultivator');
const BC = require('../game/bicanh19');
const B = require('../data/bicanh19');
const { registerStatic, safeReply } = require('./kit');
const { now } = require('../util');

const EPH = MessageFlags.Ephemeral;
const fmt = (n) => Number(n).toLocaleString('vi-VN');
const bar = (cur, max, n = 12) => { const f = Math.round(n * Math.max(0, Math.min(1, max ? cur / max : 0))); return `${'█'.repeat(f)}${'░'.repeat(n - f)}`; };
const btn = (id, label, emoji, style = ButtonStyle.Secondary, disabled = false) => { const b = new ButtonBuilder().setCustomId(id.slice(0, 100)).setLabel(String(label).slice(0, 80)).setStyle(style).setDisabled(!!disabled); if (emoji) b.setEmoji(emoji); return b; };
const rowOf = (...c) => new ActionRowBuilder().addComponents(...c);
const PRIMARY = ButtonStyle.Primary; const DANGER = ButtonStyle.Danger; const SUCCESS = ButtonStyle.Success; const GRAY = ButtonStyle.Secondary;
const nameOf = (i) => (i.member && i.member.displayName) || i.user.globalName || i.user.username;

// ================================================================ MENU
function menuView(uid, picked = null) {
  const row = Cu.getCultivator(uid); const prog = BC.progOf(uid); const run = BC.activeRunId(uid);
  const idx = picked === null ? Math.max(0, Math.min(18, row ? Math.max(0, row.realm_index - B.REALM0) : 0)) : picked;
  const bc = B.BCS[idx]; const p = prog[idx] || { clears: 0, best: 0, ach: [] };
  const why = BC.whyCannotEnter(row, idx); const left = Math.max(0, BC.CFG.ENTRIES_PER_DAY - BC.entriesToday(uid, idx));
  const emb = new EmbedBuilder().setColor(0x8e44ad).setTitle(`${E9.bc(idx)} BÍ CẢNH TIÊN GIỚI — ${bc.name}`)
    .setDescription(`${bc.desc}\n\n**Yêu cầu:** ${K.REALMS[bc.realm].name} trở lên · **Độ khó:** HP ×${bc.diff.hp.toFixed(2)} · ATK ×${bc.diff.atk.toFixed(2)} _(đã hiệu chỉnh)_\n**Boss cuối:** ${E9.mob('final')} ${bc.final} · **Tầng:** 5 · **Lượt vào hôm nay:** ${left}/${BC.CFG.ENTRIES_PER_DAY}`)
    .addFields(
      { name: `${E9.a('map', '🗺️')} 5 tầng`, value: B.FLOORS.map((f) => `**${f.n}. ${f.name}** — ${f.desc}`).join('\n').slice(0, 1020) },
      { name: `${E9.a('chart', '📈')} Tiến độ`, value: `Chinh phục: **${p.clears}** lần · Tầng cao nhất: **${p.best}/5**\n${p.ach.length ? p.ach.map((k) => BC.ACH[k]).filter(Boolean).join(' · ') : '_Chưa có thành tựu_'}`, inline: false },
      { name: `${E9.a('gift', '🎁')} Phần thưởng`, value: `Tu Vi · Linh Thạch mỗi tầng · nguyên liệu độc quyền · mảnh công pháp · rương · truyền thừa 1% · lần đầu chinh phục ×2`, inline: false },
      { name: '📌 Trạng thái', value: run ? `🔥 Bạn đang trong một lần thám hiểm (#${run}) — bấm **Tiếp tục**.` : (why ? `${E9.a('lock', '🔒')} ${why}` : `${E9.a('check', '✅')} Có thể tiến vào.`), inline: false })
    .setFooter({ text: 'Chiến đấu theo lượt · nút bấm không mất khi bot khởi động lại · Tổ đội 2–5 người' });
  const opts = B.BCS.map((x, i) => ({ label: `${i + 1}. ${x.name}`.slice(0, 100), description: `${K.REALMS[x.realm].name} · Boss: ${x.final}`.slice(0, 100), value: String(i), default: i === idx, emoji: E9.bcComp(i) }));
  const sel = new StringSelectMenuBuilder().setCustomId(`b19|m|${uid}|pick`).setPlaceholder('Chọn bí cảnh…').addOptions(opts.slice(Math.max(0, Math.min(idx - 10, 19 - 25)), 25 + Math.max(0, Math.min(idx - 10, 19 - 25))));
  const rows = [rowOf(sel)];
  if (run) rows.push(rowOf(btn(`b19|m|${uid}|cont`, 'Tiếp tục', E9.aComp('start', '▶️'), SUCCESS), btn(`b19|r|${run}|retreat`, 'Thoát bí cảnh', E9.aComp('retreat', '🏃'), DANGER)));
  else rows.push(rowOf(btn(`b19|m|${uid}|solo|${idx}`, 'Tiến vào (Solo)', E9.aComp('atk', '⚔️'), SUCCESS, !!why), btn(`b19|m|${uid}|party|${idx}`, 'Lập Tổ Đội', E9.comp('doi19', '👥'), PRIMARY, !!why), btn(`b19|m|${uid}|boss|${idx}`, 'Xem Boss', E9.aComp('look', '👁️'), GRAY), btn(`b19|m|${uid}|rf|${idx}`, 'Làm mới', E9.aComp('refresh', '🔄'), GRAY)));
  return { content: '', embeds: [emb], components: rows };
}
function bossView(idx) {
  const bc = B.BCS[idx]; const e = new EmbedBuilder().setColor(0xc0392b).setTitle(`${E9.mob('final')} ${bc.final}`).setDescription(`Boss cuối của **${bc.name}** (${bc.theme}).`)
    .addFields({ name: `${E9.a('atk', '⚔️')} Kỹ năng`, value: bc.skills.map((s, i) => `**${i + 1}. ${typeof s === 'string' ? s : s.name}**${typeof s === 'object' && s.desc ? ` — ${s.desc}` : ''}`).join('\n').slice(0, 1020) },
      { name: '🌀 3 giai đoạn', value: '100–70% HP: thường · 70–35%: ATK +15%, dựng khiên · 35–0%: ATK +30%, mở Tuyệt Kỹ. Mỗi giai đoạn hồi 5% HP một lần.' },
      { name: `${E9.a('warn', '⚠️')} Cảnh báo`, value: `Đòn nặng luôn có **dấu hiệu tụ lực** một lượt trước — hãy bấm ${E9.a('guard', '🛡️')} **Phòng Thủ**.` },
      { name: '🧬 Tiểu quái', value: `Thường: ${bc.mobs.map((m) => m.name).join(', ')}\nTinh anh: ${bc.elites.join(', ')} · Mini Boss: ${bc.mini} · Canh cửa: ${bc.guard}`.slice(0, 1020) });
  return { embeds: [e], flags: EPH };
}

// ================================================================ PANEL TRẬN
const kindIcon = new Proxy({}, { get: (_, kd) => E9.mob(String(kd)) });   // v19.1: emoji pixel theo loại kẻ địch
function lobbyView(runId) {
  const L = BC.load(runId); const members = require('../db').all('SELECT user_id FROM bc19_members WHERE run_id = ? ORDER BY rowid', runId).map((x) => x.user_id);
  const bc = B.BCS[L.run.bc_idx]; const names = (L.st.names || {});
  const emb = new EmbedBuilder().setColor(0x3498db).setTitle(`${E9.k('doi19', '👥')} Phòng chờ — ${bc.name}`)
    .setDescription(`Yêu cầu: **${K.REALMS[bc.realm].name}** trở lên · Đội trưởng: <@${L.run.leader}>\nBoss có HP ×${(1 + BC.CFG.PARTY_HP * Math.max(0, members.length - 1)).toFixed(2)} theo số người; sát thương Boss tăng chậm hơn HP.\n\n**Thành viên (${members.length}/5):**\n${members.map((u, i) => `${i === 0 ? E9.a('crown', '👑') : '•'} ${names[u] || u} <@${u}>`).join('\n')}`)
    .setFooter({ text: 'Bấm Tham Gia để vào đội · đội trưởng bấm Bắt Đầu khi đủ người (2–5)' });
  return { embeds: [emb], components: [rowOf(btn(`b19|j|${runId}`, 'Tham Gia', E9.aComp('join', '🤝'), SUCCESS), btn(`b19|l|${runId}`, 'Rời Đội', E9.aComp('leave', '🚪'), GRAY), btn(`b19|s|${runId}`, 'Bắt Đầu', E9.aComp('start', '▶️'), PRIMARY, members.length < 2), btn(`b19|x|${runId}`, 'Hủy Phòng', E9.aComp('cancel', '✖️'), DANGER))] };
}
const cdLabel = (m) => [m.cd.tuyet > 0 ? `${E9.a('tuyet', '🌠')}${m.cd.tuyet}` : '', m.cd.bi > 0 ? `${E9.a('bi', '☠️')}${m.cd.bi}` : '', m.cd.sk > 0 ? `${E9.a('sk', '📖')}${m.cd.sk}` : '', m.cd.rest > 0 ? `${E9.a('rest', '🧘')}${m.cd.rest}` : ''].filter(Boolean).join(' ');
function runView(runId, note = '') {
  const L = BC.load(runId); if (!L) return { content: '❌ Không tìm thấy lần thám hiểm này.', embeds: [], components: [] };
  const { run, st } = L; if (run.status === 'lobby') return lobbyView(runId);
  const bc = B.BCS[st.bc]; const F = B.FLOORS[Math.min(4, Math.max(0, st.floor - 1))]; const e = st.enemy;
  const color = st.over === 'won' ? 0x2ecc71 : st.over ? 0xe74c3c : (e && e.tele ? 0xe67e22 : 0x8e44ad);
  const emb = new EmbedBuilder().setColor(color).setTitle(`${E9.bc(st.bc)} ${bc.name} — Tầng ${st.floor}/5 · ${F.name}`);
  const done = !!st.over;
  if (e && !done) {
    const wave = `${st.wave + 1}/${F.waves.length}`;
    const phase = e.kind === 'final' ? ` · Giai đoạn ${e.phase}/3` : '';
    emb.addFields({ name: `${kindIcon[e.kind] || '👾'} ${e.name}  _(lượt ${wave}${phase})_`, value: `${bar(e.hp, e.maxHp)} **${fmt(e.hp)}/${fmt(e.maxHp)}**${e.shield > 0 ? ` ${E9.a('guard', '🛡️')} ${fmt(e.shield)}` : ''}${e.weak ? ` ${E9.a('weak', '⬇️')} yếu ${Math.round(e.weak.pct * 100)}%` : ''}${e.lose ? ' ⏳' : ''}${e.tele ? `\n${E9.a('warn', '⚠️')} **ĐANG TỤ LỰC: ${e.tele.name}**${e.tele.aoe ? ' (diện rộng)' : ''} — bấm ${E9.a('guard', '🛡️')} **Phòng Thủ**!` : ''}` });
  }
  emb.addFields({ name: `${E9.k('doi19', '🧑‍🤝‍🧑')} Đội hình (${st.members.length})`, value: E9.clip(st.members.map((m, i) => `${i === st.turn && !done ? E9.a('start', '▶️') : '　'}${m.alive ? E9.a('alive', '🟢') : E9.a('dead', '💀')} **${m.name}** ${bar(m.hp, m.maxHp, 8)} ${fmt(m.hp)}/${fmt(m.maxHp)}${m.shield ? ` ${E9.a('guard', '🛡️')}${fmt(m.shield)}` : ''} · ${E9.a('ll', '✨')}${Math.floor(m.ll)}% ${cdLabel(m)}`).join('\n')) });
  const logs = (() => { const out = []; let n = 0; for (const l of st.log.slice(-8).reverse()) { const t = E9.px(l); if (n + t.length + 1 > 980) break; out.unshift(t); n += t.length + 1; } return out.join('\n'); })();
  if (logs) emb.addFields({ name: `${E9.a('log', '📜')} Diễn biến`, value: logs });
  if (st.pendingReward && st.lastReward) emb.addFields({ name: `${E9.a('gift', '🎁')} Thưởng`, value: E9.clip(E9.px(st.lastReward)) });
  if (st.over === 'won') emb.setDescription('🎉 **CHINH PHỤC BÍ CẢNH!** Phần thưởng đã được trao vào kho.');
  if (st.over === 'lost') emb.setDescription('💀 Cả đội gục ngã. Phần thưởng các tầng đã qua vẫn được giữ.');
  if (st.over === 'retreat') emb.setDescription('🏃 Đã rút lui. Phần thưởng các tầng đã qua vẫn được giữ.');
  const cur = st.members[st.turn];
  emb.setFooter({ text: done ? 'Kết thúc' : `Đến lượt: ${cur ? cur.name : '—'}${st.members.length > 1 ? ` · im lặng ${BC.CFG.IDLE_SKIP}s thì người khác được đánh thay` : ''}${note ? ` · ${note}` : ''}` });
  const rows = [];
  if (!done && !st.pendingReward) {
    const c = (a, label, emoji, style = GRAY) => btn(`b19|r|${runId}|${a}`, label, emoji, style);
    rows.push(rowOf(c('atk', 'Đánh Thường', E9.aComp('atk', '⚔️'), PRIMARY), c('trong', 'Trọng Kích', E9.aComp('trong', '💢')), c('than', 'Thần Thông', E9.aComp('than', '✨')), c('tuyet', 'Tuyệt Kỹ', E9.aComp('tuyet', '🌠')), c('bi', 'Bí Pháp', E9.aComp('bi', '☠️'), DANGER)));
    rows.push(rowOf(c('sk', 'Kỹ Công Pháp', E9.aComp('sk', '📖')), c('guard', 'Phòng Thủ', E9.aComp('guard', '🛡️'), e && e.tele ? SUCCESS : GRAY), c('rest', 'Điều Tức', E9.aComp('rest', '🧘')), c('item', 'Dùng Vật Phẩm', E9.aComp('item', '💊')), c('auto', 'Tự Chiến', E9.aComp('auto', '🤖'))));
    rows.push(rowOf(c('boss', 'Xem Kẻ Địch', E9.aComp('look', '👁️')), c('refresh', 'Làm mới', E9.aComp('refresh', '🔄')), c('retreat', 'Thoát bí cảnh', E9.aComp('retreat', '🏃'), DANGER)));
  } else if (!done && st.pendingReward) {
    rows.push(rowOf(btn(`b19|r|${runId}|next`, st.floor >= 5 ? 'Hoàn tất' : 'Sang tầng kế', E9.aComp('next', '🚪'), SUCCESS), btn(`b19|r|${runId}|retreat`, 'Rút lui (giữ thưởng)', E9.aComp('retreat', '🏃'), GRAY)));
  } else rows.push(rowOf(btn('b19|done', 'Đã kết thúc', E9.aComp('done', '🏁'), GRAY, true)));
  return { content: '', embeds: [emb], components: rows };
}

// ================================================================ XỬ LÝ NÚT
const deny = (i, msg) => safeReply(i, { content: msg, flags: EPH });
async function showRun(i, runId, note = '') { const v = runView(runId, note); if (i.deferred || i.replied) return i.editReply(v); return i.update(v); }

registerStatic('b19', async (i, parts) => {
  const [kind, a, b, c, d] = parts;
  if (kind === 'done') return deny(i, '🏁 Lần thám hiểm này đã kết thúc.');
  if (kind === 'm') {   // menu — chỉ chủ menu
    const uid = a; if (String(i.user.id) !== String(uid)) return deny(i, '❌ Đây không phải menu của bạn — gõ `/bicanhtiengioi` để mở menu riêng.');
    const act = b; const idx = Number(c !== undefined ? c : (i.values && i.values[0])) || 0;
    if (act === 'pick') return i.update(menuView(uid, Number((i.values || [])[0]) || 0));
    if (act === 'rf') return i.update(menuView(uid, idx));
    if (act === 'boss') return i.reply(bossView(idx));
    if (act === 'cont') { const rid = BC.activeRunId(uid); if (!rid) return i.update(menuView(uid)); return showRun(i, rid); }
    if (act === 'solo' || act === 'party') {
      const r = BC.createLobby(uid, idx, { channelId: i.channelId, solo: act === 'solo', name: nameOf(i) });
      if (!r.ok) return deny(i, `❌ ${r.error}`);
      return showRun(i, r.runId);
    }
    return;
  }
  const runId = Number(a); if (!runId) return;
  if (kind === 'j') { const r = BC.join(runId, i.user.id, nameOf(i)); if (!r.ok) return deny(i, `❌ ${r.error}`); return showRun(i, runId); }
  if (kind === 'l') { const r = BC.leave(runId, i.user.id); if (!r.ok) return deny(i, `❌ ${r.error}`); if (r.closed) return i.update({ content: '🚪 Phòng chờ đã đóng.', embeds: [], components: [] }); return showRun(i, runId); }
  if (kind === 'x') {   // v21.4: Hủy Phòng — chỉ đội trưởng (trước đây trùng custom_id với Rời Đội nên Discord từ chối cả tin nhắn)
    const L = BC.load(runId); if (!L || L.run.status !== 'lobby') return deny(i, '❌ Phòng chờ không còn tồn tại.');
    if (L.run.leader !== String(i.user.id)) return deny(i, '❌ Chỉ đội trưởng mới hủy được phòng.');
    BC.leave(runId, i.user.id); return i.update({ content: '✖️ Phòng chờ đã bị hủy.', embeds: [], components: [] });
  }
  if (kind === 's') { const r = BC.startRun(runId, i.user.id); if (!r.ok) return deny(i, `❌ ${r.error}`); return showRun(i, runId); }
  if (kind !== 'r') return;
  const act = b;
  if (act === 'refresh') return showRun(i, runId);
  if (act === 'boss') { const L = BC.load(runId); if (!L || !L.st.enemy) return deny(i, 'Không có kẻ địch.'); const e = L.st.enemy; return i.reply({ flags: EPH, embeds: [new EmbedBuilder().setColor(0xc0392b).setTitle(`${kindIcon[e.kind] || '👾'} ${e.name}`).setDescription(`HP **${fmt(e.hp)}/${fmt(e.maxHp)}** · Kháng sát thương **${Math.round((e.res || 0) * 100)}%** · Phòng ngự **${Math.round(e.defPct)}%**${e.kind === 'final' ? `\nGiai đoạn **${e.phase}/3**\nKỹ năng: ${(e.skills || []).map((x) => x.name || x).join(' · ')}` : ''}${e.skill ? `\nKỹ năng: ${e.skill.name}` : ''}`)] }); }
  if (act === 'retreat') {
    const r = BC.retreat(runId, i.user.id); if (!r.ok) return deny(i, `❌ ${r.error}`);
    return showRun(i, runId, r.ended ? 'Đã rút lui' : 'Bạn đã rút lui');
  }
  if (act === 'next') { const r = BC.next(runId, i.user.id); if (!r.ok) return deny(i, `❌ ${r.error}`); return showRun(i, runId); }
  if (act === 'auto') { const r = BC.auto(runId, i.user.id, 20); if (!r.ok) return deny(i, `❌ ${r.error}`); return showRun(i, runId, 'Tự Chiến tối đa 20 lượt, dừng khi địch tụ lực'); }
  const r = BC.act(runId, i.user.id, act); if (!r.ok) return deny(i, `❌ ${r.error}`);
  return showRun(i, runId);
});

module.exports = { menuView, runView, lobbyView, bossView };
