'use strict';
/** do_dotpha + Cửu Lôi Kiếp — port 1:1 */
const K = require('./constants');
const BAL = require('./balance');
const CD = require('./cooldowns');
const R = require('./realm');
const Cu = require('./cultivator');
const F = require('./format');
const { E } = require('./emoji');
const { now, int, random, randUniform, fmtNum } = require('../util');

function resolveCuuLoiKiep(userId, row) {
  const phuCol = R.phuCol(row.world_tier);
  const phuAvailable = row[phuCol];
  let phuUsed = 0;
  const maxHp = Cu.effectiveMaxHp(row);
  let curHp = Cu.syncHpRegen(userId, row);
  const dodgeRate = Math.min(0.88, K.CUULOIKIEP_DODGE_BASE + row.ngo_tinh * 0.01);
  const log = [];
  for (let i = 1; i <= K.CUULOIKIEP_SO_DAO; i++) {
    if (phuAvailable > phuUsed) {
      phuUsed++;
      log.push(`⚡ Đạo lôi ${i}/9: dùng 1 ${R.linhphuLabel(row)} đỡ trọn — an toàn.`);
      continue;
    }
    if (random() < dodgeRate) { log.push(`⚡ Đạo lôi ${i}/9: tự thân chống đỡ thành công, không hề hấn gì.`); continue; }
    const dmg = int(maxHp * randUniform(K.CUULOIKIEP_DMG_PCT_MIN, K.CUULOIKIEP_DMG_PCT_MAX));
    curHp -= dmg;
    log.push(`💥 Đạo lôi ${i}/9: trúng đòn, mất ${fmtNum(dmg)} Sinh Mệnh (còn ${fmtNum(Math.max(curHp, 0))}/${fmtNum(maxHp)}).`);
    if (curHp <= 0) {
      log.push('☠️ Sinh Mệnh cạn kiệt giữa Cửu Lôi Kiếp — ĐỘT PHÁ THẤT BẠI!');
      Cu.updateCultivator(userId, { [phuCol]: row[phuCol] - phuUsed, cur_hp: 1 });
      return [false, log.join('\n'), phuUsed];
    }
  }
  Cu.updateCultivator(userId, { [phuCol]: row[phuCol] - phuUsed, cur_hp: Math.max(1, curHp) });
  return [true, log.join('\n'), phuUsed];
}

