'use strict';
// V21.5b — emoji pixel chủng tộc: đủ 31 khóa, PNG 128×128 RGBA nền trong suốt, có Unicode dự phòng, mọi khóa mà UI/logic dùng đều có hình.
const assert = require('node:assert'); const fs = require('node:fs'); const path = require('node:path'); const zlib = require('node:zlib');
const DIR = path.join(__dirname, '..', 'assets', 'emoji'); const FB = require('../src/data/emoji_fallback.json'); const R = require('../src/data/race21');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const keys = []; for (const id of R.ORDER) { keys.push(`race_${id}`, `rev_${id}`); for (const b of Object.keys(R.RACES[id].bloodlines)) keys.push(`bl_${b}`); }
keys.push('aw_1', 'aw_2', 'aw_3', 'race_awaken', 'race_bloodline', 'race_evolve', 'race_change');
ok(keys.length === 31 && new Set(keys).size === 31, '31 khóa duy nhất');
for (const k of keys) {
  const f = path.join(DIR, `${k}.png`); ok(fs.existsSync(f), `${k}.png tồn tại`);
  const b = fs.readFileSync(f); ok(b.slice(1, 4).toString() === 'PNG', `${k}: là PNG`);
  const w = b.readUInt32BE(16); const h = b.readUInt32BE(20); const ct = b[25]; ok(w === 128 && h === 128, `${k}: 128×128`); ok(ct === 6, `${k}: RGBA (có kênh alpha)`);
  ok(typeof FB[k] === 'string' && FB[k].length > 0, `${k}: có Unicode dự phòng`);
}
// pixel góc (0,0) trong suốt: giải nén IDAT, bộ lọc dòng đầu → byte alpha của pixel đầu = 0
for (const k of keys) { const b = fs.readFileSync(path.join(DIR, `${k}.png`)); let p = 8; const idat = []; while (p < b.length) { const len = b.readUInt32BE(p); const t = b.slice(p + 4, p + 8).toString(); if (t === 'IDAT') idat.push(b.slice(p + 8, p + 8 + len)); p += 12 + len; } const raw = zlib.inflateSync(Buffer.concat(idat)); ok(raw[0] === 0 ? raw[4] === 0 : true, `${k}: góc trái trên trong suốt`); }
const E = require('../src/game/emoji').E; for (const k of keys) ok(typeof E[k] === 'string' && E[k].length > 0, `E.${k} có giá trị (Unicode hoặc pixel)`);
{ const rev = JSON.parse(require('node:fs').readFileSync(path.join(__dirname, '..', 'assets', 'emoji_revisions.json'), 'utf8')); ok(rev && typeof rev === 'object', 'emoji_revisions.json hợp lệ');
  const EM = require('../src/game/emoji'); for (const [k, v] of Object.entries(rev)) { ok(/^[a-z0-9]{1,6}$/.test(v) && keys.concat(EM.ALL_KEYS).includes(k), `revision ${k}=${v} hợp lệ`); ok(EM.remoteName(k).length <= 32, 'tên emoji ≤ 32 ký tự'); }
  ok(EM.remoteName('race_nhan').startsWith('tg7_race_nhan'), 'remoteName hoạt động'); ok(EM.remoteName('canhgioi_14') === 'tg7_canhgioi_14_v18', 'revision cũ của canhgioi_14 còn nguyên'); }
console.log(`✅ test_emoji_race215: ${n} kiểm tra PASS`);
