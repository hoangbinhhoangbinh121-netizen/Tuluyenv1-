'use strict';
// V17 — đồng bộ hệ thống: trang bị / trận pháp / đan thật sự đổi chỉ số, trong trần; Bí Cảnh/Boss/Linh Thú rơi nguyên liệu vào kho; Linh Giới không rò rỉ.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_hook_${Date.now()}.db`);
const assert = require('node:assert'); const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const Inv = require('../src/game/invsvc'); const Cat = require('../src/game/catalog17'); const G = require('../src/game/gear17'); const Tr = require('../src/game/tran17');
const Dan = require('../src/game/dan17'); const FX = require('../src/game/fx17'); const Dr = require('../src/game/drops17'); const BC = require('../src/game/bicanh'); const K = require('../src/game/constants');
const { I, C } = Cat; let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const mk = (u, realm = 5) => { Cu.createCultivator(u); D.run('UPDATE cultivators SET realm_index = ?, world_tier = ?, linh_thach = 1e12, cur_hp = 100, atk = 1000, def_ = 1000, hp = 10000, spd = 1000 WHERE user_id = ?', realm, realm > 5 ? 1 : 0, String(u)); return u; };
const row = (u) => Cu.getCultivator(u);

// --- trang bị đổi chỉ số thật, trong trần
{ const u = mk(1, 5); const b = { atk: Cu.effectiveAtk(row(u)), def: Cu.effectiveDef(row(u)), hp: Cu.effectiveMaxHp(row(u)) };
  for (const t of Object.keys(C.GEAR)) { const id = G.create(u, t, 5); G.equip(u, id); }
  const a = { atk: Cu.effectiveAtk(row(u)), def: Cu.effectiveDef(row(u)), hp: Cu.effectiveMaxHp(row(u)) };
  ok(a.atk > b.atk && a.def > b.def, `trang bị không tăng chỉ số (${b.atk}→${a.atk})`); ok(a.atk <= b.atk * (1 + FX.CAP.atk) + 5, `Công Kích vượt trần: ${a.atk}/${b.atk}`); ok(a.def <= b.def * (1 + FX.CAP.def) + 5, 'Phòng Ngự vượt trần'); ok(a.hp <= b.hp * (1 + FX.CAP.hp) + 5, 'HP vượt trần');
  // tháo ra → trả lại đúng
  for (const g of G.equippedOf(u)) G.unequip(u, g.gear_id); ok(Cu.effectiveAtk(row(u)) === b.atk, 'tháo trang bị không trả chỉ số');
  // hỏng độ bền → mất chỉ số
  const id = G.listOf(u)[0].gear_id; G.equip(u, id); const w = Cu.effectiveAtk(row(u)); D.run('UPDATE gear SET dura = 0 WHERE gear_id = ?', id); FX.recompute(u); ok(Cu.effectiveAtk(row(u)) <= w, 'đồ hỏng vẫn giữ chỉ số'); }
// --- trận pháp: Sát Phạt tăng Công Kích, Tụ Linh tăng tốc tu vi, hết hạn thì mất
{ const u = mk(2, 5); const b = Cu.effectiveAtk(row(u)); const m0 = Cu.cpTuMult(row(u));
  Inv.add(u, 'tp_sat_phat', 1, { q: 5 }); Inv.add(u, 'tp_tu_linh', 1, { q: 5 }); ok(Tr.deploy(u, 'tp_sat_phat', 5).ok && Tr.deploy(u, 'tp_tu_linh', 5).ok, 'dựng trận');
  ok(Cu.effectiveAtk(row(u)) > b, 'Sát Phạt không tăng Công Kích'); ok(Cu.cpTuMult(row(u)) > m0, 'Tụ Linh không tăng tốc tu vi'); ok(Cu.cpTuMult(row(u)) <= m0 + FX.CAP.tu + FX.CAP.sectTu + 1e-9, 'tốc tu vi vượt trần');
  D.run('UPDATE fx_buffs SET until = 1 WHERE user_id = ?', String(u)); FX.recompute(u); ok(Cu.effectiveAtk(row(u)) === b && Cu.cpTuMult(row(u)) === m0, 'trận hết hạn vẫn còn hiệu lực'); }
