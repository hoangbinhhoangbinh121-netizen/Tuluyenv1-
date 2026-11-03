'use strict';
/** Kênh thông báo toàn thế giới: cài bằng /datkenhthegioi (hoặc biến WORLD_CHANNEL_ID). */
const D = require('../db');

const get = (guildId) => {
  const r = D.get("SELECT value FROM v7_settings WHERE guild_id = ? AND key = 'world_channel'", String(guildId));
  return (r && r.value) || process.env.WORLD_CHANNEL_ID || null;
};
const set = (guildId, channelId) => D.run("INSERT INTO v7_settings (guild_id, key, value) VALUES (?, 'world_channel', ?) ON CONFLICT(guild_id, key) DO UPDATE SET value = excluded.value", String(guildId), String(channelId));

/** Gửi Embed thông báo thế giới. skipIfSame: bỏ qua nếu kênh thế giới trùng kênh đã đăng bảng. */
async function announceWorld(client, guildId, embed, { channelId = null, skipIfSame = false } = {}) {
  const target = get(guildId) || channelId;
  if (!target || !client) return false;
  if (skipIfSame && String(target) === String(channelId) && get(guildId) === null) return false;
  if (skipIfSame && String(target) === String(channelId)) return false;
  try { const ch = await client.channels.fetch(String(target)); await ch.send({ embeds: [embed] }); return true; }
  catch (e) { console.warn('⚠️ Không gửi được thông báo thế giới:', e.message); return false; }
}
module.exports = { get, set, announceWorld };
