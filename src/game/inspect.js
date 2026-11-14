'use strict';
/**
 * v16.7 — Tra cứu hồ sơ người chơi cho ADMIN (`/xemnguoichoi`): tổng quan, bảng chỉ số kèm TỪNG NGUỒN cộng,
 * tài nguyên, công pháp, căn cốt, xã hội/hoạt động, thời gian + file đầy đủ mọi cột trong DB.
 * Chỉ ĐỌC — không ghi gì vào DB (không gọi syncHpRegen).
 */
const K = require('./constants');
const R = require('./realm');
const Cu = require('./cultivator');
const T = require('./talent');
const CP = require('./congphap');
const CPX = require('./cpfx');
const C16 = require('./congphapV16');
const D16 = require('../data/congphap_v16');
const D = require('../db');
const { getSectName } = require('./sectBase');
const { fmtNum } = require('../util');

const TABS = [
  ['tq', 'Tổng quan', '📋'], ['cs', 'Chỉ số & nguồn cộng', '📊'], ['tn', 'Tài nguyên & vật phẩm', '💰'],
  ['cp', 'Công pháp', '📜'], ['cc', 'Linh căn & Thể chất', '🧬'], ['xh', 'Xã hội & hoạt động', '🏯'], ['tg', 'Thời gian / cooldown', '⏱️'], ['ng', 'Nghề nghiệp, trang bị & hiệu ứng (V17)', '⚒️'],
];
const RES = {
  linh_thach: 'Linh Thạch', linh_tinh: 'Linh Tinh', linh_luc: 'Linh Lực', linh_gioi_lenh: 'Linh Giới Lệnh', linh_phu: 'Linh Phù', tien_lenh: 'Tiên Lệnh', tien_phu: 'Tiên Phù',
  nguyen_lieu: 'Nguyên Liệu', dan_duoc: 'Đan Dược', hu_khong_tinh_hoa: 'Hư Không Tinh Hoa', hu_khong_ket_tinh: 'Hư Không Kết Tinh', huyen_thiet: 'Huyền Thiết',
  manh_phap_bao: 'Mảnh Pháp Bảo', tien_kim: 'Tiên Kim', tien_ngoc: 'Tiên Ngọc', thien_hoa_tinh: 'Thiên Hỏa Tinh', thien_dao_thach: 'Thiên Đạo Thạch',
  manh_tien_gioi_lenh: 'Mảnh Tiên Giới Lệnh', manh_ghep_phithang: 'Mảnh ghép Phi Thăng', diem_linh_ngo: 'Điểm Linh Ngộ', dao_nguyen_tinh: 'Đạo Nguyên Tinh',
  thien_dao_an: 'Thiên Đạo Ấn', thien_kiep_chi_luc: 'Thiên Kiếp Chi Lực', ruong_than_bi: 'Rương Thần Bí', dan_taytuy_trongsinh: 'Đan Tẩy Tủy Trọng Sinh',
  dan_taytuy_nuaban: 'Đan Tẩy Tủy Nửa Tác Dụng', dan_pha_gioi: 'Đan Phá Giới', linh_duoc_dac_biet: 'Linh Dược Đặc Biệt', ve_bicanh_dac_biet: 'Vé Bí Cảnh Đặc Biệt',
};
const n0 = (v) => Number(v || 0);
const pc = (v, d = 1) => `${(Number(v || 0) * 100).toFixed(d).replace(/\.0+$/, '')}%`;
const safe = (fn, dflt = '—') => { try { const r = fn(); return r === undefined || r === null ? dflt : r; } catch (e) { return `(lỗi: ${e.message})`; } };
const ts = (v) => (n0(v) > 1e9 ? `<t:${Math.trunc(n0(v))}:f> (<t:${Math.trunc(n0(v))}:R>)` : '—');
/** Ghép các dòng thành 1 chuỗi ≤ max ký tự (cắt dòng thừa, ghi "… +N dòng"). */
function fit(lines, max = 1000) {
  let out = ''; let i = 0;
  for (; i < lines.length; i += 1) { const nx = out ? `${out}\n${lines[i]}` : lines[i]; if (nx.length > max - 24) break; out = nx; }
  return i < lines.length ? `${out}\n… +${lines.length - i} dòng (xem file đầy đủ)` : (out || '—');
}
const nameOfTier = (t) => (C16.isNew(t) ? C16.nameOf(t) : `[Tầng ${t}] ${safe(() => CP.currentName(t), '?')}`);

