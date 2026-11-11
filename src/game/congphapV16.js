'use strict';
/**
 * CÔNG PHÁP V16 — mua / sở hữu / trang bị / nâng cấp / mảnh bí tịch / nguồn rơi / Kỳ Ngộ cho 40 công pháp mới (data/congphap_v16.js).
 * Công pháp cũ (tier 1–7, 101, 102, 201) KHÔNG đổi: vẫn đi qua game/congphap.js. Các hàm `…Any` ở đây nhận cả hai loại.
 * Mọi hàm ghi dữ liệu chạy ĐỒNG BỘ (không await) nên đọc–kiểm tra–ghi là một khối không bị xen ngang trong cùng tiến trình.
 */
const K = require('./constants');
const R = require('./realm');
const Cu = require('./cultivator');
const CP = require('./congphap');
const CPX = require('./cpfx');
const D = require('../db');
const D16 = require('../data/congphap_v16');
const { E } = require('./emoji');
const { random, randInt, choice, int, fmtNum } = require('../util');

const { Delta } = Cu;
const book = (t) => D16.BY_TIER.get(Number(t)) || null;
const isNew = (t) => D16.BY_TIER.has(Number(t));
const MAX_EQUIP = K.CONGPHAP_MAX_EQUIP_SLOTS;
const curLabel = (c) => CP.currencyLabel(c);

// ---------------------------------------------------------------- tên / thông tin dùng chung (cũ + mới)
function nameOf(tier) { const b = book(tier); return b ? b.name : CP.currentName(Number(tier)); }
const fullName = (tier) => (isNew(tier) ? `[${tier}] ${nameOf(tier)}` : `[Tầng ${tier}] ${nameOf(tier)}`);
function nameMap() {
  const m = {}; for (const c of CP.getCurrentCongphapList()) m[c.tier] = c.name;
  for (const b of D16.BOOKS) m[b.tier] = b.name;
  return m;
}

// ---------------------------------------------------------------- điều kiện
/** Đủ cảnh giới + giới vực? (đã vượt giới vực thì không cần đủ số cảnh giới ở giới vực đó). null = đủ. */
function unmetReason(row, b) {
  const w = row.world_tier || 0;
  if (w > b.require_world) return null;
  if (w < b.require_world) return `cần phi thăng đến **${R.worldTierName(b.require_world)}**${b.require_realm > 0 ? ` và đạt **${K.REALMS[b.require_realm].name}**` : ''}`;
  if ((row.realm_index || 0) < b.require_realm) return `cần đạt **${K.REALMS[b.require_realm].name}** trở lên (ở ${R.worldTierName(b.require_world)})`;
  return null;
}
const reqText = (b) => `${K.REALMS[b.require_realm].name} · ${R.worldTierName(b.require_world)}`;

// ---------------------------------------------------------------- mua
function buy(userId, tier, expect = null) {
  const row = Cu.getCultivator(userId); const b = book(tier);
  if (!row) return '❌ Bạn chưa bắt đầu tu tiên, dùng `/batdau` trước.';
  if (!b) return '❌ Công pháp này không tồn tại.';
  if (!b.shop) return `🔒 **${b.name}** là công pháp **độc quyền**, KHÔNG bán ở Cửa Hàng. Nguồn: ${D16.sourcesOf(b)}.`;
  const owned = Cu.ownedCongphapTiers(row);
  if (owned.has(b.tier)) return `❌ Bạn đã sở hữu **${b.name}** rồi (không thể mua trùng).`;
  const why = unmetReason(row, b); if (why) return `🔒 Chưa đủ điều kiện mua **${b.name}**: ${why}.`;
  const stale = CP.priceChangedMsg(expect, b.cost, b.currency); if (stale) return stale;
  if (row[b.currency] < b.cost) return `❌ Không đủ ${curLabel(b.currency)} để mua **${b.name}** (cần ${fmtNum(b.cost)}, hiện có ${fmtNum(row[b.currency])}).`;
  owned.add(b.tier);
  const ok = Cu.updateCultivator(userId, { [b.currency]: new Delta(-b.cost), cong_phap_owned: [...owned].sort((x, y) => x - y).join(',') }, { [b.currency]: b.cost });
  if (!ok) return Cu.MSG_BALANCE_CHANGED;
  return `📜 Đã mua **${b.name}** (${b.phamName}) với giá ${fmtNum(b.cost)} ${curLabel(b.currency)}! Vào **Công Pháp** để trang bị.\n${effectLines(b, 0).join(' · ')}` + CP.balanceLine(userId, b.currency);
}

