'use strict';
/** Phi Thăng, Thiên Kiếp, Sứ Giả, Thượng Cổ Thủ Hộ, Thiên Nhân Ngũ Suy — port 1:1 */
const K = require('./constants');
const CD = require('./cooldowns');
const R = require('./realm');
const Cu = require('./cultivator');
const F = require('./format');
const D = require('../db');
const B = require('./bicanh');
const { E } = require('./emoji');
const { now, int, random, fmtNum } = require('../util');
const { Delta } = Cu;

const gateFor = (wt) => (wt <= 0 ? [K.HOATHAN_REALM_IDX, K.HOATHAN_VIENMAN_STAGE] : [K.DOKIEP_REALM_IDX, K.DOKIEP_VIENMAN_STAGE]);
function isAtAscensionGate(row) {
  const [gr, gs] = gateFor(row.world_tier);
  return row.realm_index > gr || (row.realm_index === gr && row.stage_index >= gs);
}
function thienkiepBacklash(userId, row) {
  const nv = Math.max(0, row.tu_vi - K.THIENKIEP_BACKLASH_TUVI);
  Cu.updateCultivator(userId, { tu_vi: nv });
  return `${E.thienkiep}💢 Thiếu **${R.linhgioilenhLabel(row)}** mà vẫn cưỡng ép Phi Thăng — Thiên Kiếp lập tức giáng xuống trừng phạt! Mất **${fmtNum(K.THIENKIEP_BACKLASH_TUVI)}** tu vi (còn ${fmtNum(nv)}).`;
}
const hpOr = (row) => (row.cur_hp === null || row.cur_hp === undefined ? Cu.effectiveMaxHp(row) : row.cur_hp);

function doVuotthienkiep(userId) {
  let row = Cu.getCultivator(userId);
  const [gr, gs] = gateFor(row.world_tier);
  const isTG = row.world_tier >= 1;
  const label = isTG ? 'Thiên Kiếp Tiên Giới' : 'Phi Thăng Thiên Kiếp';
  if (!isAtAscensionGate(row)) return `❌ Cần đạt ${R.realmDisplay(gr, gs)} mới có thể vượt ${label}.`;
  if (row.vuot_thienkiep) return `✅ Bạn đã vượt qua ${label} rồi, có thể tiến hành các bước phi thăng khác.`;
  const cooldown = isTG ? CD.COOLDOWN_THIENKIEP_TIENGIOI : CD.COOLDOWN_THIENKIEP;
  const cost = isTG ? K.THIENKIEP_TIENGIOI_LINH_THACH_COST : K.THIENKIEP_LINH_THACH_COST;
  const minLc = isTG ? K.THIENKIEP_TIENGIOI_MIN_LUC_CHIEN : K.THIENKIEP_MIN_LUC_CHIEN;
  const t = now();
  const remain = cooldown - (t - row.last_thienkiep);
  if (remain > 0) return `⏳ ${label} còn tích tụ, thử lại sau ${F.fmtTime(remain)}.`;
  if (row.linh_thach < cost) return `❌ Cần ${fmtNum(cost)} ${E.linhthach} Linh Thạch để đủ sức chống ${label} (hiện có ${fmtNum(row.linh_thach)}).`;
  Cu.syncHpRegen(userId, row);
  row = Cu.getCultivator(userId);
  const lc = Cu.calcLucChien(row);
  let rate; let note;
  if (lc < minLc) {
    rate = K.THIENKIEP_RATE_KHONG_DU_LUC_CHIEN;
    note = `⚠️ Lực Chiến **${fmtNum(lc)}/${fmtNum(minLc)}** — CHƯA ĐỦ mốc tối thiểu, tỉ lệ thành công bị ép cứng về **${int(rate * 100)}%** (còn lại ${100 - int(rate * 100)}% = thất bại).`;
  } else {
    rate = Math.max(0.05, Math.min(0.9, 0.45 + row.ngo_tinh * 0.02 + (row.linh_luc / 100) * 0.15));
    note = `✅ Lực Chiến **${fmtNum(lc)}/${fmtNum(minLc)}** đủ mốc tối thiểu, tỉ lệ thành công **${int(rate * 100)}%**.`;
  }
  if (!Cu.updateCultivator(userId, { linh_thach: new Delta(-cost), last_thienkiep: t }, { linh_thach: cost })) return Cu.MSG_BALANCE_CHANGED;
  if (random() < rate) {
    Cu.updateCultivator(userId, { vuot_thienkiep: 1 });
    return `${E.thienkiep} VƯỢT ${label.toUpperCase()} THÀNH CÔNG! Thân thể được tôi luyện, sẵn sàng cho một bước phi thăng.\n${note}`;
  }
  const r2 = Cu.getCultivator(userId);
  Cu.updateCultivator(userId, { tu_vi: int(r2.tu_vi * (isTG ? 0.7 : 0.6)), cur_hp: Math.max(1, int(hpOr(r2) * 0.5)) });
  return `💥 ${label} quá mạnh, bạn thất bại và bị trọng thương (mất tu vi & Sinh Mệnh). Hãy hồi phục rồi thử lại.\n${note}`;
}

