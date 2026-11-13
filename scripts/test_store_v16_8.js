'use strict';
// Test TuTienStore (không cần Discord): catalog, tạo đơn, đối soát thanh toán, giao hàng, chống gian lận. Chạy: node scripts/test_store_v16_8.js
const path = require('node:path'); const os = require('node:os'); const assert = require('node:assert/strict');
process.env.TULUYEN_DB_PATH = path.join(os.tmpdir(), `tg_store_${Date.now()}.db`);
Object.assign(process.env, { STORE_BANK_ID: 'MB', STORE_ACCOUNT_NO: '0123456789', STORE_ACCOUNT_NAME: 'NGUYEN VAN A', STORE_SEPAY_API_KEY: 'k', STORE_WEBHOOK_PORT: '8099' });
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const CAT = require('../src/store/catalog'); const O = require('../src/store/orders');
const Pets = require('../src/game/pets');
let n = 0; const ok = (name, fn) => { fn(); n += 1; console.log(`  ✓ ${name}`); };
const U = '111111111111111111'; const U2 = '222222222222222222'; const U3 = '333333333333333333'; const U4 = '444444444444444444';
Cu.createCultivator(U); Cu.createCultivator(U2); Cu.createCultivator(U3); Cu.createCultivator(U4);
const row = (u = U) => Cu.getCultivator(u);
let tx = 0; const pay = (code, amount, content, extra = {}) => O.handlePayment({ txId: `T${++tx}`, amount, content: content === undefined ? `CK ${code} cam on` : content, ...extra });
const mk = (pid, qty = 1, u = U) => { const r = O.createOrder(u, pid, qty); assert.ok(r.ok, `${pid}: ${r.msg}`); return r.order; };

console.log('Catalog');
ok('mã duy nhất, danh mục ≤ 25 sản phẩm, đủ dữ liệu', () => {
  const all = CAT.all(); assert.equal(new Set(all.map((p) => p.id)).size, all.length);
  for (const c of CAT.CATS) { const k = all.filter((p) => p.cat === c.key).length; assert.ok(k > 0 && k <= 25, `${c.key}=${k}`); }
  for (const p of all) { assert.ok(p.price >= 2000 && p.grants.length && p.name && p.desc, p.id); }
  console.log(`    ${all.length} sản phẩm / ${CAT.CATS.length} danh mục`);
});
ok('đủ 40 công pháp mới + 9 cổ + 5 pháp bảo', () => {
  const a = CAT.all(); assert.equal(a.filter((p) => /^cp_\d+$/.test(p.id)).length, 40); assert.equal(a.filter((p) => p.id.startsWith('cpo_')).length, 9); assert.equal(a.filter((p) => p.id.startsWith('pb_')).length, 5);
});

console.log('Đơn & thanh toán');
ok('mã đơn đúng định dạng, QR tính đúng tiền', () => { const o = mk('lt_5m'); assert.match(o.code, /^TTS[A-HJ-NP-Z2-9]{7}$/); assert.equal(o.amount, 10000); assert.equal(o.status, 'pending'); });
ok('tiền về → giao đúng 1 lần (nội dung CK bị chèn dấu cách/gạch)', () => {
  const o = mk('lt_5m', 2); const before = row().linh_thach; const spaced = `${o.code.slice(0, 3)} ${o.code.slice(3, 6)}-${o.code.slice(6)}`;
  const r = pay(o.code, 20000, `MBVCB.123 ${spaced} chuyen tien`); assert.equal(r.kind, 'delivered');
  assert.equal(row().linh_thach, before + 10000000); assert.equal(O.getOrder(o.code).status, 'delivered');
  assert.equal(O.handlePayment({ txId: `T${tx}`, amount: 20000, content: o.code }).kind, 'duplicate');         // webhook gửi lặp
  assert.equal(pay(o.code, 20000).kind, 'double_paid'); assert.equal(row().linh_thach, before + 10000000);   // chuyển lần 2 cùng mã: KHÔNG giao thêm
});
ok('chuyển thiếu rồi bù → cộng dồn, giao 1 lần', () => {
  const o = mk('ruong_1'); const b = row().ruong_than_bi;
  const r1 = pay(o.code, 5000); assert.equal(r1.kind, 'underpaid'); assert.equal(r1.missing, 15000); assert.equal(row().ruong_than_bi, b);
  const r2 = pay(o.code, 15000); assert.equal(r2.kind, 'delivered'); assert.equal(row().ruong_than_bi, b + 1);
});
ok('chuyển dư vẫn giao; sai tài khoản / sai mã / không mã → không giao', () => {
  const o = mk('dan_duoc_10'); const b = row().dan_duoc;
  assert.equal(pay(o.code, 15000, o.code, { account: '9999999999' }).kind, 'ignored');
  assert.equal(pay('X', 15000, 'chuyen tien an trua').kind, 'no_code');
  assert.equal(pay('X', 15000, 'TTSAAAAAAA').kind, 'no_order');
  const r = pay(o.code, 18000); assert.equal(r.kind, 'delivered'); assert.equal(r.over, 3000); assert.equal(row().dan_duoc, b + 10);
});
ok('đơn quá hạn QR vẫn giao nếu tiền về; đơn đã huỷ thì KHÔNG tự giao', () => {
  const a = mk('khivan_100'); D.run('UPDATE store_orders SET expires_at = 1 WHERE code = ?', a.code); assert.equal(O.sweepExpired() >= 1, true);
  assert.equal(O.getOrder(a.code).status, 'expired'); const b = row().khi_van; assert.equal(pay(a.code, 10000).kind, 'delivered'); assert.equal(row().khi_van, b + 100);
  const c = mk('khivan_100'); assert.equal(O.cancelOrder(U, c.code).ok, true); assert.equal(pay(c.code, 10000).kind, 'paid_cancelled'); assert.equal(O.getOrder(c.code).status, 'cancelled');
  assert.equal(O.confirmManual(c.code, 'admin1').kind, 'delivered');                     // admin duyệt tay sau khi kiểm tra sao kê
});
ok('khách khác không huỷ được đơn của người khác', () => { const o = mk('khivan_500'); assert.equal(O.cancelOrder(U2, o.code).ok, false); assert.equal(O.cancelOrder(U, o.code).ok, true); });

