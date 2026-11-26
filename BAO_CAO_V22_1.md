# BÁO CÁO V22.1 — nút Kỹ Năng Tộc · kernel mặc định cho Boss + Chứng Đạo · cpfx gộp · Sổ Cái PvE · benchmark Tông Chiến

Bản này gồm v22.0. Số khoá chi tiết: `docs/audit_v21_3/16_COMBAT_KERNEL_V22_1.md`.

## Kết quả
| Hạng mục | Trạng thái |
|---|---|
| Kernel mặc định BẬT cho Boss + Chứng Đạo (Bí Cảnh/Tông Chiến vẫn tắt) | PASS (test_kernel22 79, test_kernel221 55) |
| Nút **Kỹ Năng Tộc**: Boss (`wb|race`), Bí Cảnh (`b19|r|…|race`), Chứng Đạo (lựa chọn `race`), Tông Chiến (`sw|pq`) | PASS (logic + dựng giao diện bằng mock) |
| Từ chối lịch sự khi kernel tắt / chưa có tộc / đang hồi chiêu — không tốn lượt | PASS |
| Hết tự phát (`kernel_race_auto` mặc định off; `!kernel race on` bật lại) | PASS |
| cpfx → kernel (hộ thể/né/suy yếu/hồi của chiêu công pháp trong Bí Cảnh; lưu `m.kx`) | PASS (khi `kernel_bicanh=kernel`) |
| Sổ Cái: thưởng Boss, thưởng Bí Cảnh, phí Chứng Đạo/Đế, rút/nộp Kho Tông (`ledger.noteOnce`) | PASS — chỉ phủ các luồng này |
| Benchmark Tông Chiến + N=100 | Xong — **Tông Chiến lệch mạnh** (xem dưới) |
| Hồi quy toàn bộ `scripts/test_*.js` (TG_STRICT_UI=1) | Đạt trừ 2 test lỗi sẵn có: `test_emoji19`, `test_realms_v18` |
| Discord thật | **NOT TESTED** |

## Điều bạn cần biết khi cập nhật
1. **Boss + Chứng Đạo chạy kernel ngay.** Người chơi có tộc sẽ thấy nút **Kỹ Năng Tộc**; người không có tộc bấm sẽ nhận thông báo lịch sự. Muốn y như v21.7.1: `!kernel all off` (hoặc `!kernel boss legacy`, `!kernel chungdao legacy`).
2. Kỹ năng tộc không còn tự phát — phải bấm nút.
3. Hiệu ứng Boss/Tông Chiến nằm trong bộ nhớ: restart bot là mất hiệu ứng/hồi chiêu đang chạy (không mất tiền hay vật phẩm).

## Phát hiện từ benchmark (cần bạn quyết)
- **Tông Chiến**: người có tộc thắng người không tộc cùng chỉ số: Phượng 51→83%, Yêu 48→75%, Ma 43→60% (cận trên, N=100, nhiễu ±5). Tức mức chênh lệch lớn như PvP. Nên **chưa bật Tông Chiến**; đề xuất tăng hệ số hồi chiêu `!kernel cd_tongchien 6` rồi đo lại.
- Boss: Phượng/Ma +12% sát thương — chấp nhận được? (đang bật mặc định).
- Chứng Đạo: ít tác động tới tỉ lệ vượt kiếp.

## Cần bạn quyết định
1. Hệ số hồi chiêu Tông Chiến (3 hiện tại; đề xuất 6–10) trước khi bật.
2. Kỹ năng tự thân trong Tông Chiến: hiện cộng thêm vào đòn đánh (Boss thì thay đòn) — muốn thống nhất kiểu nào?
3. Bí Cảnh có bật kernel không? (Long 39→65% — Hộ Thể rất mạnh ở đó.)

## Giới hạn trung thực
- Chỉ test bằng discord.js giả + SQLite thật; benchmark là người chơi mô phỏng bấm đúng lúc, không phải người thật.
- Sổ Cái chỉ phủ luồng đã nối; thưởng thắng/thua Tông Chiến đi vào quỹ tông, chưa ghi sổ; một số dòng sổ dùng khoá ngẫu nhiên nên là nhật ký chứ không chống ghi đôi.
- Nút Chứng Đạo xám khi kernel tắt/chưa có tộc.
