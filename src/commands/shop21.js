'use strict';
// V21.0 — Cửa Hàng Nguyên Bảo + Nạp. Một lệnh slash (/cuahang); `nap` là lệnh chữ (?nap / !nap) mở thẳng màn nạp — không tốn thêm chỗ trong 100 lệnh slash.
const { defineCommand, isAdminApprover } = require('./framework');
const S = require('../game/shop21');
const V = require('../ui/shop21Views');

const open = (ctx, view) => (ctx.interaction ? V.open(ctx.interaction, ctx.user.id, view) : ctx.send(V.render(String(ctx.user.id), view)));
defineCommand({ name: 'cuahang', description: 'Cửa Hàng Nguyên Bảo: mua mọi vật phẩm, trang bị, Truyền Thừa Ngọc Giản · nạp 10k/20k/50k/100k', needsCultivator: true, run: (ctx) => open(ctx, 'home') });
defineCommand({ name: 'nap', description: 'Nạp Nguyên Bảo (gói 10k / 20k / 50k / 100k)', needsCultivator: true, prefixOnly: true, run: (ctx) => open(ctx, 'topup') });

// v21.2 — `.od <tên vật phẩm> [xSL] [p1-5] [@khách]`: tạo ĐƠN MUA TRỰC TIẾP. Khách tự tạo cho mình; admin tạo hộ khách bằng cách @mention.
// Thẻ đơn hiện QR + số tiền + mã TG<số>; admin bấm "Done đơn" → bot giao vật phẩm thẳng vào túi khách (không qua ví Nguyên Bảo).
const USAGE = [
  '**Cách dùng:** `.od <tên vật phẩm> [xSL] [p1-5] [@khách]`',
  '• `.od truyền thừa` — 1 Truyền Thừa Ngọc Giản',
  '• `.od truyền thừa x3` — 3 cái',
  '• `.od đan tụ khí x10 p3` — 10 đan, phẩm 3 (Thượng)',
  '• `.od thiên bảo thể chất @khách` — admin tạo đơn hộ khách',
  '• `.od i:dan_tu_khi` — dùng mã (`i:` kho · `t:` Thiên Bảo/Truyền Thừa · `p:` Linh Thú · `g:` trang bị)',
  'Tên gõ không cần dấu. Phẩm: p1 Hạ · p2 Trung (mặc định) · p3 Thượng · p4 Cực · p5 Thánh.',
].join('\n');
function parseOd(raw, mentionIds) {
  let t = ` ${raw} `;
  const ids = new Set(mentionIds);
  t = t.replace(/<@!?(\d{15,})>/g, (_, id) => { ids.add(id); return ' '; }).replace(/\s(\d{17,20})(?=\s)/g, (_, id) => { ids.add(id); return ' '; });
  let qty = 1; let q = 0;
  t = t.replace(/\s[x×*](\d{1,3})(?=\s)/i, (_, n) => { qty = Number(n); return ' '; });
  t = t.replace(/\s[pP]([1-5])(?=\s)/, (_, n) => { q = Number(n); return ' '; });
  return { query: t.replace(/\s+/g, ' ').trim(), qty, q, ids: [...ids] };
}
defineCommand({
  name: 'od', description: 'Tạo đơn mua vật phẩm: .od <tên> [xSL] [p1-5] [@khách]', prefixOnly: true, needsCultivator: false,
  run: async (ctx) => {
    const msg = ctx.message; const raw = String(msg.content || '').replace(/^\S+/, '');
    const p = parseOd(raw, [...(msg.mentions?.users?.values?.() || [])].filter((u) => !u.bot).map((u) => u.id));
    if (!p.query) return ctx.send(USAGE);
    const admin = isAdminApprover(ctx.user.id);
    let customer = String(ctx.user.id);
    if (p.ids.length) {
      if (!admin) return ctx.send('❌ Chỉ admin mới tạo đơn hộ khách được. Hãy gõ `.od <tên vật phẩm>` không kèm @.');
      customer = p.ids[0];
    }
    const r = S.resolveItem(p.query);
    if (r.none) return ctx.send(`❌ Không tìm thấy vật phẩm “${p.query}”. Thử gõ ngắn hơn hoặc dùng \`/cuahang\` → 🔎 Tìm.`);
    if (r.many) return ctx.send(`🔎 Có **${r.total}** vật phẩm khớp “${p.query}”${r.total > r.many.length ? ` (hiện ${r.many.length})` : ''} — gõ rõ hơn hoặc dùng mã:\n${r.many.map((e) => `• **${e.name}** → \`.od ${e.key}\``).join('\n')}`);
    const o = S.createItemOrder(customer, r.entry.key, p.q, p.qty, { bypassLimit: admin, by: admin && customer !== String(ctx.user.id) ? `admin ${ctx.user.id}` : '' });
    if (!o.ok) return ctx.send(o.msg);
    return ctx.send(V.renderOd(o.id));
  },
});
module.exports = { open, parseOd };
