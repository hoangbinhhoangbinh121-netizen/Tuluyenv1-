'use strict';
// V21.3 — Stat Snapshot: kết quả KHỚP CHÍNH XÁC Cu.effective* (không lệch/double-count) trên nhiều nhân vật ngẫu nhiên + có breakdown.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_st21_${Date.now()}.db`);
const assert = require('node:assert');
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const SS = require('../src/game/stat21'); const K = require('../src/game/constants');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const rows = [];
for (let i = 0; i < 60; i++) {
  const id = '9000000000000000' + String(10 + i); Cu.createCultivator(id);
  Cu.updateCultivator(id, {
    realm_index: Math.floor(rnd() * 6), stage_index: Math.floor(rnd() * 3),
    atk: 50 + Math.floor(rnd() * 5000), def_: 40 + Math.floor(rnd() * 4000), spd: 30 + Math.floor(rnd() * 900), hp: 300 + Math.floor(rnd() * 40000),
    cong_phap_bonus: rnd() * 0.8, phap_bao_bonus: rnd() * 0.5,
    ruong_bonus_atk: Math.floor(rnd() * 300), ruong_bonus_def: Math.floor(rnd() * 300), ruong_bonus_spd: Math.floor(rnd() * 50), ruong_bonus_hp: Math.floor(rnd() * 2000),
    ngusuy_started: rnd() < 0.3 ? 1 : 0, ngusuy_stage: Math.floor(rnd() * 3),
  });
  rows.push(Cu.getCultivator(id));
}
let bad = 0;
for (const r of rows) {
  const s = SS.snapshot(r);
  ok(s.check.ok, `snapshot lệch Cu.effective*: ${JSON.stringify(s.check.diffs)}`);
  ok(s.atk === Cu.effectiveAtk(r) && s.def === Cu.effectiveDef(r) && s.spd === Cu.effectiveSpd(r) && s.maxHp === Cu.effectiveMaxHp(r), 'bằng nhau từng chỉ số');
  ok(s.lucChien === Cu.calcLucChien(r), 'Lực Chiến khớp');
  ok(Array.isArray(s.breakdown.atk.mods) && s.breakdown.atk.base === r.atk, 'có breakdown + base');
  ok(s.breakdown.atk.mods.every((m) => m.sourceId && m.sourceType && m.stat && m.operation && Number.isFinite(m.value)), 'mỗi modifier đủ sourceId/sourceType/stat/operation/value');
  ok(Object.values(s.combat).every((v) => Number.isFinite(v)), 'combat mods hữu hạn: ' + JSON.stringify(s.combat));
  if (!s.check.ok) bad++;
}
ok(bad === 0, 'không lệch'); ok(SS.describe(SS.snapshot(rows[0]), 'atk').startsWith('atk:'), 'describe');
// ổn định: gọi 2 lần cho cùng kết quả
ok(JSON.stringify(SS.snapshot(rows[1])) === JSON.stringify(SS.snapshot(rows[1])), 'snapshot ổn định');
console.log(`✅ test_stat21: ${n} kiểm tra PASS`);
