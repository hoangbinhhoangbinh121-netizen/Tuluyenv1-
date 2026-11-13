'use strict';
// Test /khoatuluyen (không cần Discord): khóa chặn đúng hành động, treo quan bị hủy, hết hạn tự gỡ, không ảnh hưởng người khác.
const path = require('node:path'); const os = require('node:os'); const assert = require('node:assert/strict');
process.env.TULUYEN_DB_PATH = path.join(os.tmpdir(), `tg_lock_${Date.now()}.db`);
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const A = require('../src/game/actionsBasic'); const Lock = require('../src/game/cultLock');
const Treo = require('../src/game/treoquan'); const Dot = require('../src/game/dotpha');
let n = 0; const ok = (name, fn) => { fn(); n += 1; console.log(`  ✓ ${name}`); };
const P = '111111111111111111'; const Q = '222222222222222222'; const R = '333333333333333333';
for (const u of [P, Q, R]) Cu.createCultivator(u);

ok('chưa khóa: tu luyện / bế quan / treo quan chạy bình thường', () => {
  assert.equal(A.tuluyenR(P).ok, true); assert.equal(A.dongquanR(P).ok, true);
  assert.equal(Treo.batDau(Q).ok, true);
});
ok('khóa 1 giờ: chặn Tu Luyện, Bế Quan, Cảm Ngộ, Linh Mạch, Treo Quan (bắt đầu & xuất quan)', () => {
  const tv = Cu.getCultivator(Q).tu_vi;
  const r = Lock.lock(Q, { hours: 1, reason: 'test', by: 'adm' });
  assert.equal(r.cancelledTreo, true); assert.equal(Number(Cu.getCultivator(Q).treo_start), 0); assert.equal(Cu.getCultivator(Q).tu_vi, tv);   // hủy treo, KHÔNG nhận tu vi
  for (const f of [A.tuluyenR, A.dongquanR]) { const x = f(Q); assert.deepEqual([x.ok, x.kind], [false, 'locked']); }
  assert.match(A.doCanngo(Q), /^🔒/); assert.match(A.doLinhmach(Q), /^🔒/); assert.match(A.doTuluyen ? A.doTuluyen(Q) : '🔒', /^🔒/);
  assert.equal(Treo.batDau(Q).kind, 'locked'); assert.equal(Treo.xuatQuan(Q).kind, 'locked');
  assert.match(Lock.text(Lock.get(Q)), /đang bị khóa/); assert.match(Lock.text(Lock.get(Q)), /Lý do: test/);
});
ok('không ảnh hưởng người khác', () => { assert.equal(Lock.get(R), null); assert.notEqual(A.tuluyenR(R).kind, 'locked'); assert.equal(Lock.list().length, 1); });
ok('Đột Phá chỉ bị khóa khi admin chọn kèm', () => {
  assert.doesNotMatch(Dot.dotphaR(Q).text, /đang bị khóa/);
  Lock.lock(Q, { hours: 1, dotpha: true }); const d = Dot.dotphaR(Q); assert.equal(d.kind, 'blocked'); assert.match(d.text, /Đột Phá/); assert.match(d.text, /^🔒/);
});
ok('khóa hết hạn tự gỡ; vô thời hạn (0 giờ) không tự hết', () => {
  D.run('UPDATE cult_locks SET until = 1 WHERE user_id = ?', Q); assert.equal(Lock.get(Q), null); assert.notEqual(A.tuluyenR(Q).kind, 'locked');
  Lock.lock(Q, { hours: 0 }); D.run('SELECT 1'); assert.equal(Number(Lock.get(Q).until), 0); assert.ok(Lock.get(Q));
});
ok('mở khóa: dùng lại được; mở lần 2 báo không có', () => { assert.equal(Lock.unlock(Q), true); assert.equal(Lock.unlock(Q), false); assert.notEqual(A.tuluyenR(Q).kind, 'locked'); assert.equal(Lock.list().length, 0); });
console.log(`\n✅ ${n} nhóm kiểm thử đạt — khóa tu luyện OK`);
