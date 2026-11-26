# BÁO CÁO V22.3 — `!tangexp`: tăng tu vi riêng cho 1 người (người khác giữ nguyên) hoặc cho tất cả

Bản này gồm v22.2. Lệnh **prefix-only** (không tốn slot slash — bot vẫn đúng 100 lệnh slash).

## Cách dùng (gõ trong kênh chat, tiền tố `!`; admin bot hoặc quyền Administrator)
| Lệnh | Tác dụng |
|---|---|
| `!tangexp dat @người 5 60` | Chỉ **người đó** nhận tu vi ×5 trong 60 phút. Phút bỏ trống hoặc 0 = vĩnh viễn. Hệ số 0,1–100 (<1 = làm chậm). |
| `!tangexp @người 5` | Viết tắt của `dat`. |
| `!tangexp xoa @người` | Bỏ hệ số riêng (về bình thường). |
| `!tangexp ds` | Danh sách người đang có hệ số riêng (hệ số, hạn). |
| `!tangexp tat` / `!tangexp bat` | Công tắc tổng cho **mọi hệ số riêng** (tắt = ngưng hiệu lực, giữ dữ liệu). |
| `!tangexp all 3 120` | Tăng cho **TẤT CẢ** mọi người ×3 trong 120 phút. `!tangexp all 1` = về bình thường. (Cùng cơ chế với `/tangtoctuluyen`.) |
| `!tangexp` | Hướng dẫn + trạng thái. |
Ví dụ đúng yêu cầu "mọi người bình thường, chỉ người ấy cao": `!tangexp dat @người 10` — không đụng tới hệ số toàn server.

## Áp dụng ở đâu
- **Có:** tu vi của **Tu Luyện**, **Bế Quan**, **Bế Quan Treo** (cùng chỗ với hệ số toàn server, `actionsBasic.tuluyenMultFor` + `dongquanR`).
- **Nhân chồng** với hệ số toàn server (`/tangtoctuluyen` hoặc `!tangexp all`) và mọi buff khác (Tông, đan dược, thiên phú, Tiên ×3…).
- **Không:** tu vi từ Boss / Bí Cảnh / Chứng Đạo / nhiệm vụ, EXP Nghề, Linh Thạch. (Nếu bạn muốn cả các nguồn này, báo mình.)
- **Bế Quan Treo:** tiền thu được = thời gian treo × tốc độ **tại lúc nhận**. Nên đặt/bỏ hệ số giữa lúc đang treo thì cả đoạn treo tính theo hệ số lúc nhận; hệ số hết hạn trước khi nhận ⇒ mất phần tăng.
- Người chơi **không thấy** thông báo "đặc quyền" — chỉ thấy tu vi nhiều hơn.

## Kiểm thử
| Hạng mục | Kết quả |
|---|---|
| `scripts/test_tangexp223.js` (30 kiểm tra) | PASS |
| — P ×5 chính xác với Tu Luyện kỳ vọng và Bế Quan Treo; Q (người khác) không đổi | PASS |
| — Bấm thật: Tu Luyện 8 lần ≈ kỳ vọng; Bế Quan 40 lần có/không boost ≈ ×5 | PASS |
| — Nhân chồng toàn server (P ×10, Q ×2), hết hạn, công tắc tắt/bật, giới hạn 0,1–100, nhật ký admin | PASS |
| Hồi quy toàn bộ (52 file test, TG_STRICT_UI=1) | 50 đạt; chỉ `test_emoji19`, `test_realms_v18` lỗi (sẵn có: thiếu ảnh nguồn đã bỏ khỏi zip) |
| Discord thật | **NOT TESTED** |
