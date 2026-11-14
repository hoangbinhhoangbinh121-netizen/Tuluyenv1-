# BẢNG ĐỐI CHIẾU V16 → V17 (sinh tự động từ danh mục — `scripts/gen_doichieu_v17.js`)

Số liệu THẬT trên máy chủ (số người giữ, tổng số lượng từng loại, kết quả đối chiếu trước/sau migration) lấy bằng lệnh admin `/doichieuv17` — file này chỉ mô tả cấu trúc.

## 1. Hệ thống V16 → cách V17 xử lý

| Hệ thống / vật phẩm V16 | V17 | Dữ liệu cũ |
|---|---|---|
| Nguyên Liệu (`nguyen_lieu`) | Vật phẩm `nl_tap` (Nguyên Liệu Tạp) — dùng trong công thức, NPC thu mua/bán | Giữ nguyên cột cũ |
| Đan Dược / Tụ Khí Đan (`dan_duoc`) | Vật phẩm `dan_tu_khi` (phẩm 2) — công thức Đan Sư, vẫn cắn bằng Dùng Đan Dược | Giữ nguyên cột cũ |
| Mẻ đan cũ đang luyện (`luyendan_start`) | `/luyendan` vẫn thu được mẻ đang chạy; mẻ mới do Đan Sư đảm nhiệm | Không mất mẻ nào |
| Luyện Khí cũ (cộng ATK/DEF vĩnh viễn) | Luyện Khí Sư rèn trang bị 7 ô; **không còn** cộng vĩnh viễn mỗi lần chế | Chỉ số đã cộng giữ nguyên, không thu hồi |
| Đan Dược Phá Giới | Vật phẩm `dan_pha_gioi` + công thức Đan Sư + dùng qua Dùng Đan Dược | Giữ nguyên cột cũ |
| Đan Tẩy Tủy Trọng Sinh / Nửa Tác Dụng | `dan_tay_tuy_ts` / `dan_tay_tuy_nua` — dùng ở menu Tẩy Tủy như cũ | Giữ nguyên cột cũ |
| Huyền Thiết, Tiên Kim, Tiên Ngọc, Hư Không Tinh Hoa/Kết Tinh, Thiên Hỏa Tinh, Thiên Kiếp Chi Lực, Đạo Nguyên Tinh, Thiên Đạo Thạch/Ấn … | Vật phẩm danh mục tương ứng (nhóm Tinh Hoa / Khoáng Vật), có nguồn rơi & công dụng rõ | Giữ nguyên cột cũ |
| Linh Dược Đặc Biệt | `ld_dac_biet` — nguyên liệu Đan Phá Giới | Giữ nguyên cột cũ |
| Linh Giới Lệnh, Linh Phù, Tiên Lệnh/Phù, Mảnh Tiên Giới Lệnh, Mảnh ghép Phi Thăng, Điểm Linh Ngộ | Vật phẩm nhiệm vụ/Phi Thăng/Thiên Đạo — **không bán, không chuyển, không tiêu hao bởi nghề** | Giữ nguyên cột cũ |
| Rương Thần Bí, Vé Bí Cảnh Đặc Biệt | `vp_ruong_than_bi`, `vp_ve_bicanh_db` (Không Gian Trận Bàn thay được vé) | Giữ nguyên cột cũ |
| Linh Thú / vật phẩm Linh Thú (`pet_items`) | Yêu Đan/Tinh Huyết… dùng chung kho qua Inventory Service (adapter `pet`) | Giữ nguyên bảng cũ |
| Công Pháp / Mảnh bí tịch / Pháp Bảo | Không đổi | Không đụng |

## 2. Danh mục vật phẩm

Tổng **118** vật phẩm, **11** danh mục, **7** phẩm cấp (độc lập với phẩm chất sản phẩm 1–5).

### 🌿 Linh Dược (11)

| Vật phẩm | id | Phẩm cấp | Kho lưu | Bán NPC | Nguồn nhận | Công dụng |
|---|---|---|---|---|---|---|
| Thanh Linh Thảo | `ld_thanh_linh_thao` | Phổ thông | tbl | 175 | Linh Điền (thu hoạch/biến dị); Bí Cảnh Sơ Cấp; Bí Cảnh Trung Cấp; Thu hoạch Động Phủ (mỗi giờ) | Công thức: Dược Dịch Sơ Cấp; Công thức: Pha Thúc Sinh Dịch |
| Tử Vân Hoa | `ld_tu_van_hoa` | Tốt | tbl | 525 | Linh Điền (thu hoạch/biến dị); Bí Cảnh Sơ Cấp; Bí Cảnh Trung Cấp; Bí Cảnh Cao Cấp | Công thức: Dược Dịch Trung Cấp; Công thức: Pha Dưỡng Mạch Dịch |
| Ngọc Tủy Sâm | `ld_ngoc_tuy_sam` | Hiếm | tbl | 1750 | Linh Điền (thu hoạch/biến dị); Bí Cảnh Trung Cấp; Bí Cảnh Cao Cấp; Vạn Linh Cốc | Công thức: Dược Dịch Trung Cấp; Công thức: Cường Thể Đan; Công thức: Ngưng Thần Đan |
| Hàn Nguyệt Liên | `ld_han_nguyet_lien` | Hiếm | tbl | 1750 | Linh Điền (thu hoạch/biến dị); Bí Cảnh Trung Cấp; Bí Cảnh Cao Cấp | Công thức: Thanh Tâm Đan; Công thức: Hàn Ngọc Đan |
| Xích Diễm Hoa | `ld_xich_diem_hoa` | Hiếm | tbl | 1750 | Linh Điền (thu hoạch/biến dị); Bí Cảnh Trung Cấp; Bí Cảnh Cao Cấp | Công thức: Long Lực Đan; Công thức: Liệt Dương Đan |
| Địa Mạch Chi | `ld_dia_mach_chi` | Quý hiếm | tbl | 6125 | Linh Điền (thu hoạch/biến dị); Bí Cảnh Cao Cấp; Vạn Linh Cốc; Bí Cảnh Đặc Biệt (Nhân Giới) | Nâng cấp Linh Điền; Công thức: Ngưng Nguyên Đan; Công thức: Dược Dịch Cao Cấp; Công thức: Hộ Mạch Đan |
| Huyết Ngọc Quả | `ld_huyet_ngoc_qua` | Quý hiếm | tbl | 6125 | Linh Điền (thu hoạch/biến dị); Vạn Linh Cốc; Chiến Tông Môn (thắng) | Công thức: Dược Dịch Cao Cấp |
| Cửu Diệp Linh Chi | `ld_cuu_diep_linh_chi` | Cực phẩm | tbl | 21000 | Linh Điền (thu hoạch/biến dị); Vạn Linh Cốc; Boss Vạn Linh Cốc; Bí Cảnh Đặc Biệt (Linh Giới) | Công thức: Phá Cảnh Đan; Công thức: Độ Kiếp Đan |
| Bất Lão Tiên Quả | `ld_bat_lao_tien_qua` | Truyền thuyết | tbl | 70000 | Bí Cảnh Hợp Thể (Linh Giới); Bí Cảnh Đại Thừa (Linh Giới); Bí Cảnh Thượng Cổ (Độ Kiếp); Boss Thế Giới (cấp 7–9) | Công thức: Dược Dịch Tiên |
| Hỗn Nguyên Đạo Quả | `ld_hon_nguyen_dao_qua` | Tiên phẩm | tbl | 262500 | Bí Cảnh Thượng Cổ (Độ Kiếp); Thiên Kiếp Hóa Thân | Công thức: Tiên Nguyên Đan; Công thức: Tẩy Tủy Đan (Nửa Tác Dụng) |
| Linh Dược Đặc Biệt | `ld_dac_biet` | Quý hiếm | cột cũ `linh_duoc_dac_biet` | 6125 | Bí Cảnh Sơ Cấp; Bí Cảnh Trung Cấp; Bí Cảnh Cao Cấp; Vạn Linh Cốc | Công thức: Đan Dược Phá Giới |

