'use strict';
const K = require('./constants');
const daoLuLevelFromIntimacy = (intimacy) => {
  let level = 1;
  for (const [lv, need] of Object.entries(K.DAO_LU_LEVEL_THRESHOLDS).map(([a, b]) => [Number(a), b]).sort((a, b) => a[0] - b[0])) {
    if (intimacy >= need) level = lv;
  }
  return Math.min(level, K.DAO_LU_MAX_LEVEL);
};
const daoLuBonus = (level) => 0.15 + Math.max(0, level - 1) * 0.02;
const TITLES = { 1: 'Sơ Kết Đạo Duyên', 2: 'Tâm Ý Tương Thông', 3: 'Đồng Tâm Đồng Hành', 4: 'Lưỡng Tâm Hợp Nhất', 5: 'Thâm Tình Đạo Lữ', 6: 'Kim Lan Chi Giao', 7: 'Sinh Tử Đồng Hành', 8: 'Thiên Định Đạo Duyên', 9: 'Đạo Tâm Tương Chiếu', 10: 'Thiên Đạo Đạo Lữ' };
const daoLuTitle = (level) => TITLES[level] || 'Đạo Lữ';
const daoLuBonusFromRow = (row) => (!row || !row.partner_id ? 0.0 : daoLuBonus(parseInt(row.dao_lu_level || 1, 10)));
module.exports = { daoLuLevelFromIntimacy, daoLuBonus, daoLuTitle, daoLuBonusFromRow };

// ================= Song Tu / Đạo Lữ (hành động) =================
const D = require('../db');
const Cu = require('./cultivator');
const { E } = require('./emoji');
const F = require('./format');
const { now, int } = require('../util');
const DAILY_CD = require('./cooldowns').DAO_LU_DAILY_COOLDOWN;

function requestSongtu(fromId, toId) {
  if (String(fromId) === String(toId)) return '❌ Không thể kết làm đạo lữ với chính mình.';
  const a = Cu.getCultivator(fromId); const b = Cu.getCultivator(toId);
  if (!a || !b) return '❌ Cả hai bên đều phải bắt đầu tu tiên trước.';
  if (a.partner_id || b.partner_id) return '❌ Một trong hai bên đã có đạo lữ rồi.';
  if ((a.nhan_cau_hon || 0) < 1) return `${E.daolu} Bạn cần có **Nhẫn Cầu Hôn** mới gửi được lời mời kết đạo lữ — hãy mua ở **Cửa Hàng** (Khí Vận Các).`;
  D.transaction(() => {
    D.run('INSERT OR IGNORE INTO songtu_pending (from_id, to_id) VALUES (?, ?)', fromId, toId);
    const cur = D.get('SELECT nhan_cau_hon FROM cultivators WHERE user_id = ?', fromId);
    D.run('UPDATE cultivators SET nhan_cau_hon = ? WHERE user_id = ?', Math.max(0, (cur.nhan_cau_hon || 0) - 1), fromId);
  });
  return `${E.daolu} Đã dùng 1 **Nhẫn Cầu Hôn**, gửi lời mời **kết đạo lữ** thành công. Đối phương dùng \`/chapnhansongtu\` để chấp nhận.`;
}

function acceptSongtu(toId, fromId) {
  if (String(toId) === String(fromId)) return '❌ Không thể kết đạo lữ với chính mình.';
  return D.transaction(() => {
    if (!D.get('SELECT 1 AS x FROM songtu_pending WHERE from_id = ? AND to_id = ?', fromId, toId)) return '❌ Không có lời mời đạo lữ nào từ người này.';
    const a = D.get('SELECT partner_id FROM cultivators WHERE user_id = ?', fromId);
    const b = D.get('SELECT partner_id FROM cultivators WHERE user_id = ?', toId);
    if (!a || !b) return '❌ Cả hai bên đều phải bắt đầu tu tiên trước.';
    if (a.partner_id || b.partner_id) { D.run('DELETE FROM songtu_pending WHERE from_id = ? AND to_id = ?', fromId, toId); return '❌ Một trong hai bên đã có đạo lữ rồi.'; }
    const t = now();
    D.run('UPDATE cultivators SET partner_id = ?, dao_lu_level = 1, dao_lu_intimacy = 0, dao_lu_started_at = ?, last_dao_lu_daily = 0 WHERE user_id = ?', toId, t, fromId);
    D.run('UPDATE cultivators SET partner_id = ?, dao_lu_level = 1, dao_lu_intimacy = 0, dao_lu_started_at = ?, last_dao_lu_daily = 0 WHERE user_id = ?', fromId, t, toId);
    D.run('DELETE FROM songtu_pending WHERE from_id IN (?, ?) OR to_id IN (?, ?)', fromId, toId, fromId, toId);
    return `${E.daolu_ketdoi} **Kết đạo thành công!** Hai người đã trở thành đạo lữ, nhận buff song tu **+15% tu vi**.`;
  });
}

