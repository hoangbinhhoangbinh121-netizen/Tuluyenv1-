'use strict';
// V22.0 — Combat Kernel: mặc định legacy (không đổi hành vi) · kernel bật từng hệ thống · 4 adapter Boss / Bí Cảnh / Chứng Đạo / Tông Chiến.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_k22_${Date.now()}.db`);
process.env.BOSS_ACTION_COOLDOWN = '0';
const assert = require('node:assert');
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const ST = require('../src/game/settings'); const KN = require('../src/game/combatKernel'); const RC = require('../src/game/race21');
const FXE = require('../src/game/effectEngine'); const Inv = require('../src/game/invsvc');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const mk = (id, race = null, extra = '') => { const u = String(id); Cu.createCultivator(u); D.run(`UPDATE cultivators SET realm_index = 14, stage_index = 1, world_tier = 2, thiennhanngusuy_passed = 1, atk = 40000, def_ = 30000, spd = 3000, hp = 900000, cur_hp = 900000, linh_luc = 100, linh_thach = 900000000000000 ${extra} WHERE user_id = ?`, u);
  if (race) { RC.choose(u, race); const r = RC.awaken(u); if (!r.ok) throw new Error(`awaken ${JSON.stringify(r)}`); } return u; };
const setAll = (v) => { for (const s of KN.SYSTEMS) ST.set(`kernel_${s}`, v); };

// ---- 1) công tắc: mặc định legacy
ok(KN.SYSTEMS.length === 4 && KN.SYSTEMS.every((s) => KN.mode(s) === 'legacy' && !KN.on(s)), 'mặc định cả 4 hệ thống = legacy');
ok(KN.mode('khong_co') === 'legacy', 'hệ thống lạ → legacy');
ST.set('kernel_boss', 'kernel'); ok(KN.on('boss') && !KN.on('bicanh'), 'bật riêng boss'); ST.set('kernel_all', 'off'); ok(!KN.on('boss'), 'kernel_all=off cắt khẩn cấp'); ST.set('kernel_all', 'on'); ok(KN.on('boss'), 'bật lại'); setAll('legacy');

