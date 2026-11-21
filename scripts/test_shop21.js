'use strict';
// V21.0 — Cửa Hàng Nguyên Bảo + đơn nạp: danh mục (trừ vật phẩm nhiệm vụ), giá, mua (kho/Truyền Thừa/Linh Thú/trang bị), ví không âm, đơn nạp (chờ → done 1 lần),
// chỉ admin xác nhận, hết hạn/huỷ, giao diện + bấm nút + biểu mẫu.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_s21_${Date.now()}.db`);
const assert = require('node:assert'); const fs = require('node:fs'); const path = require('node:path');
const D = require('../src/db'); D.initDb();
const { E } = require('../src/game/emoji'); for (const f of fs.readdirSync(path.join(__dirname, '..', 'assets', 'emoji'))) { const k = f.replace(/\.png$/, ''); E[k] = `<:tg7_${k}:123456789012345678>`; }
const K = require('../src/game/constants'); const Cu = require('../src/game/cultivator'); const Inv = require('../src/game/invsvc'); const Cat = require('../src/game/catalog17');
const G = require('../src/game/gear17'); const Pets = require('../src/game/pets'); const ST = require('../src/game/settings'); const S = require('../src/game/shop21');
const A = require('../src/game/admin17'); const SV = require('../src/ui/shop21Views'); const QV = require('../src/ui/quantriViews'); const kit = require('../src/ui/kit');
const FW = require('../src/commands/framework'); require('../src/commands/shop21');
const { I, C } = Cat; let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const ADMIN = '111111111111111111'; const P = '222222222222222222'; const Q = '333333333333333333'; const NOPE = '444444444444444444';
K.ADMIN_CODE_APPROVER_IDS.push(ADMIN);
Cu.createCultivator(P); Cu.createCultivator(Q); Cu.createCultivator(ADMIN);
const row = (u) => Cu.getCultivator(u);

// ---------------------------------------------------------------- 1) danh mục
const L = S.build().list;
ok(L.length >= 400, `số mặt hàng = ${L.length}`);
ok(I.ITEMS.filter((x) => x.is_quest_item).length >= 10 && I.ITEMS.filter((x) => x.is_quest_item).every((x) => !S.entry(`i:${x.id}`)), 'KHÔNG bán vật phẩm nhiệm vụ');
const sellable = I.ITEMS.filter((x) => !x.is_quest_item && S.GROUP_BY[x.cat]);
ok(sellable.every((x) => S.entry(`i:${x.id}`)), 'mọi vật phẩm kho không phải nhiệm vụ đều có trong cửa hàng');
ok(S.entry('t:truyen_thua') && /Truyền Thừa Ngọc Giản/.test(S.entry('t:truyen_thua').name) && S.entry('t:bao_the_chat') && S.entry('t:bao_linh_can'), 'có Truyền Thừa Ngọc Giản + Thiên Bảo');
ok(S.entry('p:bat_phu') && S.entry('p:ky_nang_gian'), 'có vật phẩm Linh Thú (kể cả Kỹ Năng Ngọc Giản)');
ok(Object.keys(C.GEAR).every((k) => S.entry(`g:${k}`)), 'mọi mẫu trang bị đều có bán');
ok(L.every((e) => Number.isInteger(S.price(e, 2)) && S.price(e, 2) >= 1), 'giá nguyên ≥ 1');
ok(L.every((e) => e.key.length <= 40), 'mã mặt hàng đủ ngắn cho customId');
const gk = (k) => S.listGroup(k).length; ok(S.GROUPS.every(([k]) => gk(k) > 0), 'mọi danh mục đều có hàng');
ok(S.price(S.entry('i:dan_tu_khi'), 5) > S.price(S.entry('i:dan_tu_khi'), 2) && S.price(S.entry('i:dan_tu_khi'), 1) < S.price(S.entry('i:dan_tu_khi'), 2), 'phẩm cao giá cao');
const cheap = S.entry('i:dan_tu_khi'); const exp = S.entry('i:tdc19_bat_hu_de_cot');
ok(S.price(exp, 2) > S.price(cheap, 2) * 5, 'đồ hiếm đắt hơn hẳn đồ thường');
ok(S.listGroup('', 'truyen thua').some((e) => e.key === 't:truyen_thua'), 'tìm không dấu "truyen thua"'); ok(S.listGroup('', 'ĐAN').length > 0, 'tìm có dấu');
// giá tăng theo tầng: đồ giai đoạn 10 đắt hơn giai đoạn 1 nhưng KHÔNG đắt gấp triệu lần
const hi = Math.max(...L.map((e) => S.price(e, 2))); const lo = Math.min(...L.map((e) => S.price(e, 2)));
ok(hi > lo && hi / lo < 20000, `dải giá hợp lý (${lo}…${hi})`);
ok(S.PACKAGES.map((p) => p.vnd).join() === '10000,20000,50000,100000', 'đủ 4 gói 10k/20k/50k/100k');
ok(S.PACKAGES.every((p, i, a) => i === 0 || S.pkgNb(p) / p.vnd >= S.pkgNb(a[i - 1]) / a[i - 1].vnd), 'gói lớn không lời kém gói nhỏ');