### ⛏️ Khoáng Vật (11)

| Vật phẩm | id | Phẩm cấp | Kho lưu | Bán NPC | Nguồn nhận | Công dụng |
|---|---|---|---|---|---|---|
| Thanh Đồng Linh Quặng | `kv_thanh_dong` | Phổ thông | tbl | 175 | Bí Cảnh Sơ Cấp; Bí Cảnh Trung Cấp; Thu hoạch Động Phủ (mỗi giờ) | Công thức: Tinh Luyện Đồng Linh |
| Huyền Tinh Thạch | `kv_huyen_tinh` | Tốt | tbl | 525 | Bí Cảnh Sơ Cấp; Bí Cảnh Trung Cấp; Chuỗi Đồng Tu (mỗi mốc); Chiến Tông Môn (thua) | Công thức: Kim Cương Đan; Công thức: Tinh Luyện Huyền Thiết |
| Xích Huyết Thiết | `kv_xich_huyet_thiet` | Hiếm | tbl | 1750 | Bí Cảnh Trung Cấp; Bí Cảnh Cao Cấp; Vạn Linh Cốc | Công thức: Tinh Luyện Tử Kim |
| Băng Phách Ngọc | `kv_bang_phach_ngoc` | Hiếm | tbl | 1750 | Bí Cảnh Trung Cấp; Bí Cảnh Cao Cấp | Công thức: Hàn Ngọc Đan; Công thức: Hộ Tâm Kính; Công thức: Đúc Phôi Khí Cao |
| Tử Kim Thạch | `kv_tu_kim_thach` | Quý hiếm | tbl | 6125 | Bí Cảnh Cao Cấp; Vạn Linh Cốc; Bí Cảnh Đặc Biệt (Nhân Giới); Rương Sự Kiện Đại Phú | Công thức: Tinh Luyện Tử Kim; Công thức: Trữ Vật Giới Chỉ |
| Thiên Ngoại Vẫn Thiết | `kv_thien_ngoai_van_thiet` | Cực phẩm | tbl | 21000 | Vạn Linh Cốc; Boss Vạn Linh Cốc; Bí Cảnh Đặc Biệt (Linh Giới); Bí Cảnh Luyện Hư (Linh Giới) | Công thức: Tinh Luyện Hỗn Nguyên; Công thức: Phá Thiên Thương |
| Cửu Thiên Kim Tinh | `kv_cuu_thien_kim_tinh` | Truyền thuyết | tbl | 70000 | Bí Cảnh Hợp Thể (Linh Giới); Bí Cảnh Đại Thừa (Linh Giới); Bí Cảnh Thượng Cổ (Độ Kiếp); Boss Thế Giới (cấp 7–9) | Công thức: Tinh Luyện Hỗn Nguyên |
| Hỗn Nguyên Kim Tinh | `kv_hon_nguyen_kim_tinh` | Tiên phẩm | tbl | 262500 | Bí Cảnh Thượng Cổ (Độ Kiếp); Thiên Kiếp Hóa Thân | Công thức: Tinh Luyện Hỗn Nguyên |
| Huyền Thiết | `kv_huyen_thiet` | Hiếm | cột cũ `huyen_thiet` | 1750 | Vạn Linh Cốc | Công thức: Tinh Luyện Huyền Thiết; Công thức: Huyền Thiết Giáp |
| Tiên Kim | `kv_tien_kim` | Cực phẩm | cột cũ `tien_kim` | 21000 | Bí Cảnh Luyện Hư (Linh Giới) | Công thức: Đúc Phôi Khí Tiên |
| Tiên Ngọc | `kv_tien_ngoc` | Cực phẩm | cột cũ `tien_ngoc` | 21000 | Bí Cảnh Luyện Hư (Linh Giới); Bí Cảnh Đại Thừa (Linh Giới) | Công thức: Tụ Linh Ngọc Bội |

### 🦴 Yêu Thú Tài Liệu (8)

| Vật phẩm | id | Phẩm cấp | Kho lưu | Bán NPC | Nguồn nhận | Công dụng |
|---|---|---|---|---|---|---|
| Yêu Đan | `yt_yeu_dan` | Tốt | tbl | 525 | Bí Cảnh Sơ Cấp; Bí Cảnh Trung Cấp; Bí Cảnh Cao Cấp; Bí Cảnh Đặc Biệt (Nhân Giới) | Cho Linh Thú ăn; Công thức: Ngưng Nguyên Đan; Công thức: Tật Phong Đan; Công thức: Phá Cảnh Đan |
| Tinh Huyết Yêu Thú | `yt_tinh_huyet` | Tốt | tbl | 525 | Bí Cảnh Trung Cấp; Boss Thế Giới (cấp 1–3); Linh Thú đồng hành (nguồn ≤ 3); Linh Thú đồng hành (nguồn ≥ 4) | Công thức: Huyết Nguyên Đan; Công thức: Cường Thể Đan; Công thức: Hộ Mạch Đan; Công thức: Tật Phong Ngoa |
| Yêu Cốt | `yt_yeu_cot` | Hiếm | tbl | 1750 | Bí Cảnh Trung Cấp; Bí Cảnh Cao Cấp; Vạn Linh Cốc; Boss Thế Giới (cấp 1–3) | Công thức: Long Lực Đan; Công thức: Thanh Phong Kiếm; Công thức: Đúc Phôi Khí Trung |
| Lân Giáp | `yt_lan_giap` | Hiếm | tbl | 1750 | Bí Cảnh Cao Cấp; Vạn Linh Cốc; Boss Thế Giới (cấp 1–3); Linh Thú đồng hành (nguồn ≤ 3) | Công thức: Kim Cương Đan; Công thức: Tật Phong Ngoa; Công thức: Huyền Thiết Giáp; Công thức: Đúc Phôi Khí Cao |
| Thú Hồn | `yt_thu_hon` | Quý hiếm | tbl | 6125 | Bí Cảnh Cao Cấp; Vạn Linh Cốc; Boss Vạn Linh Cốc; Bí Cảnh Đặc Biệt (Nhân Giới) | Công thức: Ngưng Thần Đan; Công thức: Trấn Hồn Linh; Công thức: Sát Phạt Trận Bàn |
| Hồn Tinh | `yt_hon_tinh` | Cực phẩm | tbl | 21000 | Vạn Linh Cốc; Boss Vạn Linh Cốc; Bí Cảnh Đặc Biệt (Linh Giới); Bí Cảnh Luyện Hư (Linh Giới) | Công thức: Độ Kiếp Đan; Công thức: Trấn Hồn Linh; Công thức: Mê Tung Trận; Công thức: Phong Ấn Phù |
| Long Huyết | `yt_long_huyet` | Truyền thuyết | tbl | 70000 | Bí Cảnh Đại Thừa (Linh Giới); Bí Cảnh Thượng Cổ (Độ Kiếp); Thiên Kiếp Hóa Thân; Boss Thế Giới (cấp 4–6) | Công thức: Tiên Nguyên Đan; Công thức: Phá Thiên Thương |
| Phượng Vũ | `yt_phuong_vu` | Truyền thuyết | tbl | 70000 | Bí Cảnh Đại Thừa (Linh Giới); Bí Cảnh Thượng Cổ (Độ Kiếp); Thiên Kiếp Hóa Thân; Boss Thế Giới (cấp 4–6) | Công thức: Dược Dịch Tiên |

