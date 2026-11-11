'use strict';
/**
 * TÀNG KINH CÁC v16 — một menu duy nhất cho Công Pháp (cũ + 40 quyển mới): Kho · Cửa Hàng (5 nhóm) · Chi tiết · Mua · Nâng cấp · Trang bị · Mảnh bí tịch.
 * Nút/menu "tĩnh": customId = `tk|<chủ menu>|<hành động>|<trạng thái>[|<giá kỳ vọng>]` → sống sót qua khởi động lại, cập nhật tại chỗ.
 * Mỗi menu chọn ≤ 8 mục/trang (Discord cho tối đa 25), mỗi ô embed được cắt theo giới hạn (PV.EmbedBuilder).
 */
const { StringSelectMenuBuilder, ButtonStyle } = require('discord.js');
const PV = require('./petViews');
const K = require('../game/constants');
const R = require('../game/realm');
const Cu = require('../game/cultivator');
const CP = require('../game/congphap');
const C16 = require('../game/congphapV16');
const CPX = require('../game/cpfx');
const D16 = require('../data/congphap_v16');
const { E, toComponentEmoji } = require('../game/emoji');
const { registerStatic, EPHEMERAL } = require('./kit');
const { fmtNum, int } = require('../util');

const { EmbedBuilder, btn, rowOf, optEmoji, listFit } = PV;
const SHOP_PAGE = 5; const OWN_PAGE = 8;
const GROUP_TABS = ['cu', 'nhan', 'linh', 'tien', 'doc'];
const GROUP_META = {
  cu: { label: 'Công Pháp Cổ Điển (cũ)', short: 'Cổ Điển', icon: '📜', key: 'cpg_cu' },
  nhan: { ...D16.GROUPS.nhan, key: 'cpg_nhan' }, linh: { ...D16.GROUPS.linh, key: 'cpg_linh' },
  tien: { ...D16.GROUPS.tien, key: 'cpg_tien' }, doc: { ...D16.GROUPS.doc, key: 'cpg_doc' },
};
const ic = (key, fb) => E[key] || fb;
const gIcon = (g) => ic(GROUP_META[g].key, GROUP_META[g].icon);
const cIcon = (cat) => (D16.CATS[cat] ? ic(`cpc_${cat}`, D16.CATS[cat].icon) : '📜');
const bIcon = (b) => ic(`cpb_${b.tier}`, cIcon(b.cat));
const PHAM_ICON = ['🟫', '🟦', '🟩', '🟨', '🟪', '🟥', '⬜'];
const pIcon = (n) => ic(`cpp_${n + 1}`, PHAM_ICON[n] || '▫️');
const oe = (s) => (s ? optEmoji(s) : undefined);
const COLORS = { cu: 0x95a5a6, nhan: 0x2ecc71, linh: 0x3498db, tien: 0xf1c40f, doc: 0xe74c3c };

// ---------------------------------------------------------------- trạng thái ⇄ customId
const DEF = { m: 'ov', g: 'all', c: 'all', p: 0, t: 0, r: 'ov' };
const enc = (s) => [s.m, s.g, s.c, s.p, s.t, s.r].join('.');
function dec(raw) {
  const [m, g, c, p, t, r] = String(raw || '').split('.');
  return { m: m || DEF.m, g: g || DEF.g, c: c || DEF.c, p: Math.max(0, Number(p) || 0), t: Number(t) || 0, r: r || DEF.r };
}
const cid = (uid, act, st, x) => `tk|${uid}|${act}|${enc(st)}${x ? `|${x}` : ''}`.slice(0, 100);

