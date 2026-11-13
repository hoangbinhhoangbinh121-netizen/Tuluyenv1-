'use strict';
/**
 * TuTienStore — danh mục hàng. Tên / công dụng / yêu cầu lấy TỪ DỮ LIỆU GAME (constants.json, congphap_v16.js, petBalance.js)
 * nên không bán thứ game không có. Giá VNĐ ở dưới là GIÁ MẶC ĐỊNH tham khảo — admin chỉnh bằng `/storeadmin gia <mã> <giá>`
 * (lưu trong DB, không cần sửa code) hoặc sửa số trong file này.
 *
 * Mỗi sản phẩm có `grants` = danh sách thao tác cấp đồ; đơn hàng chụp lại grants lúc tạo nên đổi catalog sau đó không ảnh hưởng đơn cũ.
 *  { t:'col', col, n }        cộng cột số lượng của nhân vật (Linh Thạch, Linh Tinh, Rương, Đan...)
 *  { t:'talent', kind, name } đặt Linh Căn / Thể Chất (dùng đúng hàm admin của game, thu hồi được bằng /thuhoituchat)
 *  { t:'phapbao', tier }      thêm Pháp Bảo vào phap_bao_owned
 *  { t:'congphap', tier }     thêm Công Pháp vào cong_phap_owned
 *  { t:'pet_item', item, n }  cộng vật phẩm Linh Thú (pet_items)
 */
const K = require('../game/constants');
const Cu = require('../game/cultivator');
const D = require('../db');
const D16 = require('../data/congphap_v16');
const PB = require('../game/petBalance');
const Schema = require('./schema');
const { fmtNum } = require('../util');

const CATS = [
  { key: 'tainguyen', icon: '💎', label: 'Tài Nguyên', blurb: 'Linh Thạch · Linh Tinh · Khí Vận · Rương Thần Bí' },
  { key: 'dan', icon: '🧪', label: 'Đan Dược & Tẩy Tủy', blurb: 'Đan Dược · Đan Phá Giới · Đan Tẩy Tủy · Nhẫn Cầu Hôn' },
  { key: 'linhcan', icon: '🌱', label: 'Linh Căn', blurb: 'Đặt thẳng phẩm Linh Căn (chỉ bán loại cao hơn hiện có)' },
  { key: 'thechat', icon: '💪', label: 'Thể Chất', blurb: 'Đặt thẳng phẩm Thể Chất (chỉ bán loại cao hơn hiện có)' },
  { key: 'phapbao', icon: '🛡️', label: 'Pháp Bảo', blurb: '5 Pháp Bảo cộng % chỉ số/HP mọi nơi' },
  { key: 'cp_nhan', icon: '🌱', label: 'Công Pháp Nhân Giới', blurb: '10 quyển Tàng Kinh Các — Nhân Giới' },
  { key: 'cp_linh', icon: '🔮', label: 'Công Pháp Linh Giới', blurb: '10 quyển Tàng Kinh Các — Linh Giới' },
  { key: 'cp_tien', icon: '☁️', label: 'Công Pháp Tiên Giới', blurb: '10 quyển Tàng Kinh Các — Tiên Giới' },
  { key: 'cp_doc', icon: '🌟', label: 'Công Pháp Độc Quyền', blurb: '10 quyển độc quyền, mạnh hơn Tầng 201' },
  { key: 'cp_co', icon: '📜', label: 'Công Pháp Cổ (Tầng 1–102)', blurb: 'Công pháp cũ Tầng 1–7, 101, 102' },
  { key: 'thu_vp', icon: '🐾', label: 'Linh Thú — Vật Phẩm', blurb: 'Thức ăn · Thu Phục Phù · Khế Ước · Huyết Mạch · Kỹ Năng' },
  { key: 'thu_evo', icon: '🔥', label: 'Linh Thú — Tiến Hóa', blurb: 'Hóa Linh Châu · Nguyên Tố Tinh Hoa' },
];

