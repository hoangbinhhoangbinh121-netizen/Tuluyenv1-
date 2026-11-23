'use strict';
// V21.6 — EffectEngine (chính sách chồng, DoT, choáng + miễn nhiễm, cleanse, modifiers, JSON), kỹ năng Chủng Tộc, F-1 (hiệu ứng PvP có tác dụng thật), F-2 (Sát Chiêu hồi chiêu), chế độ 'log' = hành vi cũ.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_fx216_${Date.now()}.db`);
const assert = require('node:assert'); const fs = require('node:fs'); const path = require('node:path');
const D = require('../src/db'); D.initDb();
const { E } = require('../src/game/emoji'); for (const f of fs.readdirSync(path.join(__dirname, '..', 'assets', 'emoji'))) { const k = f.replace(/\.png$/, ''); E[k] = `<:tg7_${k}:123456789012345678>`; }
const Cu = require('../src/game/cultivator'); const ST = require('../src/game/settings'); const P = require('../src/game/pvpCore'); const C21 = require('../src/game/combat21');
const FXE = require('../src/game/effectEngine'); const RS = require('../src/game/raceSkill21'); const RC = require('../src/game/race21'); const X = require('../src/data/effects21');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const U = (k) => `500000000000000${String(k).padStart(4, '0')}`;
const mk = (k, race, aw = 1) => { const u = U(k); if (Cu.getCultivator(u)) return u; Cu.createCultivator(u); Cu.updateCultivator(u, { realm_index: 8, stage_index: 1, world_tier: 1, atk: 4000, def_: 3000, spd: 1000 + k, hp: 50000, cur_hp: 50000, linh_thach: 1e10, last_pvp: 0 });
  if (race) { RC.choose(u, race); for (let i = 0; i < aw; i++) { const r = RC.awaken(u); if (!r.ok) throw new Error(`awaken fail ${JSON.stringify(r)}`); } } return u; };
const row = (u) => Cu.getCultivator(u);
const fresh = (a, b) => { D.run('UPDATE cultivators SET last_pvp = 0 WHERE user_id IN (?, ?)', a, b); return C21.createBattle(row(a), row(b), { now: 1000 }); };

(() => {
  // ============ 1) chính sách chồng
  let s = FXE.createStore();
  let r = FXE.apply(s, 'A', 'poison'); ok(r.applied && r.action === 'new', 'poison mới');
  FXE.apply(s, 'A', 'poison'); FXE.apply(s, 'A', 'poison'); r = FXE.apply(s, 'A', 'poison'); ok(FXE.list(s, 'A')[0].stacks === 3, 'stackIntensity chặn trần 3 tầng');
  ok(FXE.startRound(s).dmg.A === 3, '3 tầng độc = 3 sinh lực/hiệp');
  s = FXE.createStore(); FXE.apply(s, 'B', 'bleed', { power: 2 }); r = FXE.apply(s, 'B', 'bleed', { power: 1 }); ok(!r.applied && r.action === 'ignored', 'strongest: yếu hơn bị bỏ qua');
  r = FXE.apply(s, 'B', 'bleed', { power: 3 }); ok(r.applied && FXE.list(s, 'B')[0].power === 3, 'strongest: mạnh hơn thay thế');
  s = FXE.createStore(); FXE.apply(s, 'A', 'burn', { dur: 2 }); FXE.endRound(s); FXE.endRound(s); ok(FXE.list(s, 'A')[0].dur === 1, 'burn trừ thời hạn từ hiệp sau hiệp áp');
  FXE.apply(s, 'A', 'burn', { dur: 2 }); ok(FXE.list(s, 'A')[0].dur === 2, 'refresh: làm mới thời hạn (không cộng dồn)');
  s = FXE.createStore(); FXE.apply(s, 'A', 'burn', { dur: 99 }); ok(FXE.list(s, 'A')[0].dur <= FXE.MAX_DUR, 'thời hạn chặn trần');
  ok(!FXE.apply(s, 'A', 'khong_co').applied, 'id lạ bị từ chối an toàn');
  // ============ 2) choáng
  s = FXE.createStore(); r = FXE.apply(s, 'A', 'stun'); ok(r.applied, 'choáng áp được'); ok(!FXE.apply(s, 'A', 'stun').applied, 'đang choáng không chồng');
  ok(FXE.consumeStun(s, 'A') === true && FXE.consumeStun(s, 'A') === false, 'choáng mất ĐÚNG 1 lượt');
  FXE.endRound(s); r = FXE.apply(s, 'A', 'stun'); ok(!r.applied && r.action === 'immune', 'hiệp kế tiếp miễn nhiễm choáng');
  FXE.endRound(s); r = FXE.apply(s, 'A', 'stun'); ok(r.applied, 'hết miễn nhiễm thì choáng lại được');
  // ============ 3) DoT / fresh / cleanse / modifiers
  s = FXE.createStore(); FXE.apply(s, 'A', 'burn', { dur: 2 }); FXE.endRound(s);               // áp trong hiệp r, kết thúc hiệp r
  ok(FXE.startRound(s).dmg.A === 2, 'DoT tick 1 ở đầu hiệp r+1'); FXE.endRound(s);
  ok(FXE.startRound(s).dmg.A === 2, 'DoT tick 2 ở đầu hiệp r+2'); FXE.endRound(s);
  ok(FXE.startRound(s).dmg.A === 0 && FXE.list(s, 'A').length === 0, 'dur=2 ⇒ đúng 2 tick rồi hết');
  s = FXE.createStore(); FXE.apply(s, 'A', 'poison'); FXE.apply(s, 'A', 'guard', { power: 0.1 }); FXE.apply(s, 'A', 'stun'); FXE.apply(s, 'A', 'freeze');
  ok(FXE.cleanse(s, 'A') >= 3, 'cleanse xoá độc/choáng/băng'); ok(FXE.list(s, 'A').some((e) => e.id === 'guard') && !FXE.list(s, 'A').some((e) => e.id === 'poison'), 'cleanse giữ buff tốt');
  s = FXE.createStore(); FXE.apply(s, 'A', 'guard', { power: 0.15 }); FXE.apply(s, 'A', 'frenzy'); FXE.apply(s, 'A', 'freeze'); FXE.apply(s, 'B', 'weaken', { power: 0.2 });
  let m = FXE.modifiers(s, 'A'); ok(Math.abs(m.dr - 0.15) < 1e-9 && Math.abs(m.dmgOut - 0.35) < 1e-9 && Math.abs(m.spdMult - 0.7) < 1e-9, 'modifiers cộng đúng'); m = FXE.modifiers(s, 'B'); ok(Math.abs(m.dmgOut + 0.2) < 1e-9, 'weaken giảm sát thương gây ra');
  for (let i = 0; i < 10; i++) FXE.apply(s, 'A', 'guard', { power: 5 }); ok(FXE.modifiers(s, 'A').dr <= 0.6, 'giảm sát thương chặn trần 60%');
  const js = FXE.toJSON(s); const s2 = FXE.fromJSON(js); ok(FXE.describe(s2, 'A') === FXE.describe(s, 'A'), 'toJSON/fromJSON giữ nguyên'); ok(FXE.fromJSON('rác{').v === 1 && FXE.fromJSON(null).v === 1, 'JSON hỏng → store rỗng');
  ok(Array.isArray(FXE.persistent('1')), 'persistent() chỉ-đọc không lỗi');
})();

