# BÁO CÁO V20.0 — Đại Hoàn Thiện Nghề Nghiệp · Đồng Bộ Kinh Tế · Khai Mở Tiên Đạo

> Nguyên tắc: **chỉ THÊM**. ID, công thức, công dụng, giá của vật phẩm V17–V19 giữ nguyên. Ba khái niệm tách riêng: **hạng nguyên liệu (1–7)**, **phẩm chất thành phẩm (1–5)**, **giai đoạn sản xuất (1–10)**.
> ⚠️ Chưa chạy trên Discord thật — chỉ kiểm bằng discord.js giả lập chặt + SQLite thật.

## 1. Tính năng đã làm
**10 giai đoạn sản xuất** (khoá theo cảnh giới, cấp nghề tối đa 9 ở giai đoạn 9–10): Phàm · Huyền · Địa · Thiên · Tiên · Chân Tiên · Kim Tiên · Tiên Vương/Tôn · Tiên Đế · Siêu Thoát (bảng ở mục 7-D). Công thức V17 được gán giai đoạn (`stage`) mà không đổi gì khác.

| Hệ thống | Nội dung |
|---|---|
| **Đan Sư** | 71 đan dược mới theo loại: Hồi phục · Tu luyện · Đột phá · Bảo vệ tâm thần · Tăng thuộc tính · Bản nguyên · Hỗ trợ độ kiếp · Đan Tiên Giới (giai đoạn 6) · Đan Đế Cảnh (7) · Đan Siêu Thoát (10) · Thất truyền (giai đoạn 5–10), có phẩm chất 1–5; Dược Dịch Thần/Đế/Siêu Thoát. 14 đan/trận **thất truyền** chỉ chế được sau khi **học bằng cuộn** (1 lần, vĩnh viễn). **Phế Đan** khi thất bại (bán lẻ, không dùng chế lại). **Dấu ấn đan** (Đan Văn/Hương/Linh/Dị Biến) cho đan phẩm ≥3: tăng hiệu lực khi dùng, lưu riêng (không đổi phẩm chất). |
| **Dị Hỏa** | 10 ngọn theo 10 giai đoạn. Thu phục bằng **Hỏa Chủng** (hiếm, không bán/giao dịch). EXP khi chế đan; cấp 1–10, kĩ năng cấp 3/6/9; **Tiến Hoá** ×3 (tốn Linh Thạch). Chỉ áp cho **đan** giai đoạn ≤ ngọn lửa. |
| **Luyện Khí Sư** | 10 Kim loại tinh luyện + 10 Phôi khí (bán thành phẩm), 35 trang bị mới `gx20_*` (giai đoạn 6–10, 7 ô × 5 bậc), Bản Vẽ Hiếm giai đoạn 6–10, 8 công thức đúc thay thế dùng phôi V20. |
| **Trận Pháp Sư** | 5 Trận Văn mới (Tiên/Thần/Đế/Thiên Đạo/Siêu Thoát) + 8 trận pháp mới (có phẩm chất, thất truyền). |
| **Linh Thực Sư** | 20 Linh Chủng V20 (10 giai đoạn × 2) cần **cấp Linh Điền** (`fieldLv`) + cấp nghề; giai đoạn thu hoạch ghi vào nghề. Giá hạt giống nâng để **trồng không có lời** ở giá NPC. |
| **Khai Thác** | 12 khu (6 mỏ + 6 thu thập), chạy theo giờ thật, tối đa 2 lượt đồng thời, lượt/ngày theo khu, cảnh giới tối thiểu, phí (vài khu), nhận thưởng bằng UPDATE có điều kiện (không nhân đôi). |
| **Đơn Hàng** | 3 đơn/ngày sinh ổn định theo (người chơi, ngày): chế N / khai thác N / thu hoạch N / giao nguyên liệu. Thưởng Linh Thạch + EXP nghề; mỗi đơn nhận 1 lần. |
| **Sổ Tay** | 7 trang: Nguyên Liệu · Đan Phương · Bản Vẽ · Trận Đồ · Linh Thực · Cuộn Thất Truyền (học) · Danh Hiệu & Thành Tựu. Nguồn/công dụng đọc **trực tiếp** từ catalog17 nên luôn khớp. |
| **Đồng bộ nguồn rơi** | Boss sự kiện (`v20_event`), Bí Cảnh Tiên Giới giai đoạn ≥6 từ tầng 3 (`v20_bc19_s6..10`), Mỏ/Thu thập (`kt20_*`) — đều qua bảng rơi `drops17` (có trần ngày/tuần theo vật phẩm + trần hạng 5/6/7 toàn cục). |
| **Danh hiệu** | 12 danh hiệu theo bộ đếm trọn đời (chỉ danh hiệu — không cộng chỉ số). |
| **V20.3 — Trang bị** | **Khảm** Yêu Hạch (1 ô với bậc ≤5, 2 ô với bậc ≥6) cộng chỉ số cố định theo giai đoạn hạch; **Thức Tỉnh** (bậc ≥6, tinh luyện ≥3, tối đa 3 lần, tỉ lệ 70/50/30%) +5% toàn bộ chỉ số mỗi lần. Sửa chữa/cường hoá/tinh luyện vẫn do hệ V17 (đã áp dụng cho trang bị V20, có độ bền). |
| **V20.3 — Trận** | Nâng Phẩm (3 trận bàn cùng loại+phẩm → 1 phẩm +1), Thu Hồi (hoàn 50% phí duy trì theo thời gian còn lại), Gia Cố (còn <50% thời gian: trả 60% phí kéo về đủ, 1 lần/ngày/trận, không áp cho trận giới hạn lượt). |
| **V20.3 — Linh Điền** | **Linh Thổ** cấp 0–5 (+0,04 cây/lần thu hoạch mỗi cấp), **Ghép Giống** (4 hạt (a) → 1 hạt (b)), **Lai Tạo** (25% +2%/cấp Linh Thực Sư, tối đa 50%, ra hạt giai đoạn kế; thất bại mất hết). Kiểm bằng test: ở Linh Thổ tối đa trồng vẫn không có lời, ghép/lai luôn lỗ hơn mua. |
| **V20.3 — Đan** | **Tuyệt Phẩm**: thành phẩm đặc biệt (1,5% với đan phẩm 5, +30% hiệu lực). Dấu ấn đan được dọn ngay mỗi khi lấy đan ra khỏi kho (bán/dùng/giao dịch). |
| **Giao diện** | 7 tab mới trong bảng `/nghenghiep`: ⛏️ Khai Thác · 🔥 Dị Hỏa Đan Sư · 📋 Đơn Hàng · 📒 Sổ Tay · 💎 Khảm & Thức Tỉnh · 🔯 Trận (Nâng/Thu/Gia Cố) · 🟫 Linh Điền Mở Rộng. 26 emoji pixel mới (`n20_*`). GIF túi trữ vật ở `/khodo`, GIF sách ở Công Pháp (ảnh nhỏ của embed). |

