'use strict';
/**
 * CHUỖI ĐỒNG TU (v12.5) — "streak" giữa hai người chơi, kiểu Snapchat.
 *  - Mỗi ngày (giờ Việt Nam, UTC+7) cả HAI người đều phải gõ /chuoi dongtu với nhau thì chuỗi mới +1.
 *  - Bỏ lỡ trọn 1 ngày (không đủ cả hai) → chuỗi đứt, hoàn thành lần kế tiếp bắt đầu lại từ 1.
 *  - Mỗi lần hoàn thành: cả hai nhận tu vi (4% tu vi gốc của tầng, tăng theo độ dài chuỗi, tối đa 12%) + thưởng mốc (3/7/14/30/60/100/200/365 ngày).
 *  - Mỗi người chỉ nhận thưởng từ tối đa CHUOI_MAX_REWARD_PAIRS (3) chuỗi mỗi ngày — chuỗi thừa vẫn tăng nhưng không thưởng (chống cày nick phụ).
 *  - Không cộng Linh Thạch. Tu vi tính từ mốc GỐC (R.tuViRequiredBase) giống các nguồn tu vi khác → đồng bộ hệ cân bằng.
 */
const D = require('../db');
const Cu = require('./cultivator');
const R = require('./realm');
const BAL = require('./balance');
const { now, int } = require('../util');

const B = BAL.B;
const TZ_OFFSET = 7 * 3600;
const dayOf = (t = now()) => Math.floor((t + TZ_OFFSET) / 86400);
const keyOf = (a, b) => { a = String(a); b = String(b); return BigInt(a) <= BigInt(b) ? [a, b] : [b, a]; };
const milestones = () => Object.keys(B.CHUOI_MILESTONES).map(Number).sort((x, y) => x - y);

/** Chuỗi còn sống? (đã hoàn thành hôm nay hoặc hôm qua) → độ dài hiệu lực, ngược lại 0. */
const aliveStreak = (p, today) => (p && p.last_done_day >= today - 1 ? p.streak : 0);

function getPair(a, b) {
  const [lo, hi] = keyOf(a, b);
  return D.get('SELECT * FROM chuoi_pairs WHERE user_lo = ? AND user_hi = ?', lo, hi) || null;
}

/** Tu vi thưởng mỗi lần hoàn thành cho một người. */
function dailyReward(row, streak) {
  const need = R.tuViRequiredBase(row.realm_index, row.stage_index, row.world_tier);
  return Math.max(1, int(need * B.CHUOI_DAILY_PCT * (1 + Math.min(streak, 30) / 15)));
}
function milestoneReward(row, streak) {
  const m = B.CHUOI_MILESTONES[streak];
  if (!m) return 0;
  return Math.max(1, int(R.tuViRequiredBase(row.realm_index, row.stage_index, row.world_tier) * m));
}
function nextMilestone(streak) { return milestones().find((m) => m > streak) || null; }

/** Số chuỗi đã hoàn thành HÔM NAY mà người này tham gia (đếm theo last_done_day). */
function doneTodayCount(userId, today) {
  const u = String(userId);
  return D.get('SELECT COUNT(*) AS n FROM chuoi_pairs WHERE (user_lo = ? OR user_hi = ?) AND last_done_day = ?', u, u, today).n;
}

/**
 * Đồng tu hôm nay với đạo hữu. Trả { ok, kind, ... }:
 *  kind: 'cho_doi_phuong' (mình xong, chờ họ) | 'hoan_thanh' (cả hai xong → chuỗi +1) | 'da_xong' (mình đã điểm danh hôm nay) | 'xong_ca_hai' (hôm nay đã hoàn thành rồi)
 */
