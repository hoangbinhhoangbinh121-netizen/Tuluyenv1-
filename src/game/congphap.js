'use strict';
/** Công Pháp: dữ liệu xoay vòng (Gemini), khoá tên chiêu, giá, mua/nâng cấp/quay — port 1:1 */
const K = require('./constants');
const CD = require('./cooldowns');
const R = require('./realm');
const Cu = require('./cultivator');
const D = require('../db');
const F = require('./format');
const CPX = require('./cpfx');
const { E } = require('./emoji');
const { geminiGenerate } = require('./ai');
const { now, int, choice, fmtNum } = require('../util');

const D16 = require('../data/congphap_v16');
const { Delta } = Cu;
const TIERS = K.CONG_PHAP_TIER_DEF;
const tierDef = (t) => TIERS.find((x) => x.tier === t);

// ---------- chiêu thức đã khoá ----------
const ATTACK_NORMAL = K.ATTACK_NORMAL;
const fallbackSkillName = (existing) => {
  for (let i = 0; i < 50; i++) {
    const n = `${choice(K._SKILL_NAME_PREFIX)} ${choice(K._SKILL_NAME_SUFFIX)}`;
    if (!existing.has(n)) return n;
  }
  return `Vô Danh Chiêu ${existing.size + 1}`;
};
function getLockedSkills(tier) {
  if (tier <= 0) return null;
  const r = D.get('SELECT skill_1, skill_2, skill_3, skill_4 FROM congphap_locked_skills WHERE tier = ?', tier);
  return r ? [r.skill_1, r.skill_2, r.skill_3, r.skill_4] : null;
}
/** Async vì có thể gọi Gemini (không chặn event loop). */
async function lockSkillsForTier(tier) {
  const already = getLockedSkills(tier);
  if (already) return already;
  const prompt = `Đặt tên 4 chiêu thức võ công tiên hiệp cho công pháp tầng ${tier}/7 (mỗi chiêu 2-5 chữ Hán Việt, không giải thích, không đánh số, mỗi chiêu 1 dòng, không trùng nhau).`;
  const seen = new Set(); const fb = [];
  for (let i = 0; i < 4; i++) { const n = fallbackSkillName(seen); seen.add(n); fb.push(n); }
  const generated = await geminiGenerate(prompt, fb.join('\n'));
  const names = [];
  for (let line of generated.split('\n')) {
    line = line.trim().replace(/^[-•0-9.) ]+/, '').trim();
    if (line && !names.includes(line)) names.push(line.slice(0, 40));
    if (names.length === 4) break;
  }
  while (names.length < 4) names.push(fallbackSkillName(new Set(names)));
  D.run('INSERT OR IGNORE INTO congphap_locked_skills (tier, skill_1, skill_2, skill_3, skill_4, locked_at) VALUES (?, ?, ?, ?, ?, ?)',
    tier, names[0], names[1], names[2], names[3], now());
  return getLockedSkills(tier) || names;
}
function pvpActionListFor(row) {
  const tier = Cu.equippedCongphapTier(row);
  if (tier <= 0) return [ATTACK_NORMAL];
  const nb = D16.BY_TIER.get(tier);
  if (nb) return [ATTACK_NORMAL, ...nb.skills.map((s) => s.name)];      // v16: 4 chiêu CỐ ĐỊNH của công pháp mới (có hiệu ứng thật — xem game/cpfx.js)
  let skills = getLockedSkills(tier);
  if (!skills) skills = K._SKILL_NAME_PREFIX.slice(0, 4).map((p, i) => `${p} ${K._SKILL_NAME_SUFFIX[i]}`);
  return [ATTACK_NORMAL, ...skills];
}

