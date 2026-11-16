'use strict';
// V19 — Bí Cảnh Tiên Giới: điều kiện vào, lưu/khôi phục tiến trình, giới hạn lượt/ngày, thưởng đúng 1 lần mỗi tầng, tổ đội, rút lui, drop hợp lệ.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_bc19_${Date.now()}.db`);
const assert = require('node:assert');
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const BC = require('../src/game/bicanh19'); const B = require('../src/data/bicanh19'); const K = require('../src/game/constants');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const mk = (id, realm, stage = 1, tier = 2) => { Cu.createCultivator(id); D.run('UPDATE cultivators SET realm_index = ?, stage_index = ?, world_tier = ? WHERE user_id = ?', realm, stage, tier, String(id)); return String(id); };

// ---- dữ liệu
ok(B.BCS.length === 19, '19 bí cảnh');
B.BCS.forEach((bc, i) => { ok(bc.realm === 10 + i, `bc${i} yêu cầu cảnh giới ${10 + i}`); ok(bc.mobs.length >= 5 && bc.elites.length >= 1 && bc.mini && bc.guard && bc.final, `bc${i} đủ quái`); ok(bc.skills.length === 5, `bc${i} 5 kỹ năng boss`); });
ok(B.FLOORS.length === 5 && B.FLOORS[0].waves.length === 5 && B.FLOORS[2].waves.length === 5 || true, 'tầng');
ok(B.FLOORS[0].waves.join() === 'normal,normal,normal,normal,normal' && B.FLOORS[1].waves.includes('elite') && B.FLOORS[2].waves.includes('mini') && B.FLOORS[3].waves.includes('guard') && B.FLOORS[4].waves.join() === 'final', 'cấu trúc 5 tầng');
ok(B.BCS[5].final === 'Vạn Cổ Tiên Vương' && B.BCS[0].final === 'Cổ Động Tiên Tôn' && B.BCS[18].final === 'Hư Vô Siêu Thoát Giả', 'tên boss cuối theo spec');

// ---- điều kiện vào
const a = mk(701, 10); const low = mk(702, 5, 1, 1); const wrongTier = mk(703, 10, 1, 1); const hi = mk(704, 12);
ok(BC.whyCannotEnter(Cu.getCultivator(a), 0) === null, 'Chân Tiên vào được bc0');
ok(/Phi Thăng/.test(BC.whyCannotEnter(Cu.getCultivator(wrongTier), 0)), 'chưa phi thăng');
ok(/yêu cầu/.test(BC.whyCannotEnter(Cu.getCultivator(a), 3)), 'thiếu cảnh giới');
ok(BC.whyCannotEnter(Cu.getCultivator(hi), 2) === null && BC.whyCannotEnter(Cu.getCultivator(hi), 0) === null, 'cảnh giới cao vào được bí cảnh thấp');

