'use strict';
// V18 — migration Tiên Đế cũ (14) → Tiên Đế mới (19, Viên Mãn): bảo toàn dữ liệu, sao lưu, chạy 1 lần, rollback, mất cờ, sao lưu hỏng thì HUỶ.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_mig18_${Date.now()}.db`);
const fs = require('node:fs'); const assert = require('node:assert');
const D = require('../src/db'); D.initDb(); const Cu = require('../src/game/cultivator'); const M = require('../src/game/migrateV18'); const K = require('../src/game/constants'); const R = require('../src/game/realm');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
// 30 người: 0..13 đủ mọi cảnh giới thấp, 5 người Tiên Đế CŨ (14, stage 0) với tu vi/chỉ số/linh thạch riêng
for (let u = 1; u <= 30; u += 1) Cu.createCultivator(u);
for (let u = 1; u <= 25; u += 1) D.run('UPDATE cultivators SET realm_index = ?, stage_index = ?, tu_vi = ?, linh_thach = ? WHERE user_id = ?', (u - 1) % 14, u % 3, 1000 * u, 77 * u, u);
const OLD = [26, 27, 28, 29, 30];
OLD.forEach((u, i) => D.run('UPDATE cultivators SET realm_index = 14, stage_index = 0, tu_vi = ?, linh_thach = ?, atk = ?, hp = ?, world_tier = 2 WHERE user_id = ?', 5e12 + i, 123456 + i, 9999 + i, 88888 + i, u));
const rowsBefore = D.all('SELECT * FROM cultivators ORDER BY user_id');
const lowBefore = rowsBefore.filter((r) => r.realm_index < 14);
ok(lowBefore.length === 25 && rowsBefore.filter((r) => r.realm_index === 14).length === 5, 'dữ liệu thử sai');
// --- 1) sao lưu hỏng → HUỶ, không đổi dữ liệu, không đặt cờ
const realBackup = M.backup; // backup nội bộ dùng D.db().exec VACUUM INTO; mô phỏng bằng thư mục không ghi được
const origExec = D.db().exec.bind(D.db());
D.db().exec = (sql) => { if (/VACUUM INTO/.test(sql)) throw new Error('đĩa đầy (giả lập)'); return origExec(sql); };
const bad = M.run(); D.db().exec = origExec;
ok(bad.aborted && !bad.ok && !M.status(), 'sao lưu hỏng phải HUỶ migration');
ok(D.all('SELECT * FROM cultivators WHERE realm_index = 14').length === 5, 'sao lưu hỏng mà vẫn đổi dữ liệu!');
// --- 2) chạy thật
const r = M.run(); ok(!r.skipped && r.ok && !r.aborted, `migration lỗi: ${JSON.stringify(r)}`);
ok(r.backup && fs.existsSync(r.backup) && fs.statSync(r.backup).size > 0, 'thiếu file sao lưu');
ok(r.moved === 5, 'phải chuyển đúng 5 người');
const rowsAfter = D.all('SELECT * FROM cultivators ORDER BY user_id');
ok(rowsAfter.length === 30, 'mất người chơi');
for (const b of rowsBefore) {
  const a = rowsAfter.find((x) => x.user_id === b.user_id);
  if (b.realm_index < 14) assert.deepStrictEqual(a, b, `cảnh giới thấp bị đổi: user ${b.user_id}`);
  else { ok(a.realm_index === 19 && a.stage_index === 3, `user ${b.user_id} chưa sang Tiên Đế Viên Mãn`); const x = { ...a, realm_index: 14, stage_index: 0 }; assert.deepStrictEqual(x, b, `cột khác bị đổi: user ${b.user_id}`); }
}
n += 25 + 5;
ok(R.realmDisplay(19, 3, true) === 'Tiên Đế · Viên Mãn', 'tên hiển thị sau migrate');
ok(Cu.getCultivator(26).tu_vi === 5e12 && Cu.getCultivator(26).realm_index === 19, 'getCultivator sau migrate');
// --- 3) chạy lặp: bị bỏ qua, người đã đột phá sau đó không bị kéo lùi
ok(M.run().skipped, 'phải chạy đúng 1 lần');
D.run('UPDATE cultivators SET realm_index = 20, stage_index = 0 WHERE user_id = 27'); ok(M.run().skipped, 'chạy lặp');
ok(Cu.getCultivator(27).realm_index === 20, 'chạy lặp làm lùi người đã đột phá');
// --- 4) mất cờ nhưng dữ liệu đã dạng mới → chỉ đặt lại cờ, không đổi dữ liệu
D.run('DELETE FROM bot_flags WHERE key = ?', M.FLAG);
const snap = D.all('SELECT * FROM cultivators ORDER BY user_id');
const again = M.run(); ok(again.assumed && again.moved === 0, 'mất cờ phải nhận ra dữ liệu đã chuyển'); assert.deepStrictEqual(D.all('SELECT * FROM cultivators ORDER BY user_id'), snap); n += 1;
// --- 5) rollback: người còn đứng ở 19/3 về 14/0, người đã đi tiếp báo 'stuck'
D.run('DELETE FROM bot_flags WHERE key = ?', M.FLAG);
D.run('UPDATE cultivators SET realm_index = 14, stage_index = 0 WHERE realm_index = 19 AND stage_index = 3'); // dựng lại trạng thái trước
D.run('UPDATE cultivators SET realm_index = 20 WHERE user_id = 27'); D.run('UPDATE cultivators SET realm_index = 14, stage_index = 0 WHERE user_id = 27'); // 27 về 14/0 như cũ
const r2 = M.run({ force: true }); ok(r2.ok && r2.moved >= 1, 'chạy lại force');
D.run('UPDATE cultivators SET realm_index = 21 WHERE user_id = 30');
const rb = M.rollback(); ok(rb.reverted === r2.moved - 1 && rb.stuck.includes(30), `rollback: ${JSON.stringify(rb)}`); ok(!M.status(), 'rollback phải gỡ cờ');
ok(Cu.getCultivator(26).realm_index === 14 && Cu.getCultivator(26).stage_index === 0, 'rollback đưa về 14/0');
// --- 6) DB mới tinh (không người chơi) vẫn chạy được & đặt cờ
process.env.TULUYEN_DB_PATH = ''; // (DB hiện tại vẫn dùng) kiểm tra DB rỗng bằng cách xoá hết người
D.run('DELETE FROM cultivators'); D.run('DELETE FROM bot_flags WHERE key = ?', M.FLAG);
const e = M.run(); ok(e.ok && e.moved === 0 && M.status().ok, 'DB rỗng');
console.log(`✅ test_migrate_v18 OK (${n} kiểm tra) — ${M.reportText()}`);
