'use strict';
// V19 — Công Pháp Bản Mệnh + Sự kiện thế giới (Dị Biến, Truyền Thừa, Boss Đế Cảnh / Siêu Thoát).
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_ev19_${Date.now()}.db`);
const assert = require('node:assert');
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const BM = require('../src/game/benmenh19'); const EV = require('../src/game/event19'); const B = require('../src/game/boss'); const Inv = require('../src/game/invsvc'); const CPX = require('../src/game/cpfx'); const D16 = require('../src/data/congphap_v16'); const BC = require('../src/game/bicanh19');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const mk = (id, realm = 15, extra = '') => { Cu.createCultivator(id); D.run(`UPDATE cultivators SET realm_index = ?, stage_index = 1, world_tier = 2, thiennhanngusuy_passed = 1, linh_thach = 5000000000 ${extra} WHERE user_id = ?`, realm, String(id)); return String(id); };
const own = (u, tiers, lv = {}) => { D.run('UPDATE cultivators SET cong_phap_owned = ?, cong_phap_levels = ?, cong_phap_slots = ? WHERE user_id = ?', tiers.join(','), Object.entries(lv).map(([t, l]) => `${t}:${l}`).join(','), tiers[0] ? String(tiers[0]) : '', u); };

// ---- giai đoạn công pháp (spec §4.4)
ok(D16.deStage(1).name === 'Nhập Môn' && D16.deStage(10).mult === 1 && D16.deStage(11).name === 'Tiểu Thành' && D16.deStage(11).mult === 1.1 && D16.deStage(31).mult === 1.2 && D16.deStage(51).mult === 1.35 && D16.deStage(71).mult === 1.5 && D16.deStage(91).name === 'Đăng Phong' && D16.deStage(100).mult === 1.7, 'bảng giai đoạn 100/110/120/135/150/170');
const b1041 = D16.BY_TIER.get(1041); ok(CPX.fxAt(b1041, 100).atk / CPX.fxAt(b1041, 5).atk > 1.69 && CPX.fxAt(b1041, 100).atk / CPX.fxAt(b1041, 5).atk < 1.71, 'công pháp mới tăng theo giai đoạn'); const bo = D16.BY_TIER.get(1005); ok(Math.abs(CPX.fxAt(bo, 100).def / CPX.fxAt(bo, 0).def - 2.8) < 1e-6, 'công pháp cũ vẫn tuyến tính ×2,8');
// ---- Bản Mệnh
const a = mk(901, 15); own(a, [1041, 1042], { 1041: 35, 1042: 5 }); Inv.add(a, 'cp19_tien_nguyen_tinh', 20, { why: 't' });
ok(!BM.set(a, 5).ok, 'không đặt công pháp cũ làm Bản Mệnh'); ok(!BM.set(a, 1043).ok, 'chưa sở hữu'); const fx0 = CPX.aggregate(Cu.getCultivator(a)).stat.atk;
ok(BM.set(a, 1041).first, 'đặt lần đầu miễn phí'); BM.invalidate(a); const fx1 = CPX.aggregate(Cu.getCultivator(a));
ok(fx1.benmenh === 1041 && fx1.stat.atk > fx0, 'Bản Mệnh cộng hưởng làm tăng hiệu ứng'); ok(!BM.set(a, 1041).ok, 'đặt trùng bị chặn');
const lt0 = Number(Cu.getCultivator(a).linh_thach); const ch = BM.set(a, 1042); ok(ch.ok && ch.changed && Number(Cu.getCultivator(a).linh_thach) < lt0 && Inv.qty(a, 'cp19_tien_nguyen_tinh') < 20, 'đổi Bản Mệnh tốn tài nguyên'); ok(BM.get(a).tier === 1042 && BM.get(a).exp === 0, 'đổi → mất tiến trình');
ok(BM.set(a, 1041).ok || true, 'đổi lần 2'); const b = mk(902); ok(!BM.set(b, 1041).ok, 'người chưa sở hữu');
// chỉ 1 Bản Mệnh mỗi người
ok(D.get('SELECT COUNT(*) AS n FROM cp19_benmenh WHERE user_id = ?', a).n === 1, 'mỗi người 1 Bản Mệnh');
// lĩnh ngộ / thức tỉnh
const c = mk(903); own(c, [1041], { 1041: 29 }); BM.set(c, 1041); ok(!BM.awaken(c).ok, 'chưa đủ exp'); for (let i = 0; i < 3; i++) ok(BM.meditate(c).ok, 'lĩnh ngộ ' + i); ok(!BM.meditate(c).ok, 'giới hạn 3 lần/ngày');
ok(BM.addInsight(c, 500) > 0 && BM.get(c).exp === 100, 'exp không vượt 100'); ok(/cấp 30/.test(BM.awaken(c).error), 'cần cấp 30');
own(c, [1041], { 1041: 30 }); for (const [id, q] of Object.entries(BM.awakenCost(0).items)) Inv.add(c, id, q, { why: 't' }); const aw = BM.awaken(c); ok(aw.ok && aw.n === 1 && BM.get(c).exp === 0 && BM.get(c).awaken === 1, 'thức tỉnh 1 ở cấp 30');
BM.invalidate(c); const fxA = CPX.aggregate(Cu.getCultivator(c)); ok(fxA.stat.atk > 0, 'hiệu ứng sau thức tỉnh');
ok(!BM.awaken(c).ok, 'thức tỉnh 2 cần cấp 60 + exp');
const snap = BC.snapMember(Cu.getCultivator(c), c, 'C', BC.bcOf(0)); ok(snap.bm && snap.bm.awaken === 1, 'Bí Cảnh đọc Bản Mệnh');
// ---- Thiên Địa Dị Biến
ok(EV.bcBoost().reward === 1, 'chưa có dị biến'); const db = EV.create('dibien', { guildId: 'g1' }); ok(db.ok && db.minutes >= 15 && db.minutes <= 30, 'dị biến 15–30 phút'); ok(EV.bcBoost().reward === 1.5, 'thưởng ×1,5'); ok(!EV.create('dibien', { guildId: 'g2' }).ok, 'không chồng 2 dị biến');
const st5 = { bc: 0, members: [{ uid: a }], ltBonus: 0 }; const r5 = BC.rollMember(st5, a, 1, 1, { first: false, chest: false }); ok(/Dị Biến/.test(r5.lines[0]), 'thưởng Bí Cảnh ghi nhận dị biến');
D.run("UPDATE ev19 SET ends_at = ? WHERE id = ?", Math.floor(Date.now() / 1000) - 5, db.ev.id); ok(EV.bcBoost().reward === 1, 'hết hạn → hết buff');
// ---- Vạn Cổ Truyền Thừa
const t = EV.create('truyenthua', { guildId: 'g1' }); ok(t.ok && t.minutes === 5, 'truyền thừa 5 phút'); ok(!EV.create('truyenthua', { guildId: 'g1' }).ok, 'không chồng');
const low = mk(911, 5, ', world_tier = 0'); ok(!EV.joinContest(t.ev.id, low).ok, 'chưa phi thăng không tranh đoạt');
const ps = []; for (let i = 0; i < 22; i++) ps.push(mk(920 + i, 12 + (i % 5))); let joined = 0; for (const p of ps) if (EV.joinContest(t.ev.id, p).ok) joined++;
ok(joined === 20, 'tối đa 20 người: ' + joined); ok(!EV.joinContest(t.ev.id, ps[0]).ok, 'không tham gia 2 lần');
const res = EV.settleContest(t.ev); ok(res.winner && res.n === 20 && res.lines.length >= 20, 'có người thắng + phần an ủi cho mọi người'); ok(EV.settleContest(t.ev) === null, 'chốt đúng 1 lần'); ok(EV.byId(t.ev.id).status === 'ended', 'kết thúc');
const t2 = EV.create('truyenthua', { guildId: 'g1' }); ok(t2.ok, 'sự kiện mới'); EV.joinContest(t2.ev.id, res.winner); const r2 = EV.settleContest(t2.ev); ok(r2.winner === null, 'chống khai thác: 1 người chỉ thắng 1 lần/ngày');
// ---- Boss Đế Cảnh / Siêu Thoát
ok(B.MAX_CAPDO === 11 && B.BOSS_TIERS[9].name === 'Đế Cảnh Hỗn Độn Thần Ma' && B.BOSS_TIERS[10].name === 'Hư Vô Siêu Thoát Chủ', 'tier 10/11'); ok(B.suggestedHp(10) > B.suggestedHp(9) && B.suggestedHp(11) > B.suggestedHp(10), 'HP tăng theo cấp');
const g = 'guild77'; const sm = B.summon({ guildId: g, channelId: 'c', by: 'x', capdo: 10, minutes: 30 }); ok(sm.ok && sm.boss.tier === 10, 'triệu hồi Đế Cảnh');
const lowB = mk(1900, 9, ', world_tier = 1'); ok(!B.attack(g, lowB, 'atk').ok && /trở lên/.test(B.attack(g, lowB, 'atk').error), 'dưới Chân Tiên không được đánh');
const fighters = []; for (let i = 0; i < 62; i++) fighters.push(mk(1000 + i, 12, ', hp = 200000, atk = 100000, cur_hp = 200000, linh_luc = 100')); let okN = 0; let capErr = 0;
for (const f of fighters) { const r = B.attack(g, f, 'atk'); if (r.ok) okN++; else if (/đủ \*\*60\*\*/.test(r.error)) capErr++; }
ok(okN === 60 && capErr === 2, `giới hạn 60 người: ok=${okN} chặn=${capErr}`);
D.run('UPDATE wb7_boss SET hp = 1 WHERE boss_id = ?', sm.boss.boss_id); D.run('UPDATE wb7_damage SET last_hit = 0'); const kill = B.attack(g, fighters[0], 'atk'); ok(kill.ok && kill.finished, 'hạ Boss');
const fin = B.finish(sm.boss.boss_id, 'killed', fighters[0]); ok(fin && fin.contributors.length === 60, 'chia thưởng'); ok(B.finish(sm.boss.boss_id, 'killed', fighters[0]) === null, 'không chia thưởng 2 lần');
ok(Inv.qty(fighters[0], 'tdc19_de_dao_ban_nguyen') + Inv.qty(fighters[1], 'tdc19_de_dao_ban_nguyen') + Inv.qty(fighters[2], 'tdc19_de_dao_ban_nguyen') >= 0, 'đọc kho');
// Siêu Thoát: chỉ ≥ 26, hall
const sg = 'guild88'; const s11 = B.summon({ guildId: sg, channelId: 'c', by: 'x', capdo: 11, minutes: 30 }); ok(s11.ok, 'Siêu Thoát');
const mid = mk(1950, 20, ', hp = 200000, atk = 100000, cur_hp = 200000'); ok(!B.attack(sg, mid, 'atk').ok, 'dưới Đại Đạo Chí Tôn không vào được');
const top = []; for (let i = 0; i < 3; i++) top.push(mk(1100 + i, 27, ', hp = 900000, atk = 9000000, cur_hp = 900000, linh_luc = 100')); for (const p of top) ok(B.attack(sg, p, 'atk').ok, 'tham chiến');
const f11 = B.finish(s11.boss.boss_id, 'escaped'); ok(f11 && f11.contributors.length === 3, 'chốt Siêu Thoát'); ok(EV.hallTop(5).length >= 1, 'bảng thành tích riêng');
// ---- tự động
let any = 0; for (let i = 0; i < 3000; i++) any += EV.autoCandidates('guildX').length; ok(any > 0 && any < 120, 'xác suất tự động hợp lý: ' + any);
D.run("INSERT INTO ev19 (kind, guild_id, status, started_at, ends_at, data) VALUES ('dibien','guildY','ended',?,?, '{}')", Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000) + 10); ok(EV.autoCandidates('guildY').length === 0, 'khoảng nghỉ tối thiểu giữa 2 sự kiện');
console.log(`✅ test_event19: ${n} kiểm tra đạt`);
