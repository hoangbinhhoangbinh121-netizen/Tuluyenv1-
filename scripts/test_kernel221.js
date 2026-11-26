'use strict';
// V22.1 — mặc định kernel (Boss + Chứng Đạo) · nút Kỹ Năng Tộc ở 4 hệ thống · cpfx gộp vào kernel · Sổ Cái cho thưởng PvE.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_k221_${Date.now()}.db`);
process.env.BOSS_ACTION_COOLDOWN = '0';
const assert = require('node:assert');
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const ST = require('../src/game/settings'); const KN = require('../src/game/combatKernel'); const RC = require('../src/game/race21');
const Inv = require('../src/game/invsvc'); const LG = require('../src/game/ledger'); const CPD = require('../src/data/congphap_v16');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const mk = (id, race = null) => { const u = String(id); Cu.createCultivator(u); D.run('UPDATE cultivators SET realm_index = 14, stage_index = 1, world_tier = 2, thiennhanngusuy_passed = 1, atk = 40000, def_ = 30000, spd = 3000, hp = 900000, cur_hp = 900000, linh_luc = 100, linh_thach = 900000000000000 WHERE user_id = ?', u);
  if (race) { RC.choose(u, race); const r = RC.awaken(u); if (!r.ok) throw new Error(`awaken ${JSON.stringify(r)}`); } return u; };
const heal = (u) => D.run('UPDATE cultivators SET cur_hp = hp, linh_luc = 100 WHERE user_id = ?', u);

// ---- 1) mặc định + kỹ năng tộc chỉ khi bấm nút
ok(KN.on('boss') && KN.on('chungdao') && !KN.on('bicanh') && !KN.on('tongchien'), 'mặc định: boss + chungdao = kernel; bicanh + tongchien = legacy');
ok(String(ST.get('kernel_race_auto', 'off')) === 'off', 'tự phát mặc định TẮT');
const ma = mk(9101, 'ma'); const row = Cu.getCultivator(ma); const MAXHP = 1000000;
let L = KN.open('boss', row, { name: 'B', unit: 500, ctrlImmune: true });
ok(KN.race(L, MAXHP, MAXHP) === null && L.cd.race === 0, 'không bấm nút ⇒ không tự phát');
ok(KN.raceCheck(L) === null, 'raceCheck: dùng được');
const rr = KN.race(L, MAXHP, MAXHP, { request: true }); ok(rr && rr.kind === 'self', 'bấm nút ⇒ phát');
ok(/hồi chiêu/.test(KN.raceCheck(L)) && KN.race(L, MAXHP, MAXHP, { request: true }).kind === 'none', 'đang hồi chiêu ⇒ từ chối lịch sự (kind none)');
const nr = mk(9102); const Ln = KN.open('boss', Cu.getCultivator(nr), { name: 'B' }); ok(/chưa có kỹ năng/.test(KN.raceCheck(Ln)) && KN.race(Ln, MAXHP, MAXHP, { request: true }).kind === 'none', 'chưa có tộc ⇒ từ chối');
const ph = mk(9103, 'phuong'); const Lp = KN.open('chungdao', Cu.getCultivator(ph), { name: 'Lôi' }); ok(/tấn công/.test(KN.raceCheck(Lp, { selfOnly: true })) && KN.raceCheck(Lp) === null, 'selfOnly: kỹ năng tấn công bị từ chối ở Chứng Đạo');
ok(KN.raceBtn('boss', row) && KN.raceBtn('bicanh', row) === null && KN.raceBtn('boss', Cu.getCultivator(nr)) === null && KN.raceBtn('chungdao', Cu.getCultivator(ph), { selfOnly: true }) === null, 'raceBtn: nhãn nút / null');