## 2. Kiến trúc (file mới / sửa)
- Dữ liệu thuần: `src/data/v20_data.js`, `items_v20.js`, `craft_v20.js` (cắm vào `craft_v17`/`items_v17` qua `install()`, **không tạo danh mục thứ hai**).
- Logic: `src/game/{learn20,marks20,dihoa20,khaithac20,donhang20,so20,hooks20,migrateV20}.js`. `hooks20.js` là **điểm móc duy nhất** vào craft17/field17 và bọc try/catch — lỗi V20 không làm mất thành phẩm V17.
- Giao diện: `src/ui/nghe20Views.js`, `src/ui/gif20.js`; nút tĩnh `ng|uid|act|…` (sống qua khởi động lại).
- Sửa nhỏ ở: `craft17` (học công thức, Dị Hỏa vào `calc`, hook sau nhận), `dan17` (dấu ấn), `field17` (cấp ruộng, thu hoạch), `bicanh19`, `event19` (nguồn rơi), `gear17` (phôi 6–10), `catalog17` (nguồn/công dụng/nhãn), `ngheViews` (4 tab), `kho.js`/`menus.js`/`congphapViews.js` (GIF), `bot.js` (migration).

## 3. Migration V20 (`src/game/migrateV20.js`)
Thuần cộng thêm: 7 bảng `v20_learned, v20_marks, v20_dihoa, v20_gather, v20_orders, v20_titles, v20_stats` (`CREATE IF NOT EXISTS`). Quy trình: sao lưu `db_backups/tutien_PRE_V20_<giờ>.db` (VACUUM INTO) + mở lại kiểm tra đủ số người → tạo bảng → **đối chiếu băm** cultivators / inv_items / prof_state / inv_log / inv_lock / inv_daily trước-sau → đặt cờ `v20_migrated` (chạy 1 lần). Sao lưu hỏng ⇒ không đặt cờ, bot vẫn chạy (an toàn vì chỉ thêm bảng). `rollback()` xoá dữ liệu 7 bảng v20 + gỡ cờ, không đụng dữ liệu cũ. Muốn dọn hẳn vật phẩm V20 đã nhận: `/restoredb` từ bản PRE_V20.

## 4. Kiểm thử
- `scripts/test_v20.js`: **1201 kiểm tra đạt** — dữ liệu 10 giai đoạn / ID không trùng / emoji mọi vật phẩm; học công thức (cuộn chỉ tiêu 1 lần); chế thật + hook; Phế Đan; dấu ấn (chặn ≤ số viên, tiêu khi dùng); Dị Hỏa (điều kiện, tự kích hoạt, đổi chính, EXP, tiến hoá, giới hạn); Khai Thác (cảnh giới, 2 lượt, không nhận 2 lần, giới hạn ngày, trần hạng 7); Đơn Hàng (ổn định, nhận 1 lần, giao đồ); Linh Điền theo cấp ruộng; danh hiệu; migration (sao lưu hỏng→huỷ, chạy lặp, rollback, chạy lại); mọi màn hình ở giới hạn Discord (≤25 lựa chọn, ≤5 hàng, embed ≤6000, custom_id ≤100); mọi hành động nút; GIF; (V20.3) khảm/thức tỉnh/hỏng đồ, trận nâng-thu-gia cố, Linh Thổ + kinh tế, ghép/lai, Tuyệt Phẩm, dọn dấu ấn, giao dịch nguyên liệu V20.
- Test cũ: giữ nguyên toàn bộ; chỉnh 3 test cho đúng dữ liệu mới (tổng emoji 570; người thử kinh tế cần cảnh giới/học công thức theo công thức; mặc đủ trang bị cần cảnh giới cao). Test kinh tế cũ **bắt được 1 lỗi thật** của V20 (trồng Linh Chủng có lời) → đã sửa giá.
- `catalog17.validate()` = 0 lỗi (mọi vật phẩm có nguồn + công dụng, không có công thức lãi).
- **Không** có test trên Discord thật; GIF làm ảnh nhỏ embed chưa xem trên app thật (Discord có thể hiện đứng hình ở một số nơi).

## 5. Chưa làm / hạn chế (nói thẳng)
- **Đã làm ở V20.3 (trước đây liệt kê là chưa làm):** khảm, thức tỉnh, nâng/thu hồi/gia cố Trận, Linh Thổ, ghép giống, lai tạo, thành phẩm đặc biệt (Tuyệt Phẩm), dọn dấu ấn khi bán. **Sửa trang bị** và **giao dịch vật phẩm giữa người chơi** đã có sẵn từ V17 và dùng được cho vật phẩm V20 (có test).
- **Vẫn chưa làm:** Gia Cố không áp cho trận có giới hạn lượt; không có "sửa" riêng cho Trận (không có cơ chế hỏng trận); khảm không có Yêu Hạch phân loại theo thuộc tính (chỉ số theo giai đoạn của hạch); trận pháp mới chưa có hiệu ứng riêng ngoài khung trận V17; thành tựu riêng cho giai đoạn 6–10 ngoài các mốc có sẵn.
- Thức tỉnh nhân toàn bộ chỉ số của món (gồm cả thuộc tính phụ), không riêng chỉ số chính.
- Dấu ấn đan lưu theo (đan, phẩm) chứ không gắn từng viên: bị chặn ≤ số viên đang có và dọn mỗi lần lấy đan ra, nhưng không biết viên nào mang dấu ấn nào.
- Bảng rơi/giá/thời gian/xác suất là số **ước lượng cân bằng bằng test kinh tế**, chưa có dữ liệu người chơi thật — cần chỉnh sau vài ngày chạy.
- Chưa thử trên Discord thật.

## 6. Cách dùng nhanh
`/nghenghiep` → chọn mục **Khai Thác / Dị Hỏa Đan Sư / Đơn Hàng / Sổ Tay** ở menu trên cùng. Học công thức thất truyền: Sổ Tay → *Cuộn Thất Truyền* → chọn cuộn.

## 7. Danh sách đầy đủ
### A. Vật phẩm mới (209)

