'use strict';
/** /chungtoc (v21.5) — Chủng Tộc & Huyết Mạch. Slash nhường chỗ: /dungluong đã chuyển sang tiền tố (!dungluong) để giữ đúng 100 lệnh slash. */
const { defineCommand } = require('./framework');
const V = require('../ui/raceViews');
defineCommand({ name: 'chungtoc', description: 'Chủng Tộc: chọn tộc, thức tỉnh, huyết mạch, tiến hóa (6 tộc)', needsCultivator: true, run: (ctx) => ctx.send(V.open(ctx.user.id)) });
