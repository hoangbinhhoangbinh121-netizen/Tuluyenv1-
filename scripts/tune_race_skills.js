'use strict';
// Công cụ chỉnh cân bằng kỹ năng tộc: node scripts/tune_race_skills.js '<json ghi đè RACE_SKILLS>' [N] — in tỉ lệ thắng vòng tròn 6 tộc (Viên Mãn, đấu tự động).
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_tune_${process.pid}_${Date.now()}.db`);
const X = require('../src/data/effects21'); const over = JSON.parse(process.argv[2] || '{}'); const N = Number(process.argv[3] || 300);
for (const [k, v] of Object.entries(over)) { if (k === '_off') { for (const r of Object.keys(X.RACE_SKILLS)) X.RACE_SKILLS[r].unlockAwaken = 99; continue; } Object.assign(X.RACE_SKILLS[k], v); }
const D = require('../src/db'); D.initDb(); const Cu = require('../src/game/cultivator'); const C21 = require('../src/game/combat21'); const RC = require('../src/game/race21');
const names = ['nhan', 'long', 'phuong', 'ma', 'linh', 'yeu']; let id = 0;
const mk = (race) => { const u = `700000000000${String(++id).padStart(6, '0')}`; Cu.createCultivator(u); Cu.updateCultivator(u, { realm_index: 8, stage_index: 1, world_tier: 1, atk: 4000, def_: 3000, spd: 1000, hp: 50000, cur_hp: 50000, linh_thach: 1e11, last_pvp: 0 }); RC.choose(u, race); for (let i = 0; i < 3; i++) RC.awaken(u); return u; };
const us = Object.fromEntries(names.map((r) => [r, mk(r)]));
const w = Object.fromEntries(names.map((r) => [r, 0])); const t = Object.fromEntries(names.map((r) => [r, 0])); let rounds = 0, games = 0;
for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) for (let g = 0; g < N; g++) {
  const [A, B] = g % 2 ? [names[i], names[j]] : [names[j], names[i]];
  D.run('UPDATE cultivators SET last_pvp = 0 WHERE user_id IN (?, ?)', us[A], us[B]);
  const b = C21.createBattle(Cu.getCultivator(us[A]), Cu.getCultivator(us[B]), { now: 1000 }); const v = C21.simulate(b); rounds += b.round; games += 1;
  t[A] += 1; t[B] += 1; if (v.result === 'A') w[A] += 1; else if (v.result === 'B') w[B] += 1; else { w[A] += .5; w[B] += .5; }
}
console.log(names.map((r) => `${r} ${(100 * w[r] / t[r]).toFixed(1)}`).join(' · '), `| hiệp TB ${(rounds / games).toFixed(2)}`, process.argv[2] || '');
process.exit(0);
