'use strict';
// V21.6 — lỗi mạng/DNS tạm thời (EAI_AGAIN…): không sinh mã lỗi, không báo admin, thử lại khi gửi tin, thông báo thân thiện.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_net216_${Date.now()}.db`);
const assert = require('node:assert'); let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const D = require('../src/db'); D.initDb();
const L = require('../src/errorlog'); const N = require('../src/ui/notifications'); const { wrapInteraction } = require('../src/ui/skin'); const F = require('../src/commands/framework');
const eai = Object.assign(new Error('getaddrinfo EAI_AGAIN discord.com'), { code: 'EAI_AGAIN', syscall: 'getaddrinfo', hostname: 'discord.com' });
const wrapped = new Error('fetch failed'); wrapped.cause = Object.assign(new Error('x'), { code: 'EAI_AGAIN' });
ok(L.isNetwork(eai) && L.isNetwork(wrapped) && L.isNetwork(new Error('socket hang up')) && L.isNetwork(Object.assign(new Error('x'), { code: 'ECONNRESET' })), 'nhận diện lỗi mạng');
ok(L.isNetwork(Object.assign(new Error('boom'), { status: 503 })), 'Discord 5xx = tạm thời');
ok(!L.isNetwork(new Error('database or disk is full')) && !L.isNetwork(new TypeError("Cannot read properties of undefined (reading 'x')")) && !L.isNetwork(null), 'lỗi code/DB KHÔNG bị coi là mạng');
ok(L.isPreSend(eai) && L.isPreSend(wrapped) && !L.isPreSend(Object.assign(new Error('x'), { code: 'ECONNRESET' })), 'chỉ lỗi "chưa gửi được" mới được thử lại');
const before = L.getRecent().length; let reported = 0; L.setReporter(() => { reported += 1; });
const w = console.warn; let warns = 0; console.warn = () => { warns += 1; };
const code = L.logError('lệnh !tuluyen', eai); for (let i = 0; i < 20; i++) L.logError('x', eai); console.warn = w;
ok(code === 'mang', "mã = 'mang' (không phải mã ngẫu nhiên)"); ok(L.getRecent().length === before, 'không chiếm chỗ trong danh sách lỗi'); ok(reported === 0, 'không báo admin'); ok(warns === 1, `chỉ 1 dòng cảnh báo / 30s (${warns})`); ok(L.getNet().count === 21, 'đếm đủ');
const real = L.logError('t', new Error('lỗi thật')); ok(real !== 'mang' && /^[0-9a-f]{4}$/.test(real) && reported === 1, 'lỗi thật vẫn có mã + báo admin');
const e = N.systemError('mang').toJSON(); ok(/chập chờn/.test(e.title) && !/mã/.test(e.description), 'thông báo mạng thân thiện, không hiện mã lỗi'); ok(/mã/.test(N.systemError('ab12').toJSON().description), 'lỗi thật vẫn hiện mã');
(async () => {
  // retry khi gửi tin của interaction: 2 lần lỗi DNS rồi thành công
  let calls = 0; const i = { createdTimestamp: Date.now(), deferred: false, replied: false, reply: async () => { calls += 1; if (calls < 3) throw eai; i.replied = true; return 'ok'; }, isChatInputCommand: () => false };
  wrapInteraction(i); ok((await i.reply({ content: 'hi' })) === 'ok' && calls === 3, 'reply thử lại 2 lần rồi thành công');
  let c2 = 0; const j = { createdTimestamp: Date.now(), deferred: false, replied: false, reply: async () => { c2 += 1; throw eai; }, isChatInputCommand: () => false }; wrapInteraction(j);
  let thrown = null; try { await j.reply({ content: 'hi' }); } catch (x) { thrown = x; } ok(thrown === eai && c2 === 3, 'quá 2 lần thì ném lỗi gốc (để logError xử lý)');
  let c3 = 0; const k = { createdTimestamp: Date.now(), deferred: false, replied: false, reply: async () => { c3 += 1; throw Object.assign(new Error('r'), { code: 'ECONNRESET' }); }, isChatInputCommand: () => false }; wrapInteraction(k);
  try { await k.reply({ content: 'x' }); } catch (_) { /* dự kiến */ } ok(c3 === 1, 'ECONNRESET (có thể đã gửi) KHÔNG thử lại → không trả lời 2 lần');
  let c4 = 0; const m = { createdTimestamp: Date.now() - 2600, deferred: false, replied: false, reply: async () => { c4 += 1; throw eai; }, isChatInputCommand: () => false }; wrapInteraction(m);
  try { await m.reply({ content: 'x' }); } catch (_) { /* dự kiến */ } ok(c4 === 1, 'sát hạn 3 giây của Discord thì không chờ thử lại');
  // lệnh tiền tố: lỗi DNS khi gửi → không ra mã lỗi, người chơi nhận (hoặc không nhận được) thông báo mạng
  const { registry } = F; let sent = []; let tries = 0;
  const msg = { author: { id: '123456789012345678', bot: false }, content: '!tuluyen', mentions: { users: new Map() }, attachments: new Map(), guild: null, channel: {}, member: null,
    reply: async (p) => { tries += 1; if (tries <= 1) throw eai; sent.push(p); return {}; } };
  F.registry.set('zz_net_test', { name: 'zz_net_test', description: 'test', options: [], noDefer: true, run: async (ctx) => ctx.send({ content: 'xin chào' }) });
  msg.content = '!zz_net_test'; const handled = await F.handlePrefix(msg, ['!']); ok(handled && sent.length === 1 && tries === 2, 'prefix: gửi lại sau lỗi DNS rồi thành công (không báo lỗi)');
  F.registry.delete('zz_net_test');
  console.log(`✅ test_neterr21: ${n} kiểm tra PASS`); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
