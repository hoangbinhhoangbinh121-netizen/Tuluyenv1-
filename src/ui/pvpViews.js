'use strict';
const { EmbedBuilder } = require('discord.js');
const Pvp = require('../game/pvp');
const D = require('../db');
const Cu = require('../game/cultivator');
const { E } = require('../game/emoji');
const { View, showModal, registerStatic, EPHEMERAL } = require('./kit');
const { ButtonStyle } = require('discord.js');
const { btn, rowOf } = require('./petViews');
const C21 = require('../game/combat21');

const eph = (i, c) => i.reply({ content: c, flags: EPHEMERAL });

/** Gửi lời khiêu chiến từ 1 interaction (nút/select/modal) — tin nhắn công khai trong kênh. */
async function challengeFromInteraction(i, challengerId, targetId) {
  const err = Pvp.challengePrecheck(challengerId, targetId);
  if (err) return eph(i, err);
  await Pvp.sendChallenge(challengerId, targetId, async (payload) => { await i.reply(payload); return i.fetchReply(); });
  return null;
}

function pvpTargetView(userId) {
  const v = new View({ ownerId: userId, timeout: 120 });
  v.userSelect({ key: 'op', placeholder: 'Chọn đối thủ để đấu pháp...', row: 0 }, (i) => {
    const t = i.users.first();
    if (t.bot) return eph(i, '❌ Không thể đấu với bot.');
    return challengeFromInteraction(i, userId, t.id);
  });
  v.button({ key: 'manual', label: 'Nhập ID/@mention khác', emoji: E.nhapid, style: 'grey', row: 1 }, (i) => showModal(i, {
    title: 'Đấu Pháp', fields: [{ id: 'id', label: 'ID hoặc @mention đối thủ', placeholder: '123456789012345678', maxLength: 40 }],
    onSubmit: (mi, get) => {
      const raw = get('id').trim().replace(/^<@!?/, '').replace(/>$/, '');
      if (!/^\d+$/.test(raw)) return eph(mi, '❌ ID đối thủ không hợp lệ.');
      return challengeFromInteraction(mi, userId, raw);
    },
  }));
  return v;
}

/** Lịch sử: trận mới (v213_battles: thắng/thua/hòa, có mã trận) + trận cũ (pvp_history, không có nhật ký) gộp theo thời gian. */
function buildHistoryEmbed(target, rows, rows213 = []) {
  const tid = String(target.id);
  const items = [];
  for (const r of rows213) {
    const mine = String(r.a_id) === tid ? 'A' : 'B'; const opp = mine === 'A' ? r.b_id : r.a_id; const ts = `<t:${Math.trunc(r.ended_at)}:R>`;
    const why = C21.REASON[r.reason] || r.reason;
    let line;
    if (r.status === 'aborted') line = `⚪ Huỷ vs <@${opp}> (${why}) — ${ts}`;
    else if (r.result === 'draw') line = `🤝 Hòa <@${opp}> (${why}) — ${ts}`;
    else if (r.result === mine) line = `🏆 Thắng <@${opp}> (+${r.stake} tu vi, ${r.rounds} hiệp) — ${ts}`;
    else line = `💀 Thua <@${opp}> (-${r.stake} tu vi, ${r.rounds} hiệp) — ${ts}`;
    items.push({ t: r.ended_at, text: `${line} · mã \`${r.id}\`` });
  }
  const seen213 = new Set(rows213.map((r) => Math.trunc(r.ended_at)));
  for (const r of rows) {
    if (seen213.has(Math.trunc(r.ended_at))) continue;                 // trận đã có ở v213 (cùng thời điểm chốt)
    const won = String(r.winner_id) === tid; const opp = won ? r.loser_id : r.winner_id; const ts = `<t:${Math.trunc(r.ended_at)}:R>`;
    items.push({ t: r.ended_at, text: won ? `🏆 Thắng <@${opp}> (+${r.stake} tu vi) — ${ts}` : `💀 Thua <@${opp}> (-${r.stake} tu vi) — ${ts}` });
  }
  items.sort((x, y) => y.t - x.t);
  return new EmbedBuilder().setTitle(`📜 Lịch Sử PvP — ${require('../game/fx19').withHieu(target.id, target.displayName || target.username)}`)
    .setDescription((items.slice(0, 8).map((x) => x.text).join('\n') + '\n\n🔎 Xem nhật ký đầy đủ: `/lichsupvp ma_tran:<mã>`').slice(0, 4000)).setColor(0xc27c0e);
}

