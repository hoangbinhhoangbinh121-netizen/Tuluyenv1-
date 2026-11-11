'use strict';
/**
 * GIAO DIỆN LINH THÚ v14.0 — một menu duy nhất (`/linhthu` hoặc Đồng Hành → Linh Thú) với 8 mục:
 * Tổng Quan · Danh Sách · Khế Ước · Nuôi Dưỡng · Tiến Hóa · Kỹ Năng · Huyết Mạch · Xuất Chiến   (+ Cửa Hàng Linh Thú).
 *
 * Nút/menu là "tĩnh": customId = `lt|<chủ menu>|<hành động>|<pet_id>|<đối số>` → bấm bao lâu cũng được, sống sót qua khởi động lại,
 * mọi thao tác CẬP NHẬT TẠI CHỖ (không sinh tin nhắn mới, không bị trôi). Chủ menu được kiểm tra ở mỗi lần bấm; mọi hàm logic lại kiểm tra
 * quyền sở hữu pet_id theo (owner, pet_id) nên không thể giả mạo.
 */
const DJS = require('discord.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = DJS;

/**
 * v14.3 — EmbedBuilder "an toàn giới hạn". Emoji tùy chỉnh <:tên:id> dài ~45 ký tự nên một dòng thú có thể >150 ký tự;
 * 8 dòng như vậy vượt 1024 của một ô → Discord/discord.js ném lỗi (mã 65dd). Mọi ô/mô tả đều được cắt theo ranh giới DÒNG
 * (không cắt giữa emoji <:..:..>), thêm "…", và không bao giờ để trống.
 */
const LIM = { fname: 256, fvalue: 1024, desc: 4096, title: 256 };
function fit(text, max, fallback = '\u200b') {
  let t = String(text === undefined || text === null ? '' : text);
  if (!t.trim()) return fallback;
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 2);
  const nl = cut.lastIndexOf('\n');
  let out = nl > max * 0.4 ? cut.slice(0, nl) : cut;
  out = out.replace(/<a?:[A-Za-z0-9_]*(?::\d*)?$/, '').replace(/<[^>]*$/, '');       // bỏ phần emoji/mention bị cắt dở
  const open = (out.match(/\*\*/g) || []).length % 2; if (open) out += '**';           // đóng đậm nếu bị cắt giữa chừng
  return `${out}…`;
}
/** Ghép danh sách dòng vừa khít `max` ký tự; phần còn lại gộp thành "… và N mục nữa". */
function listFit(lines, max, more = (n) => `… và ${n} mục nữa`) {
  const out = []; let len = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const tail = i < lines.length - 1 ? more(lines.length - i - 1).length + 1 : 0;
    if (len + lines[i].length + 1 + tail > max && out.length) return `${out.join('\n')}\n${more(lines.length - i)}`;
    out.push(lines[i]); len += lines[i].length + 1;
  }
  return out.join('\n');
}
class EmbedBuilder extends DJS.EmbedBuilder {
  addFields(...f) { return super.addFields(f.flat().map((x) => ({ ...x, name: fit(x.name, LIM.fname), value: fit(x.value, LIM.fvalue) })).slice(0, 25)); }
  setDescription(t) { return super.setDescription(fit(t, LIM.desc, '\u200b')); }
  setTitle(t) { return super.setTitle(fit(t, LIM.title, '\u200b')); }
}
const D = require('../db');
const K = require('../game/constants');
const Cu = require('../game/cultivator');
const P = require('../game/pets');
const PB = require('../game/petBalance');
const PD = require('../game/petData');
const { E, toComponentEmoji } = require('../game/emoji');
const { registerStatic, showModal, EPHEMERAL } = require('./kit');
const { fmtNum, now, clamp } = require('../util');

const TABS = [
  ['ov', 'Tổng Quan', '🐾', 'Ô khế ước, Linh Thú Viên, trứng, vật phẩm'],
  ['ls', 'Danh Sách', '📋', 'Xem toàn bộ Linh Thú & chi tiết từng con'],
  ['kh', 'Khế Ước', '📜', 'Thu phục thú hoang, nở trứng, ký/giải khế ước'],
  ['nd', 'Nuôi Dưỡng', '🍖', 'Cho ăn, dạo chơi, tăng EXP & thân mật'],
  ['th', 'Tiến Hóa', '🌟', 'Chính Hóa / Dị Hóa — đổi dòng hành'],
  ['kn', 'Kỹ Năng', '📘', 'Kỹ năng chủ động, bị động, nâng bậc'],
  ['hm', 'Huyết Mạch', '🩸', 'Tẩy luyện huyết mạch & truyền thừa'],
  ['xc', 'Xuất Chiến', '⚔️', 'Chọn thú ra trận PvP / trợ chiến'],
];
const TAB_NAME = Object.fromEntries(TABS.map((t) => [t[0], t[1]]));
const CONTRACT_ICON = {   // v14.0: emoji pixel (tự rơi về Unicode)
  get binh_dang() { return E.pet_khe_binhdang || '🤝'; }, get chu_to() { return E.pet_khe_chuto || '⛓️'; }, get ban_menh() { return E.pet_khe_banmenh || '🔮'; },
};
const COLORS = { 1: 0x95a5a6, 2: 0x2ecc71, 3: 0x3498db, 4: 0xa0522d, 5: 0x9b59b6, 6: 0xf1c40f, 7: 0xe67e22, 8: 0xe74c3c, 9: 0x2c3e50 };

