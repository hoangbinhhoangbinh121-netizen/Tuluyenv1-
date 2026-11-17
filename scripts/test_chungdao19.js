'use strict';
// V19 — Chứng Đạo: chặn đột phá thường, điều kiện, tiêu hao, 12 đạo lôi có lưu trạng thái, thắng/thua, hoàn tài nguyên, khoá 24h, Đế Đạo/Đế Binh/Đế Hiệu, grandfather.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_cd19_${Date.now()}.db`);
const assert = require('node:assert');
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const CD = require('../src/game/chungdao19'); const FX = require('../src/game/fx19'); const Inv = require('../src/game/invsvc'); const DP = require('../src/game/dotpha'); const R = require('../src/game/realm');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const mk = (id, realm = 18, stage = 3, extra = '') => { Cu.createCultivator(id); D.run(`UPDATE cultivators SET realm_index = ?, stage_index = ?, world_tier = 2, thiennhanngusuy_passed = 1, tu_vi = ? ${extra} WHERE user_id = ?`, realm, stage, 9e15, String(id)); return String(id); };
const give = (u) => { for (const [id, q] of Object.entries(CD.REQ)) Inv.add(u, id, q, { why: 'test' }); };
// ---- dữ liệu spec
ok(CD.LOI.length === 12 && CD.LOI.map((l) => Math.round(l.pct * 100)).join() === '8,9,10,11,12,13,14,15,16,18,20,25', '12 đạo lôi đúng % P_HP');
ok(CD.LOI[11].name === 'Chung Cực Chứng Đạo Lôi' && CD.LOI[11].pierce === 0.25 && CD.LOI[0].pierce === 0, 'đạo 12 phá giáp 25%');
ok(CD.REQ.tdc19_de_dao_ban_nguyen === 100 && CD.REQ.tdc19_bat_hu_de_cot === 5 && CD.REQ.tdc19_tien_ton_dao_qua === 10 && CD.REQ.tdc19_de_dao_chung_nhan === 1, 'tài nguyên spec');
// ---- chặn đột phá thường
const a = mk(801); const txt = DP.doDotpha(a); ok(/Chứng Đạo/.test(txt) && /chungdao/.test(txt), 'dotpha bị chặn → /chungdao'); ok(Cu.getCultivator(a).realm_index === 18, 'không đổi cảnh giới');
// ---- điều kiện
ok(/Thiếu tài nguyên/.test(CD.whyCannot(Cu.getCultivator(a))), 'thiếu tài nguyên');
const low = mk(802, 15, 3); ok(/Chuẩn Tiên Tôn/.test(CD.whyCannot(Cu.getCultivator(low))), 'chưa đủ cảnh giới, không bỏ qua trung gian');
const early = mk(803, 18, 1); ok(/Viên Mãn/.test(CD.whyCannot(Cu.getCultivator(early))), 'phải Viên Mãn');
ok(!CD.begin(a).ok, 'begin thiếu đồ bị chặn'); ok(Inv.qty(a, 'tdc19_de_dao_ban_nguyen') === 0, 'không trừ khi thiếu');
// ---- thắng: nhân vật rất trâu
const w = mk(804, 18, 3, ', hp = 4000000000, def_ = 900000000, atk = 90000000, cur_hp = 4000000000'); give(w); Inv.add(w, 'tdc19_de_dao_ban_nguyen', 50, { why: 't' });
ok(CD.whyCannot(Cu.getCultivator(w)) === null, 'đủ điều kiện');
const b = CD.begin(w); ok(b.ok && b.k.step === 1, 'bắt đầu'); ok(Inv.qty(w, 'tdc19_de_dao_ban_nguyen') === 50 && Inv.qty(w, 'tdc19_de_dao_chung_nhan') === 0, 'trừ tài nguyên khi bắt đầu');
ok(CD.begin(w).resumed === true, 'begin lần 2 = tiếp tục, không trừ thêm'); ok(Inv.qty(w, 'tdc19_de_dao_ban_nguyen') === 50, 'không trừ lần 2');
Inv.add(w, 'dan_huyet_nguyen', 5, { q: 2, why: 't' });
let last; for (let i = 1; i <= 12; i++) { const st = CD.kiepOf(CD.stateRow(w)); ok(st && st.step === i, `lưu trạng thái đạo ${i}`); const pick = (a) => (!CD.canResp(st, a) ? a : null); const a = (st.hp / st.maxHp < 0.6 && pick('dan')) || pick('sk') || (st.ll >= 70 && pick('dok')) || 'none'; last = CD.respond(w, a); ok(last.ok, `đạo ${i}: ` + last.error); if (i < 12) ok(!last.ended, 'chưa kết thúc'); }
ok(last.ended === 'win' && last.result.win, 'qua 12 đạo → thành công');
const aw = Cu.getCultivator(w); ok(aw.realm_index === 19 && aw.stage_index === 0, 'Tiên Đế Sơ Kỳ'); ok(Inv.qty(w, 'tdc19_de_an') === 1, 'nhận Đế Ấn'); ok(CD.passed(w) && CD.stateRow(w).kiep === null, 'đã chứng đạo, hết kiếp');
ok(CD.historyOf(w).some((h) => h.kind === 'win'), 'ghi lịch sử'); ok(/đã \*\*Chứng Đạo/.test(CD.whyCannot(aw)), 'không chứng lại');
// ---- thua: HP thấp → gục, hoàn 50%, khoá 24h, mất 10–20% tu vi
const f = mk(805, 18, 3, ', hp = 3000, def_ = 5, atk = 400, cur_hp = 3000'); give(f); const tu0 = Cu.getCultivator(f).tu_vi;
ok(CD.begin(f).ok, 'begin f'); let r; for (let i = 0; i < 12; i++) { r = CD.respond(f, 'none'); if (r.ended) break; }
ok(r.ended === 'lose' && !r.result.win, 'thất bại'); const fa = Cu.getCultivator(f);
ok(fa.realm_index === 18 && fa.stage_index === 3, 'giữ Chuẩn Tiên Đế Viên Mãn'); const lostPct = 1 - fa.tu_vi / tu0; ok(lostPct >= 0.095 && lostPct <= 0.205, 'mất 10–20% tu vi: ' + lostPct);
ok(Inv.qty(f, 'tdc19_de_dao_ban_nguyen') === 50 && Inv.qty(f, 'tdc19_bat_hu_de_cot') === 2 && Inv.qty(f, 'tdc19_tien_ton_dao_qua') === 5 && Inv.qty(f, 'tdc19_de_dao_chung_nhan') === 0, 'hoàn 50% (trừ Chứng Nhận)');
const fs = CD.stateRow(f); ok(fs.fail_until - Math.floor(Date.now() / 1000) > 86000 && fs.injured_until > 0 && !CD.passed(f), 'khoá 24h + trọng thương'); ok(/Trọng Thương/.test(CD.whyCannot(fa)), 'thông báo khoá');
ok(CD.stateRow(f).kiep === null, 'kiếp đã đóng');
// ---- ứng phó: giới hạn, không spam đan
const g = mk(806, 18, 3, ', hp = 800000, def_ = 1000, atk = 5000, cur_hp = 800000'); give(g); Inv.add(g, 'dan_huyet_nguyen', 10, { q: 2, why: 't' });
ok(CD.begin(g).ok, 'begin g'); const r1 = CD.respond(g, 'dan'); ok(r1.ok, 'đan lần 1: ' + r1.error); const r2 = CD.respond(g, 'dan'); ok(!r2.ok && /hồi chiêu/.test(r2.error), 'đan liên tiếp bị chặn');
ok(!CD.respond(g, 'cp').ok, 'chưa có công pháp không dùng được'); ok(!CD.respond(g, 'bao').ok, 'chưa có trang bị không dùng được'); ok(CD.respond(g, 'sk').ok, 'kỹ năng dùng được'); ok(!CD.respond(g, 'sk').ok, 'kỹ năng có hồi chiêu');
ok(CD.respond(g, 'dok').ok, 'dốc toàn lực'); ok(CD.kiepOf(CD.stateRow(g)).ll <= 40, 'Linh Lực về ~0 + hồi'); ok(!CD.respond(g, 'xxx').ok, 'lựa chọn lạ');
let used = 0; for (let i = 0; i < 12; i++) { const rr = CD.respond(g, 'dan'); if (rr.ok) used++; if (rr.ended) break; const rn = CD.respond(g, 'none'); if (rn.ended) break; }
ok(used + 1 <= CD.DAN_MAX, 'tối đa 3 viên cả kiếp: ' + (used + 1));
// ---- quá hạn: tự thất bại
const t = mk(807, 18, 3, ', hp = 800000, def_ = 1000, atk = 5000'); give(t); CD.begin(t);
const ks = CD.kiepOf(CD.stateRow(t)); ks.expireAt = 1; D.run('UPDATE de19_state SET kiep = ? WHERE user_id = ?', JSON.stringify(ks), t);
const sw = CD.sweepIdle(t); ok(sw && sw.expired && !sw.result.win, 'kiếp treo quá hạn → thất bại'); ok(CD.stateRow(t).fail_until > 0, 'bị khoá');
const gu = mk(808, 18, 3, ', hp = 800000, def_ = 1000, atk = 5000'); give(gu); CD.begin(gu); ok(CD.giveUp(gu).ok && !CD.passed(gu), 'bỏ cuộc = thất bại');
// ---- grandfather: người đã ≥ Tiên Đế trước V19
const gf = mk(809, 21, 2); ok(CD.passed(gf), 'đã ≥ Tiên Đế → tính đã chứng đạo'); ok(CD.stateRow(gf).grand === 1, 'grand = 1');
// ---- Đế Đạo / Đế Binh / Đế Hiệu
const p = w; ok(!CD.chooseDao(f, 'satphat').ok, 'chưa chứng đạo không chọn Đế Đạo');
Cu.updateCultivator(p, { linh_thach: 1e13 }); const items = {}; const bag = (c) => { for (const [id, n2] of Object.entries(c.items)) items[id] = (items[id] || 0) + n2; };
const fill = (c) => { for (const [id, n2] of Object.entries(c.items)) Inv.add(p, id, n2, { why: 'test' }); };
fill(FX.daoCost(0)); ok(CD.chooseDao(p, 'satphat').ok, 'chọn Đế Đạo'); ok(!CD.chooseDao(p, 'satphat').ok, 'chọn trùng bị chặn');
const row0 = Cu.getCultivator(p); const atk0 = Cu.effectiveAtk(row0); FX.invalidate(p);
for (let lv = 1; lv < 5; lv++) { fill(FX.daoCost(lv)); ok(CD.upgradeDao(p).ok, 'nâng cấp Đế Đạo ' + lv); }
ok(CD.stateRow(p).de_dao_lv === 5, 'cấp 5'); fill(CD.awakenCost(0)); ok(CD.awakenDao(p).ok && CD.stateRow(p).de_dao_awake === 1, 'thức tỉnh 1'); ok(!CD.awakenDao(p).ok, 'thức tỉnh 2 cần cấp 10');
FX.invalidate(p); const fx = FX.get(Cu.getCultivator(p)); ok(fx.stat.atk > 0.12 && fx.stat.atk <= 2 && fx.route.crit > 0.05, 'Đế Đạo cho hiệu ứng thật');
ok(CD.stateRow(f).de_dao === null, 'người khác không bị ảnh hưởng'); ok(FX.get(Cu.getCultivator(f)) === FX.EMPTY || FX.get(Cu.getCultivator(f)).stat.atk === 0, 'chưa chứng đạo → không hiệu ứng');
ok(Object.keys(FX.DE_BINH).length === 5 && ['Vạn Cổ Đế Kiếm', 'Hỗn Độn Chung', 'Luân Hồi Thiên Bàn', 'Thiên Đạo Thần Ấn', 'Vĩnh Hằng Thần Tháp'].join() === Object.values(FX.DE_BINH).map((x) => x.name).join(), '5 Đế Binh theo spec');
fill(FX.DE_BINH.kiem.craft); ok(CD.craftBinh(p, 'kiem').ok, 'chế Đế Binh'); ok(!CD.craftBinh(p, 'kiem').ok, 'không chế trùng'); ok(CD.stateRow(p).binh_eq === 'kiem', 'tự trang bị');
FX.invalidate(p); const fx2 = FX.get(Cu.getCultivator(p)); ok(fx2.stat.atk > fx.stat.atk && fx2.route.pierce >= 0.08, 'Đế Binh cộng thật, không nhân đôi Đế Đạo');
fill(FX.binhUpCost(0)); ok(CD.upgradeBinh(p, 'kiem').ok && CD.binhOf(p).kiem === 1, 'nâng cấp Đế Binh'); ok(!CD.equipBinh(p, 'chung').ok, 'chưa sở hữu không trang bị');
for (const bad of ['a', 'x'.repeat(25), '@everyone ơi', 'Đế <@123>', 'http abc', '**x**']) ok(!CD.sanitizeHieu(bad).ok, 'Đế Hiệu xấu: ' + bad);
for (const good of ['Vĩnh Hằng Đế Quân', 'Hỗn Độn Đế Tôn', 'Vô Cực Tiên Đế']) ok(CD.sanitizeHieu(good).ok, good);
ok(CD.setHieu(p, '  Vĩnh   Hằng Đế Quân ').hieu === 'Vĩnh Hằng Đế Quân', 'chuẩn hoá khoảng trắng'); ok(FX.hieuOf(p) === 'Vĩnh Hằng Đế Quân' && FX.withHieu(p, 'An').includes('Vĩnh Hằng'), 'hiển thị Đế Hiệu'); ok(!CD.setHieu(f, 'Đế Quân Vô Địch').ok, 'chưa chứng đạo không đặt Đế Hiệu');
console.log(`✅ test_chungdao19: ${n} kiểm tra đạt`);