// ---------------------------------------------------------------- 2) ví + mua hàng
ok(S.balance(P) === 0, 'ví mới = 0');
let r = S.buy(P, 'i:dan_tu_khi', 2, 1); ok(!r.ok && /Cần/.test(r.msg) && Inv.qty(P, 'dan_tu_khi', 2) === 0, 'không đủ Nguyên Bảo → không mua, không phát hàng');
ok(!S.spend(P, 1, 'x') && S.balance(P) === 0, 'ví không bao giờ âm');
ok(S.credit(P, 100000, 'test') && S.balance(P) === 100000, 'cộng ví');
const b0 = S.balance(P);
r = S.buy(P, 'i:dan_tu_khi', 3, 5); ok(r.ok && Inv.qty(P, 'dan_tu_khi', 3) === 5 && b0 - S.balance(P) === S.price(S.entry('i:dan_tu_khi'), 3) * 5, 'mua đan có phẩm: đúng số lượng, đúng phẩm, đúng tiền');
const basic = I.ITEMS.find((x) => !x.quality && !x.is_quest_item && x.store === 'tbl' && x.can_sell); const k1 = `i:${basic.id}`;
const b1 = S.balance(P); r = S.buy(P, k1, 0, 10); ok(r.ok && Inv.qty(P, basic.id) === 10 && b1 - S.balance(P) === S.price(S.entry(k1), 0) * 10, 'mua vật phẩm thường');
const col = I.ITEMS.find((x) => x.store === 'col' && !x.quality && !x.is_quest_item && x.legacy_col && S.entry(`i:${x.id}`)); if (col) { const c0 = row(P)[col.legacy_col]; r = S.buy(P, `i:${col.id}`, 0, 3); ok(r.ok && row(P)[col.legacy_col] === c0 + 3, `vật phẩm lưu cột cũ (${col.legacy_col}) cũng nhận đúng`); }
const t0 = row(P).truyen_thua; const bT = S.balance(P); r = S.buy(P, 't:truyen_thua', 0, 2); ok(r.ok && row(P).truyen_thua === t0 + 2 && bT - S.balance(P) === S.price(S.entry('t:truyen_thua'), 0) * 2 && S.price(S.entry('t:truyen_thua'), 0) === 400, 'mua 2 Truyền Thừa Ngọc Giản → cột truyen_thua +2, trừ 800 💠');
r = S.buy(P, 't:bao_the_chat', 0, 1); ok(r.ok && row(P).bao_the_chat >= 1, 'Thiên Bảo Thể Chất');
const pq0 = Pets.itemQty(P, 'bat_phu'); r = S.buy(P, 'p:bat_phu', 0, 4); ok(r.ok && Pets.itemQty(P, 'bat_phu') === pq0 + 4, 'vật phẩm Linh Thú vào túi Linh Thú');
const gcount = G.listOf(P).length; r = S.buy(P, 'g:gx_thanh_phong', 4, 2); ok(r.ok && G.listOf(P).length === gcount + 2 && G.listOf(P).filter((g) => g.tpl === 'gx_thanh_phong' && g.q === 4).length === 2, 'mua trang bị: tạo đúng số món, đúng phẩm');
r = S.buy(P, 'g:gx20_weapon_6', 3, 1); ok(r.ok, 'mua trang bị giai đoạn V20');
// trần số lượng + sai mã + vật phẩm nhiệm vụ
ok(!S.buy(P, 'i:tdc_thien_dao_thach', 0, 1).ok, 'không mua được Thiên Đạo Thạch (nhiệm vụ)'); ok(!S.buy(P, 'i:khong_co', 0, 1).ok, 'mã lạ'); ok(!S.buy(P, k1, 0, 0).ok && !S.buy(P, k1, 0, -5).ok, 'số lượng ≤ 0');
S.credit(Q, 10 ** 7, 'test'); const gq = G.listOf(Q).length; r = S.buy(Q, 'g:gx_thanh_phong', 3, 999); ok(r.ok && G.listOf(Q).length === gq + S.MAX_QTY.gear, `trần ${S.MAX_QTY.gear} món trang bị / lần`);
// kho đầy: chỉ tính tiền phần nhận được
const stackItem = I.ITEMS.find((x) => !x.quality && !x.is_quest_item && x.store === 'tbl' && x.stack_limit <= 999); if (stackItem) {
  Inv.add(Q, stackItem.id, stackItem.stack_limit - 3, { why: 'test' }); const bq = S.balance(Q); r = S.buy(Q, `i:${stackItem.id}`, 0, 50);
  ok(r.ok && r.got === 3 && bq - S.balance(Q) === S.price(S.entry(`i:${stackItem.id}`), 0) * 3, 'kho gần đầy: chỉ nhận & tính tiền phần còn chỗ');
  const bq2 = S.balance(Q); r = S.buy(Q, `i:${stackItem.id}`, 0, 5); ok(!r.ok && S.balance(Q) === bq2, 'kho đầy: không trừ Nguyên Bảo'); }