// ---------------------------------------------------------------- tiện ích dựng thành phần
const em = (s) => toComponentEmoji(s);
/** Emoji cho lựa chọn của menu chọn: PHẢI là đối tượng {name} hoặc {id,name} (chuỗi Unicode trần làm discord.js ném lỗi xác thực). */
const optEmoji = (s) => { const e = toComponentEmoji(s); return typeof e === 'string' ? { name: e } : e; };
function btn(id, label, emoji, style = ButtonStyle.Secondary, disabled = false) {
  const b = new ButtonBuilder().setCustomId(id.slice(0, 100)).setLabel(String(label).slice(0, 80)).setStyle(style).setDisabled(!!disabled);
  const e = emoji ? em(emoji) : null; if (e) b.setEmoji(e);
  return b;
}
const rowOf = (...c) => new ActionRowBuilder().addComponents(...c);
const bar = (cur, max, n = 10) => { const f = Math.round(n * clamp(max ? cur / max : 0, 0, 1)); return `${'█'.repeat(f)}${'░'.repeat(n - f)}`; };
const cid = (uid, act, pet = 0, arg = '') => `lt|${uid}|${act}|${pet || 0}|${arg}`.replace(/\|$/, '');
const nm = (v) => `${P.emojiOf(v.sp)} ${v.name}`;
const slotName = (s) => P.SLOT_LABEL[s] || 'Linh Thú Viên';

// ---------------------------------------------------------------- văn bản
function petOneLine(v, extra = '') {
  const mark = v.fighter ? '⚔️ ' : '';
  const c = v.contractInfo ? `${CONTRACT_ICON[v.contract]} ${v.contractInfo.short}` : '— chưa khế ước';
  return `${mark}${nm(v)} · **Lv.${v.level}** · ${P.tierIcon(v.tier)} ${v.tierInfo.name} · ${v.sp.hanh} · ${c}${extra}`;
}
function statsText(v) {
  const s = v.stats;
  return `❤️ ${fmtNum(s.hp)} · ⚔️ ${fmtNum(s.atk)} · 🛡️ ${fmtNum(s.def)} · 💨 ${fmtNum(s.spd)}\n_(chỉ số thú — **không** cộng vào bản thân bạn; thú tác động qua trợ chiến & kỹ năng trong PvP)_\n💠 Sức chiến đấu: **${v.rating.toFixed(2)}**${v.suppression < 1 ? ` · ⚠️ Cảnh giới chưa đủ áp chế phẩm ${v.tierInfo.name}: ×${v.suppression.toFixed(2)}` : ''}`;
}
function skillsText(v) {
  const lines = v.skills.map((s) => `${s.kind === 'active' ? '🗡️' : '🛡️'} **${s.name}** _(bậc ${s.rank})_ ${s.unlocked ? '' : `🔒 mở ở Lv.${s.unlock}`}\n   ${s.text}`);
  if (v.inheritSkill) lines.push(`🧬 **${v.inheritSkill.name}** _(Truyền Thừa · bậc ${v.inheritSkill.rank} · từ ${v.inheritSkill.species.name})_\n   ${v.inheritSkill.text}`);
  return lines.join('\n');
}
function bloodText(v) {
  const tf = Math.round(PB.STAGE_TALENT[v.stage] * (v.contractInfo ? v.contractInfo.talent : 0.9) * 100);
  return `🩸 **${v.sp.bloodline}** — ${v.stageName} (${v.purity}/100) ${bar(v.purity, 100)}\n✨ Thiên phú **${v.sp.thienphu.n}** (${tf}% hiệu lực): ${PD.fxText(v.sp.thienphu.fx)}\n_${v.sp.thienphu.desc}_${v.gen ? `\n🧬 Truyền thừa đời ${v.gen}/${PB.INHERIT.maxGen}` : ''}`;
}
function detailFields(v) {
  return [
    { name: `${nm(v)} — ${P.tierIcon(v.tier)} ${v.tierInfo.name} · hành ${v.sp.hanh} (${v.sp.role})`, value: `${v.sp.desc}\n**Lv.${v.level}/${v.cap}** ${bar(v.exp, v.expNeed)} ${fmtNum(v.exp)}/${fmtNum(v.expNeed)} EXP\n💞 Thân mật **${v.bond}**/${PB.bondCap(v.contract)} ${bar(v.bond, 100)}\n${v.contractInfo ? `${CONTRACT_ICON[v.contract]} ${v.contractInfo.name} · ${slotName(v.slot)}` : '📜 Chưa ký khế ước (ở Linh Thú Viên)'}`, inline: false },
    { name: '📊 Chỉ số', value: statsText(v).slice(0, 1000), inline: false },
    { name: '🩸 Huyết mạch & Thiên phú', value: bloodText(v).slice(0, 1000), inline: false },
  ];
}
function itemsText(owner) {
  const items = P.itemMap(owner); const keys = PB.ITEM_ORDER.filter((k) => items[k]);
  return keys.length ? keys.map((k) => `${PB.ITEMS[k].name} ×${fmtNum(items[k])}`).join(' · ') : '_Chưa có vật phẩm._';
}
const reqText = (reqs) => reqs.map((x) => `${x.ok ? '✅' : '❌'} ${x.text}`).join('\n');

