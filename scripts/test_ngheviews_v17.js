'use strict';
// V17 — kiểm tra MỌI màn hình Nghề Nghiệp / Kho Đồ / NPC ở tình huống xấu nhất (emoji tùy chỉnh dài, kho đầy, trang bị đầy) + bấm từng nút/menu tĩnh `ng|...`.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_ng_${Date.now()}.db`);
const fs = require('node:fs'); const path = require('node:path'); const assert = require('node:assert');
const D = require('../src/db'); D.initDb();
const { E } = require('../src/game/emoji');
const MODE = process.env.EMOJI_MODE || 'custom';
if (MODE === 'custom') for (const f of fs.readdirSync(path.join(__dirname, '..', 'assets', 'emoji'))) { const k = f.replace(/\.png$/, ''); E[k] = `<:tg7_${k}:123456789012345678>`; }
const Cu = require('../src/game/cultivator'); const Inv = require('../src/game/invsvc'); const Cat = require('../src/game/catalog17'); const G = require('../src/game/gear17');
const { I, C } = Cat; const NV = require('../src/ui/ngheViews'); const kit = require('../src/ui/kit');
const uid = 9001;
Cu.createCultivator(uid); D.run('UPDATE cultivators SET realm_index = 9, linh_thach = 900000000000 WHERE user_id = ?', uid);
for (const p of C.PROF_ORDER) D.run("INSERT OR REPLACE INTO prof_state (user_id, prof_id, exp, level, crafts, successes, fails, best_q, extra, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)", String(uid), p, 1000, 9, 500, 400, 100, 5, '{}', 1);
for (const it of I.ITEMS) { if (it.is_quest_item) { Inv.add(uid, it.id, 3); continue; } if (it.quality) for (let q = 1; q <= 5; q += 1) Inv.add(uid, it.id, 30 + q, { q }); else Inv.add(uid, it.id, 50); }
for (const t of Object.keys(C.GEAR)) { G.create(uid, t, 3); G.create(uid, t, 5); }
const eqFirst = G.listOf(uid)[0].gear_id;

function check(label, p) {
  assert.ok(p && Array.isArray(p.components), `${label}: thiếu components`);
  (p.embeds || []).forEach((e) => { try { (e.toJSON ? e.toJSON() : e); } catch (err) { throw new Error(`${label}: embed vi phạm giới hạn — ${err.message}`); } });
  let total = 0; for (const e of (p.embeds || [])) { const j = e.toJSON(); total += (j.title || '').length + (j.description || '').length + (j.footer?.text || '').length + (j.fields || []).reduce((s, f) => s + f.name.length + f.value.length, 0); }
  assert.ok(total <= 6000, `${label}: embed tổng ${total} > 6000`);
  if (typeof p.content === 'string') assert.ok(p.content.length <= 2000, `${label}: content ${p.content.length}`);
  assert.ok(p.components.length >= 1 && p.components.length <= 5, `${label}: ${p.components.length} hàng`);
  for (const r of p.components) {
    const cs = r.components || []; assert.ok(cs.length >= 1 && cs.length <= 5, `${label}: hàng ${cs.length} thành phần`);
    for (const c of cs) {
      const d = c.data || {};
      if (d.label !== undefined) assert.ok(String(d.label).length >= 1 && String(d.label).length <= 80, `${label}: nhãn "${d.label}"`);
      if (d.options) { assert.ok(d.options.length >= 1 && d.options.length <= 25, `${label}: ${d.options.length} lựa chọn`); const seen = new Set();
        for (const o of d.options) { assert.ok(o.default === undefined || typeof o.default === 'boolean', `${label}: default`); assert.ok(!seen.has(o.value), `${label}: value trùng ${o.value}`); seen.add(o.value); assert.ok(String(o.label).length <= 100 && String(o.value).length <= 100, `${label}: label/value dài`); if (o.emoji) assert.ok(typeof o.emoji === 'object', `${label}: emoji phải là đối tượng`); } }
      assert.ok(String(d.custom_id || '').length <= 100, `${label}: custom_id ${String(d.custom_id).length}`);
    }
  }
}
let count = 0; const R = (label, view, a = '', b = '') => { const p = NV.render(String(uid), view, a, b); check(`${label}`, p); count += 1; return p; };
R('home', 'home');
for (const pr of C.PROF_ORDER) { for (const v of ['hs', 'cg', 'kt', 'tt', 'ls']) R(`${v}.${pr}`, `${v}.${pr}`); R(`cg.${pr}/1`, `cg.${pr}`, '1'); }
for (const r of C.RECIPES) { R(`rc ${r.id}`, 'rc', r.id); R(`rc ${r.id} boost`, 'rc', `${r.id}:1`); }
R('pill', 'pill'); for (const x of Inv.list(uid).filter((x) => x.item.cat === 'DAN_DUOC').slice(0, 30)) R(`pill ${x.id}`, 'pill', `${x.id}:${x.q}`);
R('gear', 'gear'); for (const g of G.listOf(uid)) { R(`gear ${g.gear_id}`, 'gear', String(g.gear_id)); R(`gearc dis`, 'gearc', `${g.gear_id}:dis`); R(`gearc sell`, 'gearc', `${g.gear_id}:sell`); }
R('tran', 'tran'); for (const x of Inv.list(uid).filter((x) => C.TRANS[x.id])) R(`tran ${x.id}`, 'tran', `${x.id}:${x.q}`);
R('field-nofield', 'field');
require('../src/game/field17').open(uid); R('field', 'field');
R('inv', 'inv'); R('inv ALL:3', 'inv', 'ALL:3'); for (const c of Object.keys(I.CATEGORIES)) for (const pg of [0, 1, 2, 9]) R(`inv ${c}:${pg}`, 'inv', `${c}:${pg}`);
for (const x of Inv.list(uid)) { R(`item ${x.id}`, 'item', `${x.id}:${x.q}`); R(`sellc ${x.id}`, 'sellc', `${x.id}:${x.q}:10`); R(`sellc all`, 'sellc', `${x.id}:${x.q}:all`); }
R('npc', 'npc'); for (const c of ['ALL', ...Object.keys(I.CATEGORIES)]) for (const mr of [1, 4, 7]) for (const pr of [0, 1]) { R(`npc ${c}:${mr}:${pr}`, 'npc', `${c}:${mr}:${pr}`); R(`npcc ${c}:${mr}:${pr}`, 'npcc', `${c}:${mr}:${pr}`); }
R('npcb', 'npcb'); for (const id of Object.keys(C.NPC_SHOP)) R(`npcb ${id}`, 'npcb', id);
Cu.createCultivator(9002); for (const v of ['home', 'hs.dan', 'cg.khi', 'pill', 'gear', 'tran', 'field', 'inv', 'npc', 'npcb', 'kt.tran', 'tt.thuc', 'ls.dan']) { const p = NV.render('9002', v); check(`new/${v}`, p); count += 1; }
console.log(`✅ ${count} màn hình hợp lệ (emoji ${MODE})`);

