'use strict';
/**
 * LINH THÚ v14.0 — logic: sổ thú, nhặt thú/trứng, nuôi dưỡng, khế ước & ô, huyết mạch, truyền thừa, kỹ năng, tiến hóa, chợ, chuyển đổi dữ liệu cũ.
 * Mọi con số nằm ở petBalance.js; dữ liệu loài/kỹ năng ở petData.js; chiến đấu ở petCombat.js.
 * Linh Thú KHÔNG cộng HP/ATK/DEF trực tiếp cho nhân vật.
 *
 * Quy ước: owner luôn là CHUỖI (String(userId)); mọi hàm thao tác kiểm tra QUYỀN SỞ HỮU theo (owner, pet_id) nên không thể giả mạo pet_id của người khác.
 * Hàm hành động trả { ok: boolean, msg: string, ... }.
 */
const D = require('../db');
const K = require('./constants');
const Cu = require('./cultivator');
const PB = require('./petBalance');
const PD = require('./petData');
const { E } = require('./emoji');
const { now, int, random, randInt, choice, fmtNum, clamp, weightedChoice } = require('../util');

const { Delta } = Cu;
const own = (u) => String(u);
const ok = (msg, x = {}) => ({ ok: true, msg, ...x });
const bad = (msg, x = {}) => ({ ok: false, msg: msg.startsWith('❌') || msg.startsWith('⏳') || msg.startsWith('🔒') ? msg : `❌ ${msg}`, ...x });
const parseJson = (s, d) => { try { const v = JSON.parse(s); return v && typeof v === 'object' ? v : d; } catch (_) { return d; } };
const dayKey = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);   // ngày theo giờ VN

// ------------------------------------------------------------------ đọc dữ liệu
const ownerRow = (owner) => Cu.getCultivator(owner);
const ownerRealm = (owner) => { const r = ownerRow(owner); return r ? r.realm_index : 0; };
const getPet = (owner, petId) => D.get('SELECT * FROM pets WHERE owner = ? AND pet_id = ?', own(owner), Number(petId)) || null;
const listPets = (owner) => D.all('SELECT * FROM pets WHERE owner = ? ORDER BY (slot = \'\') ASC, slot ASC, level DESC, pet_id ASC', own(owner));
const getFighter = (owner) => D.get('SELECT * FROM pets WHERE owner = ? AND fighter = 1', own(owner)) || null;
const slotsOf = (owner) => { const o = { bm: null, dh1: null, dh2: null }; for (const p of D.all("SELECT * FROM pets WHERE owner = ? AND slot != ''", own(owner))) o[p.slot] = p; return o; };
const countVien = (owner) => D.get("SELECT COUNT(*) c FROM pets WHERE owner = ? AND slot = ''", own(owner)).c;
const listEggs = (owner) => D.all('SELECT * FROM pet_eggs WHERE owner = ? ORDER BY hatch_at ASC', own(owner));
const getWild = (owner) => { const w = D.get('SELECT * FROM pet_wild WHERE owner = ?', own(owner)); if (w && w.expires_at <= now()) { D.run('DELETE FROM pet_wild WHERE owner = ?', own(owner)); return null; } return w || null; };
function itemMap(owner) { const o = {}; for (const r of D.all('SELECT item, qty FROM pet_items WHERE owner = ? AND qty > 0', own(owner))) o[r.item] = r.qty; return o; }
const itemQty = (owner, item) => { const r = D.get('SELECT qty FROM pet_items WHERE owner = ? AND item = ?', own(owner), item); return r ? r.qty : 0; };
const addItem = (owner, item, qty) => { if (!PB.ITEMS[item] || !(qty > 0)) return; D.run('INSERT INTO pet_items (owner, item, qty) VALUES (?, ?, ?) ON CONFLICT(owner, item) DO UPDATE SET qty = qty + excluded.qty', own(owner), item, int(qty)); };
/** Trừ vật phẩm nguyên tử (chỉ trừ khi đủ). */
const takeItem = (owner, item, qty) => D.run('UPDATE pet_items SET qty = qty - ? WHERE owner = ? AND item = ? AND qty >= ?', int(qty), own(owner), item, int(qty)).changes > 0;
const itemName = (k) => (PB.ITEMS[k] ? `${E[PB.ITEMS[k].icon] || ''} ${PB.ITEMS[k].name}`.trim() : k);
const itemLine = (items) => Object.entries(items).filter(([, q]) => q > 0).map(([k, q]) => `${itemName(k)} ×${q}`).join(', ');

/** Dữ liệu đầy đủ của 1 con thú (kèm loài, chỉ số, rating, kỹ năng đã mở). */
function view(p, realm) {
  if (!p) return null;
  const sp = PD.speciesOf(p.species);
  if (!sp) return null;
  const pet = { ...p, tier: sp.tier };
  const ranks = parseJson(p.ranks, {});
  const ri = realm === undefined ? ownerRealm(p.owner) : realm;
  const cap = Math.max(p.level, PB.levelCap(ri, p.contract));
  const c = PB.CONTRACTS[p.contract] || null;
  const stage = PB.purityStage(p.purity);
  const skills = PD.skillList(sp).map((s) => ({ ...s, rank: clamp(int(ranks[s.key] || 1), 1, PB.SKILL_RANK_MAX), unlocked: p.level >= s.unlock }));
  const inh = PD.skillRef(p.inherit);
  const out = {
    ...p, sp, tier: sp.tier, tierInfo: PB.tierInfo(sp.tier), name: p.nick || sp.name, ranks, cap, contractInfo: c, stage, stageName: PB.STAGE_NAMES[stage],
    rating: PB.rating(pet, ri), stats: PB.statsOf(pet, sp.bias, ri), suppression: PB.suppression(sp.tier, ri), skills,
    inheritSkill: inh ? { ...inh, name: inh.def.n, rank: clamp(int(ranks.inh || 1), 1, PB.SKILL_RANK_MAX), text: inh.kind === 'passive' ? PD.fxText(inh.def.fx) : PD.skillText(inh.def) } : null,
    expNeed: PB.expNeed(p.level),
  };
  return out;
}
const emojiOf = (sp) => (E[sp.emoji] || tierIcon(sp.tier));
/** Huy hiệu phẩm cấp: emoji pixel pet_tierN, rơi về chấm màu Unicode. */
function tierIcon(n) { return E[`pet_tier${PB.tierInfo(n).n}`] || PB.tierInfo(n).icon; }