// ---------------------------------------------------------------- dựng từng mục
function pickPet(owner, petId) {
  const pets = P.listPets(owner);
  let p = pets.find((x) => x.pet_id === Number(petId));
  if (!p) p = pets.find((x) => x.fighter) || pets[0] || null;
  return { pets, pet: p };
}
function navRow(uid, tab, petId) {
  return rowOf(new StringSelectMenuBuilder().setCustomId(cid(uid, 'nav', petId)).setPlaceholder('📂 Chọn mục...')
    .addOptions(TABS.map(([k, name, icon, desc]) => ({ label: name, value: k, emoji: optEmoji(icon), description: desc.slice(0, 100), default: k === tab }))));
}
function petSelRow(uid, tab, pets, cur, arg = '') {
  if (!pets.length) return null;
  return rowOf(new StringSelectMenuBuilder().setCustomId(cid(uid, 'psel', 0, `${tab}${arg ? `:${arg}` : ''}`)).setPlaceholder('🐾 Chọn Linh Thú...')
    .addOptions(pets.slice(0, 25).map((p) => { const v = P.view(p); return { label: `${v.name} · Lv.${v.level}`.slice(0, 100), description: `${v.tierInfo.name} · ${v.sp.hanh}${p.slot ? ` · ${slotName(p.slot)}` : ' · Viên'}${p.fighter ? ' · ⚔️ xuất chiến' : ''}`.slice(0, 100), value: String(p.pet_id), default: !!(cur && p.pet_id === cur.pet_id) }; })));
}

function renderOverview(uid, ctx) {
  const owner = String(uid); const sl = P.slotsOf(owner); const eggs = P.listEggs(owner); const wild = P.getWild(owner);
  const e = new EmbedBuilder().setTitle(`${E.dongthanh} Linh Thú Viên`).setColor(0x2ecc71)
    .setDescription('Nuôi thú — ký khế ước — xuất chiến. Linh Thú **không** cộng thẳng HP/ATK/DEF cho bạn: sức mạnh của thú thể hiện ở **trợ chiến & kỹ năng** trong PvP.');
  const row = Cu.getCultivator(uid);
  const lines = ['bm', 'dh1', 'dh2'].map((k) => { const p = sl[k]; const v = p ? P.view(p, row.realm_index) : null; return `${k === 'bm' ? '🔮' : '🐾'} **${slotName(k)}:** ${v ? petOneLine(v) : '_trống_'}`; });
  e.addFields({ name: '📜 Ô Khế Ước (1 Bản Mệnh + 2 Đồng Hành · mỗi trận chỉ 1 thú xuất chiến)', value: lines.join('\n').slice(0, 1020), inline: false });
  const nVien = P.countVien(owner);
  { const vien = P.listPets(owner).filter((p) => !p.slot).map((p) => petOneLine(P.view(p, row.realm_index))); e.addFields({ name: `🏞️ Linh Thú Viên (${nVien}/${PB.VIEN_CAPACITY})`, value: vien.length ? listFit(vien, 1000, (n) => `… và ${n} con nữa (mục Danh Sách)`) : '_Chưa có thú nào ở Viên._', inline: false }); }
  if (eggs.length) e.addFields({ name: `🥚 Trứng (${eggs.length}/${PB.EGG_CAPACITY})`, value: listFit(eggs.map((g) => `• ${P.tierIcon(g.tier)} Trứng ${PB.tierInfo(g.tier).name} — ${g.hatch_at <= now() ? '**đã nở được!**' : `nở sau ${P.fmtDur(g.hatch_at - now())}`}`), 1000, (n) => `… và ${n} trứng nữa`), inline: false });
  if (wild) { const sp = PD.speciesOf(wild.species); e.addFields({ name: '🌿 Thú hoang đang chờ', value: `${P.emojiOf(sp)} **${sp.name}** (${P.tierIcon(sp.tier)} ${PB.tierInfo(sp.tier).name}) · Lv.${wild.level} — còn ${P.fmtDur(wild.expires_at - now())}. Vào mục **Khế Ước** để thu phục.`, inline: false }); }
  e.addFields({ name: '🎒 Vật phẩm Linh Thú', value: itemsText(owner).slice(0, 1000), inline: false });
  return { embeds: [e], components: [navRow(uid, 'ov', 0), rowOf(btn(cid(uid, 'hatch'), 'Nở Trứng', '🐣', ButtonStyle.Success, !eggs.some((g) => g.hatch_at <= now())), btn(cid(uid, 'shop'), 'Cửa Hàng Linh Thú', E.shop, ButtonStyle.Primary), btn(cid(uid, 'rf', 0, 'ov'), 'Làm Mới', E.lammoi))] };
}

function renderList(uid, petId) {
  const owner = String(uid); const { pets, pet } = pickPet(owner, petId);
  const e = new EmbedBuilder().setTitle(`📋 Danh Sách Linh Thú (${pets.length})`).setColor(pet ? COLORS[PD.speciesOf(pet.species).tier] : 0x95a5a6);
  if (!pet) return { embeds: [e.setDescription('Bạn chưa có Linh Thú nào. Khám phá **Bí Cảnh** để nhặt trứng / gặp thú hoang rồi vào mục **Khế Ước**.')], components: [navRow(uid, 'ls', 0)] };
  const row = Cu.getCultivator(uid);
  e.setDescription(pets.slice(0, 25).map((p) => `${p.pet_id === pet.pet_id ? '▶️' : '▫️'} ${petOneLine(P.view(p, row.realm_index))}`).join('\n').slice(0, 3800));
  e.addFields(...detailFields(P.view(pet, row.realm_index)));
  return { embeds: [e], components: [navRow(uid, 'ls', pet.pet_id), petSelRow(uid, 'ls', pets, pet), rowOf(btn(cid(uid, 'rnm', pet.pet_id), 'Đổi Tên', '✏️'), btn(cid(uid, 'rel', pet.pet_id), 'Thả Về Tự Nhiên', '🍃', ButtonStyle.Danger, !!pet.slot))] };
}

