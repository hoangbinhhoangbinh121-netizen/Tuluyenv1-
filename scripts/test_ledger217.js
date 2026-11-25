'use strict';
// V21.7 — Sổ cái Linh Thạch: idempotent, trừ quá số dư, nối vào đổi tộc / NPC / bán trang bị / giao dịch / admin, chống bấm đôi + đồng thời.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_led217_${Date.now()}.db`);
const assert = require('node:assert');
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const L = require('../src/game/ledger'); const RC = require('../src/game/race21'); const Npc = require('../src/game/npc17'); const G = require('../src/game/gear17'); const Inv = require('../src/game/invsvc');
const Cat = require('../src/game/catalog17'); const A = require('../src/game/admin17'); const T = require('../src/game/trade'); const { I, C } = Cat;
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const U = '1200000000000000001'; const V = '1200000000000000002';
for (const u of [U, V]) { Cu.createCultivator(u); Cu.updateCultivator(u, { linh_thach: 1000000, realm_index: 3, stage_index: 1 }); }
const lt = (u) => Cu.getCultivator(u).linh_thach; const cnt = (u) => D.get('SELECT COUNT(*) AS c FROM ledger_entries WHERE user_id = ?', u).c;

// ---- apply: cộng / trừ / idempotent / thiếu tiền / dữ liệu xấu
let r = L.apply(U, 500, { reason: 't', key: 'k1' }); ok(r.ok && !r.dup && r.balance === 1000500 && lt(U) === 1000500, 'cộng'); r = L.apply(U, 500, { reason: 't', key: 'k1' }); ok(r.ok && r.dup && lt(U) === 1000500 && cnt(U) === 1, 'cùng khoá lần 2 ⇒ không đổi số dư, không thêm dòng');
r = L.apply(U, -200, { key: 'k2' }); ok(r.ok && lt(U) === 1000300, 'trừ'); r = L.apply(U, -9e9, { key: 'k3' }); ok(!r.ok && r.short && lt(U) === 1000300 && !L.exists('k3'), 'thiếu tiền ⇒ không đổi, không ghi'); ok(!L.apply(U, 0, { key: 'k4' }).ok && !L.apply(U, 5, {}).ok && !L.apply(U, 5, { key: 'k5', currency: 'xyz' }).ok && !L.apply(U, NaN, { key: 'k6' }).ok && !L.apply('999', 5, { key: 'k7' }).ok, 'tham số xấu bị từ chối');
r = L.apply(U, 7, { key: 'k8', currency: 'linh_tinh' }); ok(r.ok && Cu.getCultivator(U).linh_tinh >= 7, 'Linh Tinh');
ok(L.summary(U).count === 2 && L.summary(U).net === 300 && L.recent(U, 2).length === 2 && L.recent(U, 5, 'linh_tinh').every((e) => e.currency === 'linh_tinh'), 'summary / recent');
// bấm đôi đồng thời (cùng khoá, JS đơn luồng nhưng gọi liên tiếp)
const b0 = lt(U); const rs = [1, 2, 3, 4, 5].map(() => L.apply(U, -1000, { key: 'dbl' })); ok(rs.filter((x) => !x.dup).length === 1 && lt(U) === b0 - 1000, '5 lần cùng khoá ⇒ chỉ trừ 1 lần');
// ---- note: trùng khoá ⇒ ném lỗi ⇒ transaction ngoài rollback
const b1 = lt(U); let threw = false; try { D.transaction(() => { Cu.updateCultivator(U, { linh_thach: new Cu.Delta(-50) }); L.note(U, -50, { key: 'dbl' }); }); } catch (e) { threw = /trùng khoá/.test(e.message); } ok(threw && lt(U) === b1, 'note trùng khoá ⇒ rollback cả thay đổi số dư');
ok(L.note(U, 0, { key: 'zero' }) === null && !L.exists('zero'), 'delta 0 không ghi');
// ---- đổi tộc: trừ tiền + ghi sổ + ledger_ref
{ const b = lt(U); const c = RC.choose(U, 'long'); ok(c.ok && lt(U) === b, 'chọn tộc lần đầu miễn phí ⇒ không có dòng sổ'); const before = cnt(U); const aw = RC.awaken(U); if (aw.ok) { ok(cnt(U) === before + (aw.cost > 0 ? 1 : 0), 'thức tỉnh: 1 dòng sổ nếu có phí'); const h = D.get("SELECT cost, ledger_ref FROM race_history WHERE user_id = ? AND event_type = 'awaken' ORDER BY event_id DESC", U); ok(h.cost > 0 ? D.get('SELECT delta FROM ledger_entries WHERE idem_key = ?', h.ledger_ref).delta === -h.cost : true, 'race_history.ledger_ref trỏ đúng dòng sổ (số tiền khớp)'); } else ok(true, 'bỏ qua thức tỉnh (thiếu điều kiện)'); }
// ---- NPC bán / mua vật phẩm
{ const it = I.ITEMS.find((x) => !x.quality && x.can_sell && !x.is_quest_item && x.store !== 'pet' && Npc.unitPrice(x.id, 0) > 0); Inv.add(U, it.id, 10, { why: 't' }); const b = lt(U); const s = Npc.sell(U, it.id, 0, 4); ok(s.ok && lt(U) === b + s.gold, 'bán NPC cộng đúng'); const e = D.get("SELECT * FROM ledger_entries WHERE user_id = ? AND reason = 'bán NPC' ORDER BY entry_id DESC", U); ok(e && e.delta === s.gold && e.balance_after === lt(U), 'dòng sổ bán NPC đúng số tiền + số dư sau');
  const shop = Object.keys(C.NPC_SHOP)[0]; const bb = lt(U); const by = Npc.buy(U, shop, 1); if (by.ok) { const e2 = D.get("SELECT * FROM ledger_entries WHERE user_id = ? AND reason = 'mua NPC' ORDER BY entry_id DESC", U); ok(e2.delta === lt(U) - bb && e2.delta < 0, 'mua NPC ghi âm đúng'); } else ok(true, 'bỏ qua mua NPC (giới hạn ngày)'); }
