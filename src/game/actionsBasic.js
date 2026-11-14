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
const BAL = require('./balance');
const T = require('./talent');
const TO = require('./talentOps');
const ST = require('./settings');
const { now, int, randInt, random, randUniform, fmtNum } = require('../util');

const TULUYEN_BUFF_MULT = K.TULUYEN_BUFF_MULT;
const tuluyenBuffMult = (userId) => (K.TULUYEN_BUFF_EXCLUDED_USER_IDS.includes(String(userId)) ? 1.0 : TULUYEN_BUFF_MULT);
const COMPENSATION = 14;

// v12.3: Linh Căn × Thể Chất (trần 9.0 — trước đây trần 3.0 khiến Thánh/Tiên/Hỗn Độn Linh Căn ngang nhau)
const talentMult = (row) => BAL.talentMult(row);

/** Hệ số nhân tu vi của Tu Luyện thường: tư chất × công pháp × thế giới × đạo lữ × buff Tông Môn × buff Tu Luyện. Bế Quan Treo dùng chung. */
function tuluyenMultFor(userId, row) {
  const cpBonus = Cu.cpTuMult(row);
  const wt = R.worldMult(row.world_tier);
  const st = 1.0 + daoLuBonusFromRow(row);
  const sectBuff = getSectExpBuffMult(row);
  const buff = tuluyenBuffMult(userId);
  // v13.6: độ tinh khiết Linh Căn (×0,85–1,15, trung bình 1) và hiệu ứng Thể Chất/Linh Căn (+tối đa 35%) — Ngũ/Phàm không đổi
  const fx = T.tuluyenPurity(row) * (1 + T.bundle(row).tu);
  // v13.7: sự kiện tăng tốc toàn server do admin đặt (/tangtoctuluyen) — nhân thêm cho Tu Luyện và Bế Quan Treo
  return { mult: talentMult(row) * fx * cpBonus * wt * st * sectBuff * buff * ST.speedMult(), sectBuff, buff };
}

/**
 * v14.2: tu vi KỲ VỌNG mỗi lần bấm Tu Luyện (đúng công thức tuluyenR: sàn công thức cũ, ×TULUYEN_SPEED_MULT, cơ hội ×2 của thiên phú).
 * Bế Quan Treo lấy giá trị này × TREO_EFFICIENCY → treo luôn đúng bằng 5% tốc độ bấm tay ở MỌI cảnh giới
 * (trước v14.2 treo thiếu ×3 TULUYEN_SPEED_MULT và bỏ qua sàn Phàm Nhân nên chỉ nhận ~1,7% và ~0,03%).
 */
function tuluyenExpectedPerClick(userId, row, opts = {}) {
  const { mult } = tuluyenMultFor(userId, row);
  const need = R.tuViRequiredBase(row.realm_index, row.stage_index, row.world_tier);
  const tb = BAL.tuluyenBase(need, row.realm_index, row.stage_index, CD.COOLDOWN_TULUYEN);
  const rs = R.realmSpeedMult(row.realm_index);
  let sum = 0; let n = 0;
  for (let k = 8; k <= 15; k += 1) for (let q = 0; q < 21; q += 1) { sum += Math.max(k * COMPENSATION * rs, tb * (0.85 + 0.3 * (q + 0.5) / 21)); n += 1; }
  const base = sum / n;
  // v15: opts.noProc = bỏ cơ hội nhận gấp đôi (Bế Quan Treo không được x2, chỉ tích lũy đều như bấm tay thường)
  return Math.max(1, base * mult * BAL.B.TULUYEN_SPEED_MULT) * (opts.noProc ? 1 : (1 + T.bundle(row).proc));
}

// v16: "tu luyện quá nhanh" → giảm nhẹ. Bộ đếm theo bộ nhớ (khởi động lại bot = đếm lại, chỉ có lợi cho người chơi).
const _tuTimes = new Map();
function tuluyenFatigue(userId, t, record = true) {
  const W = BAL.B.TULUYEN_FATIGUE_WINDOW; const key = String(userId);
  const arr = (_tuTimes.get(key) || []).filter((x) => t - x < W);
  const n = arr.length;                                   // số lần đã bấm trong cửa sổ (chưa tính lần này)
  if (record) { arr.push(t); _tuTimes.set(key, arr); }
  const full = Math.max(BAL.B.TULUYEN_FATIGUE_FREE + 1, Math.floor(W / CD.COOLDOWN_TULUYEN));
  const over = Math.max(0, n - BAL.B.TULUYEN_FATIGUE_FREE);
  return 1 - BAL.B.TULUYEN_FATIGUE_MAX * Math.min(1, over / (full - BAL.B.TULUYEN_FATIGUE_FREE));
}

