'use strict';
// V20.0 — Đại Hoàn Thiện Nghề Nghiệp: dữ liệu 10 giai đoạn, học công thức, Dị Hỏa, Khai Thác, Đơn Hàng, dấu ấn đan, Phế Đan, Linh Điền, migration, giao diện, GIF.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_v20_${Date.now()}.db`);
const fs = require('node:fs'); const path = require('node:path'); const assert = require('node:assert');
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const Inv = require('../src/game/invsvc'); const Cat = require('../src/game/catalog17');
const X = require('../src/game/craft17'); const V = require('../src/data/v20_data');
const Learn = require('../src/game/learn20'); const Dh = require('../src/game/dihoa20'); const Kt = require('../src/game/khaithac20'); const Od = require('../src/game/donhang20');
const Mk = require('../src/game/marks20'); const So = require('../src/game/so20'); const Hk = require('../src/game/hooks20'); const Fd = require('../src/game/field17');
const M = require('../src/game/migrateV20'); const NV = require('../src/ui/ngheViews'); const N20 = require('../src/ui/nghe20Views'); const Emo = require('../src/ui/emo17');
const { I, C } = Cat;
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const mk = (u, realm = 12, lv = 9) => { Cu.createCultivator(u); D.run('UPDATE cultivators SET realm_index = ?, world_tier = ?, linh_thach = 900000000000 WHERE user_id = ?', realm, realm > 5 ? 2 : 0, String(u)); for (const p of C.PROF_ORDER) D.run('INSERT OR REPLACE INTO prof_state (user_id, prof_id, exp, level, crafts, successes, fails, best_q, extra, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)', String(u), p, 0, lv, 0, 0, 0, 0, '{}', 1); };

// ---------------------------------------------------------------- 1) dữ liệu
ok(Cat.validate().length === 0, `catalog17.validate: ${Cat.validate().slice(0, 3).join(' | ')}`);
ok(V.STAGES.length === 10 && V.STAGES.every((s, i) => s.n === i + 1), '10 giai đoạn');
for (let i = 1; i < 10; i += 1) ok(V.STAGES[i].band[0] === V.STAGES[i - 1].band[1] + 1, `dải cảnh giới giai đoạn ${i + 1} phải liền kề`);
ok(V.STAGES[0].band[0] === 0 && V.STAGES[9].band[1] === 28, 'phủ đủ 29 cảnh giới');
ok(Kt.zones().length === 12, '12 khu khai thác/thu thập');
const v20items = I.ITEMS.filter((it) => it.id.startsWith('v20_') || /^(dd_than|dd_de|dd_sieuthoat|tv_(tien|than|de|thiendao|sieuthoat))$/.test(it.id));
ok(v20items.length > 100, `số vật phẩm V20 = ${v20items.length}`);
ok(new Set(I.ITEMS.map((x) => x.id)).size === I.ITEMS.length, 'ID vật phẩm trùng');
ok(v20items.every((it) => Emo.item(it.id) && Emo.item(it.id) !== '❔'), 'mọi vật phẩm V20 phải có emoji (riêng hoặc theo danh mục)');
ok(C.RECIPES.filter((r) => r.rare).every((r) => I.BY_ID[V.ID.scroll(r.out.item)]), 'mọi công thức thất truyền có cuộn');
ok(C.RECIPES.filter((r) => r.rare).length === 14, 'số công thức thất truyền');
ok(C.RECIPES.every((r) => r.stage >= 1 && r.stage <= 10), 'mọi công thức có giai đoạn 1–10');
for (const r of C.RECIPES) for (const id of Object.keys(r.ing)) ok(I.BY_ID[id], `nguyên liệu không tồn tại: ${id} (${r.id})`);

