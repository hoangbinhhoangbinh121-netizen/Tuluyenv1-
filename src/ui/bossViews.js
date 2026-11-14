'use strict';
/** Giao diện Boss Thế Giới v7: bảng boss công khai (cập nhật sống), nút hành động bền qua restart, thông báo thế giới. */
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const B = require('../game/boss');
const Cu = require('../game/cultivator');
const D = require('../db');
const { buildBattle } = require('./templates/battle');
const W = require('./templates/worldEvent');
const { createEmbed } = require('./components/baseEmbed');
const { progressBar } = require('./components/progressBar');
const { section } = require('./components/section');
const N = require('./notifications');
const { E, toComponentEmoji } = require('./emojis');
const { registerStatic } = require('./kit');
const { num, exp, pct, discordTime, dur, safe } = require('./format');
const { COLORS } = require('./theme/colors');
const { announceWorld } = require('./worldChannel');

const EPH = MessageFlags.Ephemeral;
const MEDAL = ['🥇', '🥈', '🥉'];
const logs = new Map();   // bossId -> [dòng nhật ký] (chỉ trong bộ nhớ)
const pushLog = (bossId, line) => { const a = logs.get(bossId) || []; a.push(line); if (a.length > 20) a.shift(); logs.set(bossId, a); };

const rankLines = (bossId, n = 5) => {
  const r = B.ranking(bossId, n);
  return r.length ? r.map((c, i) => `${MEDAL[i] || `**${i + 1}.**`} <@${c.user_id}> — ${num(c.damage)} (${num(c.hits)} đòn)`).join('\n') : '*Chưa ai ra đòn — hãy là người đầu tiên!*';
};

/** Embed bảng boss công khai. */
function bossPanel(boss, { final } = {}) {
  const alive = boss.status === 'alive' && !final;
  const t = B.totals(boss.boss_id);
  const status = alive ? 'Đang giao chiến' : (boss.status === 'killed' ? 'Đã bị trấn áp' : boss.status === 'escaped' ? 'Đã trốn thoát' : 'Đã bị hủy');
  const emb = buildBattle({
    status, title: `${boss.name} · ${boss.realm_name}`,
    color: alive ? COLORS.DANGER : (boss.status === 'killed' ? COLORS.SUCCESS : COLORS.SYSTEM),
    sides: [{ label: `${E.bosstg} YÊU THÚ CẤP THẾ GIỚI`, name: boss.name, icon: 'bosstg', hp: Math.max(0, boss.hp), maxHp: boss.max_hp, kind: 'hp', note: `Cảnh giới: ${boss.realm_name} · Cấp ${boss.tier}` }],
    turn: (D.get('SELECT COALESCE(SUM(hits),0) AS n FROM wb7_damage WHERE boss_id = ?', boss.boss_id).n || 0) + (alive ? 1 : 0),
    endsAt: alive ? boss.expires_at : null,
    log: (logs.get(boss.boss_id) || []),
    extraFields: [
      section('Bảng sát thương', [rankLines(boss.boss_id)], { emoji: 'cup' }),
      { name: `${E.thanhvien} Tham chiến`, value: `**${num(t.n)}** người`, inline: true },
      { name: `${E.satthuong} Tổng sát thương`, value: `**${num(t.dmg)}**`, inline: true },
    ],
    footer: alive ? `Hồi chiêu ${B.ACTION_CD}s/đòn` : undefined,
  });
  return emb;
}

function bossComponents(bossId, disabled = false) {
  const mk = (id, label, emoji, style) => new ButtonBuilder().setCustomId(`wb|${id}|${bossId}`).setLabel(label).setStyle(style).setDisabled(disabled).setEmoji(toComponentEmoji(E[emoji]) || '⚔️');
  return [new ActionRowBuilder().addComponents(
    mk('atk', 'Tấn Công', 'kiem', ButtonStyle.Primary),
    mk('skill', 'Thần Thông', 'linhngothiendao', ButtonStyle.Primary),
    mk('rest', 'Điều Tức', 'hoihp', ButtonStyle.Success),
    mk('rank', 'Xếp Hạng', 'cup', ButtonStyle.Secondary),
    mk('me', 'Của Tôi', 'thanhvien', ButtonStyle.Secondary),
  )];
}
const panelPayload = (boss) => ({ embeds: [bossPanel(boss)], components: bossComponents(boss.boss_id, boss.status !== 'alive') });