function daoLuStatus(userId) {
  const row = Cu.getCultivator(userId);
  if (!row) return '❌ Bạn chưa bắt đầu tu tiên.';
  if (!row.partner_id) return '💠 Bạn hiện chưa có đạo lữ.';
  const lv = int(row.dao_lu_level || 1); const intimacy = int(row.dao_lu_intimacy || 0); const need = K.DAO_LU_LEVEL_THRESHOLDS[lv + 1];
  const started = row.dao_lu_started_at || 0;
  const line = started ? `\n📅 **Kết đạo từ:** <t:${int(started)}:R>` : '';
  return `${E.daolu} **Đạo Lữ:** <@${row.partner_id}>\n💠 **Đạo Duyên:** Cấp ${lv} — ${daoLuTitle(lv)}\n❤️ **Thân Mật:** ${intimacy}/${need ? need : 'MAX'}\n✨ **Buff song tu:** +${(daoLuBonus(lv) * 100).toFixed(0)}% tu vi${line}`;
}

function daoLuDaily(userId) {
  const row = Cu.getCultivator(userId);
  if (!row || !row.partner_id) return '❌ Bạn chưa có đạo lữ.';
  const t = now(); const remain = DAILY_CD - (t - (row.last_dao_lu_daily || 0));
  if (remain > 0) return `⏳ Đạo duyên đã được vun đắp hôm nay. Còn ${F.fmtTime(remain)}.`;
  const pid = row.partner_id; const partner = Cu.getCultivator(pid);
  if (!partner || String(partner.partner_id) !== String(userId)) {
    Cu.updateCultivator(userId, { partner_id: null, dao_lu_level: 1, dao_lu_intimacy: 0 });
    return '⚠️ Quan hệ đạo lữ không đồng bộ, hệ thống đã tự bảo vệ dữ liệu.';
  }
  const old = int(row.dao_lu_level || 1); const intimacy = int(row.dao_lu_intimacy || 0) + K.DAO_LU_INTIMACY_PER_DAILY; const lv = daoLuLevelFromIntimacy(intimacy);
  D.run('UPDATE cultivators SET dao_lu_intimacy = ?, dao_lu_level = ?, last_dao_lu_daily = ? WHERE user_id IN (?, ?)', intimacy, lv, t, userId, pid);
  if (lv > old) return `${E.daolu_ketdoi} **Đạo Duyên đột phá!** Cấp ${lv} — ${daoLuTitle(lv)}. Buff song tu tăng lên **+${(daoLuBonus(lv) * 100).toFixed(0)}%**.`;
  return `💞 Vun đắp đạo duyên thành công: **+${K.DAO_LU_INTIMACY_PER_DAILY} Thân Mật**. Hiện tại Cấp ${lv}.`;
}

function breakSongtu(userId) {
  const row = Cu.getCultivator(userId);
  if (!row) return '❌ Bạn chưa bắt đầu tu tiên, dùng `/batdau` trước.';
  if (!row.partner_id) return '❌ Bạn chưa có đạo lữ.';
  const pid = row.partner_id;
  D.transaction(() => {
    D.run('UPDATE cultivators SET partner_id = NULL, dao_lu_level = 1, dao_lu_intimacy = 0, dao_lu_started_at = 0, last_dao_lu_daily = 0 WHERE user_id IN (?, ?)', userId, pid);
    D.run('DELETE FROM songtu_pending WHERE from_id = ? OR to_id = ?', userId, userId);
  });
  return `${E.daolu_chiatay} Hai người đã **giải trừ đạo duyên**. Cấp Đạo Duyên và buff song tu được đặt lại.`;
}
Object.assign(module.exports, { requestSongtu, acceptSongtu, daoLuStatus, daoLuDaily, breakSongtu });