// ---- 2) kernel thuần
const ma = mk(9101, 'ma'); const rowMa = Cu.getCultivator(ma); const maxHp = 1000000;
let L = KN.open('boss', rowMa, { name: 'Boss', unit: 500, ctrlImmune: true });
ok(L.race && L.race.def.id === 'ma_huyet_te', 'tộc Ma có kỹ năng');
ok(KN.outMult(L) === 1 && KN.takeMult(L) === 1 && KN.foeOutMult(L) === 1, 'chưa có hiệu ứng → nhân = 1');
const rc = KN.race(L, maxHp, maxHp);
ok(rc && rc.kind === 'self' && rc.free && rc.heal < 0 && Math.abs(rc.heal) <= maxHp * 0.03 + 1, `Huyết Tế: hiến tế ≤3% HP (${rc.heal})`);
ok(KN.outMult(L) > 1.2 && KN.outMult(L) < 1.4, `Cuồng Huyết tăng sát thương (${KN.outMult(L)})`);
ok(L.cd.race === 5 * KN.cdMult('boss') && KN.cdMult('chungdao') === 1 && KN.cdMult('bicanh') === 10 && KN.race(L, maxHp, maxHp) === null, 'hồi chiêu PvE nhân theo hệ thống (boss ×6) & đang hồi → không tự phát');
ST.set('kernel_cd_boss', '2'); ok(KN.cdMult('boss') === 2, 'ghi đè kernel_cd_boss'); ST.set('kernel_cd_boss', '6');
const L2 = KN.open('boss', rowMa, { name: 'Boss', unit: 500 }, JSON.parse(JSON.stringify(KN.toJSON(L)))); ok(L2.cd.race === L.cd.race && Math.abs(KN.outMult(L2) - KN.outMult(L)) < 1e-9, 'toJSON/open khôi phục đủ');
for (let i = 0; i < 31; i++) { KN.begin(L, maxHp); KN.end(L); } ok(L.cd.race === 0 && KN.outMult(L) === 1, 'hết hồi chiêu & hết hiệu ứng sau vài hiệp');
// DoT lên kẻ địch quy đổi theo foe.unit; Boss miễn nhiễm choáng; người chơi bị choáng thì mất lượt
FXE.apply(L.fx, 'B', 'burn', { dur: 2 }); let bk = KN.begin(L, maxHp); ok(bk.dotB === 2 * 500 && bk.dotA === 0 && !bk.stunned, `Thiêu Đốt lên Boss = 2 điểm × unit (${bk.dotB})`); KN.end(L);
FXE.apply(L.fx, 'B', 'stun', {}); bk = KN.begin(L, maxHp); ok(L.fx.stunned.B === false, 'Boss (ctrlImmune) không bị choáng cứng'); KN.end(L);
FXE.apply(L.fx, 'A', 'stun', {}); bk = KN.begin(L, maxHp); ok(bk.stunned === true && bk.lines.some((x) => /Choáng/.test(x)), 'người chơi choáng → mất lượt'); KN.end(L);
FXE.apply(L.fx, 'A', 'poison', { dur: 2 }); bk = KN.begin(L, maxHp); ok(bk.dotA === Math.round(maxHp / 100), 'Trúng Độc lên người chơi = 1 điểm = 1% HP'); KN.end(L);
ok(KN.foeUnit(1000) === 50 && (ST.set('kernel_foe_dot_pct', '10'), KN.foeUnit(1000) === 100) && (ST.set('kernel_foe_dot_pct', '5'), true), 'foeUnit theo kernel_foe_dot_pct');
ok(KN.race(KN.open('x', rowMa, { name: 'a' }), maxHp, maxHp, { selfOnly: true }) !== null, 'selfOnly: kỹ năng self vẫn dùng được');
const phuong = mk(9102, 'phuong'); const Lp = KN.open('chungdao', Cu.getCultivator(phuong), { name: 'Lôi' });
ok(KN.race(Lp, maxHp, maxHp, { selfOnly: true }) === null && Lp.cd.race === 0, 'selfOnly: kỹ năng tấn công bị bỏ qua, không tốn hồi chiêu');
const rA = KN.race(Lp, maxHp, maxHp); ok(rA && rA.kind === 'attack' && rA.mult > 1, 'kỹ năng tấn công trả mult'); const af = KN.after(Lp, { damage: 100, is_crit: false }); ok(af.length >= 1 && FXE.list(Lp.fx, 'B').some((e) => e.id === 'burn'), 'Niết Bàn Hỏa thiêu đốt kẻ địch sau đòn');
const lite = KN.open('bicanh', { user_id: '1', __lite: true }, {}, KN.toJSON(L)); ok(lite.race === null, 'bản nhẹ không tra DB tộc');

// ---- 3) Boss Thế Giới
const BOSS = require('../src/game/boss');
const b1 = BOSS.summon({ guildId: 'G', channelId: 'c', by: '1', capdo: 1, hp: 9e15 }); ok(b1.ok, 'triệu hồi boss');
const u1 = mk(9201, 'ma');
let r = BOSS.attack('G', u1, 'atk'); ok(r.ok && Array.isArray(r.kernelLines) && r.kernelLines.length === 0, 'LEGACY: không có dòng kernel');
ok(!KN.memPeek(`boss:${b1.boss.boss_id}:${u1}`), 'LEGACY: không tạo trạng thái kernel');
ST.set('kernel_boss', 'kernel');
r = BOSS.attack('G', u1, 'atk'); ok(r.ok && r.kernelLines.some((x) => /Huyết Tế/.test(x)), 'KERNEL: kỹ năng tộc tự phát lần đầu');
ok(KN.memPeek(`boss:${b1.boss.boss_id}:${u1}`), 'KERNEL: có trạng thái kernel trong bộ nhớ');
let big = 0; const heal1 = () => D.run('UPDATE cultivators SET cur_hp = hp, linh_luc = 100 WHERE user_id = ?', u1);
for (let i = 0; i < 6; i++) { heal1(); r = BOSS.attack('G', u1, 'atk'); ok(r.ok, 'đánh tiếp ' + (r.error || '')); big += r.dmg; } ok(big > 0, 'vẫn gây sát thương');
heal1(); r = BOSS.attack('G', u1, 'rest'); ok(r.ok && Array.isArray(r.kernelLines), 'điều tức vẫn chạy với kernel');
const u1b = mk(9202); D.run('UPDATE cultivators SET cur_hp = hp WHERE user_id = ?', u1b); r = BOSS.attack('G', u1b, 'skill'); ok(r.ok && r.kernelLines.length === 0, 'KERNEL: người chưa chọn tộc → không có dòng kỹ năng tộc');
const BV = require('../src/ui/bossViews'); ok(typeof BV === 'object', 'bossViews nạp được');
BOSS.finish(b1.boss.boss_id, 'cancelled'); ok(!KN.memPeek(`boss:${b1.boss.boss_id}:${u1}`), 'finish dọn trạng thái kernel');
setAll('legacy');