// cột số lượng được phép cộng (whitelist — không bao giờ ghép tên cột từ dữ liệu ngoài)
const COL_LABEL = {
  linh_thach: '💎 Linh Thạch', linh_tinh: '🌠 Linh Tinh', khi_van: '🍀 Khí Vận', nguyen_lieu: '🌿 Nguyên Liệu',
  ruong_than_bi: '📦 Rương Thần Bí', dan_duoc: '💊 Đan Dược', dan_pha_gioi: '⚗️ Đan Dược Phá Giới',
  dan_taytuy_trongsinh: '🧪 Đan Tẩy Tủy Trọng Sinh', dan_taytuy_nuaban: '🧪 Đan Tẩy Tủy Nửa Tác Dụng', nhan_cau_hon: '💍 Nhẫn Cầu Hôn',
};
const COLS = new Set(Object.keys(COL_LABEL));

const slug = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const vnd = (n) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;
const realmName = (i) => (K.REALMS[i] ? K.REALMS[i].name : `Cảnh giới ${i}`);

const items = [];
const add = (p) => items.push({ unique: false, maxQty: 10, dailyLimit: 0, short: '', ...p });
const col = (c, n) => ({ t: 'col', col: c, n, label: `${COL_LABEL[c]} ×${fmtNum(n)}` });

// ============================================================ TÀI NGUYÊN
for (const [id, n, price, maxQty] of [['lt_5m', 5e6, 10000, 10], ['lt_25m', 25e6, 45000, 10], ['lt_100m', 1e8, 150000, 10], ['lt_500m', 5e8, 600000, 5]]) {
  add({ id, cat: 'tainguyen', name: `Gói ${fmtNum(n)} Linh Thạch`, short: 'Tiền tệ chính: mua Công Pháp, Pháp Bảo, Đan Phương, nâng cấp...', desc: `Cộng **${fmtNum(n)}** ${COL_LABEL.linh_thach} vào nhân vật.`, price, maxQty, grants: [col('linh_thach', n)] });
}
for (const [n, price, maxQty] of [[10, 20000, 10], [50, 90000, 10], [200, 320000, 5], [1000, 1400000, 2]]) {
  add({ id: `tinh_${n}`, cat: 'tainguyen', name: `Gói ${fmtNum(n)} Linh Tinh`, short: 'Tiền tệ cao cấp: mua công pháp Linh Giới/Tiên Giới, nâng cấp Tàng Kinh Các', desc: `Cộng **${fmtNum(n)}** ${COL_LABEL.linh_tinh} (mua công pháp Linh Giới / Tiên Giới và nâng cấp công pháp mới).`, price, maxQty, grants: [col('linh_tinh', n)] });
}
for (const [n, price, maxQty] of [[1, 20000, 10], [5, 90000, 10], [10, 170000, 5]]) {
  add({ id: `ruong_${n}`, cat: 'tainguyen', name: `${n} Rương Thần Bí`, short: 'Mở ra +sao, Lực Chiến, HP, Công/Thủ vĩnh viễn (1% Công Pháp Đặc Quyền)', desc: `Cộng **${n}** ${COL_LABEL.ruong_than_bi}. Mở bằng \`/moruong\` hoặc trong Kho Đồ: cộng chỉ số vĩnh viễn, 1% ra Hồng Mông Tử Khí Quyết.`, price, maxQty, grants: [col('ruong_than_bi', n)] });
}
for (const [n, price] of [[100, 10000], [500, 45000]]) {
  add({ id: `khivan_${n}`, cat: 'tainguyen', name: `Gói ${n} Khí Vận`, short: 'Dùng ở Cửa Hàng Khí Vận (Đan Tăng Tu Vi, Đan Tốc Luyện, Đan Hồi Khí...)', desc: `Cộng **${n}** ${COL_LABEL.khi_van}.`, price, maxQty: 10, grants: [col('khi_van', n)] });
}
add({ id: 'nguyenlieu_1000', cat: 'tainguyen', name: 'Gói 1.000 Nguyên Liệu', short: 'Dùng cho Luyện Đan, Luyện Khí và nuôi Linh Thú', desc: `Cộng **1.000** ${COL_LABEL.nguyen_lieu}.`, price: 15000, maxQty: 10, grants: [col('nguyen_lieu', 1000)] });

