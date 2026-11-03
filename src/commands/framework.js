'use strict';
/**
 * Lệnh hybrid kiểu discord.py: 1 định nghĩa chạy được cả slash (/lenh) lẫn tiền tố (!lenh).
 * ctx: { user, member, guild, channel, interaction|message, args, send(payload), attachments[] }
 */
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const Cu = require('../game/cultivator');
const { logError } = require('../errorlog');
const { normalizePayload } = require('../ui/skin');
const N = require('../ui/notifications');

const registry = new Map();
const ADMIN_IDS = new Set(require('../game/constants').ADMIN_CODE_APPROVER_IDS.map(String));
const isAdminApprover = (id) => ADMIN_IDS.has(String(id));

/** type: 'string' | 'int' | 'user' | 'attachment' */
function defineCommand(def) { registry.set(def.name, def); return def; }

function buildSlashJson() {
  return [...registry.values()].map((c) => {
    const b = new SlashCommandBuilder().setName(c.name).setDescription(String(c.description).slice(0, 100));
    for (const o of c.options || []) {
      const common = (x) => x.setName(o.name).setDescription(String(o.description || o.name).slice(0, 100)).setRequired(!!o.required);
      if (o.type === 'int') b.addIntegerOption(common);
      else if (o.type === 'user') b.addUserOption(common);
      else if (o.type === 'attachment') b.addAttachmentOption(common);
      else b.addStringOption((x) => { common(x); if (o.choices && x.addChoices) x.addChoices(...o.choices.map((c) => ({ name: String(c.name).slice(0, 100), value: c.value }))); return x; });
    }
    return b.toJSON();
  });
}

function slashCtx(interaction) {
  const args = {};
  for (const o of registry.get(interaction.commandName).options || []) {
    if (o.type === 'int') args[o.name] = interaction.options.getInteger(o.name);
    else if (o.type === 'user') args[o.name] = interaction.options.getUser(o.name);
    else if (o.type === 'attachment') args[o.name] = interaction.options.getAttachment(o.name);
    else args[o.name] = interaction.options.getString(o.name);
  }
  return {
    interaction, user: interaction.user, guild: interaction.guild, channel: interaction.channel, args,
    attachments: Object.values(args).filter((a) => a && a.url && a.name),
    send: async (p) => {
      p = typeof p === 'string' ? { content: p } : p;
      if (interaction.deferred || interaction.replied) return interaction.followUp(p);
      return interaction.reply(p);
    },
  };
}

function prefixCtx(message, tokens, def) {
  const args = {};
  (def.options || []).forEach((o, idx) => {
    const t = tokens[idx];
    if (t === undefined) return;
    if (o.type === 'int') args[o.name] = Number.parseInt(t.replace(/[.,_]/g, ''), 10);
    else if (o.type === 'user') {
      const m = /\d{15,}/.exec(t); args[o.name] = m ? (message.mentions.users.get(m[0]) || { id: m[0], username: m[0] }) : null;
    } else args[o.name] = t;
  });
  return {
    message, user: message.author, guild: message.guild, channel: message.channel, args,
    attachments: [...message.attachments.values()],
    send: (p) => message.reply(normalizePayload(p)),
  };
}

async function runCommand(def, ctx) {
  const perms = ctx.interaction?.memberPermissions || ctx.message?.member?.permissions;
  const isGuildAdmin = !!(perms && perms.has('Administrator'));
  if (def.admin && !isAdminApprover(ctx.user.id)) return ctx.send({ embeds: [N.error('Lệnh này chỉ dành riêng cho admin được chỉ định.', 'E006')] });
  if (def.anyAdmin && !isAdminApprover(ctx.user.id) && !isGuildAdmin) return ctx.send({ embeds: [N.error('Lệnh này chỉ dành cho Admin (quyền Administrator hoặc admin của bot).', 'E006')] });
  if (def.guildAdmin && !isGuildAdmin) return ctx.send({ embeds: [N.error('Lệnh này chỉ dành cho Admin (quyền Administrator).', 'E006')] });
  if (def.needsCultivator && !Cu.getCultivator(ctx.user.id)) return ctx.send({ embeds: [N.error('Bạn chưa bắt đầu tu tiên, dùng `/batdau` trước.', 'E001')] });
  // (v7) không còn chặn "bấm quá nhanh" với lệnh slash — mỗi hành động đã có cooldown/khoá riêng; chặn chung từng làm người chơi bị từ chối oan.
  if (ctx.interaction && !def.noDefer && !ctx.interaction.deferred && !ctx.interaction.replied) {
    try { await ctx.interaction.deferReply(); } catch (_) { return null; }
  }
  return def.run(ctx);
}

async function handleSlash(interaction) {
  const def = registry.get(interaction.commandName);
  if (!def) return false;
  try { await runCommand(def, slashCtx(interaction)); }
  catch (e) {
    const code = logError(`lệnh /${def.name}`, e);
    const p = { embeds: [N.systemError(code)], flags: MessageFlags.Ephemeral };
    try { if (interaction.deferred || interaction.replied) await interaction.followUp(p); else await interaction.reply(p); } catch (_) { /* hết hạn */ }
  }
  return true;
}

/** prefixes: mảng tiền tố (VD ['?', '!']). Chọn tiền tố khớp dài nhất. */
async function handlePrefix(message, prefixes) {
  if (message.author.bot) return false;
  const list = (Array.isArray(prefixes) ? prefixes : [prefixes]).filter(Boolean).sort((x, y) => y.length - x.length);
  const prefix = list.find((p) => message.content.startsWith(p));
  if (!prefix) return false;
  const tokens = message.content.slice(prefix.length).trim().split(/\s+/);
  const def = registry.get((tokens.shift() || '').toLowerCase());
  if (!def) return false;
  try { await runCommand(def, prefixCtx(message, tokens, def)); }
  catch (e) {
    const code = logError(`lệnh ${prefix}${def.name}`, e);
    await message.reply({ embeds: [N.systemError(code)] }).catch(() => {});
  }
  return true;
}

module.exports = { defineCommand, buildSlashJson, handleSlash, handlePrefix, isAdminApprover, registry };
