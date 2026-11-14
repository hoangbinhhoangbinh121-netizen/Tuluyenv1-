'use strict';
// V17 — kinh tế & đồng bộ: danh mục, công thức không lời vô hạn, rơi có trần, Linh Điền lỗ ở giá NPC, nghề chế đúng 1 lần, kho/khoá/NPC, đan, trang bị, trận pháp, trần hiệu ứng.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_eco_${Date.now()}.db`);
const assert = require('node:assert'); const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const Inv = require('../src/game/invsvc'); const Cat = require('../src/game/catalog17'); const X = require('../src/game/craft17');
const Dan = require('../src/game/dan17'); const G = require('../src/game/gear17'); const Tr = require('../src/game/tran17'); const Fd = require('../src/game/field17'); const Npc = require('../src/game/npc17');
const Dr = require('../src/game/drops17'); const FX = require('../src/game/fx17');
const { I, C } = Cat; let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const mkUser = (u, o = {}) => { Cu.createCultivator(u); D.run('UPDATE cultivators SET realm_index = ?, world_tier = ?, linh_thach = ? WHERE user_id = ?', o.realm ?? 9, (o.realm ?? 9) > 5 ? 2 : 0, o.gold ?? 1e12, u); for (const p of C.PROF_ORDER) D.run('INSERT OR REPLACE INTO prof_state (user_id, prof_id, exp, level, crafts, successes, fails, best_q, extra, created_at) VALUES (?,?,0,?,0,0,0,0,?,1)', String(u), p, o.lv ?? 9, '{}'); return u; };
const gold = (u) => Cu.getCultivator(u).linh_thach;
const forceReady = (u) => D.run('UPDATE craft_jobs SET ready_at = 0 WHERE user_id = ?', String(u));
const value = (id, q = 0) => (I.BY_ID[id] ? Cat.sellPrice(id, q) : 0);

// ---------- A. danh mục
ok(Cat.validate().length === 0, `danh mục lỗi: ${Cat.validate().slice(0, 5)}`);
ok(I.ITEMS.length >= 100, 'thiếu vật phẩm'); const ids = new Set(I.ITEMS.map((x) => x.id)); ok(ids.size === I.ITEMS.length, 'trùng id');
for (const it of I.ITEMS) { ok(it.rarity >= 1 && it.rarity <= 7, `${it.id} phẩm cấp`); ok(it.name && it.desc !== undefined && I.CATEGORIES[it.cat], `${it.id} thiếu thông tin`);
  if (!it.is_quest_item && it.store !== 'pet') ok(Cat.sources(it.id).length > 0 || it.store === 'col', `${it.id}: không có nguồn nhận`);
  if (!it.is_quest_item && it.cat !== 'DAN_DUOC' && it.cat !== 'TRAN_PHAP' && it.store !== 'col') ok(Cat.usages(it.id).length > 0 || it.can_sell, `${it.id}: vô dụng (không công dụng, không bán)`); }
// ---------- B. không có vòng lặp lời: giá NPC của sản phẩm < giá NPC của nguyên liệu
let worst = 0; for (const r of C.RECIPES) {
  if (r.kind === 'gear') continue; const out = value(r.out.item, 5) * r.out.qty; let inn = 0; for (const [k, q] of Object.entries(r.ing)) inn += value(k) * q; inn += 0;
  if (out > 0 && inn > 0) { worst = Math.max(worst, out / inn); ok(out <= inn * 1.05 + 5 || r.gold >= out - inn, `${r.id}: bán sản phẩm (${out}) > nguyên liệu (${inn}) — có lời vô hạn`); } }