function doDanhPhithangSugia(userId) {
  let row = Cu.getCultivator(userId);
  const [gr, gs] = gateFor(row.world_tier);
  const isTG = row.world_tier >= 1;
  const label = isTG ? 'Tiên Giới Sứ Giả' : 'Phi Thăng Sứ Giả';
  if (!isAtAscensionGate(row)) return `❌ Cần đạt ${R.realmDisplay(gr, gs)} mới có thể khiêu chiến ${label}.`;
  const cooldown = isTG ? CD.COOLDOWN_SUGIA_TIENGIOI : CD.COOLDOWN_SUGIA;
  const moc = isTG ? K.SUGIA_TIENGIOI_LUC_CHIEN_MOC : K.SUGIA_LUC_CHIEN_MOC;
  const t = now();
  const remain = cooldown - (t - row.last_sugia);
  if (remain > 0) return `⏳ ${label} còn đang hồi phục, thử lại sau ${F.fmtTime(remain)}.`;
  Cu.syncHpRegen(userId, row);
  row = Cu.getCultivator(userId);
  const lc = Cu.calcLucChien(row);
  const rate = Math.max(0.05, Math.min(0.9, lc / moc));
  Cu.updateCultivator(userId, { last_sugia: t });
  if (random() < rate) {
    const lcol = R.lenhCol(row.world_tier);
    Cu.updateCultivator(userId, { [lcol]: row[lcol] + 1 });
    return `👺 ĐÁNH BẠI ${label.toUpperCase()}! (🔥 Lực chiến ${fmtNum(lc)}/${fmtNum(moc)})\n${E.linhgioilenh} Nhận được **1 ${R.linhgioilenhLabel(row)}**.`;
  }
  Cu.updateCultivator(userId, { cur_hp: Math.max(1, int(hpOr(row) * 0.3)) });
  return `💢 Thua trước ${label} (🔥 Lực chiến ${fmtNum(lc)}/${fmtNum(moc)} chưa đủ), bạn bị thương nặng. Hãy nâng Lực Chiến rồi quay lại.`;
}

