'use strict';
// V21.3 — PvP engine mới: không giới hạn hiệp, AFK=bỏ lượt, hòa (KO đôi/bế tắc/AFK đôi), đầu hàng, chốt trận 1 lần (idempotent), nhật ký, huỷ khi restart, embed không vượt giới hạn.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_pvp21_${Date.now()}.db`);
const assert = require('node:assert'); const fs = require('node:fs'); const path = require('node:path');
const D = require('../src/db'); D.initDb();
const { E } = require('../src/game/emoji'); for (const f of fs.readdirSync(path.join(__dirname, '..', 'assets', 'emoji'))) { const k = f.replace(/\.png$/, ''); E[k] = `<:tg7_${k}:123456789012345678>`; }
const Cu = require('../src/game/cultivator'); const P = require('../src/game/pvpCore'); const C21 = require('../src/game/combat21'); const Pvp = require('../src/game/pvp'); const ST = require('../src/game/settings');
const PV = require('../src/ui/pvpViews'); const kit = require('../src/ui/kit');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const A = '1000000000000000001'; const B = '1000000000000000002';
for (const u of [A, B]) { Cu.createCultivator(u); Cu.updateCultivator(u, { realm_index: 2, stage_index: 1, atk: 400, def_: 300, spd: 100 + (u === A ? 5 : 0), hp: 5000, tu_vi: 100000, cur_hp: 5000 }); }
const rowOf = (u) => Cu.getCultivator(u); const tuvi = (u) => rowOf(u).tu_vi;
const fresh = () => { D.run('UPDATE cultivators SET last_pvp = 0 WHERE user_id IN (?, ?)', A, B); return C21.createBattle(rowOf(A), rowOf(B), { now: 1000 }); };
const embedOk = (e) => { const j = e.toJSON(); const total = (j.title || '').length + (j.description || '').length + (j.fields || []).reduce((s, f) => s + f.name.length + f.value.length, 0) + ((j.footer && j.footer.text) || '').length; return (j.fields || []).length <= 25 && total <= 6000 && (j.fields || []).every((f) => f.value.length <= 1024 && f.name.length <= 256) && (j.description || '').length <= 4096; };
const NOERR = (fn, m) => { try { fn(); ok(true, m); } catch (e) { assert.fail(`${m}: ${e.stack}`); } };

