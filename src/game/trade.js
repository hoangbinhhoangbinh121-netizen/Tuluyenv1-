'use strict';
/** Giao Dịch 2 chiều — toàn bộ kiểm tra + trừ/cộng cả 2 chiều nằm trong 1 transaction */
const K = require('./constants');
const CD = require('./cooldowns');
const Cu = require('./cultivator');
const D = require('../db');
const T = require('./talent');
const { E } = require('./emoji');
const { now, fmtNum } = require('../util');

const sideParts = (lt, dd, lc, tc) => {
  const p = [];
  if (lt) p.push(`**${fmtNum(lt)}** ${E.linhthach} Linh Thạch`);
  if (dd) p.push(`**${fmtNum(dd)}** ${E.danduoc} Đan Dược`);
  if (lc) p.push(`**${E.linhcan} ${lc}**`);
  if (tc) p.push(`**${E.thechat} ${tc}**`);
  return p;
};
function formatOffer(offer, fromRow = null, toRow = null) {
  const g = sideParts(offer.linh_thach, offer.dan_duoc, offer.linh_can_give && fromRow ? fromRow.linh_can : null, offer.the_chat_give && fromRow ? fromRow.the_chat : null);
  const w = sideParts(offer.want_linh_thach, offer.want_dan_duoc, offer.want_linh_can && toRow ? toRow.linh_can : null, offer.want_the_chat && toRow ? toRow.the_chat : null);
  return `🎁 Gửi đi: ${g.length ? g.join(' + ') : '(không có gì)'}\n🙏 Muốn nhận: ${w.length ? w.join(' + ') : '(không có gì)'}`;
}

