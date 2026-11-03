'use strict';
const K = require('../game/constants');
const R = require('./realm');
const D = require('../db');
const { now, int } = require('../util');

/** Giá trị TƯƠNG ĐỐI cho updateCultivator: { linh_thach: new Delta(-500) } => SET linh_thach = linh_thach - 500 ngay trong SQL. */
class Delta { constructor(n) { this.n = n; } }

const COL_RE = /^[a-z_][a-z0-9_]*$/;
const MSG_BALANCE_CHANGED =
  '⚠️ Số dư của bạn vừa thay đổi nên giao dịch **không được thực hiện** (chưa bị trừ gì). Hãy xem lại số dư rồi thử lại.';

/**
 * Ghi các cột của nhân vật. Trả true nếu đã ghi.
 * guard = { linh_thach: 500 } -> CHỈ ghi nếu cột đó vẫn >= 500 ngay trong câu UPDATE (trừ tiền nguyên tử).
 */
function updateCultivator(userId, fields, guard = null) {
  const keys = Object.keys(fields);
  if (!keys.length) return true;
  const sets = []; const values = [];
  for (const k of keys) {
    if (!COL_RE.test(k)) throw new Error(`tên cột không hợp lệ: ${k}`);
    const v = fields[k];
    if (v instanceof Delta) { sets.push(`${k} = COALESCE(${k}, 0) + ?`); values.push(v.n); }
    else { sets.push(`${k} = ?`); values.push(typeof v === 'boolean' ? (v ? 1 : 0) : v === undefined ? null : v); }
  }
  let where = 'user_id = ?';
  values.push(userId);
  for (const [col, min] of Object.entries(guard || {})) {
    if (!COL_RE.test(col)) throw new Error(`tên cột không hợp lệ: ${col}`);
    where += ` AND COALESCE(${col}, 0) >= ?`;
    values.push(min);
  }
  return D.run(`UPDATE cultivators SET ${sets.join(', ')} WHERE ${where}`, ...values).changes > 0;
}

function normalizeRealmStageOverflow(row) {
  let realmIdx = row.realm_index; let stageIdx = row.stage_index;
  const orig = [realmIdx, stageIdx];
  for (;;) {
    const maxStage = K.totalStageCount(realmIdx);
    if (stageIdx < maxStage) break;
    if (realmIdx + 1 >= K.REALMS.length) { stageIdx = maxStage - 1; break; }
    stageIdx -= maxStage; realmIdx += 1;
  }
  if (realmIdx !== orig[0] || stageIdx !== orig[1]) {
    D.run('UPDATE cultivators SET realm_index = ?, stage_index = ? WHERE user_id = ?', realmIdx, stageIdx, row.user_id);
    row = D.get('SELECT * FROM cultivators WHERE user_id = ?', row.user_id);
  }
  return row;
}

function enforceHoathanCap(row) {
  if (row.world_tier === 0 && (row.realm_index > K.HOATHAN_REALM_IDX ||
      (row.realm_index === K.HOATHAN_REALM_IDX && row.stage_index > K.HOATHAN_VIENMAN_STAGE))) {
    const capped = Math.min(row.tu_vi, R.tuViRequired(K.HOATHAN_REALM_IDX, K.HOATHAN_VIENMAN_STAGE, 0));
    D.run('UPDATE cultivators SET realm_index = ?, stage_index = ?, tu_vi = ? WHERE user_id = ?',
      K.HOATHAN_REALM_IDX, K.HOATHAN_VIENMAN_STAGE, capped, row.user_id);
    row = D.get('SELECT * FROM cultivators WHERE user_id = ?', row.user_id);
  }
  return row;
}

function getCultivator(userId) {
  let row = D.get('SELECT * FROM cultivators WHERE user_id = ?', userId);
  if (row) { row = normalizeRealmStageOverflow(row); row = enforceHoathanCap(row); }
  return row || null;
}

function createCultivator(userId) {
  const linhCan = R.rollWeighted(K.LINH_CAN).name;
  const theChat = R.rollWeighted(K.THE_CHAT).name;
  D.run('INSERT INTO cultivators (user_id, linh_can, the_chat) VALUES (?, ?, ?)', userId, linhCan, theChat);
  return [linhCan, theChat];
}

// ---------- tập hợp lưu dạng chuỗi '1,3,5' ----------
const parseIntSet = (raw) => new Set(String(raw || '').split(',').map((x) => x.trim()).filter((x) => /^\d+$/.test(x)).map(Number));
const ownedPhapbaoTiers = (row) => parseIntSet(row.phap_bao_owned);
const equippedPhapbaoTier = (row) => int(Number(row.phap_bao_equipped || 0)) || 0;
const effectivePhapBaoBonus = (row) => Number(row.phap_bao_bonus || 0);
const effectiveCongPhapBonus = (row) => Number(row.cong_phap_bonus || 0);
const ownedCongphapTiers = (row) => parseIntSet(row.cong_phap_owned);

function congphapLevelsMap(row) {
  const result = {};
  for (let part of String(row.cong_phap_levels || '').split(',')) {
    part = part.trim();
    if (!part || !part.includes(':')) continue;
    const [k, v] = part.split(/:(.*)/s);
    if (/^\d+$/.test(k.trim()) && /^\d+$/.test(v.trim())) result[Number(k)] = Number(v);
  }
  return result;
}
const congphapLevelOf = (row, tier) => congphapLevelsMap(row)[tier] || 0;
const saveCongphapLevels = (userId, levels) => {
  const raw = Object.entries(levels).map(([t, lv]) => [Number(t), lv]).sort((a, b) => a[0] - b[0])
    .filter(([, lv]) => lv > 0).map(([t, lv]) => `${t}:${lv}`).join(',');
  updateCultivator(userId, { cong_phap_levels: raw });
};

