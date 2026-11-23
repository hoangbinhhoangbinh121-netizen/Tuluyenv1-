'use strict';
// V21.4 — Bí Cảnh: LẬP ĐỘI qua nút thật (menu → Tổ Đội → Tham Gia → Bắt Đầu). Bắt lỗi "không lập được đội":
// phòng chờ có 2 nút trùng custom_id → Discord từ chối cả tin nhắn. Mọi payload đều qua bộ kiểm tra Discord (ui/validate.js).
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_bcparty_${Date.now()}.db`);
process.env.TG_STRICT_UI = '1';
const assert = require('node:assert');
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const BC = require('../src/game/bicanh19'); const kit = require('../src/ui/kit'); const BV = require('../src/ui/bicanh19Views'); const V = require('../src/ui/validate'); const { normalizePayload } = require('../src/ui/skin');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const mk = (id) => { Cu.createCultivator(id); D.run('UPDATE cultivators SET realm_index = 10, stage_index = 1, world_tier = 2, thiennhanngusuy_passed = 1, tu_vi = 9e15 WHERE user_id = ?', String(id)); return String(id); };
// giả tương tác: mọi payload gửi đi PHẢI hợp lệ (đi qua normalizePayload → validate strict, ném lỗi nếu sai)
const fake = (uid, customId, values) => { const log = []; const i = { customId, user: { id: String(uid), username: 'u' + uid }, member: { displayName: 'U' + uid }, values, guildId: 'g1', channelId: 'c1', client: {}, deferred: false, replied: false,
  update: async (p) => { normalizePayload(p, { edit: true }); i.replied = true; log.push(['update', p]); }, editReply: async (p) => { normalizePayload(p, { edit: true }); log.push(['edit', p]); }, reply: async (p) => { normalizePayload(p); i.replied = true; log.push(['reply', p]); }, followUp: async (p) => { normalizePayload(p); log.push(['follow', p]); } }; i.log = log; return i; };
const click = async (uid, cid, values) => { const i = fake(uid, cid, values); await kit.routeComponent(i); return i; };
const last = (i) => i.log[i.log.length - 1];
const text = (p) => JSON.stringify(p && (p.content || '') ) + JSON.stringify((p.embeds || []).map((e) => (e.toJSON ? e.toJSON() : e)));
(async () => {
  const A = mk('2001'); const B = mk('2002'); const C = mk('2003');
  // bộ kiểm tra bắt đúng lỗi cũ
  ok(V.validateComponents([{ components: [{ type: 2, custom_id: 'x', label: 'a', style: 1 }, { type: 2, custom_id: 'x', label: 'b', style: 1 }] }]).some((m) => /TRÙNG/.test(m)), 'validate bắt custom_id trùng');
  // 1) lập đội
  let i = await click(A, `b19|m|${A}|party|0`); const lobbyMsg = last(i)[1]; ok(i.log.length === 1 && last(i)[0] === 'update', 'Tổ Đội → cập nhật phòng chờ (không lỗi component)');
  ok(V.validatePayload(lobbyMsg).length === 0, 'phòng chờ hợp lệ'); const ids = lobbyMsg.components.flatMap((r) => r.toJSON().components.map((c) => c.custom_id)); ok(new Set(ids).size === ids.length && ids.length === 4, 'phòng chờ: 4 nút, custom_id khác nhau');
  const runId = BC.activeRunId(A); ok(runId, 'có phòng chờ'); ok(D.get('SELECT status FROM bc19_runs WHERE run_id = ?', runId).status === 'lobby', 'trạng thái lobby');
  const startBtn = lobbyMsg.components[0].toJSON().components.find((c) => /\|s\|/.test(c.custom_id)); ok(startBtn.disabled === true, 'Bắt Đầu tắt khi mới 1 người');
  // 2) người khác tham gia (không phải chủ menu, vẫn được vì là nút phòng chờ)
  i = await click(B, `b19|j|${runId}`); ok(last(i)[0] === 'update' && /U2002|2002/.test(text(last(i)[1])), 'B tham gia → phòng chờ có B');
  ok(D.all('SELECT user_id FROM bc19_members WHERE run_id = ?', runId).length === 2, '2 thành viên');
  i = await click(B, `b19|j|${runId}`); ok(/đã ở trong đội/.test(text(last(i)[1])), 'B bấm Tham Gia lần 2 → báo đã ở trong đội');
  const m2 = BV.lobbyView(runId); ok(m2.components[0].toJSON().components.find((c) => /\|s\|/.test(c.custom_id)).disabled === false, 'đủ 2 người → Bắt Đầu bật');
  // 3) người ngoài bấm Bắt Đầu / Hủy Phòng → bị từ chối
  i = await click(B, `b19|s|${runId}`); ok(/Chỉ đội trưởng/.test(text(last(i)[1])), 'thành viên không bắt đầu được'); ok(D.get('SELECT status FROM bc19_runs WHERE run_id = ?', runId).status === 'lobby', 'vẫn lobby');
  i = await click(B, `b19|x|${runId}`); ok(/Chỉ đội trưởng/.test(text(last(i)[1])), 'thành viên không hủy phòng được'); ok(D.get('SELECT status FROM bc19_runs WHERE run_id = ?', runId).status === 'lobby', 'vẫn lobby (sau hủy trái phép)');
  // 4) chủ phòng bắt đầu
  i = await click(A, `b19|s|${runId}`); ok(D.get('SELECT status FROM bc19_runs WHERE run_id = ?', runId).status === 'active', 'đội trưởng bắt đầu → active'); const view = last(i)[1]; ok(V.validatePayload(view).length === 0, 'màn chiến đấu hợp lệ');
  i = await click(C, `b19|j|${runId}`); ok(/không còn tồn tại/.test(text(last(i)[1])), 'vào đội đã bắt đầu → bị từ chối');
  // 5) hủy phòng bởi chủ
  const A2 = mk('2011'); const B2 = mk('2012');
  i = await click(A2, `b19|m|${A2}|party|0`); const r2 = BC.activeRunId(A2); await click(B2, `b19|j|${r2}`);
  i = await click(A2, `b19|x|${r2}`); ok(D.get('SELECT status FROM bc19_runs WHERE run_id = ?', r2).status === 'abandoned', 'chủ hủy phòng'); ok(BC.activeRunId(A2) === null && BC.activeRunId(B2) === null, 'cả hai được giải phóng');
  // 6) Rời Đội: thành viên rời, chủ rời → đóng
  const A3 = mk('2021'); const B3 = mk('2022'); await click(A3, `b19|m|${A3}|party|0`); const r3 = BC.activeRunId(A3); await click(B3, `b19|j|${r3}`); i = await click(B3, `b19|l|${r3}`);
  ok(BC.activeRunId(B3) === null && D.all('SELECT 1 FROM bc19_members WHERE run_id = ?', r3).length === 1, 'thành viên rời đội'); await click(B3, `b19|j|${r3}`); i = await click(A3, `b19|l|${r3}`); ok(D.get('SELECT status FROM bc19_runs WHERE run_id = ?', r3).status === 'abandoned', 'chủ rời → đóng phòng');
  // 7) kẹt phòng chờ cũ: lập đội mới / vào đội khác phải tự giải phóng
  const A4 = mk('2031'); const B4 = mk('2032'); await click(A4, `b19|m|${A4}|party|0`); const old = BC.activeRunId(A4);
  i = await click(A4, `b19|m|${A4}|party|0`); const nu = BC.activeRunId(A4); ok(nu && nu !== old, 'lập đội lần 2 không bị "đang ở đội khác"'); ok(D.get('SELECT status FROM bc19_runs WHERE run_id = ?', old).status === 'abandoned', 'phòng cũ tự đóng'); ok(V.validatePayload(last(i)[1]).length === 0, 'tin nhắn hợp lệ');
  await click(B4, `b19|j|${nu}`); const A5 = mk('2041'); await click(A5, `b19|m|${A5}|party|0`); const r5 = BC.activeRunId(A5); i = await click(B4, `b19|j|${r5}`); ok(!/đang ở trong một lần/.test(text(last(i)[1])) && BC.activeRunId(B4) === r5, 'B đang kẹt phòng khác vẫn vào được đội mới'); ok(D.all('SELECT 1 FROM bc19_members WHERE run_id = ?', nu).length === 1, 'tự rời phòng cũ');
  // 8) không kẹt khi đang chạy: người trong lần thám hiểm ĐANG ĐÁNH vẫn bị chặn đúng
  const S = mk('2051'); i = await click(S, `b19|m|${S}|solo|0`); ok(D.get("SELECT status FROM bc19_runs WHERE run_id = ?", BC.activeRunId(S)).status === 'active', 'solo bắt đầu'); i = await click(S, `b19|m|${S}|party|0`); ok(/đang ở trong một lần|đã vào|khác/.test(text(last(i)[1])), 'đang đánh thì không lập thêm đội');
  // 9) dọn phòng bỏ quên
  const T = mk('2061'); await click(T, `b19|m|${T}|party|0`); const rt = BC.activeRunId(T); D.run('UPDATE bc19_runs SET updated_at = updated_at - 4000 WHERE run_id = ?', rt); ok(BC.sweepLobbies() >= 1 && BC.activeRunId(T) === null, 'sweepLobbies đóng phòng bỏ quên 30 phút'); 
  // 10) chủ menu: người khác bấm menu của A
  i = await click(B, `b19|m|${A}|party|0`); ok(/không phải menu của bạn/.test(text(last(i)[1])), 'menu chỉ chủ nhân dùng được');
  console.log(`✅ test_bicanh_party214: ${n} kiểm tra PASS`);
})().catch((e) => { console.error(e); process.exit(1); });