// ---------------------------------------------------------------- mô tả hiệu quả
const pct = (v) => `${Math.round(v * 1000) / 10}%`;
function effectLines(b, level) {
  const fx = CPX.fxAt(b, level); const out = [];
  for (const k of [...D16.STAT_KEYS, 'tu', 'luc', 'boss', ...D16.ROUTE_KEYS]) if (fx[k]) out.push(`+${pct(fx[k])} ${D16.FX_LABEL[k]}`);
  return out;
}
function skillLines(b) {
  return b.skills.map((s) => ({ name: s.name, flavor: s.flavor, effect: CPX.skillEffectText(s.name) }));
}
function pvpText(b, level) { return `buff tự thân +${pct(CPX.pvpBuffAt(b, level))}, debuff đối thủ −${pct(CPX.pvpDebuffAt(b, level))}`; }

// ---------------------------------------------------------------- nâng cấp
function bracketOf(nextLevel) { const arr = D16.UP_BRACKETS; for (let i = 0; i < arr.length; i += 1) if (nextLevel <= arr[i][0]) return i; return arr.length - 1; }
/** Chi phí nâng từ cấp `level` lên `level + 1`. null nếu đã tối đa. */
function upgradeCost(b, level) {
  const n = level + 1; if (n > D16.MAX_LEVEL) return null;
  const i = bracketOf(n); const prevMax = i === 0 ? 0 : D16.UP_BRACKETS[i - 1][0];
  const lt = b.up_currency === 'linh_tinh';
  const mult = (lt ? D16.UP_BRACKETS_LT : D16.UP_BRACKETS)[i][1];
  const pos = n - prevMax - 1;
  return Math.max(1, Math.ceil(b.up_base * mult * (1 + 0.02 * pos)));
}
function upgradeTotal(b, from = 0) { let t = 0; for (let l = from; l < D16.MAX_LEVEL; l += 1) t += upgradeCost(b, l); return t; }