// ------------------------------------------------------------------ cấp độ & EXP
/** Cộng EXP cho 1 thú (không tự kiểm tra sở hữu). Trả { gained, levels, level }. */
function addExpRaw(petId, amount, realm) {
  const p = D.get('SELECT * FROM pets WHERE pet_id = ?', petId); if (!p || !(amount > 0)) return { gained: 0, levels: 0, level: p ? p.level : 0 };
  const cap = Math.max(p.level, PB.levelCap(realm === undefined ? ownerRealm(p.owner) : realm, p.contract));
  let { level, exp } = p; let got = 0; let lv = 0;
  if (level >= cap) return { gained: 0, levels: 0, level, capped: true };
  exp += int(amount); got = int(amount);
  while (level < cap && exp >= PB.expNeed(level)) { exp -= PB.expNeed(level); level += 1; lv += 1; }
  if (level >= cap) exp = Math.min(exp, PB.expNeed(level) - 1);
  D.run('UPDATE pets SET level = ?, exp = ? WHERE pet_id = ?', level, exp, petId);
  return { gained: got, levels: lv, level, capped: level >= cap };
}
/** Chia EXP cho thú xuất chiến (đủ) và thú đồng hành còn lại trong ô (một phần). Trả dòng thông báo ('' nếu không có). */
function shareExp(owner, amount, label) {
  const f = getFighter(owner); if (!f) return '';
  const realm = ownerRealm(owner);
  const r = addExpRaw(f.pet_id, amount, realm);
  for (const p of D.all("SELECT pet_id FROM pets WHERE owner = ? AND slot != '' AND fighter = 0", own(owner))) addExpRaw(p.pet_id, int(amount * PB.COMPANION_EXP_SHARE), realm);
  if (!r.gained) return '';
  const sp = PD.speciesOf(f.species);
  return `${emojiOf(sp)} **${f.nick || sp.name}** ${label} +${fmtNum(r.gained)} EXP${r.levels ? ` → **Lv.${r.level}**!` : ''}`;
}
/** Cộng thân mật theo khế ước (trả mức thực tế). */
function addBond(petId, base) {
  const p = D.get('SELECT * FROM pets WHERE pet_id = ?', petId); if (!p) return 0;
  const gain = PB.bondGain(p.contract, base); const nb = clamp(p.bond + gain, 0, PB.bondCap(p.contract));
  const real = Math.max(0, nb - p.bond); if (real) D.run('UPDATE pets SET bond = ? WHERE pet_id = ?', nb, petId);
  return real;
}

// ------------------------------------------------------------------ nhận thú / trứng
function grantPet(owner, speciesId, o = {}) {
  const sp = PD.speciesOf(speciesId); if (!sp) return null;
  const id = D.run('INSERT INTO pets (owner, species, nick, level, exp, bond, purity, contract, slot, fighter, gen, inherit, ranks, legacy, born_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, 0, 0, \'\', \'{}\', ?, ?)',
    own(owner), sp.id, o.nick || '', clamp(int(o.level || 1), 1, PB.LEVEL_MAX), clamp(int(o.bond || 0), 0, 100), clamp(int(o.purity === undefined ? randInt(...PB.EGG_PURITY) : o.purity), 0, 100),
    o.contract || '', o.slot || '', o.legacy ? 1 : 0, now()).lastInsertRowid;
  return Number(id);
}
function pickSpecies(srcIdx) {
  const w = PB.tierWeights(srcIdx); const tier = weightedChoice([1, 2, 3, 4, 5, 6, 7, 8, 9], w);
  return { tier, species: choice(PD.BY_TIER[tier - 1]) };
}
const fmtDur = (s) => { s = Math.max(0, int(s)); return s >= 3600 ? `${Math.floor(s / 3600)}g${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}p` : s >= 60 ? `${Math.floor(s / 60)}p${String(s % 60).padStart(2, '0')}s` : `${s}s`; };

/**
 * Hook Bí Cảnh: gọi 1 lần sau mỗi lượt khám phá. srcIdx: 1..4 = Bí Cảnh thường (Sơ→Vạn Linh Cốc), 5 = Đặc Biệt, 6..9 = Linh Giới.
 * Trả chuỗi thông báo (bắt đầu bằng "\n") hoặc ''.
 */
