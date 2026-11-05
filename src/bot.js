'use strict';
require('dotenv').config();
const AC = require('./autoconfig');
AC.applyDefaults();   // điền mọi biến còn thiếu bằng mặc định — chỉ cần mỗi DISCORD_TOKEN
const { Client, GatewayIntentBits, Partials, Events, REST, Routes } = require('discord.js');
const D = require('./db');
const { syncPixelEmoji, applyEmojiFallbacks, continuePixelSyncInBackground } = require('./game/emoji');
const { wrapInteraction } = require('./ui/skin');
const kit = require('./ui/kit');
const F = require('./commands/framework');
require('./commands/basic');
require('./commands/treoquan');
require('./commands/chuoi');
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

async function registerSlash(client) {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  return AC.registerSlashAuto({
    rest, Routes, clientId: client.user.id, body: F.buildSlashJson(),
    guildIds: [...client.guilds.cache.keys()], onlyGuildId: GUILD_ID,
  });
}

let OWNER_ID = null;
/** Chủ bot (người tạo ứng dụng trên Developer Portal) tự động thành admin — không cần ADMIN_IDS. */
async function detectOwner(client) {
  try {
    const app = await client.application.fetch();
    OWNER_ID = AC.detectOwnerId(app);
    if (OWNER_ID && require('./game/constants').addAdmin(OWNER_ID)) console.log(`👑 Chủ bot ${OWNER_ID} đã tự động là admin.`);
  } catch (e) { console.warn('ℹ️ Không dò được chủ bot (dùng ADMIN_IDS nếu cần):', e.message); }
}

const BOT_VERSION = require('../package.json').version;

/** Gửi lỗi (mã + stack rút gọn) vào kênh ERROR_LOG_CHANNEL_ID hoặc DM các admin nếu ERROR_DM_ADMINS=1 — admin khỏi phải mở console. */
function installErrorReporter(client) {
  const chId = process.env.ERROR_LOG_CHANNEL_ID; const dm = (process.env.ERROR_DM_ADMINS || '0') === '1';
  if (!chId && !dm) return;
  let last = 0;
  require('./errorlog').setReporter(async (code, where, msg) => {
    const gap = chId ? 3000 : 5 * 60 * 1000;      // kênh: 3 giây · nhắn riêng chủ bot: 5 phút (khỏi bị ngập tin)
    if (Date.now() - last < gap) return; last = Date.now();
    const text = `⚠️ **Lỗi \`${code}\`** tại \`${where}\`\n\`\`\`\n${String(msg).slice(0, 1500)}\n\`\`\`\nGõ \`/loigannhat\` để xem thêm. Nếu lỗi \`database or disk is full\`: gõ \`/dungluong\`.`;
    try {
      if (chId) { const ch = await client.channels.fetch(chId); await ch.send({ content: text }); }
      else if (OWNER_ID) { const u = await client.users.fetch(OWNER_ID); await u.send({ content: text }); }
    } catch (_) { /* không gửi được thì thôi */ }
  });
}

function buildClient({ content: withContent, members: USE_MEMBERS }) {
  const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
  if (withContent) intents.push(GatewayIntentBits.MessageContent);
  if (USE_MEMBERS) intents.push(GatewayIntentBits.GuildMembers);
  const client = new Client({ intents, partials: [Partials.Channel] });

  client.once(Events.ClientReady, async (c) => {
    console.log(`🤖 Đăng nhập: ${c.user.tag}`);
    await applyEmojiFallbacks(c);
    continuePixelSyncInBackground();
    installErrorReporter(c);
    await detectOwner(c);
    try { await registerSlash(c); } catch (e) { console.error('❌ Đăng ký slash lỗi:', e.message, '— kiểm tra bot đã được mời với quyền "applications.commands" (và GUILD_ID nếu có đặt).'); }
    startBackground(client);
  });
  // Server mới mời bot vào → lệnh slash hiện ngay (chỉ khi không ghim GUILD_ID).
  client.on(Events.GuildCreate, async (g) => {
    if (GUILD_ID) return;
    try { await new REST({ version: '10' }).setToken(TOKEN).put(Routes.applicationGuildCommands(client.user.id, g.id), { body: F.buildSlashJson() }); console.log(`✅ Đã đăng ký lệnh slash cho server mới ${g.id}.`); }
    catch (e) { console.warn(`⚠️ Server mới ${g.id}: ${e.message}`); }
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
  console.log(`🌸 Tiên Giới Bot v12.5 (${BOT_VERSION}) — Node ${process.version}`);
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

  const USE_MEMBERS = (process.env.ENABLE_MEMBERS_INTENT || '1') !== '0';
  // Thử bộ intent đầy đủ nhất, bị từ chối thì tự hạ dần (không cần sửa biến gì).
  const steps = [];
  if (USE_PREFIX && USE_MEMBERS) steps.push({ content: true, members: true });
  if (USE_PREFIX) steps.push({ content: true, members: false });
  if (USE_MEMBERS) steps.push({ content: false, members: true });
  steps.push({ content: false, members: false });
  try {
    const { step } = await AC.loginCascade({
      build: buildClient, steps, login: (c) => c.login(TOKEN),
      isIntentError: (e) => /disallowed intents|used disallowed|4014/i.test(String(e && e.message || e)),
      warn: (m) => console.warn(m),
    });
    if (USE_PREFIX && !step.content) {
      console.warn('⚠️ Chưa bật "Message Content Intent" (Developer Portal → Bot → Privileged Gateway Intents) → bot chạy bằng lệnh SLASH (/); lệnh "?" và "!" tạm không dùng được.');
    }
    if (USE_MEMBERS && !step.members) console.warn('ℹ️ Chưa bật "Server Members Intent" → bỏ qua tính năng tự rút người rời server khỏi cứ điểm Tông Môn Chiến (không ảnh hưởng gì khác).');
  } catch (e) {
    const msg = String(e && e.message || e);
    if (/invalid token|an invalid token/i.test(msg) || e.code === 'TokenInvalid') {
      console.error('❌ DISCORD_TOKEN sai hoặc đã bị reset. Vào Developer Portal → Bot → Reset Token → copy token mới dán vào DISCORD_TOKEN.');
    } else console.error('❌ Đăng nhập thất bại:', msg);
    process.exit(1);
  }
}
main().catch((e) => { console.error('❌ Lỗi khởi động:', e); process.exit(1); });