/** → 'ok' hoặc chuỗi lỗi */
function createOffer(fromId, toId, lt, dd, lcGive, tcGive, wlt, wdd, wlc, wtc) {
  if (String(fromId) === String(toId)) return '❌ Không thể giao dịch với chính mình.';
  for (const [label, val] of [['Linh Thạch muốn gửi', lt], ['Đan Dược muốn gửi', dd], ['Linh Thạch muốn nhận', wlt], ['Đan Dược muốn nhận', wdd]]) {
    if (!(val >= 0) || !Number.isInteger(val)) return `❌ ${label} không hợp lệ.`;
  }
  if (![lt, dd, lcGive, tcGive, wlt, wdd, wlc, wtc].some(Boolean)) return '❌ Giao dịch trống — phải khai ít nhất 1 thứ ở phần GỬI hoặc MUỐN NHẬN.';
  if (lcGive !== wlc) return '❌ Đổi Linh Căn phải chọn CẢ 2 bước (GỬI Linh Căn của mình VÀ MUỐN NHẬN Linh Căn của đối phương) — Linh Căn chỉ có thể đổi chéo, không cho/nhận đơn lẻ được.';
  if (tcGive !== wtc) return '❌ Đổi Thể Chất phải chọn CẢ 2 bước (GỬI Thể Chất của mình VÀ MUỐN NHẬN Thể Chất của đối phương) — Thể Chất chỉ có thể đổi chéo, không cho/nhận đơn lẻ được.';
  const f = Cu.getCultivator(fromId); if (!f) return '❌ Bạn chưa bắt đầu tu tiên (dùng `/batdau` trước).';
  const t = Cu.getCultivator(toId); if (!t) return '❌ Người nhận chưa bắt đầu tu tiên.';
  if (lt > f.linh_thach) return `❌ Bạn không đủ Linh Thạch để gửi (cần ${fmtNum(lt)}, hiện có ${fmtNum(f.linh_thach)}).`;
  if (dd > (f.dan_duoc || 0)) return `❌ Bạn không đủ Đan Dược để gửi (cần ${fmtNum(dd)}, hiện có ${fmtNum(f.dan_duoc || 0)}).`;
  if (wlt > t.linh_thach) return `❌ Đối phương không đủ Linh Thạch mà bạn muốn nhận (cần ${fmtNum(wlt)}, họ hiện có ${fmtNum(t.linh_thach)}).`;
  if (wdd > (t.dan_duoc || 0)) return `❌ Đối phương không đủ Đan Dược mà bạn muốn nhận (cần ${fmtNum(wdd)}, họ hiện có ${fmtNum(t.dan_duoc || 0)}).`;
  if (lcGive && f.linh_can === t.linh_can) return '❌ Hai bên đã cùng loại Linh Căn — không cần đổi.';
  if (tcGive && f.the_chat === t.the_chat) return '❌ Hai bên đã cùng loại Thể Chất — không cần đổi.';
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
  const { linh_thach: lt, dan_duoc: dd, want_linh_thach: wlt, want_dan_duoc: wdd } = offer;
  const lcGive = !!offer.linh_can_give; const tcGive = !!offer.the_chat_give; const wlc = !!offer.want_linh_can; const wtc = !!offer.want_the_chat;
  const outcome = D.transaction(() => {
    const f = D.get('SELECT * FROM cultivators WHERE user_id = ?', fromId); const t = D.get('SELECT * FROM cultivators WHERE user_id = ?', toId);
    const cancel = (msg) => { deleteOffer(fromId, toId); return { msg }; };
    if (!f || !t) return cancel('❌ Một trong hai bên không còn dữ liệu tu tiên hợp lệ.');
    if (lt > f.linh_thach) return cancel(`❌ Người gửi không còn đủ ${fmtNum(lt)} ${E.linhthach} Linh Thạch — giao dịch bị huỷ.`);
    if (dd > (f.dan_duoc || 0)) return cancel(`❌ Người gửi không còn đủ ${fmtNum(dd)} ${E.danduoc} Đan Dược — giao dịch bị huỷ.`);
    if (wlt > t.linh_thach) return cancel(`❌ Bạn không còn đủ ${fmtNum(wlt)} ${E.linhthach} Linh Thạch để đổi lại — giao dịch bị huỷ.`);
    if (wdd > (t.dan_duoc || 0)) return cancel(`❌ Bạn không còn đủ ${fmtNum(wdd)} ${E.danduoc} Đan Dược để đổi lại — giao dịch bị huỷ.`);
    if (lcGive && f.linh_can === t.linh_can) return cancel('❌ Hai bên hiện đã cùng loại Linh Căn — giao dịch bị huỷ.');
    if (tcGive && f.the_chat === t.the_chat) return cancel('❌ Hai bên hiện đã cùng loại Thể Chất — giao dịch bị huỷ.');
    if (lt || wlt) {
      D.run('UPDATE cultivators SET linh_thach = linh_thach - ? + ? WHERE user_id = ?', lt, wlt, fromId);
      D.run('UPDATE cultivators SET linh_thach = linh_thach - ? + ? WHERE user_id = ?', wlt, lt, toId);
    }
    if (dd || wdd) {
      D.run('UPDATE cultivators SET dan_duoc = COALESCE(dan_duoc, 0) - ? + ? WHERE user_id = ?', dd, wdd, fromId);
      D.run('UPDATE cultivators SET dan_duoc = COALESCE(dan_duoc, 0) - ? + ? WHERE user_id = ?', wdd, dd, toId);
    }
    // v13.6: hồ sơ Thức Tỉnh / Tiến Hóa đi CÙNG phẩm cấp được đổi (hành, độ tinh khiết, giai đoạn...)
    const ef = { ...f, ...T.syncFields(f) }; const et = { ...t, ...T.syncFields(t) };
    const setCols = (id, src, cols) => D.run(`UPDATE cultivators SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE user_id = ?`, ...cols.map((c) => src[c]), id);
    if (lcGive && wlc) { const cols = ['linh_can', ...T.LC_COLS]; setCols(fromId, et, cols); setCols(toId, ef, cols); }
    if (tcGive && wtc) { const cols = ['the_chat', ...T.TC_COLS]; setCols(fromId, et, cols); setCols(toId, ef, cols); }
    deleteOffer(fromId, toId);
    return { ok: true, f, t };
  });
  if (!outcome.ok) return outcome.msg;
  return `${E.giaodich} Giao dịch thành công giữa <@${fromId}> và <@${toId}>!\n${formatOffer(offer, outcome.f, outcome.t)}`;
}
module.exports = { formatOffer, createOffer, getOffer, deleteOffer, acceptOffer };
