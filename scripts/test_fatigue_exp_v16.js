'use strict';
// V16 — giảm mạnh EXP đột phá + nerf nhẹ khi Tu Luyện dồn dập.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_fat_${Date.now()}.db`);
const assert = require('node:assert'); const D = require('../src/db'); D.initDb();
const A = require('../src/game/actionsBasic'); const BAL = require('../src/game/balance'); const R = require('../src/game/realm'); const K = require('../src/game/constants');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
// fatigue: ≤120 lần/giờ không giảm, 360 lần giảm đúng 15%, không bao giờ <0,85
const t0 = 1_000_000; let last = 1;
for (let i = 0; i < 120; i += 1) { last = A.tuluyenFatigue('f1', t0 + i * 10); ok(last === 1, `lần ${i + 1} chưa bị giảm`); }
for (let i = 120; i < 359; i += 1) last = A.tuluyenFatigue('f1', t0 + i * 10);
ok(last < 1 && last > 0.85, `giảm nhẹ ở lần 359: ${last}`);
for (let i = 359; i < 500; i += 1) last = A.tuluyenFatigue('f1', t0 + i * 3);
ok(Math.abs(last - 0.85) < 1e-9, `sàn −15%: ${last}`);
ok(A.tuluyenFatigue('f1', t0 + 100000) === 1, 'nghỉ đủ lâu → hết giảm');
ok(A.tuluyenFatigue('f2', t0) === 1, 'mỗi người đếm riêng');
// bấm đều đặn mỗi 30 giây (người chơi bình thường) không bao giờ bị giảm
let worst = 1; for (let i = 0; i < 400; i += 1) worst = Math.min(worst, A.tuluyenFatigue('f3', t0 + i * 30)); ok(worst === 1, 'bấm mỗi 30 giây không bị giảm');
// EXP đột phá giảm mạnh so với v14.x (0,90/0,65; v16.0: 0,40/0,25; v16.1: 0,20/0,12)
ok(K.EXP_GATE_MINOR_MULT <= 0.2 && K.EXP_GATE_MAJOR_MULT <= 0.12, 'hệ số mới');
const cut = (r, s) => R.tuViRequired(r, s, 0) / (R.tuViRequiredBase(r, s, 0) * K.EXP_REQUIRED_MULT);
for (const [r, s] of [[0, 0], [2, 4], [5, 9]]) console.log(`   cảnh giới ${r}-${s}: cần = ${R.tuViRequired(r, s, 0).toLocaleString('en')}  (gốc ×${K.EXP_REQUIRED_MULT})`);
ok(R.tuViRequired(0, 1, 0) > 0, 'vẫn dương');
console.log(`✅ test_fatigue_exp_v16 OK (${n} kiểm tra)`);