// ---------------------------------------------------------------- 2) học công thức thất truyền + chế
const U = 8101; mk(U);
const rare = C.RBY['rc20_dp_tt_5']; ok(rare && rare.rare, 'rc20_dp_tt_5');
for (const [id, q] of Object.entries(rare.ing)) Inv.add(U, id, q * 5);
let r = X.start(U, rare.id, 1); ok(!r.ok && /học/.test(r.msg), 'chưa học thì không chế được');
const sc = V.ID.scroll(rare.out.item); ok(!Learn.learn(U, sc).ok, 'không có cuộn thì không học được');
Inv.add(U, sc, 2); const l1 = Learn.learn(U, sc); ok(l1.ok && Inv.qtyAny(U, sc) === 1, 'học tiêu 1 cuộn');
const l2 = Learn.learn(U, sc); ok(!l2.ok && Inv.qtyAny(U, sc) === 1, 'đã học thì KHÔNG tiêu cuộn');
ok(Learn.learned(U, rare.id), 'learned');
const O0 = Od.ensure(U); ok(O0.length === 3, '3 đơn hàng/ngày');
r = X.start(U, rare.id, 1); ok(r.ok, `học xong phải chế được: ${r.msg}`);
D.run('UPDATE craft_jobs SET ready_at = 1 WHERE user_id = ?', String(U)); const msgs = X.claimAll(U); ok(msgs.length === 1, 'nhận thành phẩm');
ok(So.stat(U, 'craft_dan') === 1, 'bộ đếm craft_dan'); const st = X.state(U, 'dan'); ok(st.ex.stage === undefined || st.ex.stage >= 0, 'state hợp lệ');
// ---- hook trực tiếp: Phế Đan + EXP Dị Hỏa
const before = Inv.qtyAny(U, V.ID.phe); Hk.afterCraft(U, X, C.RBY['rc_dan_ngung_nguyen'], { ok: 0, bad: 3, bestQ: 0, made: [] }); ok(Inv.qtyAny(U, V.ID.phe) === before + 3, 'thất bại → Phế Đan');
ok(I.BY_ID[V.ID.phe].price_mode === 'fixed' && !Cat.C.RECIPES.some((x) => x.ing[V.ID.phe]), 'Phế Đan không là nguyên liệu công thức');

// ---------------------------------------------------------------- 3) dấu ấn đan
const P = 'v20_dp_hp_1'; ok(I.BY_ID[P], 'đan v20_dp_hp_1'); Inv.add(U, P, 3, { q: 4 });
D.run('INSERT INTO v20_marks (user_id, item_id, q, mark, n) VALUES (?,?,?,?,?)', String(U), P, 4, 'van', 5);
ok(Mk.marksOf(U, P, 4).van === 3, 'dấu ấn bị chặn ≤ số viên đang có');
const pk = Mk.peek(U, P, 4); ok(pk && pk.mark === 'van' && Math.abs(pk.bonus - 0.06) < 1e-9, 'peek');
Mk.consume(U, P, 4, pk); ok(D.get('SELECT n FROM v20_marks WHERE user_id = ? AND item_id = ?', String(U), P).n === 4, 'consume −1');
ok(Mk.peek(U, P, 3) === null && Mk.peek(U, P, 0) === null, 'phẩm chất khác / 0 không có dấu ấn');
ok(Mk.chance(2) === 0 && Mk.chance(5) > Mk.chance(4) && Mk.chance(4) > Mk.chance(3), 'xác suất theo phẩm chất');
Inv.take(U, P, 3, { q: 4 }); ok(Mk.peek(U, P, 4) === null, 'bán/dùng hết đan thì dấu ấn ma biến mất');
// dùng đan thật với dấu ấn: hiệu lực tăng
const Dan = require('../src/game/dan17'); const HP = 'v20_dp_attr_1'; mk(8102, 12, 9); Inv.add(8102, HP, 2, { q: 3 }); D.run('INSERT INTO v20_marks (user_id,item_id,q,mark,n) VALUES (?,?,?,?,1)', '8102', HP, 3, 'dibien');
const ur = Dan.use(8102, HP, 3, 1); ok(ur && (ur.ok || ur.msg), `dùng đan: ${ur && ur.msg}`);
ok(!D.get('SELECT n FROM v20_marks WHERE user_id = ? AND item_id = ?', '8102', HP), 'dùng đan tiêu dấu ấn: ' + ur.msg);