// sổ cái khớp số dư
const led = (u) => D.get('SELECT COALESCE(SUM(delta),0) AS s FROM v21_ledger WHERE user_id = ?', u).s; ok(led(P) === S.balance(P) && led(Q) === S.balance(Q), 'sổ cái = số dư');
ok(D.get('SELECT COUNT(*) AS n FROM v21_buys WHERE user_id = ?', P).n >= 6, 'ghi nhật ký mua');
// hệ số giá & ẩn hàng & đóng cửa hàng
const base = S.price(S.entry(k1), 0); ok(S.setMult(ADMIN, '2').ok && S.price(S.entry(k1), 0) >= base * 2 - 1 && !S.setMult(ADMIN, '0').ok && !S.setMult(ADMIN, '99').ok, 'hệ số giá ×2 (chặn 0 và 99)'); S.setMult(ADMIN, '1');
ok(S.toggleHide(ADMIN, 't:truyen_thua').ok && !S.listGroup('TALENT').some((e) => e.key === 't:truyen_thua') && !S.buy(P, 't:truyen_thua', 0, 1).ok, 'ẩn hàng → không hiện, không mua'); ok(S.toggleHide(ADMIN, 't:truyen_thua').ok && S.buy(P, 't:truyen_thua', 0, 1).ok, 'hiện lại');
ok(S.setOpen(ADMIN, false).ok && !S.buy(P, k1, 0, 1).ok && !S.createOrder(P, 10000).ok, 'đóng cửa hàng chặn mua + nạp'); S.setOpen(ADMIN, true);
ok(S.findEntry('Truyền Thừa Ngọc Giản') && S.findEntry('i:dan_tu_khi') && !S.findEntry('zzzxxx'), 'admin tìm hàng theo tên/mã');

// ---------------------------------------------------------------- 3) đơn nạp
ok(S.qrFile() && /qr_nap\.jpg$/.test(S.qrFile()) && S.payReady() && S.ownerName() === 'HOANG SAO AN BINH', 'có sẵn mã QR tĩnh của shop trong gói');
ok(fs.statSync(S.qrFile()).size < 150000, 'ảnh QR nhỏ gọn');
process.env.SHOP_QR_FILE = '/khong/ton/tai.jpg'; const R0 = S.createOrder(P, 10000); ok(!R0.ok && /chưa cài/.test(R0.msg) && !S.payReady(), 'không QR + không tài khoản → chưa tạo được đơn'); check('nạp chưa cài', SV.render(P, 'topup')); delete process.env.SHOP_QR_FILE;
{ const o = S.createOrder(P, 10000); ok(o.ok, 'có QR tĩnh → tạo đơn được'); const v = SV.render(P, 'order', String(o.id)); check('đơn QR tĩnh', v); ok(v.files && v.files.length === 1 && v.files[0].name === 'qr_nap.jpg' && v.attachments.length === 0, 'đơn đính kèm ảnh QR'); const j = JSON.stringify(v.embeds[0].toJSON()); ok(j.includes('attachment://qr_nap.jpg') && j.includes(`TG${o.id}`) && j.includes('HOANG SAO AN BINH'), 'đơn hiện QR + mã TG + tên chủ TK'); S.cancelOwn(P, o.id); }
ok(!S.setBank(ADMIN, '', '123', 'A').ok && S.setBank(ADMIN, 'MB', '0123456789', 'NGUYEN VAN A').ok && S.bank().ready, 'cài tài khoản nhận tiền');
ok(!S.createOrder(P, 12345).ok && !S.createOrder(P, -10000).ok, 'chỉ nhận đúng 4 gói');
const bal0 = S.balance(P); const o1 = S.createOrder(P, 50000); ok(o1.ok && o1.order.status === 'pending' && o1.order.nb === 550 && S.balance(P) === bal0, 'tạo đơn 50k → 550 Nguyên Bảo, CHƯA cộng');
ok(/^https:\/\/img\.vietqr\.io\/image\/MB-0123456789-compact2\.png\?amount=50000&addInfo=TG\d+/.test(S.qrUrl(o1.order)), 'mã VietQR đúng số tiền + nội dung');
ok(S.claim(P, o1.id).ok && S.order(o1.id).claimed === 1 && S.balance(P) === bal0, 'báo đã chuyển KHÔNG cộng tiền'); ok(!S.claim(Q, o1.id).ok, 'người khác không báo thay được');
ok(!S.cancelOwn(P, o1.id).ok, 'đã báo chuyển thì không tự huỷ'); ok(!S.confirm(ADMIN, 999999).ok, 'đơn không tồn tại');
const c1 = S.confirm(ADMIN, o1.id); ok(c1.ok && S.balance(P) === bal0 + 550 && S.order(o1.id).status === 'done', 'done đơn → cộng đúng 550');
const c2 = S.confirm(ADMIN, o1.id); ok(!c2.ok && S.balance(P) === bal0 + 550, 'done lần 2 KHÔNG cộng thêm (idempotent)');
ok(S.wallet(P).topped === 550 && S.wallet(P).vnd === 50000, 'ví ghi tổng đã nạp'); ok(led(P) === S.balance(P), 'sổ cái vẫn khớp sau khi nạp');
for (const [vndv, nb] of [[10000, 100], [20000, 210], [100000, 1150]]) { const o = S.createOrder(Q, vndv); ok(o.ok && o.order.nb === nb, `gói ${vndv} → ${nb}`); S.cancelOwn(Q, o.id); }
// tối đa 3 đơn chờ
const ids = []; for (let k = 0; k < 3; k += 1) { const o = S.createOrder(NOPE === Q ? P : Q, 10000); ok(o.ok, `đơn chờ ${k + 1}`); ids.push(o.id); } ok(!S.createOrder(Q, 10000).ok, 'quá 3 đơn chờ bị chặn');
// huỷ bởi admin; đơn đã huỷ không done được
ok(S.adminCancel(ADMIN, ids[0], 'sai tiền').ok && S.order(ids[0]).status === 'cancelled' && !S.confirm(ADMIN, ids[0]).ok && !S.adminCancel(ADMIN, ids[0]).ok, 'admin huỷ đơn; đơn huỷ không done được');
ok(S.cancelOwn(Q, ids[1]).ok && S.order(ids[1]).status === 'cancelled', 'người chơi tự huỷ đơn chưa báo chuyển');
// hết hạn 24 giờ: tự chuyển expired; admin vẫn xác nhận được nếu khách chuyển muộn
D.run('UPDATE v21_orders SET created_at = ? WHERE id = ?', Math.floor(Date.now() / 1000) - 25 * 3600, ids[2]); ok(S.pendingOrders().every((o) => o.id !== ids[2]) && S.order(ids[2]).status === 'expired', 'đơn quá 24 giờ → hết hạn');
const qb = S.balance(Q); ok(S.confirm(ADMIN, ids[2]).ok && S.balance(Q) === qb + 100, 'khách chuyển muộn: admin vẫn done được, cộng đúng 1 lần'); ok(!S.confirm(ADMIN, ids[2]).ok && S.balance(Q) === qb + 100, 'không cộng đôi');
// cộng/trừ thủ công
ok(S.adminGrant(ADMIN, P, 100, 'tặng').ok && S.adminGrant(ADMIN, P, -50, '').ok && S.balance(P) === bal0 + 550 + 50, 'admin cộng/trừ'); ok(!S.adminGrant(ADMIN, P, -1e9, '').ok, 'không trừ quá số dư'); ok(!S.adminGrant(ADMIN, P, 0, '').ok && !S.adminGrant(ADMIN, '999999999999999999', 5, '').ok, '0 / người lạ');
ok(led(P) === S.balance(P) && led(Q) === S.balance(Q), 'sổ cái khớp sau mọi thao tác'); const st = S.stats(); ok(st.all.v === 50000 + 10000 && st.all.n === 2 && st.today.n === 2, 'thống kê doanh thu');
ok(A.recent(500).some((x) => x.action === 'shop_done') && A.recent(500).some((x) => x.action === 'shop_grant'), 'ghi Nhật Ký Admin');