function doDanhThuongcoThuho(userId) {
  let row = Cu.getCultivator(userId);
  if (row.world_tier < 1) return '🔒 Chỉ mở sau khi **Phi Thăng Linh Giới**.';
  if (row.thuongco_thuho_defeated) return `✅ Bạn đã đánh bại ${E.thuongcothuho} Thượng Cổ Thủ Hộ rồi — điều kiện này đã hoàn thành cho Phi Thăng Tiên Giới.`;
  if (!isAtAscensionGate(row)) return `❌ Cần đạt ${R.realmDisplay(K.DOKIEP_REALM_IDX, K.DOKIEP_VIENMAN_STAGE)} mới đủ sức khiêu chiến Thượng Cổ Thủ Hộ.`;
  const t = now();
  const remain = CD.COOLDOWN_THUONGCOTHUHO - (t - row.last_thuongcothuho);
  if (remain > 0) return `⏳ Thượng Cổ Thủ Hộ còn đang hồi phục ý chí, thử lại sau ${F.fmtTime(remain)}.`;
  Cu.syncHpRegen(userId, row);
  row = Cu.getCultivator(userId);
  const lc = Cu.calcLucChien(row);
  const moc = int(K.TIENGIOI_LUC_CHIEN_CAN * 0.6);
  const rate = Math.max(0.05, Math.min(0.85, lc / moc));
  Cu.updateCultivator(userId, { last_thuongcothuho: t });
  if (random() < rate) {
    Cu.updateCultivator(userId, { thuongco_thuho_defeated: 1 });
    return `${E.thuongcothuho}⚔️ ĐÁNH BẠI THƯỢNG CỔ THỦ HỘ! (🔥 Lực Chiến ${fmtNum(lc)}/${fmtNum(moc)})\n👑 Điều kiện **Đánh bại Thượng Cổ Thủ Hộ** cho Phi Thăng Tiên Giới đã hoàn thành vĩnh viễn.`;
  }
  Cu.updateCultivator(userId, { cur_hp: Math.max(1, int(hpOr(row) * 0.4)) });
  return `💥 Thua trước Thượng Cổ Thủ Hộ (🔥 Lực Chiến ${fmtNum(lc)}/${fmtNum(moc)} chưa đủ), bạn bị trọng thương. Hãy nâng Lực Chiến rồi quay lại.`;
}

function tiengioiChecklist(row) {
  const lc = Cu.calcLucChien(row);
  const gateOk = row.realm_index > K.DOKIEP_REALM_IDX || (row.realm_index === K.DOKIEP_REALM_IDX && row.stage_index >= K.DOKIEP_VIENMAN_STAGE);
  const lcol = R.lenhCol(row.world_tier);
  return [
    ['canhgioi', gateOk, `Độ Kiếp Viên Mãn (hiện: ${R.realmDisplay(row.realm_index, row.stage_index)})`],
    ['thienkiep', !!row.vuot_thienkiep, 'Vượt qua Thiên Kiếp Tiên Giới'],
    ['luc_chien', lc >= K.TIENGIOI_LUC_CHIEN_CAN, `Lực Chiến ≥ ${fmtNum(K.TIENGIOI_LUC_CHIEN_CAN)} (hiện ${fmtNum(lc)})`],
    ['linh_thach', row.linh_thach >= K.TIENGIOI_LINH_THACH_CAN, `Linh Thạch ≥ ${fmtNum(K.TIENGIOI_LINH_THACH_CAN)} (hiện ${fmtNum(row.linh_thach)})`],
    ['linh_ngo', row.diem_linh_ngo >= B.DIEM_LINH_NGO_MAX, `Lĩnh Ngộ Thiên Đạo 100% (hiện ${row.diem_linh_ngo}/${B.DIEM_LINH_NGO_MAX}%)`],
    ['tien_lenh', row[lcol] >= 1, `${R.linhgioilenhLabel(row)} ×1 (hiện ${row[lcol]})`],
    ['bicanh_thuongco', row.bicanh_thuongco_count >= B.BICANH_THUONGCO_CAN, `Hoàn thành Bí Cảnh Thượng Cổ (Bí Cảnh Độ Kiếp) ≥ ${B.BICANH_THUONGCO_CAN} lần (hiện ${row.bicanh_thuongco_count})`],
    ['thuho', !!row.thuongco_thuho_defeated, 'Đánh bại Thượng Cổ Thủ Hộ'],
    ['ngusuy', !!row.thiennhanngusuy_passed, `Vượt qua Thiên Nhân Ngũ Suy (5 giai đoạn, hiện ${Math.min(row.ngusuy_stage, 5)}/5)`],
  ];
}

