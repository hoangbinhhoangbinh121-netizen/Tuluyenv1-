'use strict';
// V16.4 — nút Nâng Tối Đa / +10 cấp (tự dừng khi hết tiền), hiệu ứng Lực Chiến, đà tăng trưởng cấp cao.
const os = require('node:os'); const path = require('node:path'); const assert = require('node:assert');
process.env.TULUYEN_DB_PATH = path.join(os.tmpdir(), `tg_um164_${Date.now()}.db`);
const D = require('../src/db'); D.initDb();
const K = require('../src/game/constants'); const Cu = require('../src/game/cultivator'); const CP = require('../src/game/congphap');
const C16 = require('../src/game/congphapV16'); const D16 = require('../src/data/congphap_v16'); const CPX = require('../src/game/cpfx');
const V = require('../src/ui/congphapViews'); const { routeComponent } = (() => { try { return require('../src/ui/router'); } catch (e) { return {}; } })();
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
let seq = 9100; const mk = (f = {}) => { const id = String(++seq); Cu.createCultivator(id); Cu.updateCultivator(id, { realm_index: 9, world_tier: 2, ...f }); return id; };
const lvl = (u, t) => Cu.congphapLevelsMap(Cu.getCultivator(u))[t] || 0;

// 1) Hết tiền thì dừng đúng cấp — Nhân Giới (Linh Thạch)
let u = mk({ linh_thach: 1e12 }); C16.grantDirect(u, 1008);
const b = D16.BY_TIER.get(1008); const budget = C16.upgradeTotal(b, 0) * 0.2;
Cu.updateCultivator(u, { linh_thach: Math.floor(budget) });
const plan = C16.planUpgrade(Cu.getCultivator(u), 1008);
ok(plan.levels > 5 && plan.levels < 100 && plan.stop === 'money', `plan dừng vì hết tiền (${plan.levels})`);
const before = Cu.getCultivator(u).linh_thach; const msg = C16.upgradeMany(u, 1008);
ok(lvl(u, 1008) === plan.levels, `nâng đúng ${plan.levels} cấp, thực tế ${lvl(u, 1008)}`);
const after = Cu.getCultivator(u).linh_thach; ok(before - after === plan.spent.linh_thach, 'tiền trừ đúng bằng dự tính'); ok(after >= 0, 'không âm tiền');
ok(/hết .*Linh Thạch/.test(msg) && /Dừng ở \*\*Cấp/.test(msg), 'báo dừng vì hết tiền'); ok(msg.includes('Lực chiến'), 'có lực chiến');
const nx = C16.nextUpgrade(Cu.getCultivator(u), 1008); ok(nx && after < nx[0], 'tiền còn lại < giá cấp kế');
ok(/Không đủ/.test(C16.upgradeMany(u, 1008)), 'bấm tiếp khi hết tiền → báo thiếu, không đổi cấp'); ok(lvl(u, 1008) === plan.levels, 'cấp không đổi');
// 2) Có thêm tiền → bấm tiếp, nhanh hơn nâng tay (1 lần = N cấp) và kết quả GIỐNG HỆT nâng tay từng cấp
const ua = mk({ linh_thach: 5e8 }); const ub = mk({ linh_thach: 5e8 }); C16.grantDirect(ua, 1008); C16.grantDirect(ub, 1008);
C16.upgradeMany(ua, 1008, 37); for (let k = 0; k < 37; k += 1) C16.upgrade(ub, 1008);
ok(lvl(ua, 1008) === 37 && lvl(ub, 1008) === 37, 'đúng 37 cấp'); ok(Cu.getCultivator(ua).linh_thach === Cu.getCultivator(ub).linh_thach, 'chi phí = nâng tay');
// 3) Đạt cấp tối đa thì tự dừng
const uc = mk({ linh_thach: 1e13, linh_tinh: 1e9 }); C16.grantDirect(uc, 1008); const mc = C16.upgradeMany(uc, 1008);
ok(lvl(uc, 1008) === 100 && /cấp tối đa/.test(mc), 'dừng ở cấp 100'); ok(/tối đa/.test(C16.upgradeMany(uc, 1008)), 'đã max → báo');
// 4) Linh Tinh (Tiên Giới) và công pháp CŨ cũng dùng được
const ud = mk({ linh_tinh: 3000, linh_thach: 0 }); C16.grantDirect(ud, 1021); const pl = C16.planUpgrade(Cu.getCultivator(ud), 1021);
C16.upgradeMany(ud, 1021); ok(lvl(ud, 1021) === pl.levels && pl.levels > 0, 'Linh Tinh');
const ue = mk({ linh_thach: 3e9, linh_tinh: 400, realm_index: 9 }); Cu.updateCultivator(ue, { cong_phap_owned: '1' });
const pe = C16.planUpgrade(Cu.getCultivator(ue), 1); const me = C16.upgradeMany(ue, 1);
ok(lvl(ue, 1) === pe.levels && pe.levels > 3, `công pháp cũ Tầng 1 nâng nhanh ${pe.levels} cấp`); ok(me.includes('[Tầng 1]'), 'tên cũ');
ok(/chưa sở hữu/.test(C16.upgradeMany(ue, 1008)), 'chưa sở hữu → từ chối');
// 5) Bảo vệ số dư: giá đổi giữa chừng (expect sai) → không nâng
const uf = mk({ linh_thach: 1e9 }); C16.grantDirect(uf, 1008); const mf = C16.upgradeMany(uf, 1008, Infinity, [1, 'linh_thach']);
ok(lvl(uf, 1008) === 0 && /đã thay đổi|giá/i.test(mf), 'expect sai bị chặn: ' + mf.split('\n')[0]);
// 6) Lực chiến: quyển mới cộng % lực chiến, đúng 1 lần, tháo là hết
const ug = mk({ linh_thach: 1e9 }); const L0 = Cu.calcLucChien(Cu.getCultivator(ug)); C16.grantDirect(ug, 1040); C16.setEquipped(ug, [1040]);
const L1 = Cu.calcLucChien(Cu.getCultivator(ug)); ok(L1 > L0 * 2, `lực chiến tăng mạnh ${L0}→${L1}`);
const r1 = Cu.getCultivator(ug); const base = Cu.effectiveAtk(r1) * 3 + Cu.effectiveDef(r1) * 2 + Cu.effectiveSpd(r1) * 1.5 + Cu.effectiveMaxHp(r1) * 0.5 + r1.tu_vi * 0.01;
ok(Math.abs(L1 - Math.floor(base * (1 + CPX.lucBonus(r1)))) <= 1, 'lực chiến = chỉ số × (1 + luc) — đúng 1 lần');
C16.setEquipped(ug, []); ok(Cu.calcLucChien(Cu.getCultivator(ug)) === L0, 'tháo → lực chiến về như cũ');
for (const x of D16.BOOKS) ok(x.fx.luc > 0, `quyển ${x.tier} có Lực Chiến`);
// 7) Đà tăng trưởng cấp cao + trần
ok(Math.abs(CPX.fxAt(D16.BY_TIER.get(1040), 100).atk / CPX.fxAt(D16.BY_TIER.get(1040), 0).atk - (1 + D16.LEVEL_FX_GROWTH * 100)) < 1e-9 && D16.LEVEL_FX_GROWTH >= 0.018, 'tầng cao ×2,8');
// 8) UI: nút Nâng Tối Đa / +10 xuất hiện, có thể bấm, và bấm qua router
const ui = V.render(ug, { m: 'dt', t: 1008, r: 'ov', g: 'all', c: 'all', p: 0 });
const uh = mk({ linh_thach: 2e7 }); C16.grantDirect(uh, 1008);
const sc = V.render(uh, { m: 'dt', t: 1008, r: 'ov', g: 'all', c: 'all', p: 0 }); const btns = sc.components.flatMap((r) => r.components || r.toJSON?.().components || []);
const labels = btns.map((q) => (q.data ? q.data.label : q.label)); ok(labels.some((l) => /Tối Đa/.test(l || '')) && labels.some((l) => /\+\d+ cấp/.test(l || '')), 'có nút Nâng Tối Đa & +N cấp: ' + labels.join(' | '));
ok(sc.components.length <= 5 && labels.every((l) => !l || l.length <= 80), 'giới hạn Discord');
console.log(`✅ test_upgrade_many_v16_4 OK (${n} kiểm tra)`);
// 9) Thông báo + màn hình chi tiết sau khi nâng tối đa của MỌI quyển vẫn trong giới hạn Discord (embed ≤ 6000, description ≤ 4096, field ≤ 1024)
{
  let worst = 0;
  for (const bk of D16.BOOKS) {
    const w = mk({ linh_thach: 1e13, linh_tinh: 1e9 }); C16.grantDirect(w, bk.tier); C16.setEquipped(w, [bk.tier]);
    const m = C16.upgradeMany(w, bk.tier); const out = V.render(w, { m: 'dt', t: bk.tier, r: 'ov', g: 'all', c: 'all', p: 0 }, m);
    const e = (out.embeds[0].toJSON ? out.embeds[0].toJSON() : out.embeds[0]);
    const total = (e.title || '').length + (e.description || '').length + (e.footer ? e.footer.text.length : 0) + (e.fields || []).reduce((s, f) => s + f.name.length + f.value.length, 0);
    worst = Math.max(worst, total);
    ok((e.description || '').length <= 4096 && total <= 6000 && (e.fields || []).every((f) => f.value.length <= 1024), `${bk.tier} sau Nâng Tối Đa vượt giới hạn (${total})`);
  }
  console.log(`   embed lớn nhất sau Nâng Tối Đa: ${worst}/6000 ký tự`);
  console.log(`✅ test_upgrade_many_v16_4 (phần giới hạn) OK (${n} kiểm tra)`);
}
