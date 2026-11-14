'use strict';
// V18 — đồng bộ emoji với Discord GIẢ: tg7_canhgioi_14 (vương miện Tiên Đế cũ) ĐÃ có sẵn trên Discord → cảnh giới 14 mới phải lên dưới tên *_v18,
// Tiên Đế (19) tải lên bản vương miện cũ, emoji đã có (0–13) không bị tải lại; chạy lần 2 không tải thêm gì.
const http = require('node:http'); const assert = require('node:assert'); const os = require('node:os'); const path = require('node:path');
const posted = []; let id = 1000; const existing = [{ id: '111', name: 'tg7_canhgioi_14' }, { id: '112', name: 'tg7_canhgioi_13' }];
const srv = http.createServer((req, res) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => {
  if (req.url === '/oauth2/applications/@me') return res.end(JSON.stringify({ id: '9' }));
  if (req.method === 'GET') return res.end(JSON.stringify({ items: existing }));
  const j = JSON.parse(b); posted.push(j.name); const e = { id: String(id++), name: j.name }; existing.push(e); return res.end(JSON.stringify(e)); }); });
srv.listen(0, async () => {
  process.env.TULUYEN_DISCORD_API = `http://127.0.0.1:${srv.address().port}`; process.env.DISCORD_TOKEN = 'x'; process.env.TULUYEN_EMOJI_CACHE = path.join(os.tmpdir(), `emoji_cache_${Date.now()}.json`);
  const EM = require('../src/game/emoji'); let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
  await EM.syncPixelEmoji({ budgetMs: 600000 });
  ok(EM.realmEmoji(14).includes('tg7_canhgioi_14_v18') && !EM.realmEmoji(14).includes(':111>'), 'cảnh giới 14 không được dùng tranh cũ');
  ok(EM.realmEmoji(13) === '<:tg7_canhgioi_13:112>' && !posted.includes('tg7_canhgioi_13'), 'emoji cũ giữ nguyên, không tải lại');
  ok(posted.includes('tg7_canhgioi_19') && posted.includes('tg7_canhgioi_14_v18') && !posted.includes('tg7_canhgioi_14'), 'tải đúng tên');
  for (let i = 15; i <= 28; i++) ok(posted.includes(`tg7_canhgioi_${i}`), `thiếu tải canhgioi_${i}`);
  for (const k of ['so_ky', 'trung_ky', 'hau_ky', 'vien_man']) ok(posted.includes(`tg7_${k}`), k);
  ok(posted.every((nm) => nm.length <= 32 && /^\w+$/.test(nm)), 'tên emoji hợp lệ');
  const before = posted.length; await EM.syncPixelEmoji({ budgetMs: 600000 }); ok(posted.length === before, 'chạy lần 2 không tải thêm');
  const c = EM.toComponentEmoji(EM.realmEmoji(28)); ok(c && c.id && c.name === 'tg7_canhgioi_28', 'emoji dùng được trong nút/menu');
  srv.close(); console.log(`✅ test_emoji_sync_v18 OK (${n} kiểm tra)`); });
