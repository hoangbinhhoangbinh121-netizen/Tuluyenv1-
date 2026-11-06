'use strict';
/** Bí Cảnh (thường / Vạn Linh Cốc / Đặc Biệt / Linh Giới) + chế Phi Thăng Lệnh — port 1:1 */
const K = require('./constants');
const CD = require('./cooldowns');
const R = require('./realm');
const BAL = require('./balance');
const Cu = require('./cultivator');
const TO = require('./talentOps');
const F = require('./format');
const { E } = require('./emoji');
const { now, int, random, randInt, choice, fmtNum } = require('../util');

const DIEM_LINH_NGO_MAX = 100;
const BICANH_THUONGCO_CAN = 10;
const BICANH_LINHGIOI_SCALE = [1.0, 1.6, 2.4];
const BICANH_DACBIET_CONGPHAP_CHANCE = 0.15;

const CHAINS = [
  { key: 'luyenhu', get name() { return `${E.bicanh} Bí Cảnh Luyện Hư`; }, require_realm: 6, sub_names: ['Luyện Hư I (Sơ kỳ)', 'Luyện Hư II (Trung kỳ)', 'Luyện Hư III (Hậu kỳ)'],
    tu_vi: [300, 600], linh_thach: [40000, 90000], extra: { tienkim: [3, 8], tienngoc: [1, 3], thienhoatinh: [1, 4] } },
  { key: 'hopthe', get name() { return `${E.bicanh} Bí Cảnh Hợp Thể`; }, require_realm: 7, sub_names: ['Hợp Thể I', 'Hợp Thể II', 'Hợp Thể III'],
    tu_vi: [900, 1800], linh_thach: [80000, 160000], extra: { hukhongkettinh: [2, 6], thiendaothach: [1, 3], manhtiengioilenh: [1, 3] }, diem_linh_ngo: [1, 3] },
  { key: 'daithua', get name() { return `${E.bicanh} Bí Cảnh Đại Thừa`; }, require_realm: 8, sub_names: ['Đại Thừa I', 'Đại Thừa II', 'Đại Thừa III'],
    tu_vi: [2200, 4200], linh_thach: [150000, 300000], extra: { daonguyentinh: [1, 3], manhtiengioilenh: [1, 2], tienngoc: [2, 5] }, diem_linh_ngo: [2, 4] },
  { key: 'dokiep', get name() { return `${E.bicanh} Bí Cảnh Độ Kiếp`; }, require_realm: 9, sub_names: ['Độ Kiếp I', 'Độ Kiếp II', 'Độ Kiếp III (Boss: 🌩️ Thiên Kiếp Hóa Thân)'],
    tu_vi: [5000, 9000], linh_thach: [300000, 600000], extra: { daonguyentinh: [2, 5] }, diem_linh_ngo: [3, 6],
    boss_on_last: { name: '🌩️ Thiên Kiếp Hóa Thân', chance: 0.20, extra: { thiendaoan: [1, 1], thienkiepchiluc: [2, 4] }, bonus_linh_ngo: 5 } },
];
const ITEM_EMOJI = { tienkim: 'tienkim', tienngoc: 'tienngoc', thienhoatinh: 'thienhoatinh', hukhongkettinh: 'hukhongkettinh', thiendaothach: 'thiendaothach', manhtiengioilenh: 'manhtiengioilenh', daonguyentinh: 'daonguyentinh', thiendaoan: 'thiendaoan', thienkiepchiluc: 'thienkiepchiluc' };
const ITEM_COL = { tienkim: 'tien_kim', tienngoc: 'tien_ngoc', thienhoatinh: 'thien_hoa_tinh', hukhongkettinh: 'hu_khong_ket_tinh', thiendaothach: 'thien_dao_thach', manhtiengioilenh: 'manh_tien_gioi_lenh', daonguyentinh: 'dao_nguyen_tinh', thiendaoan: 'thien_dao_an', thienkiepchiluc: 'thien_kiep_chi_luc' };
const ITEM_LABEL = { tienkim: 'Tiên Kim', tienngoc: 'Tiên Ngọc', thienhoatinh: 'Thiên Hỏa Tinh', hukhongkettinh: 'Hư Không Kết Tinh', thiendaothach: 'Thiên Đạo Thạch', manhtiengioilenh: 'Mảnh Tiên Giới Lệnh', daonguyentinh: 'Đạo Nguyên Tinh', thiendaoan: 'Thiên Đạo Ấn', thienkiepchiluc: 'Thiên Kiếp Chi Lực' };

