'use strict';
/** Mẫu Chiến đấu (spec §3.4): hai bên · HP/MP · lượt · nhật ký · thời gian · kết quả. */
const { createEmbed } = require('../components/baseEmbed');
const { progressBar } = require('../components/progressBar');
const { E } = require('../emojis');
const { exp, num, discordTime, safe } = require('../format');
const { COLORS } = require('../theme/colors');

/** side: { name, icon, hp, maxHp, mp?, maxMp?, kind?('hp'), note? } */
function sideField(s) {
  const lines = [`${E[s.icon] || ''} **${safe(s.name)}**`, `${E.hp} ${progressBar(s.hp, s.maxHp, { kind: s.kind || 'hp', length: 10 })}`, `${exp(s.hp, s.maxHp)}`];
  if (s.maxMp) lines.push(`${E.mp} ${progressBar(s.mp, s.maxMp, { kind: 'mp', length: 10 })}  ${num(s.mp)}%`);
  if (s.note) lines.push(s.note);
  return { name: s.label || '​', value: lines.join('\n'), inline: false };
}

function buildBattle({ status, title, sides, turn, log = [], endsAt, result, color = COLORS.DANGER, extraFields = [], footer }) {
  const fields = sides.map(sideField);
  if (log.length) fields.push({ name: 'NHẬT KÝ GIAO CHIẾN', value: log.slice(-6).join('\n'), inline: false });
  for (const f of extraFields) fields.push(f);
  const lines = [];
  if (turn) lines.push(`${E.sk_thoigian} Lượt **${num(turn)}**${endsAt ? ` · Còn lại ${discordTime(endsAt, 'R')}` : ''}`);
  if (result) lines.push(result);
  return createEmbed({ cat: 'chiendau', status, title, color, description: lines.join('\n'), fields, footer });
}
module.exports = { buildBattle, sideField };
