'use strict';
/** Rương Thần Bí, Mã Code (+ duyệt admin) — port 1:1 */
const crypto = require('node:crypto');
const K = require('./constants');
const Cu = require('./cultivator');
const D = require('../db');
const CP = require('./congphap');
const { E } = require('./emoji');
const { now, int, random, choice, fmtNum } = require('../util');

// ---------- Rương Thần Bí ----------
function openRuongThanBi(userId) {
  const row = Cu.getCultivator(userId);
  if ((row.ruong_than_bi || 0) <= 0) return `❌ Bạn không có ${E.ruong} Rương Thần Bí nào — nhận qua sự kiện hoặc mã code.`;
  const updates = { ruong_than_bi: row.ruong_than_bi - 1 };
  const chain = K.CONGPHAP_SPECIAL_CHAIN;
  if (random() < K.RUONG_JACKPOT_CHANCE) {
    const cur = int(row.cong_phap_special_tier || 0);
    if (cur >= chain.length) {
      updates.linh_thach = row.linh_thach + K.RUONG_CONSOLATION_LINHTHACH * 5;
      Cu.updateCultivator(userId, updates);
      return `${E.ruong} Mở Rương Thần Bí... tia sáng tím loé lên nhưng **Hồng Mông Tử Khí Quyết** của bạn đã ở mức **Đại Thành** — không thể tăng thêm! Đền bù **${fmtNum(K.RUONG_CONSOLATION_LINHTHACH * 5)}** ${E.linhthach} Linh Thạch.`;
    }
    const nt = cur + 1; updates.cong_phap_special_tier = nt;
    Cu.updateCultivator(userId, updates);
    const s = chain[nt - 1]; const verb = cur === 0 ? 'LĨNH NGỘ' : 'ĐỘT PHÁ LÊN';
    return `🌟🎉 **TRÚNG ĐẠI THƯỞNG 1%!** ${E.ruong} Rương Thần Bí chấn động, tia tím ngập trời...\n${verb} **${s.name}** (${nt}/${chain.length}), lĩnh hội chiêu thức tuyệt học **「${s.move}」**!\n_${s.desc}_\n✨ +${int(s.bonus * 100)}% chỉ số/HP (Công Pháp Đặc Quyền, áp dụng mọi nơi — PvP, Bí Cảnh, Boss...).`;
  }
  const owned = [...Cu.ownedCongphapTiers(row)].sort((a, b) => a - b);
  if (!owned.length) {
    updates.linh_thach = row.linh_thach + K.RUONG_CONSOLATION_LINHTHACH;
    Cu.updateCultivator(userId, updates);
    return `${E.ruong} Mở Rương Thần Bí... bên trong có vài công pháp cũ nhưng bạn CHƯA sở hữu công pháp nào để ghép nâng cấp! Nhận đền bù **${fmtNum(K.RUONG_CONSOLATION_LINHTHACH)}** ${E.linhthach} Linh Thạch. (Mua Công Pháp ở **Cửa Hàng** trước để lần sau ghép được nhé!)`;
  }
  const pick = choice(owned);
  const pickName = CP.currentName(pick);
  Object.assign(updates, {
    ruong_star_count: (row.ruong_star_count || 0) + K.RUONG_STAR_GAIN,
    ruong_bonus_lucchien: (row.ruong_bonus_lucchien || 0) + K.RUONG_LUCCHIEN_GAIN,
    ruong_bonus_hp: (row.ruong_bonus_hp || 0) + K.RUONG_HP_GAIN,
    ruong_bonus_atk: (row.ruong_bonus_atk || 0) + K.RUONG_STAT_GAIN,
    ruong_bonus_def: (row.ruong_bonus_def || 0) + K.RUONG_STAT_GAIN,
    ruong_bonus_spd: (row.ruong_bonus_spd || 0) + K.RUONG_STAT_GAIN,
  });
  Cu.updateCultivator(userId, updates);
  return `${E.ruong} Mở Rương Thần Bí... không trúng Đặc Quyền, nhưng ghép được **${pickName}** (Tầng ${pick}) lên thêm **+${K.RUONG_STAR_GAIN} sao** (tổng ${updates.ruong_star_count} ⭐)!\n✨ +${fmtNum(K.RUONG_LUCCHIEN_GAIN)} Lực Chiến, +${fmtNum(K.RUONG_HP_GAIN)} Sinh Mệnh tối đa, +${K.RUONG_STAT_GAIN} Công/Thủ/Thân Pháp — cộng dồn vĩnh viễn, không mất khi đổi Công Pháp/Pháp Bảo.`;
}