function renderKhe(uid, petId) {
  const owner = String(uid); const { pets, pet } = pickPet(owner, petId); const wild = P.getWild(owner); const eggs = P.listEggs(owner);
  const e = new EmbedBuilder().setTitle('📜 Khế Ước & Thu Phục').setColor(0x9b59b6);
  const comps = [navRow(uid, 'kh', pet ? pet.pet_id : 0)];
  if (wild) {
    const sp = PD.speciesOf(wild.species); const ch = PB.captureChance(sp.tier, P.ownerRealm(owner), 0);
    e.addFields({ name: '🌿 Thú hoang xuất hiện', value: `${P.emojiOf(sp)} **${sp.name}** · ${P.tierIcon(sp.tier)} ${PB.tierInfo(sp.tier).name} · hành ${sp.hanh} · Lv.${wild.level} · huyết mạch ${wild.purity}\nTỉ lệ thu phục: **${Math.round(ch * 100)}%** (Thu Phục Phù +${Math.round(PB.CAPTURE.phuBonus * 100)}%, Linh Thú Lương +${Math.round(PB.CAPTURE.luongBonus * 100)}%) · thất bại có ${Math.round(PB.CAPTURE.flee * 100)}% bỏ chạy · còn ${P.fmtDur(wild.expires_at - now())}`, inline: false });
  } else e.addFields({ name: '🌿 Thú hoang', value: '_Không có. Khám phá Bí Cảnh để gặp thú hoang._', inline: false });
  if (eggs.length) e.addFields({ name: `🥚 Trứng (${eggs.length})`, value: eggs.map((g) => `• ${P.tierIcon(g.tier)} Trứng ${PB.tierInfo(g.tier).name} — ${g.hatch_at <= now() ? '**đã nở được!**' : `nở sau ${P.fmtDur(g.hatch_at - now())}`}`).join('\n').slice(0, 1000), inline: false });
  const has = P.itemMap(owner);
  comps.push(rowOf(btn(cid(uid, 'cap', 0, ''), 'Thu Phục', '🪤', ButtonStyle.Success, !wild), btn(cid(uid, 'cap', 0, 'p'), `Dùng Phù (${has.bat_phu || 0})`, '🔖', ButtonStyle.Success, !wild || !has.bat_phu), btn(cid(uid, 'cap', 0, 'l'), `Dùng Lương (${has.linh_thu_luong || 0})`, '🍖', ButtonStyle.Success, !wild || !has.linh_thu_luong), btn(cid(uid, 'cap', 0, 'pl'), 'Phù + Lương', '✨', ButtonStyle.Primary, !wild || !has.bat_phu || !has.linh_thu_luong)));
  comps.push(rowOf(btn(cid(uid, 'hatch'), 'Nở Trứng Chín', '🐣', ButtonStyle.Success, !eggs.some((g) => g.hatch_at <= now())), btn(cid(uid, 'rush'), `Thúc Ấp (${has.trung_nho || 0})`, '⚡', ButtonStyle.Secondary, !eggs.length || !has.trung_nho)));
  if (pet) {
    const v = P.view(pet); e.addFields({ name: `Linh Thú đang chọn: ${nm(v)} (${v.contractInfo ? `${v.contractInfo.name} · ${slotName(v.slot)}` : 'chưa khế ước'})`, value: v.contractInfo ? 'Giải khế ước để đổi loại khế. Muốn lên **Bản Mệnh Khế**: thú đã có Bình Đẳng/Chủ Tớ Khế, thân mật ≥ 70, có Bản Mệnh Tinh Huyết, ô Bản Mệnh còn trống.' : ['binh_dang', 'chu_to'].map((k) => { const r = P.reqContract(owner, pet, k); return `${CONTRACT_ICON[k]} **${PB.CONTRACTS[k].name}** — ${PB.CONTRACTS[k].desc}\n${reqText(r.reqs)}`; }).join('\n\n').slice(0, 1000) });
    if (v.contract && v.contract !== 'ban_menh') { const r = P.reqContract(owner, pet, 'ban_menh'); e.addFields({ name: `${CONTRACT_ICON.ban_menh} ${PB.CONTRACTS.ban_menh.name}`, value: `${PB.CONTRACTS.ban_menh.desc}\n${reqText(r.reqs)}`.slice(0, 1000) }); }
    const sp = petSelRow(uid, 'kh', pets, pet); if (sp) comps.push(sp);
    comps.push(rowOf(...['binh_dang', 'chu_to', 'ban_menh'].map((k) => btn(cid(uid, 'sign', pet.pet_id, k), PB.CONTRACTS[k].short, CONTRACT_ICON[k], k === 'ban_menh' ? ButtonStyle.Danger : ButtonStyle.Primary, k === 'ban_menh' ? !(pet.contract === 'binh_dang' || pet.contract === 'chu_to') : !!pet.contract)), btn(cid(uid, 'brk', pet.pet_id), 'Giải Khế', '💔', ButtonStyle.Secondary, !pet.slot)));
  } else e.addFields({ name: 'Linh Thú', value: '_Bạn chưa có Linh Thú nào để ký khế ước._' });
  return { embeds: [e], components: comps.slice(0, 5) };
}

