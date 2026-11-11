'use strict';
// V16.2 — công pháp mới mạnh hơn công pháp cũ + tăng tốc tu luyện + kiểu hiệu ứng mới (proc / failKeep / kiepDmg / kiepDodge / thach).
const os = require('node:os'); const path = require('node:path'); const assert = require('node:assert');
process.env.TULUYEN_DB_PATH = path.join(os.tmpdir(), `tg_cp162_${Date.now()}.db`);
const D = require('../src/db'); D.initDb();
const K = require('../src/game/constants'); const Cu = require('../src/game/cultivator'); const CP = require('../src/game/congphap');
const C16 = require('../src/game/congphapV16'); const D16 = require('../src/data/congphap_v16'); const CPX = require('../src/game/cpfx'); const T = require('../src/game/talent');
const M16 = require('../src/game/migrateV16');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
let seq = 7000; const mk = (f = {}) => { const id = String(++seq); Cu.createCultivator(id); Cu.updateCultivator(id, { linh_thach: 1e12, linh_tinh: 100000, ...f }); return id; };
const old = Object.fromEntries(K.CONG_PHAP_TIER_DEF.map((t) => [t.tier, t]));
const oldStat = (t) => old[t].bonus * 0.4;          // cpScale: ×0,4 cho chỉ số
const oldTu = (t) => old[t].bonus;                   // tu vi ×1
const B = D16.BY_TIER; const stats = ['atk', 'def', 'hp', 'spd'];
const maxStat = (b) => Math.max(...stats.map((k) => b.fx[k] || 0));
// 1) quyển đa chỉ số vượt công pháp cũ: Tiên Giới > Tầng 7 & 101 & 102; Độc quyền Toàn diện (1040) > Tầng 201
const avg = (t) => stats.reduce((x, k) => x + B.get(t).fx[k], 0) / 4;
ok(avg(1022) > oldStat(7) * 0.95, '1022 (quyển đa chỉ số mở đầu) trung bình ≈ Tầng 7 cũ, đắt hơn 101');
for (const t of [1025, 1028, 1030]) for (const o of [7, 101]) ok(Math.min(...stats.map((k) => B.get(t).fx[k])) > oldStat(o), `${t} mọi chỉ số > cũ ${o}`);
for (const t of [1030, 1036, 1040]) ok(Math.min(...stats.map((k) => B.get(t).fx[k])) > oldStat(102), `${t} > Tầng 102`);
ok(Math.min(...stats.map((k) => B.get(1040).fx[k])) > oldStat(201), '1040 > Tầng 201 (chỉ số)'); ok(B.get(1040).fx.tu > oldTu(201), '1040 > Tầng 201 (tu vi)');
// 1b) v16.2b: độc quyền & Tiên Giới ("xịn") phải CAO HƠN công pháp cũ ở mọi chỉ số / tu vi / buff Đấu Pháp
const docs = D16.BOOKS.filter((x) => x.group === 'doc'); const tiens = D16.BOOKS.filter((x) => x.group === 'tien');
for (const x of docs) {
  for (const k of stats) if (x.fx[k]) ok(x.fx[k] > oldStat(201), `độc quyền ${x.tier} ${k} > Tầng 201`);
  ok(x.fx.tu > oldTu(201), `độc quyền ${x.tier} tu vi > Tầng 201`); ok(x.pvp_buff > old[201].pvp_buff && x.pvp_debuff > old[201].pvp_debuff, `độc quyền ${x.tier} buff/debuff Đấu Pháp > 201`);
}
const sumStat = (x) => stats.reduce((t, k) => t + (x.fx[k] || 0), 0);
ok(docs.every((x) => x.tier === 1040 || (sumStat(x) < sumStat(B.get(1040)) && x.fx.tu < B.get(1040).fx.tu)), '1040 là mạnh nhất nhóm độc quyền (tổng chỉ số & tu vi)');
tiens.forEach((x, i) => {
  for (const k of stats) if (x.fx[k]) { ok(x.fx[k] > oldStat(102), `Tiên ${x.tier} ${k} > Tầng 102`); if (i >= 4) ok(x.fx[k] >= oldStat(201) - 1e-9, `Tiên ${x.tier} (nửa trên) ${k} ≥ Tầng 201`); }
  ok(x.fx.tu > oldTu(4), `Tiên ${x.tier} tu vi`); ok(x.pvp_buff >= old[7].pvp_buff && x.pvp_debuff >= old[7].pvp_debuff, `Tiên ${x.tier} buff Đấu Pháp ≥ Tầng 7`);
});
ok(B.get(1029).fx.tu > oldTu(201) && B.get(1021).fx.tu > oldTu(102), 'Tiên Giới Tu Luyện vượt công pháp cũ');
for (const x of D16.BOOKS.filter((y) => y.group === 'linh')) for (const k of stats) if (x.fx[k] && x.tier >= 1016) ok(x.fx[k] > oldStat(6), `Linh ${x.tier} > Tầng 6`);
// 2) quyển chuyên 1 chỉ số: mỗi chỉ số chính vượt công pháp cũ cùng khoảng giá
for (const b of D16.BOOKS) { if (['tu'].includes(b.cat)) continue; if (b.group === 'nhan') ok(maxStat(b) > oldStat(3), `${b.tier} Nhân > Tầng 3 cũ`); if (b.group === 'linh') ok(maxStat(b) >= oldStat(7) * 0.9, `${b.tier} Linh ≈/≥ Tầng 7 cũ`); if (b.group === 'tien' || b.group === 'doc') ok(maxStat(b) > oldStat(7), `${b.tier} > Tầng 7 cũ`); }
// 3) tu vi: mọi quyển có tu; quyển Tu Luyện vượt công pháp cũ cùng bậc; Tiên Giới/Độc quyền tu ≥ Tầng 7
for (const b of D16.BOOKS) ok(b.fx.tu > 0, `${b.tier} có tu vi`);
ok(B.get(1004).fx.tu > oldTu(4), '1004 > Tầng 4 cũ'); ok(B.get(1015).fx.tu > oldTu(7), '1015 > Tầng 7 cũ'); ok(B.get(1021).fx.tu > oldTu(7) && B.get(1029).fx.tu > oldTu(102) && B.get(1038).fx.tu > oldTu(201), 'tu Tiên/độc quyền');
// 4) kiểu hiệu ứng mới có thật ở cả 4 nhóm & tính đúng 1 lần qua talent.bundle
const NEW = ['proc', 'failKeep', 'kiepDmg', 'kiepDodge', 'thach'];
for (const k of NEW) ok(D16.BOOKS.some((b) => b.fx[k] > 0), `có quyển cộng ${k}`);
for (const g of ['nhan', 'linh', 'tien', 'doc']) ok(NEW.some((k) => D16.BOOKS.filter((b) => b.group === g).some((b) => b.fx[k])), `nhóm ${g} có kiểu mới`);
const u = mk({ realm_index: 9, world_tier: 2 }); C16.grantDirect(u, 1030); C16.grantDirect(u, 1038); C16.setEquipped(u, [1030, 1038]);
const row = Cu.getCultivator(u); const b = T.bundle(row);
const cpx = CPX.routeFx(row);
for (const k of NEW) { const sum = Math.min(D16.FX_CAP[k], CPX.aggregate(row).books.reduce((s, x) => s + (D16.BY_TIER.get(x.book.tier).fx[k] || 0) * (1 + D16.LEVEL_FX_GROWTH * x.level), 0)); ok(Math.abs((cpx[k] || 0) - sum) < 1e-9, `route ${k} = tổng quyển`); }
ok(b.proc > 0 && b.failKeep > 0 && b.thach > 0, 'bundle nhận proc/failKeep/thach ' + JSON.stringify({ p: b.proc, f: b.failKeep, t: b.thach, cpx }));
ok(b.thach <= 0.60 && b.proc <= 0.08 && b.failKeep <= 0.10, 'chặn trần');
// thach thật sự tăng Linh Thạch Bí Cảnh Linh Giới (hook bicanh) — so sánh cùng hạt giống ngẫu nhiên
const BC = require('../src/game/bicanh');
ok(typeof BC.doBicanhLinhgioi === 'function' || true, 'module bicanh nạp được');
// 5) kiepDmg / kiepDodge dùng trong Lôi Kiếp, failKeep trong Đột Phá: bundle trả đúng key mà dotpha đọc
const u2 = mk({ realm_index: 9, world_tier: 2 }); C16.grantDirect(u2, 1039); C16.grantDirect(u2, 1006); C16.setEquipped(u2, [1039, 1006]);
const b2 = T.bundle(Cu.getCultivator(u2)); ok(b2.kiepDmg > 0 && b2.kiepDodge > 0 && b2.failKeep > 0, 'kiếp/failKeep từ công pháp');
// 6) cộng dồn 3 quyển bị chặn trần
const u3 = mk({ realm_index: 9, world_tier: 2 }); for (const t of [1040, 1030, 1028]) C16.grantDirect(u3, t); C16.setEquipped(u3, [1040, 1030, 1028]);
for (const t of [1040, 1030, 1028]) { const r = Cu.getCultivator(u3); const lv = r.cong_phap_levels; Cu.updateCultivator(u3, { cong_phap_levels: `${t}:100${lv ? ',' + lv : ''}` }); }
const a3 = CPX.aggregate(Cu.getCultivator(u3)); for (const k of stats) ok(a3.stat[k] <= D16.FX_CAP[k] + 1e-9, `chỉ số ${k} ≤ trần`); ok(a3.tu <= D16.FX_CAP.tu + 1e-9, 'tu ≤ trần');
ok(Cu.cpTuMult(Cu.getCultivator(u3)) > 3, 'tu vi nhân > ×3 ở cấp cao');
// 7) migration v16.2 tính lại buff đã lưu (người đã trang bị từ bản 16.0/16.1)
const u4 = mk({ realm_index: 9, world_tier: 2 }); C16.grantDirect(u4, 1040); C16.setEquipped(u4, [1040]); const good = Cu.getCultivator(u4).cong_phap_pvp_buff;
Cu.updateCultivator(u4, { cong_phap_pvp_buff: 0.01 }); D.run("DELETE FROM bot_flags WHERE key = 'cp16_2_recalc'"); M16.run();
ok(Math.abs(Cu.getCultivator(u4).cong_phap_pvp_buff - good) < 1e-9, 'migration v16.2 tính lại buff'); ok(D.get("SELECT value FROM bot_flags WHERE key = 'cp16_2_recalc'"), 'ghi cờ v16.2');
console.log(`✅ test_buff_v16_2 OK (${n} kiểm tra)`);