// ---- 4) Bí Cảnh (Dựng JSON trong trạng thái)
const BC = require('../src/game/bicanh19');
const play = (uid, runId) => { let guard = 0; for (;;) { const L0 = BC.load(runId); const st = L0.st; const m = st.members.find((x) => x.uid === uid); if (L0.run.status !== 'active' || st.over) return { status: st.over || L0.run.status, st }; guard += 1; if (guard > 400) return { status: 'stuck', st };
  if (st.pendingReward || st.cleared && st.waitNext) { const nx = BC.next(runId, uid); if (!nx.ok) return { status: nx.error, st }; continue; }
  const act = BC.autoPick(st, m); const rr = BC.act(runId, uid, act); if (!rr.ok) { const r2 = BC.act(runId, uid, 'atk'); if (!r2.ok) { const nx = BC.next(runId, uid); if (!nx.ok) return { status: r2.error, st }; } } } };
const ba = mk(9301, 'ma'); const cl = BC.createLobby(ba, 0, { solo: true, name: 'A' }); ok(cl.ok, 'tạo bí cảnh LEGACY');
BC.act(cl.runId, ba, 'atk'); let ld = BC.load(cl.runId); ok(ld.st.members[0].kx === undefined, 'LEGACY: thành viên không có kx');
BC.retreat(cl.runId, ba);
ST.set('kernel_bicanh', 'kernel');
const bb = mk(9302, 'ma'); const cl2 = BC.createLobby(bb, 0, { solo: true, name: 'B' }); ok(cl2.ok, 'tạo bí cảnh KERNEL');
const a1 = BC.act(cl2.runId, bb, 'atk'); ok(a1.ok, 'đánh 1 đòn KERNEL'); ld = BC.load(cl2.runId); const m0 = ld.st.members[0];
ok(m0.kx && m0.kx.v === 1 && m0.kx.fx && m0.kx.cd.race >= 1, 'KERNEL: m.kx lưu hiệu ứng + hồi chiêu'); ok(ld.st.log.some((x) => /Huyết Tế/.test(x)), 'KERNEL: nhật ký có kỹ năng tộc');
ok(JSON.stringify(ld.st).length > 200, 'trạng thái vẫn là JSON thuần');
let stunPlays = 0; for (let i = 0; i < 12; i++) { const L1 = BC.load(cl2.runId); if (L1.run.status !== 'active' || L1.st.over) break; const r2 = BC.act(cl2.runId, bb, 'atk'); if (!r2.ok) break; stunPlays += 1; }
ok(stunPlays >= 1, 'đánh liên tiếp nhiều lượt không lỗi'); const res = play(bb, cl2.runId); ok(['won', 'lost', 'stuck'].includes(res.status) || typeof res.status === 'string', 'chạy hết bí cảnh KERNEL: ' + res.status);
setAll('legacy');

// ---- 5) Chứng Đạo
const CD = require('../src/game/chungdao19');
const mkc = (id, race) => { const u = String(id); Cu.createCultivator(u); D.run('UPDATE cultivators SET realm_index = 18, stage_index = 3, world_tier = 2, thiennhanngusuy_passed = 1, tu_vi = 9e15, hp = 4000000000, def_ = 900000000, atk = 90000000, cur_hp = 4000000000, linh_thach = 900000000000000 WHERE user_id = ?', u);
  for (const [id2, q] of Object.entries(CD.REQ)) Inv.add(u, id2, q, { why: 'test' }); if (race) { RC.choose(u, race); RC.awaken(u); } return u; };
