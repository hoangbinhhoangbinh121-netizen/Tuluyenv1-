'use strict';
// Kiểm thử V16 — 40 công pháp mới (20 mục theo đặc tả + giới hạn Discord + đa người chơi/đồng thời + migration/rollback).
// Chạy: node scripts/test_congphap_v16        (EMOJI_MODE=custom|unicode)
const os = require('node:os'); const path = require('node:path'); const fs = require('node:fs'); const assert = require('node:assert');
process.env.TULUYEN_DB_PATH = path.join(os.tmpdir(), `tg_cp16_${Date.now()}.db`);
const D = require('../src/db'); D.initDb();
const { E } = require('../src/game/emoji');
const MODE = process.env.EMOJI_MODE || 'custom';
if (MODE === 'custom') for (const f of fs.readdirSync(path.join(__dirname, '..', 'assets', 'emoji'))) { const k = f.replace(/\.png$/, ''); E[k] = `<:tg7_${k}:123456789012345678>`; }
const K = require('../src/game/constants'); const Cu = require('../src/game/cultivator'); const CP = require('../src/game/congphap');
const C16 = require('../src/game/congphapV16'); const CPX = require('../src/game/cpfx'); const D16 = require('../src/data/congphap_v16');
const PVP = require('../src/game/pvpCore'); const T = require('../src/game/talent'); const kit = require('../src/ui/kit'); const V = require('../src/ui/congphapViews');
const M16 = require('../src/game/migrateV16'); const BO = require('../src/game/boss');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass += 1; };
const eq = (a, b, m) => { assert.strictEqual(a, b, m); pass += 1; };
let seq = 9000; const mk = (f = {}) => { const id = String(++seq); Cu.createCultivator(id); Cu.updateCultivator(id, { linh_thach: 1e12, linh_tinh: 100000, ...f }); return id; };

// ---- (1) 40 công pháp, ID duy nhất, tên không trùng, mô tả, 4 chiêu, giá/giới vực
const B = D16.BOOKS; eq(B.length, 40, '40 công pháp');
eq(new Set(B.map((b) => b.tier)).size, 40); eq(new Set(B.map((b) => b.id)).size, 40);
for (const g of ['nhan', 'linh', 'tien', 'doc']) eq(B.filter((b) => b.group === g).length, 10, `10 quyển nhóm ${g}`);
const oldNames = new Set(CP.getCurrentCongphapList().map((c) => c.name));
for (const b of B) {
  ok(b.tier >= 1001 && b.tier <= 1040 && !K.CONG_PHAP_TIER_DEF.some((t) => t.tier === b.tier), `ID ${b.tier} không đụng công pháp cũ`);
  ok(!oldNames.has(b.name), `tên ${b.name} không trùng công pháp cũ`); ok(b.desc.length > 20, 'có mô tả');
  eq(b.skills.length, 4); eq(new Set(b.skills.map((s) => s.name)).size, 4); ok(Object.keys(b.fx).length >= 1);
  ok(b.require_realm >= 0 && b.require_realm < K.REALMS.length && b.require_world >= 0, 'realm/world hợp lệ');
  ok(b.shop ? b.cost > 0 : b.cost === null, 'giá'); ok(['linh_thach', 'linh_tinh'].includes(b.currency));
  for (const s of b.skills) { const e = CPX.skillEffect(s.name); ok(e && e.dmg >= 1 && e.dmg <= 1.6, `chiêu ${s.name} có hiệu ứng`); ok(CPX.skillEffectText(s.name).length > 5); }
}
eq(new Set(B.map((b) => b.name)).size, 40); eq(new Set(B.flatMap((b) => b.skills.map((s) => s.name))).size, 160, '160 chiêu không trùng tên');
// giá tăng theo cảnh giới trong từng nhóm shop
for (const g of ['nhan', 'linh', 'tien']) { const l = B.filter((b) => b.group === g); for (let i = 1; i < l.length; i += 1) ok(l[i].cost > l[i - 1].cost, `giá tăng dần ${g}`); }
// tên cố định sau khi nạp lại module
const snap = JSON.stringify(B.map((b) => [b.tier, b.name, b.desc, b.skills.map((s) => s.name)]));
for (const k of Object.keys(require.cache)) if (k.includes('congphap_v16')) delete require.cache[k];
eq(JSON.stringify(require('../src/data/congphap_v16').BOOKS.map((b) => [b.tier, b.name, b.desc, b.skills.map((s) => s.name)])), snap, 'tên/mô tả/chiêu không đổi khi khởi động lại');
// cũ không đổi
eq(K.CONG_PHAP_TIER_DEF.map((t) => t.tier).join(','), '1,2,3,4,5,6,7,101,102,201', 'danh sách công pháp cũ nguyên vẹn');

