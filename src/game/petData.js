'use strict';
/**
 * DỮ LIỆU LINH THÚ v14.0 — 45 loài · 9 phẩm cấp · 5 dòng Ngũ Hành.
 *
 * Mỗi loài có: id duy nhất, tên, phẩm cấp, hành, huyết mạch, thiên hướng chỉ số, THIÊN PHÚ riêng (fx),
 * bộ 3 kỹ năng riêng (chủ động 1 – mở cấp 1; bị động – mở cấp 15; chủ động 2 – mở cấp 40), mô tả, emoji.
 *
 * Tiến hóa: mỗi dòng (hành) đi từ phẩm 1 → 9.
 *   • Chính Hóa (main): cùng dòng, lên phẩm kế.
 *   • Dị Hóa (alt):    dùng Nguyên Tố Tinh Hoa của hành khác → nhảy sang dòng hành đó ở phẩm kế (4 nhánh).
 * Kiểu chiến đấu theo dòng: Kim = Sát Thủ, Mộc = Hồi Phục/Độc, Thủy = Khống Chế/Né, Hỏa = Thiêu Đốt/Bộc Phát, Thổ = Hộ Vệ.
 *
 * Số liệu nằm ở đây là HỆ SỐ THÔ; sức mạnh thật do petBalance.rating() quyết định.
 */
const PB = require('./petBalance');

// ---- hằng tạo kỹ năng (viết gọn) ----
const S = (n, t, p, x = {}) => ({ n, t, p, ...x });
const X = (n, p, x = {}) => S(n, 'dmg', p, { exec: 0.8, ...x });               // chiêu chém tàn: thêm sát thương lên mục tiêu ≤35% máu
const PS = (n, fx) => ({ n, fx });                                              // bị động
const TL = (n, fx, desc) => ({ n, fx, desc });                                  // thiên phú

const LINES = ['Kim', 'Mộc', 'Thủy', 'Hỏa', 'Thổ'];                              // line 0..4 = HANH
const LINE_TITLE = { Kim: 'Canh Kim', Mộc: 'Ất Mộc', Thủy: 'Quý Thủy', Hỏa: 'Bính Hỏa', Thổ: 'Mậu Thổ' };
const LINE_ROLE = { Kim: 'Sát Thủ', Mộc: 'Hồi Phục · Độc', Thủy: 'Khống Chế · Né Tránh', Hỏa: 'Thiêu Đốt · Bộc Phát', Thổ: 'Hộ Vệ · Phản Chấn' };
const LINE_BIAS = { Kim: { hp: 0.9, atk: 1.2, def: 0.85, spd: 1.1 }, Mộc: { hp: 1.1, atk: 0.9, def: 1.0, spd: 1.0 }, Thủy: { hp: 0.95, atk: 1.0, def: 1.0, spd: 1.15 }, Hỏa: { hp: 0.9, atk: 1.25, def: 0.8, spd: 1.05 }, Thổ: { hp: 1.3, atk: 0.75, def: 1.3, spd: 0.7 } };
const TIER_BLOOD = ['Phàm Huyết', 'Linh Huyết', 'Huyền Huyết', 'Địa Huyết', 'Thiên Huyết', 'Thánh Huyết', 'Tiên Huyết', 'Thần Huyết', 'Hỗn Độn Huyết'];

