'use strict';
// V22.4.3 — Thần Giới chưa mở (chặn Phi Thăng + tự hạ) và Lôi Kiếp Chứng Đạo nặng hơn.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_tg243_${Date.now()}.db`);
const assert = require('node:assert'); const fs = require('node:fs'); const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const A = require('../src/game/ascension'); const R = require('../src/game/realm'); const ST = require('../src/game/settings'); const TG = require('../src/game/thanGioi');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const mk = (id, wt, title = '') => { Cu.createCultivator(id); D.run('UPDATE cultivators SET realm_index = 13, stage_index = 3, world_tier = ?, title = ?, tu_vi = 5000, linh_thach = 99999999999 WHERE user_id = ?', wt, title, id); };
ok(R.maxWorldTier() === 2 && !R.thanGioiOpen(), 'mặc định Thần Giới đóng (tối đa Tiên Giới)');
// 1. hạ khi khởi động
mk(9301, 3, 'Tiên Phong Thần Giới'); mk(9302, 4, 'Danh Hiệu Khác'); mk(9303, 2, 'Người Phi Thăng Tiên Giới Thứ 1'); mk(9304, 1);
const before = D.get('SELECT tu_vi, realm_index, linh_thach FROM cultivators WHERE user_id = 9301');
const m = TG.run();
ok(m.moved === 2 && m.backup && fs.existsSync(m.backup), `hạ 2 người, có sao lưu (${m.backup})`);
const g = (id) => D.get('SELECT * FROM cultivators WHERE user_id = ?', id);
ok(g(9301).world_tier === 2 && g(9302).world_tier === 2, 'người ở Thần Giới/Hồng Mông → Tiên Giới');
ok(g(9301).title === '' && g(9302).title === 'Danh Hiệu Khác' && g(9303).title.includes('Tiên Giới'), 'chỉ gỡ danh hiệu "Thần Giới"');
ok(g(9303).world_tier === 2 && g(9304).world_tier === 1, 'người khác giữ nguyên');
const a = g(9301); ok(a.tu_vi === before.tu_vi && a.realm_index === before.realm_index && a.linh_thach === before.linh_thach, 'tu vi/cảnh giới/linh thạch giữ nguyên');
const fl = JSON.parse(D.get('SELECT value FROM bot_flags WHERE key = ?', TG.FLAG).value); ok(fl.length === 2 && fl.some((x) => x.id === '9301' && x.tier === 3), 'lưu danh sách để khôi phục');
ok(TG.run().moved === 0, 'chạy lại không làm gì');
// 2. bảo hiểm: lọt qua giữa 2 lần khởi động → getCultivator tự hạ
D.run('UPDATE cultivators SET world_tier = 3, title = ? WHERE user_id = 9303', 'Người Phi Thăng Thần Giới Thứ 2');
const r3 = Cu.getCultivator(9303); ok(r3.world_tier === 2 && r3.title === '', 'getCultivator tự hạ về Tiên Giới');
// 3. không thể Phi Thăng lên Thần Giới
D.run("UPDATE cultivators SET realm_index = 19, stage_index = 3, world_tier = 2, vuot_thienkiep = 1, linh_luc = 100, tien_lenh = 5, tien_phu = 500, linh_thach = 99999999999999 WHERE user_id = 9303");
const p = A.doPhithang(9303, 1); ok(/Thần Giới chưa mở/.test(p), `phi thăng bị chặn: ${p.slice(0, 60)}`);
ok(Cu.getCultivator(9303).world_tier === 2 && Cu.getCultivator(9303).tien_lenh === 5, 'không mất Tiên Lệnh/Linh Thạch, vẫn Tiên Giới');
ok(/Thần Giới chưa mở/.test(A.doVuotthienkiep(9303)) && /Thần Giới chưa mở/.test(A.doDanhPhithangSugia(9303)), 'Thiên Kiếp / Sứ Giả Tiên Giới cũng bị chặn');
// 4. Phi Thăng Linh Giới → Tiên Giới (tier 0/1) KHÔNG bị ảnh hưởng
ok(!/Thần Giới chưa mở/.test(A.doPhithang(9304, 1)), 'Linh Giới → Tiên Giới vẫn xử lý bình thường (không dính chặn)');
// 5. công tắc mở lại
ST.set('thangioi', 'on'); ok(R.maxWorldTier() === 5, 'thangioi=on → mở lại'); D.run('UPDATE cultivators SET world_tier = 3 WHERE user_id = 9301'); ok(Cu.getCultivator(9301).world_tier === 3, 'khi mở, không tự hạ'); ST.set('thangioi', 'off');
ok(Cu.getCultivator(9301).world_tier === 2, 'đóng lại → hạ lại');
// 6. Lôi Kiếp nặng hơn
const CD = require('../src/game/chungdao19');
ok(CD.CFG.K >= 1.5 && CD.CFG.MIN_TAKE >= 0.4 && CD.CFG.CRIT_P > 0, 'CFG Lôi Kiếp mới');
const k0 = { uid: '1', step: 12, maxHp: 1e6, hp: 1e6, ll: 100, shield: 0, atk: 100, def: 100, dr: 0.3, kiepRes: 0.5, eq: [], binh: null, hasGear: 0, danUsed: 3, cd: { dan: 0, bao: 0, cp: 0, sk: 0 }, surv: 0, log: [] };
const pv = CD.loiPreview(k0, 12); ok(pv.eff >= 0.45 * pv.base * 0.99, `đạo 12 tối thiểu ≥47% uy lực dù giảm tối đa (eff ${pv.eff} / base ${pv.base})`);
ok(pv.base >= 0.32 * 1.5 * 1e6, 'đạo 12 ≥ 48% sinh mệnh tối đa (chưa giảm)');
const sum = CD.LOI.reduce((s2, l) => s2 + l.pct * CD.CFG.K, 0); ok(sum > 3.0, `tổng 12 đạo = ${(sum * 100).toFixed(0)}% sinh mệnh (cũ 214%)`);
const old = 1.25 * 1.71; ok(sum > old * 1.3, 'nặng hơn bản cũ ≥30%');
const sv = Object.assign({}, CD.CFG); CD.CFG.CRIT_P = 1; const k1 = { ...k0, step: 3, hp: 5e6, maxHp: 5e6, log: [], cd: { ...k0.cd } }; const o = CD.strike(k1, 'none'); ok(/CHÍ MẠNG/.test(o.lines.join('\n')), 'chí mạng được ghi log'); Object.assign(CD.CFG, sv);
CD.CFG.CRIT_P = 0; const d1 = (() => { const k = { ...k0, step: 12, hp: 9e9, maxHp: 9e9, log: [], cd: { ...k0.cd } }; return 9e9 - (CD.strike(k, 'none'), k.hp); })(); ok(d1 > 0, 'đạo 12 gây sát thương'); Object.assign(CD.CFG, sv);
console.log(`PASS test_thangioi243: ${n} checks`);
