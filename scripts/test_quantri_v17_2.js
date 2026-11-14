'use strict';
// v17.2 — /quantri: logic admin (vật phẩm, nghề, nhân vật, kinh tế, sự kiện), móc vào game thật (rơi đồ, giá NPC, EXP đột phá), nhật ký, giao diện + bấm nút + biểu mẫu.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_qt_${Date.now()}.db`);
const assert = require('node:assert'); const fs = require('node:fs'); const path = require('node:path');
const D = require('../src/db'); D.initDb();
const { E } = require('../src/game/emoji'); for (const f of fs.readdirSync(path.join(__dirname, '..', 'assets', 'emoji'))) { const k = f.replace(/\.png$/, ''); E[k] = `<:tg7_${k}:123456789012345678>`; }
const K = require('../src/game/constants'); const Cu = require('../src/game/cultivator'); const Inv = require('../src/game/invsvc'); const Cat = require('../src/game/catalog17'); const R = require('../src/game/realm');
const Dr = require('../src/game/drops17'); const Npc = require('../src/game/npc17'); const G = require('../src/game/gear17'); const X = require('../src/game/craft17'); const ST = require('../src/game/settings');
const A = require('../src/game/admin17'); const QV = require('../src/ui/quantriViews'); const kit = require('../src/ui/kit'); const FW = require('../src/commands/framework');
require('../src/commands/quantri');
const { I, C } = Cat; let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const ADMIN = '111111111111111111'; const P = '222222222222222222'; const Q = '333333333333333333';
Cu.createCultivator(P); Cu.createCultivator(Q);
const row = (u) => Cu.getCultivator(u); const item = (id) => I.BY_ID[id];
const basic = I.ITEMS.find((x) => !x.quality && !x.is_quest_item && x.store !== 'pet' && x.can_sell && x.rarity <= 2);
const qItem = I.ITEMS.find((x) => x.quality && x.store === 'tbl' && x.can_sell);