// ---- cập nhật bảng (giới hạn tần suất) ----
const lastEdit = new Map(); const timers = new Map(); const msgRef = new Map();
async function editPanel(client, bossId, ref) {
  const boss = B.getBossById(bossId); if (!boss) return;
  let msg = ref || msgRef.get(bossId);
  try {
    if (!msg && boss.channel_id && boss.message_id && client) {
      const ch = await client.channels.fetch(boss.channel_id); msg = await ch.messages.fetch(boss.message_id);
    }
    if (msg) { await msg.edit(panelPayload(boss)); msgRef.set(bossId, msg); lastEdit.set(bossId, Date.now()); }
  } catch (_) { /* tin nhắn bị xoá/thiếu quyền — bỏ qua */ }
}
function schedulePanelRefresh(client, bossId, msg) {
  if (msg) msgRef.set(bossId, msg);
  if (timers.has(bossId)) return;
  const wait = Math.max(0, 4000 - (Date.now() - (lastEdit.get(bossId) || 0)));
  const t = setTimeout(() => { timers.delete(bossId); editPanel(client, bossId); }, wait); t.unref?.(); timers.set(bossId, t);
}

/** Kết thúc boss (gục / hết hạn / hủy): chia thưởng, khoá nút, thông báo toàn server. */
async function concludeBoss(client, bossId, reason, killerId = null) {
  const res = B.finish(bossId, reason, killerId);
  if (!res) return null;
  const boss = res.boss;
  await editPanel(client, bossId);
  const top = res.contributors.slice(0, 5).map((c) => ({ name: `<@${c.user_id}>`, damage: c.damage }));
  let emb;
  if (reason === 'killed') emb = W.bossDefeated({ name: boss.name, killer: `<@${killerId}>`, top, totalDamage: res.total });
  else if (reason === 'escaped') emb = W.bossEscaped({ name: boss.name });
  const extra = [];
  for (const c of res.contributors.slice(0, 10)) extra.push(`${MEDAL[c.rank - 1] || `**${c.rank}.**`} <@${c.user_id}> — +${num(c.tuVi)} EXP · +${num(c.linhThach)} ${E.linhthach}`);
  for (const d of res.drops) extra.push(`${E.sk_phanthuong} <@${d.user_id}> ${d.text}`);
  if (emb && extra.length) emb.addFields({ name: `${E.sk_phanthuong} PHẦN THƯỞNG`, value: extra.join('\n').slice(0, 1024), inline: false });
  if (emb) await announceWorld(client, boss.guild_id, emb, { channelId: boss.channel_id });
  logs.delete(bossId); msgRef.delete(bossId); lastEdit.delete(bossId);
  return res;
}

/** Vòng nền: boss hết hạn → trốn thoát. */
async function tick(client) {
  for (const b of B.dueBosses()) { try { await concludeBoss(client, b.boss_id, 'escaped'); } catch (e) { console.error('⚠️ boss tick:', e.message); } }
  for (const b of B.aliveBosses()) if (b.message_id && !timers.has(b.boss_id) && Date.now() - (lastEdit.get(b.boss_id) || 0) > 60000) editPanel(client, b.boss_id); // làm mới đếm lùi định kỳ
}

/** Embed kết quả riêng tư của 1 hành động. */
function personalResult(res, user) {
  const boss = B.getBossById(res.boss.boss_id);
  const nm = safe(user.displayName || user.username, 'Đạo hữu');
  let line;
  if (res.action === 'rest') line = `[Lượt ${num(res.turn)}] ${nm} điều tức, hồi **${num(res.heal)}** Sinh Mệnh và **${res.mpGain}%** Linh Lực.`;
  else if (res.action === 'skill') line = `[Lượt ${num(res.turn)}] ${nm} thi triển **Thần Thông**${res.crit ? ' — **BẠO KÍCH!**' : ''}, gây **${num(res.dmg)}** sát thương.`;
  else line = `[Lượt ${num(res.turn)}] ${nm} tung đòn, gây **${num(res.dmg)}** sát thương.`;
  const log = [line];
  if (res.counter > 0) log.push(`[Lượt ${num(res.turn)}] ${boss.name} phản công, gây **${num(res.counter)}** sát thương${res.counterCut ? ` _(trang bị/đan/trận giảm ${Math.round(res.counterCut * 100)}%)_` : ''}.`);
  if (res.finished) log.push(`${E.cup} **Đòn kết liễu!** ${boss.name} đã gục ngã.`);
  return buildBattle({
    status: res.finished ? 'Chiến thắng' : 'Đang giao chiến', title: `${boss.name}`,
    color: res.finished ? COLORS.SUCCESS : COLORS.DANGER,
    sides: [
      { label: 'ĐẠO HỮU', name: nm, icon: 'thanhvien', hp: res.hp, maxHp: res.maxHp, mp: res.mp, maxMp: 100 },
      { label: 'YÊU THÚ', name: boss.name, icon: 'bosstg', hp: res.bossHp, maxHp: boss.max_hp },
    ],
    turn: res.turn, endsAt: boss.status === 'alive' ? boss.expires_at : null, log,
    extraFields: [{ name: `${E.sk_thoigian} Hồi chiêu`, value: `${B.ACTION_CD} giây`, inline: true }],
  });
}

