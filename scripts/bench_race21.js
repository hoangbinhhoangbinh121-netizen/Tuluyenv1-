'use strict';
// V21.5 — BENCHMARK cân bằng chủng tộc bằng ĐÚNG engine PvP (combat21). Không phải test pass/fail cứng: in bảng tỉ lệ thắng; kiểm ngưỡng cân bằng ở test_race21.
// Dùng: node scripts/bench_race21.js [số trận mỗi cặp=300] [giai đoạn: none|mid|max=max]
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_bench_race_${Date.now()}.db`);
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const C21 = require('../src/game/combat21'); const RC = require('../src/game/race21'); const R = require('../src/data/race21');
const N = Number(process.argv[2] || 300); const STAGE = process.argv[3] || 'max';
const A = '2000000000000000001'; const B = '2000000000000000002';
for (const u of [A, B]) { Cu.createCultivator(u); Cu.updateCultivator(u, { realm_index: 8, stage_index: 1, world_tier: 1, atk: 4000, def_: 3000, spd: 1000, hp: 50000, cur_hp: 50000, linh_thach: 0 }); }
const preset = (uid, raceId, bl) => {
  D.run('DELETE FROM race_state WHERE user_id = ?', uid);
  if (!raceId) return;
  const max = STAGE === 'max'; const mid = STAGE === 'mid';
  D.run('INSERT INTO race_state (user_id, race_id, bloodline_id, bloodline_level, awakening_stage, evolved) VALUES (?,?,?,?,?,?)', uid, raceId, STAGE === 'none' ? '' : bl, max ? 5 : mid ? 3 : 0, max ? 3 : mid ? 2 : 0, max ? 1 : 0);
};
function duel(ra, rb, n) {
  let w = 0; let d = 0;
  for (let i = 0; i < n; i++) {
    const a = i % 2 === 0; // đổi phe để bù ưu thế bên A
    preset(A, a ? ra.r : rb.r, a ? ra.bl : rb.bl); preset(B, a ? rb.r : ra.r, a ? rb.bl : ra.bl);
    D.run('UPDATE cultivators SET last_pvp = 0 WHERE user_id IN (?, ?)', A, B);
    const b = C21.createBattle(Cu.getCultivator(A), Cu.getCultivator(B), { now: 1000 + i }); const v = C21.simulate(b);
    if (v.result === 'draw') d += 1; else if ((v.result === 'A') === a) w += 1;
  }
  return { win: w, draw: d, n };
}
const entries = [{ r: null, bl: '', label: 'không tộc' }];
for (const id of R.ORDER) for (const bl of Object.keys(R.RACES[id].bloodlines)) entries.push({ r: id, bl, label: `${id}/${bl}` });
const score = new Map(entries.map((e) => [e.label, { w: 0, d: 0, n: 0 }]));
for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
  const r = duel(entries[i], entries[j], N); const si = score.get(entries[i].label); const sj = score.get(entries[j].label);
  si.w += r.win; si.d += r.draw; si.n += r.n; sj.w += r.n - r.win - r.draw; sj.d += r.draw; sj.n += r.n;
}
console.log(`BENCH chủng tộc — giai đoạn=${STAGE}, ${N} trận/cặp`);
const rows = [...score.entries()].map(([k, s]) => ({ k, wr: (s.w + s.d / 2) / s.n })).sort((x, y) => y.wr - x.wr);
for (const r of rows) console.log(`${r.k.padEnd(22)} ${(r.wr * 100).toFixed(1)}%`);
const byRace = {}; for (const r of rows) { const id = r.k.split('/')[0]; (byRace[id] = byRace[id] || []).push(r.wr); }
console.log('--- theo tộc (TB 2 huyết mạch):'); for (const [id, a] of Object.entries(byRace)) console.log(id.padEnd(12), (a.reduce((x, y) => x + y, 0) / a.length * 100).toFixed(1) + '%');