// ---------------------------------------------------------------- thông tin chuẩn hoá (cũ + mới)
function info(row, tier) {
  const b = C16.book(tier); const lv = (Cu.congphapLevelsMap(row)[tier] || 0); const owned = Cu.ownedCongphapTiers(row).has(tier);
  const equipped = Cu.equippedCongphapTiers(row).includes(tier);
  if (b) {
    const why = C16.unmetReason(row, b);
    return {
      tier, isNew: true, b, name: b.name, desc: b.desc, group: b.group, cat: b.cat, catLabel: D16.CATS[b.cat].label, pham: b.pham, phamName: b.phamName,
      shop: b.shop, price: b.cost, currency: b.currency, req: C16.reqText(b), unmet: why, level: lv, owned, equipped, icon: bIcon(b),
      effects: C16.effectLines(b, lv), pvp: C16.pvpText(b, lv), sources: D16.sourcesOf(b), tag: `Mã ${tier}`,
      skills: C16.skillLines(b), up: owned ? C16.nextUpgrade(row, tier) : null,
    };
  }
  const tdef = CP.tierDef(tier); if (!tdef) return null;
  const list = CP.getCurrentCongphapList().find((x) => x.tier === tier);
  const cur = CP.tierCurrency(tdef, row); const price = CP.tierCost(tdef, row);
  const locked = CP.getLockedSkills(tier);
  const unmetOld = row.realm_index < tdef.require_realm ? `cần đạt **${K.REALMS[tdef.require_realm].name}**` : (row.world_tier < tdef.require_world ? `cần phi thăng đến **${R.worldTierName(tdef.require_world)}**` : null);
  return {
    tier, isNew: false, tdef, name: CP.currentName(tier), desc: list ? list.desc : 'Công pháp cổ điển.', group: 'cu', cat: 'cu', catLabel: 'Toàn diện (cổ điển)', pham: Math.min(3, Math.floor(tier / 3)), phamName: tdef.boss_drop_only ? 'Tối Thượng' : 'Cổ Điển',
    shop: !tdef.boss_drop_only, price, currency: cur, req: `${K.REALMS[tdef.require_realm].name} · ${R.worldTierName(tdef.require_world)}`, unmet: unmetOld, level: lv, owned, equipped, icon: '📜',
    effects: [`+${int(CP.totalBonus(tdef, lv, row) * 100)}% chỉ số/HP/tu vi (đều mọi chỉ số)`], pvp: `buff tự thân +${int(CP.totalPvpBuff(tdef, lv) * 100)}%, debuff đối thủ −${int(CP.totalPvpDebuff(tdef, lv) * 100)}%`,
    sources: tdef.boss_drop_only ? 'Boss Thế Giới (0,5% người kết liễu)' : 'Cửa Hàng · Quay Ngẫu Nhiên · Vạn Linh Cốc / Bí Cảnh Đặc Biệt', tag: `Tầng ${tier}`,
    skills: locked ? locked.map((n) => ({ name: n, flavor: 'Chiêu cổ điển (+15% sát thương)', effect: '' })) : [{ name: '(chiêu thức sẽ được khoá khi bạn trang bị lần đầu)', flavor: '', effect: '' }],
    up: owned ? C16.nextUpgrade(row, tier) : null,
  };
}
const oneLine = (x) => `${x.icon} **${x.name}** ${x.tag ? `· ${x.tag}` : ''}${x.level ? ` · Cấp ${x.level}` : ''}${x.equipped ? ' ✅' : ''}`;

// ---------------------------------------------------------------- danh sách
function shopTiers(row, g, c) {
  if (g === 'cu') return K.CONG_PHAP_TIER_DEF.filter((t) => !t.boss_drop_only).map((t) => t.tier);
  let list = D16.BOOKS.filter((b) => b.group === g && (c === 'all' || b.cat === c)).map((b) => b.tier);
  if (g === 'doc' && (c === 'all')) list = [...list, K.BOSS_CONGPHAP_DROP_TIER];
  return list;
}
function ownTiers(row, g, c) {
  return C16.listOwned(row).filter((o) => {
    const grp = o.isNew ? o.book.group : 'cu';
    return (g === 'all' || g === grp) && (c === 'all' || (c === 'cu' ? !o.isNew : o.cat === c));
  }).map((o) => o.tier);
}
function pageSlice(arr, page, size) {
  const pages = Math.max(1, Math.ceil(arr.length / size)); const p = Math.min(page, pages - 1);
  return { items: arr.slice(p * size, p * size + size), page: p, pages, total: arr.length };
}

