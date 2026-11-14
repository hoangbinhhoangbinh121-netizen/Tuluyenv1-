'use strict';
/**
 * DÙNG ĐAN DƯỢC v17 — mọi viên đan đều có hiệu ứng THẬT, có giới hạn mỗi ngày (đủ lực → giảm lực → chặn) và kiểm tra trạng thái.
 *  • tuvi: cộng tu vi (nhân paceFactor như V16, nhân hệ số phẩm chất) · heal: hồi sinh mệnh (chặn % tối đa) · tamcanh: giảm mệt tu luyện
 *  • buff: đi qua fx17 (có TRẦN, không cộng dồn — dùng lại chỉ làm mới)
 *  • Trừ đan + áp hiệu ứng nằm trong 1 transaction: không thể mất đan mà không có hiệu ứng, cũng không thể dùng khi hết đan.
 */
const D = require('../db');
const Cu = require('./cultivator');
const Inv = require('./invsvc');
const FX = require('./fx17');
const Cat = require('./catalog17');
const BAL = require('./balance');
const { I, C } = Cat;
const { now, int, randInt, fmtNum } = require('../util');
const K = require('./constants');

const fmtT = (s) => require('./format').fmtTime(s);
const isPill = (id) => !!C.PILLS[id];
const usedToday = (user, id) => Inv.dailyGet(user, `pill:${id}`);

/** Mô tả hiệu ứng 1 viên (để hiện trong Kho Đồ/Đan Sư). */
function describe(id, q = 2) {
  const p = C.PILLS[id]; if (!p) return '';
  const m = I.qMult(q);
  const f = (v) => `${Math.round(v * m * 1000) / 10}%`;
  const lim = `Hôm nay: ${p.soft} viên đủ lực, tối đa ${p.hard}.`;
  const rl = p.realm ? ` Cần cảnh giới ≥ ${K.REALMS[p.realm].name}.` : '';
  switch (p.k) {
    case 'tuvi': return `Cộng tu vi ngay ${Math.round(p.lo * m)}–${Math.round(p.hi * m)} (nhân hệ số nhịp tu luyện của bạn).${rl} ${lim}`;
    case 'heal': return `Hồi ${f(p.pct)} sinh mệnh tối đa (không quá ${Math.round(p.max * 100)}% mỗi viên). ${lim}`;
    case 'tamcanh': return `Trong ${fmtT(p.dur)}: giảm ${f(p.fx.fatigueCut)} mức mệt khi tu luyện dồn dập. ${lim}`;
    default: {
      const parts = Object.entries(p.fx).map(([k, v]) => `${FX_LABEL[k] || k} +${k === 'ngo' ? Math.round(v * m) : f(v)}`);
      return `${p.charges ? `Có ${p.charges} lượt dùng, ` : ''}trong ${fmtT(p.dur)}: ${parts.join(', ')}. ${USE_AT[p.key] || ''} ${lim}`.replace(/\s+/g, ' ').trim();
    }
  }
}
const FX_LABEL = { atk: 'Công Kích', def: 'Phòng Ngự', spd: 'Tốc Độ', hp: 'Sinh Mệnh', ngo: 'Ngộ Tính', bt: 'Tỉ lệ Đột Phá', failKeep: 'Giữ tu vi khi đột phá hỏng', lockCut: 'Giảm thời gian khoá Đột Phá', res_hoa: 'Kháng Hỏa (Boss)', res_han: 'Kháng Hàn (Boss)', tk: 'Tỉ lệ vượt Thiên Kiếp', kiep: 'Giảm sát thương Thiên Kiếp', fatigueCut: 'Giảm mệt' };
const USE_AT = {
  ho_mach: 'Tự dùng khi Đột Phá (tiêu 1 lượt).', pha_canh: 'Tự dùng khi Đột Phá (tiêu 1 lượt).', ngung_than: 'Áp dụng ở Cảm Ngộ / Đột Phá.', cuong_the: 'Áp dụng ở PvP, Boss, Chiến Tông Môn.',
  kim_cuong: 'Áp dụng ở PvP, Boss, Chiến Tông Môn.', long_luc: 'Áp dụng ở PvP, Boss, Chiến Tông Môn.', tat_phong: 'Áp dụng ở PvP, Boss, Chiến Tông Môn.', han_ngoc: 'Giảm đòn Hỏa của Boss.', liet_duong: 'Giảm đòn Hàn của Boss.', do_kiep: 'Tự dùng khi Độ Kiếp / Thiên Kiếp Phi Thăng (tiêu 1 lượt).',
};

/** Hệ số hiệu lực theo số viên đã dùng hôm nay: 1 (trong soft) → 0.5 (soft..hard) → chặn. */
function potency(user, id, extra = 0) {
  const p = C.PILLS[id]; const n = usedToday(user, id) + extra;
  if (n >= p.hard) return 0; if (n >= p.soft) return 0.5; return 1;
}