// ---------------------------------------------------------------- dữ liệu từng tab (trả { title, description?, fields:[{name,value,inline}] })
function tabTongQuan(row) {
  const req = R.tuViRequired(row.realm_index, row.stage_index, row.world_tier);
  const maxHp = Cu.effectiveMaxHp(row); const curHp = row.cur_hp === null || row.cur_hp === undefined ? maxHp : row.cur_hp;
  const eq = Cu.equippedCongphapTiers(row).map(nameOfTier);
  return {
    title: '📋 Tổng quan', description: `<@${row.user_id}> · ID \`${row.user_id}\`${row.title ? ` · 「${row.title}」` : ''}`,
    fields: [
      { name: 'Cảnh giới', value: `**${R.realmDisplay(row.realm_index, row.stage_index, true)}** · ${R.worldTierName(row.world_tier)}${row.world_tier ? ` (Phi Thăng lần ${row.world_tier})` : ''}\n(realm_index ${row.realm_index} · stage_index ${row.stage_index} · world_tier ${row.world_tier})`, inline: false },
      { name: 'Tu vi', value: `${fmtNum(row.tu_vi)} / ${fmtNum(req)} (${req ? ((n0(row.tu_vi) / req) * 100).toFixed(1) : 0}%)`, inline: true },
      { name: 'Sinh mệnh', value: `${fmtNum(curHp)} / ${fmtNum(maxHp)}`, inline: true },
      { name: 'Lực chiến', value: `**${fmtNum(Cu.calcLucChien(row))}**`, inline: true },
      { name: 'Căn cốt', value: `Linh căn: **${row.linh_can || '—'}**\nThể chất: **${row.the_chat || '—'}**\nNgộ tính ${n0(row.ngo_tinh)} · Khí vận ${n0(row.khi_van)}`, inline: true },
      { name: 'Tài sản chính', value: `Linh Thạch **${fmtNum(row.linh_thach)}**\nLinh Tinh **${fmtNum(row.linh_tinh)}**\nĐan Dược ${fmtNum(row.dan_duoc)} · Rương ${fmtNum(row.ruong_than_bi)}`, inline: true },
      { name: 'Công pháp đang trang bị', value: eq.length ? eq.join('\n') : '(không)', inline: false },
      { name: 'Tông môn / Đạo lữ', value: `${row.sect_id ? getSectName(row.sect_id) : 'Tán Tu'}${row.sect_role ? ` (${row.sect_role})` : ''}\nĐạo lữ: ${row.partner_id ? `<@${row.partner_id}> (cấp ${row.dao_lu_level}, thân mật ${fmtNum(row.dao_lu_intimacy)})` : 'chưa có'}`, inline: true },
      { name: 'Cờ tài khoản', value: `Khoá nhập code: ${row.code_locked ? '**CÓ**' : 'không'}\nĐã đổi ${String(row.redeemed_codes || '').split(',').filter(Boolean).length} mã\nPvP ${n0(row.pvp_wins)}W / ${n0(row.pvp_losses)}L`, inline: true },
    ],
  };
}