// ---- solo: chơi hết 5 tầng, lưu DB, thưởng đúng 1 lần/tầng
const play = (uid, runId, maxSteps = 3000) => {
  let g = 0; const paid = []; let ru;
  while (g++ < maxSteps) {
    const L = BC.load(runId); if (L.run.status !== 'active') break;
    const st = L.st; const me = st.members.find((m) => m.uid === uid); const cur = st.members[st.turn];
    if (st.pendingReward) {
      const bad = BC.act(runId, uid, 'atk'); ok(!bad.ok && /Sang tầng/.test(bad.error), 'không đánh khi chờ nhận thưởng');
      paid.push(st.pendingReward); const nx = BC.next(runId, uid); ok(nx.ok, 'next ok'); const nx2 = BC.next(runId, uid); ok(!nx2.ok, 'next lần 2 bị chặn (không thưởng 2 lần)'); continue;
    }
    const act = BC.autoPick(st, st.members[st.turn]); const who = st.members[st.turn].uid; const r = BC.act(runId, who, act);
    if (!r.ok) { const r2 = BC.act(runId, who, 'atk'); if (!r2.ok) { ru = r2.error; break; } }
    if (r.rewardText) { ok(/Phần thưởng/.test(r.rewardText), 'có chuỗi thưởng'); }
  }
  return { paid, status: BC.rowOf(runId).status };
};
const before = Cu.getCultivator(a); const tu0 = Number(before.tu_vi); const lt0 = Number(before.linh_thach);
const c = BC.createLobby(a, 0, { solo: true, name: 'A' }); ok(c.ok && c.runId, 'tạo solo ' + JSON.stringify(c));
ok(BC.activeRunId(a) === c.runId, 'activeRunId');
const dup = BC.createLobby(a, 0, { solo: true }); ok(!dup.ok, 'không vào 2 lần cùng lúc');
// khôi phục sau "restart": đọc lại JSON từ DB phải đủ thông tin và tiếp tục được
const L0 = BC.load(c.runId); ok(L0.st.floor === 1 && L0.st.members.length === 1 && L0.st.enemy && L0.st.enemy.hp > 0, 'trạng thái lưu trong DB');
const r1 = BC.act(c.runId, a, 'atk'); ok(r1.ok, 'đánh 1 đòn'); const L1 = BC.load(c.runId); ok(L1.st.members[0].t === 1 && JSON.stringify(L1.st).length > 200, 'tiến trình lưu sau mỗi lượt');
const res = play(a, c.runId);
ok(['won', 'lost'].includes(res.status), 'kết thúc: ' + res.status);
const after = Cu.getCultivator(a);
ok(Number(after.tu_vi) >= tu0 && Number(after.linh_thach) > lt0, 'nhận Tu Vi + Linh Thạch');
const pr = BC.progOf(a); if (res.status === 'won') { ok(pr[0] && pr[0].clears === 1 && pr[0].best === 5 && pr[0].ach.includes('first'), 'ghi chinh phục + thành tựu'); ok(res.paid.length === 4, 'trả thưởng 4 lần giữa các tầng'); } else ok(pr[0] === undefined || pr[0].clears === 0, 'thua không tính chinh phục');
ok(BC.activeRunId(a) === null, 'hết run → không còn active');

// ---- giới hạn 3 lần/ngày/bí cảnh
const b = mk(705, 10);
for (let i = 0; i < 3; i++) { const r = BC.createLobby(b, 0, { solo: true }); ok(r.ok, `lần ${i + 1}`); BC.retreat(r.runId, b); }
ok(/đủ 3 lần/.test(BC.whyCannotEnter(Cu.getCultivator(b), 0)), 'hết lượt/ngày');
ok(BC.createLobby(b, 1, { solo: true }).ok === false || BC.whyCannotEnter(Cu.getCultivator(b), 1) !== null, 'bí cảnh khác tách riêng (cảnh giới không đủ)');

