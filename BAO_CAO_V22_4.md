# BÁO CÁO V22.4.1 (gồm V22.4) — hạ YÊU CẦU tu vi đột phá riêng cho 1 người (`!tangexp yeucau`)

Bản này gồm v22.3. Vẫn là lệnh **prefix-only** (bot giữ đúng 100 lệnh slash).

## Ý nghĩa
"Người khác cần 100 tu vi để đột phá, mình chỉ cần 10" ⇒ yêu cầu của người đó = yêu cầu gốc **chia cho N**. Khác với hệ số tu vi (v22.3): hệ số làm người đó **kiếm nhanh hơn**, còn mục này làm **mốc đột phá thấp hơn**. Dùng riêng hoặc kết hợp cả hai.

## Cách dùng (admin bot hoặc quyền Administrator, gõ bằng tiền tố `!`)
| Lệnh | Tác dụng |
|---|---|
| `!tangexp yeucau @người 10` | Chỉ người đó cần **1/10** tu vi để đột phá (số chia 0,1–1000). Thêm số phút ở cuối nếu muốn có hạn: `!tangexp yeucau @người 10 120`. |
| `!tangexp yeucau xoa @người` | Bỏ giảm yêu cầu (về bình thường). |
| `!tangexp yeucau @người x2` | **Khó hơn**: người đó cần **gấp đôi** tu vi để đột phá (người khác cần 100 thì người này cần 200). |
| `!tangexp ds` | Danh sách cả hệ số tu vi lẫn giảm yêu cầu đột phá. |
| `!tangexp tat` / `bat` | Công tắc tổng cho **mọi** thiết lập riêng (hệ số tu vi + giảm yêu cầu). |
**Muốn người đó cần GẤP ĐÔI tu vi (khó hơn):** `!tangexp yeucau @người x2` (`x3` = gấp ba… tối đa `x10`; có thể thêm phút ở cuối). Cũng có thể nhập số chia nhỏ hơn 1 (`0.5` = gấp đôi).

## Áp dụng ở đâu
- **Điều kiện đột phá** (`/dotpha`): kiểm tra "đủ tu vi" và số tu vi bị **trừ** khi thành công đều dùng yêu cầu đã giảm.
- **Mọi chỗ hiển thị "tu vi cần"**: hồ sơ, thanh tiến độ, màn đột phá/tu luyện/treo quan, Chứng Đạo, kiểm tra admin, xuất quan.
- **Không đổi:** cơ hội đột phá thành công, Cửu Lôi Kiếp, các điều kiện khác (Thiên Nhân Ngũ Suy, Phi Thăng, Chứng Đạo…), tốc độ/phần thưởng tu vi (tính từ mốc gốc), phần thưởng Bí Cảnh, trần tu vi Hóa Thần.
- Chuyển cảnh giới xong, yêu cầu của cảnh giới kế **cũng được chia** (cùng một số chia) — số chia là cố định theo người, không tự tắt.
- Cửa Chứng Đạo Thành Đế vẫn bắt buộc vượt 12 lôi, không bị bỏ qua.

## Kiểm thử
| Hạng mục | Kết quả |
|---|---|
| `scripts/test_tangexp223.js` (55 kiểm tra; gồm v22.3) | PASS |
| — P cần 1/10, Q (người khác) vẫn cần đủ; `/dotpha` thật: Q báo "Chưa đủ tu vi", P đủ điều kiện | PASS |
| — hết hạn, công tắc tắt, dữ liệu còn, số chia ngoài 0,1–1000 bị từ chối, <1 khó hơn, xoá | PASS |
| — lệnh `yeucau` (đặt/xoá/thiếu số/quá lớn/liệt kê; `x2`/`x4` = gấp đôi/gấp bốn, `x0`/`x2000` bị từ chối) | PASS (55 kiểm tra) |
| Hồi quy toàn bộ (52 file test, TG_STRICT_UI=1) | 50 đạt; chỉ `test_emoji19`, `test_realms_v18` lỗi (sẵn có: thiếu ảnh nguồn đã bỏ khỏi zip) |
| Discord thật | **NOT TESTED** |

_v22.4.1: thêm cú pháp `x2` (yêu cầu gấp đôi). Hồi quy toàn bộ chạy ở v22.4; v22.4.1 chỉ đổi lớp lệnh `!tangexp` và đã chạy lại test_tangexp223 (55), test_lbhide22, test_kernel221, test_kernel22 — đều PASS._