// ---- 2) Boss
const BOSS = require('../src/game/boss');
const b1 = BOSS.summon({ guildId: 'G', channelId: 'c', by: '1', capdo: 1, hp: 9e15 }); ok(b1.ok, 'triệu hồi boss');
const u1 = mk(9201, 'ma'); heal(u1);
let r = BOSS.attack('G', u1, 'atk'); ok(r.ok && !r.kernelLines.some((x) => /Huyết Tế/.test(x)), 'đánh thường KHÔNG tự phát kỹ năng tộc');
heal(u1); r = BOSS.attack('G', u1, 'race'); ok(r.ok && r.dmg === 0 && r.kernelLines.some((x) => /Huyết Tế/.test(x)), 'nút Kỹ Năng Tộc (self): phát, thay đòn đánh');
heal(u1); r = BOSS.attack('G', u1, 'race'); ok(!r.ok && /hồi chiêu/.test(r.error), 'bấm lại khi hồi chiêu ⇒ từ chối, không tốn lượt');
heal(u1); r = BOSS.attack('G', u1, 'atk'); ok(r.ok && r.dmg > 0, 'đánh tiếp vẫn chạy');
const u1p = mk(9202, 'phuong'); heal(u1p); r = BOSS.attack('G', u1p, 'race'); ok(r.ok && r.dmg > 0 && r.kernelLines.some((x) => /Niết Bàn/.test(x)), 'kỹ năng tấn công: gây sát thương ×mult');
const u1n = mk(9203); heal(u1n); r = BOSS.attack('G', u1n, 'race'); ok(!r.ok && /chưa có kỹ năng/.test(r.error), 'chưa có tộc ⇒ từ chối');
ST.set('kernel_boss', 'legacy'); heal(u1); r = BOSS.attack('G', u1, 'race'); ok(!r.ok && /Kernel/i.test(r.error), 'kernel tắt ⇒ từ chối lịch sự'); ST.set('kernel_boss', 'kernel');
const BV = require('../src/ui/bossViews'); const comps = BV.panelPayload(BOSS.getBossById(b1.boss.boss_id)).components; ok(comps.length === 2 && JSON.stringify(comps[1]).includes('wb|race|'), 'UI Boss: hàng 2 có nút wb|race');
// Sổ Cái: thưởng Boss
const lt0 = Cu.getCultivator(u1).linh_thach; BOSS.finish(b1.boss.boss_id, 'killed', u1);
const lt1 = Cu.getCultivator(u1).linh_thach; const ent = D.get('SELECT * FROM ledger_entries WHERE idem_key = ?', `boss:${b1.boss.boss_id}:${u1}`);
ok(ent && ent.delta === lt1 - lt0 && ent.balance_after === lt1 && ent.currency === 'linh_thach', `Sổ Cái ghi thưởng Boss (+${lt1 - lt0})`);
ok(LG.noteOnce(u1, 5, { key: `boss:${b1.boss.boss_id}:${u1}`, reason: 'x' }) === false, 'noteOnce: trùng khoá ⇒ false, KHÔNG ném lỗi');

