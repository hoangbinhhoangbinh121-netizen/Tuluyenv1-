'use strict';
// V19.9 — Boss mạnh hơn 10–20 lần (Bí Cảnh Tiên Giới + Boss Thế Giới), thang tăng dần, chỉnh sống trong /quantri, emoji pixel a19_* gắn vào nút/nhật ký.
process.env.TULUYEN_DB_PATH = require('node:path').join(require('node:os').tmpdir(), `tg_boss199_${Date.now()}.db`);
const assert = require('node:assert'); const fs = require('node:fs'); const path = require('node:path');
const D = require('../src/db'); D.initDb();
const K = require('../src/game/constants'); const Cu = require('../src/game/cultivator'); const BC = require('../src/game/bicanh19'); const B = require('../src/data/bicanh19');
const BOSS = require('../src/game/boss'); const A = require('../src/game/admin17'); const E9 = require('../src/ui/emo19'); const EM = require('../src/game/emoji'); const BV = require('../src/ui/bicanh19Views');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const mk = (id, realm) => { Cu.createCultivator(id); D.run('UPDATE cultivators SET realm_index = ?, stage_index = 1, world_tier = 2, thiennhanngusuy_passed = 1 WHERE user_id = ?', realm, id); return Cu.getCultivator(id); };

// ---- 1) đường cong sức mạnh: tăng NGHIÊM NGẶT theo bí cảnh, mọi loại kẻ địch; Boss cuối ×10 → ×20 HP
ok(K.BC19_HP_MULT === 1 && K.BC19_ATK_MULT === 1 && K.WB_HP_MULT === 15 && K.WB_ATK_MULT === 2.5, 'mặc định hệ số boss');
for (const kind of ['normal', 'elite', 'mini', 'guard', 'final']) {
  for (let i = 1; i < 19; i += 1) { const a = BC.bossPower(i - 1, kind); const b = BC.bossPower(i, kind); ok(b.hp > a.hp && b.atk > a.atk, `bí cảnh ${i} mạnh hơn ${i - 1} (${kind})`); }
}
ok(Math.abs(BC.bossPower(0, 'final').hp - 10) < 1e-9 && Math.abs(BC.bossPower(18, 'final').hp - 20) < 1e-9, 'Boss cuối: HP ×10 → ×20');
ok(BC.bossPower(0, 'final').atk >= 1 && BC.bossPower(18, 'final').atk > BC.bossPower(0, 'final').atk, 'sát thương Boss không yếu hơn trước');
ok(BC.bossPower(9, 'final').hp > BC.bossPower(9, 'guard').hp && BC.bossPower(9, 'guard').hp > BC.bossPower(9, 'mini').hp && BC.bossPower(9, 'mini').hp > BC.bossPower(9, 'elite').hp && BC.bossPower(9, 'elite').hp > BC.bossPower(9, 'normal').hp, 'thứ bậc loại kẻ địch');
// Đại La Thiên Cung (3) KHÔNG được mạnh hơn Vương Giả Cổ Mộ / Chuẩn Tiên Vương (4)
ok(B.BCS[3].realm === 13 && B.BCS[4].realm === 14, 'bí cảnh 3 = Đại La, bí cảnh 4 = Chuẩn Tiên Vương');
ok(BC.bossPower(4, 'final').hp > BC.bossPower(3, 'final').hp && BC.bossPower(4, 'final').atk > BC.bossPower(3, 'final').atk, 'Chuẩn Tiên Vương mạnh hơn Đại La');