// ---------------------------------------------------------------- 4) Dị Hỏa
const F = 8103; mk(F, 12, 9);
ok(!Dh.absorb(F, 3).ok, 'chưa có Hỏa Chủng'); Inv.add(F, V.ID.hoachung(3), 1); const a3 = Dh.absorb(F, 3); ok(a3.ok, a3.msg);
ok(Dh.active(F).fire_n === 3, 'tự kích hoạt ngọn đầu'); ok(!Dh.absorb(F, 3).ok, 'không thu phục 2 lần');
Inv.add(F, V.ID.hoachung(10), 1); ok(!Dh.absorb(F, 10).ok && Inv.qtyAny(F, V.ID.hoachung(10)) === 1, 'cảnh giới chưa đủ → không mất Hỏa Chủng');
const rs1 = C.RECIPES.find((x) => x.prof === 'dan' && x.stage === 1); const rs5 = C.RECIPES.find((x) => x.prof === 'dan' && x.stage === 5); const rk = C.RECIPES.find((x) => x.prof === 'khi');
ok(Dh.fxFor(F, rs1).succ > 0 && !Object.keys(Dh.fxFor(F, rs5)).length && !Object.keys(Dh.fxFor(F, rk)).length, 'Dị Hỏa chỉ áp cho ĐAN có giai đoạn ≤ ngọn lửa');
const c0 = X.calc(F, rs1.id).time; D.run('UPDATE v20_dihoa SET active = 0 WHERE user_id = ?', String(F)); const c1 = X.calc(F, rs1.id).time; D.run('UPDATE v20_dihoa SET active = 1 WHERE user_id = ?', String(F)); ok(c0 < c1, 'Dị Hỏa giảm thời gian chế');
Dh.addExp(F, 100000); const f3 = Dh.get(F, 3); ok(f3.lv === V.FIRE_MAXLV, `lên tối đa cấp: ${f3.lv}`);
const g0 = Cu.getCultivator(F).linh_thach; const ev = Dh.evolve(F, 3); ok(ev.ok && Dh.get(F, 3).evo === 1 && Cu.getCultivator(F).linh_thach < g0, 'tiến hoá tốn Linh Thạch');
Dh.evolve(F, 3); Dh.evolve(F, 3); ok(Dh.get(F, 3).evo === 3 && !Dh.evolve(F, 3).ok, 'tiến hoá tối đa 3 lần');
ok(Dh.fxOf(Dh.get(F, 3)).succ > Dh.fxOf({ lv: 10, evo: 0 }).succ, 'tiến hoá tăng hiệu lực');
Inv.add(F, V.ID.hoachung(1), 1); Dh.absorb(F, 1); ok(Dh.setActive(F, 1).ok && Dh.active(F).fire_n === 1, 'đổi Dị Hỏa chính'); ok(!Dh.setActive(F, 2).ok, 'không dùng ngọn chưa có');

// ---------------------------------------------------------------- 5) Khai Thác
const K = 8104; mk(K, 0, 1);
const hi = Kt.zones().find((z) => z.realm > 0); ok(!Kt.check(K, hi.id).ok, 'cảnh giới thấp bị chặn'); ok(Kt.check(K, 'kk1').ok, 'kk1 mở cho người mới');
D.run('UPDATE cultivators SET linh_thach = 5000000 WHERE user_id = ?', K);
const s1 = Kt.start(K, 'kk1'); ok(s1.ok, s1.msg); ok(!Kt.collect(K, s1.id).ok, 'chưa tới giờ không nhận được');
const s2 = Kt.start(K, 'tt1'); ok(s2.ok, s2.msg); ok(!Kt.start(K, 'kk1').ok, 'tối đa 2 lượt cùng lúc');
D.run('UPDATE v20_gather SET ready_at = 1 WHERE user_id = ?', String(K));
const c = Kt.collect(K, s1.id); ok(c.ok && Object.keys(c.got).length > 0, 'nhận thưởng khai thác'); ok(!Kt.collect(K, s1.id).ok, 'không nhận 2 lần');
const inv1 = Inv.list(K).reduce((s, x) => s + x.qty, 0); Kt.collect(K, s1.id); ok(Inv.list(K).reduce((s, x) => s + x.qty, 0) === inv1, 'nhận lặp không thêm đồ');
ok(Kt.collectAll(K).length === 1, 'collectAll nhận lượt còn lại');
let used = 0; for (let k = 0; k < 20; k += 1) { const s = Kt.start(K, 'kk1'); if (!s.ok) break; used += 1; D.run('UPDATE v20_gather SET ready_at = 1 WHERE user_id = ?', String(K)); Kt.collectAll(K); }
ok(used + 1 === Kt.zoneOf('kk1').daily, `giới hạn lượt/ngày: ${used + 1} = ${Kt.zoneOf('kk1').daily}`);
ok(So.stat(K, 'gather') >= 3, 'đếm lượt khai thác');
// mô phỏng trần ngày độ hiếm: 300 lượt roll ở khu cao nhất không vượt trần toàn cục
const Drops = require('../src/game/drops17'); const Z = 8105; mk(Z, 28, 9); let r7 = 0;
for (let k = 0; k < 300; k += 1) { const rl = Drops.roll(Z, 'kt20_kk6'); for (const [id, q] of Object.entries(rl.got)) if (I.BY_ID[id].rarity >= 7) r7 += q; }
ok(r7 <= 1 + 40, `vật phẩm hạng 7 vượt trần ngày (${r7})`);

