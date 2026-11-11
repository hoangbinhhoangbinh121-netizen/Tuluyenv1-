'use strict';
// v14.3 — kiểm tra GIỚI HẠN Discord của mọi màn hình /linhthu ở tình huống xấu nhất:
// emoji tùy chỉnh dạng <:tg7_pet_xxx:123456789012345678> (dài ~45 ký tự), 30 thú ở Viên, 10 trứng, thú hoang, tên thú dài nhất, kho vật phẩm đầy.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_pv_${Date.now()}.db`);
const fs = require('node:fs'); const path = require('node:path'); const assert = require('node:assert');
const D = require('../src/db'); D.initDb();
const { E } = require('../src/game/emoji');
const MODE = process.env.EMOJI_MODE || 'custom';   // custom = <:tg7_x:id> dài ~45 ký tự · unicode = emoji dự phòng khi chưa tải lên Discord
if (MODE === 'custom') for (const f of fs.readdirSync(path.join(__dirname, '..', 'assets', 'emoji'))) { const k = f.replace(/\.png$/, ''); E[k] = `<:tg7_${k}:123456789012345678>`; }
const Cu = require('../src/game/cultivator'); const P = require('../src/game/pets'); const PB = require('../src/game/petBalance'); const PD = require('../src/game/petData');
const V = require('../src/ui/petViews');
const uid = 777;
Cu.createCultivator(uid); D.run('UPDATE cultivators SET realm_index = 8 WHERE user_id = ?', uid);
P.ensureMigrated(uid);
const ids = PD.ORDER; const longNick = 'Tên Rất Dài Của Linh Thú'.repeat(3);
let n = 0; const all = [];
for (const slot of ['bm', 'dh1', 'dh2']) all.push(P.grantPet(uid, ids[(n++ * 7) % ids.length], { level: 60, bond: 90, purity: 100, contract: slot === 'bm' ? 'ban_menh' : 'binh_dang', slot }));
while (P.countVien(uid) < PB.VIEN_CAPACITY) all.push(P.grantPet(uid, ids[(n++ * 11) % ids.length], { level: 1 + (n % 90), purity: n % 100, contract: n % 3 ? 'chu_to' : '' }));
for (const id of all) P.rename(uid, id, longNick);
D.run('UPDATE pets SET fighter = 1 WHERE pet_id = ?', all[0]);
for (let i = 0; i < PB.EGG_CAPACITY; i += 1) D.run("INSERT INTO pet_eggs (owner, species, tier, purity, hatch_at, source, created_at) VALUES (?, ?, ?, 30, ?, 't', 0)", String(uid), ids[(i * 5) % ids.length], 1 + (i % 9), Date.now() / 1000 + 99999);
for (const k of PB.ITEM_ORDER) P.addItem(uid, k, 123456789);
D.run('INSERT OR REPLACE INTO pet_wild (owner, species, level, purity, src, expires_at) VALUES (?, ?, 50, 60, 0, ?)', String(uid), ids[44], Math.floor(Date.now() / 1000) + 3000);

