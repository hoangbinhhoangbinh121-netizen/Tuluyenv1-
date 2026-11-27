'use strict';
// Mô phỏng cân bằng Bí Cảnh Tiên Giới V19: người chơi "AI mẫu" đánh đủ 5 tầng; đo số lượt Boss cuối, tỉ lệ thắng, HP tiêu hao từng tầng.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_sim19_${Date.now()}.db`);
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const BC = require('../src/game/bicanh19'); const B = require('../src/data/bicanh19');
let uid = 9000;
const mk = (realm, stage = 0, books = []) => {
  uid += 1; Cu.createCultivator(uid);
  D.run('UPDATE cultivators SET realm_index = ?, stage_index = ?, world_tier = 2 WHERE user_id = ?', realm, stage, uid);
  return String(uid);
};
if (process.env.CFG) Object.assign(BC.CFG, JSON.parse(process.env.CFG));
if (process.env.AICFG) Object.assign(require('../src/game/combatAI').CFG, JSON.parse(process.env.AICFG));   // v22.4.2: núm cân bằng AI (xem combatAI.CFG)
if (process.env.NOAI) require('../src/game/settings').set('bcai', 'off');                                        // v22.4.2: so sánh với hành vi V22.4.1
const runOnce = (idx, N, opts = {}) => {
  const rows = []; for (let i = 0; i < N; i += 1) { const u = mk(B.BCS[idx].realm, opts.stage ?? 1); rows.push(Cu.getCultivator(u)); }
  const bc = B.BCS[idx]; const mem = rows.map((r) => BC.snapMember(r, r.user_id, `P${r.user_id}`, bc));
  if (opts.fakeBook) for (const m of mem) m.eq = [1041];
  // v19.9: PMUL_ATK / PMUL_HP = "người chơi thật mạnh gấp bao nhiêu lần nhân vật trần" (trang bị, công pháp, đế binh, thiên phú…). VD  PMUL_ATK=8 PMUL_HP=8 node scripts/sim_bicanh19.js 4 1 20
  // KIT=1: mô phỏng người chơi "có đồ" vừa phải (bạo kích 30%, +100% sát thương lên Boss, giảm sát thương 20%, hút máu 6%, né 15%, 2 công pháp).
  if (process.env.KIT) for (const m of mem) { m.crit = 0.30; m.critMult = 0.8; m.boss = Number(process.env.KIT_BOSS || 1.0); m.dr = 0.20; m.ls = 0.06; m.dodge = 0.15; m.eq = [1041, 1043]; }
  const pa = Number(process.env.PMUL_ATK || 1); const ph = Number(process.env.PMUL_HP || 1);
  for (const m of mem) { m.atk = Math.floor(m.atk * pa); m.maxHp = Math.floor(m.maxHp * ph); m.hp = m.maxHp; m.minHp = m.maxHp; }
  const st = BC.newState(idx, mem); const stat = { floors: [], boss: 0, turns: 0 };
  let guard = 0; let floorHp = []; let attacksOnFinal = 0;
  while (!st.over && guard++ < 4000) {
    const m = st.members[st.turn]; if (!m.alive) { st.turn = (st.turn + 1) % N; continue; }
    const wasFinal = st.enemy && st.enemy.kind === 'final';
    const a = BC.autoPick(st, m); const r = BC.step(st, m.uid, a);
    if (!r.ok) { const r2 = BC.step(st, m.uid, 'atk'); if (!r2.ok) { st.over = 'stuck'; break; } }
    if (wasFinal && !['guard', 'rest'].includes(a)) attacksOnFinal += 1;
    stat.turns += 1;
    if (st.pendingReward && !st.over) { floorHp.push(st.members.reduce((s, x) => s + x.hp / x.maxHp, 0) / N); st.pendingReward = 0; BC.nextFloor(st); }
  }
  if (st.over === 'won') floorHp.push(st.members.reduce((s, x) => s + x.hp / x.maxHp, 0) / N);
  return { won: st.over === 'won', turns: stat.turns, attacksOnFinal, floorHp, cleared: st.cleared };
};
const idxList = process.argv[2] ? process.argv[2].split(',').map(Number) : [0, 5, 9, 14, 18];
const N = Number(process.argv[3] || 1); const R = Number(process.argv[4] || 60);
for (const idx of idxList) {
  let w = 0; let at = 0; let ft = 0; const fh = [0, 0, 0, 0, 0]; const fc = [0, 0, 0, 0, 0]; let fa = 0;
  for (let k = 0; k < R; k += 1) { const o = runOnce(idx, N, { fakeBook: true }); if (o.won) { w += 1; at += o.turns; } fa += o.attacksOnFinal; o.floorHp.forEach((h, i) => { fh[i] += h; fc[i] += 1; }); ft += 1; }
  console.log(`bc${idx} ${B.BCS[idx].name} N=${N}: thắng ${(w / R * 100).toFixed(0)}% | lượt/thắng ${w ? (at / w).toFixed(0) : '-'} | đòn đánh Boss cuối TB ${(fa / R).toFixed(1)} | HP% còn sau tầng: ${fh.map((h, i) => (fc[i] ? (h / fc[i] * 100).toFixed(0) : '-')).join(' ')}`);
}
