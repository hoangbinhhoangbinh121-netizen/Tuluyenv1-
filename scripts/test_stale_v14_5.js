'use strict';
// v14.5 — lượt bấm hết hạn (Discord 10062/40060) không được sinh mã lỗi/báo kênh admin, và router không gửi thêm "Có lỗi xảy ra".
const assert = require('node:assert'); const EL = require('../src/errorlog');
let reported = 0; EL.setReporter(() => { reported += 1; });
const stale = Object.assign(new Error('Unknown interaction'), { code: 10062 });
assert.strictEqual(EL.logError('x', stale), 'het-han'); assert.strictEqual(reported, 0); assert.strictEqual(EL.getStale().count, 1);
assert.strictEqual(EL.logError('x', Object.assign(new Error('Interaction has already been acknowledged.'), { code: 40060 })), 'het-han');
const real = EL.logError('x', new Error('lỗi thật')); assert.notStrictEqual(real, 'het-han'); assert.strictEqual(reported, 1);
(async () => {
  const kit = require('../src/ui/kit'); const replies = [];
  kit.registerStatic('stl', async (i) => { throw stale; });
  const i = { customId: 'stl|a', user: { id: '1' }, reply: async (p) => { replies.push(p); }, followUp: async (p) => { replies.push(p); } };
  await kit.routeComponent(i); assert.strictEqual(replies.length, 0, 'không gửi thêm tin báo lỗi khi lượt bấm đã hết hạn');
  kit.registerStatic('stl2', async () => { throw new Error('bug thật'); });
  await kit.routeComponent({ ...i, customId: 'stl2|a' }); assert.strictEqual(replies.length, 1); assert.ok(/mã lỗi/.test(replies[0].content));
  console.log('✅ test_stale_v14_5 OK');
})().catch((e) => { console.error('❌', e); process.exit(1); });
