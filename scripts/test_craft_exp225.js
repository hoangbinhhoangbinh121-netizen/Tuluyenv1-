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
console.log(`PASS test_craft_exp225: ${n} checks`);