// ---------------------------------------------------------------- thành phần chung
function groupSelect(uid, st, act, withAll) {
  const tabs = withAll ? ['all', ...GROUP_TABS] : GROUP_TABS;
  const opts = tabs.map((g) => (g === 'all'
    ? { label: 'Tất cả giới vực', value: 'all', description: 'Hiện mọi công pháp bạn sở hữu', default: st.g === 'all' }
    : { label: GROUP_META[g].label.slice(0, 100), value: g, description: g === 'cu' ? 'Tầng 1–7, 101, 102 (bán), 201 (Boss)' : (g === 'doc' ? 'Không bán thường — xem nguồn thu thập' : `${D16.BOOKS.filter((b) => b.group === g).length} quyển`), emoji: oe(gIcon(g)), default: st.g === g }));
  return rowOf(new StringSelectMenuBuilder().setCustomId(cid(uid, act, st)).setPlaceholder('🌐 Chọn giới vực / nhóm...').addOptions(opts));
}
function catSelect(uid, st, act, withClassic) {
  const cats = D16.CAT_ORDER.filter((c) => {
    if (st.m === 'shop' && st.g !== 'cu') return D16.BOOKS.some((b) => b.group === st.g && b.cat === c);
    return true;
  });
  const opts = [{ label: 'Tất cả loại', value: 'all', default: st.c === 'all' }];
  if (withClassic) opts.push({ label: 'Công pháp cổ điển', value: 'cu', emoji: oe('📜'), default: st.c === 'cu' });
  for (const c of cats) opts.push({ label: D16.CATS[c].label, value: c, emoji: oe(cIcon(c)), default: st.c === c });
  return rowOf(new StringSelectMenuBuilder().setCustomId(cid(uid, act, st)).setPlaceholder('🏷️ Lọc theo loại công pháp...').addOptions(opts.slice(0, 25)));
}
function itemSelect(uid, st, row, tiers, ph) {
  const opts = tiers.map((t) => {
    const x = info(row, t);
    const price = x.shop ? `${fmtNum(x.price)} ${x.currency === 'linh_tinh' ? 'Linh Tinh' : 'Linh Thạch'}` : 'Độc quyền';
    return { label: `${x.name}${x.owned ? ' ✅' : ''}`.slice(0, 100), description: `${x.tag} · ${x.catLabel} · ${x.owned ? `Cấp ${x.level}` : price}`.slice(0, 100), value: String(t), emoji: oe(x.icon) };
  });
  return rowOf(new StringSelectMenuBuilder().setCustomId(cid(uid, 'sel', st)).setPlaceholder(ph).addOptions(opts));
}
function pagerRow(uid, st, pg, extra = []) {
  const b = [btn(cid(uid, 'pg', { ...st, p: Math.max(0, pg.page - 1) }), '◀', null, ButtonStyle.Secondary, pg.page <= 0),
    btn(cid(uid, 'noop', st), `${pg.page + 1}/${pg.pages}`, null, ButtonStyle.Secondary, true),
    btn(cid(uid, 'pg', { ...st, p: pg.page + 1 }), '▶', null, ButtonStyle.Secondary, pg.page >= pg.pages - 1), ...extra];
  return rowOf(...b);
}

// ---------------------------------------------------------------- tổng hiệu quả
function totalsText(row) {
  const agg = CPX.aggregate(row);
  const old = Cu.effectiveCongPhapBonus(row) * 0.4;
  const pc = (v) => `+${Math.round(v * 1000) / 10}%`;
  const lines = [
    `🧘 Tu vi nhận được: **${pc(Cu.cpTuMult(row) - 1)}**`,
    `⚔️ Công ${pc(old + agg.stat.atk)} · 🛡️ Thủ ${pc(old + agg.stat.def)} · ❤️ HP ${pc(old + agg.stat.hp)} · 💨 Tốc ${pc(old + agg.stat.spd)}`,
    `🌀 Đấu pháp: buff tự thân **+${Math.round(Cu.pvpBuffPct(row) * 100)}%**, debuff đối thủ **−${Math.round(Cu.pvpDebuffPct(row) * 100)}%**`,
  ];
  if (agg.boss) lines.push(`👹 Sát thương Boss: ${pc(agg.boss)}`);
  const ex = Object.entries(agg.route).map(([k, v]) => `${D16.FX_LABEL[k]} ${pc(v)}`);
  if (ex.length) lines.push(`✨ ${ex.join(' · ')}`);
  return lines.join('\n');
}
const balText = (row) => `${E.linhthach} ${fmtNum(row.linh_thach)} · ${E.linhtinh} ${fmtNum(row.linh_tinh)}`;