### 🔯 Trận Đạo Tài Liệu (7)

| Vật phẩm | id | Phẩm cấp | Kho lưu | Bán NPC | Nguồn nhận | Công dụng |
|---|---|---|---|---|---|---|
| Linh Mặc | `td_linh_mac` | Phổ thông | tbl | 175 | NPC bán (Linh Thạch); Bí Cảnh Sơ Cấp; Bí Cảnh Trung Cấp | Công thức: Tụ Linh Ngọc Bội; Công thức: Khắc Trận Văn Sơ Cấp; Công thức: Khắc Trận Văn Trung Cấp; Công thức: Khắc Trận Văn Cao Cấp |
| Phù Chỉ | `td_phu_chi` | Phổ thông | tbl | 175 | NPC bán (Linh Thạch); Bí Cảnh Sơ Cấp | Công thức: Khắc Trận Văn Trung Cấp; Công thức: Phong Ấn Phù |
| Trận Văn Thạch | `td_tran_van_thach` | Tốt | tbl | 525 | Bí Cảnh Sơ Cấp; Bí Cảnh Trung Cấp | Công thức: Khắc Trận Văn Sơ Cấp; Công thức: Khắc Trận Văn Trung Cấp |
| Trận Kỳ | `td_tran_ky` | Tốt | tbl | 525 | NPC bán (Linh Thạch); Bí Cảnh Trung Cấp | Công thức: Tụ Linh Trận Bàn; Công thức: Hộ Thân Trận Kỳ; Công thức: Mê Tung Trận |
| Trận Bàn Cơ Thạch | `td_tran_ban_co_thach` | Hiếm | tbl | 1750 | Bí Cảnh Cao Cấp | Công thức: Tụ Linh Trận Bàn; Công thức: Sát Phạt Trận Bàn; Công thức: Khắc Trận Văn Cao Cấp; Công thức: Hộ Tông Đại Trận |
| Thiên Diễn Sa | `td_thien_dien_sa` | Quý hiếm | tbl | 6125 | Bí Cảnh Cao Cấp; Vạn Linh Cốc | Xúc tác Trận Pháp; Công thức: Khắc Trận Văn Trung Cấp; Công thức: Khắc Trận Văn Cao Cấp |
| Không Gian Phù Văn | `td_khong_gian_phu_van` | Cực phẩm | tbl | 21000 | Boss Vạn Linh Cốc; Bí Cảnh Đặc Biệt (Linh Giới); Bí Cảnh Hợp Thể (Linh Giới) | Công thức: Trữ Vật Giới Chỉ; Công thức: Không Gian Trận Bàn |

### 🌱 Linh Thực (8)

| Vật phẩm | id | Phẩm cấp | Kho lưu | Bán NPC | Nguồn nhận | Công dụng |
|---|---|---|---|---|---|---|
| Linh Chủng Thanh Linh | `lt_chung_thanh_linh` | Phổ thông | tbl | 175 | Linh Điền (thu hồi hạt giống); NPC bán (Linh Thạch); Bí Cảnh Sơ Cấp | Linh Điền (gieo/tưới) |
| Linh Chủng Tử Vân | `lt_chung_tu_van` | Tốt | tbl | 525 | Linh Điền (thu hồi hạt giống); NPC bán (Linh Thạch); Bí Cảnh Trung Cấp | Linh Điền (gieo/tưới) |
| Linh Chủng Hàn Nguyệt | `lt_chung_han_nguyet` | Hiếm | tbl | 1750 | Linh Điền (thu hồi hạt giống); NPC bán (Linh Thạch); Bí Cảnh Cao Cấp | Linh Điền (gieo/tưới) |
| Linh Chủng Xích Diễm | `lt_chung_xich_diem` | Hiếm | tbl | 1750 | Linh Điền (thu hồi hạt giống); NPC bán (Linh Thạch); Bí Cảnh Cao Cấp | Linh Điền (gieo/tưới) |
| Linh Thổ | `lt_linh_tho` | Phổ thông | tbl | 175 | NPC bán (Linh Thạch); Bí Cảnh Sơ Cấp; Thu hoạch Động Phủ (mỗi giờ) | Linh Điền (gieo/tưới); Công thức: Pha Thúc Sinh Dịch |
| Linh Tuyền Thủy | `lt_linh_tuyen_thuy` | Tốt | tbl | 525 | NPC bán (Linh Thạch); Bí Cảnh Sơ Cấp; Bí Cảnh Trung Cấp; Chuỗi Đồng Tu (mỗi mốc) | Linh Điền (gieo/tưới); Công thức: Dược Dịch Sơ Cấp; Công thức: Dược Dịch Trung Cấp; Công thức: Dược Dịch Cao Cấp |
| Thúc Sinh Dịch | `lt_thuc_sinh_dich` | Hiếm | tbl | 1260 | Chế: Pha Thúc Sinh Dịch (Linh Thực Sư cấp 2) | Bón Linh Điền |
| Dưỡng Mạch Dịch | `lt_duong_mach_dich` | Quý hiếm | tbl | 2100 | Chế: Pha Dưỡng Mạch Dịch (Linh Thực Sư cấp 4) | Bón Linh Điền |

### 🌌 Thiên Địa Chí Bảo (22)

