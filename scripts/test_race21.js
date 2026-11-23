'use strict';
// V21.5 — CHỦNG TỘC: DB/migration, chọn/đổi tộc, thức tỉnh, huyết mạch, tiến hóa, atomic + rollback, double-click, tương thích người chơi cũ (V21.4), stat snapshot, UI (nút thật, strict).
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_race215_${Date.now()}.db`);
process.env.TG_STRICT_UI = '1';
const assert = require('node:assert'); const fs = require('node:fs'); const path = require('node:path');
const D = require('../src/db'); D.initDb();
const { E } = require('../src/game/emoji'); for (const f of fs.readdirSync(path.join(__dirname, '..', 'assets', 'emoji'))) { const k = f.replace(/\.png$/, ''); E[k] = `<:tg7_${k}:123456789012345678>`; }
const Cu = require('../src/game/cultivator'); const T = require('../src/game/talent'); const SS = require('../src/game/stat21'); const C21 = require('../src/game/combat21');
const RC = require('../src/game/race21'); const R = require('../src/data/race21'); const kit = require('../src/ui/kit'); const RV = require('../src/ui/raceViews'); const { normalizePayload } = require('../src/ui/skin');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const U = (k) => `400000000000000${String(k).padStart(4, '0')}`;
const mk = (k, o = {}) => { const u = U(k); Cu.createCultivator(u); Cu.updateCultivator(u, { realm_index: 8, stage_index: 1, world_tier: 1, atk: 4000, def_: 3000, spd: 1000, hp: 50000, cur_hp: 50000, linh_thach: 1e9, ...o }); return u; };
const lt = (u) => Cu.getCultivator(u).linh_thach; const st = (u) => RC.get(u); const hist = (u) => D.all('SELECT * FROM race_history WHERE user_id = ? ORDER BY event_id', u);
const stats = (u) => { const r = Cu.getCultivator(u); return [Cu.effectiveAtk(r), Cu.effectiveDef(r), Cu.effectiveSpd(r), Cu.effectiveMaxHp(r), Cu.calcLucChien(r)]; };
const fake = (uid, customId, values, extra = {}) => { const log = []; const i = { customId, user: { id: String(uid), username: 'u' + uid }, member: { displayName: 'U' + uid }, values, guildId: 'g1', channelId: 'c1', guild: { id: 'g1', members: { cache: { get: () => ({}) }, fetch: async () => ({}) } }, client: {}, deferred: false, replied: false,
  update: async (p) => { normalizePayload(p, { edit: true }); i.replied = true; log.push(['update', p]); }, editReply: async (p) => { normalizePayload(p, { edit: true }); log.push(['edit', p]); }, reply: async (p) => { normalizePayload(p); i.replied = true; log.push(['reply', p]); }, followUp: async (p) => { normalizePayload(p); log.push(['follow', p]); },
  fetchReply: async () => ({ id: '999', edit: async () => {} }), ...extra }; i.log = log; return i; };
const txt = (i) => i.log.map(([, p]) => (typeof p === 'string' ? p : (p.content || '') + JSON.stringify((p.embeds || []).map((e) => (e.toJSON ? e.toJSON() : e))))).join(' | ');
const route = async (uid, cid, values, extra) => { const i = fake(uid, cid, values, extra); const r = await kit.routeComponent(i); i.routed = r; return i; };
const cids = (comps) => comps.flatMap((r) => (r.toJSON ? r.toJSON() : r).components.map((c) => c.custom_id));
const click = async (uid, cidKey, comps, values) => { const id = cids(comps).find((x) => x.endsWith(`|${cidKey}`)); assert.ok(id, `không có nút ${cidKey}`); await sleep(450); return route(uid, id, values); };   // 450ms > 0,4s chống spam → hành vi người thật

(async () => {
  // ================= 1) DB / migration
  for (const t of ['race_state', 'race_history']) ok(D.get("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", t), `bảng ${t} tồn tại`);
  D.migrate(); D.migrate(); ok(true, 'migrate() chạy lại nhiều lần không lỗi');
  // ================= 2) người chơi cũ (chưa chọn tộc) KHÔNG đổi gì so với V21.4
  const old = mk(1); T.bundle(Cu.getCultivator(old));
  ok(!T.bundle(Cu.getCultivator(old)).sources.some((s) => s.kind === 'Chủng Tộc'), 'chưa chọn tộc ⇒ không có nguồn Chủng Tộc'); ok(RC.fxOf(Cu.getCultivator(old)) === null, 'fxOf = null');
  const before = stats(old); ok(SS.snapshot(Cu.getCultivator(old)).check.ok, 'stat snapshot khớp (người chơi cũ)');
  // ================= 3) chọn tộc: miễn phí, đúng 1 lần, ghi lịch sử — cho cả 6 tộc
  for (const id of R.ORDER) {
    const u = mk(10 + R.ORDER.indexOf(id)); const L0 = lt(u);
    const r = RC.choose(u, id); ok(r.ok && st(u).race_id === id, `${id}: chọn tộc`); ok(lt(u) === L0, `${id}: miễn phí`);
    ok(!RC.choose(u, id).ok && !RC.choose(u, R.ORDER.find((x) => x !== id)).ok, `${id}: chọn lần 2 bị từ chối`); ok(hist(u).length === 1 && hist(u)[0].event_type === 'choose', `${id}: 1 dòng lịch sử`);
    const fx = RC.fxOf(Cu.getCultivator(u)); for (const [k, v] of Object.entries(R.RACES[id].passive.fx)) ok(Math.abs(fx.fx[k] - v) < 1e-9, `${id}: nội tại ${k} = ${v} (giai đoạn 0)`);
    const b = T.bundle(Cu.getCultivator(u)); ok(b.sources.some((s) => s.kind === 'Chủng Tộc'), `${id}: có trong talent.bundle`);
    ok(SS.snapshot(Cu.getCultivator(u)).check.ok, `${id}: stat21 snapshot vẫn khớp Cu.effective*`);
    // mọi khoá hiệu ứng hợp lệ & chặn trần
    for (const part of [R.RACES[id].passive.fx, R.RACES[id].evolved.fx, ...Object.values(R.RACES[id].bloodlines).map((x) => x.fx)]) for (const k of Object.keys(part)) ok(k in T.CAPS, `${id}: khoá ${k} ∈ CAPS`);
    ok(RC.choose(u, 'khong_co').ok === false, 'tộc không tồn tại bị từ chối');
  }
  ok(!RC.choose('999', 'nhan').ok, 'chưa có nhân vật → từ chối');
  // chọn tộc làm đổi chỉ số đúng hướng (Ma: công ↑, thủ ↓)
  const ma = U(15); const base = mk(40); RC.choose(base, 'ma'); const sB = stats(base); const sO = stats(mk(41));
  ok(sB[0] > sO[0] && sB[1] < sO[1], 'Ma Tộc: công cao hơn, thủ thấp hơn người không tộc cùng chỉ số gốc'); ok(stats(old).join() === before.join(), 'người chơi cũ không đổi chỉ số');
  // ================= 4) thức tỉnh: điều kiện, chi phí đúng, không trừ khi thất bại
  let u = mk(50, { realm_index: 1, world_tier: 0, linh_thach: 1e9 }); RC.choose(u, 'long');
  let L = lt(u); let r = RC.awaken(u); ok(!r.ok && lt(u) === L && st(u).awakening_stage === 0 && /Cảnh giới/.test(r.msg), 'thiếu cảnh giới → không trừ, không đổi');
  Cu.updateCultivator(u, { realm_index: 8, world_tier: 1, linh_thach: 50 }); r = RC.awaken(u); ok(!r.ok && lt(u) === 50, 'thiếu Linh Thạch → không trừ');
  Cu.updateCultivator(u, { linh_thach: 1e9 }); const fx0 = RC.fxOf(Cu.getCultivator(u)).fx.hp;
  for (let s = 0; s < 3; s++) { L = lt(u); r = RC.awaken(u); ok(r.ok && st(u).awakening_stage === s + 1 && lt(u) === L - R.AWAKEN[s].thach, `thức tỉnh → ${s + 1}: trừ đúng ${R.AWAKEN[s].thach}`); }
  ok(!RC.awaken(u).ok && st(u).awakening_stage === 3, 'quá giai đoạn tối đa bị từ chối'); ok(Math.abs(RC.fxOf(Cu.getCultivator(u)).fx.hp - fx0 * 1.5) < 1e-9, 'giai đoạn 3: nội tại ×1.5 (cả ưu và nhược điểm)');
  ok(hist(u).filter((h) => h.event_type === 'awaken').length === 3 && hist(u).filter((h) => h.event_type === 'awaken').every((h, i) => h.cost === R.AWAKEN[i].thach), 'lịch sử ghi đúng chi phí');
  // ================= 5) huyết mạch
  u = mk(51); RC.choose(u, 'phuong'); L = lt(u);
  ok(!RC.pickBloodline(u, 'chu_tuoc').ok && lt(u) === L, 'chưa thức tỉnh → không chọn huyết mạch'); RC.awaken(u);
  ok(!RC.pickBloodline(u, 'huyet_ma').ok, 'huyết mạch của tộc khác bị từ chối'); L = lt(u); r = RC.pickBloodline(u, 'chu_tuoc'); ok(r.ok && st(u).bloodline_id === 'chu_tuoc' && st(u).bloodline_level === 1 && lt(u) === L - R.BLOODLINE_PICK.thach, 'chọn huyết mạch Lv.1 + trừ phí');
  ok(!RC.pickBloodline(u, 'niet_ban').ok && st(u).bloodline_id === 'chu_tuoc', 'không đổi nhánh huyết mạch');
  ok(RC.fxOf(Cu.getCultivator(u)).parts.length === 2, 'fx có nội tại + huyết mạch');
  ok(!RC.upgradeBloodline(u).ok || st(u).bloodline_level === 2, 'nâng Lv.2 theo điều kiện'); // Lv.2 cần awaken≥1 (đã đủ)
  for (let lv = st(u).bloodline_level; lv < 5; lv++) { const need = R.BLOODLINE_LEVEL[lv - 1]; while (st(u).awakening_stage < need.awaken) RC.awaken(u); L = lt(u); r = RC.upgradeBloodline(u); ok(r.ok && st(u).bloodline_level === lv + 1 && lt(u) === L - need.thach, `huyết mạch → Lv.${lv + 1}`); }
  ok(!RC.upgradeBloodline(u).ok && st(u).bloodline_level === 5, 'Lv.5 là tối đa');
  ok(st(u).bloodline_exp === R.BLOODLINE_PICK.thach + R.BLOODLINE_LEVEL.reduce((a, x) => a + x.thach, 0), 'bloodline_exp = tổng Linh Thạch đã đầu tư');
  // ================= 6) tiến hóa
  u = mk(52); RC.choose(u, 'yeu'); ok(!RC.evolve(u).ok, 'chưa đủ điều kiện → không tiến hóa');
  for (let k = 0; k < 3; k++) RC.awaken(u); RC.pickBloodline(u, 'ho_vuong'); for (let k = 0; k < 4; k++) RC.upgradeBloodline(u);
  Cu.updateCultivator(u, { realm_index: 4 }); L = lt(u); ok(!RC.evolve(u).ok && lt(u) === L, 'thiếu cảnh giới → không trừ'); Cu.updateCultivator(u, { realm_index: 8 });
  const atk0 = RC.fxOf(Cu.getCultivator(u)).fx.atk; L = lt(u); r = RC.evolve(u); ok(r.ok && st(u).evolved === 1 && lt(u) === L - R.EVOLVE.thach, 'tiến hóa + trừ phí'); ok(RC.fxOf(Cu.getCultivator(u)).fx.atk > atk0, 'tiến hóa tăng hiệu ứng'); ok(!RC.evolve(u).ok, 'không tiến hóa lần 2');
  ok(RC.shortOf(Cu.getCultivator(u)).includes('Đại Yêu'), 'hiển thị tên dạng tiến hóa');
  // trần CAPS: tộc ở trạng thái tối đa không vượt trần
  for (const id of R.ORDER) { const x = mk(60 + R.ORDER.indexOf(id)); RC.choose(x, id); for (let k = 0; k < 3; k++) RC.awaken(x); RC.pickBloodline(x, Object.keys(R.RACES[id].bloodlines)[0]); for (let k = 0; k < 4; k++) RC.upgradeBloodline(x); RC.evolve(x); const b = T.bundle(Cu.getCultivator(x)); for (const k of Object.keys(T.CAPS)) ok(b[k] <= T.CAPS[k] + 1e-9 && b[k] >= (k === 'regen' ? -0.5 : -0.10) - 1e-9, `${id} tối đa: ${k} trong [sàn, trần]`); ok(SS.snapshot(Cu.getCultivator(x)).check.ok, `${id} tối đa: stat snapshot khớp`); }
  // ================= 7) đổi tộc
  u = mk(53); RC.choose(u, 'long'); RC.awaken(u); RC.pickBloodline(u, 'hac_long'); L = lt(u);
  ok(!RC.change(u, 'long').ok, 'đổi sang chính nó bị từ chối'); Cu.updateCultivator(u, { linh_thach: 10 }); ok(!RC.change(u, 'ma').ok && st(u).race_id === 'long' && lt(u) === 10, 'thiếu Linh Thạch → không đổi, không trừ'); Cu.updateCultivator(u, { linh_thach: 1e9 }); L = lt(u);
  r = RC.change(u, 'ma', 1e9); ok(r.ok && st(u).race_id === 'ma' && st(u).awakening_stage === 0 && st(u).bloodline_id === '' && st(u).bloodline_level === 0 && st(u).evolved === 0 && lt(u) === L - R.CHANGE.thach, 'đổi tộc: reset tiến trình + trừ phí');
  r = RC.change(u, 'linh', 1e9 + 3600); ok(!r.ok && /chờ thêm/.test(r.msg) && st(u).race_id === 'ma', 'hồi chiêu đổi tộc chặn lần 2'); r = RC.change(u, 'linh', 1e9 + R.CHANGE.cooldownSec + 1); ok(r.ok && st(u).race_id === 'linh', 'hết hồi chiêu → đổi được');
  ok(hist(u).map((h) => h.event_type).join() === 'choose,awaken,bloodline_pick,change,change', 'lịch sử đủ & đúng thứ tự'); ok(JSON.parse(hist(u)[3].from_state).race === 'long' && JSON.parse(hist(u)[3].to_state).race === 'ma', 'lịch sử lưu from/to');
  // ================= 8) nguyên tử: lỗi giữa chừng ⇒ rollback toàn khối (Linh Thạch không mất)
  u = mk(54); RC.choose(u, 'nhan'); L = lt(u); const h0 = hist(u).length;
  const realRun = D.run; let injected = false;
  D.run = function (sql, ...a) { if (!injected && /UPDATE race_state SET awakening_stage/.test(sql)) { injected = true; realRun.call(D, 'UPDATE race_state SET version = version + 1 WHERE user_id = ?', u); } return realRun.call(D, sql, ...a); };
  r = RC.awaken(u); D.run = realRun;
  ok(injected && !r.ok && /thao tác khác/.test(r.msg), 'xung đột phiên bản được phát hiện'); ok(lt(u) === L && st(u).awakening_stage === 0 && hist(u).length === h0, 'ROLLBACK: không trừ Linh Thạch, không đổi tiến trình, không thêm lịch sử');
  // ================= 9) bấm đúp / liên tiếp: chỉ trừ đúng số lần hợp lệ
  u = mk(55, { linh_thach: R.AWAKEN[0].thach + 5 }); RC.choose(u, 'nhan'); const rs = [RC.awaken(u), RC.awaken(u), RC.awaken(u)];
  ok(rs.filter((x) => x.ok).length === 1 && st(u).awakening_stage === 1 && lt(u) === 5, 'đủ tiền cho 1 lần: bấm 3 lần chỉ thành công 1, Linh Thạch không âm');
  const v56 = mk(56); RC.choose(v56, 'linh'); const settled = await Promise.all([1, 2, 3, 4].map(async () => RC.awaken(v56))); ok(settled.every((x) => typeof x.ok === 'boolean') && st(v56).awakening_stage === 3, 'gọi dồn dập (Promise.all) không ném lỗi, tiến trình nhất quán');
  // ================= 10) PvP: chỉ số race đi qua engine dùng chung
  const pa = mk(70); const pb = mk(71); RC.choose(pa, 'ma'); RC.choose(pb, 'long'); D.run('UPDATE cultivators SET last_pvp = 0');
  const bt = C21.createBattle(Cu.getCultivator(pa), Cu.getCultivator(pb), { now: 1 }); ok(bt.snap.A.check.ok && bt.snap.B.check.ok, 'PvP: snapshot hai bên khớp'); ok(bt.mods.A.pierce > bt.mods.B.pierce, 'PvP: Ma có xuyên giáp cao hơn Long'); const vd = C21.simulate(bt); ok(vd.over, 'PvP: trận chạy tới kết thúc');
  // ================= 11) UI thật (nút/select qua kit.routeComponent, strict)
  const ui = mk(80); const other = mk(81);
  let pay = RV.open(ui); ok(pay.embeds.length === 1 && cids(pay.components).length === 1, 'menu chưa chọn tộc: 1 select'); ok(pay.embeds[0].toJSON().fields.length === 6, 'overview liệt kê 6 tộc');
  let i = await click(ui, 'pick', pay.components, ['phuong']); const upd = i.log.find(([k]) => k === 'update')[1]; ok(/Phượng Tộc/.test(txt(i)) && cids(upd.components).some((c) => c.endsWith('|ok')), 'chọn trong select → xem trước + nút xác nhận');
  i = await click(other, 'ok', upd.components); ok(/không phải menu của bạn/.test(txt(i)) && !st(ui), 'người khác bấm xác nhận bị chặn, chưa chọn tộc');
  i = await click(ui, 'ok', upd.components); const after = i.log.find(([k]) => k === 'update')[1]; ok(st(ui) && st(ui).race_id === 'phuong' && /Chọn|chọn/.test(txt(i)), 'xác nhận → đã chọn tộc'); ok(cids(after.components).some((c) => c.endsWith('|aw')) && cids(after.components).some((c) => c.endsWith('|chg')), 'menu hồ sơ có nút Thức Tỉnh + chọn đổi tộc');
  i = await click(ui, 'aw', after.components); ok(st(ui).awakening_stage === 1 && /Thức Tỉnh/i.test(txt(i)), 'nút Thức Tỉnh hoạt động'); const p2 = i.log.find(([k]) => k === 'update')[1];
  i = await click(ui, 'bp', p2.components, ['niet_ban']); ok(st(ui).bloodline_id === 'niet_ban', 'select huyết mạch hoạt động'); const p3 = i.log.find(([k]) => k === 'update')[1];
  i = await click(ui, 'bl', p3.components); ok(st(ui).bloodline_level === 2, 'nút Nâng Huyết Mạch hoạt động'); const pb4 = i.log.find(([k]) => k === 'update')[1];
  i = await click(ui, 'hs', pb4.components); ok(/LỊCH SỬ/.test(txt(i)) && i.log[0][0] === 'reply', 'nút Lịch Sử trả embed (reply riêng, không đụng menu)');
  const p4 = (await click(ui, 'ev', pb4.components)); ok(/đủ điều kiện|Tiến Hóa/i.test(txt(p4)) && st(ui).evolved === 0, 'Tiến Hóa chưa đủ điều kiện → báo, không đổi');
  Cu.updateCultivator(ui, { linh_thach: 0 }); i = await click(ui, 'aw', pb4.components); ok(st(ui).awakening_stage === 1 && /Linh Thạch/.test(txt(i)), 'thiếu Linh Thạch → báo lỗi, không đổi');
  Cu.updateCultivator(ui, { linh_thach: 1e9 }); i = await click(ui, 'chg', pb4.components, ['ma']); const upd2 = i.log.find(([k]) => k === 'update')[1]; ok(/Đổi tộc/.test(txt(i)) && st(ui).race_id === 'phuong', 'chọn tộc khác → màn xác nhận, CHƯA đổi');
  i = await click(ui, 'ok', upd2.components); ok(st(ui).race_id === 'ma' && st(ui).awakening_stage === 0, 'xác nhận đổi tộc → đổi + reset');
  console.log(`✅ test_race21: ${n} kiểm tra PASS`);
})().catch((e) => { console.error('❌ FAIL', e); process.exit(1); });
