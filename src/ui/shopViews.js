'use strict';
/** Cửa Hàng, Công Pháp, Pháp Bảo, Tu Hành, Nghề Nghiệp, Dùng Đan Dược, Đan Tẩy Tủy — View port từ Python */
const K = require('../game/constants');
const R = require('../game/realm');
const Cu = require('../game/cultivator');
const CP = require('../game/congphap');
const Ec = require('../game/economy');
const Dan = require('../game/dan');
const A = require('../game/actionsBasic');
const { E } = require('../game/emoji');
const { View, showModal, EPHEMERAL } = require('./kit');
const { int, fmtNum } = require('../util');

const eph = (i, content, extra = {}) => i.reply({ content, flags: EPHEMERAL, ...extra });

// ---------- Công Pháp ----------
function addTechniqueSelects(v, userId, rowStart = 0) {
  const row = Cu.getCultivator(userId);
  const owned = Cu.ownedCongphapTiers(row); const levels = Cu.congphapLevelsMap(row); const equipped = Cu.equippedCongphapTiers(row);
  const options = CP.getCurrentCongphapList().map((t) => {
    const lvl = levels[t.tier] || 0; const tdef = CP.tierDef(t.tier);
    const isEq = equipped.includes(t.tier);
    const label = `[Tầng ${t.tier}] ${t.name}${lvl ? ` (Cấp ${lvl})` : ''}${owned.has(t.tier) ? '' : ' 🔒 (chưa mua)'}${isEq ? ' ✅ đang trang bị' : ''}`;
    const desc = `${t.desc} (+${int(CP.totalBonus(tdef, lvl, row) * 100)}% chỉ số/HP, buff+${int(CP.totalPvpBuff(tdef, lvl) * 100)}%/debuff-${int(CP.totalPvpDebuff(tdef, lvl) * 100)}%)`;
    return { label, description: desc, value: String(t.tier), default: isEq };
  });
  v.select({
    key: 'congphap', row: rowStart, min: 0, max: Math.min(K.CONGPHAP_MAX_EQUIP_SLOTS, options.length) || 1, options,
    placeholder: `📜 Trang bị TỐI ĐA ${K.CONGPHAP_MAX_EQUIP_SLOTS} Công Pháp cùng lúc (đã mua ở Cửa Hàng)...`,
  }, async (i, values) => {
    const r = Cu.getCultivator(userId); const own = Cu.ownedCongphapTiers(r);
    const chosen = values.map(Number);
    const invalid = chosen.filter((t) => !own.has(t));
    if (invalid.length) return eph(i, `🔒 Bạn chưa MUA công pháp ${invalid.map((t) => `Tầng ${t}`).join(', ')} — hãy mua ở **Cửa Hàng** trước khi trang bị.`);
    const picked = chosen.slice(0, K.CONGPHAP_MAX_EQUIP_SLOTS);
    Cu.updateCultivator(userId, { cong_phap_slots: picked.join(',') });
    CP.recomputeEquippedCongphap(userId);
    if (!picked.length) return eph(i, '📜 Đã THÁO toàn bộ công pháp đang trang bị.');
    await i.deferReply({ flags: EPHEMERAL });
    const blocks = [];
    for (const tier of picked) {
      const skills = CP.getLockedSkills(tier) || await CP.lockSkillsForTier(tier);
      blocks.push(`**[Tầng ${tier}] ${CP.currentName(tier)}**:\n${skills.map((s) => `　• ${s}`).join('\n')}`);
    }
    const nr = Cu.getCultivator(userId);
    await i.followUp({
      content: `📜 Đã trang bị ĐỒNG THỜI **${picked.length}/${K.CONGPHAP_MAX_EQUIP_SLOTS}** công pháp — TỔNG cộng dồn: +${int(Cu.effectiveCongPhapBonus(nr) * 100)}% chỉ số/HP/tu vi, buff tự thân +${int(Cu.pvpBuffPct(nr) * 100)}%, debuff đối thủ -${int(Cu.pvpDebuffPct(nr) * 100)}% — áp dụng ngay cho Lực Chiến, Tu Luyện, Bế Quan, PvP, Bí Cảnh, Boss Thế Giới, Thiên Kiếp...\n\n⚔️ Chiêu PvP đã khoá của từng tầng:\n${blocks.join('\n\n')}`, flags: EPHEMERAL,
    });
  });
}
function addUpgradeSelect(v, userId, rowNum = 1) {
  const row = Cu.getCultivator(userId);
  const owned = [...Cu.ownedCongphapTiers(row)].sort((a, b) => a - b); const levels = Cu.congphapLevelsMap(row);
  let options;
  if (!owned.length) options = [{ label: 'Chưa sở hữu công pháp nào', description: 'Hãy mua công pháp ở Cửa Hàng trước khi nâng cấp.', value: 'none' }];
  else options = owned.map((tier) => {
    const tdef = CP.tierDef(tier); const lvl = levels[tier] || 0; const maxed = lvl >= K.CONGPHAP_MAX_UPGRADE_LEVEL;
    let desc; let cost = 0; let cur = '';
    if (maxed) desc = 'Đã đạt cấp nâng tối đa.';
    else {
      cost = CP.tierUpgradeCost(tdef, lvl, row); cur = CP.tierUpgradeCurrency(tdef, row);
      desc = `Nâng lên Cấp ${lvl + 1}: +${int(CP.totalBonus(tdef, lvl + 1, row) * 100)}% chỉ số/HP — tốn ${fmtNum(cost)} ${cur === 'linh_tinh' ? '🌠' : '💎'}`;
    }
    return { label: `[Tầng ${tier}] ${CP.currentName(tier)} — Cấp ${lvl}/${K.CONGPHAP_MAX_UPGRADE_LEVEL}`, description: desc, value: `${tier}:${cost}:${cur}` };
  });
  v.select({ key: 'upgrade', row: rowNum, options, placeholder: '🔺 Nâng cấp công pháp đã mua (giá tuỳ tầng, xem mô tả từng dòng)...' }, (i, values) => {
    if (values[0] === 'none') return eph(i, '🔒 Bạn chưa sở hữu công pháp nào — hãy mua ở **Cửa Hàng** trước.');
    const [t, c, cur] = values[0].split(':');
    return eph(i, CP.upgradeCongPhap(userId, Number(t), [Number(c), cur]));
  });
}
function congPhapView(userId) { const v = new View({ ownerId: userId, timeout: 120 }); addTechniqueSelects(v, userId, 0); addUpgradeSelect(v, userId, 1); return v; }

