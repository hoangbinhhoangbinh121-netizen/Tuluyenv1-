'use strict';
/** Thông báo toàn thế giới (spec §4) — mẫu riêng, chỉ dành cho sự kiện có ý nghĩa toàn cục. */
const { createEmbed } = require('../components/baseEmbed');
const { COLORS } = require('../theme/colors');
const { DIVIDER } = require('../theme/typography');
const { E } = require('../emojis');
const { num, safe, discordTime } = require('../format');

const FOOT = 'TIÊN GIỚI · THIÊN ĐẠO';
const mk = (rawTitle, color, lines, closing, extraFooter) => createEmbed({
  cat: 'thiendao', rawTitle, color, description: [...lines, '', closing, DIVIDER].join('\n'), footer: extraFooter || undefined,
}).setFooter({ text: extraFooter || FOOT });

function breakthrough({ player, oldRealm, newRealm, sect, location }) {
  return mk('✦ THIÊN ĐẠO GIÁM CHỨNG ✦', COLORS.PRIMARY, [
    'Một vị tu sĩ đã nghịch thiên mà đi,\nphá vỡ bình cảnh, bước vào cảnh giới mới.', '',
    `${E.thanhvien} Nhân vật: **${safe(player)}**`,
    `${E.linhngothiendao} Cảnh giới: ${safe(oldRealm)} → **${safe(newRealm)}**`,
    `${E.tongmon} Tông môn: ${safe(sect, 'Tán tu')}`,
    `${E.bando} Địa điểm: ${safe(location, 'Thiên Địa')}`,
  ], 'Thiên địa chấn động, linh khí hội tụ.\nDị tượng xuất thế, vạn tu cùng chứng kiến.');
}

function bossSpawn({ name, realm, hp, location, expiresAt, summoner }) {
  return mk('⚠ THIÊN ĐỊA CẢNH BÁO ⚠', COLORS.DANGER, [
    '**YÊU THÚ CẤP THẾ GIỚI XUẤT THẾ**', '',
    `${E.bosstg} Boss: **${safe(name)}**`,
    `${E.linhngothiendao} Cảnh giới: ${safe(realm)}`,
    `${E.hp} Sinh mệnh: **${num(hp)}**`,
    `${E.bando} Địa điểm: ${safe(location, 'Thiên Địa')}`,
    `${E.sk_thoigian} Tồn tại đến: ${expiresAt ? discordTime(expiresAt, 'R') : '—'}`,
    summoner ? `${E.loa} Triệu hồi bởi: ${summoner}` : '',
  ], 'Các vị đạo hữu có thể tập hợp lực lượng,\ncùng nhau tiến đến trấn áp yêu thú.', '✦ THIÊN ĐẠO · THẾ GIỚI');
}

function bossDefeated({ name, killer, top = [], totalDamage }) {
  const medals = ['🥇', '🥈', '🥉'];
  return mk('✦ YÊU THÚ BỊ TRẤN ÁP ✦', COLORS.SUCCESS, [
    `${E.bosstg} **${safe(name)}** đã bị đánh gục!`, '',
    `${E.kiem} Đòn kết liễu: **${safe(killer)}**`,
    `${E.satthuong} Tổng sát thương: **${num(totalDamage)}**`, '',
    '**BẢNG CÔNG TRẠNG**', ...top.map((t, i) => `${medals[i] || `**${i + 1}.**`} ${t.name} — ${num(t.damage)}`),
  ], 'Vạn tu cùng chung tay, thiên địa lại thanh bình.', '✦ THIÊN ĐẠO · THẾ GIỚI');
}

function bossEscaped({ name }) {
  return mk('✦ YÊU THÚ ĐÃ TRỐN THOÁT ✦', COLORS.SYSTEM, [`${E.bosstg} **${safe(name)}** đã biến mất vào hư không khi hết thời hạn.`], 'Phần thưởng được chia theo sát thương đã gây ra.', '✦ THIÊN ĐẠO · THẾ GIỚI');
}

function sectWar({ sectA, sectB, status, time, location }) {
  return mk('⚔ ĐẠI CHIẾN TÔNG MÔN ⚔', COLORS.DANGER, [
    `**${safe(sectA)}** VS **${safe(sectB)}**`, '',
    `${E.tongmon} Phe thứ nhất: ${safe(sectA)}`, `${E.tongmon} Phe thứ hai: ${safe(sectB)}`,
    `${E.kiem} Trạng thái: ${safe(status)}`, `${E.sk_thoigian} Thời gian: ${safe(time)}`, `${E.bando} Chiến trường: ${safe(location)}`,
  ], '', 'THIÊN ĐẠO · CHIẾN TRƯỜNG');
}

function worldEvent({ title, description, location, duration, reward }) {
  return mk('✦ THIÊN ĐẠO · DỊ BIẾN ✦', COLORS.PRIMARY, [
    `**${safe(title)}**`, safe(description, ''), '',
    `${E.bando} Khu vực: ${safe(location)}`, `${E.sk_thoigian} Thời hạn: ${safe(duration)}`, `${E.sk_phanthuong} Cơ duyên: ${safe(reward)}`,
  ], 'Một thời đại mới có thể bắt đầu từ đây.');
}
module.exports = { breakthrough, bossSpawn, bossDefeated, bossEscaped, sectWar, worldEvent };
