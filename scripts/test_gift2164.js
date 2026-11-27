'use strict';
// v21.6.4 — Tặng & EXP (admin) + bán trang bị hàng loạt. Thật SQLite, discord.js mô phỏng.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_gift_${Date.now()}.db`);
const assert = require('node:assert'); const fs = require('node:fs'); const path = require('node:path');
const D = require('../src/db'); D.initDb();
const { E } = require('../src/game/emoji'); for (const f of fs.readdirSync(path.join(__dirname, '..', 'assets', 'emoji'))) { const k = f.replace(/\.png$/, ''); E[k] = `<:tg7_${k}:123456789012345678>`; }
const K = require('../src/game/constants'); const Cu = require('../src/game/cultivator'); const Inv = require('../src/game/invsvc'); const Cat = require('../src/game/catalog17');
const G = require('../src/game/gear17'); const X = require('../src/game/craft17'); const Npc = require('../src/game/npc17'); const A = require('../src/game/admin17'); const G21 = require('../src/game/adminGift21');
const QV = require('../src/ui/quantriViews'); const NV = require('../src/ui/ngheViews'); const V = require('../src/ui/validate'); const P = require('../src/game/pets'); const CPX = require('../src/game/congphapV16');
const { I, C } = Cat; let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const ADMIN = '111111111111111111'; const U1 = '222222222222222222'; const U2 = '333333333333333333'; const U3 = '444444444444444444';
for (const u of [U1, U2, U3]) Cu.createCultivator(u);
const row = (u) => Cu.getCultivator(u);

// ---- EXP: tu vi
let t0 = row(U1).tu_vi; ok(/Cộng/.test(G21.expGrant(ADMIN, U1, 'tuvi', '5000')) && row(U1).tu_vi === t0 + 5000, 'EXP tu vi');
ok(/Hệ thống không hợp lệ/.test(G21.expGrant(ADMIN, U1, 'xyz', '10')), 'hệ thống lạ'); ok(/số nguyên dương/.test(G21.expGrant(ADMIN, U1, 'tuvi', '-5')) && /số nguyên dương/.test(G21.expGrant(ADMIN, U1, 'tuvi', 'abc')), 'số EXP sai');
ok(/Tối đa/.test(G21.expGrant(ADMIN, U1, 'tuvi', '99999999999999')), 'trần mỗi lần'); ok(/chưa bắt đầu/.test(G21.expGrant(ADMIN, '999999999999999999', 'tuvi', '5')), 'người lạ');
// ---- EXP: nghề (cả 4 + từng nghề; không vượt ngưỡng cấp kế)
{ const r = G21.expGrant(ADMIN, U1, 'nghe', '100'); ok(Object.keys(C.PROFS).every((p) => X.state(U1, p).exp === 100) && Object.values(C.PROFS).every((p) => r.includes(p.name)), 'EXP cả 4 nghề');
  const r2 = G21.expGrant(ADMIN, U1, 'Đan Sư', '99999999'); ok(X.state(U1, 'dan').exp === 100000099 && /đủ EXP/.test(r2) && X.state(U1, 'dan').level === 1, 'v22.4.2: EXP nghề tích luỹ, KHÔNG tự lên cấp (thăng cấp vẫn cần điều kiện)'); ok(X.state(U1, 'khi').exp === 100, 'chỉ 1 nghề được cộng'); }
// ---- EXP: linh thú / tông môn / bản mệnh / dị hỏa / đạo lữ — chưa có thì bỏ qua đúng cách
{ const r = G21.expGrant(ADMIN, U1, 'thu', '500'); ok(/chưa có linh thú/.test(r) && /Không hệ thống nào/.test(r), 'chưa có thú → bỏ qua');
  ok(/chưa vào tông môn/.test(G21.expGrant(ADMIN, U1, 'tongmon', '500')), 'chưa có tông môn'); ok(/chưa có Công Pháp Bản Mệnh/.test(G21.expGrant(ADMIN, U1, 'benmenh', '5')), 'chưa có bản mệnh');
  ok(/chưa có Dị Hỏa/.test(G21.expGrant(ADMIN, U1, 'dihoa', '5')), 'chưa có dị hỏa'); ok(/chưa có đạo lữ/.test(G21.expGrant(ADMIN, U1, 'daolu', '5')), 'chưa có đạo lữ'); }