// [id, tên, mô tả, thiên phú, chủ động 1, bị động, chủ động 2, (tinh chỉnh bias)]
const RAW = {
  Kim: [
    ['kim_nha_thu', 'Kim Nha Thử', 'Chuột nhỏ nanh vàng, đánh nhanh thoắt ẩn thoắt hiện trong khe đá kim loại.',
      TL('Nanh Bén', { crit: 0.02 }, 'Nanh sắc hơn thép thường: tăng tỉ lệ bạo kích.'), S('Phệ Kim Nha', 'dmg', 1.0), PS('Răng Sắc', { crit: 0.01 }), S('Xuyên Giáp Cắn', 'dmg', 1.1, { pierce: true })],
    ['bach_ngan_lang', 'Bạch Ngân Lang', 'Sói lông bạc, săn mồi theo bầy; nhát cắn để lại vết thương rỉ máu.',
      TL('Bầy Sói', { assist: 0.15 }, 'Như có cả bầy cùng xông lên: trợ chiến mạnh hơn.'), S('Ngân Lang Trảo', 'dmg', 1.1, { then: S('Xuất Huyết', 'dot', 0.6, { d: 2, k: 'Xuất Huyết' }) }), PS('Bản Năng Săn Mồi', { execute: 0.06 }), S('Lang Hào', 'buff', 0, { v: 0.15, d: 2 })],
    ['kim_duc_ung', 'Kim Dực Ưng', 'Đại bàng cánh vàng, lao xuống từ trời cao nhanh hơn tia chớp.',
      TL('Thiên Nhãn', { crit: 0.02, pierce: 0.02 }, 'Nhìn thấu sơ hở: bạo kích và xuyên giáp.'), S('Liệt Phong Trảm', 'dmg', 1.2, { crit: 0.2 }), PS('Ưng Nhãn', { pierce: 0.03 }), X('Phi Thiên Lược', 1.2)],
    ['kim_cang_ngo_cong', 'Kim Cang Ngô Công', 'Rết khổng lồ vỏ kim cương, trăm chân cuồng loạn xé nát giáp trụ.',
      TL('Bách Túc', { assist: 0.2 }, 'Trăm chân cùng công kích: trợ chiến mạnh.'), S('Vạn Túc Cuồng Loạn', 'dmg', 1.3, { multi: 3 }), PS('Giáp Kim Cương', { dr: 0.03 }), S('Độc Nha Xuyên Giáp', 'dot', 0.9, { d: 3, k: 'Xuất Huyết', then: S('', 'weaken', 0, { v: 0.1, d: 2 }) })],
    ['thien_kiem_bang', 'Thiên Kiếm Bằng', 'Bằng điểu lông như kiếm, một cú vỗ cánh tung ra ngàn lưỡi kiếm khí.',
      TL('Kiếm Cốt', { pierce: 0.04, crit: 0.02 }, 'Thân là kiếm: xuyên giáp, bạo kích.'), S('Vạn Kiếm Quy Tông', 'dmg', 1.5, { multi: 2, pierce: true }), PS('Kiếm Ý', { critMult: 0.08 }), X('Trảm Thiên Nhất Kiếm', 1.5)],
    ['bach_ho_sat_than', 'Bạch Hổ Sát Thần', 'Thánh thú Tây Phương chủ sát phạt, tiếng gầm làm đối thủ run sợ.',
      TL('Binh Chủ', { opening: 0.15, crit: 0.02 }, 'Chủ sát phạt: mở màn hung hãn.'), S('Bạch Hổ Sát Âm', 'dmg', 1.5, { then: S('', 'stun', 0, { c: 0.25 }) }), PS('Sát Khí Nội Liễm', { crit: 0.03, critMult: 0.1 }), S('Tây Phương Canh Kim', 'buff', 0, { v: 0.25, d: 3 })],
    ['thai_bach_kiem_hac', 'Thái Bạch Tiên Kiếm Hạc', 'Tiên hạc ngậm kiếm quang, một đường kiếm phá vạn pháp.',
      TL('Thái Bạch', { crit: 0.03, execute: 0.1 }, 'Kim tinh giáng thế: chém tàn mục tiêu yếu máu.'), S('Tiên Quang Kiếm Vũ', 'dmg', 1.6, { pierce: true }), PS('Thanh Tịnh Kiếm Tâm', { lifesteal: 0.03, pierce: 0.03 }), X('Nhất Kiếm Phá Vạn Pháp', 1.7, { then: S('', 'cleanse', 0.4) })],
    ['kim_si_dai_bang', 'Kim Sí Đại Bằng Thần', 'Thần bằng cánh vàng che trời, vỗ cánh một cái là núi lở sông cạn.',
      TL('Thần Bằng', { crit: 0.04, critMult: 0.1 }, 'Thần lực của loài chim thần: bạo kích dữ dội.'), S('Cửu Thiên Bằng Dực', 'dmg', 1.8, { multi: 2 }), PS('Kim Sí Chấn Thiên', { assist: 0.3 }), X('Thiên Địa Nhất Kích', 2.0)],
    ['hon_don_thon_kim', 'Hỗn Độn Thôn Kim Thú', 'Hỗn Độn thú nuốt kim loại, nhai nát cả pháp bảo lẫn hộ thân linh quang.',
      TL('Thôn Phệ', { lifesteal: 0.04, pierce: 0.04 }, 'Nuốt chửng sinh lực và giáp kim.'), S('Thôn Kim Phệ Thiên', 'drain', 1.8), PS('Hỗn Độn Kim Thể', { pierce: 0.06, dr: 0.03 }), X('Hỗn Độn Tuyệt Sát', 2.2, { then: S('Xuất Huyết', 'dot', 0.8, { d: 3, k: 'Xuất Huyết' }) })],
  ],
  'Mộc': [
    ['thanh_diep_tho', 'Thanh Diệp Thố', 'Thỏ lông xanh như lá non, đi đến đâu cỏ cây nảy mầm đến đó.',
      TL('Linh Thảo Thể', { regen: 0.3 }, 'Thân thể tự hồi phục chậm rãi.'), S('Diệp Nhận', 'dmg', 0.9), PS('Sinh Sôi', { regen: 0.3 }), S('Thanh Diệp Dũ Thương', 'heal', 0.9)],
    ['thanh_long_sung', 'Thanh Long Sủng', 'Tiểu long thanh mộc, hơi thở mang độc tố và sinh khí song hành.',
      TL('Long Huyết', { dotAmp: 0.15 }, 'Độc tố mạnh hơn.'), S('Thanh Long Hô Hấp', 'dot', 0.9, { d: 3, k: 'Trúng Độc' }), PS('Mộc Khí Nuôi Dưỡng', { regen: 0.4 }), S('Long Khí Hồi Xuân', 'heal', 1.1)],
    ['co_moc_loc', 'Cổ Mộc Lộc', 'Hươu mang sừng cây cổ thụ, rễ ngầm quấn chân kẻ địch.',
      TL('Lộc Linh', { regen: 0.5, shieldAmp: 0.1 }, 'Sinh khí dồi dào.'), S('Cổ Mộc Phùng Xuân', 'heal', 1.2, { then: S('', 'cleanse', 0.3) }), PS('Sừng Cổ Thụ', { thorns: 0.06 }), S('Rễ Quấn', 'weaken', 0, { v: 0.18, d: 2, then: S('Độc Rễ', 'dot', 0.5, { d: 2, k: 'Trúng Độc' }) })],
    ['ngu_doc_tri_chu', 'Ngũ Độc Tri Chu', 'Nhện ngũ sắc, tơ độc tích lũy khiến vết thương mãi không lành.',
      TL('Bách Độc', { dotAmp: 0.2, proc: 0.03 }, 'Độc tố cộng dồn, hay phát động kỹ năng.'), S('Tơ Độc Quấn', 'dot', 1.0, { d: 4, k: 'Trúng Độc', then: S('', 'weaken', 0, { v: 0.1, d: 2 }) }), PS('Độc Tố Tích Lũy', { dotAmp: 0.2 }), S('Độc Huyết Phun', 'dmg', 1.2, { vsDot: 0.5 })],
    ['thanh_loan_moc_linh', 'Thanh Loan Mộc Linh', 'Thanh loan lông như lá ngọc, tiếng hót ru lành mọi vết thương.',
      TL('Sinh Mệnh Chi Vũ', { regen: 0.6, lifesteal: 0.02 }, 'Vũ điệu sinh mệnh.'), S('Hồi Xuân Vũ', 'heal', 1.4, { then: S('', 'buff', 0, { v: 0.1, d: 2 }) }), PS('Mộc Linh Hộ Thể', { dr: 0.03, regen: 0.4 }), S('Thanh Loan Nhất Khiếu', 'drain', 1.2)],
    ['cuu_diep_thanh_xa', 'Cửu Diệp Thánh Xà', 'Thánh xà chín lá, mỗi lần lột xác gột sạch mọi độc tố.',
      TL('Thoát Xác', { shieldAmp: 0.2, regen: 0.4 }, 'Lột xác tạo giáp bảo hộ.'), S('Cửu Diệp Phệ Độc', 'dot', 1.2, { d: 4, k: 'Trúng Độc', then: S('', 'heal', 0.5) }), PS('Thánh Độc Bất Xâm', { dr: 0.04, dotAmp: 0.2 }), S('Thánh Xà Thoát Xác', 'cleanse', 0.6, { then: S('', 'shield', 1.0) })],
    ['ban_dao_tien_hau', 'Bàn Đào Tiên Hầu', 'Tiên hầu canh vườn bàn đào, ban sinh khí bất tử và nổi giận thì gậy ảnh ngập trời.',
      TL('Bất Lão', { regen: 0.7, lifesteal: 0.03 }, 'Trường sinh bất lão.'), S('Bàn Đào Tiên Lộ', 'heal', 1.6, { then: S('', 'buff', 0, { v: 0.15, d: 2 }) }), PS('Trường Sinh', { regen: 0.8 }), S('Kim Cô Bổng Ảnh', 'dmg', 1.4, { then: S('', 'stun', 0, { c: 0.3 }) })],
    ['thanh_de_than_long', 'Thanh Đế Thần Long', 'Thần long Đông Phương chủ sinh trưởng, hơi thở khiến vạn vật hồi sinh.',
      TL('Thanh Đế Chi Huyết', { regen: 1.0, dotAmp: 0.2, lifesteal: 0.03 }, 'Huyết mạch Đông Phương.'), S('Vạn Mộc Hồi Xuân', 'heal', 1.9, { then: S('', 'cleanse', 0.5) }), PS('Đông Phương Sinh Khí', { regen: 1.0, dr: 0.04 }), S('Thanh Long Phệ Thế', 'drain', 1.8)],
    ['hon_don_the_gioi_thu', 'Hỗn Độn Thế Giới Thụ Linh', 'Linh thể của cây thế giới thuở hỗn độn, gốc rễ là nguồn sinh mệnh vô tận.',
      TL('Vạn Vật Sinh', { regen: 1.2, shieldAmp: 0.25 }, 'Sinh khí vô tận.'), S('Thế Giới Thụ Hộ', 'shield', 1.8, { then: S('', 'heal', 0.8) }), PS('Sinh Mệnh Căn Nguyên', { regen: 1.2, dr: 0.05 }), S('Hỗn Độn Hóa Sinh', 'drain', 2.0, { then: S('Độc Hóa', 'dot', 0.9, { d: 3, k: 'Trúng Độc' }) })],
  ],
  'Thủy': [
    ['thuy_linh_oa', 'Thủy Linh Oa', 'Ếch nhỏ trong suốt, da trơn khiến đòn đánh trượt đi.',
      TL('Da Ẩm', { dodge: 0.02 }, 'Da trơn: dễ né đòn.'), S('Thủy Tiễn', 'dmg', 0.9), PS('Trơn Trượt', { dodge: 0.015 }), S('Nước Mê', 'weaken', 0, { v: 0.12, d: 2 })],
    ['tuyet_ho_ly', 'Tuyết Hồ Ly', 'Hồ ly trắng như tuyết, mị hoặc lòng người, bước đi không để lại dấu.',
      TL('Mị Hoặc', { proc: 0.03, dodge: 0.02 }, 'Dễ phát động kỹ năng và né đòn.'), S('Hồ Mị', 'dmg', 0.9, { then: S('', 'weaken', 0, { v: 0.15, d: 2 }) }), PS('Tuyết Ảnh', { dodge: 0.03 }), S('Băng Sương Phách', 'dot', 0.8, { d: 3, k: 'Băng Phong' })],
    ['huyen_bang_giao', 'Huyền Băng Giao', 'Giao long băng giá, hơi thở đóng băng mặt hồ trong nháy mắt.',
      TL('Hàn Khí', { proc: 0.04, dr: 0.02 }, 'Hàn khí quanh thân.'), S('Băng Giao Trụy', 'dmg', 1.1, { then: S('', 'stun', 0, { c: 0.35 }) }), PS('Hàn Lân', { dr: 0.03 }), S('Huyền Băng Phong Tỏa', 'weaken', 0, { v: 0.25, d: 2, then: S('', 'shield', 0.6) })],
    ['tham_hai_ma_kinh', 'Thâm Hải Ma Kình', 'Cá voi ma thú dưới đáy biển sâu, tiếng ngâm chấn động tâm thần.',
      TL('Hải Uy', { assist: 0.2, dr: 0.03 }, 'Uy áp biển sâu.'), S('Kình Ngâm Chấn Hải', 'dmg', 1.0, { then: S('', 'stun', 0, { c: 0.45 }) }), PS('Thâm Hải Áp Lực', { dr: 0.04 }), S('Triều Dâng', 'dmg', 1.5)],
    ['van_han_bang_phuong', 'Vạn Hàn Băng Phượng', 'Băng phượng lông như lăng kính, sương giá che kín bầu trời.',
      TL('Băng Tâm', { dodge: 0.03, proc: 0.04 }, 'Tâm như băng: né tránh, hay ra chiêu.'), S('Hàn Phượng Khiếu', 'dmg', 1.2, { then: S('', 'weaken', 0, { v: 0.3, d: 2 }) }), PS('Băng Vũ Lăng', { dodge: 0.04 }), S('Tuyệt Đối Linh Độ', 'dmg', 1.2, { then: S('', 'stun', 0, { c: 0.5 }) })],
    ['huyen_minh_thanh_kinh', 'Huyền Minh Thánh Kình', 'Thánh kình Bắc Minh, thân khổng lồ che lấp vạn dặm biển khơi.',
      TL('Bắc Minh', { dr: 0.04, shieldAmp: 0.15 }, 'Thân khổng lồ bất động.'), S('Huyền Minh Trấn Hải', 'shield', 1.4, { then: S('', 'weaken', 0, { v: 0.15, d: 2 }) }), PS('Thánh Kình Bì', { dr: 0.05 }), S('Nghịch Hải Triều', 'dmg', 1.6, { then: S('', 'stun', 0, { c: 0.3 }) })],
    ['nhuoc_thuy_tien_ngu', 'Nhược Thủy Tiên Ngư', 'Tiên ngư sống trong Nhược Thủy, lông vũ cũng không nổi — đòn đánh xuyên qua như xuyên khói.',
      TL('Nhược Thủy', { dodge: 0.05, proc: 0.04 }, 'Hư ảo khó chạm.'), S('Nhược Thủy Hư Ảnh', 'evade', 0, { v: 0.18, d: 2, then: S('', 'heal', 0.6) }), PS('Lục Bình Phiêu', { dodge: 0.05 }), S('Tiên Ngư Hóa Long Vũ', 'drain', 1.5)],
    ['dong_hai_long_vuong', 'Đông Hải Long Vương Thần', 'Thần thú cai quản Đông Hải, triều cường vạn tộc cúi đầu.',
      TL('Long Vương Uy', { proc: 0.06, dr: 0.04 }, 'Uy áp thủy tộc.'), S('Long Vương Nộ Triều', 'dmg', 1.8, { then: S('', 'stun', 0, { c: 0.35 }) }), PS('Thủy Tộc Triều Bái', { assist: 0.3, dr: 0.04 }), S('Vạn Thủy Quy Nhất', 'weaken', 0, { v: 0.35, d: 3, then: S('', 'shield', 1.0) })],
    ['hon_don_hu_thuy', 'Hỗn Độn Hư Thủy Thú', 'Dòng nước hư vô thuở sơ khai hóa thành thú, thực hư bất định.',
      TL('Hư Thủy', { dodge: 0.06, proc: 0.06 }, 'Hư vô khó nắm bắt.'), S('Hư Thủy Thôn Thiên', 'dmg', 1.6, { then: S('', 'stun', 0, { c: 0.6 }) }), PS('Hư Vô Bất Thực', { dodge: 0.07, dr: 0.03 }), S('Hỗn Độn Thủy Tịch', 'weaken', 0, { v: 0.4, d: 3, then: S('Hư Thực', 'dot', 0.8, { d: 3, k: 'Băng Phong' }) })],
  ],
  'Hỏa': [
    ['xich_diem_tuoc', 'Xích Diễm Tước', 'Sẻ lửa nhỏ nhắn, cánh chim rơi ra tàn lửa đỏ.',
      TL('Hỏa Vũ', { dotAmp: 0.1 }, 'Lửa cháy lâu hơn.'), S('Hỏa Tinh', 'dot', 0.8, { d: 2, k: 'Thiêu Đốt' }), PS('Lửa Bén', { dotAmp: 0.1 }), S('Diễm Vũ', 'dmg', 1.0)],
    ['hoa_van_bao', 'Hỏa Vân Báo', 'Báo lông đỏ như mây lửa, lao đi để lại vệt cháy dài.',
      TL('Hỏa Tính', { crit: 0.02, opening: 0.1 }, 'Tính nóng: mở màn mạnh, hay bạo kích.'), S('Vân Báo Phi Trảo', 'dmg', 1.2, { then: S('', 'dot', 0.5, { d: 2, k: 'Thiêu Đốt' }) }), PS('Liệt Hỏa Thân', { crit: 0.02 }), S('Hỏa Vân Nộ', 'buff', 0, { v: 0.2, d: 2 })],
    ['xich_viem_su', 'Xích Viêm Sư', 'Sư tử bờm lửa, tiếng hống thiêu rụi cả cánh đồng.',
      TL('Sư Vương', { assist: 0.15, dotAmp: 0.1 }, 'Vương giả: trợ chiến mạnh, lửa dai.'), S('Sư Hống Liệt Diễm', 'dot', 1.0, { d: 3, k: 'Thiêu Đốt', then: S('', 'dmg', 0.6) }), PS('Viêm Chi Tâm', { dotAmp: 0.15 }), S('Thiêu Thiên Trảo', 'dmg', 1.5)],
    ['dung_nham_ma_nguu', 'Dung Nham Ma Ngưu', 'Ma ngưu nham thạch nóng chảy, mỗi bước chân để lại hố dung nham.',
      TL('Nham Thể', { thorns: 0.1, dotAmp: 0.15 }, 'Thân nóng bỏng phản thương kẻ chạm vào.'), S('Dung Nham Phún Trào', 'dot', 1.2, { d: 3, k: 'Thiêu Đốt' }), PS('Nham Giáp', { dr: 0.03, thorns: 0.08 }), S('Ngưu Trùng Liệt Địa', 'dmg', 1.6, { then: S('', 'stun', 0, { c: 0.3 }) })],
    ['liet_diem_hoa_phuong', 'Liệt Diễm Hỏa Phượng', 'Hỏa phượng liệt diễm, cánh vẫy sinh ra mưa lửa.',
      TL('Phượng Huyết', { dotAmp: 0.2, regen: 0.3 }, 'Lửa dai và tự hồi phục.'), S('Phượng Vũ Cửu Thiên', 'dot', 1.4, { d: 3, k: 'Thiêu Đốt', then: S('', 'buff', 0, { v: 0.12, d: 2 }) }), PS('Hỏa Phượng Tâm', { lifesteal: 0.03, dotAmp: 0.2 }), S('Niết Hỏa Trùng Sinh', 'heal', 1.2, { then: S('', 'dmg', 0.8) })],
    ['chu_tuoc_thanh_thu', 'Chu Tước Thánh Thú', 'Thánh thú Nam Phương, ngọn lửa ly hỏa thiêu đốt cả linh hồn.',
      TL('Nam Phương Thánh Hỏa', { opening: 0.2, dotAmp: 0.2 }, 'Mở màn bằng thánh hỏa.'), S('Nam Minh Ly Hỏa', 'dot', 1.6, { d: 4, k: 'Thiêu Đốt' }), PS('Chu Tước Thần Hỏa', { dotAmp: 0.25, crit: 0.02 }), S('Chu Tước Phần Thiên', 'dmg', 1.8, { vsDot: 0.4 })],
    ['kim_o_tien_thu', 'Kim Ô Tiên Thú', 'Tam túc kim ô mang theo thái dương chân hỏa, nhìn thẳng sẽ mù mắt.',
      TL('Nhật Luân', { crit: 0.03, dotAmp: 0.25 }, 'Thái dương chiếu rọi.'), S('Kim Ô Thái Dương Hỏa', 'dot', 1.8, { d: 3, k: 'Thiêu Đốt', then: S('', 'weaken', 0, { v: 0.15, d: 2 }) }), PS('Thái Dương Chân Hỏa', { pierce: 0.05, dotAmp: 0.25 }), S('Kim Ô Trụy Nhật', 'dmg', 2.0, { vsDot: 0.5 })],
    ['chuc_dung_hoa_than', 'Chúc Dung Hỏa Thần Thú', 'Thần thú của Hỏa Thần Chúc Dung, ngọn lửa không dập tắt nổi.',
      TL('Hỏa Thần', { dotAmp: 0.3, crit: 0.03 }, 'Lửa thần bất diệt.'), S('Chúc Dung Liệt Thế', 'dot', 2.0, { d: 4, k: 'Thiêu Đốt' }), PS('Hỏa Thần Chi Tâm', { assist: 0.3, dotAmp: 0.3 }), X('Hỏa Thần Phán Quyết', 2.0, { then: S('', 'dot', 0.8, { d: 2, k: 'Thiêu Đốt' }) })],
    ['hon_don_thieu_the', 'Hỗn Độn Thiêu Thế Viêm', 'Ngọn lửa hỗn độn sơ khai thành thú, đốt cả quy tắc của trời đất.',
      TL('Thiêu Thế', { dotAmp: 0.4, opening: 0.2 }, 'Lửa diệt thế.'), S('Hỗn Độn Thiêu Thế', 'dot', 2.2, { d: 4, k: 'Thiêu Đốt', then: S('', 'dmg', 1.0) }), PS('Diệt Thế Chi Hỏa', { dotAmp: 0.4, pierce: 0.06 }), S('Viêm Diệt Vạn Pháp', 'dmg', 2.4, { vsDot: 0.7 })],
  ],
  'Thổ': [
    ['hoang_ne_xuyen_son', 'Hoàng Nê Xuyên Sơn', 'Tê tê vảy bùn vàng, cuộn tròn là một khối đá cứng.',
      TL('Giáp Dày', { guard: 0.6 }, 'Mở màn có lớp giáp bảo vệ.'), S('Cuốn Cầu', 'shield', 0.9), PS('Giáp Bùn', { dr: 0.015 }), S('Nê Chùy', 'dmg', 0.9)],
    ['huyen_vu_quy', 'Huyền Vũ Quy', 'Rùa đen mai kiên cố, sống lâu vạn tuổi, phòng thủ vô song.',
      TL('Quy Tức', { guard: 0.8, regen: 0.2 }, 'Mai rùa bảo hộ.'), S('Quy Giáp Phòng Hộ', 'shield', 1.1), PS('Huyền Vũ Thủ', { dr: 0.03 }), S('Phản Chấn', 'thorn', 0, { v: 0.4, d: 2 })],
    ['hoang_nham_te', 'Hoàng Nham Tê', 'Tê giác nham thạch, một cú húc nghiền nát đá tảng.',
      TL('Nham Cốt', { guard: 1.0, dr: 0.02 }, 'Cốt cứng như nham thạch.'), S('Nham Giáp Trùng', 'dmg', 1.2, { then: S('', 'stun', 0, { c: 0.25 }) }), PS('Tê Bì', { dr: 0.03, thorns: 0.06 }), S('Địa Thuẫn', 'shield', 1.3)],
    ['dia_mach_cu_tuong', 'Địa Mạch Cự Tượng', 'Voi khổng lồ hút khí địa mạch, mỗi bước chân đất trời rung chuyển.',
      TL('Cự Lực', { assist: 0.15, guard: 1.0 }, 'Sức mạnh thô bạo kèm giáp hộ thể.'), S('Cự Tượng Dậm Chân', 'dmg', 1.1, { then: S('', 'stun', 0, { c: 0.4 }) }), PS('Địa Mạch Hộ Thể', { dr: 0.04 }), S('Mạch Địa Hồi Nguyên', 'shield', 1.5, { then: S('', 'heal', 0.6) })],
    ['thai_son_cu_hung', 'Thái Sơn Cự Hùng', 'Gấu khổng lồ cao như núi, đứng yên là một bức tường.',
      TL('Bất Động', { dr: 0.04, thorns: 0.08 }, 'Bất động như núi, phản thương.'), S('Thái Sơn Áp Đỉnh', 'dmg', 1.5, { then: S('', 'weaken', 0, { v: 0.2, d: 2 }) }), PS('Thái Sơn Bất Động', { dr: 0.05 }), S('Hùng Hống', 'thorn', 0, { v: 0.5, d: 3, then: S('', 'shield', 0.8) })],
    ['trung_uong_hoang_long', 'Trung Ương Hoàng Long', 'Thánh long Trung Ương chủ Thổ, long khí địa mạch hộ thể.',
      TL('Trung Ương Mậu Kỷ', { guard: 1.2, dr: 0.04 }, 'Long khí địa mạch hộ thể.'), S('Hoàng Long Hộ Thể', 'shield', 1.8), PS('Địa Mạch Long Khí', { dr: 0.05, shieldAmp: 0.2 }), S('Long Uy Trấn Thiên', 'dmg', 1.3, { then: S('', 'stun', 0, { c: 0.5 }) })],
    ['tuc_nhuong_tien_thu', 'Tức Nhưỡng Tiên Thú', 'Tiên thú hóa thân từ Tức Nhưỡng — đất tự sinh trưởng không bao giờ cạn.',
      TL('Tức Nhưỡng', { shieldAmp: 0.25, regen: 0.5 }, 'Đất tự sinh bất tận.'), S('Tức Nhưỡng Sinh Trưởng', 'shield', 2.0, { then: S('', 'heal', 0.7) }), PS('Tự Sinh Bất Tận', { regen: 0.6, dr: 0.04 }), S('Nhưỡng Địa Phản Kích', 'thorn', 0, { v: 0.7, d: 3, then: S('', 'dmg', 1.0) })],
    ['hau_tho_than_thu', 'Hậu Thổ Thần Thú', 'Thần thú của Hậu Thổ nương nương, mang trong mình sức nặng của đại địa.',
      TL('Hậu Thổ', { dr: 0.06, shieldAmp: 0.3 }, 'Đại địa chi mẫu.'), S('Hậu Thổ Hoàng Hạp', 'shield', 2.3, { then: S('', 'cleanse', 0.4) }), PS('Đại Địa Chi Mẫu', { dr: 0.06, regen: 0.6 }), S('Địa Mẫu Chấn', 'dmg', 1.8, { then: S('', 'stun', 0, { c: 0.4 }) })],
    ['hon_don_thon_dia', 'Hỗn Độn Thôn Địa Thú', 'Hỗn Độn thú nuốt đất trời, không gì làm nó lay chuyển.',
      TL('Bất Hủ', { dr: 0.07, guard: 1.5 }, 'Bất hủ bất diệt.'), S('Thôn Địa Phong Ấn', 'shield', 2.6, { then: S('', 'weaken', 0, { v: 0.2, d: 2 }) }), PS('Hỗn Độn Bất Hủ', { dr: 0.08, thorns: 0.12 }), S('Hỗn Độn Địa Chấn', 'drain', 2.0, { then: S('', 'stun', 0, { c: 0.4 }) })],
  ],
};

