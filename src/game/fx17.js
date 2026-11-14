'use strict';
/**
 * HIỆU ỨNG v17 — gom TRANG BỊ (đang mặc, còn độ bền) + BUFF ĐAN DƯỢC + TRẬN PHÁP cá nhân (+ trận Tông Môn) thành MỘT gói số có TRẦN.
 *  • Lưu bộ nhớ đệm JSON ở cultivators.fx17 (tính lại khi đổi trang bị/buff/trận) → đọc chỉ số (effectiveAtk...) không phải truy vấn DB mỗi lần.
 *  • Mục có hạn (buff/trận) mang `until` riêng, hết hạn tự rơi khỏi gói khi đọc — không cần dọn.
 *  • Cùng khoá buff dùng lại = LÀM MỚI (lấy giá trị lớn hơn), KHÔNG cộng dồn. Tổng mọi nguồn bị chặn bởi CAP — phẩm chất cao không đồng nghĩa mạnh vô hạn.
 */
const D = require('../db');
const { now } = require('../util');

/** Trần TỔNG (gear + đan + trận). Giá trị là tỉ lệ (0.30 = +30%) trừ ngo (điểm Ngộ Tính). */
const CAP = {
  atk: 0.30, def: 0.30, spd: 0.30, hp: 0.30, tu: 0.25, ngo: 8, bt: 0.10, failKeep: 0.10, dr: 0.15, dodge: 0.10, crit: 0.08, pierce: 0.10, lifesteal: 0.06, loot: 0.15,
  regen: 0.5, kiep: 0.20, tk: 0.15, res_hoa: 0.25, res_han: 0.25, foe: 0.10, bossDr: 0.35, lockCut: 0.5, fatigueCut: 0.6, sectDr: 0.10, sectTu: 0.08,
};
const KEYS = Object.keys(CAP);
const ZERO = Object.freeze(Object.fromEntries(KEYS.map((k) => [k, 0])));

// ------------------------------------------------------------------ tính gói từ JSON bộ nhớ đệm
let _lastStr = null; let _lastParsed = null;
function parse(s) {
  if (!s) return null;
  if (s === _lastStr) return _lastParsed;
  let o = null; try { o = JSON.parse(s); } catch (_) { o = null; }
  _lastStr = s; _lastParsed = o && typeof o === 'object' ? o : null; return _lastParsed;
}
function fold(g, e, t) {
  const out = { ...ZERO };
  for (const [k, v] of Object.entries(g || {})) if (k in out) out[k] += Number(v) || 0;
  for (const ent of e || []) { if (ent[0] > t) for (const [k, v] of Object.entries(ent[1] || {})) if (k in out) out[k] += Number(v) || 0; }
  for (const k of KEYS) out[k] = Math.max(0, Math.min(CAP[k], out[k]));
  return out;
}
/** Gói hiệu ứng của 1 hàng cultivators (có thể là hàng bán phần: thiếu fx17 → không có hiệu ứng). */
function get(row) {
  if (!row || !row.fx17) return ZERO;
  const p = parse(row.fx17); if (!p) return ZERO;
  return fold(p.g, p.e, now());
}
const stat = (row, k) => get(row)[k] || 0;
// Trận pháp Tông Môn (Hộ Tông Đại Trận) — tra cứu có đệm 5 giây
const _sect = new Map();
function sectFx(row) {
  if (!row || !row.sect_id) return ZERO;
  const t = now(); const c = _sect.get(row.sect_id);
  if (c && t - c.at < 5) return c.fx;
  let fx = ZERO;
  try {
    const s = D.get('SELECT tran_key, tran_until, tran_q FROM sects WHERE sect_id = ?', row.sect_id);
    if (s && s.tran_key && s.tran_until > t) {
      const C = require('../data/craft_v17'); const I = require('../data/items_v17');
      const d = C.TRANS[s.tran_key]; const m = I.qMult(s.tran_q || 2);
      fx = { ...ZERO, sectDr: Math.min(CAP.sectDr, (d.fx.sectDr || 0) * m), sectTu: Math.min(CAP.sectTu, (d.fx.sectTu || 0) * m) };
    }
  } catch (e) { /* cột chưa migrate: bỏ qua */ }
  _sect.set(row.sect_id, { at: t, fx }); return fx;
}
const sectFxClear = () => _sect.clear();
/** Hệ số tu vi cộng thêm (trận Tụ Linh + Hộ Tông + trang bị) — dùng trong cpTuMult. */
const tuBonus = (row) => { const f = get(row); return Math.min(CAP.tu + CAP.sectTu, f.tu + sectFx(row).sectTu); };