// ---- 3) Bí Cảnh: nút + cpfx
const BC = require('../src/game/bicanh19');
const ba = mk(9301, 'ma'); const cl = BC.createLobby(ba, 0, { solo: true, name: 'A' }); ok(cl.ok, 'tạo bí cảnh');
let a = BC.act(cl.runId, ba, 'race'); ok(!a.ok && /Kernel/i.test(a.error), 'LEGACY: nút Kỹ Năng Tộc bị từ chối lịch sự'); BC.retreat(cl.runId, ba);
ST.set('kernel_bicanh', 'kernel');
const bb = mk(9302, 'ma'); const c2 = BC.createLobby(bb, 0, { solo: true, name: 'B' });
a = BC.act(c2.runId, bb, 'atk'); ok(a.ok, 'đánh thường KERNEL'); let ld = BC.load(c2.runId); ok(!ld.st.log.some((x) => /Huyết Tế/.test(x)), 'KERNEL: không tự phát');
a = BC.act(c2.runId, bb, 'race'); ok(a.ok, 'nút Kỹ Năng Tộc: ' + (a.error || '')); ld = BC.load(c2.runId); ok(ld.st.log.some((x) => /Huyết Tế/.test(x)) && ld.st.members[0].kx.cd.race >= 1, 'đã phát + lưu hồi chiêu');
a = BC.act(c2.runId, bb, 'race'); ok(!a.ok && /hồi chiêu/.test(a.error), 'bấm lại ⇒ từ chối');
const bn = mk(9303); const c3 = BC.createLobby(bn, 0, { solo: true, name: 'N' }); a = BC.act(c3.runId, bn, 'race'); ok(!a.ok && /chưa có kỹ năng/.test(a.error), 'chưa có tộc ⇒ từ chối');
const BCV = require('../src/ui/bicanh19Views'); ok(typeof BCV.runView === 'function', 'bicanh19Views nạp được');
{ const v = BCV.runView(c2.runId); ok(JSON.stringify(v.components).includes(`b19|r|${c2.runId}|race`), 'UI Bí Cảnh: có nút race'); }
// cpfx → kernel
const skName = [...CPD.BY_SKILL.keys()].find((k) => { const CPX = require('../src/game/cpfx'); const e = CPX.skillEffect(k); return e && e.guard; });
ok(skName, 'có chiêu công pháp V16 có hộ thể'); const Lc = KN.open('bicanh', row, { name: 'E' });
const cp = KN.cp(Lc, skName, MAXHP, MAXHP); ok(cp.lines.some((x) => /hộ thể/.test(x)), 'KN.cp áp hộ thể'); const ci = KN.cpIn(Lc); ok(ci.guard > 0, `cpIn.guard=${ci.guard}`);
for (let i = 0; i < 6; i++) KN.cpTick(Lc); ok(KN.cpIn(Lc).guard === 0, 'hết lượt sau vài đòn');
KN.cp(Lc, skName, MAXHP, MAXHP); const rest = KN.open('bicanh', { user_id: '1', __lite: true }, {}, JSON.parse(JSON.stringify(KN.toJSON(Lc)))); ok(KN.cpIn(rest).guard > 0, 'cp lưu/khôi phục qua JSON (m.kx)');
ok(KN.cp(Lc, 'chiêu-không-tồn-tại', MAXHP, MAXHP).lines.length === 0, 'chiêu lạ ⇒ không hiệu ứng');
ST.set('kernel_bicanh', 'legacy');

// ---- 4) Chứng Đạo
const CD = require('../src/game/chungdao19');
const mkc = (id, race) => { const u = String(id); Cu.createCultivator(u); D.run('UPDATE cultivators SET realm_index = 18, stage_index = 3, world_tier = 2, thiennhanngusuy_passed = 1, tu_vi = 9e15, hp = 4000000000, def_ = 900000000, atk = 90000000, cur_hp = 4000000000, linh_thach = 900000000000000 WHERE user_id = ?', u);
  for (const [id2, q] of Object.entries(CD.REQ)) Inv.add(u, id2, q, { why: 'test' }); if (race) { RC.choose(u, race); RC.awaken(u); } return u; };
const c1 = mkc(9401, 'long'); ok(CD.begin(c1).ok, 'begin'); let s1 = CD.kiepOf(CD.stateRow(c1));
ok(!CD.canResp({ ...s1, uid: c1 }, 'race', Cu.getCultivator(c1)), 'Long: nút race dùng được');
let q = CD.respond(c1, 'none'); ok(q.ok && !q.lines.some((x) => /Long Uy/.test(x)), 'không bấm ⇒ không tự phát');
q = CD.respond(c1, 'race'); ok(q.ok && q.lines.some((x) => /Long Uy/.test(x)), 'bấm race ⇒ phát Long Uy');
s1 = CD.kiepOf(CD.stateRow(c1)); ok(/hồi chiêu/.test(CD.canResp({ ...s1, uid: c1 }, 'race', Cu.getCultivator(c1))), 'đang hồi chiêu ⇒ canResp trả lý do');
q = CD.respond(c1, 'race'); ok(!q.ok && /hồi chiêu/.test(q.error), 'respond từ chối khi hồi chiêu');
const c4 = mkc(9403, 'phuong'); CD.begin(c4); ok(/tấn công/.test(CD.canResp({ ...CD.kiepOf(CD.stateRow(c4)), uid: c4 }, 'race', Cu.getCultivator(c4))), 'Phượng (tấn công): không dùng ở Chứng Đạo');
ST.set('kernel_chungdao', 'legacy'); ok(/Kernel/i.test(CD.canResp({ ...s1, uid: c1 }, 'race', Cu.getCultivator(c1))), 'kernel tắt ⇒ lý do lịch sự'); ST.set('kernel_chungdao', 'kernel');
const CV = require('../src/ui/chungdaoViews'); ok(CV && typeof CV === 'object', 'chungdaoViews nạp được');

