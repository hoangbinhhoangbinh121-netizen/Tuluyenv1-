'use strict';
// Sinh phần DANH SÁCH của BAO_CAO_V20.md (vật phẩm mới, công thức, ID, khu khai thác) từ dữ liệu thật — chạy: node scripts/gen_report_v20.js > /tmp/v20_lists.md
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_rep20_${Date.now()}.db`);
const Cat = require('../src/game/catalog17'); const V = require('../src/data/v20_data'); const Kt = require('../src/game/khaithac20');
const { I, C } = Cat; const out = [];
const isV20 = (it) => it.id.startsWith('v20_') || /^(dd_than|dd_de|dd_sieuthoat|tv_(tien|than|de|thiendao|sieuthoat))$/.test(it.id);
const items = I.ITEMS.filter(isV20);
out.push(`### A. Vật phẩm mới (${items.length})`, '', '| ID | Tên | Danh mục | Hạng |', '|---|---|---|---|');
for (const it of items) out.push(`| \`${it.id}\` | ${it.name} | ${it.cat} | ${it.rarity} |`);
const rec = C.RECIPES.filter((r) => /^(rc20_|rc_v20_)/.test(r.id) || r.id.includes('20'));
out.push('', `### B. Công thức mới (${rec.length})`, '', '| ID | Nghề | Giai đoạn | Cấp nghề | Tên | Thất truyền |', '|---|---|---|---|---|---|');
for (const r of rec) out.push(`| \`${r.id}\` | ${C.PROFS[r.prof].name} | ${r.stage} | ${r.lv} | ${r.name} | ${r.rare ? 'có' : ''} |`);
out.push('', '### C. Khu khai thác / thu thập (12)', '', '| ID | Tên | Loại | Cảnh giới | Thời gian | Lượt/ngày | Phí |', '|---|---|---|---|---|---|---|');
for (const z of Kt.zones()) out.push(`| \`${z.id}\` | ${z.name} | ${z.kind === 'kk' ? 'Mỏ' : 'Thu thập'} | ${z.realm} | ${z.dur}s | ${z.daily} | ${z.gold || 0} |`);
out.push('', '### D. 10 giai đoạn', '', '| # | Tên | Dải cảnh giới | Cấp nghề | Dị Hỏa |', '|---|---|---|---|---|');
for (const s of V.STAGES) out.push(`| ${s.n} | ${s.name} | ${s.band[0]}–${s.band[1]} | ${s.lv} | ${s.hoaName} |`);
console.log(out.join('\n'));