// ---------- công pháp xoay vòng ----------
const ROTATING = {};
const fallbackCongphapName = () => `${choice(K._CONGPHAP_NAME_PREFIX)} ${choice(K._CONGPHAP_NAME_SUFFIX)}`;
async function refreshRotatingCongphap() {
  for (const tdef of TIERS) {
    const tier = tdef.tier;
    const fbName = fallbackCongphapName();
    const fbDesc = `Tăng ${int(tdef.bonus * 100)}% tu vi nhận được khi tu luyện / bế quan.`;
    const label = tdef.boss_drop_only ? 'Boss Thế Giới (tối thượng)' : (tdef.currency === 'linh_tinh' ? 'Chợ Vạn Linh' : `tầng ${tier}/7`);
    const prompt = `Đặt 1 cái tên công pháp tu tiên thượng cổ hiếm có cho ${label} (2-5 chữ Hán Việt, không giải thích gì thêm) và viết 1 câu mô tả hiệu quả tu luyện dưới 15 từ, văn phong tiên hiệp. Trả lời đúng định dạng:\nTên: ...\nMô tả: ...`;
    const text = await geminiGenerate(prompt, `Tên: ${fbName}\nMô tả: ${fbDesc}`);
    let name = fbName; let desc = fbDesc;
    for (const raw of text.split('\n')) {
      const line = raw.trim(); const low = line.toLowerCase();
      if (low.startsWith('tên:')) name = line.split(/:(.*)/s)[1].trim() || name;
      else if (low.startsWith('mô tả:')) desc = line.split(/:(.*)/s)[1].trim() || desc;
    }
    ROTATING[tier] = { name: name.slice(0, 60), desc: desc.slice(0, 150), generated_at: now() };
  }
}
function fallbackPopulate() {
  for (const tdef of TIERS) {
    if (ROTATING[tdef.tier]) continue;
    ROTATING[tdef.tier] = { name: fallbackCongphapName().slice(0, 60), desc: `Tăng ${int(tdef.bonus * 100)}% tu vi nhận được khi tu luyện / bế quan.`, generated_at: now() };
  }
}
function getCurrentCongphapList() {
  if (!Object.keys(ROTATING).length) fallbackPopulate();
  return TIERS.filter((t) => ROTATING[t.tier]).map((t) => ({
    tier: t.tier, name: ROTATING[t.tier].name, desc: ROTATING[t.tier].desc, bonus: t.bonus,
    require_realm: t.require_realm, require_world: t.require_world,
  }));
}
const currentName = (tier) => { const nb = D16.BY_TIER.get(Number(tier)); if (nb) return nb.name; const c = getCurrentCongphapList().find((t) => t.tier === tier); return c ? c.name : `Công Pháp Tầng ${tier}`; };

// ---------- giá ----------
const currencyLabel = (c) => (c === 'linh_tinh' ? `${E.linhtinh} Linh Tinh` : `${E.linhthach} Linh Thạch`);
function tierCurrency(tdef, row = null) {
  if ('currency' in tdef) return tdef.currency;
  if (row && row.world_tier >= 1) return 'linh_tinh';
  return 'linh_thach';
}
function tierCost(tdef, row = null) {
  if ('currency' in tdef) return tdef.cost;
  if (row && row.world_tier >= 1) return Math.max(1, Math.ceil(tdef.cost / K.LINHTINH_EXCHANGE_RATE));
  return tdef.cost;
}
function tierUpgradeCost(tdef, curLevel = 0, row = null) {
  if (!('currency' in tdef) && row && row.world_tier >= 1) return K.CONGPHAP_LINHGIOI_UPGRADE_BASE_COST * (K.CONGPHAP_LINHGIOI_UPGRADE_COST_MULT ** curLevel);
  const base = 'upgrade_cost' in tdef ? tdef.upgrade_cost : K.CONGPHAP_UPGRADE_COST;
  return base * (10 ** Math.floor(curLevel / K.CONGPHAP_UPGRADE_COST_BRACKET));
}
const tierUpgradeCurrency = (tdef, row = null) => ('upgrade_currency' in tdef ? tdef.upgrade_currency : tierCurrency(tdef, row));
function priceChangedMsg(expect, cost, currency) {
  if (!expect) return '';
  const [seenCost, seenCur] = expect;
  if (int(seenCost) === int(cost) && seenCur === currency) return '';
  return `⚠️ Giá đã thay đổi so với lúc bạn mở màn hình: trước thấy **${fmtNum(seenCost)}** ${currencyLabel(seenCur)}, hiện là **${fmtNum(cost)}** ${currencyLabel(currency)}. **Chưa trừ gì** — hãy mở lại Cửa Hàng để xem giá mới.`;
}
function totalBonus(tdef, level, row = null) {
  let step = K.CONGPHAP_UPGRADE_BONUS_STEP;
  if (!('currency' in tdef) && row && row.world_tier >= 1) step = K.CONGPHAP_LINHGIOI_UPGRADE_BONUS_STEP;
  return tdef.bonus + level * step;
}
const totalPvpBuff = (tdef, level) => tdef.pvp_buff + level * K.CONGPHAP_UPGRADE_PVP_STEP;
const totalPvpDebuff = (tdef, level) => tdef.pvp_debuff + level * K.CONGPHAP_UPGRADE_PVP_STEP;

