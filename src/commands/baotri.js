'use strict';
/** /baotri — [Admin] bật/tắt chế độ bảo trì TOÀN BỘ bot (xem game/maintenance.js). Chính lệnh này luôn dùng được để tắt bảo trì. */
const { defineCommand } = require('./framework');
const M = require('../game/maintenance');
const { E } = require('../game/emoji');

const ts = (s) => `<t:${s}:f>`;
const status = (s) => (s.on
  ? `🛠️ **ĐANG BẢO TRÌ** từ ${ts(s.since)}${s.by ? ` (bởi <@${s.by}>)` : ''}${s.reason ? `\n📝 Lý do: ${s.reason}` : ''}${s.eta ? `\n⏳ Dự kiến mở lại: <t:${s.eta}:R>` : ''}`
  : '✅ Bot đang **hoạt động bình thường** (không bảo trì).');

defineCommand({
  name: 'baotri', description: '[Admin] Bật/tắt bảo trì TOÀN BỘ bot — mọi lệnh và nút bấm của người chơi tạm dừng', anyAdmin: true, maintenanceExempt: true,
  options: [
    { name: 'trang_thai', type: 'string', required: false, description: 'Bật / Tắt / Xem (bỏ trống: đảo trạng thái hiện tại)', choices: [
      { name: 'Bật bảo trì', value: 'bat' }, { name: 'Tắt bảo trì', value: 'tat' }, { name: 'Xem trạng thái', value: 'xem' },
    ] },
    { name: 'ly_do', type: 'string', required: false, description: 'Lý do bảo trì (hiện cho người chơi)' },
    { name: 'phut', type: 'int', required: false, description: 'Dự kiến bao nhiêu phút nữa mở lại (hiện đồng hồ đếm lùi)' },
  ],
  async run(ctx) {
    const cur = M.get();
    const raw = String(ctx.args.trang_thai || '').trim().toLowerCase();
    const act = ['bat', 'on', 'bật'].includes(raw) ? 'bat' : ['tat', 'off', 'tắt'].includes(raw) ? 'tat' : raw === 'xem' ? 'xem' : (raw ? null : (cur.on ? 'tat' : 'bat'));
    if (!act) return ctx.send('❓ Dùng: `/baotri trang_thai:Bật|Tắt|Xem [ly_do] [phut]`.');
    if (act === 'xem') return ctx.send(status(cur));
    if (act === 'bat') {
      const s = M.enable({ by: ctx.user.id, reason: ctx.args.ly_do || '', minutes: Number(ctx.args.phut) || 0 });
      await setPresence(ctx, true);
      return ctx.send(`${E.caidat || '🛠️'} **ĐÃ BẬT BẢO TRÌ TOÀN BỘ BOT.**\nMọi lệnh/nút bấm của người chơi bị chặn, các vòng nền game (Boss, Tông Môn Chiến, Đại Phú…) tạm dừng. Auto-backup vẫn chạy.\n${status(s)}\n\nGõ \`/baotri\` (hoặc \`/baotri trang_thai:Tắt\`) để mở lại.`);
    }
    if (!cur.on) return ctx.send(status(cur));
    M.disable(); await setPresence(ctx, false);
    return ctx.send('✅ **ĐÃ TẮT BẢO TRÌ** — bot hoạt động trở lại bình thường cho mọi người chơi.');
  },
});

/** Đặt trạng thái hiển thị của bot (best-effort, lỗi cũng không sao). */
async function setPresence(ctx, on) {
  try {
    const client = ctx.interaction?.client || ctx.message?.client;
    if (!client || !client.user) return;
    client.user.setPresence(on ? { status: 'dnd', activities: [{ name: '🛠️ Đang bảo trì' }] } : { status: 'online', activities: [] });
  } catch (_) { /* bỏ qua */ }
}