function doVuotThiennhanngusuy(userId) {
  const row = Cu.getCultivator(userId);
  if (row.world_tier < 1) return '🔒 Chỉ mở sau khi **Phi Thăng Linh Giới**.';
  if (row.thiennhanngusuy_passed) return `✅ Bạn đã TOÀN THẮNG ${E.thiennhanngusuy} Thiên Nhân Ngũ Suy (5/5 giai đoạn) rồi.`;
  if (!isAtAscensionGate(row)) return `🔒 Thiên Nhân Ngũ Suy chỉ mở khi đạt **${R.realmDisplay(K.DOKIEP_REALM_IDX, K.DOKIEP_VIENMAN_STAGE)}** (hiện: ${R.realmDisplay(row.realm_index, row.stage_index)}).`;
  const missing = tiengioiChecklist(row).filter(([k, ok]) => k !== 'ngusuy' && !ok).map(([, , l]) => l);
  if (missing.length) return `🔒 Đã đạt Độ Kiếp Viên Mãn, nhưng còn thiếu điều kiện để đối mặt Thiên Nhân Ngũ Suy:\n${missing.map((m) => `❌ ${m}`).join('\n')}`;
  const t = now();
  const remain = CD.COOLDOWN_THIENNHANNGUSUY - (t - row.last_thiennhanngusuy);
  if (remain > 0) return `⏳ Đang chịu suy, tích tụ thêm ý chí — thử lại giai đoạn tiếp theo sau ${F.fmtTime(remain)}.`;
  const idx = Math.min(row.ngusuy_stage, K.NGUSUY_STAGES.length - 1);
  const st = K.NGUSUY_STAGES[idx];
  const lc = Cu.calcLucChien(row);
  const rate = Math.max(0.05, Math.min(0.85, st.base_rate + Math.min(0.20, (lc / K.TIENGIOI_LUC_CHIEN_CAN) * 0.20) + row.ngo_tinh * 0.01));
  const up = { last_thiennhanngusuy: t };
  if (!row.ngusuy_started) up.ngusuy_started = 1;
  Cu.updateCultivator(userId, up);
  const header = `${st.icon} **${st.name}** (giai đoạn ${idx + 1}/5) — ${st.flavor}\n`;
  if (random() < rate) {
    const n = idx + 1;
    if (n >= K.NGUSUY_STAGES.length) {
      const r2 = Cu.getCultivator(userId);
      const p = K.NGUSUY_PASS_BONUS_STAT_PCT;
      const bh = Math.max(1, int(r2.hp * p)); const ba = Math.max(1, int(r2.atk * p)); const bd = Math.max(1, int(r2.def_ * p)); const bs = Math.max(1, int(r2.spd * p));
      const title = `${E.thiennhan} Thiên Nhân ${E.thiennhan}`;
      Cu.updateCultivator(userId, { ngusuy_stage: n, thiennhanngusuy_passed: 1, hp: r2.hp + bh, atk: r2.atk + ba, def_: r2.def_ + bd, spd: r2.spd + bs, title });
      return `${header}${E.thiennhanngusuy}👑 VƯỢT QUA GIAI ĐOẠN CUỐI — **TOÀN THẮNG THIÊN NHÂN NGŨ SUY!**\nSinh — Lão — Bệnh — Tử — Suy, tất cả đều không thể quật ngã ý chí của bạn.\n✨ VĨNH VIỄN +${int(p * 100)}% toàn bộ thuộc tính (+${fmtNum(bh)} HP / +${fmtNum(ba)} Công / +${fmtNum(bd)} Thủ / +${fmtNum(bs)} Thân Pháp)!\n🏅 Nhận danh hiệu **「${title}」**!\n🌌 Đủ điều kiện cuối cùng cho **Phi Thăng Tiên Giới**, hãy dùng \`/phithang\`.`;
    }
    Cu.updateCultivator(userId, { ngusuy_stage: n });
    const nx = K.NGUSUY_STAGES[n];
    return `${header}✅ VƯỢT QUA **${st.name}** (${n}/5)! Cơ thể tạm ổn định, nhưng kiếp nạn chưa dừng lại...\n➡️ Giai đoạn tiếp theo: ${nx.icon} **${nx.name}** — dùng \`/thiennhanngusuy\` lại sau ${F.fmtTime(CD.COOLDOWN_THIENNHANNGUSUY)} để thử tiếp.`;
  }
  const r2 = Cu.getCultivator(userId);
  const loss = int(r2.tu_vi * st.fail_tu_vi_pct);
  Cu.updateCultivator(userId, { tu_vi: Math.max(0, r2.tu_vi - loss), cur_hp: Math.max(1, int(hpOr(r2) * st.fail_hp_pct)) });
  return `${header}💥 THẤT BẠI trước **${st.name}** — ${st.fail_flavor}, mất **${fmtNum(loss)}** tu vi & trọng thương.\n⚠️ Vẫn đang ở giai đoạn này (không lùi lại), hãy hồi phục và thử lại sau ${F.fmtTime(CD.COOLDOWN_THIENNHANNGUSUY)}.`;
}