function specialCongphapCurrent(row) {
  const tier = int(Number(row.cong_phap_special_tier || 0)) || 0;
  if (tier <= 0) return null;
  return K.CONGPHAP_SPECIAL_CHAIN[Math.min(tier, K.CONGPHAP_SPECIAL_CHAIN.length) - 1];
}
const specialCongphapBonus = (row) => { const s = specialCongphapCurrent(row); return s ? s.bonus : 0; };

// ---------- Ngũ Suy ----------
const ngusuyActive = (row) => !!row.ngusuy_started && !row.thiennhanngusuy_passed;
function ngusuyStatMult(row) {
  if (!ngusuyActive(row)) return 1.0;
  return K.NGUSUY_STAGES[Math.min(row.ngusuy_stage, K.NGUSUY_STAGES.length - 1)].stat_mult;
}

// ---------- chỉ số hiệu dụng ----------
const cpScale = (row) =>
  (1 + effectiveCongPhapBonus(row) * 0.4 + effectivePhapBaoBonus(row) * 0.4 + specialCongphapBonus(row) * 0.4) * ngusuyStatMult(row);
const effectiveAtk = (row) => int(row.atk * cpScale(row)) + int(row.ruong_bonus_atk || 0);
const effectiveDef = (row) => int(row.def_ * cpScale(row)) + int(row.ruong_bonus_def || 0);
const effectiveSpd = (row) => int(row.spd * cpScale(row)) + int(row.ruong_bonus_spd || 0);
const effectiveMaxHp = (row) => int(row.hp * cpScale(row)) + int(row.ruong_bonus_hp || 0);
const pvpBuffPct = (row) => Number(row.cong_phap_pvp_buff || 0);
const pvpDebuffPct = (row) => Number(row.cong_phap_pvp_debuff || 0);

function calcLucChien(row) {
  let base = effectiveAtk(row) * 3 + effectiveDef(row) * 2 + effectiveSpd(row) * 1.5 + effectiveMaxHp(row) * 0.5 + row.tu_vi * 0.01;
  base += int(row.ruong_bonus_lucchien || 0);
  return int(base);
}

const HP_REGEN_PER_MINUTE = 0.005;
function syncHpRegen(userId, row = null) {
  row = row || getCultivator(userId);
  const t = now();
  const elapsedMin = row.last_hp_regen ? Math.max(0, (t - row.last_hp_regen) / 60) : 0;
  const maxHp = effectiveMaxHp(row);
  let curHp = row.cur_hp !== null && row.cur_hp !== undefined ? row.cur_hp : maxHp;
  if (curHp < maxHp && elapsedMin > 0) curHp = Math.min(maxHp, int(curHp + maxHp * HP_REGEN_PER_MINUTE * elapsedMin));
  if (curHp > maxHp) curHp = maxHp;
  // Không ghi DB nếu HP không đổi và mốc hồi vừa mới cập nhật (xem Tổng Quan liên tục không còn ghi mỗi lần).
  if (row.cur_hp === curHp && row.last_hp_regen && t - row.last_hp_regen < 30) return curHp;
  updateCultivator(userId, { cur_hp: curHp, last_hp_regen: t });
  return curHp;
}

function lucChienMocAt(requiredTuVi) {
  const gate = R.tuViRequired(K.HOATHAN_REALM_IDX, K.HOATHAN_VIENMAN_STAGE, 0);
  return Math.max(1, int(K.THIENKIEP_MIN_LUC_CHIEN * requiredTuVi / gate));
}

module.exports = {
  Delta, MSG_BALANCE_CHANGED, updateCultivator, getCultivator, createCultivator,
  parseIntSet, ownedPhapbaoTiers, equippedPhapbaoTier, effectivePhapBaoBonus, effectiveCongPhapBonus,
  ownedCongphapTiers, congphapLevelsMap, congphapLevelOf, saveCongphapLevels,
  specialCongphapCurrent, specialCongphapBonus, ngusuyActive, ngusuyStatMult,
  cpScale, effectiveAtk, effectiveDef, effectiveSpd, effectiveMaxHp, pvpBuffPct, pvpDebuffPct,
  calcLucChien, syncHpRegen, lucChienMocAt, HP_REGEN_PER_MINUTE,
};

// ---- Công pháp đang trang bị (đa slot) ----
const legacyEquippedCongphapTier = (row) => {
  const m = /^\[Tầng (\d+)\]/.exec(row.cong_phap || '');
  return m ? Number(m[1]) : 0;
};
function equippedCongphapTiers(row) {
  const tiers = String(row.cong_phap_slots || '').split(',').map((x) => x.trim()).filter((x) => /^\d+$/.test(x)).map(Number);
  if (tiers.length) return tiers.slice(0, K.CONGPHAP_MAX_EQUIP_SLOTS);
  const legacy = legacyEquippedCongphapTier(row);
  return legacy ? [legacy] : [];
}
const equippedCongphapTier = (row) => { const t = equippedCongphapTiers(row); return t.length ? t[0] : 0; };
Object.assign(module.exports, { equippedCongphapTiers, equippedCongphapTier, legacyEquippedCongphapTier });
