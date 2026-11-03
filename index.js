'use strict';
/**
 * Điểm khởi động cho hosting chạy mặc định "node index.js" (VibeHost, Pterodactyl...).
 * Kiểm tra thư viện đã cài chưa để báo lỗi dễ hiểu thay vì crash khó đọc.
 */
for (const mod of ['discord.js', 'dotenv']) {
  try { require.resolve(mod); } catch (_) {
    console.error(`❌ Thiếu thư viện "${mod}". Hãy chạy lệnh:  npm install   (rồi khởi động lại bot).`);
    console.error('   Nếu host không có ô gõ lệnh: vào mục Startup, bật "Auto install packages" hoặc đặt lệnh khởi động: npm install && node index.js');
    process.exit(1);
  }
}
require('./src/bot.js');
