'use strict';
/** Sự kiện MỘT NGÀY ĐẠI PHÚ — thị trường ảo theo server (không đụng Linh Thạch thật, trừ thưởng Top 10) */
const crypto = require('node:crypto');
const K = require('./constants');
const CD = require('./cooldowns');
const Cu = require('./cultivator');
const D = require('../db');
const { E } = require('./emoji');
const { now, int, random, randUniform, choice, pyRound, fmtNum } = require('../util');

const DURATION = CD.EVENT_DAIPHU_DURATION_SECONDS; const START_CASH = K.EVENT_DAIPHU_STARTING_CASH;
const MARKET_CYCLE = K.EVENT_DAIPHU_MARKET_CYCLE_SECONDS; const STATE_CHECK = K.EVENT_DAIPHU_STATE_CHECK_SECONDS; const HISTORY_KEEP = K.EVENT_DAIPHU_MARKET_HISTORY_KEEP;
const BANK_TERM = CD.EVENT_DAIPHU_BANK_TERM_SECONDS; const RUONG_CD = CD.EVENT_DAIPHU_RUONG_COOLDOWN_SECONDS;
const ASSET_DEFS = [
  ['linhngoc', 'Linh Ngọc', () => '💎', 0.02, 0.05, 100000], ['linhduoc', 'Linh Dược', () => E.linhduocdacbiet, 0.03, 0.08, 80000],
  ['phapbao_event', 'Pháp Bảo', () => E.phapbao, 0.05, 0.12, 200000], ['congphap_event', 'Công Pháp', () => E.congphap, 0.07, 0.18, 150000],
  ['tientinh', 'Tiên Tinh', () => E.tientinh, 0.10, 0.25, 300000], ['yeuhach_event', 'Yêu Hạch', () => E.yeuhach, 0.05, 0.15, 120000],
];
const ASSETS = Object.fromEntries(ASSET_DEFS.map(([k, name, emo, vmin, vmax, base]) => [k, { key: k, name, get emoji() { return emo(); }, vol_min: vmin, vol_max: vmax, base_price: base }]));
const MISSIONS = K.EVENT_DAIPHU_MISSIONS;
const J = (s, d) => { try { return s ? JSON.parse(s) : d; } catch (_) { return d; } };
const warn = (t) => `${E.sk_canhbao} ${t}`;
const money = (n) => require('../ui/format').num(Math.round(n));

const updating = new Set();
const isUpdating = (gid) => updating.has(String(gid));
const initPrices = () => Object.fromEntries(Object.entries(ASSETS).map(([k, a]) => [k, Number(a.base_price)]));

function formatCountdown(sec) {
  sec = Math.max(0, int(sec));
  if (sec <= 0) return '00:00:00';
  if (sec >= 3600) return `${Math.floor(sec / 3600)} giờ ${Math.floor((sec % 3600) / 60)} phút`;
  if (sec >= 60) return `${Math.floor(sec / 60)} phút ${sec % 60} giây`;
  return `${sec} giây`;
}
const nextMarketSeconds = (ev) => { const last = ev.last_market_update || now(); return Math.max(0, Math.min(MARKET_CYCLE - (now() - last), MARKET_CYCLE)); };
function formatMarketCountdown(sec) {
  sec = Math.max(0, int(sec)); const v = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  return sec < 60 ? [`${E.sk_thoigian} Cập nhật sau`, v] : [`${E.sk_thitruong} Thị trường tiếp theo thay đổi sau`, v];
}
const getEvent = (gid) => D.get('SELECT * FROM event_daiphu WHERE guild_id = ?', gid);

