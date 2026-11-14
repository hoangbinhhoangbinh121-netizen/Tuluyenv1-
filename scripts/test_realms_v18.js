'use strict';
// V18 — 29 cảnh giới: dữ liệu, tiểu cảnh giới, đột phá liên tiếp, chặn ở Siêu Thoát Viên Mãn, công thức không tràn, emoji + fallback.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_realm18_${Date.now()}.db`);
const fs = require('node:fs'); const path = require('node:path'); const assert = require('node:assert');
const D = require('../src/db'); D.initDb();
const K = require('../src/game/constants'); const R = require('../src/game/realm'); const EM = require('../src/game/emoji'); const Cu = require('../src/game/cultivator'); const DP = require('../src/game/dotpha');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const NAMES = ['Phàm Nhân', 'Luyện Khí', 'Trúc Cơ', 'Kết Đan', 'Nguyên Anh', 'Hóa Thần', 'Luyện Hư', 'Hợp Thể', 'Đại Thừa', 'Độ Kiếp', 'Chân Tiên', 'Kim Tiên', 'Thái Ất Kim Tiên', 'Đại La Kim Tiên',
  'Chuẩn Tiên Vương', 'Tiên Vương', 'Chuẩn Tiên Tôn', 'Tiên Tôn', 'Chuẩn Tiên Đế', 'Tiên Đế', 'Chuẩn Tiên Tổ', 'Tiên Tổ', 'Chuẩn Đạo Tổ', 'Đạo Tổ', 'Chuẩn Thiên Đạo', 'Thiên Đạo', 'Đại Đạo Chí Tôn', 'Vô Thượng Chí Tôn', 'Siêu Thoát'];
// --- dữ liệu
ok(K.REALMS.length === 29 && K.MAX_REALM_IDX === 28, '29 cảnh giới');
NAMES.forEach((nm, i) => ok(K.REALMS[i].name === nm, `tên #${i} = ${K.REALMS[i].name} ≠ ${nm}`));
ok(new Set(K.REALMS.map((r) => r.name)).size === 29, 'trùng tên cảnh giới');
for (let i = 10; i <= 28; i++) { ok(K.totalStageCount(i) === 4, `#${i} phải đúng 4 tiểu cảnh giới`); assert.deepStrictEqual(K.REALMS[i].stages, ['Sơ Kỳ', 'Trung Kỳ', 'Hậu Kỳ', 'Viên Mãn']); }
ok(K.REALMS.slice(14).every((r) => r.stages.length === 4 && !r.stages.some((s) => /Tầng/.test(s))), 'không có "Tầng N" từ Đại La Kim Tiên trở lên');
ok(K.totalStageCount(0) === 1 && K.totalStageCount(1) === 20 && K.totalStageCount(6) === 23, 'cảnh giới thấp không đổi');
ok(K.TIEN_DE_REALM_IDX === 19 && K.OLD_TIENDE_REALM_IDX === 14, 'hằng Tiên Đế');
// --- nextStage: đi liên tiếp từ Phàm Nhân đến Siêu Thoát Viên Mãn, không nhảy cóc, rồi null
let cur = [0, 0]; let steps = 0; const seen = new Set();
while (true) {
  const key = cur.join('/'); ok(!seen.has(key), 'lặp vòng'); seen.add(key);
  const nx = R.nextStage(cur[0], cur[1]); if (nx === null) break;
  if (nx[0] === cur[0]) ok(nx[1] === cur[1] + 1, `nhảy tiểu cảnh giới ${cur} → ${nx}`);
  else { ok(nx[0] === cur[0] + 1 && nx[1] === 0, `qua đại cảnh giới ${cur} → ${nx}: phải về Sơ Kỳ/tầng 1`); ok(cur[1] === K.totalStageCount(cur[0]) - 1, 'chỉ qua đại cảnh giới khi đang Viên Mãn'); }
  cur = nx; steps += 1;
}
ok(cur[0] === 28 && cur[1] === 3, 'điểm cuối = Siêu Thoát Viên Mãn'); ok(R.nextStage(28, 3) === null, 'Siêu Thoát Viên Mãn không đột phá thêm');
ok(steps === K.REALMS.reduce((s, r) => s + K.totalStageCount(r.name ? K.REALMS.indexOf(r) : 0), 0) - 1, 'số bước = tổng số tiểu cảnh giới - 1');
ok(R.realmDisplay(28, 3, true) === 'Siêu Thoát · Viên Mãn' && R.realmDisplay(14, 0, true) === 'Chuẩn Tiên Vương · Sơ Kỳ' && R.realmDisplay(19, 3, true) === 'Tiên Đế · Viên Mãn', 'định dạng hiển thị');
ok(R.realmDisplay(19, 0).includes(' Tiên Đế · Sơ Kỳ'), 'có emoji trước tên'); 
// --- công thức: tăng đơn điệu, không tràn, <= trần, các cảnh giới thấp KHÔNG đổi so với v17.1 (giá trị tham chiếu tính tay)
for (const w of [0, 1, 2, 3, 4, 5]) {
  let prev = -1;
  for (let r = 1; r <= 28; r++) for (let s = 0; s < K.totalStageCount(r); s++) {
    const v = R.tuViRequired(r, s, w);
    ok(Number.isFinite(v) && v > 0 && v <= K.TU_VI_REQUIRED_CAP && Number.isSafeInteger(v), `tràn số r${r} s${s} w${w}: ${v}`);
    if (r >= 14 && s > 0 && !R.isMajorGate(r, s)) ok(v >= prev, `giảm dần r${r} s${s} w${w}: ${prev} → ${v}`);   // cảnh giới thấp có bảng riêng (v17), chỉ kiểm tra tăng đơn điệu cho cảnh giới mới
    prev = v;
  }
}
for (const [r, s, w] of [[1, 0, 0], [5, 7, 1], [9, 22, 1], [10, 0, 2], [13, 3, 2]]) { // cùng công thức v17.1: 100*3^r*(1+.4s)*50^w ... qua override nên so với tuViRequiredLegacy
  const base = R.tuViRequiredBase(r, s, w); ok(Number.isInteger(base) && base > 0, 'base'); }