// ---- 5) Tông Chiến
const W = require('../src/game/sectwar');
const mkw = (id, race) => { const u = mk(id, race); D.run('UPDATE cultivators SET realm_index = 3, stage_index = 1, world_tier = 0 WHERE user_id = ?', u); return u; };
const pa = mkw(9501, 'ma'); const pd = mkw(9502);
const war = W.createWar('GW', 'c1', 'registration', 0); W.activateWar(war);
D.run("INSERT INTO sects (sect_id, name, leader_id, treasury) VALUES (7001,'KA',?,1000000),(7002,'KB',?,0)", pa, pd); D.run('UPDATE cultivators SET sect_id = 7001 WHERE user_id = ?', pa); D.run('UPDATE cultivators SET sect_id = 7002 WHERE user_id = ?', pd);
W.joinWar(war, pa, 7001); W.joinWar(war, pd, 7002); W.moveToNode(war, pa, 7001, 'bac'); W.moveToNode(war, pd, 7002, 'bac');
const reset = () => D.run("UPDATE sect_war_participants SET hp = NULL, revive_at = NULL, node_key = 'bac' WHERE war_id = ? AND user_id = ?", war, pd);
let out = W.doAttack(war, pa, pd, { race: true }); ok(/Kernel/i.test(out), 'LEGACY: nút bị từ chối lịch sự');
ST.set('kernel_tongchien', 'kernel'); reset(); out = W.doAttack(war, pa, pd); ok(!/Huyết Tế/.test(out), 'đánh thường: không tự phát');
reset(); out = W.doAttack(war, pa, pd, { race: true }); ok(/Huyết Tế/.test(out), 'nút: phát kỹ năng tộc (' + out.slice(0, 80) + ')');
const part = W.getParticipant(war, pa); reset(); out = W.doAttack(war, pa, pd, { race: true }); ok(/hồi chiêu/.test(out), 'bấm lại khi hồi chiêu ⇒ báo, không đánh');
const pn = mkw(9503); D.run('UPDATE cultivators SET sect_id = 7001 WHERE user_id = ?', pn); W.joinWar(war, pn, 7001); W.moveToNode(war, pn, 7001, 'bac'); reset(); out = W.doAttack(war, pn, pd, { race: true }); ok(/chưa có kỹ năng/.test(out), 'chưa có tộc ⇒ từ chối');
const SV = require('../src/ui/sectWarViews'); ok(SV && typeof SV === 'object', 'sectWarViews nạp được');
// rút / nộp kho → sổ cái
const before = LG.summary(pa).count; const t0 = Cu.getCultivator(pa).linh_thach;
const m1 = W.doRutkho(pa, 1000); ok(/rút/.test(m1) && Cu.getCultivator(pa).linh_thach === t0 + 1000 && LG.summary(pa).count === before + 1, 'rút Kho Tông ghi Sổ Cái');
ok(LG.recent(pa, 1)[0].delta === 1000 && LG.recent(pa, 1)[0].reason === 'rút Kho Tông', 'dòng sổ đúng');
ST.set('kernel_tongchien', 'legacy');

// ---- 6) !kernel hiển thị mặc định mới
const reg = require('../src/commands/framework').registry; require('../src/commands/admin'); const kc = reg.get('kernel'); ok(kc, 'có !kernel');
(async () => { const sent = []; await kc.run({ args: {}, send: async (x) => sent.push(String(x)) }); ok(/kernel/.test(sent.join('\n')), '!kernel xem trạng thái');
  console.log(`✅ test_kernel221: ${n} kiểm tra PASS`); process.exit(0); })().catch((e) => { console.error(e); process.exit(1); });