// ---------------------------------------------------------------- 4) giao diện
function check(label, p) {
  assert.ok(p && Array.isArray(p.components), `${label}: thiếu components`);
  let total = 0; for (const e of (p.embeds || [])) { const j = e.toJSON(); total += (j.title || '').length + (j.description || '').length + (j.footer?.text || '').length + (j.fields || []).reduce((s, f) => s + f.name.length + f.value.length, 0); assert.ok((j.description || '').length <= 4096, `${label}: mô tả`); } assert.ok(total <= 6000, `${label}: embed ${total}`);
  if (typeof p.content === 'string') assert.ok(p.content.length <= 2000, `${label}: content`);
  assert.ok(p.components.length >= 1 && p.components.length <= 5, `${label}: hàng ${p.components.length}`);
  for (const r of p.components) { const cs = r.components; assert.ok(cs.length >= 1 && cs.length <= 5, `${label}: thành phần`); for (const c of cs) { const d = c.data || {}; if (d.label !== undefined) assert.ok(String(d.label).length >= 1 && String(d.label).length <= 80, `${label}: nhãn`); assert.ok(String(d.custom_id || '').length >= 1 && String(d.custom_id).length <= 100, `${label}: custom_id ${d.custom_id}`);
    if (d.options) { assert.ok(d.options.length >= 1 && d.options.length <= 25, `${label}: số lựa chọn`); const vs = d.options.map((o) => o.value); assert.ok(new Set(vs).size === vs.length, `${label}: trùng value`); for (const o of d.options) { assert.ok(String(o.label).length <= 100 && String(o.value).length <= 100 && String(o.description || '').length <= 100, `${label}: option`); assert.ok(typeof o.default === 'boolean' || o.default === undefined, 'default'); assert.ok(!o.emoji || typeof o.emoji === 'object', 'emoji obj'); } } } }
  n += 1;
}
const R = SV.render; check('home', R(P, 'home')); check('topup', R(P, 'topup')); check('orders', R(P, 'orders')); check('order', R(Q, 'order', String(ids[2]))); check('order lạ', R(P, 'order', '99999'));
const pend = S.createOrder(P, 20000); check('order chờ', R(P, 'order', String(pend.id)));
ok(/Không tìm thấy đơn/.test(R(Q, 'order', String(pend.id)).content), 'không xem được đơn của người khác'); ok(!JSON.stringify(R(Q, 'order', String(pend.id))).includes('0123456789'), 'đơn người khác không lộ số tài khoản');
for (const [k] of S.GROUPS) { const all = S.listGroup(k); const pages = Math.ceil(all.length / 8); for (let pg = 0; pg < pages; pg += 1) check(`list ${k} ${pg}`, R(P, 'list', `${k}:${pg}:`)); }
check('list ALL', R(P, 'list', 'ALL:0:')); check('list tìm', R(P, 'list', 'ALL:0:ngoc gian')); check('list rỗng', R(P, 'list', 'ALL:0:zzzxxx')); check('list trang quá', R(P, 'list', 'DAN_DUOC:99:'));
for (const e of L) { if (e.key.length > 0) { const v = R(P, 'item', e.key, '3'); assert.ok(v.embeds.length === 1); } } n += 1;
for (const k of ['i:dan_tu_khi', 't:truyen_thua', 'p:bat_phu', 'g:gx20_weapon_10', 'i:tdc19_bat_hu_de_cot', 'i:v20_hc_10']) { check(`item ${k}`, R(P, 'item', k, '2')); check(`item ${k} q5`, R(P, 'item', k, '5')); }
check('item lạ', R(P, 'item', 'i:khong_co'));
for (const [v] of QV.NAV) check(`quantri ${v}`, QV.render(ADMIN, v)); check('quantri dn chọn đơn', QV.render(ADMIN, 'dn', '', String(pend.id)));
// lệnh: /cuahang là slash, /nap là lệnh chữ; tổng slash vẫn ≤ 100
const slash = FW.buildSlashJson().map((s) => s.name); ok(slash.includes('cuahang') && !slash.includes('nap') && FW.registry.get('nap').prefixOnly, '/cuahang slash, ?nap chỉ lệnh chữ'); ok(slash.length <= 100, `số lệnh slash = ${slash.length}`);