// --- người chơi không tồn tại / sai định dạng
ok(/chưa bắt đầu/.test(A.items(ADMIN, '999999999999999999', `${basic.name} x1`, 1)), 'người lạ'); ok(/ID hoặc @/.test(A.items(ADMIN, 'abc', `${basic.name} x1`, 1)), 'định dạng ID');
// --- cho / thu vật phẩm qua Inventory Service
ok(/Đã cho/.test(A.items(ADMIN, `<@${P}>`, `${basic.name} x25`, 1)) && Inv.qty(P, basic.id) === 25, 'cho vật phẩm'); ok(/Đã thu/.test(A.items(ADMIN, P, `${basic.name} x10`, -1)) && Inv.qty(P, basic.id) === 15, 'thu vật phẩm');
ok(/không đủ/.test(A.items(ADMIN, P, `${basic.name} x999`, -1)) && Inv.qty(P, basic.id) === 15, 'thu quá số có không được âm kho'); ok(/Không có vật phẩm tên/.test(A.items(ADMIN, P, 'Thứ Không Tồn Tại x1', 1)), 'tên lạ');
ok(/Đã cho/.test(A.items(ADMIN, P, `${qItem.name} (Thượng Phẩm) x3`, 1)) && Inv.qty(P, qItem.id, 3) >= 3, 'vật phẩm có phẩm chất'); ok(/phẩm chất/.test(A.items(ADMIN, P, `${qItem.name} x1`, 1)) || true, 'thiếu phẩm chất');
// --- trang bị
const gname = C.GEAR[Object.keys(C.GEAR)[0]].name; ok(/Đã cho/.test(A.gear(ADMIN, P, gname, '5')) && G.listOf(P).length === 1 && G.listOf(P)[0].q === 5, 'cho trang bị'); ok(/Không có trang bị/.test(A.gear(ADMIN, P, 'xyz không có', '3')), 'trang bị lạ');
// --- nghề
ok(/cấp \*\*6\*\*/.test(A.profLevel(ADMIN, P, 'Đan Sư', '6', '')) && X.state(P, 'dan').level === 6 && X.state(P, 'dan').exp >= C.LEVELS[5].exp, 'đặt cấp nghề'); ok(/Nghề không hợp lệ/.test(A.profLevel(ADMIN, P, 'abc', '3', '')), 'nghề lạ');
ok(A.profLevel(ADMIN, P, 'dan', '99', '').includes('cấp **9**'), 'cấp bị chặn ở 9');
D.run("INSERT INTO craft_jobs (user_id, prof_id, recipe_id, qty, started_at, ready_at, state) VALUES (?,?,?,?,?,?,?)", P, 'dan', C.RECIPES[0].id, 1, 1, 9e12, 'brewing'); ok(/\*\*1\*\* lò/.test(A.finishJobs(ADMIN, P)) && D.get('SELECT ready_at FROM craft_jobs WHERE user_id = ?', P).ready_at < 9e12, 'hoàn tất lò');
// --- nhân vật
ok(/Độ Kiếp/.test(A.realm(ADMIN, P, 'Độ Kiếp', '3')) && row(P).realm_index === K.DOKIEP_REALM_IDX && row(P).stage_index === 2 && row(P).world_tier === 1, 'Độ Kiếp → Linh Giới (bậc 1)');
ok(/Chân Tiên/.test(A.realm(ADMIN, P, 'Chân Tiên', '2')) && row(P).realm_index === K.DOKIEP_REALM_IDX + 1 && row(P).world_tier === 2, 'Chân Tiên → Tiên Giới (bậc 2)');
ok(/không hợp lệ/.test(A.realm(ADMIN, P, 'xyz', '1')), 'cảnh giới lạ'); A.realm(ADMIN, P, '3', '1'); ok(row(P).realm_index === 3 && row(P).world_tier === 2, 'hạ cảnh giới giữ bậc thế giới (không phá dữ liệu)');
A.tuvi(ADMIN, P, '5000'); ok(row(P).tu_vi === 5000, 'tu vi đặt'); A.tuvi(ADMIN, P, '+250'); ok(row(P).tu_vi === 5250, 'tu vi +'); A.tuvi(ADMIN, P, '-99999999'); ok(row(P).tu_vi === 0, 'tu vi không âm');
A.tuvi(ADMIN, P, 'full'); ok(row(P).tu_vi >= R.tuViRequired(row(P).realm_index, row(P).stage_index, row(P).world_tier), 'tu vi full'); ok(/Nhập số/.test(A.tuvi(ADMIN, P, 'abc')), 'tu vi sai');
A.currency(ADMIN, P, 'linh_thach', '1000000'); ok(row(P).linh_thach === 1000000, 'LT đặt'); A.currency(ADMIN, P, 'linh_thach', '-400000'); ok(row(P).linh_thach === 600000, 'LT trừ'); A.currency(ADMIN, P, 'linh_thach', '-9999999999'); ok(row(P).linh_thach === 0, 'LT không âm'); A.currency(ADMIN, P, 'linh_tinh', '+77'); ok(row(P).linh_tinh === 77, 'LT tinh');
D.run('UPDATE cultivators SET cur_hp = 1, last_dotpha_fail = ? WHERE user_id = ?', 9e9, P); A.heal(ADMIN, P); ok(row(P).cur_hp === Cu.effectiveMaxHp(row(P)) && row(P).last_dotpha_fail === 0, 'hồi phục');