| Vật phẩm | id | Phẩm cấp | Kho lưu | Bán NPC | Nguồn nhận | Công dụng |
|---|---|---|---|---|---|---|
| Hư Không Toái Phiến | `tdc_hu_khong_toai_phien` | Truyền thuyết | tbl | 70000 | Bí Cảnh Hợp Thể (Linh Giới); Bí Cảnh Đại Thừa (Linh Giới); Bí Cảnh Thượng Cổ (Độ Kiếp); Thiên Kiếp Hóa Thân | Công thức: Đúc Phôi Khí Tiên; Công thức: Không Gian Trận Bàn |
| Hỗn Độn Nguyên Khí | `tdc_hon_don_nguyen_khi` | Tiên phẩm | tbl | 262500 | Bí Cảnh Thượng Cổ (Độ Kiếp); Thiên Kiếp Hóa Thân; Boss Thế Giới (cấp 7–9) | Công thức: Tẩy Tủy Đan (Nửa Tác Dụng) |
| Tàn Quyển Đan Phương | `tdc_tan_quyen_dan_phuong` | Quý hiếm | tbl | 6125 | Vạn Linh Cốc; Bí Cảnh Đặc Biệt (Nhân Giới); Boss Thế Giới (cấp 4–6); Rương Sự Kiện Đại Phú | Đọc để tăng EXP Đan Sư; Công thức: Tẩy Tủy Đan (Nửa Tác Dụng) |
| Mảnh Bản Vẽ Pháp Bảo | `tdc_manh_ban_ve` | Quý hiếm | tbl | 6125 | Phân giải trang bị; Vạn Linh Cốc; Bí Cảnh Đặc Biệt (Nhân Giới); Bí Cảnh Đặc Biệt (Linh Giới) | Tinh luyện trang bị; Công thức: Phá Thiên Thương |
| Cổ Trận Đồ | `tdc_co_tran_do` | Cực phẩm | tbl | 21000 | Boss Vạn Linh Cốc; Bí Cảnh Đặc Biệt (Linh Giới); Bí Cảnh Hợp Thể (Linh Giới); Bí Cảnh Đại Thừa (Linh Giới) | Công thức: Hộ Tông Đại Trận; Công thức: Không Gian Trận Bàn |
| Đan Hỏa Tinh | `tdc_dan_hoa_tinh` | Hiếm | tbl | 1750 | Bí Cảnh Cao Cấp; Bí Cảnh Đặc Biệt (Nhân Giới); Boss Thế Giới (cấp 1–3); Chuỗi Đồng Tu (mỗi mốc) | Xúc tác Đan Sư; Công thức: Phá Cảnh Đan; Công thức: Liệt Dương Đan |
| Khí Linh Hạch | `tdc_khi_linh_hach` | Quý hiếm | tbl | 6125 | Phân giải trang bị; Bí Cảnh Cao Cấp; Vạn Linh Cốc; Boss Vạn Linh Cốc | Công thức: Hộ Tâm Kính; Công thức: Huyền Thiết Giáp; Công thức: Tụ Linh Ngọc Bội; Công thức: Trấn Hồn Linh |
| Thiên Cơ Phù Văn | `tdc_thien_co_phu_van` | Cực phẩm | tbl | 21000 | Vạn Linh Cốc; Boss Vạn Linh Cốc; Bí Cảnh Đặc Biệt (Nhân Giới); Bí Cảnh Đặc Biệt (Linh Giới) | Công thức: Khắc Trận Văn Cao Cấp; Công thức: Mê Tung Trận; Công thức: Phong Ấn Phù |
| Hư Không Tinh Hoa | `tdc_hu_khong_tinh_hoa` | Quý hiếm | cột cũ `hu_khong_tinh_hoa` | 6125 | Vạn Linh Cốc | Công thức: Không Gian Trận Bàn |
| Hư Không Kết Tinh | `tdc_hu_khong_ket_tinh` | Truyền thuyết | cột cũ `hu_khong_ket_tinh` | 70000 | Bí Cảnh Hợp Thể (Linh Giới) | Công thức: Không Gian Trận Bàn |
| Thiên Hỏa Tinh | `tdc_thien_hoa_tinh` | Cực phẩm | cột cũ `thien_hoa_tinh` | 21000 | Bí Cảnh Luyện Hư (Linh Giới) | Công thức: Tiên Nguyên Đan |
| Thiên Kiếp Chi Lực | `tdc_thien_kiep_chi_luc` | Cực phẩm | cột cũ `thien_kiep_chi_luc` | không bán | Thiên Kiếp Hóa Thân | Công thức: Phá Thiên Thương |
| Thiên Đạo Thạch | `tdc_thien_dao_thach` | Cực phẩm | cột cũ `thien_dao_thach` | không bán | Bí Cảnh Hợp Thể (Linh Giới) | Đổi Bảo Thạch Thể Chất/Linh Căn |
| Đạo Nguyên Tinh | `tdc_dao_nguyen_tinh` | Truyền thuyết | cột cũ `dao_nguyen_tinh` | không bán | Bí Cảnh Đại Thừa (Linh Giới); Bí Cảnh Thượng Cổ (Độ Kiếp) | Đổi Bảo Thạch Thể Chất/Linh Căn |
| Thiên Đạo Ấn | `tdc_thien_dao_an` | Truyền thuyết | cột cũ `thien_dao_an` | không bán | Thiên Kiếp Hóa Thân | Thiên Đạo |
| Mảnh Tiên Giới Lệnh | `tdc_manh_tien_gioi_lenh` | Cực phẩm | cột cũ `manh_tien_gioi_lenh` | không bán | Bí Cảnh Hợp Thể (Linh Giới); Bí Cảnh Đại Thừa (Linh Giới) | Con Đường Phi Thăng |
| Mảnh ghép Phi Thăng Lệnh | `tdc_manh_ghep_phithang` | Quý hiếm | cột cũ `manh_ghep_phithang` | không bán | Bí Cảnh Trung Cấp; Bí Cảnh Cao Cấp; Vạn Linh Cốc | Con Đường Phi Thăng |
| Linh Giới Lệnh | `tdc_linh_gioi_lenh` | Cực phẩm | cột cũ `linh_gioi_lenh` | không bán | Phi Thăng | Con Đường Phi Thăng |
| Tiên Giới Lệnh | `tdc_tien_gioi_lenh` | Truyền thuyết | cột cũ `tien_lenh` | không bán | Phi Thăng | Con Đường Phi Thăng |
| Linh Phù | `tdc_linh_phu` | Quý hiếm | cột cũ `linh_phu` | không bán | Bí Cảnh Trung Cấp; Bí Cảnh Cao Cấp; Vạn Linh Cốc | Con Đường Phi Thăng |
| Tiên Phù | `tdc_tien_phu` | Cực phẩm | cột cũ `tien_phu` | không bán | Bí Cảnh Luyện Hư (Linh Giới); Bí Cảnh Hợp Thể (Linh Giới); Bí Cảnh Đại Thừa (Linh Giới); Bí Cảnh Thượng Cổ (Độ Kiếp) | Con Đường Phi Thăng |
| Điểm Linh Ngộ | `tdc_diem_linh_ngo` | Quý hiếm | cột cũ `diem_linh_ngo` | không bán | Bí Cảnh Hợp Thể (Linh Giới); Bí Cảnh Đại Thừa (Linh Giới); Bí Cảnh Thượng Cổ (Độ Kiếp) | Con Đường Phi Thăng |

### ⚗️ Nguyên Liệu Trung Gian (17)

