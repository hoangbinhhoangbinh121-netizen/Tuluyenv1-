'use strict';
// Mô phỏng Đại Kiếp Chứng Đạo (12 đạo lôi). v22.4.3: nhiều cấu hình đồ + núm chỉnh CFG qua env (CDCFG='{"K":1.9}').
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_simcd_${Date.now()}.db`);
const D = require('../src/db'); D.initDb(); const Cu = require('../src/game/cultivator'); const CD = require('../src/game/chungdao19'); const Inv = require('../src/game/invsvc');
if (process.env.CDCFG) Object.assign(CD.CFG, JSON.parse(process.env.CDCFG));
Cu.createCultivator(1); D.run('UPDATE cultivators SET realm_index=18, stage_index=3, world_tier=2 WHERE user_id=1'); const row = Cu.getCultivator(1);
const atk = Cu.effectiveAtk(row), def = Cu.effectiveDef(row), hp = Cu.effectiveMaxHp(row) * 100000;
const N = Number(process.env.N || 400);
// profile: dr/kiepRes (giảm sát thương), books (số công pháp), gear, binh, surv, shield khởi đầu (% maxHp), defMul (phòng ngự so với công)
const PROF = {
  'tay không (0 đồ)':      { dr: 0.0, kr: 0.0, books: 0, gear: 0, shield: 0, defx: 1 },
  'trung bình (đồ+3 sách)': { dr: 0.05, kr: 0.05, books: 3, gear: 1, shield: 0, defx: 1 },
  'khá (đồ tốt)':         { dr: 0.15, kr: 0.15, books: 4, gear: 1, shield: 0.05, defx: 2 },
  'tối đa (bản mệnh+đế binh)': { dr: 0.30, kr: 0.40, books: 5, gear: 1, shield: 0.05, defx: 3, binh: 'chung', surv: 1 },
};
const run = (policy, dan, P) => {
  Inv.add(1, 'dan_huyet_nguyen', 80, { q: 2, why: 's' }); let wins = 0; const fin = []; const stepDie = Array(13).fill(0);
  for (let t = 0; t < N; t++) {
    const k = { uid: '1', step: 1, maxHp: hp, hp, ll: 100, shield: Math.floor(hp * P.shield), atk, def: def * P.defx, dr: P.dr, kiepRes: P.kr, eq: [1041, 1042, 1043, 1044, 1045].slice(0, P.books), binh: P.binh || null, hasGear: P.gear, danUsed: 3 - dan, cd: { dan: 0, bao: 0, cp: 0, sk: 0 }, surv: P.surv || 0, log: [] };
    let dead = false; while (k.step <= 12) { const a = policy(k); const bad = CD.canResp(k, a, row); const st = k.step; const o = CD.strike(k, bad ? 'none' : a); if (o.dead) { dead = true; stepDie[st]++; break; } }
    if (!dead) { wins++; fin.push(k.hp / k.maxHp); }
  }
  const mid = stepDie.map((n, i) => (n ? `${i}:${Math.round(n / N * 100)}%` : '')).filter(Boolean).join(' ');
  return `${String((wins / N * 100).toFixed(0)).padStart(3)}% thắng · hp cuối TB ${fin.length ? Math.round(fin.reduce((a, b) => a + b, 0) / fin.length * 100) : '-'}% · chết ở đạo: ${mid || '—'}`;
};
const smart = (k) => { if (k.hp / k.maxHp < 0.55 && !CD.canResp(k, 'dan')) return 'dan'; for (const a of ['bao', 'cp', 'sk', 'dok']) if (!CD.canResp(k, a)) { if (a === 'dok' && k.ll < 70) continue; return a; } return 'none'; };
console.log(JSON.stringify(CD.CFG), 'N=', N, 'defPct gốc', (100 * def / (atk + def + 1)).toFixed(0));
for (const [name, P] of Object.entries(PROF)) { console.log(`— ${name}`); console.log('   không ứng phó    ', run(() => 'none', 0, P)); console.log('   thông minh, 3 đan', run(smart, 3, P)); }