function balanceLine(userId, ...cols) { return F.balanceLine(Cu.getCultivator(userId), ...cols); }

function recomputeEquippedCongphap(userId) {
  const row = Cu.getCultivator(userId);
  const tiers = Cu.equippedCongphapTiers(row);
  const levels = Cu.congphapLevelsMap(row);
  let tb = 0; let buff = 0; let debuff = 0; const names = [];
  for (const tier of tiers) {
    const nb = D16.BY_TIER.get(tier);
    if (nb) {          // v16: công pháp mới KHÔNG cộng vào cong_phap_bonus (hiệu ứng tính riêng ở cpfx.js) — chỉ buff/debuff đấu pháp dùng chung cột cũ
      const lvl = Math.min(D16.MAX_LEVEL, levels[tier] || 0);
      buff += CPX.pvpBuffAt(nb, lvl); debuff += CPX.pvpDebuffAt(nb, lvl);
      names.push(`[${tier}] ${nb.name}${lvl ? ` (Cấp ${lvl})` : ''}`);
      continue;
    }
    const tdef = tierDef(tier); if (!tdef) continue;
    const lvl = levels[tier] || 0;
    tb += totalBonus(tdef, lvl, row); buff += totalPvpBuff(tdef, lvl); debuff += totalPvpDebuff(tdef, lvl);
    names.push(`[Tầng ${tier}] ${currentName(tier)}${lvl ? ` (Cấp ${lvl})` : ''}`);
  }
  Cu.updateCultivator(userId, { cong_phap: names.join(', '), cong_phap_slots: tiers.join(','), cong_phap_bonus: tb, cong_phap_pvp_buff: buff, cong_phap_pvp_debuff: debuff });
}

function upgradeCongPhap(userId, tier, expect = null) {
  const row = Cu.getCultivator(userId);
  const tdef = tierDef(tier);
  if (!tdef) return '❌ Công pháp Tầng này không tồn tại.';
  if (!Cu.ownedCongphapTiers(row).has(tier)) return `🔒 Bạn chưa MUA công pháp Tầng ${tier} — hãy mua ở **Cửa Hàng** trước khi nâng cấp.`;
  const levels = Cu.congphapLevelsMap(row);
  const cur = levels[tier] || 0;
  if (cur >= K.CONGPHAP_MAX_UPGRADE_LEVEL) return `❌ Công pháp Tầng ${tier} đã đạt cấp nâng tối đa (**Cấp ${K.CONGPHAP_MAX_UPGRADE_LEVEL}**).`;
  const cost = tierUpgradeCost(tdef, cur, row); const cur_ = tierUpgradeCurrency(tdef, row);
  const stale = priceChangedMsg(expect, cost, cur_); if (stale) return stale;
  if (row[cur_] < cost) return `❌ Không đủ ${currencyLabel(cur_)} để nâng cấp (cần ${fmtNum(cost)}, hiện có ${fmtNum(row[cur_])}).`;
  const newLevel = cur + 1; levels[tier] = newLevel;
  if (!Cu.updateCultivator(userId, { [cur_]: new Delta(-cost) }, { [cur_]: cost })) return Cu.MSG_BALANCE_CHANGED;
  Cu.saveCongphapLevels(userId, levels);
  let note;
  if (Cu.equippedCongphapTiers(row).includes(tier)) { recomputeEquippedCongphap(userId); note = ' Trang bị đang dùng đã tự cập nhật chỉ số ngay.'; }
  else note = ' Hãy vào menu **Công Pháp** trang bị tầng này để áp dụng chỉ số mới.';
  return `🔺 Đã nâng cấp **[Tầng ${tier}] ${currentName(tier)}** lên **Cấp ${newLevel}/${K.CONGPHAP_MAX_UPGRADE_LEVEL}** (tốn ${fmtNum(cost)} ${currencyLabel(cur_)})!\n` +
    `📈 Tổng cộng giờ: +${int(totalBonus(tdef, newLevel, row) * 100)}% chỉ số/HP, buff tự thân +${int(totalPvpBuff(tdef, newLevel) * 100)}%, debuff đối thủ -${int(totalPvpDebuff(tdef, newLevel) * 100)}%.${note}` + balanceLine(userId, cur_);
}