console.log('Hàng đặc biệt');
ok('Linh Căn: chỉ bán phẩm cao hơn, đặt đúng phẩm, không cho mua lại phẩm thấp', () => {
  Cu.updateCultivator(U, { linh_can: 'Ngũ Linh Căn' });
  assert.equal(O.createOrder(U, 'lc_ngu_linh_can', 1).ok, false);
  const o = mk('lc_thien_linh_can'); assert.equal(pay(o.code, o.amount).kind, 'delivered'); assert.equal(row().linh_can, 'Thiên Linh Căn');
  const r = O.createOrder(U, 'lc_song_linh_can', 1); assert.equal(r.ok, false); assert.match(r.msg, /tụt phẩm/);
});
ok('Thể Chất đặt đúng phẩm (và chặn khi đã có phẩm cao hơn)', () => {
  Cu.updateCultivator(U, { the_chat: 'Hoang Cổ Thánh Thể' }); assert.equal(O.createOrder(U, 'tc_huyen_the', 1).ok, false);
  Cu.updateCultivator(U, { the_chat: 'Phàm Thể' }); const o = mk('tc_huyen_the'); assert.equal(pay(o.code, o.amount).kind, 'delivered'); assert.equal(row().the_chat, 'Huyền Thể'); });
ok('Pháp Bảo: cấp 1 lần, mua lại bị chặn', () => {
  const o = mk('pb_2'); assert.equal(pay(o.code, o.amount).kind, 'delivered'); assert.ok(Cu.ownedPhapbaoTiers(row()).has(2));
  assert.equal(O.createOrder(U, 'pb_2', 1).ok, false);
});
ok('Công Pháp mới + cổ vào cong_phap_owned', () => {
  for (const id of ['cp_1001', 'cp_1031', 'cpo_1']) { const o = mk(id); assert.equal(pay(o.code, o.amount).kind, 'delivered', id); }
  const owned = Cu.ownedCongphapTiers(row()); for (const t of [1001, 1031, 1]) assert.ok(owned.has(t), `thiếu ${t}`);
});
ok('Vật phẩm Linh Thú cộng vào pet_items; Hóa Linh Châu đủ số cho 1 lần tiến hóa', () => {
  const o = mk('pet_evo_t3'); assert.equal(pay(o.code, o.amount).kind, 'delivered'); assert.equal(Pets.itemQty(U, 'evo_t3'), 4);
  const p = mk('pet_than_thu_dan_5'); pay(p.code, p.amount); assert.equal(Pets.itemQty(U, 'than_thu_dan'), 5);
});
ok('Giới hạn/ngày: Bản Mệnh Tinh Huyết tối đa 2', () => {
  mk('pet_ban_menh_huyet_1', 1, U2); mk('pet_ban_menh_huyet_1', 1, U2); const r = O.createOrder(U2, 'pet_ban_menh_huyet_1', 1); assert.equal(r.ok, false); assert.match(r.msg, /tối đa 2/);
});
ok('Giới hạn đơn chờ / người (mặc định 3)', () => { for (let i = 0; i < 3; i += 1) mk('khivan_100', 1, U3); const r = O.createOrder(U3, 'khivan_100', 1); assert.equal(r.ok, false); assert.match(r.msg, /tối đa 3/); });