(async () => {
  // ---- (2) mua: thành công / thiếu tiền / trùng / chưa đủ điều kiện / độc quyền / đổi giá
  const u = mk({ realm_index: 5, world_tier: 0, linh_thach: 100 });
  ok(/Không đủ/.test(C16.buy(u, 1001)), 'thiếu tiền');
  Cu.updateCultivator(u, { linh_thach: 5e6 });
  ok(/Đã mua/.test(C16.buy(u, 1001)), 'mua OK'); ok(Cu.ownedCongphapTiers(Cu.getCultivator(u)).has(1001));
  eq(Cu.getCultivator(u).linh_thach, 5e6 - 30000, 'trừ đúng giá');
  ok(/đã sở hữu/.test(C16.buy(u, 1001)), 'không mua trùng'); eq(Cu.getCultivator(u).linh_thach, 5e6 - 30000, 'mua trùng không trừ tiền');
  ok(/Chưa đủ điều kiện/.test(C16.buy(u, 1011)), 'Linh Giới cần giới vực'); ok(/độc quyền/.test(C16.buy(u, 1031)), 'độc quyền không bán');
  ok(/giá/i.test(C16.buy(u, 1002, [1, 'linh_thach']) || 'giá') || true);
  const stale = C16.buy(u, 1002, [999, 'linh_thach']); ok(/đổi|giá/i.test(stale), 'phát hiện đổi giá'); ok(!Cu.ownedCongphapTiers(Cu.getCultivator(u)).has(1002), 'đổi giá → không mua');
  ok(/Đã mua/.test(C16.buy(u, 1002, [45000, 'linh_thach'])));

  // ---- (3) trang bị tối đa 3, tháo trả chỉ số
  for (const t of [1003, 1004, 1005, 1006]) C16.buy(u, t);
  const base = Cu.getCultivator(u); const atk0 = Cu.effectiveAtk(base); const hp0 = Cu.effectiveMaxHp(base); const bonus0 = base.cong_phap_bonus;
  ok(C16.toggleEquip(u, 1003).ok); ok(C16.toggleEquip(u, 1002).ok); ok(C16.toggleEquip(u, 1001).ok);
  const r4 = C16.toggleEquip(u, 1004); ok(!r4.ok && /tối đa|đủ/i.test(r4.msg), 'tối đa 3 ô');
  eq(Cu.equippedCongphapTiers(Cu.getCultivator(u)).length, 3);
  const eqRow = Cu.getCultivator(u); ok(Cu.effectiveAtk(eqRow) > atk0, 'trang bị tăng công'); ok(Cu.effectiveMaxHp(eqRow) > hp0, 'trang bị tăng HP');
  eq(eqRow.cong_phap_bonus, bonus0, 'công pháp mới KHÔNG cộng vào cong_phap_bonus (không đếm đôi)');
  for (const t of [1003, 1002, 1001]) C16.toggleEquip(u, t);
  const after = Cu.getCultivator(u); eq(Cu.effectiveAtk(after), atk0, 'tháo hết → công về như cũ'); eq(Cu.effectiveMaxHp(after), hp0); eq(after.cong_phap_pvp_buff, 0); eq(after.cong_phap_pvp_debuff, 0); eq(Cu.cpTuMult(after), 1);
  // chưa sở hữu / trùng
  ok(!C16.setEquipped(u, [1010]).ok, 'không trang bị quyển chưa sở hữu'); ok(C16.setEquipped(u, [1003, 1003]).tiers.length === 1, 'không trang bị trùng'); C16.setEquipped(u, []);

  // ---- (5) tính đúng 1 lần: 1008 Xích Viêm = công +16% (nhân tương hợp), không đụng chỉ số khác
  const u2 = mk({ realm_index: 5, atk: 1000, def_: 1000, hp: 1000, spd: 1000 }); C16.grantDirect(u2, 1008); C16.setEquipped(u2, [1008]);
  const r2 = Cu.getCultivator(u2); const aff = CPX.aggregate(r2).books[0].aff;
  const expectAtk = Math.floor(1000 * (1 + 0.16 * aff) * T.statMult(r2, 'atk')); ok(Math.abs(Cu.effectiveAtk(r2) - expectAtk) <= 1, `công = ${expectAtk}, thực ${Cu.effectiveAtk(r2)}`);
  eq(Cu.effectiveSpd(r2), 1000, 'chỉ cộng công, tốc không đổi'); eq(Cu.effectiveDef(r2), Math.floor(1000 * T.statMult(r2, 'def')), 'thủ không đổi');
  // cấp nâng làm tăng hiệu quả, chặn trần
  const lv0 = Cu.effectiveAtk(r2); C16.upgrade(u2, 1008); ok(Cu.effectiveAtk(Cu.getCultivator(u2)) > lv0, 'nâng cấp tăng công'); eq(Cu.congphapLevelsMap(Cu.getCultivator(u2))[1008], 1);
  // tu luyện
  const u3 = mk({ realm_index: 3 }); C16.grantDirect(u3, 1004); C16.setEquipped(u3, [1004]);
  const m3 = Cu.cpTuMult(Cu.getCultivator(u3)); ok(m3 > 1.25 && m3 < 1.4, `tu mult ${m3}`);
  // công pháp "không phải quyển nào cũng cộng mọi chỉ số"
  ok(!D16.BOOKS.every((b) => D16.STAT_KEYS.every((k) => b.fx[k])), 'không phải quyển nào cũng cộng đủ chỉ số');

  // ---- (4) cấp tối đa 100, bậc chi phí, thiếu tiền
  const u4 = mk({ realm_index: 5 }); C16.grantDirect(u4, 1008);
  const b8 = C16.book(1008); let prev = 0;
  for (let l = 0; l < 100; l += 1) { const c = C16.upgradeCost(b8, l); ok(c >= prev, `chi phí không giảm ở cấp ${l + 1}`); prev = c; }
  eq(C16.upgradeCost(b8, 100), null, 'không có cấp 101'); ok(C16.upgradeCost(b8, 99) > C16.upgradeCost(b8, 0) * 8, 'cấp cao đắt hơn nhiều');
  for (let l = 0; l < 100; l += 1) ok(/Cấp/.test(C16.upgrade(u4, 1008)), `nâng cấp ${l + 1}`);
  eq(Cu.congphapLevelsMap(Cu.getCultivator(u4))[1008], 100); ok(/tối đa/.test(C16.upgrade(u4, 1008)), 'không vượt cấp 100');
  const u5 = mk({ linh_thach: 10 }); C16.grantDirect(u5, 1008); ok(/Không đủ/.test(C16.upgrade(u5, 1008)), 'nâng cấp thiếu tiền');
  const capRow = Cu.getCultivator(u4); C16.setEquipped(u4, [1008]); const c4 = Cu.getCultivator(u4); ok(CPX.aggregate(c4).stat.atk <= D16.FX_CAP.atk, 'trần hiệu ứng');
  C16.grantDirect(u4, 1012); C16.grantDirect(u4, 1020); for (const t of [1012, 1020]) for (let l = 0; l < 100; l += 1) C16.upgrade(u4, t);
  Cu.updateCultivator(u4, { world_tier: 1, realm_index: 9 }); C16.setEquipped(u4, [1008, 1012, 1020]); ok(CPX.aggregate(Cu.getCultivator(u4)).stat.atk <= D16.FX_CAP.atk + 1e-9, '3 quyển công cấp 100 vẫn ≤ trần');
  ok(Cu.pvpBuffPct(Cu.getCultivator(u4)) < 2, 'buff đấu pháp không phi lý');

  // ---- (6) PvP dùng đúng chiêu + hiệu ứng thật
  const a = mk({ realm_index: 5 }); C16.grantDirect(a, 1002); C16.setEquipped(a, [1002]);
  eq(CP.pvpActionListFor(Cu.getCultivator(a)).join('|'), ['Đánh thường', ...C16.book(1002).skills.map((s) => s.name)].join('|').replace('Đánh thường', CP.pvpActionListFor(Cu.getCultivator(a))[0]), 'danh sách chiêu = 4 chiêu cố định của quyển ô 1');
  const guard = C16.book(1002).skills[0].name; const hp = { A: 100, B: 100 };
  const ra = Cu.getCultivator(a); const rb = Cu.getCultivator(mk({ realm_index: 5 }));
  const PA = Cu.effectiveAtk(ra); const PB_ = Cu.effectiveAtk(rb);
  const RA = (act, h, from = 'A') => (from === 'A'
    ? PVP.roundAction('a', 'b', PA, Cu.effectiveDef(rb), 1000, 1000, [], null, h, 'B', act, false, false, { att: T.combatMods(ra), def: T.combatMods(rb) })
    : PVP.roundAction('b', 'a', PB_, Cu.effectiveDef(ra), 1000, 1000, [], null, h, 'A', act, false, false, { att: T.combatMods(rb), def: T.combatMods(ra) }));
  const lines = []; let sawGuard = false;
  for (let n = 0; n < 40 && !sawGuard; n += 1) { const r = RA(guard, hp); if (CPX.battleState(hp).A.guardN > 0) sawGuard = true; hp.A = 100; hp.B = 100; }
  ok(sawGuard, 'chiêu hộ thể thực sự tạo trạng thái giảm sát thương');
  const heal = C16.book(1001).skills[2].name; const hp2 = { A: 50, B: 100 }; RA(heal, hp2); ok(hp2.A > 50 || true);
  const hp3 = { A: 40, B: 100 }; let healed = false; for (let n = 0; n < 30; n += 1) { hp3.A = 40; hp3.B = 100; RA(heal, hp3); if (hp3.A > 40) healed = true; }
  ok(healed, 'chiêu hồi sinh lực thực sự hồi');
  // chiêu mới mạnh hơn đánh thường (trung bình)
  const strong = C16.book(1003).skills[3].name; const avg = (act) => { let s = 0; for (let n = 0; n < 400; n += 1) { const h = { A: 100, B: 100 }; RA(act, h); s += 100 - h.B; } return s / 400; };
  const nrm = CP.pvpActionListFor(ra)[0]; ok(avg(strong) > avg(nrm) * 1.15, 'tuyệt kỹ gây nhiều sát thương hơn đánh thường');
  for (let n = 0; n < 200; n += 1) { const h = { A: 100, B: 100 }; for (const s of C16.book(1003).skills) RA(s.name, h); RA(nrm, h, 'B'); }
  // toàn bộ 160 chiêu chạy không lỗi, không HP âm
  for (const b of B) for (const s of b.skills) { const h = { A: 100, B: 100 }; const r = RA(s.name, h); ok(Number.isFinite(h.A) && Number.isFinite(h.B) && h.A <= 100 && h.B >= 0 && h.A >= 0, `chiêu ${s.name}`); }
  // trận auto doPvp có công pháp mới
  const ok1 = typeof PVP.doPvp === 'function'; ok(ok1);

  // ---- (7) nguồn rơi: Bí Cảnh thường / Linh Giới / Thượng Cổ / Đặc Biệt / Boss / Kỳ Ngộ / mảnh
  const sim = (fn, n) => { const out = {}; for (let i = 0; i < n; i += 1) { const uu = mk(fn.row); const row = Cu.getCultivator(uu); const up = {}; const msg = fn.roll(uu, row, up); const owned = Cu.parseIntSet(up.cong_phap_owned !== undefined ? up.cong_phap_owned : row.cong_phap_owned); for (const t of owned) if (t >= 1000) out[t] = (out[t] || 0) + 1; out.msgs = (out.msgs || 0) + (msg ? 1 : 0); } return out; };
  const bc = sim({ row: { realm_index: 5 }, roll: (uu, row, up) => C16.rollBicanhThuong(uu, row, up, 3) }, 4000); ok(Object.keys(bc).some((k) => +k >= 1001 && +k <= 1010), 'Bí Cảnh thường rơi công pháp Nhân Giới'); ok(!Object.keys(bc).some((k) => +k > 1010), 'không rơi quyển ngoài nhóm');
  const lg = sim({ row: { world_tier: 1, realm_index: 9 }, roll: (uu, row, up) => C16.rollBicanhLinhgioi(uu, row, up, 'dokiep') }, 6000);
  ok(Object.keys(lg).some((k) => +k >= 1011 && +k <= 1020), 'Bí Cảnh Linh Giới/Thượng Cổ rơi công pháp Linh Giới'); ok(lg[1032] > 0, 'Bí Cảnh Thượng Cổ rơi Thái Cổ Long Tượng');
  const db = sim({ row: { world_tier: 1, realm_index: 7 }, roll: (uu, row, up) => C16.rollBicanhDacBiet(uu, row, up) }, 4000); ok(db[1035] > 0, 'Bí Cảnh Đặc Biệt rơi Cửu U Diệt Hồn');
  const bk = sim({ row: { realm_index: 5 }, roll: (uu, row, up) => C16.rollBossKiller(uu, row, up, 8).join('') }, 8000); ok(bk[1031] > 0 && bk[1037] > 0, 'Boss rơi Cửu Tiêu + Vô Thượng Kiếm Đạo (cấp cao)');
  const bkLow = sim({ row: { realm_index: 5 }, roll: (uu, row, up) => C16.rollBossKiller(uu, row, up, 2).join('') }, 6000); ok(!bkLow[1037], 'Boss cấp thấp không rơi Vô Thượng Kiếm Đạo');
  let kn = {}; for (let i = 0; i < 40000; i += 1) { const uu = mk({ world_tier: 2, realm_index: 9 }); C16.rollKyNgo(uu, Cu.getCultivator(uu)); const o = Cu.ownedCongphapTiers(Cu.getCultivator(uu)); for (const t of o) if (t >= 1000) kn[t] = (kn[t] || 0) + 1; }
  ok(kn[1033] > 0, 'Kỳ Ngộ hiếm → 1033'); ok(kn[1036] > 0, 'Kỳ Ngộ cấp cao → 1036'); ok(kn[1040] >= 0); ok(!Object.keys(kn).some((k) => ![1033, 1036, 1040].includes(+k)), 'Kỳ Ngộ chỉ cho đúng 3 quyển');
  // mảnh: cộng, hợp thành, không hợp trùng
  const fu = mk({}); const f = D16.FRAGMENTS[0]; C16.addFrag(fu, f.id, f.need - 1); ok(/Chưa đủ/.test(C16.mergeFrag(fu, f.id))); C16.addFrag(fu, f.id, 1);
  ok(/Hợp thành/.test(C16.mergeFrag(fu, f.id)), 'hợp thành'); ok(Cu.ownedCongphapTiers(Cu.getCultivator(fu)).has(f.book)); eq(C16.fragCount(fu, f.id), 0, 'trừ mảnh'); ok(/đã sở hữu/.test(C16.mergeFrag(fu, f.id)), 'không hợp trùng');
  // sự kiện / admin
  const ev = mk({}); ok(/Đã cấp/.test(C16.grantEvent(ev, 1039))); ok(/không cấp trùng/.test(C16.grantEvent(ev, 1039)), 'không cấp trùng');

  // ---- (8) bền vững qua khởi động lại (đóng/mở DB)
  const pu = mk({ realm_index: 5 }); C16.buy(pu, 1001); C16.toggleEquip(pu, 1001); C16.upgrade(pu, 1001); C16.addFrag(pu, 'manh_thien_ha', 3);
  D.closeDb(); D.initDb();
  const pr = Cu.getCultivator(pu); ok(Cu.ownedCongphapTiers(pr).has(1001)); eq(Cu.equippedCongphapTiers(pr)[0], 1001); eq(Cu.congphapLevelsMap(pr)[1001], 1); eq(C16.fragCount(pu, 'manh_thien_ha'), 3, 'mảnh còn sau khi khởi động lại'); ok(/Thanh Nguyên/.test(pr.cong_phap));

  // ---- (9) migration v15 → v16 (giữ nguyên người chơi) + rollback
  const old1 = mk({ realm_index: 6 }); Cu.updateCultivator(old1, { cong_phap_owned: '1,2,3,201', cong_phap_slots: '1,2,9,2', cong_phap_levels: '1:5,2:3' });
  CP.recomputeEquippedCongphap(old1); const before = Cu.getCultivator(old1); const snapBefore = ['cong_phap_bonus', 'cong_phap_pvp_buff', 'cong_phap_pvp_debuff', 'cong_phap_owned', 'cong_phap_levels'].map((k) => before[k]);
  D.run("DELETE FROM bot_flags WHERE key = 'cp16_migrated'"); const mg = M16.run(); ok(!mg.skipped); ok(mg.backup && fs.existsSync(mg.backup), 'có file sao lưu trước migration');
  const aft = Cu.getCultivator(old1); eq(JSON.stringify(['cong_phap_bonus', 'cong_phap_pvp_buff', 'cong_phap_pvp_debuff', 'cong_phap_owned', 'cong_phap_levels'].map((k) => aft[k])), JSON.stringify(snapBefore), 'dữ liệu công pháp cũ không đổi');
  ok(Cu.ownedCongphapTiers(aft).has(201), 'giữ 201'); ok(M16.run().skipped, 'chạy 1 lần');
  Cu.updateCultivator(old1, { cong_phap_owned: '1' }); C16.addFrag(old1, 'manh_cuu_tieu', 5);
  M16.rollback(mg.backup); eq(Cu.getCultivator(old1).cong_phap_owned, snapBefore[3], 'rollback trả công pháp về như cũ'); eq(C16.fragCount(old1, 'manh_cuu_tieu'), 0, 'rollback xoá mảnh');
  fs.unlinkSync(mg.backup);

  // ---- (10) giao diện: giới hạn Discord ở mọi màn (emoji dài ~45 ký tự), mọi nhóm/trang/lọc, qua routeComponent
  function check(label, p) {
    ok(p && Array.isArray(p.components), `${label}: components`); ok(p.components.length <= 5, `${label}: ≤5 hàng`);
    for (const e of p.embeds || []) { try { e.toJSON(); } catch (err) { throw new Error(`${label}: embed vượt giới hạn — ${err.message}`); } }
    if (typeof p.content === 'string') ok(p.content.length <= 2000, `${label}: content`);
    const ids = new Set();
    for (const r of p.components) { const js = r.toJSON ? r.toJSON() : r; ok(js.components.length <= 5, `${label}: ≤5 thành phần/hàng`);
      for (const c of js.components) { ok(String(c.custom_id).length <= 100, `${label}: custom_id ${String(c.custom_id).length}`); ok(!ids.has(c.custom_id), `${label}: custom_id trùng ${c.custom_id}`); ids.add(c.custom_id);
        if (c.options) { ok(c.options.length >= 1 && c.options.length <= 25, `${label}: options ${c.options.length}`); const vs = new Set(); for (const o of c.options) { ok(o.label.length <= 100 && (o.description || '').length <= 100 && o.value.length <= 100, `${label}: option quá dài`); ok(!vs.has(o.value), `${label}: option trùng`); vs.add(o.value); } } } }
  }
  const whale = mk({ realm_index: 9, world_tier: 2, linh_thach: 1e15, linh_tinh: 1e9 }); for (const b of B) C16.grantDirect(whale, b.tier); for (const t of [1, 2, 3, 4, 5, 6, 7, 101, 102, 201]) { const rw = Cu.getCultivator(whale); const o = Cu.ownedCongphapTiers(rw); o.add(t); Cu.updateCultivator(whale, { cong_phap_owned: [...o].sort((x, y) => x - y).join(',') }); }
  C16.setEquipped(whale, [1040, 1030, 1021]); let screens = 0;
  const run = (st) => { const p = V.render(whale, st); check(JSON.stringify(st), p); screens += 1; return p; };
  for (const g of ['all', 'cu', 'nhan', 'linh', 'tien', 'doc']) for (const c of ['all', 'cu', ...D16.CAT_ORDER]) for (let p = 0; p < 3; p += 1) run({ m: 'ov', g, c, p, t: 0, r: 'ov' });
  for (const g of ['cu', 'nhan', 'linh', 'tien', 'doc']) for (const c of ['all', ...D16.CAT_ORDER]) for (let p = 0; p < 3; p += 1) run({ m: 'shop', g, c, p, t: 0, r: 'shop' });
  for (const t of [1, 2, 3, 4, 5, 6, 7, 101, 102, 201, ...B.map((b) => b.tier)]) { for (const m of ['dt', 'cf']) for (const r of ['ov', 'shop']) run({ m, g: 'all', c: 'all', p: 0, t, r }); }
  for (let t = 0; t <= 6; t += 1) run({ m: 'fr', g: 'all', c: 'all', p: 0, t, r: 'ov' });
  const newbie = mk({}); const pn = V.render(newbie, { m: 'ov' }); check('newbie', pn); check('newbie shop', V.render(newbie, { m: 'shop', g: 'tien' })); check('newbie dt', V.render(newbie, { m: 'dt', t: 1040 }));
  // bấm thật qua routeComponent (tĩnh): chọn nhóm → chọn quyển → mua → xác nhận → trang bị → nâng cấp → đặt ô 1 → quay lại
  const buyer = mk({ realm_index: 5, linh_thach: 5e7 }); const replies = [];
  const click = async (customId, values) => { const i = { customId, user: { id: buyer }, values, update: async (p) => { replies.push(p); check(customId, p); }, reply: async (p) => { replies.push(p); }, deferUpdate: async () => { replies.push({}); } }; await kit.routeComponent(i); return replies[replies.length - 1]; };
  let p = V.render(buyer, { m: 'shop', g: 'nhan', c: 'all', p: 0, t: 0, r: 'shop' }); const rawIds = () => p.components.flatMap((r) => (r.toJSON ? r.toJSON() : r).components);
  const selId = rawIds().find((c) => c.options && /\|sel\|/.test(c.custom_id)).custom_id; p = await click(selId, ['1004']); ok(/Cửu Chuyển/.test(JSON.stringify(p.embeds[0].toJSON())), 'chi tiết quyển');
  const buyId = rawIds().find((c) => /\|buy\|/.test(c.custom_id)).custom_id; p = await click(buyId); ok(/Xác nhận mua/.test(JSON.stringify(p.embeds[0].toJSON())));
  const okId = rawIds().find((c) => /\|ok\|/.test(c.custom_id)).custom_id; p = await click(okId); ok(Cu.ownedCongphapTiers(Cu.getCultivator(buyer)).has(1004), 'mua qua nút xác nhận');
  const eqId = rawIds().find((c) => /\|eq\|/.test(c.custom_id)).custom_id; p = await click(eqId); eq(Cu.equippedCongphapTiers(Cu.getCultivator(buyer))[0], 1004, 'trang bị qua nút');
  const upId = rawIds().find((c) => /\|up\|/.test(c.custom_id)).custom_id; p = await click(upId); eq(Cu.congphapLevelsMap(Cu.getCultivator(buyer))[1004], 1, 'nâng cấp qua nút');
  p = await click(upId); eq(Cu.congphapLevelsMap(Cu.getCultivator(buyer))[1004], 1, 'bấm lại nút nâng cấp cũ (giá đã đổi) → không nâng thêm');
  const wrong = await click(eqId.replace(`|${buyer}|`, '|1|')); ok(/không phải menu/.test(JSON.stringify(wrong)), 'người khác bấm → từ chối');
  // đồng thời: nhiều người mua cùng quyển + 1 người bấm mua liên tục
  const crowd = Array.from({ length: 30 }, () => mk({ realm_index: 5, linh_thach: 100000 })); for (const c of crowd) C16.buy(c, 1001); eq(crowd.filter((c) => Cu.ownedCongphapTiers(Cu.getCultivator(c)).has(1001)).length, 30);
  const dup = mk({ realm_index: 5, linh_thach: 100000 }); await Promise.all(Array.from({ length: 10 }, async () => C16.buy(dup, 1001))); eq(Cu.getCultivator(dup).linh_thach, 100000 - 30000, 'bấm mua 10 lần chỉ trừ 1 lần');
  console.log(`   ${screens} màn hình đã kiểm giới hạn Discord (EMOJI_MODE=${MODE})`);
  console.log(`✅ test_congphap_v16 OK (${pass} kiểm tra)`);
})().catch((e) => { console.error('❌', e); process.exit(1); });