function buyCongPhap(userId, tier, expect = null) {
  const row = Cu.getCultivator(userId);
  const tdef = tierDef(tier);
  if (!tdef) return '❌ Công pháp Tầng này không tồn tại.';
  if (tdef.boss_drop_only) return '🔒 Công pháp này KHÔNG bán ở Cửa Hàng — chỉ rơi ra khi ra đòn kết liễu hạ gục Boss Thế Giới.';
  const owned = Cu.ownedCongphapTiers(row);
  if (owned.has(tier)) return `❌ Bạn đã sở hữu công pháp Tầng ${tier} rồi.`;
  if (row.realm_index < tdef.require_realm) return `🔒 Cần đạt ${K.REALMS[tdef.require_realm].name} trở lên mới được MUA công pháp Tầng ${tier}.`;
  if (row.world_tier < tdef.require_world) return `🔒 Công pháp Tầng ${tier} chỉ bán cho người đã phi thăng đến ${R.worldTierName(tdef.require_world)} trở lên.`;
  const currency = tierCurrency(tdef, row); const cost = tierCost(tdef, row);
  const stale = priceChangedMsg(expect, cost, currency); if (stale) return stale;
  if (row[currency] < cost) return `❌ Không đủ ${currencyLabel(currency)} để mua công pháp Tầng ${tier} (cần ${fmtNum(cost)}, hiện có ${fmtNum(row[currency])}).`;
  owned.add(tier);
  const newOwned = [...owned].sort((a, b) => a - b).join(',');
  if (!Cu.updateCultivator(userId, { [currency]: new Delta(-cost), cong_phap_owned: newOwned }, { [currency]: cost })) return Cu.MSG_BALANCE_CHANGED;
  const upCost = tierUpgradeCost(tdef, 0, row); const upCur = tierUpgradeCurrency(tdef, row);
  return `📜 Đã mua **[Tầng ${tier}] ${currentName(tier)}** với giá ${fmtNum(cost)} ${currencyLabel(currency)}! Vào menu **Công Pháp** để trang bị (+${int(tdef.bonus * 100)}% lực chiến/chỉ số/HP, chiêu Tự Buff +${int(tdef.pvp_buff * 100)}%, chiêu Debuff -${int(tdef.pvp_debuff * 100)}% đối thủ khi đấu pháp). Sau đó có thể bấm **🔺 Nâng Cấp** để tăng thêm chỉ số (tốn ${fmtNum(upCost)} ${currencyLabel(upCur)}/lần).` + balanceLine(userId, currency);
}

function doRandomCongphap(userId) {
  const row = Cu.getCultivator(userId);
  const isTg = row.world_tier >= 1;
  const currency = isTg ? 'linh_tinh' : 'linh_thach';
  const cost = isTg ? K.CONGPHAP_GACHA_COST_LINHTINH : K.CONGPHAP_GACHA_COST_LINHTHACH;
  if (row[currency] < cost) return `❌ Cần ${fmtNum(cost)} ${currencyLabel(currency)} để Quay Ngẫu Nhiên Công Pháp (hiện có ${fmtNum(row[currency])}).`;
  const owned = Cu.ownedCongphapTiers(row);
  const eligible = TIERS.filter((t) => !t.boss_drop_only && !('currency' in t) && !owned.has(t.tier) && row.realm_index >= t.require_realm && row.world_tier >= t.require_world);
  if (!eligible.length) return '❌ Bạn đã sở hữu hết Công Pháp phù hợp với cảnh giới hiện tại rồi — hãy tu luyện lên cao hơn hoặc Phi Thăng.';
  const won = choice(eligible);
  owned.add(won.tier);
  if (!Cu.updateCultivator(userId, { [currency]: new Delta(-cost), cong_phap_owned: [...owned].sort((a, b) => a - b).join(',') }, { [currency]: cost })) return Cu.MSG_BALANCE_CHANGED;
  return `🎲✨ Quay Ngẫu Nhiên trúng **[Tầng ${won.tier}] ${currentName(won.tier)}** (tốn ${fmtNum(cost)} ${currencyLabel(currency)})! Vào menu **Công Pháp** để trang bị (+${int(won.bonus * 100)}% lực chiến/chỉ số/HP).` + balanceLine(userId, currency);
}

module.exports = {
  tierDef, getLockedSkills, lockSkillsForTier, pvpActionListFor, refreshRotatingCongphap, getCurrentCongphapList, currentName,
  currencyLabel, tierCurrency, tierCost, tierUpgradeCost, tierUpgradeCurrency, totalBonus, totalPvpBuff, totalPvpDebuff,
  recomputeEquippedCongphap, balanceLine, upgradeCongPhap, buyCongPhap, doRandomCongphap, priceChangedMsg,
};
