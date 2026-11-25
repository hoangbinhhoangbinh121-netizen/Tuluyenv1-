'use strict';
// V21.7.1 — Đan Tẩy Tủy: phí luyện khi KHÔNG có đan chuyển từ Linh Thạch sang Linh Tinh, giá rất cao (người chơi thường không đủ).
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_taytuy_${Date.now()}.db`);
const assert = require('node:assert'); const D = require('../src/db'); D.initDb();
const S = require('../src/game/shop21'); const K = require('../src/game/constants'); const Cu = require('../src/game/cultivator'); const Dan = require('../src/game/dan');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const OLD = { ts: 6000, nua: 4245 };
const ts = S.findEntry('i:dan_tay_tuy_ts'); const nua = S.findEntry('i:dan_tay_tuy_nua');
ok(ts && nua, 'cả hai món có trong cửa hàng Nguyên Bảo'); ok(S.price(ts) === OLD.ts * 30 && S.price(nua) === OLD.nua * 30, 'giá Nguyên Bảo giữ ×30 (không đổi)');
ok(K.TAYTUY_LINH_TINH_COST === 1e15 && K.TAYTUY_NUABAN_LINH_TINH_COST === 1e14, 'phí bằng Linh Tinh: 1e15 / 1e14');
ok(K.TAYTUY_LINH_THACH_COST === undefined && K.TAYTUY_NUABAN_LINH_THACH_COST === undefined, 'không còn khoá giá Linh Thạch');
ok(Number.isSafeInteger(K.TAYTUY_LINH_TINH_COST), 'còn trong số nguyên an toàn');
const other = S.findEntry('i:dan_tu_khi'); ok(S.price(other) === 5, 'món khác giữ nguyên giá');
const U = '555555555555555555'; Cu.createCultivator(U);
Cu.updateCultivator(U, { linh_thach: 5e15, linh_tinh: 5000000 });                 // nhiều Linh Thạch + 5 triệu Linh Tinh: vẫn không đủ
const r1 = Dan.doTaytuyReroll(U); const r2 = Dan.doTaytuyNuabanReroll(U, 'linh_can');
ok(/Linh Tinh/.test(r1) && /❌/.test(r1) && !/Linh Thạch/.test(r1), 'Trọng Sinh: đòi Linh Tinh, không dùng Linh Thạch');
ok(/Linh Tinh/.test(r2) && /❌/.test(r2) && !/Linh Thạch/.test(r2), 'Nửa Tác Dụng: đòi Linh Tinh');
let row = Cu.getCultivator(U); ok(row.linh_thach === 5e15 && row.linh_tinh === 5000000, 'bị từ chối thì không trừ gì');
Cu.updateCultivator(U, { linh_tinh: 1e15 });                                       // đủ → trừ đúng Linh Tinh, Linh Thạch giữ nguyên
const r3 = Dan.doTaytuyReroll(U); row = Cu.getCultivator(U);
ok(/TRỌNG SINH/.test(r3) && /Linh Tinh/.test(r3) && row.linh_tinh === 1e15 - K.TAYTUY_LINH_TINH_COST + 0 && row.linh_thach === 5e15, 'đủ Linh Tinh → luyện được, trừ Linh Tinh');
Cu.updateCultivator(U, { linh_tinh: 1e14 });
const r4 = Dan.doTaytuyNuabanReroll(U, 'the_chat'); row = Cu.getCultivator(U);
ok(/NỬA TÁC DỤNG/.test(r4) && row.linh_tinh === 0 && row.linh_thach === 5e15, 'Nửa Tác Dụng: trừ 1e14 Linh Tinh');
Cu.updateCultivator(U, { dan_taytuy_trongsinh: 1, dan_taytuy_nuaban: 1, linh_tinh: 0 });   // có đan trong kho: vẫn miễn phí
ok(/TRỌNG SINH/.test(Dan.doTaytuyReroll(U)) && /NỬA TÁC DỤNG/.test(Dan.doTaytuyNuabanReroll(U, 'linh_can')), 'có đan trong kho → dùng miễn phí như cũ');
console.log(`✅ test_taytuy_price30: ${n} kiểm tra PASS`);
