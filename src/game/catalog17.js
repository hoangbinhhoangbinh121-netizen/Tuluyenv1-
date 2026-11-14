'use strict';
/**
 * Catalog v17 = items_v17 (danh mục) + craft_v17 (công thức/bảng rơi) → tính GIÁ, NGUỒN NHẬN, NƠI DÙNG cho từng vật phẩm.
 *  • source_ids / recipe_ids / usage_ids được SUY RA, không gõ tay → luôn khớp dữ liệu thật; validate() báo vật phẩm mồ côi.
 *  • Giá sản phẩm/bán thành phẩm lấy từ công thức: NPC thu mua ≤ 55–80% tổng NPC-giá nguyên liệu ⇒ chế rồi bán KHÔNG bao giờ lãi.
 */
const I = require('../data/items_v17');
const C = require('../data/craft_v17');

const Q_SELL = [0, 0.7, 1.0, 1.2, 1.4, 1.6];          // hệ số giá bán theo phẩm chất (nhân sau hệ số 0.55 của sản phẩm có phẩm chất)
const nominal = (id) => { const it = I.BY_ID[id]; return it ? Math.floor(it.base_value * I.NPC_RATE) : 0; };

// ---------------------------------------------------------------- nguồn/nơi dùng ngoài bảng rơi & công thức
const SHOP_IDS = Object.keys(C.NPC_SHOP);
const LEGACY_SRC = {
  nl_tap: ['bc0', 'bc1', 'bc2', 'vlc'], ld_dac_biet: ['bc0', 'bc1', 'bc2', 'vlc'], kv_huyen_thiet: ['vlc'], nl_manh_phap_bao: ['vlc'], tdc_hu_khong_tinh_hoa: ['vlc'],
  kv_tien_kim: ['chain_luyenhu'], kv_tien_ngoc: ['chain_luyenhu', 'chain_daithua'], tdc_thien_hoa_tinh: ['chain_luyenhu'], tdc_hu_khong_ket_tinh: ['chain_hopthe'],
  tdc_thien_dao_thach: ['chain_hopthe'], tdc_manh_tien_gioi_lenh: ['chain_hopthe', 'chain_daithua'], tdc_dao_nguyen_tinh: ['chain_daithua', 'chain_dokiep'],
  tdc_thien_dao_an: ['chain_dokiep_boss'], tdc_thien_kiep_chi_luc: ['chain_dokiep_boss'], tdc_manh_ghep_phithang: ['bc1', 'bc2', 'vlc'],
  tdc_linh_gioi_lenh: ['phithang'], tdc_tien_gioi_lenh: ['phithang'], tdc_linh_phu: ['bc1', 'bc2', 'vlc'], tdc_tien_phu: ['chain_luyenhu', 'chain_hopthe', 'chain_daithua', 'chain_dokiep'],
  tdc_diem_linh_ngo: ['chain_hopthe', 'chain_daithua', 'chain_dokiep'],
  dan_tu_khi: [], dan_pha_gioi: ['shop_dan'], dan_tay_tuy_ts: ['code'], dan_tay_tuy_nua: ['code'], vp_ruong_than_bi: ['event', 'code'], vp_ve_bicanh_db: ['boss_kill'],
};
// Nơi TIÊU THỤ / SỬ DỤNG ngoài công thức
const EXTRA_USES = {
  nl_tap: ['pet_feed'], yt_yeu_dan: ['pet_feed'],
  tdc_thien_dao_thach: ['talent_exchange'], tdc_dao_nguyen_tinh: ['talent_exchange'],
  tdc_linh_gioi_lenh: ['phithang'], tdc_tien_gioi_lenh: ['phithang'], tdc_linh_phu: ['phithang'], tdc_tien_phu: ['phithang'], tdc_manh_ghep_phithang: ['phithang'], tdc_manh_tien_gioi_lenh: ['phithang'],
  tdc_diem_linh_ngo: ['phithang'], tdc_thien_dao_an: ['thiendao'],
  kl_dong: ['gear_enh', 'gear_repair'], kl_huyen: ['gear_enh'], kl_tu: ['gear_enh'], kl_hon: ['gear_enh'],
  nl_manh_phap_bao: ['gear_enh', 'gear_refine', 'catalyst_khi'], tdc_manh_ban_ve: ['gear_refine'],
  tdc_dan_hoa_tinh: ['catalyst_dan'], td_thien_dien_sa: ['catalyst_tran'],
  lt_linh_tho: ['field'], lt_linh_tuyen_thuy: ['field'], tdc_moc_nguyen_tinh: ['field_up'], ld_dia_mach_chi: ['field_up'],
  lt_thuc_sinh_dich: ['field_fert'], lt_duong_mach_dich: ['field_fert'],
  tdc_tan_quyen_dan_phuong: ['use_tanquyen'], tdc_dan_hoa_tinh_: [],
  dan_pha_gioi: ['use_dan'], dan_tay_tuy_ts: ['taytuy'], dan_tay_tuy_nua: ['taytuy'], vp_ruong_than_bi: ['moruong'], vp_ve_bicanh_db: ['bicanh_db'],
};
for (const id of Object.keys(C.SEEDS)) { (EXTRA_USES[id] = EXTRA_USES[id] || []).push('field'); }
for (const id of Object.keys(C.PILLS)) (EXTRA_USES[id] = EXTRA_USES[id] || []).push('use_dan');
for (const id of Object.keys(C.TRANS)) (EXTRA_USES[id] = EXTRA_USES[id] || []).push('deploy');
// rơi / nhận khác
const EXTRA_SRC = {};
for (const [seed, s] of Object.entries(C.SEEDS)) {
  (EXTRA_SRC[s.crop] = EXTRA_SRC[s.crop] || []).push('field');
  if (s.mut) (EXTRA_SRC[s.mut.to] = EXTRA_SRC[s.mut.to] || []).push('field');
  (EXTRA_SRC[seed] = EXTRA_SRC[seed] || []).push('field_seed');
}
for (const id of SHOP_IDS) (EXTRA_SRC[id] = EXTRA_SRC[id] || []).push('npc_shop');
// phân giải trang bị trả về
const DISMANTLE = { pk_tho: 0.6, pk_trung: 0.6, pk_cao: 0.6, pk_tien: 0.5, tdc_khi_linh_hach: 0.25, tdc_manh_ban_ve: 0.1 };
for (const id of Object.keys(DISMANTLE)) (EXTRA_SRC[id] = EXTRA_SRC[id] || []).push('dismantle');
EXTRA_SRC.nl_tap = [...(EXTRA_SRC.nl_tap || [])];
EXTRA_SRC.dan_tu_khi = [];