function adminOpen(gid, delayMinutes = 0) {
  const t = now(); const start = t + Math.max(0, delayMinutes) * 60; const end = start + DURATION;
  const status = delayMinutes <= 0 ? 'RUNNING' : 'NOT_STARTED';
  D.transaction(() => {
    D.run(`INSERT INTO event_daiphu (guild_id, event_id, status, start_time, end_time, market_prices, market_history, current_cycle, last_market_update, final_prices, final_rankings, reward_status, market_changes)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, NULL, 'pending', ?)
           ON CONFLICT(guild_id) DO UPDATE SET event_id=excluded.event_id, status=excluded.status, start_time=excluded.start_time, end_time=excluded.end_time,
             market_prices=excluded.market_prices, market_history=excluded.market_history, current_cycle=0, last_market_update=excluded.last_market_update,
             final_prices=NULL, final_rankings=NULL, reward_status='pending', market_changes=excluded.market_changes`,
    gid, crypto.randomUUID(), status, start, end, JSON.stringify(initPrices()), JSON.stringify([]), t, JSON.stringify({}));
    D.run('DELETE FROM event_daiphu_players WHERE guild_id = ?', gid);
  });
  return [status, start, end];
}

function settleBank(gid, uid, player) {
  const t = now(); const deposits = J(player.bank_deposits, []); const pending = []; let cash = player.cash; let changed = false;
  for (const dep of deposits) { if (t >= dep.maturity_time) { cash += dep.amount * (1 + K.EVENT_DAIPHU_BANK_INTEREST_PCT); changed = true; } else pending.push(dep); }
  if (changed) D.run('UPDATE event_daiphu_players SET cash=?, bank_deposits=? WHERE guild_id=? AND user_id=?', cash, JSON.stringify(pending), gid, uid);
  return [cash, pending];
}
function getOrJoinPlayer(gid, uid) {
  let row = D.get('SELECT * FROM event_daiphu_players WHERE guild_id = ? AND user_id = ?', gid, uid);
  if (!row) {
    const t = now();
    D.run(`INSERT INTO event_daiphu_players (guild_id, user_id, cash, assets, joined_at, last_transaction_at, highest_assets, bank_deposits, oracle_uses, mission_data, insurance_data, risk_trade_data, last_ruong_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, '[]', 0, '{}', '{}', '{}', 0)`, gid, uid, START_CASH, '{}', t, t, START_CASH);
    row = D.get('SELECT * FROM event_daiphu_players WHERE guild_id = ? AND user_id = ?', gid, uid);
  }
  const [cash] = settleBank(gid, uid, row);
  if (cash !== row.cash) row = D.get('SELECT * FROM event_daiphu_players WHERE guild_id = ? AND user_id = ?', gid, uid);
  return row;
}
function totalAssets(cash, assets, prices, deposits = null) {
  let total = cash;
  for (const [k, q] of Object.entries(assets)) total += q * (prices[k] || 0);
  if (deposits) total += deposits.reduce((s, d) => s + d.amount, 0);
  return total;
}
const logTx = (gid, uid, type, asset, qty, price, amount) =>
  D.run('INSERT INTO event_daiphu_tx_log (guild_id, user_id, tx_id, type, asset, quantity, price, amount, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', gid, uid, crypto.randomUUID(), type, asset, qty, price, amount, now());