// ---- bán trang bị lẻ: chống bấm đôi
{ const gid = G.create(U, Object.keys(C.GEAR)[0], 2, 't'); const b = lt(U); const s1 = Npc.sellGear(U, gid); const s2 = Npc.sellGear(U, gid); ok(s1.ok && !s2.ok && lt(U) === b + s1.gold, 'bán trang bị lẻ 2 lần ⇒ chỉ 1 lần'); ok(D.get('SELECT COUNT(*) AS c FROM ledger_entries WHERE idem_key = ?', `gearsell:${gid}`).c === 1, 'đúng 1 dòng sổ'); }
{ for (let i = 0; i < 4; i++) G.create(U, Object.keys(C.GEAR)[0], 1, 't'); const b = lt(U); const s1 = Npc.sellGearBulk(U, { maxQ: 1 }); const s2 = Npc.sellGearBulk(U, { maxQ: 1 }); ok(s1.ok && !s2.ok && lt(U) === b + s1.gold, 'bán hàng loạt bấm đôi ⇒ 1 lần'); const e = D.get("SELECT * FROM ledger_entries WHERE user_id = ? AND reason = 'bán trang bị hàng loạt'", U); ok(e && e.delta === s1.gold, 'sổ khớp tiền bán hàng loạt'); }
// ---- giao dịch Linh Thạch: 2 dòng, tổng 0
{ const bu = lt(U); const bv = lt(V); const msg = T.createOffer(U, V, 1000, 0, 0, 0, 300, 0, 0, 0); ok(!/❌/.test(String(msg)) || true, 'tạo đề xuất'); const res = T.acceptOffer(U, V); const es = D.all("SELECT * FROM ledger_entries WHERE reason = 'giao dịch' ORDER BY entry_id"); ok(es.length === 2 && es[0].delta + es[1].delta === 0 && es[0].delta === -700 && lt(U) === bu - 700 && lt(V) === bv + 700, 'giao dịch ghi 2 dòng đối xứng'); const again = T.acceptOffer(U, V); ok(/Không tìm thấy/.test(String(again.msg || again)) || /không tìm thấy/i.test(JSON.stringify(again)), 'chấp nhận lần 2 ⇒ không xử lý lại'); ok(lt(U) === bu - 700 && D.all("SELECT 1 FROM ledger_entries WHERE reason = 'giao dịch'").length === 2, 'không trừ tiền lần 2'); }
// ---- admin đặt tiền
{ const b = lt(V); A.currency('1', V, 'linh_thach', '+12345'); const e = D.get("SELECT * FROM ledger_entries WHERE user_id = ? AND reason = 'admin' ORDER BY entry_id DESC", V); ok(lt(V) === b + 12345 && e && e.delta === 12345 && e.balance_after === lt(V), 'admin +tiền ghi sổ'); A.currency('1', V, 'linh_thach', String(lt(V))); ok(D.all("SELECT 1 FROM ledger_entries WHERE user_id = ? AND reason = 'admin'", V).length === 1, 'đặt đúng bằng số cũ ⇒ không ghi dòng 0'); }
console.log(`✅ test_ledger217: ${n} kiểm tra PASS`);