function upgrade(userId, tier, expect = null) {
  const row = Cu.getCultivator(userId); const b = book(tier);
  if (!row) return '❌ Bạn chưa bắt đầu tu tiên, dùng `/batdau` trước.';
  if (!b) return '❌ Công pháp này không tồn tại.';
  if (!Cu.ownedCongphapTiers(row).has(b.tier)) return `🔒 Bạn chưa sở hữu **${b.name}**.`;
  const levels = Cu.congphapLevelsMap(row); const cur = Math.min(D16.MAX_LEVEL, levels[b.tier] || 0);
  if (cur >= D16.MAX_LEVEL) return `❌ **${b.name}** đã đạt cấp nâng tối đa (**Cấp ${D16.MAX_LEVEL}**).`;
  const cost = upgradeCost(b, cur); const c = b.up_currency;
  const stale = CP.priceChangedMsg(expect, cost, c); if (stale) return stale;
  if (row[c] < cost) return `❌ Không đủ ${curLabel(c)} để nâng cấp (cần ${fmtNum(cost)}, hiện có ${fmtNum(row[c])}).`;
  if (!Cu.updateCultivator(userId, { [c]: new Delta(-cost) }, { [c]: cost })) return Cu.MSG_BALANCE_CHANGED;
  levels[b.tier] = cur + 1; Cu.saveCongphapLevels(userId, levels);
  const equipped = Cu.equippedCongphapTiers(row).includes(b.tier);
  if (equipped) CP.recomputeEquippedCongphap(userId);
  return `🔺 Đã nâng **${b.name}** lên **Cấp ${cur + 1}/${D16.MAX_LEVEL}** (tốn ${fmtNum(cost)} ${curLabel(c)}).\n📈 ${effectLines(b, cur + 1).join(' · ')} · ${pvpText(b, cur + 1)}.${equipped ? ' Đã tự áp dụng.' : ' Hãy trang bị để áp dụng.'}` + CP.balanceLine(userId, c);
}
/** Nâng cấp bất kỳ công pháp (cũ hoặc mới). */
function upgradeAny(userId, tier, expect = null) {
  if (isNew(tier)) return upgrade(userId, tier, expect);
  const row = Cu.getCultivator(userId); const tdef = CP.tierDef(Number(tier));
  if (!row || !tdef) return '❌ Công pháp này không tồn tại.';
  const lvl = Cu.congphapLevelsMap(row)[tier] || 0;
  const exp = expect || [CP.tierUpgradeCost(tdef, lvl, row), CP.tierUpgradeCurrency(tdef, row)];
  return CP.upgradeCongPhap(userId, Number(tier), exp);
}
/** [chi phí, tiền tệ] để nâng từ cấp `lvl` lên `lvl+1` (cũ hoặc mới); null nếu đã tối đa. */
function costAt(row, tier, lvl) {
  if (lvl >= D16.MAX_LEVEL) return null;
  if (isNew(tier)) { const b = book(tier); return b ? [upgradeCost(b, lvl), b.up_currency] : null; }
  const tdef = CP.tierDef(Number(tier)); if (!tdef) return null;
  return [CP.tierUpgradeCost(tdef, lvl, row), CP.tierUpgradeCurrency(tdef, row)];
}
const levelOf = (row, tier) => Math.min(D16.MAX_LEVEL, Cu.congphapLevelsMap(row)[tier] || 0);
/** [chi phí, tiền tệ] nâng tiếp của 1 công pháp (cũ/mới); null nếu đã tối đa. */
function nextUpgrade(row, tier) { return costAt(row, Number(tier), levelOf(row, tier)); }
/** Mô phỏng (không ghi DB): với số dư hiện có, nâng liên tiếp tối đa `steps` cấp được bao nhiêu. → { levels, from, to, spent:{tiền tệ: số}, stop:'cap'|'money'|'steps', need } */
function planUpgrade(row, tier, steps = Infinity) {
  tier = Number(tier); const from = levelOf(row, tier); const bal = { linh_thach: row.linh_thach, linh_tinh: row.linh_tinh };
  const spent = {}; let lvl = from; let stop = 'steps'; let need = null;
  while (lvl - from < steps) {
    const c = costAt(row, tier, lvl);
    if (!c) { stop = 'cap'; break; }
    if ((bal[c[1]] || 0) < c[0]) { stop = 'money'; need = c; break; }
    bal[c[1]] -= c[0]; spent[c[1]] = (spent[c[1]] || 0) + c[0]; lvl += 1;
  }
  return { levels: lvl - from, from, to: lvl, spent, stop, need };
}
const spentText = (spent) => Object.entries(spent).filter(([, v]) => v > 0).map(([c, v]) => `${fmtNum(v)} ${curLabel(c)}`).join(' + ') || '0';
/**
 * v16.3 — Nâng NHANH nhiều cấp trong 1 lần bấm (công pháp cũ hoặc mới): nâng liên tục tới khi hết tiền thì TỰ DỪNG ở cấp đó
 * (hoặc đủ `steps` cấp, hoặc đạt Cấp 100). Mỗi cấp vẫn là 1 lần trừ tiền có bảo vệ số dư (an toàn khi bấm đồng thời).
 */