const feedLine = (res, user) => {
  const nm = `<@${user.id}>`;
  if (res.action === 'rest') return `[Lượt ${num(res.turn)}] ${nm} điều tức hồi sức.`;
  return `[Lượt ${num(res.turn)}] ${nm} ${res.action === 'skill' ? `dùng Thần Thông${res.crit ? ' (bạo kích)' : ''}` : 'tấn công'} — **${num(res.dmg)}** sát thương.`;
};

/** Thực hiện 1 hành động + phản hồi (dùng chung cho nút bấm và lệnh /danhboss). */
async function doAction(i, action, guildId) {
  const res = B.attack(guildId, i.user.id, action);
  if (!res.ok) {
    if (res.expired) { await concludeBoss(i.client, res.bossId, 'escaped'); }
    const e = res.cooldown ? N.cooldown(res.error) : N.error(res.error, res.code);
    return i.reply({ embeds: [e], flags: EPH });
  }
  pushLog(res.boss.boss_id, feedLine(res, i.user));
  await i.reply({ embeds: [personalResult(res, i.user)], flags: EPH });
  if (res.finished) await concludeBoss(i.client, res.boss.boss_id, 'killed', res.killerId);
  else schedulePanelRefresh(i.client, res.boss.boss_id, i.message || null);
  return null;
}

registerStatic('wb', async (i, [action, bossId]) => {
  const boss = B.getBossById(Number(bossId));
  if (!boss || boss.status !== 'alive') {
    return i.reply({ embeds: [N.info('Boss này đã kết thúc. Chờ lần triệu hồi tiếp theo!')], flags: EPH });
  }
  if (action === 'rank') {
    const all = B.ranking(boss.boss_id, 15);
    return i.reply({ embeds: [createEmbed({ cat: 'boss', header: 'BẢNG SÁT THƯƠNG', title: boss.name, color: COLORS.DANGER, description: all.length ? all.map((c, k) => `${MEDAL[k] || `**${k + 1}.**`} <@${c.user_id}> — ${num(c.damage)} (${num(c.hits)} đòn)`).join('\n') : 'Chưa có ai ra đòn.' })], flags: EPH });
  }
  if (action === 'me') {
    const m = B.myStat(boss.boss_id, i.user.id); const t = B.totals(boss.boss_id);
    return i.reply({ embeds: [createEmbed({ cat: 'boss', header: 'CHIẾN TÍCH CỦA TÔI', title: boss.name, color: COLORS.INFO, description: m && m.hits ? `${E.satthuong} Sát thương: **${num(m.damage)}** (${pct(t.dmg ? m.damage / t.dmg : 0)} tổng)\n${E.kiem} Số đòn: **${num(m.hits)}**` : 'Bạn chưa ra đòn nào.' })], flags: EPH });
  }
  if (['atk', 'skill', 'rest'].includes(action)) return doAction(i, action, boss.guild_id);
  return null;
});

/** Triệu hồi + đăng bảng. channel: kênh gửi bảng. Trả { ok, boss?, error? } */
async function summonAndPost({ client, guildId, channel, by, capdo, hp, minutes }) {
  const s = B.summon({ guildId, channelId: channel && channel.id, by, capdo, hp, minutes });
  if (!s.ok) return s;
  const msg = await channel.send(panelPayload(s.boss));
  B.setMessage(s.boss.boss_id, channel.id, msg.id); msgRef.set(s.boss.boss_id, msg); lastEdit.set(s.boss.boss_id, Date.now());
  const boss = B.getBossById(s.boss.boss_id);
  const ann = W.bossSpawn({ name: boss.name, realm: boss.realm_name, hp: boss.max_hp, location: `<#${channel.id}>`, expiresAt: boss.expires_at, summoner: by ? `<@${by}>` : '' });
  await announceWorld(client, guildId, ann, { channelId: channel.id, skipIfSame: true });
  return { ok: true, boss, message: msg };
}

module.exports = { panelResultFor: personalResult, bossPanel, panelPayload, doAction, concludeBoss, tick, summonAndPost, schedulePanelRefresh, editPanel };
