'use strict';
/**
 * TuTienStore — điều phối: khởi động webhook + dọn đơn quá hạn, và "báo kết quả" cho người chơi / admin.
 * Báo cho người chơi: ưu tiên TIN NHẮN ẨN (followUp ephemeral trên lượt mở cửa hàng, còn hiệu lực ~15 phút);
 * hết hạn thì nhắn riêng (DM). Không bao giờ gửi vào kênh công khai.
 */
const { MessageFlags } = require('discord.js');
const K = require('../game/constants');
const CFG = require('./config');
const Schema = require('./schema');
const O = require('./orders');
const M = require('./messages');
const W = require('./webhook');
const { vnd } = require('./catalog');

let _client = null;
const sessions = new Map();                       // mã đơn -> { i: interaction gốc, exp }
const SESSION_MS = 14 * 60 * 1000;                // token interaction của Discord sống 15 phút

/** Lưu lượt tương tác để về sau báo "thanh toán thành công" bằng tin nhắn ẩn. */
function registerSession(code, interaction) { sessions.set(code, { i: interaction, exp: Date.now() + SESSION_MS }); }

async function tellUser(userId, code, payload, { editPanel = null } = {}) {
  const s = sessions.get(code);
  if (s && Date.now() < s.exp) {
    try {
      if (editPanel) { try { await s.i.editReply({ ...editPanel, components: [], attachments: [] }); } catch (_) { /* panel đã đổi — bỏ qua */ } }
      await s.i.followUp({ ...payload, flags: MessageFlags.Ephemeral });
      return true;
    } catch (_) { /* token hết hạn → DM */ }
  }
  try { const u = await _client.users.fetch(String(userId)); await u.send(payload); return true; } catch (_) { return false; }
}

async function alertAdmin(text) {
  if (!_client) return;
  const cfg = CFG.get(); const body = { content: String(text).slice(0, 1900) };
  if (cfg.adminChannel) { try { const ch = await _client.channels.fetch(cfg.adminChannel); await ch.send(body); return; } catch (_) { /* thử DM */ } }
  for (const id of K.ADMIN_CODE_APPROVER_IDS.slice(0, 3)) { try { const u = await _client.users.fetch(String(id)); await u.send(body); } catch (_) { /* bỏ qua */ } }
}

/** Xử lý kết quả của O.handlePayment / O.confirmManual: báo người chơi + admin. */
async function settle(r) {
  try {
    const o = r.order;
    switch (r.kind) {
      case 'delivered': {
        const extra = r.over > 0 ? `\n💡 Bạn chuyển dư ${vnd(r.over)} — liên hệ admin nếu cần hoàn.` : '';
        const emb = M.success(o, r.lines || [], extra);
        await tellUser(o.user_id, o.code, { embeds: [emb] }, { editPanel: { embeds: [emb] } });
        await alertAdmin(`💰 Đơn \`${o.code}\` đã giao${r.manual ? ' (admin duyệt tay)' : ''}: ${o.product_name}${o.qty > 1 ? ` ×${o.qty}` : ''} — ${vnd(o.amount)} — khách <@${o.user_id}>`);
        break;
      }
      case 'delivery_error':
        await tellUser(o.user_id, o.code, { embeds: [M.deliveryError(o)] });
        await alertAdmin(`🚨 **Đã nhận tiền nhưng GIAO HÀNG LỖI** — đơn \`${o.code}\` (${o.product_name}) khách <@${o.user_id}>: ${r.error}\nSửa nguyên nhân rồi chạy \`/storeadmin giaolai ${o.code}\` (hoặc hoàn tiền thủ công).`);
        break;
      case 'underpaid':
        await tellUser(o.user_id, o.code, { embeds: [M.underpaid(o, r)] });
        await alertAdmin(`ℹ️ Đơn \`${o.code}\` mới nhận ${vnd(r.total)}/${vnd(o.amount)} (thiếu ${vnd(r.missing)}) — khách <@${o.user_id}>. Khách được nhắc chuyển bù.`);
        break;
      case 'double_paid':
        await alertAdmin(`⚠️ **Thanh toán lặp** cho đơn \`${o.code}\` (đã ở trạng thái ${o.status}) — nhận thêm ${vnd(r.amount)}, khách <@${o.user_id}>. Cần hoàn tiền thủ công.`);
        break;
      case 'paid_cancelled':
        await alertAdmin(`⚠️ Đơn \`${o.code}\` đã HUỶ nhưng vừa nhận ${vnd(r.amount)} — khách <@${o.user_id}>. Nếu muốn giao: \`/storeadmin duyet ${o.code}\`; không thì hoàn tiền.`);
        break;
      case 'no_order':
        await alertAdmin(`⚠️ Nhận ${vnd(r.amount)} có mã \`${r.code}\` nhưng KHÔNG có đơn tương ứng (gõ sai mã?). Kiểm tra sao kê và xử lý thủ công.`);
        break;
      default: break;   // no_code / duplicate / ignored: tiền không liên quan cửa hàng — im lặng
    }
  } catch (e) { console.error('⚠️ TuTienStore settle:', e && e.message); }
}

const _claimAt = new Map();
/** Khách bấm "Tôi đã chuyển" (chế độ QR tĩnh): báo admin kiểm tra lịch sử nhận tiền rồi duyệt. Chống spam 90 giây/đơn. */
async function claimPaid(o) {
  const last = _claimAt.get(o.code) || 0;
  if (Date.now() - last < 90000) return false;
  _claimAt.set(o.code, Date.now());
  await alertAdmin(`🔔 Khách <@${o.user_id}> báo **đã chuyển ${vnd(o.amount)}** cho đơn \`${o.code}\` (${o.product_name}).\nKiểm tra lịch sử nhận tiền (lời nhắn \`${o.code}\`), đúng thì chạy \`/storeadmin duyet ${o.code}\`.`);
  return true;
}

async function onWebhookTx(tx) {
  const r = O.handlePayment(tx);
  if (r.kind !== 'duplicate' && r.kind !== 'ignored') console.log(`🏪 TuTienStore tx ${tx.txId}: ${r.kind}${r.order ? ` (đơn ${r.order.code})` : ''}`);
  await settle(r);
}

function start(client) {
  _client = client;
  Schema.ensure();
  W.start(onWebhookTx);
  const tick = async () => {
    try {
      O.sweepExpired();
      for (const [code, s] of sessions) if (Date.now() > s.exp) sessions.delete(code);
      for (const r of O.reprocessStuck()) await settle(r);
    } catch (e) { console.error('⚠️ TuTienStore tick:', e && e.message); }
  };
  setInterval(tick, 60 * 1000).unref();
  tick();
  const c = CFG.get();
  const m = CFG.mode(c);
  console.log(`🏪 TuTienStore: ${m === 'vietqr' ? 'VietQR động' : m === 'static' ? 'QR tĩnh (assets/store/qr.jpg)' : 'CHƯA cấu hình (cần STORE_BANK_ID/STORE_ACCOUNT_NO/STORE_ACCOUNT_NAME hoặc ảnh QR)'} · ${CFG.autoReady(c) ? 'nhận tiền tự động (SePay)' : 'admin duyệt tay'}`);
}

module.exports = { start, settle, registerSession, tellUser, alertAdmin, claimPaid };