function upgradeMany(userId, tier, steps = Infinity, expect = null) {
  tier = Number(tier);
  let row = Cu.getCultivator(userId);
  if (!row) return '❌ Bạn chưa bắt đầu tu tiên, dùng `/batdau` trước.';
  const nm = isNew(tier) ? nameOf(tier) : `[Tầng ${tier}] ${CP.currentName(tier)}`;
  if (!isNew(tier) && !CP.tierDef(tier)) return '❌ Công pháp này không tồn tại.';
  if (!Cu.ownedCongphapTiers(row).has(tier)) return `🔒 Bạn chưa sở hữu **${nm}**.`;
  const from = levelOf(row, tier); const spent = {}; let done = 0; let stop = 'steps'; let need = null; let failMsg = null; let ex = expect;
  while (done < steps) {
    row = Cu.getCultivator(userId);
    const c = nextUpgrade(row, tier);
    if (!c) { stop = 'cap'; break; }
    if (row[c[1]] < c[0]) { stop = 'money'; need = [c, row[c[1]]]; break; }
    const before = levelOf(row, tier);
    const msg = upgradeAny(userId, tier, ex || c); ex = null;
    if (levelOf(Cu.getCultivator(userId), tier) <= before) { stop = 'fail'; failMsg = msg; break; }
    spent[c[1]] = (spent[c[1]] || 0) + c[0]; done += 1;
  }
  const now = from + done;
  if (!done) return failMsg || (stop === 'cap' ? `❌ **${nm}** đã đạt cấp nâng tối đa (**Cấp ${D16.MAX_LEVEL}**).`
    : `❌ Không đủ ${curLabel(need[0][1])} để nâng cấp (cần ${fmtNum(need[0][0])}, hiện có ${fmtNum(need[1])}).`);
  const why = stop === 'cap' ? `🏁 Đã đạt **cấp tối đa ${D16.MAX_LEVEL}**.`
    : stop === 'money' ? `⏹️ Dừng ở **Cấp ${now}** vì hết ${curLabel(need[0][1])} (cấp tiếp cần ${fmtNum(need[0][0])}, còn ${fmtNum(need[1])}).`
      : stop === 'fail' ? `⏹️ Dừng ở **Cấp ${now}**: ${String(failMsg || '').split('\n')[0]}`
        : `✅ Đã nâng đủ **${done}** cấp theo yêu cầu.`;
  const fin = Cu.getCultivator(userId);
  const detail = isNew(tier) ? `📈 ${effectLines(book(tier), now).join(' · ')} · ${pvpText(book(tier), now)}.` : '📈 Chỉ số đã tự cập nhật nếu công pháp đang trang bị.';
  return `⏫ Nâng nhanh **${nm}**: **Cấp ${from} → Cấp ${now}/${D16.MAX_LEVEL}** (+${done} cấp, tốn ${spentText(spent)}).\n${why}\n${detail}\n⚔️ Lực chiến hiện tại: **${fmtNum(Cu.calcLucChien(fin))}**`;
}

// ---------------------------------------------------------------- trang bị
function saveSlots(userId, tiers) {
  Cu.updateCultivator(userId, { cong_phap_slots: tiers.join(',') });
  CP.recomputeEquippedCongphap(userId);
}
/** Đặt danh sách trang bị (chỉ giữ quyển đã sở hữu, đủ điều kiện, không trùng, tối đa 3). Trả { ok, msg, tiers }. */
function setEquipped(userId, wanted) {
  const row = Cu.getCultivator(userId); if (!row) return { ok: false, msg: '❌ Bạn chưa bắt đầu tu tiên.' };
  const own = Cu.ownedCongphapTiers(row);
  const uniq = [...new Set(wanted.map(Number))];
  for (const t of uniq) {
    if (!own.has(t)) return { ok: false, msg: `🔒 Bạn chưa sở hữu **${nameOf(t)}**.` };
    const b = book(t); const why = b ? unmetReason(row, b) : null;
    if (why) return { ok: false, msg: `🔒 Chưa đủ điều kiện trang bị **${b.name}**: ${why}.` };
  }
  if (uniq.length > MAX_EQUIP) return { ok: false, msg: `❌ Chỉ được trang bị tối đa **${MAX_EQUIP}** công pháp cùng lúc — hãy tháo bớt trước.` };
  saveSlots(userId, uniq);
  return { ok: true, tiers: uniq, msg: uniq.length ? `📜 Đang trang bị **${uniq.length}/${MAX_EQUIP}**: ${uniq.map(nameOf).join(' · ')}.` : '📜 Đã THÁO toàn bộ công pháp.' };
}
function toggleEquip(userId, tier) {
  const row = Cu.getCultivator(userId); if (!row) return { ok: false, msg: '❌ Bạn chưa bắt đầu tu tiên.' };
  const cur = Cu.equippedCongphapTiers(row); tier = Number(tier);
  if (cur.includes(tier)) { const r = setEquipped(userId, cur.filter((t) => t !== tier)); return { ...r, msg: `📤 Đã tháo **${nameOf(tier)}**. Chỉ số đã trả về như chưa trang bị.` }; }
  if (cur.length >= MAX_EQUIP) return { ok: false, msg: `❌ Đã đủ **${MAX_EQUIP}/${MAX_EQUIP}** công pháp — hãy tháo 1 quyển trước khi trang bị **${nameOf(tier)}**.` };
  const r = setEquipped(userId, [...cur, tier]);
  return r.ok ? { ...r, msg: `📥 Đã trang bị **${nameOf(tier)}**. ${r.msg}` } : r;
}
/** Đưa quyển lên ô 1 — chiêu thức đấu pháp lấy từ quyển ở ô 1. */
function makePrimary(userId, tier) {
  const row = Cu.getCultivator(userId); tier = Number(tier);
  const cur = Cu.equippedCongphapTiers(row);
  if (!cur.includes(tier)) return { ok: false, msg: '❌ Quyển này chưa được trang bị.' };
  saveSlots(userId, [tier, ...cur.filter((t) => t !== tier)]);
  return { ok: true, msg: `🥇 **${nameOf(tier)}** giờ ở **ô 1** — 4 chiêu thức Đấu Pháp sẽ lấy từ quyển này.` };
}