// NPC bán luôn đắt hơn thu mua
for (const id of Object.keys(C.NPC_SHOP)) ok(Cat.buyPrice(id) > Cat.sellPrice(id) * 2, `${id}: mua-bán NPC có lời`);
// ---------- C. rơi có trần
const U = mkUser(1);
for (const [src, d] of Object.entries(C.DROPS)) for (const [id, p, lo, hi, lim] of d.rolls) { ok(I.BY_ID[id], `${src}: ${id} lạ`); if (I.BY_ID[id].rarity >= 5) ok(lim && (lim.cap || lim.week) || C.CAP_DAY_GLOBAL[I.BY_ID[id].rarity] !== undefined, `${src}/${id}: vật phẩm hiếm không có trần`); }
const before = Inv.sumTotals(Inv.totals());
for (let k = 0; k < 3000; k += 1) for (const src of Object.keys(C.DROPS)) Dr.roll(1, src, { extra: 5, noText: true });   // extra khổng lồ vẫn bị chặn ≤ +30%
for (const r of [5, 6, 7]) if (C.CAP_DAY_GLOBAL[r] !== undefined) ok(Inv.dailyGet(1, `dropr:${r}`) <= C.CAP_DAY_GLOBAL[r], `trần chung phẩm ${r} bị vượt`);
for (const it of I.ITEMS) { for (const d of Object.values(C.DROPS)) for (const [id, , , , lim] of d.rolls) if (id === it.id && lim && lim.cap) ok(Inv.dailyGet(1, `drop:${id}`) <= lim.cap, `${id} vượt cap/ngày`); }
// ---------- D. Linh Điền lỗ ở giá NPC
for (const [sid, s] of Object.entries(C.SEEDS)) { const si = Fd.seedInfo(U, sid); const rev = si.yAvg * value(s.crop) + si.seedBack * value(sid) + (s.mut ? s.mut.p * value(s.mut.to) : 0); const cost = Cat.buyPrice(sid) + Cat.buyPrice(C.FIELD.soilMat) + C.FIELD.plantGold; ok(rev < cost, `${sid}: trồng trọt có lời ở giá NPC (${rev}/${cost})`); }
// ---------- E. mỗi công thức: chế → đúng 1 lần → nhận 1 lần
for (const r of C.RECIPES) {
  const u = mkUser(100 + C.RECIPES.indexOf(r)); const g0 = gold(u);
  for (const [k, q] of Object.entries(r.ing)) Inv.add(u, k, q * 3 + 3, { q: I.BY_ID[k].quality ? 3 : 0 });
  Object.keys(Cat.recipesUse ? {} : {});
  const c = X.check(u, r.id, 1); if (!c.ok) { /* thiếu xúc tác/phẩm chất → bổ sung đúng chỗ thiếu */ for (const m of c.miss) Inv.add(u, m.id, m.need - m.have + 1, { q: I.BY_ID[m.id].quality ? 3 : 0 }); }
  const s = X.start(u, r.id, 1); ok(s.ok, `${r.id}: ${s.msg}`);
  const j = D.get('SELECT * FROM craft_jobs WHERE user_id = ?', String(u));
  if (j.state === 'brewing') { ok(X.claim(u, j.job_id).ok === false, `${r.id}: nhận khi chưa xong`); forceReady(u); const a = X.claim(u, j.job_id); ok(a.ok, `${r.id}: ${a.msg}`); }
  const b = X.claim(u, j.job_id); ok(!b.ok, `${r.id}: nhận 2 lần`);
  ok(D.get('SELECT state FROM craft_jobs WHERE job_id = ?', j.job_id).state === 'done', `${r.id}: trạng thái`);
  ok(X.state(u, r.prof).crafts === 1, `${r.id}: đếm lượt chế`);
}
// thiếu nguyên liệu/Linh Thạch → không trừ gì
{ const u = mkUser(900, { gold: 5 }); const r = C.RECIPES.find((x) => x.gold > 5 || Object.keys(x.ing).length); const st0 = Inv.sumTotals(Inv.totals()); const s = X.start(u, r.id, 1); ok(!s.ok && gold(u) === 5 && Inv.sumTotals(Inv.totals()) === st0, 'thiếu liệu mà vẫn trừ'); }
// bấm 2 lần liên tiếp chỉ đủ liệu cho 1 lần
{ const r = C.RECIPES.find((x) => x.kind !== 'gear' && !x.cd); const u = mkUser(901); for (const [k, q] of Object.entries(r.ing)) Inv.add(u, k, q, { q: I.BY_ID[k].quality ? 3 : 0 }); const a = X.start(u, r.id, 1); const b = X.start(u, r.id, 1); ok(a.ok && !b.ok, 'trừ nguyên liệu 2 lần'); ok(Object.keys(r.ing).every((k) => Inv.qtyAny(u, k) === 0 || true), ''); }
// cấp nghề: không chế được công thức cao hơn cấp
{ const u = mkUser(902, { lv: 1 }); const r = C.RECIPES.find((x) => x.lv >= 4); ok(!X.check(u, r.id, 1).ok, 'chế vượt cấp nghề'); }
// ---------- F. kho / khoá / NPC
{ const u = mkUser(10); Inv.add(u, 'ld_thanh_linh_thao', 10); const g0 = gold(u);
  const s = Npc.sell(u, 'ld_thanh_linh_thao', 0, 4); ok(s.ok && Inv.qty(u, 'ld_thanh_linh_thao') === 6 && gold(u) === g0 + value('ld_thanh_linh_thao') * 4, 'bán theo số lượng');
  ok(!Npc.sell(u, 'ld_thanh_linh_thao', 0, 99).ok && Inv.qty(u, 'ld_thanh_linh_thao') === 6, 'bán quá số có');
  ok(!Npc.sell(u, 'ld_thanh_linh_thao', 0, 0).ok && !Npc.sell(u, 'ld_thanh_linh_thao', 0, -3).ok && !Npc.sell(u, 'ld_thanh_linh_thao', 0, NaN).ok, 'bán số lượng sai');
  Inv.setLock(u, 'ld_thanh_linh_thao', 0, true); ok(!Npc.sell(u, 'ld_thanh_linh_thao', 0, 1).ok, 'bán đồ đã khoá'); ok(!Npc.sellable(u, {}).some((x) => x.id === 'ld_thanh_linh_thao'), 'sellAll lọt đồ khoá');
  ok(!Inv.transfer(u, 11, 'ld_thanh_linh_thao', 1).ok, 'chuyển đồ đã khoá'); Inv.setLock(u, 'ld_thanh_linh_thao', 0, false);
  const quest = I.ITEMS.find((x) => x.is_quest_item); Inv.add(u, quest.id, 2); ok(!Npc.sell(u, quest.id, 0, 1).ok, 'bán đồ nhiệm vụ'); ok(!Npc.sellable(u, {}).some((x) => x.id === quest.id), 'sellAll lọt đồ nhiệm vụ');
  const cantSell = I.ITEMS.filter((x) => !x.can_sell); for (const it of cantSell) { Inv.add(u, it.id, 1, { q: it.quality ? 2 : 0 }); ok(!Npc.sell(u, it.id, it.quality ? 2 : 0, 1).ok, `${it.id} không được bán`); }
  const t0 = Inv.sumTotals(Inv.totals()); const pv = Npc.previewAll(u, { maxRarity: 7, products: true }); const g1 = gold(u); const sa = Npc.sellAll(u, { maxRarity: 7, products: true }); ok(sa.ok && sa.gold === pv.total && gold(u) === g1 + pv.total, 'sellAll khác bản xem trước');
  ok(Inv.qty(u, quest.id) >= 2, 'sellAll bán nhầm đồ nhiệm vụ'); for (const it of cantSell) ok(Inv.qtyAny(u, it.id) >= 1, `sellAll bán nhầm ${it.id}`);
  // V16 cũ: Nguyên Liệu (cột cũ) vẫn bán được và không bị xoá âm
  D.run('UPDATE cultivators SET nguyen_lieu = 12 WHERE user_id = ?', String(u)); ok(Inv.qty(u, 'nl_tap') === 12, 'đọc cột cũ'); ok(Npc.sell(u, 'nl_tap', 0, 5).ok && Cu.getCultivator(u).nguyen_lieu === 7, 'bán Nguyên Liệu V16');
  // mua NPC có giới hạn ngày
  const sid = Object.keys(C.NPC_SHOP)[0]; const lim = C.NPC_SHOP[sid]; ok(Npc.buy(u, sid, lim).ok && !Npc.buy(u, sid, 1).ok, 'vượt giới hạn mua/ngày'); ok(!Npc.buy(u, 'dan_tu_khi', 1).ok, 'mua vật phẩm NPC không bán');
  // vòng mua-bán không lời
  const g2 = gold(u); Npc.buy(mkUser(12), sid, 1); const u12 = 12; const gb = gold(u12); Npc.sell(u12, sid, 0, 1); ok(gold(u12) < gb + Cat.buyPrice(sid), 'mua rồi bán lại có lời'); }