function starIconLine(starCount, bonusLc, bonusHp, bonusAtk, maxIcons = 10) {
  const icons = starCount <= maxIcons ? '⭐'.repeat(starCount) : `${'⭐'.repeat(maxIcons)} +${starCount - maxIcons}`;
  return `${icons} (${starCount} sao)\n✨ +${fmtNum(bonusLc)} Lực Chiến, +${fmtNum(bonusHp)} Sinh Mệnh, +${bonusAtk} Công/Thủ/Thân Pháp`;
}

// ---------- Mã code ----------
const CODES = K.CODE_DEFINITIONS;
const codeUseCount = (code) => { const r = D.get('SELECT use_count FROM code_usage WHERE code = ?', code); return r ? r.use_count : 0; };
const codeIncrementUse = (code) => D.run('INSERT INTO code_usage (code, use_count) VALUES (?, 1) ON CONFLICT(code) DO UPDATE SET use_count = use_count + 1', code);
function createPendingCodeRequest(userId, code) {
  const id = crypto.randomBytes(6).toString('hex');
  D.run("INSERT INTO code_pending_requests (request_id, user_id, code, status, created_at) VALUES (?, ?, ?, 'pending', ?)", id, userId, code, now());
  return id;
}
const getPendingCodeRequest = (id) => D.get('SELECT * FROM code_pending_requests WHERE request_id = ?', id);
const findActivePendingRequest = (userId, code) => D.get("SELECT * FROM code_pending_requests WHERE user_id = ? AND code = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1", userId, code);
const countPendingOrApproved = (code) => D.get("SELECT COUNT(*) AS c FROM code_pending_requests WHERE code = ? AND status IN ('pending', 'approved')", code).c;
const setPendingStatus = (id, st) => D.run('UPDATE code_pending_requests SET status = ? WHERE request_id = ?', st, id);
const redeemedCodeSet = (row) => new Set(String(row.redeemed_codes || '').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean));

function rewardLinesForCode(c) {
  const r = [];
  if (c.linh_thach) r.push(`💎 **${fmtNum(c.linh_thach)}** ${E.linhthach} Linh Thạch`);
  if (c.linh_tinh) r.push(`🌠 **${fmtNum(c.linh_tinh)}** ${E.linhtinh} Linh Tinh`);
  if (c.dan_taytuy_trongsinh) r.push(`🧪 **${c.dan_taytuy_trongsinh}** × ${E.taytuydan} Đan Tẩy Tủy Trọng Sinh (vật phẩm hiếm — giá trị cửa hàng ${fmtNum(K.TAYTUY_LINH_THACH_COST)} Linh Thạch)`);
  if (c.dan_taytuy_nuaban) r.push(`🧪 **${c.dan_taytuy_nuaban}** × ${E.taytuydan} Đan Tẩy Tủy Nửa Tác Dụng (tự chọn reroll ${E.linhcan} Linh Căn HOẶC ${E.thechat} Thể Chất — giá trị cửa hàng ${fmtNum(K.TAYTUY_NUABAN_LINH_THACH_COST)} Linh Thạch)`);
  if (c.dan_duoc) r.push(`💊 **${c.dan_duoc}** × ${E.danduoc} Đan Dược (cắn ngay nhận 60~120 tu vi)`);
  if (c.dan_pha_gioi) r.push(`⚗️ **${c.dan_pha_gioi}** × ${E.phagioidan} Đan Dược Phá Giới (bỏ bớt cooldown Đột Phá thất bại)`);
  if (c.cong_phap && require('./congphapV16').isNew(c.cong_phap)) r.push(`📜 Công Pháp **${require('./congphapV16').nameOf(c.cong_phap)}**`);
  if (c.ruong_than_bi) r.push(`📦 **${c.ruong_than_bi}** × ${E.ruong} Rương Thần Bí`);
  return r;
}

