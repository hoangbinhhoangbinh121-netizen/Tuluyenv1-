'use strict';
// V22.2 — !bxh: ẩn / xoá khỏi bảng xếp hạng + công tắc bật/tắt.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_lb22_${Date.now()}.db`);
const assert = require('node:assert');
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const LB = require('../src/game/lbHide'); const ST = require('../src/game/settings');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const mk = (id, realm) => { Cu.createCultivator(String(id)); D.run('UPDATE cultivators SET realm_index = ?, stage_index = 1, tu_vi = 1000 WHERE user_id = ?', realm, String(id)); return String(id); };
const A = mk('100000000000000001', 9); const B = mk('100000000000000002', 8); const C = mk('100000000000000003', 7);
const SV = require('../src/ui/socialViews');
const board = () => JSON.stringify(SV.buildLeaderboardEmbed().toJSON ? SV.buildLeaderboardEmbed().toJSON() : SV.buildLeaderboardEmbed());
ok(board().includes(A) && board().includes(B) && board().includes(C), 'ban đầu thấy cả 3');
ok(LB.enabled() && LB.hiddenIds().length === 0, 'mặc định BẬT, chưa ai bị ẩn');

// ---- ẩn
let r = LB.set(B, 'an', 'admin1', 'thử'); ok(r.ok && r.mode === 'an' && r.purged === 0, 'ẩn');
ok(!board().includes(B) && board().includes(A) && board().includes(C), 'Thiên Kiêu Bảng: B biến mất, A và C còn');
ok(LB.isHidden(B) && !LB.isHidden(A), 'isHidden');

// ---- dữ liệu xếp hạng lưu riêng
D.run('INSERT INTO ev19_hall (user_id, wins, best_damage, total_damage, last_at) VALUES (?,?,?,?,?)', A, 3, 100, 300, 1); D.run('INSERT INTO ev19_hall (user_id, wins, best_damage, total_damage, last_at) VALUES (?,?,?,?,?)', B, 5, 900, 1500, 1);
const EV = require('../src/game/event19'); ok(EV.hallTop(10).map((x) => x.user_id).join() === A, 'bảng thành tích: B (đang ẩn) không hiện, dữ liệu vẫn còn');
ok(!!D.get('SELECT 1 x FROM ev19_hall WHERE user_id = ?', B), 'ẩn KHÔNG xoá dữ liệu');
D.run("INSERT INTO wb7_boss (boss_id, guild_id, name, tier, hp, max_hp, status, spawned_at, expires_at) VALUES (1,'G','X',1,0,10,'dead',1,2),(2,'G','Y',1,5,10,'alive',1,2)");
for (const [bid, u, d] of [[1, A, 10], [1, B, 99], [2, B, 77], [2, A, 5]]) D.run('INSERT INTO wb7_damage (boss_id, user_id, damage, hits, last_hit) VALUES (?,?,?,?,0)', bid, u, d, 1);
const BS = require('../src/game/boss'); const BV = require('../src/ui/bossViews');
const lb = require('../src/game/lbHide'); ok(lb.filter(BS.ranking(1, 50)).map((x) => x.user_id).join() === A, 'sát thương Boss 1: B bị lọc khỏi bảng');
const chuoiRow = (lo, hi, st) => D.run('INSERT INTO chuoi_pairs (user_lo, user_hi, streak, best, total_days, last_lo_day, last_hi_day, last_done_day) VALUES (?,?,?,?,?,?,?,?)', lo, hi, st, st, st, 99999, 99999, 99999);
chuoiRow(A, C, 5); chuoiRow(B, C, 9);
const CH = require('../src/game/chuoi'); const lbd = CH.leaderboard(10, 99999 * 86400);
ok(lbd.length === 1 && lbd[0].streak === 5, `Chuỗi: cặp có B bị ẩn cả cặp (${JSON.stringify(lbd)})`);

// ---- công tắc tổng
LB.setEnabled(false); ok(!LB.enabled() && LB.hiddenIds().length === 0 && board().includes(B) && CH.leaderboard(10, 99999 * 86400).length === 2 && EV.hallTop(10).length === 2, 'TẮT: tất cả hiện lại');
LB.setEnabled(true); ok(!board().includes(B) && EV.hallTop(10).length === 1, 'BẬT lại: ẩn lại ngay');

