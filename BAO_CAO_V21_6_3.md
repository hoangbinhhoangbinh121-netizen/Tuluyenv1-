# BÁO CÁO V21.6.3 — "Lượt bấm hết hạn (10062 / 40060)"

**Triệu chứng:** console báo `Lượt bấm hết hạn tại nút tĩnh (10062 Unknown interaction)` và `biểu mẫu tĩnh (40060 already acknowledged)`; người chơi thấy "Tương tác đã hết hạn".

**Đã sửa**
1. `src/ui/skin.js` — watchdog (chậm > 1,8s) trước đây `deferReply` cho MỌI loại interaction, kể cả nút/menu → `i.update()` sau đó bị đổi thành `editReply` lên tin "đang xử lý" thay vì sửa bảng gốc. Nay: nút/menu/modal-từ-tin-nhắn → `deferUpdate`; slash/modal độc lập → `deferReply` ephemeral. `reply()` sau `deferUpdate` gửi tin MỚI (followUp), không ghi đè bảng gốc.
2. `src/ui/quantriViews.js` — nút `dok`/`dno` (có bước nhắn DM qua mạng) và form `/quantri` (có `announce()` qua mạng) nay ack TRƯỚC rồi mới xử lý → hết 40060 do `update` thất bại rồi `reply` lại.
3. `scripts/test_ack2163.js` — test mô phỏng 6 trường hợp.

**Chưa xác nhận:** nếu console còn `🐢 Vòng lặp bị chặn` thì nguyên nhân là event loop bị chặn (host yếu / `VACUUM INTO` đồng bộ) — ack sớm không cứu được; cần log dòng đó.
**Kiểm thử:** mô phỏng (discord.js stub) PASS; chạy trên host: `node scripts/test_ack2163.js`, `test_restart2161.js`, `test_buttons214.js`. Trên Discord thật: NOT TESTED.
**Kiểm tra host chạy đúng bản:** `grep '"version"' package.json` → `21.6.3`; dòng khởi động in `Thiên Tông Bot v21.6.3`.
