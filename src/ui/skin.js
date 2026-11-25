'use strict';
/**
 * LỚP ĐỒNG BỘ GIAO DIỆN — mọi tin nhắn bot gửi ra (tính năng cũ lẫn mới) đều đi qua đây để:
 *  • Embed cũ: đổi màu về bảng màu v7, thêm footer "✦ Thiên Tông Bot v21.4 · Thiên Đạo" + timestamp, ép giới hạn Discord.
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
  else if (!old.includes('Thiên Tông Bot') && !old.includes('Tiên Giới Bot')) d.footer = { ...d.footer, text: `${FOOTER_TEXT} · ${old}`.slice(0, 2048) };
  if (!d.timestamp) d.timestamp = new Date().toISOString();
  return enforceLimits(eb);
}

/** Chuẩn hóa payload gửi đi. edit=true: cần xoá content/embeds cũ khi đổi sang embed. */
function normalizePayload(payload, { edit = false } = {}) {
  let p = typeof payload === 'string' ? { content: payload } : { ...(payload || {}) };
  if (p.skin === false) { delete p.skin; require('./validate').check(p, 'raw'); return p; }
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
  require('./validate').check(p, 'send');   // v21.4: chặn lỗi component/embed trước khi lên Discord
  return p;
}

// ---------------------------------------------------------------- bọc interaction
const WATCHDOG_MS = 1800;   // v21.6.3: sớm hơn để còn dư biên trước mốc 3 giây của Discord (host chậm)
function wrapInteraction(i) {
  if (!i || i.__skinned) return i;
  i.__skinned = true;
  const acked = () => i.deferred || i.replied;
  let ackKind = null;   // v21.6.3: 'update' (deferUpdate: sửa chính tin nhắn gốc) | 'reply' (deferReply: tin mới)
  const orig = {};
  // v21.6: DNS/mạng chập chờn (EAI_AGAIN…) ⇒ thử lại tối đa 2 lần, CHỈ với lỗi chắc chắn chưa gửi được yêu cầu (không sợ trả lời 2 lần) và chỉ khi còn trong hạn 3 giây của Discord.
  const { isPreSend } = require('../errorlog'); const BACKOFF = [250, 700];
  const retry = (fn) => async (...a) => {
    for (let n = 0; ; n++) {
      try { return await fn(...a); }
      catch (e) {
        const left = 2700 - (Date.now() - (i.createdTimestamp || Date.now()));
        if (!isPreSend(e) || n >= BACKOFF.length || (!i.deferred && !i.replied && left < BACKOFF[n])) throw e;
        await new Promise((r) => setTimeout(r, BACKOFF[n]));
      }
    }
  };
  for (const k of ['reply', 'editReply', 'followUp', 'update', 'deferReply', 'deferUpdate', 'showModal']) if (typeof i[k] === 'function') orig[k] = retry(i[k].bind(i));
  let timer = null; let pend = null;   // pend = lời ack tự động của watchdog còn bay → phản hồi thật phải ĐỢI nó xong (trước đây đua nhau → 40060)
  const settle = async () => { if (pend) { try { await pend; } catch (_) { /* bỏ qua */ } } };
  const stop = () => { if (timer) { clearTimeout(timer); timer = null; } };
  const noFlags = (p) => { const q = { ...p }; delete q.flags; delete q.ephemeral; return q; };

  if (orig.reply) i.reply = async (p) => {
    stop(); await settle(); const q = normalizePayload(p);
    if (i.deferred && !i.replied) {
      // v21.6.3: đã deferUpdate (nút/menu/modal từ tin nhắn) mà handler muốn reply → gửi tin MỚI, tuyệt đối không ghi đè bảng gốc.
      if (ackKind === 'update') return orig.followUp(q);
      return orig.editReply(noFlags(normalizePayload(p, { edit: true })));
    }
    if (i.replied) return orig.followUp(q);
    return orig.reply(q);
  };
  if (orig.editReply) i.editReply = async (p) => { stop(); await settle(); return orig.editReply(noFlags(normalizePayload(p, { edit: true }))); };
  if (orig.followUp) i.followUp = async (p) => {
    stop(); await settle(); const q = normalizePayload(p);
    if (!acked() && orig.reply) return orig.reply(q);
    return orig.followUp(q);
  };
  if (orig.update) i.update = async (p) => {
    stop(); await settle(); const q = normalizePayload(p, { edit: true });
    if (acked()) return orig.editReply(noFlags(q));
    return orig.update(q);
  };
  if (orig.deferReply) i.deferReply = async (o) => { stop(); await settle(); if (acked()) return null; const r = await orig.deferReply(o); ackKind = 'reply'; return r; };
  if (orig.deferUpdate) i.deferUpdate = async () => { stop(); await settle(); if (acked()) return null; const r = await orig.deferUpdate(); ackKind = 'update'; return r; };
  if (orig.showModal) i.showModal = async (m) => { stop(); return orig.showModal(m); };

  // Chậm >1,8s mà chưa phản hồi → ack tự động để Discord không báo 10062 / "ứng dụng không phản hồi".
  // v21.6.3: trước đây MỌI loại interaction đều bị deferReply (kể cả nút/menu) → sau đó i.update() bị đổi thành editReply lên tin "đang xử lý"
  // thay vì sửa bảng gốc. Nay: nút/menu/modal-từ-tin-nhắn → deferUpdate; lệnh slash/modal độc lập → deferReply ephemeral.
  {
    const is = (m) => typeof i[m] === 'function' && i[m]();
    const wantUpdate = is('isMessageComponent') || (is('isModalSubmit') && is('isFromMessage'));
    const doAck = wantUpdate ? orig.deferUpdate : orig.deferReply;
    if (doAck) {
      timer = setTimeout(() => {
        timer = null; if (acked()) return;
        ackKind = wantUpdate ? 'update' : 'reply';
        pend = (wantUpdate ? doAck() : doAck({ flags: MessageFlags.Ephemeral })).catch(() => { /* quá hạn thật sự → logError ở tầng route sẽ đếm */ }).finally(() => { pend = null; });
      }, WATCHDOG_MS);
      timer.unref?.();
    }
  }
  return i;
}

module.exports = { normalizePayload, plainToEmbed, skinEmbed, wrapInteraction };