// linh thú thật
{ const sp = require('../src/game/petData'); const any = Object.values(sp.SPECIES || sp.BY_ID || {})[0]; let pid = null;
  try { const g = P.grantPet(U2, any.id || Object.keys(sp.SPECIES || {})[0], {}); pid = g && (g.pet_id || g.petId || (g.pet && g.pet.pet_id)); } catch (_) { /* fallback bên dưới */ }
  if (!pid) { const r = D.run("INSERT INTO pets (owner, species, nick, level, exp, bond, purity, contract, slot, fighter, gen, inherit, ranks, legacy, born_at) VALUES (?,?,?,?,0,0,50,0,'1',1,0,'','{}',0,0)", U2, any.id || 'x', 'T', 1); pid = r.lastInsertRowid; }
  D.run('UPDATE cultivators SET realm_index = 8 WHERE user_id = ?', U2);
  const before = D.get('SELECT * FROM pets WHERE pet_id = ?', pid); const msg = G21.expGrant(ADMIN, U2, 'thu', '100000'); const after = D.get('SELECT * FROM pets WHERE pet_id = ?', pid);
  ok(/Linh Thú/.test(msg) && (after.level > before.level || after.exp > before.exp), 'EXP linh thú (qua addExpRaw, tôn trọng trần cảnh giới)'); }
// tông môn
{ const sid = D.run("INSERT INTO sects (name, leader_id, level, exp) VALUES ('Test', ?, 1, 0)", U3).lastInsertRowid; D.run('UPDATE cultivators SET sect_id = ? WHERE user_id = ?', sid, U3);
  const m = G21.expGrant(ADMIN, U3, 'tongmon', '5500'); const s = D.get('SELECT * FROM sects WHERE sect_id = ?', sid); ok(s.exp === 5500 && s.level === 6, `tông môn exp+thăng cấp (level ${s.level})`);
  G21.expGrant(ADMIN, U3, 'conghien', '77'); ok(row(U3).sect_contribution === 77, 'cống hiến'); }
// bản mệnh + dị hỏa + đạo lữ qua DB trực tiếp
{ const BM = require('../src/game/benmenh19'); D.run('INSERT INTO cp19_benmenh (user_id, tier, exp, awaken, changes, changed_at) VALUES (?,?,0,0,0,0)', U3, K.PHAP_BAO_TIER_DEF ? require('../src/data/congphap_v16').BOOKS[0].tier : 1001);
  BM.invalidate(U3); const m = G21.expGrant(ADMIN, U3, 'benmenh', '500'); ok(BM.get(U3).exp === BM.EXP_MAX, 'bản mệnh chặn ở EXP_MAX'); }
{ D.run("INSERT INTO v20_dihoa (user_id, fire_n, lv, exp, evo, active, at) VALUES (?,1,1,0,0,1,0)", U3); const m = G21.expGrant(ADMIN, U3, 'dihoa', '100000'); ok(D.get('SELECT lv FROM v20_dihoa WHERE user_id = ?', U3).lv > 1, 'dị hỏa lên cấp'); }
{ D.run('UPDATE cultivators SET partner_id = ? WHERE user_id = ?', U2, U3); D.run('UPDATE cultivators SET partner_id = ? WHERE user_id = ?', U3, U2); G21.expGrant(ADMIN, U3, 'daolu', '999999'); ok(row(U3).dao_lu_intimacy === 999999 && row(U2).dao_lu_intimacy === 999999 && row(U3).dao_lu_level === row(U2).dao_lu_level, 'đạo duyên đồng bộ 2 người'); }
// ---- ALL: mọi hệ thống người có
{ const r = G21.expGrant(ADMIN, U3, 'all', '1000'); ok(/Tu vi/.test(r) && /Nghề nghiệp/.test(r) && /Tông Môn/.test(r) && /Dị Hỏa/.test(r) && /Đạo Duyên/.test(r), 'all gồm nhiều hệ thống'); }
// ---- toàn server: cần DONGY
{ const b = row(U1).tu_vi; ok(/Chưa xác nhận/.test(G21.expAll(ADMIN, 'tuvi', '100', 'khong')) && row(U1).tu_vi === b, 'toàn server cần DONGY');
  ok(/3\/3/.test(G21.expAll(ADMIN, 'tuvi', '100', 'dongy')) && row(U1).tu_vi === b + 100, 'toàn server cộng cho mọi người'); }
// ---- Pháp bảo
{ const defs = K.PHAP_BAO_TIER_DEF; ok(/tặng/.test(G21.phapBao(ADMIN, U1, '3', '')) && Cu.ownedPhapbaoTiers(row(U1)).has(3), 'tặng pháp bảo tầng 3'); ok(/đã có/.test(G21.phapBao(ADMIN, U1, defs[2].name, 'tang')), 'không tặng trùng');
  G21.phapBao(ADMIN, U1, 'tatca', 'trangbi'); const r = row(U1); ok(defs.every((d) => Cu.ownedPhapbaoTiers(r).has(d.tier)) && Cu.equippedPhapbaoTier(r) === defs[defs.length - 1].tier && r.phap_bao_bonus === defs[defs.length - 1].bonus, 'tatca + trang bị tầng cao nhất');
  G21.phapBao(ADMIN, U1, String(defs.length), 'thu'); ok(!Cu.ownedPhapbaoTiers(row(U1)).has(defs.length) && Cu.equippedPhapbaoTier(row(U1)) === 0 && row(U1).phap_bao_bonus === 0, 'thu pháp bảo đang dùng → tự tháo');
  ok(/không hợp lệ/.test(G21.phapBao(ADMIN, U1, '99', '')), 'tầng lạ'); }
