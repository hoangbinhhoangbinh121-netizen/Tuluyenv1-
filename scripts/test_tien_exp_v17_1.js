'use strict';
// v17.1: đột phá trên Độ Kiếp Viên Mãn (cảnh giới Tiên) cần tu vi x7; phía dưới và tốc độ/phần thưởng (mốc GỐC) không đổi.
const assert = require('assert');
const K = require('../src/game/constants'); const R = require('../src/game/realm');
assert.strictEqual(K.TIEN_EXP_MULT, 7);
const raw = (r, s, w) => R.tuViRequiredBase(r, s, w) * K.EXP_REQUIRED_MULT * (R.isMajorGate(r, s) ? K.EXP_GATE_MAJOR_MULT : K.EXP_GATE_MINOR_MULT);
let n = 0;
for (let r = 1; r < K.REALMS.length; r++) {
  const cnt = K.totalStageCount(r);
  for (let s = 0; s < cnt; s++) for (const w of [0, 1, 2]) {
    const exp = (r > K.DOKIEP_REALM_IDX || (r === K.DOKIEP_REALM_IDX && s === K.DOKIEP_VIENMAN_STAGE)) ? 7 * (r >= K.HIGH_TIEN_START_IDX ? K.HIGH_TIEN_EXP_MULT : 1) * (r >= K.HIGH_TIEN_START_IDX ? K.TIEN_HIGH_EXTRA_MULT : (r >= K.TIEN_START_IDX ? K.TIEN_MID_EXTRA_MULT : 1)) : 1;   // v18.2: Tiên cao (≥ Chuẩn Tiên Vương) x7 x5
    assert.strictEqual(R.tuViRequired(r, s, w), R.softCap(Math.trunc(raw(r, s, w) * exp)), `r${r} s${s} w${w}`);   // v18.0: có trần chống tràn số
    assert.strictEqual(R.tienExpMult(r, s), exp); n++;
  }
}
// Độ Kiếp tầng 22 (trước Viên Mãn) và Đại Thừa không bị nhân; mốc Lực Chiến (Legacy) không đổi
assert.strictEqual(R.tienExpMult(K.DOKIEP_REALM_IDX, K.DOKIEP_VIENMAN_STAGE - 1), 1);
assert.strictEqual(R.tuViRequiredLegacy(10, 0, 2), Math.trunc(R.tuViRequiredBase(10, 0, 2) * K.EXP_REQUIRED_MULT));
console.log(`✅ test_tien_exp_v17_1 OK (${n} mốc)`);