| ID | Tên | Danh mục | Hạng |
|---|---|---|---|
| `v20_ld_1a` | Phàm Căn Thảo | LINH_DUOC | 1 |
| `v20_ch_1a` | Phàm Chủng · Phàm Căn Thảo | LINH_THUC | 1 |
| `v20_ld_1b` | Sương Mai Hoa | LINH_DUOC | 1 |
| `v20_ch_1b` | Phàm Chủng · Sương Mai Hoa | LINH_THUC | 1 |
| `v20_kv_1a` | Phàm Thiết Quặng | KHOANG_VAT | 1 |
| `v20_kv_1b` | Sơn Thạch Tinh | KHOANG_VAT | 1 |
| `v20_yt_1` | Nanh Sói Phàm | YEU_THU_TAI_LIEU | 1 |
| `v20_td_1` | Phù Chỉ Phàm Văn | TRAN_DAO_TAI_LIEU | 1 |
| `v20_kl_1` | Phàm Thiết Tinh Luyện | NGUYEN_LIEU_TRUNG_GIAN | 1 |
| `v20_pk_1` | Phôi Phàm Khí | NGUYEN_LIEU_TRUNG_GIAN | 1 |
| `v20_hc_1` | Hỏa Chủng · Thanh Mộc Phàm Hỏa | THIEN_DIA_CHI_BAO | 1 |
| `v20_ld_2a` | Linh Tâm Thảo | LINH_DUOC | 2 |
| `v20_ch_2a` | Linh Chủng · Linh Tâm Thảo | LINH_THUC | 2 |
| `v20_ld_2b` | Ngưng Lộ Quả | LINH_DUOC | 2 |
| `v20_ch_2b` | Linh Chủng · Ngưng Lộ Quả | LINH_THUC | 2 |
| `v20_kv_2a` | Linh Thiết Quặng | KHOANG_VAT | 2 |
| `v20_kv_2b` | Thanh Ngọc Thạch | KHOANG_VAT | 2 |
| `v20_yt_2` | Linh Lang Giác | YEU_THU_TAI_LIEU | 2 |
| `v20_td_2` | Linh Văn Thạch | TRAN_DAO_TAI_LIEU | 2 |
| `v20_kl_2` | Linh Thiết Tinh Luyện | NGUYEN_LIEU_TRUNG_GIAN | 2 |
| `v20_pk_2` | Phôi Linh Khí | NGUYEN_LIEU_TRUNG_GIAN | 2 |
| `v20_hc_2` | Hỏa Chủng · Xích Diễm Linh Hỏa | THIEN_DIA_CHI_BAO | 2 |
| `v20_ld_3a` | Huyền Âm Chi | LINH_DUOC | 3 |
| `v20_ch_3a` | Huyền Chủng · Huyền Âm Chi | LINH_THUC | 3 |
| `v20_ld_3b` | Hắc Diệp Sâm | LINH_DUOC | 3 |
| `v20_ch_3b` | Huyền Chủng · Hắc Diệp Sâm | LINH_THUC | 3 |
| `v20_kv_3a` | Huyền Thiết Tinh | KHOANG_VAT | 3 |
| `v20_kv_3b` | Ô Kim Thạch | KHOANG_VAT | 3 |
| `v20_yt_3` | Huyền Quy Giáp | YEU_THU_TAI_LIEU | 3 |
| `v20_td_3` | Huyền Văn Sa | TRAN_DAO_TAI_LIEU | 3 |
| `v20_kl_3` | Huyền Thiết Hợp Kim | NGUYEN_LIEU_TRUNG_GIAN | 3 |
| `v20_pk_3` | Phôi Huyền Khí | NGUYEN_LIEU_TRUNG_GIAN | 3 |
| `v20_hc_3` | Hỏa Chủng · U Minh Huyền Hỏa | THIEN_DIA_CHI_BAO | 3 |
| `v20_ld_4a` | Địa Long Sâm | LINH_DUOC | 4 |
| `v20_ch_4a` | Địa Chủng · Địa Long Sâm | LINH_THUC | 4 |
| `v20_ld_4b` | Hậu Thổ Linh Chi | LINH_DUOC | 4 |
| `v20_ch_4b` | Địa Chủng · Hậu Thổ Linh Chi | LINH_THUC | 4 |
| `v20_kv_4a` | Địa Tâm Kim | KHOANG_VAT | 4 |
| `v20_kv_4b` | Hậu Thổ Tinh Thạch | KHOANG_VAT | 4 |
| `v20_yt_4` | Địa Long Lân | YEU_THU_TAI_LIEU | 4 |
| `v20_td_4` | Địa Mạch Trận Thạch | TRAN_DAO_TAI_LIEU | 4 |
| `v20_kl_4` | Địa Tâm Hợp Kim | NGUYEN_LIEU_TRUNG_GIAN | 4 |
| `v20_pk_4` | Phôi Địa Khí | NGUYEN_LIEU_TRUNG_GIAN | 4 |
| `v20_hc_4` | Hỏa Chủng · Địa Tâm Nham Hỏa | THIEN_DIA_CHI_BAO | 4 |
| `v20_ld_5a` | Thiên Tuyền Hoa | LINH_DUOC | 5 |
| `v20_ch_5a` | Thiên Chủng · Thiên Tuyền Hoa | LINH_THUC | 5 |
| `v20_ld_5b` | Ngũ Sắc Linh Chi | LINH_DUOC | 5 |
| `v20_ch_5b` | Thiên Chủng · Ngũ Sắc Linh Chi | LINH_THUC | 5 |
| `v20_kv_5a` | Thiên Ngoại Thiết Tinh | KHOANG_VAT | 5 |
| `v20_kv_5b` | Lôi Kích Thạch | KHOANG_VAT | 5 |
| `v20_yt_5` | Thiên Bằng Vũ | YEU_THU_TAI_LIEU | 5 |
| `v20_td_5` | Thiên Cơ Trận Tinh | TRAN_DAO_TAI_LIEU | 5 |
| `v20_kl_5` | Thiên Ngoại Hợp Kim | NGUYEN_LIEU_TRUNG_GIAN | 5 |
| `v20_pk_5` | Phôi Thiên Khí | NGUYEN_LIEU_TRUNG_GIAN | 5 |
| `v20_hc_5` | Hỏa Chủng · Cửu Thiên Lôi Hỏa | THIEN_DIA_CHI_BAO | 5 |
| `v20_ld_6a` | Thánh Quang Thảo | LINH_DUOC | 6 |
| `v20_ch_6a` | Thánh Chủng · Thánh Quang Thảo | LINH_THUC | 6 |
| `v20_ld_6b` | Bạch Ngọc Liên | LINH_DUOC | 6 |
| `v20_ch_6b` | Thánh Chủng · Bạch Ngọc Liên | LINH_THUC | 6 |
| `v20_kv_6a` | Tiên Kim Quặng | KHOANG_VAT | 6 |
| `v20_kv_6b` | Tiên Ngọc Tủy | KHOANG_VAT | 6 |
| `v20_yt_6` | Tiên Hạc Cốt | YEU_THU_TAI_LIEU | 6 |
| `v20_td_6` | Tiên Văn Ngọc | TRAN_DAO_TAI_LIEU | 6 |
| `v20_kl_6` | Tiên Kim Tinh Luyện | NGUYEN_LIEU_TRUNG_GIAN | 6 |
| `v20_pk_6` | Phôi Tiên Khí Thượng | NGUYEN_LIEU_TRUNG_GIAN | 6 |
| `v20_hc_6` | Hỏa Chủng · Bạch Ngọc Tiên Hỏa | THIEN_DIA_CHI_BAO | 6 |
| `v20_ld_7a` | Tiên Lộ Kỳ Hoa | LINH_DUOC | 6 |
| `v20_ch_7a` | Tiên Chủng · Tiên Lộ Kỳ Hoa | LINH_THUC | 6 |
| `v20_ld_7b` | Vạn Niên Tiên Sâm | LINH_DUOC | 6 |
| `v20_ch_7b` | Tiên Chủng · Vạn Niên Tiên Sâm | LINH_THUC | 6 |
| `v20_kv_7a` | Đế Kim Tinh | KHOANG_VAT | 6 |
| `v20_kv_7b` | Huyền Hoàng Thạch | KHOANG_VAT | 6 |
| `v20_yt_7` | Chân Long Giác | YEU_THU_TAI_LIEU | 6 |
| `v20_td_7` | Đế Văn Kim Tủy | TRAN_DAO_TAI_LIEU | 6 |
| `v20_kl_7` | Đế Kim Tinh Luyện | NGUYEN_LIEU_TRUNG_GIAN | 6 |
| `v20_pk_7` | Phôi Đế Khí | NGUYEN_LIEU_TRUNG_GIAN | 6 |
| `v20_hc_7` | Hỏa Chủng · Hoàng Kim Đế Hỏa | THIEN_DIA_CHI_BAO | 6 |
| `v20_ld_8a` | Thần Hồn Thảo | LINH_DUOC | 7 |
| `v20_ch_8a` | Thần Chủng · Thần Hồn Thảo | LINH_THUC | 7 |
| `v20_ld_8b` | Hỗn Linh Quả | LINH_DUOC | 7 |
| `v20_ch_8b` | Thần Chủng · Hỗn Linh Quả | LINH_THUC | 7 |
| `v20_kv_8a` | Đạo Tổ Kim Hạch | KHOANG_VAT | 7 |
| `v20_kv_8b` | Hỗn Nguyên Tinh Thạch | KHOANG_VAT | 7 |
| `v20_yt_8` | Đạo Tổ Thú Hồn | YEU_THU_TAI_LIEU | 7 |
| `v20_td_8` | Đạo Tổ Văn Hạch | TRAN_DAO_TAI_LIEU | 7 |
| `v20_kl_8` | Đạo Tổ Kim Tinh Luyện | NGUYEN_LIEU_TRUNG_GIAN | 7 |
| `v20_pk_8` | Phôi Đạo Tổ Khí | NGUYEN_LIEU_TRUNG_GIAN | 7 |
| `v20_hc_8` | Hỏa Chủng · Hỗn Nguyên Đạo Hỏa | THIEN_DIA_CHI_BAO | 7 |
| `v20_ld_9a` | Đế Vương Hoa | LINH_DUOC | 7 |
| `v20_ch_9a` | Đế Chủng · Đế Vương Hoa | LINH_THUC | 7 |
| `v20_ld_9b` | Bất Tử Linh Chi | LINH_DUOC | 7 |
| `v20_ch_9b` | Đế Chủng · Bất Tử Linh Chi | LINH_THUC | 7 |
| `v20_kv_9a` | Thiên Đạo Kim Tinh | KHOANG_VAT | 7 |
| `v20_kv_9b` | Vô Cực Thần Thạch | KHOANG_VAT | 7 |
| `v20_yt_9` | Thiên Đạo Thú Hạch | YEU_THU_TAI_LIEU | 7 |
| `v20_td_9` | Thiên Đạo Văn Tinh | TRAN_DAO_TAI_LIEU | 7 |
| `v20_kl_9` | Thiên Đạo Kim Tinh Luyện | NGUYEN_LIEU_TRUNG_GIAN | 7 |
| `v20_pk_9` | Phôi Thiên Đạo Khí | NGUYEN_LIEU_TRUNG_GIAN | 7 |
| `v20_hc_9` | Hỏa Chủng · Vô Cực Thiên Đạo Hỏa | THIEN_DIA_CHI_BAO | 7 |
| `v20_ld_10a` | Siêu Thoát Hư Liên | LINH_DUOC | 7 |
| `v20_ch_10a` | Siêu Thoát Chủng · Siêu Thoát Hư Liên | LINH_THUC | 7 |
| `v20_ld_10b` | Vô Cực Đạo Quả | LINH_DUOC | 7 |
| `v20_ch_10b` | Siêu Thoát Chủng · Vô Cực Đạo Quả | LINH_THUC | 7 |
| `v20_kv_10a` | Siêu Thoát Hư Kim | KHOANG_VAT | 7 |
| `v20_kv_10b` | Hỗn Độn Tinh Thạch | KHOANG_VAT | 7 |
| `v20_yt_10` | Siêu Thoát Thú Tinh | YEU_THU_TAI_LIEU | 7 |
| `v20_td_10` | Siêu Thoát Văn Hạch | TRAN_DAO_TAI_LIEU | 7 |
| `v20_kl_10` | Siêu Thoát Kim Tinh Luyện | NGUYEN_LIEU_TRUNG_GIAN | 7 |
| `v20_pk_10` | Phôi Siêu Thoát Khí | NGUYEN_LIEU_TRUNG_GIAN | 7 |
| `v20_hc_10` | Hỏa Chủng · Siêu Thoát Hư Không Hỏa | THIEN_DIA_CHI_BAO | 7 |
| `dd_than` | Dược Dịch Thần | NGUYEN_LIEU_TRUNG_GIAN | 6 |
| `dd_de` | Dược Dịch Đế | NGUYEN_LIEU_TRUNG_GIAN | 7 |
| `dd_sieuthoat` | Dược Dịch Siêu Thoát | NGUYEN_LIEU_TRUNG_GIAN | 7 |
| `tv_tien` | Tiên Văn | NGUYEN_LIEU_TRUNG_GIAN | 6 |
| `tv_than` | Thần Văn | NGUYEN_LIEU_TRUNG_GIAN | 6 |
| `tv_de` | Đế Văn | NGUYEN_LIEU_TRUNG_GIAN | 7 |
| `tv_thiendao` | Thiên Đạo Văn | NGUYEN_LIEU_TRUNG_GIAN | 7 |
| `tv_sieuthoat` | Siêu Thoát Văn | NGUYEN_LIEU_TRUNG_GIAN | 7 |
| `v20_bv_6` | Bản Vẽ Hiếm · Tiên Cấp | THIEN_DIA_CHI_BAO | 6 |
| `v20_bv_7` | Bản Vẽ Hiếm · Đế Cấp | THIEN_DIA_CHI_BAO | 6 |
| `v20_bv_8` | Bản Vẽ Hiếm · Đạo Tổ Cấp | THIEN_DIA_CHI_BAO | 7 |
| `v20_bv_9` | Bản Vẽ Hiếm · Thiên Đạo Cấp | THIEN_DIA_CHI_BAO | 7 |
| `v20_bv_10` | Bản Vẽ Hiếm · Siêu Thoát Cấp | THIEN_DIA_CHI_BAO | 7 |
| `v20_phe_dan` | Phế Đan | VAT_PHAM_KHAC | 1 |
| `v20_dp_hp_1` | Hồi Xuân Đan | DAN_DUOC | 1 |
| `v20_dp_tu_1` | Dưỡng Khí Đan | DAN_DUOC | 1 |
| `v20_dp_attr_1` | Cường Thân Đan | DAN_DUOC | 1 |
| `v20_dp_hp_2` | Linh Sinh Đan | DAN_DUOC | 2 |
| `v20_dp_tu_2` | Tụ Linh Đan | DAN_DUOC | 2 |
| `v20_dp_pha_2` | Phá Chướng Đan | DAN_DUOC | 2 |
| `v20_dp_tam_2` | Ninh Thần Đan | DAN_DUOC | 2 |
| `v20_dp_attr_2` | Linh Lực Đan | DAN_DUOC | 2 |
| `v20_dp_hp_3` | Huyền Sinh Đan | DAN_DUOC | 3 |
| `v20_dp_tu_3` | Huyền Tu Đan | DAN_DUOC | 3 |
| `v20_dp_pha_3` | Huyền Phá Đan | DAN_DUOC | 3 |
| `v20_dp_tam_3` | Định Hồn Đan | DAN_DUOC | 3 |
| `v20_dp_attr_3` | Huyền Cương Đan | DAN_DUOC | 3 |
| `v20_dp_ban_3` | Huyền Bản Nguyên Đan | DAN_DUOC | 3 |
| `v20_dp_hp_4` | Địa Nguyên Hồi Đan | DAN_DUOC | 4 |
| `v20_dp_tu_4` | Địa Tâm Tu Đan | DAN_DUOC | 4 |
| `v20_dp_pha_4` | Địa Phá Đan | DAN_DUOC | 4 |
| `v20_dp_tam_4` | Địa Hồn Đan | DAN_DUOC | 4 |
| `v20_dp_attr_4` | Địa Hộ Đan | DAN_DUOC | 4 |
| `v20_dp_ban_4` | Địa Bản Nguyên Đan | DAN_DUOC | 4 |
| `v20_dp_hp_5` | Thiên Sinh Đan | DAN_DUOC | 5 |
| `v20_dp_tu_5` | Thiên Tu Đan | DAN_DUOC | 5 |
| `v20_dp_pha_5` | Thiên Phá Đan | DAN_DUOC | 5 |
| `v20_dp_tam_5` | Thiên Hồn Đan | DAN_DUOC | 5 |
| `v20_dp_attr_5` | Thiên Lực Đan | DAN_DUOC | 5 |
| `v20_dp_ban_5` | Thiên Bản Nguyên Đan | DAN_DUOC | 5 |
| `v20_dp_kiep_5` | Thiên Kiếp Hộ Đan | DAN_DUOC | 5 |
| `v20_dp_hp_6` | Tiên Lộ Hồi Đan | DAN_DUOC | 6 |
| `v20_dp_tu_6` | Tiên Tu Đan | DAN_DUOC | 6 |
| `v20_dp_pha_6` | Tiên Phá Đan | DAN_DUOC | 6 |
| `v20_dp_tam_6` | Tiên Hồn Đan | DAN_DUOC | 6 |
| `v20_dp_attr_6` | Tiên Thể Đan | DAN_DUOC | 6 |
| `v20_dp_ban_6` | Tiên Bản Nguyên Đan | DAN_DUOC | 6 |
| `v20_dp_kiep_6` | Tiên Kiếp Hộ Đan | DAN_DUOC | 6 |
| `v20_dp_tg_6` | Tiên Giới Linh Đan | DAN_DUOC | 6 |
| `v20_dp_hp_7` | Đế Sinh Đan | DAN_DUOC | 6 |
| `v20_dp_tu_7` | Đế Tu Đan | DAN_DUOC | 6 |
| `v20_dp_pha_7` | Đế Phá Đan | DAN_DUOC | 6 |
| `v20_dp_tam_7` | Đế Hồn Đan | DAN_DUOC | 6 |
| `v20_dp_attr_7` | Đế Thể Đan | DAN_DUOC | 6 |
| `v20_dp_ban_7` | Đế Bản Nguyên Đan | DAN_DUOC | 6 |
| `v20_dp_kiep_7` | Đế Kiếp Hộ Đan | DAN_DUOC | 6 |
| `v20_dp_dc_7` | Đế Cảnh Chiến Đan | DAN_DUOC | 6 |
| `v20_dp_hp_8` | Đạo Tổ Hồi Sinh Đan | DAN_DUOC | 7 |
| `v20_dp_tu_8` | Đạo Tổ Tu Đan | DAN_DUOC | 7 |
| `v20_dp_pha_8` | Đạo Tổ Phá Đan | DAN_DUOC | 7 |
| `v20_dp_tam_8` | Đạo Hồn Đan | DAN_DUOC | 7 |
| `v20_dp_attr_8` | Đạo Thể Đan | DAN_DUOC | 7 |
| `v20_dp_ban_8` | Đạo Tổ Bản Nguyên Đan | DAN_DUOC | 7 |
| `v20_dp_kiep_8` | Đạo Kiếp Hộ Đan | DAN_DUOC | 7 |
| `v20_dp_hp_9` | Thiên Đạo Sinh Đan | DAN_DUOC | 7 |
| `v20_dp_tu_9` | Thiên Đạo Tu Đan | DAN_DUOC | 7 |
| `v20_dp_pha_9` | Thiên Đạo Phá Đan | DAN_DUOC | 7 |
| `v20_dp_tam_9` | Thiên Đạo Hồn Đan | DAN_DUOC | 7 |
| `v20_dp_attr_9` | Thiên Đạo Thể Đan | DAN_DUOC | 7 |
| `v20_dp_ban_9` | Thiên Đạo Bản Nguyên Đan | DAN_DUOC | 7 |
| `v20_dp_kiep_9` | Thiên Đạo Kiếp Hộ Đan | DAN_DUOC | 7 |
| `v20_dp_hp_10` | Siêu Thoát Hồi Sinh Đan | DAN_DUOC | 7 |
| `v20_dp_tu_10` | Siêu Thoát Tu Đan | DAN_DUOC | 7 |
| `v20_dp_pha_10` | Siêu Thoát Phá Đan | DAN_DUOC | 7 |
| `v20_dp_tam_10` | Siêu Thoát Hồn Đan | DAN_DUOC | 7 |
| `v20_dp_attr_10` | Siêu Thoát Thể Đan | DAN_DUOC | 7 |
| `v20_dp_ban_10` | Siêu Thoát Bản Nguyên Đan | DAN_DUOC | 7 |
| `v20_dp_kiep_10` | Siêu Thoát Kiếp Hộ Đan | DAN_DUOC | 7 |
| `v20_dp_st_10` | Siêu Thoát Chí Đan | DAN_DUOC | 7 |
| `v20_dp_tt_5` | Thiên Đạo Phục Sinh Đan | DAN_DUOC | 5 |
| `v20_dp_tt_6` | Tiên Thiên Tạo Hóa Đan | DAN_DUOC | 6 |
| `v20_dp_tt_7` | Đế Vương Bất Hủ Đan | DAN_DUOC | 6 |
| `v20_dp_tt_8` | Đạo Tổ Hỗn Nguyên Đan | DAN_DUOC | 7 |
| `v20_dp_tt_9` | Thiên Đạo Vô Cực Đan | DAN_DUOC | 7 |
| `v20_dp_tt_10` | Siêu Thoát Hư Không Đan | DAN_DUOC | 7 |
| `v20_ct_v20_dp_tt_5` | Đan Phương Thất Truyền · Thiên Đạo Phục Sinh Đan | THIEN_DIA_CHI_BAO | 5 |
| `v20_ct_v20_dp_tt_6` | Đan Phương Thất Truyền · Tiên Thiên Tạo Hóa Đan | THIEN_DIA_CHI_BAO | 6 |
| `v20_ct_v20_dp_tt_7` | Đan Phương Thất Truyền · Đế Vương Bất Hủ Đan | THIEN_DIA_CHI_BAO | 6 |
| `v20_ct_v20_dp_tt_8` | Đan Phương Thất Truyền · Đạo Tổ Hỗn Nguyên Đan | THIEN_DIA_CHI_BAO | 7 |
| `v20_ct_v20_dp_tt_9` | Đan Phương Thất Truyền · Thiên Đạo Vô Cực Đan | THIEN_DIA_CHI_BAO | 7 |
| `v20_ct_v20_dp_tt_10` | Đan Phương Thất Truyền · Siêu Thoát Hư Không Đan | THIEN_DIA_CHI_BAO | 7 |
| `v20_ct_tp20_tran_ap` | Trận Đồ Thất Truyền · Trấn Áp Đại Trận | THIEN_DIA_CHI_BAO | 4 |
| `v20_ct_tp20_tu_linh_tien` | Trận Đồ Thất Truyền · Tiên Tụ Linh Trận | THIEN_DIA_CHI_BAO | 6 |
| `v20_ct_tp20_ho_than_de` | Trận Đồ Thất Truyền · Đế Hộ Thân Trận | THIEN_DIA_CHI_BAO | 6 |
| `v20_ct_tp20_sat_phat_de` | Trận Đồ Thất Truyền · Đế Sát Phạt Trận | THIEN_DIA_CHI_BAO | 7 |
| `v20_ct_tp20_dao_to` | Trận Đồ Thất Truyền · Đạo Tổ Hộ Tông Trận | THIEN_DIA_CHI_BAO | 7 |
| `v20_ct_tp20_thien_dia` | Trận Đồ Thất Truyền · Thiên Địa Đại Trận | THIEN_DIA_CHI_BAO | 7 |
| `v20_ct_tp20_khong_gian_de` | Trận Đồ Thất Truyền · Đế Không Gian Trận Bàn | THIEN_DIA_CHI_BAO | 7 |
| `v20_ct_tp20_chung_cuc` | Trận Đồ Thất Truyền · Chung Cực Trận | THIEN_DIA_CHI_BAO | 7 |

