'use strict';
/**
 * TRẬN PHÁP v17 — 7 trận, triển khai THẬT:
 *  • Tụ Linh (tốc độ tu vi: Tu Luyện/Bế Quan/Bí Cảnh/Động Phủ/Chuỗi — qua cpTuMult) · Hộ Thân (Phòng Ngự + giảm sát thương PvP/Boss/Chiến Tông Môn)
 *  • Sát Phạt (Công Kích + Xuyên Giáp) · Mê Tung (Né Tránh + tăng tỉ lệ rơi nguyên liệu) · Phong Ấn (làm yếu đối thủ PvP / giảm phản đòn Boss — có số lượt)
 *  • Hộ Tông Đại Trận (Tông Chủ dựng cho cả Tông Môn) · Không Gian (mỗi lượt thay 1 Vé Bí Cảnh Đặc Biệt)
 *  Mỗi lần triển khai: tiêu 1 trận bàn trong kho + phí DUY TRÌ (Linh Thạch, tăng theo cảnh giới) · tối đa 3 trận cá nhân cùng lúc · giới hạn số lần/ngày.
 */
const D = require('../db');
const Cu = require('./cultivator');
const Inv = require('./invsvc');
const FX = require('./fx17');
const Cat = require('./catalog17');
const { I, C } = Cat;
const { now, int, fmtNum } = require('../util');
const K = require('./constants');

const fmtT = (s) => require('./format').fmtTime(s);
const keyOf = (id) => `tran:${id}`;
const isTran = (id) => !!C.TRANS[id];
const realmF = (row) => 1 + 0.3 * (row ? row.realm_index : 0);
function upkeepCost(user, id) {
  const row = Cu.getCultivator(user); const d = C.TRANS[id];
  let upk = 0; try { upk = require('./craft17').techFx(user, 'tran').upk || 0; } catch (_) { upk = 0; }
  return Math.max(0, Math.round(d.upkeep * (d.dur / 3600) * realmF(row) * (1 - Math.min(0.5, upk))));
}
function describe(id, q = 2) {
  const d = C.TRANS[id]; if (!d) return '';
  const m = I.qMult(q); const pc = (v) => `${Math.round(v * m * 1000) / 10}%`;
  const L = { tu: 'Tốc độ tu vi', def: 'Phòng Ngự', dr: 'Giảm sát thương nhận', atk: 'Công Kích', pierce: 'Xuyên Giáp', dodge: 'Né Tránh', loot: 'Tỉ lệ rơi nguyên liệu', foe: 'Làm yếu đối thủ PvP', bossDr: 'Giảm phản đòn Boss', sectDr: 'Giảm sát thương Tông Môn trong Chiến Tông Môn', sectTu: 'Tốc độ tu vi cả Tông Môn' };
  const parts = Object.entries(d.fx).filter(([k]) => k !== 'teleport').map(([k, v]) => `${L[k] || k} +${pc(v)}`);
  if (d.fx.teleport) parts.push('Mỗi lượt thay 1 Vé Bí Cảnh Đặc Biệt');
  return `${parts.join(', ')} trong ${fmtT(d.dur)}${d.charges ? `, ${d.charges} lượt` : ''}. Duy trì ≈ ${fmtNum(d.upkeep * (d.dur / 3600))} Linh Thạch (nhân hệ số cảnh giới). Tối đa ${d.daily} lần/ngày.${d.sect ? ' Chỉ Tông Chủ.' : ''}`;
}

/** Các trận cá nhân/Tông Môn đang chạy của người chơi. */
function active(user) {
  const out = FX.listBuffs(user, 'tran').map((b) => ({ id: b.key.slice(5), left: Math.max(0, int(b.until - now())), charges: b.charges, q: b.q, fx: b.fxo }));
  const row = Cu.getCultivator(user);
  let sect = null;
  if (row && row.sect_id) { const s = D.get('SELECT tran_key, tran_until, tran_q FROM sects WHERE sect_id = ?', row.sect_id); if (s && s.tran_key && s.tran_until > now()) sect = { id: s.tran_key, left: int(s.tran_until - now()), q: s.tran_q }; }
  return { personal: out, sect };
}

