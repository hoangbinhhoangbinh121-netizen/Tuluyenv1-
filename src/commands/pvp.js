'use strict';
const { defineCommand } = require('./framework');
const Pvp = require('../game/pvp');
const P = require('../game/pvpCore');
const Cu = require('../game/cultivator');
const D = require('../db');
const { E } = require('../game/emoji');
const { buildHistoryEmbed, buildStatsEmbed, battleLogPanel } = require('../ui/pvpViews');
const C21 = require('../game/combat21');

defineCommand({
  name: 'dauphap', description: 'Đấu pháp với người chơi khác', needsCultivator: true,
  options: [{ name: 'doi_thu', type: 'user', required: true, description: 'Đối thủ' }],
  async run(ctx) {
    const err = await Pvp.sendChallenge(ctx.user.id, ctx.args.doi_thu.id, (p) => ctx.send(p));
    if (err) return ctx.send(err);
    return null;
  },
});
defineCommand({ name: 'mopvp', description: '[Admin] Mở PvP (đấu pháp) cho mọi người chơi', guildAdmin: true,
  run: (c) => { P.pvpSetLocked(false); return c.send(`${E.kiem} **PvP đã MỞ** — mọi đạo hữu có thể khiêu chiến bằng menu \`/tutien\` hoặc \`/dauphap\`.`); } });
defineCommand({ name: 'khoapvp', description: '[Admin] Khoá PvP tạm thời (bảo trì/cân bằng)', guildAdmin: true,
  run: (c) => { P.pvpSetLocked(true); return c.send('🔒 **PvP đã KHOÁ.** Gõ `/mopvp` để mở lại bất cứ lúc nào.'); } });
defineCommand({
  name: 'thongkepvp', description: 'Xem thống kê thắng/thua đấu pháp của bạn hoặc người khác',
  options: [{ name: 'thanh_vien', type: 'user', description: 'Thành viên (bỏ trống = bạn)' }],
  run(c) {
    const t = c.args.thanh_vien || c.user; const row = Cu.getCultivator(t.id);
    if (!row) return c.send(`❌ <@${t.id}> chưa bắt đầu tu tiên.`);
    return c.send({ embeds: [buildStatsEmbed(t, row)] });
  },
});
defineCommand({
  name: 'lichsupvp', description: 'Xem các trận đấu pháp gần nhất, hoặc nhật ký đầy đủ của 1 trận (mã trận)',
  options: [{ name: 'ma_tran', type: 'string', description: 'Mã trận (có trong lịch sử / cuối trận) để xem nhật ký đầy đủ' }, { name: 'thanh_vien', type: 'user', description: 'Thành viên (bỏ trống = bạn)' }],
  run(c) {
    const mm = c.args.ma_tran ? /^<@!?(\d{15,})>$|^(\d{15,})$/.exec(String(c.args.ma_tran).trim()) : null;       // dùng tiền tố: `?lichsupvp @ai_đó` rơi vào ô đầu
    if (mm && !c.args.thanh_vien) c.args.thanh_vien = { id: mm[1] || mm[2], username: mm[1] || mm[2] };
    if (c.args.ma_tran && !mm) {
      const id = String(c.args.ma_tran).trim().toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, 16);
      return c.send(battleLogPanel(id, 0, 0, c.user.id));
    }
    const t = c.args.thanh_vien || c.user;
    const rows = D.all('SELECT winner_id, loser_id, stake, ended_at FROM pvp_history WHERE winner_id = ? OR loser_id = ? ORDER BY ended_at DESC LIMIT 8', t.id, t.id);
    const rows213 = C21.recent(t.id, 8);
    if (!rows.length && !rows213.length) return c.send(`ℹ️ <@${t.id}> chưa có trận đấu pháp nào được ghi nhận.`);
    return c.send({ embeds: [buildHistoryEmbed(t, rows, rows213)] });
  },
});