const DACBIET_GROUPS = {
  nhan_gioi: { label: 'Bí Cảnh Đặc Biệt — Nhân Giới', min_realm: 1, max_realm: 5, base_tu_vi: [250, 450], image: 'bicanh_dacbiet_nhangioi.png' },
  linh_gioi: { label: 'Bí Cảnh Đặc Biệt — Linh Giới', min_realm: 6, max_realm: 9, base_tu_vi: [350000, 650000], image: 'bicanh_dacbiet_linhgioi.png' },
};

const rr = (r) => randInt(r[0], r[1]);
const cpName = (CP, tier) => CP.currentName(tier);

function doBicanh(userId, tierIdx = 0) {
  const CP = require('./congphap');
  const row = Cu.getCultivator(userId);
  const tier = K.BICANH_TIERS[tierIdx];
  if (row.realm_index < tier.require_realm) return `🔒 **${tier.name}** yêu cầu đạt ${K.REALMS[tier.require_realm].name} trở lên (bí cảnh giới hạn theo tu vi/cảnh giới).`;
  const t = now();
  const remain = CD.COOLDOWN_BICANH - (t - row.last_bicanh);
  if (remain > 0) return `⏳ Còn ${F.fmtTime(remain)} nữa mới khám phá bí cảnh tiếp được.`;
  const realmIdx = row.realm_index;
  const cpBonus = 1 + Cu.effectiveCongPhapBonus(row);
  const PF = BAL.paceFactor(row);
  const lootM = TO.lootMultOf(row);           // v13.6: Thể Chất/Linh Căn tăng thu hoạch tu vi Bí Cảnh (tối đa +30%) — Linh Thạch giữ nguyên
  const tuViBase = int(rr(tier.tu_vi_range) * (1 + realmIdx * 0.25) * cpBonus * PF);
  const tuViGain = int(tuViBase * lootM);
  const nlGain = rr(tier.nl_range);
  const ltGain = int(tuViBase / PF * 200);   // linh thạch giữ công thức cũ (không lạm phát)
  const up = { tu_vi: row.tu_vi + tuViGain, nguyen_lieu: row.nguyen_lieu + nlGain, linh_thach: row.linh_thach + ltGain, last_bicanh: t, ...TO.progFields(row, { lc: 2, tc: 1 }) };
  const cpNote = cpBonus > 1 ? ` (đã gồm +${int((cpBonus - 1) * 100)}% công pháp)` : '';
  const isVLC = !!tier.van_linh_coc; let isBoss = false; let enc = '';
  if (isVLC) {
    isBoss = random() < K.VANLINHCOC_BOSS_CHANCE;
    if (isBoss) {
      enc = `\n👑 Chạm trán **${K.VANLINHCOC_BOSS}**! Sau trận huyết chiến, bạn thu được chiến lợi phẩm dồi dào hơn hẳn.`;
      const bt = int(tuViGain * 0.6); const bl = int(ltGain * 0.6);
      up.tu_vi += bt; up.linh_thach += bl;
      enc += ` (+${bt} tu vi, +${fmtNum(bl)} ${E.linhthach} thưởng thêm từ Boss)`;
    } else enc = `\n👾 Đánh bại **${choice(K.VANLINHCOC_QUAI)}** trấn giữ Vạn Linh Cốc.`;
  }
  let msg = `${E.bicanh} Khám phá **${tier.name}**: nhận **${tuViGain}** tu vi, **${nlGain}** ${E.nguyenlieu} nguyên liệu, **${fmtNum(ltGain)}** ${E.linhthach} Linh Thạch.${cpNote}${enc}`;
  if (tier.manhghep_chance > 0 && random() < tier.manhghep_chance) {
    const g = randInt(1, 3); const nm = row.manh_ghep_phithang + g; up.manh_ghep_phithang = nm;
    msg += `\n🧩 Nhặt được **${g}** mảnh ghép Phi Thăng Lệnh (${nm}/${K.MANHGHEP_PHITHANG_CAN}, đủ ${K.MANHGHEP_PHITHANG_CAN} thì \`/chephithanglenh\` để chế thành 1 ${E.linhgioilenh}).`;
  }
  const isHTVM = realmIdx === 5 && row.stage_index === 3;
  const canPhu = isHTVM || row.world_tier > 0; const pc = R.phuCol(row.world_tier);
  if (canPhu && row[pc] < K.PHITHANG_LINH_PHU_CAN && random() < 0.30) {
    up[pc] = row[pc] + 1;
    msg += `\n${E.linhphu} Bạn cảm ngộ được 1 mảnh **${R.linhphuLabel(row)}** cho nhiệm vụ Con Đường Phi Thăng (${row[pc] + 1}/${K.PHITHANG_LINH_PHU_CAN}).`;
  }
  if (!row.linh_thu && random() < 0.1) {
    const beast = choice(['Hỏa Vân Báo', 'Thanh Long Sủng', 'Tuyết Hồ Ly', 'Huyền Vũ Quy']);
    up.linh_thu = beast; up.linh_thu_level = 1;
    msg += `\n${E.dongthanh} May mắn! Bạn nhặt được trứng linh thú và nở ra **${beast}**!`;
  }
  const ldc = K.LINHDUOC_DACBIET_DROP_CHANCE[Math.min(tierIdx, K.LINHDUOC_DACBIET_DROP_CHANCE.length - 1)];
  if (random() < ldc) {
    const g = randInt(1, 2); up.linh_duoc_dac_biet = (row.linh_duoc_dac_biet || 0) + g;
    msg += `\n${E.linhduocdacbiet} Nhặt được **${g}** Linh Dược Đặc Biệt (dùng luyện ${E.phagioidan} Đan Dược Phá Giới, cần ${K.DAN_PHA_GIOI_CRAFT_COST}/viên).`;
  }
  if (isVLC) {
    const loot = [];
    if (random() < (isBoss ? 0.20 : 0.08)) { const g = isBoss ? randInt(1, 2) : 1; up.linh_tinh = row.linh_tinh + g; loot.push(`${E.linhtinh} **${g}** Linh Tinh`); }
    if (random() < (isBoss ? 0.45 : 0.22)) { const g = randInt(2, 6); up.hu_khong_tinh_hoa = row.hu_khong_tinh_hoa + g; loot.push(`${E.hukhongtinhhoa} **${g}** Hư Không Tinh Hoa`); }
    if (random() < (isBoss ? 0.40 : 0.18)) { const g = randInt(1, 4); up.huyen_thiet = row.huyen_thiet + g; loot.push(`${E.huyenthiet} **${g}** Huyền Thiết`); }
    if (random() < (isBoss ? 0.30 : 0.12)) { const g = randInt(1, 2); up.manh_phap_bao = row.manh_phap_bao + g; loot.push(`${E.manhphapbao} **${g}** Mảnh Pháp Bảo`); }
    if (loot.length) msg += `\n🎁 Chiến lợi phẩm Vạn Linh Cốc: ${loot.join(', ')}.`;
    if (random() < K.VANLINHCOC_CONGPHAP_CHANCE * (isBoss ? 2 : 1)) {
      const owned = Cu.ownedCongphapTiers(row);
      const elig = K.CONG_PHAP_TIER_DEF.filter((t) => !owned.has(t.tier) && row.realm_index >= t.require_realm && row.world_tier >= t.require_world);
      if (elig.length) {
        const won = choice(elig); owned.add(won.tier);
        up.cong_phap_owned = [...owned].sort((a, b) => a - b).join(',');
        msg += `\n📜✨ CỰC PHẨM! Trong hư không, bạn cảm ngộ được **[Tầng ${won.tier}] ${cpName(CP, won.tier)}** — đã tự động thêm vào kho công pháp sở hữu, vào menu **Công Pháp** để trang bị miễn phí!`;
      }
    }
  }
  Cu.updateCultivator(userId, up);
  return msg + TO.rollDrops(userId, 'bicanh', lootM);
}