| Vật phẩm | id | Phẩm cấp | Kho lưu | Bán NPC | Nguồn nhận | Công dụng |
|---|---|---|---|---|---|---|
| Nguyên Liệu Tạp | `nl_tap` | Phổ thông | cột cũ `nguyen_lieu` | 175 | NPC bán (Linh Thạch); Bí Cảnh Sơ Cấp; Bí Cảnh Trung Cấp; Bí Cảnh Cao Cấp | Cho Linh Thú ăn; Công thức: Tụ Khí Đan; Công thức: Tinh Luyện Đồng Linh; Công thức: Đúc Phôi Khí Thô |
| Mảnh Pháp Bảo | `nl_manh_phap_bao` | Hiếm | cột cũ `manh_phap_bao` | 1750 | Vạn Linh Cốc | Cường hoá trang bị; Tinh luyện trang bị; Xúc tác Luyện Khí |
| Dược Dịch Sơ Cấp | `dd_so` | Tốt | tbl | 490 | Chế: Dược Dịch Sơ Cấp (Đan Sư cấp 1) | Công thức: Tụ Khí Đan; Công thức: Huyết Nguyên Đan; Công thức: Cường Thể Đan |
| Dược Dịch Trung Cấp | `dd_trung` | Hiếm | tbl | 1540 | Chế: Dược Dịch Trung Cấp (Đan Sư cấp 2) | Công thức: Thanh Tâm Đan; Công thức: Ngưng Nguyên Đan; Công thức: Kim Cương Đan; Công thức: Long Lực Đan |
| Dược Dịch Cao Cấp | `dd_cao` | Quý hiếm | tbl | 12684 | Chế: Dược Dịch Cao Cấp (Đan Sư cấp 4) | Công thức: Tật Phong Đan; Công thức: Hộ Mạch Đan; Công thức: Ngưng Thần Đan; Công thức: Phá Cảnh Đan |
| Dược Dịch Tiên | `dd_tien` | Truyền thuyết | tbl | 133134 | Chế: Dược Dịch Tiên (Đan Sư cấp 6) | Công thức: Tiên Nguyên Đan; Công thức: Tẩy Tủy Đan (Nửa Tác Dụng) |
| Đồng Linh Tinh Luyện | `kl_dong` | Tốt | tbl | 560 | Chế: Tinh Luyện Đồng Linh (Luyện Khí Sư cấp 1) | Cường hoá trang bị; Sửa trang bị; Công thức: Đúc Phôi Khí Thô |
| Huyền Thiết Tinh Luyện | `kl_huyen` | Hiếm | tbl | 2030 | Chế: Tinh Luyện Huyền Thiết (Luyện Khí Sư cấp 2) | Cường hoá trang bị; Công thức: Đúc Phôi Khí Trung |
| Tử Kim Tinh Luyện | `kl_tu` | Quý hiếm | tbl | 6300 | Chế: Tinh Luyện Tử Kim (Luyện Khí Sư cấp 4) | Cường hoá trang bị; Công thức: Đúc Phôi Khí Cao |
| Hỗn Nguyên Kim Tinh Luyện | `kl_hon` | Truyền thuyết | tbl | 149800 | Chế: Tinh Luyện Hỗn Nguyên (Luyện Khí Sư cấp 6) | Cường hoá trang bị; Công thức: Đúc Phôi Khí Tiên |
| Phôi Khí Thô | `pk_tho` | Phổ thông | tbl | 2016 | Phân giải trang bị; Chế: Đúc Phôi Khí Thô (Luyện Khí Sư cấp 1) | Công thức: Thanh Phong Kiếm |
| Phôi Khí Trung | `pk_trung` | Hiếm | tbl | 4648 | Phân giải trang bị; Chế: Đúc Phôi Khí Trung (Luyện Khí Sư cấp 3) | Công thức: Tật Phong Ngoa; Công thức: Hộ Tâm Kính; Công thức: Huyền Thiết Giáp |
| Phôi Khí Cao | `pk_cao` | Quý hiếm | tbl | 17780 | Phân giải trang bị; Chế: Đúc Phôi Khí Cao (Luyện Khí Sư cấp 5) | Công thức: Tụ Linh Ngọc Bội; Công thức: Trấn Hồn Linh; Công thức: Trữ Vật Giới Chỉ |
| Phôi Khí Tiên | `pk_tien` | Truyền thuyết | tbl | 312480 | Phân giải trang bị; Chế: Đúc Phôi Khí Tiên (Luyện Khí Sư cấp 7) | Công thức: Phá Thiên Thương |
| Trận Văn Sơ Cấp | `tv_so` | Tốt | tbl | 560 | Chế: Khắc Trận Văn Sơ Cấp (Trận Pháp Sư cấp 1) | Công thức: Tụ Linh Trận Bàn; Công thức: Hộ Thân Trận Kỳ |
| Trận Văn Trung Cấp | `tv_trung` | Hiếm | tbl | 3080 | Chế: Khắc Trận Văn Trung Cấp (Trận Pháp Sư cấp 3) | Công thức: Sát Phạt Trận Bàn; Công thức: Mê Tung Trận; Công thức: Phong Ấn Phù |
| Trận Văn Cao Cấp | `tv_cao` | Quý hiếm | tbl | 12390 | Chế: Khắc Trận Văn Cao Cấp (Trận Pháp Sư cấp 5) | Công thức: Hộ Tông Đại Trận; Công thức: Không Gian Trận Bàn |

### 💊 Đan Dược (18)

| Vật phẩm | id | Phẩm cấp | Kho lưu | Bán NPC | Nguồn nhận | Công dụng |
|---|---|---|---|---|---|---|
| Tụ Khí Đan | `dan_tu_khi` | Phổ thông | cột cũ `dan_duoc` | 750 (Trung phẩm) | Chế: Tụ Khí Đan (Đan Sư cấp 1) | Dùng (cắn đan) |
| Ngưng Nguyên Đan | `dan_ngung_nguyen` | Hiếm | tbl | 5351 (Trung phẩm) | Chế: Ngưng Nguyên Đan (Đan Sư cấp 3) | Dùng (cắn đan) |
| Huyết Nguyên Đan | `dan_huyet_nguyen` | Phổ thông | tbl | 413 (Trung phẩm) | Chế: Huyết Nguyên Đan (Đan Sư cấp 1) | Dùng (cắn đan) |
| Thanh Tâm Đan | `dan_thanh_tam` | Tốt | tbl | 904 (Trung phẩm) | Chế: Thanh Tâm Đan (Đan Sư cấp 2) | Dùng (cắn đan) |
| Hộ Mạch Đan | `dan_ho_mach` | Quý hiếm | tbl | 10633 (Trung phẩm) | Chế: Hộ Mạch Đan (Đan Sư cấp 4) | Dùng (cắn đan) |
| Phá Cảnh Đan | `dan_pha_canh` | Quý hiếm | tbl | 19777 (Trung phẩm) | Chế: Phá Cảnh Đan (Đan Sư cấp 5) | Dùng (cắn đan) |
| Ngưng Thần Đan | `dan_ngung_than` | Hiếm | tbl | 11307 (Trung phẩm) | Chế: Ngưng Thần Đan (Đan Sư cấp 4) | Dùng (cắn đan) |
| Cường Thể Đan | `dan_cuong_the` | Tốt | tbl | 1790 (Trung phẩm) | Chế: Cường Thể Đan (Đan Sư cấp 2) | Dùng (cắn đan) |
| Kim Cương Đan | `dan_kim_cuong` | Hiếm | tbl | 2945 (Trung phẩm) | Chế: Kim Cương Đan (Đan Sư cấp 3) | Dùng (cắn đan) |
| Long Lực Đan | `dan_long_luc` | Hiếm | tbl | 3619 (Trung phẩm) | Chế: Long Lực Đan (Đan Sư cấp 3) | Dùng (cắn đan) |
| Tật Phong Đan | `dan_tat_phong` | Hiếm | tbl | 18814 (Trung phẩm) | Chế: Tật Phong Đan (Đan Sư cấp 4) | Dùng (cắn đan) |
| Hàn Ngọc Đan | `dan_han_ngoc` | Quý hiếm | tbl | 13232 (Trung phẩm) | Chế: Hàn Ngọc Đan (Đan Sư cấp 5) | Dùng (cắn đan) |
| Liệt Dương Đan | `dan_liet_duong` | Quý hiếm | tbl | 13232 (Trung phẩm) | Chế: Liệt Dương Đan (Đan Sư cấp 5) | Dùng (cắn đan) |
| Độ Kiếp Đan | `dan_do_kiep` | Cực phẩm | tbl | 48602 (Trung phẩm) | Chế: Độ Kiếp Đan (Đan Sư cấp 6) | Dùng (cắn đan) |
| Tiên Nguyên Đan | `dan_tien_nguyen` | Cực phẩm | tbl | 267648 (Trung phẩm) | Chế: Tiên Nguyên Đan (Đan Sư cấp 7) | Dùng (cắn đan) |
| Đan Dược Phá Giới | `dan_pha_gioi` | Cực phẩm | cột cũ `dan_pha_gioi` | 16843 | Cửa Hàng Đan Dược; Chế: Đan Dược Phá Giới (Đan Sư cấp 5) | Dùng (cắn đan) |
| Đan Tẩy Tủy Trọng Sinh | `dan_tay_tuy_ts` | Tiên phẩm | cột cũ `dan_taytuy_trongsinh` | không bán | Mã code | Tẩy Tủy |
| Đan Tẩy Tủy Nửa Tác Dụng | `dan_tay_tuy_nua` | Truyền thuyết | cột cũ `dan_taytuy_nuaban` | không bán | Mã code; Chế: Tẩy Tủy Đan (Nửa Tác Dụng) (Đan Sư cấp 8) | Tẩy Tủy |