// ---------------------------------------------------------------- giá
const recipesByOut = {};
for (const r of C.RECIPES) (recipesByOut[r.out.item] = recipesByOut[r.out.item] || []).push(r);
const priced = new Set();
function price(id, stack = []) {
  const it = I.BY_ID[id]; if (!it) throw new Error(`vật phẩm không tồn tại: ${id}`);
  if (priced.has(id)) return it;
  if (stack.includes(id)) throw new Error(`công thức vòng: ${[...stack, id].join(' → ')}`);
  if (it.price_mode === 'raw') { it.base_value = I.rawValue(it); }
  else if (it.price_mode === 'fixed') { /* base_value đã có */ }
  else {
    const rs = recipesByOut[id] || [];
    if (!rs.length) { it.base_value = I.rawValue(it); }
    else {
      let best = null;
      for (const r of rs) {
        let v = r.gold; let nom = 0;
        for (const [k, n] of Object.entries(r.ing)) { price(k, [...stack, id]); v += I.BY_ID[k].base_value * n; nom += I.BY_ID[k].nominal * n; }
        const per = (v * 1.15) / r.out.qty; const nper = (nom / r.out.qty) * (it.quality || it.cat === 'DAN_DUOC' ? 0.55 : 0.8);
        if (!best || per < best.per) best = { per, nper };
      }
      it.base_value = Math.ceil(best.per); it.nominal = Math.floor(best.nper);
    }
  }
  if (it.nominal === undefined) it.nominal = Math.floor(it.base_value * I.NPC_RATE);
  priced.add(id); return it;
}
// thứ tự: nguyên liệu trước để `nominal` luôn có khi tính công thức
for (const it of I.ITEMS) if (it.price_mode === 'raw' || it.price_mode === 'fixed') { if (it.price_mode === 'raw') it.base_value = I.rawValue(it); it.nominal = Math.floor(it.base_value * I.NPC_RATE); priced.add(it.id); }
for (const it of I.ITEMS) price(it.id);
for (const it of I.ITEMS) { it.npc_sell_price = it.can_sell ? it.nominal : 0; }
// trang bị: giá mẫu theo công thức
const GEAR_VALUE = {};
for (const gid of Object.keys(C.GEAR)) {
  const r = recipesByOut[gid][0]; let nom = 0; let v = r.gold;
  for (const [k, n] of Object.entries(r.ing)) { nom += I.BY_ID[k].nominal * n; v += I.BY_ID[k].base_value * n; }
  GEAR_VALUE[gid] = { base_value: Math.ceil(v * 1.15), npc: Math.floor(nom * 0.5) };
}