/** Tu luyện — trả dữ liệu có cấu trúc (UI v7 dựng Embed từ đây). */
function tuluyenR(userId) {
  const row = Cu.getCultivator(userId);
  const t = now();
  const remain = CD.COOLDOWN_TULUYEN - (t - row.last_tuluyen);
  if (remain > 0) return { ok: false, kind: 'tuluyen', remain };
  const { mult, sectBuff, buff } = tuluyenMultFor(userId, row);
  // v12.3: tu vi mỗi lần = tu vi cần cho tầng kế / số lần bấm chuẩn của tầng đó (xem balance.js), nhân tư chất & buff.
  const need = R.tuViRequiredBase(row.realm_index, row.stage_index, row.world_tier); // mốc GỐC: tốc độ không đổi khi tăng exp đột phá
  const oldBase = randInt(8, 15) * COMPENSATION * R.realmSpeedMult(row.realm_index);   // công thức cũ làm sàn (Phàm Nhân)
  const base = Math.max(oldBase, BAL.tuluyenBase(need, row.realm_index, row.stage_index, CD.COOLDOWN_TULUYEN) * randUniform(0.85, 1.15));
  const fatigue0 = tuluyenFatigue(userId, t);
  const fatigue = 1 - (1 - fatigue0) * (1 - require('./fx17').stat(row, 'fatigueCut'));   // v17: Thanh Tâm Đan giảm mệt tu luyện dồn dập
  let gained = Math.max(1, int(base * mult * BAL.B.TULUYEN_SPEED_MULT * fatigue));
  const proc = random() < T.bundle(row).proc;      // v13.6: Hỗn Độn Diễn Sinh / Thời Quang...: cơ hội nhận gấp đôi
  if (proc) gained *= 2;
  Cu.updateCultivator(userId, { tu_vi: row.tu_vi + gained, last_tuluyen: t, ...TO.progFields(row, { lc: 1 }) });
  return { ok: true, kind: 'tuluyen', proc, fatigue, gained, mult, sectBuff: sectBuff > 1, buff: buff > 1, before: row.tu_vi, after: row.tu_vi + gained, row: Cu.getCultivator(userId), cooldown: CD.COOLDOWN_TULUYEN };
}
function doTuluyen(userId) {
  const r = tuluyenR(userId);
  if (!r.ok) return `⏳ Còn ${F.fmtTime(r.remain)} nữa mới tu luyện tiếp được.`;
  let note = r.sectBuff ? ' (đã gồm buff +5% EXP Tông Môn Chiến)' : '';
  if (r.buff) note += ' (✨ đang có buff Tu Luyện, hấp thụ linh khí nhanh hơn hẳn)';
  if (r.fatigue < 0.995) note += ` (😮‍💨 tu luyện dồn dập nên linh khí hấp thụ kém đi −${Math.round((1 - r.fatigue) * 100)}%)`;
  if (r.proc) note += ' (🌀 Thiên phú diễn sinh — nhận **gấp đôi** tu vi!)';
  return `${E.tuluyen} Tu luyện thành công, nhận được **${fmtNum(r.gained)}** tu vi${note}.`;
}