function statBreakdown(row, stat) {
  const col = { atk: 'atk', def: 'def', spd: 'spd', hp: 'hp' }[stat] === 'def' ? 'def_' : stat;
  const base = n0(row[col]);
  const oldCp = Cu.effectiveCongPhapBonus(row) * 0.4; const pb = Cu.effectivePhapBaoBonus(row) * 0.4; const sp = Cu.specialCongphapBonus(row) * 0.4; const nw = CPX.statBonus(row, stat);
  const tal = stat === 'spd' ? 1 : safe(() => T.statMult(row, stat), 1);
  const flat = n0(row[`ruong_bonus_${stat}`]);
  const eff = { atk: Cu.effectiveAtk, def: Cu.effectiveDef, spd: Cu.effectiveSpd, hp: Cu.effectiveMaxHp }[stat](row);
  return `**${fmtNum(eff)}** ← gốc ${fmtNum(base)} × (1 + cổ điển ${pc(oldCp)} + pháp bảo ${pc(pb)} + đặc biệt ${pc(sp)} + công pháp mới ${pc(nw)} + trang bị/trận/đan V17 ${pc(safe(() => require('./fx17').stat(row, stat), 0))}) × thể/linh căn ${tal.toFixed(3)} (×ngũ suy)${flat ? ` + rương ${fmtNum(flat)}` : ''}`;
}
function tabChiSo(row) {
  const agg = CPX.aggregate(row); const bun = safe(() => T.bundle(row), {});
  const bl = Object.entries(bun).filter(([k, v]) => typeof v === 'number' && v && T.LABEL[k]).map(([k, v]) => `${T.LABEL[k]}: **${pc(v)}**`);
  return {
    title: '📊 Chỉ số & nguồn cộng', description: 'Công thức: gốc × (1 + Σ nguồn) × hệ số Thể Chất/Linh Căn + cộng phẳng từ Rương.',
    fields: [
      { name: `⚔️ Công kích`, value: statBreakdown(row, 'atk'), inline: false }, { name: '🛡️ Phòng ngự', value: statBreakdown(row, 'def'), inline: false },
      { name: '💨 Thân pháp', value: statBreakdown(row, 'spd'), inline: false }, { name: '❤️ Sinh mệnh tối đa', value: statBreakdown(row, 'hp'), inline: false },
      { name: 'Công pháp MỚI đang trang bị (V16)', value: agg.n ? [`Số quyển: ${agg.n}`, `Chỉ số: Công ${pc(agg.stat.atk)} · Thủ ${pc(agg.stat.def)} · HP ${pc(agg.stat.hp)} · Tốc ${pc(agg.stat.spd)}`, `Tu vi nhận ×${(1 + agg.tu).toFixed(2)} (+${pc(agg.tu)}) · Lực chiến +${pc(agg.luc)} · Boss +${pc(agg.boss)}`, `Buff Đấu Pháp +${pc(row.cong_phap_pvp_buff)} · Debuff −${pc(row.cong_phap_pvp_debuff)}`, `Hiệu ứng khác: ${Object.entries(agg.route).map(([k, v]) => `${D16.FX_LABEL[k] || k} ${pc(v)}`).join(' · ') || '—'}`].join('\n') : '(không trang bị quyển mới)', inline: false },
      { name: 'Tu vi nhận được từ công pháp', value: `×${safe(() => Cu.cpTuMult(row), 1).toFixed(2)} (cổ điển + mới)`, inline: true },
      { name: 'Công pháp cổ điển (cong_phap_bonus)', value: `${pc(row.cong_phap_bonus)} → hiệu lực ${pc(Cu.effectiveCongPhapBonus(row))}`, inline: true },
      { name: 'Hiệu ứng Thể Chất + Linh Căn + Công Pháp (gộp, đã chặn trần)', value: fit(bl, 1000), inline: false },
    ],
  };
}

function tabTaiNguyen(row) {
  const lines = Object.entries(RES).map(([k, lb]) => `${lb}: **${fmtNum(row[k])}**`);
  const half = Math.ceil(lines.length / 2);
  return {
    title: '💰 Tài nguyên & vật phẩm', description: `Đã đổi code: ${String(row.redeemed_codes || '').split(',').filter(Boolean).join(', ') || '(chưa mã nào)'}`,
    fields: [
      { name: 'Tiền tệ & vật phẩm (1)', value: fit(lines.slice(0, half)), inline: true }, { name: 'Tiền tệ & vật phẩm (2)', value: fit(lines.slice(half)), inline: true },
      { name: 'Rương Thần Bí (cộng thêm)', value: `Sao ${n0(row.ruong_star_count)} · HP +${fmtNum(row.ruong_bonus_hp)} · Công +${fmtNum(row.ruong_bonus_atk)} · Thủ +${fmtNum(row.ruong_bonus_def)} · Tốc +${fmtNum(row.ruong_bonus_spd)} · Lực chiến +${fmtNum(row.ruong_bonus_lucchien)}`, inline: false },
      { name: 'Pháp bảo', value: `Sở hữu: ${row.phap_bao_owned || '—'} · Đang dùng: Tầng ${n0(row.phap_bao_equipped) || '—'} · bonus ${pc(row.phap_bao_bonus)}`, inline: false },
    ],
  };
}

