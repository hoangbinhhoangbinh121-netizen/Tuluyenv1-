'use strict';
/**
 * BẢNG QUẢN TRỊ v17.2 — /quantri. Chỉ admin của bot (ADMIN_CODE_APPROVER_IDS). Một bộ xử lý nút TĨNH ('qt'):
 * customId `qt|<uid>|<act>|<arg>` nên còn hiệu lực sau khi bot khởi động lại. Giao diện KHÔNG tự sửa dữ liệu — mọi thao tác
 * qua game/admin17.js (có nhật ký). Mọi ô nhập đều là biểu mẫu (modal), nên chỉ tốn 1 lệnh slash.
 */
const { ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const { EmbedBuilder, fit, listFit, optEmoji, btn, rowOf } = require('./petViews');
const { registerStatic, showModal, EPHEMERAL } = require('./kit');
const A = require('../game/admin17');
const ST = require('../game/settings');
const K = require('../game/constants');
const { fmtNum, now } = require('../util');

const isAdmin = (id) => require('../commands/framework').isAdminApprover(id);
const cid = (uid, act, arg = '') => `qt|${uid}|${act}|${arg}`.replace(/\|+$/, '').slice(0, 100);
const NAV = [
  ['home', 'Tổng Quan', '🛠️', 'Trạng thái bot, kinh tế, sự kiện'],
  ['vp', 'Vật Phẩm & Nghề', '🎒', 'Cho/thu vật phẩm, trang bị, cấp nghề, lò chế'],
  ['nv', 'Nhân Vật', '🧙', 'Cảnh giới, tu vi, Linh Thạch, hồi phục'],
  ['kt', 'Kinh Tế', '💰', 'Hệ số EXP, rơi đồ, giá NPC (chỉnh trực tiếp)'],
  ['sk', 'Sự Kiện & Thông Báo', '📣', 'Tăng tốc tu luyện, tăng rơi đồ, thông báo server'],
  ['nk', 'Nhật Ký Admin', '📜', 'Các thao tác admin gần nhất'],
];
const navRow = (uid, cur) => rowOf(new StringSelectMenuBuilder().setCustomId(cid(uid, 'nav')).setPlaceholder('Chọn mục quản trị…')
  .addOptions(NAV.map(([v, l, e, d]) => ({ label: l, value: v, description: d.slice(0, 100), emoji: optEmoji(e), default: v === cur }))));
const mins = (until) => (until ? `còn ${Math.max(1, Math.ceil((until - now()) / 60))} phút` : 'đến khi tắt');
const F = (name, value, inline = false) => ({ name: fit(name, 256), value: fit(value, 1024), inline });

// ---------------------------------------------------------------- các biểu mẫu (modal). run(admin, get, i) → chuỗi kết quả
const U = { id: 'u', label: 'Người chơi (ID hoặc @nhắc)', placeholder: '123456789012345678', maxLength: 40 };
const MODALS = {
  give: { view: 'vp', title: 'Cho vật phẩm V17', fields: [U, { id: 't', label: 'Vật phẩm', paragraph: true, maxLength: 400, placeholder: 'Thanh Linh Thảo x5, Tụ Khí Đan (Thượng Phẩm) x2' }], run: (a, g) => A.items(a, g('u'), g('t'), 1) },
  take: { view: 'vp', title: 'Thu vật phẩm V17', fields: [U, { id: 't', label: 'Vật phẩm', paragraph: true, maxLength: 400, placeholder: 'Thanh Linh Thảo x5' }], run: (a, g) => A.items(a, g('u'), g('t'), -1) },
  gear: { view: 'vp', title: 'Cho trang bị', fields: [U, { id: 't', label: 'Trang bị (tên hoặc mã)', maxLength: 80, placeholder: 'Thanh Phong Kiếm' }, { id: 'q', label: 'Phẩm chất 1–5 (mặc định 3)', required: false, maxLength: 1, placeholder: '3' }], run: (a, g) => A.gear(a, g('u'), g('t'), g('q')) },
  prof: { view: 'vp', title: 'Đặt cấp nghề', fields: [U, { id: 'p', label: 'Nghề', maxLength: 30, placeholder: 'Đan Sư / Luyện Khí Sư / Trận Pháp Sư / Linh Thực Sư' }, { id: 'l', label: 'Cấp 1–9', maxLength: 1, placeholder: '5' }, { id: 'e', label: 'EXP nghề (bỏ trống = đúng ngưỡng cấp)', required: false, maxLength: 12 }], run: (a, g) => A.profLevel(a, g('u'), g('p'), g('l'), g('e')) },
  jobs: { view: 'vp', title: 'Hoàn tất lò chế đang chạy', fields: [U], run: (a, g) => A.finishJobs(a, g('u')) },
  realm: { view: 'nv', title: 'Đặt cảnh giới', fields: [U, { id: 'r', label: 'Cảnh giới (số 0–14 hoặc tên)', maxLength: 30, placeholder: 'Độ Kiếp  hoặc  9' }, { id: 's', label: 'Tầng (bắt đầu từ 1)', required: false, maxLength: 3, placeholder: '1' }], run: (a, g) => A.realm(a, g('u'), g('r'), g('s')) },
  tuvi: { view: 'nv', title: 'Đặt tu vi', fields: [U, { id: 'n', label: 'Tu vi: số, +số, -số hoặc full', maxLength: 20, placeholder: 'full' }], run: (a, g) => A.tuvi(a, g('u'), g('n')) },
  lt: { view: 'nv', title: 'Đặt Linh Thạch', fields: [U, { id: 'n', label: 'Số: 1000000, +5000 hoặc -5000', maxLength: 20 }], run: (a, g) => A.currency(a, g('u'), 'linh_thach', g('n')) },
  lti: { view: 'nv', title: 'Đặt Linh Tinh', fields: [U, { id: 'n', label: 'Số: 100, +10 hoặc -10', maxLength: 20 }], run: (a, g) => A.currency(a, g('u'), 'linh_tinh', g('n')) },
  heal: { view: 'nv', title: 'Hồi phục nhân vật', fields: [U], run: (a, g) => A.heal(a, g('u')) },
  expc: { view: 'kt', title: 'Hệ số EXP đột phá', fields: [
    { id: 'a', label: `EXP gốc (mặc định ${A.ORIG.exp})`, required: false, maxLength: 12, placeholder: 'bỏ trống = giữ nguyên · "mac dinh" = về gốc' },
    { id: 'b', label: `Tiểu cảnh giới (mặc định ${A.ORIG.minor})`, required: false, maxLength: 12 },
    { id: 'c', label: `Đại cảnh giới (mặc định ${A.ORIG.major})`, required: false, maxLength: 12 }],
  run: (a, g) => ['exp:a', 'minor:b', 'major:c'].map((x) => { const [k, f] = x.split(':'); return A.ecoSet(a, k, g(f)); }).filter((r) => !r.skip).map((r) => r.msg).join('\n') || 'ℹ️ Không có gì thay đổi.' },
  tien: { view: 'kt', title: 'Hệ số cảnh giới Tiên', fields: [{ id: 'a', label: `x EXP khi đột phá trên Độ Kiếp (mặc định ${A.ORIG.tien})`, maxLength: 12, placeholder: '7' }], run: (a, g) => A.ecoSet(a, 'tien', g('a')).msg },
  drop: { view: 'kt', title: 'Hệ số rơi nguyên liệu', fields: [{ id: 'a', label: 'Nhân xác suất rơi (0–5, mặc định 1)', maxLength: 8, placeholder: '1.5' }], run: (a, g) => `${A.ecoSet(a, 'drop', g('a')).msg}\nℹ️ Trần rơi theo ngày/tuần/phẩm cấp vẫn áp dụng — không thể rơi vô hạn.` },
  npc: { view: 'kt', title: 'Giá NPC', fields: [
    { id: 'a', label: 'Giá NPC thu mua ×(0.1–3, mặc định 1)', required: false, maxLength: 8 },
    { id: 'b', label: 'Giá NPC bán ×(0.1–5, mặc định 1)', required: false, maxLength: 8 }],
  run: (a, g) => [A.ecoSet(a, 'sell', g('a')), A.ecoSet(a, 'buy', g('b'))].filter((r) => !r.skip).map((r) => r.msg).join('\n') || 'ℹ️ Không có gì thay đổi.' },
  reset: { view: 'kt', title: 'Về mặc định toàn bộ kinh tế', fields: [{ id: 'a', label: 'Gõ DONGY để xác nhận', maxLength: 10 }], run: (a, g) => { if (String(g('a')).trim().toUpperCase() !== 'DONGY') return '❌ Chưa xác nhận (cần gõ đúng DONGY) — không có gì thay đổi.'; A.ecoReset(a); return '↩️ Đã đưa mọi hệ số kinh tế & sự kiện rơi đồ về mặc định.'; } },
};
// hai biểu mẫu sự kiện/thông báo cần client → xử lý riêng (xem modalRun)
MODALS.evspeed = { view: 'sk', title: 'Sự kiện tăng tốc tu luyện', fields: [{ id: 'm', label: 'Hệ số 0.1–50 (hoặc "tat")', maxLength: 8, placeholder: '2' }, { id: 'p', label: 'Số phút (bỏ trống = đến khi tắt)', required: false, maxLength: 6 }, { id: 'n', label: 'Thông báo ra kênh thế giới? (co/khong)', required: false, maxLength: 5, placeholder: 'co' }] };
MODALS.evdrop = { view: 'sk', title: 'Sự kiện tăng tỉ lệ rơi', fields: [{ id: 'm', label: 'Hệ số 0.1–5 (hoặc "tat")', maxLength: 8, placeholder: '2' }, { id: 'p', label: 'Số phút (bỏ trống = đến khi tắt)', required: false, maxLength: 6 }, { id: 'n', label: 'Thông báo ra kênh thế giới? (co/khong)', required: false, maxLength: 5, placeholder: 'co' }] };
MODALS.ann = { view: 'sk', title: 'Thông báo toàn server', fields: [{ id: 't', label: 'Tiêu đề', maxLength: 80, placeholder: 'Bảo trì / Sự kiện mới…' }, { id: 'c', label: 'Nội dung', paragraph: true, maxLength: 1500 }] };

async function announce(i, title, text) {
  try {
    const { announceWorld } = require('./worldChannel'); const { createEmbed } = require('./components/baseEmbed');
    const ok = await announceWorld(i.client, i.guildId, createEmbed({ cat: 'thiendao', header: 'THIÊN ĐẠO', status: title, description: text }), { channelId: i.channelId });
    return ok ? '📣 Đã gửi thông báo ra kênh thế giới.' : '⚠️ Chưa có kênh thế giới (dùng /datkenhthegioi) nên không gửi được thông báo.';
  } catch (e) { return `⚠️ Không gửi được thông báo: ${e.message}`; }
}
const yes = (s) => !/^(k|khong|không|no|n|0)$/i.test(String(s || '').trim());
async function modalRun(act, admin, get, i) {
  if (act === 'evspeed') {
    const r = A.setSpeedEvent(admin, String(get('m')).trim().toLowerCase().replace(',', '.'), Number(get('p')) || 0); if (!r.ok) return r.msg;
    if (r.off) { const a = r.was && yes(get('n')) ? `\n${await announce(i, 'Sự kiện kết thúc', '🛑 Sự kiện **tăng tốc tu luyện** đã kết thúc. Tốc độ tu luyện trở lại bình thường.')}` : ''; return `🛑 Đã tắt sự kiện tăng tốc tu luyện (về ×1).${a}`; }
    const a = yes(get('n')) ? `\n${await announce(i, 'Tăng tốc tu luyện', `⚡ **Thiên địa linh khí cuồn cuộn!** Mọi tu sĩ được tăng tốc tu luyện **×${r.info.mult}** (Tu Luyện, Bế Quan, Bế Quan Treo) ${mins(r.info.until)}. Mau tu luyện nào!`)}` : '';
    return `✅ Tăng tốc tu luyện **×${r.info.mult}** — ${mins(r.info.until)}. Không ảnh hưởng EXP cần để đột phá.${a}`;
  }
  if (act === 'evdrop') {
    const raw = String(get('m')).trim().toLowerCase().replace(',', '.');
    if (raw === 'tat' || Number(raw) === 1) { const was = A.evDrop().active; A.setEvDrop(admin, 1, 0); const a = was && yes(get('n')) ? `\n${await announce(i, 'Sự kiện kết thúc', '🛑 Sự kiện **tăng tỉ lệ rơi nguyên liệu** đã kết thúc.')}` : ''; return `🛑 Đã tắt sự kiện tăng tỉ lệ rơi (về ×1).${a}`; }
    const m = Number(raw); if (!(m >= 0.1 && m <= 5)) return '❌ Hệ số phải từ 0.1 đến 5 (hoặc "tat").';
    const info = A.setEvDrop(admin, m, Math.max(0, Math.trunc(Number(get('p')) || 0)));
    const a = yes(get('n')) ? `\n${await announce(i, 'Tăng tỉ lệ rơi', `🎁 **Cơ duyên giáng thế!** Tỉ lệ rơi nguyên liệu tăng **×${info.mult}** ${mins(info.until)} (Bí Cảnh, Boss, Linh Thú…).`)}` : '';
    return `✅ Tăng tỉ lệ rơi **×${info.mult}** — ${mins(info.until)}. Trần rơi theo ngày/tuần/phẩm cấp vẫn áp dụng.${a}`;
  }
  if (act === 'ann') { const t = String(get('t')).trim(); const c = String(get('c')).trim(); if (!t || !c) return '❌ Cần cả tiêu đề và nội dung.'; const r = await announce(i, t.slice(0, 80), c); A.log(admin, 'thong_bao', '', `${t}: ${c}`.slice(0, 300)); return r; }
  return MODALS[act].run(admin, get);
}

// ---------------------------------------------------------------- các màn hình
function viewHome(uid) {
  const o = A.overview(); const e = new EmbedBuilder().setTitle('🛠️ Quản Trị Tiên Giới').setColor(0x34495e);
  e.setDescription(fit(`Bảng điều khiển dành cho admin. Chọn mục ở menu bên dưới — mọi thao tác nhập liệu mở bằng biểu mẫu, và đều được ghi **Nhật Ký Admin**.`, 400));
  e.addFields(
    F('👥 Người chơi', `**${fmtNum(o.total)}** tu sĩ · hôm nay **${o.today}** thao tác admin`, true),
    F('🚧 Bảo trì', o.maint ? '🔴 ĐANG BẬT (`/baotri` để tắt)' : '🟢 Tắt', true),
    F('⚡ Tăng tốc tu luyện', o.speed.active ? `×${o.speed.mult} — ${mins(o.speed.until)}` : 'Không có sự kiện', true),
    F('🎁 Tăng tỉ lệ rơi', o.evDrop.active ? `×${o.evDrop.mult} — ${mins(o.evDrop.until)}` : 'Không có sự kiện', true),
    F('📈 Hệ số hiện hành', `EXP gốc **${A.ecoGet('exp')}** · Tiên **×${A.ecoGet('tien')}** · Rơi **×${A.ecoGet('drop')}** · NPC thu **×${A.ecoGet('sell')}** / bán **×${A.ecoGet('buy')}**`),
  );
  return { embeds: [e], components: [navRow(uid, 'home')] };
}
function viewVp(uid) {
  const e = new EmbedBuilder().setTitle('🎒 Vật Phẩm & Nghề').setColor(0x16a085);
  e.setDescription(fit('Mọi thao tác đi qua **Inventory Service** (kho không bao giờ âm, có trần chồng, ghi `inv_log`).\n• Vật phẩm: `Tên x số`, cách nhau dấu phẩy. Có phẩm chất: `Tụ Khí Đan (Thượng Phẩm) x2`.\n• Người chơi: dán **ID** hoặc @nhắc tên.\n• Thu vật phẩm chỉ thu đủ số lượng đang có, không âm kho.', 900));
  e.addFields(F('🎓 Nghề', Object.values(require('../data/craft_v17').PROFS).map((p) => `${p.icon} ${p.name}`).join(' · ')), F('🛡️ Trang bị', Object.values(require('../data/craft_v17').GEAR).map((g) => g.name).join(' · ')));
  return { embeds: [e], components: [navRow(uid, 'vp'), rowOf(btn(cid(uid, 'm', 'give'), 'Cho vật phẩm', '🎁', ButtonStyle.Success), btn(cid(uid, 'm', 'take'), 'Thu vật phẩm', '🧺', ButtonStyle.Danger), btn(cid(uid, 'm', 'gear'), 'Cho trang bị', '🛡️'), btn(cid(uid, 'm', 'prof'), 'Đặt cấp nghề', '🎓'), btn(cid(uid, 'm', 'jobs'), 'Hoàn tất lò', '⏩'))] };
}
function viewNv(uid) {
  const e = new EmbedBuilder().setTitle('🧙 Nhân Vật').setColor(0x8e44ad);
  e.setDescription(fit('Chỉnh dữ liệu một người chơi. Đặt cảnh giới cao sẽ **tự nâng bậc thế giới** cho khớp (Linh Giới >Hóa Thần, Tiên Giới >Độ Kiếp) và giữ nguyên tu vi hiện có.\n• Tu vi / Linh Thạch / Linh Tinh: nhập số để đặt, `+số` hoặc `-số` để cộng trừ; tu vi còn nhận `full`.\n• Hồi phục: đầy Sinh Mệnh + xoá thời gian dưỡng thương sau đột phá hụt.', 900));
  e.addFields(F('🏔️ Cảnh giới', K.REALMS.map((r, i) => `${i}·${r.name}`).join('  ')));
  return { embeds: [e], components: [navRow(uid, 'nv'), rowOf(btn(cid(uid, 'm', 'realm'), 'Đặt cảnh giới', '🏔️', ButtonStyle.Primary), btn(cid(uid, 'm', 'tuvi'), 'Đặt tu vi', '✨'), btn(cid(uid, 'm', 'lt'), 'Linh Thạch', '💰'), btn(cid(uid, 'm', 'lti'), 'Linh Tinh', '💎'), btn(cid(uid, 'm', 'heal'), 'Hồi phục', '💖', ButtonStyle.Success))] };
}
function viewKt(uid) {
  const R = require('../game/realm'); const o = A.overview(); const e = new EmbedBuilder().setTitle('💰 Kinh Tế').setColor(0xf39c12);
  e.setDescription(fit('Chỉnh **ngay trong game**, lưu vào cơ sở dữ liệu (còn sau khi khởi động lại), có biên an toàn. Khoảng trống bỏ qua = giữ nguyên; gõ `mac dinh` để về giá trị gốc.', 500));
  const row = (k) => { const v = A.ecoGet(k); const d = A.ORIG[k]; return `${A.ECO[k].label}: **${v}**${v === d ? '' : ` _(gốc ${d})_`}`; };
  e.addFields(F('📊 Hệ số', ['exp', 'minor', 'major', 'tien', 'drop', 'sell', 'buy'].map(row).join('\n')),
    F('🎯 Mốc tu vi để đột phá (xem trước)', `Luyện Khí tầng 1: **${fmtNum(o.gates.tuvi0)}**\nHóa Thần Viên Mãn: **${fmtNum(o.gates.hoathan)}**\nĐộ Kiếp Viên Mãn → Chân Tiên: **${fmtNum(o.gates.dokiep)}**\nChân Tiên tầng 1: **${fmtNum(o.gates.chantien)}**`));
  return { embeds: [e], components: [navRow(uid, 'kt'), rowOf(btn(cid(uid, 'm', 'expc'), 'EXP đột phá', '📈', ButtonStyle.Primary), btn(cid(uid, 'm', 'tien'), 'Hệ số Tiên', '👑'), btn(cid(uid, 'm', 'drop'), 'Rơi đồ', '🎁'), btn(cid(uid, 'm', 'npc'), 'Giá NPC', '🏪'), btn(cid(uid, 'm', 'reset'), 'Mặc định', '↩️', ButtonStyle.Danger))] };
}
function viewSk(uid) {
  const o = A.overview(); const e = new EmbedBuilder().setTitle('📣 Sự Kiện & Thông Báo').setColor(0xe74c3c);
  e.setDescription(fit('Sự kiện có thể đặt **thời hạn (phút)** — tự hết hạn. Có tuỳ chọn thông báo tự động ra kênh thế giới (đặt bằng `/datkenhthegioi`).', 400));
  e.addFields(F('⚡ Tăng tốc tu luyện', o.speed.active ? `**×${o.speed.mult}** — ${mins(o.speed.until)}` : 'Không có sự kiện', true), F('🎁 Tăng tỉ lệ rơi', o.evDrop.active ? `**×${o.evDrop.mult}** — ${mins(o.evDrop.until)}` : 'Không có sự kiện', true));
  return { embeds: [e], components: [navRow(uid, 'sk'), rowOf(btn(cid(uid, 'm', 'evspeed'), 'Tăng tốc tu luyện', '⚡', ButtonStyle.Primary), btn(cid(uid, 'm', 'evdrop'), 'Tăng tỉ lệ rơi', '🎁', ButtonStyle.Primary), btn(cid(uid, 'm', 'ann'), 'Thông báo server', '📣', ButtonStyle.Success), btn(cid(uid, 'off'), 'Tắt mọi sự kiện', '🛑', ButtonStyle.Danger))] };
}
function viewNk(uid) {
  const rows = A.recent(15); const e = new EmbedBuilder().setTitle('📜 Nhật Ký Admin').setColor(0x7f8c8d);
  const fmt = (r) => `\`${new Date((r.ts + 7 * 3600) * 1000).toISOString().slice(5, 16).replace('T', ' ')}\` <@${r.admin_id}> **${r.action}**${r.target ? ` → ${/^\d{15,}$/.test(r.target) ? `<@${r.target}>` : r.target}` : ''}${r.detail ? ` — ${String(r.detail).slice(0, 80)}` : ''}`;
  e.setDescription(fit(rows.length ? listFit(rows.map(fmt), 3800) : 'Chưa có thao tác admin nào.', 4000));
  return { embeds: [e], components: [navRow(uid, 'nk'), rowOf(btn(cid(uid, 'rf', 'nk'), 'Làm mới', '🔄'), btn(cid(uid, 'exp'), 'Xuất .txt (200 dòng)', '📄'))] };
}
const VIEWS = { home: viewHome, vp: viewVp, nv: viewNv, kt: viewKt, sk: viewSk, nk: viewNk };
function render(uid, view = 'home', note = '') {
  const out = (VIEWS[view] || viewHome)(String(uid)); if (note) out.content = fit(note, 1900, ''); return out;
}
const open = (i, uid, view = 'home') => i.reply({ ...render(uid, view), flags: EPHEMERAL });

// ---------------------------------------------------------------- xử lý bấm nút (tĩnh)
registerStatic('qt', async (i, parts) => {
  const [uid, act, arg] = parts;
  if (String(i.user.id) !== String(uid) || !isAdmin(i.user.id)) return i.reply({ content: '❌ Bảng này chỉ dành cho admin được chỉ định — gõ `/quantri` để mở bảng của bạn.', flags: EPHEMERAL });
  const sel = (i.values || [])[0];
  switch (act) {
    case 'nav': return i.update(render(uid, sel || 'home'));
    case 'rf': return i.update(render(uid, arg || 'home'));
    case 'm': {
      const def = MODALS[arg]; if (!def) return i.update(render(uid, 'home'));
      return showModal(i, { title: def.title, fields: def.fields, onSubmit: async (mi, get) => {
        let msg; try { msg = await modalRun(arg, mi.user.id, get, mi); } catch (e) { msg = `❌ Lỗi: ${e.message}`; }
        const panel = render(uid, def.view, msg);
        if (typeof mi.isFromMessage === 'function' && mi.isFromMessage() && typeof mi.update === 'function') { try { return await mi.update(panel); } catch (_) { /* rơi xuống reply */ } }
        return mi.reply({ content: fit(msg, 1900, '✅'), flags: EPHEMERAL });
      } });
    }
    case 'off': { const r = A.setSpeedEvent(i.user.id, 'tat'); A.setEvDrop(i.user.id, 1, 0); return i.update(render(uid, 'sk', `🛑 Đã tắt mọi sự kiện${r.was ? ' (tăng tốc tu luyện)' : ''}.`)); }
    case 'exp': return i.reply({ content: '📄 Nhật ký admin (200 dòng gần nhất):', files: [new AttachmentBuilder(Buffer.from(A.logText(200), 'utf8'), { name: 'nhat_ky_admin.txt' })], flags: EPHEMERAL });
    default: return i.update(render(uid, 'home'));
  }
});

module.exports = { render, open, MODALS, NAV };