// ---- dựng bảng loài ----
const SPECIES = {};            // id → species
const ORDER = [];              // id theo (phẩm, dòng)
const BY_TIER = Array.from({ length: 9 }, () => []);
const BY_LINE = { Kim: [], Mộc: [], Thủy: [], Hỏa: [], Thổ: [] };
LINES.forEach((hanh, li) => {
  RAW[hanh].forEach((r, ti) => {
    const [id, name, desc, thienphu, a1, p1, a2] = r;
    const tier = ti + 1;
    const lb = LINE_BIAS[hanh];
    const wob = ((id.length * 7 + tier * 3) % 5) / 100;                      // lệch nhỏ để mỗi loài một chút khác nhau
    const sp = {
      id, name, tier, hanh, line: li, desc,
      bloodline: `${LINE_TITLE[hanh]} · ${TIER_BLOOD[ti]}`, role: LINE_ROLE[hanh],
      bias: { hp: +(lb.hp + (hanh === 'Thổ' ? wob : -wob / 2)).toFixed(2), atk: +(lb.atk + (hanh === 'Kim' || hanh === 'Hỏa' ? wob : 0)).toFixed(2), def: lb.def, spd: lb.spd },
      thienphu, skills: { a1, p1, a2 }, emoji: `pet_${id}`,
    };
    SPECIES[id] = sp; ORDER.push(id); BY_TIER[ti].push(id); BY_LINE[hanh].push(id);
  });
});
ORDER.sort((a, b) => (SPECIES[a].tier - SPECIES[b].tier) || (SPECIES[a].line - SPECIES[b].line));
for (let t = 0; t < 9; t += 1) BY_TIER[t].sort((a, b) => SPECIES[a].line - SPECIES[b].line);