function tabCongPhap(row) {
  const own = [...Cu.ownedCongphapTiers(row)].sort((a, b) => a - b); const lv = Cu.congphapLevelsMap(row); const eq = Cu.equippedCongphapTiers(row);
  const lines = own.map((t) => `${eq.includes(t) ? `✅ ô ${eq.indexOf(t) + 1}` : '▫️'} ${nameOfTier(t)} — Cấp ${Math.min(100, lv[t] || 0)}`);
  const fr = safe(() => C16.allFragCounts(row.user_id), {});
  const frl = D16.FRAGMENTS.map((f) => `${f.name}: ${fr[f.id] || 0}/${f.need}`);
  const newOwned = own.filter((t) => C16.isNew(t)).length;
  return {
    title: '📜 Công pháp', description: `Sở hữu **${own.length}** quyển (${newOwned} quyển V16, ${own.length - newOwned} cổ điển) · đang trang bị **${eq.length}/3**\nSlots: \`${row.cong_phap_slots || ''}\` · Levels: \`${String(row.cong_phap_levels || '').slice(0, 200)}\``,
    fields: [
      { name: 'Danh sách', value: fit(lines, 1000), inline: false },
      { name: 'Mảnh bí tịch', value: fit(frl), inline: false },
      { name: 'Công pháp đặc biệt', value: row.cong_phap_special_tier ? `Tầng ${row.cong_phap_special_tier} (${safe(() => nameOfTier(row.cong_phap_special_tier))})` : '(không)', inline: true },
    ],
  };
}

function tabCanCot(row) {
  const lc = T.LC_COLS.map((c) => `${c}: ${row[c] ?? '—'}`); const tc = T.TC_COLS.map((c) => `${c}: ${row[c] ?? '—'}`);
  const bun = safe(() => T.bundle(row), {});
  return {
    title: '🧬 Linh căn & Thể chất', description: `Linh căn **${row.linh_can || '—'}** · Thể chất **${row.the_chat || '—'}**`,
    fields: [
      { name: 'Hồ sơ Linh Căn (cột DB)', value: fit(lc), inline: true }, { name: 'Hồ sơ Thể Chất (cột DB)', value: fit(tc), inline: true },
      { name: 'Hệ số chỉ số (statMult)', value: `Công ×${safe(() => T.statMult(row, 'atk'), 1).toFixed(3)} · Thủ ×${safe(() => T.statMult(row, 'def'), 1).toFixed(3)} · HP ×${safe(() => T.statMult(row, 'hp'), 1).toFixed(3)}`, inline: false },
      { name: 'Bundle hiệu ứng (đã gộp & chặn trần)', value: fit(Object.entries(bun).filter(([k, v]) => typeof v === 'number' && v).map(([k, v]) => `${T.LABEL[k] || k}: ${typeof v === 'number' ? v.toFixed(4) : v}`), 1000), inline: false },
    ],
  };
}