function doBicanhDacBiet(userId, group) {
  const CP = require('./congphap');
  const row = Cu.getCultivator(userId);
  const g = DACBIET_GROUPS[group];
  if (!g) return '❌ Loại Bí Cảnh Đặc Biệt không hợp lệ.';
  const ve = row.ve_bicanh_dac_biet || 0;
  if (ve <= 0) return `❌ Bạn không có ${E.vebicanhdacbiet} Vé Bí Cảnh Đặc Biệt nào — hạ gục Boss Thế Giới (ra đòn kết liễu) để có 10% cơ hội rơi ra.`;
  const ri = row.realm_index;
  if (!(g.min_realm <= ri && ri <= g.max_realm)) return `🔒 **${g.label}** chỉ dành cho người tu luyện từ ${K.REALMS[g.min_realm].name} đến ${K.REALMS[g.max_realm].name}.`;
  const cpBonus = 1 + Cu.effectiveCongPhapBonus(row);
  const PFD = group === 'linh_gioi' ? 1 : BAL.paceFactor(row);
  const tuVi = int(rr(g.base_tu_vi) * (1 + ri * 0.25) * cpBonus * K.BICANH_DACBIET_MULT * PFD);
  const lt = int(tuVi / PFD * 200);
  const up = { tu_vi: row.tu_vi + tuVi, linh_thach: row.linh_thach + lt, ve_bicanh_dac_biet: ve - 1, ...TO.progFields(row, { lc: 3, tc: 2 }) };
  const cpNote = cpBonus > 1 ? ` (đã gồm +${int((cpBonus - 1) * 100)}% công pháp)` : '';
  let msg = `${E.bicanh}✨ Khám phá **${g.label}**! Dùng hết 1 ${E.vebicanhdacbiet} Vé (còn ${ve - 1}). Nhận **${fmtNum(tuVi)}** tu vi, **${fmtNum(lt)}** ${E.linhthach} Linh Thạch.${cpNote}`;
  if (random() < BICANH_DACBIET_CONGPHAP_CHANCE) {
    const owned = Cu.ownedCongphapTiers(row);
    const elig = K.CONG_PHAP_TIER_DEF.filter((t) => !owned.has(t.tier) && !t.boss_drop_only && row.realm_index >= t.require_realm && row.world_tier >= t.require_world);
    if (elig.length) {
      const won = choice(elig); owned.add(won.tier);
      up.cong_phap_owned = [...owned].sort((a, b) => a - b).join(',');
      msg += `\n📜✨ Trong Bí Cảnh Đặc Biệt, bạn cảm ngộ được **[Tầng ${won.tier}] ${cpName(CP, won.tier)}** — đã tự động thêm vào kho công pháp sở hữu, vào menu **Công Pháp** để trang bị miễn phí!`;
    }
  }
  Cu.updateCultivator(userId, up);
  return msg + TO.rollDrops(userId, 'bicanh', TO.lootMultOf(row) * 2);   // Bí Cảnh Đặc Biệt: cơ duyên gấp đôi
}

