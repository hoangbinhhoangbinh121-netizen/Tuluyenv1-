'use strict';
/** Lệnh admin v13.7: đầy tu vi · tặng Thể Chất / Linh Căn · thu hồi · roll lại · tăng tốc tu luyện toàn server. */
const { defineCommand } = require('./framework');
const K = require('../game/constants');
const Cu = require('../game/cultivator');
const T = require('../game/talent');
const AT = require('../game/adminTalent');
const ST = require('../game/settings');
const { fmtNum, now } = require('../util');
const { createEmbed } = require('../ui/components/baseEmbed');
const { announceWorld } = require('../ui/worldChannel');
const { E } = require('../ui/emojis');

const memberOpt = { name: 'thanh_vien', type: 'user', required: true, description: 'Thành viên' };
const chTc = K.THE_CHAT.map((t) => ({ name: `${t.name} (x${t.mult})`.slice(0, 100), value: t.name }));
const chLc = K.LINH_CAN.map((t) => ({ name: `${t.name} (x${t.mult})`.slice(0, 100), value: t.name }));
const kindChoices = [{ name: 'Thể Chất', value: 'the_chat' }, { name: 'Linh Căn', value: 'linh_can' }, { name: 'Cả hai', value: 'ca_hai' }];
const kindsOf = (v) => (v === 'ca_hai' ? ['the_chat', 'linh_can'] : (v === 'the_chat' || v === 'linh_can' ? [v] : null));
const noUser = (u) => `❌ <@${u?.id}> chưa bắt đầu tu tiên.`;
const profileLine = (row) => `${T.shortTheChat(row)} · ${T.shortLinhCan(row)}`;

defineCommand({
  name: 'fullexp', description: '[Admin] Đầy tu vi cho 1 thành viên (đủ để đột phá tầng kế tiếp)', admin: true,
  options: [memberOpt],
  async run(ctx) {
    const u = ctx.args.thanh_vien; const r = u && AT.fullExp(u.id);
    if (!r) return ctx.send(noUser(u));
    return ctx.send(`✅ Đã đầy tu vi cho <@${u.id}>: **${fmtNum(r.before)}** → **${fmtNum(r.after)}** (mức cần để đột phá: ${fmtNum(r.need)}). Dùng \`/dotpha\` để đột phá.`);
  },
});

const giveCmd = (name, kind, choices, label) => defineCommand({
  name, description: `[Admin] Tặng ${label} chỉ định cho 1 thành viên (lưu bản gốc để thu hồi)`, admin: true,
  options: [memberOpt, { name: 'pham_cap', type: 'string', required: true, description: `Phẩm cấp ${label}`, choices }],
  async run(ctx) {
    const u = ctx.args.thanh_vien; if (!u || !Cu.getCultivator(u.id)) return ctx.send(noUser(u));
    const r = AT.give(u.id, kind, ctx.args.pham_cap, ctx.user.id);
    if (!r.ok) return ctx.send(r.msg);
    return ctx.send(`🎁 Đã tặng **${label}** cho <@${u.id}>: **${r.before}** → **${r.info.name}** (x${r.info.mult}). Hồ sơ thức tỉnh/tiến hóa được đặt lại, hành & độ tinh khiết roll mới.\n${profileLine(r.row)}\nDùng \`/thuhoituchat\` để trả về bản gốc.`);
  },
});
giveCmd('tangthechat', 'the_chat', chTc, 'Thể Chất');
giveCmd('tanglinhcan', 'linh_can', chLc, 'Linh Căn');

defineCommand({
  name: 'thuhoituchat', description: '[Admin] Thu hồi Thể Chất / Linh Căn đã tặng hoặc roll lại — trả về bản gốc ban đầu của thành viên', admin: true,
  options: [memberOpt, { name: 'loai', type: 'string', required: true, description: 'Thu hồi phần nào', choices: kindChoices }],
  async run(ctx) {
    const u = ctx.args.thanh_vien; const kinds = kindsOf(ctx.args.loai);
    if (!u || !kinds) return ctx.send('❌ Thiếu thành viên hoặc loại không hợp lệ.');
    const r = AT.revoke(u.id, kinds, ctx.user.id);
    if (r.noUser) return ctx.send(noUser(u));
    const lines = [...r.restored.map((x) => `↩️ ${x}`), ...r.none.map((x) => `ℹ️ ${x}: không có bản tặng/roll nào của admin để thu hồi.`)];
    return ctx.send(`🔙 Thu hồi cho <@${u.id}>:\n${lines.join('\n')}`);
  },
});

