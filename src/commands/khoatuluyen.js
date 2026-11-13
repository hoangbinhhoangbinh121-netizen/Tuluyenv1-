'use strict';
/**
 * /khoatuluyen — [Admin] khóa / mở khóa / xem khóa tu luyện của 1 người chơi (xem game/cultLock.js).
 *   /khoatuluyen thanh_vien:@A gio:24 ly_do:"treo máy bug"     → khóa 24 giờ
 *   /khoatuluyen thanh_vien:@A                                  → khóa vô thời hạn (tới khi mở)
 *   /khoatuluyen hanh_dong:Mở khóa thanh_vien:@A                → mở khóa
 *   /khoatuluyen hanh_dong:Danh sách                            → ai đang bị khóa
 */
const { defineCommand } = require('./framework');
const Cu = require('../game/cultivator');
const Lock = require('../game/cultLock');

const mention = (id) => `<@${id}>`;
const clientOf = (ctx) => (ctx.interaction && ctx.interaction.client) || (ctx.message && ctx.message.client) || null;
async function dm(ctx, id, text) {
  try { const c = clientOf(ctx); if (!c) return false; const u = await c.users.fetch(String(id)); await u.send(text); return true; } catch (_) { return false; }
}

defineCommand({
  name: 'khoatuluyen', description: '[Admin] Khóa / mở khóa tu luyện của một người chơi (Tu Luyện, Bế Quan, Cảm Ngộ, Linh Mạch, Treo Quan)', admin: true,
  options: [
    { name: 'thanh_vien', type: 'user', required: false, description: 'Người chơi cần khóa / mở / xem' },
    { name: 'hanh_dong', type: 'string', required: false, description: 'Khóa (mặc định) / Mở khóa / Xem / Danh sách', choices: [
      { name: 'Khóa tu luyện', value: 'khoa' }, { name: 'Mở khóa', value: 'mo' }, { name: 'Xem tình trạng', value: 'xem' }, { name: 'Danh sách đang khóa', value: 'ds' },
    ] },
    { name: 'gio', type: 'int', required: false, description: 'Khóa bao nhiêu GIỜ (bỏ trống = vô thời hạn, tối đa 8760)' },
    { name: 'ly_do', type: 'string', required: false, description: 'Lý do (hiện cho người bị khóa)' },
    { name: 'ca_dotpha', type: 'string', required: false, description: 'Khóa luôn cả Đột Phá?', choices: [{ name: 'Có — khóa cả Đột Phá', value: 'co' }, { name: 'Không — chỉ khóa tu luyện (mặc định)', value: 'khong' }] },
  ],
  async run(ctx) {
    const raw = String(ctx.args.hanh_dong || '').trim().toLowerCase();
    const act = ['khoa', 'mo', 'xem', 'ds'].includes(raw) ? raw : (raw ? null : 'khoa');
    if (!act) return ctx.send('❓ Hành động không hợp lệ. Dùng: Khóa / Mở khóa / Xem / Danh sách.');

    if (act === 'ds') {
      const rows = Lock.list();
      if (!rows.length) return ctx.send('✅ Hiện **không ai** đang bị khóa tu luyện.');
      const lines = rows.map((l) => `🔒 ${mention(l.user_id)} — ${Lock.until(l)}${Number(l.block_dotpha) ? ' · gồm Đột Phá' : ''}${l.reason ? ` — _${l.reason}_` : ''}${l.by ? ` (bởi ${mention(l.by)})` : ''}`);
      return ctx.send(`**🔒 Đang bị khóa tu luyện (${rows.length}):**\n${lines.join('\n')}`.slice(0, 1900));
    }

    const u = ctx.args.thanh_vien;
    if (!u) return ctx.send('❓ Chọn **thanh_vien** cần khóa / mở / xem.');
    if (u.bot) return ctx.send('❌ Không thể khóa bot.');
    if (!Cu.getCultivator(u.id)) return ctx.send(`❌ ${mention(u.id)} chưa bắt đầu tu tiên (chưa có nhân vật).`);

    if (act === 'xem') {
      const l = Lock.get(u.id);
      return ctx.send(l ? `🔒 ${mention(u.id)} đang bị khóa tu luyện ${Lock.until(l)}${Number(l.block_dotpha) ? ' (gồm Đột Phá)' : ''}.${l.reason ? `\n📝 Lý do: ${l.reason}` : ''}${l.by ? `\n👮 Bởi: ${mention(l.by)}` : ''}` : `✅ ${mention(u.id)} **không** bị khóa tu luyện.`);
    }
    if (act === 'mo') {
      if (!Lock.unlock(u.id)) return ctx.send(`ℹ️ ${mention(u.id)} vốn không bị khóa tu luyện.`);
      const sent = await dm(ctx, u.id, '🔓 **Tu luyện của bạn đã được mở khóa.** Chúc đạo hữu tinh tiến!');
      return ctx.send(`🔓 Đã **mở khóa** tu luyện cho ${mention(u.id)}.${sent ? '' : ' _(không nhắn riêng được cho họ)_'}`);
    }

    // khóa
    const hours = ctx.args.gio === null || ctx.args.gio === undefined || Number.isNaN(ctx.args.gio) ? 0 : Number(ctx.args.gio);
    if (hours < 0 || hours > 8760) return ctx.send('❌ **gio** phải từ 1 đến 8760 (hoặc bỏ trống = vô thời hạn).');
    const dotpha = String(ctx.args.ca_dotpha || '').toLowerCase() === 'co';
    const { lock, cancelledTreo } = Lock.lock(u.id, { hours, reason: ctx.args.ly_do || '', by: ctx.user.id, dotpha });
    const sent = await dm(ctx, u.id, Lock.text(lock));
    return ctx.send(`🔒 Đã **khóa tu luyện** ${mention(u.id)} ${Lock.until(lock)}${dotpha ? ' — **gồm cả Đột Phá**' : ''}.${lock.reason ? `\n📝 Lý do: ${lock.reason}` : ''}${cancelledTreo ? '\n⚠️ Phiên **bế quan treo** đang chạy của họ đã bị hủy (không nhận tu vi).' : ''}${sent ? '' : '\n_(không nhắn riêng được cho họ — họ sẽ thấy thông báo khi thử tu luyện)_'}\nMở khóa: \`/khoatuluyen hanh_dong:Mở khóa thanh_vien:@người\`.`);
  },
});