function tabXaHoi(row) {
  const q = (sql, ...a) => safe(() => D.get(sql, ...a), null);
  const pets = safe(() => D.all('SELECT species, nick, level, fighter FROM pets WHERE owner = ? ORDER BY level DESC LIMIT 12', String(row.user_id)), []);
  const petN = safe(() => D.get('SELECT COUNT(*) AS c FROM pets WHERE owner = ?', String(row.user_id)), null);
  const bossDmg = q('SELECT SUM(damage) AS s FROM world_boss_damage WHERE user_id = ?', row.user_id);
  const pvp = safe(() => D.all('SELECT battle_id, winner_id, loser_id, stake, rounds, ended_at FROM pvp_history WHERE winner_id = ? OR loser_id = ? ORDER BY battle_id DESC LIMIT 5', row.user_id, row.user_id), []);
  const pvpLines = Array.isArray(pvp) ? pvp.map((r) => `${String(r.winner_id) === String(row.user_id) ? '🏆 thắng' : '💀 thua'} đối thủ <@${String(r.winner_id) === String(row.user_id) ? r.loser_id : r.winner_id}> · cược ${fmtNum(r.stake)} · ${r.rounds} hiệp · <t:${Math.trunc(n0(r.ended_at))}:R>`) : [];
  const petLines = Array.isArray(pets) ? pets.map((p) => `${p.fighter ? '⚔️' : '▫️'} ${p.nick || p.species} (${p.species}) Lv${p.level}`) : [];
  return {
    title: '🏯 Xã hội & hoạt động',
    fields: [
      { name: 'Tông môn', value: `${row.sect_id ? getSectName(row.sect_id) : 'Tán Tu'} · vai trò ${row.sect_role || 'detu'} · cống hiến ${fmtNum(row.sect_contribution)}`, inline: false },
      { name: 'Đạo lữ & động phủ', value: `Đạo lữ ${row.partner_id ? `<@${row.partner_id}>` : '—'} · Động phủ cấp ${n0(row.dongphu_level)} "${row.dongphu_ten || '—'}"`, inline: false },
      { name: 'Linh thú', value: `Tổng ${petN && petN.c !== undefined ? petN.c : '—'} con${petLines.length ? `\n${fit(petLines, 700)}` : ''}`, inline: false },
      { name: 'Chiến đấu', value: `PvP ${n0(row.pvp_wins)}W/${n0(row.pvp_losses)}L · Sát thương Boss tích luỹ: ${bossDmg && bossDmg.s ? fmtNum(bossDmg.s) : '0'} · Vượt Thiên Kiếp ${n0(row.vuot_thienkiep)}`, inline: false },
      { name: 'Bí cảnh', value: `Thượng Cổ: ${n0(row.bicanh_thuongco_count)} · Linh Giới tiến độ: ${row.bicanh_linhgioi_progress || '—'} · Thủ Hộ đã hạ: ${n0(row.thuongco_thuho_defeated)} · Ngũ suy: giai đoạn ${n0(row.ngusuy_stage)}`, inline: false },
      { name: 'PvP gần đây', value: pvpLines.length ? fit(pvpLines) : '—', inline: false },
    ],
  };
}

function tabThoiGian(row) {
  const lines = Object.keys(row).filter((k) => /^(last_|treo_|.*_start$|.*_started_at$)/.test(k) && n0(row[k]) > 1e9).map((k) => `\`${k}\`: ${ts(row[k])}`);
  return { title: '⏱️ Thời gian / cooldown', description: 'Các mốc thời gian đã ghi (cột last_*, treo_*, *_start).', fields: [{ name: 'Mốc', value: fit(lines, 1000), inline: false }] };
}

