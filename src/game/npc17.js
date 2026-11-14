'use strict';
/**
 * NPC THU MUA / BÁN v17.
 *  • Thu mua: 1 món / theo số lượng / tất cả (lọc danh mục). Giá = npc_sell_price (≈35% giá trị; sản phẩm chế ≤ 55–80% giá nguyên liệu) × hệ số phẩm chất.
 *  • BẢO VỆ (không bao giờ bán được): vật phẩm nhiệm vụ / Phi Thăng / Thiên Đạo (can_sell = false), vật phẩm đã KHOÁ, trang bị ĐANG MẶC hoặc đã khoá.
 *    Vật phẩm V16 cũ (Nguyên Liệu, Đan Dược, Huyền Thiết...) vẫn được NPC mua (xem nhưng KHÔNG tự đổi/xoá số cũ).
 *  • Bán: một số nguyên liệu cơ bản với giá 1,5× giá trị (money sink), giới hạn mua mỗi ngày.
 *  Mọi giao dịch trừ vật phẩm + cộng Linh Thạch trong 1 transaction; trừ vật phẩm có điều kiện nên không thể bán quá số có.
 */
const D = require('../db');
const Cu = require('./cultivator');
const Inv = require('./invsvc');
const Cat = require('./catalog17');
const { I, C } = Cat;
const { int, fmtNum } = require('../util');
const { Delta } = Cu;

const GOLD_CAP = 9e15;

/** Lý do không bán được (null = bán được). */
function blockReason(user, id, q = 0) {
  const it = I.BY_ID[id]; if (!it) return 'Vật phẩm không tồn tại.';
  if (it.is_quest_item) return 'Vật phẩm nhiệm vụ/Phi Thăng/Thiên Đạo — không thể bán.';
  if (!it.can_sell) return 'Vật phẩm này NPC không thu mua.';
  if (Inv.isLocked(user, id, q)) return 'Vật phẩm đang bị 🔒 khoá — mở khoá trước.';
  return null;
}
const unitPrice = (id, q = 0) => Cat.sellPrice(id, q);
function quote(user, id, q = 0, n = 1) {
  const have = Inv.qty(user, id, q); n = Math.max(0, Math.min(int(n), have)); const p = unitPrice(id, q);
  return { id, q, have, n, unit: p, total: p * n, block: blockReason(user, id, q) };
}

function sell(user, id, q = 0, n = 1) {
  n = int(n); if (!(n > 0)) return { ok: false, msg: 'Số lượng không hợp lệ.' };
  const it = I.BY_ID[id]; if (!it) return { ok: false, msg: 'Vật phẩm không tồn tại.' };
  return D.transaction(() => {
    const b = blockReason(user, id, Inv.norm(it, q)); if (b) return { ok: false, msg: `❌ ${b}` };
    const have = Inv.qty(user, id, q); if (have < n) return { ok: false, msg: `❌ Bạn chỉ có ${have} × ${it.name}.` };
    const p = unitPrice(id, Inv.norm(it, q)); if (p <= 0) return { ok: false, msg: '❌ NPC không thu mua vật phẩm này.' };
    if (!Inv.take(user, id, n, { q, why: 'bán NPC' })) return { ok: false, msg: '❌ Số lượng vừa thay đổi — thử lại.' };
    Cu.updateCultivator(user, { linh_thach: new Delta(p * n) });
    return { ok: true, gold: p * n, msg: `💰 Bán **${n} × ${it.name}**${q ? ` (${I.qName(q)})` : ''}: +**${fmtNum(p * n)}** Linh Thạch.` };
  });
}
/** Danh sách bán được (đã loại vật phẩm bị chặn) — lọc theo danh mục / phẩm cấp tối đa. */
function sellable(user, { cat = null, maxRarity = 7, products = true } = {}) {
  return Inv.list(user).filter((x) => (!cat || x.item.cat === cat) && x.item.rarity <= maxRarity && !blockReason(user, x.id, x.q) && unitPrice(x.id, x.q) > 0 && (products || !x.item.quality));
}
function sellAll(user, opts = {}) {
  return D.transaction(() => {
    let total = 0; const lines = [];
    for (const x of sellable(user, opts)) {
      const r = sell(user, x.id, x.q, x.qty); if (r.ok) { total += r.gold; lines.push(`${x.qty} × ${x.item.name}${x.q ? ` (${I.qName(x.q)})` : ''}`); }
    }
    if (!lines.length) return { ok: false, msg: 'Không có vật phẩm nào bán được (đã loại khoá/nhiệm vụ).' };
    return { ok: true, gold: total, n: lines.length, msg: `💰 Đã bán ${lines.length} loại vật phẩm: +**${fmtNum(total)}** Linh Thạch.` };
  });
}
function previewAll(user, opts = {}) {
  const list = sellable(user, opts); let total = 0; for (const x of list) total += unitPrice(x.id, x.q) * x.qty;
  return { list, total };
}