// ------------------------------------------------------------------ ghi: tính lại bộ nhớ đệm
function recompute(user) {
  const u = String(user); const t = now();
  const g = {};
  const gearRows = D.all('SELECT * FROM gear WHERE user_id = ? AND equipped = 1', u);
  if (gearRows.length) { const G = require('./gear17'); for (const r of gearRows) { if (r.dura <= 0) continue; for (const [k, v] of Object.entries(G.statsOf(r))) g[k] = (g[k] || 0) + v; } }
  const e = [];
  for (const b of D.all('SELECT fx, until FROM fx_buffs WHERE user_id = ? AND until > ?', u, t)) { let f = {}; try { f = JSON.parse(b.fx); } catch (_) { f = {}; } e.push([b.until, f]); }
  const s = JSON.stringify({ g, e });
  D.run('UPDATE cultivators SET fx17 = ? WHERE user_id = ?', s, u);
  return s;
}

// ------------------------------------------------------------------ buff có hạn (đan dược / trận pháp cá nhân)
function setBuff(user, key, fx, dur, { charges = 0, q = 2, kind = 'pill' } = {}) {
  const u = String(user); const t = now();
  const old = D.get('SELECT * FROM fx_buffs WHERE user_id = ? AND key = ?', u, key);
  let merged = { ...fx };
  if (old && old.until > t) { let of = {}; try { of = JSON.parse(old.fx); } catch (_) { of = {}; } for (const [k, v] of Object.entries(of)) merged[k] = Math.max(merged[k] || 0, v); }   // không cộng dồn
  D.run('INSERT OR REPLACE INTO fx_buffs (user_id, key, fx, until, charges, q, kind) VALUES (?,?,?,?,?,?,?)', u, key, JSON.stringify(merged), t + dur, charges, q, kind);
  recompute(u);
  return merged;
}
const activeBuff = (user, key) => { const r = D.get('SELECT * FROM fx_buffs WHERE user_id = ? AND key = ? AND until > ?', String(user), key, now()); if (!r) return null; try { r.fxo = JSON.parse(r.fx); } catch (_) { r.fxo = {}; } return r; };
const listBuffs = (user, kind = null) => D.all(`SELECT * FROM fx_buffs WHERE user_id = ? AND until > ?${kind ? ' AND kind = ?' : ''} ORDER BY until ASC`, ...[String(user), now(), ...(kind ? [kind] : [])])
  .map((r) => { try { r.fxo = JSON.parse(r.fx); } catch (_) { r.fxo = {}; } return r; });
/** Dùng 1 lần của buff theo lượt (Hộ Mạch, Phá Cảnh, Độ Kiếp, Phong Ấn, Không Gian). Trả buff nếu còn lượt (và đã trừ), null nếu không. */
function consume(user, key) {
  const u = String(user); const r = activeBuff(u, key); if (!r || r.charges <= 0) return null;
  const ok = D.run('UPDATE fx_buffs SET charges = charges - 1 WHERE user_id = ? AND key = ? AND charges > 0', u, key).changes > 0;
  if (!ok) return null;
  if (r.charges - 1 <= 0) { D.run('DELETE FROM fx_buffs WHERE user_id = ? AND key = ?', u, key); }
  recompute(u);
  return r;
}
function cleanup(user) { D.run('DELETE FROM fx_buffs WHERE user_id = ? AND until <= ?', String(user), now()); }

module.exports = { CAP, KEYS, ZERO, get, stat, tuBonus, sectFx, sectFxClear, recompute, setBuff, activeBuff, listBuffs, consume, cleanup };
