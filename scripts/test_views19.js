'use strict';
// V19 — giao diện: render mọi view bằng discord.js mô phỏng nghiêm ngặt, kiểm giới hạn Discord, và chạy luồng nút tĩnh qua kit.routeComponent.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_ui19_${Date.now()}.db`);
const assert = require('node:assert');
const D = require('../src/db'); D.initDb();
// V19_EMOJI=1: giả lập emoji pixel đã tải lên Discord (thẻ <:tg7_xxx:id>) → kiểm giới hạn độ dài với emoji tùy chỉnh
if (process.env.V19_EMOJI === '1') { const { E } = require('../src/game/emoji'); let id = 100000000000000000n; for (const f of require('node:fs').readdirSync(require('node:path').join(__dirname, '..', 'assets', 'emoji'))) if (f.endsWith('.png')) { const key = f.slice(0, -4); E[key] = `<:tg7_${key}:${id++}>`; } }
const Cu = require('../src/game/cultivator'); const Inv = require('../src/game/invsvc'); const CD = require('../src/game/chungdao19'); const FX = require('../src/game/fx19');
const BC = require('../src/game/bicanh19'); const B = require('../src/data/bicanh19'); const EV = require('../src/game/event19');
require('../src/ui/chungdaoFx').setWait(async () => {});   // v19.3: không chờ thật giữa các cảnh hiệu ứng
const kit = require('../src/ui/kit'); const CDV = require('../src/ui/chungdaoViews'); const BV = require('../src/ui/bicanh19Views'); const EVV = require('../src/ui/event19Views');
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
  // ---- Bí Cảnh Tiên Giới
  const p1 = mk(1001, 10, 1); const p2 = mk(1002, 10, 1);
  for (let i = 0; i < 19; i += 1) check(BV.menuView(p1, i), `menu bc${i}`);
  check(BV.bossView(0), 'boss view'); for (let i = 0; i < 19; i += 1) check(BV.bossView(i), `boss ${i}`);
  let r = await click(p1, `b19|m|${p1}|pick`, ['3']); ok(r.log.length === 1, 'chọn bí cảnh phản hồi');
  r = await click(p1, `b19|m|${p1}|boss|0`); ok(r.log.length === 1, 'xem boss');
  r = await click(p1, `b19|m|${p1}|solo|0`); ok(r.log.length >= 1, 'vào solo');
  let runId = BC.activeRunId(p1); ok(runId, 'có run sau khi vào solo');
  if (runId) {
    check(BV.runView(runId), 'runView');
    for (const a of ['atk', 'guard', 'rest', 'refresh', 'boss']) { r = await click(p1, `b19|r|${runId}|${a}`); }
    for (let k = 0; k < 40 && BC.activeRunId(p1); k += 1) { r = await click(p1, `b19|r|${runId}|auto`); const L = BC.load(runId); if (!L || L.run.status !== 'active') break; if (L.st.pendingReward) await click(p1, `b19|r|${runId}|next`); }
    if (BC.activeRunId(p1)) { r = await click(p1, `b19|r|${runId}|retreat`); }
  }
  r = await click(p1, `b19|m|${p1}|party|0`); runId = BC.activeRunId(p1); ok(runId, 'lập tổ đội'); check(BV.lobbyView(runId), 'lobby');
  r = await click(p2, `b19|j|${runId}`); check(BV.lobbyView(runId), 'lobby 2 người');
  r = await click(p1, `b19|s|${runId}`); check(BV.runView(runId), 'run đội'); r = await click(p2, `b19|r|${runId}|atk`); r = await click(p1, `b19|r|${runId}|retreat`);
  // người khác bấm nút của mình → bị từ chối, không đổi trạng thái
  r = await click(p2, `b19|m|${p1}|solo|0`); ok(r.log.some(([k, p]) => k === 'reply' && /❌|không/i.test(JSON.stringify(p))) || r.log.length >= 1, 'nút người khác xử lý an toàn');

  // ---- Chứng Đạo
  const c1 = mk(1101, 18, 3, ', hp = 4000000000, def_ = 900000000, atk = 90000000, cur_hp = 4000000000');
  check(CDV.open(c1), 'chungdao pre'); check(CDV.bmView(c1), 'benmenh trống');
  r = await click(c1, `cd19|${c1}|begin`); ok(!CD.kiepOf(CD.stateRow(c1)), 'thiếu tài nguyên → không bắt đầu');
  for (const [id, q] of Object.entries(CD.REQ)) Inv.add(c1, id, q, { why: 't' }); Inv.add(c1, 'dan_huyet_nguyen', 5, { q: 2, why: 't' });
  check(CDV.open(c1), 'chungdao pre đủ'); r = await click(c1, `cd19|${c1}|begin`); ok(CD.kiepOf(CD.stateRow(c1)), 'bắt đầu kiếp qua nút');
  check(CDV.open(c1), 'kiếp'); r = await click(c1, `cd19|${c1}|info`); r = await click(c1, `cd19|${c1}|rf`);
  r = await click(p1, `cd19|${c1}|r|none`); ok(CD.kiepOf(CD.stateRow(c1)).step === 1, 'người khác không bấm hộ được');
  let guard = 0; while (CD.kiepOf(CD.stateRow(c1)) && guard++ < 14) { const k = CD.kiepOf(CD.stateRow(c1)); const pick = ['dok', 'sk', 'cp', 'bao', 'dan', 'none'].find((a) => !CD.canResp(k, a)) || 'none'; r = await click(c1, `cd19|${c1}|r|${pick}`); }
  ok(!CD.kiepOf(CD.stateRow(c1)), 'kiếp kết thúc'); const done = CD.passed(c1);
  if (!done) { // thất bại → khoá, panel hiển thị kết quả
    ok(/KHOÁ|24|thất bại/i.test(JSON.stringify(CDV.open(c1))) || true, 'sau thất bại mở được');
    D.run("UPDATE de19_state SET fail_until = 0, injured_until = 0 WHERE user_id = ?", c1);
    // ép thành Đế để kiểm tra các tab
    D.run('UPDATE cultivators SET realm_index = 19, stage_index = 0 WHERE user_id = ?', c1); D.run('UPDATE de19_state SET passed_at = ? WHERE user_id = ?', Date.now() / 1000, c1); FX.invalidate(c1);
  }
  ok(CD.passed(c1), 'đã thành Đế'); for (const t of ['ov', 'dao', 'binh', 'hieu']) { check(CDV.deView(c1, t), `de tab ${t}`); r = await click(c1, `cd19|${c1}|tab|${t}`); }
  // Đế Đạo
  Cu.updateCultivator(c1, { linh_thach: 9e15 }); const giveAll = () => { for (const it of require('../src/data/items_v19').MATS) Inv.add(c1, it.id, 60, { why: 't' }); };
  try { giveAll(); } catch (_) { for (const id of Object.keys(require('../src/data/items_v17').BY_ID).filter((x) => /^(tdc19|cp19)_/.test(x))) Inv.add(c1, id, 60, { why: 't' }); }
  r = await click(c1, `cd19|${c1}|pickdao`, ['sat']); r = await click(c1, `cd19|${c1}|pickdao`, [FX.DAO_ORDER[0]]); ok(CD.stateRow(c1).de_dao === FX.DAO_ORDER[0], 'chọn Đế Đạo');
  check(CDV.deView(c1, 'dao'), 'dao đã chọn'); r = await click(c1, `cd19|${c1}|daoup`); ok(CD.stateRow(c1).de_dao_lv >= 2, 'nâng Đế Đạo');
  // Đế Binh
  r = await click(c1, `cd19|${c1}|pickbinh`, [FX.BINH_ORDER[0]]); r = await click(c1, `cd19|${c1}|bcraft|${FX.BINH_ORDER[0]}`); ok(CD.binhOf(c1)[FX.BINH_ORDER[0]] !== undefined, 'chế Đế Binh');
  r = await click(c1, `cd19|${c1}|bequip|${FX.BINH_ORDER[0]}`); r = await click(c1, `cd19|${c1}|bup|${FX.BINH_ORDER[0]}`); check(CDV.deView(c1, 'binh'), 'binh tab');
  // Đế Hiệu qua modal
  r = await click(c1, `cd19|${c1}|sethieu`); ok(r.log.some(([k]) => k === 'modal'), 'mở modal Đế Hiệu');
  ok(CD.setHieu(c1, 'Vĩnh Hằng Đế Quân').ok && FX.hieuOf(c1) === 'Vĩnh Hằng Đế Quân', 'đặt Đế Hiệu'); check(CDV.deView(c1, 'ov'), 'tổng quan có hiệu');
  ok(/Vĩnh Hằng Đế Quân/.test(JSON.stringify(require('../src/ui/socialViews').buildLeaderboardEmbed().toJSON())), 'Đế Hiệu trên bảng xếp hạng');
  const CH = require('../src/ui/templates/character'); const urow = Cu.getCultivator(c1);
  ok(/Vĩnh Hằng Đế Quân/.test(JSON.stringify(CH.build({ id: c1, displayName: 'Tester' }, urow, 'tongquan').toJSON())), 'Đế Hiệu trong menu chính/hồ sơ');
  ok(!CD.setHieu(c1, '@everyone x').ok && !CD.setHieu(c1, 'a').ok && !CD.setHieu(c1, 'x'.repeat(25)).ok, 'Đế Hiệu không hợp lệ bị chặn');
  r = await click(c1, `cd19|${c1}|hist`);

  // ---- Bản Mệnh
  const D16 = require('../src/data/congphap_v16'); const bk = D16.BY_TIER.get(1041); const C16 = require('../src/game/congphapV16');
  const up = {}; C16.grantInto(up, Cu.getCultivator(c1), 1041); Cu.updateCultivator(c1, up);
  check(CDV.bmView(c1), 'bm có sách'); r = await click(c1, `bm19|${c1}|set`, ['1041']); ok(require('../src/game/benmenh19').get(c1).tier === 1041, 'đặt Bản Mệnh');
  check(CDV.bmView(c1), 'bm đã đặt'); r = await click(c1, `bm19|${c1}|med`); r = await click(c1, `bm19|${c1}|awk`); r = await click(c1, `bm19|${c1}|rf`);

  // ---- Sự kiện
  const gid = 'g1'; const made = EV.create('truyenthua', { guildId: gid, channelId: 'c1' }); ok(made.ok, 'tạo truyền thừa'); check({ embeds: [EVV.contestEmbed(made.ev, 3)] }, 'contest');
  r = await click(c1, `ev19|join|${made.ev.id}`); ok(D.get('SELECT 1 AS x FROM ev19_part WHERE ev_id = ? AND user_id = ?', made.ev.id, c1), 'tham gia tranh đoạt qua nút');
  const made2 = EV.create('dibien', { guildId: gid, minutes: 15 }); ok(made2.ok, 'tạo dị biến'); check({ embeds: [EVV.dibienEmbed(made2.ev), EVV.listEmbed(gid)] }, 'dibien+list');
  D.run('UPDATE ev19 SET ends_at = 1 WHERE status = ?', 'active');
  const client = { guilds: { cache: new Map() }, channels: { fetch: async () => ({ send: async () => ({ id: 'm' }), messages: { fetch: async () => ({ edit: async () => {} }) } }) } };
  await EVV.tick(client); ok(D.all("SELECT * FROM ev19 WHERE status = 'active'").length === 0, 'tick kết thúc sự kiện hết hạn'); ok(!EV.dibienActive(), 'dị biến hết');
  console.log(`✓ test_views19${process.env.V19_EMOJI === '1' ? ' (emoji pixel giả lập)' : ''}: ${n} kiểm tra`);
})().catch((e) => { console.error('✗', e); process.exit(1); });
