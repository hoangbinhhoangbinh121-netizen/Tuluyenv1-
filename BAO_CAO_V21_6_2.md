# BÁO CÁO V21.6.2 — "MENU / BIỂU MẪU TOÀN BÁO HẾT HẠN"

**Triệu chứng:** mở biểu mẫu/menu (kể cả khi là admin) thường báo "hết hạn".

**Điều tra trong code**
- Menu (`View`) và biểu mẫu (`showModal`) nằm trong bộ nhớ của tiến trình bot; khi bot khởi động lại thì mọi menu/biểu mẫu đang mở đều mất và nút báo "hết hạn".
- `src/bot.js`: nếu đăng nhập Discord gặp **bất kỳ lỗi nào, kể cả lỗi mạng tạm thời (`EAI_AGAIN`)** thì `process.exit(1)` → host khởi động lại bot → lặp lại khi mạng còn chập chờn. Đây khớp với lỗi `EAI_AGAIN discord.com` bạn gặp sáng nay.
- Không có `uncaughtException` handler: một lỗi ném ra từ bộ đếm giờ/sự kiện làm sập tiến trình (cũng khởi động lại).
- `/quantri` (admin) dùng nút tĩnh nhưng **biểu mẫu thì động** → nút còn nhưng form báo "hết hạn" sau mỗi lần restart.
- ⚠️ Chưa có log thật của host để xác nhận bot có đang bị khởi động lại; đây là giả thuyết mạnh nhất từ code, **chưa xác nhận**.

**Đã sửa**
1. Lỗi mạng khi đăng nhập → chờ 5·n giây (tối đa 60) rồi thử lại (tối đa 60 lần), không thoát. Token sai/lỗi khác vẫn thoát như cũ.
2. `uncaughtException`: ghi log, bot chạy tiếp; thoát có kiểm soát nếu > 8 lỗi/60 giây (tránh vòng lặp hỏng).
3. Biểu mẫu `/quantri` chuyển sang **form tĩnh** (`qm|<uid>|<form>`): không phụ thuộc bộ nhớ, dùng được sau restart; kiểm tra đúng admin.
4. Thông báo menu/biểu mẫu không còn nói chung chung: nếu bot mới khởi động (<3 giờ) hiện "bot vừa khởi động lại <t:…:R>", ngược lại nói "menu quá cũ (tối đa 15 phút không bấm) hoặc bot đã khởi động lại".
5. `/loigannhat` thêm dòng "Bot chạy liên tục từ …" — dùng để biết bot có bị restart liên tục không.

**Chưa làm:** các biểu mẫu khác (kho đồ, tìm kiếm shop, tông môn, đại phủ, linh thú, xã hội, Chứng Đạo) vẫn là loại động; menu `View` vẫn hết hạn sau 15 phút không bấm.

**Kiểm thử:** `test_restart2161` (11 PASS, mới), `test_quantri_v17_2` 285, `test_buttons214` (cập nhật câu chữ), toàn bộ regression 44 file (strict UI): 43/44 exit=0 ở lần chạy toàn bộ; `test_buttons214` còn 2 regex cũ khớp câu chữ "hết hạn" (câu chữ đã đổi có chủ đích thành "không còn…") → đã sửa regex, chạy lại riêng 47/47 PASS (chưa chạy lại toàn bộ lần cuối sau sửa regex). Trên host thật: **NOT TESTED**.