// ---------------------------------------------------------------- truy vấn
const sources = (id) => {
  const out = new Set(EXTRA_SRC[id] || []);
  for (const s of LEGACY_SRC[id] || []) out.add(s);
  for (const [sid, d] of Object.entries(C.DROPS)) if (d.rolls.some((x) => x[0] === id)) out.add(sid);
  for (const r of recipesByOut[id] || []) out.add(`recipe:${r.id}`);
  return [...out];
};
const recipesOut = (id) => (recipesByOut[id] || []).map((r) => r.id);
const recipesUse = (id) => C.RECIPES.filter((r) => r.ing[id]).map((r) => r.id);
const usages = (id) => {
  const out = new Set(EXTRA_USES[id] || []);
  for (const r of recipesUse(id)) out.add(`recipe:${r}`);
  return [...out];
};
/** Cho nguồn nhận/tiêu thụ ra chữ dễ đọc. */
const SRC_LABEL = {
  field: 'Linh Điền (thu hoạch/biến dị)', field_seed: 'Linh Điền (thu hồi hạt giống)', npc_shop: 'NPC bán (Linh Thạch)', dismantle: 'Phân giải trang bị', code: 'Mã code', phithang: 'Phi Thăng',
  shop_dan: 'Cửa Hàng Đan Dược', event: 'Sự kiện Đại Phú', boss_kill: 'Boss Thế Giới (kết liễu)',
};
const USE_LABEL = {
  pet_feed: 'Cho Linh Thú ăn', talent_exchange: 'Đổi Bảo Thạch Thể Chất/Linh Căn', phithang: 'Con Đường Phi Thăng', thiendao: 'Thiên Đạo', gear_enh: 'Cường hoá trang bị', gear_refine: 'Tinh luyện trang bị',
  gear_repair: 'Sửa trang bị', catalyst_khi: 'Xúc tác Luyện Khí', catalyst_dan: 'Xúc tác Đan Sư', catalyst_tran: 'Xúc tác Trận Pháp', field: 'Linh Điền (gieo/tưới)', field_up: 'Nâng cấp Linh Điền',
  field_fert: 'Bón Linh Điền', use_tanquyen: 'Đọc để tăng EXP Đan Sư', use_dan: 'Dùng (cắn đan)', deploy: 'Triển khai trận pháp', taytuy: 'Tẩy Tủy', moruong: 'Mở Rương', bicanh_db: 'Vào Bí Cảnh Đặc Biệt',
};
const srcLabel = (s) => {
  if (s.startsWith('recipe:')) { const r = C.RBY[s.slice(7)]; return r ? `Chế: ${r.name} (${C.PROFS[r.prof].name} cấp ${r.lv})` : s; }
  if (C.DROPS[s]) return C.DROPS[s].label; return SRC_LABEL[s] || s;
};
const useLabel = (s) => {
  if (s.startsWith('recipe:')) { const r = C.RBY[s.slice(7)]; return r ? `Công thức: ${r.name}` : s; }
  return USE_LABEL[s] || s;
};