function onBicanh(userId, srcIdx) {
  try {
    const owner = own(userId); const lines = [];
    ensureMigrated(owner);
    const drops = {};
    for (const rule of PB.ITEM_DROP) { const [item, ch, q] = rule(srcIdx); if (ch > 0 && random() < ch) drops[item] = (drops[item] || 0) + q; }
    for (const [k, q] of Object.entries(drops)) addItem(owner, k, q);
    if (Object.keys(drops).length) lines.push(`🎒 Linh Thú: nhặt được ${itemLine(drops)}.`);
    if (random() < PB.EGG_CHANCE(srcIdx) && listEggs(owner).length < PB.EGG_CAPACITY) {
      const { tier, species } = pickSpecies(srcIdx);
      D.run('INSERT INTO pet_eggs (owner, species, tier, purity, hatch_at, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', owner, species, tier, randInt(...PB.EGG_PURITY), now() + PB.EGG.seconds(tier), `bicanh${srcIdx}`, now());
      lines.push(`🥚 **Nhặt được Trứng Linh Thú** (${tierIcon(tier)} ${PB.tierInfo(tier).name}) — nở sau ${fmtDur(PB.EGG.seconds(tier))}. Xem \`/linhthu\` → Khế Ước.`);
    }
    if (!getWild(owner) && random() < PB.WILD_CHANCE(srcIdx)) {
      const { tier, species } = pickSpecies(srcIdx); const [lo, hi] = PB.WILD_LEVEL(tier);
      D.run('INSERT OR REPLACE INTO pet_wild (owner, species, level, purity, src, expires_at) VALUES (?, ?, ?, ?, ?, ?)', owner, species, randInt(lo, hi), randInt(...PB.WILD_PURITY), srcIdx, now() + PB.CAPTURE.ttl);
      const sp = PD.speciesOf(species);
      lines.push(`${emojiOf(sp)} **Một ${sp.name} hoang dã xuất hiện!** (${tierIcon(tier)} ${PB.tierInfo(tier).name}) — vào \`/linhthu\` → Khế Ước để thu phục trong ${Math.floor(PB.CAPTURE.ttl / 60)} phút.`);
    }
    const ex = shareExp(owner, PB.expBicanh(srcIdx, (getFighter(owner) || { level: 1 }).level), 'đồng hành thám hiểm');
    if (ex) lines.push(ex);
    return lines.length ? `\n${lines.join('\n')}` : '';
  } catch (e) { console.error('⚠️ pets.onBicanh:', e.message); return ''; }
}
/** Hook Boss Thế Giới (kết liễu/đóng góp lớn). */
function onBoss(userId) { try { ensureMigrated(own(userId)); const f = getFighter(own(userId)); return f ? shareExp(own(userId), PB.expBoss(f.level), 'trợ chiến Boss') : ''; } catch (e) { return ''; } }

/** Nở các trứng đã đủ giờ (nếu Viên còn chỗ). Trả danh sách thú mới nở [{id, species}]. */
function hatchReady(owner) {
  owner = own(owner); const out = [];
  for (const egg of D.all('SELECT * FROM pet_eggs WHERE owner = ? AND hatch_at <= ? ORDER BY hatch_at ASC', owner, now())) {
    if (countVien(owner) >= PB.VIEN_CAPACITY) break;
    const done = D.transaction(() => {
      if (D.run('DELETE FROM pet_eggs WHERE egg_id = ? AND owner = ?', egg.egg_id, owner).changes === 0) return null;
      return grantPet(owner, egg.species, { level: 1, purity: egg.purity, bond: 10 });
    });
    if (done) out.push({ id: done, species: egg.species });
  }
  return out;
}
function rushEgg(owner, eggId) {
  owner = own(owner); const egg = D.get('SELECT * FROM pet_eggs WHERE owner = ? AND egg_id = ?', owner, Number(eggId));
  if (!egg) return bad('Không tìm thấy quả trứng này.');
  if (countVien(owner) >= PB.VIEN_CAPACITY) return bad(`Linh Thú Viên đã đầy (${PB.VIEN_CAPACITY}). Hãy thả bớt thú trước.`);
  if (!takeItem(owner, PB.EGG.rush, 1)) return bad(`Cần 1 ${itemName(PB.EGG.rush)}.`);
  D.run('UPDATE pet_eggs SET hatch_at = 0 WHERE egg_id = ?', egg.egg_id);
  const h = hatchReady(owner); if (!h.length) { addItem(owner, PB.EGG.rush, 1); return bad('Không thể nở trứng lúc này.'); }
  const sp = PD.speciesOf(h[0].species);
  return ok(`🐣 Trứng nở ra **${emojiOf(sp)} ${sp.name}** (${tierIcon(sp.tier)} ${PB.tierInfo(sp.tier).name})! Thú ở Linh Thú Viên.`, { petId: h[0].id });
}

/** Thu phục thú hoang. opts.phu / opts.luong: dùng Thu Phục Phù / Linh Thú Lương. */
function capture(owner, opts = {}) {
  owner = own(owner); ensureMigrated(owner);
  const w = getWild(owner); if (!w) return bad('Hiện không có thú hoang nào để thu phục (khám phá Bí Cảnh để gặp).');
  if (countVien(owner) >= PB.VIEN_CAPACITY) return bad(`Linh Thú Viên đã đầy (${PB.VIEN_CAPACITY}). Hãy thả bớt thú trước.`);
  const sp = PD.speciesOf(w.species); let bonus = 0; const used = [];
  if (opts.phu) { if (!takeItem(owner, 'bat_phu', 1)) return bad(`Bạn không có ${itemName('bat_phu')}.`); bonus += PB.CAPTURE.phuBonus; used.push(itemName('bat_phu')); }
  if (opts.luong) { if (!takeItem(owner, 'linh_thu_luong', 1)) { if (opts.phu) addItem(owner, 'bat_phu', 1); return bad(`Bạn không có ${itemName('linh_thu_luong')}.`); } bonus += PB.CAPTURE.luongBonus; used.push(itemName('linh_thu_luong')); }
  const chance = PB.captureChance(sp.tier, ownerRealm(owner), bonus);
  if (random() < chance) {
    const id = D.transaction(() => { if (D.run('DELETE FROM pet_wild WHERE owner = ? AND species = ?', owner, w.species).changes === 0) return null; return grantPet(owner, w.species, { level: w.level, purity: w.purity, bond: 0 }); });
    if (!id) return bad('Thú hoang đã biến mất.');
    return ok(`🎉 **Thu phục thành công ${emojiOf(sp)} ${sp.name}!** (Lv.${w.level}, huyết mạch ${w.purity}/100). Thú đang ở Linh Thú Viên — ký **Khế Ước** để đưa vào ô.`, { petId: id, chance });
  }
  if (random() < PB.CAPTURE.flee) { D.run('DELETE FROM pet_wild WHERE owner = ?', owner); return ok(`💨 Thu phục thất bại (${Math.round(chance * 100)}%) — **${sp.name} bỏ chạy mất rồi!**${used.length ? ` (đã dùng ${used.join(', ')})` : ''}`, { fled: true, chance }); }
  return ok(`❌ Thu phục thất bại (${Math.round(chance * 100)}%) nhưng ${sp.name} vẫn còn đó, thử lại nhé.${used.length ? ` (đã dùng ${used.join(', ')})` : ''}`, { chance });
}

