'use strict';
// V21.6.1 — "biểu mẫu/menu hết hạn": form /quantri tĩnh (sống sót qua restart), thông báo nói rõ lý do, đăng nhập thử lại khi lỗi mạng (không thoát).
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_rs2161_${Date.now()}.db`);
const assert = require('node:assert'); let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const D = require('../src/db'); D.initDb();
const kit = require('../src/ui/kit'); const QV = require('../src/ui/quantriViews'); const AC = require('../src/autoconfig'); const L = require('../src/errorlog'); const K = require('../src/game/constants');
const ADMIN = '111111111111111111'; K.ADMIN_CODE_APPROVER_IDS.push(ADMIN);
(async () => {
  // 1) menu động đã mất (như sau restart): thông báo nêu lý do
  const said = []; const mkI = (cid, who = ADMIN) => ({ customId: cid, user: { id: who }, deferred: false, replied: false, reply: async (p) => { said.push(p); }, followUp: async (p) => { said.push(p); }, isModalSubmit: () => true });
  await kit.routeModal(mkI('mdeadbeef01')); ok(said.length === 1 && /không còn/.test(said[0].content) && /khởi động lại/.test(said[0].content), 'biểu mẫu động đã mất → nói rõ "bot vừa khởi động lại"');
  ok(new RegExp(`<t:${kit.BOOT_AT}:R>`).test(said[0].content), 'có mốc thời gian khởi động');
  await kit.routeComponent(Object.assign(mkI('deadbeef02|x'), { isButton: () => true })); ok(/không còn/.test(said[1].content) && /khởi động lại/.test(said[1].content), 'menu động đã mất → nói rõ lý do');
  // 2) form /quantri là form TĨNH: customId "qm|uid|form"; không nằm trong bộ nhớ ⇒ restart không làm mất
  let shown = null; const opener = { customId: `qt|${ADMIN}|m|lt`, user: { id: ADMIN }, deferred: false, replied: false, showModal: async (m) => { shown = m; }, reply: async () => {}, update: async () => {} };
  await kit.routeComponent(opener); const mid = shown && (shown.id || (shown.toJSON ? shown.toJSON().custom_id : shown.data.custom_id)); ok(/^qm\|111111111111111111\|lt$/.test(mid), `customId tĩnh (${mid})`);
  const submit = async (cid, who, vals = {}) => { const out = []; const mi = { customId: cid, user: { id: who }, client: {}, guildId: '1', channelId: '2', fields: { getTextInputValue: (id) => vals[id] ?? '' }, reply: async (p) => { out.push(p); }, deferred: false, replied: false }; await kit.routeModal(mi); return out; };
  let o = await submit(mid, '222222222222222222'); ok(o.length === 1 && /chỉ dành cho admin/.test(o[0].content), 'người khác nộp form của admin → từ chối');
  o = await submit(`qm|${ADMIN}|khong_co_form`, ADMIN); ok(o.length === 1 && /không còn/.test(o[0].content), 'tên form lạ → thông báo gọn, không sập');
  const Cu = require('../src/game/cultivator'); const P = '333333333333333333'; Cu.createCultivator(P);
  o = await submit(mid, ADMIN, { u: P, n: '+100' }); ok(o.length === 1 && String(o[0].content || (o[0].embeds && 'embed')).length > 0, 'admin nộp form tĩnh → xử lý bình thường');
  // 3) retryOnNetwork
  const eai = Object.assign(new Error('getaddrinfo EAI_AGAIN discord.com'), { code: 'EAI_AGAIN' }); const waits = []; const sleep = async (ms) => { waits.push(ms); };
  let c = 0; const r = await AC.retryOnNetwork(async () => { c += 1; if (c < 4) throw eai; return 'ok'; }, { isNetwork: L.isNetwork, sleep, warn: () => {} }); ok(r === 'ok' && c === 4 && waits.join() === '5000,10000,15000', 'lỗi DNS → thử lại 3 lần rồi thành công, chờ tăng dần, không thoát');
  const bad = new Error('An invalid token was provided'); let c2 = 0; try { await AC.retryOnNetwork(async () => { c2 += 1; throw bad; }, { isNetwork: L.isNetwork, sleep, warn: () => {} }); } catch (e) { ok(e === bad && c2 === 1, 'token sai → ném ngay, KHÔNG lặp'); }
  let c3 = 0; try { await AC.retryOnNetwork(async () => { c3 += 1; throw eai; }, { isNetwork: L.isNetwork, sleep, warn: () => {}, max: 3 }); } catch (e) { ok(e === eai && c3 === 3, 'quá số lần tối đa thì ném lỗi'); }
  waits.length = 0; await AC.retryOnNetwork(async (a) => { if (a < 20) throw eai; }, { isNetwork: L.isNetwork, sleep, warn: () => {} }); ok(Math.max(...waits) === 60000, 'thời gian chờ chặn trần 60 giây');
  console.log(`✅ test_restart2161: ${n} kiểm tra PASS`); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
