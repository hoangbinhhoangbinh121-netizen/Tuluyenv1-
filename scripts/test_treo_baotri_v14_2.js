'use strict';
// Kiểm thử v14.2: Bế Quan Treo (5%, không giới hạn, tách /xuatquan) + chế độ bảo trì toàn bot. Chạy: node scripts/test_treo_baotri_v14_2.js
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_treo_${Date.now()}.db`);
const assert = require('node:assert');
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const T = require('../src/game/treoquan'); const A = require('../src/game/actionsBasic');
const BAL = require('../src/game/balance'); const M = require('../src/game/maintenance'); const ST = require('../src/game/settings');
const F = require('../src/commands/framework');
require('../src/commands/treoquan'); require('../src/commands/baotri'); require('../src/commands/basic'); require('../src/commands/pvp');
const t0 = () => Math.floor(Date.now() / 1000);

(async () => {
  // ---- cấu hình ----
  assert.strictEqual(BAL.B.TREO_MAX_HOURS, 0, 'không còn giới hạn 4h'); assert.strictEqual(BAL.B.TREO_EFFICIENCY, 0.05);
  assert.ok(F.registry.has('treoquan') && F.registry.has('xuatquan') && F.registry.has('baotri'));
  assert.ok(!(F.registry.get('treoquan').options || []).length, '/treoquan không còn đối số xuất quan');
  assert.ok(F.registry.get('baotri').anyAdmin && F.registry.get('baotri').maintenanceExempt);

  // ---- treo = 5% tay ở mọi cảnh giới (kể cả Phàm Nhân, nơi trước đây chỉ ~0,03%) ----
  let id = 900;
  for (const realm of [0, 1, 2, 4, 7, 10, 14]) {
    id += 1; Cu.createCultivator(id); D.run('UPDATE cultivators SET realm_index = ? WHERE user_id = ?', realm, id);
    const row = Cu.getCultivator(id);
    const hand = A.tuluyenExpectedPerClick(id, row);
    const r = T.rateOf(id, row);
    const ratio = r.rate / (hand / 10);
    assert.ok(Math.abs(ratio - 0.05) < 1e-9, `realm ${realm}: treo/tay = ${ratio}`);
    // thực nghiệm: trung bình 400 lần bấm tay thật vs kỳ vọng (sai số 12%)
    let sum = 0; for (let i = 0; i < 400; i += 1) { D.run('UPDATE cultivators SET last_tuluyen = 0 WHERE user_id = ?', id); sum += A.tuluyenR(id).gained; }
    assert.ok(Math.abs(sum / 400 / hand - 1) < 0.12, `kỳ vọng tay lệch: realm ${realm} ${(sum / 400 / hand).toFixed(3)}`);
  }

  // ---- xuất quan nhận tu vi, không giới hạn ----
  id += 1; Cu.createCultivator(id); D.run('UPDATE cultivators SET tu_vi = 0 WHERE user_id = ?', id);
  assert.ok(!T.xuatQuan(id).ok, 'chưa treo thì xuất quan báo lỗi nhẹ');
  assert.ok(T.batDau(id).ok); assert.strictEqual(T.batDau(id).kind, 'dang_treo');
  assert.strictEqual(T.xuatQuan(id).kind, 'qua_som');
  D.run('UPDATE cultivators SET treo_start = ? WHERE user_id = ?', t0() - 3600, id);
  const x1 = T.xuatQuan(id); assert.strictEqual(x1.kind, 'xuatquan'); assert.ok(x1.gained > 100 && x1.after === x1.gained, JSON.stringify([x1.gained, x1.after]));
  assert.strictEqual(Cu.getCultivator(id).tu_vi, x1.gained); assert.strictEqual(Number(Cu.getCultivator(id).treo_start), 0);
  // treo 30 ngày: không bị cắt ở 4h, không xuất quan cưỡng chế, tăng tuyến tính
  T.batDau(id); D.run('UPDATE cultivators SET treo_start = ?, tu_vi = 0 WHERE user_id = ?', t0() - 30 * 86400, id);
  assert.strictEqual(T.sweepExpired(), 0); assert.strictEqual(T.settleIfExpired(id), null);
  const st = T.stateOf(id); assert.ok(st.active && !st.full && st.counted >= 30 * 86400 - 2);
  const x30 = T.xuatQuan(id); assert.strictEqual(x30.kind, 'xuatquan'); assert.ok(Math.abs(x30.gained / (x1.gained * 720) - 1) < 0.02, 'tuyến tính theo giờ');
  assert.ok(!x30.capped);

  // ---- giao diện (embed) dựng được ở mọi trạng thái, kể cả Infinity ----
  const V = require('../src/ui/templates/treoquan');
  Cu.updateCultivator(id, { treo_start: 0 });
  for (const r of [T.xem(id), T.batDau(id), T.batDau(id), T.xuatQuan(id)]) assert.ok(V.view(r), r.kind);
  D.run('UPDATE cultivators SET treo_start = ? WHERE user_id = ?', t0() - 90000, id);
  const js = JSON.stringify(V.view(T.xem(id)).toJSON ? V.view(T.xem(id)).toJSON() : {}); assert.ok(!/cưỡng chế|Infinity|NaN/.test(js), js.slice(0, 300));
  assert.ok(require('../src/ui/embeds')); T.xuatQuan(id);

  // ---- bảo trì ----
  const sent = [];
  const mkMsg = (uid, text, admin) => ({ author: { id: String(uid), bot: false }, content: text, guild: { id: 'g1' }, channel: {}, mentions: { users: new Map() }, member: { permissions: { has: () => !!admin } }, reply: async (p) => { sent.push(p); return p; }, attachments: new Map() });
  const text = (p) => JSON.stringify(p && p.embeds ? p.embeds.map((e) => (e.toJSON ? e.toJSON() : e)) : p);
  await F.handlePrefix(mkMsg(id, '!xuatquan', false), ['!']); assert.ok(!/BẢO TRÌ/.test(text(sent.pop())), 'chưa bảo trì thì chạy bình thường');
  // người thường không bật được
  await F.handlePrefix(mkMsg(id, '!baotri bat', false), ['!']); assert.ok(!M.isOn(), 'người thường không được bật bảo trì'); sent.length = 0;
  // admin bật
  await F.handlePrefix(mkMsg(1, '!baotri bat', true), ['!']); assert.ok(M.isOn()); assert.strictEqual(M.get().by, '1'); sent.length = 0;
  Cu.createCultivator(950); const before = JSON.stringify(Cu.getCultivator(950));
  for (const c of ['!xuatquan', '!treoquan', '!tutien', '!tuluyen', '!dauphap']) { await F.handlePrefix(mkMsg(950, c, false), ['!']); const p = sent.pop(); assert.ok(p && /BẢO TRÌ/.test(text(p)), `${c} phải bị chặn`); }
  assert.strictEqual(JSON.stringify(Cu.getCultivator(950)), before, 'bảo trì không được thay đổi dữ liệu người chơi');
  await F.handlePrefix(mkMsg(1, '!treoquan', true), ['!']); assert.ok(/BẢO TRÌ/.test(text(sent.pop())), 'admin cũng bị chặn (trừ /baotri)');
  // slash: bị chặn bằng reply ephemeral, không defer
  const calls = [];
  const slash = (name, uid, admin) => ({ commandName: name, user: { id: String(uid) }, memberPermissions: { has: () => !!admin }, options: { getString: () => null, getInteger: () => null, getUser: () => null, getAttachment: () => null }, deferred: false, replied: false, guild: {}, channel: {}, deferReply: async () => calls.push('defer'), reply: async (p) => { calls.push(['reply', p]); }, followUp: async (p) => calls.push(['follow', p]) });
  await F.handleSlash(slash('xuatquan', 950)); assert.strictEqual(calls[0][0], 'reply'); assert.ok(/BẢO TRÌ/.test(text(calls[0][1])) && calls[0][1].flags); calls.length = 0;
  // /baotri xem + tắt (admin) vẫn chạy khi đang bảo trì; trạng thái bền qua bộ nhớ đệm
  ST.set('maint_on', '1'); assert.ok(M.isOn());
  await F.handlePrefix(mkMsg(1, '!baotri tat', true), ['!']); assert.ok(!M.isOn()); sent.length = 0;
  await F.handlePrefix(mkMsg(950, '!xuatquan', false), ['!']); assert.ok(!/BẢO TRÌ/.test(text(sent.pop())), 'tắt bảo trì → chạy lại bình thường');
  // bật lại có lý do + đồng hồ, kiểm tra thông báo
  M.enable({ by: '1', reason: 'Cập nhật v14.2', minutes: 30 }); const nt = JSON.stringify(M.notice().toJSON()); assert.ok(/Cập nhật v14\.2/.test(nt) && /<t:\d+:R>/.test(nt)); M.disable();
  console.log('✅ test_treo_baotri_v14_2 OK');
})().catch((e) => { console.error('❌', e); process.exit(1); });
