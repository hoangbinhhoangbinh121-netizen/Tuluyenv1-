'use strict';
// V16.5 — mã đền bù DENBUMATDULIEU: đổi 1 lần/tài khoản, cộng đúng quà, không giới hạn lượt, không cần admin duyệt, nhập lại bị chặn.
const os = require('node:os'); const path = require('node:path'); const assert = require('node:assert');
process.env.TULUYEN_DB_PATH = path.join(os.tmpdir(), `tg_code165_${Date.now()}.db`);
const D = require('../src/db'); D.initDb(); const Cu = require('../src/game/cultivator'); const Inv = require('../src/game/inventory');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const c = Inv.CODES.DENBUMATDULIEU; ok(c && !c.requires_admin_approval && !c.booster_only && c.max_uses === null, 'định nghĩa mã');
Cu.createCultivator('501'); Cu.createCultivator('502');
const a0 = Cu.getCultivator('501'); const [msg, req] = Inv.redeemCode('501', null, ' denbumatdulieu ');
const a1 = Cu.getCultivator('501');
ok(req === null && /thành công/.test(msg), 'đổi thành công (không cần duyệt, không phân biệt hoa/thường): ' + msg.split('\n')[0]);
ok(a1.linh_thach - a0.linh_thach === 5000000 && a1.linh_tinh - a0.linh_tinh === 100 && a1.ruong_than_bi - a0.ruong_than_bi === 3 && a1.dan_pha_gioi - a0.dan_pha_gioi === 2 && a1.dan_duoc - a0.dan_duoc === 10 && a1.dan_taytuy_nuaban - a0.dan_taytuy_nuaban === 1, 'cộng đúng quà');
ok(/Linh Tinh/.test(msg) && /Tẩy Tủy Nửa Tác Dụng/.test(msg), 'thông báo có Linh Tinh & Đan Tẩy Tủy Nửa Tác Dụng');
const [m2] = Inv.redeemCode('501', null, 'DENBUMATDULIEU'); ok(/đã được sử dụng/.test(m2), 'nhập lại bị chặn'); const a2 = Cu.getCultivator('501');
ok(a2.linh_thach === a1.linh_thach && a2.linh_tinh === a1.linh_tinh, 'không cộng lần 2');
const [m3] = Inv.redeemCode('502', null, 'DENBUMATDULIEU'); ok(/thành công/.test(m3), 'người khác vẫn đổi được (không giới hạn lượt)'); ok(Cu.getCultivator('502').linh_tinh === 100, 'người 2 đủ quà');
console.log(`✅ test_code_denbu_v16_5 OK (${n} kiểm tra)`);