const LOG_PAGE = 4;
const plId = (id, page, f) => `pl|${id}|${page}|${f}`;
/** Nhật ký 1 trận: phân trang (4 hiệp/trang), lọc "chỉ hiệp có thay đổi sinh lực". */
/** Chỉ 2 người trong trận (hoặc admin duyệt) xem được nhật ký — v21.4 (kế hoạch: người ngoài trận không được dùng nút của trận). */
function canViewBattle(bt, uid) {
  if (!uid) return true;                                    // gọi nội bộ/test không kèm người xem
  if ([String(bt.a_id), String(bt.b_id)].includes(String(uid))) return true;
  try { return !!require('../commands/framework').isAdminApprover(uid); } catch (_) { return false; }
}
function battleLogPanel(battleId, page = 0, filter = 0, viewerId = null) {
  const bt = C21.getLog(battleId);
  if (!bt) return { content: '❌ Không tìm thấy trận với mã này.', embeds: [], components: [] };
  if (!canViewBattle(bt, viewerId)) return { content: '🔒 Chỉ hai người trong trận (hoặc admin) mới xem được nhật ký trận này.', embeds: [], components: [] };
  let rows = bt.logRows; if (Number(filter)) rows = rows.filter((r) => r.x);
  const pages = Math.max(1, Math.ceil(rows.length / LOG_PAGE)); const pg = Math.max(0, Math.min(pages - 1, Number(page) || 0));
  const t = (bt.sum && bt.sum.totals) || null;
  const res = bt.status === 'aborted' ? `⚪ Huỷ (${C21.REASON[bt.reason] || bt.reason})` : bt.result === 'draw' ? `🤝 Hòa (${C21.REASON[bt.reason] || bt.reason})` : `${bt.result === 'A' ? '🅰️' : '🅱️'} thắng (${C21.REASON[bt.reason] || bt.reason})`;
  const e = new EmbedBuilder().setTitle(`📜 Nhật ký trận ${bt.id}`).setColor(0xc27c0e)
    .setDescription(`🅰️ <@${bt.a_id}> vs 🅱️ <@${bt.b_id}>\nKết quả: **${res}** · ${bt.rounds} hiệp · cược ${bt.stake} tu vi${t ? `\n🅰️ gây ${t.A.dealt} · nhận ${t.A.taken}   |   🅱️ gây ${t.B.dealt} · nhận ${t.B.taken}` : ''}`.slice(0, 1500));
  if (!bt.logRows.length) e.addFields({ name: 'Nhật ký', value: 'Trận này không có nhật ký lưu lại.', inline: false });
  for (const r of rows.slice(pg * LOG_PAGE, pg * LOG_PAGE + LOG_PAGE)) e.addFields({ name: `⏱️ Hiệp ${r.r}`, value: String(r.t).slice(0, 1000), inline: false });
  e.setFooter({ text: `Trang ${pg + 1}/${pages}${Number(filter) ? ' · lọc: hiệp có thay đổi sinh lực' : ''}` });
  const f = Number(filter) ? 1 : 0;
  const comps = [rowOf(
    btn(plId(bt.id, Math.max(0, pg - 1), f), '◀', undefined, ButtonStyle.Secondary), btn(plId(bt.id, Math.min(pages - 1, pg + 1), f), '▶', undefined, ButtonStyle.Secondary),
    btn(plId(bt.id, 0, f ? 0 : 1), f ? 'Bỏ lọc' : 'Lọc: có đổi sinh lực', '🔎'))];
  return { embeds: [e], components: comps };
}
registerStatic('pl', async (i, parts) => {
  const [id, page, f] = parts;
  const p = battleLogPanel(id, Number(page) || 0, Number(f) || 0, i.user.id);
  if (p.content && !p.embeds.length) return i.reply({ content: p.content, flags: EPHEMERAL });
  return i.update(p);
});
function buildStatsEmbed(target, row) {
  const w = row.pvp_wins; const l = row.pvp_losses; const t = w + l;
  let draws = 0; try { draws = D.get("SELECT COUNT(*) AS n FROM v213_battles WHERE status = 'done' AND result = 'draw' AND (a_id = ? OR b_id = ?)", String(target.id), String(target.id)).n; } catch (_) { /* bảng chưa có */ }
  return new EmbedBuilder().setTitle(`⚔️ Thống Kê PvP — ${require('../game/fx19').withHieu(target.id, target.displayName || target.username)}`).setColor(0x5865f2).addFields(
    { name: 'Thắng', value: String(w), inline: true }, { name: 'Thua', value: String(l), inline: true }, { name: 'Hòa', value: String(draws), inline: true }, { name: 'Tỉ lệ thắng', value: t > 0 ? `${(w / t * 100).toFixed(1)}%` : '—', inline: true });
}
module.exports = { pvpTargetView, challengeFromInteraction, buildHistoryEmbed, buildStatsEmbed, battleLogPanel, LOG_PAGE };