function renderNuoi(uid, petId) {
  const owner = String(uid); const { pets, pet } = pickPet(owner, petId);
  const e = new EmbedBuilder().setTitle('🍖 Nuôi Dưỡng').setColor(0x27ae60);
  if (!pet) return { embeds: [e.setDescription('Bạn chưa có Linh Thú nào.')], components: [navRow(uid, 'nd', 0)] };
  const v = P.view(pet); const has = P.itemMap(owner); const row = Cu.getCultivator(uid);
  e.addFields(...detailFields(v).slice(0, 1));
  e.addFields({ name: 'Cấp tối đa', value: `Trần cấp theo cảnh giới của bạn: **Lv.${v.cap}** (${K.REALMS[row.realm_index].name}: 15 + 6/đại cảnh giới${v.contract === 'ban_menh' ? ' + 10 Bản Mệnh' : '; Bản Mệnh Khế +10'}).\nCho ăn → EXP & thân mật · Dạo Chơi (miễn phí, hồi ${P.fmtDur(PB.PLAY.cooldown)}) → EXP & thân mật.`, inline: false });
  e.addFields({ name: '🎒 Thức ăn', value: `Linh Thú Lương ×${has.linh_thu_luong || 0} (+${PB.ITEMS.linh_thu_luong.exp} EXP) · Linh Thú Đan ×${has.linh_thu_dan || 0} (+${fmtNum(PB.ITEMS.linh_thu_dan.exp)}) · Thần Thú Đan ×${has.than_thu_dan || 0} (+${fmtNum(PB.ITEMS.than_thu_dan.exp)}) · Nguyên liệu: ${fmtNum(row.nguyen_lieu || 0)} (${PB.BASIC_FEED.nguyen_lieu} nguyên liệu → +${PB.BASIC_FEED.exp} EXP)`, inline: false });
  const f = (key, n) => ['feed', key, n];
  const mk = (n) => rowOf(btn(cid(uid, 'fd', pet.pet_id, `linh_thu_luong:${n}`), `Lương ×${n}`, '🍖', ButtonStyle.Success, (has.linh_thu_luong || 0) < n), btn(cid(uid, 'fd', pet.pet_id, `linh_thu_dan:${n}`), `Đan ×${n}`, '💊', ButtonStyle.Success, (has.linh_thu_dan || 0) < n), btn(cid(uid, 'fd', pet.pet_id, `than_thu_dan:${n}`), `Thần Đan ×${n}`, '✨', ButtonStyle.Success, (has.than_thu_dan || 0) < n), btn(cid(uid, 'fd', pet.pet_id, `basic:${n}`), `Nguyên Liệu ×${n}`, E.nguyenlieu || '🌿', ButtonStyle.Primary, (row.nguyen_lieu || 0) < PB.BASIC_FEED.nguyen_lieu * n));
  const comps = [navRow(uid, 'nd', pet.pet_id), petSelRow(uid, 'nd', pets, pet), mk(1), mk(10), rowOf(btn(cid(uid, 'play', pet.pet_id), 'Dạo Chơi', '🌿', ButtonStyle.Primary), btn(cid(uid, 'shop'), 'Cửa Hàng', E.shop))];
  return { embeds: [e], components: comps };
}

function renderEvo(uid, petId, sel) {
  const owner = String(uid); const { pets, pet } = pickPet(owner, petId);
  const e = new EmbedBuilder().setTitle('🌟 Tiến Hóa').setColor(0xf1c40f);
  if (!pet) return { embeds: [e.setDescription('Bạn chưa có Linh Thú nào.')], components: [navRow(uid, 'th', 0)] };
  const v = P.view(pet); const opts = P.evoList(owner, pet.pet_id);
  e.setDescription(`${petOneLine(v)}\n\n**Chính Hóa**: cùng dòng hành, lên phẩm kế. **Dị Hóa**: dùng ${PB.HANH.map((h) => `Tinh Hoa ${h}`).join('/')} để nhảy sang dòng hành khác (huyết mạch −15, cần huyết mạch ≥ 60 & thân mật ≥ 60, không áp dụng Chủ Tớ Khế).`);
  if (!opts.length) return { embeds: [e.addFields({ name: 'Đã đạt đỉnh', value: 'Hỗn Độn Thú là phẩm cấp cao nhất — không thể tiến hóa thêm.' })], components: [navRow(uid, 'th', pet.pet_id), petSelRow(uid, 'th', pets, pet)].filter(Boolean) };
  const cur = opts.find((o) => (o.kind === 'main' ? 'main' : o.hanh) === sel) || opts[0]; const curKey = cur.kind === 'main' ? 'main' : cur.hanh;
  e.addFields({ name: 'Các nhánh tiến hóa', value: opts.map((o) => `${o.all ? '🟢' : '🔴'} ${o.kind === 'main' ? '**Chính Hóa**' : `Dị Hóa [${o.hanh}]`} → ${P.emojiOf(o.toSpecies)} ${o.toSpecies.name} _(${o.toSpecies.role})_`).join('\n').slice(0, 1000) });
  e.addFields({ name: `Điều kiện: ${cur.kind === 'main' ? 'Chính Hóa' : `Dị Hóa [${cur.hanh}]`} → ${cur.toSpecies.name}`, value: `${reqText(cur.reqs)}\n_${cur.toSpecies.desc}_\n🗡️ ${cur.toSpecies.skills.a1.n} · 🛡️ ${cur.toSpecies.skills.p1.n} · 🗡️ ${cur.toSpecies.skills.a2.n}`.slice(0, 1000) });
  const select = rowOf(new StringSelectMenuBuilder().setCustomId(cid(uid, 'esel', pet.pet_id)).setPlaceholder('🔀 Chọn nhánh...').addOptions(opts.map((o) => ({ label: `${o.kind === 'main' ? 'Chính Hóa' : `Dị Hóa [${o.hanh}]`} → ${o.toSpecies.name}`.slice(0, 100), value: o.kind === 'main' ? 'main' : o.hanh, description: o.all ? 'Đủ điều kiện' : 'Chưa đủ điều kiện', default: (o.kind === 'main' ? 'main' : o.hanh) === curKey }))));
  return { embeds: [e], components: [navRow(uid, 'th', pet.pet_id), petSelRow(uid, 'th', pets, pet), select, rowOf(btn(cid(uid, 'evo', pet.pet_id, curKey), 'Tiến Hóa', '🌟', ButtonStyle.Success, !cur.all), btn(cid(uid, 'shop'), 'Cửa Hàng', E.shop))] };
}