// ---------- Pháp Bảo ----------
function phapBaoView(userId) {
  const v = new View({ ownerId: userId, timeout: 120 });
  const row = Cu.getCultivator(userId);
  const owned = [...Cu.ownedPhapbaoTiers(row)].sort((a, b) => a - b); const eq = Cu.equippedPhapbaoTier(row);
  const options = [{ label: '— Tháo Pháp Bảo —', description: 'Không trang bị món nào', value: '0', default: eq === 0 }];
  if (!owned.length) options.push({ label: 'Chưa sở hữu Pháp Bảo nào', description: 'Mua ở Cửa Hàng trước.', value: 'none' });
  else for (const tier of owned) { const t = Ec.pbDef(tier); options.push({ label: `${t.name}${tier === eq ? ' ✅ đang trang bị' : ''}`, description: `+${int(t.bonus * 100)}% chỉ số/HP (mọi nơi)`, value: String(tier), default: tier === eq }); }
  v.select({ key: 'equip', options, placeholder: `${E.phapbao} Trang bị Pháp Bảo (đã mua ở Cửa Hàng)...` }, (i, values) => {
    if (values[0] === 'none') return eph(i, '🔒 Bạn chưa sở hữu Pháp Bảo nào — hãy mua ở **Cửa Hàng** trước.');
    return eph(i, Ec.equipPhapBao(userId, Number(values[0])));
  });
  return v;
}

// ---------- Tẩy Tủy (nửa) ----------
function tayTuyNuaBanChoiceView(userId) {
  const v = new View({ ownerId: userId, timeout: 60 });
  const pick = (stat) => async (i) => {
    const result = Dan.doTaytuyNuabanReroll(userId, stat);
    v.disableAll();
    try { await i.update({ content: result, components: v.components() }); } catch (_) { await eph(i, result); }
  };
  v.button({ key: 'lc', label: 'Linh Căn', emoji: E.linhcan, style: 'blurple' }, pick('linh_can'));
  v.button({ key: 'tc', label: 'Thể Chất', emoji: E.thechat, style: 'blurple' }, pick('the_chat'));
  return v;
}
const taytuyNuabanPrompt = (i, userId) => i.reply({ content: `${E.taytuydan} **Đan Tẩy Tủy Nửa Tác Dụng** — chọn chỉ số muốn reroll (chỉ số còn lại giữ nguyên):`, components: tayTuyNuaBanChoiceView(userId).components(), flags: EPHEMERAL });