// ---------------------------------------------------------------- cấp quyền sở hữu (rơi / sự kiện / mảnh)
/** Thêm quyển vào `up` (đối tượng cập nhật cultivator đang gom). Trả true nếu thật sự thêm (chưa sở hữu). */
function grantInto(up, row, tier) {
  const owned = Cu.parseIntSet(up.cong_phap_owned !== undefined ? up.cong_phap_owned : row.cong_phap_owned);
  if (owned.has(tier)) return false;
  owned.add(tier); up.cong_phap_owned = [...owned].sort((a, b) => a - b).join(',');
  return true;
}
function grantDirect(userId, tier) {
  const row = Cu.getCultivator(userId); if (!row) return false;
  const up = {}; if (!grantInto(up, row, Number(tier))) return false;
  Cu.updateCultivator(userId, up); return true;
}
/** Admin / mã code / sự kiện đặc biệt. */
function grantEvent(userId, tier) {
  const b = book(tier); if (!b) return '❌ Mã công pháp không tồn tại.';
  if (!grantDirect(userId, tier)) return `ℹ️ Người chơi đã sở hữu **${b.name}** — không cấp trùng.`;
  return `✅ Đã cấp **${b.name}** (${D16.GROUPS[b.group].short}).`;
}

// ---------------------------------------------------------------- mảnh bí tịch
const fragRow = (userId, id) => D.get('SELECT qty FROM congphap_fragments WHERE user_id = ? AND frag_id = ?', String(userId), id);
const fragCount = (userId, id) => { const r = fragRow(userId, id); return r ? r.qty : 0; };
const allFragCounts = (userId) => Object.fromEntries(D.all('SELECT frag_id, qty FROM congphap_fragments WHERE user_id = ?', String(userId)).map((r) => [r.frag_id, r.qty]));
function addFrag(userId, id, n) {
  if (!D16.FRAG_BY_ID.has(id) || n <= 0) return 0;
  D.run('INSERT INTO congphap_fragments (user_id, frag_id, qty) VALUES (?, ?, ?) ON CONFLICT(user_id, frag_id) DO UPDATE SET qty = qty + excluded.qty', String(userId), id, n);
  return fragCount(userId, id);
}
function mergeFrag(userId, id) {
  const f = D16.FRAG_BY_ID.get(id); if (!f) return '❌ Loại mảnh không tồn tại.';
  const b = book(f.book);
  return D.transaction(() => {
    const row = Cu.getCultivator(userId); if (!row) return '❌ Bạn chưa bắt đầu tu tiên.';
    if (Cu.ownedCongphapTiers(row).has(f.book)) return `❌ Bạn đã sở hữu **${b.name}** rồi — không cần hợp thành.`;
    const have = fragCount(userId, id);
    if (have < f.need) return `❌ Chưa đủ mảnh: ${have}/${f.need} **${f.name}**.`;
    D.run('UPDATE congphap_fragments SET qty = qty - ? WHERE user_id = ? AND frag_id = ? AND qty >= ?', f.need, String(userId), id, f.need);
    const up = {}; grantInto(up, row, f.book); Cu.updateCultivator(userId, up);
    return `🧩✨ Hợp thành **${b.name}** từ ${f.need} mảnh! Vào **Công Pháp** để trang bị${unmetReason(row, b) ? ` (cần ${unmetReason(row, b)} mới trang bị được)` : ''}.`;
  });
}
function fragLine(f, have) { return `${f.icon} ${f.name}: **${have}/${f.need}**`; }

