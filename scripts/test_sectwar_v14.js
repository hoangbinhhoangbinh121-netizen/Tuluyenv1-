'use strict';
// Kiểm thử Tông Môn Chiến v14.0: 2 chiến trường (Nhân Giới / Linh Giới), bảng giao chiến tĩnh, admin hạ gục tức thì. Chạy: node scripts/test_sectwar_v14.js
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_sw_${Date.now()}.db`);
const assert = require('node:assert');
const D = require('../src/db'); D.initDb();
const Cu = require('../src/game/cultivator'); const W = require('../src/game/sectwar'); const kit = require('../src/ui/kit'); const V = require('../src/ui/sectWarViews');
const mk = (id, sect, wt, realm) => { Cu.createCultivator(id); D.run('UPDATE cultivators SET sect_id = ?, world_tier = ?, realm_index = ? WHERE user_id = ?', sect, wt, realm, id); };
D.run("INSERT INTO sects (sect_id, name, leader_id) VALUES (1,'Nhân A',1),(2,'Nhân B',2),(3,'Linh C',3),(4,'Linh D',4)");
mk(1, 1, 0, 2); mk(2, 2, 0, 2); mk(3, 3, 1, 6); mk(4, 4, 1, 6);
const G = 'g1';
// --- 2 chiến trường độc lập ---
const wN = W.createWar(G, 'c1', 'registration', 0); const wL = W.createWar(G, 'c1', 'registration', 1);
assert.notStrictEqual(wN, wL);
assert.strictEqual(W.getActiveWar(G, 0).war_id, wN); assert.strictEqual(W.getActiveWar(G, 1).war_id, wL);
assert.ok(W.isEligible(Cu.getCultivator(1), 0) && !W.isEligible(Cu.getCultivator(1), 1));
assert.ok(W.isEligible(Cu.getCultivator(3), 1) && !W.isEligible(Cu.getCultivator(3), 0));
W.activateWar(wN); W.activateWar(wL);
const mkI = (uid, cid, admin, values) => {
  const out = { calls: [] };
  const i = { user: { id: String(uid) }, customId: cid, values: values || [], guildId: G, guild: { members: { cache: new Map() } }, memberPermissions: { has: () => !!admin }, deferred: false, replied: false,
    reply: async (p) => { out.calls.push(['reply', p]); i.replied = true; }, update: async (p) => { out.calls.push(['update', p]); i.replied = true; }, followUp: async (p) => { out.calls.push(['followUp', p]); } };
  out.i = i; return out;
};
(async () => {
  // người Nhân Giới bấm nút ở chiến trường Linh Giới → bị chặn
  let r = mkI(1, `sw|mv|${wL}|bac`); await kit.routeComponent(r.i); assert.ok(/Linh Giới/.test(r.calls[0][1].content), 'chặn sai thế giới');
  // 1,2 (Nhân) vào Bắc Thành qua bản đồ công khai
  r = mkI(1, `sw|mv|${wN}|bac`); await kit.routeComponent(r.i); assert.strictEqual(r.calls[0][0], 'reply'); assert.ok(r.calls[0][1].content.includes('Bắc Thành'));
  assert.ok(r.calls[0][1].components.length >= 2);
  W.moveToNode(wN, 2, 2, 'bac'); W.moveToNode(wL, 3, 3, 'bac'); W.moveToNode(wL, 4, 4, 'bac');
  // địch ở Linh Giới không lẫn vào Nhân Giới
  const en1 = W.getAttackableEnemies(wN, 1); assert.deepStrictEqual(en1.enemies.map((x) => x.user_id), [2]);
  // người chơi thường đánh tiếp (cập nhật tại chỗ)
  await new Promise((s) => setTimeout(s, 1100));
  r = mkI(1, `sw|pk|${wN}`); await kit.routeComponent(r.i); assert.strictEqual(r.calls[0][0], 'update'); assert.ok(/Nhật ký/.test(r.calls[0][1].content), r.calls[0][1].content);
  // Admin ở Linh Giới: giao chiến → trừ 1e17, hạ gục tức thì
  await new Promise((s) => setTimeout(s, 1100));
  r = mkI(3, `sw|ga|${wL}`, true); await kit.routeComponent(r.i); const txt = r.calls[0][1].content;
  assert.ok(txt.includes('100000000000000000'), txt); assert.ok(txt.includes('HẠ GỤC'), txt);
  const p4 = W.getParticipant(wL, 4); assert.strictEqual(p4.hp, 0); assert.ok(p4.revive_at > Date.now() / 1000);
  assert.ok(W.getWarLog(wL).some((l) => l.includes('thiên phạt')));
  assert.strictEqual(W.getWarScores(wL)['3'], 10);
  // Nhân Giới không bị ảnh hưởng
  assert.ok((W.getParticipant(wN, 2).hp || 1) > 0);
  // Không phải admin → sát thương thường (không bao giờ ra 1e17)
  await new Promise((s) => setTimeout(s, 1100));
  r = mkI(2, `sw|pk|${wN}`); await kit.routeComponent(r.i); assert.ok(!r.calls[0][1].content.includes('100000000000000000'));
  // Bản đồ có chiến báo + tên chiến trường; refresh/enter dùng nút tĩnh
  r = mkI(3, `sw|rf|${wL}`); await kit.routeComponent(r.i); const emb = r.calls[0][1].embeds[0].toJSON(); assert.ok(emb.title.includes('Linh Giới')); assert.ok(emb.fields.some((f) => f.name.includes('Chiến Báo')));
  // trận kết thúc → bảng cũ báo hết hạn nhưng KHÔNG báo "menu hết hạn"
  D.run("UPDATE sect_wars SET status='finished' WHERE war_id = ?", wN);
  r = mkI(1, `sw|pk|${wN}`); await kit.routeComponent(r.i); assert.ok(/không còn diễn ra/.test(r.calls[0][1].content));
  // runTick vẫn chạy với 2 trận
  W.runTick();
  console.log('✅ test_sectwar_v14 OK');
  process.exit(0);
})().catch((e) => { console.error('❌', e); process.exit(1); });