// ============================================================ ĐAN DƯỢC
add({ id: 'dan_duoc_10', cat: 'dan', name: '10 Đan Dược', short: 'Cắn ngay nhận 60–120 tu vi mỗi viên', desc: `Cộng **10** ${COL_LABEL.dan_duoc} (mỗi viên +60–120 tu vi).`, price: 15000, grants: [col('dan_duoc', 10)] });
add({ id: 'dan_duoc_50', cat: 'dan', name: '50 Đan Dược', short: 'Cắn ngay nhận 60–120 tu vi mỗi viên', desc: `Cộng **50** ${COL_LABEL.dan_duoc} (mỗi viên +60–120 tu vi).`, price: 65000, grants: [col('dan_duoc', 50)] });
add({ id: 'phagioi_1', cat: 'dan', name: '1 Đan Dược Phá Giới', short: 'Giảm thời gian chờ sau đột phá thất bại', desc: `Cộng **1** ${COL_LABEL.dan_pha_gioi}: bỏ bớt cooldown Đột Phá sau khi thất bại.`, price: 25000, grants: [col('dan_pha_gioi', 1)] });
add({ id: 'phagioi_5', cat: 'dan', name: '5 Đan Dược Phá Giới', short: 'Giảm thời gian chờ sau đột phá thất bại', desc: `Cộng **5** ${COL_LABEL.dan_pha_gioi}.`, price: 110000, grants: [col('dan_pha_gioi', 5)] });
add({ id: 'taytuy_nua_1', cat: 'dan', name: 'Đan Tẩy Tủy Nửa Tác Dụng', short: 'Tự chọn reroll Linh Căn HOẶC Thể Chất (ngẫu nhiên)', desc: `Cộng **1** ${COL_LABEL.dan_taytuy_nuaban}: tự chọn reroll Linh Căn hoặc Thể Chất — kết quả vẫn ngẫu nhiên theo xác suất của game.`, price: 150000, maxQty: 5, grants: [col('dan_taytuy_nuaban', 1)] });
add({ id: 'taytuy_trong_1', cat: 'dan', name: 'Đan Tẩy Tủy Trọng Sinh', short: 'Reroll CẢ Linh Căn và Thể Chất (ngẫu nhiên)', desc: `Cộng **1** ${COL_LABEL.dan_taytuy_trongsinh}: reroll cả Linh Căn và Thể Chất — kết quả ngẫu nhiên theo xác suất của game.`, price: 450000, maxQty: 3, grants: [col('dan_taytuy_trongsinh', 1)] });
add({ id: 'nhan_cau_hon_1', cat: 'dan', name: 'Nhẫn Cầu Hôn', short: 'Cần để gửi lời mời Song Tu (tốn 1 chiếc/lần mời)', desc: `Cộng **1** ${COL_LABEL.nhan_cau_hon}: cần để gửi lời mời Song Tu.`, price: 10000, grants: [col('nhan_cau_hon', 1)] });

// ============================================================ LINH CĂN / THỂ CHẤT (chỉ bán phẩm cao — không để khách mua nhầm bị tụt phẩm)
const TALENT_PRICE = {
  linh_can: { 'Tam Linh Căn': 30000, 'Song Linh Căn': 60000, 'Thiên Linh Căn': 120000, 'Dị Linh Căn': 250000, 'Thánh Linh Căn': 500000, 'Tiên Linh Căn': 1000000, 'Hỗn Độn Linh Căn': 2000000 },
  the_chat: { 'Linh Thể': 20000, 'Huyền Thể': 50000, 'Hoang Cổ Thánh Thể': 100000, 'Tiên Thiên Đạo Thể': 200000, 'Hồng Mông Đạo Thể': 400000, 'Hỗn Độn Thần Thể': 800000, 'Vô Cực Đạo Thể': 1500000 },
};
const TALENT_LIST = { linh_can: K.LINH_CAN, the_chat: K.THE_CHAT };
const TALENT_LABEL = { linh_can: 'Linh Căn', the_chat: 'Thể Chất' };
for (const kind of ['linh_can', 'the_chat']) {
  for (const [name, price] of Object.entries(TALENT_PRICE[kind])) {
    const info = TALENT_LIST[kind].find((x) => x.name === name); if (!info) continue;
    add({
      id: `${kind === 'linh_can' ? 'lc' : 'tc'}_${slug(name)}`, cat: kind === 'linh_can' ? 'linhcan' : 'thechat', unique: true,
      name, short: `Hệ số x${info.mult} — đặt thẳng ${TALENT_LABEL[kind]} này (không random)`,
      desc: `Đổi ${TALENT_LABEL[kind]} hiện tại thành **${name}** (hệ số **x${info.mult}**).\n⚠️ Hồ sơ thức tỉnh/tiến hóa của ${TALENT_LABEL[kind]} được **đặt lại**, hành & độ tinh khiết roll mới. Chỉ bán khi cao hơn phẩm bạn đang có.`,
      price, grants: [{ t: 'talent', kind, name, label: `${kind === 'linh_can' ? '🌱' : '💪'} ${TALENT_LABEL[kind]}: **${name}** (x${info.mult})` }],
    });
  }
}