// ---------- Dùng Đan Dược ----------
function danDuocView(userId) {
  const v = new View({ ownerId: userId, timeout: 120 });
  const uses = Dan.getDanDuocUses(Cu.getCultivator(userId));
  const options = uses.length ? uses.map((u) => ({ label: u.label, description: u.desc, value: u.key })) : [{ label: 'Chưa có Đan Dược nào để dùng', value: 'none' }];
  v.select({ key: 'dan', options, placeholder: uses.length ? 'Dùng Đan Dược — chọn viên muốn cắn...' : 'Kho Đan Dược trống — Luyện Đan hoặc mua ở Cửa Hàng trước' }, (i, values) => {
    if (values[0] === 'none') return eph(i, '❌ Bạn chưa có Đan Dược nào để dùng.');
    if (values[0] === 'taytuynuaban') return taytuyNuabanPrompt(i, userId);
    return eph(i, Dan.useDanDuoc(userId, values[0]));
  });
  return v;
}

// ---------- Cửa Hàng ----------
function shopView(userId) {
  const v = new View({ ownerId: userId, timeout: 120 });
  const row = Cu.getCultivator(userId);
  v.select({
    key: 'item', row: 0, placeholder: 'Chọn vật phẩm muốn mua (Khí Vận 🍀)...',
    options: K.SHOP_ITEMS.map((i) => ({ label: `${i.name} — ${i.cost} 🍀`, description: i.desc, value: i.name })),
  }, (i, values) => eph(i, Ec.applyShopItem(userId, values[0])));

  const ownedCp = Cu.ownedCongphapTiers(row);
  const cpOpts = []; const prices = [];
  for (const tdef of K.CONG_PHAP_TIER_DEF) {
    if (tdef.boss_drop_only) continue;
    const cur = CP.tierCurrency(tdef, row); const cost = CP.tierCost(tdef, row); const short = cur === 'linh_tinh' ? '🌠' : '💎';
    const needWorld = tdef.require_world ? ` / ${R.worldTierName(tdef.require_world)}` : '';
    cpOpts.push({
      label: `[Tầng ${tdef.tier}] ${fmtNum(cost)} ${short}${ownedCp.has(tdef.tier) ? ' ✅' : ''}`,
      description: `+${int(tdef.bonus * 100)}% chỉ số/HP, buff+${int(tdef.pvp_buff * 100)}%/debuff-${int(tdef.pvp_debuff * 100)}% — cần ${K.REALMS[tdef.require_realm].name}${needWorld}`,
      value: `${tdef.tier}:${cost}:${cur}`,
    });
    prices.push([cost, short]);
  }
  const min = prices.reduce((a, b) => (b[0] < a[0] ? b : a), prices[0] || [0, '💎']);
  v.select({ key: 'cp', row: 1, options: cpOpts, placeholder: `Mua Công Pháp theo Tầng (phẩm giai, tối thiểu ${fmtNum(min[0])} ${min[1]})...` }, (i, values) => {
    const [t, c, cur] = values[0].split(':');
    return eph(i, CP.buyCongPhap(userId, Number(t), [Number(c), cur]));
  });

  v.select({
    key: 'danphuong', row: 2, placeholder: `Chọn Đan Phương muốn mua (${K.DAN_PHUONG.length} phẩm cấp, tối thiểu ${fmtNum(Math.min(...K.DAN_PHUONG.map((d) => d.cost)))} 💎)...`,
    options: Dan.getCurrentDanduocList().map((d) => ({ label: `${d.name} — ${fmtNum(d.cost)} 💎`, description: `${d.rolled_name}: ${d.rolled_desc} (thành công ${int(d.success_rate * 100)}%)`, value: d.name })),
  }, (i, values) => eph(i, Dan.buyDanPhuong(userId, values[0])));

  const ownedPb = Cu.ownedPhapbaoTiers(row);
  v.select({
    key: 'pb', row: 3, placeholder: `${E.phapbao} Mua Pháp Bảo (bổ trợ, độc lập Công Pháp)...`,
    options: K.PHAP_BAO_TIER_DEF.map((t) => ({ label: `${t.name} — ${fmtNum(t.cost)} 💎${ownedPb.has(t.tier) ? ' ✅' : ''}`, description: `+${int(t.bonus * 100)}% chỉ số/HP (mọi nơi) — cần ${K.REALMS[t.require_realm].name} trở lên`, value: String(t.tier) })),
  }, (i, values) => eph(i, Ec.buyPhapBao(userId, Number(values[0]))));

  v.button({ key: 'doi', label: 'Đổi Linh Tinh', emoji: E.linhtinh, style: 'blurple', row: 4 }, (i) => showModal(i, {
    title: 'Đổi Linh Tinh',
    fields: [{ id: 'so_luong', label: `Số lượng Linh Tinh muốn đổi (${fmtNum(K.LINHTINH_EXCHANGE_RATE)} 💎/1)`, placeholder: '1', maxLength: 6 }],
    onSubmit: (mi, get) => {
      const raw = get('so_luong').trim();
      if (!/^\d+$/.test(raw)) return eph(mi, '❌ Số lượng không hợp lệ, hãy nhập số nguyên dương.');
      return eph(mi, Ec.doiLinhTinh(userId, Number(raw)));
    },
  }));
  v.button({ key: 'quay', label: 'Quay Ngẫu Nhiên Công Pháp', emoji: E.sk_ngaunhien, style: 'green', row: 4 }, (i) => eph(i, CP.doRandomCongphap(userId)));
  v.button({ key: 'pgd', label: `Mua Đan Dược Phá Giới (${fmtNum(K.DAN_PHA_GIOI_COST_LINH_THACH)} 💎)`, emoji: E.phagioidan, style: 'blurple', row: 4 }, (i) => eph(i, Dan.buyDanPhaGioi(userId)));
  v.button({ key: 'linhthu', label: 'Cửa Hàng Linh Thú', emoji: E.dongthanh, style: 'green', row: 4 }, async (i) => i.reply({ ...require('./petViews').render(userId, 'sh', 0, ''), flags: EPHEMERAL }));
  return v;
}

