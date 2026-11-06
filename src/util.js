'use strict';
/** Tiện ích thay cho các hàm dựng sẵn của Python (đúng ngữ nghĩa, không đoán). */
const now = () => Date.now() / 1000;                        // time.time()
const int = (x) => Math.trunc(x);                            // int(x): cắt về 0
const floorDiv = (a, b) => Math.floor(a / b);                // a // b
const mod = (a, b) => ((a % b) + b) % b;                     // a % b kiểu Python
/** round() của Python: làm tròn về số chẵn gần nhất khi .5 (banker's rounding). */
function pyRound(x, nd = 0) {
  const m = 10 ** nd;
  const v = x * m;
  const f = Math.floor(v);
  const diff = v - f;
  let r;
  if (Math.abs(diff - 0.5) < 1e-9) r = f % 2 === 0 ? f : f + 1;
  else r = Math.round(v);
  return r / m;
}
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1)); // random.randint (gồm cả 2 đầu)
const randUniform = (a, b) => a + Math.random() * (b - a);
const random = () => Math.random();
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
function sample(arr, k) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}
function shuffle(arr) { const a = arr.slice(); return sample(a, a.length); }
/** random.choices(table, weights=[...], k=1)[0] */
function weightedChoice(items, weights) {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}
/** f"{n:,}" của Python */
const fmtNum = (n) => require('./ui/format').num(n);   // 1.250.000 (chuẩn v7)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
module.exports = { now, int, floorDiv, mod, pyRound, randInt, randUniform, random, choice, sample, shuffle, weightedChoice, fmtNum, sleep, clamp };