function settleInsurance(gid, oldPrices, newPrices) {
  for (const r of D.all("SELECT * FROM event_daiphu_players WHERE guild_id = ? AND insurance_data != '{}'", gid)) {
    const ins = J(r.insurance_data, {}); if (!Object.keys(ins).length) continue;
    let payout = 0;
    for (const [k, c] of Object.entries(ins)) {
      const np = newPrices[k] !== undefined ? newPrices[k] : c.price_at_purchase;
      if (np < c.price_at_purchase) payout += (c.price_at_purchase - np) * c.qty_at_purchase * K.EVENT_DAIPHU_INSURANCE_COVERAGE_PCT;
      delete ins[k];
    }
    D.run('UPDATE event_daiphu_players SET cash=?, insurance_data=? WHERE guild_id=? AND user_id=?', r.cash + payout, JSON.stringify(ins), gid, r.user_id);
    if (payout > 0) logTx(gid, r.user_id, 'INSURANCE_PAYOUT', 'cash', 1, payout, payout);
  }
}
function updateMarket(gid, ev) {
  const prices = J(ev.market_prices, {}); let history = J(ev.market_history, []); const changes = {}; const old = { ...prices };
  for (const [key, a] of Object.entries(ASSETS)) {
    let pct = randUniform(a.vol_min, a.vol_max); if (random() < 0.5) pct = -pct;
    const oldP = prices[key] !== undefined ? prices[key] : a.base_price;
    const newP = pyRound(Math.max(1000.0, oldP * (1 + pct)), -2);
    prices[key] = newP; changes[key] = oldP ? pyRound((newP - oldP) / oldP * 100, 1) : 0.0;
  }
  history.push({ cycle: ev.current_cycle + 1, time: now(), prices: { ...prices } }); history = history.slice(-HISTORY_KEEP);
  D.run('UPDATE event_daiphu SET market_prices=?, market_history=?, current_cycle=current_cycle+1, last_market_update=?, market_changes=? WHERE guild_id=?', JSON.stringify(prices), JSON.stringify(history), now(), JSON.stringify(changes), gid);
  settleInsurance(gid, old, prices);
}
function leaderboard(gid, prices, limit = 10) {
  const scored = D.all('SELECT * FROM event_daiphu_players WHERE guild_id = ?', gid)
    .map((r) => [r.user_id, totalAssets(r.cash, J(r.assets, {}), prices, J(r.bank_deposits, [])), r.cash]).sort((a, b) => b[1] - a[1]);
  return [scored.slice(0, limit), scored];
}

function checkMissions(gid, uid, player, ctx) {
  const md = J(player.mission_data, {}); const before = JSON.stringify(md); const done = [];
  md._total_buy_qty = (md._total_buy_qty || 0) + (ctx.buy_qty || 0);
  md._total_sell_count = (md._total_sell_count || 0) + (ctx.sell_happened ? 1 : 0);
  const grant = (k) => { if (!md[k]) { md[k] = true; done.push(MISSIONS[k]); } };
  if (md._total_buy_qty >= 5) grant('mua_5don');
  if (md._total_sell_count >= 1) grant('ban_1lan');
  if ((ctx.total_assets_now || 0) >= 15000000) grant('tongtaisan_15tr');
  const reward = done.reduce((s, m) => s + m.reward, 0);
  if (reward > 0 || JSON.stringify(md) !== before) {
    D.run('UPDATE event_daiphu_players SET cash = cash + ?, mission_data = ? WHERE guild_id=? AND user_id=?', reward, JSON.stringify(md), gid, uid);
    if (reward > 0) logTx(gid, uid, 'MISSION', 'cash', done.length, reward, reward);
  }
  return done;
}
const running = (gid) => { const ev = getEvent(gid); return ev && ev.status === 'RUNNING' ? ev : null; };