console.log('Lỗi giao hàng');
ok('giao lỗi → đơn "error", không cộng đồ; sửa xong giao lại được, không cộng đôi', () => {
  const o = mk('pb_3'); const owned = Cu.ownedPhapbaoTiers(row()); owned.add(3);
  Cu.updateCultivator(U, { phap_bao_owned: [...owned].sort().join(',') });          // giả lập: khách có Pháp Bảo này từ nguồn khác khi đơn đang chờ
  const r = pay(o.code, o.amount); assert.equal(r.kind, 'delivery_error'); assert.equal(O.getOrder(o.code).status, 'error');
  assert.equal(pay(o.code, o.amount).kind, 'double_paid');                          // trả tiền lần nữa cho đơn đang lỗi → báo admin, không giao
  assert.equal(O.retryDelivery(o.code).kind, 'delivery_error');
  Cu.updateCultivator(U, { phap_bao_owned: '2' }); const rr = O.retryDelivery(o.code); assert.equal(rr.kind, 'delivered'); assert.ok(Cu.ownedPhapbaoTiers(row()).has(3));
});
ok('đơn nhiều bước: bước đã giao không giao lại', () => {
  const o = mk('khivan_100'); const grants = JSON.parse(O.getOrder(o.code).grants);
  const two = [...grants, { t: 'col', col: 'khi_van', n: 7, label: 'x' }, { t: 'col', col: 'not_a_col', n: 1, label: 'bad' }];
  D.run("UPDATE store_orders SET grants = ?, status = 'delivering' WHERE code = ?", JSON.stringify(two), o.code);
  const b = row().khi_van; const r1 = O.deliver(o.code); assert.equal(r1.ok, false); assert.equal(row().khi_van, b + 107);
  assert.equal(O.getOrder(o.code).grant_step, 2); const r2 = O.deliver(o.code); assert.equal(r2.ok, false); assert.equal(row().khi_van, b + 107);   // gọi lại: không cộng thêm
});

