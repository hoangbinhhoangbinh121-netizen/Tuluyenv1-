'use strict';
// Sinh BANG_DOI_CHIEU_V17.md (đối chiếu vật phẩm/hệ thống) và các số đếm cho BAO_CAO_V17.md trực tiếp từ danh mục — luôn khớp mã nguồn.
const fs = require('node:fs'); const path = require('node:path');
const Cat = require('../src/game/catalog17'); const { I, C } = Cat; const K = require('../src/game/constants');
const L = []; const w = (s = '') => L.push(s);
const rar = (r) => I.RARITY[r - 1].name;
w('# BẢNG ĐỐI CHIẾU V16 → V17 (sinh tự động từ danh mục — `scripts/gen_doichieu_v17.js`)'); w();
w('Số liệu THẬT trên máy chủ (số người giữ, tổng số lượng từng loại, kết quả đối chiếu trước/sau migration) lấy bằng lệnh admin `/doichieuv17` — file này chỉ mô tả cấu trúc.'); w();
w('## 1. Hệ thống V16 → cách V17 xử lý'); w();
w('| Hệ thống / vật phẩm V16 | V17 | Dữ liệu cũ |'); w('|---|---|---|');
for (const r of [
  ['Nguyên Liệu (`nguyen_lieu`)', 'Vật phẩm `nl_tap` (Nguyên Liệu Tạp) — dùng trong công thức, NPC thu mua/bán', 'Giữ nguyên cột cũ'],
  ['Đan Dược / Tụ Khí Đan (`dan_duoc`)', 'Vật phẩm `dan_tu_khi` (phẩm 2) — công thức Đan Sư, vẫn cắn bằng Dùng Đan Dược', 'Giữ nguyên cột cũ'],
  ['Mẻ đan cũ đang luyện (`luyendan_start`)', '`/luyendan` vẫn thu được mẻ đang chạy; mẻ mới do Đan Sư đảm nhiệm', 'Không mất mẻ nào'],
  ['Luyện Khí cũ (cộng ATK/DEF vĩnh viễn)', 'Luyện Khí Sư rèn trang bị 7 ô; **không còn** cộng vĩnh viễn mỗi lần chế', 'Chỉ số đã cộng giữ nguyên, không thu hồi'],
  ['Đan Dược Phá Giới', 'Vật phẩm `dan_pha_gioi` + công thức Đan Sư + dùng qua Dùng Đan Dược', 'Giữ nguyên cột cũ'],
  ['Đan Tẩy Tủy Trọng Sinh / Nửa Tác Dụng', '`dan_tay_tuy_ts` / `dan_tay_tuy_nua` — dùng ở menu Tẩy Tủy như cũ', 'Giữ nguyên cột cũ'],
  ['Huyền Thiết, Tiên Kim, Tiên Ngọc, Hư Không Tinh Hoa/Kết Tinh, Thiên Hỏa Tinh, Thiên Kiếp Chi Lực, Đạo Nguyên Tinh, Thiên Đạo Thạch/Ấn …', 'Vật phẩm danh mục tương ứng (nhóm Tinh Hoa / Khoáng Vật), có nguồn rơi & công dụng rõ', 'Giữ nguyên cột cũ'],
  ['Linh Dược Đặc Biệt', '`ld_dac_biet` — nguyên liệu Đan Phá Giới', 'Giữ nguyên cột cũ'],
  ['Linh Giới Lệnh, Linh Phù, Tiên Lệnh/Phù, Mảnh Tiên Giới Lệnh, Mảnh ghép Phi Thăng, Điểm Linh Ngộ', 'Vật phẩm nhiệm vụ/Phi Thăng/Thiên Đạo — **không bán, không chuyển, không tiêu hao bởi nghề**', 'Giữ nguyên cột cũ'],
  ['Rương Thần Bí, Vé Bí Cảnh Đặc Biệt', '`vp_ruong_than_bi`, `vp_ve_bicanh_db` (Không Gian Trận Bàn thay được vé)', 'Giữ nguyên cột cũ'],
  ['Linh Thú / vật phẩm Linh Thú (`pet_items`)', 'Yêu Đan/Tinh Huyết… dùng chung kho qua Inventory Service (adapter `pet`)', 'Giữ nguyên bảng cũ'],
  ['Công Pháp / Mảnh bí tịch / Pháp Bảo', 'Không đổi', 'Không đụng'],
]) w(`| ${r.join(' | ')} |`);
w(); w('## 2. Danh mục vật phẩm'); w();
w(`Tổng **${I.ITEMS.length}** vật phẩm, **${Object.keys(I.CATEGORIES).length}** danh mục, **${I.RARITY.length}** phẩm cấp (độc lập với phẩm chất sản phẩm 1–5).`); w();
for (const [cat, meta] of Object.entries(I.CATEGORIES)) {
  const items = I.ITEMS.filter((x) => x.cat === cat); if (!items.length) continue;
  w(`### ${meta.icon || ''} ${meta.label} (${items.length})`); w();
  w('| Vật phẩm | id | Phẩm cấp | Kho lưu | Bán NPC | Nguồn nhận | Công dụng |'); w('|---|---|---|---|---|---|---|');
  for (const it of items) {
    const src = Cat.sources(it.id).map(Cat.srcLabel).slice(0, 4).join('; ') || '—'; const use = Cat.usages(it.id).map(Cat.useLabel).slice(0, 4).join('; ') || '—';
    const price = !it.can_sell || it.is_quest_item ? 'không bán' : `${Cat.sellPrice(it.id, it.quality ? 2 : 0)}${it.quality ? ' (Trung phẩm)' : ''}`;
    w(`| ${it.name} | \`${it.id}\` | ${rar(it.rarity)} | ${it.store === 'col' ? `cột cũ \`${it.legacy_col}\`` : it.store} | ${price} | ${src.replace(/\|/g, '/')} | ${use.replace(/\|/g, '/')} |`);
  }
  w();
}
w('## 3. Công thức nghề'); w();
for (const p of C.PROF_ORDER) {
  const rs = C.RECIPES.filter((r) => r.prof === p); w(`### ${C.PROFS[p].name} (${rs.length} công thức)`); w();
  w('| Công thức | Cấp | Cảnh giới | Nguyên liệu | Linh Thạch | Sản phẩm | Thời gian | Thành công |'); w('|---|---|---|---|---|---|---|---|');
  for (const r of rs) {
    const out = r.kind === 'gear' ? `trang bị ${C.GEAR[r.out.item].name}` : `${r.out.qty} × ${I.BY_ID[r.out.item].name}`;
    w(`| ${r.name} | ${C.LEVELS[r.lv - 1].name} | ${K.REALMS[r.realm].name} | ${Object.entries(r.ing).map(([k, n]) => `${n} ${I.BY_ID[k].name}`).join(', ')} | ${r.gold} | ${out} | ${Math.round(r.time / 60)}′ | ${Math.round(Math.min(1, r.rate) * 100)}% |`);
  }
  w();
}
fs.writeFileSync(path.join(__dirname, '..', 'BANG_DOI_CHIEU_V17.md'), L.join('\n') + '\n');
const stat = { items: I.ITEMS.length, cats: Object.keys(I.CATEGORIES).length, recipes: C.RECIPES.length, pills: Object.keys(C.PILLS).length, trans: Object.keys(C.TRANS).length, gear: Object.keys(C.GEAR).length, drops: Object.keys(C.DROPS).length, seeds: Object.keys(C.SEEDS).length, techs: Object.values(C.TECHS).reduce((s, x) => s + x.length, 0), ach: Object.values(C.ACH).reduce((s, x) => s + x.length, 0), npcShop: Object.keys(C.NPC_SHOP).length,
  byProf: Object.fromEntries(C.PROF_ORDER.map((p) => [p, C.RECIPES.filter((r) => r.prof === p).length])), byCat: Object.fromEntries(Object.keys(I.CATEGORIES).map((c) => [c, I.ITEMS.filter((x) => x.cat === c).length])),
  newMaterials: I.ITEMS.filter((x) => x.store === 'tbl' && !['DAN_DUOC', 'TRAN_PHAP'].includes(x.cat)).length, quest: I.ITEMS.filter((x) => x.is_quest_item).length, products: I.ITEMS.filter((x) => ['DAN_DUOC', 'TRAN_PHAP'].includes(x.cat)).length };
console.log(JSON.stringify(stat));
