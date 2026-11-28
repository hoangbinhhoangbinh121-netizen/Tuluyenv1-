'use strict';
// V22.4.2 — hồi quy luyện đan: EXP nghề không bị chặn trần (không còn "+0 EXP"), tên buff đan đúng, thông báo nhận đan.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_cx_${Date.now()}.db`);
const assert = require('node:assert'); const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const Inv = require('../src/game/invsvc'); const Cat = require('../src/game/catalog17'); const X = require('../src/game/craft17');
const Dan = require('../src/game/dan17'); const NV = require('../src/ui/ngheViews');
const { C } = Cat; let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const u = 7001; Cu.createCultivator(u); D.run('UPDATE cultivators SET realm_index = 9, world_tier = 2, linh_thach = 900000000000 WHERE user_id = ?', u);
// 1. addExp tích luỹ vượt ngưỡng cấp kế
X.state(u, 'dan'); const nx = X.nextDef(1);
ok(X.addExp(u, 'dan', nx.exp - 5) === nx.exp - 5, 'cộng gần ngưỡng');
ok(X.addExp(u, 'dan', 50) === 50, 'cộng vượt ngưỡng vẫn nhận đủ 50 (không bị cắt)');
ok(X.state(u, 'dan').exp === nx.exp + 45, `EXP tích luỹ ${X.state(u, 'dan').exp}`);
ok(X.expFull(u, 'dan') === true, 'expFull khi đủ');
ok(X.addExp(u, 'dan', 0) === 0 && X.addExp(u, 'dan', -5) === 0, 'cộng 0/âm → 0');
// 2. nhận đan: thông báo có +EXP > 0 kể cả khi đã đủ ngưỡng
const r = C.RECIPES.find((x) => x.prof === 'dan' && x.lv === 1 && !x.q === false) || C.RECIPES.find((x) => x.prof === 'dan' && x.lv === 1);
for (const [k, q] of Object.entries(r.ing)) Inv.add(u, k, q * 5);
const before = X.state(u, 'dan').exp; const s = X.start(u, r.id, 1);
ok(s.ok, `start: ${s.msg}`);
D.run('UPDATE craft_jobs SET ready_at = 0 WHERE user_id = ?', String(u));
const msgs = X.claimAll(u, 'dan'); ok(msgs.length === 1, 'claimAll trả 1 thông báo');
const after = X.state(u, 'dan').exp; ok(after > before, `EXP tăng ${before}→${after}`);
ok(/\+[1-9][\d.,]* EXP/.test(msgs[0]), `thông báo có +EXP: ${msgs[0]}`);
ok(/đủ EXP/.test(msgs[0]), 'nhắc thăng cấp khi đủ EXP');
ok(!/chạm ngưỡng/.test(msgs[0]), 'không còn câu "chạm ngưỡng"');
// 3. gain tối thiểu ≥ 1 kể cả khi chế đồ cấp thấp ở nghề cấp cao
D.run("UPDATE prof_state SET level = 6 WHERE user_id = ? AND prof_id = 'dan'", String(u));
for (const [k, q] of Object.entries(r.ing)) Inv.add(u, k, q * 5);
const b2 = X.state(u, 'dan').exp; ok(X.start(u, r.id, 1).ok, 'start 2'); D.run('UPDATE craft_jobs SET ready_at = 0 WHERE user_id = ?', String(u)); X.claimAll(u, 'dan');
ok(X.state(u, 'dan').exp >= b2 + 1, 'EXP tăng ≥ 1 ở cấp cao');
// 4. Tàn Quyển
Inv.add(u, 'tdc_tan_quyen_dan_phuong', 2); const t = X.useTanQuyen(u); ok(t.ok && /\+[1-9]/.test(t.msg), `tàn quyển: ${t.msg}`);
// 5. tên buff đan đúng trên giao diện
const pillIds = Object.keys(C.PILLS).filter((k) => C.PILLS[k].k === 'buff' && C.PILLS[k].key).slice(0, 4);
const kinds = Object.keys(C.PILLS).filter((k) => C.PILLS[k].k === 'tamcanh');
for (const id of [...pillIds, ...kinds.slice(0, 1)]) Inv.add(u, id, 3, { q: 2 });
for (const id of [...pillIds, ...kinds.slice(0, 1)]) { const rr = Dan.use(u, id, 2, 1); ok(rr.ok, `dùng ${id}: ${rr.msg}`); }
const act = Dan.activeList(u); ok(act.length >= pillIds.length, 'có buff đang chạy');
const flat = (p) => JSON.stringify((p.embeds || []).map((e) => e.toJSON()));
const view = flat(NV.render(String(u), 'pill')); const home = flat(NV.render(String(u), 'home'));
for (const id of pillIds) { const name = Cat.I.BY_ID[id].name; ok(view.includes(name), `màn Dùng Đan hiện đúng tên "${name}"`); ok(home.includes(name), `Tổng Quan hiện đúng tên "${name}"`); }
if (kinds[0]) ok(view.includes(Cat.I.BY_ID[kinds[0]].name), 'đan tâm cảnh (khoá mặc định) hiện đúng tên');
// 6. admin quà nghề không còn báo "chạm ngưỡng"
const AG = require('../src/game/adminGift21'); ok(!/chạm ngưỡng/.test(require('node:fs').readFileSync(require.resolve('../src/game/adminGift21'), 'utf8')), 'admin gift không còn text cũ');
// 7. v22.4.3: TỰ ĐỘNG NHẬN thành phẩm khi lò xong (không cần bấm "Nhận")
{
  const w = 7002; Cu.createCultivator(w); D.run('UPDATE cultivators SET realm_index = 9, world_tier = 2, linh_thach = 900000000000 WHERE user_id = ?', w);
  const rr = C.RECIPES.find((x) => x.prof === 'dan' && x.lv === 1);
  for (const [k, q] of Object.entries(rr.ing)) Inv.add(w, k, q * 6);
  X.state(w, 'dan'); const e0 = X.state(w, 'dan').exp; const inv0 = Inv.qtyAny(w, rr.out.item);
  D.run("UPDATE prof_state SET level = 4 WHERE user_id = ? AND prof_id = 'dan'", String(w)); const s1 = X.start(w, rr.id, 1); ok(s1.ok, 'start đợt 1: ' + JSON.stringify(s1.msg)); D.run('DELETE FROM craft_cd WHERE user_id = ?', String(w)); const s2 = X.start(w, rr.id, 1); ok(s2.ok, 'start đợt 2: ' + s2.msg);
  ok(X.autoClaimReady() === 0, 'chưa tới giờ → chưa tự nhận'); ok(D.all("SELECT 1 FROM craft_jobs WHERE user_id = ? AND state = 'brewing'", String(w)).length === 2, 'vẫn đang luyện');
  D.run('UPDATE craft_jobs SET ready_at = 0 WHERE user_id = ?', String(w));
  ok(X.autoClaimReady() === 2, 'nền tự nhận 2 lệnh đã xong');
  ok(D.all("SELECT 1 FROM craft_jobs WHERE user_id = ? AND state = 'brewing'", String(w)).length === 0, 'hết lệnh đang luyện');
  ok(X.state(w, 'dan').exp > e0, `EXP đã cộng ${e0}→${X.state(w, 'dan').exp}`);
  ok(Inv.qtyAny(w, rr.out.item) > inv0 || X.state(w, 'dan').fails > 0, 'đan đã vào kho (hoặc mẻ thất bại có ghi nhận)');
  ok(X.autoClaimReady() === 0, 'không nhận lặp');
  const p1 = NV.render(String(w), 'hs.dan'); ok(/Tự động nhận thành phẩm/.test(p1.content || ''), 'mở bảng thấy thông báo tự nhận');
  const p2 = NV.render(String(w), 'hs.dan'); ok(!/Tự động nhận thành phẩm/.test(p2.content || ''), 'thông báo chỉ hiện 1 lần');
  // người chưa bấm gì, mở bảng khi lò vừa xong (chưa kịp vòng nền) vẫn được nhận ngay
  for (const [k, q] of Object.entries(rr.ing)) Inv.add(w, k, q * 2);
  const e1 = X.state(w, 'dan').exp; ok(X.start(w, rr.id, 1).ok, 'start đợt 3'); D.run('UPDATE craft_jobs SET ready_at = 0 WHERE user_id = ?', String(w));
  const p3 = NV.render(String(w), 'home'); ok(/Tự động nhận thành phẩm/.test(p3.content || '') && X.state(w, 'dan').exp > e1, 'mở bảng → nhận ngay + cộng EXP');
  // công tắc tắt
  require('../src/game/settings').set('autoclaim', 'off'); for (const [k, q] of Object.entries(rr.ing)) Inv.add(w, k, q * 2);
  ok(X.start(w, rr.id, 1).ok, 'start đợt 4'); D.run('UPDATE craft_jobs SET ready_at = 0 WHERE user_id = ?', String(w)); ok(X.autoClaimReady() === 0, 'autoclaim=off → không tự nhận');
  ok(X.claimAll(w).length === 1, 'nhận thủ công vẫn dùng được'); require('../src/game/settings').set('autoclaim', 'on');
}
// 8. v22.4.3: màn Dùng Đan phân trang — đan thường mới luyện không bị cắt khỏi danh sách (>25 loại)
{
  const w = 7003; Cu.createCultivator(w); D.run('UPDATE cultivators SET realm_index = 9, world_tier = 2 WHERE user_id = ?', w);
  const pills = Cat.I.ITEMS.filter((it) => it.cat === 'DAN_DUOC' && Dan.isPill(it.id)); ok(pills.length > 25, `đủ loại đan để thử (${pills.length})`);
  for (const it of pills) Inv.add(w, it.id, 2, { q: it.quality ? 3 : 0 });
  const low = pills.filter((it) => it.rarity === Math.min(...pills.map((x) => x.rarity)))[0];   // đan độ hiếm thấp nhất = bị cắt trước đây
  const opts = (pl) => pl.components.flatMap((r) => r.components || []).filter((c) => c.data && c.data.options && /psel/.test(c.data.custom_id)).flatMap((c) => c.data.options);
  const p0 = NV.render(String(w), 'pill'); const seen = new Set(opts(p0).map((o) => o.value.split(':')[0])); ok(opts(p0).length <= 25, 'trang 1 ≤ 25 lựa chọn');
  const total = Math.ceil(Inv.list(w).filter((x) => Dan.isPill(x.id) || x.item.cat === 'DAN_DUOC').length / 25); ok(total >= 2, `có ${total} trang`);
  for (let pg = 1; pg < total; pg += 1) for (const o of opts(NV.render(String(w), 'pill', `~${pg}`))) seen.add(o.value.split(':')[0]);
  ok(seen.has(low.id), `đan "${low.name}" (hiếm thấp nhất) xuất hiện ở một trang nào đó`);
  for (const it of pills) ok(seen.has(it.id), `${it.id} có trong danh sách phân trang`);
  const btnIds = (pl) => pl.components.flatMap((r) => r.components || []).map((c) => (c.data || {}).custom_id).filter(Boolean);
  ok(btnIds(p0).some((id) => /\|v\|pill\|~1$/.test(id)), 'có nút Trang sau'); const last = NV.render(String(w), 'pill', `~${total - 1}`); ok(btnIds(last).some((id) => /~\d+$/.test(id)), 'trang cuối có nút điều hướng');
  const sel = NV.render(String(w), 'pill', `${low.id}:${low.quality ? 3 : 0}`); ok(opts(sel).some((o) => o.default), 'chọn 1 đan → tự nhảy tới trang chứa nó và đánh dấu');
}
console.log(`PASS test_craft_exp225: ${n} checks`);