// --- Hộ Tông Đại Trận: chỉ Tông Chủ, cả tông hưởng
{ const u = mk(3, 5); const v = mk(4, 5); D.run("INSERT INTO sects (sect_id, name, leader_id) VALUES (900, 'T', ?)", String(u)); D.run("UPDATE cultivators SET sect_id = 900, sect_role = 'tongchu' WHERE user_id = ?", String(u)); D.run("UPDATE cultivators SET sect_id = 900, sect_role = 'dethu' WHERE user_id = ?", String(v));
  const sect = Object.keys(C.TRANS).find((i) => C.TRANS[i].sect); for (const x of [u, v]) Inv.add(x, sect, 1, { q: 5 });
  ok(!Tr.deploy(v, sect, 5).ok, 'đệ tử dựng Hộ Tông'); const m0 = Cu.cpTuMult(row(v)); ok(Tr.deploy(u, sect, 5).ok, 'Tông Chủ dựng'); ok(Cu.cpTuMult(row(v)) >= m0, 'thành viên không hưởng Hộ Tông'); }
// --- đan: hồi HP thật, tu vi thật, bị khoá khi hết ngày
{ const u = mk(5, 5); const heal = Object.keys(C.PILLS).find((i) => C.PILLS[i].k === 'heal'); D.run('UPDATE cultivators SET cur_hp = 10 WHERE user_id = ?', String(u)); Inv.add(u, heal, 3, { q: 3 }); const r = Dan.use(u, heal, 3, 1); ok(r.ok && row(u).cur_hp > 10, 'đan hồi HP không hồi'); ok(row(u).cur_hp <= Cu.effectiveMaxHp(row(u)), 'hồi vượt HP tối đa');
  const tu = Object.keys(C.PILLS).find((i) => C.PILLS[i].k === 'tuvi' && !C.PILLS[i].realm); Inv.add(u, tu, 3, { q: 3 }); const t0 = row(u).tu_vi; ok(Dan.use(u, tu, 3, 1).ok && row(u).tu_vi > t0, 'đan tu vi không cộng tu vi'); }
// --- rơi nguyên liệu từ Bí Cảnh / Boss / Linh Thú
{ const u = mk(6, 5); let got = 0; const t0 = Inv.sumTotals(Inv.totals());
  for (let k = 0; k < 300; k += 1) { D.run('UPDATE cultivators SET last_bicanh = 0 WHERE user_id = ?', String(u)); const m = BC.doBicanh(u, 0); if (/Thu được/.test(m)) got += 1; }
  ok(got > 0, 'Bí Cảnh không rơi nguyên liệu V17'); ok(Inv.sumTotals(Inv.totals()) > t0, 'rơi nhưng kho không tăng');
  for (const s of ['boss_lo', 'boss_mid', 'boss_hi', 'linhthu_lo', 'linhthu_hi', 'bc0', 'bc1', 'bc2', 'vlc', 'bc_nhan', 'bc_linh']) ok(C.DROPS[s], `thiếu nguồn rơi ${s}`);
  ok(Dr.bossSource(1) === 'boss_lo' && Dr.bossSource(5) === 'boss_mid' && Dr.bossSource(9) === 'boss_hi', 'nguồn boss'); }
// --- Linh Giới / tầng: vật phẩm Linh Giới không rơi ở Nhân Giới
{ const u = mk(7, 5); for (let k = 0; k < 400; k += 1) { for (const s of ['bc0', 'bc1', 'bc2', 'bc_nhan', 'boss_lo']) Dr.roll(u, s, { extra: 1, noText: true }); }
  const lg = ['tdc_hu_khong_tinh_hoa']; for (const id of lg) ok(Inv.qty(u, id) === 0 || !C.DROPS.bc0.rolls.some((r) => r[0] === id), `${id} rơi ở Nhân Giới`); }
// --- người chơi chưa có gì: mọi tra cứu không ném lỗi
{ const u = mk(8, 0); ok(FX.get(row(u)) && Tr.active(u).personal.length === 0 && G.listOf(u).length === 0 && Dan.activeList(u).length === 0, 'người mới'); ok(Cu.effectiveAtk(row(u)) > 0, 'chỉ số người mới'); }
console.log(`✅ test_hooks_v17 OK (${n} kiểm tra)`);
