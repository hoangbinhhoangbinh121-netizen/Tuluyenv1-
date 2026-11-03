'use strict';
/**
 * Tiện ích định dạng DUY NHẤT cho toàn bot (spec v7 §7): số dùng dấu chấm ngăn cách hàng nghìn, phần trăm dùng dấu phẩy,
 * thời gian tiếng Việt, tuyệt đối không in "undefined" / "null" / "NaN".
 */
const toNum = (n) => {
  if (typeof n === 'bigint') return Number(n);
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
};

/** 1250000 → "1.250.000" (cắt phần thập phân). */
function num(n) {
  const v = Math.trunc(toNum(n));
  const neg = v < 0;
  let s;
  try { s = BigInt(Math.abs(v)).toString(); } catch (_) { s = String(Math.abs(v)); }
  s = s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return neg ? `-${s}` : s;
}

/** Rút gọn số rất lớn cho chỗ hẹp: 1.250.000.000 → "1,25 tỷ". */
function compact(n) {
  const v = toNum(n); const a = Math.abs(v);
  const f = (x, unit) => `${(Math.round(x * 100) / 100).toString().replace('.', ',')} ${unit}`;
  if (a >= 1e12) return f(v / 1e12, 'nghìn tỷ');
  if (a >= 1e9) return f(v / 1e9, 'tỷ');
  if (a >= 1e6) return f(v / 1e6, 'triệu');
  return num(v);
}

/** 0.755 → "75,5%" ; 0.5 → "50%" (không có số thập phân thừa). ratio=true nếu đầu vào là 0..1. */
function pct(x, { ratio = true, digits = 1 } = {}) {
  const v = toNum(x) * (ratio ? 100 : 1);
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  return `${String(r).replace('.', ',')}%`;
}

/** "8.500 / 10.000" */
const exp = (cur, max) => `${num(cur)} / ${num(max)}`;

const pad2 = (x) => String(x).padStart(2, '0');
/** Giây → "02 giờ 30 phút" | "05 phút 03 giây" | "9 giây". */
function dur(seconds) {
  const s = Math.max(0, Math.trunc(toNum(seconds)));
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60;
  if (h > 0) return `${pad2(h)} giờ ${pad2(m)} phút`;
  if (m > 0) return `${pad2(m)} phút ${pad2(r)} giây`;
  return `${r} giây`;
}
/** Ngày giờ thật: "02/11/2026 · 17:30" */
function dateTime(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  return `${pad2(x.getDate())}/${pad2(x.getMonth() + 1)}/${x.getFullYear()} · ${pad2(x.getHours())}:${pad2(x.getMinutes())}`;
}
/** Mốc thời gian động của Discord: <t:...:R> (đếm ngược/so với hiện tại). */
const discordTime = (unixSeconds, style = 'R') => `<t:${Math.trunc(toNum(unixSeconds))}:${style}>`;

const level = (n) => `Cấp ${num(n)}`;
const stageText = (realm, stage) => (stage ? `${realm} · ${stage}` : String(realm));

/** Giá trị an toàn để in ra: null/undefined/NaN/'' → fallback. */
function safe(v, fallback = '—') {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'number' && !Number.isFinite(v)) return fallback;
  const s = String(v);
  if (s === '' || s === 'undefined' || s === 'null' || s === 'NaN') return fallback;
  return s;
}
const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? `${s.slice(0, Math.max(0, n - 1))}…` : s; };

module.exports = { num, compact, pct, exp, dur, dateTime, discordTime, level, stageText, safe, clip, toNum, pad2 };
