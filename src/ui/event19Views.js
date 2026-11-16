'use strict';
/**
 * Giao diện + vòng nền Sự Kiện Thế Giới V19 (spec §8).
 *  • Nút tĩnh `ev19|join|<id>` — tranh đoạt Vạn Cổ Truyền Thừa.
 *  • tick(client): mỗi 60 giây — kết thúc sự kiện hết hạn, tự sinh sự kiện (chỉ ở server đã đặt kênh thế giới), dọn Bí Cảnh treo.
 */
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const D = require('../db');
const K = require('../game/constants');
const EV = require('../game/event19');
const BC = require('../game/bicanh19');
const BossG = require('../game/boss');
const WC = require('./worldChannel');
const { registerStatic, safeReply } = require('./kit');
const { now } = require('../util');

const fmt = (n) => Number(n).toLocaleString('vi-VN');
const ts = (t) => `<t:${Math.floor(t)}:R>`;

function dibienEmbed(ev, ended = false) {
  const k = EV.KINDS.dibien;
  return new EmbedBuilder().setColor(ended ? 0x7f8c8d : 0x1abc9c).setTitle(`${k.icon} ${k.name.toUpperCase()}${ended ? ' — ĐÃ KẾT THÚC' : ''}`)
    .setDescription(`${k.desc}\n\n✨ Phần thưởng **Tu Vi / Linh Thạch** Bí Cảnh Tiên Giới **×${EV.DIBIEN.reward}**\n🎁 Tỉ lệ rơi nguyên liệu **×${EV.DIBIEN.drop}**\n⏳ ${ended ? 'Đã kết thúc.' : `Kết thúc ${ts(ev.ends_at)}`}\n\nDùng \`/bicanhtiengioi\` để tận dụng!`);
}
function contestEmbed(ev, n = 0, result = null) {
  const k = EV.KINDS.truyenthua; const lg = EV.legacyOf(EV.dataOf(ev).legacy);
  const e = new EmbedBuilder().setColor(result ? 0x7f8c8d : 0xf1c40f).setTitle(`${k.icon} VẠN CỔ TRUYỀN THỪA — ${lg.name}`);
  if (!result) e.setDescription(`${k.desc}\n\n👥 Đã có **${n}/${k.cap}** người tranh đoạt\n📋 Điều kiện: từ **${K.REALMS[k.minRealm].name}**, đã phi thăng Tiên Giới\n🎲 Người có **sức mạnh × may mắn** cao nhất nhận phần chính (mỗi người chỉ thắng 1 lần/ngày); những người còn lại nhận phần an ủi.\n⏳ Chốt ${ts(ev.ends_at)}`);
  else e.setDescription(result.n ? `**${result.n}** người tranh đoạt.\n${result.lines.join('\n').slice(0, 3500)}` : 'Không có ai tranh đoạt — truyền thừa tan vào hư không.');
  return e;
}
const joinRow = (ev, disabled = false) => new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ev19|join|${ev.id}`).setLabel('Tranh Đoạt').setEmoji('📜').setStyle(ButtonStyle.Success).setDisabled(disabled));

async function channelFor(client, guildId, preferred) {
  const id = WC.get(guildId) || preferred; if (!id || !client) return null;
  try { return await client.channels.fetch(String(id)); } catch (_) { return null; }
}
/** Đăng thông báo sự kiện (Dị Biến / Truyền Thừa) vào kênh; lưu message_id. */
async function postEvent(client, ev, channel = null) {
  const ch = channel || await channelFor(client, ev.guild_id, ev.channel_id); if (!ch) return null;
  const payload = ev.kind === 'truyenthua' ? { embeds: [contestEmbed(ev)], components: [joinRow(ev)] } : { embeds: [dibienEmbed(ev)] };
  try { const m = await ch.send(payload); D.run('UPDATE ev19 SET channel_id = ?, message_id = ? WHERE id = ?', String(ch.id), String(m.id), ev.id); return m; }
  catch (e) { console.warn('⚠️ Không đăng được sự kiện V19:', e.message); return null; }
}
async function editMsg(client, ev, payload) {
  if (!ev.channel_id || !ev.message_id) return;
  try { const ch = await client.channels.fetch(String(ev.channel_id)); const m = await ch.messages.fetch(String(ev.message_id)); await m.edit(payload); } catch (_) { /* tin nhắn đã bị xoá */ }
}

registerStatic('ev19', async (i, parts) => {
  if (parts[0] !== 'join') return null;
  const ev = EV.byId(Number(parts[1]));
  const r = EV.joinContest(Number(parts[1]), i.user.id);
  if (!r.ok) return safeReply(i, { content: `❌ ${r.error}`, flags: MessageFlags.Ephemeral });
  if (ev) { try { await i.message.edit({ embeds: [contestEmbed(ev, r.n)], components: [joinRow(ev)] }); } catch (_) { /* bỏ qua */ } }
  return safeReply(i, { content: `📜 Bạn đã tham gia tranh đoạt (**${r.n}/${r.cap}**). Chờ chốt kết quả!`, flags: MessageFlags.Ephemeral });
});

/** Khởi tạo sự kiện thủ công / tự động. Trả { ok, text, error }. */
async function start(client, kind, { guildId, channel, by = null, minutes = null }) {
  if (kind === 'dibien' || kind === 'truyenthua') {
    const r = EV.create(kind, { guildId, channelId: channel && channel.id, minutes }); if (!r.ok) return r;
    await postEvent(client, r.ev, channel);
    if (kind === 'dibien') { try { await WC.announceWorld(client, guildId, dibienEmbed(r.ev), { channelId: channel && channel.id, skipIfSame: true }); } catch (_) { /* bỏ qua */ } }
    return { ok: true, text: `Đã mở **${EV.KINDS[kind].name}** (${r.minutes} phút).` };
  }
  const k = EV.KINDS[kind]; if (!k || !k.tier) return { ok: false, error: 'Loại sự kiện không hợp lệ.' };
  if (!channel) return { ok: false, error: 'Không có kênh để đăng bảng Boss.' };
  const BV = require('./bossViews');
  const r = await BV.summonAndPost({ client, guildId, channel, by, capdo: k.tier, minutes: minutes || k.minutes });
  return r.ok ? { ok: true, text: `Đã mở **${k.name}** — ${r.boss.name}.` } : r;
}

let busy = false;
async function tick(client) {
  if (busy) return; busy = true;
  try {
    const t = now();
    for (const ev of D.all("SELECT * FROM ev19 WHERE status = 'active' AND ends_at <= ?", t)) {
      if (ev.kind === 'dibien') { EV.endDibien(ev); await editMsg(client, ev, { embeds: [dibienEmbed(ev, true)] }); }
      else if (ev.kind === 'truyenthua') {
        const out = EV.settleContest(ev); if (!out) continue;
        await editMsg(client, ev, { embeds: [contestEmbed(ev, out.n, out)], components: [joinRow(ev, true)] });
        if (out.winner && ev.guild_id) { const ch = await channelFor(client, ev.guild_id, ev.channel_id); if (ch) { try { await ch.send({ embeds: [contestEmbed(ev, out.n, out)] }); } catch (_) { /* bỏ qua */ } } }
      }
    }
    try { BC.sweepStale(); } catch (e) { console.error('⚠️ bc19 sweep:', e.message); }
    // Tự sinh sự kiện: chỉ server đã đặt kênh thế giới
    for (const g of client.guilds ? [...client.guilds.cache.values()] : []) {
      const ch = WC.get(g.id) ? await channelFor(client, g.id, null) : null; if (!ch) continue;
      for (const kind of EV.autoCandidates(g.id, t)) {
        if ((kind === 'dicanh' || kind === 'sieuthoat') && BossG.getAliveBoss(g.id)) continue;
        const r = await start(client, kind, { guildId: g.id, channel: ch }); if (r.ok) break;
      }
    }
  } catch (e) { console.error('⚠️ ev19 tick lỗi:', e.message); }
  finally { busy = false; }
}
function listEmbed(guildId) {
  const e = new EmbedBuilder().setColor(0x9b59b6).setTitle('🌠 SỰ KIỆN THẾ GIỚI TIÊN GIỚI');
  const lines = [];
  const db = EV.dibienActive(); if (db) lines.push(`${EV.KINDS.dibien.icon} **Thiên Địa Dị Biến** — Bí Cảnh Tiên Giới ×${EV.DIBIEN.reward}, rơi ×${EV.DIBIEN.drop} · kết thúc ${ts(db.ends_at)}`);
  const tt = guildId && EV.activeOf('truyenthua', guildId); if (tt) lines.push(`${EV.KINDS.truyenthua.icon} **Vạn Cổ Truyền Thừa** (${EV.legacyOf(EV.dataOf(tt).legacy).name}) — chốt ${ts(tt.ends_at)}`);
  const b = guildId && BossG.getAliveBoss(guildId); if (b && b.tier >= 10) lines.push(`${b.tier === 10 ? EV.KINDS.dicanh.icon : EV.KINDS.sieuthoat.icon} **${b.name}** — dùng \`/trangthaiboss\``);
  e.setDescription(lines.length ? lines.join('\n') : 'Hiện chưa có sự kiện nào. Sự kiện xuất hiện ngẫu nhiên khi server đã đặt kênh thế giới (`/datkenhthegioi`).');
  e.addFields({ name: '📖 Các sự kiện', value: EV.KIND_ORDER.map((k) => `${EV.KINDS[k].icon} **${EV.KINDS[k].name}** — ${EV.KINDS[k].desc}`).join('\n').slice(0, 1020) });
  const hall = EV.hallTop(10);
  if (hall.length) e.addFields({ name: '🌌 Bảng thành tích Siêu Thoát Chi Môn', value: hall.map((h, i) => `**${i + 1}.** <@${h.user_id}> — ${h.wins} lần hạ · kỷ lục ${fmt(h.best_damage)} sát thương`).join('\n').slice(0, 1020) });
  return e;
}
module.exports = { tick, start, postEvent, listEmbed, contestEmbed, dibienEmbed };