// ---- xoá
r = LB.set(B, 'xoa', 'admin1', 'gian lận'); ok(r.ok && r.purged === 2, `xoá gỡ ${r.purged} dòng (hall + boss đã kết thúc)`);
ok(!D.get('SELECT 1 x FROM ev19_hall WHERE user_id = ?', B), 'ev19_hall của B đã gỡ');
ok(!D.get('SELECT 1 x FROM wb7_damage WHERE boss_id = 1 AND user_id = ?', B) && !!D.get('SELECT 1 x FROM wb7_damage WHERE boss_id = 2 AND user_id = ?', B), 'sát thương Boss ĐÃ kết thúc gỡ; Boss ĐANG SỐNG giữ nguyên (để chia thưởng)');
ok(D.all('SELECT * FROM lb_removed WHERE user_id = ?', B).length === 2, 'có bản sao lưu');
// xoá → ẩn: trả lại điểm
r = LB.set(B, 'an', 'admin1'); ok(r.ok && r.restored === 2 && !!D.get('SELECT 1 x FROM ev19_hall WHERE user_id = ?', B) && D.all('SELECT * FROM lb_removed').length === 0, 'xoá→ẩn: khôi phục điểm đã gỡ');
LB.set(B, 'xoa', 'admin1'); const u = LB.unset(B, 'admin1');
ok(u.ok && u.restored === 2 && u.was === 'xoa' && board().includes(B) && EV.hallTop(10).length === 2 && D.get('SELECT damage FROM wb7_damage WHERE boss_id = 1 AND user_id = ?', B).damage === 99, 'hien: hiện lại + khôi phục đủ điểm');
ok(!LB.unset(B, 'a').ok, 'hien người không bị ẩn ⇒ báo, không lỗi');
ok(!LB.set(B, 'khac', 'a').ok && !LB.set('', 'an', 'a').ok, 'sai chế độ / thiếu người ⇒ từ chối');
ok(D.all("SELECT * FROM admin_log17 WHERE action LIKE 'bxh_%'").length >= 4, 'ghi nhật ký admin');

// ---- lệnh !bxh
require('../src/commands/admin'); const reg = require('../src/commands/framework').registry; const cmd = reg.get('bxh');
ok(cmd && cmd.prefixOnly && cmd.anyAdmin, '!bxh tồn tại, prefixOnly + admin');
(async () => {
  const run = async (content, args) => { const out = []; await cmd.run({ args, user: { id: '1' }, message: { content }, send: async (x) => out.push(String(x)) }); return out.join('\n'); };
  let o = await run('!bxh', {}); ok(/Ẩn \/ xoá/.test(o) && /BẬT/.test(o), 'không tham số ⇒ hướng dẫn');
  o = await run(`!bxh an <@${C}> spam tên`, { hanh_dong: 'an', thanh_vien: { id: C } }); ok(/ẩn/.test(o) && LB.isHidden(C) && D.get('SELECT reason FROM lb_hidden WHERE user_id = ?', C).reason === 'spam tên', 'an + lý do nhiều từ');
  o = await run('!bxh ds', { hanh_dong: 'ds' }); ok(o.includes(C) && /spam tên/.test(o), 'ds');
  o = await run('!bxh tat', { hanh_dong: 'tat' }); ok(!LB.enabled() && /TẮT/.test(o), 'tat');
  o = await run(`!bxh xoa ${C}`, { hanh_dong: 'xoa', thanh_vien: { id: C } }); ok(/TẮT/.test(o), 'xoá khi tính năng tắt ⇒ cảnh báo');
  o = await run('!bxh bat', { hanh_dong: 'bat' }); ok(LB.enabled() && /BẬT/.test(o), 'bat');
  o = await run('!bxh xoa', { hanh_dong: 'xoa' }); ok(/Cần người chơi/.test(o), 'thiếu người ⇒ hướng dẫn');
  o = await run(`!bxh hien ${C}`, { hanh_dong: 'hien', thanh_vien: { id: C } }); ok(/hiện lại/.test(o) && !LB.isHidden(C), 'hien');
  o = await run('!bxh linh tinh', { hanh_dong: 'linh' }); ok(/không hợp lệ/.test(o), 'hành động lạ ⇒ báo');
  console.log(`✅ test_lbhide22: ${n} kiểm tra PASS`); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
