'use strict';
// v17.2 — hiệu ứng Phi Thăng Tiên Giới: giao dịch commit đúng, chuỗi cảnh chạy đủ, lỗi gửi ảnh không mất kết quả, đủ file GIF.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_asc_${Date.now()}.db`);
const assert = require('node:assert'); const fs = require('node:fs'); const path = require('node:path');
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const K = require('../src/game/constants'); const A = require('../src/game/ascension'); const B = require('../src/game/bicanh'); const R = require('../src/game/realm');
const FX = require('../src/ui/ascendFx');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };

// --- đủ 6 file GIF, đúng cỡ (≤ 8 MB mỗi file để Discord nhận)
for (const k of [...FX.SCENES.map((s) => s.key), FX.FINAL.key]) { const f = path.join(FX.DIR, `${k}.gif`); ok(fs.existsSync(f), `thiếu ${k}.gif`); ok(fs.statSync(f).size < 8 * 1048576, `${k}.gif quá nặng`); ok(fs.readFileSync(f).subarray(0, 3).toString() === 'GIF', `${k} không phải GIF`); }

// --- chuỗi cảnh: 5 cảnh + cảnh cuối, cảnh đầu qua first(), còn lại qua edit(); mỗi cảnh có file đính kèm đúng tên + embed.setImage
const mkIo = (failAt = -1, failAll = false) => { const log = []; let calls = 0;
  const rec = (kind) => async (p) => { const k = calls; calls += 1; if (failAll || k === failAt) throw new Error('boom'); log.push({ kind, p }); };
  return { log, io: { first: rec('first'), edit: rec('edit') } }; };