function renderSkill(uid, petId) {
  const owner = String(uid); const { pets, pet } = pickPet(owner, petId);
  const e = new EmbedBuilder().setTitle('📘 Kỹ Năng').setColor(0x3498db);
  if (!pet) return { embeds: [e.setDescription('Bạn chưa có Linh Thú nào.')], components: [navRow(uid, 'kn', 0)] };
  const v = P.view(pet); const has = P.itemMap(owner);
  e.setDescription(`${petOneLine(v)}\nKỹ năng chủ động phát động theo tỉ lệ mỗi lượt (có hồi chiêu); bị động luôn hiệu lực. Mở khóa: kỹ năng 1 (Lv.${PB.SKILL_UNLOCK.a1}), bị động (Lv.${PB.SKILL_UNLOCK.p1}), kỹ năng 2 (Lv.${PB.SKILL_UNLOCK.a2}). Nâng bậc cần ${PB.ITEMS.ky_nang_gian.name} (có ${has.ky_nang_gian || 0}) + Linh Thạch.`);
  e.addFields({ name: 'Bộ kỹ năng', value: skillsText(v).slice(0, 1000) });
  const ups = v.skills.filter((s) => s.unlocked).map((s) => btn(cid(uid, 'upg', pet.pet_id, s.key), `${s.name} (${s.rank}→${s.rank + 1})`, '📘', ButtonStyle.Primary, s.rank >= PB.SKILL_RANK_MAX || !has.ky_nang_gian));
  if (v.inheritSkill) ups.push(btn(cid(uid, 'upg', pet.pet_id, 'inh'), `${v.inheritSkill.name} (${v.inheritSkill.rank}→${v.inheritSkill.rank + 1})`, '🧬', ButtonStyle.Primary, v.inheritSkill.rank >= PB.SKILL_RANK_MAX || !has.ky_nang_gian));
  const comps = [navRow(uid, 'kn', pet.pet_id), petSelRow(uid, 'kn', pets, pet)];
  if (ups.length) comps.push(rowOf(...ups.slice(0, 4)));
  comps.push(rowOf(btn(cid(uid, 'shop'), 'Mua Ngọc Giản', E.shop)));
  return { embeds: [e], components: comps };
}

function renderBlood(uid, petId, sac) {
  const owner = String(uid); const { pets, pet } = pickPet(owner, petId);
  const e = new EmbedBuilder().setTitle('🩸 Huyết Mạch & Truyền Thừa').setColor(0xc0392b);
  if (!pet) return { embeds: [e.setDescription('Bạn chưa có Linh Thú nào.')], components: [navRow(uid, 'hm', 0)] };
  const v = P.view(pet); const has = P.itemMap(owner);
  e.setDescription(bloodText(v));
  e.addFields({ name: 'Tẩy luyện huyết mạch', value: `Dùng ${PB.ITEMS.huyet_mach_tinh.name} (có ${has.huyet_mach_tinh || 0}) + ${fmtNum(PB.REFINE.cost(v.tier))} Linh Thạch: +${PB.REFINE.gain[0]}~${PB.REFINE.gain[1]} độ thuần (giảm hiệu quả sau ${PB.REFINE.softCap}). Ngưỡng thức tỉnh: ${PB.PURITY_STAGES.slice(1).join(' / ')} → ${PB.STAGE_NAMES.slice(1).join(' / ')}.` });
  const cands = pets.filter((p) => !p.slot && p.pet_id !== pet.pet_id && PD.speciesOf(p.species).tier >= v.tier - PB.INHERIT.minTierGap);
  const comps = [navRow(uid, 'hm', pet.pet_id), petSelRow(uid, 'hm', pets, pet), rowOf(btn(cid(uid, 'ref', pet.pet_id), 'Tẩy Luyện Huyết Mạch', '🩸', ButtonStyle.Danger, v.purity >= 100 || !has.huyet_mach_tinh))];
  let sacPet = sac ? cands.find((p) => p.pet_id === Number(sac)) : null;
  e.addFields({ name: `🧬 Truyền Thừa (đời ${v.gen}/${PB.INHERIT.maxGen}) — hiến tế 1 thú ở Viên`, value: `Thú hiến tế biến mất; thú này nhận **${Math.round(PB.INHERIT.frac * 100)}%** độ thuần của nó và có thể thừa hưởng **1 kỹ năng** (ô Truyền Thừa — thay ô cũ). Phí ${fmtNum(PB.INHERIT.cost(v.tier))} Linh Thạch. Thú hiến tế phải ≥ ${PB.tierInfo(Math.max(1, v.tier - PB.INHERIT.minTierGap)).name}.${cands.length ? '' : '\n_Chưa có thú phù hợp ở Linh Thú Viên._'}` });
  if (cands.length) {
    comps.push(rowOf(new StringSelectMenuBuilder().setCustomId(cid(uid, 'ssel', pet.pet_id)).setPlaceholder('🧬 Chọn thú hiến tế...').addOptions(cands.slice(0, 25).map((p) => { const sv = P.view(p); return { label: `${sv.name} · Lv.${sv.level}`.slice(0, 100), description: `${sv.tierInfo.name} · huyết mạch ${sv.purity}`.slice(0, 100), value: String(p.pet_id), default: !!(sacPet && sacPet.pet_id === p.pet_id) }; }))));
    if (sacPet) {
      const sv = P.view(sacPet); e.addFields({ name: `Hiến tế: ${nm(sv)}`, value: `+${Math.floor(sv.purity * PB.INHERIT.frac)} độ thuần. Chọn kỹ năng muốn truyền (tỉ lệ ~${Math.round(P.inheritChance({ tier: v.tier }, { tier: sv.tier, purity: sv.purity }) * 100)}%):\n${sv.skills.map((s) => `• ${s.name}`).join('\n')}` });
      comps.push(rowOf(...sv.skills.map((s) => btn(cid(uid, 'inh', pet.pet_id, `${sacPet.pet_id}:${s.key}`), s.name, s.kind === 'active' ? '🗡️' : '🛡️', ButtonStyle.Danger)), btn(cid(uid, 'inh', pet.pet_id, `${sacPet.pet_id}:`), 'Chỉ lấy huyết mạch', '🩸', ButtonStyle.Secondary)));
    }
  }
  return { embeds: [e], components: comps.slice(0, 5) };
}

