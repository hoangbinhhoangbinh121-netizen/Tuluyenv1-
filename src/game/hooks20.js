'use strict';
/**
 * V20.0 — Điểm móc DUY NHẤT giữa động cơ V17 (craft17/field17/dan17) và các hệ thống V20. Mọi hàm bọc try/catch ở nơi gọi:
 * lỗi ở V20 không bao giờ làm hỏng việc nhận thành phẩm / thu hoạch của V17.
 */
const D = require('../db');
const Inv = require('./invsvc');
const Cat = require('./catalog17');
const V = require('../data/v20_data');
const { C } = Cat;

/** Sau khi nhận 1 lệnh chế (trong transaction của claim). Trả chuỗi thông báo thêm. */
function afterCraft(user, X, r, { ok, bad, bestQ, made }) {
  const S = require('./so20'); let msg = '';
  const stage = r.stage || 1;
  if (ok > 0) { X.bumpExtra(user, r.prof, 'stage', stage, 'max'); S.maxStat(user, 'stage', stage); }
  S.addStat(user, `craft_${r.prof}`, ok + bad);
  if (r.prof === 'dan') {
    if (bad > 0) { const n = Inv.add(user, V.ID.phe, bad, { why: 'phế đan' }); if (n) msg += `\n🗑️ Thu được ${n} × Phế Đan (cặn đan hỏng).`; }
    const mk = require('./marks20').roll(user, made.filter((m) => m.q >= 3));
    const parts = Object.entries(mk).map(([k, n]) => `${require('./marks20').MARKS[k].name} ×${n}`); if (parts.length) msg += `\n✨ Đan có dấu ấn: ${parts.join(', ')}.`;
    msg += require('./dihoa20').addExp(user, (ok + bad) * (2 + stage));
  }
  if (ok > 0) msg += require('./donhang20').bump(user, 'craft', ok, { prof: r.prof, stage });
  msg += S.checkTitles(user);
  return msg;
}
function afterHarvest(user, X, seed) {
  const S = require('./so20'); const s = C.SEEDS[seed]; let msg = '';
  if (s && s.stage) { X.bumpExtra(user, 'thuc', 'stage', s.stage, 'max'); S.maxStat(user, 'stage', s.stage); }
  S.addStat(user, 'harv', 1); S.addStat(user, 'craft_thuc', 1);
  msg += require('./donhang20').bump(user, 'harvest', 1, {}); msg += S.checkTitles(user);
  return msg;
}
const safe = (fn, ...a) => { try { return fn(...a) || ''; } catch (e) { try { require('../util').logger && require('../util').logger.warn && require('../util').logger.warn(`v20 hook: ${e.message}`); } catch (_) { /* bỏ qua */ } return ''; } };
module.exports = { afterCraft: (...a) => safe(afterCraft, ...a), afterHarvest: (...a) => safe(afterHarvest, ...a) };
