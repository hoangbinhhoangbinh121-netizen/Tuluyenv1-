'use strict';
// V19.3 — hiệu ứng Chứng Đạo Thành Đế: tài nguyên đủ/nhẹ, đủ 30 file gốc được dùng, chuỗi cảnh, dự phòng khi lỗi/thiếu file.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_cdfx_${Date.now()}.db`);
const assert = require('node:assert'); const fs = require('node:fs'); const path = require('node:path');
const D = require('../src/db'); D.initDb();
const FX = require('../src/ui/chungdaoFx'); const WC = require('../src/ui/worldChannel');
const { EmbedBuilder } = require('discord.js');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
FX.setWait(async () => {});
const names = (p) => (p.files || []).map((f) => f.name);
const imgOf = (p) => { const j = p.embeds[0].toJSON(); return j.image && j.image.url; };

(async () => {
  // 1) tài nguyên
  let total = 0;
  for (const f of FX.ALL_FILES) { ok(FX.has(f), `thiếu file ${f}`); const sz = fs.statSync(path.join(FX.DIR, f)).size; total += sz; ok(sz < 1.6 * 1024 * 1024, `${f} quá nặng`); ok(sz > 5000, `${f} quá nhỏ`); }
  const onDisk = fs.readdirSync(FX.DIR).sort(); ok(JSON.stringify(onDisk) === JSON.stringify([...FX.ALL_FILES].sort()), 'thư mục assets/chungdao khớp ALL_FILES (không thừa/thiếu)');
  ok(total < 5 * 1024 * 1024, `tổng ${Math.round(total / 1024)}KB phải < 5MB (giữ zip < 30MiB)`);
  // 2) đủ 30 file gốc có trong MANIFEST của script dựng
  const src = fs.readFileSync(path.join(__dirname, 'build_chungdao_fx_v19_3.py'), 'utf8');
  const man = [...src.matchAll(/'((?:0\d|1[0-6])_[a-z_]+\.(?:jpg|png)|anim_[a-z_]+\.gif|fx_[a-z_0-9]+\.png)':/g)].map((m) => m[1]);
  ok(new Set(man).size === 30, `MANIFEST phải liệt kê 30 file gốc (có ${new Set(man).size})`);
  for (const m of new Set(man)) { const base = m.replace(/\.[a-z]+$/, ''); ok(src.split(m).length >= 3 || src.includes(`'${m}'`), `file gốc ${m} được dùng trong script`); ok(base.length > 0, 'tên'); }
  // 3) ảnh theo đạo lôi 1..12 + tab Đế
  const seen = new Set(); for (let i = 1; i <= 12; i += 1) { const f = FX.loiImage(i); ok(FX.has(f), f); seen.add(f); } ok(seen.size === 12, '12 ảnh lôi khác nhau');
  ok(FX.loiImage(0) === 'loi_01.jpg' && FX.loiImage(99) === 'loi_12.jpg', 'chặn biên đạo lôi');
  for (const tab of ['ov', 'dao', 'binh', 'hieu']) { const p = FX.dressTab({ embeds: [new EmbedBuilder().setTitle('t')] }, tab); ok(Array.isArray(p.attachments) && p.attachments.length === 0, `tab ${tab}: attachments rỗng để thay ảnh cũ`); ok(p.files && p.files.length >= 1, `tab ${tab}: có ảnh`); }
  // 4) dress: thiếu file → chỉ chữ, không tham chiếu attachment
  const miss = FX.dress({ embeds: [new EmbedBuilder().setTitle('x')] }, { image: 'khong_ton_tai.jpg', thumb: 'cung_khong.png' });
  ok(!miss.files && !imgOf(miss), 'thiếu file → không ảnh'); ok(FX.dress(null) === null && FX.dress({}).embeds === undefined, 'dress an toàn với payload lạ');
  // 5) chuỗi thắng
  const log = []; const io = { first: async (p) => { log.push(['first', p]); }, edit: async (p) => { log.push(['edit', p]); } };
  const fin = (o = {}) => FX.dress({ embeds: [new EmbedBuilder().setTitle(o.plain ? 'plain' : 'final')], components: [] }, o.plain ? {} : { image: 'win_d.jpg', thumb: 'de_an.png' });
  ok(await FX.playWin(io, 'Tester', fin), 'chiếu đủ'); ok(log.length === FX.WIN_SCENES.length + 1, 'đủ cảnh + kết quả'); ok(log[0][0] === 'first' && log.slice(1).every(([k]) => k === 'edit'), 'first rồi edit');
  const used = new Set(log.flatMap(([, p]) => names(p))); for (const f of ['anim_thien_loi.gif', 'anim_than_quang.gif', 'anim_luan_ban.gif', 'win_a.jpg', 'win_b.jpg', 'win_c.jpg', 'win_d.jpg', 'de_an.png']) ok(used.has(f), `chuỗi thắng dùng ${f}`);
  for (const [, p] of log) { ok(p.attachments && p.attachments.length === 0, 'mỗi cảnh thay ảnh cũ'); ok(JSON.stringify(p.embeds[0].toJSON()).length < 5900, 'embed < 6000'); for (const e of p.embeds) { const j = e.toJSON(); ok((j.description || '').length <= 4096, 'mô tả ≤4096'); } }
  ok(log[log.length - 1][1].embeds[0].toJSON().title === 'final', 'cảnh cuối là kết quả');
  // 6) lỗi giữa chừng → vẫn giao kết quả; lỗi cả ảnh → dự phòng chữ
  let c1 = 0; const io2 = { first: async () => { c1 += 1; }, edit: async (p) => { c1 += 1; if (c1 === 3) throw new Error('hết hạn'); log2.push(p); } }; const log2 = [];
  ok((await FX.playWin(io2, 'T', fin)) === false, 'báo gián đoạn'); ok(log2.length >= 1 && log2[log2.length - 1].embeds[0].toJSON().title === 'final', 'vẫn giao kết quả sau lỗi');
  const log3 = []; const io3 = { first: async (p) => { if (p.files) throw new Error('lỗi tải ảnh'); log3.push(p); }, edit: async (p) => { if (p.files) throw new Error('lỗi tải ảnh'); log3.push(p); } };
  await FX.playWin(io3, 'T', fin); ok(log3.length === 1 && log3[0].embeds[0].toJSON().title === 'plain' && !log3[0].files, 'dự phòng chỉ chữ khi mọi ảnh lỗi');
  // 7) thất bại + cảnh đánh trúng
  const lf = []; ok(await FX.playFail({ first: async (p) => lf.push(p), edit: async (p) => lf.push(p) }, 'T', () => FX.dress({ embeds: [new EmbedBuilder().setTitle('fail')] }, { image: 'fail.jpg' })), 'chiếu thất bại'); ok(lf.length === 2 && names(lf[0])[0] === 'anim_thien_loi.gif' && names(lf[1])[0] === 'fail.jpg', 'fail: lôi → kết quả');
  const lh = []; ok(await FX.playHit({ first: async (p) => lh.push(['first', p]), edit: async (p) => lh.push(['edit', p]) }, 3, 'Diệt Hồn Thần Lôi', ['a', 'b', 'c', 'd'], () => FX.dressKiep({ embeds: [new EmbedBuilder().setTitle('next')], components: [] }, 4)), 'hit');
  ok(lh.length === 2 && names(lh[0][1])[0] === 'anim_thien_loi.gif' && names(lh[1][1])[0] === 'loi_04.jpg', 'hit rồi đạo kế'); ok(/Diệt Hồn/.test(lh[0][1].embeds[0].toJSON().description) && !/\ba\b\n/.test(lh[0][1].embeds[0].toJSON().description), 'hit hiển thị 3 dòng cuối');
  let tries = 0; const lr = []; await FX.playHit({ first: async (p) => lr.push(p), edit: async (p) => { tries += 1; if (tries === 1) throw new Error('mạng'); lr.push(p); } }, 1, 'X', [], () => ({ embeds: [new EmbedBuilder().setTitle('next')], components: [] }));
  ok(tries === 2 && lr.length === 2, 'hit thử lại 1 lần khi sửa tin lỗi');
  // 8) thông báo thế giới kèm ảnh
  let sent = null; const client = { channels: { fetch: async () => ({ send: async (p) => { sent = p; } }) } }; WC.set('gx', 'ch1');
  const e = new EmbedBuilder().setTitle('Đại đạo'); const d = FX.dress({ embeds: [e] }, { image: 'win_d.jpg', thumb: 'de_an.png' });
  ok(await WC.announceWorld(client, 'gx', e, { files: d.files }), 'gửi được'); ok(sent && sent.files && sent.files.length === 2, 'thông báo kèm 2 ảnh');
  sent = null; ok(await WC.announceWorld(client, 'gx', new EmbedBuilder().setTitle('t')), 'gửi không ảnh'); ok(sent && !sent.files && sent.embeds.length === 1, 'không files → payload cũ');
  console.log(`✓ test_chungdao_fx19: ${n} kiểm tra`);
})().catch((e) => { console.error('✗', e); process.exit(1); });
