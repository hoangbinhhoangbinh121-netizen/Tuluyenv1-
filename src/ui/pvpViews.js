'use strict';
const { EmbedBuilder } = require('discord.js');
const Pvp = require('../game/pvp');
const D = require('../db');
const Cu = require('../game/cultivator');
const { E } = require('../game/emoji');
const { View, showModal, EPHEMERAL } = require('./kit');

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

function buildHistoryEmbed(target, rows) {
  const lines = rows.map((r) => {
    const won = String(r.winner_id) === String(target.id); const opp = won ? r.loser_id : r.winner_id; const ts = `<t:${Math.trunc(r.ended_at)}:R>`;
    return won ? `🏆 Thắng <@${opp}> (+${r.stake} tu vi) — ${ts}` : `💀 Thua <@${opp}> (-${r.stake} tu vi) — ${ts}`;
  });
  return new EmbedBuilder().setTitle(`📜 Lịch Sử PvP — ${target.displayName || target.username}`).setDescription(lines.join('\n')).setColor(0xc27c0e);
}
function buildStatsEmbed(target, row) {
  const w = row.pvp_wins; const l = row.pvp_losses; const t = w + l;
  return new EmbedBuilder().setTitle(`⚔️ Thống Kê PvP — ${target.displayName || target.username}`).setColor(0x5865f2).addFields(
    { name: 'Thắng', value: String(w), inline: true }, { name: 'Thua', value: String(l), inline: true }, { name: 'Tỉ lệ thắng', value: t > 0 ? `${(w / t * 100).toFixed(1)}%` : '—', inline: true });
}
module.exports = { pvpTargetView, challengeFromInteraction, buildHistoryEmbed, buildStatsEmbed };