function doChePhithangLenh(userId) {
  const row = Cu.getCultivator(userId);
  if (row.world_tier === 0) return `❌ Ở ${R.worldTierName(0)}, ${E.linhgioilenh} Linh Giới Lệnh chỉ nhận được bằng cách đánh bại Phi Thăng Sứ Giả (\`/danhphithangsugia\`), không thể chế từ mảnh ghép. Mảnh ghép (${row.manh_ghep_phithang}/${K.MANHGHEP_PHITHANG_CAN}) sẽ dùng được để chế Tiên Lệnh sau khi Phi Thăng Linh Giới.`;
  if (row.manh_ghep_phithang < K.MANHGHEP_PHITHANG_CAN) return `❌ Cần ${K.MANHGHEP_PHITHANG_CAN} mảnh ghép Phi Thăng Lệnh để chế (hiện có ${row.manh_ghep_phithang}/${K.MANHGHEP_PHITHANG_CAN}). Khám phá Bí Cảnh để nhặt thêm.`;
  const lc = R.lenhCol(row.world_tier);
  Cu.updateCultivator(userId, { manh_ghep_phithang: row.manh_ghep_phithang - K.MANHGHEP_PHITHANG_CAN, [lc]: row[lc] + 1 });
  return `🔨 Chế thành công! Dùng hết ${K.MANHGHEP_PHITHANG_CAN} mảnh ghép, nhận **1 ${E.linhgioilenh} ${R.linhgioilenhLabel(row)}**.`;
}