(async () => {
  { const { log, io } = mkIo(); const good = await FX.play(io, { name: 'Tiểu Minh', text: 'KẾT QUẢ PHI THĂNG', wait: async () => {} });
    ok(good === true, 'chiếu đủ phải trả true'); ok(log.length === 6, `số cảnh ${log.length}`); ok(log[0].kind === 'first' && log.slice(1).every((x) => x.kind === 'edit'), 'thứ tự first/edit');
    const names = log.map((x) => (x.p.files && x.p.files[0] && x.p.files[0].name) || ''); ok(names.join(',') === 'ascension_warning.gif,ascension_gate.gif,ascension_tribulation.gif,ascension_success.gif,immortal_arrival.gif,immortal_realm.gif', names.join());
    ok(log.every((x) => Array.isArray(x.p.attachments) && x.p.attachments.length === 0), 'mỗi lần sửa phải gỡ file cảnh trước (attachments: [])');
    const fin = log[5].p.embeds[0].toJSON ? log[5].p.embeds[0].toJSON() : log[5].p.embeds[0].data; ok(String(fin.description).includes('KẾT QUẢ PHI THĂNG'), 'cảnh cuối thiếu kết quả'); ok(fin.image && fin.image.url === 'attachment://immortal_realm.gif', 'cảnh cuối thiếu ảnh');
    const first = log[0].p.embeds[0].toJSON ? log[0].p.embeds[0].toJSON() : log[0].p.embeds[0].data; ok(String(first.description).includes('Tiểu Minh'), 'tên người chơi không vào lời dẫn'); }
  // lỗi giữa chừng (cảnh 3): vẫn giao được cảnh cuối có kết quả
  { const { log, io } = mkIo(2); const good = await FX.play(io, { name: 'A', text: 'KQ', wait: async () => {} }); ok(good === false, 'gián đoạn phải trả false');
    const last = log[log.length - 1].p.embeds[0]; const j = last.toJSON ? last.toJSON() : last.data; ok(String(j.description).includes('KQ'), 'mất kết quả khi cảnh giữa lỗi'); }
  // lỗi toàn bộ: không ném lỗi ra ngoài
  { const { io } = mkIo(-1, true); let thrown = false; try { await FX.play(io, { text: 'KQ', wait: async () => {} }); } catch (_) { thrown = true; } ok(!thrown, 'play không được ném lỗi'); }

  // --- tích hợp: phi thăng thật Linh Giới → Tiên Giới (giao dịch commit trước, hiệu ứng chỉ là trình diễn)
  const u = '4242'; Cu.createCultivator(u);
  const lcol = R.lenhCol(1); const pcol = R.phuCol(1);
  D.run(`UPDATE cultivators SET world_tier = 1, realm_index = ?, stage_index = ?, vuot_thienkiep = 1, linh_luc = 100, linh_thach = ?, ${lcol} = 1, ${pcol} = ?,
         diem_linh_ngo = ?, bicanh_thuongco_count = ?, thuongco_thuho_defeated = 1, thiennhanngusuy_passed = 1, atk = ?, def_ = 1000, hp = 10000, spd = 1000 WHERE user_id = ?`,
    K.DOKIEP_REALM_IDX, K.DOKIEP_VIENMAN_STAGE, K.TIENGIOI_LINH_THACH_CAN * 2, K.PHITHANG_LINH_PHU_CAN, B.DIEM_LINH_NGO_MAX, B.BICANH_THUONGCO_CAN, K.TIENGIOI_LUC_CHIEN_CAN, u);
  const need = A.tiengioiChecklist(Cu.getCultivator(u)).filter(([, o]) => !o).map(([k]) => k); ok(need.length === 0, `thiếu điều kiện: ${need}`);
  const res = A.doPhithangEx(u, 777); ok(res.ok && res.tier === 2 && FX.isTienGioi(res), `phi thăng Tiên Giới: ${res.text}`); ok(Cu.getCultivator(u).world_tier === 2, 'world_tier chưa lên 2');
  ok(res.text.includes('Tiên Giới'), 'kết quả chữ thiếu Tiên Giới'); { const again = A.doPhithangEx(u, 777); ok(!again.ok, `phi thăng lần 2 phải bị chặn: ${again.text}`); } ok(!FX.isTienGioi(A.doPhithangEx(u, 777)), 'thất bại không được chiếu hiệu ứng');
  // Linh Giới (tier 1) KHÔNG chiếu hiệu ứng Tiên Giới
  const v = '4343'; Cu.createCultivator(v);
  D.run('UPDATE cultivators SET world_tier = 0, realm_index = ?, stage_index = ?, vuot_thienkiep = 1, linh_luc = 100, linh_thach = ?, linh_gioi_lenh = 1, linh_phu = ?, atk = 5e5, def_ = 5e5, hp = 5e6, spd = 5e5 WHERE user_id = ?',
    K.HOATHAN_REALM_IDX, K.HOATHAN_VIENMAN_STAGE, K.PHITHANG_LINH_THACH_COST * 2, K.PHITHANG_LINH_PHU_CAN, v);
  const r2 = A.doPhithangEx(v, 777); ok(r2.ok && r2.tier === 1 && !FX.isTienGioi(r2), `phi thăng Linh Giới: ${r2.text}`);
  // --- đường thật: slash (đã defer → editReply), tiền tố (reply rồi edit), nút (reply rồi editReply). Rút ngắn thời gian chờ.
  const real = FX.SCENES.map((x) => x.ms); FX.SCENES.forEach((x) => { x.ms = 0; });
  { const calls = []; const i = { deferred: true, replied: false, editReply: async (p) => { calls.push(p); } }; await FX.playForCtx({ interaction: i, user: { username: 'u' } }, { text: 'KQ' }); ok(calls.length === 6 && calls.every((c) => c.embeds && c.embeds.length === 1), 'slash'); }
  { const calls = []; const msg = { edit: async (p) => { calls.push(['edit', p]); } }; await FX.playForCtx({ user: { username: 'u' }, send: async (p) => { calls.push(['send', p]); return msg; } }, { text: 'KQ' }); ok(calls.length === 6 && calls[0][0] === 'send' && calls.slice(1).every((c) => c[0] === 'edit'), 'tiền tố'); }
  { const calls = []; const i = { deferred: false, replied: false, user: { username: 'u' }, reply: async (p) => { i.replied = true; calls.push(['reply', p]); }, editReply: async (p) => { calls.push(['edit', p]); } }; await FX.playForButton(i, { text: 'KQ' }); ok(calls.length === 6 && calls[0][0] === 'reply' && calls.slice(1).every((c) => c[0] === 'edit'), 'nút'); }
  FX.SCENES.forEach((x, k) => { x.ms = real[k]; });
  console.log(`✅ test_ascend_fx_v17_2 OK (${n} kiểm tra)`);
})().catch((e) => { console.error('❌', e); process.exit(1); });
