'use strict';
/** Giao Dịch 2 chiều — toàn bộ kiểm tra + trừ/cộng cả 2 chiều nằm trong 1 transaction */
const K = require('./constants');
const CD = require('./cooldowns');
const Cu = require('./cultivator');
const D = require('../db');
const { E } = require('./emoji');
const { now, fmtNum } = require('../util');

const sideParts = (lt, dd) => {
  const p = [];
  if (lt) p.push(`**${fmtNum(lt)}** ${E.linhthach} Linh Thạch`);
  if (dd) p.push(`**${fmtNum(dd)}** ${E.danduoc} Đan Dược`);
  return p;
};
function formatOffer(offer) {
  const g = sideParts(offer.linh_thach, offer.dan_duoc);
  const w = sideParts(offer.want_linh_thach, offer.want_dan_duoc);
  return `🎁 Gửi đi: ${g.length ? g.join(' + ') : '(không có gì)'}\n🙏 Muốn nhận: ${w.length ? w.join(' + ') : '(không có gì)'}`;
}
/** v16.7: đã LOẠI BỎ việc đổi Linh Căn / Thể Chất giữa người chơi (chỉ còn Linh Thạch + Đan Dược). */
const MSG_NO_TALENT_TRADE = '🚫 Đã **loại bỏ** việc giao dịch / đổi **Linh Căn** và **Thể Chất** giữa người chơi. Giao Dịch chỉ còn Linh Thạch và Đan Dược.';

/** → 'ok' hoặc chuỗi lỗi */
function createOffer(fromId, toId, lt, dd, lcGive, tcGive, wlt, wdd, wlc, wtc) {
  if (lcGive || tcGive || wlc || wtc) return MSG_NO_TALENT_TRADE;
  if (String(fromId) === String(toId)) return '❌ Không thể giao dịch với chính mình.';
  for (const [label, val] of [['Linh Thạch muốn gửi', lt], ['Đan Dược muốn gửi', dd], ['Linh Thạch muốn nhận', wlt], ['Đan Dược muốn nhận', wdd]]) {
    if (!(val >= 0) || !Number.isInteger(val)) return `❌ ${label} không hợp lệ.`;
  }
  if (![lt, dd, wlt, wdd].some(Boolean)) return '❌ Giao dịch trống — phải khai ít nhất 1 thứ ở phần GỬI hoặc MUỐN NHẬN.';
  const f = Cu.getCultivator(fromId); if (!f) return '❌ Bạn chưa bắt đầu tu tiên (dùng `/batdau` trước).';
  const t = Cu.getCultivator(toId); if (!t) return '❌ Người nhận chưa bắt đầu tu tiên.';
  if (lt > f.linh_thach) return `❌ Bạn không đủ Linh Thạch để gửi (cần ${fmtNum(lt)}, hiện có ${fmtNum(f.linh_thach)}).`;
  if (dd > (f.dan_duoc || 0)) return `❌ Bạn không đủ Đan Dược để gửi (cần ${fmtNum(dd)}, hiện có ${fmtNum(f.dan_duoc || 0)}).`;
  if (wlt > t.linh_thach) return `❌ Đối phương không đủ Linh Thạch mà bạn muốn nhận (cần ${fmtNum(wlt)}, họ hiện có ${fmtNum(t.linh_thach)}).`;
  if (wdd > (t.dan_duoc || 0)) return `❌ Đối phương không đủ Đan Dược mà bạn muốn nhận (cần ${fmtNum(wdd)}, họ hiện có ${fmtNum(t.dan_duoc || 0)}).`;
  D.run(`INSERT OR REPLACE INTO trade_pending (from_id, to_id, linh_thach, dan_duoc, linh_can_give, the_chat_give, want_linh_thach, want_dan_duoc, want_linh_can, want_the_chat, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, fromId, toId, lt, dd, +lcGive, +tcGive, wlt, wdd, +wlc, +wtc, now());
  return 'ok';
}
const getOffer = (f, t) => D.get('SELECT * FROM trade_pending WHERE from_id = ? AND to_id = ?', f, t);
const deleteOffer = (f, t) => D.run('DELETE FROM trade_pending WHERE from_id = ? AND to_id = ?', f, t);

function acceptOffer(fromId, toId) {
  const offer = getOffer(fromId, toId);
  if (!offer) return '❌ Không tìm thấy đề xuất giao dịch nào từ người này (có thể đã hết hạn hoặc bị huỷ).';
  if (now() - offer.created_at > CD.TRADE_EXPIRE_SECONDS) { deleteOffer(fromId, toId); return '⏳ Đề xuất giao dịch đã hết hạn (quá 15 phút), hãy nhờ họ đề xuất lại.'; }
  if (offer.linh_can_give || offer.the_chat_give || offer.want_linh_can || offer.want_the_chat) { deleteOffer(fromId, toId); return `${MSG_NO_TALENT_TRADE}\nĐề xuất cũ này đã bị huỷ, không có gì bị trừ.`; }   // đề xuất tồn đọng từ bản cũ
  const { linh_thach: lt, dan_duoc: dd, want_linh_thach: wlt, want_dan_duoc: wdd } = offer;
  const outcome = D.transaction(() => {
    const f = D.get('SELECT * FROM cultivators WHERE user_id = ?', fromId); const t = D.get('SELECT * FROM cultivators WHERE user_id = ?', toId);
    const cancel = (msg) => { deleteOffer(fromId, toId); return { msg }; };
    if (!f || !t) return cancel('❌ Một trong hai bên không còn dữ liệu tu tiên hợp lệ.');
    if (lt > f.linh_thach) return cancel(`❌ Người gửi không còn đủ ${fmtNum(lt)} ${E.linhthach} Linh Thạch — giao dịch bị huỷ.`);
    if (dd > (f.dan_duoc || 0)) return cancel(`❌ Người gửi không còn đủ ${fmtNum(dd)} ${E.danduoc} Đan Dược — giao dịch bị huỷ.`);
    if (wlt > t.linh_thach) return cancel(`❌ Bạn không còn đủ ${fmtNum(wlt)} ${E.linhthach} Linh Thạch để đổi lại — giao dịch bị huỷ.`);
    if (wdd > (t.dan_duoc || 0)) return cancel(`❌ Bạn không còn đủ ${fmtNum(wdd)} ${E.danduoc} Đan Dược để đổi lại — giao dịch bị huỷ.`);
    if (lt || wlt) {
      D.run('UPDATE cultivators SET linh_thach = linh_thach - ? + ? WHERE user_id = ?', lt, wlt, fromId);
      D.run('UPDATE cultivators SET linh_thach = linh_thach - ? + ? WHERE user_id = ?', wlt, lt, toId);
    }
    if (dd || wdd) {
      D.run('UPDATE cultivators SET dan_duoc = COALESCE(dan_duoc, 0) - ? + ? WHERE user_id = ?', dd, wdd, fromId);
      D.run('UPDATE cultivators SET dan_duoc = COALESCE(dan_duoc, 0) - ? + ? WHERE user_id = ?', wdd, dd, toId);
    }
    deleteOffer(fromId, toId);
    return { ok: true, f, t };
  });
  if (!outcome.ok) return outcome.msg;
  return `${E.giaodich} Giao dịch thành công giữa <@${fromId}> và <@${toId}>!\n${formatOffer(offer)}`;
}
module.exports = { formatOffer, createOffer, getOffer, deleteOffer, acceptOffer, MSG_NO_TALENT_TRADE };
