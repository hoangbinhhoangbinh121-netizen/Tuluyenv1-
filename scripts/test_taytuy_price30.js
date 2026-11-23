'use strict';
// V21.5b — Đan Tẩy Tủy (Trọng Sinh + Nửa Tác Dụng) giá ×30; đối chứng: các món khác KHÔNG đổi giá.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_taytuy30_${Date.now()}.db`);
const assert = require('node:assert'); const D = require('../src/db'); D.initDb();
const S = require('../src/game/shop21'); const K = require('../src/game/constants'); const I = require('../src/game/catalog17');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const OLD = { ts: 6000, nua: 4245 };   // giá V21.4 (đo từ code cũ: ceil(2·√(base/1000))·3)
const ts = S.findEntry('i:dan_tay_tuy_ts'); const nua = S.findEntry('i:dan_tay_tuy_nua');
ok(ts && nua, 'cả hai món có trong cửa hàng');
ok(S.price(ts) === OLD.ts * 30, `Trọng Sinh = ${OLD.ts * 30}`); ok(S.price(nua) === OLD.nua * 30, `Nửa Tác Dụng = ${OLD.nua * 30}`);
ok(S.PRICE_MULT.dan_tay_tuy_ts === 30 && S.PRICE_MULT.dan_tay_tuy_nua === 30, 'hệ số ×30');
ok(K.TAYTUY_LINH_THACH_COST === 30e12 && K.TAYTUY_NUABAN_LINH_THACH_COST === 3e12, 'giá luyện bằng Linh Thạch ×30 (1e12→3e13, 1e11→3e12)');
ok(Number.isSafeInteger(K.TAYTUY_LINH_THACH_COST), 'còn trong số nguyên an toàn');
// đối chứng: món khác không bị nhân
const other = S.findEntry('i:dan_tu_khi'); ok(S.price(other) === 5, 'món khác giữ nguyên giá (Tụ Khí Đan = 5)');
const hasMult = new Set(Object.keys(S.PRICE_MULT)); ok(hasMult.size === 2, 'chỉ 2 món bị nhân');
console.log(`✅ test_taytuy_price30: ${n} kiểm tra PASS`);
