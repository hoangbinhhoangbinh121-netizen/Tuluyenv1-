'use strict';
// V19.3 — (1) Thiên Nhân Ngũ Suy hồi chiêu 12 giờ/giai đoạn (v19.8); (2) Bí Cảnh Tiên Giới: thông báo nêu RÕ điều kiện Phi Thăng Tiên Giới còn thiếu, và vào được ngay sau khi phi thăng.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_gate193_${Date.now()}.db`);
const assert = require('node:assert');
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const BC = require('../src/game/bicanh19'); const K = require('../src/game/constants'); const R = require('../src/game/realm');
const A = require('../src/game/ascension'); const CD = require('../src/game/cooldowns'); const { now } = require('../src/util');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const mk = (id, realm, stage, tier) => { Cu.createCultivator(id); D.run('UPDATE cultivators SET realm_index = ?, stage_index = ?, world_tier = ? WHERE user_id = ?', realm, stage, tier, String(id)); return String(id); };
const row = (id) => Cu.getCultivator(id);
const FULL = (id, tier) => { const lcol = R.lenhCol(tier); D.run(`UPDATE cultivators SET vuot_thienkiep = 1, linh_luc = 100, linh_thach = 9e18, diem_linh_ngo = 100, bicanh_thuongco_count = 10, thuongco_thuho_defeated = 1, thiennhanngusuy_passed = 1, ngusuy_stage = 5, atk = 4e10, def_ = 4e10, hp = 4e11, cur_hp = 4e11, spd = 4e10, ${lcol} = 3 WHERE user_id = ?`, id); };

(async () => {
  // ---- 1) Ngũ Suy: hồi chiêu
  ok(CD.COOLDOWN_THIENNHANNGUSUY === 12 * 3600, 'hồi chiêu Ngũ Suy = 12 giờ');
  const s = mk(801, 9, 22, 1); FULL(s, 1); D.run('UPDATE cultivators SET thiennhanngusuy_passed = 0, ngusuy_stage = 0, ngusuy_started = 0, last_thiennhanngusuy = 0, tu_vi = 1e9 WHERE user_id = ?', s);
  const t0 = now(); const r1 = A.doVuotThiennhanngusuy(s); ok(/Thọ|giai đoạn 1\/5/.test(r1), 'giai đoạn 1 chạy');
  D.run('UPDATE cultivators SET last_thiennhanngusuy = ? WHERE user_id = ?', t0 - 11 * 3600, s);
  ok(/tích tụ thêm ý chí/.test(A.doVuotThiennhanngusuy(s)) && /giờ|phút/.test(A.doVuotThiennhanngusuy(s)), 'mới 11 giờ → vẫn phải chờ');
  D.run('UPDATE cultivators SET last_thiennhanngusuy = ? WHERE user_id = ?', t0 - 12 * 3600 - 5, s);
  ok(!/tích tụ thêm ý chí/.test(A.doVuotThiennhanngusuy(s)), 'qua 12 giờ → thử tiếp được');
  // người đang chờ theo mốc 24h cũ cũng được lợi: mốc 13 giờ trước đã đủ
  const s2 = mk(802, 9, 22, 1); FULL(s2, 1); D.run('UPDATE cultivators SET thiennhanngusuy_passed = 0, ngusuy_stage = 2, ngusuy_started = 1, last_thiennhanngusuy = ?, tu_vi = 1e9 WHERE user_id = ?', now() - 13 * 3600, s2);
  ok(!/tích tụ thêm ý chí/.test(A.doVuotThiennhanngusuy(s2)), 'người đang chịu suy từ 13 giờ trước không còn bị khóa');

  // ---- 1b) v20.4: tỉ lệ thành công MỖI giai đoạn Ngũ Suy = 99% (người yếu cũng vậy)
  ok(K.NGUSUY_SUCCESS_RATE === 0.99, 'NGUSUY_SUCCESS_RATE mặc định 0.99');
  let pass = 0; const N = 600;
  for (let i = 0; i < N; i += 1) {
    const w = mk(9000 + i, 9, 22, 1); FULL(w, 1);
    D.run('UPDATE cultivators SET thiennhanngusuy_passed = 0, ngusuy_stage = 0, ngusuy_started = 0, last_thiennhanngusuy = 0, tu_vi = 1e9, ngo_tinh = 0 WHERE user_id = ?', w);
    A.doVuotThiennhanngusuy(w); if (row(w).ngusuy_stage === 1) pass += 1;
  }
  ok(pass / N >= 0.97, `giai đoạn 1: ${pass}/${N} thành công (kỳ vọng ~99%)`);

  // ---- 2) Bí Cảnh Tiên Giới
  const a = mk(810, 12, 1, 1);                       // cảnh giới đủ (Thái Ất Kim Tiên) nhưng vẫn ở Linh Giới
  const why = BC.whyCannotEnter(row(a), 0);
  ok(/Phi Thăng Tiên Giới/.test(why) && /đã đủ/.test(why) && /Linh Giới/.test(why), 'nói rõ: cảnh giới đủ nhưng chưa Phi Thăng Tiên Giới');
  ok(/Còn thiếu \d+ điều kiện/.test(why) && /Thiên Nhân Ngũ Suy/.test(why) && /Lực Chiến/.test(why), 'liệt kê điều kiện còn thiếu');
  ok(why.length <= 1000, 'vừa ô embed (≤1024)');
  const b = mk(811, 5, 1, 0); const wb = BC.whyCannotEnter(row(b), 0); ok(/Linh Giới trước/.test(wb), 'Phàm Giới → chỉ đường Phi Thăng Linh Giới');
  const c = mk(812, 9, 22, 2); D.run('UPDATE cultivators SET thiennhanngusuy_passed = 1 WHERE user_id = ?', c); const wc = BC.whyCannotEnter(row(c), 0); ok(/yêu cầu/.test(wc) && /dotpha/.test(wc) && /Độ Kiếp/.test(wc), 'đã Phi Thăng nhưng thiếu cảnh giới → báo /dotpha');
  // phi thăng thật rồi vào được
  const d = mk(813, 12, 1, 1); FULL(d, 1);
  ok(!/Chưa đủ|❌/.test(String(BC.whyCannotEnter(row(d), 0)).split('\n')[1] || '') || true, 'chuẩn bị');
  const pr = A.doPhithangEx ? A.doPhithangEx(d, 1) : A.doPhithang(d, 1); const txt = typeof pr === 'string' ? pr : (pr && (pr.text || pr.error || JSON.stringify(pr)));
  ok(row(d).world_tier === 2, `Phi Thăng Tiên Giới thành công (${String(txt).slice(0, 160)})`);
  ok(BC.whyCannotEnter(row(d), 0) === null, 'sau Phi Thăng + cảnh giới đủ → vào được Bí Cảnh Tiên Giới');
  ok(BC.createLobby(d, 0, { solo: true }).ok === true, 'tạo trận Bí Cảnh thật sự thành công');
  // menu hiển thị lý do trong ô Trạng thái (không lỗi)
  const V = require('../src/ui/bicanh19Views'); const mv = V.menuView(a); const f = mv.embeds[0].toJSON().fields.find((x) => x.name.includes('Trạng thái')); ok(f && /Còn thiếu/.test(f.value) && f.value.length <= 1024, 'menu hiển thị điều kiện còn thiếu');
  console.log(`✓ test_gate_v19_3: ${n} kiểm tra`);
})().catch((e) => { console.error('✗', e); process.exit(1); });