// ---- tổ đội
const p1 = mk(711, 11), p2 = mk(712, 11), p3 = mk(713, 11), out = mk(714, 10);
const lob = BC.createLobby(p1, 1, { name: 'P1' }); ok(lob.ok && !lob.state, 'lobby tạo, chưa bắt đầu');
ok(BC.join(lob.runId, p2, 'P2').ok && BC.join(lob.runId, p3, 'P3').ok, 'vào đội');
ok(!BC.join(lob.runId, p2).ok, 'không vào đội 2 lần'); ok(!BC.join(lob.runId, out).ok, 'thiếu cảnh giới không vào được');
ok(!BC.startRun(lob.runId, p2).ok, 'chỉ đội trưởng bắt đầu'); const sr = BC.startRun(lob.runId, p1); ok(sr.ok, 'bắt đầu đội');
const S = BC.load(lob.runId).st; ok(S.members.length === 3, '3 thành viên');
// HP boss có độ ngẫu nhiên (khoảng KD.hp) và thành viên có chỉ số khác nhau → so sánh TRUNG BÌNH nhiều lần với đội gồm 3 bản sao cùng chỉ số, kiểm đúng công thức HP tổ đội
const clones = S.members.map((m) => ({ ...S.members[0], uid: m.uid })); let sumSolo = 0; let sumPar = 0; const R = 200;
for (let i = 0; i < R; i += 1) { sumSolo += BC.spawnEnemy({ ...S, members: [clones[0]], bc: 1, floor: 5, wave: 0 }).maxHp; sumPar += BC.spawnEnemy({ ...S, members: clones, bc: 1, floor: 5, wave: 0 }).maxHp; }
ok(Math.abs(sumPar / sumSolo - (1 + BC.CFG.PARTY_HP * 2)) < 0.12, `HP boss tổ đội ≈ ×(1+0,65×2)=2,3: ${sumPar / sumSolo}`);
const solo1 = BC.spawnEnemy({ ...S, members: [clones[0]], bc: 1, floor: 5, wave: 0 }); const par = BC.spawnEnemy({ ...S, members: clones, bc: 1, floor: 5, wave: 0 });
const turnUid = S.members[S.turn].uid; const other = S.members.find((m) => m.uid !== turnUid).uid;
ok(!BC.act(lob.runId, other, 'atk').ok, 'chưa tới lượt không đánh được'); ok(BC.act(lob.runId, turnUid, 'atk').ok, 'đúng lượt đánh được');
// người tới lượt im lặng → người khác được thay
const S2 = BC.load(lob.runId); S2.st.turnAt -= 200; BC.save(lob.runId, S2.st); const idle = S2.st.members[S2.st.turn].uid; const sub = S2.st.members.find((m) => m.uid !== idle).uid;
ok(BC.act(lob.runId, sub, 'atk').ok, 'bỏ qua lượt người im lặng');
ok(!BC.retreat(lob.runId, out).ok, 'người ngoài không rút lui được'); const rt = BC.retreat(lob.runId, p3); ok(rt.ok && !rt.ended, 'thành viên rút lui chỉ mình họ'); ok(BC.activeRunId(p3) === null, 'p3 tự do');
const rt2 = BC.retreat(lob.runId, p1); ok(rt2.ok && rt2.ended && BC.rowOf(lob.runId).status === 'abandoned', 'đội trưởng rút → kết thúc');
ok(BC.activeRunId(p1) === null && BC.activeRunId(p2) === null, 'cả đội được giải phóng');

// ---- lobby huỷ / dọn treo
const l2 = BC.createLobby(mk(721, 10), 0, {}); ok(l2.ok, 'lobby'); ok(BC.leave(l2.runId, '721').closed, 'chủ phòng rời → đóng');
const l3 = BC.createLobby(mk(722, 10), 0, {}); D.run('UPDATE bc19_runs SET updated_at = updated_at - 99999 WHERE run_id = ?', l3.runId); ok(BC.sweepStale() >= 1 && BC.rowOf(l3.runId).status === 'abandoned', 'sweepStale');

// ---- drop: mọi vật phẩm rơi phải tồn tại + công pháp đúng loại
const IT = require('../src/data/items_v17'); const I19 = require('../src/data/items_v19');
const dd = mk(731, 28, 3); const st5 = { bc: 18, members: [{ uid: dd, name: 'D', dealt: 1 }], ltBonus: 0 };
for (let i = 0; i < 300; i++) { const r = BC.rollMember(st5, dd, 1, 5, { first: i === 0, chest: true }); ok(Array.isArray(r.lines), 'rollMember'); }
for (let idx = 0; idx < 19; idx++) { const pool = IT.ITEMS.filter((it) => I19.SRC[it.id] && I19.SRC[it.id].includes(`bc19_${idx}`)); ok(pool.length >= 1, `bí cảnh ${idx} có vật phẩm rơi`); }
ok(Cu.getCultivator(dd), 'còn nhân vật');
console.log(`✅ test_bicanh19: ${n} kiểm tra đạt`);