// ============================================================ PHÁP BẢO
const PB_PRICE = { 1: 30000, 2: 70000, 3: 150000, 4: 300000, 5: 600000 };
for (const t of K.PHAP_BAO_TIER_DEF) {
  add({
    id: `pb_${t.tier}`, cat: 'phapbao', unique: true, name: t.name, short: `+${Math.round(t.bonus * 100)}% chỉ số/HP mọi nơi (PvP, Bí Cảnh, Boss, Thiên Kiếp...)`,
    desc: `Pháp Bảo **${t.name}**: **+${Math.round(t.bonus * 100)}%** chỉ số/HP áp dụng mọi nơi. Trong game mua ở Cửa Hàng với ${fmtNum(t.cost)} Linh Thạch (cần ${realmName(t.require_realm)}). Sau khi nhận, vào menu Tu Hành để trang bị.`,
    price: PB_PRICE[t.tier] || 50000, grants: [{ t: 'phapbao', tier: t.tier, label: `🛡️ Pháp Bảo **${t.name}** (+${Math.round(t.bonus * 100)}%)` }],
  });
}

// ============================================================ CÔNG PHÁP MỚI (V16) — 40 quyển
const CP_PRICE = {
  nhan: [10, 15, 20, 30, 40, 55, 70, 90, 110, 140],
  linh: [60, 80, 100, 130, 160, 200, 250, 310, 380, 460],
  tien: [250, 320, 400, 500, 620, 760, 920, 1100, 1300, 1600],
  doc: [800, 1000, 1200, 1400, 1600, 1800, 2000, 2300, 2600, 3000],
};
const CP_CAT = { nhan: 'cp_nhan', linh: 'cp_linh', tien: 'cp_tien', doc: 'cp_doc' };
const gi = {}; // chỉ số trong nhóm
for (const b of D16.BOOKS) {
  gi[b.group] = (gi[b.group] === undefined ? 0 : gi[b.group] + 1);
  const g = D16.GROUPS[b.group];
  const worldTxt = b.require_world ? ` · ${b.require_world === 1 ? 'Linh Giới' : 'Tiên Giới'}` : '';
  add({
    id: `cp_${b.tier}`, cat: CP_CAT[b.group], unique: true, name: b.name,
    short: `${b.phamName} · ${g.short} — ${String(b.desc || '').slice(0, 60)}`,
    desc: `📜 **${b.name}** (${b.phamName} · ${g.short})\n${b.desc || ''}\nTrang bị cần: **${realmName(b.require_realm)}**${worldTxt}. Nâng cấp tới Cấp ${D16.MAX_LEVEL} trong Tàng Kinh Các.`,
    price: (CP_PRICE[b.group] || [100])[gi[b.group]] * 1000,
    grants: [{ t: 'congphap', tier: b.tier, label: `📜 Công Pháp **${b.name}** (${b.phamName})` }],
  });
}
// Công pháp cũ (không gồm Tầng 201 — chỉ rơi từ Boss)
const OLD_PRICE = { 1: 5000, 2: 8000, 3: 12000, 4: 20000, 5: 35000, 6: 60000, 7: 100000, 101: 150000, 102: 250000 };
let CPold = null;
const oldName = (t) => { try { CPold = CPold || require('../game/congphap'); return CPold.currentName(t); } catch (_) { return `Công Pháp Tầng ${t}`; } };
for (const t of K.CONG_PHAP_TIER_DEF) {
  if (t.boss_drop_only || !OLD_PRICE[t.tier]) continue;
  add({
    id: `cpo_${t.tier}`, cat: 'cp_co', unique: true, name: `[Tầng ${t.tier}] Công Pháp`,
    short: `+${Math.round(t.bonus * 100)}% chỉ số/HP, buff PvP +${Math.round(t.pvp_buff * 100)}% — cần ${realmName(t.require_realm)}`,
    desc: `Công pháp cổ **Tầng ${t.tier}**: **+${Math.round(t.bonus * 100)}%** chỉ số/HP, buff Đấu Pháp +${Math.round(t.pvp_buff * 100)}% / debuff -${Math.round(t.pvp_debuff * 100)}%. Cần ${realmName(t.require_realm)} để trang bị.`,
    price: OLD_PRICE[t.tier], dynName: () => `[Tầng ${t.tier}] ${oldName(t.tier)}`,
    grants: [{ t: 'congphap', tier: t.tier, label: `📜 Công Pháp Tầng ${t.tier}` }],
  });
}