### 🧿 Trận Pháp (7)

| Vật phẩm | id | Phẩm cấp | Kho lưu | Bán NPC | Nguồn nhận | Công dụng |
|---|---|---|---|---|---|---|
| Tụ Linh Trận Bàn | `tp_tu_linh` | Tốt | tbl | 1867 (Trung phẩm) | Chế: Tụ Linh Trận Bàn (Trận Pháp Sư cấp 1) | Triển khai trận pháp |
| Hộ Thân Trận Kỳ | `tp_ho_than` | Hiếm | tbl | 1482 (Trung phẩm) | Chế: Hộ Thân Trận Kỳ (Trận Pháp Sư cấp 3) | Triển khai trận pháp |
| Sát Phạt Trận Bàn | `tp_sat_phat` | Hiếm | tbl | 8681 (Trung phẩm) | Chế: Sát Phạt Trận Bàn (Trận Pháp Sư cấp 4) | Triển khai trận pháp |
| Mê Tung Trận | `tp_me_tung` | Quý hiếm | tbl | 27065 (Trung phẩm) | Chế: Mê Tung Trận (Trận Pháp Sư cấp 5) | Triển khai trận pháp |
| Phong Ấn Phù | `tp_phong_an` | Quý hiếm | tbl | 25275 (Trung phẩm) | Chế: Phong Ấn Phù (Trận Pháp Sư cấp 5) | Triển khai trận pháp |
| Hộ Tông Đại Trận | `tp_ho_tong` | Cực phẩm | tbl | 61349 (Trung phẩm) | Chế: Hộ Tông Đại Trận (Trận Pháp Sư cấp 7) | Triển khai trận pháp |
| Không Gian Trận Bàn | `tp_khong_gian` | Cực phẩm | tbl | 173885 (Trung phẩm) | Chế: Không Gian Trận Bàn (Trận Pháp Sư cấp 8) | Triển khai trận pháp |

### 🎁 Vật Phẩm Khác (2)

| Vật phẩm | id | Phẩm cấp | Kho lưu | Bán NPC | Nguồn nhận | Công dụng |
|---|---|---|---|---|---|---|
| Rương Thần Bí | `vp_ruong_than_bi` | Cực phẩm | cột cũ `ruong_than_bi` | không bán | Rương Sự Kiện Đại Phú; Mã code | Mở Rương |
| Vé Bí Cảnh Đặc Biệt | `vp_ve_bicanh_db` | Cực phẩm | cột cũ `ve_bicanh_dac_biet` | không bán | Boss Thế Giới (kết liễu) | Vào Bí Cảnh Đặc Biệt |

### 🌠 Linh Tinh Tài Liệu (Tinh Hoa) (7)

| Vật phẩm | id | Phẩm cấp | Kho lưu | Bán NPC | Nguồn nhận | Công dụng |
|---|---|---|---|---|---|---|
| Kim Nguyên Tinh | `tdc_kim_nguyen_tinh` | Quý hiếm | tbl | 6125 | Bí Cảnh Cao Cấp; Vạn Linh Cốc | Công thức: Đúc Phôi Khí Cao |
| Mộc Nguyên Tinh | `tdc_moc_nguyen_tinh` | Quý hiếm | tbl | 6125 | Bí Cảnh Cao Cấp; Vạn Linh Cốc | Nâng cấp Linh Điền |
| Thủy Nguyên Tinh | `tdc_thuy_nguyen_tinh` | Quý hiếm | tbl | 6125 | Bí Cảnh Cao Cấp; Vạn Linh Cốc | Công thức: Hàn Ngọc Đan |
| Hỏa Nguyên Tinh | `tdc_hoa_nguyen_tinh` | Quý hiếm | tbl | 6125 | Bí Cảnh Cao Cấp; Vạn Linh Cốc | Công thức: Liệt Dương Đan |
| Thổ Nguyên Tinh | `tdc_tho_nguyen_tinh` | Quý hiếm | tbl | 6125 | Bí Cảnh Cao Cấp; Vạn Linh Cốc | Công thức: Hộ Tông Đại Trận |
| Phong Linh Tủy | `tdc_phong_linh_tuy` | Cực phẩm | tbl | 21000 | Vạn Linh Cốc; Boss Vạn Linh Cốc; Bí Cảnh Đặc Biệt (Nhân Giới); Bí Cảnh Đặc Biệt (Linh Giới) | Công thức: Tật Phong Đan |
| Lôi Linh Tủy | `tdc_loi_linh_tuy` | Cực phẩm | tbl | 21000 | Boss Vạn Linh Cốc; Bí Cảnh Đặc Biệt (Nhân Giới); Bí Cảnh Đặc Biệt (Linh Giới); Bí Cảnh Luyện Hư (Linh Giới) | Công thức: Độ Kiếp Đan |

## 3. Công thức nghề

### Đan Sư (21 công thức)