function renderFight(uid) {
  const owner = String(uid); const sl = P.slotsOf(owner); const f = P.getFighter(owner); const row = Cu.getCultivator(uid);
  const e = new EmbedBuilder().setTitle('⚔️ Xuất Chiến').setColor(0xe74c3c)
    .setDescription('Mỗi trận PvP chỉ **1 thú** xuất chiến (trợ chiến + kỹ năng). Thú còn lại trong ô nhận một phần EXP. Thú ở Linh Thú Viên không ra trận.');
  const lines = ['bm', 'dh1', 'dh2'].map((k) => { const p = sl[k]; const v = p ? P.view(p, row.realm_index) : null; return `${k === 'bm' ? '🔮' : '🐾'} **${slotName(k)}:** ${v ? petOneLine(v) : '_trống_'}`; });
  e.addFields({ name: 'Các ô khế ước', value: lines.join('\n').slice(0, 1000) });
  if (f) { const v = P.view(f, row.realm_index); e.addFields({ name: 'Đang xuất chiến', value: `${petOneLine(v)}\n${skillsText(v)}`.slice(0, 1000) }); }
  else e.addFields({ name: 'Đang xuất chiến', value: '_Chưa có thú xuất chiến — ký khế ước rồi chọn thú._' });
  const bs = ['bm', 'dh1', 'dh2'].filter((k) => sl[k]).map((k) => { const v = P.view(sl[k]); return btn(cid(uid, 'fgt', sl[k].pet_id), `${v.name}`.slice(0, 60), CONTRACT_ICON[v.contract] || '🐾', v.fighter ? ButtonStyle.Success : ButtonStyle.Primary, !!v.fighter); });
  const comps = [navRow(uid, 'xc', f ? f.pet_id : 0)];
  if (bs.length) comps.push(rowOf(...bs, btn(cid(uid, 'nofgt'), 'Rút Lui', '🏳️', ButtonStyle.Secondary, !f)));
  return { embeds: [e], components: comps };
}

function renderShop(uid, item) {
  const owner = String(uid); const row = Cu.getCultivator(uid); const has = P.itemMap(owner);
  const e = new EmbedBuilder().setTitle(`${E.shop} Cửa Hàng Linh Thú`).setColor(0xf39c12)
    .setDescription(`Số dư: **${fmtNum(row.linh_thach)}** ${E.linhthach} Linh Thạch\nVật phẩm nhặt thêm từ **Bí Cảnh** (thường · đặc biệt · Linh Giới).`);
  const sel = PB.ITEMS[item] && PB.SHOP_ITEMS.includes(item) ? item : null;
  if (sel) { const it = PB.ITEMS[sel]; e.addFields({ name: `${it.name} — ${fmtNum(it.price)} Linh Thạch`, value: `${it.desc}\nĐang có: **${has[sel] || 0}**${PB.SHOP_DAILY_LIMIT[sel] ? `\nGiới hạn ${PB.SHOP_DAILY_LIMIT[sel]}/ngày` : ''}` }); }
  const comps = [rowOf(new StringSelectMenuBuilder().setCustomId(cid(uid, 'shsel')).setPlaceholder('🛒 Chọn vật phẩm...').addOptions(PB.SHOP_ITEMS.slice(0, 25).map((k) => ({ label: `${PB.ITEMS[k].name} — ${fmtNum(PB.ITEMS[k].price)}`.slice(0, 100), value: k, description: PB.ITEMS[k].desc.slice(0, 100), default: k === sel }))))];
  if (sel) comps.push(rowOf(...[1, 5, 10].map((n) => btn(cid(uid, 'buy', 0, `${sel}:${n}`), `Mua ×${n}`, '🛒', ButtonStyle.Success, row.linh_thach < PB.ITEMS[sel].price * n))));
  comps.push(rowOf(btn(cid(uid, 'nav', 0, 'ov'), 'Về Tổng Quan', '🐾')));
  return { embeds: [e], components: comps };
}
function renderConfirmRelease(uid, petId) {
  const p = P.getPet(String(uid), petId); if (!p) return renderList(uid, 0);
  const v = P.view(p);
  const e = new EmbedBuilder().setTitle('🍃 Xác nhận thả Linh Thú').setColor(0xe67e22).setDescription(`Bạn chắc chắn muốn thả ${nm(v)} (Lv.${v.level})? **Không thể hoàn tác.** Bạn nhận lại một ít vật phẩm & Linh Thạch.`);
  return { embeds: [e], components: [rowOf(btn(cid(uid, 'relok', p.pet_id), 'Xác Nhận Thả', '🍃', ButtonStyle.Danger), btn(cid(uid, 'rf', p.pet_id, 'ls'), 'Hủy', '↩️'))] };
}

