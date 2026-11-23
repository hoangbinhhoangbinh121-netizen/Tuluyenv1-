# 31 EMOJI CHỦNG TỘC (V21.5) — GHI CHÚ ĐỂ BẠN VẼ LẠI

Ảnh đánh số: `docs/audit_v21_3/emoji_v21_5_danh_so.png` (đọc từ trái sang phải, trên xuống dưới, **#1 → #31**, cùng thứ tự với ảnh bạn gửi).
**Cập nhật v21.6.1:** 31 emoji này đã được **thay bằng bản bạn tự vẽ** (bảng `assets/source/race_sheet_v21_7.png`). Tài liệu dưới đây mô tả bản tạm cũ do mình vẽ bằng code (`scripts/make_pixel_emoji_v21_5.py`) và vẫn dùng được làm quy cách nếu vẽ lại lần nữa.

## A. QUY CÁCH CHUNG (áp cho cả 31 cái)

| Mục | Quy định |
|---|---|
| Tên file | `<key>.png` đúng như cột "Key" bên dưới (VD `race_nhan.png`), chữ thường, có gạch dưới |
| Kích thước | **128 × 128 px**, PNG, **nền trong suốt** (RGBA). Dung lượng ≤ 256 KB (Discord giới hạn) — thực tế nên < 30 KB |
| Chỗ đặt | thư mục `assets/emoji/` — bot tự tải lên thành Application Emoji tên `tg7_<key>` khi khởi động (không cần làm gì thêm). File trùng tên = **ghi đè** emoji cũ |
| Kích thước hiển thị thật | trên Discord chỉ **20–32 px** (nút bấm, tiêu đề embed) ⇒ hình phải **đọc được khi thu nhỏ**: 1 biểu tượng lớn ở giữa, silhouette rõ, ít chi tiết nhỏ li ti |
| Phong cách hiện tại | pixel-art lưới 64×64 phóng ×2 (mỗi "điểm ảnh" = 2 px), **viền tối** (`#2e223c`) quanh hình, có **bevel** (nửa sáng / nửa tối), **quầng sáng mờ** màu chủ đạo bao quanh, 2–3 **tia sáng dấu "+"** ở góc, và một **bản mini của chính biểu tượng ở góc dưới-phải** (huy hiệu nhỏ ~20 px) |
| Nếu bạn vẽ phong cách khác | được, miễn **cả bộ cùng một phong cách** và đúng khung 128×128, trong suốt. Giữ viền tối dày ~2–4 px để nổi trên nền Discord sáng lẫn tối |
| Nhóm cùng loại | nên **cùng khung/cùng màu viền** để nhìn là biết nhóm: Tộc = hình tròn/tự do, Huyết mạch = biểu tượng đơn, Tiến hóa = **khung lục giác vàng đồng**, Thức tỉnh = **quả cầu + chấm**, Thao tác = biểu tượng lớn |
| Khi bạn đã vẽ xong | gửi lại zip/ảnh; nếu là 1 tờ sprite nhiều ô, cho mình biết số cột/hàng + thứ tự, mình cắt (đã có script cắt sheet). Mình sẽ **không** ghi đè bản bạn vẽ bằng script nữa |

### Bảng màu đang dùng (hex)
Vàng `#f0be3c` · vàng sáng `#ffe882` · xanh ngọc `#32aaaa` / đậm `#28968c` · cam `#f08228` · tím `#aa64dc` · tím ma `#78288c` · linh khí `#6ee6eb` · cáo `#ee8028` · xanh dương `#5096f0` · đỏ `#e1463c` / đỏ đậm `#8c2428` · máu `#aa1428` · trời `#96d2ff` · xanh lá `#54b45a` · chanh `#a0e15a` · hồng `#f58cbe` · trắng `#f6f6fa` · xương `#e6e0c8` · viền mực `#2e223c`

## B. CHI TIẾT TỪNG EMOJI

Cột "Dùng ở đâu" = nơi emoji xuất hiện trong bot (`/chungtoc` và các màn có hiện tên tộc: hồ sơ, `/tuluyen`, PvP…).
Chữ "Emoji dự phòng" = icon Unicode hiện thay khi emoji pixel chưa tải lên được.

### 1) 6 TỘC — `race_*` (hàng 1, #1–#6) · hiện cạnh tên tộc ở khắp nơi
| # | Key | Tộc (vai trò) | Hình đang vẽ | Màu quầng/chủ đạo | Ý tưởng nếu bạn vẽ lại | Dự phòng |
|---|---|---|---|---|---|---|
| 1 | `race_nhan` | **Nhân Tộc** — thích nghi, đa năng | Người ngồi thiền, áo xanh dương cổ trắng, mặt tròn tóc đen, **vòng hào quang vàng** sau đầu, tay chắp trước bụng | vàng `#f0be3c` + áo `#466ebe` | Một tu sĩ ngồi kiết già, nhìn chính diện, hào quang tròn. Nhấn "bình thường nhưng linh hoạt": màu trung tính, không sừng/cánh | 🧑 |
| 2 | `race_long` | **Long Tộc** — chống chịu, long uy | **Đầu rồng nhìn thẳng**: da xanh ngọc, 2 sừng vàng, mắt vàng có đồng tử dọc, mõm lớn có 2 lỗ mũi, 2 sợi râu vàng hai bên | xanh ngọc `#32aaaa` + vàng | Đầu rồng phương Đông uy nghiêm, sừng cong, râu dài. Cảm giác "nặng, vững" | 🐉 |
| 3 | `race_phuong` | **Phượng Tộc** — hỏa lực, hồi phục | **Chim phượng lửa dang cánh**: thân vàng, cánh cam-đỏ xoè 2 bên, đuôi lửa dài, mào đỏ trên đầu | cam `#f08228` + đỏ + vàng | Phượng hoàng cánh lửa đối xứng, đuôi nhiều lông. Màu nóng, chuyển sắc đỏ → cam → vàng | 🔥 |
| 4 | `race_ma` | **Ma Tộc** — áp chế, bạo phát | **Mặt quỷ** da tím đậm, 2 sừng đen cong, **mắt đỏ hẹp**, miệng há có nanh trắng | tím `#78288c` / `#aa64dc` | Mặt ma tộc dữ tợn, sừng nhọn, mắt đỏ phát sáng. Phải đọc ra "ác" ngay | 😈 |
| 5 | `race_linh` | **Linh Tộc** — thân pháp, linh lực | **Giọt linh khí** xanh lam nhạt hình hạt nước/tinh thể có **lõi sáng hình thoi**, có dải gió và 1 chiếc lá xanh bên cạnh | linh khí `#6ee6eb` + lá `#5abe64` | Linh thể trong suốt, nhẹ, như ngọn lửa ma xanh/giọt sương phát sáng, kèm gió | ✨ |
| 6 | `race_yeu` | **Yêu Tộc** — bản năng, biến hóa | **Mặt hồ ly** nhìn thẳng: lông cam, tai nhọn viền trắng-đen, mõm trắng, mũi đen, mắt xếch | cam `#ee8028` | Mặt cáo cam-trắng, tai dựng. (Lưu ý: Yêu = cả hồ + hổ; bản hiện tại chọn cáo làm đại diện — bạn có thể vẽ "yêu thú" chung) | 🦊 |

### 2) 12 HUYẾT MẠCH — `bl_*` (hàng 1 cuối + hàng 2 + đầu hàng 3, #7–#18) · hiện khi chọn/nâng huyết mạch, mỗi tộc có 2 huyết mạch
| # | Key | Huyết mạch (tộc) — hướng | Hình đang vẽ | Chủ đạo | Ý tưởng vẽ lại | Dự phòng |
|---|---|---|---|---|---|---|
| 7 | `bl_nhan_hoang` | **Nhân Hoàng Huyết** (Nhân) — tu luyện, ngộ đạo, đột phá | **Vương miện vàng** có 3 hạt ngọc (đỏ giữa, xanh 2 bên), phía sau **mặt trời toả tia** | vàng | Vương miện + hào quang mặt trời = "hoàng giả" | 👑 |
| 8 | `bl_chien_than` | **Chiến Thần Huyết** (Nhân) — công/thủ/bạo kích cân bằng | **Khiên xanh dương** viền vàng, **thanh kiếm** cắm dọc giữa khiên | xanh dương `#5096f0` | Kiếm + khiên đối xứng, màu thép/xanh | 🛡️ |
| 9 | `bl_thuong_long` | **Thương Long Huyết** (Long) — bền bỉ, hồi sinh mệnh, chịu Lôi Kiếp | **Viên ngọc xanh** tròn trong vòng **rồng xanh ngọc cuộn quanh** (đầu rồng nhỏ góc trên-phải, đuôi góc dưới-trái) | xanh dương + ngọc | Rồng xanh cuốn quanh ngọc châu, cảm giác "nước/bảo vệ" | 🌊 |
| 10 | `bl_hac_long` | **Hắc Long Huyết** (Long) — hung bạo, xuyên giáp, bạo kích | **Con mắt rồng** trong đĩa tối viền gai tua tủa, **đồng tử dọc đen**, tròng cam-đỏ | tím tối + cam | Mắt rồng đen khè, nhiều gai, đáng sợ (khác hẳn #9 hiền) | 🐾 |
| 11 | `bl_chu_tuoc` | **Chu Tước Huyết** (Phượng) — bùng nổ, bạo kích | **Cánh phượng đỏ-cam** nhiều lông xoè như quạt, có lông nhỏ vàng ở mép + đốm sáng | đỏ `#e1463c` | Một chiếc cánh lửa lớn, nhiều lớp lông | 🪽 |
| 12 | `bl_niet_ban` | **Niết Bàn Phượng Huyết** (Phượng) — tái sinh, hồi mạnh, giữ tu vi khi đột phá hỏng | **Vòng lửa cam** bao quanh một **quả trứng/hạt trắng**, bên dưới 3 hạt tro nhỏ | cam | Trứng phượng hoàng trong lửa = "tái sinh". Có thể vẽ phượng nhỏ nở từ tro | ♻️ |
| 13 | `bl_huyet_ma` | **Huyết Ma Huyết** (Ma) — hút máu | **Giọt máu đỏ** lớn, có điểm sáng bóng, **2 nanh trắng** nhỏ ở đáy | đỏ máu | Giọt máu + nanh ma cà rồng | 🩸 |
| 14 | `bl_co_ma` | **Cổ Ma Huyết** (Ma) — cổ xưa, xuyên giáp sâu, bớt sát thương | **Đầu lâu** màu xương, mắt tím, mũi tam giác, hàm răng, **dấu rune tím** trên trán | tím + xương | Đầu lâu cổ có rune cổ ngữ, cảm giác "xưa cũ" | 💀 |
| 15 | `bl_phong_linh` | **Phong Linh Huyết** (Linh) — thân pháp, né, bạo kích, né Lôi Kiếp | **Xoáy gió** nhiều vòng đồng tâm xanh-trắng, có **đuôi gió** và mũi tên/mắt gió ở giữa | trời `#96d2ff` | Cơn lốc xoáy cuộn, nhìn là biết "gió" | 🌀 |
| 16 | `bl_moc_linh` | **Mộc Linh Huyết** (Linh) — sinh khí, hấp thu, hồi phục, thu hoạch | **Cây xanh** tròn tán (có quả vàng nhỏ), thân nâu, **hào quang xanh** | chanh/xanh lá | Cây linh thần, tán tròn lấp lánh | 🌳 |
| 17 | `bl_ho_yeu` | **Hồ Yêu Huyết** (Yêu) — linh hoạt, né, ngộ đạo, cơ duyên | **Đuôi cáo cam** cong phía dưới trăng khuyết trắng-đen (trăng ở góc trên-trái) | cam + đen/trắng | Đuôi cáo (có thể 9 đuôi) + trăng = "mị hoặc" | 🌙 |
| 18 | `bl_ho_vuong` | **Hổ Vương Huyết** (Yêu) — hung mãnh: công, bạo kích, sinh mệnh | **Mặt hổ** vàng-cam, vằn đen, **chữ 王** trên trán, mắt trắng | cam vàng | Mặt hổ nhìn thẳng với chữ 王 trán — đây là chi tiết nhận diện chính | 🐯 |

### 3) 6 DẠNG TIẾN HÓA — `rev_*` (đầu-giữa hàng 3, #19–#24) · hiện khi tộc **đã tiến hóa** (cuối chuỗi, rất hiếm → vẽ **đẹp nhất bộ**)
Đặc điểm chung: **khung huy hiệu lục giác** viền vàng đồng, nền màu riêng từng tộc, bên trong là 1 biểu tượng vàng/sáng.
| # | Key | Dạng tiến hóa | Hình đang vẽ | Nền khung | Ý tưởng vẽ lại | Dự phòng |
|---|---|---|---|---|---|---|
| 19 | `rev_nhan` | **Nhân Đạo Chí Tôn** | Khung **xanh dương**, **vương miện vàng** lớn, 1 sao vàng nhỏ dưới | `#3c5aaa` | Vương miện Chí Tôn, uy nghiêm nhưng không sừng (khác Ma Tôn) | 👑 |
| 20 | `rev_long` | **Chân Long** | Khung **xanh ngọc**, **mắt rồng vàng** (con ngươi dọc đen) | `#28968c` | Mắt rồng vàng hoặc đầu rồng vàng trong khung | 🐲 |
| 21 | `rev_phuong` | **Thần Phượng** | Khung **đỏ thẫm**, **cánh lửa vàng** xoè (2 cánh hình chữ V) | `#8c2428` | Phượng vàng toả sáng trong khung đỏ | 🔥 |
| 22 | `rev_ma` | **Ma Tôn** | Khung **tím tối**, **vương miện sừng** tím, 3 viên ngọc đỏ phía dưới | `#3c1850` | Vương miện ma sừng nhọn, ngọc đỏ | 😈 |
| 23 | `rev_linh` | **Thiên Linh** | Khung **xanh ngọc nhạt**, **vầng sáng tròn** đồng tâm + ngôi sao 4 cánh giữa | `#32aaaa` | Vầng sáng thiên giới, sao toả ra | 🌟 |
| 24 | `rev_yeu` | **Đại Yêu** | Khung **nâu cam**, **ngôi sao/hoa 8 cánh** cam-trắng (gợi chín đuôi) | `#6e321e` | Chín đuôi cáo xoè như quạt trong khung | 🦊 |

### 4) 3 BẬC THỨC TỈNH — `aw_1..3` (hàng 4, #25–#27) · hiện trong `/chungtoc` mục "Thức tỉnh" (Sơ Giai / Trung Giai / Viên Mãn) — chưa thức tỉnh dùng ▫️
| # | Key | Bậc | Hình | Màu | Ghi chú |
|---|---|---|---|---|---|
| 25 | `aw_1` | Thức Tỉnh **Sơ Giai** | **Quả cầu xanh dương** nhạt, **8 tia** toả ra, **1 chấm trắng** giữa | `#78bef0` | Số chấm = bậc (1·2·3) — giữ đặc điểm này để nhìn là biết bậc |
| 26 | `aw_2` | Thức Tỉnh **Trung Giai** | Quả cầu **tím**, 8 tia, **2 chấm trắng** | `#aa82f0` | |
| 27 | `aw_3` | Thức Tỉnh **Viên Mãn** | Quả cầu **vàng**, 8 tia, **3 chấm trắng** | `#ffc846` | Bậc cao nhất → sáng nhất |

### 5) 4 NÚT THAO TÁC — `race_awaken` · `race_bloodline` · `race_evolve` · `race_change` (hàng 4, #28–#31) · hiện trên **nút bấm** của `/chungtoc` (nhỏ nhất, cần đơn giản nhất!)
| # | Key | Nút | Hình | Màu | Ý tưởng |
|---|---|---|---|---|---|
| 28 | `race_awaken` | **Thức Tỉnh** | **Bông sen hồng** 5 cánh nở trên mặt nước xanh, nhụy vàng | hồng `#f58cbe` | Hoa sen thức tỉnh (có thể thay bằng mắt mở / tia sáng bình minh) |
| 29 | `race_bloodline` | **Nâng Huyết Mạch** | **Giọt máu đỏ** lớn có dấu **X/xoắn DNA** trắng + vạch vàng giữa | đỏ máu | Giọt máu + xoắn kép (DNA). Khác #13 (#13 có nanh) |
| 30 | `race_evolve` | **Tiến Hóa** | **Mũi tên xanh lá chỉ lên** (nửa sáng/nửa tối) với **ngôi sao vàng** ở giữa | xanh lá `#54b45a` | Mũi tên lên + sao = "lên cấp" |
| 31 | `race_change` | **Đổi Tộc** | **Hai mũi tên ngược chiều** (xanh dương → phải, cam → trái) | xanh/cam | Biểu tượng "đổi/hoán đổi" |

## C. LƯU Ý KHI VẼ

1. **Dễ phân biệt ở 24 px**: 6 tộc nên khác nhau ở **màu + hình khối** (vàng-người / xanh ngọc-rồng / đỏ cam-chim / tím-quỷ / xanh nhạt-giọt / cam-cáo), đừng chỉ khác chi tiết nhỏ.
2. **12 huyết mạch**: 2 cái cùng tộc phải khác hẳn nhau (VD #9 hiền-xanh vs #10 dữ-tối; #11 cánh vs #12 trứng) vì xuất hiện cạnh nhau trong menu chọn.
3. **Tiến hóa #19–24** nên sang hơn huyết mạch (khung lục giác, kim loại vàng).
4. **#13 vs #29** đều là giọt máu đỏ — nếu muốn tránh nhầm, đổi #29 thành xoắn DNA/ADN không có giọt.
5. **Yêu Tộc**: hiện chọn cáo (race) + cáo (bl_ho_yeu) + hổ (bl_ho_vuong); nếu bạn muốn "Yêu Tộc" nói chung (cả cáo lẫn hổ) hãy vẽ race_yeu là **nửa cáo nửa hổ** hoặc mặt yêu thú có sừng nhỏ.
6. **Thay emoji đã vẽ lại** (quan trọng): Discord *không cho thay ảnh* của Application Emoji cùng tên, nên khi bạn vẽ lại 1 emoji giữ nguyên tên file, phải báo bot dùng tên mới:
   - chép đè `assets/emoji/<key>.png` bằng bản bạn vẽ;
   - mở `assets/emoji_revisions.json` (hiện là `{}`) và ghi hậu tố cho mỗi key vừa vẽ lại, VD `{"race_nhan": "b", "race_long": "b"}`; lần vẽ lại tiếp theo của cùng key đổi `b` → `c`…;
   - `git add -A; git commit; git push`, khởi động lại bot → bot tự tải ảnh mới lên với tên `tg7_race_nhan_b` (không phải xoá gì trên Discord). Cách đơn giản nhất: gửi ảnh cho mình, mình lo cả cắt + ghi hậu tố + đóng zip.
7. Ngoài 31 cái này, **570 emoji cũ** trong `assets/emoji/` không đụng tới.
