'use strict';
/** Mẫu Nhân vật (spec §3.1) — chia 8 tab, KHÔNG nhồi mọi dữ liệu vào một Embed. */
const K = require('../../game/constants');
const R = require('../../game/realm');
const Cu = require('../../game/cultivator');
const CP = require('../../game/congphap');
const D = require('../../db');
const { getSectName } = require('../../game/sectBase');
const { daoLuTitle } = require('../../game/daolu');
const { createEmbed } = require('../components/baseEmbed');
const { progressBar } = require('../components/progressBar');
const { statField, statLine } = require('../components/statField');
const { section } = require('../components/section');
const { checklist } = require('./breakthrough');
const { E } = require('../emojis');
const { num, exp, pct, safe } = require('../format');
const { COLORS } = require('../theme/colors');

const TABS = [
  ['tongquan', 'Tổng quan', 'thanhvien'], ['thuoctinh', 'Thuộc tính', 'congkich'], ['canhgioi', 'Cảnh giới', 'dotpha'],
  ['trangbi', 'Trang bị', 'phapbao'], ['congphap', 'Công pháp', 'congphap'], ['thanthong', 'Thần thông', 'linhngothiendao'],
  ['thanhtuu', 'Thành tựu', 'cup'], ['hanhtrinh', 'Hành trình', 'bando'],
];
const TAB_KEYS = TABS.map((t) => t[0]);

const nameOf = (u) => safe(u.displayName || u.globalName || u.username, 'Đạo hữu');

function tongquan(user, row) {
  const required = R.tuViRequired(row.realm_index, row.stage_index, row.world_tier);
  const curHp = Cu.syncHpRegen(user.id, row);
  row = Cu.getCultivator(user.id);
  const maxHp = Cu.effectiveMaxHp(row);
  const luc = Cu.calcLucChien(row);
  const moc = Cu.lucChienMocAt(required);
  const world = `${R.worldTierName(row.world_tier)}${row.world_tier ? ` (Phi Thăng lần ${row.world_tier})` : ''}`;
  return createEmbed({
    cat: 'nhanvat', status: 'Online', title: `${row.title ? `「${row.title}」 ` : ''}${nameOf(user)}`,
    description: `${world} · ${row.sect_id ? getSectName(row.sect_id) : 'Tán Tu'}`,
    thumbnail: user.displayAvatarURL ? user.displayAvatarURL() : undefined,
    fields: [
      { name: 'CẢNH GIỚI', value: `**${R.realmDisplay(row.realm_index, row.stage_index)}**`, inline: false },
      { name: `${E.linhngo} Tu vi`, value: `${progressBar(row.tu_vi, required, { kind: 'tuvi' })}\n${exp(row.tu_vi, required)} EXP`, inline: false },
      { name: `${E.hp} Sinh mệnh`, value: `${progressBar(curHp, maxHp, { kind: 'hp' })}\n${exp(curHp, maxHp)}`, inline: false },
      { name: `${E.satthuong} Lực chiến`, value: `${progressBar(luc, moc, { kind: 'lucchien' })}\n**${num(luc)}** (mốc: ${num(moc)})`, inline: false },
      statField('linhthach', 'Linh thạch', row.linh_thach), statField('linhtinh', 'Linh tinh', row.linh_tinh), statField('linhluc', 'Linh lực', pct(row.linh_luc, { ratio: false })),
    ],
  });
}

function thuoctinh(user, row) {
  return createEmbed({
    cat: 'nhanvat', status: 'Thuộc tính', title: nameOf(user), color: COLORS.INFO,
    fields: [
      statField('hp', 'Sinh mệnh', Cu.effectiveMaxHp(row)), statField('congkich', 'Công kích', Cu.effectiveAtk(row)), statField('phongngu', 'Phòng ngự', Cu.effectiveDef(row)),
      statField('thanphap', 'Thân pháp', Cu.effectiveSpd(row)), statField('linhngo', 'Ngộ tính', row.ngo_tinh), statField('khivan', 'Khí vận', row.khi_van),
      statField('linhcan', 'Linh căn', row.linh_can), statField('thechat', 'Thể chất', row.the_chat), statField('satthuong', 'Lực chiến', Cu.calcLucChien(row)),
    ],
  });
}

function canhgioi(user, row) {
  const required = R.tuViRequired(row.realm_index, row.stage_index, row.world_tier);
  const nxt = R.nextStage(row.realm_index, row.stage_index);
  let rate = K.BASE_BREAKTHROUGH_RATE - row.realm_index * 0.005 + row.ngo_tinh * 0.01 + row.khi_van * 0.005;
  rate = Math.max(0.15, Math.min(0.97, rate));
  return createEmbed({
    cat: 'dotpha', status: 'Cảnh giới', title: 'Cảnh Giới Đột Phá',
    fields: [
      { name: 'Cảnh giới hiện tại', value: `**${R.realmDisplay(row.realm_index, row.stage_index)}**`, inline: true },
      { name: 'Cảnh giới tiếp theo', value: nxt ? `**${R.realmDisplay(nxt[0], nxt[1])}**` : '**Đã đạt tối cao**', inline: true },
      { name: 'Tiến độ', value: `${progressBar(row.tu_vi, required, { kind: 'tuvi' })}\n${exp(row.tu_vi, required)} EXP`, inline: false },
      { name: 'Điều kiện đột phá', value: checklist(row), inline: false },
      statField('dotpha', 'Tỉ lệ ước tính', pct(rate), { inline: true }),
    ],
  });
}

