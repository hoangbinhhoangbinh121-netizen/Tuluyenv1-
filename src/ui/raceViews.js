'use strict';
/** v21.5 — Giao diện Chủng Tộc: /chungtoc. Mọi nút kiểm chủ menu (View.checkOwner); số liệu lấy từ data/race21.js + game/race21.js. */
const { EmbedBuilder } = require('discord.js');
const T = require('../game/talent');
const RC = require('../game/race21');
const Cu = require('../game/cultivator');
const { View, EPHEMERAL } = require('./kit');
const { COLORS } = require('./theme/colors');
const { fmtNum, now } = require('../util');
const R = RC.R;

const fxText = (fx) => T.fxLines(fx).join('\n') || '—';
const clip = (s, n = 1000) => String(s).slice(0, n);

function overviewEmbed() {
  const e = new EmbedBuilder().setTitle('🧬 CHỦNG TỘC').setColor(COLORS.SPECIAL)
    .setDescription('Chọn **chủng tộc** gốc của nhân vật — **lần đầu miễn phí**. Mỗi tộc có điểm mạnh và nhược điểm rõ. Về sau đổi tộc phải trả Linh Thạch, chờ hồi chiêu và **mất toàn bộ** thức tỉnh / huyết mạch / tiến hóa.');
  for (const id of R.ORDER) { const r = R.RACES[id]; e.addFields({ name: `${RC.icon(r)} ${r.name} — ${r.role}`, value: clip(`${r.passive.desc}\n_${r.counter}_`, 400), inline: false }); }
  return e;
}
function previewEmbed(raceId) {
  const r = R.RACES[raceId];
  const e = new EmbedBuilder().setTitle(`${RC.icon(r)} ${r.name} — ${r.role}`).setColor(COLORS.INFO).setDescription(clip(r.lore, 600));
  e.addFields({ name: `✦ Nội tại — ${r.passive.name}`, value: clip(`${r.passive.desc}\n${fxText(r.passive.fx)}`), inline: false });
  for (const b of Object.values(r.bloodlines)) e.addFields({ name: `${RC.iconBl(Object.keys(r.bloodlines).find((k) => r.bloodlines[k] === b))} ${b.name}`, value: clip(`${b.desc}\n${fxText(b.fx)}`), inline: true });
  e.addFields({ name: `${RC.iconEv(r.id)} Tiến hóa — ${r.evolved.name}`, value: clip(`${r.evolved.desc}\n${fxText(r.evolved.fx)}`), inline: false }, { name: '⚠️ Khắc chế', value: clip(r.counter), inline: false });
  return e;
}
function profileEmbed(row, note) {
  const st = RC.get(row.user_id); const r = RC.raceOf(st); const fx = RC.fxFromState(st);
  const bl = st.bloodline_id && r.bloodlines[st.bloodline_id];
  const e = new EmbedBuilder().setTitle(`${RC.icon(r)} ${fx.label} — ${r.role}`).setColor(COLORS.SPECIAL).setDescription(note ? clip(note, 1500) : clip(r.lore, 600));
  e.addFields(
    { name: `${RC.iconAw(st.awakening_stage)} Thức tỉnh`, value: `${R.AW_NAMES[st.awakening_stage]} (nội tại ×${R.AW_MULT[st.awakening_stage]})`, inline: true },
    { name: `${bl ? RC.iconBl(st.bloodline_id) : RC.iconOp('bloodline')} Huyết mạch`, value: bl ? `${bl.name} · Lv.${st.bloodline_level}/5 (×${R.LV_MULT[st.bloodline_level]})` : 'Chưa thức tỉnh', inline: true },
    { name: `${st.evolved ? RC.iconEv(r.id) : RC.iconOp('evolve')} Tiến hóa`, value: st.evolved ? `**${r.evolved.name}**` : 'Chưa', inline: true },
    { name: `✦ Hiệu ứng đang hoạt động (đã gồm trần chung)`, value: clip(fx.parts.map((p) => `**${p.name}** (×${Math.round(p.mult * 100) / 100})\n${fxText(p.fx)}`).join('\n')), inline: false },
  );
  const steps = RC.nextSteps(row);
  if (steps.length) e.addFields({ name: '🎯 Bước kế tiếp', value: clip(steps.map((s) => `**${s.title}**\n${s.lines.join('\n')}`).join('\n\n')), inline: false });
  e.addFields({ name: '⚠️ Khắc chế', value: clip(r.counter), inline: false }, { name: '💎 Linh Thạch', value: fmtNum(row.linh_thach || 0), inline: true });
  return e.setFooter({ text: st.changed_at ? `Đổi tộc gần nhất: ${new Date(st.changed_at * 1000).toISOString().slice(0, 10)}` : 'Chủng Tộc · Thiên Tông Bot' });
}
function historyEmbed(userId) {
  const rows = RC.historyOf(userId, 10);
  const EV = { choose: 'Chọn tộc', change: 'Đổi tộc', awaken: 'Thức tỉnh', bloodline_pick: 'Thức tỉnh huyết mạch', bloodline_up: 'Nâng huyết mạch', evolve: 'Tiến hóa' };
  return new EmbedBuilder().setTitle('📜 LỊCH SỬ CHỦNG TỘC').setColor(COLORS.SYSTEM)
    .setDescription(clip(rows.map((h) => `<t:${Math.floor(h.created_at)}:R> · **${EV[h.event_type] || h.event_type}**${h.cost ? ` · −${fmtNum(h.cost)} Linh Thạch` : ''}`).join('\n') || 'Chưa có sự kiện nào.', 3500));
}