// ---------- Bí Cảnh Linh Giới ----------
function allLinhgioiSubtiers() {
  const out = [];
  for (const chain of CHAINS) chain.sub_names.forEach((sub_name, sub_idx) => out.push({ sub_key: `${chain.key}_${sub_idx + 1}`, chain, sub_idx, sub_name }));
  return out;
}
function loadLinhgioiProgress(row) {
  let data;
  try { data = row.bicanh_linhgioi_progress ? JSON.parse(row.bicanh_linhgioi_progress) : {}; } catch (_) { data = {}; }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) data = {};
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === '__all_done__') out[k] = !!v;
    else if (v !== null && typeof v === 'object' && !Array.isArray(v)) out[k] = v;
    else out[k] = { count: v ? 1 : 0, first: !!v };
  }
  return out;
}

function doBicanhLinhgioi(userId, subKey) {
  const row = Cu.getCultivator(userId);
  if (row.world_tier < 1) return '🔒 Hệ Thống Bí Cảnh Linh Giới chỉ mở sau khi **Phi Thăng Linh Giới**. Hãy hoàn thành Phi Thăng trước.';
  const entry = allLinhgioiSubtiers().find((e) => e.sub_key === subKey);
  if (!entry) return '❌ Bí Cảnh không tồn tại.';
  const { chain, sub_idx: subIdx, sub_name: subName } = entry;
  if (row.realm_index < chain.require_realm) return `🔒 **${chain.name}** yêu cầu đạt ${K.REALMS[chain.require_realm].name} trở lên.`;
  if (row.realm_index === chain.require_realm && row.stage_index < subIdx) return `🔒 **${subName}** yêu cầu tiểu cảnh giới **${K.SUB_4[subIdx]}** trở lên của ${K.REALMS[chain.require_realm].name} (hiện tại: ${K.SUB_4[row.stage_index]}).`;
  const t = now();
  const remain = CD.COOLDOWN_BICANH_LINHGIOI - (t - row.last_bicanh_linhgioi);
  if (remain > 0) return `⏳ Còn ${F.fmtTime(remain)} nữa mới khám phá Bí Cảnh Linh Giới tiếp được.`;

  const scale = BICANH_LINHGIOI_SCALE[subIdx];
  const tuVi = int(rr(chain.tu_vi) * scale); const lt = int(rr(chain.linh_thach) * scale);
  const up = { tu_vi: row.tu_vi + tuVi, linh_thach: row.linh_thach + lt, last_bicanh_linhgioi: t };
  const loot = [`**${fmtNum(tuVi)}** tu vi`, `**${fmtNum(lt)}** ${E.linhthach} Linh Thạch`];
  const pc = R.phuCol(row.world_tier);
  if (row[pc] < K.PHITHANG_LINH_PHU_CAN && random() < 0.35) {
    up[pc] = row[pc] + 1;
    loot.push(`${E.linhphu} **1 ${R.linhphuLabel(row)}** (${row[pc] + 1}/${K.PHITHANG_LINH_PHU_CAN})`);
  }
  for (const [field, rng] of Object.entries(chain.extra || {})) {
    const g = Math.max(1, int(rr(rng) * scale)); const col = ITEM_COL[field];
    up[col] = row[col] + g; loot.push(`**${g}** ${E[ITEM_EMOJI[field]]} ${ITEM_LABEL[field]}`);
  }
  let diem = 0;
  if (chain.diem_linh_ngo) diem = Math.max(1, int(rr(chain.diem_linh_ngo) * scale));
  let bossNote = '';
  const bc = chain.boss_on_last;
  if (bc && subIdx === chain.sub_names.length - 1 && random() < bc.chance) {
    bossNote = `\n👑 **Chạm trán ${bc.name}!** Sau trận huyết chiến kinh thiên động địa, bạn đánh bại được nó.`;
    const bl = [];
    for (const [field, rng] of Object.entries(bc.extra)) {
      const g = rr(rng); const col = ITEM_COL[field];
      up[col] = (up[col] !== undefined ? up[col] : row[col]) + g;
      bl.push(`**${g}** ${E[ITEM_EMOJI[field]]} ${ITEM_LABEL[field]}`);
    }
    diem += bc.bonus_linh_ngo || 0;
    if (bl.length) bossNote += ` Chiến lợi phẩm: ${bl.join(', ')}.`;
  }
  const progress = loadLinhgioiProgress(row);
  const ep = progress[subKey] || { count: 0, first: false };
  const isFirst = !ep.first;
  ep.count = (ep.count || 0) + 1;
  let ach = '';
  if (isFirst) {
    ep.first = true; up.linh_thach += lt; diem += 1;
    ach = `\n🏅 **Lần đầu hoàn thành ${subName}!** Thưởng thêm **${fmtNum(lt)}** ${E.linhthach} Linh Thạch.`;
  } else if (ep.count % 5 === 0 && chain.extra) {
    const key = choice(Object.keys(chain.extra)); const col = ITEM_COL[key];
    up[col] = (up[col] !== undefined ? up[col] : row[col]) + 1;
    ach = `\n📈 Đã khám phá ${ep.count} lần — tỉ lệ rơi nguyên liệu tăng, nhận thêm **1** ${E[ITEM_EMOJI[key]]} ${ITEM_LABEL[key]}.`;
  }
  progress[subKey] = ep;
  if (diem) {
    const nd = Math.min(DIEM_LINH_NGO_MAX, row.diem_linh_ngo + diem); up.diem_linh_ngo = nd;
    loot.push(`**+${diem}** ${E.linhngothiendao} Lĩnh Ngộ Thiên Đạo (${nd}/${DIEM_LINH_NGO_MAX}%)`);
  }
  const allKeys = allLinhgioiSubtiers().map((e) => e.sub_key);
  const cleared = new Set(Object.entries(progress).filter(([k, v]) => k !== '__all_done__' && v.first).map(([k]) => k));
  let allDone = '';
  if (allKeys.every((k) => cleared.has(k)) && !progress.__all_done__) {
    progress.__all_done__ = true; up.diem_linh_ngo = DIEM_LINH_NGO_MAX;
    allDone = `\n\n${E.linhngothiendao} 👑 **HOÀN THÀNH TOÀN BỘ BÍ CẢNH LINH GIỚI!** Lĩnh Ngộ Thiên Đạo đạt **${DIEM_LINH_NGO_MAX}%**! Bạn đã đủ nền tảng để hướng tới **Thiên Nhân Ngũ Suy** và **Phi Thăng Tiên Giới**.`;
  }
  up.bicanh_linhgioi_progress = JSON.stringify(progress);
  let tc = '';
  if (chain.key === 'dokiep') {
    const n = row.bicanh_thuongco_count + 1; up.bicanh_thuongco_count = n;
    tc = `\n${E.bicanh} Bí Cảnh Thượng Cổ: đã hoàn thành **${n}/${BICANH_THUONGCO_CAN}** lần (điều kiện Phi Thăng Tiên Giới).`;
  }
  Cu.updateCultivator(userId, up);
  return `${E.bicanhlinhgioi} Khám phá **${subName}** (${chain.name}): nhận ${loot.join(', ')}.${bossNote}${ach}${tc}${allDone}`;
}

module.exports = {
  CHAINS, DACBIET_GROUPS, DIEM_LINH_NGO_MAX, BICANH_THUONGCO_CAN, ITEM_EMOJI, ITEM_COL, ITEM_LABEL,
  doBicanh, doBicanhDacBiet, doChePhithangLenh, allLinhgioiSubtiers, loadLinhgioiProgress, doBicanhLinhgioi,
};
