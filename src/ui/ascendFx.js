'use strict';
/**
 * HIỆU ỨNG PHI THĂNG TIÊN GIỚI (v17.2) — chiếu 5 cảnh pixel động rồi cảnh cuối kèm kết quả.
 * Chạy SAU khi giao dịch phi thăng đã commit (ascension.doPhithangEx) nên hoàn toàn là phần trình diễn:
 * lỗi gửi ảnh/hết hạn tương tác KHÔNG ảnh hưởng dữ liệu, và kết quả chữ luôn được giao (dự phòng không ảnh).
 */
const fs = require('node:fs');
const path = require('node:path');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

const DIR = path.join(__dirname, '..', '..', 'assets', 'phithang');
const fileOf = (k) => path.join(DIR, `${k}.gif`);
const SCENES = [
  { key: 'ascension_warning', color: 0x6c3fc5, title: '⚡ THIÊN ĐỊA DỊ BIẾN', ms: 3500,
    text: (n) => `Mây đen cuồn cuộn, lôi quang xé ngang trời. **${n}** đứng trên đỉnh núi, linh lực quanh thân hóa thành xoáy sáng — Phi Thăng Đại Trận bừng tỉnh…` },
  { key: 'ascension_gate', color: 0x3498db, title: '🏯 THIÊN MÔN HIỆN THẾ', ms: 3500,
    text: () => 'Tầng mây tách ra, một cánh **Thiên Môn** ngọc bích hiện lên giữa không trung, tiên quang rọi xuống bậc thềm mây.' },
  { key: 'ascension_tribulation', color: 0xf1c40f, title: '🌩️ THIÊN KIẾP GIÁNG LÂM', ms: 3800,
    text: () => 'Lôi kiếp đánh xuống! Màn linh quang hộ thể rung chuyển dữ dội nhưng **không vỡ** — Thiên Đạo đang khảo nghiệm đạo tâm.' },
  { key: 'ascension_success', color: 0xf5cba7, title: '✨ ĐỘ KIẾP THÀNH CÔNG', ms: 3800,
    text: (n) => `Kiếp vân tan biến. Thân thể **${n}** hóa thành quang hoa, nhẹ nhàng bay về phía Thiên Môn giữa mưa cánh hoa.` },
  { key: 'immortal_arrival', color: 0x2ecc71, title: '🏮 TIÊN GIỚI ĐÓN KHÁCH', ms: 3500,
    text: () => 'Bước qua Thiên Môn, con đường ngọc dẫn thẳng tới **Tiên Cung** nhiều tầng mái ngói xanh. Tiên khí ngập tràn, đèn linh sáng dọc lối đi.' },
];
const FINAL = { key: 'immortal_realm', color: 0xf1c40f, title: '👑 PHI THĂNG TIÊN GIỚI THÀNH CÔNG' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function payload(scene, desc, { footer = null } = {}) {
  const f = fileOf(scene.key); const has = fs.existsSync(f);
  const e = new EmbedBuilder().setColor(scene.color).setTitle(scene.title).setDescription(String(desc).slice(0, 4000));
  if (footer) e.setFooter({ text: footer });
  const out = { embeds: [e], attachments: [] };
  if (has) { e.setImage(`attachment://${scene.key}.gif`); out.files = [new AttachmentBuilder(f, { name: `${scene.key}.gif` })]; }
  return out;
}
/**
 * io = { first(payload), edit(payload) } (cả hai trả Promise). Trả true nếu chiếu đủ, false nếu bị gián đoạn
 * (khi đó vẫn cố giao kết quả chữ ở cuối). opts.wait = hàm chờ (test có thể đổi thành chờ 0ms).
 */
async function play(io, { name = 'Đạo hữu', text = '', wait = sleep } = {}) {
  let started = false; let ok = true;
  try {
    for (let i = 0; i < SCENES.length; i += 1) {
      const sc = SCENES[i]; const p = payload(sc, sc.text(name), { footer: `Phi Thăng · cảnh ${i + 1}/${SCENES.length + 1}` });
      if (!started) { await io.first(p); started = true; } else await io.edit(p);
      await wait(sc.ms);
    }
  } catch (_) { ok = false; }
  const fin = payload(FINAL, text || 'Phi Thăng thành công!', { footer: `Phi Thăng · cảnh ${SCENES.length + 1}/${SCENES.length + 1}` });
  try { if (started) await io.edit(fin); else await io.first(fin); }
  catch (_) {                                         // dự phòng cuối: chỉ chữ, không ảnh
    try { const plain = { embeds: [new EmbedBuilder().setColor(FINAL.color).setTitle(FINAL.title).setDescription(String(text).slice(0, 4000))], attachments: [] }; if (started) await io.edit(plain); else await io.first(plain); ok = false; } catch (_2) { ok = false; }
  }
  return ok;
}

/** Chọn cách chiếu theo loại ngữ cảnh. kind: 'ctx' (lệnh slash/tiền tố) | 'button' (interaction đã reply chưa?). */
async function playForCtx(ctx, res) {
  const name = (ctx.user && (ctx.user.displayName || ctx.user.username)) || 'Đạo hữu';
  if (ctx.interaction) {
    const i = ctx.interaction;
    return play({ first: (p) => (i.deferred || i.replied ? i.editReply(p) : i.reply(p)), edit: (p) => i.editReply(p) }, { name, text: res.text });
  }
  let msg = null;
  return play({ first: async (p) => { msg = await ctx.send(p); }, edit: (p) => (msg ? msg.edit(p) : ctx.send(p)) }, { name, text: res.text });
}
async function playForButton(i, res) {
  const name = (i.user && (i.user.displayName || i.user.username)) || 'Đạo hữu';
  return play({ first: (p) => (i.deferred || i.replied ? i.editReply(p) : i.reply(p)), edit: (p) => i.editReply(p) }, { name, text: res.text });
}
module.exports = { play, playForCtx, playForButton, SCENES, FINAL, DIR, isTienGioi: (res) => !!(res && res.ok && res.tier === 2) };
