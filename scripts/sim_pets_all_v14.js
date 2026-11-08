'use strict';
// Bảng sức mạnh 45 loài: mỗi loài ở cảnh giới vừa đủ phẩm cấp, cấp tối đa theo cảnh giới, huyết mạch 80, thân mật 80, Bản Mệnh Khế; đối thủ ngang cảnh giới KHÔNG thú.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_all_${Date.now()}.db`);
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const P = require('../src/game/pets'); const PB = require('../src/game/petBalance'); const PD = require('../src/game/petData'); const PC = require('../src/game/petCombat'); const Pv = require('../src/game/pvpCore');
let uid = 500; const mk = (r) => { uid += 1; Cu.createCultivator(uid); D.run('UPDATE cultivators SET realm_index = ? WHERE user_id = ?', r, uid); return uid; };
function duel(rowA, rowB, n) { let w = 0; for (let i = 0; i < n; i += 1) { const ar = PC.buildArena(rowA, rowB); const hp = { A: 100, B: 100 }; const mA = PC.mergeMods({}, ar.A); const mB = PC.mergeMods({}, ar.B);
  for (let rd = 1; rd <= 5 && hp.A > 0 && hp.B > 0; rd += 1) for (const [ak, dk] of (Math.random() < 0.5 ? [['A', 'B'], ['B', 'A']] : [['B', 'A'], ['A', 'B']])) { if (hp.A <= 0 || hp.B <= 0) continue;
    Pv.roundAction(ak, dk, 1000, 1000, 10000, 10000, ['x'], '', hp, dk, null, false, false, { att: ak === 'A' ? mA : mB, def: ak === 'A' ? mB : mA, pet: { arena: ar } }); }
  if (hp.A > hp.B || (hp.A === hp.B && Math.random() < 0.5)) w += 1; } return w / n; }
const N = Number(process.env.SIM_N || 600);
const res = {};
for (const id of PD.ORDER) { const sp = PD.SPECIES[id]; const realm = PB.tierReqRealm(sp.tier); const lv = Math.min(100, PB.levelCap(realm, 'ban_menh'));
  const u = mk(realm); const pid = P.grantPet(u, id, { level: lv, purity: 80, bond: 80, contract: 'ban_menh', slot: 'bm' }); D.run('UPDATE pets SET fighter = 1 WHERE pet_id = ?', pid);
  const w = duel(Cu.getCultivator(u), Cu.getCultivator(mk(realm)), N); (res[sp.tier] = res[sp.tier] || []).push([sp.name, sp.hanh, lv, w]); }
for (const t of Object.keys(res)) { const a = res[t]; const m = a.reduce((s, x) => s + x[3], 0) / a.length; console.log(`Phẩm ${t} (TB ${(m * 100).toFixed(0)}%):  ` + a.map((x) => `${x[1]} ${(x[3] * 100).toFixed(0)}%`).join('  ')); }