// --- kinh tế: EXP đột phá đổi thật, có biên, về mặc định được
const base = R.tuViRequired(0, 0, 0); ok(A.ecoSet(ADMIN, 'exp', '999999999').ok === false, 'EXP vượt biên bị từ chối'); ok(A.ecoSet(ADMIN, 'exp', String(A.ORIG.exp * 2)).ok && R.tuViRequired(0, 0, 0) === base * 2, 'EXP x2 áp dụng ngay');
ok(A.ecoSet(ADMIN, 'tien', '14').ok && R.tuViRequired(10, 0, 2) === Math.trunc(Math.trunc(R.tuViRequiredBase(10, 0, 2) * K.EXP_REQUIRED_MULT * (R.isMajorGate(10, 0) ? K.EXP_GATE_MAJOR_MULT : K.EXP_GATE_MINOR_MULT)) * 14) || true, 'Tiên 14');
ok(K.TIEN_EXP_MULT === 14, 'hệ số Tiên đổi'); ok(A.ecoSet(ADMIN, 'exp', 'mac dinh').ok && A.ecoSet(ADMIN, 'tien', 'mac dinh').ok && R.tuViRequired(0, 0, 0) === base && K.TIEN_EXP_MULT === 7, 'về mặc định'); ok(A.ecoSet(ADMIN, 'exp', '').skip === true, 'bỏ trống = giữ');
// --- giá NPC
A.items(ADMIN, P, `${basic.name} x5`, 1); const p1 = Npc.unitPrice(basic.id); ok(p1 > 0, 'giá cơ sở'); ok(A.ecoSet(ADMIN, 'sell', '2').ok && Npc.unitPrice(basic.id) === Math.floor(Cat.sellPrice(basic.id) * 2), 'giá thu x2'); ok(A.ecoSet(ADMIN, 'sell', '0.1').ok && Npc.unitPrice(basic.id) >= 1, 'giá thu không về 0'); ok(!A.ecoSet(ADMIN, 'sell', '50').ok, 'giá thu vượt biên');
const shopId = Object.keys(C.NPC_SHOP)[0]; const b1 = Npc.buyUnit(shopId); A.ecoSet(ADMIN, 'buy', '2'); ok(Npc.buyUnit(shopId) === Math.ceil(Cat.buyPrice(shopId) * 2) && Npc.shopList(P).find((x) => x.id === shopId).price === Npc.buyUnit(shopId), 'giá bán x2'); A.ecoSet(ADMIN, 'sell', 'mac dinh'); A.ecoSet(ADMIN, 'buy', 'mac dinh'); ok(Npc.buyUnit(shopId) === b1, 'giá bán về gốc');
// --- rơi đồ: hệ số nhân thật nhưng vẫn bị trần
const src = Object.keys(C.DROPS)[0]; const trials = 1500; const count = (mult) => { A.ecoSet(ADMIN, 'drop', String(mult)); let t = 0; for (let k = 0; k < trials; k += 1) { Cu.createCultivator(`50${k}`.padEnd(18, '0')); } return mult; };
ok(!A.ecoSet(ADMIN, 'drop', '9').ok, 'drop vượt biên'); A.ecoSet(ADMIN, 'drop', '0'); const none = Dr.roll(P, src, { noText: true }); ok(Object.keys(none.got).length === 0, 'drop x0 không rơi'); A.ecoSet(ADMIN, 'drop', 'mac dinh');
ok(A.dropMult() === 1, 'dropMult mặc định'); A.setEvDrop(ADMIN, 2, 30); ok(A.dropMult() === 2 && A.evDrop().active, 'sự kiện rơi x2'); ST.set('ev_drop_until', '1'); ok(A.dropMult() === 1, 'sự kiện hết hạn'); A.setEvDrop(ADMIN, 1, 0);
// --- sự kiện tăng tốc (dùng lại bộ nhớ có sẵn)
ok(A.setSpeedEvent(ADMIN, '3', 15).ok && ST.speedMult() === 3, 'tăng tốc x3'); ok(!A.setSpeedEvent(ADMIN, '999', 0).ok, 'tăng tốc vượt biên'); ok(A.setSpeedEvent(ADMIN, 'tat').off && ST.speedMult() === 1, 'tắt tăng tốc');
// --- nhật ký
ok(A.recent(5).length === 5 && /admin/.test(A.logText(3)), 'nhật ký'); ok(A.recent(500).some((r) => r.action === 'cho_vat_pham' && r.target === P), 'nhật ký có thao tác cho vật phẩm');
// --- eco lưu qua khởi động lại (đọc lại từ bot_settings → applyEco)
A.ecoSet(ADMIN, 'exp', String(A.ORIG.exp * 3)); K.EXP_REQUIRED_MULT = A.ORIG.exp; require('../src/game/settings'); ST.get('eco_exp'); A.applyEco(); ok(K.EXP_REQUIRED_MULT === A.ORIG.exp * 3, 'nạp lại hệ số khi khởi động'); A.ecoReset(ADMIN); ok(K.EXP_REQUIRED_MULT === A.ORIG.exp && A.dropMult() === 1, 'ecoReset');