// ------------------------------------------------------------------ nuôi dưỡng
function feed(owner, petId, foodKey, qty = 1) {
  owner = own(owner); ensureMigrated(owner);
  const p = getPet(owner, petId); if (!p) return bad('Không tìm thấy Linh Thú này.');
  qty = clamp(int(qty), 1, 50);
  const realm = ownerRealm(owner); const cap = Math.max(p.level, PB.levelCap(realm, p.contract));
  if (p.level >= cap) return bad(`**${p.nick || PD.speciesOf(p.species).name}** đã đạt cấp tối đa theo cảnh giới của bạn (Lv.${cap}). Hãy đột phá cảnh giới${p.contract === 'ban_menh' ? '' : ' hoặc ký Bản Mệnh Khế (+10 cấp)'}.`);
  let exp; let bondBase; let costLine;
  if (foodKey === 'basic') {
    const b = PB.BASIC_FEED; const need = b.nguyen_lieu * qty;
    if (!Cu.updateCultivator(owner, { nguyen_lieu: new Delta(-need) }, { nguyen_lieu: need })) return bad(`Cần ${need} ${E.nguyenlieu} nguyên liệu.`);
    exp = b.exp * qty; bondBase = b.bond * qty; costLine = `-${need} ${E.nguyenlieu} nguyên liệu`;
  } else {
    const it = PB.ITEMS[foodKey]; if (!it || !it.exp) return bad('Vật phẩm này không dùng để cho thú ăn.');
    if (!takeItem(owner, foodKey, qty)) return bad(`Không đủ ${it.name} (cần ${qty}).`);
    exp = it.exp * qty; bondBase = it.bond * qty; costLine = `-${qty} ${it.name}`;
  }
  const r = addExpRaw(p.pet_id, exp, realm); const bd = addBond(p.pet_id, bondBase);
  const sp = PD.speciesOf(p.species);
  return ok(`${emojiOf(sp)} **${p.nick || sp.name}** ăn no! +${fmtNum(r.gained)} EXP${r.levels ? ` → **Lv.${r.level}**` : ''}, +${bd} thân mật. (${costLine})${r.capped ? '\n⚠️ Đã chạm cấp tối đa — EXP dư bị bỏ.' : ''}`, { levels: r.levels });
}
function play(owner, petId) {
  owner = own(owner); ensureMigrated(owner);
  const p = getPet(owner, petId); if (!p) return bad('Không tìm thấy Linh Thú này.');
  const remain = PB.PLAY.cooldown - (now() - (p.last_play || 0));
  if (remain > 0) return bad(`⏳ ${p.nick || PD.speciesOf(p.species).name} còn mệt, chờ ${fmtDur(remain)} nữa mới dạo chơi tiếp được.`);
  D.run('UPDATE pets SET last_play = ? WHERE pet_id = ?', now(), p.pet_id);
  const r = addExpRaw(p.pet_id, PB.PLAY.exp(p.level), ownerRealm(owner)); const bd = addBond(p.pet_id, PB.PLAY.bond);
  const sp = PD.speciesOf(p.species);
  return ok(`🌿 Bạn dẫn **${emojiOf(sp)} ${p.nick || sp.name}** đi dạo: +${fmtNum(r.gained)} EXP${r.levels ? ` → **Lv.${r.level}**` : ''}, +${bd} thân mật.`);
}
const cleanName = (s) => String(s || '').replace(/[\r\n\t]+/g, ' ').replace(/[@`*_~|<>\\[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, PB.RENAME_MAX);
function rename(owner, petId, name) {
  const p = getPet(owner, petId); if (!p) return bad('Không tìm thấy Linh Thú này.');
  const n = cleanName(name);
  D.run('UPDATE pets SET nick = ? WHERE pet_id = ? AND owner = ?', n, p.pet_id, own(owner));
  return ok(n ? `✏️ Đã đổi tên thành **${n}**.` : '✏️ Đã trả về tên gốc của loài.');
}
function release(owner, petId) {
  owner = own(owner); const p = getPet(owner, petId); if (!p) return bad('Không tìm thấy Linh Thú này.');
  if (p.slot) return bad('Thú đang trong ô Khế Ước — hãy **Giải Khế** trước khi thả.');
  const sp = PD.speciesOf(p.species);
  const rw = PB.RELEASE.items(sp.tier, p.level); const lt = PB.RELEASE.linhThach(sp.tier, p.level);
  const done = D.transaction(() => { if (D.run('DELETE FROM pets WHERE pet_id = ? AND owner = ? AND slot = \'\'', p.pet_id, owner).changes === 0) return false; for (const [k, q] of Object.entries(rw)) if (q > 0) addItem(owner, k, q); Cu.updateCultivator(owner, { linh_thach: new Delta(lt) }); return true; });
  if (!done) return bad('Không thể thả con thú này.');
  return ok(`🍃 Đã thả **${p.nick || sp.name}** về tự nhiên. Nhận lại ${itemLine(rw) || 'không có vật phẩm'} và ${fmtNum(lt)} ${E.linhthach} Linh Thạch.`);
}

// ------------------------------------------------------------------ khế ước & ô
const SLOT_LABEL = { bm: 'Bản Mệnh', dh1: 'Đồng Hành 1', dh2: 'Đồng Hành 2' };
function reqContract(owner, p, key) {
  const c = PB.CONTRACTS[key]; const sp = PD.speciesOf(p.species); const realm = ownerRealm(owner); const r = [];
  r.push({ ok: !p.contract || key === 'ban_menh', text: p.contract && key !== 'ban_menh' ? 'Thú đang có khế ước — Giải Khế trước' : 'Thú chưa ký khế ước' });
  if (key === 'ban_menh') {
    r.push({ ok: p.contract === 'binh_dang' || p.contract === 'chu_to', text: 'Đã ký Bình Đẳng hoặc Chủ Tớ Khế trước' });
    r.push({ ok: !slotsOf(owner).bm, text: 'Ô Bản Mệnh còn trống' });
  } else {
    r.push({ ok: !!(!slotsOf(owner).dh1 || !slotsOf(owner).dh2), text: 'Còn ô Đồng Hành trống' });
  }
  if (key === 'chu_to') r.push({ ok: realm >= PB.tierReqRealm(sp.tier), text: `Cảnh giới chủ ≥ ${K.REALMS[PB.tierReqRealm(sp.tier)].name} (áp chế được ${PB.tierInfo(sp.tier).name})` });
  if (c.needBond) r.push({ ok: p.bond >= c.needBond, text: `Thân mật ≥ ${c.needBond} (hiện ${p.bond})` });
  for (const [k, q] of Object.entries(c.needItem)) r.push({ ok: itemQty(owner, k) >= q, text: `${itemName(k)} ×${q} (có ${itemQty(owner, k)})` });
  const cost = c.cost(sp.tier); const row = ownerRow(owner);
  r.push({ ok: !!row && row.linh_thach >= cost, text: `${fmtNum(cost)} Linh Thạch` });
  return { reqs: r, cost, all: r.every((x) => x.ok) };
}
function signContract(owner, petId, key) {
  owner = own(owner); ensureMigrated(owner);
  const c = PB.CONTRACTS[key]; if (!c) return bad('Loại khế ước không hợp lệ.');
  const p = getPet(owner, petId); if (!p) return bad('Không tìm thấy Linh Thú này.');
  const chk = reqContract(owner, p, key);
  if (!chk.all) return bad(`Chưa đủ điều kiện ký **${c.name}**:\n${chk.reqs.map((x) => `${x.ok ? '✅' : '❌'} ${x.text}`).join('\n')}`);
  const sp = PD.speciesOf(p.species);
  const res = D.transaction(() => {
    if (!Cu.updateCultivator(owner, { linh_thach: new Delta(-chk.cost) }, { linh_thach: chk.cost })) return 'balance';
    for (const [k, q] of Object.entries(c.needItem)) if (!takeItem(owner, k, q)) throw new Error('thiếu vật phẩm');
    const sl = slotsOf(owner);
    let slot;
    if (key === 'ban_menh') { slot = 'bm'; }
    else slot = !sl.dh1 ? 'dh1' : 'dh2';
    const bond = Math.min(p.bond, c.bondCap);
    D.run("UPDATE pets SET slot = '' WHERE pet_id = ? AND owner = ?", p.pet_id, owner);          // nhả ô cũ trước (Bản Mệnh chuyển từ Đồng Hành) để không đụng chỉ mục duy nhất
    D.run('UPDATE pets SET contract = ?, slot = ?, bond = ? WHERE pet_id = ? AND owner = ?', key, slot, bond, p.pet_id, owner);
    if (!D.get('SELECT 1 x FROM pets WHERE owner = ? AND fighter = 1', owner)) D.run('UPDATE pets SET fighter = 1 WHERE pet_id = ?', p.pet_id);
    return slot;
  });
  if (res === 'balance') return bad(Cu.MSG_BALANCE_CHANGED);
  return ok(`📜 **${c.name}** đã ký với **${emojiOf(sp)} ${p.nick || sp.name}**! Thú vào ô **${SLOT_LABEL[res]}**.\n_${c.desc}_`, { slot: res });
}
function breakContract(owner, petId) {
  owner = own(owner); const p = getPet(owner, petId); if (!p) return bad('Không tìm thấy Linh Thú này.');
  if (!p.slot) return bad('Thú này chưa ký khế ước.');
  D.transaction(() => {
    D.run("UPDATE pets SET contract = '', slot = '', fighter = 0, bond = MAX(0, bond - ?) WHERE pet_id = ? AND owner = ?", PB.CONTRACT_BREAK_BOND, p.pet_id, owner);
    if (p.fighter) { const nx = D.get("SELECT pet_id FROM pets WHERE owner = ? AND slot != '' ORDER BY (slot = 'bm') DESC, level DESC LIMIT 1", owner); if (nx) D.run('UPDATE pets SET fighter = 1 WHERE pet_id = ?', nx.pet_id); }
  });
  return ok(`💔 Đã **Giải Khế** với **${p.nick || PD.speciesOf(p.species).name}** (−${PB.CONTRACT_BREAK_BOND} thân mật). Thú trở về Linh Thú Viên; phí/vật phẩm ký khế không hoàn lại.`);
}
function setFighter(owner, petId) {
  owner = own(owner); const p = getPet(owner, petId); if (!p) return bad('Không tìm thấy Linh Thú này.');
  if (!p.slot) return bad('Chỉ thú đã ký khế ước (trong ô) mới được xuất chiến.');
  D.transaction(() => { D.run('UPDATE pets SET fighter = 0 WHERE owner = ?', owner); D.run('UPDATE pets SET fighter = 1 WHERE pet_id = ? AND owner = ?', p.pet_id, owner); });
  return ok(`⚔️ **${p.nick || PD.speciesOf(p.species).name}** sẽ xuất chiến (PvP, trợ chiến). Mỗi lúc chỉ 1 thú ra trận.`);
}
function unsetFighter(owner) { D.run('UPDATE pets SET fighter = 0 WHERE owner = ?', own(owner)); return ok('🏳️ Không còn thú nào xuất chiến.'); }

// ------------------------------------------------------------------ kỹ năng, huyết mạch, truyền thừa
function upgradeSkill(owner, petId, key) {
  owner = own(owner); const p = getPet(owner, petId); if (!p) return bad('Không tìm thấy Linh Thú này.');
  const v = view(p); const sk = key === 'inh' ? v.inheritSkill && { key: 'inh', name: v.inheritSkill.name, rank: v.inheritSkill.rank, unlocked: true } : v.skills.find((s) => s.key === key);
  if (!sk) return bad('Kỹ năng không hợp lệ.');
  if (!sk.unlocked) return bad('Kỹ năng này chưa được mở khóa (cần đủ cấp).');
  if (sk.rank >= PB.SKILL_RANK_MAX) return bad(`**${sk.name}** đã đạt bậc tối đa (${PB.SKILL_RANK_MAX}).`);
  const cost = PB.SKILL_UPGRADE.cost(sk.rank, v.tier);
  const done = D.transaction(() => {
    if (!Cu.updateCultivator(owner, { linh_thach: new Delta(-cost) }, { linh_thach: cost })) return 'bal';
    if (!takeItem(owner, PB.SKILL_UPGRADE.item, 1)) throw new Error('thiếu ngọc giản');
    const ranks = { ...v.ranks, [key]: sk.rank + 1 };
    D.run('UPDATE pets SET ranks = ? WHERE pet_id = ? AND owner = ?', JSON.stringify(ranks), p.pet_id, owner);
    return 'ok';
  });
  if (done === 'bal') return bad(`Cần ${fmtNum(cost)} ${E.linhthach} Linh Thạch.`);
  return ok(`📘 **${sk.name}** lên **bậc ${sk.rank + 1}** (−${fmtNum(cost)} Linh Thạch, −1 ${itemName(PB.SKILL_UPGRADE.item)}).`);
}
function refineBlood(owner, petId) {
  owner = own(owner); const p = getPet(owner, petId); if (!p) return bad('Không tìm thấy Linh Thú này.');
  if (p.purity >= 100) return bad('Huyết mạch đã đạt **Chân Huyết** tối đa (100).');
  const sp = PD.speciesOf(p.species); const cost = PB.REFINE.cost(sp.tier); const R = PB.REFINE;
  const before = PB.purityStage(p.purity);
  let gain = randInt(R.gain[0], R.gain[1]); if (p.purity >= R.softCap) gain = Math.max(1, int(gain * R.softMult));
  const res = D.transaction(() => {
    if (!Cu.updateCultivator(owner, { linh_thach: new Delta(-cost) }, { linh_thach: cost })) return 'bal';
    if (!takeItem(owner, R.item, 1)) throw new Error('thiếu huyết mạch tinh');
    D.run('UPDATE pets SET purity = MIN(100, purity + ?) WHERE pet_id = ? AND owner = ?', gain, p.pet_id, owner);
    return 'ok';
  });
  if (res === 'bal') return bad(`Cần ${fmtNum(cost)} ${E.linhthach} Linh Thạch.`);
  const np = Math.min(100, p.purity + gain); const after = PB.purityStage(np);
  return ok(`🩸 Tẩy luyện huyết mạch **${p.nick || sp.name}**: ${p.purity} → **${np}** (+${gain})${after > before ? `\n✨ **Thức tỉnh: ${PB.STAGE_NAMES[after]}!** Thiên phú mạnh hơn.` : ''}`);
}
function inheritChance(t, s) { return clamp(PB.INHERIT.skillChance + 0.05 * (s.tier - t.tier) + 0.002 * s.purity, 0.1, 0.8); }
function inheritBlood(owner, targetId, sacrificeId, skillKey) {
  owner = own(owner); ensureMigrated(owner);
  if (Number(targetId) === Number(sacrificeId)) return bad('Không thể truyền thừa cho chính mình.');
  const t = getPet(owner, targetId); const s = getPet(owner, sacrificeId);
  if (!t || !s) return bad('Không tìm thấy Linh Thú.');
  if (s.slot) return bad('Thú hiến tế phải đang ở Linh Thú Viên (không có khế ước/ô).');
  const ts = PD.speciesOf(t.species); const ss = PD.speciesOf(s.species);
  if (ss.tier < ts.tier - PB.INHERIT.minTierGap) return bad(`Thú hiến tế phải từ **${PB.tierInfo(Math.max(1, ts.tier - PB.INHERIT.minTierGap)).name}** trở lên (không kém quá ${PB.INHERIT.minTierGap} phẩm).`);
  if (t.gen >= PB.INHERIT.maxGen) return bad(`Thú đã truyền thừa tối đa ${PB.INHERIT.maxGen} đời.`);
  if (skillKey && !['a1', 'p1', 'a2'].includes(skillKey)) return bad('Kỹ năng truyền thừa không hợp lệ.');
  const cost = PB.INHERIT.cost(ts.tier);
  const chance = skillKey ? inheritChance({ tier: ts.tier }, { tier: ss.tier, purity: s.purity }) : 0;
  const gain = int(s.purity * PB.INHERIT.frac);
  let got = false;
  const res = D.transaction(() => {
    if (!Cu.updateCultivator(owner, { linh_thach: new Delta(-cost) }, { linh_thach: cost })) return 'bal';
    if (D.run("DELETE FROM pets WHERE pet_id = ? AND owner = ? AND slot = ''", s.pet_id, owner).changes === 0) throw new Error('hiến tế thất bại');
    got = !!skillKey && random() < chance;
    D.run('UPDATE pets SET purity = MIN(100, purity + ?), gen = gen + 1 WHERE pet_id = ? AND owner = ?', gain, t.pet_id, owner);
    if (got) { const ranks = parseJson(t.ranks, {}); ranks.inh = 1; D.run('UPDATE pets SET inherit = ?, ranks = ? WHERE pet_id = ? AND owner = ?', `${ss.id}:${skillKey}`, JSON.stringify(ranks), t.pet_id, owner); }
    return 'ok';
  });
  if (res === 'bal') return bad(`Cần ${fmtNum(cost)} ${E.linhthach} Linh Thạch.`);
  const sk = skillKey ? ss.skills[skillKey].n : '';
  return ok(`🧬 **Truyền Thừa Huyết Mạch** hoàn tất! **${s.nick || ss.name}** hiến tế cho **${t.nick || ts.name}**: huyết mạch +${gain} (đời ${t.gen + 1}).${skillKey ? (got ? `\n✨ Thừa hưởng kỹ năng **${sk}** (ô Truyền Thừa)!` : `\n💨 Kỹ năng **${sk}** không truyền được (tỉ lệ ${Math.round(chance * 100)}%).`) : ''}`, { got });
}

// ------------------------------------------------------------------ tiến hóa
function evoRequirements(owner, p, opt) {
  const sp = PD.speciesOf(p.species); const t = sp.tier; const realm = ownerRealm(owner); const row = ownerRow(owner);
  const need = opt.kind === 'main' ? PB.EVO.main(t) : PB.EVO.alt(t, opt.hanh);
  const r = [];
  r.push({ ok: p.level >= need.level, text: `Cấp ≥ ${need.level} (hiện ${p.level})` });
  r.push({ ok: p.bond >= need.bond, text: `Thân mật ≥ ${need.bond} (hiện ${p.bond})` });
  if (need.purity) r.push({ ok: p.purity >= need.purity, text: `Huyết mạch ≥ ${need.purity} (hiện ${p.purity})` });
  r.push({ ok: realm >= need.ownerRealm, text: `Cảnh giới chủ ≥ ${K.REALMS[Math.min(need.ownerRealm, K.REALMS.length - 1)].name}` });
  if (opt.kind === 'alt') r.push({ ok: !!(PB.CONTRACTS[p.contract] ? PB.CONTRACTS[p.contract].allowAlt : true), text: 'Không ký Chủ Tớ Khế (khế ước này cấm Dị Hóa)' });
  for (const [k, q] of Object.entries(need.items)) r.push({ ok: itemQty(owner, k) >= q, text: `${itemName(k)} ×${q} (có ${itemQty(owner, k)})` });
  r.push({ ok: !!row && row.linh_thach >= need.cost, text: `${fmtNum(need.cost)} Linh Thạch` });
  return { need, reqs: r, all: r.every((x) => x.ok) };
}
function evoList(owner, petId) {
  const p = getPet(owner, petId); if (!p) return [];
  return PD.evoOptions(p.species).map((o) => ({ ...o, toSpecies: PD.speciesOf(o.to), ...evoRequirements(own(owner), p, o) }));
}
function evolve(owner, petId, kind, hanh) {
  owner = own(owner); ensureMigrated(owner);
  const p = getPet(owner, petId); if (!p) return bad('Không tìm thấy Linh Thú này.');
  const sp = PD.speciesOf(p.species); if (sp.tier >= 9) return bad('Đã là phẩm cấp cao nhất (Hỗn Độn Thú), không thể tiến hóa thêm.');
  const opt = PD.evoOptions(p.species).find((o) => o.kind === kind && (kind === 'main' || o.hanh === hanh));
  if (!opt) return bad('Nhánh tiến hóa không hợp lệ.');
  const chk = evoRequirements(owner, p, opt);
  if (!chk.all) return bad(`Chưa đủ điều kiện tiến hóa:\n${chk.reqs.map((x) => `${x.ok ? '✅' : '❌'} ${x.text}`).join('\n')}`);
  const to = PD.speciesOf(opt.to);
  const res = D.transaction(() => {
    if (!Cu.updateCultivator(owner, { linh_thach: new Delta(-chk.need.cost) }, { linh_thach: chk.need.cost })) return 'bal';
    for (const [k, q] of Object.entries(chk.need.items)) if (!takeItem(owner, k, q)) throw new Error('thiếu nguyên liệu');
    const purity = kind === 'alt' ? Math.max(0, p.purity - 15) : p.purity;
    D.run('UPDATE pets SET species = ?, exp = 0, purity = ? WHERE pet_id = ? AND owner = ?', to.id, purity, p.pet_id, owner);
    return 'ok';
  });
  if (res === 'bal') return bad(Cu.MSG_BALANCE_CHANGED);
  return ok(`🌟 **TIẾN HÓA THÀNH CÔNG!** ${emojiOf(sp)} ${sp.name} → **${emojiOf(to)} ${to.name}** (${tierIcon(to.tier)} ${PB.tierInfo(to.tier).name}, hành ${to.hanh}).${kind === 'alt' ? '\n🔀 Dị Hóa: huyết mạch −15.' : ''}`, { to: to.id });
}

// ------------------------------------------------------------------ chợ
function buyItem(userId, item, qty = 1) {
  const owner = own(userId); const it = PB.ITEMS[item];
  if (!it || !PB.SHOP_ITEMS.includes(item)) return bad('Vật phẩm không có bán.');
  qty = clamp(int(qty), 1, 99);
  const lim = PB.SHOP_DAILY_LIMIT[item];
  const day = dayKey();
  return D.transaction(() => {
    if (lim) {
      const used = (D.get('SELECT qty FROM pet_daily WHERE owner = ? AND day = ? AND item = ?', owner, day, item) || { qty: 0 }).qty;
      if (used + qty > lim) return bad(`${it.name} chỉ mua tối đa ${lim}/ngày (hôm nay còn ${Math.max(0, lim - used)}).`);
    }
    const cost = it.price * qty;
    if (!Cu.updateCultivator(owner, { linh_thach: new Delta(-cost) }, { linh_thach: cost })) return bad(`Cần ${fmtNum(cost)} ${E.linhthach} Linh Thạch.`);
    addItem(owner, item, qty);
    if (lim) D.run('INSERT INTO pet_daily (owner, day, item, qty) VALUES (?, ?, ?, ?) ON CONFLICT(owner, day, item) DO UPDATE SET qty = qty + excluded.qty', owner, day, item, qty);
    return ok(`🛒 Đã mua **${it.name} ×${qty}** (−${fmtNum(cost)} ${E.linhthach} Linh Thạch).`);
  });
}

// ------------------------------------------------------------------ chuyển đổi dữ liệu cũ (linh_thu / linh_thu_level)
const OLD_BEAST_FALLBACK = { name: '', species: 'hoa_van_bao' };
function ensureLegacyTable() { D.run('CREATE TABLE IF NOT EXISTS pet_legacy_backup (owner TEXT PRIMARY KEY, name TEXT, level INTEGER, migrated_at REAL)'); }
/** Chuyển Linh Thú kiểu cũ của 1 người sang cấu trúc mới (idempotent, không mất tên/cấp). Trả pet_id hoặc null. */
function migrateOne(userId) {
  const owner = own(userId); ensureLegacyTable();
  if (D.get('SELECT 1 x FROM pet_legacy_backup WHERE owner = ?', owner)) return null;
  const row = D.get('SELECT linh_thu, linh_thu_level FROM cultivators WHERE user_id = ?', userId);
  if (!row || !row.linh_thu) return null;
  const name = String(row.linh_thu).trim(); const level = clamp(int(row.linh_thu_level || 1), 1, PB.LEVEL_MAX);
  const mapped = PB.LEGACY_MAP[name]; let species = mapped;
  if (!species) { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; species = PD.BY_TIER[1][h % 5]; }   // tên lạ: gán 1 loài Linh Thú, giữ nguyên tên làm biệt danh
  const nick = mapped ? '' : cleanName(name);
  return D.transaction(() => {
    D.run('INSERT OR IGNORE INTO pet_legacy_backup (owner, name, level, migrated_at) VALUES (?, ?, ?, ?)', owner, name, int(row.linh_thu_level || 0), now());
    const free = !D.get("SELECT 1 x FROM pets WHERE owner = ? AND slot = 'dh1'", owner);
    const id = grantPet(owner, species, { nick, level, purity: PB.LEGACY.purity, bond: PB.LEGACY.bond, contract: free ? PB.LEGACY.contract : '', slot: free ? 'dh1' : '', legacy: 1 });
    if (free && !D.get('SELECT 1 x FROM pets WHERE owner = ? AND fighter = 1', owner)) D.run('UPDATE pets SET fighter = 1 WHERE pet_id = ?', id);
    return id;
  });
}
const _ensured = new Set();
/** Gọi trước mọi thao tác Linh Thú của 1 người: chuyển đổi dữ liệu cũ một lần. */
function ensureMigrated(owner) { owner = own(owner); if (_ensured.has(owner)) return; try { migrateOne(owner); } finally { _ensured.add(owner); if (_ensured.size > 20000) _ensured.clear(); } }
/** Chạy khi bot khởi động: chuyển đổi hàng loạt. */
function migrateAll() {
  ensureLegacyTable(); let n = 0;
  for (const r of D.all("SELECT user_id FROM cultivators WHERE linh_thu IS NOT NULL AND linh_thu != '' AND CAST(user_id AS TEXT) NOT IN (SELECT owner FROM pet_legacy_backup)")) { if (migrateOne(r.user_id)) n += 1; _ensured.add(own(r.user_id)); }
  return n;
}

// ------------------------------------------------------------------ tổng hợp cho giao diện / Hồ Sơ
/** Dòng hiển thị nhanh thú xuất chiến, dùng ở Hồ Sơ/Tổng Quan. */
function profileLine(userId) {
  try {
    const owner = own(userId); ensureMigrated(owner);
    const f = getFighter(owner); if (!f) return D.get('SELECT 1 x FROM pets WHERE owner = ? LIMIT 1', owner) ? 'Chưa có thú xuất chiến' : 'Chưa có';
    const v = view(f, ownerRealm(owner));
    return `${emojiOf(v.sp)} ${v.name} · Lv.${v.level} · ${v.tierInfo.name} · ${PB.CONTRACTS[v.contract] ? PB.CONTRACTS[v.contract].short : 'Chưa khế ước'}`;
  } catch (e) { return 'Chưa có'; }
}
/** Tóm tắt Kho Đồ: vật phẩm + trứng + số thú. */
function inventorySummary(userId) {
  const owner = own(userId); ensureMigrated(owner);
  const items = itemMap(owner); const eggs = listEggs(owner); const n = D.get('SELECT COUNT(*) c FROM pets WHERE owner = ?', owner).c;
  const parts = [];
  if (n) parts.push(`🐾 ${n} Linh Thú`);
  const ready = eggs.filter((e) => e.hatch_at <= now()).length;
  if (eggs.length) parts.push(`🥚 ${eggs.length} trứng${ready ? ` (${ready} đã nở được)` : ''}`);
  const it = Object.entries(items).map(([k, q]) => `${itemName(k)} ×${q}`);
  return { n, eggs: eggs.length, items, text: [parts.join(' · '), it.join('\n')].filter(Boolean).join('\n') };
}

module.exports = {
  getPet, listPets, getFighter, slotsOf, countVien, listEggs, getWild, itemMap, itemQty, addItem, takeItem, itemName, itemLine, view, emojiOf, tierIcon, fmtDur, cleanName,
  addExpRaw, shareExp, addBond, grantPet, onBicanh, onBoss, hatchReady, rushEgg, capture, feed, play, rename, release,
  signContract, breakContract, setFighter, unsetFighter, reqContract, upgradeSkill, refineBlood, inheritBlood, inheritChance, evoList, evolve, buyItem,
  migrateOne, migrateAll, ensureMigrated, profileLine, inventorySummary, SLOT_LABEL, ownerRealm,
};
