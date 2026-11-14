'use strict';
// V17 — migration: dữ liệu V16 nguyên vẹn (đối chiếu trước/sau), chạy 1 lần, backup tạo ra, rollback.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_mig_${Date.now()}.db`);
const fs = require('node:fs'); const assert = require('node:assert');
const D = require('../src/db'); D.initDb(); const Cu = require('../src/game/cultivator'); const M = require('../src/game/migrateV17'); const Inv = require('../src/game/invsvc');
for (let u = 1; u <= 20; u += 1) { Cu.createCultivator(u); D.run('UPDATE cultivators SET linh_thach = ?, nguyen_lieu = ?, dan_duoc = ?, dan_pha_gioi = ?, huyen_thiet = ?, atk = atk + ?, linh_duoc_dac_biet = ? WHERE user_id = ?', 1000 * u, 7 * u, 3 * u, u % 4, 5 * u, u, u % 6, u); }
const before = M.snapshot();
const r = M.run(); assert.ok(!r.skipped && r.ok, `migration lệch: ${JSON.stringify(r.diff)}`); assert.ok(r.backup && fs.existsSync(r.backup), 'thiếu file sao lưu');
const after = M.snapshot(); assert.deepStrictEqual(M.diff(before, after), [], 'dữ liệu V16 bị thay đổi');
assert.strictEqual(after.players, 20); assert.strictEqual(Inv.qty(5, 'nl_tap', 0), 35, 'Nguyên Liệu cũ phải đọc đúng qua Inventory Service');
assert.ok(M.run().skipped, 'phải chạy đúng 1 lần');
assert.ok(M.status().ok);
// V17 thêm dữ liệu → rollback thường KHÔNG đụng dữ liệu V17, rollback sâu thì xoá; cột cũ luôn nguyên
Inv.add(3, 'ld_thanh_linh_thao', 5); const lt = Cu.getCultivator(3).linh_thach;
M.rollback(); assert.ok(!M.status()); assert.strictEqual(Inv.qty(3, 'ld_thanh_linh_thao'), 5);
M.rollback({ dropV17Data: true }); assert.strictEqual(Inv.qty(3, 'ld_thanh_linh_thao'), 0); assert.strictEqual(Cu.getCultivator(3).linh_thach, lt); assert.strictEqual(Inv.qty(5, 'nl_tap', 0), 35);
assert.ok(M.run({ force: true }).ok);
console.log('✅ test_migrate_v17 OK');
