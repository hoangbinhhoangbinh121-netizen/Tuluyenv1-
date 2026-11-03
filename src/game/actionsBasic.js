'use strict';
/** do_tuluyen / do_dongquan / do_canngo / do_linhmach / do_hoi_hp — port 1:1 từ tuluyenbot.py */
const K = require('./constants');
const CD = require('./cooldowns');
const R = require('./realm');
const Cu = require('./cultivator');
const F = require('./format');
const { E } = require('./emoji');
const { getSectExpBuffMult } = require('./sectBase');
const { daoLuBonusFromRow } = require('./daolu');
const { now, int, randInt, random, fmtNum } = require('../util');

const TULUYEN_BUFF_MULT = K.TULUYEN_BUFF_MULT;
const tuluyenBuffMult = (userId) => (K.TULUYEN_BUFF_EXCLUDED_USER_IDS.includes(String(userId)) ? 1.0 : TULUYEN_BUFF_MULT);
const COMPENSATION = 14;

function talentMult(row) {
  return Math.min(R.getMult(K.LINH_CAN, row.linh_can) * R.getMult(K.THE_CHAT, row.the_chat), K.TULUYEN_TALENT_MULT_CAP);
}

/** Tu luyện — trả dữ liệu có cấu trúc (UI v7 dựng Embed từ đây). */
function tuluyenR(userId) {
  const row = Cu.getCultivator(userId);
  const t = now();
  const remain = CD.COOLDOWN_TULUYEN - (t - row.last_tuluyen);
  if (remain > 0) return { ok: false, kind: 'tuluyen', remain };
  const cpBonus = 1 + Cu.effectiveCongPhapBonus(row);
  const wt = R.worldMult(row.world_tier);
  const st = 1.0 + daoLuBonusFromRow(row);
  const sectBuff = getSectExpBuffMult(row);
  const buff = tuluyenBuffMult(userId);
  const mult = R.realmSpeedMult(row.realm_index) * talentMult(row) * cpBonus * wt * st * sectBuff * buff;
  const gained = int(randInt(8, 15) * COMPENSATION * mult);
  Cu.updateCultivator(userId, { tu_vi: row.tu_vi + gained, last_tuluyen: t });
  return { ok: true, kind: 'tuluyen', gained, mult, sectBuff: sectBuff > 1, buff: buff > 1, before: row.tu_vi, after: row.tu_vi + gained, row: Cu.getCultivator(userId), cooldown: CD.COOLDOWN_TULUYEN };
}
function doTuluyen(userId) {
  const r = tuluyenR(userId);
  if (!r.ok) return `⏳ Còn ${F.fmtTime(r.remain)} nữa mới tu luyện tiếp được.`;
  let note = r.sectBuff ? ' (đã gồm buff +5% EXP Tông Môn Chiến)' : '';
  if (r.buff) note += ' (✨ đang có buff Tu Luyện, hấp thụ linh khí nhanh hơn hẳn)';
  return `${E.tuluyen} Tu luyện thành công, nhận được **${fmtNum(r.gained)}** tu vi${note}.`;
}

function dongquanR(userId) {
  const row = Cu.getCultivator(userId);
  const t = now();
  const remain = CD.COOLDOWN_DONGQUAN - (t - row.last_dongquan);
  if (remain > 0) return { ok: false, kind: 'dongquan', remain };
  const cpBonus = 1 + Cu.effectiveCongPhapBonus(row);
  const sectBuff = getSectExpBuffMult(row);
  const mult = R.realmSpeedMult(row.realm_index) * talentMult(row) * cpBonus * R.worldMult(row.world_tier) * (1.0 + daoLuBonusFromRow(row)) * sectBuff;
  const gained = int(randInt(80, 150) * mult);
  const linhThachGain = gained * 500;
  Cu.updateCultivator(userId, { tu_vi: row.tu_vi + gained, linh_thach: row.linh_thach + linhThachGain, last_dongquan: t });
  return { ok: true, kind: 'dongquan', gained, linhThachGain, mult, sectBuff: sectBuff > 1, before: row.tu_vi, after: row.tu_vi + gained, row: Cu.getCultivator(userId), cooldown: CD.COOLDOWN_DONGQUAN };
}
function doDongquan(userId) {
  const r = dongquanR(userId);
  if (!r.ok) return `⏳ Còn ${F.fmtTime(r.remain)} nữa mới bế quan tiếp được.`;
  const note = r.sectBuff ? ' (đã gồm buff +5% EXP Tông Môn Chiến)' : '';
  return `${E.bequan} Bế quan xong, nhận được **${fmtNum(r.gained)}** tu vi và **${fmtNum(r.linhThachGain)}** ${E.linhthach} Linh Thạch${note}.`;
}

function doCanngo(userId) {
  const row = Cu.getCultivator(userId);
  const t = now();
  const remain = CD.COOLDOWN_CANNGO - (t - row.last_canngo);
  if (remain > 0) return `⏳ Còn ${F.fmtTime(remain)} nữa mới cảm ngộ tiếp được.`;
  if (random() < 0.35) {
    const gained = randInt(1, 3);
    Cu.updateCultivator(userId, { ngo_tinh: row.ngo_tinh + gained, last_canngo: t });
    return `${E.linhngo} Ngộ đạo! Nhận thêm **${gained}** Độ Lĩnh Ngộ.`;
  }
  Cu.updateCultivator(userId, { last_canngo: t });
  return `${E.linhngo} Cảm ngộ nhưng chưa lĩnh hội được gì, thử lại sau.`;
}

function doLinhmach(userId) {
  const row = Cu.getCultivator(userId);
  const t = now();
  const remain = CD.COOLDOWN_LINHMACH - (t - row.last_linhmach);
  if (remain > 0) return `⏳ Còn ${F.fmtTime(remain)} nữa mới hấp thụ linh mạch tiếp được.`;
  const gained = randInt(3, 8);
  const linhLucGain = randInt(4, 9);
  const newLinhLuc = Math.min(100, row.linh_luc + linhLucGain);
  Cu.updateCultivator(userId, { khi_van: row.khi_van + gained, linh_luc: newLinhLuc, last_linhmach: t });
  return `${E.linhmach} Hấp thụ linh khí, nhận **${gained}** Khí Vận và **+${linhLucGain}%** ${E.linhluc} Linh Lực (${newLinhLuc}%).`;
}

function doHoiHp(userId) {
  let row = Cu.getCultivator(userId);
  const curHp = Cu.syncHpRegen(userId, row);
  row = Cu.getCultivator(userId);
  const maxHp = Cu.effectiveMaxHp(row);
  const bar = F.emojiProgressBar(curHp, maxHp, F.EMOJI_BAR_GREEN);
  if (curHp >= maxHp) return `💚 **Hồi HP** — Sinh Mệnh đã ĐẦY!\n${bar}\n${fmtNum(curHp)}/${fmtNum(maxHp)}`;
  const missing = maxHp - curHp;
  const minutesLeft = missing / (maxHp * Cu.HP_REGEN_PER_MINUTE);
  return `💚 **Hồi HP** — đang hồi phục dần theo thời gian (0.5% Sinh Mệnh tối đa/phút), không cần làm gì thêm, chỉ cần chờ:\n${bar}\n${fmtNum(curHp)}/${fmtNum(maxHp)}\n⏳ Còn khoảng **${F.fmtTime(minutesLeft * 60)}** nữa là hồi ĐẦY 100%.`;
}

module.exports = { tuluyenR, dongquanR, doTuluyen, doDongquan, doCanngo, doLinhmach, doHoiHp, tuluyenBuffMult };
