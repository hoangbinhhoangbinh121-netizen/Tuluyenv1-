'use strict';
/** Thao tác admin lên Thể Chất / Linh Căn / Tu Vi của thành viên. Mọi thay đổi lưu BẢN GỐC (lần đầu) để /thuhoituchat khôi phục. */
const D = require('../db');
const K = require('./constants');
const R = require('./realm');
const Cu = require('./cultivator');
const T = require('./talent');
const { now } = require('../util');

const KIND = {
  the_chat: { col: 'the_chat', list: K.THE_CHAT, cols: T.TC_COLS, fresh: (n) => T.tcFields(n), label: 'Thể Chất' },
  linh_can: { col: 'linh_can', list: K.LINH_CAN, cols: T.LC_COLS, fresh: (n) => T.lcFields(n), label: 'Linh Căn' },
};
const find = (kind, name) => KIND[kind].list.find((x) => x.name === name);

/** Lưu bản gốc nếu chưa có (giữ bản sớm nhất để thu hồi quay về đúng trạng thái tự nhiên). */
function snapshot(row, kind, adminId) {
  const k = KIND[kind];
  if (D.get('SELECT 1 AS x FROM admin_grants WHERE user_id = ? AND kind = ?', String(row.user_id), kind)) return;
  const eff = { ...row, ...T.syncFields(row) };
  const prev = {}; for (const c of k.cols) prev[c] = eff[c];
  D.run('INSERT INTO admin_grants (user_id, kind, prev_tier, prev_json, by_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)', String(row.user_id), kind, row[k.col], JSON.stringify(prev), String(adminId), now());
}
function apply(userId, kind, name, adminId) {
  const row = Cu.getCultivator(userId); if (!row) return { ok: false, msg: `❌ <@${userId}> chưa bắt đầu tu tiên.` };
  const k = KIND[kind]; const info = find(kind, name);
  if (!info) return { ok: false, msg: `❌ Không có phẩm cấp **${name}**.` };
  D.transaction(() => { snapshot(row, kind, adminId); Cu.updateCultivator(userId, { [k.col]: name, ...k.fresh(name) }); });
  return { ok: true, row: Cu.getCultivator(userId), info, before: row[k.col] };
}
/** Tặng phẩm cấp chỉ định. */
const give = (userId, kind, name, adminId) => apply(userId, kind, name, adminId);
/** Roll lại ngẫu nhiên theo xác suất của game (miễn phí, không cần Đan Tẩy Tủy). */
function reroll(userId, kind, adminId) {
  const k = KIND[kind]; const pick = R.rollWeighted(k.list);
  return apply(userId, kind, pick.name, adminId);
}
/** Thu hồi: khôi phục bản gốc trước khi admin can thiệp. Trả { restored: [...], none: [...] }. */
function revoke(userId, kinds, adminId) {
  const row = Cu.getCultivator(userId); const out = { restored: [], none: [] };
  if (!row) return { ...out, noUser: true };
  for (const kind of kinds) {
    const k = KIND[kind]; const g = D.get('SELECT * FROM admin_grants WHERE user_id = ? AND kind = ?', String(userId), kind);
    if (!g) { out.none.push(k.label); continue; }
    const prev = JSON.parse(g.prev_json || '{}');
    D.transaction(() => { Cu.updateCultivator(userId, { [k.col]: g.prev_tier, ...prev }); D.run('DELETE FROM admin_grants WHERE user_id = ? AND kind = ?', String(userId), kind); });
    out.restored.push(`${k.label}: **${row[k.col]}** → **${g.prev_tier}**`);
  }
  return out;
}
/** Đầy tu vi: đặt tu vi bằng đúng mức cần để đột phá tầng kế (không giảm nếu đã cao hơn). */
function fullExp(userId) {
  const row = Cu.getCultivator(userId); if (!row) return null;
  const need = R.tuViRequired(row.realm_index, row.stage_index, row.world_tier);
  const nv = Math.max(row.tu_vi, need);
  Cu.updateCultivator(userId, { tu_vi: nv });
  return { before: row.tu_vi, after: nv, need, row };
}
module.exports = { KIND, give, reroll, revoke, fullExp };