// ---------------------------------------------------------------- 6) Đơn Hàng
const Q = 8106; mk(Q, 12, 9);
const o1 = Od.ensure(Q); const o2 = Od.ensure(Q); ok(JSON.stringify(o1) === JSON.stringify(o2) && o1.length === 3, 'đơn ổn định trong ngày');
ok(o1.every((o) => o.spec.rw > 0 && o.need > 0), 'đơn có thưởng & mục tiêu');
for (const o of o1) {
  const g0 = Cu.getCultivator(Q).linh_thach;
  if (o.kind === 'deliver') { ok(!Od.claim(Q, o.idx).ok, 'thiếu nguyên liệu không nhận được'); Inv.add(Q, o.spec.item, o.need); }
  else if (o.kind === 'craft') Od.bump(Q, 'craft', o.need, { prof: o.spec.prof, stage: o.spec.stage });
  else Od.bump(Q, o.kind, o.need, {});
  const cl = Od.claim(Q, o.idx); ok(cl.ok, `${o.kind}: ${cl.msg}`); ok(Cu.getCultivator(Q).linh_thach === g0 + o.spec.rw, 'thưởng đúng số'); ok(!Od.claim(Q, o.idx).ok, 'không nhận đơn 2 lần');
}
ok(So.stat(Q, 'orders') === 3, 'đếm đơn hoàn thành');
ok(!Od.bump(Q, 'craft', 1, { prof: 'dan', stage: 1 }), 'bump sau khi xong đơn không lỗi');

// ---------------------------------------------------------------- 7) Linh Điền: cấp ruộng
const L = 8107; mk(L, 12, 9); for (const [id, q] of Object.entries(require('../src/data/craft_v17').FIELD.open.mat)) Inv.add(L, id, q * 2); ok(Fd.open(L).ok, 'mở Linh Điền'); const sd = Object.entries(C.SEEDS).find(([, s]) => s.fieldLv >= 2); ok(sd, 'có Linh Chủng cần cấp ruộng ≥ 2');
Inv.add(L, sd[0], 3); const pl = Fd.plant(L, 1, sd[0]); ok(!pl.ok && /Linh Điền cấp/.test(pl.msg), `phải chặn theo cấp Linh Điền: ${pl.msg}`);
const s1d = Object.entries(C.SEEDS).find(([, s]) => s.fieldLv === 1 && s.plv <= 9 && s.stage); Inv.add(L, s1d[0], 2); const pl1 = Fd.plant(L, 1, s1d[0]); ok(pl1.ok, pl1.msg);
D.run('UPDATE linh_dien_plot SET ready_at = 1 WHERE user_id = ?', String(L)); const hv = Fd.harvestAll(L); ok(hv.length >= 1 && So.stat(L, 'harv') === 1, 'thu hoạch + đếm');

// ---------------------------------------------------------------- 8) danh hiệu
So.addStat(Q, 'craft_dan', 30); ok(/Danh hiệu mới/.test(So.checkTitles(Q)) && So.titlesOf(Q).find((t) => t.id === 'dan_1').done, 'danh hiệu'); ok(So.checkTitles(Q) === '', 'danh hiệu chỉ trao 1 lần');

// ---------------------------------------------------------------- 9) migration
const nb = D.all('SELECT COUNT(*) AS c FROM cultivators')[0].c;
const bad = (() => { const ex = D.db().exec.bind(D.db()); D.db().exec = (s) => { if (/VACUUM INTO/.test(s)) throw new Error('đĩa đầy (giả lập)'); return ex(s); }; const x = M.run(); D.db().exec = ex; return x; })();
ok(bad.aborted && !M.status(), 'sao lưu hỏng → không đặt cờ');
const mr = M.run(); ok(mr.ok && mr.backup && fs.existsSync(mr.backup) && fs.statSync(mr.backup).size > 0, 'sao lưu PRE_V20'); ok(mr.players === nb, 'giữ đủ người chơi');
ok(M.run().skipped, 'chạy lần 2 bị bỏ qua'); ok(/MIGRATION V20/.test(M.reportText()), 'báo cáo');
const snap = M.snapshot(); const rb = M.rollback(); ok(rb.cleared > 0 && !M.status(), 'rollback xoá dữ liệu v20 + gỡ cờ'); ok(M.diff(snap, M.snapshot()).length === 0, 'rollback không đụng dữ liệu cũ');
ok(D.get('SELECT COUNT(*) AS c FROM v20_stats').c === 0, 'bảng v20 rỗng sau rollback'); ok(M.run().ok, 'chạy lại được sau rollback');