### B. Công thức mới (153)

| ID | Nghề | Giai đoạn | Cấp nghề | Tên | Thất truyền |
|---|---|---|---|---|---|
| `rc20_kl_1` | Luyện Khí Sư | 1 | 1 | Chế Phàm Thiết Tinh Luyện |  |
| `rc20_pk_1` | Luyện Khí Sư | 1 | 1 | Đúc Phôi Phàm Khí |  |
| `rc20_kl_2` | Luyện Khí Sư | 2 | 2 | Chế Linh Thiết Tinh Luyện |  |
| `rc20_pk_2` | Luyện Khí Sư | 2 | 2 | Đúc Phôi Linh Khí |  |
| `rc20_kl_3` | Luyện Khí Sư | 3 | 3 | Chế Huyền Thiết Hợp Kim |  |
| `rc20_pk_3` | Luyện Khí Sư | 3 | 3 | Đúc Phôi Huyền Khí |  |
| `rc20_kl_4` | Luyện Khí Sư | 4 | 4 | Chế Địa Tâm Hợp Kim |  |
| `rc20_pk_4` | Luyện Khí Sư | 4 | 4 | Đúc Phôi Địa Khí |  |
| `rc20_kl_5` | Luyện Khí Sư | 5 | 5 | Chế Thiên Ngoại Hợp Kim |  |
| `rc20_pk_5` | Luyện Khí Sư | 5 | 5 | Đúc Phôi Thiên Khí |  |
| `rc20_kl_6` | Luyện Khí Sư | 6 | 6 | Chế Tiên Kim Tinh Luyện |  |
| `rc20_pk_6` | Luyện Khí Sư | 6 | 6 | Đúc Phôi Tiên Khí Thượng |  |
| `rc20_kl_7` | Luyện Khí Sư | 7 | 7 | Chế Đế Kim Tinh Luyện |  |
| `rc20_pk_7` | Luyện Khí Sư | 7 | 7 | Đúc Phôi Đế Khí |  |
| `rc20_kl_8` | Luyện Khí Sư | 8 | 8 | Chế Đạo Tổ Kim Tinh Luyện |  |
| `rc20_pk_8` | Luyện Khí Sư | 8 | 8 | Đúc Phôi Đạo Tổ Khí |  |
| `rc20_kl_9` | Luyện Khí Sư | 9 | 9 | Chế Thiên Đạo Kim Tinh Luyện |  |
| `rc20_pk_9` | Luyện Khí Sư | 9 | 9 | Đúc Phôi Thiên Đạo Khí |  |
| `rc20_kl_10` | Luyện Khí Sư | 10 | 9 | Chế Siêu Thoát Kim Tinh Luyện |  |
| `rc20_pk_10` | Luyện Khí Sư | 10 | 9 | Đúc Phôi Siêu Thoát Khí |  |
| `rc20_tv_6` | Trận Pháp Sư | 6 | 6 | Khắc Tiên Văn |  |
| `rc20_tv_7` | Trận Pháp Sư | 7 | 7 | Khắc Thần Văn |  |
| `rc20_tv_8` | Trận Pháp Sư | 8 | 8 | Khắc Đế Văn |  |
| `rc20_tv_9` | Trận Pháp Sư | 9 | 9 | Khắc Thiên Đạo Văn |  |
| `rc20_tv_10` | Trận Pháp Sư | 10 | 9 | Khắc Siêu Thoát Văn |  |
| `rc20_tv_so` | Trận Pháp Sư | 1 | 1 | Khắc Trận Văn Sơ Cấp (vật liệu Phàm Văn) |  |
| `rc20_tv_trung` | Trận Pháp Sư | 2 | 3 | Khắc Trận Văn Trung Cấp (vật liệu Linh/Huyền Văn) |  |
| `rc20_tv_cao` | Trận Pháp Sư | 4 | 5 | Khắc Trận Văn Cao Cấp (vật liệu Địa/Thiên Văn) |  |
| `rc20_dd_than` | Đan Sư | 6 | 6 | Dược Dịch Thần |  |
| `rc20_dd_de` | Đan Sư | 8 | 8 | Dược Dịch Đế |  |
| `rc20_dd_sieuthoat` | Đan Sư | 10 | 9 | Dược Dịch Siêu Thoát |  |
| `rc20_dp_hp_1` | Đan Sư | 1 | 1 | Hồi Xuân Đan |  |
| `rc20_dp_tu_1` | Đan Sư | 1 | 1 | Dưỡng Khí Đan |  |
| `rc20_dp_attr_1` | Đan Sư | 1 | 1 | Cường Thân Đan |  |
| `rc20_dp_hp_2` | Đan Sư | 2 | 2 | Linh Sinh Đan |  |
| `rc20_dp_tu_2` | Đan Sư | 2 | 2 | Tụ Linh Đan |  |
| `rc20_dp_pha_2` | Đan Sư | 2 | 2 | Phá Chướng Đan |  |
| `rc20_dp_tam_2` | Đan Sư | 2 | 2 | Ninh Thần Đan |  |
| `rc20_dp_attr_2` | Đan Sư | 2 | 2 | Linh Lực Đan |  |
| `rc20_dp_hp_3` | Đan Sư | 3 | 3 | Huyền Sinh Đan |  |
| `rc20_dp_tu_3` | Đan Sư | 3 | 3 | Huyền Tu Đan |  |
| `rc20_dp_pha_3` | Đan Sư | 3 | 3 | Huyền Phá Đan |  |
| `rc20_dp_tam_3` | Đan Sư | 3 | 3 | Định Hồn Đan |  |
| `rc20_dp_attr_3` | Đan Sư | 3 | 3 | Huyền Cương Đan |  |
| `rc20_dp_ban_3` | Đan Sư | 3 | 3 | Huyền Bản Nguyên Đan |  |
| `rc20_dp_hp_4` | Đan Sư | 4 | 4 | Địa Nguyên Hồi Đan |  |
| `rc20_dp_tu_4` | Đan Sư | 4 | 4 | Địa Tâm Tu Đan |  |
| `rc20_dp_pha_4` | Đan Sư | 4 | 4 | Địa Phá Đan |  |
| `rc20_dp_tam_4` | Đan Sư | 4 | 4 | Địa Hồn Đan |  |
| `rc20_dp_attr_4` | Đan Sư | 4 | 4 | Địa Hộ Đan |  |
| `rc20_dp_ban_4` | Đan Sư | 4 | 4 | Địa Bản Nguyên Đan |  |
| `rc20_dp_hp_5` | Đan Sư | 5 | 5 | Thiên Sinh Đan |  |
| `rc20_dp_tu_5` | Đan Sư | 5 | 5 | Thiên Tu Đan |  |
| `rc20_dp_pha_5` | Đan Sư | 5 | 5 | Thiên Phá Đan |  |
| `rc20_dp_tam_5` | Đan Sư | 5 | 5 | Thiên Hồn Đan |  |
| `rc20_dp_attr_5` | Đan Sư | 5 | 5 | Thiên Lực Đan |  |
| `rc20_dp_ban_5` | Đan Sư | 5 | 5 | Thiên Bản Nguyên Đan |  |
| `rc20_dp_kiep_5` | Đan Sư | 5 | 5 | Thiên Kiếp Hộ Đan |  |
| `rc20_dp_hp_6` | Đan Sư | 6 | 6 | Tiên Lộ Hồi Đan |  |
| `rc20_dp_tu_6` | Đan Sư | 6 | 6 | Tiên Tu Đan |  |
| `rc20_dp_pha_6` | Đan Sư | 6 | 6 | Tiên Phá Đan |  |
| `rc20_dp_tam_6` | Đan Sư | 6 | 6 | Tiên Hồn Đan |  |
| `rc20_dp_attr_6` | Đan Sư | 6 | 6 | Tiên Thể Đan |  |
| `rc20_dp_ban_6` | Đan Sư | 6 | 6 | Tiên Bản Nguyên Đan |  |
| `rc20_dp_kiep_6` | Đan Sư | 6 | 6 | Tiên Kiếp Hộ Đan |  |
| `rc20_dp_tg_6` | Đan Sư | 6 | 6 | Tiên Giới Linh Đan |  |
| `rc20_dp_hp_7` | Đan Sư | 7 | 7 | Đế Sinh Đan |  |
| `rc20_dp_tu_7` | Đan Sư | 7 | 7 | Đế Tu Đan |  |
| `rc20_dp_pha_7` | Đan Sư | 7 | 7 | Đế Phá Đan |  |
| `rc20_dp_tam_7` | Đan Sư | 7 | 7 | Đế Hồn Đan |  |
| `rc20_dp_attr_7` | Đan Sư | 7 | 7 | Đế Thể Đan |  |
| `rc20_dp_ban_7` | Đan Sư | 7 | 7 | Đế Bản Nguyên Đan |  |
| `rc20_dp_kiep_7` | Đan Sư | 7 | 7 | Đế Kiếp Hộ Đan |  |
| `rc20_dp_dc_7` | Đan Sư | 7 | 7 | Đế Cảnh Chiến Đan |  |
| `rc20_dp_hp_8` | Đan Sư | 8 | 8 | Đạo Tổ Hồi Sinh Đan |  |
| `rc20_dp_tu_8` | Đan Sư | 8 | 8 | Đạo Tổ Tu Đan |  |
| `rc20_dp_pha_8` | Đan Sư | 8 | 8 | Đạo Tổ Phá Đan |  |
| `rc20_dp_tam_8` | Đan Sư | 8 | 8 | Đạo Hồn Đan |  |
| `rc20_dp_attr_8` | Đan Sư | 8 | 8 | Đạo Thể Đan |  |
| `rc20_dp_ban_8` | Đan Sư | 8 | 8 | Đạo Tổ Bản Nguyên Đan |  |
| `rc20_dp_kiep_8` | Đan Sư | 8 | 8 | Đạo Kiếp Hộ Đan |  |
| `rc20_dp_hp_9` | Đan Sư | 9 | 9 | Thiên Đạo Sinh Đan |  |
| `rc20_dp_tu_9` | Đan Sư | 9 | 9 | Thiên Đạo Tu Đan |  |
| `rc20_dp_pha_9` | Đan Sư | 9 | 9 | Thiên Đạo Phá Đan |  |
| `rc20_dp_tam_9` | Đan Sư | 9 | 9 | Thiên Đạo Hồn Đan |  |
| `rc20_dp_attr_9` | Đan Sư | 9 | 9 | Thiên Đạo Thể Đan |  |
| `rc20_dp_ban_9` | Đan Sư | 9 | 9 | Thiên Đạo Bản Nguyên Đan |  |
| `rc20_dp_kiep_9` | Đan Sư | 9 | 9 | Thiên Đạo Kiếp Hộ Đan |  |
| `rc20_dp_hp_10` | Đan Sư | 10 | 9 | Siêu Thoát Hồi Sinh Đan |  |
| `rc20_dp_tu_10` | Đan Sư | 10 | 9 | Siêu Thoát Tu Đan |  |
| `rc20_dp_pha_10` | Đan Sư | 10 | 9 | Siêu Thoát Phá Đan |  |
| `rc20_dp_tam_10` | Đan Sư | 10 | 9 | Siêu Thoát Hồn Đan |  |
| `rc20_dp_attr_10` | Đan Sư | 10 | 9 | Siêu Thoát Thể Đan |  |
| `rc20_dp_ban_10` | Đan Sư | 10 | 9 | Siêu Thoát Bản Nguyên Đan |  |
| `rc20_dp_kiep_10` | Đan Sư | 10 | 9 | Siêu Thoát Kiếp Hộ Đan |  |
| `rc20_dp_st_10` | Đan Sư | 10 | 9 | Siêu Thoát Chí Đan |  |
| `rc20_dp_tt_5` | Đan Sư | 5 | 5 | Thiên Đạo Phục Sinh Đan | có |
| `rc20_dp_tt_6` | Đan Sư | 6 | 6 | Tiên Thiên Tạo Hóa Đan | có |
| `rc20_dp_tt_7` | Đan Sư | 7 | 7 | Đế Vương Bất Hủ Đan | có |
| `rc20_dp_tt_8` | Đan Sư | 8 | 8 | Đạo Tổ Hỗn Nguyên Đan | có |
| `rc20_dp_tt_9` | Đan Sư | 9 | 9 | Thiên Đạo Vô Cực Đan | có |
| `rc20_dp_tt_10` | Đan Sư | 10 | 9 | Siêu Thoát Hư Không Đan | có |
| `rc20_tp20_tran_ap` | Trận Pháp Sư | 4 | 4 | Trấn Áp Đại Trận | có |
| `rc20_tp20_tu_linh_tien` | Trận Pháp Sư | 6 | 6 | Tiên Tụ Linh Trận | có |
| `rc20_tp20_ho_than_de` | Trận Pháp Sư | 7 | 7 | Đế Hộ Thân Trận | có |
| `rc20_tp20_sat_phat_de` | Trận Pháp Sư | 8 | 8 | Đế Sát Phạt Trận | có |
| `rc20_tp20_dao_to` | Trận Pháp Sư | 8 | 8 | Đạo Tổ Hộ Tông Trận | có |
| `rc20_tp20_thien_dia` | Trận Pháp Sư | 9 | 9 | Thiên Địa Đại Trận | có |
| `rc20_tp20_khong_gian_de` | Trận Pháp Sư | 9 | 9 | Đế Không Gian Trận Bàn | có |
| `rc20_tp20_chung_cuc` | Trận Pháp Sư | 10 | 9 | Chung Cực Trận | có |
| `rc20_gx20_weapon_6` | Luyện Khí Sư | 6 | 6 | Tiên Quang Kiếm |  |
| `rc20_gx20_armor_6` | Luyện Khí Sư | 6 | 6 | Tiên Quang Giáp |  |
| `rc20_gx20_jade_6` | Luyện Khí Sư | 6 | 6 | Tiên Quang Ngọc Bội |  |
| `rc20_gx20_mirror_6` | Luyện Khí Sư | 6 | 6 | Tiên Quang Hộ Tâm Kính |  |
| `rc20_gx20_boots_6` | Luyện Khí Sư | 6 | 6 | Tiên Quang Ngoa |  |
| `rc20_gx20_ring_6` | Luyện Khí Sư | 6 | 6 | Tiên Quang Giới Chỉ |  |
| `rc20_gx20_bell_6` | Luyện Khí Sư | 6 | 6 | Tiên Quang Linh |  |
| `rc20_gx20_weapon_7` | Luyện Khí Sư | 7 | 7 | Đế Uy Kiếm |  |
| `rc20_gx20_armor_7` | Luyện Khí Sư | 7 | 7 | Đế Uy Giáp |  |
| `rc20_gx20_jade_7` | Luyện Khí Sư | 7 | 7 | Đế Uy Ngọc Bội |  |
| `rc20_gx20_mirror_7` | Luyện Khí Sư | 7 | 7 | Đế Uy Hộ Tâm Kính |  |
| `rc20_gx20_boots_7` | Luyện Khí Sư | 7 | 7 | Đế Uy Ngoa |  |
| `rc20_gx20_ring_7` | Luyện Khí Sư | 7 | 7 | Đế Uy Giới Chỉ |  |
| `rc20_gx20_bell_7` | Luyện Khí Sư | 7 | 7 | Đế Uy Linh |  |
| `rc20_gx20_weapon_8` | Luyện Khí Sư | 8 | 8 | Đạo Tổ Kiếm |  |
| `rc20_gx20_armor_8` | Luyện Khí Sư | 8 | 8 | Đạo Tổ Giáp |  |
| `rc20_gx20_jade_8` | Luyện Khí Sư | 8 | 8 | Đạo Tổ Ngọc Bội |  |
| `rc20_gx20_mirror_8` | Luyện Khí Sư | 8 | 8 | Đạo Tổ Hộ Tâm Kính |  |
| `rc20_gx20_boots_8` | Luyện Khí Sư | 8 | 8 | Đạo Tổ Ngoa |  |
| `rc20_gx20_ring_8` | Luyện Khí Sư | 8 | 8 | Đạo Tổ Giới Chỉ |  |
| `rc20_gx20_bell_8` | Luyện Khí Sư | 8 | 8 | Đạo Tổ Linh |  |
| `rc20_gx20_weapon_9` | Luyện Khí Sư | 9 | 9 | Thiên Đạo Kiếm |  |
| `rc20_gx20_armor_9` | Luyện Khí Sư | 9 | 9 | Thiên Đạo Giáp |  |
| `rc20_gx20_jade_9` | Luyện Khí Sư | 9 | 9 | Thiên Đạo Ngọc Bội |  |
| `rc20_gx20_mirror_9` | Luyện Khí Sư | 9 | 9 | Thiên Đạo Hộ Tâm Kính |  |
| `rc20_gx20_boots_9` | Luyện Khí Sư | 9 | 9 | Thiên Đạo Ngoa |  |
| `rc20_gx20_ring_9` | Luyện Khí Sư | 9 | 9 | Thiên Đạo Giới Chỉ |  |
| `rc20_gx20_bell_9` | Luyện Khí Sư | 9 | 9 | Thiên Đạo Linh |  |
| `rc20_gx20_weapon_10` | Luyện Khí Sư | 10 | 9 | Siêu Thoát Kiếm |  |
| `rc20_gx20_armor_10` | Luyện Khí Sư | 10 | 9 | Siêu Thoát Giáp |  |
| `rc20_gx20_jade_10` | Luyện Khí Sư | 10 | 9 | Siêu Thoát Ngọc Bội |  |
| `rc20_gx20_mirror_10` | Luyện Khí Sư | 10 | 9 | Siêu Thoát Hộ Tâm Kính |  |
| `rc20_gx20_boots_10` | Luyện Khí Sư | 10 | 9 | Siêu Thoát Ngoa |  |
| `rc20_gx20_ring_10` | Luyện Khí Sư | 10 | 9 | Siêu Thoát Giới Chỉ |  |
| `rc20_gx20_bell_10` | Luyện Khí Sư | 10 | 9 | Siêu Thoát Linh |  |
| `rc20_alt_gx_thanh_phong` | Luyện Khí Sư | 1 | 2 | Thanh Phong Kiếm (phôi V20) |  |
| `rc20_alt_gx_pha_thien_thuong` | Luyện Khí Sư | 4 | 7 | Phá Thiên Thương (phôi V20) |  |
| `rc20_alt_gx_huyen_thiet_giap` | Luyện Khí Sư | 3 | 4 | Huyền Thiết Giáp (phôi V20) |  |
| `rc20_alt_gx_tu_linh_boi` | Luyện Khí Sư | 3 | 5 | Tụ Linh Ngọc Bội (phôi V20) |  |
| `rc20_alt_gx_ho_tam_kinh` | Luyện Khí Sư | 2 | 3 | Hộ Tâm Kính (phôi V20) |  |
| `rc20_alt_gx_tat_phong_ngoa` | Luyện Khí Sư | 2 | 3 | Tật Phong Ngoa (phôi V20) |  |
| `rc20_alt_gx_tru_vat_gioi` | Luyện Khí Sư | 4 | 6 | Trữ Vật Giới Chỉ (phôi V20) |  |
| `rc20_alt_gx_tran_hon_linh` | Luyện Khí Sư | 3 | 5 | Trấn Hồn Linh (phôi V20) |  |