| Công thức | Cấp | Cảnh giới | Nguyên liệu | Linh Thạch | Sản phẩm | Thời gian | Thành công |
|---|---|---|---|---|---|---|---|
| Dược Dịch Sơ Cấp | Học Đồ | Phàm Nhân | 4 Thanh Linh Thảo, 1 Linh Tuyền Thủy | 100 | 2 × Dược Dịch Sơ Cấp | 2′ | 95% |
| Tụ Khí Đan | Học Đồ | Phàm Nhân | 5 Nguyên Liệu Tạp, 1 Dược Dịch Sơ Cấp | 200 | 1 × Tụ Khí Đan | 5′ | 90% |
| Huyết Nguyên Đan | Học Đồ | Phàm Nhân | 2 Dược Dịch Sơ Cấp, 1 Tinh Huyết Yêu Thú | 300 | 2 × Huyết Nguyên Đan | 4′ | 90% |
| Dược Dịch Trung Cấp | Sơ Cấp | Phàm Nhân | 3 Tử Vân Hoa, 1 Ngọc Tủy Sâm, 1 Linh Tuyền Thủy | 600 | 2 × Dược Dịch Trung Cấp | 3′ | 92% |
| Thanh Tâm Đan | Sơ Cấp | Phàm Nhân | 1 Dược Dịch Trung Cấp, 1 Hàn Nguyệt Liên | 800 | 2 × Thanh Tâm Đan | 5′ | 90% |
| Cường Thể Đan | Sơ Cấp | Phàm Nhân | 2 Dược Dịch Sơ Cấp, 1 Ngọc Tủy Sâm, 1 Tinh Huyết Yêu Thú | 900 | 1 × Cường Thể Đan | 6′ | 88% |
| Ngưng Nguyên Đan | Trung Cấp | Phàm Nhân | 2 Dược Dịch Trung Cấp, 1 Yêu Đan, 1 Địa Mạch Chi | 2500 | 1 × Ngưng Nguyên Đan | 10′ | 85% |
| Kim Cương Đan | Trung Cấp | Phàm Nhân | 2 Dược Dịch Trung Cấp, 1 Lân Giáp, 1 Huyền Tinh Thạch | 2000 | 1 × Kim Cương Đan | 8′ | 86% |
| Long Lực Đan | Trung Cấp | Phàm Nhân | 2 Dược Dịch Trung Cấp, 1 Yêu Cốt, 1 Xích Diễm Hoa | 2000 | 1 × Long Lực Đan | 8′ | 86% |
| Dược Dịch Cao Cấp | Cao Cấp | Phàm Nhân | 2 Dược Dịch Trung Cấp, 1 Địa Mạch Chi, 1 Huyết Ngọc Quả, 1 Linh Tuyền Thủy | 3000 | 1 × Dược Dịch Cao Cấp | 5′ | 90% |
| Tật Phong Đan | Cao Cấp | Phàm Nhân | 1 Dược Dịch Cao Cấp, 1 Phong Linh Tủy, 1 Yêu Đan | 5000 | 1 × Tật Phong Đan | 10′ | 84% |
| Hộ Mạch Đan | Cao Cấp | Phàm Nhân | 1 Dược Dịch Cao Cấp, 1 Địa Mạch Chi, 1 Tinh Huyết Yêu Thú | 6000 | 1 × Hộ Mạch Đan | 12′ | 82% |
| Ngưng Thần Đan | Cao Cấp | Phàm Nhân | 1 Dược Dịch Cao Cấp, 1 Thú Hồn, 1 Ngọc Tủy Sâm | 6000 | 1 × Ngưng Thần Đan | 12′ | 82% |
| Phá Cảnh Đan | Đại Sư | Phàm Nhân | 1 Dược Dịch Cao Cấp, 1 Cửu Diệp Linh Chi, 1 Đan Hỏa Tinh, 1 Yêu Đan | 20000 | 1 × Phá Cảnh Đan | 20′ | 75% |
| Hàn Ngọc Đan | Đại Sư | Phàm Nhân | 1 Dược Dịch Cao Cấp, 2 Hàn Nguyệt Liên, 1 Băng Phách Ngọc, 1 Thủy Nguyên Tinh | 15000 | 1 × Hàn Ngọc Đan | 15′ | 78% |
| Liệt Dương Đan | Đại Sư | Phàm Nhân | 1 Dược Dịch Cao Cấp, 2 Xích Diễm Hoa, 1 Đan Hỏa Tinh, 1 Hỏa Nguyên Tinh | 15000 | 1 × Liệt Dương Đan | 15′ | 78% |
| Đan Dược Phá Giới | Đại Sư | Phàm Nhân | 5 Linh Dược Đặc Biệt | 0 | 1 × Đan Dược Phá Giới | 0′ | 100% |
| Dược Dịch Tiên | Tông Sư | Hóa Thần | 1 Bất Lão Tiên Quả, 1 Phượng Vũ, 2 Dược Dịch Cao Cấp, 2 Linh Tuyền Thủy | 60000 | 1 × Dược Dịch Tiên | 15′ | 85% |
| Độ Kiếp Đan | Tông Sư | Nguyên Anh | 2 Dược Dịch Cao Cấp, 1 Lôi Linh Tủy, 1 Cửu Diệp Linh Chi, 1 Hồn Tinh | 120000 | 1 × Độ Kiếp Đan | 30′ | 70% |
| Tiên Nguyên Đan | Đại Tông Sư | Luyện Hư | 1 Dược Dịch Tiên, 1 Hỗn Nguyên Đạo Quả, 1 Long Huyết, 1 Thiên Hỏa Tinh | 400000 | 1 × Tiên Nguyên Đan | 60′ | 65% |
| Tẩy Tủy Đan (Nửa Tác Dụng) | Thánh Sư | Đại Thừa | 3 Tàn Quyển Đan Phương, 2 Dược Dịch Tiên, 1 Hỗn Nguyên Đạo Quả, 1 Hỗn Độn Nguyên Khí | 5000000 | 1 × Đan Tẩy Tủy Nửa Tác Dụng | 120′ | 30% |

### Luyện Khí Sư (16 công thức)

