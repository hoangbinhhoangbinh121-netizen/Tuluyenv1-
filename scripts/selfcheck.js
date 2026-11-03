'use strict';
// Kiểm tra nhanh: DB mở được, schema đủ cột, logic cốt lõi chạy được. Chạy: npm run check
process.env.TULUYEN_DB_PATH = process.env.TULUYEN_DB_PATH || require('node:path').join(require('node:os').tmpdir(), `tg_check_${Date.now()}.db`);
const D = require('../src/db'); const Cu = require('../src/game/cultivator'); const A = require('../src/game/actionsBasic');
console.log('driver:', D.initDb());
const id = '123456789012345678';
if (!Cu.getCultivator(id)) Cu.createCultivator(id);
console.log(A.doTuluyen(id)); console.log(A.doLinhmach(id));
console.log('Lực chiến:', Cu.calcLucChien(Cu.getCultivator(id)));
const B = require('../src/game/boss');
const sm = B.summon({ guildId: '1', channelId: '2', by: id, capdo: 1, hp: 1000 });
console.log('Boss:', sm.ok ? sm.boss.name : sm.error);
const f = require('../src/ui/format');
console.log('Định dạng:', f.num(1250000), f.pct(0.755), f.dur(9000));
console.log('✅ OK');
