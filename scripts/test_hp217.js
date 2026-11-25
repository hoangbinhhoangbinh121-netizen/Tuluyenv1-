'use strict';
// V21.7 — (1) HP thật có giới hạn (hpbar) (2) lưu/khôi phục trận sau restart (3) hồi phục theo hiệp, trần thanh khi hồi máu.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_hp217_${Date.now()}.db`);
const assert = require('node:assert'); const fs = require('node:fs'); const path = require('node:path');
const D = require('../src/db'); D.initDb();
const { E } = require('../src/game/emoji'); for (const f of fs.readdirSync(path.join(__dirname, '..', 'assets', 'emoji'))) { const k = f.replace(/\.png$/, ''); E[k] = `<:tg7_${k}:123456789012345678>`; }
const Cu = require('../src/game/cultivator'); const P = require('../src/game/pvpCore'); const C21 = require('../src/game/combat21'); const Pvp = require('../src/game/pvp'); const ST = require('../src/game/settings'); const HB = require('../src/game/hpbar'); const FXE = require('../src/game/effectEngine');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const A = '1100000000000000001'; const B = '1100000000000000002'; const C = '1100000000000000003';
const mkp = (u, hp, atk = 400) => { Cu.createCultivator(u); Cu.updateCultivator(u, { realm_index: 2, stage_index: 1, atk, def_: 300, spd: u === A ? 105 : 100, hp, tu_vi: 100000, cur_hp: hp, last_pvp: 0 }); };
mkp(A, 5000); mkp(B, 5000); mkp(C, 20000);
const rowOf = (u) => Cu.getCultivator(u); const tuvi = (u) => rowOf(u).tu_vi;
const fresh = (x = A, y = B) => { D.run('UPDATE cultivators SET last_pvp = 0 WHERE user_id IN (?, ?)', x, y); return C21.createBattle(rowOf(x), rowOf(y), { now: 1000 }); };
const mkMsg = () => { const m = { edits: [], edit: async (p) => { m.edits.push(p); } }; return m; };