(async () => {
  const mk = (cid, who, values) => { const calls = []; const i = { customId: cid, user: { id: who }, values, client: { users: { fetch: async () => ({ send: async (p) => { calls.push(['dm', p]); } }) }, channels: { fetch: async () => ({ send: async () => {} }) } }, guildId: '1', channelId: '2', deferred: false, replied: false, update: async (p) => { calls.push(['update', p]); }, reply: async (p) => { calls.push(['reply', p]); }, showModal: async (m) => { calls.push(['modal', m]); } }; return { i, calls }; };
  const click = async (cid, who, values) => { const { i, calls } = mk(cid, who, values); await kit.routeComponent(i); return calls; };
  // người chơi: duyệt → mua → nạp → báo chuyển
  let c = await click(`sp|${P}|home|`, P); ok(c[0][0] === 'update', 'mở trang chủ'); check('click home', c[0][1]);
  c = await click(`sp|${P}|nav|`, P, ['GEAR']); ok(c[0][0] === 'update', 'chọn danh mục'); check('click nav', c[0][1]);
  c = await click(`sp|${P}|it|GEAR:0:`, P, ['g:gx_thanh_phong']); check('click item', c[0][1]);
  const gb = G.listOf(P).length; c = await click(`sp|${P}|buy|g:gx_thanh_phong:3|1`, P); ok(c[0][0] === 'update' && G.listOf(P).length === gb + 1 && /Đã mua/.test(c[0][1].content), 'nút Mua ×1'); check('sau mua', c[0][1]);
  c = await click(`sp|${P}|qs|g:gx_thanh_phong`, P, ['5']); check('đổi phẩm', c[0][1]);
  c = await click(`sp|${Q}|buy|g:gx_thanh_phong:3|1`, P); ok(c[0][0] === 'reply' && /không phải bảng của bạn/.test(c[0][1].content), 'người khác bấm nút của bạn bị chặn');
  c = await click(`sp|${P}|find|`, P); ok(c[0][0] === 'modal', 'mở ô tìm kiếm');
  c = await click(`sp|${P}|topv|`, P); check('nạp', c[0][1]);
  const cnt = D.get("SELECT COUNT(*) AS n FROM v21_orders WHERE user_id = ? AND status = 'pending'", P).n;
  c = await click(`sp|${P}|top|100000`, P); ok(c[0][0] === 'update' && D.get("SELECT COUNT(*) AS n FROM v21_orders WHERE user_id = ? AND status = 'pending'", P).n === cnt + 1, 'nút gói 100k tạo đơn'); check('đơn mới', c[0][1]);
  const mine = D.get("SELECT id FROM v21_orders WHERE user_id = ? AND status = 'pending' ORDER BY id DESC", P).id;
  const calls0 = await click(`sp|${P}|paid|${mine}`, P); ok(calls0[0][0] === 'update' && S.order(mine).claimed === 1, 'nút "Tôi đã chuyển"'); ok(S.balance(P) === led(P), 'báo chuyển không cộng tiền');
  c = await click(`sp|${P}|ords|`, P); check('đơn của tôi', c[0][1]); c = await click(`sp|${P}|osel|`, P, [String(mine)]); check('mở đơn', c[0][1]);
  // người chơi KHÔNG thể done đơn: nút admin của quantri bị chặn
  const before = S.balance(P);
  for (const who of [P, NOPE]) { c = await click(`qt|${who}|dok|${mine}`, who); ok(c[0][0] === 'reply' && /admin/.test(c[0][1].content) && S.balance(P) === before && S.order(mine).status === 'pending', 'người thường không done đơn được'); }
  c = await click(`qt|${ADMIN}|dok|${mine}`, P); ok(c[0][0] === 'reply' && S.balance(P) === before, 'mượn bảng admin của người khác cũng không được');
  // admin: mở tab, chọn đơn, done
  c = await click(`qt|${ADMIN}|nav|`, ADMIN, ['dn']); ok(c[0][0] === 'update'); check('quantri dn', c[0][1]);
  c = await click(`qt|${ADMIN}|dsel|`, ADMIN, [String(mine)]); ok(c[0][0] === 'update' && JSON.stringify(c[0][1]).includes(`Done đơn #${mine}`), 'chọn đơn hiện nút Done'); check('quantri dn chọn', c[0][1]);
  c = await click(`qt|${ADMIN}|dok|${mine}`, ADMIN); ok(c.some((x) => x[0] === 'update') && S.balance(P) === before + 1150 && S.order(mine).status === 'done', 'admin bấm Done → cộng 1150'); ok(c.some((x) => x[0] === 'dm' && /1\.150/.test(String(x[1].content))), 'nhắn riêng người chơi khi done');
  c = await click(`qt|${ADMIN}|dok|${mine}`, ADMIN); ok(S.balance(P) === before + 1150, 'bấm Done lần 2 không cộng thêm');
  const p2 = S.createOrder(P, 10000); c = await click(`qt|${ADMIN}|dno|${p2.id}`, ADMIN); ok(S.order(p2.id).status === 'cancelled', 'admin huỷ đơn bằng nút');
  // biểu mẫu admin
  const submit = async (act, vals) => { const calls = await click(`qt|${ADMIN}|m|${act}`, ADMIN); ok(calls[0][0] === 'modal', `mở modal ${act}`); const mm = calls[0][1]; const mid = mm.id || (mm.toJSON ? mm.toJSON().custom_id : mm.data.custom_id); const out = [];
    const mi = { customId: mid, user: { id: ADMIN }, client: mk('x', ADMIN).i.client, guildId: '1', channelId: '2', fields: { getTextInputValue: (id) => (vals[id] === undefined ? '' : vals[id]) }, reply: async (p) => { out.push(p); }, deferred: false, replied: false };
    await kit.routeModal(mi); ok(out.length === 1 && String(out[0].content).length > 0, `nộp modal ${act}`); return out[0].content; };
  ok(/Đã lưu/.test(await submit('bank', { a: 'VCB', b: '999888777', c: 'TRAN THI B' })) && S.bank().id === 'VCB', 'modal tài khoản');
  const p3 = S.createOrder(Q, 10000); const qb3 = S.balance(Q); ok(/done đơn/.test(await submit('dcode', { o: `TG${p3.id}`, n: 'ok' })) && S.balance(Q) === qb3 + 100, 'modal Done theo mã TG<số>'); ok(/đã được xác nhận/.test(await submit('dcode', { o: String(p3.id) })), 'Done theo mã lần 2 bị từ chối');
  ok(/Cộng/.test(await submit('dgrant', { u: P, n: '25', w: 'thưởng' })), 'modal cộng 💠'); ok(/số dư/.test(await submit('dwal', { u: P })), 'modal xem ví'); ok(/×3/.test(await submit('dprice', { a: '3', b: '' })) && S.mult() === 3, 'modal hệ số giá'); await submit('dprice', { a: '1', b: '' }); ok(/ẩn/i.test(await submit('dhide', { k: 'Kỹ Năng Ngọc Giản' })), 'modal ẩn hàng'); await submit('dhide', { k: 'Kỹ Năng Ngọc Giản' });
  ok(/ĐÓNG/.test(await submit('dprice', { a: '', b: 'dong' })) && !S.shopOn(), 'modal đóng cửa hàng'); await submit('dprice', { a: '', b: 'mo' }); ok(S.shopOn(), 'mở lại');
  // lệnh chữ
  const sent = []; const ctx = { user: { id: P }, send: async (p) => { sent.push(p); } }; await FW.registry.get('nap').run(ctx); await FW.registry.get('cuahang').run(ctx); ok(sent.length === 2 && sent.every((p) => p.embeds && p.components), 'lệnh ?nap / /cuahang (dạng chữ)');
  // ================================================================ v21.2 — `.od` đơn mua trực tiếp
  D.run("UPDATE v21_orders SET status = 'cancelled' WHERE status = 'pending'");
  const C1 = '555555555555555555'; const C2 = '666666666666666666'; Cu.createCultivator(C1); Cu.createCultivator(C2);
  ok(S.resolveItem('truyền thừa').entry?.key === 't:truyen_thua' && S.resolveItem('truyen thua').entry?.key === 't:truyen_thua' && S.resolveItem('T:truyen_thua').entry?.key === 't:truyen_thua', 'tìm "truyền thừa" (có/không dấu, theo mã)');
  ok(S.resolveItem('đan').many && S.resolveItem('đan').many.length <= 10 && S.resolveItem('zzzxxx').none && S.resolveItem('i:khong_co').none && S.resolveItem('').none, 'nhiều kết quả / không thấy');
  ok(S.resolveItem('i:dan_tu_khi').entry.key === 'i:dan_tu_khi', 'theo mã i:');
  // tạo đơn + giao hàng
  let io = S.createItemOrder(C1, 't:truyen_thua', 0, 2); ok(io.ok && io.order.kind === 'item' && io.order.vnd === 80000 && io.order.item_qty === 2 && io.order.status === 'pending', '2 Truyền Thừa = 800 💠 = 80.000đ');
  ok(/Truyền Thừa Ngọc Giản/.test(S.orderText(io.order)) && /80\.000đ/.test(S.orderText(io.order)), 'mô tả đơn');
  const w0 = JSON.stringify(S.wallet(C1)); const tt0 = row(C1).truyen_thua;
  ok(row(C1).truyen_thua === tt0, 'tạo đơn chưa giao hàng');
  const cd = S.confirm(ADMIN, io.id); ok(cd.ok && cd.delivered === 2 && row(C1).truyen_thua === tt0 + 2 && JSON.stringify(S.wallet(C1)) === w0, 'Done → giao 2 Truyền Thừa, KHÔNG đụng ví');
  ok(!S.confirm(ADMIN, io.id).ok && row(C1).truyen_thua === tt0 + 2, 'Done lần 2 không giao thêm');
  ok(D.get("SELECT COUNT(*) AS n FROM v21_buys WHERE user_id = ? AND key = 't:truyen_thua'", C1).n === 1, 'ghi nhật ký mua');
  // phẩm + trang bị
  io = S.createItemOrder(C1, 'i:dan_tu_khi', 4, 10); ok(io.ok && io.order.vnd === S.price(S.entry('i:dan_tu_khi'), 4) * 10 * 100 && io.order.item_q === 4, 'đơn đan có phẩm: giá theo phẩm');
  ok(S.confirm(ADMIN, io.id).ok && Inv.qty(C1, 'dan_tu_khi', 4) === 10, 'giao đúng phẩm');
  io = S.createItemOrder(C1, 'g:gx_thanh_phong', 5, 2); const gc = G.listOf(C1).length; ok(io.ok && S.confirm(ADMIN, io.id).ok && G.listOf(C1).length === gc + 2 && G.listOf(C1).filter((g) => g.q === 5).length >= 2, 'giao trang bị phẩm 5');
  // tối thiểu 1.000đ, trần số lượng
  const cheapest = S.build().list.filter((e) => e.kind === 'inv').sort((x, y) => S.price(x, 0) - S.price(y, 0))[0]; io = S.createItemOrder(C2, cheapest.key, 0, 1); ok(io.ok && io.order.vnd === 1000, 'đơn nhỏ nhất làm tròn lên 1.000đ'); S.cancelOwn(C2, io.id);
  io = S.createItemOrder(C2, 'g:gx_thanh_phong', 3, 999); ok(io.ok && io.order.item_qty === S.MAX_QTY.gear, 'trần số lượng theo loại'); S.cancelOwn(C2, io.id);
  // kho đầy → hoàn phần chưa giao thành Nguyên Bảo
  if (stackItem) { Inv.add(C2, stackItem.id, stackItem.stack_limit - 3, { why: 'test' }); io = S.createItemOrder(C2, `i:${stackItem.id}`, 0, 50); const nb0 = S.balance(C2); const cc = S.confirm(ADMIN, io.id);
    ok(cc.ok && cc.delivered === 3 && cc.refunded && S.balance(C2) === nb0 + S.price(S.entry(`i:${stackItem.id}`), 0) * 47, 'kho chỉ nhận 3/50 → hoàn 47 phần thành 💠 vào ví'); ok(led(C2) === S.balance(C2), 'sổ cái khớp'); }
  // từ chối
  ok(!S.createItemOrder('999999999999999999', 't:truyen_thua', 0, 1).ok, 'khách chưa tu tiên'); ok(!S.createItemOrder(C1, 'i:tdc_thien_dao_thach', 0, 1).ok, 'không đặt được vật phẩm nhiệm vụ'); ok(!S.createItemOrder(C1, 'i:khong_co', 0, 1).ok, 'mã lạ');
  S.toggleHide(ADMIN, 't:truyen_thua'); ok(!S.createItemOrder(C1, 't:truyen_thua', 0, 1).ok, 'hàng bị ẩn không đặt được'); S.toggleHide(ADMIN, 't:truyen_thua');
  S.setOpen(ADMIN, false); ok(!S.createItemOrder(C1, 't:truyen_thua', 0, 1).ok, 'cửa hàng đóng'); S.setOpen(ADMIN, true);
  for (let k = 0; k < 3; k += 1) ok(S.createItemOrder(C1, 't:bao_the_chat', 0, 1).ok, `đơn chờ ${k + 1}`); ok(!S.createItemOrder(C1, 't:bao_the_chat', 0, 1).ok, 'khách tối đa 3 đơn chờ'); ok(S.createItemOrder(C1, 't:bao_the_chat', 0, 1, { bypassLimit: true }).ok, 'admin tạo hộ vượt hạn mức'); D.run("UPDATE v21_orders SET status = 'cancelled' WHERE status = 'pending'");
  // lệnh .od
  const mkCtx = (who, content, mentions = []) => { const sent = []; return { sent, ctx: { user: { id: who }, message: { content, mentions: { users: new Map(mentions.map((id) => [id, { id, bot: false }])) } }, send: async (p) => { sent.push(p); } } }; };
  const od = FW.registry.get('od'); ok(od && od.prefixOnly && !slash.includes('od'), 'od là lệnh chữ (không tốn slot slash)');
  let m = mkCtx(C1, '.od'); await od.run(m.ctx); ok(/Cách dùng/.test(String(m.sent[0])), '.od trống → hướng dẫn');
  m = mkCtx(C1, '.od truyền thừa x2'); await od.run(m.ctx); ok(m.sent.length === 1 && m.sent[0].embeds && m.sent[0].components.length === 1, '.od truyền thừa x2 → thẻ đơn'); const oc = D.get("SELECT * FROM v21_orders WHERE user_id = ? AND kind = 'item' AND status = 'pending' ORDER BY id DESC", C1); ok(oc && oc.item_key === 't:truyen_thua' && oc.item_qty === 2 && oc.vnd === 80000, 'đơn tạo cho chính người gõ');
  ok((m.sent[0].files?.length === 1 || JSON.stringify(m.sent[0].embeds[0].toJSON()).includes('img.vietqr.io')) && JSON.stringify(m.sent[0].embeds[0].toJSON()).includes(`TG${oc.id}`), 'thẻ có QR (ảnh đính kèm hoặc VietQR động) + mã TG'); check('thẻ .od', m.sent[0]);
  m = mkCtx(C1, `.od thiên bảo thể chất <@${C2}>`, [C2]); await od.run(m.ctx); ok(/Chỉ admin/.test(String(m.sent[0])) && !D.get("SELECT 1 AS x FROM v21_orders WHERE user_id = ? AND item_key = 't:bao_the_chat' AND status = 'pending'", C2), 'người thường @người khác bị từ chối');
  m = mkCtx(ADMIN, `.od thiên bảo thể chất <@${C2}>`, [C2]); await od.run(m.ctx); const oc2 = D.get("SELECT * FROM v21_orders WHERE user_id = ? AND item_key = 't:bao_the_chat' AND status = 'pending'", C2); ok(oc2 && m.sent[0].embeds, 'admin tạo hộ khách bằng @');
  m = mkCtx(ADMIN, '.od đan x3'); await od.run(m.ctx); ok(/\.od i:/.test(String(m.sent[0])) && /khớp/.test(String(m.sent[0])), 'tên mơ hồ → liệt kê mã để chọn');
  m = mkCtx(C1, '.od zzzxxx'); await od.run(m.ctx); ok(/Không tìm thấy/.test(String(m.sent[0])), 'không thấy vật phẩm');
  m = mkCtx(C1, '.od tdc_thien_dao_thach'); await od.run(m.ctx); ok(/Không tìm thấy/.test(String(m.sent[0])), 'vật phẩm nhiệm vụ không đặt được qua .od');
  m = mkCtx(C1, '.od i:dan_tu_khi p3 x5'); await od.run(m.ctx); const oc3 = D.get("SELECT * FROM v21_orders WHERE user_id = ? AND item_key = 'i:dan_tu_khi' AND status = 'pending'", C1); ok(oc3 && oc3.item_q === 3 && oc3.item_qty === 5, 'tham số p3 x5');
  ok(fs.readFileSync(path.join(__dirname, '..', 'src', 'bot.js'), 'utf8').includes('/^\\.od(\\s|$)/i') , 'bot.js nhận tiền tố "." riêng cho .od');
  // nút trên thẻ đơn
  D.run("UPDATE v21_orders SET status = 'cancelled' WHERE status = 'pending' AND id <> ?", oc.id);
  c = await click(`od|${oc.id}|paid`, C2); ok(c[0][0] === 'reply' && S.order(oc.id).claimed === 0, 'người khác không báo chuyển thay khách');
  c = await click(`od|${oc.id}|paid`, C1); ok(c[0][0] === 'update' && S.order(oc.id).claimed === 1, 'khách báo đã chuyển'); check('thẻ sau báo', c[0][1]);
  const tt1 = row(C1).truyen_thua; c = await click(`od|${oc.id}|done`, C1); ok(c[0][0] === 'reply' && /admin/.test(c[0][1].content) && row(C1).truyen_thua === tt1 && S.order(oc.id).status === 'pending', 'khách tự bấm Done bị từ chối');
  c = await click(`od|${oc.id}|done`, C2); ok(c[0][0] === 'reply' && row(C1).truyen_thua === tt1, 'người lạ bấm Done bị từ chối');
  c = await click(`od|${oc.id}|cancel`, C1); ok(S.order(oc.id).status === 'pending', 'khách đã báo chuyển thì không tự huỷ');
  c = await click(`od|${oc.id}|done`, ADMIN); ok(c.some((x) => x[0] === 'update') && row(C1).truyen_thua === tt1 + 2 && S.order(oc.id).status === 'done', 'admin Done → giao 2 Truyền Thừa'); ok(c.some((x) => x[0] === 'dm' && /Đơn mua/.test(String(x[1].content))), 'nhắn riêng khách'); const upd = c.find((x) => x[0] === 'update')[1]; ok(upd.components.length === 0 && upd.attachments.length === 0, 'thẻ đã xong: bỏ nút + bỏ ảnh QR'); ok(upd.embeds.length === 1 && /Đã cộng|Đã giao|Đơn mua/.test(JSON.stringify(upd.embeds[0].toJSON())) && /done đơn/i.test(upd.content), 'thẻ xong: tiêu đề trạng thái + thông báo giao hàng');
  c = await click(`od|${oc.id}|done`, ADMIN); ok(row(C1).truyen_thua === tt1 + 2, 'bấm Done lần 2 không giao thêm');
  c = await click(`od|${oc2.id}|cancel`, ADMIN); ok(S.order(oc2.id).status === 'cancelled', 'admin huỷ trên thẻ');
  m = mkCtx(C2, '.od truyền thừa'); await od.run(m.ctx); const oc4 = D.get("SELECT * FROM v21_orders WHERE user_id = ? AND status = 'pending'", C2); c = await click(`od|${oc4.id}|cancel`, C2); ok(S.order(oc4.id).status === 'cancelled', 'khách tự huỷ khi chưa báo chuyển');
  // tab admin hiện đơn mua
  m = mkCtx(C1, '.od truyền thừa'); await od.run(m.ctx); const oc5 = D.get("SELECT * FROM v21_orders WHERE user_id = ? AND status = 'pending'", C1); const dv = QV.render(ADMIN, 'dn', '', String(oc5.id)); check('quantri dn có đơn mua', dv); ok(JSON.stringify(dv.embeds[0].toJSON()).includes('Truyền Thừa Ngọc Giản'), 'tab admin ghi rõ vật phẩm của đơn mua'); check('đơn của tôi (đơn mua)', SV.render(C1, 'orders'));
  const sp1 = SV.render(C1, 'order', String(oc5.id)); check('sp đơn mua', sp1);
  S.cancelOwn(C1, oc5.id);
  ok(led(P) === S.balance(P) && led(Q) === S.balance(Q) && led(C1) === S.balance(C1), 'sổ cái khớp (đơn mua không làm lệch ví)');
  ok(led(P) === S.balance(P) && led(Q) === S.balance(Q), 'sổ cái khớp sau toàn bộ test');
  console.log(`✅ test_shop21: ${n} kiểm tra đạt.`);
})().catch((e) => { console.error(e); process.exit(1); });