const get = (id) => I.BY_ID[id] || null;
/** Giá NPC thu mua 1 đơn vị (q = phẩm chất sản phẩm). */
function sellPrice(id, q = 0) {
  const it = I.BY_ID[id]; if (!it || !it.can_sell) return 0;
  if (it.quality && q > 0) return Math.max(0, Math.floor(it.npc_sell_price * Q_SELL[q]));
  return it.npc_sell_price;
}
/** Giá NPC bán (người chơi mua). */
const buyPrice = (id) => Math.ceil(I.BY_ID[id].base_value * C.NPC_BUY_MULT);

function validate() {
  const bad = [];
  const has = (id, where) => { if (!I.BY_ID[id] && !C.GEAR[id]) bad.push(`${where}: vật phẩm không tồn tại "${id}"`); };
  for (const r of C.RECIPES) {
    if (!C.PROFS[r.prof]) bad.push(`recipe ${r.id}: nghề lạ`); if (r.lv < 1 || r.lv > 9) bad.push(`recipe ${r.id}: cấp lạ`);
    for (const k of Object.keys(r.ing)) has(k, `recipe ${r.id}`);
    has(r.out.item, `recipe ${r.id} out`);
    if (r.kind === 'gear' && !C.GEAR[r.out.item]) bad.push(`recipe ${r.id}: thiếu mẫu trang bị`);
    if (r.kind !== 'gear' && I.BY_ID[r.out.item] && r.q && !I.BY_ID[r.out.item].quality) bad.push(`recipe ${r.id}: sản phẩm không có phẩm chất`);
  }
  for (const [sid, d] of Object.entries(C.DROPS)) for (const x of d.rolls) has(x[0], `drop ${sid}`);
  for (const id of Object.keys(C.NPC_SHOP)) has(id, 'npc_shop');
  for (const it of I.ITEMS) {
    if (it.cat === 'DAN_DUOC' && it.quality && !C.PILLS[it.id]) bad.push(`đan ${it.id}: thiếu hiệu ứng`);
    if (it.cat === 'TRAN_PHAP' && !C.TRANS[it.id]) bad.push(`trận ${it.id}: thiếu hiệu ứng`);
    if (!it.is_quest_item || it.id === 'tdc_thien_dao_thach') { /* bắt buộc có nguồn & nơi dùng */ }
    if (!sources(it.id).length && it.id !== 'dan_tu_khi') bad.push(`${it.id}: KHÔNG có nguồn nhận`);
    if (!usages(it.id).length) bad.push(`${it.id}: KHÔNG có nơi tiêu thụ/sử dụng`);
    if (!(it.base_value > 0)) bad.push(`${it.id}: không có giá trị`);
  }
  for (const r of C.RECIPES) { if (!usages(r.out.item).length && r.kind !== 'gear') bad.push(`sản phẩm ${r.out.item} không có công dụng`); }
  // chống lãi Linh Thạch: NPC bán sản phẩm tối đa (phẩm cao nhất) < tổng NPC giá nguyên liệu
  for (const r of C.RECIPES) {
    let inV = 0; for (const [k, n] of Object.entries(r.ing)) inV += I.BY_ID[k].nominal * n;
    const it = I.BY_ID[r.out.item]; if (!it) continue;
    const maxQ = it.quality ? 5 : 0; const outV = (it.can_sell ? sellPrice(it.id, maxQ) : 0) * r.out.qty;
    if (outV > inV && inV > 0) bad.push(`recipe ${r.id}: bán sản phẩm (${outV}) > nguyên liệu (${inV}) — có thể lãi Linh Thạch`);
  }
  return bad;
}

module.exports = {
  I, C, Q_SELL, GEAR_VALUE, DISMANTLE, SHOP_IDS, get, price, sellPrice, buyPrice, nominal, sources, usages, recipesOut, recipesUse, srcLabel, useLabel, validate,
};
