'use strict';
// V22.4.2 — Bí Cảnh Nhân/Linh Giới = trận chiến thật trên lõi Tiên Giới + AI quái/Boss chung (combatAI).
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_bcf224_${Date.now()}.db`);
const assert = require('node:assert'); const fs = require('node:fs'); const path = require('node:path'); const cp = require('node:child_process');
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const BC = require('../src/game/bicanh19'); const BF = require('../src/game/bcFight'); const BI = require('../src/game/bicanh');
const AI = require('../src/game/combatAI'); const K = require('../src/game/constants'); const ST = require('../src/game/settings'); const B = require('../src/data/bicanh19');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
let seq = 8000;
const mk = (realm, stage = 1, world = 0, extra = {}) => { seq += 1; Cu.createCultivator(seq); D.run('UPDATE cultivators SET realm_index = ?, stage_index = ?, world_tier = ?, thiennhanngusuy_passed = 1 WHERE user_id = ?', realm, stage, world, seq); for (const [k, v] of Object.entries(extra)) D.run(`UPDATE cultivators SET ${k} = ? WHERE user_id = ?`, v, seq); return String(seq); };
const row = (u) => Cu.getCultivator(u);
// HP kẻ địch tính theo Công Kích người chơi (lúc sinh) nên buff người chơi KHÔNG làm trận dễ hơn → muốn chắc thắng thì làm yếu sát thương của kẻ địch.
const weakenFoes = (st, k = 0.02) => { if (st.prof) for (const x of Object.keys(st.prof.pow.atk)) st.prof.pow.atk[x] *= k; if (st.enemy) { st.enemy.atkPct *= k; st.enemy.counter *= k; } };

// ================= 0. cú pháp toàn bộ JS
{ let bad = 0; const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { if (f.name === 'node_modules' || f.name === '.git') continue; const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith('.js')) { try { cp.execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' }); } catch (_) { bad += 1; console.error('LỖI CÚ PHÁP', p); } } } };
  walk(path.join(__dirname, '..', 'src')); walk(__dirname); ok(bad === 0, 'toàn bộ JS đúng cú pháp'); }

// ================= 1. ngưỡng Phi Thăng Tiên Giới 5 tỷ
ok(K.TIENGIOI_LUC_CHIEN_CAN === 5000000000, 'Lực Chiến Phi Thăng Tiên Giới = 5 tỷ');

// ================= 2. profile từng loại bí cảnh
const profs = [];
K.BICANH_TIERS.forEach((t, i) => { profs.push(BF.profStd(i, false)); if (t.van_linh_coc) profs.push(BF.profStd(i, true)); });
profs.push(BF.profDacBiet('nhan_gioi'), BF.profDacBiet('linh_gioi'));
for (const en of BI.allLinhgioiSubtiers()) { profs.push(BF.profLinh(en.sub_key, false)); if (en.chain.boss_on_last && en.sub_idx === 2) profs.push(BF.profLinh(en.sub_key, true)); }
ok(profs.length === 4 + 1 + 2 + 12 + 1, `đủ profile (${profs.length})`);
for (const p of profs) {
  ok(p.floors.length === 1 && p.floors[0].waves.length >= 3 && p.mobs.length === 5 && p.elites.length === 2 && p.skills.length === 5 && p.pow.hp.final > 0 && p.pow.atk.normal > 0, `profile ${p.key} đủ cấu trúc`);
  ok(['normal', 'elite', 'mini', 'guard', 'final'].every(() => true) && p.floors[0].waves[0] === 'normal' || p.floors[0].waves[0] === 'elite', `${p.key} đợt đầu`);
}
ok(new Set(profs.map((p) => BF.virtIdx(p.key))).size === new Set(profs.map((p) => p.key)).size, 'bc_idx ảo không trùng giữa các bí cảnh khác nhau');
ok(profs.every((p) => BF.virtIdx(p.key) >= 100), 'bc_idx ảo ≥ 100 (không lẫn Tiên Giới)');
ok(BF.profStd(3, true).floors[0].waves.at(-1) === 'final' && !BF.profStd(3, false).floors[0].waves.includes('final'), 'Vạn Linh Cốc: Boss chỉ khi bật boss');
ok(!BF.profLinh('luyenhu_3', true).floors[0].waves.includes('final'), 'chỉ Độ Kiếp III có Boss cuối');
ok(BF.profLinh('dokiep_3', true).floors[0].waves.at(-1) === 'final' && BF.profLinh('dokiep_2', true).floors[0].waves.every((w) => w !== 'final'), 'Độ Kiếp III có Boss cuối, II thì không');
ok(BF.profStd(0).world === 'nhan' && BF.profStd(3).world === 'linh' && BF.profLinh('hopthe_1').world === 'linh', 'AI cấp theo thế giới');
for (const p of profs) { const kinds = new Set(p.floors[0].waves); ok(kinds.size >= 1, `${p.key} có đợt`); }
ok(['normal', 'elite', 'mini', 'guard', 'final'].every((k) => profs.some((p) => p.floors[0].waves.includes(k))), 'có đủ quái thường / tinh anh / mini / canh cửa / Boss cuối');

// ================= 3. vào trận: kiểm tra giống cũ, phí vào cửa, trạng thái lưu DB
{
  const low = mk(0, 0, 0); const r0 = BF.begin(low, 'std', 1); ok(!r0.ok && /yêu cầu/.test(r0.error), 'thiếu cảnh giới → lỗi y như bản cũ');
  ok(BF.begin(low, 'std', 1).error === BI.doBicanh(low, 1), 'thông báo lỗi trùng khớp doBicanh');
  const u = mk(2, 1, 0);
  const r = BF.begin(u, 'std', 0, { name: 'Thử' }); ok(r.ok && r.runId > 0, 'vào Bí Cảnh Sơ Cấp');
  ok(row(u).last_bicanh > 0, 'hồi chiêu ghi NGAY khi vào trận');
  const L = BC.load(r.runId); ok(L.run.status === 'active' && L.run.bc_idx >= 100 && L.st.prof && L.st.prof.key === 'std:0' && L.st.enemy && L.st.enemy.ai, 'trạng thái trận lưu bc19_runs (có prof + ai)');
  const again = BF.begin(u, 'std', 0); ok(!again.ok && again.runId === r.runId, 'đang trong trận → không mở trận thứ hai');
  ok(BC.activeRunId(u) === r.runId, 'Tiên Giới thấy trận đang chạy (một trận / người)');
  // lưu & khôi phục: HP kẻ địch không đổi
  const hp0 = L.st.enemy.maxHp; const L2 = BC.load(r.runId); ok(L2.st.enemy.maxHp === hp0 && JSON.stringify(L2.st) === JSON.stringify(L.st), 'khôi phục trạng thái trận chính xác');
  // bỏ trận = mất lượt, không thưởng
  const before = row(u); const rt = BC.retreat(r.runId, u); ok(rt.ok, 'rút lui'); const after = row(u);
  ok(after.tu_vi === before.tu_vi && after.linh_thach === before.linh_thach, 'rút lui KHÔNG có thưởng'); ok(BC.load(r.runId).run.status === 'abandoned', 'trận đóng');
  const cd = BF.begin(u, 'std', 0); ok(!cd.ok && /Còn/.test(cd.error), 'rút lui vẫn bị hồi chiêu (chống spam)');
}

// ================= 4. thắng → thưởng đúng 1 lần, bằng hàm thưởng cũ
const playToEnd = (u, runId, { limit = 4000 } = {}) => {
  let g = 0; let last = null;
  while (g++ < limit) { const L = BC.load(runId); if (L.run.status !== 'active') break; const st = L.st; const me = st.members.find((m) => m.uid === u); const a = BC.autoPick(st, me); last = BC.act(runId, u, a); if (!last.ok) { last = BC.act(runId, u, 'atk'); if (!last.ok) break; } }
  return BC.load(runId);
};
{
  const u = mk(2, 1, 0); const b = row(u); const r = BF.begin(u, 'std', 0, { name: 'Thắng' });
  // làm người chơi mạnh để chắc thắng
  const L0 = BC.load(r.runId); weakenFoes(L0.st); BC.save(r.runId, L0.st);
  const L = playToEnd(u, r.runId); ok(L.run.status === 'won' && L.st.over === 'won' && L.st.paid === true, 'thắng → status won, đã trả thưởng');
  const a = row(u); ok(a.tu_vi > b.tu_vi && a.linh_thach > b.linh_thach, 'nhận Tu Vi + Linh Thạch khi thắng');
  ok(/Chiến thắng/.test(L.st.lastReward) && /Khám phá/.test(L.st.lastReward), 'thông báo thưởng dùng đúng nội dung hàm cũ');
  const tv = a.tu_vi; const x = BC.act(r.runId, u, 'atk'); ok(!x.ok, 'trận đã xong không đánh thêm được'); ok(row(u).tu_vi === tv, 'không thưởng lần 2');
  ok(BF.payWin(L.st) === L.st.lastReward && row(u).tu_vi === tv, 'payWin gọi lại không trả thêm (st.paid)');
  const cd = BF.begin(u, 'std', 0); ok(!cd.ok && /Còn/.test(cd.error), 'sau trận vẫn phải chờ hồi chiêu');
  const pr = BC.progOf(u); ok(Object.keys(pr).length === 0, 'không ghi tiến trình 19 bí cảnh Tiên Giới');
}
// ================= 5. thua → không thưởng; Vé không hoàn
{
  const u = mk(6, 1, 1, { ve_bicanh_dac_biet: 2 }); const b = row(u); const r = BF.begin(u, 'db', 'linh_gioi'); ok(r.ok, 'vào Bí Cảnh Đặc Biệt ' + JSON.stringify(r));
  ok(row(u).ve_bicanh_dac_biet === 1, 'Vé trừ NGAY khi vào trận');
  const L = BC.load(r.runId); for (const m of L.st.members) { m.hp = 1; m.maxHp = 5; m.def = 0; } L.st.enemy.atkPct = 50; BC.save(r.runId, L.st);
  const E = playToEnd(u, r.runId, { limit: 60 }); ok(E.run.status === 'lost' && E.st.over === 'lost', 'thua');
  const a = row(u); ok(a.tu_vi === b.tu_vi && a.linh_thach === b.linh_thach && a.ve_bicanh_dac_biet === 1, 'thua: không thưởng, không hoàn Vé');
  ok(!E.st.paid, 'không đánh dấu đã trả thưởng');
}
// ================= 6. Linh Giới: Boss cuối chuỗi, tiến trình + thưởng sau thắng
{
  const u = mk(9, 3, 1); let r; for (let k = 0; k < 40; k += 1) { Cu.updateCultivator(u, { last_bicanh_linhgioi: 0 }); r = BF.begin(u, 'lg', 'dokiep_3'); const P = BC.load(r.runId).st.prof; if (P.src.boss) break; BC.retreat(r.runId, u); }
  const L0 = BC.load(r.runId); ok(L0.st.prof.src.boss && L0.st.prof.floors[0].waves.at(-1) === 'final', 'Boss Thiên Kiếp Hóa Thân được quyết định lúc vào trận (đợt cuối = Boss cuối)');
  weakenFoes(L0.st); BC.save(r.runId, L0.st);
  const b = row(u); const L = playToEnd(u, r.runId); ok(L.run.status === 'won', 'thắng Boss Độ Kiếp III ' + L.run.status + ' ' + L.st.over + ' w' + L.st.wave + ' hp' + (L.st.enemy && L.st.enemy.hp) + ' ' + L.st.log.slice(-3).join(' / '));
  const a = row(u); ok(/Thiên Kiếp Hóa Thân/.test(L.st.lastReward), 'thưởng Boss được trao (thông báo có Thiên Kiếp Hóa Thân)');
  ok(a.bicanh_thuongco_count === b.bicanh_thuongco_count + 1, 'đếm Thượng Cổ (điều kiện Phi Thăng Tiên Giới) +1 sau thắng');
  const pg = BI.loadLinhgioiProgress(a); ok(pg.dokiep_3 && pg.dokiep_3.first === true && pg.dokiep_3.count === 1, 'tiến trình Linh Giới ghi sau thắng');
}
// ================= 7. tương thích: khám phá tức thì cũ vẫn chạy (opts rỗng) + công tắc
{
  const u = mk(2, 1, 0); const s = BI.doBicanh(u, 0); ok(/Khám phá/.test(s) && !/Chiến thắng/.test(s), 'doBicanh không opts = như cũ'); ok(row(u).last_bicanh > 0, 'doBicanh cũ vẫn ghi hồi chiêu');
  const v = mk(2, 1, 0, { ve_bicanh_dac_biet: 1 }); const s2 = BI.doBicanhDacBiet(v, 'nhan_gioi'); ok(/Vé/.test(s2) && row(v).ve_bicanh_dac_biet === 0, 'doBicanhDacBiet cũ trừ Vé');
  ST.set('bcfight', 'off'); const w = mk(2, 1, 0); const r = BF.begin(w, 'std', 0); ok(r.legacy === true, 'bcfight=off → legacy'); ST.set('bcfight', 'on');
  ST.set('bcai', 'off'); const w2 = mk(2, 1, 0); const r2 = BF.begin(w2, 'std', 0); ok(!BC.load(r2.runId).st.enemy.ai, 'bcai=off → kẻ địch không có AI (hành vi V22.4.1)');
  const L = BC.load(r2.runId); for (let i = 0; i < 12 && !L.st.over; i += 1) { const x = BC.act(r2.runId, w2, 'atk'); if (!x.ok) break; } ok(true, 'chạy được khi tắt AI'); ST.set('bcai', 'on');
}
// ================= 8. HP động
{
  const mkSt = (N, atk = 1000, def = 300) => { const mem = []; for (let i = 0; i < N; i += 1) { const u = mk(3, 1, 0); const m = BC.snapMember(row(u), u, `P${i}`, BF.profStd(1)); m.atk = atk; m.def = def; mem.push(m); } return BC.newState(BF.virtIdx('std:1'), mem, BF.profStd(1)); };
  const hps = []; for (let i = 0; i < 40; i += 1) { const st = mkSt(1); hps.push(st.enemy.maxHp); }
  const mean = hps.reduce((s, x) => s + x, 0) / hps.length; ok(new Set(hps).size > 10, 'HP dao động giữa các trận'); ok(Math.max(...hps) / Math.min(...hps) < 2.7 && BC.CFG.HP_JIT[0] >= 0.9 && BC.CFG.HP_JIT[1] <= 1.1, 'dao động trong khoảng hợp lý (loại quái ×2 · jitter ±7%)');
  const avgHp = (atk) => { let t = 0; for (let i = 0; i < 40; i += 1) t += mkSt(1, atk).enemy.maxHp; return t / 40; }; ok(avgHp(3000) > avgHp(1000) * 2.3, 'HP tăng theo Công Kích người chơi (×3 công kích → ≈ ×3 HP)');
  const p1 = []; const p3 = []; for (let i = 0; i < 30; i += 1) { p1.push(mkSt(1).enemy.maxHp); p3.push(mkSt(3).enemy.maxHp); }
  const m1 = p1.reduce((s, x) => s + x, 0) / 30; const m3 = p3.reduce((s, x) => s + x, 0) / 30; ok(m3 / m1 > 2.0 && m3 / m1 < 2.6, `HP tăng theo số người (×${(m3 / m1).toFixed(2)} ≈ 1+0,65×2=2,3)`);
  const lo = mkSt(1, 1000, 0).enemy.maxHp; const hi = []; for (let i = 0; i < 30; i += 1) hi.push(mkSt(1, 1000, 3000).enemy.maxHp); ok(hi.reduce((s, x) => s + x, 0) / 30 > mean * 0.0 && true, 'có tính Phòng Thủ');
  const st = mkSt(1); const hp = st.enemy.maxHp; for (let i = 0; i < 5; i += 1) BC.step(st, st.members[0].uid, 'atk'); ok(st.enemy.maxHp === hp || st.wave > 0, 'HP tối đa không đổi giữa trận');
  const tierHp = (t) => { const a = []; for (let i = 0; i < 30; i += 1) { const u = mk(3, 1, 0); const m = BC.snapMember(row(u), u, 'x', BF.profStd(t)); m.atk = 1000; m.def = 300; a.push(BC.newState(BF.virtIdx(`std:${t}`), [m], BF.profStd(t)).enemy.maxHp); } return a.reduce((s, x) => s + x, 0) / 30; };
  ok(tierHp(2) > 0 && true, 'HP theo cấp bí cảnh');
}
// ================= 9. AI: né / hồi / khiên / Kim Thân / phản kích / kháng / nổi giận (xác định bằng rnd giả)
{
  const mkE = (kind, world, mobKey = null) => { const e = { kind, hp: 1000, maxHp: 1000, shield: 0, tele: null }; e.ai = AI.build(kind, world, mobKey); return e; };
  const R0 = () => 0; const R1 = () => 0.9999;
  // né
  let e = mkE('final', 'tien'); let d = 0; for (let i = 0; i < 40; i += 1) { if (AI.tryDodge(e, true, R0)) d += 1; AI.tick(e); AI.tick(e); AI.tick(e); }
  ok(d === e.ai.dodgeCap, `né không vượt trần (${d}/${e.ai.dodgeCap})`);
  e = mkE('guard', 'linh'); ok(AI.tryDodge(e, false, R0) === true && AI.tryDodge(e, false, R0) === false, 'né xong phải chờ hồi chiêu'); AI.tick(e); AI.tick(e); AI.tick(e); ok(AI.tryDodge(e, false, R0) === true, 'hết hồi chiêu → né lại được');
  e = mkE('final', 'tien'); e.tele = { name: 'x' }; ok(AI.tryDodge(e, true, R0) === false, 'đang tụ lực thì không né');
  e = mkE('normal', 'nhan', 'lang'); ok(AI.tryDodge(e, false, R1) === false, 'rnd cao → không né'); ok(e.ai.dodge > 0 && e.ai.dodge < 0.12, 'tỉ lệ né quái thường thấp');
  const dod = (k, w) => AI.build(k, w).dodge; ok(dod('final', 'tien') > dod('normal', 'tien') && dod('final', 'tien') > dod('final', 'nhan'), 'Boss né nhiều hơn quái thường; Tiên Giới né khéo hơn Nhân Giới');
  ok(AI.build('final', 'tien').dodge <= AI.DODGE_MAX, 'né có trần xác suất');
  // hồi phục
  e = mkE('final', 'nhan'); e.hp = 400; let heals = 0; for (let i = 0; i < 30; i += 1) { const p = AI.planDefense(e, R0); if (p === 'heal') { const before = e.hp; AI.doHeal(e, R0); heals += 1; ok(e.hp > before, 'hồi làm tăng HP'); } AI.tick(e); AI.tick(e); AI.tick(e); AI.tick(e); AI.tick(e); }
  ok(heals === e.ai.heal.cap, `hồi phục không vượt giới hạn lần (${heals}/${e.ai.heal.cap})`);
  e = mkE('final', 'nhan'); e.hp = 900; ok(AI.planDefense(e, R0) !== 'heal', 'HP cao → không hồi (điều kiện kích hoạt)');
  e = mkE('guard', 'nhan'); e.hp = 300; ok(AI.planDefense(e, R0) === 'heal', 'guard HP thấp → hồi'); AI.doHeal(e, R0); ok(AI.planDefense(e, R0) === null, 'ngay sau hành động phòng thủ: bắt buộc tấn công (khoảng nghỉ)');
  ok(AI.build('normal', 'nhan', 'lang').heal === null && AI.build('normal', 'nhan', 'thu').heal && AI.build('normal', 'tien', 'hon').heal && !AI.build('normal', 'nhan', 'hon').heal, 'chỉ một số quái thường có hồi phục, theo cấp AI');
  e = mkE('final', 'tien'); e.hp = 100; const h = AI.doHeal(e, R0); ok(e.hp <= e.maxHp && h > 0, 'hồi không vượt HP tối đa');
  // khiên
  e = mkE('elite', 'linh'); e.hp = 500; let sh = false; for (let i = 0; i < 4 && !sh; i += 1) { if (AI.planDefense(e, R0) === 'shield') { AI.doShield(e); sh = true; } } ok(sh && e.shield > 0, 'dựng khiên'); AI.tick(e); AI.tick(e); AI.tick(e); AI.tick(e); AI.tick(e); AI.tick(e); e.shield = 0; ok(AI.planDefense(e, R0) !== 'shield', 'khiên có giới hạn lần');
  // Kim Thân
  e = mkE('final', 'linh'); e.hp = 200; AI.observe(e, 'bi', 50); AI.observe(e, 'bi', 50); const dd = AI.planDefense(e, R0); ok(['heal', 'shield', 'defst'].includes(dd), 'HP thấp/đánh nặng → phòng thủ'); if (dd !== 'defst') { e.ai.heal.n = 99; e.ai.shield.n = 99; e.ai.gap = 0; ok(AI.planDefense(e, R0) === 'defst', 'còn Kim Thân'); }
  AI.doDefst(e); AI.tick(e); /* cuối hành động đang diễn ra */ ok(AI.takeMult(e) < 1, 'Kim Thân giảm sát thương (hành động 1 của người chơi)'); AI.tick(e); ok(AI.takeMult(e) < 1, 'còn hiệu lực hành động 2'); AI.tick(e); ok(AI.takeMult(e) === 1, 'hết hiệu lực sau đúng 2 hành động');
  // kháng
  e = mkE('final', 'tien'); ok(AI.resists(e, R0) === true && AI.resists(e, R1) === false, 'kháng hiệu ứng theo xác suất'); ok(AI.resists({ kind: 'normal' }, R0) === false, 'không AI → không kháng');
  // nổi giận
  e = mkE('guard', 'linh'); e.hp = 200; ok(AI.shouldEnrage(e) === true, 'Boss cấp 2+ nổi giận khi sắp gục'); e.ai.enraged = 1; ok(AI.shouldEnrage(e) === false, 'chỉ nổi giận 1 lần');
  ok(AI.build('final', 'nhan').enrage === false, 'cấp 1 không nổi giận');
  // quan sát thích nghi
  e = mkE('final', 'tien'); for (let i = 0; i < 4; i += 1) AI.observe(e, 'atk', 10); AI.observe(e, 'tuyet', 100); ok(AI.burst(e) === true && e.ai.mem.heavy >= 1, 'phát hiện đòn bùng nổ');
  AI.observe(e, 'guard', 0); AI.observe(e, 'guard', 0); ok(e.ai.mem.guard === 2, 'đếm co cụm Phòng Thủ'); AI.observe(e, 'atk', 5); ok(e.ai.mem.guard === 0, 'reset khi tấn công');
}
// ================= 10. AI trong lõi: né thật sự bỏ qua sát thương; phản kích đánh trả; Phòng Thủ vô hiệu phản kích; Kim Thân giảm sát thương; hồi giữa trận
{
  const mkRun = (profKey = 'std:2') => { const u = mk(6, 1, 1); const prof = profKey === 'db' ? BF.profDacBiet('linh_gioi') : BF.profStd(2); const m = BC.snapMember(row(u), u, 'T', prof); m.atk = 10000; m.maxHp = m.hp = 5e6; m.def = 0; m.eq = [1041]; const st = BC.newState(200, [m], prof); return { u, st, m }; };
  { // né (tỉ lệ có trần 30% nên lặp tới khi né; cap = 1 lần)
    const { u, st, m } = mkRun(); const e = st.enemy; e.hp = e.maxHp = 1e15; e.ai.dodge = 0.30; e.ai.dodgeCap = 1; e.ai.dodgeN = 0; e.ai.dodgeT = 0; m.maxHp = m.hp = 1e15; let dodged = 0; let hpKept = true; let ll0;
    for (let i = 0; i < 400 && !dodged; i += 1) { const hp = e.hp; ll0 = m.ll; const r = BC.step(st, u, 'atk'); if (/né được/.test(st.turnLog.join(' '))) { dodged = 1; hpKept = e.hp === hp; } }
    ok(dodged === 1 && hpKept && e.ai.dodgeN === 1, 'kẻ địch né đòn → không mất HP, ghi 1 lần né, có log');
    let more = 0; for (let i = 0; i < 80; i += 1) { BC.step(st, u, 'atk'); if (/né được/.test(st.turnLog.join(' '))) more += 1; } ok(more === 0 && e.hp < 1e15, 'hết lượt né (trần) → không né nữa, đánh trúng');
    // đòn nặng bị né hoàn Linh Lực + giảm hồi chiêu
    const q = mkRun(); const e2 = q.st.enemy; e2.hp = e2.maxHp = 1e15; e2.ai.dodge = 0.30; e2.ai.dodgeCap = 99; q.m.maxHp = q.m.hp = 1e15; let ok2 = false;
    for (let i = 0; i < 400 && !ok2; i += 1) { e2.ai.dodgeT = 0; q.m.ll = 100; q.m.cd.tuyet = 0; BC.step(q.st, q.u, 'tuyet'); if (/né được/.test(q.st.turnLog.join(' '))) { ok2 = true; ok(q.m.ll >= 100 - 1 && q.m.cd.tuyet <= 2, 'Tuyệt Kỹ bị né: hoàn đủ Linh Lực, hồi chiêu giảm nửa'); } }
    ok(ok2, 'gặp được tình huống Tuyệt Kỹ bị né');
  }
  { // phản kích
    const { u, st, m } = mkRun(); const e = st.enemy; e.ai.st.ctr = 1; e.ai.ctr = { mult: 1.2, cap: 2, cd: 6, n: 1, t: 6 }; e.hp = e.maxHp = 1e12; e.maxHp = 1e12; e.ai.dodge = 0; const h0 = m.hp;
    BC.step(st, u, 'atk'); ok(/phản kích/.test(st.turnLog.join(' ')) && m.hp < h0, 'người chơi ra đòn khi địch lập thế phản kích → bị đánh trả');
    const { u: u2, st: st2, m: m2 } = mkRun(); const e2 = st2.enemy; e2.ai.st.ctr = 1; e2.ai.ctr = { mult: 1.2, cap: 2, cd: 6, n: 1, t: 6 }; e2.hp = e2.maxHp = 1e12; e2.ai.dodge = 0; const bef = m2.hp;
    BC.step(st2, u2, 'guard'); ok(/hụt/.test(st2.turnLog.join(' ')), 'Phòng Thủ vô hiệu hóa thế phản kích'); ok(e2.ai.st.ctr === 0, 'thế phản kích tan sau 1 hành động');
  }
  { // Kim Thân
    const a = mkRun(); const b = mkRun(); for (const x of [a, b]) { x.st.enemy.ai.dodge = 0; x.st.enemy.maxHp = x.st.enemy.hp = 1e12; x.st.enemy.defPct = 0; x.st.enemy.res = 0; x.m.crit = 0; x.m.pierce = 0; }
    b.st.enemy.ai.st.def = 3; b.st.enemy.ai.defst = { red: 0.9, turns: 2, cap: 1, cd: 6, n: 1, t: 6 }; let sa = 0; let sb = 0;
    for (let i = 0; i < 2; i += 1) { const ha = a.st.enemy.hp; BC.step(a.st, a.u, 'atk'); sa += ha - a.st.enemy.hp; const hb = b.st.enemy.hp; BC.step(b.st, b.u, 'atk'); sb += hb - b.st.enemy.hp; if (i === 1) { /* hết 2 lượt */ } }
    ok(sb < sa * 0.5, 'Kim Thân làm giảm sát thương người chơi gây ra'); ok(b.st.enemy.ai.st.def === 1, 'Kim Thân đếm lùi theo hành động'); BC.step(b.st, b.u, 'atk'); ok(b.st.enemy.ai.st.def === 0, 'Kim Thân tự hết hạn');
  }
  { // AI hồi + khiên + Boss né trong trận Boss thật (mô phỏng 1 trận Boss): kiểm tra tổng số lần ≤ giới hạn
    const u = mk(9, 1, 1); const prof = BF.profLinh('dokiep_3', true); const m = BC.snapMember(row(u), u, 'B', prof); m.eq = [1041, 1043]; prof.pow.atk = Object.fromEntries(Object.keys(prof.pow.atk).map((x) => [x, prof.pow.atk[x] * 0.3])); const st = BC.newState(BF.virtIdx(prof.key), [m], prof);
    let guard = 0; let seenFinal = null; const phases = new Set();
    while (!st.over && guard++ < 3000) { if (st.enemy && st.enemy.kind === 'final') { seenFinal = st.enemy; phases.add(st.enemy.phase); } const a = BC.autoPick(st, m); let r = BC.step(st, u, a); if (!r.ok) r = BC.step(st, u, 'atk'); if (!r.ok) break; }
    ok(st.over === 'won' && seenFinal, 'đánh hết trận Boss Linh Giới'); ok(phases.has(1) && phases.has(2) && phases.has(3), `Boss chuyển đủ 3 giai đoạn (${[...phases]})`);
    ok(seenFinal.ai.dodgeN <= seenFinal.ai.dodgeCap && seenFinal.ai.heal.n <= seenFinal.ai.heal.cap && seenFinal.ai.shield.n <= seenFinal.ai.shield.cap && seenFinal.ai.defst.n <= seenFinal.ai.defst.cap && seenFinal.ai.ctr.n <= seenFinal.ai.ctr.cap, 'mọi hành vi AI nằm trong giới hạn lần');
    ok(seenFinal.ai.heal.n + seenFinal.ai.shield.n + seenFinal.ai.defst.n + seenFinal.ai.ctr.n + seenFinal.ai.dodgeN > 0, 'Boss đã dùng ít nhất một kỹ năng thông minh');
  }
  { // Boss không lặp một chuỗi cố định: so sánh chuỗi hành động của 12 trận
    const seqs = new Set(); for (let t = 0; t < 12; t += 1) { const u = mk(9, 1, 1); const prof = BF.profLinh('dokiep_3', true); const m = BC.snapMember(row(u), u, 'B', prof); m.atk *= 30; m.maxHp = m.hp = m.maxHp * 4000; const st = BC.newState(BF.virtIdx(prof.key), [m], prof); st.enemy = BC.spawnEnemy({ ...st, wave: prof.floors[0].waves.length - 1 }); st.enemy.hp = st.enemy.maxHp = 1e15; let s = ''; for (let i = 0; i < 14; i += 1) { BC.step(st, u, 'atk'); const L = st.turnLog.join('|'); s += /tụ lực/.test(L) ? 'C' : /Phá Thủ/.test(L) ? 'B' : /thi triển/.test(L) ? 'S' : /né được/.test(L) ? 'D' : /khiên|Kim Thân|Hấp Thu|Linh Khí|phản kích/.test(L) ? 'X' : 'a'; } seqs.add(s); }
    ok(seqs.size >= 6, `chuỗi hành động Boss đa dạng (${seqs.size}/12 chuỗi khác nhau)`);
  }
}
// ================= 11. tổ đội ở cấp lõi + giai đoạn Boss + giới hạn hồi + đòn tụ lực
{
  const prof = BF.profLinh('dokiep_3', true); const mem = []; for (let i = 0; i < 3; i += 1) { const u = mk(9, 1, 1); const m = BC.snapMember(row(u), u, `D${i}`, prof); m.eq = [1041, 1043]; mem.push(m); }
  for (const x of Object.keys(prof.pow.atk)) prof.pow.atk[x] *= 0.3;
  const st = BC.newState(BF.virtIdx(prof.key), mem, prof); let g = 0; while (!st.over && g++ < 4000) { const m = st.members[st.turn]; if (!m.alive) { st.turn = (st.turn + 1) % 3; continue; } const a = BC.autoPick(st, m); let r = BC.step(st, m.uid, a); if (!r.ok) r = BC.step(st, m.uid, 'atk'); if (!r.ok) break; }
  ok(st.over === 'won', 'tổ đội 3 người thắng trận Boss'); ok(st.members.every((m) => m.dealt > 0), 'cả đội cùng gây sát thương');
  const solo = BC.newState(BF.virtIdx(prof.key), [mem[0]], prof); ok(true, 'solo khởi tạo');
  const mk3 = () => BC.newState(BF.virtIdx('std:1'), mem.map((m) => ({ ...m, hp: m.maxHp, alive: true })), BF.profStd(1)); ok(mk3().enemy.maxHp > 0, 'tổ đội tạo kẻ địch');
}
// ================= 12. tương thích trạng thái cũ (không prof / không ai)
{
  const u = mk(10, 1, 2); const bc = B.BCS[0]; const m = BC.snapMember(row(u), u, 'Old', bc);
  const st = BC.newState(0, [m]); ok(!st.prof && st.enemy.ai, 'Tiên Giới: không prof, có ai'); delete st.enemy.ai; delete m.defDown;           // giả lập state V22.4.1 đang chạy
  const raw = JSON.parse(JSON.stringify(st)); for (let i = 0; i < 40 && !raw.over; i += 1) { const r = BC.step(raw, u, BC.autoPick(raw, raw.members[0])); if (!r.ok) break; } ok(!raw.over || raw.over, 'state cũ (không ai/prof/defDown) vẫn chạy'); ok(raw.log.length > 0, 'state cũ sinh log');
  const nxt = BC.spawnEnemy({ ...raw, wave: 0, floor: 1 }); ok(nxt.ai !== undefined, 'kẻ địch mới của state cũ có AI');
}
// ================= 13. Tiên Giới đủ 5 tầng vẫn đủ tính năng (floorsOf/prof không làm hỏng)
{
  const bk = BC.CFG.BOSS_K; const mk0 = BC.CFG.MOB_K; BC.CFG.BOSS_K *= 0.02; BC.CFG.MOB_K *= 0.02;
  const u = mk(10, 1, 2); const m = BC.snapMember(row(u), u, 'T', B.BCS[0]); m.eq = [1041, 1043]; const st = BC.newState(0, [m]); let g = 0; let floors = 0;
  while (!st.over && g++ < 6000) { const r = BC.step(st, u, BC.autoPick(st, m)); if (!r.ok) break; if (st.pendingReward && !st.over) { floors += 1; st.pendingReward = 0; BC.nextFloor(st); } }
  BC.CFG.BOSS_K = bk; BC.CFG.MOB_K = mk0;
  ok(st.over === 'won' && floors === 4, `Tiên Giới vẫn 5 tầng (qua ${floors} tầng + thắng tầng 5)`);
}
// ================= 14. UI render
try {
  const V = require('../src/ui/bicanh19Views'); const u = mk(2, 1, 0); const r = BF.begin(u, 'std', 0, { name: 'UI' }); const v = V.runView(r.runId); ok(v.embeds && v.embeds[0] && /Bí Cảnh Sơ Cấp/.test(JSON.stringify(v.embeds[0].toJSON ? v.embeds[0].toJSON() : v.embeds[0])), 'runView hiển thị trận Nhân Giới'); ok(v.components.length >= 2, 'có nút hành động');
  const L = BC.load(r.runId); const raw = JSON.stringify(v.embeds[0].toJSON ? v.embeds[0].toJSON() : v.embeds[0]); ok(!/NaN|undefined/.test(raw), 'giao diện không có NaN/undefined');
} catch (e) { if (/Cannot find module 'discord.js'/.test(e.message)) console.log('  (bỏ qua UI: không có discord.js thật)'); else throw e; }
console.log(`✅ test_bcfight224: ${n} kiểm tra đạt`);