| Công thức | Cấp | Cảnh giới | Nguyên liệu | Linh Thạch | Sản phẩm | Thời gian | Thành công |
|---|---|---|---|---|---|---|---|
| Tinh Luyện Đồng Linh | Học Đồ | Phàm Nhân | 4 Thanh Đồng Linh Quặng, 4 Nguyên Liệu Tạp | 200 | 2 × Đồng Linh Tinh Luyện | 2′ | 95% |
| Đúc Phôi Khí Thô | Học Đồ | Phàm Nhân | 2 Đồng Linh Tinh Luyện, 8 Nguyên Liệu Tạp | 300 | 1 × Phôi Khí Thô | 3′ | 92% |
| Tinh Luyện Huyền Thiết | Sơ Cấp | Phàm Nhân | 3 Huyền Tinh Thạch, 2 Huyền Thiết | 800 | 2 × Huyền Thiết Tinh Luyện | 3′ | 92% |
| Thanh Phong Kiếm | Sơ Cấp | Phàm Nhân | 2 Phôi Khí Thô, 1 Yêu Cốt | 3000 | trang bị Thanh Phong Kiếm | 15′ | 85% |
| Đúc Phôi Khí Trung | Trung Cấp | Phàm Nhân | 2 Huyền Thiết Tinh Luyện, 1 Yêu Cốt | 1500 | 1 × Phôi Khí Trung | 5′ | 90% |
| Tật Phong Ngoa | Trung Cấp | Phàm Nhân | 1 Phôi Khí Trung, 1 Lân Giáp, 2 Tinh Huyết Yêu Thú | 6000 | trang bị Tật Phong Ngoa | 20′ | 82% |
| Hộ Tâm Kính | Trung Cấp | Phàm Nhân | 1 Phôi Khí Trung, 2 Băng Phách Ngọc, 1 Khí Linh Hạch | 8000 | trang bị Hộ Tâm Kính | 20′ | 80% |
| Tinh Luyện Tử Kim | Cao Cấp | Phàm Nhân | 2 Tử Kim Thạch, 2 Xích Huyết Thiết | 4000 | 2 × Tử Kim Tinh Luyện | 5′ | 90% |
| Huyền Thiết Giáp | Cao Cấp | Phàm Nhân | 2 Phôi Khí Trung, 3 Huyền Thiết, 3 Lân Giáp, 1 Khí Linh Hạch | 20000 | trang bị Huyền Thiết Giáp | 30′ | 80% |
| Đúc Phôi Khí Cao | Đại Sư | Phàm Nhân | 2 Tử Kim Tinh Luyện, 1 Lân Giáp, 1 Băng Phách Ngọc, 1 Kim Nguyên Tinh | 10000 | 1 × Phôi Khí Cao | 10′ | 88% |
| Tụ Linh Ngọc Bội | Đại Sư | Luyện Hư | 1 Phôi Khí Cao, 2 Tiên Ngọc, 2 Linh Mặc, 1 Khí Linh Hạch | 60000 | trang bị Tụ Linh Ngọc Bội | 40′ | 78% |
| Trấn Hồn Linh | Đại Sư | Kết Đan | 1 Phôi Khí Cao, 2 Thú Hồn, 1 Hồn Tinh, 1 Khí Linh Hạch | 60000 | trang bị Trấn Hồn Linh | 40′ | 78% |
| Tinh Luyện Hỗn Nguyên | Tông Sư | Hóa Thần | 1 Hỗn Nguyên Kim Tinh, 1 Cửu Thiên Kim Tinh, 2 Thiên Ngoại Vẫn Thiết | 100000 | 2 × Hỗn Nguyên Kim Tinh Luyện | 15′ | 85% |
| Trữ Vật Giới Chỉ | Tông Sư | Luyện Hư | 1 Phôi Khí Cao, 2 Không Gian Phù Văn, 2 Tử Kim Thạch, 2 Khí Linh Hạch | 200000 | trang bị Trữ Vật Giới Chỉ | 50′ | 75% |
| Đúc Phôi Khí Tiên | Đại Tông Sư | Luyện Hư | 2 Hỗn Nguyên Kim Tinh Luyện, 1 Tiên Kim, 1 Hư Không Toái Phiến | 300000 | 1 × Phôi Khí Tiên | 30′ | 80% |
| Phá Thiên Thương | Đại Tông Sư | Luyện Hư | 1 Phôi Khí Tiên, 2 Thiên Ngoại Vẫn Thiết, 1 Long Huyết, 2 Khí Linh Hạch, 1 Mảnh Bản Vẽ Pháp Bảo, 1 Thiên Kiếp Chi Lực | 600000 | trang bị Phá Thiên Thương | 70′ | 70% |

### Trận Pháp Sư (10 công thức)

| Công thức | Cấp | Cảnh giới | Nguyên liệu | Linh Thạch | Sản phẩm | Thời gian | Thành công |
|---|---|---|---|---|---|---|---|
| Khắc Trận Văn Sơ Cấp | Học Đồ | Phàm Nhân | 2 Trận Văn Thạch, 2 Linh Mặc | 150 | 2 × Trận Văn Sơ Cấp | 2′ | 95% |
| Tụ Linh Trận Bàn | Học Đồ | Phàm Nhân | 2 Trận Văn Sơ Cấp, 1 Trận Bàn Cơ Thạch, 1 Trận Kỳ | 1000 | 1 × Tụ Linh Trận Bàn | 10′ | 88% |
| Khắc Trận Văn Trung Cấp | Trung Cấp | Phàm Nhân | 2 Trận Văn Thạch, 1 Thiên Diễn Sa, 2 Linh Mặc, 1 Phù Chỉ | 2000 | 2 × Trận Văn Trung Cấp | 4′ | 90% |
| Hộ Thân Trận Kỳ | Trung Cấp | Phàm Nhân | 2 Trận Văn Sơ Cấp, 2 Trận Kỳ, 1 Yêu Đan | 4000 | 1 × Hộ Thân Trận Kỳ | 15′ | 85% |
| Sát Phạt Trận Bàn | Cao Cấp | Phàm Nhân | 2 Trận Văn Trung Cấp, 2 Trận Bàn Cơ Thạch, 1 Thú Hồn | 12000 | 1 × Sát Phạt Trận Bàn | 20′ | 82% |
| Khắc Trận Văn Cao Cấp | Đại Sư | Phàm Nhân | 2 Trận Bàn Cơ Thạch, 1 Thiên Diễn Sa, 1 Thiên Cơ Phù Văn, 2 Linh Mặc | 15000 | 2 × Trận Văn Cao Cấp | 8′ | 88% |
| Mê Tung Trận | Đại Sư | Phàm Nhân | 2 Trận Văn Trung Cấp, 2 Trận Kỳ, 1 Thiên Cơ Phù Văn, 1 Hồn Tinh | 30000 | 1 × Mê Tung Trận | 25′ | 78% |
| Phong Ấn Phù | Đại Sư | Phàm Nhân | 1 Trận Văn Trung Cấp, 3 Phù Chỉ, 2 Linh Mặc, 1 Thiên Cơ Phù Văn, 1 Hồn Tinh | 30000 | 1 × Phong Ấn Phù | 25′ | 78% |
| Hộ Tông Đại Trận | Đại Tông Sư | Luyện Hư | 3 Trận Văn Cao Cấp, 3 Trận Bàn Cơ Thạch, 1 Cổ Trận Đồ, 2 Hồn Tinh, 1 Thổ Nguyên Tinh | 400000 | 1 × Hộ Tông Đại Trận | 60′ | 68% |
| Không Gian Trận Bàn | Thánh Sư | Đại Thừa | 2 Trận Văn Cao Cấp, 2 Không Gian Phù Văn, 1 Hư Không Toái Phiến, 2 Hư Không Kết Tinh, 1 Cổ Trận Đồ, 3 Hư Không Tinh Hoa | 800000 | 1 × Không Gian Trận Bàn | 90′ | 62% |

### Linh Thực Sư (2 công thức)

| Công thức | Cấp | Cảnh giới | Nguyên liệu | Linh Thạch | Sản phẩm | Thời gian | Thành công |
|---|---|---|---|---|---|---|---|
| Pha Thúc Sinh Dịch | Sơ Cấp | Phàm Nhân | 2 Linh Tuyền Thủy, 2 Thanh Linh Thảo, 1 Linh Thổ | 500 | 1 × Thúc Sinh Dịch | 5′ | 92% |
| Pha Dưỡng Mạch Dịch | Cao Cấp | Phàm Nhân | 2 Linh Tuyền Thủy, 2 Tử Vân Hoa, 1 Tinh Huyết Yêu Thú | 3000 | 1 × Dưỡng Mạch Dịch | 10′ | 88% |