function phithangFailMessage(row) {
  const [gr, gs] = gateFor(row.world_tier);
  if (!isAtAscensionGate(row)) return `❌ Cần đạt ${R.realmDisplay(gr, gs)} mới có thể phi thăng.`;
  if (row.world_tier >= K.WORLD_TIERS.length - 1) return `♾️ Bạn đã ở ${R.worldTierName(row.world_tier)}, cảnh giới tối cao của vũ trụ này.`;
  if (!row.vuot_thienkiep) return '❌ Bạn chưa vượt qua Thiên Kiếp (`/vuotthienkiep`).';
  const lcol = R.lenhCol(row.world_tier); const pcol = R.phuCol(row.world_tier);
  if (row[lcol] < 1) return `❌ Cần 1 ${E.linhgioilenh} ${R.linhgioilenhLabel(row)} — đánh bại ${row.world_tier >= 1 ? 'Tiên Giới Sứ Giả' : 'Phi Thăng Sứ Giả'} (\`/danhphithangsugia\`) để nhận.`;
  if (row.linh_luc < 100) return `❌ Linh Lực chưa đầy (hiện ${row.linh_luc}%/100%). Hãy dùng Linh Mạch thêm.`;
  if (row.world_tier === 1) {
    const missing = tiengioiChecklist(row).filter(([k, ok]) => k !== 'thienkiep' && k !== 'tien_lenh' && !ok).map(([, , l]) => l);
    if (missing.length) return `❌ Chưa đủ điều kiện Phi Thăng Tiên Giới:\n${missing.map((m) => `• ${m}`).join('\n')}`;
  } else {
    if (row.linh_thach < K.PHITHANG_LINH_THACH_COST) return `❌ Cần ${fmtNum(K.PHITHANG_LINH_THACH_COST)} ${E.linhthach} Linh Thạch (hiện có ${fmtNum(row.linh_thach)}).`;
    if (row[pcol] < K.PHITHANG_LINH_PHU_CAN) return `❌ Nhiệm vụ 'Con Đường Phi Thăng' chưa xong (${row[pcol]}/${K.PHITHANG_LINH_PHU_CAN} ${E.linhphu} ${R.linhphuLabel(row)}, rơi ra khi khám phá Bí Cảnh).`;
  }
  return '⏳ Có một lệnh Phi Thăng khác của bạn vừa xử lý xong (hoặc dữ liệu vừa thay đổi). Hãy kiểm tra lại bằng `/dieukienphithang` rồi thử lại.';
}

