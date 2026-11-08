'use strict';
/**
 * LỚP ĐỒNG BỘ GIAO DIỆN — mọi tin nhắn bot gửi ra (tính năng cũ lẫn mới) đều đi qua đây để:
 *  • Embed cũ: đổi màu về bảng màu v7, thêm footer "✦ Tiên Giới Bot v14.1 · Thiên Đạo" + timestamp, ép giới hạn Discord.
 *  • Tin nhắn chữ thuần ("❌ …", "⏳ …", "✅ …") → Embed chuẩn (thành công/lỗi/cooldown/cảnh báo/thông tin) có mã lỗi E00x.
 *  • Mọi emoji tuỳ chỉnh cũ gắn cứng ID → emoji pixel hiện hành (không bao giờ hiện ":tên:" thô).
 *  • Bọc interaction: reply/editReply/followUp/update an toàn (không lỗi "đã trả lời"), tự báo "đang xử lý" nếu chậm >2,2s.
 */
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { normalizeColor, COLORS } = require('./theme/colors');
const { FOOTER_TEXT } = require('./theme/typography');
const { enforceLimits, createEmbed } = require('./components/baseEmbed');
const N = require('./notifications');
const { skinEmojiText } = require('./emojis');
const { guessCode } = require('./notifications/errors');

const ICON_RE = /^(?:[\p{Extended_Pictographic}️‍]+)\s*/u;
const SUCCESS_RE = /^(?:✅|🎉|✨|🌟|👑|💚|🏆|🎁|💰)/u;

/** Chữ thuần → Embed chuẩn. Trả null nếu không nên chuyển (rỗng/quá dài). */
function plainToEmbed(text) {
  const raw = String(text ?? '').trim();
  if (!raw || raw.length > 3900) return null;
  const s = skinEmojiText(raw);
  const strip = () => s.replace(ICON_RE, '');
  if (/^(?:❌|🚫|⛔|✖|✕)/u.test(s)) return N.error(strip());
  if (/^⏳/u.test(s)) return N.cooldown(strip());
  if (/^⌛/u.test(s)) return N.expired(strip());
  if (/^⚠/u.test(s)) { const b = strip(); return guessCode(b) === 'E008' ? N.warning(b, { footer: 'E008 · Dữ liệu đang được xử lý' }) : N.warning(b); }
  if (SUCCESS_RE.test(s)) return N.success(strip());
  return createEmbed({ cat: 'thiendao', color: COLORS.INFO, description: s });
}

/** Chuẩn hóa 1 embed cũ (EmbedBuilder hoặc JSON). */
function skinEmbed(e) {
  const eb = e instanceof EmbedBuilder ? e : (typeof e.toJSON === 'function' ? e : new EmbedBuilder(e));
  const d = eb.data || eb;
  d.color = normalizeColor(d.color);
  if (d.title) d.title = skinEmojiText(d.title);
  if (d.description) d.description = skinEmojiText(d.description);
  if (d.fields) d.fields = d.fields.map((f) => ({ ...f, name: skinEmojiText(f.name), value: skinEmojiText(f.value) }));
  const old = d.footer && d.footer.text;
  if (!old) d.footer = { text: FOOTER_TEXT };
  else if (!old.includes('Tiên Giới Bot')) d.footer = { ...d.footer, text: `${FOOTER_TEXT} · ${old}`.slice(0, 2048) };
  if (!d.timestamp) d.timestamp = new Date().toISOString();
  return enforceLimits(eb);
}

/** Chuẩn hóa payload gửi đi. edit=true: cần xoá content/embeds cũ khi đổi sang embed. */
function normalizePayload(payload, { edit = false } = {}) {
  let p = typeof payload === 'string' ? { content: payload } : { ...(payload || {}) };
  if (p.skin === false) { delete p.skin; return p; }
  delete p.skin;
  if (typeof p.content === 'string') p.content = skinEmojiText(p.content);
  const hasEmbeds = Array.isArray(p.embeds) && p.embeds.length > 0;
  if (!hasEmbeds && typeof p.content === 'string' && p.content.trim()) {
    const mentions = (p.content.match(/<@[!&]?\d+>/g) || []).join(' ');
    const emb = plainToEmbed(p.content);
    if (emb) { p.embeds = [emb]; p.content = mentions || (edit ? null : undefined); }
  } else if (hasEmbeds) {
    p.embeds = p.embeds.map(skinEmbed);
  }
  return p;
}

// ---------------------------------------------------------------- bọc interaction
const WATCHDOG_MS = 2200;
function wrapInteraction(i) {
  if (!i || i.__skinned) return i;
  i.__skinned = true;
  const acked = () => i.deferred || i.replied;
  const orig = {};
  for (const k of ['reply', 'editReply', 'followUp', 'update', 'deferReply', 'deferUpdate', 'showModal']) if (typeof i[k] === 'function') orig[k] = i[k].bind(i);
  let timer = null;
  const stop = () => { if (timer) { clearTimeout(timer); timer = null; } };
  const noFlags = (p) => { const q = { ...p }; delete q.flags; delete q.ephemeral; return q; };

  if (orig.reply) i.reply = async (p) => {
    stop(); const q = normalizePayload(p);
    if (i.deferred && !i.replied) return orig.editReply(noFlags(normalizePayload(p, { edit: true })));
    if (i.replied) return orig.followUp(q);
    return orig.reply(q);
  };
  if (orig.editReply) i.editReply = async (p) => { stop(); return orig.editReply(noFlags(normalizePayload(p, { edit: true }))); };
  if (orig.followUp) i.followUp = async (p) => {
    stop(); const q = normalizePayload(p);
    if (!acked() && orig.reply) return orig.reply(q);
    return orig.followUp(q);
  };
  if (orig.update) i.update = async (p) => {
    stop(); const q = normalizePayload(p, { edit: true });
    if (acked()) return orig.editReply(noFlags(q));
    return orig.update(q);
  };
  if (orig.deferReply) i.deferReply = async (o) => { stop(); if (acked()) return null; return orig.deferReply(o); };
  if (orig.deferUpdate) i.deferUpdate = async () => { stop(); if (acked()) return null; return orig.deferUpdate(); };
  if (orig.showModal) i.showModal = async (m) => { stop(); return orig.showModal(m); };

  // Chậm >2,2s mà chưa phản hồi → báo "đang xử lý" để Discord không hiện "ứng dụng không phản hồi".
  if (orig.deferReply && typeof i.isChatInputCommand === 'function') {
    timer = setTimeout(() => { timer = null; if (!acked()) orig.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {}); }, WATCHDOG_MS);
    timer.unref?.();
  }
  return i;
}

module.exports = { normalizePayload, plainToEmbed, skinEmbed, wrapInteraction };