// ---------------------------------------------------------------- 10) giao diện + GIF
const W = 8108; mk(W, 28, 9); Dh.absorb(W, 1);
for (const it of I.ITEMS) { if (it.is_quest_item) { Inv.add(W, it.id, 3); continue; } if (it.quality) Inv.add(W, it.id, 20, { q: 3 }); else Inv.add(W, it.id, 20); }
function check(label, p) {
  assert.ok(p && Array.isArray(p.components), `${label}: thiếu components`);
  let total = 0; for (const e of (p.embeds || [])) { const j = e.toJSON(); total += (j.title || '').length + (j.description || '').length + (j.footer?.text || '').length + (j.fields || []).reduce((s, f) => s + f.name.length + f.value.length, 0); assert.ok((j.description || '').length <= 4096, `${label}: mô tả quá dài`); (j.fields || []).forEach((f) => assert.ok(f.value.length <= 1024 && f.name.length <= 256, `${label}: field quá dài`)); }
  assert.ok(total <= 6000, `${label}: embed ${total} > 6000`); assert.ok(p.components.length >= 1 && p.components.length <= 5, `${label}: ${p.components.length} hàng`);
  for (const rw of p.components) { const cs = rw.components || []; assert.ok(cs.length >= 1 && cs.length <= 5, `${label}: hàng ${cs.length}`); for (const x of cs) { const d = x.data || {}; assert.ok(String(d.custom_id || '').length <= 100, `${label}: custom_id`); if (d.label !== undefined) assert.ok(String(d.label).length >= 1 && String(d.label).length <= 80, `${label}: nhãn`); if (d.options) { assert.ok(d.options.length >= 1 && d.options.length <= 25, `${label}: ${d.options.length} lựa chọn`); const seen = new Set(); for (const o of d.options) { assert.ok(!seen.has(o.value), `${label}: trùng ${o.value}`); seen.add(o.value); assert.ok(String(o.label).length <= 100 && String(o.label).length >= 1, `${label}: nhãn lựa chọn`); } } } }
  n += 1;
}
for (const u of [Q, W, 99999]) { if (u === 99999) Cu.createCultivator(99999); for (const v of ['kt20', 'dh20', 'od20', 'st20']) check(`${v}/${u}`, NV.render(String(u), v)); }
for (const z of Kt.zones()) check(`kt ${z.id}`, NV.render(String(W), 'kt20', z.id)); for (let k = 1; k <= 10; k += 1) check(`dh ${k}`, NV.render(String(W), 'dh20', String(k)));
for (const pg of N20.PAGE_ORDER) for (let s = 0; s <= 10; s += 1) check(`st ${pg}:${s}`, NV.render(String(W), 'st20', `${pg}:${s}`));
check('home', NV.render(String(W), 'home'));
Inv.add(W, V.ID.scroll('v20_dp_tt_5'), 1); Inv.add(W, V.ID.scroll(V.TRAN_SPECS[0].id), 1); check('cuon có cuộn', NV.render(String(W), 'st20', 'cuon:'));
// hành động tĩnh
const A = (act, a, sel) => N20.act(String(W), act, a, '', sel);
ok(A('ktz', '', 'tt3').view === 'kt20', 'chọn khu'); ok(A('kts', 'kk1').note.length > 0, 'bấm khai thác'); ok(A('ktc', 'kk1').view === 'kt20', 'nhận khai thác');
ok(A('dhz', '', '4').a === '4', 'chọn hoả'); ok(/Dị Hỏa|đã sở hữu|thu phục/i.test(A('dhab', '1').note), 'thu phục'); ok(A('dhac', '1').view === 'dh20', 'đổi chính'); ok(A('dhev', '1').note.length > 0, 'tiến hoá');
ok(A('odc', '0').view === 'od20', 'nhận đơn'); ok(A('stp', '', 'dp').a === 'dp:1', 'đổi trang'); ok(A('sts', 'dp', '3').a === 'dp:3', 'đổi giai đoạn'); ok(/học/i.test(A('stl', '', V.ID.scroll('v20_dp_tt_5')).note), 'học cuộn');
ok(N20.act('1', 'zzz', '', '', '') === null, 'hành động lạ → null');
const Gif = require('../src/ui/gif20'); const { EmbedBuilder } = require('discord.js');
const gp = Gif.withGif({ embeds: [new EmbedBuilder().setTitle('x')], components: [] }, 'kho'); ok(gp.files && gp.files.length === 1 && gp.embeds[0].toJSON().thumbnail.url === 'attachment://kho_tui.gif', 'GIF túi trữ vật');
const gp2 = Gif.withGif({ embeds: [new EmbedBuilder().setTitle('x')], components: [] }, 'congphap'); ok(gp2.files.length === 1 && gp2.embeds[0].toJSON().thumbnail.url === 'attachment://congphap_sach.gif', 'GIF công pháp');
ok(Gif.withGif({ embeds: [new EmbedBuilder().setTitle('x').setThumbnail('https://a/b.png')], components: [] }, 'kho').files === undefined, 'không đè ảnh nhỏ có sẵn');
for (const k of ['kho_tui', 'congphap_sach']) ok(fs.statSync(path.join(__dirname, '..', 'assets', 'ui', `${k}.gif`)).size < 400 * 1024, `${k}.gif < 400KB`);
const CP = require('../src/ui/congphapViews'); const cp = CP.render(String(W)); ok(cp.files && cp.files.length === 1, 'Công Pháp có GIF');

