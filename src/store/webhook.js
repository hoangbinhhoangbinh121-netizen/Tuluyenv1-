'use strict';
/**
 * Webhook nhận tiền về từ SePay (https://sepay.vn): POST /sepay, xác thực bằng header  Authorization: Apikey <STORE_SEPAY_API_KEY>.
 * Dùng module http có sẵn của Node — không cần cài thêm thư viện. Trả 200 {"success":true} thì SePay coi là đã nhận.
 */
const http = require('node:http');
const crypto = require('node:crypto');
const CFG = require('./config');

const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();
function authOk(req, key) {
  if (!key) return false;
  const raw = String(req.headers.authorization || req.headers['x-api-key'] || '');
  const got = raw.replace(/^(Apikey|Bearer)\s+/i, '').trim();
  return crypto.timingSafeEqual(digest(got), digest(key));       // so sánh hằng thời gian
}
function readBody(req, max = 65536) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > max) { reject(new Error('body quá lớn')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** onTx({ txId, amount, content, account }) được gọi cho mỗi giao dịch tiền VÀO hợp lệ. Trả server hoặc null (nếu chưa đủ cấu hình). */
function start(onTx) {
  const cfg = CFG.get();
  if (!cfg.sepayKey) { console.warn('ℹ️ TuTienStore: chưa đặt STORE_SEPAY_API_KEY → KHÔNG nhận tiền tự động. Admin xác nhận tay bằng /storeadmin duyet.'); return null; }
  if (!cfg.port) { console.warn('ℹ️ TuTienStore: chưa có cổng webhook (STORE_WEBHOOK_PORT / SERVER_PORT) → KHÔNG nhận tiền tự động.'); return null; }
  const server = http.createServer(async (req, res) => {
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    try {
      const url = String(req.url || '').split('?')[0];
      if (req.method === 'GET' && (url === '/' || url === '/health')) return send(200, { ok: true, service: 'tutienstore' });
      if (req.method === 'POST' && url === '/sepay') {
        if (!authOk(req, cfg.sepayKey)) return send(401, { success: false, message: 'unauthorized' });
        let d; try { d = JSON.parse(await readBody(req)); } catch (_) { return send(400, { success: false, message: 'bad json' }); }
        if (String(d.transferType || '').toLowerCase() !== 'in') return send(200, { success: true });   // chỉ quan tâm tiền VÀO
        await onTx({
          txId: d.id !== undefined && d.id !== null ? d.id : d.referenceCode,
          amount: d.transferAmount,
          content: [d.code, d.content, d.description].filter(Boolean).join(' '),
          account: d.accountNumber,
        });
        return send(200, { success: true });
      }
      return send(404, { success: false });
    } catch (e) {
      console.error('⚠️ TuTienStore webhook:', e && e.message);
      return send(500, { success: false });      // 5xx → SePay tự gửi lại; giao dịch trùng đã được chặn bằng store_tx
    }
  });
  server.on('error', (e) => console.error('❌ TuTienStore webhook không mở được cổng:', e.message));
  server.listen(cfg.port, '0.0.0.0', () => console.log(`🏪 TuTienStore webhook đang nghe: cổng ${cfg.port} (POST /sepay · GET /health)`));
  return server;
}

module.exports = { start };