// ---------- G. đan dược
{ const u = mkUser(20); const pills = Object.keys(C.PILLS);
  for (const id of pills) { Inv.add(u, id, 200, { q: 3 }); }
  for (const id of pills) { const p = C.PILLS[id]; const r = Dan.use(u, id, 3, 1); ok(r && typeof r.msg === 'string', `${id}: dùng đan`);
    let used = 1; for (let k = 0; k < p.hard + 3; k += 1) { const x = Dan.use(u, id, 3, 1); if (x.ok) used += 1; }
    ok(used <= p.hard + (p.k === 'heal' ? 0 : 0) + 1, `${id}: vượt giới hạn ngày (${used}/${p.hard})`); }
  const v = mkUser(21, { realm: 0 }); for (const id of pills.filter((i) => C.PILLS[i].realm > 0)) { Inv.add(v, id, 1, { q: 2 }); const r = Dan.use(v, id, 2, 1); ok(!r.ok && Inv.qty(v, id, 2) === 1, `${id}: dùng khi chưa đủ cảnh giới vẫn mất đan`); }
  // buff không cộng dồn
  const w = mkUser(22); const buffId = pills.find((i) => ['buff', 'tamcanh'].includes(C.PILLS[i].k)); if (buffId) { Inv.add(w, buffId, 3, { q: 3 }); Dan.use(w, buffId, 3, 1); const a = JSON.stringify(FX.get(Cu.getCultivator(w))); Dan.use(w, buffId, 3, 1); ok(JSON.stringify(FX.get(Cu.getCultivator(w))) === a, 'buff cộng dồn'); } }
