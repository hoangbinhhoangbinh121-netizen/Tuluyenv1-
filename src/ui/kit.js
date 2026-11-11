'use strict';
/**
 * Bộ khung UI mô phỏng discord.ui.View của discord.py trên nền discord.js v14:
 *  - View có chủ sở hữu (owner), timeout, danh sách nút/select, handler theo key.
 *  - Mọi nút/select đi qua 1 router duy nhất (customId = "<viewId>|<key>").
 *  - Tự kiểm tra đúng chủ nhân, chống bấm dồn (global_click_allowed), bắt lỗi on_error.
 */
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, UserSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags,
} = require('discord.js');
const crypto = require('node:crypto');
const { toComponentEmoji } = require('../game/emoji');
const { logError } = require('../errorlog');

const EPHEMERAL = MessageFlags.Ephemeral;
const STYLE = { green: ButtonStyle.Success, red: ButtonStyle.Danger, blurple: ButtonStyle.Primary, grey: ButtonStyle.Secondary, secondary: ButtonStyle.Secondary, danger: ButtonStyle.Danger };

// ---------- chống spam ----------
const _lastClick = new Map();
const GLOBAL_CLICK_COOLDOWN = 0.4;
function globalClickAllowed(userId, cooldown = GLOBAL_CLICK_COOLDOWN) {
  const t = Date.now() / 1000;
  const last = _lastClick.get(String(userId)) || 0;
  if (t - last < cooldown) return false;
  _lastClick.set(String(userId), t);
  return true;
}
/** asyncio.Lock theo user: tryLock() trả hàm unlock hoặc null nếu đang bị giữ. */
const _locks = new Set();
function tryUserLock(userId) {
  const k = String(userId);
  if (_locks.has(k)) return null;
  _locks.add(k);
  return () => _locks.delete(k);
}

// ---------- View ----------
const registry = new Map(); // viewId -> View

class View {
  /**
   * @param {object} o  { ownerId, timeout(giây), checkOwner }
   */
  constructor({ ownerId = null, timeout = 900, checkOwner = true } = {}) {
    this.id = crypto.randomBytes(5).toString('hex');
    this.ownerId = ownerId === null ? null : String(ownerId);
    this.timeoutMs = timeout * 1000;
    this.checkOwner = checkOwner;
    this.items = []; // {type, key, row, builder, handler}
    this.stopped = false;
    this.onTimeout = null;
    this._timer = null;
    registry.set(this.id, this);
    this._touch();
  }
  _touch() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => { this.stop(); if (this.onTimeout) this.onTimeout(); }, this.timeoutMs);
    this._timer.unref?.();
  }
  stop() { this.stopped = true; if (this._timer) clearTimeout(this._timer); registry.delete(this.id); }

  button({ key, label, emoji, style = 'grey', row = 0, disabled = false, url }, handler) {
    const b = new ButtonBuilder().setStyle(STYLE[style] ?? ButtonStyle.Secondary).setDisabled(disabled);
    if (label) b.setLabel(String(label).slice(0, 80));
    const em = toComponentEmoji(emoji); if (em) b.setEmoji(em);
    b.setCustomId(`${this.id}|${key}`);
    this.items.push({ type: 'button', key, row, builder: b, handler });
    return this;
  }
  select({ key, placeholder, options, row = 0, min = 1, max = 1, disabled = false }, handler) {
    const s = new StringSelectMenuBuilder().setCustomId(`${this.id}|${key}`).setMinValues(min).setMaxValues(max).setDisabled(disabled);
    if (placeholder) s.setPlaceholder(String(placeholder).slice(0, 150));
    s.addOptions(options.slice(0, 25).map((o) => {
      const opt = { label: String(o.label).slice(0, 100), value: String(o.value) };
      if (o.description) opt.description = String(o.description).slice(0, 100);
      const em = toComponentEmoji(o.emoji); if (em) opt.emoji = em;
      if (o.default) opt.default = true;
      return opt;
    }));
    this.items.push({ type: 'select', key, row, builder: s, handler });
    return this;
  }
  userSelect({ key, placeholder, row = 0 }, handler) {
    const s = new UserSelectMenuBuilder().setCustomId(`${this.id}|${key}`).setMinValues(1).setMaxValues(1);
    if (placeholder) s.setPlaceholder(String(placeholder).slice(0, 150));
    this.items.push({ type: 'userselect', key, row, builder: s, handler });
    return this;
  }
  /** Danh sách ActionRow cho message (nút gộp theo `row`, select chiếm cả hàng). */
  components() {
    const rows = new Map();
    for (const it of this.items) {
      if (!rows.has(it.row)) rows.set(it.row, []);
      rows.get(it.row).push(it.builder);
    }
    return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, arr]) => new ActionRowBuilder().addComponents(...arr));
  }
  disableAll() { for (const it of this.items) it.builder.setDisabled(true); }
  find(key) { return this.items.find((i) => i.key === key); }
}