const speciesOf = (id) => SPECIES[id] || null;
/** Tiến hóa Chính Hóa: cùng dòng, phẩm kế. */
const evoMain = (id) => { const s = SPECIES[id]; return s && s.tier < 9 ? BY_LINE[s.hanh][s.tier] : null; };
/** Dị Hóa: dùng Nguyên Tố Tinh Hoa của hành `hanh` (≠ hành hiện tại) → dòng đó ở phẩm kế. */
const evoAlt = (id, hanh) => { const s = SPECIES[id]; if (!s || s.tier >= 9 || hanh === s.hanh || !BY_LINE[hanh]) return null; return BY_LINE[hanh][s.tier]; };
const evoOptions = (id) => {
  const s = SPECIES[id]; if (!s || s.tier >= 9) return [];
  const out = [{ kind: 'main', to: evoMain(id), hanh: s.hanh }];
  for (const h of PB.HANH) if (h !== s.hanh) out.push({ kind: 'alt', to: evoAlt(id, h), hanh: h });
  return out;
};

// ---- mô tả văn bản (UI) ----
const FXNAME = { crit: 'Bạo kích', critMult: 'Sát thương bạo kích', dodge: 'Né tránh', pierce: 'Xuyên giáp', lifesteal: 'Hút máu', dr: 'Giảm sát thương nhận', thorns: 'Phản thương', regen: 'Hồi sinh lực/hiệp', opening: 'Sát thương hiệp mở màn', execute: 'Sát thương lên mục tiêu ≤35% máu', assist: 'Sát thương trợ chiến', dotAmp: 'Sát thương theo thời gian', shieldAmp: 'Lượng khiên', proc: 'Tỉ lệ phát động kỹ năng', guard: 'Giáp mở màn' };
const fxText = (fx) => Object.entries(fx || {}).map(([k, v]) => {
  if (k === 'regen') return `${FXNAME[k]} +${(v * 1).toFixed(1)}%`;
  if (k === 'guard') return `${FXNAME[k]} ×${v}`;
  return `${FXNAME[k] || k} +${Math.round(v * 100)}%`;
}).join(', ');
const TYPE_LABEL = { dmg: 'Sát thương', dot: 'Sát thương theo thời gian', shield: 'Tạo khiên', heal: 'Hồi sinh lực', stun: 'Choáng', weaken: 'Suy yếu', buff: 'Cường hóa', drain: 'Hút sinh lực', cleanse: 'Thanh tẩy', thorn: 'Phản chấn', evade: 'Né tránh' };
function oneText(s) {
  const p = (s.p || 0).toFixed(1);
  switch (s.t) {
    case 'dmg': return `gây sát thương ×${p}${s.multi ? ` (${s.multi} đòn)` : ''}${s.pierce ? ', xuyên khiên' : ''}${s.exec ? `, +${Math.round(s.exec * 100)}% lên mục tiêu ≤35% máu` : ''}${s.vsDot ? `, +${Math.round(s.vsDot * 100)}% nếu mục tiêu đang chịu hiệu ứng` : ''}${s.crit ? `, +${Math.round(s.crit * 100)}% bạo kích` : ''}`;
    case 'dot': return `gây **${s.k || 'Thiêu Đốt'}** ×${p} trong ${s.d} hiệp`;
    case 'shield': return `tạo khiên ×${p}`;
    case 'heal': return `hồi sinh lực ×${p}`;
    case 'stun': return `${Math.round((s.c || 0) * 100)}% làm đối thủ choáng (mất lượt ra đòn)`;
    case 'weaken': return `giảm ${Math.round((s.v || 0) * 100)}% sát thương đối thủ trong ${s.d} hiệp`;
    case 'buff': return `tăng ${Math.round((s.v || 0) * 100)}% sát thương của bạn trong ${s.d} hiệp`;
    case 'drain': return `gây sát thương ×${p} và hút 50% thành sinh lực`;
    case 'cleanse': return 'xóa hiệu ứng xấu trên bạn';
    case 'thorn': return `phản ${Math.round((s.v || 0) * 100)}% sát thương nhận trong ${s.d} hiệp`;
    case 'evade': return `+${Math.round((s.v || 0) * 100)}% né tránh trong ${s.d} hiệp`;
    default: return '';
  }
}
function skillText(s) { const parts = [oneText(s)]; if (s.then) parts.push(oneText(s.then)); return parts.filter(Boolean).join(' → '); }