function render(uid, tab, petId, arg) {
  P.ensureMigrated(uid); P.hatchReady(uid);
  switch (tab) {
    case 'ls': return renderList(uid, petId);
    case 'kh': return renderKhe(uid, petId);
    case 'nd': return renderNuoi(uid, petId);
    case 'th': return renderEvo(uid, petId, arg);
    case 'kn': return renderSkill(uid, petId);
    case 'hm': return renderBlood(uid, petId, arg);
    case 'xc': return renderFight(uid);
    case 'sh': return renderShop(uid, arg);
    default: return renderOverview(uid);
  }
}
const withNote = (payload, note) => ({ ...payload, content: note ? String(note).slice(0, 1900) : '' });

/** Mở menu từ lệnh/nút (trả lời riêng tư). */
async function open(i, uid, tab = 'ov') {
  const p = render(uid, tab, 0, '');
  return i.reply({ ...p, flags: EPHEMERAL });
}

// ---------------------------------------------------------------- xử lý bấm nút (tĩnh)
registerStatic('lt', async (i, parts) => {
  const [uid, act, petRaw, arg0] = parts; const petId = Number(petRaw) || 0; const arg = arg0 === undefined ? '' : arg0;
  if (String(i.user.id) !== String(uid)) return i.reply({ content: '❌ Đây không phải menu Linh Thú của bạn — hãy gõ `/linhthu` để mở menu riêng.', flags: EPHEMERAL });
  if (!Cu.getCultivator(i.user.id)) return i.update({ content: '❌ Bạn chưa bắt đầu tu tiên.', embeds: [], components: [] });
  const owner = String(uid); P.ensureMigrated(owner);
  const upd = (tab, pid, a, note) => i.update(withNote(render(uid, tab, pid, a), note));
  const sel = (i.values || [])[0];
  switch (act) {
    case 'nav': return upd(sel || arg || 'ov', petId, '');
    case 'rf': return upd(arg || 'ov', petId, '');
    case 'psel': { const [tab, a] = String(arg).split(':'); return upd(tab || 'ls', Number(sel) || 0, a || ''); }
    case 'esel': return upd('th', petId, sel);
    case 'ssel': return upd('hm', petId, sel);
    case 'shsel': return upd('sh', 0, sel);
    case 'shop': return upd('sh', 0, '');
    case 'hatch': { const h = P.hatchReady(owner); const names = h.map((x) => { const sp = PD.speciesOf(x.species); return `${P.emojiOf(sp)} **${sp.name}** (${P.tierIcon(sp.tier)} ${PB.tierInfo(sp.tier).name})`; });
      return upd('kh', h[0] ? h[0].id : petId, '', h.length ? `🐣 Trứng nở ra: ${names.join(', ')}! Thú ở Linh Thú Viên — ký khế ước để đưa vào ô.` : '🥚 Chưa có trứng nào đến giờ nở (hoặc Linh Thú Viên đã đầy).'); }
    case 'rush': { const egg = P.listEggs(owner)[0]; const r = egg ? P.rushEgg(owner, egg.egg_id) : { msg: '❌ Không có trứng.' }; return upd('kh', r.petId || petId, '', r.msg); }
    case 'cap': { const r = P.capture(owner, { phu: arg.includes('p'), luong: arg.includes('l') }); return upd('kh', r.petId || petId, '', r.msg); }
    case 'sign': { const r = P.signContract(owner, petId, arg); return upd('kh', petId, '', r.msg); }
    case 'brk': { const r = P.breakContract(owner, petId); return upd('kh', petId, '', r.msg); }
    case 'fd': { const [food, n] = arg.split(':'); const r = P.feed(owner, petId, food, Number(n) || 1); return upd('nd', petId, '', r.msg); }
    case 'play': { const r = P.play(owner, petId); return upd('nd', petId, '', r.msg); }
    case 'evo': { const [kind, hanh] = arg === 'main' ? ['main', ''] : ['alt', arg]; const r = P.evolve(owner, petId, kind, hanh); return upd('th', petId, '', r.msg); }
    case 'upg': { const r = P.upgradeSkill(owner, petId, arg); return upd('kn', petId, '', r.msg); }
    case 'ref': { const r = P.refineBlood(owner, petId); return upd('hm', petId, '', r.msg); }
    case 'inh': { const [sac, key] = arg.split(':'); const r = P.inheritBlood(owner, petId, Number(sac), key || ''); return upd('hm', petId, '', r.msg); }
    case 'fgt': { const r = P.setFighter(owner, petId); return upd('xc', petId, '', r.msg); }
    case 'nofgt': { const r = P.unsetFighter(owner); return upd('xc', 0, '', r.msg); }
    case 'buy': { const [item, n] = arg.split(':'); const r = P.buyItem(owner, item, Number(n) || 1); return upd('sh', 0, item, r.msg); }
    case 'rel': return i.update(renderConfirmRelease(uid, petId));
    case 'relok': { const r = P.release(owner, petId); return upd('ls', 0, '', r.msg); }
    case 'rnm': {
      const p = P.getPet(owner, petId); if (!p) return upd('ls', 0, '', '❌ Không tìm thấy Linh Thú.');
      return showModal(i, { title: 'Đổi tên Linh Thú', fields: [{ id: 'name', label: `Tên mới (tối đa ${PB.RENAME_MAX} ký tự, bỏ trống = tên gốc)`, required: false, maxLength: PB.RENAME_MAX }],
        onSubmit: async (mi, get) => { const r = P.rename(owner, petId, get('name')); await mi.update(withNote(render(uid, 'ls', petId, ''), r.msg)); } });
    }
    default: return upd('ov', 0, '');
  }
});

module.exports = { open, render, TABS, fit, listFit, EmbedBuilder, optEmoji, btn, rowOf };
