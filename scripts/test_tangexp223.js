'use strict';
// V22.3 — !tangexp: hệ số tu vi riêng cho 1 người / toàn server.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_te23_${Date.now()}.db`);
const assert = require('node:assert');
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const ST = require('../src/game/settings'); const PB = require('../src/game/playerBoost'); const A = require('../src/game/actionsBasic'); const TQ = require('../src/game/treoquan');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const near = (a, b, tol = 0.02) => Math.abs(a / b - 1) <= tol;
const mk = (id) => { const u = String(id); Cu.createCultivator(u); D.run('UPDATE cultivators SET realm_index = 5, stage_index = 1, last_tuluyen = 0, last_dongquan = 0, linh_luc = 100 WHERE user_id = ?', u); return u; };
const P = mk('200000000000000001'); const Q = mk('200000000000000002'); const row = (u) => Cu.getCultivator(u);

ok(PB.mult(P) === 1 && PB.enabled(), 'mặc định ×1, BẬT');
const base = A.tuluyenExpectedPerClick(P, row(P), { noProc: true }); const baseQ = A.tuluyenExpectedPerClick(Q, row(Q), { noProc: true });   // thiên phú mỗi người khác nhau ⇒ so với CHÍNH NỀN của người đó
let r = PB.set(P, 5, 0, 'adm'); ok(r.ok && r.mult === 5 && r.until === 0, 'đặt ×5 vĩnh viễn');
ok(near(A.tuluyenExpectedPerClick(P, row(P), { noProc: true }), base * 5, 1e-9), 'Tu Luyện của P ×5');
ok(near(A.tuluyenExpectedPerClick(Q, row(Q), { noProc: true }), baseQ, 1e-9), 'Q (người khác) KHÔNG đổi');
const rq = TQ.rateOf(Q, row(Q)).rate; ok(near(TQ.rateOf(P, row(P)).rate, base * 5 / require('../src/game/cooldowns').COOLDOWN_TULUYEN * require('../src/game/balance').B.TREO_EFFICIENCY, 1e-9) && near(rq, baseQ / require('../src/game/cooldowns').COOLDOWN_TULUYEN * require('../src/game/balance').B.TREO_EFFICIENCY, 1e-9), 'Bế Quan Treo: P ×5, Q không đổi');
// bấm thật nhiều lần (ngẫu nhiên): tổng tu vi P ≈ 5× Q
const exp5 = A.tuluyenExpectedPerClick(P, row(P));   // có cơ hội ×2
let gp = 0; for (let i = 0; i < 8; i++) { D.run('UPDATE cultivators SET last_tuluyen = 0, tu_vi = 0 WHERE user_id = ?', P); gp += A.tuluyenR(P).gained; }
ok(gp / (8 * exp5) > 0.6 && gp / (8 * exp5) < 1.4, `bấm Tu Luyện thật 8 lần: ${(gp / (8 * exp5)).toFixed(2)} × kỳ vọng boosted`);
const dq = (u, k) => { let s2 = 0; for (let i = 0; i < k; i++) { D.run('UPDATE cultivators SET last_dongquan = 0, tu_vi = 0 WHERE user_id = ?', u); s2 += A.dongquanR(u).gained; } return s2; };
const bBoost = dq(P, 40); PB.clear(P, 'adm'); const bPlain = dq(P, 40); ok(bBoost / bPlain > 4 && bBoost / bPlain < 6, `Bế Quan P: có/không boost = ${(bBoost / bPlain).toFixed(2)} (kỳ vọng ~5)`); PB.set(P, 5, 0, 'adm');

// ---- chồng với toàn server
ST.setSpeed(2, 0); ok(near(A.tuluyenExpectedPerClick(P, row(P), { noProc: true }), base * 10, 1e-9) && near(A.tuluyenExpectedPerClick(Q, row(Q), { noProc: true }), baseQ * 2, 1e-9), 'toàn server ×2 nhân chồng: P ×10, Q ×2'); ST.setSpeed(1, 0);