function trangbi(user, row) {
  const pb = K.PHAP_BAO_TIER_DEF.find((t) => t.tier === Cu.equippedPhapbaoTier(row));
  const tiers = Cu.equippedCongphapTiers(row);
  const names = Object.fromEntries(CP.getCurrentCongphapList().map((c) => [c.tier, c.name]));
  return createEmbed({
    cat: 'vatpham', status: 'Trang bị', title: nameOf(user),
    fields: [
      section(`Công pháp đang dùng (${tiers.length}/${K.CONGPHAP_MAX_EQUIP_SLOTS})`, tiers.length ? tiers.map((t) => `${E.congphap} Tầng ${t} — ${names[t] || '???'}`) : ['Chưa trang bị'], { }),
      section('Pháp bảo', [pb ? `${E.phapbao} **${pb.name}**` : 'Chưa trang bị']),
      section('Linh thú', [row.linh_thu ? `${E.dongthanh} ${row.linh_thu} (cấp ${num(row.linh_thu_level)})` : 'Chưa có']),
    ],
  });
}

function congphap(user, row) {
  const owned = [...Cu.ownedCongphapTiers(row)].sort((a, b) => a - b);
  const names = Object.fromEntries(CP.getCurrentCongphapList().map((c) => [c.tier, c.name]));
  const lv = Cu.congphapLevelsMap(row);
  const lines = owned.map((t) => `${E.congphap} Tầng ${t} — ${names[t] || '???'}${lv[t] ? ` · Lv ${lv[t]}` : ''}`);
  return createEmbed({
    cat: 'vatpham', status: 'Công pháp sở hữu', title: `${num(owned.length)} công pháp`,
    description: lines.length ? lines.slice(0, 25).join('\n') + (lines.length > 25 ? `\n*…và ${lines.length - 25} công pháp khác*` : '') : 'Chưa sở hữu — mua ở Cửa Hàng.',
  });
}

function thanthong(user, row) {
  const cur = Cu.specialCongphapCurrent(row);
  const tier = Number(row.cong_phap_special_tier || 0);
  const lines = K.CONGPHAP_SPECIAL_CHAIN.map((s, i) => `${i < tier ? E.xacnhan : E.sk_camkhoa} **${s.name}** — 「${s.move}」 (+${Math.trunc(s.bonus * 100)}%)`);
  return createEmbed({
    cat: 'bicanh', status: 'Thần thông', title: cur ? cur.name : 'Chưa lĩnh ngộ', color: COLORS.SPECIAL,
    description: `${lines.join('\n')}\n\n*Công Pháp Đặc Quyền rơi từ Boss Thế Giới / Rương Thần Bí.*`,
  });
}

function thanhtuu(user, row) {
  return createEmbed({
    cat: 'nhiemvu', status: 'Thành tựu', title: nameOf(user),
    fields: [
      statField('thienkiep', 'Thiên kiếp', row.vuot_thienkiep ? 'Đã vượt' : 'Chưa vượt', { raw: true }),
      statField('thiennhan', 'Ngũ suy', row.thiennhanngusuy_passed ? 'Đã vượt' : (row.ngusuy_started ? 'Đang trải qua' : 'Chưa'), { raw: true }),
      statField('phithang', 'Phi thăng', `Lần ${num(row.world_tier)}`, { raw: true }),
      statField('linhngothiendao', 'Lĩnh ngộ thiên đạo', `${num(row.diem_linh_ngo)}%`, { raw: true }),
      statField('daolu', 'Đạo lữ', row.partner_id ? `<@${row.partner_id}> · ${daoLuTitle(parseInt(row.dao_lu_level || 1, 10))}` : 'Chưa kết đạo', { raw: true }),
      statField('vebicanhdacbiet', 'Vé bí cảnh đặc biệt', row.ve_bicanh_dac_biet || 0),
    ],
  });
}

function hanhtrinh(user, row) {
  const id = String(user.id);
  const win = D.get('SELECT COUNT(*) AS n FROM pvp_history WHERE winner_id = ?', id).n;
  const lose = D.get('SELECT COUNT(*) AS n FROM pvp_history WHERE loser_id = ?', id).n;
  let boss = 0;
  try { boss = D.get('SELECT COALESCE(SUM(damage),0) AS n FROM wb7_damage WHERE user_id = ?', id).n; } catch (_) { /* chưa có */ }
  return createEmbed({
    cat: 'nhanvat', status: 'Hành trình', title: nameOf(user),
    fields: [statField('kiem', 'PvP thắng', win), statField('tuchoi', 'PvP thua', lose), statField('bosstg', 'Sát thương lên Boss', boss)],
  });
}

const BUILDERS = { tongquan, thuoctinh, canhgioi, trangbi, congphap, thanthong, thanhtuu, hanhtrinh };
/** Dựng Embed cho một tab. user: Discord User/Member. */
function build(user, row, tab = 'tongquan') {
  return (BUILDERS[tab] || tongquan)(user, row);
}
module.exports = { build, TABS, TAB_KEYS, statLine };