console.log('Ví Thiên Tệ: nạp tuỳ ý + mua bằng Thiên Tệ');
const T = require('../src/store/topup'); const W = require('../src/store/wallet');
ok('bậc thưởng tăng dần, tỉ lệ/1.000đ tăng theo số tiền nạp', () => {
  const rates = [10000, 50000, 100000, 200000, 500000, 1000000].map((a) => T.quote(a).perK);
  for (let i = 1; i < rates.length; i += 1) assert.ok(rates[i] > rates[i - 1], `bậc ${i} không tăng`);
  const q = T.quote(100000); assert.deepEqual([q.base, q.pct, q.bonus, q.total], [1000, 10, 100, 1100]);
  assert.equal(T.quote(9000).ok, false); assert.equal(T.quote(50500).ok, false); assert.equal(T.quote(20000001).ok, false);
});
ok('đọc số tiền: 50000 · 50.000đ · 75k · 1tr · 1,5tr · rác', () => {
  assert.deepEqual(['50000', '50.000đ', '75k', '1tr', '1,5tr', ' 200 000 '].map(T.parseAmount), [50000, 50000, 75000, 1000000, 1500000, 200000]);
  assert.ok(Number.isNaN(T.parseAmount('abc'))); assert.ok(Number.isNaN(T.parseAmount('')));
});
ok('đơn nạp: trả tiền → cộng đúng Thiên Tệ (gồm thưởng) vào VÍ, 1 lần; KHÔNG đụng Linh Thạch', () => {
  const r = O.createTopupOrder(U, 200000); assert.ok(r.ok, r.msg); const lt = row().linh_thach; const b = W.balance(U);
  assert.equal(r.order.amount, 200000); assert.equal(r.quote.total, 2300);                 // 200k → 2000 gốc + 15%
  assert.equal(pay(r.order.code, 200000).kind, 'delivered'); assert.equal(W.balance(U), b + 2300); assert.equal(row().linh_thach, lt);
  assert.equal(pay(r.order.code, 200000).kind, 'double_paid'); assert.equal(W.balance(U), b + 2300);
  assert.equal(O.createTopupOrder(U, 5000).ok, false);
  assert.equal(W.ledger(U, 1)[0].reason, 'topup');
});
ok('sổ cái chặn cộng đôi cùng 1 đơn nạp (UNIQUE)', () => { D.transaction(() => W.credit(U2, 5, 'topup', 'REFX1')); assert.throws(() => D.transaction(() => W.credit(U2, 5, 'topup', 'REFX1'))); assert.equal(W.balance(U2), 5); });
ok('mua bằng Thiên Tệ: trừ ví, giao đồ, ghi đơn "wallet", không tính vào doanh thu tiền thật', () => {
  const b = W.balance(U); const dd = row().dan_duoc; const rev0 = O.stats().all.v;
  const r = O.buyWithWallet(U, 'dan_duoc_10', 1); assert.ok(r.ok, r.msg);
  assert.equal(r.cost, 150); assert.equal(W.balance(U), b - 150); assert.equal(row().dan_duoc, dd + 10);
  assert.deepEqual([r.order.pay_by, r.order.amount, r.order.tt_cost, r.order.status], ['wallet', 0, 150, 'delivered']);
  assert.equal(O.stats().all.v, rev0); assert.equal(W.ledger(U, 1)[0].reason, 'buy');
});
ok('thiếu Thiên Tệ → từ chối, không trừ; không mua được hàng đã sở hữu / thấp phẩm', () => {
  const b = W.balance(U4); const r = O.buyWithWallet(U4, 'ruong_10', 1); assert.equal(r.ok, false); assert.match(r.msg, /Không đủ Thiên Tệ/); assert.equal(W.balance(U4), b);
  W.credit(U, 100000, 'admin', '', 'test'); assert.equal(O.buyWithWallet(U, 'pb_2', 1).ok, false);           // đã có Pháp Bảo 2
  assert.match(O.buyWithWallet(U, 'lc_song_linh_can', 1).msg, /tụt phẩm/);
});
ok('không tiêu quá số dư (mua liên tiếp, số dư vừa đủ 1 lần)', () => {
  const X = '555555555555555555'; Cu.createCultivator(X); W.credit(X, 150, 'admin', '', 't');
  assert.equal(O.buyWithWallet(X, 'dan_duoc_10', 1).ok, true); assert.equal(O.buyWithWallet(X, 'dan_duoc_10', 1).ok, false); assert.equal(W.balance(X), 0);
});
ok('giao lỗi khi mua bằng ví → TỰ HOÀN Thiên Tệ, đơn đóng; hoàn lại lần 2 bị chặn', () => {
  const keep = CAT.blockReason; CAT.blockReason = () => '';          // giả lập: lọt qua kiểm tra trước, giao thì phát hiện đã có
  const b = W.balance(U); const r = O.buyWithWallet(U, 'pb_3', 1); CAT.blockReason = keep;
  assert.equal(r.ok, false); assert.equal(r.refunded, true); assert.equal(W.balance(U), b); assert.equal(O.getOrder(r.order.code).status, 'cancelled');
  assert.equal(O.refundWalletOrder(r.order.code).ok, false);
});
ok('admin cộng/trừ Thiên Tệ: ghi sổ, không cho âm', () => {
  const b = W.balance(U3); assert.ok(O.adminAdjust('adm', U3, 1000, 'bù').ok); assert.ok(O.adminAdjust('adm', U3, -400).ok); assert.equal(W.balance(U3), b + 600);
  assert.equal(O.adminAdjust('adm', U3, -99999999).ok, false); assert.equal(W.balance(U3), b + 600); assert.equal(W.ledger(U3, 1)[0].reason, 'admin');
  assert.ok(W.totals().outstanding > 0);
});
ok('chế độ QR tĩnh: có ảnh QR → nhận đơn, admin duyệt tay giao đúng', () => {
  const CFG = require('../src/store/config'); const keep = { ...process.env };
  for (const k of ['STORE_BANK_ID', 'STORE_ACCOUNT_NO', 'STORE_ACCOUNT_NAME', 'STORE_SEPAY_API_KEY']) delete process.env[k];
  assert.equal(CFG.mode(), 'static'); assert.equal(CFG.autoReady(), false);
  const r = O.createTopupOrder(U4, 50000); assert.ok(r.ok, r.msg); const b = W.balance(U4);
  assert.equal(O.confirmManual(r.order.code, 'adminX').kind, 'delivered'); assert.equal(W.balance(U4), b + 525);
  assert.equal(O.getOrder(r.order.code).pay_by, 'admin:adminX');
  Object.assign(process.env, keep); assert.equal(CFG.mode(), 'vietqr');
});

console.log('Admin');
ok('đổi giá / tắt sản phẩm có hiệu lực; thống kê chạy được', () => {
  assert.ok(CAT.setPrice('lt_5m', 12345)); assert.equal(CAT.get('lt_5m').price, 12345); CAT.setPrice('lt_5m', null); assert.equal(CAT.get('lt_5m').price, 10000);
  CAT.setEnabled('lt_5m', false); assert.equal(O.createOrder(U, 'lt_5m', 1).ok, false); CAT.setEnabled('lt_5m', true);
  const s = O.stats(); assert.ok(s.all.n > 5 && s.all.v > 0);
});
console.log(`\n✅ ${n} nhóm kiểm thử đạt — TuTienStore OK`);