defineCommand({
  name: 'rolltuchat', description: '[Admin] Roll lại ngẫu nhiên Thể Chất / Linh Căn của 1 thành viên (miễn phí, có thể thu hồi)', admin: true,
  options: [memberOpt, { name: 'loai', type: 'string', required: true, description: 'Roll lại phần nào', choices: kindChoices }],
  async run(ctx) {
    const u = ctx.args.thanh_vien; const kinds = kindsOf(ctx.args.loai);
    if (!u || !kinds) return ctx.send('❌ Thiếu thành viên hoặc loại không hợp lệ.');
    if (!Cu.getCultivator(u.id)) return ctx.send(noUser(u));
    const lines = []; let last;
    for (const kind of kinds) {
      const r = AT.reroll(u.id, kind, ctx.user.id); if (!r.ok) return ctx.send(r.msg);
      lines.push(`🎲 ${AT.KIND[kind].label}: **${r.before}** → **${r.info.name}** (x${r.info.mult})`); last = r.row;
    }
    return ctx.send(`${lines.join('\n')}\nDành cho <@${u.id}> · ${profileLine(Cu.getCultivator(u.id))}`);
  },
});

defineCommand({
  name: 'tangtoctuluyen', description: '[Admin] Tăng tốc độ tu luyện TOÀN BỘ người chơi (Tu Luyện, Bế Quan, Bế Quan Treo) — bỏ trống để xem', admin: true,
  options: [
    { name: 'he_so', type: 'string', description: `Hệ số nhân thêm ${ST.SPEED_MIN}–${ST.SPEED_MAX} (vd 2 = gấp đôi, 1 hoặc "tat" = tắt)` },
    { name: 'so_phut', type: 'int', description: 'Tự hết hạn sau bao nhiêu phút (bỏ trống/0 = đến khi tắt)' },
  ],
  async run(ctx) {
    const raw = String(ctx.args.he_so || '').trim().toLowerCase().replace(',', '.');
    const show = () => {
      const i = ST.speedInfo();
      if (!i.active) return 'ℹ️ Hiện **không** có sự kiện tăng tốc (hệ số ×1).';
      return `${E.tangtoc} Đang tăng tốc toàn server **×${i.mult}** ${i.until ? `— còn ${Math.max(1, Math.ceil((i.until - now()) / 60))} phút` : '— đến khi admin tắt'}.`;
    };
    if (!raw) return ctx.send(show());
    // v13.8: thông báo ra kênh thế giới (/datkenhthegioi) hoặc kênh hiện tại nếu chưa cài
    const announce = async (title, text) => {
      try {
        const client = (ctx.interaction || ctx.message || {}).client; if (!client || !ctx.guild) return;
        await announceWorld(client, ctx.guild.id, createEmbed({ cat: 'thiendao', header: 'THIÊN ĐẠO', status: title, description: text }), { channelId: ctx.channel && ctx.channel.id });
      } catch (_) { /* thông báo lỗi không làm hỏng lệnh */ }
    };
    if (['tat', 'off', 'reset', 'huy'].includes(raw)) {
      const was = ST.speedInfo().active; ST.setSpeed(1, 0);
      if (was) await announce('Sự kiện kết thúc', '🛑 Sự kiện **tăng tốc tu luyện** đã kết thúc. Tốc độ tu luyện trở lại bình thường.');
      return ctx.send('🛑 Đã tắt sự kiện tăng tốc tu luyện (về ×1).');
    }
    const m = Number(raw);
    if (!(m >= ST.SPEED_MIN && m <= ST.SPEED_MAX)) return ctx.send(`❌ Hệ số phải từ ${ST.SPEED_MIN} đến ${ST.SPEED_MAX}.`);
    ST.setSpeed(m, Math.max(0, Number(ctx.args.so_phut) || 0));
    if (m !== 1) await announce('Tăng tốc tu luyện', `${E.tangtoc} **Thiên địa linh khí cuồn cuộn!** Mọi tu sĩ được tăng tốc tu luyện **×${m}** (Tu Luyện, Bế Quan, Bế Quan Treo)${ST.speedInfo().until ? ` trong **${Math.ceil((ST.speedInfo().until - now()) / 60)} phút**` : ' cho đến khi Thiên Đạo thu hồi'}. Mau tu luyện nào!`);
    return ctx.send(`✅ ${show()}\nÁp dụng cho mọi người chơi ngay lập tức (nhân thêm lên tốc độ hiện tại của từng người). Không ảnh hưởng exp cần để đột phá.`);
  },
});