function grantCodeRewards(userId, code, c) {
  const row = Cu.getCultivator(userId);
  if (!row) return '❌ Người chơi này không còn tồn tại trong hệ thống (chưa/không còn `/batdau`).';
  const redeemed = redeemedCodeSet(row); const up = {};
  if (c.linh_thach) up.linh_thach = row.linh_thach + c.linh_thach;
  if (c.linh_tinh) up.linh_tinh = (row.linh_tinh || 0) + c.linh_tinh;      // v16.5: mã code có thể tặng Linh Tinh (dùng cho mã đền bù)
  for (const col of ['dan_taytuy_trongsinh', 'dan_taytuy_nuaban', 'dan_duoc', 'dan_pha_gioi', 'ruong_than_bi']) if (c[col]) up[col] = (row[col] || 0) + c[col];
  if (c.cong_phap && require('./congphapV16').isNew(c.cong_phap)) require('./congphapV16').grantInto(up, row, Number(c.cong_phap));   // v16: mã code có thể tặng 1 công pháp mới
  redeemed.add(code);
  up.redeemed_codes = [...redeemed].sort().join(',');
  Cu.updateCultivator(userId, up);
  if (c.max_uses !== null && c.max_uses !== undefined && !c.requires_admin_approval) codeIncrementUse(code);
  return `✅ Đổi mã **${code}** thành công — ${c.label}!\n${rewardLinesForCode(c).join('\n')}\n\nVào ${E.khodo} **Kho Đồ** để xem lại vật phẩm.`;
}

/** → [message, requestId|null]. member: GuildMember (để kiểm tra Booster) hoặc null. */
function redeemCode(userId, member, rawCode) {
  const row = Cu.getCultivator(userId);
  if (!row) return ['❌ Bạn chưa bắt đầu tu tiên, dùng `/batdau` trước.', null];
  if (row.code_locked) return ['🔒 Tài khoản của bạn đã bị KHOÁ nhập code (do nhập lại mã đã dùng). Vui lòng liên hệ admin để được mở khoá.', null];
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) return ['❌ Vui lòng nhập mã code.', null];
  const redeemed = redeemedCodeSet(row);
  const c = CODES[code];
  if (!c) return [`❌ Mã **${code}** không tồn tại hoặc đã hết hạn.`, null];
  if (redeemed.has(code)) {
    // Nhập lại mã đã dùng: chỉ báo "nhập sai / đã sử dụng", KHÔNG khoá tài khoản nữa.
    return [`❌ Nhập sai! Mã **${code}** đã được sử dụng rồi, không thể nhập lại.`, null];
  }
  if (c.booster_only && !(member && member.premiumSince)) return [`🔒 Mã **${code}** chỉ dành cho **Server Booster**.`, null];
  if (c.max_uses !== null && c.max_uses !== undefined) {
    const used = c.requires_admin_approval ? countPendingOrApproved(code) : codeUseCount(code);
    if (used >= c.max_uses) return [`❌ Mã **${code}** đã hết lượt nhận (giới hạn ${c.max_uses} người).`, null];
  }
  if (c.requires_admin_approval) {
    if (findActivePendingRequest(userId, code)) return [`⏳ Bạn đã gửi yêu cầu đổi mã **${code}** trước đó rồi, đang chờ admin xác nhận. Vui lòng chờ thêm, đừng gửi lại nhiều lần.`, null];
    const id = createPendingCodeRequest(userId, code);
    return [`📨 Yêu cầu đổi mã **${code}** (${c.label}) đã được gửi tới admin để xác nhận. Vật phẩm sẽ được cộng vào ${E.khodo} **Kho Đồ** ngay sau khi admin duyệt.`, id];
  }
  return [grantCodeRewards(userId, code, c), null];
}

module.exports = {
  CODES, openRuongThanBi, starIconLine, redeemCode, grantCodeRewards, rewardLinesForCode, getPendingCodeRequest,
  setPendingStatus, codeIncrementUse, codeUseCount, countPendingOrApproved,
};