function trade(gid, uid, assetKey, qty, isBuy) {
  if (!Number.isInteger(qty) || qty <= 0) return warn('Giao dịch không hợp lệ — số lượng phải là số nguyên dương.');
  if (isUpdating(gid)) return `${E.sk_camkhoa} Thị trường đang cập nhật giá, vui lòng thử lại sau giây lát.`;
  const ev = running(gid); if (!ev) return warn('Giao dịch không hợp lệ — sự kiện hiện không mở giao dịch.');
  const t = now(); if (t >= ev.end_time) return `${E.sk_camkhoa} THỊ TRƯỜNG ĐÓNG CỬA — sự kiện đã kết thúc, không thể giao dịch.`;
  if (!ASSETS[assetKey]) return warn('Giao dịch không hợp lệ — tài sản không tồn tại.');
  const prices = J(ev.market_prices, {}); const price = prices[assetKey];
  if (!price || price <= 0) return warn('Giao dịch không hợp lệ — giá hiện tại không hợp lệ.');
  const player = getOrJoinPlayer(gid, uid); const assets = J(player.assets, {}); const amount = pyRound(price * qty); const a = ASSETS[assetKey];
  let newCash;
  if (isBuy) {
    if (player.cash < amount) return warn(`Không đủ tiền mặt — cần ${fmtNum(amount)}, hiện có ${money(player.cash)}.`);
    newCash = player.cash - amount; assets[assetKey] = (assets[assetKey] || 0) + qty;
  } else {
    const held = assets[assetKey] || 0;
    if (held < qty) return warn(`Không đủ ${a.name} để bán — đang giữ ${held}.`);
    newCash = player.cash + amount; assets[assetKey] = held - qty; if (assets[assetKey] <= 0) delete assets[assetKey];
  }
  const totalNow = totalAssets(newCash, assets, prices, J(player.bank_deposits, []));
  const highest = Math.max(player.highest_assets || 0, totalNow);
  const newDone = D.transaction(() => {
    D.run('UPDATE event_daiphu_players SET cash=?, assets=?, last_transaction_at=?, highest_assets=? WHERE guild_id=? AND user_id=?', newCash, JSON.stringify(assets), t, highest, gid, uid);
    logTx(gid, uid, isBuy ? 'BUY' : 'SELL', assetKey, qty, price, amount);
    return checkMissions(gid, uid, getOrJoinPlayer(gid, uid), { buy_qty: isBuy ? qty : 0, sell_happened: !isBuy, total_assets_now: totalNow });
  });
  const finalCash = getOrJoinPlayer(gid, uid).cash;
  const mt = newDone.length ? `\n\n🎯 **Hoàn thành nhiệm vụ!**\n${newDone.map((m) => `• ${m.desc} → +${fmtNum(m.reward)}`).join('\n')}` : '';
  return `✅ ${isBuy ? 'Mua' : 'Bán'} thành công!\n\n${a.emoji} ${a.name} ×${qty}\n${E.sk_tien} ${isBuy ? '-' : '+'}${money(amount)}${mt}\n\n${E.sk_tien} Số dư: ${money(finalCash)}`;
}