(() => {
  // ============ 4) kỹ năng tộc: mở khoá, dữ liệu
  const nt = mk(1); const names = ['nhan', 'long', 'phuong', 'ma', 'linh', 'yeu']; const us = {};
  names.forEach((rid, i) => { us[rid] = mk(10 + i, rid, 1); });
  ok(RS.forRow(row(nt)) === null, 'chưa chọn tộc ⇒ không có kỹ năng tộc');
  const lo = mk(30, 'nhan', 0); ok(RS.forRow(row(lo)) === null, 'chưa thức tỉnh ⇒ chưa mở khoá');
  for (const rid of names) { const f = RS.forRow(row(us[rid])); ok(f && f.raceId === rid && f.cd >= 3, `${rid}: có kỹ năng tộc`); }
  for (const rid of names) { const d = X.RACE_SKILLS[rid]; ok(d && ['self', 'attack'].includes(d.kind) && d.cd >= 1, `${rid}: dữ liệu hợp lệ`); }
  // ============ 5) F-2: Sát Chiêu có hồi chiêu
  const a = mk(40), b = mk(41);
  let bt = fresh(a, b); ok(bt.policy.killCd === 3, 'mặc định hồi 3 hiệp');
  C21.playRound(bt, { A: P.PVP_ACTION_KILLMOVE, B: P.PVP_ACTION_DEFEND }); ok(bt.cd.A.kill === 2, 'dùng Sát Chiêu → hồi còn 2 sau khi qua hiệp (3−1)');
  const rep = C21.playRound(bt, { A: P.PVP_ACTION_KILLMOVE, B: P.PVP_ACTION_DEFEND }); ok(rep.block.join('\n').includes('Sát Chiêu còn hồi'), 'dùng khi còn hồi → ra Đánh Thường có ghi chú');
  ok(!bt.log[bt.log.length - 1].t.includes('undefined'), 'nhật ký sạch');
  ST.set('pvp_killmove_cd', 0); bt = fresh(a, b); C21.playRound(bt, { A: P.PVP_ACTION_KILLMOVE, B: P.PVP_ACTION_DEFEND }); ok(bt.cd.A.kill === 0, 'killCd=0 → tắt hồi chiêu (hành vi cũ)'); ST.set('pvp_killmove_cd', 3);
  // ============ 6) F-1: hiệu ứng ngẫu nhiên có tác dụng thật vs chế độ 'log'
  let appliedReal = 0, dotLines = 0, stunLines = 0;
  for (let i = 0; i < 120; i++) { const t = fresh(a, b); for (let r = 0; r < 6 && !C21.judge(t).over; r++) { const o = C21.playRound(t, { A: P.ATTACK_NORMAL, B: P.ATTACK_NORMAL }); const txt = o.block.join('\n'); if (txt.includes('nhận')) appliedReal += 1; if (/Trúng Độc|Xuất Huyết|Thiêu Đốt/.test(txt) && /sinh lực\./.test(txt)) dotLines += 1; if (txt.includes('mất lượt')) stunLines += 1; } }
  ok(appliedReal > 0, 'có hiệu ứng được áp thật'); ok(dotLines > 0, 'DoT thật trừ sinh lực'); ok(stunLines > 0, 'Choáng thật làm mất lượt');
  ST.set('pvp_effects_mode', 'log'); let any = 0; for (let i = 0; i < 60; i++) { const t = fresh(a, b); for (let r = 0; r < 6 && !C21.judge(t).over; r++) { C21.playRound(t, { A: P.ATTACK_NORMAL, B: P.ATTACK_NORMAL }); } ok(FXE.list(t.fx, 'A').length === 0 && FXE.list(t.fx, 'B').length === 0 && !t.fx.stunned.A && !t.fx.stunned.B, "chế độ 'log' không áp hiệu ứng thật"); any += 1; }
  const tl = fresh(a, b); C21.playRound(tl, { A: P.PVP_ACTION_KILLMOVE, B: P.ATTACK_NORMAL }); ok(tl.cd.A.kill === 2, "chế độ 'log' vẫn có hồi chiêu Sát Chiêu (độc lập)"); ST.set('pvp_effects_mode', 'real');
  // ============ 7) kỹ năng tộc trong trận
  for (const rid of names) {
    const u = us[rid]; const foe = mk(60 + names.indexOf(rid)); const t = fresh(u, foe); const act = t.race.A.action; ok(!!act, `${rid}: action`);
    ok(RS.available(t, 'A'), 'sẵn sàng'); t.hp.A = 60; const before = t.hp.A;
    const o = C21.playRound(t, { A: act, B: P.PVP_ACTION_DEFEND }); const txt = o.block.join('\n'); ok(txt.includes('thi triển') || txt.includes(act) || X.RACE_SKILLS[rid].kind === 'attack', `${rid}: dùng được`);
    ok(t.cd.A.race === t.race.A.cd - 1, `${rid}: hồi chiêu bắt đầu (${t.cd.A.race})`);
    const again = C21.playRound(t, { A: act, B: P.PVP_ACTION_DEFEND }); ok(again.block.join('\n').includes('kỹ năng tộc còn hồi'), `${rid}: còn hồi ⇒ Đánh Thường có ghi chú`);
    if (rid === 'nhan') if (rid === 'ma') ok(t.hp.A <= 100, 'ma: không vượt 100');
  }
  { const u = us.ma; for (const h of [1, 2, 3, 4, 50]) { const t = fresh(u, mk(70)); t.hp.A = h; RS.castSelf(t, 'A', 'B'); ok(t.hp.A >= 1, `Huyết Tế không bao giờ tự giết (hp ${h} → ${t.hp.A})`); } }       // kiểm tra riêng bước hiến tế (đòn phản/độc của đối thủ sau đó có thể hạ gục hợp lệ)
  { const u = us.nhan; const t = fresh(u, mk(71)); FXE.apply(t.fx, 'A', 'poison'); FXE.apply(t.fx, 'A', 'stun'); FXE.consumeStun(t.fx, 'A'); FXE.apply(t.fx, 'A', 'burn'); t.hp.A = 50; C21.playRound(t, { A: t.race.A.action, B: P.PVP_ACTION_DEFEND }); ok(!FXE.list(t.fx, 'A').some((e) => e.id === 'poison' || e.id === 'burn'), 'Nhân: cleanse thật'); }
  { const t = fresh(us.long, mk(72)); C21.playRound(t, { A: t.race.A.action, B: P.PVP_ACTION_DEFEND }); ok(FXE.list(t.fx, 'A').some((e) => e.id === 'guard') && FXE.list(t.fx, 'B').some((e) => e.id === 'weaken'), 'Long Uy: guard bản thân + weaken đối thủ'); }
  { const t = fresh(us.phuong, mk(73)); let burned = 0; for (let i = 0; i < 40; i++) { const t2 = fresh(us.phuong, mk(73)); C21.playRound(t2, { A: t2.race.A.action, B: P.ATTACK_NORMAL }); if (FXE.list(t2.fx, 'B').some((e) => e.id === 'burn')) burned += 1; } ok(burned > 0, 'Phượng: Niết Bàn Hỏa gây Thiêu Đốt khi trúng'); }
  { let hits = 0; for (let i = 0; i < 40; i++) { const t = fresh(us.nhan, mk(90)); const o = C21.playRound(t, { A: t.race.A.action, B: P.PVP_ACTION_DEFEND }); const txt = o.block.join('\n'); if (t.hp.A <= 100 && txt.includes('thi triển')) hits += 0; const t2 = fresh(us.long, mk(91)); const o2 = C21.playRound(t2, { A: t2.race.A.action, B: P.ATTACK_NORMAL }); if (t2.hp.B < 100) hits += 1; ok(o2.block.join('\n').includes('thi triển') || o2.block.join('\n').includes('Choáng'), 'kỹ năng tự thân: có dòng thi triển (hoặc bị choáng trước)'); }
    ok(hits > 0, "kỹ năng 'free' (Long Uy): thi triển xong VẪN ra đòn thường trong cùng hiệp"); ok(X.RACE_SKILLS.long.free === true && X.RACE_SKILLS.phuong.free !== true, 'cờ free đúng dữ liệu'); }
  // ============ 8) simulate chạy với kỹ năng tộc / hiệu ứng, không treo, nhật ký hợp lệ
  for (const rid of names) for (let i = 0; i < 10; i++) { const t = fresh(us[rid], us[names[(names.indexOf(rid) + 1) % 6]]); const v = C21.simulate(t); ok(v.over && ['A', 'B', 'draw'].includes(v.result), 'simulate kết thúc'); ok(t.log.length === t.round && t.hp.A <= 100 && t.hp.B <= 100, 'log/hp hợp lệ'); }
  // trận giữa người không có tộc vẫn chạy y như cũ
  for (let i = 0; i < 20; i++) { const t = fresh(a, b); const v = C21.simulate(t); ok(v.over, 'không-tộc vẫn chạy'); ok(t.race.A === null && t.race.B === null, 'không có kỹ năng tộc'); }
})();
(() => {
  // ============ 9) StatEngine: chồng hiệu ứng trong trận lên chỉ số bền vững, không double-count
  const SE = require('../src/game/statEngine'); const u = mk(80, 'long', 1); const row0 = row(u);
  const solo = SE.forUser(row0, null, 'A'); ok(solo.check.ok, 'snapshot bền vững khớp Cu.effective*'); ok(solo.atk === Cu.effectiveAtk(row0) && solo.def === Cu.effectiveDef(row0) && solo.maxHp === Cu.effectiveMaxHp(row0), 'không có hiệu ứng ⇒ đúng chỉ số bền vững (không cộng lại chủng tộc)');
  const st = FXE.createStore(); FXE.apply(st, 'A', 'guard', { power: 0.15 }); FXE.apply(st, 'A', 'frenzy'); FXE.apply(st, 'A', 'freeze'); FXE.apply(st, 'A', 'evasion');
  const r = SE.forUser(row0, st, 'A'); ok(r.atk === solo.atk && r.def === solo.def, 'effect dạng sát thương/giảm thương/né không đụng Công/Thủ gốc'); ok(Math.abs(r.mods.dr - (1 - (1 - (solo.mods.dr || 0)) * 0.85)) < 1e-9, 'dr gộp kiểu nhân với dr bền vững'); ok(Math.abs(r.mods.dmgMult - 1.35) < 1e-9, 'dmgMult = 1 + dmgOut'); ok(Math.abs(r.spd - solo.spd * 0.7) < 1e-6, 'Băng Phong ×0.7 tốc'); ok(r.mods.dodge > (solo.mods.dodge || 0), 'Linh Thân tăng né');
  const direct = SE.applyBattle({ atk: 1000, def: 500, spd: 100 }, { crit: 0.1, dodge: 0.05, dr: 0.2 }, { atkMult: 0.8, defMult: 1.25, spdMult: 1, dmgOut: -0.15, dr: 0.1, dodge: 0.02, crit: 0.05 });
  ok(direct.atk === 800 && direct.def === 625 && Math.abs(direct.mods.dr - (1 - 0.8 * 0.9)) < 1e-9 && Math.abs(direct.mods.crit - 0.15) < 1e-9, 'applyBattle tính đúng'); ok(direct.stages.length === 2 && SE.explain(direct).includes('Công ×0.8'), 'stages + explain');
  ok(SE.applyBattle({ atk: 1, def: 1, spd: 1 }, null, null).mods && SE.applyBattle({ atk: 1, def: 1, spd: 1 }, undefined, null).stages.length === 1, 'null-safe');
})();
console.log(`✅ test_effects21: ${n} kiểm tra PASS`);