// ---------------------------------------------------------------- nguồn rơi
const chainReached = (chainKey, need) => D16.CHAIN_ORDER.indexOf(chainKey) >= D16.CHAIN_ORDER.indexOf(need);
function pickPool(row, up, groupKey) {
  const owned = Cu.parseIntSet(up.cong_phap_owned !== undefined ? up.cong_phap_owned : row.cong_phap_owned);
  const elig = D16.BOOKS.filter((b) => b.group === groupKey && b.shop && !owned.has(b.tier) && !unmetReason(row, b));
  return elig.length ? choice(elig) : null;
}
const dropLine = (b, where) => `\n📜✨ ${where}, bạn cảm ngộ được **${b.name}** (${b.phamName}) — đã thêm vào kho công pháp! Vào **Công Pháp** để trang bị.`;
function fragDrops(userId, row, up, list, ctxKey) {
  let msg = '';
  for (const [id, chance, rng, need] of list || []) {
    if (need && ctxKey !== undefined && typeof need === 'string' && !chainReached(ctxKey, need)) continue;
    if (need && typeof need === 'number' && ctxKey < need) continue;
    const f = D16.FRAG_BY_ID.get(id);
    const owned = Cu.parseIntSet(up.cong_phap_owned !== undefined ? up.cong_phap_owned : row.cong_phap_owned);
    if (owned.has(f.book)) continue;             // đã có quyển → không rơi mảnh thừa
    if (random() < chance) { const g = randInt(rng[0], rng[1]); const tot = addFrag(userId, id, g); msg += `\n${f.icon} Nhặt được **${g}** ${f.name} (${tot}/${f.need}).`; }
  }
  return msg;
}
/** Bí Cảnh thường (Sơ/Trung/Cao/Vạn Linh Cốc): tierIdx 0..3 → công pháp Nhân Giới. Trả chuỗi thông báo. */
function rollBicanhThuong(userId, row, up, tierIdx) {
  const S = D16.SOURCES.bicanh_thuong;
  if (random() >= S.chance[Math.min(tierIdx, S.chance.length - 1)]) return '';
  const b = pickPool(row, up, S.pool); if (!b) return '';
  grantInto(up, row, b.tier); return dropLine(b, 'Trong Bí Cảnh');
}
function rollBicanhDacBiet(userId, row, up) {
  const S = D16.SOURCES.bicanh_dacbiet; let msg = '';
  for (const [tier, chance] of S.book) {
    const b = book(tier);
    if (random() < chance && grantInto(up, row, tier)) msg += dropLine(b, 'Trong Bí Cảnh Đặc Biệt');
  }
  return msg + fragDrops(userId, row, up, S.frag);
}
/** Bí Cảnh Linh Giới: chainKey luyenhu|hopthe|daithua|dokiep; chuỗi Độ Kiếp (dokiep) = "Bí Cảnh Thượng Cổ". */
function rollBicanhLinhgioi(userId, row, up, chainKey) {
  let msg = '';
  const S = D16.SOURCES.bicanh_linhgioi;
  if (random() < S.pool[1]) { const b = pickPool(row, up, S.pool[0]); if (b && grantInto(up, row, b.tier)) msg += dropLine(b, 'Trong Bí Cảnh Linh Giới'); }
  for (const [tier, chance, need] of S.book) {
    if (need && !chainReached(chainKey, need)) continue;
    if (random() < chance && grantInto(up, row, tier)) msg += dropLine(book(tier), 'Trong Bí Cảnh Linh Giới');
  }
  msg += fragDrops(userId, row, up, S.frag.map(([a, c, r, n]) => [a, c, r, n]), chainKey);
  if (chainKey === 'dokiep') {
    const T = D16.SOURCES.bicanh_thuongco;
    if (random() < T.pool[1]) { const b = pickPool(row, up, T.pool[0]); if (b && grantInto(up, row, b.tier)) msg += dropLine(b, 'Trong Bí Cảnh Thượng Cổ'); }
    for (const [tier, chance] of T.book) if (random() < chance && grantInto(up, row, tier)) msg += dropLine(book(tier), 'Trong Bí Cảnh Thượng Cổ');
    msg += fragDrops(userId, row, up, T.frag);
  }
  return msg;
}
/** Boss Thế Giới — người kết liễu. bossTier 1..9. Trả danh sách { text }. */
function rollBossKiller(userId, row, up, bossTier) {
  const out = []; const S = D16.SOURCES.boss_killer;
  for (const [tier, chance, minTier] of S.book) {
    if (minTier && bossTier < minTier) continue;
    if (random() < chance && grantInto(up, row, tier)) out.push(`cảm ngộ **${nameOf(tier)}** — công pháp độc quyền của Boss Thế Giới!`);
  }
  return out;
}
/** Boss Thế Giới — người đóng góp ≥ 2%: rơi mảnh. */
function rollBossContrib(userId, row, bossTier) {
  const up = {}; const msg = fragDrops(userId, row, up, D16.SOURCES.boss_contrib.frag, bossTier);
  return msg.replace(/^\n/, '').split('\n').filter(Boolean);
}

