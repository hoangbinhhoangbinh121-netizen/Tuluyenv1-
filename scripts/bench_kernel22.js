'use strict';
// V22.0 — benchmark Combat Kernel: legacy vs kernel, theo tộc. Số liệu hiệu ứng/kỹ năng tộc là ĐỀ XUẤT chờ duyệt.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_bk22_${Date.now()}.db`); process.env.BOSS_ACTION_COOLDOWN = '0';
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const ST = require('../src/game/settings'); const RC = require('../src/game/race21'); const Inv = require('../src/game/invsvc');
const BC = require('../src/game/bicanh19'); const B = require('../src/data/bicanh19'); const BOSS = require('../src/game/boss'); const CD = require('../src/game/chungdao19');
const N = Number(process.env.N || 24); const RACES = [null, 'nhan', 'long', 'phuong', 'ma', 'linh', 'yeu']; let seq = 100000;
const mkBase = (race, sql) => { const u = String(seq++); Cu.createCultivator(u); D.run(`UPDATE cultivators SET linh_thach = 900000000000000, ${sql} WHERE user_id = ?`, u); if (race) { RC.choose(u, race); const r = RC.awaken(u); if (!r.ok) throw new Error(JSON.stringify(r)); } return u; };
const setK = (on) => { for (const s of ['boss', 'bicanh', 'chungdao', 'tongchien']) ST.set(`kernel_${s}`, on ? 'kernel' : 'legacy'); };
const pct = (a, b) => `${(100 * a / Math.max(1, b)).toFixed(0)}%`;

function benchBicanh(race, kernel) {
  setK(kernel); let win = 0; let turns = 0; let hpEnd = 0;
  for (let i = 0; i < N; i++) {
    const idx = 0; const bc = B.BCS[idx];
    const u = mkBase(race, `realm_index = ${bc.realm}, stage_index = 1, world_tier = 2, thiennhanngusuy_passed = 1, atk = 4000, def_ = 3000, hp = 90000, cur_hp = 90000`);
    const c = BC.createLobby(u, idx, { solo: true, name: 'X' }); if (!c.ok) continue; let g = 0;
    for (;;) { const L = BC.load(c.runId); const st = L.st; const m = st.members[0]; if (L.run.status !== 'active' || st.over) { if (st.over === 'won' || L.run.status === 'won') win += 1; turns += st.turns || 0; hpEnd += m.hp / m.maxHp; break; }
      if (++g > 4000) break; if (st.pendingReward || st.waitNext) { BC.next(c.runId, u); continue; }
      const r = BC.act(c.runId, u, BC.autoPick(st, m)); if (!r.ok) { const r2 = BC.act(c.runId, u, 'atk'); if (!r2.ok) { const nx = BC.next(c.runId, u); if (!nx.ok) break; } } }
  }
  return { win: pct(win, N), turns: (turns / N).toFixed(0), hp: pct(hpEnd, N) };
}
function benchBoss(race, kernel) {
  setK(kernel); const b = BOSS.summon({ guildId: `G${seq++}`, channelId: 'c', by: '1', capdo: 1, hp: 9e15 }); const gid = b.boss.guild_id; let dealt = 0; let taken = 0; let calls = 0;
  for (let i = 0; i < N; i++) {
    const u = mkBase(race, 'realm_index = 14, stage_index = 1, world_tier = 2, atk = 40000, def_ = 30000, hp = 900000, cur_hp = 900000, linh_luc = 100');
    for (let k = 0; k < 8; k++) { D.run('UPDATE cultivators SET cur_hp = hp, linh_luc = 100 WHERE user_id = ?', u); const hp0 = Cu.getCultivator(u).cur_hp; const r = BOSS.attack(gid, u, k % 3 === 2 ? 'skill' : 'atk'); if (r.ok) { dealt += r.dmg; taken += r.counter; calls += 1; } }
  }
  return { dmg: Math.round(dealt / calls), counter: Math.round(taken / calls) };
}
function benchChungdao(race, kernel) {
  setK(kernel); let win = 0; let hpEnd = 0; const NN = N * 12;
  const u = mkBase(race, 'realm_index = 18, stage_index = 3, world_tier = 2'); const row = Cu.getCultivator(u); const KN = require('../src/game/combatKernel');
  const atk = Cu.effectiveAtk(row); const def = Cu.effectiveDef(row); const hp = Cu.effectiveMaxHp(row) * 100000;
  const smart = (k) => { for (const a of ['bao', 'cp', 'sk', 'dok']) if (!CD.canResp(k, a)) { if (a === 'dok' && k.ll < 70) continue; return a; } return 'none'; };   // người chơi trung bình: có trang bị + 3 công pháp, không có đan
  for (let t = 0; t < NN; t++) {
    const k = { uid: u, step: 1, maxHp: hp, hp, ll: 100, shield: 0, atk, def, dr: 0.05, kiepRes: 0, eq: [1041, 1042, 1043], binh: null, hasGear: 1, danUsed: 3, cd: { dan: 0, bao: 0, cp: 0, sk: 0 }, surv: 0, log: [], last: [] };
    const KL = kernel ? KN.open('chungdao', row, { name: 'Thiên Lôi', ctrlImmune: true, me: 'Bạn' }, null) : null; let dead = false;
    while (k.step <= 12) { const a = smart(k); const o = CD.strike(k, a, KL); if (o.dead) { dead = true; break; } }
    if (!dead) win += 1; hpEnd += k.hp / k.maxHp;
  }
  return { win: pct(win, NN), hp: pct(hpEnd, NN) };
}
console.log(`## Bench Combat Kernel V22.0 (N=${N}/ô; mock + SQLite thật)\n`);
console.log('### Bí Cảnh #1 solo, người chơi đúng cảnh giới yêu cầu — thắng / lượt TB / HP còn lại cuối run (legacy → kernel)\n| Tộc | thắng | lượt | HP cuối |\n|---|---|---|---|');
for (const r of RACES) { const a = benchBicanh(r, false); const k = benchBicanh(r, true); console.log(`| ${r || 'không tộc'} | ${a.win} → ${k.win} | ${a.turns} → ${k.turns} | ${a.hp} → ${k.hp} |`); }
console.log('\n### Boss Thế Giới — sát thương TB/đòn · phản công TB/đòn (legacy → kernel)\n| Tộc | sát thương | phản công |\n|---|---|---|');
for (const r of RACES) { const a = benchBoss(r, false); const k = benchBoss(r, true); console.log(`| ${r || 'không tộc'} | ${a.dmg} → ${k.dmg} | ${a.counter} → ${k.counter} |`); }
console.log('\n### Chứng Đạo — tỉ lệ vượt kiếp / HP cuối (legacy → kernel), người chơi trung bình (có trang bị + 3 công pháp, không đan)\n| Tộc | vượt kiếp | HP cuối |\n|---|---|---|');
for (const r of RACES) { const a = benchChungdao(r, false); const k = benchChungdao(r, true); console.log(`| ${r || 'không tộc'} | ${a.win} → ${k.win} | ${a.hp} → ${k.hp} |`); }
setK(false); process.exit(0);