function check(label, payload) {
  assert.ok(payload && Array.isArray(payload.components), `${label}: thiếu components`);
  (payload.embeds || []).forEach((e) => { try { (e.toJSON ? e.toJSON() : e); } catch (err) { throw new Error(`${label}: embed vi phạm giới hạn — ${err.message}`); } });
  if (typeof payload.content === 'string') assert.ok(payload.content.length <= 2000, `${label}: content ${payload.content.length}`);
  assert.ok(payload.components.length <= 5, `${label}: quá 5 hàng`);
  for (const r of payload.components) {
    const cs = r.components || []; assert.ok(cs.length >= 1 && cs.length <= 5, `${label}: hàng ${cs.length} thành phần`);
    for (const c of cs) {
      const d = c.data || {};
      if (d.label !== undefined) assert.ok(String(d.label).length >= 1 && String(d.label).length <= 80, `${label}: nhãn nút "${d.label}"`);
      if (d.options) {
        assert.ok(d.options.length >= 1 && d.options.length <= 25, `${label}: ${d.options.length} lựa chọn`);
        for (const o of d.options) { assert.ok(o.default === undefined || typeof o.default === 'boolean', `${label}: option.default phải là boolean, đang là ${JSON.stringify(o.default)}`); assert.ok(typeof o.label === 'string' && typeof o.value === 'string', `${label}: label/value phải là chuỗi`); assert.ok(o.description === undefined || (typeof o.description === 'string' && o.description.length >= 1), `${label}: description rỗng`); assert.ok(o.emoji === undefined || (typeof o.emoji === 'object' && (o.emoji.name || o.emoji.id)), `${label}: emoji của option phải là đối tượng, đang là ${JSON.stringify(o.emoji)}`); assert.ok(o.label.length >= 1 && o.label.length <= 100, `${label}: option label ${o.label.length}`); assert.ok(!o.description || o.description.length <= 100, `${label}: option desc ${o.description.length}`); assert.ok(String(o.value).length <= 100); }
      }
      assert.ok(String(d.custom_id || '').length <= 100, `${label}: custom_id ${String(d.custom_id).length}`);
    }
  }
}
const rows = P.listPets(uid); const first = rows[0].pet_id; const mid = rows[10].pet_id; const last = rows[rows.length - 1].pet_id;
let count = 0;
for (const tab of ['ov', 'ls', 'kh', 'nd', 'th', 'kn', 'hm', 'xc', 'sh']) {
  for (const pid of tab === 'ov' || tab === 'xc' || tab === 'sh' ? [0] : [first, mid, last]) {
    for (const arg of ['', '1', 'ban_menh', 'chu_to', 'binh_dang', 'alt', 'main']) {
      try { check(`${tab}/${pid}/${arg || '-'}`, V.render(uid, tab, pid, arg)); count += 1; } catch (e) { if (/vi phạm|quá|nhãn|option|hàng|content|custom_id|thiếu/.test(e.message)) throw e; throw new Error(`${tab}/${pid}/${arg}: ${e.stack}`); }
    }
  }
}
// người chơi mới chưa có thú + mọi tab
Cu.createCultivator(778); for (const tab of ['ov', 'ls', 'kh', 'nd', 'th', 'kn', 'hm', 'xc', 'sh']) { check(`new/${tab}`, V.render(778, tab, 0, '')); count += 1; }
// ---- bấm TỪNG nút/menu tĩnh `lt|...` như người chơi thật: không được ném lỗi, mọi phản hồi phải qua kiểm tra giới hạn ----
const kit = require('../src/ui/kit');
(async () => {
  const mk = (cid, values) => { const calls = []; const i = { customId: cid, user: { id: String(uid) }, values, deferred: false, replied: false, message: {}, guild: {}, channel: {},
    update: async (p) => { calls.push(['update', p]); }, reply: async (p) => { calls.push(['reply', p]); }, followUp: async (p) => { calls.push(['follow', p]); }, showModal: async (m) => { calls.push(['modal', m]); }, deferUpdate: async () => {}, editReply: async (p) => { calls.push(['edit', p]); } }; return { i, calls }; };
  const pet = rows[2].pet_id; const sac = rows[5].pet_id; let clicks = 0;
  const acts = [['nav', pet, '', ['kh']], ['nav', pet, '', ['hm']], ['rf', pet, 'ls'], ['psel', 0, 'kn:', [String(pet)]], ['psel', 0, 'ls', [String(mid)]], ['esel', pet, '', ['main']], ['esel', pet, '', ['Kim']], ['ssel', pet, '', [String(sac)]], ['shsel', 0, '', ['luong']], ['shop', 0, ''],
    ['hatch', 0, ''], ['rush', 0, ''], ['cap', 0, 'pl'], ['cap', 0, ''], ['sign', pet, 'binh_dang'], ['sign', pet, 'chu_to'], ['sign', pet, 'ban_menh'], ['brk', pet, ''], ['fd', pet, 'luong:1'], ['fd', pet, 'luong:10'], ['play', pet, ''],
    ['evo', pet, 'main'], ['evo', pet, 'Kim'], ['upg', pet, 'a1'], ['upg', pet, 'p1'], ['ref', pet, ''], ['inh', pet, `${sac}:`], ['fgt', pet, ''], ['nofgt', pet, ''], ['buy', 0, 'luong:1'], ['rel', pet, ''], ['rnm', pet, ''], ['zzz', 0, '']];
  for (const [act, pid, arg, values] of acts) {
    const { i, calls } = mk(`lt|${uid}|${act}|${pid}|${arg}`, values); const label = `bấm ${act}/${arg}`;
    try { await kit.routeComponent(i); } catch (e) { throw new Error(`${label}: ${e.stack}`); }
    assert.ok(calls.length >= 1, `${label}: không có phản hồi`);
    for (const [kind, p] of calls) { if (kind === 'modal') continue; assert.ok(!/Có lỗi xảy ra|quá nhanh/.test(JSON.stringify(p)), `${label}: ${JSON.stringify(p).slice(0, 200)}`); if (p.embeds) check(label, { ...p, components: p.components || [] }); }
    clicks += 1; kit._reset && kit._reset();
  }
  console.log(`✅ ${clicks} lượt bấm nút/menu tĩnh không lỗi`);
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
console.log(`✅ test_petviews_limits_v14_3 OK (${count} màn hình, ${all.length} thú, emoji ${MODE})`);

// ---- đường lệnh tiền tố `!linhthu` (ctx.send(render)) với dữ liệu xấu nhất ----
(async () => {
  const F = require('../src/commands/framework'); require('../src/commands/pets');
  const sent = [];
  const msg = { author: { id: String(uid), bot: false }, content: '!linhthu', guild: { id: 'g1' }, channel: {}, mentions: { users: new Map() }, member: { permissions: { has: () => false } }, attachments: new Map(), reply: async (p) => { sent.push(p); return p; } };
  await F.handlePrefix(msg, ['!']);
  assert.ok(sent.length === 1, 'không có phản hồi'); const p = sent[0];
  assert.ok(!/Có lỗi xảy ra|⚠️/.test(JSON.stringify(p).slice(0, 400)), JSON.stringify(p).slice(0, 300));
  check('!linhthu', p); console.log('✅ !linhthu (lệnh tiền tố) không lỗi');
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