// ---- 2) kẻ địch sinh ra thật sự nhân hệ số: so cùng một người chơi, Boss cuối bí cảnh 4 > bí cảnh 3 và >> kiểu cũ
const row = mk(2001, 14); let prevAtk = 0;
for (let i = 0; i < 19; i += 1) {
  const st2 = BC.newState(i, [BC.snapMember(row, row.user_id, 'T', B.BCS[i])]); st2.floor = 4; st2.wave = 0; st2.pendingReward = 4; st2.cleared = 4; BC.nextFloor(st2);   // sang tầng 5 = Boss cuối
  const e = st2.enemy; ok(e && e.kind === 'final', `bí cảnh ${i}: tầng 5 là Boss cuối`);
  const meanAtk = st2.members[0].atk; const ratio = e.maxHp / (meanAtk * 40);   // hpMult ∈ [35,45] → ratio ≈ hpE × pow.hp × [0,875..1,125] × defF(0,92..1,08) × nhiễu v22.4.2 (0,93..1,07)
  const hpE = 1 + (B.BCS[i].diff.hp - 1) * BC.CFG.HP_EASE; const pw = BC.bossPower(i, 'final');
  ok(ratio >= hpE * pw.hp * 0.72 && ratio <= hpE * pw.hp * 1.32, `bí cảnh ${i}: HP Boss cuối ≈ hệ số × công người chơi (${ratio.toFixed(2)})`);
  ok(ratio >= 8 * hpE, `bí cảnh ${i}: Boss cuối trâu ≥ ×8 so với bản cũ`);
  ok(e.atkPct > prevAtk || i === 0, `bí cảnh ${i}: ATK Boss cuối tăng dần`); prevAtk = e.atkPct;
}
// hệ số /quantri: ×2 HP
{
  const make = () => { const st = BC.newState(5, [BC.snapMember(row, row.user_id, 'T', B.BCS[5])]); st.pendingReward = 4; st.cleared = 4; st.floor = 4; BC.nextFloor(st); return st.enemy; };
  const e1 = make(); K.BC19_HP_MULT = 2; K.BC19_ATK_MULT = 2; const e2 = make(); K.BC19_HP_MULT = 1; K.BC19_ATK_MULT = 1;
  ok(e2.maxHp / e1.maxHp > 1.5 && e2.maxHp / e1.maxHp < 2.6, 'BC19_HP_MULT ×2 → HP gần gấp đôi'); ok(e2.atkPct / e1.atkPct > 1.99 && e2.atkPct / e1.atkPct < 2.01, 'BC19_ATK_MULT ×2 → ATK gấp đôi');
}
ok(BC.CFG.DMG_CAP >= 9e17 && BC.CFG.AUTO_MAX >= 20, 'trần sát thương nâng + Tự Chiến dài hơn');

// ---- 3) Boss Thế Giới: HP tăng nghiêm ngặt theo cấp & nhân WB_HP_MULT
for (let i = 1; i < 11; i += 1) ok(BOSS.suggestedHp(i + 1) > BOSS.suggestedHp(i), `Boss Thế Giới cấp ${i + 1} trâu hơn cấp ${i}`);
{ const a = BOSS.suggestedHp(5); K.WB_HP_MULT = 30; const b = BOSS.suggestedHp(5); K.WB_HP_MULT = 15; ok(b / a > 1.95 && b / a < 2.05, 'WB_HP_MULT ×2 → HP ×2'); }
{ // phản đòn ×WB_ATK_MULT, không bao giờ giết hẳn người đánh
  const u = mk(2101, 8); D.run('UPDATE cultivators SET cur_hp = ?, atk = 1 WHERE user_id = ?', Cu.effectiveMaxHp(u), 2101);
  const s = BOSS.summon({ guildId: 'g', channelId: 'c', by: '1', capdo: 6, hp: 9e12, minutes: 30 }); ok(s.ok, 'triệu hồi boss');
  K.WB_ATK_MULT = 100; const r = BOSS.attack('g', '2101', 'atk'); K.WB_ATK_MULT = 2.5;
  ok(r.ok && r.hp >= 1, 'phản đòn cực nặng vẫn để người đánh còn ≥1 HP');
  const bb = BOSS.getAliveBoss('g'); BOSS.finish(bb.boss_id, 'cancelled');
}

// ---- 4) /quantri: hệ số Boss chỉnh sống + về mặc định
{
  const r1 = A.ecoSet('1', 'bchp', '3'); ok(r1.ok && K.BC19_HP_MULT === 3, 'ecoSet bchp'); const r2 = A.ecoSet('1', 'wbhp', 'x20'); ok(r2.ok && K.WB_HP_MULT === 20, 'ecoSet wbhp');
  const r3 = A.ecoSet('1', 'bcatk', '0.5'); ok(K.BC19_ATK_MULT === 0.5, 'ecoSet bcatk'); const r4 = A.ecoSet('1', 'wbatk', '4'); ok(K.WB_ATK_MULT === 4, 'ecoSet wbatk');
  ok(!A.ecoSet('1', 'bchp', '0').ok && !A.ecoSet('1', 'wbhp', '99999999').ok, 'biên an toàn');
  A.ecoReset('1'); ok(K.BC19_HP_MULT === 1 && K.BC19_ATK_MULT === 1 && K.WB_HP_MULT === 15 && K.WB_ATK_MULT === 2.5, 'ecoReset → mặc định');
  const QV = require('../src/ui/quantriViews'); ok(QV.MODALS.boss && QV.MODALS.boss.fields.length === 4, 'modal Sức mạnh Boss'); const msg = QV.MODALS.boss.run('1', (id) => ({ a: '2', b: '', c: '', d: '' }[id])); ok(/HP Boss Bí Cảnh/.test(msg) && K.BC19_HP_MULT === 2, 'modal chạy'); A.ecoReset('1');
}

