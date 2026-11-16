'use strict';
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_simcd_${Date.now()}.db`);
const D = require('../src/db'); D.initDb(); const Cu = require('../src/game/cultivator'); const CD = require('../src/game/chungdao19'); const Inv = require('../src/game/invsvc');
Cu.createCultivator(1); D.run('UPDATE cultivators SET realm_index=18, stage_index=3, world_tier=2 WHERE user_id=1'); const row = Cu.getCultivator(1);
const atk = Cu.effectiveAtk(row), def = Cu.effectiveDef(row), hp = Cu.effectiveMaxHp(row) * 100000; console.log({ atk, def, hp, defPct: (100 * def / (atk + def + 1)).toFixed(1) });
const run = (policy, dan, gear, books, ll) => {
  Inv.add(1, 'dan_huyet_nguyen', 50, { q: 2, why: 's' }); let wins = 0; const N = 300;
  for (let t = 0; t < N; t++) {
    const k = { uid: '1', step: 1, maxHp: hp, hp, ll: 100, shield: 0, atk, def, dr: 0.05, kiepRes: 0, eq: books ? [1041, 1042, 1043] : [], binh: null, hasGear: gear, danUsed: 3 - dan, cd: { dan: 0, bao: 0, cp: 0, sk: 0 }, surv: 0, log: [], last: [] };
    let dead = false; globalThis.__minhp = globalThis.__minhp || []; while (k.step <= 12) { const a = policy(k); const bad = CD.canResp(k, a, row); const o = CD.strike(k, bad ? 'none' : a); if (o.dead) { dead = true; break; } }
    if (!dead) wins++; (globalThis.__f = globalThis.__f || []).push(k.hp / k.maxHp);
  }
  const f = globalThis.__f; globalThis.__f = []; return (wins / N * 100).toFixed(0) + '% hp cuối TB ' + (f.reduce((a, b) => a + b, 0) / f.length * 100).toFixed(0) + '%';
};
const smart = (k) => { if (k.hp / k.maxHp < 0.55 && !CD.canResp(k, 'dan')) return 'dan'; for (const a of ['bao', 'cp', 'sk', 'dok']) if (!CD.canResp(k, a)) { if (a === 'dok' && k.ll < 70) continue; return a; } return 'none'; };
console.log('không làm gì          ', run(() => 'none', 0, 0, 0));
console.log('3 đan + spam none     ', run((k) => (k.hp / k.maxHp < 0.5 && !CD.canResp(k, 'dan') ? 'dan' : 'none'), 3, 0, 0));
console.log('thông minh, 0 đan     ', run(smart, 0, 1, 1));
console.log('thông minh, 1 đan     ', run(smart, 1, 1, 1));
console.log('thông minh, 3 đan     ', run(smart, 3, 1, 1));
console.log('thông minh, 3 đan, ko đồ', run(smart, 3, 0, 0));
