'use strict';
/**
 * V20.0 — DỊ HỎA của Đan Sư (10 ngọn theo 10 giai đoạn). Thu phục bằng Hỏa Chủng (vật phẩm hiếm, không bán/giao dịch).
 * Mỗi lần chế đan thành công/thất bại cho Dị Hỏa đang dùng EXP; lên cấp tăng tỉ lệ thành công + giảm thời gian; cấp 3/6/9 mở kĩ năng; cấp 10 có thể Tiến Hoá (tốn Linh Thạch, tối đa 3 lần).
 * Dị Hỏa chỉ phụ trợ chế ĐAN có giai đoạn ≤ giai đoạn của ngọn lửa. Đan Hỏa Tinh (tdc_dan_hoa_tinh) vẫn chỉ là nguyên liệu xúc tác — không đổi.
 */
const D = require('../db');
const Cu = require('./cultivator');
const Inv = require('./invsvc');
const Cat = require('./catalog17');
const X = require('./craft17');
const V = require('../data/v20_data');
const { I } = Cat;
const { now, fmtNum } = require('../util');
const { Delta } = Cu;

const uid = (u) => String(u);
const EVO_MAX = 3;
const owned = (user) => D.all('SELECT * FROM v20_dihoa WHERE user_id = ? ORDER BY fire_n', uid(user));
const get = (user, n) => D.get('SELECT * FROM v20_dihoa WHERE user_id = ? AND fire_n = ?', uid(user), n);
const active = (user) => D.get('SELECT * FROM v20_dihoa WHERE user_id = ? AND active = 1', uid(user));
const evoMult = (f) => 1 + 0.25 * (f ? f.evo : 0);
/** Hiệu lực của 1 ngọn: { succ, time, qup, save, dbl } */
function fxOf(f) {
  if (!f) return {}; const k = evoMult(f); const out = { succ: (0.01 + 0.004 * f.lv) * k, time: (0.02 + 0.006 * f.lv) * k };
  for (const s of V.FIRE_SKILLS) if (f.lv >= s.lv) for (const [a, b] of Object.entries(s.fx)) out[a] = (out[a] || 0) + b * k;
  for (const a of Object.keys(out)) out[a] = Math.round(out[a] * 1e4) / 1e4; return out;
}
/** Hiệu lực áp dụng cho 1 công thức (chỉ đan; giai đoạn công thức ≤ giai đoạn ngọn lửa). */
function fxFor(user, r) {
  if (!r || r.prof !== 'dan') return {}; const f = active(user); if (!f) return {};
  return (r.stage || 1) <= f.fire_n ? fxOf(f) : {};
}
function absorb(user, n) {
  n = Math.floor(Number(n)); const S = V.stage(n); if (!S) return { ok: false, msg: 'Không có Dị Hỏa này.' };
  return D.transaction(() => {
    const me = Cu.getCultivator(user); if (!me) return { ok: false, msg: 'Bạn chưa bắt đầu tu tiên.' };
    if (get(user, n)) return { ok: false, msg: `Bạn đã sở hữu **${S.hoaName}** rồi.` };
    const st = X.state(user, 'dan'); const miss = [];
    if (st.level < S.lv) miss.push(`Đan Sư cấp **${Cat.C.LEVELS[S.lv - 1].name}**`);
    if (me.realm_index < S.band[0]) miss.push(`cảnh giới ≥ **${require('./constants').REALMS[S.band[0]].name}**`);
    if (miss.length) return { ok: false, msg: `Chưa đủ điều kiện thu phục ${S.hoaName}: cần ${miss.join(' và ')}.` };
    if (!Inv.take(user, V.ID.hoachung(n), 1, { why: 'thu phục Dị Hỏa' })) return { ok: false, msg: `Bạn không có ${I.BY_ID[V.ID.hoachung(n)].name}.` };
    const first = !active(user);
    D.run('INSERT INTO v20_dihoa (user_id, fire_n, lv, exp, evo, active, at) VALUES (?,?,1,0,0,?,?)', uid(user), n, first ? 1 : 0, now());
    require('./so20').maxStat(user, 'fires', owned(user).length);
    const t = require('./so20').checkTitles(user);
    return { ok: true, msg: `🔥 Thu phục thành công **${S.hoaName}**!${first ? ' Đã tự kích hoạt.' : ''}\n${S.hoa}: hỗ trợ chế đan đến ${S.name}.${t}` };
  });
}
function setActive(user, n) {
  return D.transaction(() => {
    if (!get(user, n)) return { ok: false, msg: 'Bạn chưa sở hữu ngọn Dị Hỏa này.' };
    D.run('UPDATE v20_dihoa SET active = 0 WHERE user_id = ?', uid(user)); D.run('UPDATE v20_dihoa SET active = 1 WHERE user_id = ? AND fire_n = ?', uid(user), n);
    return { ok: true, msg: `🔥 Đã dùng **${V.stage(n).hoaName}** làm Dị Hỏa chính.` };
  });
}
/** Cộng EXP cho ngọn đang dùng (gọi khi nhận đan). Trả thông điệp nếu lên cấp. */
function addExp(user, amount, fire = null) {   // v21.6.4: tham số fire (hàng v20_dihoa) để admin cộng cho từng ngọn; mặc định = ngọn đang dùng
  const f = fire || active(user); if (!f || amount <= 0) return '';
  let { lv, exp } = f; exp += Math.round(amount); let up = 0;
  while (lv < V.FIRE_MAXLV && exp >= V.fireExpNeed(lv)) { exp -= V.fireExpNeed(lv); lv += 1; up += 1; }
  if (lv >= V.FIRE_MAXLV) exp = Math.min(exp, V.fireExpNeed(V.FIRE_MAXLV - 1));
  D.run('UPDATE v20_dihoa SET lv = ?, exp = ? WHERE user_id = ? AND fire_n = ?', lv, exp, uid(user), f.fire_n);
  return up ? `\n🔥 **${V.stage(f.fire_n).hoaName}** lên cấp **${lv}**!` : '';
}
const evolveCost = (f) => V.FIRE_EVOLVE_GOLD(f.fire_n) * (f.evo + 1);
function evolve(user, n) {
  return D.transaction(() => {
    const f = get(user, n); if (!f) return { ok: false, msg: 'Bạn chưa sở hữu ngọn Dị Hỏa này.' };
    if (f.lv < V.FIRE_MAXLV) return { ok: false, msg: `Cần Dị Hỏa đạt cấp ${V.FIRE_MAXLV} (hiện ${f.lv}).` };
    if (f.evo >= EVO_MAX) return { ok: false, msg: 'Dị Hỏa đã Tiến Hoá tối đa.' };
    const g = evolveCost(f); const me = Cu.getCultivator(user);
    if (me.linh_thach < g) return { ok: false, msg: `Thiếu Linh Thạch (${fmtNum(me.linh_thach)}/${fmtNum(g)}).` };
    if (!Cu.updateCultivator(user, { linh_thach: new Delta(-g) }, { linh_thach: g })) return { ok: false, msg: Cu.MSG_BALANCE_CHANGED };
    D.run('UPDATE v20_dihoa SET evo = evo + 1, exp = 0 WHERE user_id = ? AND fire_n = ?', uid(user), n);
    return { ok: true, msg: `🔥 **${V.stage(n).hoaName}** Tiến Hoá lần ${f.evo + 1}/${EVO_MAX} (−${fmtNum(g)} Linh Thạch): hiệu lực ×${(1 + 0.25 * (f.evo + 1)).toFixed(2)}.` };
  });
}
module.exports = { EVO_MAX, owned, get, active, fxOf, fxFor, absorb, setActive, addExp, evolve, evolveCost, evoMult };
