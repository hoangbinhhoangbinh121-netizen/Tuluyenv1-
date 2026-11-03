'use strict';
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events, REST, Routes } = require('discord.js');
const D = require('./db');
const { syncPixelEmoji, applyEmojiFallbacks, continuePixelSyncInBackground } = require('./game/emoji');
const { wrapInteraction } = require('./ui/skin');
const kit = require('./ui/kit');
const F = require('./commands/framework');
require('./commands/basic');
require('./commands/admin');
require('./commands/dan');
require('./commands/kho');
require('./commands/chiendau');
require('./commands/phithang');
require('./commands/sect');
require('./commands/social');
require('./commands/pvp');
require('./commands/sectwar');
require('./commands/daiphu');
require('./commands/guide');
const { startBackground } = require('./background');

const TOKEN = process.env.DISCORD_TOKEN;
// Bản Python mặc định dùng tiền tố "?" (vd ?tuluyen); lệnh admin ẩn dùng "!" → chấp nhận cả hai. Đổi bằng COMMAND_PREFIX="?,!,."
const PREFIXES = String(process.env.COMMAND_PREFIX || '?,!').split(/[,\s]+/).filter(Boolean);
const GUILD_ID = process.env.GUILD_ID || '';
const USE_PREFIX = (process.env.ENABLE_PREFIX_COMMANDS || '1') !== '0';

async function registerSlash(clientId) {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const body = F.buildSlashJson();
  if (GUILD_ID) await rest.put(Routes.applicationGuildCommands(clientId, GUILD_ID), { body });
  else await rest.put(Routes.applicationCommands(clientId), { body });
  console.log(`✅ Đã đăng ký ${body.length} lệnh slash ${GUILD_ID ? `(server ${GUILD_ID})` : '(toàn cục — có thể mất tới 1 giờ để hiện)'}.`);
}

const BOT_VERSION = require('../package.json').version;

/** Gửi lỗi (mã + stack rút gọn) vào kênh ERROR_LOG_CHANNEL_ID hoặc DM các admin nếu ERROR_DM_ADMINS=1 — admin khỏi phải mở console. */
function installErrorReporter(client) {
  const chId = process.env.ERROR_LOG_CHANNEL_ID; const dm = (process.env.ERROR_DM_ADMINS || '0') === '1';
  if (!chId && !dm) return;
  let last = 0;
  require('./errorlog').setReporter(async (code, where, msg) => {
    if (Date.now() - last < 3000) return; last = Date.now();   // chống ngập tin
    const text = `⚠️ **Lỗi \`${code}\`** tại \`${where}\`\n\`\`\`\n${String(msg).slice(0, 1500)}\n\`\`\``;
    try {
      if (chId) { const ch = await client.channels.fetch(chId); await ch.send({ content: text }); }
      else for (const id of require('./game/constants').ADMIN_CODE_APPROVER_IDS.slice(0, 3)) { const u = await client.users.fetch(id); await u.send({ content: text }); }
    } catch (_) { /* không gửi được thì thôi */ }
  });
}

function buildClient(withContent) {
  const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
  if (withContent) intents.push(GatewayIntentBits.MessageContent);
  const USE_MEMBERS = (process.env.ENABLE_MEMBERS_INTENT || '0') === '1';
  if (USE_MEMBERS) intents.push(GatewayIntentBits.GuildMembers);
  const client = new Client({ intents, partials: [Partials.Channel] });

  client.once(Events.ClientReady, async (c) => {
    console.log(`🤖 Đăng nhập: ${c.user.tag}`);
    await applyEmojiFallbacks(c);
    continuePixelSyncInBackground();
    installErrorReporter(c);
    try { await registerSlash(c.user.id); } catch (e) { console.error('❌ Đăng ký slash lỗi:', e.message, '— kiểm tra bot đã được mời với quyền "applications.commands" và GUILD_ID đúng.'); }
    startBackground(client);
  });
  client.on(Events.InteractionCreate, async (i) => {
    try {
      wrapInteraction(i);   // v7: phản hồi luôn đi qua lớp đồng bộ giao diện + chống lỗi "đã trả lời"
      if (i.isChatInputCommand()) await F.handleSlash(i);
      else if (i.isModalSubmit()) await kit.routeModal(i);
      else if (i.isMessageComponent()) await kit.routeComponent(i);
    } catch (e) { require('./errorlog').logError('interactionCreate', e); }
  });
  if (USE_MEMBERS) client.on(Events.GuildMemberRemove, (m) => {
    try {
      const W = require('./game/sectwar'); const war = W.getActiveWar(m.guild.id); if (!war) return;
      const part = W.getParticipant(war.war_id, m.id);
      if (part && part.node_key) W.moveToNode(war.war_id, m.id, part.sect_id, null);
    } catch (e) { console.error('⚠️ GuildMemberRemove:', e.message); }
  });
  if (withContent) client.on(Events.MessageCreate, async (m) => {
    try {
      if (await require('./commands/hiddenAdmin').handleHiddenAdmin(m)) return;
      await F.handlePrefix(m, PREFIXES);
    } catch (e) { require('./errorlog').logError('messageCreate', e); }
  });
  return client;
}

async function main() {
  console.log(`🌸 Tiên Giới Bot v7.0 (${BOT_VERSION}) — Node ${process.version}`);
  if (!TOKEN) {
    console.error('❌ Thiếu DISCORD_TOKEN. Hãy tạo file .env (hoặc mục Startup/Variables của host) với dòng:  DISCORD_TOKEN=token_bot_cua_ban');
    process.exit(1);
  }
  if (/\s|^["']|["']$/.test(TOKEN)) console.warn('⚠️ DISCORD_TOKEN có dấu cách/dấu nháy thừa — hãy xoá đi nếu bot không đăng nhập được.');
  const driver = D.initDb();
  console.log(`🗄️ SQLite: ${D.DB_PATH} (driver: ${driver})`);
  await syncPixelEmoji();

  process.on('unhandledRejection', (e) => console.error('⚠️ unhandledRejection:', e));
  const shutdown = () => { try { D.closeDb(); } catch (_) { /* bỏ qua */ } process.exit(0); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);

  let client = buildClient(USE_PREFIX);
  try {
    await client.login(TOKEN);
  } catch (e) {
    const msg = String(e && e.message || e);
    if (USE_PREFIX && /disallowed intents/i.test(msg)) {
      console.warn('⚠️ Chưa bật "Message Content Intent" trong Discord Developer Portal → Bot → Privileged Gateway Intents.');
      console.warn('   → Bot vẫn chạy bình thường bằng lệnh SLASH (/). Lệnh bắt đầu bằng "!" (vd !restore_db, !hoang) sẽ KHÔNG hoạt động cho tới khi bạn bật intent đó rồi khởi động lại.');
      try { client.destroy(); } catch (_) { /* bỏ qua */ }
      client = buildClient(false);
      try { await client.login(TOKEN); }
      catch (e2) { console.error('❌ Đăng nhập thất bại:', e2.message); process.exit(1); }
    } else if (/invalid token|an invalid token/i.test(msg) || e.code === 'TokenInvalid') {
      console.error('❌ DISCORD_TOKEN sai hoặc đã bị reset. Vào Developer Portal → Bot → Reset Token → copy token mới dán vào DISCORD_TOKEN.');
      process.exit(1);
    } else {
      console.error('❌ Đăng nhập thất bại:', msg);
      process.exit(1);
    }
  }
}
main().catch((e) => { console.error('❌ Lỗi khởi động:', e); process.exit(1); });
