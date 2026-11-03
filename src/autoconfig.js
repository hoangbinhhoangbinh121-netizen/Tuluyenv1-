'use strict';
/**
 * CẤU HÌNH TỰ ĐỘNG — bạn chỉ cần mỗi DISCORD_TOKEN. Mọi biến khác đều có mặc định hợp lý trong file này,
 * và những thứ bot tự dò được thì tự dò (chủ bot = admin, lệnh slash đăng ký ngay cho từng server...).
 * Có biến môi trường nào đặt tay thì vẫn được tôn trọng, TRỪ nhóm "sao lưu" (xem dưới) để khỏi đầy đĩa.
 */
const DEFAULTS = {
  COMMAND_PREFIX: '?,!',
  ENABLE_PREFIX_COMMANDS: '1',
  ENABLE_MEMBERS_INTENT: '1',      // tự thử bật; nếu Developer Portal chưa bật Server Members Intent thì tự bỏ
  TULUYEN_EMOJI_AUTOSYNC: '1',
  WORLD_ANNOUNCE_MIN_REALM: '5',
  BOSS_ACTION_COOLDOWN: '8',
  BOSS_DEFAULT_MINUTES: '30',
  ERROR_DM_ADMINS: '1',            // lỗi được nhắn riêng cho chủ bot (tối đa 1 tin / 5 phút)
};
// Sao lưu: LUÔN dùng giá trị này (bỏ qua biến trên host) — chỉ giữ bản mới nhất, không bao giờ làm đầy đĩa.
// Muốn tự đặt: thêm biến CONFIG_FROM_ENV=1.
const BACKUP_FIXED = {
  AUTO_BACKUP_HOURS: '6',
  AUTO_BACKUP_KEEP: '1',
  BACKUP_KEEP_MANUAL: '1',
  BACKUP_KEEP_PRE: '1',
  BACKUP_MAX_MB: '200',
};

function applyDefaults(env = process.env) {
  const set = [];
  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (env[k] === undefined || String(env[k]).trim() === '') { env[k] = v; set.push(k); }
  }
  const fromEnv = String(env.CONFIG_FROM_ENV || '') === '1';
  for (const [k, v] of Object.entries(BACKUP_FIXED)) {
    if (fromEnv && env[k] !== undefined && String(env[k]).trim() !== '') continue;
    env[k] = v;
  }
  return set;
}

/** Tìm ID chủ bot (người sở hữu ứng dụng, hoặc chủ team) từ đối tượng application của discord.js. */
function detectOwnerId(app) {
  const o = app && app.owner;
  if (!o) return null;
  if (o.ownerId) return String(o.ownerId);             // Team
  if (o.id) return String(o.id);                       // User
  return null;
}

/**
 * Đăng ký lệnh slash:
 *  - có GUILD_ID → chỉ server đó (như cũ);
 *  - không có   → đăng ký NGAY cho từng server bot đang ở (hiện tức thì, không đợi ~1 giờ) rồi xoá bản toàn cục để khỏi hiện trùng;
 *                 nếu không server nào đăng ký được thì rơi về đăng ký toàn cục.
 * rest/Routes được truyền vào để dễ kiểm thử.
 */
async function registerSlashAuto({ rest, Routes, clientId, body, guildIds, onlyGuildId = '', log = console.log, warn = console.warn }) {
  if (onlyGuildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, onlyGuildId), { body });
    log(`✅ Đã đăng ký ${body.length} lệnh slash (server ${onlyGuildId}).`);
    return { mode: 'guild', ok: [onlyGuildId], failed: [] };
  }
  const ok = []; const failed = [];
  for (const gid of guildIds) {
    try { await rest.put(Routes.applicationGuildCommands(clientId, gid), { body }); ok.push(gid); }
    catch (e) { failed.push(gid); warn(`⚠️ Không đăng ký được lệnh cho server ${gid}: ${e.message}`); }
  }
  if (ok.length) {
    try { await rest.put(Routes.applicationCommands(clientId), { body: [] }); } catch (_) { /* không xoá được thì thôi */ }
    log(`✅ Đã đăng ký ${body.length} lệnh slash cho ${ok.length} server (hiện ngay).`);
    return { mode: 'per-guild', ok, failed };
  }
  await rest.put(Routes.applicationCommands(clientId), { body });
  log(`✅ Đã đăng ký ${body.length} lệnh slash (toàn cục — có thể mất tới 1 giờ để hiện).`);
  return { mode: 'global', ok: [], failed };
}

/** Thử đăng nhập với bộ intent đầy đủ nhất, tự hạ dần nếu Developer Portal chưa bật. steps: [{content, members}] */
async function loginCascade({ build, steps, login, isIntentError, warn = console.warn }) {
  let lastErr;
  for (let i = 0; i < steps.length; i++) {
    const st = steps[i];
    const client = build(st);
    try { await login(client); return { client, step: st }; }
    catch (e) {
      lastErr = e;
      try { client.destroy(); } catch (_) { /* bỏ qua */ }
      if (!isIntentError(e) || i === steps.length - 1) throw e;
      warn(`⚠️ Intent bị từ chối (content=${st.content}, members=${st.members}) → thử cấu hình nhẹ hơn.`);
    }
  }
  throw lastErr;
}

module.exports = { DEFAULTS, BACKUP_FIXED, applyDefaults, detectOwnerId, registerSlashAuto, loginCascade };