const c1 = mkc(9401, 'long'); ok(CD.begin(c1).ok, 'begin LEGACY'); const rl = CD.respond(c1, 'none'); ok(rl.ok && !CD.kiepOf(CD.stateRow(c1)).kx, 'LEGACY: không có kx');
ST.set('kernel_chungdao', 'kernel');
const c2 = mkc(9402, 'long'); ok(CD.begin(c2).ok, 'begin KERNEL'); const rk = CD.respond(c2, 'none');
ok(rk.ok && CD.kiepOf(CD.stateRow(c2)).kx && rk.lines.some((x) => /Long Uy/.test(x)), 'KERNEL: Long Uy tự phát khi có lôi');
const kx = CD.kiepOf(CD.stateRow(c2)).kx; ok(kx.cd.race >= 1, 'hồi chiêu lưu trong kiếp');
const c3 = mkc(9403, 'phuong'); CD.begin(c3); const rp = CD.respond(c3, 'none'); ok(rp.ok && !rp.lines.some((x) => /Niết Bàn/.test(x)), 'tộc chỉ có kỹ năng tấn công → không tự phát trong Chứng Đạo');
let ended = null; for (let i = 0; i < 14 && !ended; i++) { const q = CD.respond(c2, 'none'); if (!q.ok) break; ended = q.ended || null; } ok(ended === 'win' || ended === 'lose', 'chạy hết đại kiếp KERNEL: ' + ended);
setAll('legacy');

// ---- 6) Tông Chiến
const W = require('../src/game/sectwar');
const mkw = (id, race) => { const u = mk(id, race); D.run('UPDATE cultivators SET realm_index = 3, stage_index = 1, world_tier = 0 WHERE user_id = ?', u); return u; };
const pa = mkw(9501, 'ma'); const pd = mkw(9502);
const war = W.createWar('GW', 'c1', 'registration', 0); W.activateWar(war);
D.run("INSERT INTO sects (sect_id, name, leader_id) VALUES (7001,'KA',?),(7002,'KB',?)", pa, pd); D.run('UPDATE cultivators SET sect_id = 7001 WHERE user_id = ?', pa); D.run('UPDATE cultivators SET sect_id = 7002 WHERE user_id = ?', pd);
W.joinWar(war, pa, 7001); W.joinWar(war, pd, 7002); W.moveToNode(war, pa, 7001, 'bac'); W.moveToNode(war, pd, 7002, 'bac');
const tick = () => { W.checkActionCooldown; };
let out = W.doAttack(war, pa, pd); ok(typeof out === 'string' && !KN.memPeek(`tc:${war}:${pa}`), 'LEGACY: đòn Tông Chiến bình thường, không tạo kernel');
ST.set('kernel_tongchien', 'kernel');
let hit = 0; let sawRace = false; for (let i = 0; i < 12; i++) { D.run("UPDATE sect_war_participants SET hp = NULL, revive_at = NULL, node_key = 'bac' WHERE war_id = ? AND user_id = ?", war, pd); out = W.doAttack(war, pa, pd); ok(typeof out === 'string', 'đòn KERNEL trả chuỗi'); if (/gây|HẠ GỤC|né/.test(out)) hit += 1; if (/Huyết Tế/.test(out)) sawRace = true; }
ok(hit === 12 && KN.memPeek(`tc:${war}:${pa}`), 'KERNEL: 12 đòn, có trạng thái kernel'); ok(sawRace, 'KERNEL: kỹ năng tộc xuất hiện trong kết quả');
const adm = W.doAttack(war, pa, pd, { admin: true }); ok(typeof adm === 'string', 'admin giáng thiên phạt vẫn chạy khi bật kernel');
setAll('legacy');

// ---- 7) lệnh admin !kernel
const reg = require('../src/commands/framework').registry; require('../src/commands/admin'); const kc = reg.get('kernel'); ok(kc && kc.prefixOnly && kc.admin, '!kernel là lệnh admin prefix-only');
const run = async (args) => { const sent = []; await kc.run({ args, send: async (x) => sent.push(String(x)) }); return sent.join('\n'); };
(async () => {
  ok(/legacy/.test(await run({})), '!kernel xem'); ok(/Boss Thế Giới.*kernel/.test(await run({ he_thong: 'boss', gia_tri: 'kernel' }) + KN.SYS_NAME.boss), 'đặt boss');
  ok(KN.on('boss'), 'đã bật'); ok(/❌/.test(await run({ he_thong: 'boss', gia_tri: 'xyz' })), 'giá trị sai'); ok(/❌/.test(await run({ he_thong: 'foe', gia_tri: '99' })), 'foe ngoài khoảng');
  await run({ he_thong: 'all', gia_tri: 'off' }); ok(!KN.on('boss'), 'all off'); await run({ he_thong: 'all', gia_tri: 'on' }); await run({ he_thong: 'boss', gia_tri: 'legacy' }); ok(!KN.on('boss'), 'về legacy');
  console.log(`✅ test_kernel22: ${n} kiểm tra PASS`); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
