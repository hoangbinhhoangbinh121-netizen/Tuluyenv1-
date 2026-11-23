'use strict';
// V21.4 — STRICT BUTTON TEST (mock): 14 tình huống router (kế hoạch §3.1) + từng nút PvP (§3.3) đi qua kit.routeComponent bằng customId THẬT.
// Chỉ chứng minh logic của bot với discord.js giả lập — KHÔNG thay thế thử trên Discord thật (§3.4: NOT TESTED).
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_btn214_${Date.now()}.db`);
process.env.TG_STRICT_UI = '1';
const assert = require('node:assert'); const fs = require('node:fs'); const path = require('node:path');
const D = require('../src/db'); D.initDb();
const { E } = require('../src/game/emoji'); for (const f of fs.readdirSync(path.join(__dirname, '..', 'assets', 'emoji'))) { const k = f.replace(/\.png$/, ''); E[k] = `<:tg7_${k}:123456789012345678>`; }
const Cu = require('../src/game/cultivator'); const P = require('../src/game/pvpCore'); const C21 = require('../src/game/combat21'); const Pvp = require('../src/game/pvp');
const kit = require('../src/ui/kit'); const PV = require('../src/ui/pvpViews'); const { normalizePayload } = require('../src/ui/skin'); const V = require('../src/ui/validate');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const A = '3000000000000000001'; const B = '3000000000000000002'; const X = '3000000000000000009';
for (const u of [A, B, X]) { Cu.createCultivator(u); Cu.updateCultivator(u, { realm_index: 2, stage_index: 1, atk: 400, def_: 300, spd: 100, hp: 5000, tu_vi: 100000, cur_hp: 5000 }); }
const fake = (uid, customId, values, extra = {}) => { const log = []; const i = { customId, user: { id: String(uid), username: 'u' + uid }, member: { displayName: 'U' + uid }, values, guildId: 'g1', channelId: 'c1', guild: { id: 'g1', members: { cache: { get: () => ({}) }, fetch: async () => ({}) } }, client: {}, deferred: false, replied: false,
  update: async (p) => { normalizePayload(p, { edit: true }); i.replied = true; log.push(['update', p]); }, editReply: async (p) => { normalizePayload(p, { edit: true }); log.push(['edit', p]); }, reply: async (p) => { normalizePayload(p); i.replied = true; log.push(['reply', p]); }, followUp: async (p) => { normalizePayload(p); log.push(['follow', p]); },
  fetchReply: async () => ({ id: '999', edit: async () => {} }), ...extra }; i.log = log; return i; };
const txt = (i) => i.log.map(([, p]) => (typeof p === 'string' ? p : (p.content || '') + JSON.stringify((p.embeds || []).map((e) => (e.toJSON ? e.toJSON() : e))))).join(' | ');
const route = async (uid, cid, values, extra) => { const i = fake(uid, cid, values, extra); const r = await kit.routeComponent(i); i.routed = r; return i; };
const cids = (comps) => comps.flatMap((r) => (r.toJSON ? r.toJSON() : r).components.map((c) => c.custom_id));
const click = async (uid, cidKey, comps, values) => { const id = cids(comps).find((x) => x.endsWith(`|${cidKey}`)); assert.ok(id, `không có nút ${cidKey}`); await sleep(450); return route(uid, id, values); };   // 450ms > 0,4s chống spam → hành vi người thật

(async () => {
  // ================= §3.1 router: 14 tình huống bằng View thường
  let calls = 0; let boom = false;
  const mkView = (owner, timeout = 5) => { const v = new kit.View({ ownerId: owner, timeout }); v.button({ key: 'go', label: 'Go', style: 'green' }, async (i) => { calls += 1; if (boom) throw new Error('lỗi giả'); await i.reply({ content: 'đã xử lý' }); }); return v; };
  let v = mkView(A); const go = cids(v.components())[0];
  let i = await route(A, go); ok(calls === 1 && /đã xử lý/.test(txt(i)), '1. đúng chủ bấm → handler chạy 1 lần');
  i = await route(B, go); ok(calls === 1 && /không phải menu của bạn/.test(txt(i)), '2. người khác bấm → từ chối, handler không chạy');
  await sleep(450); i = await route(A, go); i = await route(A, go); ok(calls === 2 && /quá nhanh/.test(txt(i)), '7. bấm đúp <0,4s → lần 2 bị chặn, handler chỉ chạy 1 lần thêm');
  await sleep(450); boom = true; i = await route(A, go); ok(i.routed === true && /mã lỗi|lỗi/i.test(txt(i)), '10. handler ném lỗi → trả thông báo lỗi, không sập'); boom = false;
  v.stop(); await sleep(450); i = await route(A, go); ok(/hết hạn|không còn/.test(txt(i)) && calls === 3, '3/4. view đã stop/hết hạn → báo hết hạn, handler không chạy');
  const v2 = mkView(A, 0.05); const go2 = cids(v2.components())[0]; await sleep(120); i = await route(A, go2); ok(/hết hạn|không còn/.test(txt(i)), '3. hết hạn theo timeout thật');
  i = await route(A, 'chuoi-khong-co-gach-doc'); ok(i.routed === false && i.log.length === 0, '5. customId sai định dạng → bỏ qua (false), không lỗi');
  i = await route(A, 'zzzzzz|abc'); ok(/hết hạn|không còn/.test(txt(i)), '6. customId không còn tồn tại → báo hết hạn (không im lặng)');
  const v3 = mkView(A); await sleep(450); i = await route(A, `${v3.id}|khong_co_key`); ok(i.log.length === 1 && /không còn hiệu lực/.test(txt(i)), '6b. view còn nhưng nút không tồn tại → có phản hồi (trước v21.4: im lặng)');
  // hai người bấm cùng lúc vào menu công khai (ownerId null)
  let hits = 0; const pub = new kit.View({ ownerId: null, checkOwner: false, timeout: 5 }); pub.button({ key: 'p', label: 'p' }, async (i2) => { hits += 1; await i2.reply({ content: 'ok' }); }); const pid = cids(pub.components())[0];
  const [r1, r2] = await Promise.all([route(A, pid), route(B, pid)]); ok(hits === 2 && /ok/.test(txt(r1)) && /ok/.test(txt(r2)), '8. hai người bấm đồng thời → cả hai được xử lý độc lập');
  // 12. static handler sau "restart" (registry View rỗng): vẫn chạy được vì đăng ký bằng mã
  i = await route(A, 'pl|khongcoma|0|0'); ok(/Không tìm thấy/.test(txt(i)), '12. static handler gọi được không cần View trong RAM');
  // ================= §3.3 PvP: từng nút
  // Chấp Nhận / Từ Chối
  D.run('UPDATE cultivators SET last_pvp = 0');
  let sent = null; const err = await Pvp.sendChallenge(A, B, async (p) => { sent = { ...p, edit: async () => {} }; return sent; }); ok(err === '' && sent, 'gửi lời khiêu chiến');
  let ch = sent.components; ok(V.validatePayload(sent).length === 0, 'thẻ khiêu chiến hợp lệ');
  i = await click(X, 'ok', ch); ok(/không dành cho bạn/.test(txt(i)) && Pvp.SESSIONS.size === 0, 'Chấp Nhận: người ngoài không nhận được');
  i = await click(A, 'ok', ch); ok(/không dành cho bạn/.test(txt(i)) && Pvp.SESSIONS.size === 0, 'Chấp Nhận: chính người khiêu chiến cũng không tự nhận');
  i = await click(X, 'no', ch); ok(/không dành cho bạn/.test(txt(i)) && Pvp.BUSY.has(A), 'Từ Chối: người ngoài không từ chối thay');
  i = await click(B, 'ok', ch); ok(Pvp.SESSIONS.size === 1, 'Chấp Nhận: đúng người → mở trận'); const s = [...Pvp.SESSIONS.values()][0];
  i = await click(B, 'ok', ch); ok(/đã kết thúc|hết hạn|không còn/.test(txt(i)) && Pvp.SESSIONS.size === 1, 'Chấp Nhận bấm lại → không mở trận thứ hai');
  // từ chối ở lời khiêu chiến khác
  for (const u of [A, B]) Pvp.BUSY.delete(u); Pvp.SESSIONS.clear(); D.run('UPDATE cultivators SET last_pvp = 0'); let sent2 = null; await Pvp.sendChallenge(A, B, async (p) => { sent2 = p; return { edit: async () => {} }; });
  i = await click(B, 'no', sent2.components); ok(/đã từ chối/.test(txt(i)) && !Pvp.BUSY.has(A) && !Pvp.BUSY.has(B), 'Từ Chối: đúng người → huỷ, giải phóng BUSY');
  // trận thật: dùng phiên s
  Pvp.SESSIONS.clear(); for (const u of [A, B]) Pvp.BUSY.delete(u); D.run('UPDATE cultivators SET last_pvp = 0');
  const sess = Pvp._test.buildSession('g1', 'c1', A, B); sess.message = { id: '1', edit: async () => {} }; let rv = Pvp._test.roundView(sess); sess.active_view = rv; let comps = rv.components();
  ok(cids(comps).length === 5 && new Set(cids(comps)).size === 5, 'trận có 5 nút khác custom_id (Đánh Thường/Công Pháp/Phòng Thủ/Sát Chiêu/Đầu Hàng)');
  i = await click(X, 'atk', comps); ok(/không phải trận/.test(txt(i)) && !sess.acted.A && !sess.acted.B, 'người ngoài trận bấm nút trận → từ chối, không ảnh hưởng');
  i = await click(A, 'atk', comps); ok(sess.acted.A && sess.actions.A === P.ATTACK_NORMAL, 'Đánh Thường ghi nhận');
  i = await click(A, 'kill', comps); ok(/đã chọn/.test(txt(i)) && sess.actions.A === P.ATTACK_NORMAL, 'bấm thêm nút khác cùng hiệp → bị từ chối, hành động đầu giữ nguyên (đúng 1 lần/lượt)');
  i = await click(A, 'atk', comps); ok(/đã chọn/.test(txt(i)), 'Đánh Thường bấm lại → từ chối');
  const roundBefore = sess.round; i = await click(B, 'def', comps); ok(sess.round === roundBefore + 1 || sess.settled, 'Phòng Thủ (B) → đủ 2 bên → qua hiệp');
  ok(sess.log[0].t.includes(P.PVP_ACTION_DEFEND) || sess.log[0].t.includes('phòng thủ'), 'Phòng Thủ có hiệu lực ghi trong nhật ký');
  // Phòng Thủ thật sự giảm sát thương (thống kê, 400 hiệp mỗi nhánh)
  const dmgAvg = (def) => { let t = 0; let k = 0; for (let r = 0; r < 400; r++) { D.run('UPDATE cultivators SET last_pvp = 0'); const b = C21.createBattle(Cu.getCultivator(A), Cu.getCultivator(B), {}); const hp = b.hp; const rr = P.roundAction(b.tag.A, b.tag.B, b.atk.A, b.def_.B, b.power.A, b.power.B, b.skills.A, '', hp, 'B', P.ATTACK_NORMAL, def, false, { att: b.mods.A, def: b.mods.B, pet: { arena: b.arena } }); if (rr.record.damage) { t += rr.record.damage; k++; } } return t / k; };
  const dNo = dmgAvg(false); const dDef = dmgAvg(true); ok(dDef < dNo * 0.8, `Phòng Thủ thật sự giảm sát thương (TB ${dDef.toFixed(2)} vs ${dNo.toFixed(2)})`);
  // Sát Chiêu: ghi nhận hợp lệ; FINDING: không có cooldown/chi phí
  if (!sess.settled) {
    comps = Pvp._test.roundView(sess).components(); sess.active_view = null;
    rv = Pvp._test.roundView(sess); sess.active_view = rv; comps = rv.components();
    i = await click(A, 'kill', comps); ok(sess.actions.A === P.PVP_ACTION_KILLMOVE, 'Sát Chiêu ghi nhận hành động hợp lệ');
    // Đầu Hàng 2 bước: bấm Đầu Hàng → chỉ hiện xác nhận, KHÔNG kết thúc
    const tokBefore = sess.round_token;
    i = await click(B, 'sur', comps); ok(/Xác nhận\?/.test(txt(i)), 'Đầu Hàng → hiện bước xác nhận'); ok(!sess.settled && !sess.acted.B, 'Đầu Hàng chưa xác nhận → trận chưa kết thúc, B chưa bị tính hành động');
    const confirmCid = cids(i.log[0][1].components)[0]; ok(/\|yes$/.test(confirmCid), 'có nút Xác nhận');
    i = await click(B, 'atk', comps); ok(!sess.settled && sess.round_token === tokBefore + 1, 'Hủy đầu hàng (bỏ qua bước xác nhận) → B đánh bình thường, trận tiếp tục sang hiệp mới');
  }
  // Xác nhận chỉ đúng người + đúng hiệp
  Pvp.SESSIONS.clear(); for (const u of [A, B]) Pvp.BUSY.delete(u); D.run('UPDATE cultivators SET last_pvp = 0');
  const s2 = Pvp._test.buildSession('g1', 'c1', A, B); s2.message = { id: '2', edit: async () => {} }; const rv2 = Pvp._test.roundView(s2); s2.active_view = rv2; const comps2 = rv2.components();
  i = await click(A, 'sur', comps2); const yes = cids(i.log[0][1].components)[0]; await sleep(450);
  const iX = await route(X, yes); ok(!s2.settled, 'Xác nhận: người khác bấm nút xác nhận của A → không có tác dụng'); ok(/không phải menu của bạn/.test(txt(iX)), 'Xác nhận: báo không phải menu của bạn');
  const iB = await route(B, yes); ok(!s2.settled, 'Xác nhận: đối thủ cũng không bấm thay được');
  // hiệp cũ: xác nhận sau khi hiệp đã qua
  await Pvp._test.recordAction(s2, 'B', P.ATTACK_NORMAL); await Pvp._test.recordAction(s2, 'A', P.ATTACK_NORMAL); ok(s2.round === 1 && !s2.settled, 'qua hiệp 1');
  await sleep(450); const late = await route(A, yes); ok(/đã muộn|Đã muộn/.test(txt(late)) && !s2.settled, 'Xác nhận của hiệp cũ → bị từ chối, trận không kết thúc');
  // xác nhận đúng
  const rv2b = Pvp._test.roundView(s2); s2.active_view = rv2b; const comps2b = rv2b.components(); i = await click(A, 'sur', comps2b); const yes2 = cids(i.log[0][1].components)[0]; await sleep(450);
  const okc = await route(A, yes2); ok(s2.settled && D.get('SELECT result, reason FROM v213_battles WHERE id = ?', s2.id).reason === 'surrender', 'Xác nhận đúng người/đúng hiệp → đầu hàng kết thúc trận');
  await sleep(450); const again = await route(A, yes2); ok(again.log.length === 1 && /muộn|hết hạn|không còn/.test(txt(again)), 'bấm Xác nhận lần 2 → được trả lời "đã muộn", không xử lý lại'); ok(D.get('SELECT COUNT(*) AS n FROM v213_battles WHERE id = ? AND status = ?', s2.id, 'done').n === 1, 'chốt đúng 1 lần');
  // Xem Nhật Ký / Lọc / Trang
  const bid = s2.id;   D.run("UPDATE v213_battles SET log = ? WHERE id = ?", JSON.stringify(Array.from({ length: 11 }, (_, k) => ({ r: k + 1, t: `hiệp ${k + 1}`, a: 90, b: 90, x: k % 2 }))), bid);
  await sleep(450); i = await route(A, `pl|${bid}|0|0`); let ft = i.log[0][1].embeds[0].toJSON().footer.text; ok(/Trang 1\/3/.test(ft), 'Xem nhật ký: đúng mã trận, trang 1/3');
  await sleep(450); i = await route(A, `pl|${bid}|99|0`); ft = i.log[0][1].embeds[0].toJSON().footer.text; ok(/Trang 3\/3/.test(ft), 'Trang tiếp: không vượt số trang');
  await sleep(450); i = await route(A, `pl|${bid}|-5|0`); ft = i.log[0][1].embeds[0].toJSON().footer.text; ok(/Trang 1\/3/.test(ft), 'Trang trước: không xuống trang âm');
  await sleep(450); i = await route(A, `pl|${bid}|0|1`); const f1 = i.log[0][1].embeds[0].toJSON(); ok(/Trang 1\/2/.test(f1.footer.text) && f1.fields.every((f) => /hiệp (2|4|6|8|10)$/.test(f.value) || /^hiệp (2|4|6|8)/.test(f.value)), 'Lọc nhật ký: chỉ hiệp có đổi sinh lực (x=1) → 5 hiệp, 2 trang');
  await sleep(450); i = await route(X, `pl|${bid}|0|0`); ok(/Chỉ hai người trong trận/.test(txt(i)) && !i.log.some(([k]) => k === 'update'), 'nhật ký: người ngoài trận không xem được');
  await sleep(450); i = await route(B, `pl|${bid}|abc|zz`); ok(i.log.length === 1, 'tham số trang rác → vẫn phản hồi, không sập');
  await sleep(450); i = await route(A, `pl|${bid}`); ok(i.log.length >= 1, 'customId thiếu tham số → vẫn phản hồi');
  console.log(`✅ test_buttons214: ${n} kiểm tra PASS`);
})().catch((e) => { console.error(e); process.exit(1); });