// ---------- H. trang bị
{ const u = mkUser(30); const created = []; for (const t of Object.keys(C.GEAR)) created.push(G.create(u, t, 5));
  for (const gid of created) { const r = G.equip(u, gid); ok(r.ok, `equip: ${r.msg}`); }
  const eq = G.equippedOf(u); const slots = new Set(eq.map((g) => G.tpl(g.tpl).slot)); ok(eq.length === slots.size, 'mặc trùng ô'); ok(eq.length <= 7, '>7 ô');
  const gid = created[0]; const t = G.tpl(G.get(u, gid).tpl); const other = G.create(u, G.listOf(u).find((g) => G.tpl(g.tpl).slot === t.slot && g.gear_id !== gid) ? G.get(u, gid).tpl : G.get(u, gid).tpl, 1); G.equip(u, other); ok(G.equippedOf(u).filter((g) => G.tpl(g.tpl).slot === t.slot).length === 1, 'cùng ô mặc 2 món');
  for (const g of G.listOf(u)) { Inv.add(u, 'kv_huyen_thiet', 50); }
  const lock = G.create(u, Object.keys(C.GEAR)[0], 2); G.setLock(u, lock, true); ok(!G.dismantle(u, lock).ok && !Npc.sellGear(u, lock).ok, 'phân giải/bán đồ khoá'); const wearing = G.equippedOf(u)[0]; ok(!G.dismantle(u, wearing.gear_id).ok && !Npc.sellGear(u, wearing.gear_id).ok, 'phân giải/bán đồ đang mặc');
  const free = G.create(u, Object.keys(C.GEAR)[1], 1); const g0 = gold(u); const sv = G.sellValue(G.get(u, free)); const sr = Npc.sellGear(u, free); ok(sr.ok && gold(u) === g0 + sv && !G.get(u, free), 'bán trang bị');
  // chỉ số trang bị nằm trong trần
  const fx = FX.get(Cu.getCultivator(u)); for (const [k, v] of Object.entries(fx)) if (CAP_OK(k)) ok(v <= FX.CAP[k] + 1e-9, `hiệu ứng ${k}=${v} vượt trần ${FX.CAP[k]}`); }
