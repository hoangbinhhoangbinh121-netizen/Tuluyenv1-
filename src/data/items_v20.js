'use strict';
/**
 * V20.0 — VẬT PHẨM MỚI của Đại Hoàn Thiện Nghề Nghiệp (cắm vào danh mục v17 qua install(def), không tạo danh mục thứ hai).
 * Không đổi ID/công dụng vật phẩm V17/V19. Mọi vật phẩm ở đây đều có nguồn thật (khai thác / Linh Điền / bí cảnh / boss / đơn hàng / công thức) — kiểm bởi catalog17.validate().
 */
const V = require('./v20_data');
const { STAGES, ID } = V;

function install(def) {
  const mat = (id, name, cat, sub, rarity, base, desc, o = {}) => def({ id, name, cat, sub, rarity, desc, price_mode: 'fixed', base_value: Math.round(base), ...o });
  for (const S of STAGES) {
    const n = S.n; const rar = Math.min(7, S.rar);
    // ---- Linh Dược (nhóm theo giai đoạn) + Linh Chủng tương ứng
    V.HERB[n - 1].forEach((nm, i) => {
      const k = i === 0 ? 'a' : 'b';
      mat(ID.herb(n, k), nm, 'LINH_DUOC', 'v20', rar, S.base * (i === 0 ? 1 : 1.4), `${S.duoc} (${S.name}) — nguyên liệu luyện đan, thu hoạch từ Linh Điền hoặc hái ở nơi thu thập.`);
      mat(ID.seed(n, k), `${S.chung} · ${nm}`, 'LINH_THUC', 'chung', rar, S.base * (i === 0 ? 1 : 1.4) * 1.6, `${S.chung} (${S.name}) — hạt giống ${nm}. Gieo ở Linh Điền (cần cấp Linh Điền và cấp Linh Thực Sư).`);
    });
    // ---- Khoáng vật
    V.ORE[n - 1].forEach((nm, i) => mat(ID.ore(n, i === 0 ? 'a' : 'b'), nm, 'KHOANG_VAT', 'v20', rar, S.base * (i === 0 ? 1 : 1.3), `Khoáng vật ${S.name} — khai thác ở mỏ hoặc rơi từ bí cảnh; dùng tinh luyện, đúc trang bị, khắc trận.`));
    // ---- Yêu thú tài liệu & Trận đạo
    mat(ID.beast(n), V.BEAST[n - 1], 'YEU_THU_TAI_LIEU', 'v20', rar, S.base * 1.2, `Nguyên liệu yêu thú ${S.name} — rơi từ Boss, Bí Cảnh, Linh Thú đồng hành; dùng luyện đan, đúc phôi, chế trang bị.`);
    mat(ID.tran(n), V.TRANMAT[n - 1], 'TRAN_DAO_TAI_LIEU', 'v20', rar, S.base * 1.1, `Vật liệu trận đạo ${S.name} — khắc Trận Văn.`);
    // ---- Nguyên liệu trung gian (bán thành phẩm — giá theo công thức)
    def({ id: ID.kl(n), name: V.KL[n - 1], cat: 'NGUYEN_LIEU_TRUNG_GIAN', sub: 'kimloai', rarity: rar, desc: `Kim loại tinh luyện ${S.name} — bán thành phẩm của Luyện Khí Sư (cường hoá, đúc phôi).`, price_mode: 'recipe' });
    def({ id: ID.pk(n), name: V.PK[n - 1], cat: 'NGUYEN_LIEU_TRUNG_GIAN', sub: 'phoikhi', rarity: rar, desc: `Phôi khí ${S.name} — bán thành phẩm để rèn trang bị.`, price_mode: 'recipe' });
    // ---- Hỏa Chủng (thu phục Dị Hỏa)
    mat(ID.hoachung(n), `Hỏa Chủng · ${S.hoaName}`, 'THIEN_DIA_CHI_BAO', 'hoa', rar, S.base * 25, `Hạt giống của ${S.hoaName} (${S.hoa}). Dùng ở mục Dị Hỏa của Đan Sư để thu phục; vật phẩm hiếm.`, { can_sell: false, can_trade: false });
  }
  // ---- Dược Dịch mở rộng + Trận Văn mở rộng (đúng spec: Thần, Đế, Siêu Thoát / Tiên Văn → Siêu Thoát Văn)
  def({ id: 'dd_than', name: 'Dược Dịch Thần', cat: 'NGUYEN_LIEU_TRUNG_GIAN', sub: 'duocdich', rarity: 6, desc: 'Dược dịch cấp Thần — bán thành phẩm của Đan Sư, nền cho đan dược Tiên Cấp/Đế Cấp.', price_mode: 'recipe' });
  def({ id: 'dd_de', name: 'Dược Dịch Đế', cat: 'NGUYEN_LIEU_TRUNG_GIAN', sub: 'duocdich', rarity: 7, desc: 'Dược dịch cấp Đế — nền cho đan dược Đạo Tổ Cấp/Thiên Đạo Cấp.', price_mode: 'recipe' });
  def({ id: 'dd_sieuthoat', name: 'Dược Dịch Siêu Thoát', cat: 'NGUYEN_LIEU_TRUNG_GIAN', sub: 'duocdich', rarity: 7, desc: 'Dược dịch cấp Siêu Thoát — nền cho đan dược Siêu Thoát Cấp.', price_mode: 'recipe' });
  for (const [id, nm, r] of [['tv_tien', 'Tiên Văn', 6], ['tv_than', 'Thần Văn', 6], ['tv_de', 'Đế Văn', 7], ['tv_thiendao', 'Thiên Đạo Văn', 7], ['tv_sieuthoat', 'Siêu Thoát Văn', 7]]) {
    def({ id, name: nm, cat: 'NGUYEN_LIEU_TRUNG_GIAN', sub: 'tranvan', rarity: r, desc: `${nm} đã khắc — bán thành phẩm của Trận Pháp Sư.`, price_mode: 'recipe' });
  }
  // ---- Bản vẽ hiếm (đúc trang bị giai đoạn Tiên Cấp trở lên)
  for (let n = 6; n <= 10; n += 1) {
    const S = V.stage(n);
    mat(ID.bv(n), `Bản Vẽ Hiếm · ${S.name}`, 'THIEN_DIA_CHI_BAO', 'banve', Math.min(7, S.rar), S.base * 15, `Bản vẽ hiếm ${S.name} — mỗi lần chế một món trang bị ${S.name} tiêu 1 bản vẽ. Rơi ở mỏ đặc biệt, bí cảnh, Boss; đơn hàng nghề nghiệp.`, { can_trade: false });
  }
  // ---- Phế Đan (sản phẩm phụ khi luyện đan thất bại)
  def({ id: ID.phe, name: 'Phế Đan', cat: 'VAT_PHAM_KHAC', sub: 'phe', rarity: 1, desc: 'Cặn đan hỏng sau khi luyện thất bại. Bán lẻ được vài đồng hoặc cho Linh Thú ăn; KHÔNG dùng để luyện lại.', price_mode: 'fixed', base_value: 40 });
  // ---- Đan dược mới (có phẩm chất 1–5) + Đan phương thất truyền
  for (const p of V.pillSpecs()) def({ id: p.id, name: p.name, cat: 'DAN_DUOC', sub: 'dan', rarity: p.rar, desc: p.desc, quality: true, price_mode: 'recipe' });
  // ---- Trận pháp mới (có phẩm chất)
  for (const t of V.TRAN_SPECS) def({ id: t.id, name: t.name, cat: 'TRAN_PHAP', sub: 'tran', rarity: t.rar, desc: t.desc, quality: true, price_mode: 'recipe' });
  // ---- Cuộn công thức thất truyền (học 1 lần; tiêu hao khi học) — id tạo từ công thức ở craft_v20
  for (const p of V.pillSpecs().filter((x) => x.rare)) mat(ID.scroll(p.id), `Đan Phương Thất Truyền · ${p.name}`, 'THIEN_DIA_CHI_BAO', 'cuon', p.rar, V.stage(p.stage).base * 30, `Cuộn đan phương cổ: dùng ở Sổ Tay Đan Phương để HỌC công thức ${p.name} (tiêu hao 1 cuộn, học vĩnh viễn).`, { can_trade: false });
  for (const t of V.TRAN_SPECS) mat(ID.scroll(t.id), `Trận Đồ Thất Truyền · ${t.name}`, 'THIEN_DIA_CHI_BAO', 'cuon', t.rar, V.stage(t.stage).base * 30, `Cuộn trận đồ cổ: dùng ở Sổ Tay Trận Đồ để HỌC công thức ${t.name} (tiêu hao 1 cuộn, học vĩnh viễn).`, { can_trade: false });
}

module.exports = { install };
