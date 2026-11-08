'use strict';
// Mô phỏng cân bằng PvP có Linh Thú (đối thủ ngang nhau, không thú). node scripts/sim_pets_v14.js
if (!process.env.TULUYEN_DB_PATH) process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_sim_${Date.now()}.db`);
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const P = require('../src/game/pets'); const PB = require('../src/game/petBalance'); const PD = require('../src/game/petData'); const PC = require('../src/game/petCombat'); const Pv = require('../src/game/pvpCore');
let uid = 9000;
const mk = (realm) => { uid += 1; Cu.createCultivator(uid); D.run('UPDATE cultivators SET realm_index = ? WHERE user_id = ?', realm, uid); return uid; };
const withPet = (realm, sp, level, purity, bond, contract) => { const u = mk(realm); const id = P.grantPet(u, sp, { level, purity, bond, contract, slot: contract === 'ban_menh' ? 'bm' : 'dh1' }); D.run('UPDATE pets SET fighter = 1 WHERE pet_id = ?', id); return Cu.getCultivator(u); };
function duel(rowA, rowB, n) {
  let w = 0;
  for (let i = 0; i < n; i += 1) {
    const ar = PC.buildArena(rowA, rowB); const hp = { A: 100, B: 100 }; const mA = PC.mergeMods({}, ar.A); const mB = PC.mergeMods({}, ar.B);
    for (let rd = 1; rd <= 5 && hp.A > 0 && hp.B > 0; rd += 1) for (const [ak, dk] of (Math.random() < 0.5 ? [['A', 'B'], ['B', 'A']] : [['B', 'A'], ['A', 'B']])) {
      if (hp.A <= 0 || hp.B <= 0) continue;
      Pv.roundAction(ak, dk, 1000, 1000, 10000, 10000, ['Đánh Thường'], '', hp, dk, null, false, false, { att: ak === 'A' ? mA : mB, def: ak === 'A' ? mB : mA, pet: { arena: ar } });
    }
    if (hp.A > hp.B || (hp.A === hp.B && Math.random() < 0.5)) w += 1;
  }
  return w / n;
}
const N = Number(process.env.SIM_N || 800);
const cfgs = [
  ['Phàm Lv10 BĐ (cảnh giới 0)', 0, 'kim_nha_thu', 10, 40, 30, 'binh_dang'], ['Linh Lv25 BĐ (cg 1)', 1, 'bach_ngan_lang', 25, 50, 40, 'binh_dang'], ['Huyền Lv35 BĐ (cg 3)', 3, 'co_moc_loc', 35, 60, 50, 'binh_dang'],
  ['Địa Lv45 BM (cg 4)', 4, 'kim_cang_ngo_cong', 45, 70, 60, 'ban_menh'], ['Thiên Lv60 BM (cg 5)', 5, 'liet_diem_hoa_phuong', 60, 80, 70, 'ban_menh'], ['Thánh Lv70 BM (cg 6)', 6, 'chu_tuoc_thanh_thu', 70, 90, 80, 'ban_menh'],
  ['Tiên Lv85 BM (cg 8)', 8, 'kim_o_tien_thu', 85, 100, 90, 'ban_menh'], ['Thần Lv100 BM (cg 10)', 10, 'hau_tho_than_thu', 100, 100, 100, 'ban_menh'], ['Hỗn Độn Lv100 BM (cg 12)', 12, 'hon_don_thieu_the', 100, 100, 100, 'ban_menh'],
];
console.log('Linh Thú (xuất chiến) vs đối thủ ngang cảnh giới KHÔNG thú — tỉ lệ thắng của bên có thú:');
for (const [name, realm, sp, lv, pu, bo, ct] of cfgs) { const a = withPet(realm, sp, lv, pu, bo, ct); const b = Cu.getCultivator(mk(realm)); console.log(`  ${name.padEnd(30)} ${(duel(a, b, N) * 100).toFixed(1)}%`); }
console.log('\nTheo từng loài (phẩm 5, Lv60 BM, cg5) — kiểm tra không loài nào vượt trội/quá yếu:');
for (const id of PD.BY_TIER[4]) { const a = withPet(5, id, 60, 80, 70, 'ban_menh'); const b = Cu.getCultivator(mk(5)); console.log(`  ${PD.SPECIES[id].name.padEnd(26)} ${(duel(a, b, N) * 100).toFixed(1)}%`); }
console.log('\nThú vs thú (cùng phẩm 5/Lv60/BM, khác dòng) — ma trận thắng của hàng so với cột:');
const L = PD.BY_TIER[4]; const rows = L.map((id) => withPet(5, id, 60, 80, 70, 'ban_menh')); const rows2 = L.map((id) => withPet(5, id, 60, 80, 70, 'ban_menh'));
console.log('  ' + ' '.repeat(24) + L.map((id) => PD.SPECIES[id].hanh.padEnd(6)).join(''));
L.forEach((id, i) => console.log('  ' + PD.SPECIES[id].name.padEnd(24) + L.map((_, j) => ((duel(rows[i], rows2[j], N / 2) * 100).toFixed(0) + '%').padEnd(6)).join('')));