function dongTu(userId, targetId, t = now()) {
  const me = String(userId); const you = String(targetId);
  if (me === you) return { ok: false, kind: 'tu_minh' };
  const rowMe = Cu.getCultivator(me); const rowYou = Cu.getCultivator(you);
  if (!rowMe) return { ok: false, kind: 'chua_tu_tien' };
  if (!rowYou) return { ok: false, kind: 'doi_phuong_chua_tu_tien', targetId: you };
  const today = dayOf(t); const [lo, hi] = keyOf(me, you); const meIsLo = lo === me;
  let p = D.get('SELECT * FROM chuoi_pairs WHERE user_lo = ? AND user_hi = ?', lo, hi);
  if (!p) {
    D.run('INSERT INTO chuoi_pairs (user_lo, user_hi, streak, best, total_days, last_lo_day, last_hi_day, last_done_day, created_at) VALUES (?,?,0,0,0,0,0,0,?)', lo, hi, t);
    p = D.get('SELECT * FROM chuoi_pairs WHERE user_lo = ? AND user_hi = ?', lo, hi);
  }
  const myDay = meIsLo ? p.last_lo_day : p.last_hi_day; const yourDay = meIsLo ? p.last_hi_day : p.last_lo_day;
  if (p.last_done_day === today) return { ok: true, kind: 'xong_ca_hai', pair: p, streak: p.streak, today, targetId: you };
  if (myDay === today) return { ok: true, kind: 'da_xong', pair: p, streak: aliveStreak(p, today), today, targetId: you, waiting: yourDay !== today };

  D.run(`UPDATE chuoi_pairs SET ${meIsLo ? 'last_lo_day' : 'last_hi_day'} = ? WHERE user_lo = ? AND user_hi = ?`, today, lo, hi);
  if (yourDay !== today) {
    const alive = aliveStreak(p, today);
    return { ok: true, kind: 'cho_doi_phuong', pair: p, streak: alive, today, targetId: you, atRisk: alive > 0 && p.last_done_day === today - 1 };
  }

  // Cả hai đã đồng tu hôm nay → hoàn thành.
  const streak = p.last_done_day === today - 1 ? p.streak + 1 : 1;
  const broke = p.streak > 0 && p.last_done_day < today - 1;
  const best = Math.max(p.best, streak);
  // Đếm số chuỗi đã hoàn thành hôm nay TRƯỚC khi ghi chuỗi này.
  const rewarded = {}; const rewardLines = {};
  for (const [uid, row] of [[me, rowMe], [you, rowYou]]) {
    const cnt = doneTodayCount(uid, today);
    if (cnt >= B.CHUOI_MAX_REWARD_PAIRS) { rewarded[uid] = { tuVi: 0, milestone: 0, capped: true }; continue; }
    rewarded[uid] = { tuVi: dailyReward(row, streak), milestone: milestoneReward(row, streak), capped: false };
  }
  D.transaction(() => {
    D.run('UPDATE chuoi_pairs SET streak = ?, best = ?, total_days = total_days + 1, last_done_day = ? WHERE user_lo = ? AND user_hi = ?', streak, best, today, lo, hi);
    for (const uid of [me, you]) {
      const g = rewarded[uid].tuVi + rewarded[uid].milestone;
      if (g > 0) D.run('UPDATE cultivators SET tu_vi = tu_vi + ? WHERE user_id = ?', g, uid);
    }
  });
  rewardLines.me = rewarded[me]; rewardLines.you = rewarded[you];
  return {
    ok: true, kind: 'hoan_thanh', streak, best, broke, previous: p.streak, today, targetId: you, reward: rewarded[me], rewardYou: rewarded[you],
    milestone: B.CHUOI_MILESTONES[streak] ? streak : 0, next: nextMilestone(streak), row: Cu.getCultivator(me),
  };
}

/** Danh sách chuỗi của một người (mới/đang sống lên đầu). */
function listOf(userId, t = now()) {
  const u = String(userId); const today = dayOf(t);
  const rows = D.all('SELECT * FROM chuoi_pairs WHERE (user_lo = ? OR user_hi = ?) AND (streak > 0 OR last_lo_day = ? OR last_hi_day = ?)', u, u, today, today);
  return rows.map((p) => {
    const meIsLo = p.user_lo === u; const other = meIsLo ? p.user_hi : p.user_lo;
    const myDay = meIsLo ? p.last_lo_day : p.last_hi_day; const yourDay = meIsLo ? p.last_hi_day : p.last_lo_day;
    const alive = aliveStreak(p, today);
    let status;
    if (p.last_done_day === today) status = 'xong';
    else if (myDay === today) status = 'cho_ho';
    else if (yourDay === today) status = 'cho_ban';
    else if (alive > 0) status = 'sap_dut';
    else status = 'dut';
    return { other, streak: alive, best: p.best, total: p.total_days, status, lastDone: p.last_done_day };
  }).sort((a, b) => b.streak - a.streak || b.best - a.best);
}

/** Bảng xếp hạng chuỗi đang sống dài nhất toàn bot. */
function leaderboard(limit = 10, t = now()) {
  const today = dayOf(t);
  return D.all('SELECT * FROM chuoi_pairs WHERE streak > 0 AND last_done_day >= ? ORDER BY streak DESC, best DESC, total_days DESC LIMIT ?', today - 1, limit)
    .map((p) => ({ a: p.user_lo, b: p.user_hi, streak: p.streak, best: p.best, total: p.total_days }));
}

/** Chuỗi sống dài nhất của một người (dùng cho màn hình Trạng Thái). */
function topOf(userId, t = now()) { const l = listOf(userId, t).filter((x) => x.streak > 0); return l[0] || null; }

module.exports = { dayOf, keyOf, aliveStreak, dailyReward, milestoneReward, nextMilestone, getPair, dongTu, listOf, leaderboard, topOf, milestones };
