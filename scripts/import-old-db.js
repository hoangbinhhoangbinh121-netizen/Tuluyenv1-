'use strict';
/**
 * Chuyển dữ liệu từ DB của bản Python cũ (VD tutien_20260816_064733.db) sang data/tutien.db.
 * Schema giữ NGUYÊN nên chỉ cần copy file; script này sao lưu DB hiện có, copy, rồi chạy migration thêm cột còn thiếu.
 * Dùng:  node scripts/import-old-db.js đường/dẫn/tutien_cu.db
 */
const fs = require('node:fs');
const path = require('node:path');
const D = require('../src/db');
const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error('Cách dùng: node scripts/import-old-db.js <file .db cũ>'); process.exit(1); }
if (fs.existsSync(D.DB_PATH)) {
  const bak = D.DB_PATH.replace(/\.db$/, `_truoc_khi_import_${Date.now()}.db`);
  fs.copyFileSync(D.DB_PATH, bak); console.log('🛡️ Đã sao lưu DB hiện có →', bak);
}
fs.mkdirSync(path.dirname(D.DB_PATH), { recursive: true });
fs.copyFileSync(src, D.DB_PATH);
for (const e of ['-wal', '-shm']) { try { fs.unlinkSync(D.DB_PATH + e); } catch (_) { /* không có */ } }
const driver = D.initDb();
const n = D.get('SELECT COUNT(*) c FROM cultivators').c;
const s = D.get('SELECT COUNT(*) c FROM sects').c;
console.log(`✅ Import xong (${driver}): ${n} nhân vật, ${s} tông môn. Đã tự thêm các cột còn thiếu.`);