// ============================================================ LINH THÚ — vật phẩm (22 loại trong game; trứng/thú sống KHÔNG bán — thu phục qua Bí Cảnh)
const PET_PACKS = [
  ['linh_thu_luong', 50, 5000], ['linh_thu_dan', 20, 10000], ['than_thu_dan', 5, 15000, 4], ['bat_phu', 10, 8000], ['khe_uoc_phu', 5, 8000],
  ['ban_menh_huyet', 1, 20000, 2], ['huyet_mach_tinh', 3, 15000], ['ky_nang_gian', 5, 15000], ['trung_nho', 5, 8000],
];
const petGrant = (item, n) => ({ t: 'pet_item', item, n, label: `🐾 ${PB.ITEMS[item].name} ×${n}` });
for (const [item, n, price, daily] of PET_PACKS) {
  const it = PB.ITEMS[item]; if (!it) continue;
  add({ id: `pet_${item}_${n}`, cat: 'thu_vp', name: `${it.name} ×${n}`, short: it.desc, desc: `Cộng **${n}** × **${it.name}** (vật phẩm Linh Thú).\n${it.desc}`, price, dailyLimit: daily || 0, grants: [petGrant(item, n)] });
}
for (let t = 1; t <= 8; t += 1) {
  const item = `evo_t${t}`; const it = PB.ITEMS[item]; if (!it) continue;
  const n = 1 + t; // đúng số Hóa Linh Châu cần cho 1 lần tiến hóa chính (EVO.main)
  add({ id: `pet_${item}`, cat: 'thu_evo', name: `${it.name} ×${n}`, short: `Đủ cho 1 lần tiến hóa chính (cần ${n} viên)`, desc: `Cộng **${n}** × **${it.name}** — đúng số cần cho 1 lần tiến hóa chính.\n${it.desc}`, price: [5000, 8000, 14000, 25000, 45000, 80000, 140000, 250000][t - 1], grants: [petGrant(item, n)] });
}
for (const h of PB.HANH) {
  const item = `ess_${PB.HANH_KEY[h]}`; const it = PB.ITEMS[item]; if (!it) continue;
  add({ id: `pet_${item}`, cat: 'thu_evo', name: `${it.name} ×5`, short: it.desc, desc: `Cộng **5** × **${it.name}**.\n${it.desc}`, price: 10000, grants: [petGrant(item, 5)] });
}

// ============================================================ API
const BASE = new Map(items.map((p) => [p.id, p]));
if (BASE.size !== items.length) throw new Error('TuTienStore: trùng mã sản phẩm trong catalog');
for (const p of items) {
  if (p.cat && !CATS.some((c) => c.key === p.cat)) throw new Error(`TuTienStore: danh mục lạ ${p.cat}`);
  for (const g of p.grants) if (g.t === 'col' && !COLS.has(g.col)) throw new Error(`TuTienStore: cột lạ ${g.col}`);
}