function doPhithang(userId, guildId = 0) {
  const row = Cu.getCultivator(userId);
  const [gr, gs] = gateFor(row.world_tier);
  if (!isAtAscensionGate(row)) return `❌ Cần đạt ${R.realmDisplay(gr, gs)} mới có thể phi thăng.`;
  if (row.world_tier >= K.WORLD_TIERS.length - 1) return `♾️ Bạn đã ở ${R.worldTierName(row.world_tier)}, cảnh giới tối cao của vũ trụ này.`;
  if (!row.vuot_thienkiep) return '❌ Bạn chưa vượt qua Thiên Kiếp (`/vuotthienkiep`).';
  const lcol = R.lenhCol(row.world_tier); const pcol = R.phuCol(row.world_tier);
  if (row[lcol] < 1) {
    const sg = row.world_tier >= 1 ? 'Tiên Giới Sứ Giả' : 'Phi Thăng Sứ Giả';
    return `${thienkiepBacklash(userId, row)}\n❌ Cần 1 ${E.linhgioilenh} ${R.linhgioilenhLabel(row)} — đánh bại ${sg} (\`/danhphithangsugia\`) để nhận.`;
  }
  const newTier = row.world_tier + 1;
  let thachCost; let phuCost; let extraWhere = ''; let extraParams = [];
  if (row.world_tier === 1) {
    const missing = tiengioiChecklist(row).filter(([k, ok]) => k !== 'thienkiep' && k !== 'tien_lenh' && !ok).map(([, , l]) => l);
    if (missing.length) return `❌ Chưa đủ điều kiện Phi Thăng Tiên Giới:\n${missing.map((m) => `• ${m}`).join('\n')}`;
    thachCost = K.TIENGIOI_LINH_THACH_CAN; phuCost = 0;
    extraWhere = ' AND diem_linh_ngo >= ? AND bicanh_thuongco_count >= ? AND thuongco_thuho_defeated = 1 AND thiennhanngusuy_passed = 1';
    extraParams = [B.DIEM_LINH_NGO_MAX, B.BICANH_THUONGCO_CAN];
  } else {
    if (row.linh_luc < 100) return `❌ Linh Lực chưa đầy (hiện ${row.linh_luc}%/100%). Hãy dùng Linh Mạch thêm.`;
    if (row.linh_thach < K.PHITHANG_LINH_THACH_COST) return `❌ Cần ${fmtNum(K.PHITHANG_LINH_THACH_COST)} ${E.linhthach} Linh Thạch (hiện có ${fmtNum(row.linh_thach)}).`;
    if (row[pcol] < K.PHITHANG_LINH_PHU_CAN) return `❌ Nhiệm vụ 'Con Đường Phi Thăng' chưa xong (${row[pcol]}/${K.PHITHANG_LINH_PHU_CAN} ${E.linhphu} ${R.linhphuLabel(row)}, rơi ra khi khám phá Bí Cảnh).`;
    thachCost = K.PHITHANG_LINH_THACH_COST; phuCost = K.PHITHANG_LINH_PHU_CAN;
  }
  const myRank = D.transaction(() => {
    const r = D.run(
      `UPDATE cultivators SET world_tier = ?, linh_thach = linh_thach - ?, linh_luc = 0, ${lcol} = ${lcol} - 1, ${pcol} = ${pcol} - ?, vuot_thienkiep = 0
       WHERE user_id = ? AND world_tier = ? AND vuot_thienkiep = 1 AND linh_luc >= 100 AND linh_thach >= ? AND ${lcol} >= 1 AND ${pcol} >= ?${extraWhere}`,
      newTier, thachCost, phuCost, userId, row.world_tier, thachCost, phuCost, ...extraParams);
    if (r.changes === 0) return null;
    if (!D.get('SELECT user_id FROM server_first_ascend WHERE guild_id = ?', guildId)) D.run('INSERT INTO server_first_ascend (guild_id, user_id, achieved_at) VALUES (?, ?, ?)', guildId, userId, now());
    const prev = D.get('SELECT COALESCE(MAX(rank), 0) AS r FROM server_ascend_rank WHERE guild_id = ? AND world_tier = ?', guildId, newTier);
    const rank = prev.r + 1;
    D.run('INSERT OR IGNORE INTO server_ascend_rank (guild_id, world_tier, user_id, rank, achieved_at) VALUES (?, ?, ?, ?, ?)', guildId, newTier, userId, rank, now());
    return rank;
  });
  if (myRank === null) return phithangFailMessage(Cu.getCultivator(userId));
  const tierLabel = R.worldTierName(newTier);
  const title = myRank === 1 ? `${E.phithangdau} Tiên Phong ${tierLabel} ${E.phithangdau}` : `Người Phi Thăng ${tierLabel} Thứ ${myRank}`;
  Cu.updateCultivator(userId, { title });
  const nextReq = R.tuViRequired(row.realm_index, row.stage_index, newTier);
  const first = myRank === 1 ? `\n${E.phithangdau} **NGƯỜI ĐẦU TIÊN CỦA SERVER PHI THĂNG ${tierLabel.toUpperCase()} THÀNH CÔNG!** Danh hiệu **「${title}」** đặc biệt đã được trao!\n` : '';
  const bcNote = newTier === 1 ? `\n${E.bicanhlinhgioi} **Hệ Thống Bí Cảnh Linh Giới đã mở khóa!** Dùng nút **Bí Cảnh Linh Giới** trong Chiến Đấu hoặc \`/bicanhlinhgioi\` để bắt đầu.` : '';
  const tgNote = newTier === 2 ? `\n${E.thiennhanngusuy} 👑 **PHI THĂNG TIÊN GIỚI THÀNH CÔNG!** Vượt qua Độ Kiếp, Thượng Cổ Thủ Hộ và Thiên Nhân Ngũ Suy — bạn chính thức bước vào hàng ngũ Chân Tiên.` : '';
  const speed = int((1 - R.worldMult(newTier)) * 100);
  return `${first}${E.phithang}🎉 PHI THĂNG THÀNH CÔNG! Bạn rời khỏi ${R.worldTierName(row.world_tier)}, bước vào **${tierLabel}**!\n${R.worldTierFlavor(newTier)}\n` +
    `✅ Tu vi & cảnh giới **giữ nguyên** (${R.realmDisplay(row.realm_index, row.stage_index)}, **${fmtNum(row.tu_vi)}** tu vi) — KHÔNG reset về Luyện Khí, tiếp tục đột phá lên thẳng từ đây.\n` +
    `📊 Do ở ${tierLabel} nên mốc tu vi cần để đột phá tiếp theo tăng vọt lên **${fmtNum(nextReq)}** (tu luyện sẽ chậm hơn hẳn, giữ cân bằng game).\n` +
    `📉 Tốc độ tu luyện thường (Tu Luyện/Bế Quan) tại ${tierLabel} còn lại **${int(R.worldMult(newTier) * 100)}%** (giảm ${speed}% vĩnh viễn) — bù lại bằng Bí Cảnh Linh Giới.\n` +
    `💪 Buff thể chất (Sinh Mệnh/Công Kích/Phòng Ngự/Thân Pháp) mỗi lần đột phá cũng giảm còn ~40% mức cũ.\n🔓 Mở khóa công pháp, bí cảnh, tông môn và tài nguyên riêng của ${tierLabel}.\n🏅 Nhận danh hiệu **「${title}」**.${bcNote}${tgNote}`;
}

module.exports = { isAtAscensionGate, doVuotthienkiep, doDanhPhithangSugia, doDanhThuongcoThuho, tiengioiChecklist, doVuotThiennhanngusuy, doPhithang, gateFor };
