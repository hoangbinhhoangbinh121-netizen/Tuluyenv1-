# BÁO CÁO V22.0 — Combat Kernel + adapter Boss / Bí Cảnh / Chứng Đạo / Tông Chiến

Bản này gồm v21.7.1 (Đan Tẩy Tủy tính bằng Linh Tinh).

## Kết quả
| Hạng mục | Trạng thái |
|---|---|
| `combatKernel.js` (EffectEngine + kỹ năng tộc dùng chung cho PvE) | PASS (test_kernel22) |
| Adapter Boss Thế Giới | PASS (legacy không đổi; kernel chạy) |
| Adapter Bí Cảnh (lưu `m.kx` trong JSON run) | PASS, chạy hết một run kernel |
| Adapter Chứng Đạo (kỹ năng tộc tự thân) | PASS, chạy hết đại kiếp |
| Adapter Tông Chiến | PASS (chức năng); **chưa đo cân bằng bằng số** |
| Lệnh admin `!kernel` (prefix-only) | PASS |
| Mặc định | **legacy = TẮT**, người chơi không thấy đổi gì |
| Số liệu cân bằng | ĐỀ XUẤT, benchmark nhiễu ±9 điểm % — xem docs 15 |
| Discord thật | **NOT TESTED** |

## Cách dùng
`!kernel` xem · `!kernel boss kernel` bật Boss · `!kernel all off` cắt khẩn cấp · `!kernel cd_bicanh 10` đổi hồi chiêu · `!kernel foe 5` · `!kernel race off`.
Khuyến nghị: bật từng hệ thống một, theo dõi, rồi mới bật tiếp.

## Điều quan trọng đã phát hiện
Benchmark đầu tiên (hồi chiêu như PvP) khiến tộc Nhân/Long/Linh thắng Bí Cảnh 100% — số liệu PvP **không chuyển thẳng** sang PvE. Nên có hệ số nhân hồi chiêu theo hệ thống; sau đó Bí Cảnh nằm trong nhiễu, Boss tăng sát thương ~+12–15% ở Phượng/Ma.

## Cần bạn quyết định
1. Bật hệ thống nào trước? (đề nghị Chứng Đạo hoặc Boss — ít rủi ro nhất)
2. Duyệt hệ số hồi chiêu và quy ước điểm thanh Boss (5% một đòn).
3. Có muốn thêm nút bấm kỹ năng tộc trong 4 giao diện thay cho tự phát không?

## Giới hạn trung thực
- Chỉ test bằng discord.js giả + SQLite thật; hiệu ứng Boss/Tông Chiến nằm trong bộ nhớ (mất khi restart).
- Hiệu ứng lên quái trong Bí Cảnh tính riêng từng thành viên.
- Chưa gộp cpfx.battleState với EffectEngine.
- Tông Chiến chưa có benchmark số.

## Tiếp theo
Sau khi bạn duyệt số liệu: gộp cpfx vào kernel, nối kernel vào Sổ Cái (thưởng PvE), nút kỹ năng tộc.