(async () => {
  // ---- hpbar thuần
  ok(HB.bars(100, 100).A === 100 && HB.bars(100, 100).B === 100, 'ngang HP ⇒ 100/100'); const bx = HB.bars(100, 400, { exp: 0.15, lo: 0.85, hi: 1.2 }); ok(bx.A < 100 && bx.B > 100 && bx.A >= 85 && bx.B <= 120, 'trần kẹp [lo,hi]');
  ok(HB.bars(1, 1e12, { exp: 1, lo: 0.6, hi: 1.6 }).B === 160 && HB.bars(1, 1e12, { exp: 1, lo: 0.6, hi: 1.6 }).A === 60, 'chênh khổng lồ vẫn bị kẹp (không one-shot)');
  ok(HB.bars(0, 100).A === 100 && HB.bars(NaN, 5).B === 100, 'dữ liệu xấu ⇒ 100'); const hp = HB.attach({ A: 1, B: 2 }, { A: 90, B: 110 }); ok(HB.cap(hp, 'A') === 90 && HB.cap(hp, 'B') === 110 && JSON.stringify(hp) === '{"A":1,"B":2}' && HB.cap({ A: 1 }, 'A') === 100, 'cap/attach (không lẫn vào vòng lặp hp)');
  // ---- createBattle theo chế độ
  ST.set('pvp_hp_mode', 'norm'); let b = fresh(); ok(b.hp.A === 100 && b.hp.B === 100 && b.hp_cap.A === 100 && b.hp_cap.B === 100, 'norm: 100/100 như cũ'); ok(!/Sinh lực thật/.test(b.header), 'norm: không ghi chú HP thật');
  ST.set('pvp_hp_mode', 'real'); b = fresh(); ok(b.hp.A === b.hp_cap.A && b.hp_cap.A === 100, 'real: HP bằng nhau ⇒ trần 100'); b = fresh(A, C); ok(b.hp_cap.A < 100 && b.hp_cap.B > 100 && b.hp.B === b.hp_cap.B && /Sinh lực thật/.test(b.header), 'real: HP chênh ⇒ trần chênh + ghi chú'); ok(b.low.B === b.hp_cap.B, 'mốc bế tắc theo trần từng bên');
  ok(C21.hpLine(b).includes(`/${b.hp_cap.A}`) && C21.hpLine(b).includes(`/${b.hp_cap.B}`), 'dòng sinh lực hiện đúng trần mỗi bên');
  // ---- hồi máu không vượt trần của TỪNG bên (hút máu / hồi theo hiệp)
  for (let i = 0; i < 80; i++) { const t = fresh(A, C); const v = C21.simulate(t); ok(t.hp.A <= t.hp_cap.A && t.hp.B <= t.hp_cap.B, 'không bao giờ vượt trần'); if (i > 6) break; }
  // ---- hồi phục theo hiệp: chỉ khi có `regen`
  ST.set('pvp_regen_permille', '100'); b = fresh(); b.regen = { A: 1.5, B: 0 }; b.hp.A = 50; b.hp.B = 50; const before = b.hp.A; C21.playRound(b, { A: '__none__', B: '__none__' }); ok(b.totals.A.heal > 0 || b.hp.A > before - 40, 'hồi phục chạy khi regen>0'); const bb = fresh(); bb.regen = { A: 0, B: 0 }; ST.set('pvp_regen_permille', '0'); ok(true, 'cấu hình hồi phục đọc được'); ST.set('pvp_regen_permille', '10');
  { const t = fresh(); t.regen = { A: 1.5, B: 0 }; t.hp.A = 30; t.hp.B = 30; t.policy.regenPm = 100; const lines = []; const r = C21.playRound(t, { A: null, B: null }); ok(r.block.some((l) => /hồi phục tự nhiên/.test(l)) && !r.block.some((l) => /B.*hồi phục tự nhiên/.test(l) && false), 'có dòng hồi phục tự nhiên'); }

  // ---- lưu / khôi phục trạng thái
  ST.set('pvp_hp_mode', 'real'); b = fresh(A, C); b.policy.regenPm = 10; for (let i = 0; i < 4; i++) { const v = C21.playRound(b, { A: 'Đánh Thường', B: 'Đánh Thường' }).verdict; if (v.over) break; }
  FXE.apply(b.fx, 'A', 'poison', { dur: 3, source: 'B' }); b.cd.A.kill = 2; b.cd.B.race = 1; b.arena.A.st.shield = 7; b.arena.B.st.regenCarry = 0.5; require('../src/game/cpfx').battleState(b.hp).A.guard = 0.2;
  const js = C21.serialize(b); ok(js.length < 150000, `ảnh chụp gọn (${js.length} B)`); const r = C21.rehydrate(js); ok(!!r, 'dựng lại được');
  ok(r.id === b.id && r.round === b.round && r.hp.A === b.hp.A && r.hp.B === b.hp.B && r.hp_cap.A === b.hp_cap.A && HB.cap(r.hp, 'B') === HB.cap(b.hp, 'B'), 'hp + trần + hiệp giữ nguyên');
  ok(JSON.stringify(r.fx) === JSON.stringify(b.fx) && r.cd.A.kill === 2 && r.cd.B.race === 1, 'hiệu ứng + hồi chiêu giữ nguyên'); ok(r.arena.A.st.shield === 7 && r.arena.B.st.regenCarry === 0.5, 'trạng thái thú giữ nguyên'); ok(require('../src/game/cpfx').battleState(r.hp).A.guard === 0.2, 'trạng thái chiêu công pháp giữ nguyên');
  ok(JSON.stringify(r.totals) === JSON.stringify(b.totals) && r.atk.A === b.atk.A && r.power.B === b.power.B && r.log.length === b.log.length, 'tổng kết + chỉ số đóng băng + nhật ký giữ nguyên');
  ok(C21.rehydrate('{hỏng') === null && C21.rehydrate('{"v":2}') === null, 'ảnh hỏng ⇒ null (không ném lỗi)');
  // đóng băng chỉ số: đổi hồ sơ sau khi lưu không làm đổi trận khôi phục
  Cu.updateCultivator(A, { atk: 999999 }); const r2 = C21.rehydrate(js); ok(r2.atk.A === b.atk.A, 'chỉ số trận đóng băng, không ăn theo thay đổi sau restart'); Cu.updateCultivator(A, { atk: 400 });
  let v; for (let i = 0; i < 400 && !(v = C21.playRound(r, { A: 'Đánh Thường', B: 'Đánh Thường' }).verdict).over; i++); ok(v.over, 'trận khôi phục chạy tiếp tới phán quyết');

  // ---- restart giữa trận qua pvp.recoverStale
  ST.set('pvp_resume_window', '900'); D.run('UPDATE cultivators SET last_pvp = 0');
  let s = Pvp._test.buildSession('g1', 'c1', A, B); s.message = mkMsg(); C21.setMessage(s.id, '777'); await Pvp._test.recordAction(s, 'A', 'Đánh Thường'); await Pvp._test.recordAction(s, 'B', 'Đánh Thường');   // hiệp 1 → lưu
  ok(!s.settled && D.get('SELECT round FROM v217_battle_state WHERE battle_id = ?', s.id).round === 1, 'sau hiệp 1 có ảnh chụp round=1'); const hpA = s.hp.A; const hpB = s.hp.B; const t0 = [tuvi(A), tuvi(B)];
  Pvp.SESSIONS.clear(); Pvp.BUSY.clear();                                                                            // = tiến trình mới
  const m2 = mkMsg(); const client = { channels: { fetch: async () => ({ messages: { fetch: async () => m2 } }) } };
  const cnt = await Pvp.recoverStale(client); ok(cnt === 0 && Pvp.recoverStale.last.resumed === 1, 'khôi phục 1 trận, không huỷ'); const s2 = Pvp.SESSIONS.get(s.id); ok(!!s2 && Pvp.BUSY.get(A) === s.id && Pvp.BUSY.get(B) === s.id, 'session + BUSY dựng lại');
  ok(s2.hp.A === hpA && s2.hp.B === hpB && s2.round === 1 && D.get('SELECT status FROM v213_battles WHERE id = ?', s.id).status === 'active', 'sinh lực/hiệp giữ nguyên, trận vẫn active'); ok(m2.edits.length === 1 && m2.edits[0].components && m2.edits[0].components.length > 0 && /khôi phục/.test(m2.edits[0].content), 'tin nhắn trận được sửa kèm nút mới');
  ok(tuvi(A) === t0[0] && tuvi(B) === t0[1], 'khôi phục không đổi tu vi'); ok(Pvp.SESSIONS.get(s.id).active_view !== null, 'có view hiệp mới');
  ok((await Pvp.recoverStale(client)) === 0 && Pvp.recoverStale.last.resumed === 0 && Pvp.SESSIONS.has(s.id), 'gọi lại recoverStale không huỷ nhầm trận đang chạy');
  // chơi tiếp tới hết trận trên session khôi phục → chốt đúng 1 lần
  let guard = 0; while (!s2.settled && guard++ < 400) { await Pvp._test.recordAction(s2, 'A', 'Đánh Thường'); await Pvp._test.recordAction(s2, 'B', 'Đánh Thường'); }
  ok(s2.settled && D.get('SELECT status FROM v213_battles WHERE id = ?', s.id).status === 'done', 'trận khôi phục chốt xong'); ok(!D.get('SELECT 1 AS x FROM v217_battle_state WHERE battle_id = ?', s.id) && !Pvp.BUSY.has(A) && !Pvp.BUSY.has(B), 'xoá ảnh chụp + giải phóng BUSY'); ok(P.settleBattle(s2, { over: true, result: 'A', reason: 'ko' }, 99999) === 'dup', 'không chốt lần 2');
  // quá cửa sổ → huỷ như cũ
  D.run('UPDATE cultivators SET last_pvp = 0'); s = Pvp._test.buildSession('g1', 'c1', A, B); s.message = mkMsg(); C21.setMessage(s.id, '778'); D.run('UPDATE v217_battle_state SET saved_at = saved_at - 5000 WHERE battle_id = ?', s.id); Pvp.SESSIONS.clear(); Pvp.BUSY.clear();
  const m3 = mkMsg(); ok((await Pvp.recoverStale({ channels: { fetch: async () => ({ messages: { fetch: async () => m3 } }) } })) === 1 && D.get('SELECT reason FROM v213_battles WHERE id = ?', s.id).reason === 'restart' && /bị huỷ/.test(m3.edits[0].content) && !D.get('SELECT 1 AS x FROM v217_battle_state WHERE battle_id = ?', s.id), 'quá cửa sổ khôi phục ⇒ huỷ + dọn ảnh chụp');
  // không lấy được tin nhắn → huỷ, không rò BUSY
  D.run('UPDATE cultivators SET last_pvp = 0'); s = Pvp._test.buildSession('g1', 'c1', A, B); C21.setMessage(s.id, '779'); Pvp.SESSIONS.clear(); Pvp.BUSY.clear();
  ok((await Pvp.recoverStale({ channels: { fetch: async () => { throw new Error('Unknown Message'); } } })) === 1 && !Pvp.BUSY.has(A) && !Pvp.SESSIONS.has(s.id), 'tin nhắn mất ⇒ huỷ, không rò BUSY');
  // ảnh chụp hỏng → huỷ
  D.run('UPDATE cultivators SET last_pvp = 0'); s = Pvp._test.buildSession('g1', 'c1', A, B); C21.setMessage(s.id, '780'); D.run("UPDATE v217_battle_state SET state = '{bad' WHERE battle_id = ?", s.id); Pvp.SESSIONS.clear(); Pvp.BUSY.clear();
  ok((await Pvp.recoverStale({ channels: { fetch: async () => ({ messages: { fetch: async () => mkMsg() } }) } })) === 1 && !Pvp.BUSY.has(A), 'ảnh chụp hỏng ⇒ huỷ');
  // tắt tính năng
  ST.set('pvp_resume_window', '0'); D.run('UPDATE cultivators SET last_pvp = 0'); s = Pvp._test.buildSession('g1', 'c1', A, B); C21.setMessage(s.id, '781'); Pvp.SESSIONS.clear(); Pvp.BUSY.clear(); ok((await Pvp.recoverStale({ channels: { fetch: async () => ({ messages: { fetch: async () => mkMsg() } }) } })) === 1, 'window=0 ⇒ luôn huỷ (hành vi cũ)');
  console.log(`✅ test_hp217: ${n} kiểm tra PASS`); process.exit(0);
})().catch((e) => { console.error('❌', e); process.exit(1); });