// ---------------------------------------------------------------- Kỳ Ngộ (module MỚI, độc lập — source cũ KHÔNG có Kỳ Ngộ; kích hoạt khi Cảm Ngộ)
const kyngoLevels = (row) => {
  const w = row.world_tier || 0; const r = row.realm_index || 0; const lv = [];
  if (w >= 2 && r >= 5) lv.push('cuc_hiem');
  if (w >= 1 && r >= 8) lv.push('cao');
  if (w >= 1 && r >= 3) lv.push('hiem');
  if (w >= 1 || r >= 2) lv.push('thuong');
  return lv;
};
/** Gọi sau mỗi lần Cảm Ngộ. Trả chuỗi thông báo ('' nếu không có kỳ ngộ). */
function rollKyNgo(userId, row) {
  const S = D16.SOURCES.kyngo; const up = {}; let msg = '';
  for (const lv of kyngoLevels(row)) {
    if (random() >= S[lv].chance) continue;
    if (lv === 'thuong') {
      const cand = D16.FRAGMENTS.filter((f) => !Cu.ownedCongphapTiers(row).has(f.book));
      if (!cand.length) continue;
      const f = choice(cand); const tot = addFrag(userId, f.id, 1);
      msg = `\n🌠 **Kỳ Ngộ!** Trong lúc cảm ngộ, bạn nhặt được 1 ${f.icon} **${f.name}** (${tot}/${f.need}).`; break;
    }
    const tier = D16.KYNGO_BOOK[lv]; const b = book(tier);
    if (grantInto(up, row, tier)) {
      Cu.updateCultivator(userId, up);
      const label = { hiem: 'Kỳ Ngộ Hiếm', cao: 'Kỳ Ngộ Cấp Cao', cuc_hiem: 'Kỳ Ngộ Cực Hiếm' }[lv];
      return `\n🌌✨ **${label}!** Thiên cơ chợt mở, bạn lĩnh ngộ được **${b.name}** (${b.phamName}) — đã thêm vào kho công pháp!`;
    }
  }
  return msg;
}

// ---------------------------------------------------------------- danh sách cho Cửa Hàng / Kho
/** Mục cửa hàng theo nhóm + lọc loại. group 'doc' = công pháp đặc biệt (chỉ xem nguồn, không mua). */
function listShop(group, cat = 'all') {
  return D16.BOOKS.filter((b) => b.group === group && (cat === 'all' || b.cat === cat));
}
/** Tất cả công pháp ĐANG SỞ HỮU (cũ + mới) → [{tier, isNew, book?, level, equipped}] sắp theo (giới vực, tier). */
function listOwned(row) {
  const levels = Cu.congphapLevelsMap(row); const eq = Cu.equippedCongphapTiers(row);
  return [...Cu.ownedCongphapTiers(row)].filter((t) => isNew(t) || CP.tierDef(t)).map((t) => {
    const b = book(t); const tdef = CP.tierDef(t);
    return { tier: t, isNew: !!b, book: b, tdef, level: Math.min(D16.MAX_LEVEL, levels[t] || 0), equipped: eq.includes(t), world: b ? b.require_world : (tdef ? tdef.require_world : 0), cat: b ? b.cat : 'cu', name: nameOf(t) };
  }).sort((a, b) => (a.isNew - b.isNew) || a.tier - b.tier);
}

module.exports = {
  D16, book, isNew, nameOf, fullName, nameMap, unmetReason, reqText, buy, upgrade, upgradeAny, upgradeCost, upgradeTotal, nextUpgrade, costAt, planUpgrade, upgradeMany,
  effectLines, skillLines, pvpText, pct, setEquipped, toggleEquip, makePrimary, grantInto, grantDirect, grantEvent,
  fragCount, allFragCounts, addFrag, mergeFrag, fragLine, rollBicanhThuong, rollBicanhDacBiet, rollBicanhLinhgioi, rollBossKiller, rollBossContrib,
  rollKyNgo, kyngoLevels, listShop, listOwned, MAX_EQUIP,
};