// Đại La Kim Tiên trở xuống: công thức gốc ×3/bậc (không dùng nhánh mới)
ok(R.tuViRequiredBase(13, 0, 2) === Math.trunc(100 * 3 ** 13 * 50 ** 2), 'base idx13 giữ nguyên'); ok(R.realmSpeedMult(13) === 16 * 1.35 ** 4 || Math.abs(R.realmSpeedMult(13) - K.REALM_SPEED_MULT[9] * 1.35 ** 4) < 1e-6, 'speed idx13 giữ nguyên');
// Tiên Đế mới (19) = đúng mức Tiên Đế cũ (14 cũ) về tốc độ (không lạm phát linh thạch)
ok(Math.abs(R.realmSpeedMult(19) - K.REALM_SPEED_MULT[9] * 1.35 ** 5) < 1e-6, 'tốc độ Tiên Đế mới = Tiên Đế cũ');
ok(Math.abs(R.tuViRequiredBase(19, 0, 2) / R.tuViRequiredBase(13, 0, 2) - 3) < 0.01, 'mốc Tiên Đế mới ≈ ×3 Đại La (đúng 1 bậc cũ)');
ok(R.realmSpeedMult(28) < 200, `speed Siêu Thoát hợp lý: ${R.realmSpeedMult(28)}`);
// Cơ chế v17.1 vẫn còn: x7 từ Độ Kiếp Viên Mãn trở lên
ok(R.tienExpMult(9, 22) === 7 && R.tienExpMult(9, 21) === 1 && R.tienExpMult(28, 3) === 7 && R.tienExpMult(14, 0) === 7, 'x7 EXP Tiên');
// --- đột phá thật qua dotpha: đi liên tiếp từ Luyện Khí Tầng 1 tới Siêu Thoát Viên Mãn (ép may mắn), rồi bị chặn
Cu.createCultivator(901);
const origRand = Math.random; Math.random = () => 0.0001;
try {
  D.run('UPDATE cultivators SET realm_index = 1, stage_index = 0, world_tier = 4, ngo_tinh = 0 WHERE user_id = 901');
  let exp = [1, 0]; let guard = 0; const visited = [];
  while (guard++ < 400) {
    const row = Cu.getCultivator(901); const nx = R.nextStage(row.realm_index, row.stage_index);
    if (nx === null) break;
    Cu.updateCultivator(901, { tu_vi: R.tuViRequired(row.realm_index, row.stage_index, row.world_tier), cur_hp: 1e12, last_dotpha_fail: 0 });
    const out = DP.doDotpha(901); const after = Cu.getCultivator(901);
    ok(after.realm_index === nx[0] && after.stage_index === nx[1], `đột phá ${row.realm_index}/${row.stage_index} → ${after.realm_index}/${after.stage_index} (mong ${nx}): ${String(out).slice(0, 160)}`);
    visited.push(after.realm_index);
  }
  ok(guard < 400, 'vòng lặp đột phá không dừng');
  const fin = Cu.getCultivator(901); ok(fin.realm_index === 28 && fin.stage_index === 3, `phải tới Siêu Thoát Viên Mãn, đang ở ${fin.realm_index}/${fin.stage_index}`);
  ok(new Set(visited).size === 28, 'đi qua đủ 28 đại cảnh giới (1..28)');
  Cu.updateCultivator(901, { tu_vi: K.TU_VI_REQUIRED_CAP });
  const top = DP.doDotpha(901);
  ok(/cao nhất hiện tại/.test(top) && /Siêu Thoát/.test(top) && !/Tiên Đế/.test(top), `doDotpha ở đỉnh: ${top}`);
  const after = Cu.getCultivator(901); ok(after.realm_index === 28 && after.stage_index === 3 && after.tu_vi === K.TU_VI_REQUIRED_CAP, 'đỉnh: không đổi cảnh giới, không trừ tu vi');
  ok(Number.isSafeInteger(after.hp) && Number.isSafeInteger(after.atk) && after.hp > 0, `chỉ số ở đỉnh hợp lệ hp=${after.hp} atk=${after.atk}`);
} finally { Math.random = origRand; }
// --- emoji
for (let i = 0; i <= 28; i++) {
  const f = path.join(__dirname, '..', 'assets', 'emoji', `canhgioi_${i}.png`); ok(fs.existsSync(f), `thiếu ${f}`);
  const png = fs.readFileSync(f); ok(png.readUInt32BE(16) === 128 && png.readUInt32BE(20) === 128, `canhgioi_${i}.png phải 128x128`);
  ok(typeof EM.FALLBACK[`canhgioi_${i}`] === 'string' && EM.FALLBACK[`canhgioi_${i}`].length > 0, `thiếu fallback canhgioi_${i}`);
  ok(EM.realmEmoji(i) && EM.realmEmoji(i) !== '✦', `realmEmoji(${i})`);
}
const crc = (i) => require('node:crypto').createHash('md5').update(fs.readFileSync(path.join(__dirname, '..', 'assets', 'emoji', `canhgioi_${i}.png`))).digest('hex');
ok(new Set(Array.from({ length: 29 }, (_, i) => crc(i))).size === 29, 'có emoji cảnh giới trùng ảnh nhau');
ok(EM.realmEmoji(99) === EM.realmEmoji(28) && EM.realmEmoji(-3) === EM.realmEmoji(0) && EM.realmEmoji('x') === EM.realmEmoji(0), 'kẹp chỉ số emoji');
for (const k of ['so_ky', 'trung_ky', 'hau_ky', 'vien_man']) { ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'emoji', `${k}.png`)) && EM.FALLBACK[k], `emoji ${k}`); }
ok(EM.stageEmoji(19, 0) && EM.stageEmoji(19, 0) !== EM.stageEmoji(19, 3) && EM.stageEmoji(1, 5) === '' && EM.stageEmoji(0, 0) === '', 'stageEmoji');
ok(EM.remoteName('canhgioi_14') === 'tg7_canhgioi_14_v18' && EM.remoteName('canhgioi_13') === 'tg7_canhgioi_13' && EM.remoteName('canhgioi_14').length <= 32, 'tên emoji trên Discord');
// canhgioi_19 = tranh vương miện của Tiên Đế cũ (giữ nguyên)
ok(crc(19) === '5eeefd55934b6569f3811f427d4593f2', 'canhgioi_19 phải là vương miện Tiên Đế cũ'); ok(crc(14) !== crc(19), 'canhgioi_14 mới khác vương miện');
// cố định: realm cấp thấp (0–13) giữ nguyên ảnh? đã có trong git; kiểm tra tên file còn đủ
ok(Object.keys(EM.FALLBACK).filter((k) => /^canhgioi_\d+$/.test(k)).length >= 29, 'fallback đủ 29');
console.log(`✅ test_realms_v18 OK (${n} kiểm tra)`);
