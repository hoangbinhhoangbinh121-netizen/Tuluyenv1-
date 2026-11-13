'use strict';
/**
 * TuTienStore — Nạp THIÊN TỆ theo số tiền tuỳ ý. Nạp càng nhiều, tỉ lệ quy đổi càng cao (thưởng % cộng thêm).
 * Muốn đổi bảng thưởng: sửa TIERS bên dưới. Tỉ lệ gốc (Thiên Tệ / 1.000đ) đặt bằng STORE_TT_PER_1K trong .env.
 */
const { fmtNum } = require('../util');
const { vnd } = require('./catalog');

const Wallet = require('./wallet');
const BASE_TT_PER_1000 = Wallet.TT_PER_1000;      // mặc định 10.000đ = 100 Thiên Tệ
const MIN = 10000; const MAX = 20000000; const STEP = 1000;
const TIERS = [          // thưởng % trên TOÀN BỘ số Thiên Tệ quy đổi
  { min: 10000, pct: 0 }, { min: 50000, pct: 5 }, { min: 100000, pct: 10 },
  { min: 200000, pct: 15 }, { min: 500000, pct: 20 }, { min: 1000000, pct: 30 },
];
const PRESETS = [10000, 20000, 50000, 100000, 200000, 500000, 1000000, 2000000];

function quote(amount) {
  amount = Math.floor(Number(amount));
  if (!Number.isFinite(amount) || amount < MIN) return { ok: false, msg: `Nạp tối thiểu ${vnd(MIN)}.` };
  if (amount > MAX) return { ok: false, msg: `Mỗi lần nạp tối đa ${vnd(MAX)}.` };
  if (amount % STEP) return { ok: false, msg: 'Số tiền phải tròn nghìn đồng (ví dụ 50.000đ).' };
  const tier = [...TIERS].reverse().find((t) => amount >= t.min);
  const base = (amount / STEP) * BASE_TT_PER_1000;
  const bonus = Math.round((base * tier.pct) / 100);
  return { ok: true, amount, base, bonus, pct: tier.pct, total: base + bonus, perK: Math.round(((base + bonus) / (amount / STEP)) * 100) / 100 };
}

/** Hiểu "50000", "50.000", "50k", "1tr", "1,5tr", "50.000đ"... → số tiền (VNĐ) hoặc NaN. */
function parseAmount(raw) {
  const s = String(raw || '').toLowerCase().replace(/\s+/g, '').replace(/vnd|vnđ|đ|d$/g, '');
  const m = /^([\d.,]+)(k|tr|m)?$/.exec(s); if (!m) return NaN;
  if (m[2]) { const n = parseFloat(m[1].replace(/\./g, '').replace(',', '.')); return Math.round(n * (m[2] === 'k' ? 1e3 : 1e6)); }
  return parseInt(m[1].replace(/[.,]/g, ''), 10);
}
/** Hiển thị tỉ lệ có số lẻ kiểu Việt: 10,5 */
const rate = (n) => String(n).replace('.', ',');
const tierLines = () => TIERS.map((t, i) => {
  const next = TIERS[i + 1]; const q = quote(t.min);
  return `${t.pct ? `**+${t.pct}%**` : 'gốc'} · từ **${vnd(t.min)}**${next ? ` đến ${vnd(next.min - 1)}` : ' trở lên'} → ${rate(q.perK)} Thiên Tệ / 1.000đ`;
});

module.exports = { quote, parseAmount, tierLines, rate, TIERS, PRESETS, MIN, MAX, BASE_TT_PER_1000 };