function cfgMap() {
  try { Schema.ensure(); return new Map(D.all('SELECT product_id, price, enabled FROM store_product_cfg').map((r) => [r.product_id, r])); } catch (_) { return new Map(); }
}
function merge(p, cfg) {
  const c = cfg.get(p.id);
  const price = c && c.price !== null && c.price !== undefined ? Number(c.price) : p.price;
  return { ...p, name: p.dynName ? p.dynName() : p.name, basePrice: p.price, price, enabled: !c || c.enabled === null || c.enabled === undefined || Number(c.enabled) !== 0 };
}
/** Tất cả sản phẩm (kể cả đang tắt). */
const all = () => { const cfg = cfgMap(); return items.map((p) => merge(p, cfg)); };
const get = (id) => { const p = BASE.get(String(id)); return p ? merge(p, cfgMap()) : null; };
/** Sản phẩm đang bán trong 1 danh mục. */
const listCat = (catKey) => all().filter((p) => p.cat === catKey && p.enabled);
const cats = () => { const a = all(); return CATS.map((c) => ({ ...c, count: a.filter((p) => p.cat === c.key && p.enabled).length })); };

/** Khai triển grants theo số lượng. Hàng "unique" luôn x1. */
function expand(p, qty) {
  if (p.unique) return p.grants.map((g) => ({ ...g }));
  return p.grants.map((g) => (g.t === 'col' || g.t === 'pet_item'
    ? { ...g, n: g.n * qty, label: g.label.replace(/×[\d.,]+\s*$/, `×${fmtNum(g.n * qty)}`) }
    : { ...g }));
}

const talentMult = (kind, name) => { const x = TALENT_LIST[kind].find((i) => i.name === name); return x ? x.mult : 0; };
/** Lý do KHÔNG nên bán cho người này (đã có / không phải nâng cấp), hoặc '' nếu bán được. */
function blockReason(p, row) {
  for (const g of p.grants) {
    if (g.t === 'phapbao' && Cu.ownedPhapbaoTiers(row).has(g.tier)) return `Bạn đã sở hữu **${p.name}** rồi.`;
    if (g.t === 'congphap' && Cu.ownedCongphapTiers(row).has(Number(g.tier))) return `Bạn đã sở hữu **${p.name}** rồi.`;
    if (g.t === 'talent') {
      const cur = talentMult(g.kind, row[g.kind]); const want = talentMult(g.kind, g.name);
      if (want <= cur) return `${TALENT_LABEL[g.kind]} hiện tại của bạn (**${row[g.kind] || 'chưa có'}**, x${cur || 1}) đã bằng hoặc cao hơn **${g.name}** (x${want}) — không bán để tránh bạn bị tụt phẩm.`;
    }
  }
  return '';
}
const ownedMark = (p, row) => (p.grants.some((g) => (g.t === 'phapbao' && Cu.ownedPhapbaoTiers(row).has(g.tier)) || (g.t === 'congphap' && Cu.ownedCongphapTiers(row).has(Number(g.tier)))) ? 'owned' : (blockReason(p, row) ? 'blocked' : ''));

function setPrice(id, price) {
  if (!BASE.has(id)) return false; Schema.ensure();
  D.run('INSERT INTO store_product_cfg (product_id, price, enabled) VALUES (?, ?, 1) ON CONFLICT(product_id) DO UPDATE SET price = excluded.price', id, price === null ? null : Math.round(price));
  return true;
}
function setEnabled(id, on) {
  if (!BASE.has(id)) return false; Schema.ensure();
  D.run('INSERT INTO store_product_cfg (product_id, price, enabled) VALUES (?, NULL, ?) ON CONFLICT(product_id) DO UPDATE SET enabled = excluded.enabled', id, on ? 1 : 0);
  return true;
}

module.exports = { CATS, COL_LABEL, COLS, TALENT_LIST, TALENT_LABEL, talentMult, all, get, listCat, cats, expand, blockReason, ownedMark, setPrice, setEnabled, vnd, slug };