// ---- 5) emoji pixel a19_*
const A19 = ['atk', 'trong', 'than', 'tuyet', 'bi', 'sk', 'guard', 'rest', 'item', 'auto', 'look', 'refresh', 'retreat', 'next', 'join', 'leave', 'start', 'cancel', 'done', 'warn', 'weak', 'dead', 'alive', 'log', 'gift', 'win', 'map', 'chart', 'll', 'crown', 'lock', 'check', 'cross'];
const FB = require('../src/data/emoji_fallback.json');
for (const k of A19) {
  const f = path.join(__dirname, '..', 'assets', 'emoji', `a19_${k}.png`); ok(fs.existsSync(f), `a19_${k}.png tồn tại`);
  const b = fs.readFileSync(f); ok(b.readUInt32BE(16) === 128 && b.readUInt32BE(20) === 128, `a19_${k} 128×128`); ok(b.length < 60000, `a19_${k} nhẹ`);
  ok(typeof FB[`a19_${k}`] === 'string' && FB[`a19_${k}`].length > 0, `a19_${k} có Unicode dự phòng`);
  ok(EM.ALL_KEYS.includes(`a19_${k}`), `a19_${k} nằm trong danh sách đồng bộ`);
}
ok(E9.a('atk') === FB.a19_atk, 'chưa tải lên → dùng Unicode dự phòng');
// emoji cũ KHÔNG bị đụng: các khóa pixel của bản trước vẫn nguyên (kiểm bằng số lượng + vài khóa mốc)
for (const k of ['canhgioi_14', 'bc19_04', 'boss19', 'mob_canh', 'kiem', 'hp', 'bosstg']) ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'emoji', `${k}.png`)), `emoji cũ ${k} còn nguyên`);
ok(EM.ALL_KEYS.length === 511 + A19.length + 26 + 31, `tổng emoji = 511 cũ + ${A19.length} mới v19 + 26 mới v20 + 31 chủng tộc v21.5 (${EM.ALL_KEYS.length})`);
// giả lập đã tải lên → px() & nút dùng thẻ pixel
let id = 700000000000000000n; for (const k of A19) EM.CUSTOM_EMOJI[`a19_${k}`] = `<:tg7_a19_${k}:${id++}>`;
const t = E9.px('⚔️ **A** dùng **Đánh Thường**\n✨ **A** dùng **Thần Thông**\n💢 **X** −5\n⚠️ **Boss** đang tụ lực\n🛡️ **A** thủ thế\n☠️ **A** gục\n✨ lấp lánh');
ok(/<:tg7_a19_atk:\d+>/.test(t) && /<:tg7_a19_than:\d+>/.test(t) && /<:tg7_a19_trong:\d+>/.test(t) && /<:tg7_a19_warn:\d+>/.test(t) && /<:tg7_a19_guard:\d+>/.test(t) && /<:tg7_a19_bi:\d+>/.test(t), 'px() đổi emoji Unicode trong nhật ký sang pixel');
ok(!/^⚔️|\n⚔️/.test(t) && t.endsWith('✨ lấp lánh'), 'px() chỉ đổi icon hành động, giữ ✨ giữa câu');
ok(E9.clip('a\n' + 'b'.repeat(30), 20) === 'a' && E9.clip('<:x:1>\n<:y:2>', 8) === '<:x:1>', 'clip() cắt theo dòng, không cắt giữa thẻ emoji');
const me = mk(2201, 10); const menu = BV.menuView('2201', 0); const comps = menu.components.flatMap((r) => (r.toJSON ? r.toJSON() : r).components);
const solo = comps.find((c) => /\|solo\|/.test(c.custom_id || '')); ok(solo && solo.emoji && /^\d+$/.test(String(solo.emoji.id)), 'nút Tiến vào dùng emoji pixel (có id)');
console.log(`✅ test_boss_v19_9 OK (${n} kiểm tra)`);