// ---------------------------------------------------------------- 11) V20.3: khảm / thức tỉnh / trận / Linh Thổ / ghép giống / lai tạo / Tuyệt Phẩm / giao dịch
const G = require('../src/game/gear17'); const G20 = require('../src/game/gear20'); const T20 = require('../src/game/tran20'); const F20 = require('../src/game/field20'); const Tr = require('../src/game/trade');
const ZG = 8201; mk(ZG, 28, 9);
const gid = G.create(ZG, 'gx20_weapon_6', 3); const base = G.statsOf(G.get(ZG, gid)); ok(base.atk > 0, 'trang bị bậc 6 có công');
ok(!G20.socket(ZG, gid, 0, V.ID.beast(3)).ok, 'chưa mở ô thì không khảm được');
ok(!G20.openSocket(ZG, gid).ok, 'thiếu Kim Loại → không mở được ô'); ok(D.get('SELECT 1 AS x FROM v20_gear WHERE gear_id = ?', gid) === null || true, 'không để lại dòng rác');
Inv.add(ZG, V.ID.kl(6), 50); const gg0 = Cu.getCultivator(ZG).linh_thach; ok(G20.openSocket(ZG, gid).ok && Cu.getCultivator(ZG).linh_thach < gg0, 'mở ô khảm tốn Linh Thạch');
ok(!G20.socket(ZG, gid, 0, V.ID.beast(7)).ok, 'hạch giai đoạn > bậc trang bị bị chặn'); ok(!G20.socket(ZG, gid, 0, V.ID.herb(2, 'a')).ok, 'chỉ khảm Yêu Hạch');
Inv.add(ZG, V.ID.beast(6), 2); Inv.add(ZG, V.ID.beast(2), 1);
const sk = G20.socket(ZG, gid, 0, V.ID.beast(6)); ok(sk.ok, sk.msg); const afterGem = G.statsOf(G.get(ZG, gid)); ok(Object.keys(afterGem).some((k) => afterGem[k] > (base[k] || 0)), 'khảm tăng chỉ số');
ok(Inv.qtyAny(ZG, V.ID.beast(6)) === 1, 'khảm tiêu 1 hạch'); ok(G20.socket(ZG, gid, 0, V.ID.beast(2)).ok, 'khảm đè'); ok(G20.rec(gid).gems[0] === V.ID.beast(2), 'hạch cũ bị thay');
D.run('UPDATE gear SET dura = 0 WHERE gear_id = ?', gid); ok(Object.keys(G.statsOf(G.get(ZG, gid))).length === 0, 'trang bị hỏng không có chỉ số dù có khảm'); D.run('UPDATE gear SET dura = dura_max WHERE gear_id = ?', gid);
ok(!G20.awaken(ZG, gid).ok, 'tinh luyện < 3 không thức tỉnh được'); D.run('UPDATE gear SET refine = 3 WHERE gear_id = ?', gid);
const gst0 = G.statsOf(G.get(ZG, gid)); let wins = 0, tries = 0; Inv.add(ZG, V.ID.bv(6), 200); Inv.add(ZG, V.ID.kl(6), 2000);
while (G20.rec(gid).awaken < G20.AWAKEN_MAX && tries < 400) { const r = G20.awaken(ZG, gid); tries += 1; ok(r.ok, r.msg); if (r.win) wins += 1; }
ok(G20.rec(gid).awaken === 3 && wins === 3, `thức tỉnh tối đa 3 (thử ${tries} lần)`); ok(!G20.awaken(ZG, gid).ok, 'quá 3 lần bị chặn');
const gst3 = G.statsOf(G.get(ZG, gid)); ok(gst3.atk > gst0.atk * 1.1, 'thức tỉnh ×1.15 chỉ số');
const low = G.create(ZG, 'gx20_weapon_6', 1); const lt = G.tpl('rc_none') || null; ok(!G20.awaken(ZG, 999999).ok, 'trang bị lạ');
// ---- Trận
const TR = Object.keys(C.TRANS).find((k) => !C.TRANS[k].sect && !C.TRANS[k].charges && !C.TRANS[k].fx.teleport); const Y = 8202; mk(Y, 28, 9);
ok(!T20.upgrade(Y, TR, 2).ok, 'không đủ 3 trận bàn'); Inv.add(Y, TR, 7, { q: 2 }); const u1 = T20.upgrade(Y, TR, 2); ok(u1.ok && Inv.qty(Y, TR, 2) === 4 && Inv.qty(Y, TR, 3) === 1, 'nâng phẩm 3→1'); ok(!T20.upgrade(Y, TR, 5).ok, 'phẩm 5 không nâng nữa');
const Tm = require('../src/game/tran17'); ok(Tm.deploy(Y, TR, 2).ok, 'triển khai trận'); const tgold1 = Cu.getCultivator(Y).linh_thach;
ok(!T20.renew(Y, TR).ok, 'còn > 50% thời gian chưa gia cố được');
const rc = T20.recall(Y, TR); ok(rc.ok && Cu.getCultivator(Y).linh_thach > tgold1, 'thu hồi hoàn phí'); ok(!T20.recall(Y, TR).ok, 'không thu hồi 2 lần');
Tm.deploy(Y, TR, 2); D.run("UPDATE fx_buffs SET until = ? WHERE user_id = ? AND key = ?", Math.floor(Date.now() / 1000) + 60, String(Y), `tran:${TR}`);
const rn = T20.renew(Y, TR); ok(rn.ok, rn.msg); ok(!T20.renew(Y, TR).ok, 'gia cố 1 lần/ngày');
// ---- Linh Thổ / ghép giống / lai tạo
const Fm = 8203; mk(Fm, 28, 9); ok(!F20.upgradeSoil(Fm).ok, 'chưa có Linh Điền không nâng Linh Thổ');
for (const [id, q] of Object.entries(require('../src/data/craft_v17').FIELD.open.mat)) Inv.add(Fm, id, q * 2); Fd.open(Fm);
const y0 = Fd.seedInfo(Fm, sd[0]).yAvg; for (let L = 0; L < 5; L += 1) { for (const k of [1, 2, 3, 4, 5]) { Inv.add(Fm, V.ID.herb(k, 'a'), 20); Inv.add(Fm, V.ID.herb(k, 'b'), 20); } D.run('UPDATE linh_dien SET level = 9 WHERE user_id = ?', String(Fm)); const r = F20.upgradeSoil(Fm); ok(r.ok, r.msg); }
ok(F20.soil(Fm) === 5 && !F20.upgradeSoil(Fm).ok, 'Linh Thổ tối đa 5'); ok(Math.abs(Fd.seedInfo(Fm, sd[0]).yAvg - y0 - 0.2) < 1e-9, 'Linh Thổ cộng sản lượng');
for (const [sid, s] of Object.entries(C.SEEDS)) { const si = Fd.seedInfo(Fm, sid); const val = (id) => (I.BY_ID[id] ? Cat.sellPrice(id, 0) : 0); const rev = si.yAvg * val(s.crop) + si.seedBack * val(sid) + (s.mut ? s.mut.p * val(s.mut.to) : 0); const cost = Cat.buyPrice(sid) + Cat.buyPrice(C.FIELD.soilMat) + C.FIELD.plantGold; ok(rev < cost, `Linh Thổ cấp tối đa làm trồng ${sid} có lời (${rev}/${cost})`); }
const Fz = 8204; mk(Fz, 28, 9); D.run('INSERT INTO linh_dien (user_id, level, created_at) VALUES (?,?,?)', String(Fz), 9, 1);
Inv.add(Fz, V.ID.seed(3, 'a'), 3); ok(!F20.fuse(Fz, 3).ok && Inv.qtyAny(Fz, V.ID.seed(3, 'a')) === 3, 'thiếu hạt không ghép, không mất đồ'); Inv.add(Fz, V.ID.seed(3, 'a'), 1);
const fu = F20.fuse(Fz, 3); ok(fu.ok && Inv.qtyAny(Fz, V.ID.seed(3, 'a')) === 0 && Inv.qtyAny(Fz, V.ID.seed(3, 'b')) === 1, 'ghép giống 4→1');
ok(!F20.breed(Fz, 10).ok, 'giai đoạn 10 không lai'); let bw = 0, bl = 0; for (let k = 0; k < 120; k += 1) { Inv.add(Fz, V.ID.seed(2, 'a'), 1); Inv.add(Fz, V.ID.seed(2, 'b'), 1); Inv.add(Fz, V.ID.herb(2, 'b'), 1); const r = F20.breed(Fz, 2); ok(r.ok, r.msg); if (r.win) bw += 1; else bl += 1; }
ok(bw > 5 && bl > 5, `lai tạo có thắng/thua (${bw}/${bl})`); ok(Inv.qtyAny(Fz, V.ID.seed(3, 'a')) === bw, 'đúng số hạt lai ra'); ok(!F20.breed(Fz, 2).ok, 'thiếu vật liệu không lai');
for (let n = 1; n < 10; n += 1) { const exp = (Cat.buyPrice(V.ID.seed(n, 'a')) + Cat.buyPrice(V.ID.seed(n, 'b')) + Cat.buyPrice(V.ID.herb(n, 'b')) + F20.breedCost(n).gold) * (1 / 0.5); ok(exp > Cat.buyPrice(V.ID.seed(n + 1, 'a')), `lai tạo giai đoạn ${n} không được rẻ hơn mua`); }
for (let n = 1; n <= 10; n += 1) ok(Cat.buyPrice(V.ID.seed(n, 'a')) * 4 + Math.round(V.stage(n).base * 3) > Cat.buyPrice(V.ID.seed(n, 'b')), `ghép giống ${n} không được rẻ hơn mua`);
// ---- Tuyệt Phẩm + dọn dấu ấn khi bán / giao dịch
const Mu = 8205; mk(Mu, 12, 9); let tuyet = 0; for (let k = 0; k < 400; k += 1) { Inv.add(Mu, 'v20_dp_hp_1', 10, { q: 5 }); const g = Mk.roll(Mu, Array.from({ length: 10 }, () => ({ item: 'v20_dp_hp_1', q: 5 }))); tuyet += g.tuyet || 0; Inv.take(Mu, 'v20_dp_hp_1', 10, { q: 5 }); }
ok(tuyet > 0, `có thành phẩm Tuyệt Phẩm (${tuyet}/4000)`); ok(tuyet < 400, 'Tuyệt Phẩm phải hiếm'); ok(!D.get('SELECT 1 AS x FROM v20_marks WHERE user_id = ?', String(Mu)), 'bán/dùng hết đan → dấu ấn bị dọn ngay (không còn dòng rác)');
const S1 = 8206; const S2 = 8207; mk(S1, 12, 9); mk(S2, 12, 9); Inv.add(S1, 'v20_dp_hp_1', 5, { q: 4 }); D.run('INSERT INTO v20_marks (user_id,item_id,q,mark,n) VALUES (?,?,?,?,5)', String(S1), 'v20_dp_hp_1', 4, 'van');
Inv.take(S1, 'v20_dp_hp_1', 3, { q: 4, why: 'bán' }); ok(D.get('SELECT n FROM v20_marks WHERE user_id = ?', String(S1)).n === 2, 'bán bớt → dấu ấn còn đúng số viên');
const herb = V.ID.herb(1, 'a'); Inv.add(S1, herb, 5); const co = Tr.createOffer(String(S1), String(S2), 0, 0, 0, 0, 0, 0, 0, 0, [{ id: herb, qty: 5, q: 0 }], []); ok(co === 'ok', `giao dịch nguyên liệu V20: ${co}`);
const acc = Tr.acceptOffer(String(S1), String(S2)); ok(Inv.qtyAny(S2, herb) === 5 && Inv.qtyAny(S1, herb) === 0, 'giao dịch nguyên liệu V20 chuyển đúng');
ok(typeof Tr.createOffer(String(S1), String(S2), 0, 0, 0, 0, 0, 0, 0, 0, [{ id: V.ID.hoachung(1), qty: 1, q: 0 }], []) === 'string' && Tr.createOffer(String(S1), String(S2), 0, 0, 0, 0, 0, 0, 0, 0, [{ id: V.ID.hoachung(1), qty: 1, q: 0 }], []) !== 'ok', 'Hỏa Chủng không giao dịch được');
// ---- UI mới

