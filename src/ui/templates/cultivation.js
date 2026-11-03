'use strict';
/** Mẫu giao diện Tu luyện (spec §3.2): bắt đầu · đang tu luyện · hoàn thành · cooldown. */
const R = require('../../game/realm');
const { createEmbed } = require('../components/baseEmbed');
const { progressBar } = require('../components/progressBar');
const { statField } = require('../components/statField');
const { E } = require('../emojis');
const N = require('../notifications');
const { num, exp, dur, safe } = require('../format');
const { COLORS } = require('../theme/colors');

const MULT = (m) => `×${(Math.round((Number(m) || 0) * 100) / 100).toString().replace('.', ',')}`;
const LABEL = { tuluyen: ['Vận Chuyển Chu Thiên', 'Đạo hữu đã hấp thu linh khí để gia tăng tu vi.', 'tuluyen'], dongquan: ['Bế Quan Thanh Tu', 'Đạo hữu đóng cửa tĩnh tu, linh khí thấm vào từng kinh mạch.', 'bequan'] };

/** Khung "đang tu luyện" cho hiệu ứng thanh chạy (step 0..steps). */
function inProgress(kind, step, steps) {
  const [title, , icon] = LABEL[kind] || LABEL.tuluyen;
  return createEmbed({
    cat: 'tuluyen', status: 'Đang tu luyện', title,
    description: `${E[icon]} Đạo hữu đang hấp thu linh khí...\n${progressBar(step, steps, { kind: 'green', length: 10 })}`,
  });
}

/** Kết quả tu luyện / bế quan thành công. r: dữ liệu từ A.tuluyenR / A.dongquanR */
function result(r) {
  const [title, intro] = LABEL[r.kind] || LABEL.tuluyen;
  const row = r.row;
  const required = R.tuViRequired(row.realm_index, row.stage_index, row.world_tier);
  const ready = row.tu_vi >= required;
  const fields = [
    statField('linhmach', 'Linh khí hấp thu', `+${num(r.gained)}`),
    statField('linhluc', 'Hiệu suất', MULT(r.mult)),
    statField('sk_thoigian', 'Hồi chiêu', dur(r.cooldown)),
  ];
  if (r.kind === 'dongquan') fields.push(statField('linhthach', 'Linh thạch', `+${num(r.linhThachGain)}`));
  fields.push({ name: `${E.tuvi || E.linhngo} Tiến độ đột phá`, value: `${progressBar(row.tu_vi, required, { kind: 'tuvi' })}\n**${exp(row.tu_vi, required)}** EXP`, inline: false });
  const notes = [];
  if (r.sectBuff) notes.push(`${E.tongmon} Đã gồm buff +5% EXP Tông Môn Chiến.`);
  if (r.buff) notes.push('✨ Đang có buff Tu Luyện — hấp thụ linh khí nhanh hơn hẳn.');
  if (ready) notes.push(`${E.dotpha} **Đã đủ tu vi — có thể Đột Phá!**`);
  return createEmbed({
    cat: 'tuluyen', status: 'Hoàn thành tu luyện', title, color: COLORS.CULTIVATION,
    description: [intro, `✦ Tu vi đã tăng trưởng\n${R.realmDisplay(row.realm_index, row.stage_index)} · ${num(r.before)} → ${num(r.after)} EXP`, ...notes].join('\n'),
    fields,
  });
}

function cooldown(kind, remain) {
  const verb = kind === 'dongquan' ? 'bế quan' : 'tu luyện';
  return N.cooldown(`Còn **${dur(remain)}** nữa mới ${verb} tiếp được.`);
}

/** Kết quả đơn giản (cảm ngộ / linh mạch / hồi HP): text cũ → Embed tu luyện chuẩn. */
function simple(text, header) {
  if (/^⏳/.test(text)) return N.cooldown(text.replace(/^⏳\s*/, ''));
  return createEmbed({ cat: 'tuluyen', header, description: String(safe(text, '')) });
}
module.exports = { inProgress, result, cooldown, simple, MULT };