// ---------- Nhóm menu ----------
function tuHanhGroupView(userId) {
  const v = new View({ ownerId: userId, timeout: 120 });
  addTechniqueSelects(v, userId, 0); addUpgradeSelect(v, userId, 1);
  v.button({ key: 'linhmach', label: 'Linh Mạch', emoji: E.linhmach, style: 'grey', row: 2 }, (i) => eph(i, A.doLinhmach(userId)));
  v.button({ key: 'phapbao', label: 'Pháp Bảo', emoji: E.phapbao, style: 'blurple', row: 2 }, (i) =>
    i.reply({ content: `${E.phapbao} Chọn Pháp Bảo muốn trang bị (mua ở **Cửa Hàng** nếu chưa có):`, components: phapBaoView(userId).components(), flags: EPHEMERAL }));
  return v;
}
function ngheNghiepGroupView(userId) {
  const v = new View({ ownerId: userId, timeout: 120 });
  v.button({ key: 'luyendan', label: 'Luyện Đan', emoji: E.luyendan, style: 'green' }, (i) => eph(i, Dan.doLuyendan(userId)));
  v.button({ key: 'luyenkhi', label: 'Luyện Khí', emoji: E.nghenghiep, style: 'green' }, (i) => eph(i, Dan.doLuyenkhi(userId)));
  v.button({ key: 'pgd', label: `Luyện Phá Giới Đan (${K.DAN_PHA_GIOI_CRAFT_COST} 🌿)`, emoji: E.phagioidan, style: 'grey' }, (i) => eph(i, Dan.craftDanPhaGioi(userId)));
  return v;
}
const open = (i, content, view) => i.reply({ content, components: view.components(), flags: EPHEMERAL });

module.exports = { shopView, congPhapView, phapBaoView, danDuocView, tuHanhGroupView, ngheNghiepGroupView, taytuyNuabanPrompt, open };