/** View chính. pending = { kind: 'choose'|'change', raceId } khi đang chờ xác nhận. */
function mainView(userId, pending = null) {
  const v = new View({ ownerId: userId, timeout: 600 });
  const row = Cu.getCultivator(userId); const st = RC.get(userId);
  const refresh = async (i, res, pend = null) => {
    const fresh = Cu.getCultivator(userId); const view = mainView(userId, pend);
    const emb = pend ? previewEmbed(pend.raceId) : (RC.get(userId) ? profileEmbed(fresh, res && res.msg) : overviewEmbed());
    if (pend) emb.setDescription(clip(`${pend.kind === 'change' ? `⚠️ **Đổi tộc** tốn **${fmtNum(R.CHANGE.thach)}** Linh Thạch, hồi chiêu ${R.CHANGE.cooldownSec / 86400} ngày và **xoá** thức tỉnh/huyết mạch/tiến hóa hiện tại.\n\n` : ''}${emb.data.description || ''}`, 1800));
    else if (res && res.msg && !RC.get(userId)) emb.setDescription(clip(res.msg, 1500));
    v.stop();
    return i.update({ embeds: [emb], components: view.components() });
  };
  const act = (fn) => async (i) => { const res = fn(); if (!res.ok) { return i.reply({ content: clip(res.msg, 1800), flags: EPHEMERAL }); } return refresh(i, res); };
  if (!st) {
    v.select({ key: 'pick', placeholder: 'Chọn chủng tộc để xem chi tiết…', row: 0, options: R.ORDER.map((id) => ({ label: R.RACES[id].name, value: id, description: R.RACES[id].role, emoji: RC.icon(R.RACES[id]) })) },
      (i, vals) => refresh(i, null, { kind: 'choose', raceId: vals[0] }));
    if (pending) {
      v.button({ key: 'ok', label: `Xác nhận chọn ${R.RACES[pending.raceId].name}`, style: 'green', row: 1 }, act(() => RC.choose(userId, pending.raceId)));
      v.button({ key: 'no', label: 'Huỷ', style: 'grey', row: 1 }, (i) => refresh(i, null, null));
    }
    return v;
  }
  const r = RC.raceOf(st);
  v.button({ key: 'aw', label: 'Thức Tỉnh', emoji: RC.iconOp('awaken'), style: 'blurple', row: 0, disabled: st.awakening_stage >= R.AWAKEN.length }, act(() => RC.awaken(userId)));
  v.button({ key: 'bl', label: 'Nâng Huyết Mạch', emoji: RC.iconOp('bloodline'), style: 'red', row: 0, disabled: !st.bloodline_id || st.bloodline_level >= 5 }, act(() => RC.upgradeBloodline(userId)));
  v.button({ key: 'ev', label: 'Tiến Hóa', emoji: RC.iconOp('evolve'), style: 'green', row: 0, disabled: !!st.evolved }, act(() => RC.evolve(userId)));
  v.button({ key: 'hs', label: 'Lịch Sử', emoji: '📜', style: 'grey', row: 0 }, (i) => i.reply({ embeds: [historyEmbed(userId)], flags: EPHEMERAL }));
  v.button({ key: 'info', label: 'Xem 6 Tộc', emoji: '🧬', style: 'grey', row: 0 }, (i) => i.reply({ embeds: [overviewEmbed()], flags: EPHEMERAL }));
  if (!st.bloodline_id) {
    v.select({ key: 'bp', placeholder: `Thức tỉnh Huyết Mạch (${fmtNum(R.BLOODLINE_PICK.thach)} Linh Thạch)…`, row: 1, options: Object.entries(r.bloodlines).map(([id, b]) => ({ label: b.name, value: id, description: b.desc, emoji: RC.iconBl(id) })) },
      async (i, vals) => { const res = RC.pickBloodline(userId, vals[0]); if (!res.ok) return i.reply({ content: clip(res.msg, 1800), flags: EPHEMERAL }); return refresh(i, res); });
  }
  v.select({ key: 'chg', placeholder: 'Đổi sang tộc khác (có phí)…', row: 2, options: R.ORDER.filter((id) => id !== st.race_id).map((id) => ({ label: R.RACES[id].name, value: id, description: R.RACES[id].role, emoji: RC.icon(R.RACES[id]) })) },
    (i, vals) => refresh(i, null, { kind: 'change', raceId: vals[0] }));
  if (pending) {
    v.button({ key: 'ok', label: `Xác nhận ĐỔI sang ${R.RACES[pending.raceId].name}`, style: 'red', row: 3 }, act(() => RC.change(userId, pending.raceId)));
    v.button({ key: 'no', label: 'Huỷ', style: 'grey', row: 3 }, (i) => refresh(i, null, null));
  }
  return v;
}

/** Payload mở menu. */
function open(userId) {
  const row = Cu.getCultivator(userId); const v = mainView(userId);
  return { embeds: [RC.get(userId) ? profileEmbed(row) : overviewEmbed()], components: v.components() };
}
module.exports = { open, mainView, overviewEmbed, previewEmbed, profileEmbed, historyEmbed };