function tabNghe(row) {
  const u = row.user_id; const X = require('./craft17'); const C = require('../data/craft_v17'); const G = require('./gear17'); const Inv = require('./invsvc'); const FX = require('./fx17'); const Tr = require('./tran17'); const Dan = require('./dan17'); const { I } = require('./catalog17');
  const fmtT = (x) => require('./format').fmtTime(x);
  const fields = [];
  fields.push({ name: 'Nghề nghiệp', value: fit(C.PROF_ORDER.map((p) => { const st = X.state(u, p); const j = X.jobsOf(u, p); return `**${C.PROFS[p].name}**: ${X.levelName(st.level)} (Lv.${st.level}) · EXP ${fmtNum(st.exp)} · chế ${fmtNum(st.crafts)} (✅${fmtNum(st.successes)}/💥${fmtNum(st.fails)})${j.length ? ` · lò ${j.length}` : ''}`; }), 1000), inline: false });
  const eq = G.equippedOf(u);
  fields.push({ name: `Trang bị đang mặc (${eq.length}/7) · tổng ${G.listOf(u).length} món`, value: fit(eq.map((g) => `${G.name(g)} (${I.qName(g.q)}) bền ${Math.ceil(g.dura)}/${g.dura_max}${g.locked ? ' 🔒' : ''} → ${G.fmtStats(G.statsOf(g))}`), 1000), inline: false });
  const fx = FX.get(row); fields.push({ name: 'Hiệu ứng tổng V17 (đã chặn trần)', value: fit(Object.entries(fx).filter(([, v]) => v).map(([k, v]) => `${k} ${k === 'ngo' ? v : pc(v)} / trần ${k === 'ngo' ? FX.CAP[k] : pc(FX.CAP[k])}`), 1000), inline: false });
  const act = Tr.active(u); fields.push({ name: 'Trận pháp & buff đang chạy', value: fit([...act.personal.map((b) => `🧿 ${b.id} (${I.qName(b.q)}) còn ${fmtT(b.left)}${b.charges ? ` · ${b.charges} lượt` : ''}`), ...(act.sect ? [`🏯 Hộ Tông ${act.sect.id} còn ${fmtT(act.sect.left)}`] : []), ...Dan.activeList(u).map((b) => `💊 ${b.key} còn ${fmtT(b.left)}`)], 1000), inline: false });
  const cnt = {}; for (const x of Inv.list(u)) cnt[x.item.cat] = (cnt[x.item.cat] || 0) + x.qty;
  fields.push({ name: 'Kho vật phẩm theo danh mục (tổng số lượng)', value: fit(Object.entries(cnt).map(([c, n]) => `${I.CATEGORIES[c]?.label || c}: ${fmtNum(n)}`), 1000), inline: false });
  const ld = safe(() => require('./field17').status(u), null);
  fields.push({ name: 'Linh Điền', value: ld && ld.f ? `Cấp ${ld.f.level} · ${ld.plots.length}/${ld.max} ô đang trồng · ${ld.plots.filter((p) => p.ready).length} ô chín` : 'Chưa mở.', inline: false });
  return { title: '⚒️ Nghề nghiệp, trang bị & hiệu ứng (V17)', description: 'Chỉ đọc — số liệu lấy thẳng từ Inventory Service / fx17.', fields };
}
const BUILDERS = { ng: tabNghe, tq: tabTongQuan, cs: tabChiSo, tn: tabTaiNguyen, cp: tabCongPhap, cc: tabCanCot, xh: tabXaHoi, tg: tabThoiGian };
function page(userId, tab = 'tq') {
  const row = Cu.getCultivator(userId);
  if (!row) return null;
  const b = BUILDERS[tab] || tabTongQuan; const p = b(row);
  p.fields = (p.fields || []).map((f) => ({ ...f, value: String(f.value).slice(0, 1024) || '—', name: String(f.name).slice(0, 256) }));
  p.description = p.description ? String(p.description).slice(0, 4000) : undefined;
  return p;
}
/** File văn bản đầy đủ: mọi cột DB + giá trị tính ra. */
function fullText(userId) {
  const row = Cu.getCultivator(userId);
  if (!row) return null;
  const L = [`HỒ SƠ NGƯỜI CHƠI ${userId} — xuất lúc ${new Date().toISOString()}`, '='.repeat(70), '', '## GIÁ TRỊ TÍNH RA'];
  L.push(`Cảnh giới: ${R.realmDisplay(row.realm_index, row.stage_index, true)} / ${R.worldTierName(row.world_tier)}`);
  L.push(`Tu vi cần: ${R.tuViRequired(row.realm_index, row.stage_index, row.world_tier)}`);
  L.push(`Công/Thủ/Tốc/HP hiệu dụng: ${Cu.effectiveAtk(row)} / ${Cu.effectiveDef(row)} / ${Cu.effectiveSpd(row)} / ${Cu.effectiveMaxHp(row)}`);
  L.push(`Lực chiến: ${Cu.calcLucChien(row)}`);
  L.push(`Hệ số tu vi công pháp: ×${Cu.cpTuMult(row).toFixed(3)}`);
  try { const t = tabNghe(row); for (const f of t.fields) L.push(`[V17] ${f.name}: ${String(f.value).replace(/\n/g, ' | ')}`); } catch (e) { L.push(`[V17] lỗi: ${e.message}`); }
  for (const s of ['atk', 'def', 'spd', 'hp']) L.push(`Nguồn ${s}: ${statBreakdown(row, s).replace(/\*\*/g, '')}`);
  L.push(`Công pháp V16 (aggregate): ${JSON.stringify(CPX.aggregate(row), (k, v) => (k === 'book' ? { tier: v.tier, name: v.name } : v))}`);
  L.push(`Talent bundle: ${JSON.stringify(safe(() => T.bundle(row), {}))}`);
  L.push(`Công pháp sở hữu: ${[...Cu.ownedCongphapTiers(row)].sort((a, b) => a - b).map(nameOfTier).join(' | ')}`);
  L.push(`Mảnh bí tịch: ${JSON.stringify(safe(() => C16.allFragCounts(userId), {}))}`);
  L.push('', '## TẤT CẢ CỘT TRONG BẢNG cultivators');
  for (const [k, v] of Object.entries(row)) L.push(`${k} = ${v === null ? 'NULL' : v}`);
  return L.join('\n');
}
module.exports = { TABS, page, fullText, fit };