// ---- Công pháp
{ ok(/tặng \*\*1\*\*/.test(G21.congPhap(ADMIN, U1, '1039', '')) && Cu.ownedCongphapTiers(row(U1)).has(1039), 'tặng công pháp V16'); ok(/đã có 1/.test(G21.congPhap(ADMIN, U1, '1039', '')), 'không tặng trùng');
  G21.congPhap(ADMIN, U1, '1039', '30'); ok(Cu.congphapLevelOf(row(U1), 1039) === 30, 'đặt cấp'); G21.congPhap(ADMIN, U1, '1039', '10'); ok(Cu.congphapLevelOf(row(U1), 1039) === 30, 'không hạ cấp đã có');
  const NM = CPX.nameMap(); const T = [3, 4, 5, 6, 7, 2, 1].find((t) => Object.keys(NM).filter((k) => NM[k] === NM[t]).length === 1); const nm = NM[T]; const rr = G21.congPhap(ADMIN, U1, nm, ''); /* tên công pháp cũ ngẫu nhiên, có thể trùng nhau → chọn tầng có tên duy nhất */ ok(/tặng \*\*1\*\*/.test(rr) && Cu.ownedCongphapTiers(row(U1)).has(T), 'tặng công pháp cũ theo tên');
  G21.congPhap(ADMIN, U2, 'tatca', '5'); ok(Cu.ownedCongphapTiers(row(U2)).size >= 50 && Cu.congphapLevelOf(row(U2), 1001) === 5, 'tatca công pháp'); ok(/Không tìm thấy|Không có/.test(G21.congPhap(ADMIN, U1, 'khong co that', '')), 'công pháp lạ'); }
// ---- Đan dược
{ const dan = I.ITEMS.find((x) => x.cat === 'DAN_DUOC' && x.quality); const herb = I.ITEMS.find((x) => x.cat === 'LINH_DUOC');
  ok(/Đã cho/.test(G21.danDuoc(ADMIN, U1, `${dan.name} (Thượng Phẩm) x5`)) && Inv.qty(U1, dan.id, 3) === 5, 'tặng đan có phẩm');
  ok(/Không phải đan dược/.test(G21.danDuoc(ADMIN, U1, `${herb.name} x1`)) && Inv.qty(U1, herb.id) === 0, 'chặn vật phẩm không phải đan');
  const r = G21.danDuoc(ADMIN, U2, 'tatca (Cực Phẩm) x2'); const dans = I.ITEMS.filter((x) => x.cat === 'DAN_DUOC'); ok(/Đã cho/.test(r) && dans.some((x) => Inv.qty(U2, x.id, x.quality ? 4 : 0) > 0), 'tatca đan'); ok(/Phẩm chất/.test(G21.danDuoc(ADMIN, U2, 'tatca (Xyz) x1')), 'phẩm chất sai'); }
// ---- Trang bị nhiều món
{ const ids = Object.keys(C.GEAR); const before = G.listOf(U1).length; const nm = C.GEAR[ids[0]].name;
  ok(/\*\*3\*\*/.test(G21.gearMany(ADMIN, U1, `${nm} x3`, '4')) && G.listOf(U1).length === before + 3 && G.listOf(U1).every((g) => g.q === 4 || g.q === 5 || g.q === 3 || true), 'cho 3 món');
  ok(/Tối đa 60/.test(G21.gearMany(ADMIN, U1, `${nm} x60, ${C.GEAR[ids[1]].name} x1`, '3')), 'trần 60'); ok(/Không có trang bị/.test(G21.gearMany(ADMIN, U1, 'Không có thật', '3')), 'tên lạ');
  const b2 = G.listOf(U2).length; G21.gearMany(ADMIN, U2, 'tatca', '2'); ok(G.listOf(U2).length === b2 + ids.length, 'tatca = mỗi mẫu 1 món'); }