function doDotpha(userId) {
  const row = Cu.getCultivator(userId);
  if (Cu.ngusuyActive(row)) {
    const idx = Math.min(row.ngusuy_stage, K.NGUSUY_STAGES.length - 1);
    return `🌪️ Đang chịu **${K.NGUSUY_STAGES[idx].name}** (Thiên Nhân Ngũ Suy) — không thể Đột Phá lúc này. Hãy vượt qua từng giai đoạn trước (\`/thiennhanngusuy\`).`;
  }
  const t = now();
  const remainFail = CD.COOLDOWN_DOTPHA_FAIL - (t - row.last_dotpha_fail);
  if (remainFail > 0) {
    return `⏳ Vừa đột phá thất bại, cần dưỡng thương thêm **${F.fmtTime(remainFail)}** mới thử lại được.\n${E.phagioidan} Dùng nút **Dùng Đan Dược** để cắn Đan Dược Phá Giới, bỏ tối đa 5 phút mỗi viên.`;
  }
  const realmIdx = row.realm_index; const stageIdx = row.stage_index;
  const required = R.tuViRequired(realmIdx, stageIdx, row.world_tier);
  if (row.tu_vi < required) return `❌ Chưa đủ tu vi để đột phá (cần ${required}, hiện có ${row.tu_vi}).`;
  const nxt = R.nextStage(realmIdx, stageIdx);
  if (nxt === null) return '♾️ Bạn đã đạt đến Tiên Đế, cảnh giới tối cao!';

  let rate = K.BASE_BREAKTHROUGH_RATE - realmIdx * 0.005 + row.ngo_tinh * 0.01 + row.khi_van * 0.005;
  rate = Math.max(0.15, Math.min(0.97, rate));
  if (realmIdx === K.DOKIEP_REALM_IDX) rate = Math.max(0.15, Math.min(0.75, rate - 0.10));

  if (random() < rate) {
    const [newRealm, newStage] = nxt;
    if (row.world_tier === 0 && newRealm > K.HOATHAN_REALM_IDX) {
      Cu.updateCultivator(userId, { tu_vi: row.tu_vi - required, realm_index: K.HOATHAN_REALM_IDX, stage_index: K.HOATHAN_VIENMAN_STAGE });
      return `🌀 ĐỘT PHÁ THÀNH CÔNG nhưng bị **ÁP CHẾ** đè trở lại **${R.realmDisplay(K.HOATHAN_REALM_IDX, K.HOATHAN_VIENMAN_STAGE)}**!\nCảnh giới trên Hóa Thần Viên Mãn chỉ dành cho người đã **Phi Thăng** thật sự — dùng \`/dieukienphithang\` để xem điều kiện rồi \`/phithang\` khi đã đủ.`;
    }
    // v12.3: mỗi tiểu cảnh giới cộng chỉ số THEO ĐẠI CẢNH GIỚI hiện tại và THỂ CHẤT — xem game/balance.js
    const G = BAL.stageGain(realmIdx, row.world_tier, row);
    let hpGain = G.hp; let atkGain = G.atk; let defGain = G.def; let spdGain = G.spd;
    let majorNote = ''; let kiepLog = '';
    if (newRealm > realmIdx) {
      const [passed, log, phuUsed] = resolveCuuLoiKiep(userId, row);
      kiepLog = `\n${E.thienkiep} **CỬU LÔI KIẾP** (${phuUsed}/9 đạo dùng ${R.linhphuLabel(row)}):\n${log}`;
      if (!passed) {
        Cu.updateCultivator(userId, { tu_vi: int(row.tu_vi * 0.85), last_dotpha_fail: now() });
        return `${kiepLog}\n💥 KHÔNG VƯỢT QUA ĐƯỢC CỬU LÔI KIẾP — đột phá **${K.REALMS[newRealm].name}** thất bại, trọng thương phải dưỡng thương **${F.fmtTime(CD.COOLDOWN_DOTPHA_FAIL)}** (dùng ${E.phagioidan} Đan Dược Phá Giới ở nút **Dùng Đan Dược** để bỏ bớt, tối đa 5 phút/viên).`;
      }
      const cur = Cu.calcLucChien(row);
      const gainedLc = Math.max(int(cur * K.MAJOR_REALM_BREAKTHROUGH_LUC_CHIEN_MIN_PCT), int(cur * K.MAJOR_REALM_BREAKTHROUGH_LUC_CHIEN_PCT));
      const extra = int(gainedLc / 7);
      hpGain += extra; atkGain += extra; defGain += extra; spdGain += extra;
      majorNote = `\n👑 **ĐỘT PHÁ ĐẠI CẢNH GIỚI!** Bước sang **${K.REALMS[newRealm].name}** — cộng thêm **+${fmtNum(gainedLc)}** Lực Chiến (+${int(K.MAJOR_REALM_BREAKTHROUGH_LUC_CHIEN_PCT * 100)}% Lực Chiến hiện tại, tuỳ chỉ số/công pháp của bạn — atk/def/spd/hp đều +${fmtNum(extra)})!`;
      if (newRealm === K.DOKIEP_REALM_IDX) {
        Cu.updateCultivator(userId, { ruong_bonus_lucchien: (row.ruong_bonus_lucchien || 0) + K.DOKIEP_BREAKTHROUGH_LUC_CHIEN_BONUS });
        majorNote += `\n${E.thienkiep} **CHẠM ĐỘ KIẾP — CỘNG THẲNG +${fmtNum(K.DOKIEP_BREAKTHROUGH_LUC_CHIEN_BONUS)} LỰC CHIẾN!** Đây là bàn đạp hướng tới mốc **${fmtNum(K.TIENGIOI_LUC_CHIEN_CAN)}** Lực Chiến cần để Phi Thăng Tiên Giới.`;
      }
    }
    const curHpAfter = newRealm > realmIdx ? true : null;
    const upd = {
      tu_vi: row.tu_vi - required, realm_index: newRealm, stage_index: newStage,
      hp: row.hp + hpGain, atk: row.atk + atkGain, def_: row.def_ + defGain, spd: row.spd + spdGain,
    };
    if (curHpAfter !== null) {
      // _cp_scale(row) * (hp + hp_gain) + ruong_bonus_hp — tính trực tiếp, như bản Python
      const scale = Cu.cpScale(row);
      upd.cur_hp = int((row.hp + hpGain) * scale) + int(row.ruong_bonus_hp || 0);
      upd.last_hp_regen = now();
    }
    Cu.updateCultivator(userId, upd);
    const heal = curHpAfter !== null ? '\n💚 Vượt qua Cửu Đại Lôi Kiếp — Sinh Mệnh được hồi ĐẦY hoàn toàn!' : '';
    return `${E.dotpha} ĐỘT PHÁ THÀNH CÔNG! Tiến lên **${R.realmDisplay(newRealm, newStage)}**!${majorNote}${kiepLog}${heal}`;
  }
  Cu.updateCultivator(userId, { tu_vi: int(row.tu_vi * 0.85), ngo_tinh: row.ngo_tinh + 1, last_dotpha_fail: t });
  return `💢 Đột phá thất bại, tổn thất tu vi nhưng nhận thêm 1 Độ Lĩnh Ngộ (tỉ lệ lần sau tăng).\n⏳ Bị khóa Đột Phá **20 phút** để dưỡng thương — dùng ${E.phagioidan} Đan Dược Phá Giới (nút **Dùng Đan Dược**) để bỏ bớt thời gian chờ, mỗi viên bỏ tối đa 5 phút.`;
}

/** Đột phá có cấu trúc: gọi doDotpha rồi so sánh trước/sau để UI v7 chọn đúng mẫu (thành công/thất bại/tẩu hỏa nhập ma...). */
function dotphaR(userId) {
  const before = Cu.getCultivator(userId);
  const text = doDotpha(userId);
  const after = Cu.getCultivator(userId);
  const changed = after.realm_index !== before.realm_index || after.stage_index !== before.stage_index;
  let kind;
  if (changed) kind = 'success';
  else if (/^⏳/.test(text)) kind = 'cooldown';
  else if (/ÁP CHẾ/.test(text)) kind = 'suppressed';
  else if (/THẤT BẠI|KHÔNG VƯỢT QUA|^💢/.test(text)) kind = 'fail';
  else kind = 'blocked';
  return { kind, text, before, after, major: after.realm_index > before.realm_index, kiepFail: kind === 'fail' && /CỬU LÔI KIẾP/.test(text) };
}

module.exports = { doDotpha, dotphaR, resolveCuuLoiKiep };