// ---------------------------------------------------------------- màn hình
function renderOverview(uid, st, row) {
  const own = ownTiers(row, st.g, st.c); const pg = pageSlice(own, st.p, OWN_PAGE); st = { ...st, p: pg.page };
  const all = C16.listOwned(row); const eq = Cu.equippedCongphapTiers(row);
  const e = new EmbedBuilder().setTitle(`${ic('tangkinh', '📚')} Tàng Kinh Các — Kho Công Pháp`).setColor(0x8e44ad)
    .setDescription(`Sở hữu **${all.length}** công pháp (cũ ${all.filter((o) => !o.isNew).length} · mới ${all.filter((o) => o.isNew).length}) · Đang trang bị **${eq.length}/${K.CONGPHAP_MAX_EQUIP_SLOTS}**\n${balText(row)}`);
  e.addFields({ name: '🧿 Đang trang bị', value: eq.length ? eq.map((t, i) => { const x = info(row, t); return `${i === 0 ? '🥇' : `${i + 1}.`} ${oneLine(x)}`; }).join('\n') : 'Chưa trang bị. Chọn 1 công pháp bên dưới → **Trang bị**.', inline: false });
  e.addFields({ name: '📈 Tổng hiệu quả đang nhận', value: totalsText(row), inline: false });
  e.addFields({ name: `📖 Danh sách (${pg.total}) — trang ${pg.page + 1}/${pg.pages}`, value: pg.items.length ? listFit(pg.items.map((t) => oneLine(info(row, t))), 1000) : 'Không có công pháp nào khớp bộ lọc.', inline: false });
  e.setFooter({ text: 'Chiêu thức Đấu Pháp lấy từ quyển ở ô 1 (🥇). Chọn quyển → "Đặt ô 1".' });
  const comps = [groupSelect(uid, st, 'gsel', true), catSelect(uid, { ...st, m: 'ov' }, 'csel', true)];
  if (pg.items.length) comps.push(itemSelect(uid, st, row, pg.items, '🔎 Chọn công pháp để xem chi tiết / trang bị / nâng cấp...'));
  comps.push(pagerRow(uid, st, pg, [btn(cid(uid, 'nav', { ...st, m: 'shop', g: 'nhan', c: 'all', p: 0 }), 'Cửa Hàng', ic('shop', '🛒'), ButtonStyle.Success), btn(cid(uid, 'nav', { ...st, m: 'fr' }), 'Mảnh', '🧩', ButtonStyle.Primary)]));
  return { embeds: [e], components: comps };
}
function renderShop(uid, st, row) {
  const g = GROUP_TABS.includes(st.g) ? st.g : 'nhan'; st = { ...st, g };
  const list = shopTiers(row, g, st.c); const pg = pageSlice(list, st.p, SHOP_PAGE); st = { ...st, p: pg.page };
  const e = new EmbedBuilder().setTitle(`${ic('shop', '🛒')} Tàng Kinh Các — Cửa Hàng · ${GROUP_META[g].label}`).setColor(COLORS[g])
    .setDescription(`${balText(row)}\n${g === 'doc' ? '🌟 Nhóm **độc quyền**: KHÔNG bán — xem nguồn thu thập.' : 'Chọn quyển để xem chi tiết rồi **Mua**. Mỗi quyển chỉ mua 1 lần.'}`);
  for (const t of pg.items) {
    const x = info(row, t);
    const price = x.shop ? `${fmtNum(x.price)} ${x.currency === 'linh_tinh' ? `${E.linhtinh} Linh Tinh` : `${E.linhthach} Linh Thạch`}` : '🔒 Độc quyền';
    const status = x.owned ? '✅ Đã sở hữu' : (x.unmet ? `🔒 ${x.unmet.replace(/\*\*/g, '')}` : '🟢 Đủ điều kiện');
    e.addFields({ name: `${x.icon} ${x.name} · ${x.tag}`, value: `${x.pham !== undefined ? pIcon(x.pham) : ''} ${x.phamName} · ${x.catLabel}\n_${x.desc}_\n💰 ${price} · 🎓 ${x.req}\n${x.effects.slice(0, 4).join(' · ')}\n${status}`, inline: false });
  }
  if (!pg.items.length) e.addFields({ name: 'Trống', value: 'Không có công pháp nào khớp bộ lọc.', inline: false });
  e.setFooter({ text: `Trang ${pg.page + 1}/${pg.pages} · ${pg.total} công pháp` });
  const comps = [groupSelect(uid, st, 'gsel', false), catSelect(uid, st, 'csel', false)];
  if (pg.items.length) comps.push(itemSelect(uid, { ...st, r: 'shop' }, row, pg.items, '🔎 Chọn công pháp để xem chi tiết / mua...'));
  comps.push(pagerRow(uid, st, pg, [btn(cid(uid, 'nav', { ...st, m: 'ov', g: 'all', c: 'all', p: 0 }), 'Kho', ic('khodo', '🎒'), ButtonStyle.Primary), btn(cid(uid, 'nav', { ...st, m: 'fr' }), 'Mảnh', '🧩', ButtonStyle.Secondary)]));
  return { embeds: [e], components: comps };
}
function renderDetail(uid, st, row, note) {
  const x = info(row, st.t);
  if (!x) return renderOverview(uid, { ...st, m: 'ov' }, row);
  const e = new EmbedBuilder().setTitle(`${x.icon} ${x.name}`).setColor(COLORS[x.group] || 0x8e44ad)
    .setDescription(`${note ? `${note}\n\n` : ''}_${x.desc}_`);
  e.addFields(
    { name: 'Thông tin', value: `${x.tag} · ${pIcon(x.pham)} **${x.phamName}** · ${x.catLabel}\n🎓 Yêu cầu: ${x.req}${x.unmet && !x.owned ? ` — 🔒 ${x.unmet}` : ''}\n💰 Giá: ${x.shop ? `**${fmtNum(x.price)}** ${x.currency === 'linh_tinh' ? `${E.linhtinh} Linh Tinh` : `${E.linhthach} Linh Thạch`}` : '🔒 Độc quyền (không bán)'}\n📌 Trạng thái: ${x.owned ? `✅ Đã sở hữu · **Cấp ${x.level}/${K.CONGPHAP_MAX_UPGRADE_LEVEL}**${x.equipped ? ' · 🧿 Đang trang bị' : ''}` : '❌ Chưa sở hữu'}`, inline: false },
    { name: `📈 Hiệu quả${x.owned ? ` (Cấp ${x.level})` : ' (Cấp 0)'}`, value: `${x.effects.join('\n')}\n🌀 Đấu pháp: ${x.pvp}`, inline: false },
    { name: '⚔️ Bốn chiêu thức Đấu Pháp', value: x.skills.map((s, i) => `**${i + 1}. ${s.name}**${s.flavor ? ` — ${s.flavor}` : ''}${s.effect ? `\n　↳ ${s.effect}` : ''}`).join('\n'), inline: false },
    { name: '🧭 Nguồn thu thập', value: x.sources, inline: false },
  );
  if (!x.isNew && !x.owned) e.setFooter({ text: 'Công pháp cổ điển: mọi chỉ số cộng đều nhau; chiêu thức chỉ +15% sát thương.' });
  if (x.isNew) {
    const lvNext = x.level + 1; const b = x.b;
    if (x.owned && x.level < D16.MAX_LEVEL) e.setFooter({ text: `Nâng lên Cấp ${lvNext}: ${C16.effectLines(b, lvNext).slice(0, 3).join(' · ')} — hiệu quả tối đa ×${(1 + D16.LEVEL_FX_GROWTH * D16.MAX_LEVEL).toFixed(1)} ở Cấp ${D16.MAX_LEVEL}` });
  }
  const back = st.r === 'shop' ? 'shop' : 'ov';
  const row1 = []; const stBack = { ...st, m: back };
  if (x.owned) {
    row1.push(btn(cid(uid, 'eq', st), x.equipped ? 'Tháo' : 'Trang bị', null, x.equipped ? ButtonStyle.Secondary : ButtonStyle.Success, false));
    if (x.equipped) row1.push(btn(cid(uid, 'pr', st), 'Đặt ô 1', '🥇', ButtonStyle.Secondary, Cu.equippedCongphapTiers(row)[0] === x.tier));
    const u = x.up;
    row1.push(btn(cid(uid, 'up', st, u ? `${u[0]}:${u[1]}` : ''), u ? `Nâng cấp (${fmtNum(u[0])} ${u[1] === 'linh_tinh' ? 'LT' : 'LThạch'})`.slice(0, 80) : 'Cấp tối đa', '🔺', ButtonStyle.Primary, !u));
  } else if (x.shop) {
    row1.push(btn(cid(uid, 'buy', st), `Mua (${fmtNum(x.price)} ${x.currency === 'linh_tinh' ? 'LT' : 'LThạch'})`.slice(0, 80), ic('shop', '🛒'), ButtonStyle.Success, !!x.unmet));
  } else if (x.isNew) {
    const f = D16.FRAGMENTS.find((q) => q.book === x.tier);
    if (f) row1.push(btn(cid(uid, 'nav', { ...st, m: 'fr', t: D16.FRAGMENTS.indexOf(f) + 1 }), `Mảnh bí tịch (${C16.fragCount(uid, f.id)}/${f.need})`.slice(0, 80), '🧩', ButtonStyle.Primary));
  }
  row1.push(btn(cid(uid, 'nav', stBack), 'Quay lại', '↩️', ButtonStyle.Secondary));
  return { embeds: [e], components: [rowOf(...row1)] };
}
function renderConfirm(uid, st, row) {
  const x = info(row, st.t); if (!x) return renderShop(uid, { ...st, m: 'shop' }, row);
  const cur = x.currency === 'linh_tinh' ? `${E.linhtinh} Linh Tinh` : `${E.linhthach} Linh Thạch`;
  const e = new EmbedBuilder().setTitle(`${ic('shop', '🛒')} Xác nhận mua`).setColor(0xf39c12)
    .setDescription(`Bạn sắp mua **${x.name}** (${x.tag}).\n💰 Giá: **${fmtNum(x.price)}** ${cur}\n👛 Hiện có: **${fmtNum(row[x.currency])}** ${cur}\n\n⚠️ Giá được kiểm tra lại lúc xác nhận; nếu đã đổi, giao dịch sẽ bị huỷ mà chưa trừ gì.`);
  return { embeds: [e], components: [rowOf(btn(cid(uid, 'ok', st, `${x.price}:${x.currency}`), 'Xác nhận mua', ic('xacnhan', '✅'), ButtonStyle.Success, row[x.currency] < x.price), btn(cid(uid, 'nav', { ...st, m: 'dt' }), 'Huỷ', ic('tuchoi', '✖️'), ButtonStyle.Secondary))] };
}
function renderFragments(uid, st, row, note) {
  const counts = C16.allFragCounts(uid); const own = Cu.ownedCongphapTiers(row);
  const e = new EmbedBuilder().setTitle(`🧩 Tàng Kinh Các — Mảnh Bí Tịch`).setColor(0x1abc9c)
    .setDescription(`${note ? `${note}\n\n` : ''}Thu thập đủ mảnh để **hợp thành** công pháp độc quyền (mỗi loại mảnh chỉ rơi khi bạn chưa sở hữu quyển đó).`);
  const lines = D16.FRAGMENTS.map((f, i) => `${i + 1}. ${C16.fragLine(f, counts[f.id] || 0)}${own.has(f.book) ? ' ✅ đã sở hữu' : ''}\n　→ **${C16.nameOf(f.book)}** · ${D16.SOURCE_TEXT[f.book]}`);
  e.addFields({ name: 'Danh sách mảnh', value: listFit(lines, 1000), inline: false });
  const sel = Math.max(0, Math.min(D16.FRAGMENTS.length, st.t));
  const opts = D16.FRAGMENTS.map((f, i) => ({ label: f.name.slice(0, 100), description: `${counts[f.id] || 0}/${f.need} · hợp thành ${C16.nameOf(f.book)}`.slice(0, 100), value: String(i + 1), emoji: oe(ic(`cpm_${f.id}`, f.icon)), default: sel === i + 1 }));
  const f = sel ? D16.FRAGMENTS[sel - 1] : null;
  const can = !!f && (counts[f.id] || 0) >= f.need && !own.has(f.book);
  return { embeds: [e], components: [
    rowOf(new StringSelectMenuBuilder().setCustomId(cid(uid, 'fsel', st)).setPlaceholder('🧩 Chọn loại mảnh...').addOptions(opts)),
    rowOf(btn(cid(uid, 'mg', st), f ? `Hợp thành (${counts[f.id] || 0}/${f.need})`.slice(0, 80) : 'Hợp thành', '🧩', ButtonStyle.Success, !can),
      btn(cid(uid, 'nav', { ...st, m: 'ov', g: 'all', c: 'all', p: 0 }), 'Kho', ic('khodo', '🎒'), ButtonStyle.Primary), btn(cid(uid, 'nav', { ...st, m: 'shop', g: 'doc', c: 'all', p: 0 }), 'Cửa Hàng', ic('shop', '🛒'), ButtonStyle.Secondary))] };
}