// ---- hết hạn / tắt / xoá / giới hạn
D.run("UPDATE player_exp_boost SET until = ? WHERE user_id = ?", Math.floor(Date.now() / 1000) - 5, P); PB._resetCache(); ok(PB.mult(P) === 1 && PB.list()[0].active === false, 'hết hạn ⇒ ×1');
r = PB.set(P, 3, 30, 'adm'); ok(r.until > Math.floor(Date.now() / 1000) + 1700 && PB.mult(P) === 3, 'đặt có thời hạn 30 phút');
PB.setEnabled(false); ok(PB.mult(P) === 1 && near(A.tuluyenExpectedPerClick(P, row(P), { noProc: true }), base, 1e-9), 'công tắc TẮT ⇒ ×1 (dữ liệu còn)'); ok(PB.list().length === 1, 'dữ liệu vẫn còn khi tắt');
PB.setEnabled(true); ok(PB.mult(P) === 3, 'BẬT lại ⇒ có hiệu lực ngay');
ok(!PB.set(P, 0, 0).ok && !PB.set(P, 101, 0).ok && !PB.set(P, 'abc', 0).ok && !PB.set('', 2, 0).ok, 'hệ số ngoài 0,1–100 / rác / thiếu người ⇒ từ chối');
ok(PB.set(P, 0.5, 0).ok && PB.mult(P) === 0.5, 'cho phép <1 (làm chậm)');
ok(PB.clear(P, 'adm').ok && PB.mult(P) === 1 && !PB.clear(P).ok, 'xoá; xoá lần 2 báo không có');
ok(D.all("SELECT * FROM admin_log17 WHERE action LIKE 'tangexp_%'").length >= 3, 'ghi nhật ký admin');

// ---- v22.4: hạ yêu cầu đột phá riêng
const R = require('../src/game/realm'); const DP = require('../src/game/dotpha');
const reqBase = R.tuViRequired(row(P).realm_index, row(P).stage_index, row(P).world_tier);
ok(R.tuViRequiredFor(row(P)) === reqBase && R.tuViRequiredFor(row(Q)) === reqBase, 'mặc định yêu cầu = tuViRequired');
let nr = PB.setNeed(P, 10, 0, 'adm'); ok(nr.ok && nr.div === 10, 'đặt chia 10');
ok(R.tuViRequiredFor(row(P)) === Math.ceil(reqBase / 10) && R.tuViRequiredFor(row(Q)) === reqBase, `P cần ${R.tuViRequiredFor(row(P))}, Q vẫn cần ${reqBase}`);
D.run('UPDATE cultivators SET tu_vi = ?, last_dotpha_fail = 0 WHERE user_id IN (?, ?)', Math.ceil(reqBase / 10), P, Q);
const mq = DP.doDotpha ? DP.doDotpha(Q) : ''; const mp = DP.doDotpha ? DP.doDotpha(P) : '';
ok(/Chưa đủ tu vi/.test(String(mq)), 'Q (bình thường) chưa đủ tu vi');
ok(!/Chưa đủ tu vi/.test(String(mp)), `P đủ điều kiện đột phá (kết quả: ${String(mp).slice(0, 60).replace(/\n/g, ' ')})`);
ok(R.tuViRequiredFor(row(P), 5, 1, 0) === Math.ceil(R.tuViRequired(5, 1, 0) / 10), 'dạng đủ tham số (realm/stage/tier)'); PB.setNeed(P, 10, 0, 'adm');
const rb = () => R.tuViRequired(row(P).realm_index, row(P).stage_index, row(P).world_tier);   // P có thể đã lên cảnh giới sau khi đột phá ở trên
D.run("UPDATE player_need_cut SET until = ? WHERE user_id = ?", Math.floor(Date.now() / 1000) - 5, P); PB._resetCache(); ok(R.tuViRequiredFor(row(P)) === rb(), 'hết hạn ⇒ yêu cầu bình thường');
PB.setNeed(P, 10, 0, 'adm'); PB.setEnabled(false); ok(R.tuViRequiredFor(row(P)) === rb() && PB.listNeed().length === 1, 'công tắc TẮT ⇒ bình thường, dữ liệu còn'); PB.setEnabled(true);
ok(!PB.setNeed(P, 0, 0).ok && !PB.setNeed(P, 5000, 0).ok && !PB.setNeed(P, 'x', 0).ok, 'số chia ngoài 0,1–1000 ⇒ từ chối');
ok(PB.setNeed(P, 0.5, 0).ok && R.tuViRequiredFor(row(P)) === rb() * 2, 'chia <1 ⇒ khó hơn');
ok(PB.clearNeed(P, 'adm').ok && R.tuViRequiredFor(row(P)) === rb() && !PB.clearNeed(P).ok, 'xoá');
// hiển thị: template dùng đúng yêu cầu của người đó
PB.setNeed(P, 10, 0, 'adm'); const tp = require('../src/ui/templates/cultivation'); const emb = JSON.stringify(Object.values(tp).filter((f) => typeof f === 'function').length);
ok(emb !== undefined, 'template cultivation nạp được');