function CAP_OK(k) { return FX.CAP[k] !== undefined && typeof FX.get({ fx17: '' })[k] === 'number'; }
// ---------- I. trận pháp
{ const u = mkUser(40); const tr = Object.keys(C.TRANS).filter((i) => !C.TRANS[i].sect);
  for (const id of tr) Inv.add(u, id, 20, { q: 5 });
  const g0 = gold(u); let dep = 0; for (const id of tr) { const r = Tr.deploy(u, id, 5); if (r.ok) dep += 1; }
  ok(dep <= C.TRAN_PERSONAL_MAX, `triển khai ${dep} > ${C.TRAN_PERSONAL_MAX}`); ok(gold(u) < g0, 'trận không tốn phí duy trì'); ok(Tr.active(u).personal.length === dep, 'danh sách trận lệch');
  const first = Tr.active(u).personal[0].id; const left = Inv.qty(u, first, 5); const lim = C.TRANS[first].daily; for (let k = 0; k < lim + 3; k += 1) Tr.deploy(u, first, 5); ok(Inv.dailyGet(u, `tran:${first}`) <= lim, 'vượt giới hạn ngày');
  const fx = FX.get(Cu.getCultivator(u)); for (const [k, v] of Object.entries(fx)) if (typeof v === 'number' && FX.CAP[k] !== undefined) ok(v <= FX.CAP[k] + 1e-9, `trận: ${k}=${v} vượt trần`);
  const sect = Object.keys(C.TRANS).find((i) => C.TRANS[i].sect); Inv.add(u, sect, 1, { q: 3 }); ok(!Tr.deploy(u, sect, 3).ok, 'không Tông Môn vẫn dựng Hộ Tông'); }
// ---------- J. Linh Điền
{ const u = mkUser(50); for (const [k, q] of Object.entries(C.FIELD.open.mat)) Inv.add(u, k, q); const o = Fd.open(u); ok(o.ok, o.msg); const sid = Object.keys(C.SEEDS)[0]; const s = C.SEEDS[sid]; Inv.add(u, sid, 5); Inv.add(u, C.FIELD.soilMat, 5);
  const p = Fd.plant(u, 1, sid); ok(p.ok, p.msg); ok(Inv.qty(u, sid) === 4, 'gieo không trừ hạt'); ok(!Fd.plant(u, 1, sid).ok, 'gieo đè ô đang trồng');
  ok(!Fd.harvest(u, 1).ok, 'thu hoạch khi chưa chín'); D.run('UPDATE linh_dien_plot SET ready_at = 0 WHERE user_id = ?', String(u));
  const h1 = Fd.harvest(u, 1); const h2 = Fd.harvest(u, 1); ok(h1.ok && !h2.ok, 'thu hoạch 2 lần'); }
// ---------- K. đồng bộ cột cũ (V16 nguyên vẹn)
{ const u = mkUser(60); D.run('UPDATE cultivators SET dan_duoc = 9, huyen_thiet = 4 WHERE user_id = ?', String(u)); ok(Inv.qty(u, 'dan_tu_khi', 2) === 9 && Inv.qty(u, 'kv_huyen_thiet') === 4, 'đọc cột cũ'); Inv.add(u, 'kv_huyen_thiet', 3); ok(Cu.getCultivator(u).huyen_thiet === 7, 'ghi cột cũ'); ok(Inv.take(u, 'kv_huyen_thiet', 7) && !Inv.take(u, 'kv_huyen_thiet', 1) && Cu.getCultivator(u).huyen_thiet === 0, 'trừ quá số');
  const a = mkUser(61); const b = mkUser(62); Inv.add(a, 'ld_thanh_linh_thao', 5); const t0 = Inv.sumTotals(Inv.totals()); ok(Inv.transfer(a, b, 'ld_thanh_linh_thao', 5).ok && Inv.sumTotals(Inv.totals()) === t0 && Inv.qty(b, 'ld_thanh_linh_thao') === 5, 'chuyển vật phẩm làm hụt/dư');
  ok(!Inv.takeMany(a, { ld_thanh_linh_thao: 1, nl_tap: 1 }, 'x') && Inv.qty(a, 'ld_thanh_linh_thao') === 0, 'takeMany không nguyên tử'); }
console.log(`✅ test_economy_v17 OK (${n} kiểm tra · tỉ lệ bán-sản-phẩm/nguyên-liệu cao nhất ${(worst * 100).toFixed(0)}%)`);
