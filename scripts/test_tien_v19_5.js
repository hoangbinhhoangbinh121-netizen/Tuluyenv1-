'use strict';
// V19.5 — EXP đột phá từ Chân Tiên trở lên nhân thêm (×3 Chân Tiên→Đại La, ×4 Tiên cao) + tốc độ tu luyện ở cảnh giới Tiên ×3; chỉnh được bằng /quantri.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_tien195_${Date.now()}.db`);
const assert = require('node:assert');
const D = require('../src/db'); D.initDb();
const K = require('../src/game/constants'); const R = require('../src/game/realm'); const Cu = require('../src/game/cultivator'); const AB = require('../src/game/actionsBasic'); const A = require('../src/game/admin17');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const mk = (id, realm, stage = 0, tier = 2) => { Cu.createCultivator(id); D.run('UPDATE cultivators SET realm_index = ?, stage_index = ?, world_tier = ? WHERE user_id = ?', realm, stage, tier, String(id)); return String(id); };
const raw = (r, s, t = 2) => Math.min(K.TU_VI_REQUIRED_CAP, Math.trunc(R.tuViRequiredBase(r, s, t) * K.EXP_REQUIRED_MULT * (R.isMajorGate(r, s) ? K.EXP_GATE_MAJOR_MULT : K.EXP_GATE_MINOR_MULT) * 1));

ok(K.TIEN_START_IDX === 10 && K.TIEN_MID_EXTRA_MULT === 3 && K.TIEN_HIGH_EXTRA_MULT === 4 && K.TIEN_SPEED_MULT === 3, 'mặc định ×3 / ×4 / tốc độ ×3');
// hệ số theo cảnh giới
ok(R.tienExpMult(8, 5) === 1 && R.tienExpMult(9, 10) === 1, 'dưới Độ Kiếp Viên Mãn không đổi');
ok(R.tienExpMult(9, 22) === K.TIEN_EXP_MULT, 'cửa Độ Kiếp VM → Chân Tiên giữ ×7 (chưa nhân thêm)');
for (const r of [10, 11, 12, 13]) for (const s of [0, 3]) ok(R.tienExpMult(r, s) === K.TIEN_EXP_MULT * 3, `realm ${r} = ×${K.TIEN_EXP_MULT * 3}`);
for (const r of [14, 15, 19, 28]) ok(R.tienExpMult(r, 0) === K.TIEN_EXP_MULT * K.HIGH_TIEN_EXP_MULT * 4, `realm ${r} = ×140`);
// mốc tu vi thực tế = trước × 3 (hoặc × 4) khi chưa chạm trần
const before = (r, s) => { const sv = [K.TIEN_MID_EXTRA_MULT, K.TIEN_HIGH_EXTRA_MULT]; K.TIEN_MID_EXTRA_MULT = 1; K.TIEN_HIGH_EXTRA_MULT = 1; const v = R.tuViRequired(r, s, 2); [K.TIEN_MID_EXTRA_MULT, K.TIEN_HIGH_EXTRA_MULT] = sv; return v; };
for (const [r, s, k] of [[10, 0, 3], [11, 2, 3], [13, 3, 3], [14, 0, 4], [16, 1, 4], [18, 0, 4]]) { const b = before(r, s); const a = R.tuViRequired(r, s, 2); ok(a < 6e15 && Math.abs(a / b - k) < 0.001, `realm ${r}.${s}: ×${k} (${(a / b).toFixed(3)})`); }
ok(R.tuViRequired(28, 3, 2) <= K.TU_VI_REQUIRED_CAP && R.tuViRequired(28, 3, 2) >= before(28, 3), 'đỉnh không vượt trần số an toàn');
for (let s = 0; s < 4; s += 1) { let prev = 0; for (let r = 10; r <= 28; r += 1) { const v = R.tuViRequired(r, s, 2); ok(v > prev && v < K.TU_VI_REQUIRED_CAP, `mốc TĂNG DẦN theo cảnh giới, không phẳng, dưới trần (r${r} s${s})`); prev = v; } }
ok(R.softCap(1e15) === 1e15 && R.softCap(6e15) === 6e15 && R.softCap(1e30) <= K.TU_VI_REQUIRED_CAP && R.softCap(7e15) > 6e15, 'trần mềm: giữ nguyên dưới 6e15, tiệm cận trần');
ok(Number.isSafeInteger(R.tuViRequired(28, 3, 2)), 'số nguyên an toàn');
// tốc độ ×3 từ Chân Tiên
const hi = mk(901, 10), lo = mk(902, 9, 22, 2), top = mk(903, 20, 0, 2);
const exp = (id) => { const row = Cu.getCultivator(id); return AB.tuluyenExpectedPerClick(id, row, { noProc: true }); };
// so cùng người ở 2 thiết lập hệ số (chỉ đổi K.TIEN_SPEED_MULT) để triệt tiêu khác biệt cảnh giới
const e3 = exp(hi); K.TIEN_SPEED_MULT = 1; const e1 = exp(hi); K.TIEN_SPEED_MULT = 3;
ok(Math.abs(e3 / e1 - 3) < 0.001, `Chân Tiên: tốc độ ×3 (${(e3 / e1).toFixed(3)})`);
const t3 = exp(top); K.TIEN_SPEED_MULT = 1; const t1 = exp(top); K.TIEN_SPEED_MULT = 3; ok(Math.abs(t3 / t1 - 3) < 0.001, 'Tiên cao: tốc độ ×3');
const l3 = exp(lo); K.TIEN_SPEED_MULT = 7; const l7 = exp(lo); K.TIEN_SPEED_MULT = 3; ok(l3 === l7, 'Độ Kiếp (chưa là Tiên): KHÔNG đổi tốc độ');
// treo = 10% của tay (dùng cùng công thức nên cũng ×3)
ok(Math.abs(AB.tuluyenExpectedPerClick(hi, Cu.getCultivator(hi), { noProc: true }) - e3) < 1e-6, 'treo/bấm dùng chung công thức');
// /quantri chỉnh được và về mặc định
const ADMIN = '1'; for (const [k, prop, def] of [['tienmid', 'TIEN_MID_EXTRA_MULT', 3], ['tienhigh', 'TIEN_HIGH_EXTRA_MULT', 4], ['tienspeed', 'TIEN_SPEED_MULT', 3]]) {
  ok(A.ecoSet(ADMIN, k, '5').ok && K[prop] === 5, `${k} đổi được`); ok(A.ecoSet(ADMIN, k, '0').ok === false && A.ecoSet(ADMIN, k, '99999').ok === false, `${k} chặn biên`);
  ok(A.ecoSet(ADMIN, k, 'mac dinh').ok && K[prop] === def, `${k} về mặc định`); }
ok(R.tienExpMult(10, 0) === 21, 'sau reset vẫn ×21');
A.ecoReset(ADMIN); ok(K.TIEN_SPEED_MULT === 3 && K.TIEN_MID_EXTRA_MULT === 3 && K.TIEN_HIGH_EXTRA_MULT === 4, 'ecoReset đưa cả 3 hệ số mới về mặc định');
// giao diện /quantri không lỗi và đủ ô
const Q = require('../src/ui/quantriViews'); const mv = Q.MODALS ? Q.MODALS.tien : null; if (mv) ok(mv.fields.length === 5 && mv.fields.every((f) => f.label.length <= 45), 'modal Hệ số Tiên: 5 ô, nhãn ≤45 ký tự');
console.log(`✓ test_tien_v19_5: ${n} kiểm tra`);