/** Nút "tĩnh" (không phụ thuộc bộ nhớ, sống sót qua restart): customId = "<prefix>|..." */
const staticHandlers = new Map();
const registerStatic = (prefix, handler) => staticHandlers.set(prefix, handler);

/** Router: gọi từ interactionCreate cho button/select. Trả true nếu đã xử lý. */
async function routeComponent(interaction) {
  const cid = interaction.customId || '';
  const idx = cid.indexOf('|');
  if (idx < 0) return false;
  const sh = staticHandlers.get(cid.slice(0, idx));
  if (sh) {
    try { await sh(interaction, cid.slice(idx + 1).split('|')); }
    catch (e) { const code = logError('nút tĩnh', e); if (code === 'het-han') return true; await safeReply(interaction, { content: `❌ Có lỗi xảy ra (mã lỗi \`${code}\`), vui lòng thử lại.`, flags: EPHEMERAL }); }
    return true;
  }
  const view = registry.get(cid.slice(0, idx));
  if (!view) {
    await safeReply(interaction, { content: '⌛ Menu này đã hết hạn (hoặc bot vừa khởi động lại) — hãy gõ `/tutien` để mở menu mới.', flags: EPHEMERAL });
    return true;
  }
  const item = view.find(cid.slice(idx + 1));
  if (!item) return true;
  if (view.checkOwner && view.ownerId !== null && String(interaction.user.id) !== view.ownerId) {
    await safeReply(interaction, { content: '❌ Đây không phải menu của bạn — hãy gõ `/tutien` để mở menu riêng của mình.', flags: EPHEMERAL });
    return true;
  }
  if (view.ownerId !== null && !globalClickAllowed(interaction.user.id)) {
    await safeReply(interaction, { content: '⚠️ Bạn đang bấm quá nhanh, vui lòng chờ chút rồi thử lại.', flags: EPHEMERAL });
    return true;
  }
  view._touch();
  try {
    const values = interaction.values || [];
    await item.handler(interaction, values, view);
  } catch (e) {
    const code = logError(`nút/menu "${item.key}"`, e);
    if (code === 'het-han') return true;
    await safeReply(interaction, { embeds: [require('./notifications').systemError(code)], flags: EPHEMERAL });
  }
  return true;
}

/** Gửi phản hồi bất kể interaction đã ack hay chưa; nuốt lỗi "Unknown interaction". */
async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) return await interaction.followUp(payload);
    return await interaction.reply(payload);
  } catch (e) { return null; }
}

// ---------- Modal ----------
const modals = new Map(); // customId -> {handler, expires}
function showModal(interaction, { title, fields, onSubmit }) {
  const id = `m${crypto.randomBytes(5).toString('hex')}`;
  const m = new ModalBuilder().setCustomId(id).setTitle(String(title).slice(0, 45));
  for (const f of fields) {
    const ti = new TextInputBuilder().setCustomId(f.id).setLabel(String(f.label).slice(0, 45))
      .setStyle(f.paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(f.required !== false).setMaxLength(f.maxLength || 400);
    if (f.placeholder) ti.setPlaceholder(String(f.placeholder).slice(0, 100)); // placeholder rỗng bị Discord từ chối
    m.addComponents(new ActionRowBuilder().addComponents(ti));
  }
  modals.set(id, { handler: onSubmit, owner: String(interaction.user.id), exp: Date.now() + 15 * 60 * 1000 });
  return interaction.showModal(m);
}
async function routeModal(interaction) {
  const m = modals.get(interaction.customId);
  if (!m) { await safeReply(interaction, { content: '⌛ Biểu mẫu này đã hết hạn — hãy mở lại từ menu.', flags: EPHEMERAL }); return true; }
  modals.delete(interaction.customId);
  try { await m.handler(interaction, (id) => interaction.fields.getTextInputValue(id)); }
  catch (e) { const code = logError('modal', e); await safeReply(interaction, { embeds: [require('./notifications').systemError(code)], flags: EPHEMERAL }); }
  return true;
}
setInterval(() => { const t = Date.now(); for (const [k, v] of modals) if (v.exp < t) modals.delete(k); }, 60000).unref();

module.exports = { _registry: registry, registerStatic, View, routeComponent, routeModal, showModal, safeReply, globalClickAllowed, tryUserLock, EPHEMERAL };
