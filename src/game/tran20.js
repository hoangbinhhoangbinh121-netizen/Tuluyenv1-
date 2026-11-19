'use strict';
/**
 * V20.3 — TRẬN PHÁP: Nâng Phẩm · Thu Hồi · Gia Cố (chồng lên tran17, không đổi cách triển khai/duy trì).
 *  • Nâng Phẩm: 3 trận bàn cùng loại + cùng phẩm → 1 trận bàn phẩm +1 (tối đa 5) + phí Linh Thạch. Luôn lỗ so với chế mới (là chỗ tiêu hao).
 *  • Thu Hồi: dỡ 1 trận cá nhân đang chạy, hoàn 50% phí duy trì theo thời gian còn lại (không trả trận bàn).
 *  • Gia Cố: khi trận (không giới hạn lượt) còn < 50% thời gian, trả 60% phí duy trì để kéo về đủ thời gian — không tốn trận bàn, tối đa 1 lần/ngày/trận.
 */
const D = require('../db');
const Cu = require('./cultivator');
const Inv = require('./invsvc');
const FX = require('./fx17');
const T = require('./tran17');
const Cat = require('./catalog17');
const { I, C } = Cat;
const { now, int, fmtNum } = require('../util');
const { Delta } = Cu;

const key = (id) => `tran:${id}`;
const fmtT = (s) => require('./format').fmtTime(s);
const upgradeFee = (user, id) => Math.round(T.upkeepCost(user, id) * 2 + 1);
function upgrade(user, id, q) {
  q = int(q); const d = C.TRANS[id]; if (!d) return { ok: false, msg: 'Không phải trận pháp.' };
  if (!(q >= 1 && q < 5)) return { ok: false, msg: 'Chỉ nâng được trận bàn phẩm 1–4.' };
  return D.transaction(() => {
    const fee = upgradeFee(user, id); const me = Cu.getCultivator(user);
    if (Inv.qty(user, id, q) < 3) return { ok: false, msg: `Cần 3 × ${I.BY_ID[id].name} (${I.qName(q)}) — hiện có ${Inv.qty(user, id, q)}.` };
    if (me.linh_thach < fee) return { ok: false, msg: `Cần ${fmtNum(fee)} Linh Thạch phí nâng phẩm.` };
    if (!Cu.updateCultivator(user, { linh_thach: new Delta(-fee) }, { linh_thach: fee })) return { ok: false, msg: Cu.MSG_BALANCE_CHANGED };
    if (!Inv.take(user, id, 3, { q, why: 'nâng phẩm trận' })) return { ok: false, msg: 'Không đủ trận bàn.' };
    Inv.add(user, id, 1, { q: q + 1, why: 'nâng phẩm trận' });
    return { ok: true, msg: `🔯 Ghép 3 × ${I.BY_ID[id].name} (${I.qName(q)}) → 1 × **${I.qName(q + 1)}** (−${fmtNum(fee)} Linh Thạch).` };
  });
}
const mine = (user, id) => FX.listBuffs(user, 'tran').find((b) => b.key === key(id));
function recall(user, id) {
  return D.transaction(() => {
    const b = mine(user, id); const d = C.TRANS[id]; if (!b || !d) return { ok: false, msg: 'Bạn không có trận này đang chạy.' };
    const left = Math.max(0, b.until - now()); const refund = Math.floor(0.5 * T.upkeepCost(user, id) * Math.min(1, left / d.dur));
    D.run('DELETE FROM fx_buffs WHERE user_id = ? AND key = ?', String(user), key(id)); FX.recompute(user);
    if (refund > 0) Cu.updateCultivator(user, { linh_thach: new Delta(refund) });
    return { ok: true, msg: `↩️ Đã thu hồi **${I.BY_ID[id].name}** (còn ${fmtT(left)}), hoàn **${fmtNum(refund)}** Linh Thạch.` };
  });
}
function renew(user, id) {
  return D.transaction(() => {
    const b = mine(user, id); const d = C.TRANS[id]; if (!b || !d) return { ok: false, msg: 'Bạn không có trận này đang chạy.' };
    if (d.charges) return { ok: false, msg: 'Trận giới hạn số lượt không gia cố được — hãy triển khai lại.' };
    const left = Math.max(0, b.until - now()); if (left >= d.dur * 0.5) return { ok: false, msg: `Trận còn ${fmtT(left)} — chỉ gia cố khi còn dưới 50% thời gian.` };
    if (Inv.dailyGet(user, `tran20r:${id}`) >= 1) return { ok: false, msg: 'Hôm nay bạn đã gia cố trận này rồi.' };
    const fee = Math.round(T.upkeepCost(user, id) * 0.6); const me = Cu.getCultivator(user);
    if (me.linh_thach < fee) return { ok: false, msg: `Cần ${fmtNum(fee)} Linh Thạch để gia cố.` };
    if (!Cu.updateCultivator(user, { linh_thach: new Delta(-fee) }, { linh_thach: fee })) return { ok: false, msg: Cu.MSG_BALANCE_CHANGED };
    D.run('UPDATE fx_buffs SET until = ? WHERE user_id = ? AND key = ?', now() + d.dur, String(user), key(id)); FX.recompute(user);
    Inv.dailyAdd(user, `tran20r:${id}`, 1);
    return { ok: true, msg: `🛡️ Gia cố **${I.BY_ID[id].name}**: kéo dài về đủ ${fmtT(d.dur)} (−${fmtNum(fee)} Linh Thạch).` };
  });
}
module.exports = { upgrade, recall, renew, upgradeFee };
