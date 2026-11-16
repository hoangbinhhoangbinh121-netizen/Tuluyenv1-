'use strict';
// V19.1 — emoji pixel mới: đủ file 128x128, có emoji dự phòng, tên hợp lệ, KHÔNG ghi đè emoji cũ, mọi khóa V19 trong UI đều có tranh.
const fs = require('node:fs'); const path = require('node:path'); const assert = require('node:assert'); const cp = require('node:child_process');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const dir = path.join(__dirname, '..', 'assets', 'emoji'); const fb = require('../src/data/emoji_fallback.json');
const src = fs.readFileSync(path.join(__dirname, 'make_pixel_emoji_v19.py'), 'utf8');
const keys = ['bicanh19', 'chungdao', 'dekiep', 'dean', 'dehieu', 'benmenh', 'dedao', 'debinh', 'sukien19', 'linhngo19', 'thucngo19', 'doi19', 'mob_thuong', 'mob_tinhanh', 'mob_mini', 'mob_canh', 'boss19',
  'dd_satphat', 'dd_sinhmenh', 'dd_thoikhong', 'dd_luanhoi', 'dd_hondon', 'dd_huydiet', 'db_kiem', 'db_chung', 'db_ban', 'db_an', 'db_thap', 'ev_dibien', 'ev_dicanh', 'ev_truyenthua', 'ev_sieuthoat'];
for (let i = 0; i < 19; i += 1) keys.push(`bc19_${String(i).padStart(2, '0')}`);
ok(keys.length === 51, '51 emoji mới');
const png = (f) => { const b = fs.readFileSync(f); return { sig: b.slice(0, 8).toString('hex'), w: b.readUInt32BE(16), h: b.readUInt32BE(20), size: b.length }; };
for (const k of keys) {
  const f = path.join(dir, `${k}.png`); ok(fs.existsSync(f), `thiếu ${k}.png`);
  const p = png(f); ok(p.sig === '89504e470d0a1a0a' && p.w === 128 && p.h === 128, `${k}: PNG 128x128`); ok(p.size > 800 && p.size < 256 * 1024, `${k}: kích thước hợp lý ${p.size}`);
  ok(/^\w{1,24}$/.test(k) && `tg7_${k}`.length <= 32, `${k}: tên emoji hợp lệ (tối đa 32 ký tự khi có tiền tố)`); ok(typeof fb[k] === 'string' && fb[k].length > 0, `${k}: có emoji Unicode dự phòng`);
  ok(src.includes(`'${k}'`) || k.startsWith('bc19_'), `${k}: có trong script vẽ`);
}
// không trùng/ghi đè emoji cũ: git không có → so với danh sách các file cũ trong BAO_CAO? Đối chiếu bằng số lượng: mọi khóa mới khác nhau và tên không trùng bộ cũ (cũ = 460 file có trước V19.1)
ok(new Set(keys).size === keys.length, 'khóa không trùng nhau');
const all = fs.readdirSync(dir).filter((f) => f.endsWith('.png')); ok(all.length >= 460 + 51 - 1, `tổng ${all.length} emoji (460 cũ + 51 mới, 1 khóa linhngo cũ giữ nguyên)`);
ok(fs.existsSync(path.join(dir, 'linhngo.png')) && fs.existsSync(path.join(dir, 'treoquan.png')) && fs.existsSync(path.join(dir, 'canhgioi_19.png')), 'emoji cũ còn nguyên');
// giới hạn Discord: ≤ 2000 emoji/ứng dụng; mỗi file ≤ 256 KB
ok(all.length <= 2000, 'không vượt 2000 emoji ứng dụng'); for (const f of all) ok(fs.statSync(path.join(dir, f)).size <= 256 * 1024, `${f} ≤ 256KB`);
// script an toàn: chạy lại KHÔNG đổi emoji cũ (băm trước/sau)
const crypto = require('node:crypto'); const hash = (f) => crypto.createHash('md5').update(fs.readFileSync(path.join(dir, f))).digest('hex');
const old = all; const before   // v19.2: gồm cả 51 emoji V19 do người dùng tự vẽ — script vẽ bằng code không được ghi đè
   = Object.fromEntries(old.map((f) => [f, hash(f)]));
const r = cp.spawnSync('python3', [path.join(__dirname, 'make_pixel_emoji_v19.py')], { encoding: 'utf8' }); ok(r.status === 0, `script vẽ chạy được: ${r.stderr}`);
ok(old.every((f) => hash(f) === before[f]), 'chạy lại script vẽ không đổi bất kỳ emoji nào (kể cả 51 emoji tranh người dùng)');
ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'source', 'v19_1_sheet.png')) && fs.existsSync(path.join(__dirname, 'build_emoji_from_sheet_v19_1.py')), 'có bảng tranh gốc + script cắt');
// tranh người dùng: nền trong suốt thật + icon chiếm phần lớn khung
const bigIc = cp.spawnSync('python3', ['-c', `import sys\nfrom PIL import Image\nbad=0\nfor k in sys.argv[1:]:\n    im=Image.open('${dir.replace(/\\/g, '/')}/'+k+'.png').convert('RGBA'); a=im.split()[3]; bb=a.getbbox(); px=sum(1 for v in a.getdata() if v>16)\n    if not bb or max(bb[2]-bb[0],bb[3]-bb[1])<100 or px<2500 or a.getpixel((0,0))>0: bad+=1; print('xấu',k,bb,px)\nsys.exit(bad)`, ...keys], { encoding: 'utf8' }); ok(bigIc.status === 0, `emoji tranh người dùng hợp lệ (nền trong suốt, icon đủ lớn): ${bigIc.stdout}`);
// emo19 helper
const E9 = require('../src/ui/emo19'); ok(E9.bc(0) && E9.bc(18) && E9.dao('hunhdon') && E9.binh('thap') && E9.ev('sieuthoat') && E9.mob('final'), 'emo19 luôn trả chuỗi (dự phòng Unicode)');
const c = E9.comp('bicanh19', '🌀'); ok(c && typeof c === 'object' && (c.id || c.name === '🌀'), 'emo19.comp luôn trả đối tượng hợp lệ');
console.log(`✅ test_emoji19 OK (${n} kiểm tra)`);
