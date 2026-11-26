# BÁO CÁO V22.2 — `!bxh`: ẩn / xoá một người khỏi bảng xếp hạng (có công tắc bật/tắt)

Bản này gồm v22.1. Lệnh **prefix-only** (không tốn slot slash — bot vẫn đúng 100 lệnh slash).

## Cách dùng (gõ trong kênh chat, bằng tiền tố `!`)
| Lệnh | Tác dụng |
|---|---|
| `!bxh an @người [lý do]` | **ẨN**: không hiện ở các bảng; mọi dữ liệu giữ nguyên. |
| `!bxh xoa @người [lý do]` | **XOÁ**: ẩn + gỡ điểm xếp hạng đã lưu riêng (Bảng thành tích Siêu Thoát; sát thương của các Boss **đã kết thúc**). Có bản sao lưu để khôi phục. |
| `!bxh hien @người` | Hiện lại + khôi phục điểm đã gỡ. |
| `!bxh ds` | Danh sách người đang bị ẩn/xoá (kèm lý do). |
| `!bxh tat` / `!bxh bat` | **Công tắc tổng**: tắt ⇒ mọi người hiện lại như chưa ẩn (dữ liệu ẩn/xoá vẫn giữ); bật lại ⇒ ẩn lại ngay. |
| `!bxh` | Hướng dẫn + trạng thái hiện tại. |
`@người` có thể thay bằng ID Discord. Mỗi thao tác ghi vào nhật ký admin (`admin_log17`).

## Phạm vi
- **Có áp:** Thiên Kiêu Bảng (`/bangxephang`, menu Xếp Hạng) · bảng sát thương Boss (panel + nút Xếp Hạng) · Bảng thành tích Siêu Thoát (event19) · Bảng Chuỗi Đồng Tu (cặp có 1 người bị ẩn ⇒ ẩn cả cặp).
- **Không áp:** bảng Tông Môn / Tông Chiến (xếp theo tông, không theo người) và Đại Phú Đường (sự kiện riêng) — nếu cần, báo mình thêm.
- **Quyền:** admin của bot (`ADMIN_CODE_APPROVER_IDS`) **hoặc** người có quyền Administrator trong server.

## Lưu ý an toàn dữ liệu
- "Xoá" **không bao giờ đụng sát thương của Boss đang sống** (còn dùng để chia thưởng) — chỉ gỡ Boss đã kết thúc.
- "Xoá" không xoá người chơi, tài sản hay tiến trình tu luyện; chỉ gỡ điểm xếp hạng lưu riêng, và khôi phục được bằng `!bxh hien`.
- Chuyển `xoa` → `an` sẽ trả lại điểm đã gỡ (chỉ còn ẩn).
- Boss kết thúc **sau khi** xoá: người đó vẫn có dòng sát thương mới trong DB nhưng bị lọc khi hiển thị (đang xoá/ẩn).

## Kiểm thử
| Hạng mục | Kết quả |
|---|---|
| `scripts/test_lbhide22.js` (30 kiểm tra: ẩn, xoá, khôi phục, công tắc, 4 bảng, lệnh) | PASS |
| Hồi quy toàn bộ (51 file test, TG_STRICT_UI=1) | 49 đạt; chỉ `test_emoji19`, `test_realms_v18` lỗi (sẵn có: thiếu ảnh nguồn đã bỏ khỏi zip) |
| Discord thật | **NOT TESTED** (mock discord.js + SQLite thật) |

## Về câu hỏi "lệnh kernel không thấy"
`!kernel`, `!socai`, `!pvpset`, `!bxh` đều là lệnh **tiền tố** — không hiện trong menu `/`. Gõ trực tiếp `!kernel` trong kênh chat. `!kernel`/`!socai`/`!pvpset` chỉ chạy với ID trong `ADMIN_CODE_APPROVER_IDS` (biến môi trường); nếu bot trả "chỉ dành riêng cho admin được chỉ định" thì ID của bạn chưa nằm trong danh sách đó. `!bxh` mở rộng hơn: cũng nhận người có quyền Administrator của server.