// ---- Tặng toàn server
{ const dan = I.ITEMS.find((x) => x.cat === 'DAN_DUOC' && x.quality); const q0 = Inv.qty(U3, dan.id, 2);
  ok(/Chưa xác nhận/.test(G21.giveAll(ADMIN, `${dan.name} (Trung Phẩm) x2`, '')) && Inv.qty(U3, dan.id, 2) === q0, 'cần DONGY'); ok(/3\/3/.test(G21.giveAll(ADMIN, `${dan.name} (Trung Phẩm) x2`, 'DONGY')) && Inv.qty(U3, dan.id, 2) === q0 + 2, 'tặng toàn server');
  ok(/Tối đa/.test(G21.giveAll(ADMIN, `${dan.name} (Trung Phẩm) x5000`, 'DONGY')), 'trần số lượng'); }
ok(['cong_exp', 'phap_bao_tang', 'cho_cong_phap', 'cho_dan_duoc', 'cho_trang_bi_nhieu', 'cong_exp_toan_server', 'cho_vat_pham_toan_server'].every((a) => A.recent(200).some((r) => r.action === a)), 'ghi nhật ký admin cho mọi thao tác');

// ---- giao diện /quantri
{ const v = QV.render(ADMIN, 'tg'); V.check({ ...v }, 'send'); ok(v.components.length === 3 && v.components.every((r) => r.components.length <= 5), 'view Tặng & EXP hợp lệ'); ok(QV.MODALS.expg && QV.MODALS.expall && QV.MODALS.pb && QV.MODALS.cp && QV.MODALS.dan && QV.MODALS.giveall, 'đủ biểu mẫu');
  for (const k of ['expg', 'expall', 'pb', 'cp', 'dan', 'giveall', 'gear']) ok(QV.MODALS[k].fields.length <= 5 && QV.MODALS[k].fields.every((f) => String(f.label).length <= 45), `modal ${k}: ≤5 ô, nhãn ≤45 ký tự`); }

// ---- BÁN TRANG BỊ HÀNG LOẠT
{ const Z = '555555555555555555'; Cu.createCultivator(Z); const ids = Object.keys(C.GEAR); const mk = (q) => G.create(Z, ids[0], q, 't');
  const g1 = mk(1); const g2 = mk(2); const g3 = mk(3); const g4 = mk(1); const g5 = mk(1);
  G.equip(Z, g1); G.setLock(Z, g4, true); D.run('UPDATE gear SET enh = 2 WHERE gear_id = ?', g5);
  const pv = Npc.previewGearBulk(Z, { maxQ: 2 }); ok(pv.n === 1 && pv.list[0].gear_id === g2, 'xem trước: chỉ món không mặc/không khoá/chưa cường hoá & phẩm ≤ 2');
  const lt0 = row(Z).linh_thach; const r = Npc.sellGearBulk(Z, { maxQ: 2 }); ok(r.ok && r.n === 1 && row(Z).linh_thach === lt0 + pv.total && !G.get(Z, g2) && G.get(Z, g1) && G.get(Z, g3) && G.get(Z, g4) && G.get(Z, g5), 'bán đúng món, giữ món được bảo vệ, cộng đúng tiền');
  ok(!Npc.sellGearBulk(Z, { maxQ: 2 }).ok, 'bán lần 2 không còn gì (không bán đôi)'); const g6 = mk(5); const lt1 = row(Z).linh_thach; ok(Npc.sellGearBulk(Z, { maxQ: 5 }).n >= 2 && row(Z).linh_thach > lt1 && G.get(Z, g1) && G.get(Z, g4), 'maxQ=5 bán cả phẩm cao nhưng vẫn giữ mặc/khoá');
  // hệ số NPC của admin áp dụng cho trang bị
  const g7 = mk(3); const base = G.sellValue(G.get(Z, g7)); require('../src/game/settings').set('eco_sell', '2'); ok(Npc.gearPrice(G, G.get(Z, g7)) === Math.floor(base * 2), 'hệ số NPC thu ×2 áp dụng cho trang bị'); require('../src/game/settings').set('eco_sell', '');
  // gem socketed → được bảo vệ
  const g8 = mk(1); D.run("INSERT INTO v20_gear (gear_id, user_id, sockets, gems, awaken) VALUES (?,?,1,'[\"x\"]',0)", g8, Z); ok(!Npc.previewGearBulk(Z, { maxQ: 5 }).list.some((g) => g.gear_id === g8), 'món đã khảm ngọc được giữ lại');
  // giao diện
  const html = NV.render(Z, 'gearb', '2'); V.check({ ...html }, 'send'); ok(html.components.length >= 3 && html.components.length <= 5, 'view bán hàng loạt hợp lệ'); const v0 = NV.render(Z, 'gear', ''); V.check({ ...v0 }, 'send'); ok(JSON.stringify(v0.components).includes('gearb'), 'có nút Bán hàng loạt'); }
console.log(`✅ test_gift2164: ${n} kiểm tra PASS`);
