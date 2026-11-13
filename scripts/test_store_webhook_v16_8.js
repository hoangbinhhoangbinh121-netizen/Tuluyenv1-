'use strict';
// Test webhook SePay của TuTienStore (không cần Discord). Chạy: node scripts/test_store_webhook_v16_8.js
const assert = require('node:assert/strict');
Object.assign(process.env, { STORE_SEPAY_API_KEY: 'secret-key', STORE_WEBHOOK_PORT: '18099' });
const W = require('../src/store/webhook');
const got = [];
const server = W.start(async (tx) => { got.push(tx); });
const post = (body, headers = {}) => fetch('http://127.0.0.1:18099/sepay', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
setTimeout(async () => {
  const good = { Authorization: 'Apikey secret-key' };
  const tx = { id: 777, transferType: 'in', transferAmount: 10000, accountNumber: '0123456789', content: 'CK TTSABCDEFG', code: null };
  assert.equal((await post(tx)).status, 401);                                            // không có key
  assert.equal((await post(tx, { Authorization: 'Apikey sai' })).status, 401);           // sai key
  assert.equal((await post(tx, good)).status, 200); assert.equal(got.length, 1);
  assert.deepEqual([got[0].txId, got[0].amount], [777, 10000]);
  assert.equal((await post({ ...tx, transferType: 'out' }, good)).status, 200); assert.equal(got.length, 1);   // tiền RA bị bỏ qua
  assert.equal((await fetch('http://127.0.0.1:18099/health')).status, 200);
  assert.equal((await fetch('http://127.0.0.1:18099/sepay', { method: 'POST', headers: good, body: '{hỏng' })).status, 400);
  console.log('✅ Webhook OK: xác thực key, bỏ tiền ra, JSON hỏng, health'); server.close(); process.exit(0);
}, 300);