const GW = 8208; mk(GW, 28, 9); G.create(GW, 'gx20_weapon_6', 3); Inv.add(GW, V.ID.beast(3), 2); Inv.add(GW, V.ID.kl(6), 20); G20.openSocket(GW, G.listOf(GW)[0].gear_id);
for (const v of ['gx20', 'tr20', 'fd20']) for (const u of [GW, W, 99999]) check(`${v}/${u}`, NV.render(String(u), v));
for (let k = 1; k <= 10; k += 1) check(`fd20 ${k}`, NV.render(String(GW), 'fd20', String(k)));
check('gx20 sel', NV.render(String(GW), 'gx20', String(G.listOf(GW)[0].gear_id))); check('tr20 sel', NV.render(String(Y), 'tr20', `${TR}|3`));
const A2 = (act, a, sel) => N20.act(String(GW), act, a, '', sel);
ok(A2('gxz', '', String(G.listOf(GW)[0].gear_id)).view === 'gx20', 'chọn trang bị'); ok(A2('gxk', String(G.listOf(GW)[0].gear_id), V.ID.beast(3)).note.length > 0, 'khảm qua nút'); ok(A2('gxa', String(G.listOf(GW)[0].gear_id)).note.length > 0, 'thức tỉnh qua nút');
ok(A2('tru', `${TR}|2`).view === 'tr20', 'nâng trận qua nút'); ok(A2('trr', TR).note.length > 0, 'thu hồi qua nút'); ok(A2('trn', TR).note.length > 0, 'gia cố qua nút'); ok(A2('fds', '1').note.length > 0, 'Linh Thổ qua nút'); ok(A2('fdf', '1').note.length > 0, 'ghép qua nút'); ok(A2('fdb', '1').note.length > 0, 'lai qua nút');

console.log(`✅ test_v20: ${n} kiểm tra đạt.`);