function render(userId, st = DEF, note = '') {
  const uid = String(userId); const row = Cu.getCultivator(uid);
  if (!row) return { content: '❌ Bạn chưa bắt đầu tu tiên, dùng `/batdau` trước.', embeds: [], components: [] };
  st = { ...DEF, ...st };
  let out;
  if (st.m === 'shop') out = renderShop(uid, st, row);
  else if (st.m === 'dt') out = renderDetail(uid, st, row, note);
  else if (st.m === 'cf') out = renderConfirm(uid, st, row);
  else if (st.m === 'fr') out = renderFragments(uid, st, row, note);
  else out = renderOverview(uid, st, row);
  if (note && st.m !== 'dt' && st.m !== 'fr') out.content = String(note).slice(0, 1900);
  else out.content = '';
  return out;
}
const open = (i, userId, st = DEF) => i.reply({ ...render(userId, st), flags: EPHEMERAL });

// ---------------------------------------------------------------- xử lý bấm (tĩnh)
registerStatic('tk', async (i, parts) => {
  const [uid, act, raw, x] = parts; const st = dec(raw);
  if (String(i.user.id) !== String(uid)) return i.reply({ content: '❌ Đây không phải menu Công Pháp của bạn — hãy mở **Công Pháp** ở Kho Đồ / Tu Hành.', flags: EPHEMERAL });
  if (!Cu.getCultivator(uid)) return i.update({ content: '❌ Bạn chưa bắt đầu tu tiên.', embeds: [], components: [] });
  const sel = (i.values || [])[0];
  const upd = (s, note) => i.update(render(uid, s, note));
  switch (act) {
    case 'noop': return i.deferUpdate();
    case 'nav': return upd({ ...st, p: st.m === 'dt' || st.m === 'cf' ? st.p : st.p });
    case 'pg': return upd(st);
    case 'gsel': return upd({ ...st, g: sel, c: 'all', p: 0 });
    case 'csel': return upd({ ...st, c: sel, p: 0 });
    case 'sel': return upd({ ...st, m: 'dt', t: Number(sel) || 0, r: st.m === 'shop' ? 'shop' : 'ov' });
    case 'fsel': return upd({ ...st, t: Number(sel) || 0 });
    case 'eq': { const r = C16.toggleEquip(uid, st.t); return upd({ ...st, m: 'dt' }, r.msg); }
    case 'pr': { const r = C16.makePrimary(uid, st.t); return upd({ ...st, m: 'dt' }, r.msg); }
    case 'up': { const [c, cur] = String(x || '').split(':'); const msg = C16.upgradeAny(uid, st.t, c ? [Number(c), cur] : null); return upd({ ...st, m: 'dt' }, msg); }
    case 'buy': return upd({ ...st, m: 'cf' });
    case 'ok': {
      const [c, cur] = String(x || '').split(':'); const exp = [Number(c), cur];
      const msg = C16.isNew(st.t) ? C16.buy(uid, st.t, exp) : CP.buyCongPhap(uid, st.t, exp);
      return upd({ ...st, m: 'dt' }, msg);
    }
    case 'mg': { const f = D16.FRAGMENTS[st.t - 1]; const msg = f ? C16.mergeFrag(uid, f.id) : '❌ Hãy chọn loại mảnh trước.'; return upd({ ...st, m: 'fr' }, msg); }
    default: return i.deferUpdate();
  }
});

module.exports = { render, open, DEF, info, shopTiers, ownTiers, totalsText, enc, dec };
