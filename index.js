'use strict';
/**
 * Điểm khởi động cho hosting chạy mặc định "node index.js" (VibeHost, Pterodactyl...).
 * Tự kiểm tra thư viện: thiếu hoặc HỎNG (vd thiếu file bên trong discord.js do cài dở/host dọn bớt file)
 * thì tự cài lại rồi mới chạy bot, thay vì chạy được vài phút rồi lỗi "Cannot find module".
 */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

// File bên trong discord.js được nạp "lười" lúc gửi tin nhắn — thiếu là mọi lệnh đều lỗi.
const LAZY_FILES = ['client/WebhookClient.js', 'structures/Webhook.js', 'structures/MessagePayload.js', 'client/Client.js'];

function depsProblem() {
  let djsSrc;
  try { djsSrc = path.dirname(require.resolve('discord.js')); } catch (_) { return 'thiếu discord.js'; }
  try { require.resolve('dotenv'); } catch (_) { return 'thiếu dotenv'; }
  const missing = LAZY_FILES.filter((f) => !fs.existsSync(path.join(djsSrc, f)));
  return missing.length ? `discord.js thiếu file: ${missing.join(', ')}` : '';
}

if (process.env.TULUYEN_SKIP_DEPCHECK !== '1') {
  let problem = depsProblem();
  if (problem) {
    console.warn(`⚠️ Thư viện chưa đủ (${problem}). Đang tự cài lại — có thể mất vài phút...`);
    try {
      try { fs.rmSync(path.join(__dirname, 'node_modules', 'discord.js'), { recursive: true, force: true }); } catch (_) { /* bỏ qua */ }
      execSync('npm install --no-audit --no-fund --no-package-lock --omit=dev', { cwd: __dirname, stdio: 'inherit' });
    } catch (e) {
      console.error('❌ Tự cài thư viện thất bại:', e.message);
    }
    // xoá cache require để lần kiểm tra sau đọc lại đĩa
    for (const k of Object.keys(require.cache)) if (k.includes(`${path.sep}node_modules${path.sep}`)) delete require.cache[k];
    problem = depsProblem();
    if (problem) {
      console.error(`❌ Vẫn lỗi thư viện (${problem}).`);
      console.error('   Hãy xoá thư mục node_modules rồi chạy:  npm install   (hoặc Startup → bật "Auto install packages"), sau đó khởi động lại.');
      process.exit(1);
    }
    console.log('✅ Đã cài lại thư viện xong.');
  }
}
require('./src/bot.js');
