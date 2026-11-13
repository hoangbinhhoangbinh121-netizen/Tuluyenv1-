'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
/** TuTienStore — cấu hình đọc từ biến môi trường (.env / Startup của host). Đọc lại mỗi lần gọi nên đổi .env + restart là có hiệu lực. */
const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) && v !== '' && v !== undefined ? Math.min(hi, Math.max(lo, n)) : d; };

function qrFile(e) {
  // Ảnh QR tĩnh (ZaloPay / MoMo / QR ngân hàng không có số tiền). Mặc định assets/store/qr.jpg nếu file tồn tại.
  const raw = String(e.STORE_QR_IMAGE || 'assets/store/qr.jpg').trim();
  const abs = path.isAbsolute(raw) ? raw : path.join(ROOT, raw);
  try { return fs.statSync(abs).isFile() ? abs : ''; } catch (_) { return ''; }
}

function get() {
  const e = process.env;
  const prefix = String(e.STORE_PAYMENT_PREFIX || 'TTS').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) || 'TTS';
  return {
    bank: String(e.STORE_BANK_ID || '').trim(),                         // mã ngân hàng theo VietQR: MB, VCB, TCB, ACB, BIDV, VPB...
    account: String(e.STORE_ACCOUNT_NO || '').replace(/\s+/g, ''),      // số tài khoản nhận tiền
    name: String(e.STORE_ACCOUNT_NAME || '').trim(),                    // tên chủ tài khoản (không dấu cũng được)
    sepayKey: String(e.STORE_SEPAY_API_KEY || '').trim(),               // API key đặt ở webhook SePay (kiểu xác thực "API Key")
    port: num(e.STORE_WEBHOOK_PORT || e.SERVER_PORT || e.PORT, 0, 0, 65535),
    ttlMin: num(e.STORE_ORDER_TTL_MIN, 15, 5, 120),                     // phút hiệu lực của QR (đơn quá hạn VẪN được giao nếu tiền về)
    adminChannel: String(e.STORE_ADMIN_CHANNEL_ID || '').trim(),        // kênh báo đơn/sự cố cho admin (bỏ trống = nhắn riêng admin)
    maxPending: num(e.STORE_MAX_PENDING, 3, 1, 10),                     // số đơn chờ thanh toán tối đa / người
    qrImage: qrFile(e),                                                  // ảnh QR tĩnh (chế độ duyệt tay)
    prefix,
  };
}
/** Chế độ VietQR động (có sẵn số tiền + nội dung, nhận tiền tự động được) cần đủ ngân hàng; không thì dùng ảnh QR tĩnh (admin duyệt tay). */
const vietqrReady = (c = get()) => !!(c.bank && c.account && c.name);
const mode = (c = get()) => (vietqrReady(c) ? 'vietqr' : (c.qrImage ? 'static' : 'none'));
/** Đủ thông tin để nhận đơn chưa. */
const payReady = (c = get()) => mode(c) !== 'none';
/** Có nhận tiền tự động (webhook SePay) không — nếu không, admin xác nhận tay bằng /storeadmin duyet. */
const autoReady = (c = get()) => !!(vietqrReady(c) && c.sepayKey && c.port);

/** Cho phép khách chuyển khoản TRỰC TIẾP cho từng vật phẩm (không qua Thiên Tệ). Đặt STORE_DIRECT_BUY=0 để chỉ bán bằng Thiên Tệ. */
const directBuy = () => !/^(0|false|no|off)$/i.test(String(process.env.STORE_DIRECT_BUY || '1').trim());

module.exports = { directBuy, get, payReady, autoReady, vietqrReady, mode };