function deploy(user, id, q = 2) {
  const d = C.TRANS[id]; if (!d) return { ok: false, msg: 'Đây không phải trận pháp triển khai được.' };
  return D.transaction(() => {
    const row = Cu.getCultivator(user); if (!row) return { ok: false, msg: 'Bạn chưa bắt đầu tu tiên.' };
    const it = I.BY_ID[id];
    if (Inv.qty(user, id, q) < 1) return { ok: false, msg: `Bạn không có **${it.name}** (${I.qName(q)}) trong kho.` };
    if (Inv.dailyGet(user, `tran:${id}`) >= d.daily) return { ok: false, msg: `Hôm nay bạn đã triển khai **${it.name}** đủ ${d.daily} lần.` };
    const cost = upkeepCost(user, id);
    if (row.linh_thach < cost) return { ok: false, msg: `Cần **${fmtNum(cost)}** Linh Thạch duy trì trận (hiện có ${fmtNum(row.linh_thach)}).` };
    const m = I.qMult(q); const fx = {};
    for (const [k, v] of Object.entries(d.fx)) fx[k] = k === 'teleport' ? 1 : Math.round(v * m * 1e4) / 1e4;
    if (d.sect) {
      if (!row.sect_id) return { ok: false, msg: 'Bạn chưa gia nhập Tông Môn nào.' };
      if (row.sect_role !== 'tongchu') return { ok: false, msg: 'Chỉ **Tông Chủ** mới dựng được Hộ Tông Đại Trận.' };
      const s = D.get('SELECT tran_key, tran_until FROM sects WHERE sect_id = ?', row.sect_id);
      if (s && s.tran_key && s.tran_until > now() + d.dur * 0.5) return { ok: false, msg: `Hộ Tông Đại Trận hiện còn **${fmtT(s.tran_until - now())}** — chờ gần hết hạn mới dựng lại.` };
      if (!Cu.updateCultivator(user, { linh_thach: new Cu.Delta(-cost) }, { linh_thach: cost })) return { ok: false, msg: Cu.MSG_BALANCE_CHANGED };
      Inv.take(user, id, 1, { q, why: 'triển khai' });
      D.run('UPDATE sects SET tran_key = ?, tran_until = ?, tran_q = ? WHERE sect_id = ?', id, now() + d.dur, q, row.sect_id);
      FX.sectFxClear();
      Inv.dailyAdd(user, `tran:${id}`, 1);
      progress(user, 'hoTong', 1);
      return { ok: true, msg: `🔯 **Hộ Tông Đại Trận** (${I.qName(q)}) bao phủ Tông Môn trong **${fmtT(d.dur)}**: ${describe(id, q).split(' trong ')[0]}. (−${fmtNum(cost)} Linh Thạch duy trì)` };
    }
    const cur = FX.listBuffs(user, 'tran');
    if (!cur.some((b) => b.key === keyOf(id)) && cur.length >= C.TRAN_PERSONAL_MAX) return { ok: false, msg: `Bạn chỉ duy trì được tối đa **${C.TRAN_PERSONAL_MAX}** trận cá nhân cùng lúc.` };
    if (!Cu.updateCultivator(user, { linh_thach: new Cu.Delta(-cost) }, { linh_thach: cost })) return { ok: false, msg: Cu.MSG_BALANCE_CHANGED };
    Inv.take(user, id, 1, { q, why: 'triển khai' });
    FX.setBuff(user, keyOf(id), fx, d.dur, { charges: d.charges || 0, q, kind: 'tran' });
    Inv.dailyAdd(user, `tran:${id}`, 1);
    progress(user, 'deploys', 1);
    return { ok: true, msg: `🔯 Triển khai **${it.name}** (${I.qName(q)}): ${describe(id, q).split(' Duy trì')[0]} (−${fmtNum(cost)} Linh Thạch duy trì)` };
  });
}
function progress(user, key, n) {
  try { const X = require('./craft17'); X.bumpExtra(user, 'tran', key, n); X.addExp(user, 'tran', 3 + n); X.checkAch(user, 'tran'); } catch (e) { console.warn('⚠️ exp trận:', e.message); }
}

/** Không Gian Trận Bàn: 1 lượt dịch chuyển THAY cho 1 Vé Bí Cảnh Đặc Biệt. Trả true và đã trừ lượt nếu còn. (Bí Cảnh Đặc Biệt gọi khi hết vé.) */
function teleportTicket(user) {
  const b = FX.activeBuff(user, keyOf('tp_khong_gian'));
  if (!b || b.charges <= 0) return false;
  return !!FX.consume(user, keyOf('tp_khong_gian'));
}
/** Số lượt còn lại của 1 trận (Phong Ấn/Không Gian). */
const chargesLeft = (user, id) => { const b = FX.activeBuff(user, keyOf(id)); return b ? b.charges : 0; };
/** Dùng 1 lượt Phong Ấn khi vào trận PvP/Boss. Trả buff nếu còn lượt. */
const consumeSeal = (user) => FX.consume(user, keyOf('tp_phong_an'));
/** Hệ số rút hồi chiêu Bí Cảnh (Mê Tung + trang bị). */

module.exports = { isTran, describe, upkeepCost, active, deploy, teleportTicket, chargesLeft, consumeSeal, keyOf };
