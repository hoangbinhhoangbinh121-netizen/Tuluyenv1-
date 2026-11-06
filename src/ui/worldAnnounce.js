'use strict';
/** Thông báo toàn thế giới cho đột phá đại cảnh giới — chỉ từ cảnh giới WORLD_ANNOUNCE_MIN_REALM (mặc định Hóa Thần) trở lên. */
const R = require('../game/realm');
const { getSectName } = require('../game/sectBase');
const W = require('./templates/worldEvent');
const { announceWorld, get } = require('./worldChannel');

const MIN_REALM = Number(process.env.WORLD_ANNOUNCE_MIN_REALM || 5);
async function announceBreakthrough(client, guildId, user, d) {
  if (!guildId || !get(guildId) || d.after.realm_index < MIN_REALM) return false;   // chỉ khi đã đặt kênh thế giới
  const emb = W.breakthrough({
    player: `<@${user.id}>`, oldRealm: R.realmDisplay(d.before.realm_index, d.before.stage_index, true), newRealm: R.realmDisplay(d.after.realm_index, d.after.stage_index, true),
    sect: d.after.sect_id ? getSectName(d.after.sect_id) : 'Tán tu', location: 'Thiên Địa',
  });
  return announceWorld(client, guildId, emb);
}
module.exports = { announceBreakthrough };