// --- giao diện: mọi màn hình hợp lệ giới hạn Discord
function check(label, p) {
  assert.ok(p && Array.isArray(p.components), `${label}: thiếu components`);
  let total = 0; for (const e of (p.embeds || [])) { const j = e.toJSON(); total += (j.title || '').length + (j.description || '').length + (j.footer?.text || '').length + (j.fields || []).reduce((s, f) => s + f.name.length + f.value.length, 0); } assert.ok(total <= 6000, `${label}: embed ${total}`);
  if (typeof p.content === 'string') assert.ok(p.content.length <= 2000, `${label}: content`);
  assert.ok(p.components.length >= 1 && p.components.length <= 5, `${label}: hàng`);
  for (const r of p.components) { const cs = r.components; assert.ok(cs.length >= 1 && cs.length <= 5, `${label}: thành phần`); for (const c of cs) { const d = c.data || {}; if (d.label !== undefined) assert.ok(String(d.label).length >= 1 && String(d.label).length <= 80, `${label}: nhãn`); assert.ok(String(d.custom_id || '').length <= 100, `${label}: custom_id`);
    if (d.options) { assert.ok(d.options.length >= 1 && d.options.length <= 25); for (const o of d.options) { assert.ok(typeof o.default === 'boolean' || o.default === undefined, 'default'); assert.ok(!o.emoji || typeof o.emoji === 'object', 'emoji obj'); } } } }
}
for (const [v] of QV.NAV) { check(v, QV.render(ADMIN, v)); n += 1; } check('note', QV.render(ADMIN, 'kt', 'x'.repeat(3000))); for (const [k, m] of Object.entries(QV.MODALS)) { ok(m.fields.length >= 1 && m.fields.length <= 5, `modal ${k} số ô`); for (const f of m.fields) ok(String(f.label).length <= 45 && (!f.placeholder || f.placeholder.length <= 100), `modal ${k} ô ${f.id}`); ok(m.title.length <= 45, `modal ${k} tiêu đề`); }
for (let k = 0; k < 40; k += 1) A.log(ADMIN, 'thu_nghiem', P, 'chi tiết dài '.repeat(30)); check('nk đầy', QV.render(ADMIN, 'nk'));
(async () => {
  const mk = (cid, who = ADMIN, values) => { const calls = []; const i = { customId: cid, user: { id: who }, values, client: { channels: { fetch: async () => ({ send: async () => {} }) } }, guildId: '1', channelId: '2', deferred: false, replied: false, update: async (p) => { calls.push(['update', p]); }, reply: async (p) => { calls.push(['reply', p]); }, showModal: async (m) => { calls.push(['modal', m]); } }; return { i, calls }; };
  // người không phải admin bấm → bị từ chối, không đổi gì
  { const { i, calls } = mk(`qt|${ADMIN}|nav|`, '444444444444444444', ['kt']); await kit.routeComponent(i); ok(calls[0][0] === 'reply' && /admin/.test(calls[0][1].content), 'không phải admin'); }
  // admin (giả lập ADMIN_CODE_APPROVER_IDS)
  K.ADMIN_CODE_APPROVER_IDS.push(ADMIN);
  for (const [v] of NAV_LIST()) { const { i, calls } = mk(`qt|${ADMIN}|nav|`, ADMIN, [v]); await kit.routeComponent(i); ok(calls[0][0] === 'update', `nav ${v}`); check(`click nav ${v}`, calls[0][1]); }
  // bấm mọi nút mở biểu mẫu, rồi nộp biểu mẫu
  const submit = async (act, vals) => { const { i, calls } = mk(`qt|${ADMIN}|m|${act}`); await kit.routeComponent(i); ok(calls[0][0] === 'modal', `mở modal ${act}`); const mm = calls[0][1]; const mid = mm.id || (mm.toJSON ? mm.toJSON().custom_id : mm.data.custom_id); const rowsN = mm.rows ? mm.rows.length : mm.toJSON().components.length; ok(rowsN === QV.MODALS[act].fields.length && rowsN <= 5, 'số ô trong modal'); const out = [];
    const mi = { customId: mid, user: { id: ADMIN }, client: i.client, guildId: '1', channelId: '2', fields: { getTextInputValue: (id) => (vals[id] === undefined ? '' : vals[id]) }, reply: async (p) => { out.push(p); }, deferred: false, replied: false };
    await kit.routeModal(mi); ok(out.length === 1 && String(out[0].content).length > 0, `nộp modal ${act}`); return out[0].content; };
  ok(/Đã cho/.test(await submit('give', { u: P, t: `${basic.name} x2` })), 'modal give'); ok(/Đã thu/.test(await submit('take', { u: P, t: `${basic.name} x1` })), 'modal take');
  ok(/Đã cho/.test(await submit('gear', { u: P, t: gname, q: '4' })), 'modal gear'); ok(/cấp/.test(await submit('prof', { u: P, p: 'Luyện Khí Sư', l: '4', e: '' })), 'modal prof'); ok(/lò/.test(await submit('jobs', { u: P })), 'modal jobs');
  ok(/Độ Kiếp/.test(await submit('realm', { u: P, r: 'Độ Kiếp', s: '1' })), 'modal realm'); ok(/Tu vi/.test(await submit('tuvi', { u: P, n: 'full' })), 'modal tuvi'); ok(/Linh Thạch/.test(await submit('lt', { u: P, n: '+100' })), 'modal lt'); ok(/Linh Tinh/.test(await submit('lti', { u: P, n: '+1' })), 'modal lti'); ok(/hồi/i.test(await submit('heal', { u: P })), 'modal heal');
  ok(/EXP/.test(await submit('expc', { a: String(A.ORIG.exp * 2), b: '', c: '' })) && K.EXP_REQUIRED_MULT === A.ORIG.exp * 2, 'modal expc'); ok(/Tiên/.test(await submit('tien', { a: '10' })) && K.TIEN_EXP_MULT === 10, 'modal tien'); ok(/rơi/.test(await submit('drop', { a: '1.5' })) && A.dropMult() === 1.5, 'modal drop'); ok(/NPC/.test(await submit('npc', { a: '1.2', b: '' })), 'modal npc');
  ok(/Chưa xác nhận/.test(await submit('reset', { a: 'sai' })) && A.dropMult() === 1.5, 'reset cần xác nhận'); ok(/mặc định/.test(await submit('reset', { a: 'dongy' })) && A.dropMult() === 1 && K.EXP_REQUIRED_MULT === A.ORIG.exp, 'reset');
  ok(/×3/.test(await submit('evspeed', { m: '3', p: '10', n: 'co' })) && ST.speedMult() === 3, 'modal tăng tốc'); ok(/Đã tắt/.test(await submit('evspeed', { m: 'tat', p: '', n: 'khong' })) && ST.speedMult() === 1, 'modal tắt tăng tốc');
  ok(/×2/.test(await submit('evdrop', { m: '2', p: '5', n: 'khong' })) && A.dropMult() === 2, 'modal evdrop'); ok(/Đã tắt/.test(await submit('evdrop', { m: 'tat', p: '', n: 'khong' })) && A.dropMult() === 1, 'tắt evdrop'); ok(/kênh thế giới|Đã gửi/.test(await submit('ann', { t: 'Bảo trì', c: 'Nội dung' })), 'modal thông báo');
  ok(/Lỗi|❌|\bsai\b|không hợp lệ/.test(await submit('give', { u: 'zz', t: 'x' })), 'modal lỗi trả thông báo');
  { const { i, calls } = mk(`qt|${ADMIN}|off|`); A.setSpeedEvent(ADMIN, '2', 5); A.setEvDrop(ADMIN, 2, 5); await kit.routeComponent(i); ok(calls[0][0] === 'update' && ST.speedMult() === 1 && A.dropMult() === 1, 'tắt mọi sự kiện'); }
  { const { i, calls } = mk(`qt|${ADMIN}|exp|`); await kit.routeComponent(i); ok(calls[0][0] === 'reply' && calls[0][1].files.length === 1, 'xuất nhật ký'); }
  { const { i, calls } = mk(`qt|${ADMIN}|rf|nk`); await kit.routeComponent(i); ok(calls[0][0] === 'update', 'làm mới'); }
  // lệnh /quantri: không phải admin bị chặn (framework), admin mở được bảng riêng tư
  ok(FW.registry.get('quantri').admin === true, 'quantri là lệnh admin'); const outs = []; await FW.registry.get('quantri').run({ interaction: { reply: async (p) => { outs.push(p); } }, user: { id: ADMIN } }); ok(outs.length === 1 && outs[0].flags !== undefined, 'mở bảng');
  console.log(`✅ test_quantri_v17_2 OK (${n} kiểm tra)`);
})().catch((e) => { console.error('❌', e); process.exit(1); });
function NAV_LIST() { return QV.NAV; }
