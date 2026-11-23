'use strict';
/**
 * v21.3 — STAT SNAPSHOT (nguồn sự thật DUY NHẤT để đọc chỉ số chiến đấu của 1 nhân vật).
 *
 * Không đổi công thức gameplay: snapshot() chạy lại ĐÚNG các thành phần mà cultivator.js đang dùng
 * (công pháp cũ, pháp bảo, công pháp đặc biệt, công pháp mới cpfx, trang bị/đan/trận fx17, Đế Đạo/Đế Binh fx19,
 * Ngũ Suy, Thể Chất + Linh Căn, rương), nhưng ghi lại từng nguồn (sourceBreakdown) và tự đối chiếu với
 * Cu.effectiveAtk/Def/Spd/MaxHp/calcLucChien — `check.ok === false` nếu hai đường lệch nhau (bắt double-count / lệch công thức).
 *
 * Thứ tự pipeline (tài liệu 02_STAT_PIPELINE): base → (cộng dồn) công pháp/pháp bảo/đặc biệt/cpfx/fx17/fx19 → ×Ngũ Suy
 *   → ×Thể Chất+Linh Căn → +rương (phẳng) → làm tròn xuống.
 */
const Cu = require('./cultivator');
const T = require('./talent');
const CPX = require('./cpfx');
const X17 = require('./fx17');
const X19 = require('./fx19');
const { int } = require('../util');

const STATS = ['atk', 'def', 'spd', 'hp'];
const BASE_COL = { atk: 'atk', def: 'def_', spd: 'spd', hp: 'hp' };
const FLAT_COL = { atk: 'ruong_bonus_atk', def: 'ruong_bonus_def', spd: 'ruong_bonus_spd', hp: 'ruong_bonus_hp' };
const round4 = (x) => Math.round(x * 10000) / 10000;

/** Các nguồn CỘNG vào ngoặc công pháp của 1 chỉ số (đúng như cpScaleFor). */
function additiveSources(row, stat) {
  return [
    { sourceId: 'cong_phap', sourceType: 'congphap', operation: 'add', value: Cu.effectiveCongPhapBonus(row) * 0.4 },
    { sourceId: 'phap_bao', sourceType: 'phapbao', operation: 'add', value: Cu.effectivePhapBaoBonus(row) * 0.4 },
    { sourceId: 'cong_phap_dac_biet', sourceType: 'congphap', operation: 'add', value: Cu.specialCongphapBonus(row) * 0.4 },
    { sourceId: 'cong_phap_moi', sourceType: 'congphap', operation: 'add', value: CPX.statBonus(row, stat) },
    { sourceId: 'trang_bi_dan_tran', sourceType: 'equipment', operation: 'add', value: X17.stat(row, stat) },
    { sourceId: 'de_dao_de_binh', sourceType: 'de', operation: 'add', value: X19.statBonus(row, stat) },
  ].map((s) => ({ ...s, stat }));
}

/** Tính 1 chỉ số + breakdown. */
function one(row, stat) {
  const base = Number(row[BASE_COL[stat]] || 0);
  const adds = additiveSources(row, stat);
  const bracket = adds.reduce((a, s) => a + s.value, 1);    // cùng thứ tự cộng như cpScaleFor (tránh lệch số thực)
  const ngusuy = Cu.ngusuyStatMult(row);
  const talent = stat === 'spd' ? 1 : T.statMult(row, stat);     // tốc độ không nhân Thể Chất/Linh Căn (đúng như effectiveSpd)
  const flat = int(row[FLAT_COL[stat]] || 0);
  const scale = bracket * ngusuy;
  const value = (stat === 'hp' ? int(base * (scale * talent)) : int(base * scale * talent)) + flat;   // hp: hpScale = cpScale × talent (kết hợp trước)
  const mods = [
    ...adds.filter((s) => s.value !== 0).map((s) => ({ ...s, value: round4(s.value), stackingGroup: 'cp_scale' })),
    ...(ngusuy !== 1 ? [{ sourceId: 'ngu_suy', sourceType: 'debuff', stat, operation: 'mul', value: round4(ngusuy), stackingGroup: 'ngusuy' }] : []),
    ...(talent !== 1 ? [{ sourceId: 'the_chat_linh_can', sourceType: 'talent', stat, operation: 'mul', value: round4(talent), stackingGroup: 'talent' }] : []),
    ...(flat ? [{ sourceId: 'ruong', sourceType: 'chest', stat, operation: 'flat', value: flat, stackingGroup: 'ruong' }] : []),
  ];
  return { value, base, scale: round4(scale), mods };
}

/**
 * snapshot(row) → { atk, def, spd, maxHp, lucChien, combat:{crit,critMult,dodge,dr,pierce,lifesteal},
 *                   breakdown:{atk,def,spd,hp}, check:{ok,diffs[]}, version }
 * `row` là hàng cultivators (đã chuẩn hoá bởi getCultivator).
 */
function snapshot(row) {
  const a = one(row, 'atk'); const d = one(row, 'def'); const s = one(row, 'spd'); const h = one(row, 'hp');
  const lucChien = Cu.calcLucChien(row);                       // Lực Chiến có thêm % cpfx/fx19 + phẳng rương: giữ nguyên hàm gốc, chỉ đối chiếu
  const combat = T.combatMods(row);
  const diffs = [];
  const cmp = (k, mine, ref) => { if (mine !== ref) diffs.push({ stat: k, snapshot: mine, legacy: ref }); };
  cmp('atk', a.value, Cu.effectiveAtk(row)); cmp('def', d.value, Cu.effectiveDef(row));
  cmp('spd', s.value, Cu.effectiveSpd(row)); cmp('hp', h.value, Cu.effectiveMaxHp(row));
  return {
    version: 1, userId: String(row.user_id), realm: [row.realm_index, row.stage_index],
    atk: a.value, def: d.value, spd: s.value, maxHp: h.value, lucChien, combat,
    breakdown: { atk: a, def: d, spd: s, hp: h },
    check: { ok: diffs.length === 0, diffs },
  };
}

/** Dòng chữ gọn cho UI/nhật ký: "Công 1234 (gốc 1000 ×1.20 …)". */
function describe(snap, stat = 'atk') {
  const b = snap.breakdown[stat]; if (!b) return '';
  const parts = b.mods.map((m) => (m.operation === 'add' ? `+${(m.value * 100).toFixed(1)}% ${m.sourceId}` : m.operation === 'mul' ? `×${m.value} ${m.sourceId}` : `+${m.value} ${m.sourceId}`));
  return `${stat}: ${b.value} (gốc ${b.base}${parts.length ? ' · ' + parts.join(' · ') : ''})`;
}

module.exports = { snapshot, describe, STATS };