### C. Khu khai thác / thu thập (12)

| ID | Tên | Loại | Cảnh giới | Thời gian | Lượt/ngày | Phí |
|---|---|---|---|---|---|---|
| `kk1` | Mỏ Khoáng Vật | Mỏ | 0 | 300s | 4 | 0 |
| `kk2` | Mỏ Linh Thạch | Mỏ | 2 | 450s | 4 | 40000 |
| `kk3` | Mỏ Tiên Kim | Mỏ | 9 | 1519s | 3 | 0 |
| `kk4` | Mỏ Thần Tinh | Mỏ | 14 | 3417s | 2 | 0 |
| `kk5` | Mỏ Hỗn Độn | Mỏ | 24 | 7689s | 2 | 0 |
| `kk6` | Mỏ Tài Nguyên Đặc Biệt | Mỏ | 9 | 1519s | 2 | 0 |
| `tt1` | Sơn Mạch | Thu thập | 0 | 300s | 4 | 0 |
| `tt2` | Linh Cốc | Thu thập | 2 | 450s | 4 | 0 |
| `tt3` | Dược Viên | Thu thập | 4 | 675s | 3 | 0 |
| `tt4` | Cổ Lâm | Thu thập | 6 | 1013s | 3 | 0 |
| `tt5` | Tiên Dược Viên | Thu thập | 11 | 2278s | 2 | 0 |
| `tt6` | Thần Dược Cấm Địa | Thu thập | 20 | 5126s | 2 | 0 |

### D. 10 giai đoạn

| # | Tên | Dải cảnh giới | Cấp nghề | Dị Hỏa |
|---|---|---|---|---|
| 1 | Phàm Cấp | 0–1 | 1 | Thanh Mộc Phàm Hỏa |
| 2 | Linh Cấp | 2–3 | 2 | Xích Diễm Linh Hỏa |
| 3 | Huyền Cấp | 4–5 | 3 | U Minh Huyền Hỏa |
| 4 | Địa Cấp | 6–8 | 4 | Địa Tâm Nham Hỏa |
| 5 | Thiên Cấp | 9–10 | 5 | Cửu Thiên Lôi Hỏa |
| 6 | Tiên Cấp | 11–13 | 6 | Bạch Ngọc Tiên Hỏa |
| 7 | Đế Cấp | 14–19 | 7 | Hoàng Kim Đế Hỏa |
| 8 | Đạo Tổ Cấp | 20–23 | 8 | Hỗn Nguyên Đạo Hỏa |
| 9 | Thiên Đạo Cấp | 24–26 | 9 | Vô Cực Thiên Đạo Hỏa |
| 10 | Siêu Thoát Cấp | 27–28 | 9 | Siêu Thoát Hư Không Hỏa |
