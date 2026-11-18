'use strict';
// V19.11 — Bản hướng dẫn lụm vật phẩm Chứng Đạo + vá lỗ hổng Bất Hủ Đế Cốt (bc8 Boss cuối).
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_guide1911_${Date.now()}.db`);
const assert = require('node:assert');
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const Inv = require('../src/game/invsvc'); const CD = require('../src/game/chungdao19');
const BC = require('../src/game/bicanh19'); const B = require('../src/data/bicanh19'); const I19 = require('../src/data/items_v19'); const G = require('../src/game/chungdaoGuide');
const kit = require('../src/ui/kit'); const CDV = require('../src/ui/chungdaoViews');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const mk = (id, realm, stage = 0, extra = '') => { Cu.createCultivator(id); D.run(`UPDATE cultivators SET realm_index = ?, stage_index = ?, world_tier = 2, thiennhanngusuy_passed = 1, tu_vi = 9e15 ${extra} WHERE user_id = ?`, realm, stage, String(id)); return String(id); };
/** Kiểm giới hạn payload Discord. */
function check(p, tag) {
  ok(p && typeof p === 'object', `${tag}: payload`);
  const comps = (p.components || []).map((r) => (r.toJSON ? r.toJSON() : r)); ok(comps.length <= 5, `${tag}: ≤5 hàng`);
  for (const r of comps) { ok(r.components.length >= 1 && r.components.length <= 5, `${tag}: hàng 1–5 thành phần`); for (const c of r.components) ok(!c.custom_id || c.custom_id.length <= 100, `${tag}: customId ≤100`); }
  for (const e of p.embeds || []) { const j = e.toJSON ? e.toJSON() : e; let total = (j.title || '').length + (j.description || '').length + (j.footer ? j.footer.text.length : 0); ok((j.title || '').length <= 256 && (j.description || '').length <= 4096, `${tag}: title/desc`); ok((j.fields || []).length <= 25, `${tag}: ≤25 field`); for (const f of j.fields || []) { ok(f.name.length > 0 && f.name.length <= 256 && f.value.length > 0 && f.value.length <= 1024, `${tag}: field "${f.name.slice(0, 30)}" ${f.value.length}`); total += f.name.length + f.value.length; } ok(total <= 6000, `${tag}: tổng embed ≤6000 (${total})`); }
}
/** v19.3: mọi attachment://x trong embed phải có file cùng tên đính kèm (và file phải tồn tại, ≤10 file). */
function checkFiles(p, tag) {
  const refs = []; for (const e of p.embeds || []) { const j = e.toJSON ? e.toJSON() : e; for (const u of [j.image && j.image.url, j.thumbnail && j.thumbnail.url]) if (u && /^attachment:\/\//.test(u)) refs.push(u.slice(13)); }
  const names = (p.files || []).map((f) => f.name); ok(names.length <= 10, `${tag}: ≤10 file`);
  for (const r of refs) ok(names.includes(r), `${tag}: ảnh ${r} có file đính kèm`);
  for (const f of p.files || []) ok(require('node:fs').existsSync(f.attachment || f.path), `${tag}: file ${f.name} tồn tại`);
}
/** Giả tương tác nút/select. */
const fake = (uid, customId, values) => { const log = []; const i = { customId, user: { id: String(uid), username: 'u' + uid }, member: { displayName: 'U' + uid }, values, guildId: 'g1', client: { channels: { fetch: async () => ({ send: async () => ({ id: 'm' }) }) } }, message: { edit: async () => {} }, replied: false, deferred: false, log,
  update: async (p) => { i.replied = true; log.push(['update', p]); }, editReply: async (p) => { log.push(['edit', p]); }, reply: async (p) => { i.replied = true; log.push(['reply', p]); }, followUp: async (p) => { log.push(['followUp', p]); }, deferUpdate: async () => { log.push(['defer']); }, showModal: async (m) => { log.push(['modal', m]); }, isButton: () => !values, isStringSelectMenu: () => !!values }; return i; };
const click = async (uid, customId, values) => { const i = fake(uid, customId, values); await kit.routeComponent(i); for (const [, p] of i.log) { ok(!/mã lỗi/.test(JSON.stringify(p || '')), `click ${customId}: lỗi nội bộ ${JSON.stringify(p).slice(0, 120)}`); } for (const [, p] of i.log) if (p && typeof p === 'object' && (p.embeds || p.components)) { check(p, `click ${customId}`); checkFiles(p, `click ${customId}`); } return i; };
(async () => {
  // ---- vá Đế Cốt: có nguồn vào được TRƯỚC khi Chứng Đạo (cảnh giới ≤ Chuẩn Tiên Đế)
  const cotSrc = G.sourcesOf(null, 'tdc19_bat_hu_de_cot'); ok(cotSrc.length >= 1, 'Đế Cốt có nguồn bí cảnh');
  ok(cotSrc.some((s) => s.realmIdx <= CD.GATE_REALM && s.e > 0), 'Đế Cốt lụm được trước khi thành Đế (bc ≤ Chuẩn Tiên Đế)');
  ok(B.BCS[8].realm === CD.GATE_REALM, 'bc8 = Đế Đạo Cổ Lộ ở đúng cảnh giới cổng Chứng Đạo');
  ok(I19.SRC.tdc19_bat_hu_de_cot.includes('bc19_8'), 'SRC có bc19_8');
  for (const id of Object.keys(CD.REQ)) { const l = G.sourcesOf(null, id); const ev = G.EXTRA[id]; ok(l.length > 0 || (ev && ev.length), `${id}: có nguồn để lụm`); ok(CD.REQ[id] > 0, `${id}: có yêu cầu`); }
  ok(BC.expectedDrop('tdc19_bat_hu_de_cot', 8) > 0 && BC.expectedDrop('tdc19_bat_hu_de_cot', 0) === 0, 'expectedDrop Đế Cốt chỉ ở bc8+');
  // ---- trang hướng dẫn
  const u = mk(7001, 18, 3); const low = mk(7002, 10, 1);
  Inv.add(u, 'tdc19_de_dao_ban_nguyen', 30, { why: 't' });
  for (const uid of [u, low, null]) { const P = G.pages(uid); for (const [k] of G.PAGE_KEYS) { const pg = P[k]; ok(pg && pg.title, `trang ${k}`); ok((pg.description || '').length <= 3900, `${k}: mô tả vừa`); for (const f of pg.fields) ok(f.name.length <= 256 && String(f.value).length <= 1024 && String(f.value).length > 0, `${k}: field hợp lệ`); } }
  const ov = G.pages(u).ov; ok(/30\/100/.test(ov.description), 'tổng quan hiện tiến độ thật 30/100'); ok(/Chuẩn Tiên Đế · Viên Mãn/.test(ov.description), 'ghi đúng cổng Chuẩn Tiên Đế · Viên Mãn'); ok(!/Đại Đạo Chí Tôn/.test(ov.description), 'không còn sai cổng');
  const ban = G.sourcesOf(u, 'tdc19_de_dao_ban_nguyen'); ok(ban.every((s) => s.runs === Math.ceil(70 / s.e)), 'số lượt còn cần = ceil(thiếu/kỳ vọng)'); ok(ban.find((s) => s.idx === 8).can === true && G.sourcesOf(low, 'tdc19_de_dao_ban_nguyen').find((s) => s.idx === 8).can === false, 'cờ vào được theo cảnh giới');
  // ---- UI
  check(CDV.guideView(u), 'guide ov'); for (const [k] of G.PAGE_KEYS) check(CDV.guideView(u, k), `guide ${k}`); check(CDV.guideView(u, 'bậy'), 'guide key bậy → ov'); check(CDV.guideView(low, 'cot'), 'guide người thấp');
  const pre = CDV.preView(u); check(pre, 'preView'); ok(JSON.stringify(pre.components.map((r) => r.toJSON())).includes(`cd19|${u}|guide|ov`), 'menu Chứng Đạo có nút Hướng dẫn');
  let r = await click(u, `cd19|${u}|guide|ov`); ok(r.log.length === 1, 'nút hướng dẫn phản hồi');
  r = await click(u, `cd19|${u}|gpick`, ['cot']); ok(r.log.length === 1 && /Bất Hủ Đế Cốt/.test(JSON.stringify(r.log[0][1])), 'chọn trang Đế Cốt');
  r = await click(u, `cd19|${u}|rf`); ok(r.log.length === 1, 'quay lại /chungdao');
  // ---- lệnh chữ đăng ký, không tính vào 100 slash
  const reg = require('../src/commands/framework'); const cmds = (reg.commands || reg.COMMANDS || reg.all && reg.all()) ; 
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'src/commands/tiengioi19.js'), 'utf8'); ok(/name: 'huongdanchungdao'[^\n]*prefixOnly: true/.test(src), 'huongdanchungdao prefixOnly');
  console.log(`test_chungdao_guide_v19_11: ${n} kiểm tra OK`);
})().catch((e) => { console.error(e); process.exit(1); });