(async () => {
  // ---------------------------------------------------------------- 1) mô phỏng nhiều trận bằng engine dùng chung
  const res = { A: 0, B: 0, draw: 0 }; let maxRounds = 0; let over5 = 0;
  for (let i = 0; i < 150; i++) {
    const b = fresh(); const v = C21.simulate(b);
    ok(['A', 'B', 'draw'].includes(v.result) && v.over, 'kết quả hợp lệ'); res[v.result] += 1; maxRounds = Math.max(maxRounds, b.round); if (b.round > 5) over5 += 1;
    ok(b.log.length === b.round, 'mỗi hiệp 1 dòng nhật ký');
    if (v.reason === 'ko') ok((v.result === 'A' ? b.hp.B : b.hp.A) <= 0, 'KO ⇒ bên thua hết sinh lực');
    if (i % 10 === 0) ok(embedOk(C21.embed(b, { verdict: v })), 'embed trong giới hạn Discord');
  }
  console.log('   mô phỏng 150 trận:', JSON.stringify(res), 'tối đa', maxRounds, 'hiệp; trận >5 hiệp:', over5);
  ok(maxRounds >= 1, 'chạy được'); ok(over5 > 0, 'có trận kéo dài quá 5 hiệp (đã bỏ giới hạn 5 hiệp)');

  // ---------------------------------------------------------------- 2) AFK / đầu hàng / bế tắc / KO đôi
  let b = fresh(); const afkLimit = b.policy.afkForfeit;
  let v; for (let i = 0; i < afkLimit; i++) { ({ verdict: v } = C21.playRound(b, { A: P.ATTACK_NORMAL, B: null })); }
  ok(v.over && v.result === 'A' && v.reason === 'afk', 'B AFK liên tiếp → A thắng'); ok(b.totals.B.afk === afkLimit, 'đếm lượt AFK');
  ok(b.log[0].t.includes('bỏ lượt'), 'AFK = bỏ lượt (có dòng báo)'); ok(b.totals.B.taken >= 0 && b.hp.B <= 100, 'A vẫn được ra đòn');
  b = fresh(); C21.playRound(b, { A: null, B: null }); ok(!C21.judge(b).over, '1 lần AFK chưa xử'); ok(b.hp.A === 100 && b.hp.B === 100, 'AFK đôi không ai bị đánh (không tự đánh thường)');
  ({ verdict: v } = C21.playRound(b, { A: null, B: null })); ok(v.over && v.result === 'draw' && v.reason === 'afk_both', 'cả hai AFK liên tiếp → hòa');
  b = fresh(); C21.playRound(b, { A: null, B: P.ATTACK_NORMAL }); C21.playRound(b, { A: P.ATTACK_NORMAL, B: null }); ok(b.afk.A === 0, 'hành động ở hiệp sau reset bộ đếm AFK');
  b = fresh(); ({ verdict: v } = C21.playRound(b, { A: C21.SURRENDER, B: P.ATTACK_NORMAL })); ok(v.over && v.result === 'B' && v.reason === 'surrender' && b.hp.A === 100 && b.hp.B === 100, 'đầu hàng → bên kia thắng, không ra đòn');
  b = fresh(); ({ verdict: v } = C21.playRound(b, { A: C21.SURRENDER, B: C21.SURRENDER })); ok(v.over && v.result === 'B', 'đầu hàng cùng lúc: quy tắc xác định (A đứng trước) — không random');
  b = fresh(); let r = 0; do { ({ verdict: v } = C21.playRound(b, { A: P.PVP_ACTION_DEFEND, B: P.PVP_ACTION_DEFEND })); r += 1; } while (!v.over && r < 500);
  ok(v.over && v.result === 'draw' && v.reason === 'stalemate' && r === b.policy.stalemate, `bế tắc → hòa sau đúng ${b.policy.stalemate} hiệp (${r})`);
  b = fresh(); b.hp.A = 0; b.hp.B = 0; ok(C21.judge(b).result === 'draw' && C21.judge(b).reason === 'double_ko', 'KO đồng thời → hòa (không tung đồng xu)');
  b = fresh(); b.hp.A = 40; b.hp.B = 40; ok(!C21.judge(b).over, 'ngang sinh lực KHÔNG tự phân thắng bại');
  b = fresh(); b.round = b.policy.safety; ok(C21.judge(b).reason === 'safety' && C21.judge(b).result === 'draw', 'chốt chặn an toàn → hòa');
  ST.set('pvp_afk_forfeit', 3); ST.set('pvp_stalemate_rounds', 7); b = fresh(); ok(b.policy.afkForfeit === 3 && b.policy.stalemate === 7, 'chính sách chỉnh được bằng bot_settings'); ST.set('pvp_afk_forfeit', 2); ST.set('pvp_stalemate_rounds', 15);
  ST.set('pvp_afk_forfeit', 'abc'); ok(C21.policy().afkForfeit === 2, 'giá trị rác → mặc định'); ST.set('pvp_afk_forfeit', 2);

  // ---------------------------------------------------------------- 3) chốt trận: đúng 1 lần, hòa không đổi tu vi
  let t0 = tuvi(A) + tuvi(B);
  b = fresh(); C21.record(b); b.hp.B = 0; let vd = C21.judge(b); b.round = 4;
  const a0 = tuvi(A); const b0 = tuvi(B);
  let real = P.settleBattle(b, vd, 2000); ok(typeof real === 'number' && real > 0, `thắng nhận tu vi (${real})`);
  ok(tuvi(A) === a0 + real && tuvi(B) === b0 - real, 'tu vi chuyển đúng 1 lần'); ok(tuvi(A) + tuvi(B) === t0, 'tổng tu vi bảo toàn');
  ok(P.settleBattle(b, vd, 2001) === 'dup', 'chốt lần 2 cùng trận → dup'); ok(tuvi(A) === a0 + real, 'không cộng lần 2');
  let row = D.get('SELECT * FROM v213_battles WHERE id = ?', b.id); ok(row.status === 'done' && row.result === 'A' && row.stake === real && row.rounds === 4, 'v213_battles đã chốt');
  ok(D.get('SELECT COUNT(*) AS n FROM pvp_history WHERE ended_at = 2000').n === 1, 'pvp_history chỉ 1 dòng'); ok(rowOf(A).pvp_wins === 1 && rowOf(B).pvp_losses === 1, 'đếm thắng/thua');
  b = fresh(); C21.record(b); D.run('UPDATE cultivators SET last_pvp = ? WHERE user_id = ?', 3000, A);
  ok(P.settleBattle(b, { over: true, result: 'A', reason: 'ko' }, 3000.1) === null, 'cooldown bị tiêu bởi trận khác → null'); ok(D.get('SELECT status FROM v213_battles WHERE id = ?', b.id).status === 'active', 'null ⇒ không đánh dấu done'); ok(C21.abort(b.id, 'cooldown') && D.get('SELECT status FROM v213_battles WHERE id = ?', b.id).status === 'aborted', 'huỷ trận không chốt');
  const before = [tuvi(A), tuvi(B)]; b = fresh(); C21.record(b); b.round = 9; real = P.settleBattle(b, { over: true, result: 'draw', reason: 'stalemate' }, 4000);
  ok(real === 0 && tuvi(A) === before[0] && tuvi(B) === before[1], 'HÒA: không ai mất/được tu vi'); ok(rowOf(A).last_pvp === 4000, 'hòa vẫn tiêu cooldown');
  row = D.get('SELECT * FROM v213_battles WHERE id = ?', b.id); ok(row.status === 'done' && row.result === 'draw' && row.reason === 'stalemate', 'hòa được ghi'); ok(D.get('SELECT COUNT(*) AS n FROM pvp_history WHERE ended_at = 4000').n === 0, 'hòa không vào pvp_history (không tính thắng/thua)');
  ok(P.settleBattle(b, { over: true, result: 'draw', reason: 'stalemate' }, 4001) === 'dup', 'hòa cũng chốt 1 lần');
  // thua không âm tu vi
  D.run('UPDATE cultivators SET tu_vi = 5 WHERE user_id = ?', B); b = fresh(); C21.record(b); real = P.settleBattle(b, { over: true, result: 'A', reason: 'ko' }, 5000); ok(real <= 5 && tuvi(B) >= 0, 'tu vi người thua không âm'); D.run('UPDATE cultivators SET tu_vi = 100000 WHERE user_id IN (?, ?)', A, B);

  // ---------------------------------------------------------------- 4) đấu tự động doPvp dùng chung engine
  D.run('UPDATE cultivators SET last_pvp = 0'); const d1 = P.doPvp(A, B); ok(typeof d1 === 'object' && d1.embed && ['A', 'B', 'draw'].includes(d1.result), 'doPvp chạy bằng engine'); ok(embedOk(d1.embed), 'embed doPvp trong giới hạn');
  ok(D.get("SELECT status FROM v213_battles WHERE id = ?", d1.battleId).status === 'done', 'doPvp ghi nhật ký trận'); ok(typeof P.doPvp(A, B) === 'string', 'cooldown chặn trận tiếp');
  ok(/Mã trận/.test(JSON.stringify(d1.embed.toJSON())), 'embed có mã trận');
  for (let i = 0; i < 30; i++) { D.run('UPDATE cultivators SET last_pvp = 0'); const d = P.doPvp(A, B); ok(typeof d === 'object' && embedOk(d.embed), 'doPvp lặp'); }

  // ---------------------------------------------------------------- 5) PvP tương tác (phiên, nút, hết giờ AFK, đầu hàng, bấm đúp)
  const mkMsg = () => { const m = { id: '777', edits: 0, edit: async () => { m.edits += 1; } }; return m; };
  D.run('UPDATE cultivators SET last_pvp = 0');
  let s = Pvp._test.buildSession('g1', 'c1', A, B); s.message = mkMsg(); s.active_view = Pvp._test.roundView(s);
  ok(Pvp.BUSY.get(A) === s.id && D.get('SELECT status FROM v213_battles WHERE id = ?', s.id).status === 'active', 'phiên mở: BUSY + v213 active');
  await Pvp._test.recordAction(s, 'A', P.ATTACK_NORMAL); await Pvp._test.recordAction(s, 'A', P.PVP_ACTION_KILLMOVE); ok(s.actions.A === P.ATTACK_NORMAL, 'bấm đúp: lựa chọn đầu giữ nguyên');
  await Pvp._test.recordAction(s, 'B', P.ATTACK_NORMAL); ok(s.round === 1 && s.round_token === 1 || s.settled, 'đủ 2 bên → qua hiệp');
  // AFK: A hoạt động, B bỏ → hết giờ
  let guard = 0; const tv = [tuvi(A), tuvi(B)];
  while (!s.settled && guard++ < 50) {
    await Pvp._test.recordAction(s, 'A', P.ATTACK_NORMAL);
    if (s.settled) break;
    await s.active_view.onTimeout();           // B không chọn → hết giờ → bỏ lượt
  }
  ok(s.settled, 'trận AFK kết thúc'); const row2 = D.get('SELECT * FROM v213_battles WHERE id = ?', s.id); ok(row2.status === 'done', 'đã chốt');
  ok(['afk', 'ko'].includes(row2.reason) && row2.result !== 'draw' || row2.reason === 'stalemate', `kết thúc hợp lệ (${row2.result}/${row2.reason})`);
  ok(!Pvp.BUSY.has(A) && !Pvp.BUSY.has(B) && !Pvp.SESSIONS.has(s.id), 'dọn phiên'); ok(s.message.edits > 0, 'cập nhật tin nhắn');
  ok(tuvi(A) + tuvi(B) === tv[0] + tv[1], 'tổng tu vi bảo toàn'); ok(embedOk(C21.embed(s, { verdict: { result: row2.result, reason: row2.reason } })), 'embed cuối hợp lệ');
  const sNo = s; await Pvp._test.recordAction(sNo, 'A', P.ATTACK_NORMAL); ok(D.get('SELECT COUNT(*) AS n FROM v213_battles WHERE id = ? AND status = ?', s.id, 'done').n === 1, 'action sau khi kết thúc bị bỏ qua');
  // đầu hàng
  D.run('UPDATE cultivators SET last_pvp = 0'); s = Pvp._test.buildSession('g1', 'c1', A, B); s.message = mkMsg(); s.active_view = Pvp._test.roundView(s);
  const aw = tuvi(A); await Pvp._test.recordAction(s, 'A', C21.SURRENDER); ok(s.settled, 'đầu hàng chốt ngay'); const r3 = D.get('SELECT * FROM v213_battles WHERE id = ?', s.id); ok(r3.result === 'B' && r3.reason === 'surrender', 'đầu hàng → B thắng'); ok(tuvi(A) <= aw, 'người đầu hàng không được tu vi');
  // cả hai AFK → hòa
  D.run('UPDATE cultivators SET last_pvp = 0'); s = Pvp._test.buildSession('g1', 'c1', A, B); s.message = mkMsg(); s.active_view = Pvp._test.roundView(s);
  const tb = [tuvi(A), tuvi(B)]; await s.active_view.onTimeout(); ok(!s.settled && s.round === 1, 'AFK đôi lần 1: bỏ lượt, trận tiếp tục'); await s.active_view.onTimeout(); ok(s.settled, 'AFK đôi lần 2: kết thúc'); const r4 = D.get('SELECT * FROM v213_battles WHERE id = ?', s.id); ok(r4.result === 'draw' && r4.reason === 'afk_both', 'hòa'); ok(tuvi(A) === tb[0] && tuvi(B) === tb[1], 'hòa: tu vi giữ nguyên');
  // nút cũ của hiệp trước không tính (token)
  D.run('UPDATE cultivators SET last_pvp = 0'); s = Pvp._test.buildSession('g1', 'c1', A, B); s.message = mkMsg(); const v1 = Pvp._test.roundView(s); s.active_view = v1; await Pvp._test.recordAction(s, 'A', P.ATTACK_NORMAL); await Pvp._test.recordAction(s, 'B', P.ATTACK_NORMAL);
  const tok = s.round_token; if (!s.settled) { await v1.onTimeout(); ok(s.round_token === tok, 'timeout của view cũ không phá hiệp mới'); }
  if (!s.settled) await Pvp._test.recordAction(s, 'A', C21.SURRENDER);

  // ---------------------------------------------------------------- 6) restart: huỷ trận dở, không ai mất gì
  D.run('UPDATE cultivators SET last_pvp = 0'); s = Pvp._test.buildSession('g1', 'c1', A, B); s.message = mkMsg(); C21.setMessage(s.id, '555');
  Pvp.SESSIONS.clear(); Pvp.BUSY.clear(); require('../src/game/settings').set('pvp_resume_window', '0');   // v21.7: mô phỏng tiến trình mới + tắt khôi phục → hành vi huỷ cũ
  const tr = [tuvi(A), tuvi(B)]; const cnt = await Pvp.recoverStale({ channels: { fetch: async () => ({ messages: { fetch: async () => ({ edit: async () => {} }) } }) } });
  ok(cnt >= 1, 'recoverStale huỷ trận active'); ok(D.get('SELECT status, reason FROM v213_battles WHERE id = ?', s.id).reason === 'restart', 'lý do restart'); ok(tuvi(A) === tr[0] && tuvi(B) === tr[1], 'huỷ do restart: tu vi không đổi'); ok(await Pvp.recoverStale(null) === 0, 'chạy lại không huỷ gì thêm');
  Pvp.SESSIONS.clear(); Pvp.BUSY.clear();
  ok(P.settleBattle(s, { over: true, result: 'A', reason: 'ko' }, 9000) === 'dup', 'trận đã huỷ (restart) không chốt được nữa (chống nhân đôi sau restart)');

  // ---------------------------------------------------------------- 7) nhật ký + lịch sử
  const doneId = d1.battleId; let pan = PV.battleLogPanel(doneId, 0, 0); ok(pan.embeds && embedOk(pan.embeds[0]) && pan.components.length === 1, 'panel nhật ký');
  ok(PV.battleLogPanel('zzzz', 0, 0).content.includes('Không tìm thấy'), 'mã sai');
  const big = fresh(); C21.record(big); for (let i = 0; i < 120; i++) C21.playRound(big, { A: P.PVP_ACTION_DEFEND, B: P.PVP_ACTION_DEFEND }) ; // 15 hiệp rồi hòa; thêm tay để thử trang
  for (let i = 0; i < 60; i++) big.log.push({ r: big.log.length + 1, t: `hiệp giả ${i}`, a: 90, b: 90, x: i % 2 }); P.settleBattle(big, { over: true, result: 'draw', reason: 'stalemate' }, 9100);
  pan = PV.battleLogPanel(big.id, 3, 0); ok(embedOk(pan.embeds[0]) && /Trang 4\//.test(pan.embeds[0].toJSON().footer.text), 'phân trang'); const pf = PV.battleLogPanel(big.id, 0, 1); ok(/Trang 1\//.test(pf.embeds[0].toJSON().footer.text) && pf.embeds[0].toJSON().fields.every((f) => !/hiệp giả \d*[02468]$/.test(f.value)), 'lọc chỉ hiệp có đổi sinh lực');
  ok(PV.battleLogPanel(big.id, 9999, 0).embeds[0], 'trang vượt biên được kẹp');
  const mk = (id) => ({ id, username: 'x', displayName: 'x' }); const he = PV.buildHistoryEmbed(mk(A), D.all('SELECT winner_id, loser_id, stake, ended_at FROM pvp_history LIMIT 8'), C21.recent(A, 8)); ok(embedOk(he) && /mã/.test(he.toJSON().description), 'lịch sử có mã trận');
  ok(/Hòa/.test(JSON.stringify(PV.buildStatsEmbed(mk(A), rowOf(A)).toJSON())), 'thống kê có số trận hòa');
  // nút phân trang tĩnh
  let upd = null; const fakeI = { update: async (p) => { upd = p; }, user: { id: A } };
  const route = kit.routeComponent; ok(typeof route === 'function', 'routeComponent tồn tại');
  await route({ customId: `pl|${big.id}|1|0`, isButton: () => true, isStringSelectMenu: () => false, isAnySelectMenu: () => false, user: { id: A }, update: async (p) => { upd = p; }, reply: async () => {}, deferred: false, replied: false, client: {} }).catch(() => {});
  ok(upd && upd.embeds && /Trang 2\//.test(upd.embeds[0].toJSON().footer.text), 'nút ▶ chuyển trang');
  // lệnh
  const FW = require('../src/commands/framework'); require('../src/commands/pvp'); const sent = []; const cmd = FW.registry ? FW.registry.get('lichsupvp') : null;
  if (cmd) { await cmd.run({ args: { ma_tran: big.id }, user: { id: A }, send: async (p) => { sent.push(p); } }); await cmd.run({ args: {}, user: { id: A }, send: async (p) => { sent.push(p); } }); await cmd.run({ args: { ma_tran: `<@${B}>` }, user: { id: A }, send: async (p) => { sent.push(p); } }); ok(sent.length === 3 && sent[0].embeds && sent[1].embeds && sent[2].embeds, '/lichsupvp: mã trận / mặc định / @người'); }
  // slash vẫn ≤ 100
  ok(FW.buildSlashJson().length <= 100, `slash ≤ 100 (${FW.buildSlashJson().length})`);
  console.log(`✅ test_pvp21: ${n} kiểm tra PASS`);
})().catch((e) => { console.error(e); process.exit(1); });