// ------------------------------------------------------------------ trang bị
function sellGear(user, gearId) {
  const G = require('./gear17'); const row = G.get(user, gearId); if (!row) return { ok: false, msg: 'Không tìm thấy trang bị.' };
  if (row.equipped) return { ok: false, msg: '❌ Trang bị đang mặc — tháo ra trước.' };
  if (row.locked) return { ok: false, msg: '❌ Trang bị đang 🔒 khoá.' };
  return D.transaction(() => {
    const v = G.sellValue(row);
    if (D.run('DELETE FROM gear WHERE gear_id = ? AND user_id = ? AND equipped = 0 AND locked = 0', row.gear_id, String(user)).changes === 0) return { ok: false, msg: 'Trang bị vừa thay đổi.' };
    Cu.updateCultivator(user, { linh_thach: new Delta(v) });
    return { ok: true, gold: v, msg: `💰 Bán **${G.name(row)}**: +**${fmtNum(v)}** Linh Thạch.` };
  });
}

// ------------------------------------------------------------------ NPC bán
const shopList = (user) => Object.entries(C.NPC_SHOP).map(([id, lim]) => ({ id, limit: lim, bought: Inv.dailyGet(user, `npcbuy:${id}`), price: Cat.buyPrice(id), item: I.BY_ID[id] }));
function buy(user, id, n = 1) {
  n = int(n); const lim = C.NPC_SHOP[id]; if (!lim) return { ok: false, msg: 'NPC không bán vật phẩm này.' };
  if (!(n > 0)) return { ok: false, msg: 'Số lượng không hợp lệ.' };
  return D.transaction(() => {
    const bought = Inv.dailyGet(user, `npcbuy:${id}`);
    if (bought + n > lim) return { ok: false, msg: `❌ Hôm nay NPC chỉ còn bán cho bạn **${Math.max(0, lim - bought)}** × ${I.BY_ID[id].name}.` };
    const cost = Cat.buyPrice(id) * n; const me = Cu.getCultivator(user);
    if (!me || me.linh_thach < cost) return { ok: false, msg: `❌ Cần ${fmtNum(cost)} Linh Thạch (hiện có ${fmtNum(me ? me.linh_thach : 0)}).` };
    if (!Cu.updateCultivator(user, { linh_thach: new Delta(-cost) }, { linh_thach: cost })) return { ok: false, msg: Cu.MSG_BALANCE_CHANGED };
    const got = Inv.add(user, id, n, { why: 'mua NPC' }); if (got < n) throw new Error('kho đầy');
    Inv.dailyAdd(user, `npcbuy:${id}`, n);
    return { ok: true, msg: `🛒 Mua **${n} × ${I.BY_ID[id].name}**: −${fmtNum(cost)} Linh Thạch.` };
  });
}

module.exports = { blockReason, unitPrice, quote, sell, sellable, sellAll, previewAll, sellGear, shopList, buy, GOLD_CAP };
