# 03 — Audit PvP (trước V21.3) và cách xử lý

| # | Vấn đề tìm thấy ở V21.2 | Xử lý V21.3 | Trạng thái |
|---|---|---|---|
| 1 | Giới hạn cứng 5 hiệp, hết hiệp so sinh lực | Bỏ. Trận kết thúc khi KO / đầu hàng / AFK / bế tắc | PASS (`test_pvp21`) |
| 2 | Hết giờ chọn → **tự Đánh Thường** | AFK = **bỏ lượt**; AFK liên tiếp ≥2 → xử thua; cả hai AFK liên tiếp → hòa | PASS |
| 3 | Hòa sinh lực → **tung đồng xu** | Bỏ. Ngang sinh lực không tự phân thắng bại; KO đồng thời → hòa | PASS |
| 4 | Hai nơi chứa logic vòng đấu (`pvp.js` và `pvpCore.doPvp`) | Cả hai chạy `combat21.js`; công thức 1 hiệp `roundAction` giữ nguyên | PASS |
| 5 | Embed thêm 1 field/hiệp → vỡ giới hạn 25 field khi trận dài | Chỉ hiện 3 hiệp gần nhất; toàn bộ nằm ở nhật ký. Kiểm tra ≤25 field/≤6000 ký tự | PASS |
| 6 | Không có nhật ký, hòa không được ghi | Bảng `v213_battles` (thắng/thua/hòa/huỷ, mã trận, log, tổng sát thương); `/lichsupvp ma_tran:<mã>` có phân trang + lọc | PASS |
| 7 | Chốt trận có thể lặp nếu bấm/restart | Chốt `status 'active'→'done'` trong CÙNG transaction với đổi tu vi; lần 2 trả `dup` | PASS |
| 8 | Restart giữa trận | Trận dở bị **huỷ** (không ai mất/được gì), báo vào tin nhắn trận nếu sửa được | PASS (huỷ). **Khôi phục tiếp tục trận: KHÔNG làm** (cần lưu trạng thái Discord view) |
| 9 | Không có đầu hàng | Nút **Đầu Hàng** (xác nhận 2 bước) | PASS |
| 10 | HP PvP cố định 100 (thanh chuẩn hoá) | **GIỮ NGUYÊN** — đổi sang HP thật là quyết định cân bằng lớn | BLOCKED (cần duyệt) |
| 11 | Ngang Tốc độ → ngẫu nhiên người đánh trước | Giữ (RNG phía server, đúng plan "server-side RNG") | GIỮ |
| 12 | Hai người bấm cùng lúc | JS đơn luồng + cờ `acted/resolving/round_token`; test bấm đúp, nút hiệp cũ | PASS |

## Chính sách ĐỀ XUẤT (mặc định, chỉnh bằng `bot_settings`, chờ bạn duyệt)
`pvp_afk_forfeit=2` · `pvp_stalemate_rounds=15` · `pvp_safety_rounds=300` (chốt chặn → hòa, không phải giới hạn thiết kế).
Hòa: không đổi tu vi, vẫn tiêu cooldown, hao độ bền, tiêu Phong Ấn; không vào `pvp_history` (không tính thắng/thua), có trong thống kê "Hòa".