/** Danh sách kỹ năng đầy đủ của 1 loài: key → {key, kind:'active'|'passive', name, text, unlock}. */
function skillList(sp) {
  const U = PB.SKILL_UNLOCK;
  return [
    { key: 'a1', kind: 'active', name: sp.skills.a1.n, text: skillText(sp.skills.a1), unlock: U.a1, def: sp.skills.a1 },
    { key: 'p1', kind: 'passive', name: sp.skills.p1.n, text: fxText(sp.skills.p1.fx), unlock: U.p1, def: sp.skills.p1 },
    { key: 'a2', kind: 'active', name: sp.skills.a2.n, text: skillText(sp.skills.a2), unlock: U.a2, def: sp.skills.a2 },
  ];
}
/** Tra kỹ năng theo (loài nguồn, khóa) — dùng cho Truyền Thừa: "speciesId:key". */
function skillRef(ref) {
  const [sid, key] = String(ref || '').split(':'); const sp = SPECIES[sid];
  if (!sp || !sp.skills[key]) return null;
  return { ref, species: sp, key, def: sp.skills[key], kind: key[0] === 'p' ? 'passive' : 'active' };
}

if (ORDER.length !== 45) throw new Error(`petData: cần đúng 45 loài, đang có ${ORDER.length}`);

module.exports = { SPECIES, ORDER, BY_TIER, BY_LINE, LINES, LINE_TITLE, LINE_ROLE, TIER_BLOOD, speciesOf, evoMain, evoAlt, evoOptions, fxText, skillText, skillList, skillRef, FXNAME, TYPE_LABEL };