function dongquanR(userId) {
  const row = Cu.getCultivator(userId);
  const t = now();
  const remain = CD.COOLDOWN_DONGQUAN - (t - row.last_dongquan);
  if (remain > 0) return { ok: false, kind: 'dongquan', remain };
  const cpBonus = Cu.cpTuMult(row);
  const sectBuff = getSectExpBuffMult(row);
  const worldDao = R.worldMult(row.world_tier) * (1.0 + daoLuBonusFromRow(row)) * sectBuff;
  const mult = talentMult(row) * T.tuluyenPurity(row) * (1 + T.bundle(row).tu) * cpBonus * worldDao;
  const need = R.tuViRequiredBase(row.realm_index, row.stage_index, row.world_tier); // mốc GỐC: tốc độ không đổi khi tăng exp đột phá
  const oldGained = int(randInt(80, 150) * R.realmSpeedMult(row.realm_index) * mult);
  // v12.3: 1 lần Bế Quan = 12% tu vi cần cho tầng kế (tư chất chuẩn) × tư chất; Linh Thạch GIỮ NGUYÊN công thức cũ để không lạm phát.
  const gained = Math.max(oldGained, int(BAL.dongquanBase(need) * mult * BAL.B.TULUYEN_SPEED_MULT * ST.speedMult() * randUniform(0.9, 1.1)));   // v13.7: sự kiện tăng tốc chỉ nhân tu vi, KHÔNG nhân Linh Thạch
  const linhThachGain = oldGained * 500;
  Cu.updateCultivator(userId, { tu_vi: row.tu_vi + gained, linh_thach: row.linh_thach + linhThachGain, last_dongquan: t, ...TO.progFields(row, { lc: 3 }) });
  return { ok: true, kind: 'dongquan', gained, linhThachGain, mult, sectBuff: sectBuff > 1, before: row.tu_vi, after: row.tu_vi + gained, row: Cu.getCultivator(userId), cooldown: CD.COOLDOWN_DONGQUAN };
}
function doDongquan(userId) {
  const r = dongquanR(userId);
  if (!r.ok) return `⏳ Còn ${F.fmtTime(r.remain)} nữa mới bế quan tiếp được.`;
  const note = r.sectBuff ? ' (đã gồm buff +5% EXP Tông Môn Chiến)' : '';
  return `${E.bequan} Bế quan xong, nhận được **${fmtNum(r.gained)}** tu vi và **${fmtNum(r.linhThachGain)}** ${E.linhthach} Linh Thạch${note}.`;
}

/** v16: Kỳ Ngộ (module mới, độc lập) — mỗi lần Cảm Ngộ có cơ hội rất nhỏ gặp kỳ ngộ nhận công pháp / mảnh bí tịch. Lỗi ở đây không được làm hỏng Cảm Ngộ. */
function kyNgo(userId, row) { try { return require('./congphapV16').rollKyNgo(userId, row); } catch (e) { console.error('⚠️ Kỳ Ngộ:', e.message); return ''; } }

function doCanngo(userId) {
  const row = Cu.getCultivator(userId);
  const t = now();
  const remain = CD.COOLDOWN_CANNGO - (t - row.last_canngo);
  if (remain > 0) return `⏳ Còn ${F.fmtTime(remain)} nữa mới cảm ngộ tiếp được.`;
  const fxN = T.bundle(row);
  if (random() < Math.min(0.6, 0.35 + fxN.ngo + require('./fx17').stat(row, 'ngo') * 0.01)) {   // v17: + Ngưng Thần Đan     // v13.6: Thể Chất/Linh Căn tăng tỉ lệ Ngộ đạo (tối đa +12%)
    const gained = Math.max(1, Math.round(randInt(1, 3) * Math.min(1.4, T.absorbMult(row))));
    Cu.updateCultivator(userId, { ngo_tinh: row.ngo_tinh + gained, last_canngo: t });
    return `${E.linhngo} Ngộ đạo! Nhận thêm **${gained}** Độ Lĩnh Ngộ.${kyNgo(userId, row)}`;
  }
  Cu.updateCultivator(userId, { last_canngo: t });
  return `${E.linhngo} Cảm ngộ nhưng chưa lĩnh hội được gì, thử lại sau.${kyNgo(userId, row)}`;
}

function doLinhmach(userId) {
  const row = Cu.getCultivator(userId);
  const t = now();
  const remain = CD.COOLDOWN_LINHMACH - (t - row.last_linhmach);
  if (remain > 0) return `⏳ Còn ${F.fmtTime(remain)} nữa mới hấp thụ linh mạch tiếp được.`;
  const am = T.absorbMult(row);      // v13.6: hấp thu linh khí (độ tinh khiết × hiệu ứng Thể Chất/Linh Căn)
  const gained = Math.max(1, Math.round(randInt(3, 8) * am));
  const linhLucGain = Math.max(1, Math.round(randInt(4, 9) * am));
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

module.exports = { tuluyenFatigue, tuluyenExpectedPerClick, tuluyenR, dongquanR, doTuluyen, doDongquan, doCanngo, doLinhmach, doHoiHp, tuluyenBuffMult, tuluyenMultFor };
