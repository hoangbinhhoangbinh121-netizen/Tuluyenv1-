'use strict';
// V19.7 — (1) Tiên Giới bắt buộc Thiên Nhân Ngũ Suy + Phi Thăng Tiên Giới (đột phá từ Chân Tiên, Bí Cảnh, Chứng Đạo, sự kiện); (2) Phi Thăng âm thầm.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_gate197_${Date.now()}.db`);
const assert = require('node:assert');
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const K = require('../src/game/constants'); const R = require('../src/game/realm'); const A = require('../src/game/ascension');
const DP = require('../src/game/dotpha'); const BC = require('../src/game/bicanh19'); const CD = require('../src/game/chungdao19'); const AD = require('../src/game/admin17');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const mk = (id, realm, stage, tier, passed = 0) => { Cu.createCultivator(id); D.run('UPDATE cultivators SET realm_index = ?, stage_index = ?, world_tier = ?, thiennhanngusuy_passed = ?, tu_vi = 9e15, cur_hp = 1e12, hp = 1e12 WHERE user_id = ?', realm, stage, tier, passed, String(id)); return String(id); };
const row = (id) => Cu.getCultivator(id);

// --- 1) Đột phá VÀO Chân Tiên (Độ Kiếp Viên Mãn → Chân Tiên) bị chặn nếu chưa Ngũ Suy + Phi Thăng Tiên Giới, không tốn tu vi
const a = mk(1001, 9, 22, 1, 0); const r1 = DP.doDotpha(a);
ok(typeof r1 === 'string' && /Thiên Nhân Ngũ Suy/.test(r1) && /Phi Thăng Tiên Giới/.test(r1) && /❌/.test(r1), 'tier1 chưa Ngũ Suy: bị chặn, nêu rõ cả 2 điều kiện');
ok(row(a).realm_index === 9 && row(a).tu_vi === 9e15, 'không đổi cảnh giới, không mất tu vi');
// tier 2 nhưng chưa Ngũ Suy (vd. dữ liệu cũ) → vẫn chặn
const b = mk(1002, 9, 22, 2, 0); ok(/Ngũ Suy/.test(DP.doDotpha(b)) && row(b).realm_index === 9, 'tier2 thiếu Ngũ Suy: chặn');
// người đã ở Chân Tiên nhưng chưa phi thăng (kẽ hở cũ) → mọi đột phá tiếp theo bị chặn (kể cả tiểu cảnh giới)
const c = mk(1003, 10, 0, 1, 0); ok(/Phi Thăng Tiên Giới/.test(DP.doDotpha(c)) && row(c).stage_index === 0, 'đang ở Chân Tiên chưa phi thăng: chặn tiếp');
// Độ Kiếp tầng thấp vẫn đột phá bình thường (không bị chặn bởi luật mới)
const d = mk(1004, 9, 3, 1, 0); const rd = DP.doDotpha(d); ok(!/yêu cầu hoàn thành/.test(String(rd)), 'dưới Chân Tiên không bị luật mới chặn');
// đủ cả hai → đột phá được (không bị chặn bởi luật mới)
const e = mk(1005, 9, 22, 2, 1); const re = DP.doDotpha(e); ok(!/yêu cầu hoàn thành/.test(String(re)), 'đủ Ngũ Suy + Phi Thăng Tiên Giới: không bị chặn');
// --- 2) Bí Cảnh Tiên Giới + Chứng Đạo
const f = mk(1006, 12, 0, 2, 0); ok(/Ngũ Suy/.test(BC.whyCannotEnter(row(f), 0)), 'Bí Cảnh Tiên Giới: thiếu Ngũ Suy chặn');
const g = mk(1007, 12, 0, 2, 1); ok(BC.whyCannotEnter(row(g), 0) === null, 'Bí Cảnh Tiên Giới: đủ → vào được');
const h = mk(1008, CD.GATE_REALM, CD.GATE_STAGE, 2, 0); ok(/Ngũ Suy/.test(String(CD.whyCannot(row(h)))), 'Chứng Đạo: thiếu Ngũ Suy chặn');
// --- 3) admin đặt cảnh giới Tiên → coi như đã qua Ngũ Suy (không bị khoá oan, không cộng thưởng)
const i = mk('900000000000001009', 5, 0, 0, 0); const atk0 = row(i).atk; AD.realm('1', i, 'Chân Tiên', '1'); ok(row(i).world_tier === 2 && row(i).thiennhanngusuy_passed === 1 && row(i).atk === atk0, 'admin đặt Chân Tiên: tier 2 + đã qua Ngũ Suy, không cộng thưởng');
ok(A.tienUnlocked(row(i)) && !A.tienUnlocked(row(a)), 'tienUnlocked');
// --- 4) Phi Thăng âm thầm
const q = mk(1010, 9, 22, 1, 1); ok(A.isQuiet(q) === false, 'mặc định không âm thầm');
ok(A.toggleQuiet(q) === true && A.isQuiet(q) === true && row(q).phithang_quiet === 1, 'bật âm thầm'); ok(A.toggleQuiet(q) === false && !A.isQuiet(q), 'tắt âm thầm'); ok(A.toggleQuiet(q, true) === true && A.toggleQuiet(q, true) === true, 'đặt cụ thể, idempotent');
ok(/BẬT/.test(A.quietText(true)) && /TẮT/.test(A.quietText(false)), 'câu chữ'); ok(A.toggleQuiet('999') === null, 'người lạ → null');
(async () => {
  const { MessageFlags } = require('discord.js'); const EPH = MessageFlags.Ephemeral;
  const reg = require('../src/commands/framework'); require('../src/commands/phithang');
  const names = reg.buildSlashJson().map((s) => s.name); ok(!names.includes('phithangamtham') && names.includes('phithang') && reg.registry.get('phithangamtham').prefixOnly === true, 'phithangamtham chỉ dùng tiền tố (không tốn ô slash)');
  const FX = require('../src/ui/ascendFx'); const calls = [];
  const fakeI = (uid) => ({ user: { id: uid, username: 'u' }, deferred: false, replied: false, reply: async (p) => { calls.push(['reply', p]); }, editReply: async (p) => { calls.push(['edit', p]); }, followUp: async (p) => { calls.push(['follow', p]); } });
  const ctxOf = (i) => ({ interaction: i, user: i.user, send: async (p) => i.reply(typeof p === 'string' ? { content: p } : p) });
  const sleep0 = async () => {}; void sleep0;
  // playForCtx quiet → reply đầu có cờ Ephemeral; không quiet → công khai
  const res = { ok: true, tier: 2, text: 'XONG' };
  const i1 = fakeI('1'); await FX.playForCtx(ctxOf(i1), res, { quiet: true, wait: async () => {} }).catch(() => {});
  ok(calls[0] && calls[0][0] === 'reply' && calls[0][1].flags === EPH, 'hiệu ứng âm thầm: cảnh đầu là ephemeral');
  calls.length = 0; const i2 = fakeI('2'); await FX.playForCtx(ctxOf(i2), res, { quiet: false }).catch(() => {});
  ok(calls[0] && calls[0][0] === 'reply' && calls[0][1].flags === undefined, 'không âm thầm: công khai như cũ');
  // menu Phi Thăng: nút 🤫 có, mỗi hàng ≤5 nút, bấm → bật/tắt + trả lời ephemeral
  const PT = require('../src/ui/phithang'); const v = PT.phiThangGroupView(q);
  const rows = v.components().map((r) => (r.components ? r.components.length : r.toJSON().components.length)); ok(rows.every((x) => x <= 5) && rows.length >= 2, 'menu Phi Thăng: hàng nút hợp lệ');
  const it = v.items.find((x) => x.key === 'qt'); ok(!!it, 'có nút Âm thầm'); const before = A.isQuiet(q); const got = [];
  await it.handler({ user: { id: q }, reply: async (p) => { got.push(p); } }); ok(A.isQuiet(q) === !before && got[0].flags === EPH && /Phi Thăng âm thầm/.test(got[0].content), 'bấm nút đổi trạng thái và trả lời riêng tư');
  console.log(`✓ test_tiengate_v19_7: ${n} kiểm tra`);
})().catch((e) => { console.error('✗', e); process.exit(1); });
