'use strict';
/**
 * RƠI NGUYÊN LIỆU v17 — mỗi nguồn một bảng riêng (data/craft_v17.js · DROPS), phẩm cấp hợp tầng, KHÔNG vô hạn:
 *  • xác suất nhân hệ số may mắn tối đa ×1,30 (Thể Chất/Linh Căn + trang bị + Mê Tung gộp lại, đã chặn)
 *  • vật phẩm hiếm có trần theo ngày/tuần (cap/week) và trần chung theo phẩm cấp 5/6/7 mỗi ngày (CAP_DAY_GLOBAL)
 *  • đi thẳng vào Inventory Service; thông báo gọn 1 dòng để ghép vào tin nhắn của Bí Cảnh/Boss/...
 */
const Inv = require('./invsvc');
const FX = require('./fx17');
const Cat = require('./catalog17');
const { I, C } = Cat;
const { random, randInt } = require('../util');
const Cu = require('./cultivator');

const emo = (id) => { try { return require('../ui/emo17').item(id); } catch (_) { return ''; } };

/** Hệ số nhân xác suất: 1 + min(0,30; extra + trang bị/trận). extra = (lootM − 1) từ Thể Chất/Linh Căn nếu nguồn truyền vào. */
function luckMult(row, extra = 0) {
  const fx = row ? FX.stat(row, 'loot') : 0;
  return 1 + Math.max(0, Math.min(0.30, (Number(extra) || 0) + fx));
}
/**
 * Lăn bảng rơi của `source` cho `user`. opts: { extra (số), mult (nhân hệ số số lượng, mặc định 1), row (hàng đã tải), noText }.
 * Trả { got: {id: n}, text: '\n🎁 ...' }.
 */
function roll(user, source, opts = {}) {
  const d = C.DROPS[source]; if (!d) return { got: {}, text: '' };
  const row = opts.row || Cu.getCultivator(user);
  const pm = luckMult(row, opts.extra || 0);
  const got = {};
  for (const [id, p, lo, hi, lim] of d.rolls) {
    const it = I.BY_ID[id]; if (!it) continue;
    if (random() >= Math.min(1, p * pm)) continue;
    let n = randInt(lo, hi);
    if (lim && lim.cap && Inv.dailyGet(user, `drop:${id}`) >= lim.cap) continue;
    if (lim && lim.week && Inv.weeklyGet(user, `dropw:${id}`) >= lim.week) continue;
    if (lim && lim.cap) n = Math.min(n, lim.cap - Inv.dailyGet(user, `drop:${id}`));
    if (it.rarity >= 5) {
      const g = C.CAP_DAY_GLOBAL[it.rarity]; if (g !== undefined) { const left = g - Inv.dailyGet(user, `dropr:${it.rarity}`); if (left <= 0) continue; n = Math.min(n, left); }
    }
    const real = Inv.add(user, id, n, { why: `rơi ${source}` });
    if (!real) continue;
    got[id] = (got[id] || 0) + real;
    if (lim && lim.cap) Inv.dailyAdd(user, `drop:${id}`, real);
    if (lim && lim.week) Inv.weeklyAdd(user, `dropw:${id}`, real);
    if (it.rarity >= 5) Inv.dailyAdd(user, `dropr:${it.rarity}`, real);
  }
  const parts = Object.entries(got).map(([id, n]) => `${emo(id)} **${n}** ${I.BY_ID[id].name}`);
  return { got, text: parts.length && !opts.noText ? `\n🎁 Thu được: ${parts.join(', ')}.` : '' };
}
const text = (user, source, opts) => roll(user, source, opts).text;

/** Mốc nguồn rơi theo cấp Boss Thế Giới / Linh Thú. */
const bossSource = (bossLevel) => (bossLevel <= 3 ? 'boss_lo' : bossLevel <= 6 ? 'boss_mid' : 'boss_hi');
const petSource = (sourceIdx) => (sourceIdx >= 4 ? 'linhthu_hi' : 'linhthu_lo');
const bicanhSource = (tierIdx) => (['bc0', 'bc1', 'bc2', 'vlc'][Math.min(3, Math.max(0, tierIdx))]);

/** Kỳ vọng giá trị NPC của 1 lượt rơi (không lấy trần) — dùng cho test cân bằng. */
function expectedValue(source) {
  const d = C.DROPS[source]; let v = 0;
  for (const [id, p, lo, hi] of d.rolls) v += p * ((lo + hi) / 2) * I.BY_ID[id].npc_sell_price;
  return v;
}

module.exports = { luckMult, roll, text, bossSource, petSource, bicanhSource, expectedValue };
