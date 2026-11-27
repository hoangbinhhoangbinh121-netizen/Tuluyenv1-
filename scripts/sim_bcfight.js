'use strict';
// V22.4.2 — Mô phỏng cân bằng Bí Cảnh Nhân/Linh Giới (trận chiến theo lượt trên lõi Tiên Giới). Người chơi "AI mẫu" (autoPick).
//   node scripts/sim_bcfight.js [số trận=60] [N người=1]    KIT=1: người chơi có đồ vừa phải (bạo kích, giảm sát thương, hút máu, 2 công pháp)
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_simbcf_${Date.now()}.db`);
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const BC = require('../src/game/bicanh19'); const BF = require('../src/game/bcFight'); const K = require('../src/game/constants'); const BI = require('../src/game/bicanh');
let uid = 7000;
const mk = (realm, stage, world) => { uid += 1; Cu.createCultivator(uid); D.run('UPDATE cultivators SET realm_index = ?, stage_index = ?, world_tier = ? WHERE user_id = ?', realm, stage, world, uid); return String(uid); };
const fight = (prof, realm, stage, world, N, kit) => {
  const mem = []; for (let i = 0; i < N; i += 1) { const u = mk(realm, stage, world); const m = BC.snapMember(Cu.getCultivator(u), u, `P${u}`, prof); m.eq = [1041];
    if (kit) { m.crit = 0.30; m.critMult = 0.8; m.boss = 1.0; m.dr = 0.20; m.ls = 0.06; m.dodge = 0.15; m.eq = [1041, 1043]; } mem.push(m); }
  const st = BC.newState(BF.virtIdx(prof.key), mem, prof); let g = 0; let turns = 0;
  while (!st.over && g++ < 3000) {
    const m = st.members[st.turn]; if (!m.alive) { st.turn = (st.turn + 1) % N; continue; }
    const a = BC.autoPick(st, m); let r = BC.step(st, m.uid, a); if (!r.ok) r = BC.step(st, m.uid, 'atk'); if (!r.ok) { st.over = 'stuck'; break; } turns += 1;
    if (st.pendingReward && !st.over) { st.pendingReward = 0; BC.nextFloor(st); }
  }
  return { won: st.over === 'won', turns, hp: st.members.reduce((s, x) => s + x.hp / x.maxHp, 0) / N };
};
const R = Number(process.argv[2] || 60); const N = Number(process.argv[3] || 1); const kit = !!process.env.KIT;
const cases = [];
K.BICANH_TIERS.forEach((t, i) => { cases.push([`Nhân ${t.name}`, BF.profStd(i, false), t.require_realm, 1, 0]); if (t.van_linh_coc) cases.push([`  ${t.name} + BOSS`, BF.profStd(i, true), t.require_realm, 1, 0]); });
cases.push(['ĐB Nhân Giới (Luyện Khí)', BF.profDacBiet('nhan_gioi'), 1, 1, 0], ['ĐB Nhân Giới (Hóa Thần)', BF.profDacBiet('nhan_gioi'), 5, 1, 0], ['ĐB Linh Giới (Luyện Hư)', BF.profDacBiet('linh_gioi'), 6, 1, 1], ['ĐB Linh Giới (Độ Kiếp)', BF.profDacBiet('linh_gioi'), 9, 1, 1]);
for (const en of BI.allLinhgioiSubtiers()) { const last = en.sub_idx === 2 && en.chain.boss_on_last; cases.push([`Linh ${en.sub_key}`, BF.profLinh(en.sub_key, false), en.chain.require_realm, en.sub_idx, 1]); if (last) cases.push([`  ${en.sub_key} + BOSS`, BF.profLinh(en.sub_key, true), en.chain.require_realm, en.sub_idx, 1]); }
for (const [name, prof, realm, stage, world] of cases) {
  let w = 0; let t = 0; let h = 0; for (let k = 0; k < R; k += 1) { const o = fight(prof, realm, stage, world, N, kit); if (o.won) { w += 1; t += o.turns; h += o.hp; } }
  console.log(`${name.padEnd(34)} thắng ${String(Math.round(w / R * 100)).padStart(3)}% | lượt/thắng ${w ? (t / w).toFixed(0).padStart(3) : '  -'} | HP còn TB ${w ? Math.round(h / w * 100) : '-'}%`);
}