function useOne(user, id, q, row) {
  const p = C.PILLS[id]; const m = I.qMult(q); const pot = potency(user, id);
  if (pot <= 0) return { ok: false, msg: `Hôm nay bạn đã dùng đủ **${p.hard}** viên ${I.BY_ID[id].name} — thân thể không chịu thêm nữa.` };
  if (p.realm && row.realm_index < p.realm) return { ok: false, msg: `Cần cảnh giới ≥ **${K.REALMS[p.realm].name}** để dùng ${I.BY_ID[id].name}.` };
  const it = I.BY_ID[id]; const nm = `${it.name}${q ? ` (${I.qName(q)})` : ''}`;
  if (p.k === 'heal') {
    const max = Cu.effectiveMaxHp(row); const cur = Cu.syncHpRegen(user, row);
    if (cur >= max) return { ok: false, msg: 'Sinh mệnh của bạn đang đầy — chưa cần dùng.' };
  }
  if (p.k === 'tamcanh' || p.k === 'buff') {
    const old = FX.activeBuff(user, p.key || 'tam_canh');
    if (old && old.charges <= 0 && p.charges) { /* hết lượt → cho phép dùng lại */ }
  }
  if (!Inv.take(user, id, 1, { q, why: `dùng ${id}` })) return { ok: false, msg: `Bạn không còn ${nm}.` };
  Inv.dailyAdd(user, `pill:${id}`, 1);
  const eff = pot < 1 ? ' _(đã dùng nhiều trong ngày: hiệu lực giảm một nửa)_' : '';
  if (p.k === 'tuvi') {
    const gain = Math.max(1, int(randInt(p.lo, p.hi) * m * pot * BAL.paceFactor(row)));
    Cu.updateCultivator(user, { tu_vi: new Cu.Delta(gain) });
    return { ok: true, msg: `💊 Dùng **${nm}**: nhận ngay **${fmtNum(gain)}** tu vi.${eff}` };
  }
  if (p.k === 'heal') {
    const max = Cu.effectiveMaxHp(row); const cur = Cu.syncHpRegen(user, row);
    const heal = Math.min(int(max * Math.min(p.max, p.pct * m) * pot), max - cur);
    Cu.updateCultivator(user, { cur_hp: cur + heal, last_hp_regen: now() });
    return { ok: true, msg: `💊 Dùng **${nm}**: hồi **${fmtNum(heal)}** sinh mệnh (${fmtNum(cur + heal)}/${fmtNum(max)}).${eff}` };
  }
  const fx = {};
  for (const [k, v] of Object.entries(p.fx)) fx[k] = k === 'ngo' ? Math.max(1, Math.round(v * m * pot)) : Math.round(v * m * pot * 1e4) / 1e4;
  const key = p.key || 'tam_canh';
  FX.setBuff(user, key, fx, p.dur, { charges: p.charges || 0, q, kind: 'pill' });
  return { ok: true, msg: `💊 Dùng **${nm}**: ${describe(id, q).split('. Hôm nay')[0]}${eff}` };
}

/** Dùng n viên (tối đa 20/lần bấm). Cả lượt chạy trong 1 transaction. */
function use(user, id, q = 0, n = 1) {
  if (!isPill(id)) return { ok: false, msg: 'Vật phẩm này không phải đan dược dùng trực tiếp.' };
  n = Math.max(1, Math.min(20, int(n)));
  return D.transaction(() => {
    const row = Cu.getCultivator(user); if (!row) return { ok: false, msg: 'Bạn chưa bắt đầu tu tiên.' };
    if (Inv.qty(user, id, q) < 1) return { ok: false, msg: `Bạn không có ${I.BY_ID[id].name}${q ? ` (${I.qName(q)})` : ''} trong kho.` };
    const lines = []; let used = 0;
    for (let i = 0; i < n; i += 1) {
      const r = useOne(user, id, q, Cu.getCultivator(user));
      if (!r.ok) { if (!used) return r; lines.push(`⚠️ ${r.msg}`); break; }
      used += 1; if (n === 1 || i === 0 || i === n - 1) lines.push(r.msg);
    }
    if (used > 2) lines.splice(1, lines.length - 2, `… (dùng liên tiếp ${used} viên) …`);
    return { ok: true, used, msg: lines.join('\n') };
  });
}

/** Đan Phá Giới & Tẩy Tủy dùng chung luồng cũ (Cột cũ — không đổi hành vi). */
function useLegacy(user, id) {
  const Dan = require('./dan');
  if (id === 'dan_pha_gioi') return { ok: true, msg: Dan.doCanDanGiamDotpha(user) };
  if (id === 'dan_tay_tuy_ts') return { ok: true, msg: Dan.doTaytuyReroll(user) };
  if (id === 'dan_tay_tuy_nua') return { ok: true, msg: 'Chọn Linh Căn hoặc Thể Chất ở menu **Tẩy Tủy** (dùng nút bên dưới).' };
  return { ok: false, msg: 'Không dùng được vật phẩm này.' };
}

/** Buff đang chạy — để hiển thị. */
function activeList(user) {
  return FX.listBuffs(user, 'pill').map((b) => ({ key: b.key, left: Math.max(0, int(b.until - now())), charges: b.charges, fx: b.fxo }));
}

module.exports = { isPill, describe, potency, usedToday, use, useLegacy, activeList, FX_LABEL };
