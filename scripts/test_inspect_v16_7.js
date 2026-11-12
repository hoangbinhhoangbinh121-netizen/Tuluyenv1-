'use strict';
// V16.7 — gỡ giao dịch Linh Căn/Thể Chất + lệnh admin /xemnguoichoi.
const os = require('node:os'); const path = require('node:path'); const assert = require('node:assert');
process.env.TULUYEN_DB_PATH = path.join(os.tmpdir(), `tg_insp167_${Date.now()}.db`);
const D = require('../src/db'); D.initDb();
const K = require('../src/game/constants'); const Cu = require('../src/game/cultivator'); const C16 = require('../src/game/congphapV16'); const D16 = require('../src/data/congphap_v16');
const TR = require('../src/game/trade'); const IN = require('../src/game/inspect');
require('../src/commands/social'); require('../src/commands/adminXem'); const { registry } = require('../src/commands/framework');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const mk = (id, f = {}) => { Cu.createCultivator(id); Cu.updateCultivator(id, f); return id; };

// ---- 1) Giao dịch: không còn đổi Linh Căn / Thể Chất
mk('1001', { linh_thach: 1000, dan_duoc: 5, linh_can: 'Kim Linh Căn', the_chat: 'Phàm Thể' }); mk('1002', { linh_thach: 1000, dan_duoc: 5, linh_can: 'Hỏa Linh Căn', the_chat: 'Cuồng Thể' });
for (const args of [[true, false, true, false], [false, true, false, true], [true, true, true, true], [true, false, false, false], [false, false, false, true]]) {
  const r = TR.createOffer('1001', '1002', 0, 0, args[0], args[1], 0, 0, args[2], args[3]); ok(r === TR.MSG_NO_TALENT_TRADE, 'từ chối đổi căn cốt: ' + args.join());
}
ok(D.get('SELECT COUNT(*) c FROM trade_pending').c === 0, 'không tạo đề xuất nào');
ok(TR.createOffer('1001', '1002', 100, 1, false, false, 50, 0, false, false) === 'ok', 'Linh Thạch/Đan Dược vẫn giao dịch được');
const msg = TR.acceptOffer('1001', '1002'); ok(/Giao dịch thành công/.test(msg) && !/Linh Căn|Thể Chất/.test(msg), 'chấp nhận bình thường');
const a = Cu.getCultivator('1001'); const b = Cu.getCultivator('1002'); ok(a.linh_thach === 950 && b.linh_thach === 1050 && a.dan_duoc === 4 && b.dan_duoc === 6, 'cộng trừ đúng');
ok(a.linh_can === 'Kim Linh Căn' && b.the_chat === 'Cuồng Thể', 'căn cốt không đổi');
// đề xuất tồn đọng từ bản cũ (có cờ đổi căn cốt) bị huỷ khi chấp nhận, không đổi gì
D.run('INSERT INTO trade_pending (from_id, to_id, linh_thach, dan_duoc, linh_can_give, the_chat_give, want_linh_thach, want_dan_duoc, want_linh_can, want_the_chat, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', '1001', '1002', 0, 0, 1, 0, 0, 0, 1, 0, Math.floor(Date.now() / 1000));
const old = TR.acceptOffer('1001', '1002'); ok(/loại bỏ/.test(old), 'đề xuất cũ bị huỷ'); ok(Cu.getCultivator('1001').linh_can === 'Kim Linh Căn' && Cu.getCultivator('1002').linh_can === 'Hỏa Linh Căn', 'không đổi linh căn'); ok(!TR.getOffer('1001', '1002'), 'đã xoá đề xuất');
const sl = registry.get('giaodich'); ok(sl && !sl.options.some((o) => /doi_/.test(o.name)), 'lệnh /giaodich hết tuỳ chọn đổi căn cốt'); ok(!/Linh Căn|Thể Chất/.test(sl.description), 'mô tả lệnh');
const guide = require('fs').readFileSync(path.join(__dirname, '../src/data/guide.json'), 'utf8'); ok(!/giao dịch 2 chiều \(Linh Thạch\/Đan Dược\/Linh Căn/.test(guide), 'hướng dẫn đã sửa');

// ---- 2) /xemnguoichoi
const cmd = registry.get('xemnguoichoi'); ok(cmd && cmd.admin === true, 'lệnh admin');
const rich = mk('2001', { realm_index: 9, world_tier: 2, linh_thach: 123456789, linh_tinh: 4321, dan_duoc: 77, ruong_than_bi: 3, partner_id: '1001', dao_lu_level: 3, pvp_wins: 5, pvp_losses: 2, redeemed_codes: 'DENBUMATDULIEU,TYSVTOP1', last_tuluyen: Math.floor(Date.now() / 1000) - 60, title: 'Thử Nghiệm' });
for (const t of [1008, 1021, 1031, 1040, 1032]) C16.grantDirect(rich, t); C16.setEquipped(rich, [1040, 1031, 1032]);
Cu.updateCultivator(rich, { cong_phap_owned: [...Cu.ownedCongphapTiers(Cu.getCultivator(rich)), 1, 3, 201].join(',') });
for (const [k] of IN.TABS) {
  const p = IN.page(rich, k); ok(p && p.title, `tab ${k}`);
  const total = p.title.length + (p.description || '').length + p.fields.reduce((s, f) => s + f.name.length + f.value.length, 0);
  ok(total <= 6000 && (p.description || '').length <= 4096 && p.fields.length <= 25 && p.fields.every((f) => f.value.length <= 1024 && f.value.length > 0 && f.name.length <= 256), `tab ${k} trong giới hạn Discord (${total})`);
}
ok(IN.page('999999', 'tq') === null, 'người không tồn tại → null');
const cs = JSON.stringify(IN.page(rich, 'cs')); ok(/công pháp mới/.test(cs) && /Lực chiến/.test(cs), 'tab chỉ số có nguồn công pháp mới');
const txt = IN.fullText(rich); ok(txt.includes('linh_thach = 123456789') && txt.includes('## TẤT CẢ CỘT') && txt.includes(String(Cu.calcLucChien(Cu.getCultivator(rich)))), 'file đầy đủ');
ok(Object.keys(Cu.getCultivator(rich)).every((c) => txt.includes(`\n${c} = `)), 'mọi cột DB đều có trong file');
// chạy lệnh qua framework: admin được, người thường bị chặn
const sent = []; const mkCtx = (uid, args) => ({ user: { id: uid }, args, send: async (p) => sent.push(p), interaction: { reply: async (p) => sent.push(p) } });
const adminId = String(K.ADMIN_CODE_APPROVER_IDS[0]);
(async () => {
  const F = require('../src/commands/framework');
  await cmd.run(mkCtx(adminId, { thanh_vien: { id: rich } })); const first = sent.pop();
  ok(first.embeds && first.components && first.components.length === 2, 'lệnh trả embed + select + nút xuất file');
  ok(String(first.flags) === String(require('discord.js').MessageFlags.Ephemeral), 'phản hồi riêng tư (ephemeral)');
  await cmd.run(mkCtx(adminId, { id: ` <@${rich}> ` })); ok(sent.pop().embeds, 'tra bằng ID');
  await cmd.run(mkCtx(adminId, { id: '12345' })); ok(/Không có dữ liệu/.test(sent.pop().content), 'ID lạ');
  await cmd.run(mkCtx(adminId, {})); ok(/chọn/.test(sent.pop().content), 'thiếu tham số');
  // bấm thật: chọn từng tab trong select + nút xuất file
  const AX = require('../src/commands/adminXem'); const v = AX.viewFor(adminId, rich, 'tq');
  for (const [k] of IN.TABS) {
    const out = []; await AX.viewFor(adminId, rich, 'tq').find('tab').handler({ values: [k], update: async (p) => out.push(p), message: {} });
    ok(out[0] && out[0].embeds && out[0].embeds[0] && out[0].components.length === 2, `chọn tab ${k}`);
  }
  const o2 = []; await v.find('file').handler({ reply: async (p) => o2.push(p) });
  ok(o2[0] && o2[0].files && o2[0].files.length === 1 && String(o2[0].flags) === String(require('discord.js').MessageFlags.Ephemeral), 'nút xuất file đính kèm .txt, riêng tư');
  const o3 = []; await AX.viewFor(adminId, '999999', 'tq').find('tab').handler({ values: ['cs'], update: async (p) => o3.push(p) }); ok(/không còn dữ liệu/.test(o3[0].content), 'người đã xoá dữ liệu');
  console.log(`✅ test_inspect_v16_7 OK (${n} kiểm tra)`);
})().catch((e) => { console.error(e); process.exit(1); });
