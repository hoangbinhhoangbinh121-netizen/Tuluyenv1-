'use strict';
// V21.6 — benchmark ảnh hưởng cân bằng: (1) F-1/F-2: chế độ cũ (log + Sát Chiêu không hồi) vs mới (hiệu ứng thật + hồi 3); (2) kỹ năng tộc: mỗi tộc vs 5 tộc còn lại (cùng chỉ số, cùng thức tỉnh).
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_bfx216_${Date.now()}.db`);
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const ST = require('../src/game/settings'); const C21 = require('../src/game/combat21'); const RC = require('../src/game/race21');
const N = Number(process.argv[2] || 600);
const names = ['nhan', 'long', 'phuong', 'ma', 'linh', 'yeu']; let id = 0;
const mk = (race, atk, aw) => { const u = `600000000000${String(++id).padStart(6, '0')}`; Cu.createCultivator(u); Cu.updateCultivator(u, { realm_index: 8, stage_index: 1, world_tier: 1, atk, def_: 3000, spd: 1000, hp: 50000, cur_hp: 50000, linh_thach: 1e11, last_pvp: 0 }); if (race) { RC.choose(u, race); for (let i = 0; i < aw; i++) RC.awaken(u); } return u; };
const run = (a, b, n) => { const r = { A: 0, B: 0, draw: 0, rounds: 0 }; for (let i = 0; i < n; i++) { D.run('UPDATE cultivators SET last_pvp = 0 WHERE user_id IN (?, ?)', a, b); const t = C21.createBattle(Cu.getCultivator(a), Cu.getCultivator(b), { now: 1000 }); const v = C21.simulate(t); r[v.result] += 1; r.rounds += t.round; } r.rounds /= n; return r; };
const pct = (x, n) => (100 * x / n).toFixed(1);
const out = [];
// (1) cùng chỉ số, không tộc: A vs B cân bằng ⇒ kiểm tra độ lệch + độ dài trận
const a = mk(null, 4000, 0), b = mk(null, 4000, 0), strong = mk(null, 4400, 0);
for (const [label, mode, kcd] of [['CŨ (log-only, Sát Chiêu không hồi)', 'log', 0], ['MỚI (hiệu ứng thật, Sát Chiêu hồi 3)', 'real', 3], ['Chỉ F-2 (log + hồi 3)', 'log', 3], ['Chỉ F-1 (hiệu ứng thật, không hồi)', 'real', 0]]) {
  ST.set('pvp_effects_mode', mode); ST.set('pvp_killmove_cd', kcd);
  const eq = run(a, b, N), st = run(strong, a, N);
  out.push(`| ${label} | A ${pct(eq.A, N)}% / B ${pct(eq.B, N)}% / hòa ${pct(eq.draw, N)}% · ${eq.rounds.toFixed(2)} hiệp | mạnh hơn +10% công thắng ${pct(st.A, N)}% (trận ${st.rounds.toFixed(2)} hiệp) |`);
}
console.log('### 1) F-1 / F-2 (người chơi không tộc, ' + N + ' trận / ô)\n| Chế độ | Hai bên ngang nhau | Bên mạnh hơn +10% công |\n|---|---|---|\n' + out.join('\n'));
ST.set('pvp_effects_mode', 'real'); ST.set('pvp_killmove_cd', 3);
// (2) tộc vs tộc: thức tỉnh 3 (Viên Mãn)
const us = Object.fromEntries(names.map((r) => [r, mk(r, 4000, 3)])); const none = mk(null, 4000, 0);
const M = {}; for (const x of names) { M[x] = {}; for (const y of names) if (x !== y) M[x][y] = run(us[x], us[y], Math.round(N / 2)); }
const rows = names.map((x) => { let w = 0, t = 0; for (const y of names) if (x !== y) { const r = M[x][y]; w += r.A + r.draw / 2; t += Math.round(N / 2); } return `| ${x} | ${pct(w, t)}% | ${names.filter((y) => y !== x).map((y) => `${y} ${pct(M[x][y].A + M[x][y].draw / 2, Math.round(N / 2))}`).join(' · ')} |`; });
console.log('\n### 2) Tộc vs tộc (thức tỉnh Viên Mãn, dùng kỹ năng tộc tự động 70% khi sẵn sàng)\n| Tộc | Thắng TB | Chi tiết (% thắng, hòa = ½) |\n|---|---|---|\n' + rows.join('\n'));
const vs = names.map((x) => { const r = run(us[x], none, Math.round(N / 2)); return `| ${x} | ${pct(r.A + r.draw / 2, Math.round(N / 2))}% | ${r.rounds.toFixed(2)} |`; });
console.log('\n### 3) Tộc (Viên Mãn) vs người không tộc cùng chỉ số gốc\n| Tộc | Thắng | Hiệp TB |\n|---|---|---|\n' + vs.join('\n'));
process.exit(0);