// ---- lệnh
require('../src/commands/admin'); const cmd = require('../src/commands/framework').registry.get('tangexp');
ok(cmd && cmd.prefixOnly && cmd.anyAdmin, '!tangexp: prefix-only + admin');
(async () => {
  const run = async (a, b, c, d) => { const out = []; await cmd.run({ args: { a, b, c, d }, user: { id: '1' }, send: async (x) => out.push(String(x)) }); return out.join('\n'); };
  let o = await run(); ok(/Tăng tu vi riêng/.test(o) && /BẬT/.test(o) && /bình thường/.test(o), 'help');
  o = await run('dat', `<@${P}>`, '4', '60'); ok(/×\*\*4\*\*/.test(o) && PB.mult(P) === 4 && /chỉ người này/.test(o), 'dat @người 4 60');
  o = await run(`<@${Q}>`, '2.5'); ok(PB.mult(Q) === 2.5 && /vĩnh viễn/.test(o), 'viết tắt: !tangexp @người 2.5');
  o = await run('ds'); ok(o.includes(P) && o.includes(Q), 'ds');
  o = await run('all', '3', '10'); ok(ST.speedMult() === 3 && /TẤT CẢ/.test(o), 'all ×3 10 phút');
  o = await run('all', '1'); ok(ST.speedMult() === 1 && /bình thường/.test(o), 'all 1 = về bình thường');
  o = await run('tat'); ok(!PB.enabled() && PB.mult(P) === 1, 'tat'); o = await run('bat'); ok(PB.enabled() && PB.mult(P) === 4, 'bat');
  o = await run('xoa', `<@${P}>`); ok(PB.mult(P) === 1 && /bỏ hệ số/.test(o), 'xoa');
  o = await run('dat', `<@${P}>`); ok(/Cú pháp/.test(o), 'thiếu hệ số ⇒ hướng dẫn');
  o = await run('dat', `<@${P}>`, '999'); ok(/khoảng/.test(o), 'hệ số quá lớn ⇒ từ chối');
  o = await run('yeucau', `<@${P}>`, '10', '30'); ok(/1\/10/.test(o) && PB.needDiv(P) === 10 && /chỉ người này/.test(o), 'yeucau @người 10 30');
  o = await run('yeucau', `<@${Q}>`, '2'); ok(PB.needDiv(Q) === 2 && /vĩnh viễn/.test(o), 'yeucau không phút = vĩnh viễn');
  o = await run('ds'); ok(/hạ yêu cầu đột phá/.test(o) && /1\/10/.test(o) && /1\/2/.test(o), 'ds liệt kê yêu cầu đột phá');
  o = await run('yeucau', `<@${P}>`, 'x2', '15'); ok(/gấp 2 lần/.test(o) && PB.needDiv(P) === 0.5, 'yeucau x2 ⇒ cần gấp đôi');
  { const R2 = require('../src/game/realm'); const rr = Cu.getCultivator(P); ok(R2.tuViRequiredFor(rr) === R2.tuViRequired(rr.realm_index, rr.stage_index, rr.world_tier) * 2, 'yêu cầu thực tế = ×2'); }
  o = await run('yeucau', `<@${P}>`, 'x4'); ok(/gấp 4 lần/.test(o) && PB.needDiv(P) === 0.25, 'x4 ⇒ gấp bốn'); o = await run('ds'); ok(/gấp 4 lần/.test(o), 'ds hiển thị "gấp 4 lần"');
  o = await run('yeucau', `<@${P}>`, 'x0'); ok(/Cú pháp/.test(o), 'x0 ⇒ từ chối'); o = await run('yeucau', `<@${P}>`, 'x2000'); ok(/khoảng/.test(o), 'x2000 ⇒ ngoài khoảng, từ chối');
  o = await run('yeucau', `<@${P}>`); ok(/Cú pháp/.test(o), 'yeucau thiếu số ⇒ hướng dẫn');
  o = await run('yeucau', `<@${P}>`, '99999'); ok(/khoảng/.test(o), 'yeucau số quá lớn ⇒ từ chối');
  o = await run('yeucau', 'xoa', `<@${P}>`); ok(PB.needDiv(P) === 1 && /bình thường/.test(o), 'yeucau xoa');
  o = await run('yeucau', 'xoa', `<@${P}>`); ok(/không có giảm/.test(o), 'yeucau xoa lần 2 ⇒ báo');
  o = await run('linhtinh'); ok(/không hợp lệ/.test(o), 'hành động lạ');
  console.log(`✅ test_tangexp223: ${n} kiểm tra PASS`); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
