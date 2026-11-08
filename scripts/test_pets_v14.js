'use strict';
// Kiểm thử Linh Thú v14.0. Chạy: node scripts/test_pets_v14.js [--sim]
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_pets_${Date.now()}.db`);
const assert = require('node:assert');
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const P = require('../src/game/pets'); const PB = require('../src/game/petBalance'); const PD = require('../src/game/petData'); const PC = require('../src/game/petCombat'); const Pv = require('../src/game/pvpCore');
const mk = (id, realm, lt = 1e9) => { Cu.createCultivator(id); D.run('UPDATE cultivators SET realm_index = ?, linh_thach = ?, nguyen_lieu = 500 WHERE user_id = ?', realm, lt, id); };

// ---- dữ liệu loài ----
assert.strictEqual(PD.ORDER.length, 45);
for (let t = 1; t <= 9; t += 1) assert.strictEqual(PD.BY_TIER[t - 1].length, 5, `phẩm ${t} phải đủ 5 loài`);
assert.strictEqual(new Set(PD.ORDER.map((i) => PD.SPECIES[i].name)).size, 45);
for (const id of PD.ORDER) {
  const s = PD.SPECIES[id];
  assert.ok(s.thienphu.fx && s.skills.a1 && s.skills.p1.fx && s.skills.a2 && s.bloodline && s.desc && s.emoji, id);
  const o = PD.evoOptions(id);
  if (s.tier < 9) { assert.strictEqual(o.length, 5, id); assert.strictEqual(PD.SPECIES[o[0].to].tier, s.tier + 1); assert.strictEqual(PD.SPECIES[o[0].to].hanh, s.hanh); assert.ok(o.slice(1).every((x) => PD.SPECIES[x.to].hanh === x.hanh && x.hanh !== s.hanh)); } else assert.strictEqual(o.length, 0);
}
// kỹ năng khác biệt thật sự: không có 2 loài trùng bộ (tên a1,a2 và fx bị động)
const sig = new Set(PD.ORDER.map((i) => { const s = PD.SPECIES[i]; return `${s.skills.a1.n}|${s.skills.a2.n}|${JSON.stringify(s.thienphu.fx)}`; })); assert.strictEqual(sig.size, 45);
for (const [t, id] of [[1, 'hoa_van_bao']]) assert.ok(PD.SPECIES[id]);

(async () => {
  // ---- chuyển đổi dữ liệu cũ ----
  mk(101, 3); D.run("UPDATE cultivators SET linh_thu = 'Hỏa Vân Báo', linh_thu_level = 7 WHERE user_id = 101");
  mk(102, 3); D.run("UPDATE cultivators SET linh_thu = 'Tiểu Bạch', linh_thu_level = 3 WHERE user_id = 102");
  mk(103, 3);
  assert.strictEqual(P.migrateAll(), 2); assert.strictEqual(P.migrateAll(), 0, 'idempotent');
  let pets = P.listPets(101); assert.strictEqual(pets.length, 1); assert.strictEqual(pets[0].species, 'hoa_van_bao'); assert.strictEqual(pets[0].level, 7); assert.strictEqual(pets[0].slot, 'dh1'); assert.strictEqual(pets[0].fighter, 1);
  pets = P.listPets(102); assert.strictEqual(pets[0].nick, 'Tiểu Bạch'); assert.strictEqual(pets[0].level, 3);
  assert.strictEqual(D.get('SELECT linh_thu FROM cultivators WHERE user_id = 101').linh_thu, 'Hỏa Vân Báo', 'giữ nguyên dữ liệu cũ');
  for (const [old, sp] of Object.entries(PB.LEGACY_MAP)) assert.ok(PD.SPECIES[sp], old);
  // không cộng chỉ số cho chủ
  const before = Cu.effectiveAtk(Cu.getCultivator(101)); P.feed(101, pets[0].pet_id, 'basic', 1); assert.strictEqual(before, Cu.effectiveAtk(Cu.getCultivator(101)));

  // ---- chống giả mạo / sở hữu ----
  const pid = P.listPets(101)[0].pet_id;
  assert.strictEqual(P.getPet(103, pid), null); assert.ok(!P.feed(103, pid, 'basic').ok); assert.ok(!P.setFighter(103, pid).ok); assert.ok(!P.release(103, pid).ok); assert.ok(!P.evolve(103, pid, 'main').ok);
  assert.ok(!P.signContract(103, pid, 'binh_dang').ok); assert.ok(!P.inheritBlood(103, pid, pid, 'a1').ok);

  // ---- Bí Cảnh: rơi trứng/thú hoang/vật phẩm ----
  mk(104, 6); let eggs = 0; let wild = 0; let itemsGot = 0;
  for (let i = 0; i < 3000; i += 1) { D.run('DELETE FROM pet_eggs WHERE owner = ?', '104'); D.run('DELETE FROM pet_wild WHERE owner = ?', '104'); const n = P.onBicanh(104, 4); if (/Trứng/.test(n)) eggs += 1; if (/hoang dã/.test(n)) wild += 1; if (/nhặt được/.test(n)) itemsGot += 1; }
  console.log(`   Bí Cảnh src=4 / 3000 lượt: trứng ${eggs} (${(eggs / 30).toFixed(1)}%), thú hoang ${wild} (${(wild / 30).toFixed(1)}%), vật phẩm ${itemsGot}`);
  assert.ok(eggs > 30 && wild > 30);
  // ---- thu phục ----
  D.run('DELETE FROM pet_wild WHERE owner = ?', '104'); D.run("INSERT INTO pet_wild (owner, species, level, purity, src, expires_at) VALUES ('104', 'bach_ngan_lang', 10, 40, 2, ?)", Date.now() / 1000 + 600);
  P.addItem(104, 'bat_phu', 50); let caught = null;
  for (let i = 0; i < 40 && !caught; i += 1) { if (!P.getWild(104)) D.run("INSERT INTO pet_wild (owner, species, level, purity, src, expires_at) VALUES ('104', 'bach_ngan_lang', 10, 40, 2, ?)", Date.now() / 1000 + 600); const r = P.capture(104, { phu: true }); if (r.petId) caught = r.petId; }
  assert.ok(caught, 'thu phục được'); assert.strictEqual(P.getPet(104, caught).slot, '');
  // ---- trứng nở ----
  D.run("DELETE FROM pet_eggs WHERE owner = '104'");   // vòng Bí Cảnh phía trên có thể để lại 1 trứng ngẫu nhiên → test từng chập chờn
  D.run("INSERT INTO pet_eggs (owner, species, tier, purity, hatch_at, source, created_at) VALUES ('104', 'thanh_diep_tho', 1, 30, ?, 't', 0)", Date.now() / 1000 + 9999);
  assert.strictEqual(P.hatchReady(104).length, 0); P.addItem(104, 'trung_nho', 1); const egg = P.listEggs(104)[0]; const rr = P.rushEgg(104, egg.egg_id); assert.ok(rr.ok, rr.msg);
  // ---- khế ước & ô ----
  const wolf = caught; D.run('UPDATE pets SET bond = 80 WHERE pet_id = ?', wolf);
  assert.ok(!P.signContract(104, wolf, 'ban_menh').ok, 'Bản Mệnh cần khế ước trước');
  P.addItem(104, 'khe_uoc_phu', 5); P.addItem(104, 'ban_menh_huyet', 2);
  let r = P.signContract(104, wolf, 'binh_dang'); assert.ok(r.ok, r.msg); assert.strictEqual(P.getPet(104, wolf).slot, 'dh1'); assert.strictEqual(P.getFighter(104).pet_id, wolf);
  const rabbit = P.listPets(104).find((p) => p.species === 'thanh_diep_tho').pet_id; D.run('UPDATE pets SET bond = 40 WHERE pet_id = ?', rabbit);
  r = P.signContract(104, rabbit, 'chu_to'); assert.ok(r.ok, r.msg); assert.strictEqual(P.getPet(104, rabbit).slot, 'dh2'); assert.ok(P.getPet(104, rabbit).bond <= 60);
  assert.ok(!P.signContract(104, caught, 'binh_dang').ok);
  r = P.signContract(104, wolf, 'ban_menh'); assert.ok(r.ok, r.msg); assert.strictEqual(P.getPet(104, wolf).slot, 'bm'); assert.strictEqual(P.slotsOf(104).dh1, null);
  r = P.setFighter(104, rabbit); assert.ok(r.ok); assert.strictEqual(P.getFighter(104).pet_id, rabbit); assert.strictEqual(D.get("SELECT COUNT(*) c FROM pets WHERE owner='104' AND fighter=1").c, 1);
  r = P.breakContract(104, rabbit); assert.ok(r.ok); assert.strictEqual(P.getFighter(104).pet_id, wolf);
  // ---- nuôi dưỡng & trần cấp ----
  P.addItem(104, 'linh_thu_dan', 30); r = P.feed(104, wolf, 'linh_thu_dan', 30); assert.ok(r.ok, r.msg); assert.ok(P.getPet(104, wolf).level > 10);
  const cap = PB.levelCap(6, 'ban_menh'); for (let i = 0; i < 5; i += 1) { P.addItem(104, 'than_thu_dan', 50); P.feed(104, wolf, 'than_thu_dan', 50); } assert.ok(P.getPet(104, wolf).level <= cap);
  // ---- huyết mạch & truyền thừa ----
  P.addItem(104, 'huyet_mach_tinh', 5); const pu = P.getPet(104, wolf).purity; r = P.refineBlood(104, wolf); assert.ok(r.ok, r.msg); assert.ok(P.getPet(104, wolf).purity > pu);
  const sac = P.grantPet(104, 'kim_dac_ung' in PD.SPECIES ? 'kim_dac_ung' : 'kim_duc_ung', { level: 5, purity: 80 });
  r = P.inheritBlood(104, wolf, sac, 'a2'); assert.ok(r.ok, r.msg); assert.strictEqual(P.getPet(104, sac), null); assert.strictEqual(P.getPet(104, wolf).gen, 1);
  // ---- kỹ năng ----
  P.addItem(104, 'ky_nang_gian', 3); r = P.upgradeSkill(104, wolf, 'a1'); assert.ok(r.ok, r.msg); assert.strictEqual(P.view(P.getPet(104, wolf)).skills[0].rank, 2);
  // ---- tiến hóa ----
  D.run('UPDATE pets SET level = 40, bond = 90, purity = 90 WHERE pet_id = ?', wolf);
  let evo = P.evoList(104, wolf); assert.strictEqual(evo.length, 5); assert.ok(!evo[0].all, 'thiếu vật phẩm');
  P.addItem(104, 'evo_t2', 10); P.addItem(104, 'ess_hoa', 10);
  r = P.evolve(104, wolf, 'main'); assert.ok(r.ok, r.msg); assert.strictEqual(P.getPet(104, wolf).species, 'kim_duc_ung'); assert.strictEqual(P.getPet(104, wolf).level, 40);
  D.run('UPDATE pets SET level = 60 WHERE pet_id = ?', wolf); P.addItem(104, 'evo_t3', 10);
  r = P.evolve(104, wolf, 'alt', 'Hỏa'); assert.ok(r.ok, r.msg); assert.strictEqual(PD.SPECIES[P.getPet(104, wolf).species].hanh, 'Hỏa'); assert.strictEqual(PD.SPECIES[P.getPet(104, wolf).species].tier, 4);
  // Chủ Tớ không được Dị Hóa
  const rb = rabbit; D.run("UPDATE pets SET level = 30, bond = 50, purity = 80, contract = 'chu_to' WHERE pet_id = ?", rb); assert.ok(!P.evolve(104, rb, 'alt', 'Kim').ok);
  // ---- thả thú ----
  const spare = P.grantPet(104, 'xich_diem_tuoc', { level: 12 }); r = P.release(104, spare); assert.ok(r.ok, r.msg); assert.strictEqual(P.getPet(104, spare), null);
  // ---- chợ ----
  r = P.buyItem(104, 'linh_thu_luong', 3); assert.ok(r.ok, r.msg); for (let i = 0; i < 3; i += 1) P.buyItem(104, 'ban_menh_huyet', 1); assert.ok(!P.buyItem(104, 'ban_menh_huyet', 1).ok, 'giới hạn ngày');
  assert.ok(!P.buyItem(104, 'khong_co', 1).ok);

  // ---- PvP: arena / kỹ năng / sát thương ----
  mk(201, 6); mk(202, 6);
  const petA = P.grantPet(201, 'thai_son_cu_hung', { level: 60, purity: 80, bond: 80, contract: 'ban_menh', slot: 'bm' }); D.run('UPDATE pets SET fighter = 1 WHERE pet_id = ?', petA);
  const run = (n, rowA, rowB) => { let w = 0; let used = 0; for (let i = 0; i < n; i += 1) { const ar = PC.buildArena(rowA, rowB); const hp = { A: 100, B: 100 }; const mA = PC.mergeMods({}, ar.A); const mB = PC.mergeMods({}, ar.B);
    for (let rd = 1; rd <= 5 && hp.A > 0 && hp.B > 0; rd += 1) for (const [ak, dk] of (Math.random() < 0.5 ? [['A', 'B'], ['B', 'A']] : [['B', 'A'], ['A', 'B']])) { if (hp.A <= 0 || hp.B <= 0) continue; Pv.roundAction(ak, dk, 1000, 1000, 10000, 10000, ['Đánh Thường'], '', hp, dk, null, false, false, { att: ak === 'A' ? mA : mB, def: ak === 'A' ? mB : mA, pet: { arena: ar } }); }
    if (hp.A > hp.B || (hp.A === hp.B && Math.random() < 0.5)) w += 1; used += ar.A.st.used.length + ar.B.st.used.length; } return { win: w / n, skills: used / n }; };
  const ra = Cu.getCultivator(201); const rbRow = Cu.getCultivator(202);
  const base = run(1500, rbRow, Cu.getCultivator(202)); console.log(`   Không thú vs không thú: ${(base.win * 100).toFixed(1)}%`);
  const withPet = run(1500, ra, rbRow); console.log(`   Thái Sơn Cự Hùng Lv60 BM vs không thú: ${(withPet.win * 100).toFixed(1)}%  (kỹ năng/trận ${withPet.skills.toFixed(2)})`);
  assert.ok(withPet.skills > 0, 'kỹ năng phải phát động'); assert.ok(withPet.win > 0.5);
  // Hộ Chủ chỉ 1 lần
  const ar = PC.buildArena(ra, rbRow); const hp = { A: 3, B: 100 }; const ln = []; PC.hurt(ar, 'A', 50, hp, ln); assert.strictEqual(hp.A, 3, 'Hộ Chủ giữ mạng'); assert.strictEqual(ar.A.st.lastStandUsed, true);
  const hp2 = { A: 50, B: 100 }; PC.hurt(ar, 'A', 80, hp2, []); assert.strictEqual(hp2.A, 0, 'Hộ Chủ chỉ 1 lần');
  console.log('✅ test_pets_v14 OK');
  if (process.argv.includes('--sim')) require('./sim_pets_v14.js');
  process.exit(0);
})().catch((e) => { console.error('❌', e); process.exit(1); });
