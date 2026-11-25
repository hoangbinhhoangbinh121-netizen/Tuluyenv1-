'use strict';
// V21.7 — benchmark "HP thật có giới hạn" (pvp_hp_mode=real) so với chuẩn hoá 100 (norm).
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_bhp217_${Date.now()}.db`);
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const ST = require('../src/game/settings'); const C21 = require('../src/game/combat21'); const RC = require('../src/game/race21');
const N = Number(process.argv[2] || 600); let id = 0;
const mk = (o = {}) => { const u = `700000000000${String(++id).padStart(6, '0')}`; Cu.createCultivator(u); Cu.updateCultivator(u, { realm_index: 8, stage_index: 1, world_tier: 1, atk: o.atk || 4000, def_: o.def || 3000, spd: o.spd || 1000, hp: o.hp || 50000, cur_hp: o.hp || 50000, linh_thach: 1e11, last_pvp: 0 }); if (o.race) { RC.choose(u, o.race); for (let i = 0; i < (o.aw || 0); i++) RC.awaken(u); } return u; };
const run = (a, b, n) => { const r = { A: 0, B: 0, draw: 0, rounds: 0 }; for (let i = 0; i < n; i++) { D.run('UPDATE cultivators SET last_pvp = 0 WHERE user_id IN (?, ?)', a, b); const t = C21.createBattle(Cu.getCultivator(a), Cu.getCultivator(b), { now: 1000 }); const v = C21.simulate(t); r[v.result] += 1; r.rounds += t.round; } r.rounds /= n; return r; };
const pct = (r, n) => (100 * (r.A + r.draw / 2) / n).toFixed(1);
const out = [];
const base = mk();
console.log('### 1) HP gốc gấp k lần (cùng công/thủ/tốc) — % thắng của bên nhiều HP hơn, ' + N + ' trận/ô\n| HP ×k | norm (cũ) | real (mới) | hiệp TB real |\n|---|---|---|---|');
for (const k of [1, 1.3, 2, 4, 10]) {
  const A = mk({ hp: 50000 * k }); const row = [];
  for (const m of ['norm', 'real']) { ST.set('pvp_hp_mode', m); row.push(run(A, base, N)); }
  console.log(`| ×${k} | ${pct(row[0], N)}% | ${pct(row[1], N)}% | ${row[1].rounds.toFixed(1)} |`);
}
ST.set('pvp_hp_mode', 'real');
console.log('\n### 2) Bên công +10% nhưng HP ×0.5 (real) — "kính đại bác" có bị bóp quá không?\n| | A thắng |\n|---|---|');
for (const m of ['norm', 'real']) { ST.set('pvp_hp_mode', m); const A = mk({ atk: 4400, hp: 25000 }); console.log(`| ${m} | ${pct(run(A, base, N), N)}% |`); }
ST.set('pvp_hp_mode', 'real');
console.log('\n### 3) Tộc (thức tỉnh Viên Mãn) vs người không tộc cùng chỉ số gốc\n| Tộc | norm | real | hiệp TB real |\n|---|---|---|---|');
for (const r of ['nhan', 'long', 'phuong', 'ma', 'linh', 'yeu']) {
  const U = mk({ race: r, aw: 3 }); const rows = [];
  for (const m of ['norm', 'real']) { ST.set('pvp_hp_mode', m); rows.push(run(U, base, Math.round(N / 2))); }
  console.log(`| ${r} | ${pct(rows[0], Math.round(N / 2))}% | ${pct(rows[1], Math.round(N / 2))}% | ${rows[1].rounds.toFixed(1)} |`);
}
console.log('\n### 4) Hai người ngang nhau (sanity) real\n'); ST.set('pvp_hp_mode', 'real'); const e = run(mk(), mk(), N); console.log(`A ${pct(e, N)}% · hòa ${(100 * e.draw / N).toFixed(1)}% · ${e.rounds.toFixed(1)} hiệp`);
process.exit(0);
