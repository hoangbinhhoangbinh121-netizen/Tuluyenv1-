# Tiến độ chuyển Python → Node.js (v6-7) — HOÀN TẤT ĐỢT CHUYỂN

Nguồn: `tuluyenbot.py` (13.843 dòng). **Toàn bộ 64 lệnh của bản Python đều đã có trong bản Node.js** (66 lệnh slash tổng cộng, gồm `/giaodich`, `/restore_db`, `/thientongcode`, `/thuhoilinhthach`).

| Nhóm | Trạng thái |
|---|---|
| Schema + migration DB, SQLite file, ID snowflake dạng chuỗi (không mất chính xác) | ✅ |
| Toàn bộ số liệu game (173 bảng) tự trích từ Python, không gõ lại tay | ✅ |
| Tu Luyện / Bế Quan / Cảm Ngộ / Linh Mạch / Hồi HP / Đột Phá + Cửu Lôi Kiếp | ✅ |
| Công Pháp, Pháp Bảo, Cửa Hàng, Đổi Linh Tinh, Quay Công Pháp (+ xoay vòng tên bằng Gemini) | ✅ |
| Đan Phương, Luyện Đan, Luyện Khí, Linh Thú, Đan Phá Giới, Tẩy Tủy, Dùng Đan Dược | ✅ |
| Kho Đồ, Nhập Code (+ duyệt admin, nút bền qua restart), Rương Thần Bí, Công Pháp Đặc Quyền | ✅ |
| Bí Cảnh (thường, Vạn Linh Cốc, Đặc Biệt, Linh Giới 12 cấp), Boss Thế Giới | ✅ |
| Phi Thăng, Thiên Kiếp, Sứ Giả, Thượng Cổ Thủ Hộ, Thiên Nhân Ngũ Suy | ✅ |
| Tông Môn (đủ chức năng), Kho Tông, Tông Môn Chiến (bản đồ, cứ điểm, giao chiến, tick 10s, thưởng) | ✅ |
| PvP: đấu theo hiệp (Đánh Thường/Công Pháp/Phòng Thủ/Sát Chiêu), đấu tự động, thống kê, lịch sử, khoá/mở | ✅ |
| Đạo Lữ/Song Tu, Động Phủ (kênh riêng), Giao Dịch 2 chiều, Thiên Kiêu Bảng | ✅ |
| Sự kiện Một Ngày Đại Phú (thị trường, Ngân Khố, Thiên Cơ, Thương Vụ, Bảo Hiểm, Rương, chốt giải) | ✅ |
| `/huongdan`, lệnh admin ẩn (`!hoang`, `!tongmonchien_*`), sao lưu/khôi phục DB, tự sao lưu | ✅ |
| Vòng lặp nền: xoay vòng công pháp/đan dược, tick Tông Môn Chiến, trạng thái + chu kỳ giá Đại Phú | ✅ |

## Đã kiểm tra thế nào
* Logic được chạy thử trên **bản sao DB thật** (`tutien_20260816_064733.db`, 61 nhân vật): từng nhóm tính năng, có ép RNG để thử nhánh hiếm.
* Công thức cảnh giới/tu vi đối chiếu số trực tiếp với Python.
* Bấm thử tự động **190 nút/menu/dropdown** — không có lỗi runtime.
* Kiểm tra tự động các giới hạn của Discord: 66 lệnh slash (tên, thứ tự option bắt buộc), bố cục 19 view (≤5 nút/hàng, select đứng riêng một hàng, ≤25 lựa chọn, độ dài label/ID/placeholder).
* **CHƯA** chạy với Discord thật (môi trường dựng không có mạng/không cài được `discord.js`) → lần chạy đầu hãy thử các luồng chính (`/batdau`, `/tutien`, nhập code, đấu pháp, tông môn chiến) trên server thử và báo lỗi nếu có.

## Khác biệt có chủ ý so với bản Python
* Hạ gục Boss Thế Giới + chia thưởng nằm trong **một transaction** (Python commit trước rồi mới chia → có thể chia 2 lần).
* Nút duyệt code của admin là nút **tĩnh** — còn bấm được sau khi bot khởi động lại.
* Ô nhập "Bổ Nhiệm" của Tông Môn: sửa lỗi code Đạo Lữ bị dán nhầm trong bản Python.
* Giao Dịch: Discord không cho mở modal thứ 2 ngay sau modal thứ 1, nên sau bước 1 có nút **Tiếp tục — Bước 2/2** để mở modal MUỐN NHẬN (bản Python gọi thẳng modal thứ 2 và sẽ báo lỗi).
* Menu PvP dùng ô chọn thành viên có sẵn của Discord (thay danh sách 25 ứng viên tự dựng).
* Ngũ Suy/Phi Thăng: giữ nguyên luật cũ (bảng "người đầu tiên" tính chung theo server).

## Ghi chú kỹ thuật
ID Discord luôn là **chuỗi** trong JS · `round()` Python → `pyRound` · `int()` → `Math.trunc` · `random.*` → `util.js`.

Xem thêm `KNOWN_ISSUES.md` — lỗi đã biết và việc làm tiếp.