function bankDeposit(gid, uid, amount) {
  if (!running(gid)) return warn('Sự kiện hiện không mở giao dịch.');
  if (amount < K.EVENT_DAIPHU_BANK_MIN_DEPOSIT) return warn(`Số tiền gửi tối thiểu là ${fmtNum(K.EVENT_DAIPHU_BANK_MIN_DEPOSIT)}.`);
  const p = getOrJoinPlayer(gid, uid); const deps = J(p.bank_deposits, []);
  if (deps.length >= K.EVENT_DAIPHU_BANK_MAX_ACTIVE) return warn(`Bạn đang có tối đa ${K.EVENT_DAIPHU_BANK_MAX_ACTIVE} khoản gửi chờ đáo hạn.`);
  if (p.cash < amount) return warn(`Không đủ tiền mặt — cần ${fmtNum(amount)}, hiện có ${money(p.cash)}.`);
  const t = now(); deps.push({ amount, deposit_time: t, maturity_time: t + BANK_TERM }); const newCash = p.cash - amount;
  D.transaction(() => { D.run('UPDATE event_daiphu_players SET cash=?, bank_deposits=? WHERE guild_id=? AND user_id=?', newCash, JSON.stringify(deps), gid, uid); logTx(gid, uid, 'DEPOSIT', 'cash', 1, amount, amount); });
  return `${E.sk_nganKho} Đã gửi **${fmtNum(amount)}** vào Ngân Khố (đáo hạn <t:${int(t + BANK_TERM)}:R>, lãi +${int(K.EVENT_DAIPHU_BANK_INTEREST_PCT * 100)}%).\n${E.sk_tien} Số dư còn lại: ${money(newCash)}`;
}
function oracleUse(gid, uid, assetKey) {
  if (!running(gid)) return warn('Sự kiện hiện không hoạt động.');
  if (!ASSETS[assetKey]) return warn('Tài sản không tồn tại.');
  const p = getOrJoinPlayer(gid, uid);
  if (p.oracle_uses >= K.EVENT_DAIPHU_ORACLE_MAX_USES) return warn(`Bạn đã dùng hết ${K.EVENT_DAIPHU_ORACLE_MAX_USES} lượt Thiên Cơ trong event này.`);
  const a = ASSETS[assetKey]; const trueUp = random() < 0.5; const shownUp = random() < K.EVENT_DAIPHU_ORACLE_ACCURACY ? trueUp : !trueUp;
  const trend = shownUp ? `${E.sk_tang} có xu hướng TĂNG` : `${E.sk_giam} có xu hướng GIẢM`;
  D.run('UPDATE event_daiphu_players SET oracle_uses = oracle_uses + 1 WHERE guild_id=? AND user_id=?', gid, uid);
  return `${E.sk_thienco} Thiên Cơ hé lộ: **${a.emoji} ${a.name}** ở chu kỳ tới ${trend} (chỉ mang tính tham khảo, không tuyệt đối chính xác).\n${E.sk_ngaunhien} Lượt Thiên Cơ còn lại: ${K.EVENT_DAIPHU_ORACLE_MAX_USES - (p.oracle_uses + 1)}/${K.EVENT_DAIPHU_ORACLE_MAX_USES}.`;
}
function riskTrade(gid, uid, stake) {
  if (!running(gid)) return warn('Sự kiện hiện không hoạt động.');
  if (stake < K.EVENT_DAIPHU_RISK_MIN_STAKE) return warn(`Số tiền mạo hiểm tối thiểu là ${fmtNum(K.EVENT_DAIPHU_RISK_MIN_STAKE)}.`);
  const p = getOrJoinPlayer(gid, uid); const rd = J(p.risk_trade_data, {}); const t = now(); const last = rd.last_at || 0;
  if (t - last < K.EVENT_DAIPHU_RISK_COOLDOWN_SECONDS) return warn(`Thương Vụ đang hồi — thử lại sau ${formatCountdown(K.EVENT_DAIPHU_RISK_COOLDOWN_SECONDS - (t - last))}.`);
  const maxStake = p.cash * K.EVENT_DAIPHU_RISK_MAX_STAKE_PCT;
  if (stake > maxStake) return warn(`Chỉ được mạo hiểm tối đa ${fmtNum(maxStake)} (30% tiền mặt hiện có).`);
  if (p.cash < stake) return warn('Không đủ tiền mặt.');
  const roll = random(); let cum = 0; let mult = 0.0;
  for (const [m, pr] of K.EVENT_DAIPHU_RISK_OUTCOMES) { cum += pr; if (roll <= cum) { mult = m; break; } }
  const profit = pyRound(stake * mult); const newCash = p.cash + profit; rd.last_at = t;
  D.transaction(() => { D.run('UPDATE event_daiphu_players SET cash=?, risk_trade_data=? WHERE guild_id=? AND user_id=?', newCash, JSON.stringify(rd), gid, uid); logTx(gid, uid, 'RISK_TRADE', 'cash', 1, stake, profit); });
  const result = profit > 0 ? `${E.sk_tang} Thắng đậm! +${fmtNum(profit)}` : profit === 0 ? '➖ Hoà vốn, không lời không lỗ.' : `${E.sk_giam} Lỗ vốn! -${fmtNum(-profit)}`;
  return `${E.sk_thuongvu} Kết quả Thương Vụ (mạo hiểm ${fmtNum(stake)}):\n${result}\n\n${E.sk_tien} Số dư: ${money(newCash)}`;
}
function insuranceBuy(gid, uid, assetKey) {
  const ev = running(gid); if (!ev) return warn('Sự kiện hiện không hoạt động.');
  if (!ASSETS[assetKey]) return warn('Tài sản không tồn tại.');
  const p = getOrJoinPlayer(gid, uid); const qty = J(p.assets, {})[assetKey] || 0;
  if (qty <= 0) return warn('Bạn chưa nắm giữ tài sản này nên không thể mua bảo hiểm.');
  const price = J(ev.market_prices, {})[assetKey] || 0; const premium = pyRound(qty * price * K.EVENT_DAIPHU_INSURANCE_PREMIUM_PCT);
  if (p.cash < premium) return warn(`Không đủ tiền mặt để đóng phí bảo hiểm (${fmtNum(premium)}).`);
  const ins = J(p.insurance_data, {}); if (ins[assetKey]) return warn('Tài sản này đang có hợp đồng bảo hiểm hiệu lực rồi.');
  ins[assetKey] = { price_at_purchase: price, qty_at_purchase: qty, premium }; const newCash = p.cash - premium; const a = ASSETS[assetKey];
  D.transaction(() => { D.run('UPDATE event_daiphu_players SET cash=?, insurance_data=? WHERE guild_id=? AND user_id=?', newCash, JSON.stringify(ins), gid, uid); logTx(gid, uid, 'INSURANCE_BUY', assetKey, qty, price, premium); });
  return `${E.sk_baohiem} Đã mua bảo hiểm cho **${a.emoji} ${a.name}** (phí ${fmtNum(premium)}) — đền ${int(K.EVENT_DAIPHU_INSURANCE_COVERAGE_PCT * 100)}% thiệt hại nếu giá giảm ở chu kỳ tới.\n${E.sk_tien} Số dư: ${money(newCash)}`;
}
function openRuong(gid, uid) {
  if (!running(gid)) return warn('Sự kiện hiện không hoạt động.');
  const p = getOrJoinPlayer(gid, uid); const t = now(); const last = p.last_ruong_at || 0;
  if (t - last < RUONG_CD) return warn(`Rương đang hồi — thử lại sau ${formatCountdown(RUONG_CD - (t - last))}.`);
  const reward = choice(K.EVENT_DAIPHU_RUONG_REWARDS); const newCash = p.cash + reward;
  D.transaction(() => { D.run('UPDATE event_daiphu_players SET cash=?, last_ruong_at=? WHERE guild_id=? AND user_id=?', newCash, t, gid, uid); logTx(gid, uid, 'REWARD', 'cash', 1, reward, reward); });
  return `${E.sk_taisan} Mở Rương... nhận được ${E.sk_phanthuong} **${fmtNum(reward)}** tiền mặt!\n${E.sk_tien} Số dư: ${money(newCash)}`;
}
function finalize(gid, ev) {
  const prices = J(ev.market_prices, {}); const [, scored] = leaderboard(gid, prices, 10000);
  const rankings = scored.map(([uid, total]) => ({ user_id: uid, total }));
  D.transaction(() => {
    D.run("UPDATE event_daiphu SET status='ENDED', final_prices=?, final_rankings=?, reward_status='granted' WHERE guild_id=?", JSON.stringify(prices), JSON.stringify(rankings), gid);
    rankings.slice(0, 10).forEach((e, i) => {
      const c = Cu.getCultivator(e.user_id); if (!c) return;
      const reward = K.EVENT_DAIPHU_TOP_REWARDS[i + 1] !== undefined ? K.EVENT_DAIPHU_TOP_REWARDS[i + 1] : K.EVENT_DAIPHU_REWARD_4_10;
      Cu.updateCultivator(e.user_id, { linh_thach: new Cu.Delta(reward) });
      logTx(gid, e.user_id, 'REWARD', 'linh_thach', 1, reward, reward);
    });
  });
}
function stateTick() {
  const t = now();
  for (const ev of D.all('SELECT * FROM event_daiphu')) {
    if (ev.status === 'NOT_STARTED' && t >= ev.start_time) D.run("UPDATE event_daiphu SET status='RUNNING' WHERE guild_id=?", ev.guild_id);
    else if (ev.status === 'RUNNING' && t >= ev.end_time) finalize(ev.guild_id, ev);
  }
}
function marketTick() {
  const t = now();
  for (const ev of D.all("SELECT * FROM event_daiphu WHERE status='RUNNING'")) {
    if (t < ev.end_time) { const g = String(ev.guild_id); updating.add(g); try { updateMarket(ev.guild_id, ev); } finally { updating.delete(g); } }
  }
}

module.exports = {
  ASSETS, MISSIONS, MARKET_CYCLE, STATE_CHECK, J, money, formatCountdown, nextMarketSeconds, formatMarketCountdown, getEvent, adminOpen, getOrJoinPlayer,
  totalAssets, leaderboard, trade, bankDeposit, oracleUse, riskTrade, insuranceBuy, openRuong, finalize, stateTick, marketTick, isUpdating,
};
