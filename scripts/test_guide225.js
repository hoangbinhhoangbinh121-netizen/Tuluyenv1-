'use strict';
// V22.4.2 — hướng dẫn: mọi lệnh đã đăng ký đều có trong /huongdan; embed từng nhóm không vượt giới hạn Discord.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_gd_${Date.now()}.db`);
const assert = require('node:assert'); const fs = require('node:fs'); const path = require('node:path');
require('../src/db').initDb(); let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
for (const f of fs.readdirSync(path.join(__dirname, '..', 'src', 'commands'))) if (f.endsWith('.js')) require(`../src/commands/${f}`);
const reg = require('../src/commands/framework').registry; const G = require('../src/data/guide.json'); const gm = require('../src/commands/guide');
const inG = new Set(G.flatMap((c) => c.commands.map((x) => x[0])));
const missing = [...reg.values()].map((c) => c.name).filter((x) => !inG.has(x)); ok(missing.length === 0, `thiếu trong hướng dẫn: ${missing}`);
const dup = G.flatMap((c) => c.commands.map((x) => x[0])).filter((x, i, a) => a.indexOf(x) !== i); ok(dup.length === 0, `trùng: ${dup}`);
for (const x of inG) ok(reg.get(x), `hướng dẫn nhắc lệnh không tồn tại: ${x}`);
for (const c of G) { const j = gm.categoryEmbed(c).toJSON(); ok((j.fields || []).every((f) => f.value.length <= 1024), `${c.key}: field >1024`); ok(JSON.stringify(j).length < 6000 && (j.description || '').length <= 4096, `${c.key}: embed quá dài`);
  for (const [nm, d] of c.commands) ok(d && d.length > 5, `${c.key}/${nm}: mô tả trống`); }
const ov = gm.overviewEmbed().toJSON(); ok(ov.fields.length === G.length, 'tổng quan đủ nhóm');
const txt = JSON.stringify(G); ok(/5 tỷ/.test(txt) && /bcfight/.test(txt) && /theo lượt/.test(txt), 'có nội dung V22.4.2');
console.log(`PASS test_guide225: ${n} checks`);