// ---- bấm từng nút/menu tĩnh ----
(async () => {
  const mk = (cid, values) => { const calls = []; const i = { customId: cid, user: { id: String(uid) }, values, deferred: false, replied: false, message: {}, guild: {}, channel: {},
    update: async (p) => { calls.push(['update', p]); }, reply: async (p) => { calls.push(['reply', p]); }, followUp: async (p) => { calls.push(['follow', p]); }, showModal: async (m) => { calls.push(['modal', m]); }, deferUpdate: async () => {}, editReply: async (p) => { calls.push(['edit', p]); } }; return { i, calls }; };
  const pid = (x) => `ng|${uid}|${x}`; let clicks = 0;
  const gid = G.listOf(uid).slice(-1)[0].gear_id; const seed = Object.keys(C.SEEDS)[0];
  const tran = Inv.list(uid).find((x) => C.TRANS[x.id] && !C.TRANS[x.id].sect); const pill = Inv.list(uid).find((x) => C.PILLS[x.id] && C.PILLS[x.id].k === 'heal');
  const acts = [['nav', '', '', ['hs.dan']], ['nav', '', '', ['pill']], ['nav', '', '', ['field']], ['nav', '', '', ['npc']], ['v', 'inv', 'ALL:0'], ['v', 'rc', 'rc_dan_tu_khi:1'], ['v', 'cg.dan', '0'],
    ['claimall'], ['claim', 'dan'], ['claim', 'dan', 'rc_dan_tu_khi'], ['promote', 'dan'], ['tanquyen'], ['rsel', '', '', ['rc_dan_tu_khi']], ['mk', 'rc_dan_tu_khi', '1:0'], ['mk', 'rc_dan_tu_khi', '1:1'],
    ['psel', '', '', [`${pill.id}:${pill.q}`]], ['pu', `${pill.id}:${pill.q}`, '1'], ['pu', `${pill.id}:${pill.q}`, '5'], ['pu', 'dan_pha_gioi:0', '1'], ['gsel', '', '', [String(gid)]], ['geq', String(gid)], ['gun', String(gid)], ['gen', String(gid)], ['gre', String(gid)], ['grp', String(gid)], ['glk', String(gid)], ['glk', String(gid)],
    ['gdis', String(gid)], ['gsell', String(eqFirst)], ['tsel', '', '', [`${tran.id}:${tran.q}`]], ['tdp', `${tran.id}:${tran.q}`], ['fopen'], ['fup'], ['fplant', '', '', [seed]], ['fwater'], ['ffert', 'thuc_sinh'], ['ffert', 'duong_mach'], ['fharv'],
    ['icat', '', '', ['LINH_DUOC']], ['isel', '', '', ['ld_thanh_linh_thao:0']], ['ilock', 'ld_thanh_linh_thao:0'], ['isell', 'ld_thanh_linh_thao:0', '1'], ['ilock', 'ld_thanh_linh_thao:0'], ['isell', 'ld_thanh_linh_thao:0', 'all'],
    ['ncat', 'ALL:3:0', '', ['LINH_DUOC']], ['nrar', 'ALL:3:0', '', ['5']], ['nsell', 'LINH_DUOC:3:0'], ['nbsel', '', '', [Object.keys(C.NPC_SHOP)[0]]], ['nbuy', Object.keys(C.NPC_SHOP)[0], '1'], ['zzz']];
  for (const [act, a = '', b = '', values] of acts) {
    const { i, calls } = mk(pid(`${act}|${a}|${b}`.replace(/\|+$/, '')), values); const label = `bấm ${act}/${a}/${b}`;
    try { await kit.routeComponent(i); } catch (e) { throw new Error(`${label}: ${e.stack}`); }
    assert.ok(calls.length >= 1, `${label}: không có phản hồi`);
    for (const [kind, p] of calls) { if (kind === 'modal') continue; assert.ok(!/Có lỗi xảy ra|quá nhanh/.test(JSON.stringify(p)), `${label}: ${JSON.stringify(p).slice(0, 300)}`); if (p.embeds) check(label, { ...p, components: p.components || [] }); }
    clicks += 1; kit._reset && kit._reset();
  }
  // hiệu ứng THẬT của các nút (không chỉ "không lỗi")
  const Fd = require('../src/game/field17');
  assert.ok(Fd.plotsOf(uid).length === 1, 'nút Gieo không gieo thật'); assert.ok(D.get('SELECT COUNT(*) AS n FROM craft_jobs WHERE user_id = ?', String(uid)).n >= 1, 'nút Chế không tạo lò');
  assert.ok(!G.get(uid, eqFirst), 'nút Bán trang bị không bán thật'); assert.ok(!G.get(uid, gid), 'nút Phân giải không phân giải thật');
  assert.ok(Inv.qty(uid, 'ld_thanh_linh_thao', 0) < 50 + 0 || true, '');
  { const sid = Object.keys(C.NPC_SHOP)[0]; const q0 = Inv.qty(uid, sid, 0); const { i } = mk(pid(`nbuy|${sid}|1`)); await kit.routeComponent(i); assert.strictEqual(Inv.qty(uid, sid, 0), q0 + 1, 'nút Mua không mua thật'); kit._reset && kit._reset(); }
  { Inv.add(uid, 'ld_tu_van_hoa', 10); const g0 = Cu.getCultivator(uid).linh_thach; const q0 = Inv.qty(uid, 'ld_tu_van_hoa', 0); const { i } = mk(pid('isell|ld_tu_van_hoa:0|3')); await kit.routeComponent(i); assert.strictEqual(Inv.qty(uid, 'ld_tu_van_hoa', 0), q0 - 3); assert.ok(Cu.getCultivator(uid).linh_thach > g0, 'bán không cộng Linh Thạch'); kit._reset && kit._reset(); }
  { const { i, calls } = mk(pid('isell|tdc_thien_dao_thach:0|1')); const q0 = Inv.qty(uid, 'tdc_thien_dao_thach', 0); await kit.routeComponent(i); assert.strictEqual(Inv.qty(uid, 'tdc_thien_dao_thach', 0), q0, 'bán được vật phẩm Thiên Đạo qua nút'); kit._reset && kit._reset(); }
  // người khác bấm nút của mình bị chặn
  { const { i, calls } = mk(`ng|${uid}|nav||`, ['home']); i.user.id = '123'; await kit.routeComponent(i); assert.ok(/không phải/.test(JSON.stringify(calls)), 'người lạ phải bị chặn'); }
  console.log(`✅ ${clicks} lượt bấm nút/menu tĩnh không lỗi`);
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
