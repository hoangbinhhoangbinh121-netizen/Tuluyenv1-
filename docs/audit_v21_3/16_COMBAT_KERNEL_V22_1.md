# 16 — Combat Kernel V22.1 (bổ sung cho 15)

## Thay đổi so với V22.0
| # | Nội dung | Ghi chú |
|---|---|---|
| 1 | **Mặc định bật** kernel cho **Boss Thế Giới + Chứng Đạo**; **Bí Cảnh + Tông Chiến vẫn `legacy`** | `KN.DEFAULT_MODE`. Giá trị admin đã đặt trong `bot_settings` được giữ nguyên; `!kernel boss legacy` / `!kernel all off` quay về V21.7.1 ngay lập tức. |
| 2 | **Nút Kỹ Năng Tộc** ở cả 4 giao diện; kỹ năng tộc **không còn tự phát** | `kernel_race_auto` mặc định `off` (`!kernel race on` = tự phát như V22.0, dùng làm cận trên khi benchmark). |
| 3 | **cpfx gộp vào kernel** (hộ thể / né / suy yếu / hồi của chiêu công pháp V16) cho Bí Cảnh `Kỹ Công Pháp` | `L.cp`, `KN.cp / cpIn / cpTick`, lưu cùng `m.kx`. Một nguồn duy nhất cho PvP và Bí Cảnh. |
| 4 | **Sổ Cái cho thưởng PvE** | `ledger.noteOnce` (không ném lỗi khi trùng khoá). Nối: thưởng Boss, thưởng Bí Cảnh (Linh Thạch + Linh Tinh), phí Chứng Đạo/Đế, rút/nộp Kho Tông. |
| 5 | Benchmark Tông Chiến + N lớn hơn | `scripts/bench_kernel22.js` (N qua biến môi trường). |

## Nút Kỹ Năng Tộc — hành vi
| Hệ thống | customId | Hành vi khi bấm |
|---|---|---|
| Boss | `wb|race|<boss>` (hàng 2) | Kỹ năng **tự thân**: thay đòn đánh của lượt (không gây sát thương, Boss vẫn phản công). Kỹ năng **tấn công**: đòn đánh × `mult` của kỹ năng. Tính vào hồi chiêu hành động 3s như mọi đòn. |
| Bí Cảnh | `b19|r|<run>|race` (hàng 3) | Giống Boss; tốn 1 lượt của người bấm. |
| Chứng Đạo | `cd|…|r|race` (hàng 2) | Là một lựa chọn ứng phó (như Pháp Bảo/Công Pháp). **Chỉ kỹ năng tự thân** (hồi/hộ thể/né…); tộc chỉ có kỹ năng tấn công → nút xám. |
| Tông Chiến | `sw|pq|<trận>` (bảng chiến trường) | Tự chọn mục tiêu như "Đánh Tiếp", đồng thời thi triển kỹ năng tộc. Kỹ năng tự thân **không** thay đòn đánh (khác Boss) — vẫn đánh 1 đòn. |

Từ chối lịch sự (tin nhắn riêng, **không tốn lượt, không đổi trạng thái**): kernel tắt · chưa chọn/thức tỉnh tộc · đang hồi chiêu (còn bao nhiêu lượt) · kỹ năng tấn công ở Chứng Đạo.
Hồi chiêu vẫn là `CD_MULT` của V22.0 (boss ×6, bicanh ×10, chungdao ×1, tongchien ×3) — đếm theo lượt của hệ thống đó.

## cpfx → kernel (Bí Cảnh)
- Dùng `Kỹ Công Pháp` (`sk`): nếu tên chiêu thuộc 40 công pháp V16 có hiệu ứng, áp **hộ thể / né / suy yếu / hồi** lên lớp kernel của người đánh (`L.cp.A`) và suy yếu lên quái (`L.cp.B`).
- Quái đánh người chơi: `raw ×= (1−hộ thể) × (1−suy yếu)`, né cộng vào tỉ lệ né (trần 60% như cũ); trừ lượt sau mỗi đòn (kể cả đòn bị né).
- Thành viên khác bị đánh (không phải người đang hành động): lớp nhẹ được **ghi lại** vào `m.kx` để số lượt hiệu ứng giảm đúng.
- Chỉ áp khi `kernel_bicanh = kernel`. Chứng Đạo vẫn dùng "Công Pháp Chống Lôi" riêng (không đổi).
- Hiệu ứng `dmg/pierce/crit` của chiêu **không** áp lại ở đây (Bí Cảnh đã có bảng `SIG` riêng) — tránh nhân đôi.

## Sổ Cái — phần đã nối thêm
| Luồng | Khoá | Ghi chú |
|---|---|---|
| Thưởng Boss (kể cả thoát/hết giờ) | `boss:<id>:<user>` | chống ghi đôi theo (boss, người) |
| Thưởng Bí Cảnh mỗi tầng | `bc19:<ngẫu nhiên>` | Linh Thạch và Linh Tinh ghi 2 dòng riêng |
| Phí Chứng Đạo/Đế (đổi/nâng/thức tỉnh Đế Đạo, chế/nâng Đế Binh) | `cdpay:<ngẫu nhiên>` | |
| Rút / nộp Kho Tông | `rutkho:` / `nopkho:<ngẫu nhiên>` | |
**Chưa nối:** Linh Thạch vào **Kho Tông** từ phần thưởng thắng/thua Tông Chiến (đi vào quỹ tông, không vào ví người chơi); thưởng nhiệm vụ; chế tạo; Cửa Hàng Nguyên Bảo; phí Tẩy Tủy bằng Linh Tinh.
Vì dùng khoá ngẫu nhiên ở vài nơi, sổ cái ở các luồng đó là **nhật ký**, không phải cơ chế chống ghi đôi (chống ghi đôi vẫn là điều kiện DB sẵn có của từng luồng).

## Giới hạn đã biết
- Hiệu ứng Boss/Tông Chiến nằm trong bộ nhớ: restart bot ⇒ mất hiệu ứng và hồi chiêu đang chạy (không mất tiền/vật phẩm). Bí Cảnh/Chứng Đạo lưu trong JSON nên bền qua restart.
- Hiệu ứng lên quái trong Bí Cảnh theo từng thành viên.
- Nút Chứng Đạo hiển thị xám cả khi kernel tắt (không có tin nhắn giải thích khi bấm vì nút bị khoá); nút Boss/Bí Cảnh/Tông Chiến vẫn bấm được và trả lời lịch sự.
- Chưa có số đo cho kỹ năng tự thân trong Tông Chiến vì nó cộng thêm vào đòn đánh (thiết kế khác Boss) — chờ bạn xác nhận muốn đổi thành "thay đòn" hay không.
- Kiểm thử: `scripts/test_kernel22.js` (79), `scripts/test_kernel221.js` (55), `scripts/bench_kernel22.js`. Discord thật: **NOT TESTED**.

## Benchmark (N=100 mỗi ô; `kernel_race_auto=on` = người chơi bấm kỹ năng ngay khi hồi xong ⇒ **cận trên**; hồi chiêu ×6/×10/×1/×3; mock + SQLite thật)
**Độ nhiễu:** với N=100 sai số tiêu chuẩn mỗi ô thắng/thua ≈ ±5 điểm % (Chứng Đạo dùng 1200 lượt/ô nên nhiễu thấp hơn; nhưng "HP cuối" vẫn dao động vài điểm — dòng "không tộc" không bị kernel tác động mà vẫn lệch 25%→23%). Hiệu số nhỏ hơn ~±8 điểm % **không** nên đọc là tác động thật.
Tông Chiến: 1v1, hai người cùng chỉ số, **ai đánh trước tung đồng xu** (lần chạy thử đầu với "người có tộc luôn đánh trước" cho 100% thắng ở dòng không tộc — lợi thế đi trước lớn — nên đã sửa).

### Bí Cảnh #1 solo, người chơi đúng cảnh giới yêu cầu — thắng / lượt TB / HP còn lại cuối run (legacy → kernel)
| Tộc | thắng | lượt | HP cuối |
|---|---|---|---|
| không tộc | 26% → 28% | 817 → 822 | 12% → 13% |
| nhan | 31% → 37% | 823 → 864 | 15% → 17% |
| long | 39% → 65% | 903 → 1003 | 18% → 30% |
| phuong | 100% → 100% | 994 → 905 | 53% → 51% |
| ma | 24% → 27% | 767 → 761 | 12% → 12% |
| linh | 55% → 54% | 948 → 955 | 25% → 25% |
| yeu | 22% → 17% | 765 → 735 | 10% → 8% |

### Boss Thế Giới — sát thương TB/đòn · phản công TB/đòn (legacy → kernel)
| Tộc | sát thương | phản công |
|---|---|---|
| không tộc | 55225 → 54899 | 146192 → 145634 |
| nhan | 56778 → 56607 | 148152 → 143504 |
| long | 56319 → 56085 | 152747 → 134703 |
| phuong | 57808 → 64456 | 143137 → 143728 |
| ma | 58279 → 65197 | 146242 → 145953 |
| linh | 55812 → 54568 | 138852 → 133658 |
| yeu | 56282 → 58058 | 152219 → 152746 |

### Chứng Đạo — tỉ lệ vượt kiếp / HP cuối (legacy → kernel), người chơi trung bình (có trang bị + 3 công pháp, không đan)
| Tộc | vượt kiếp | HP cuối |
|---|---|---|
| không tộc | 100% → 100% | 25% → 23% |
| nhan | 100% → 100% | 25% → 41% |
| long | 100% → 100% | 25% → 38% |
| phuong | 100% → 100% | 23% → 23% |
| ma | 100% → 100% | 23% → 14% |
| linh | 100% → 100% | 23% → 27% |
| yeu | 100% → 100% | 23% → 23% |

### Tông Chiến — 1v1 (ai đánh trước tung đồng xu) người có tộc vs người không tộc, cùng chỉ số: tỉ lệ người có tộc thắng / số đòn TB (legacy → kernel)
| Tộc | thắng | đòn TB | trận phân thắng bại |
|---|---|---|---|
| không tộc | 49% → 51% | 9.9 → 9.8 | 100 → 100 |
| nhan | 54% → 63% | 9.8 → 9.9 | 100 → 100 |
| long | 55% → 62% | 9.8 → 10.0 | 100 → 100 |
| phuong | 51% → 83% | 9.7 → 8.8 | 100 → 100 |
| ma | 43% → 60% | 9.6 → 9.2 | 100 → 100 |
| linh | 46% → 46% | 9.7 → 9.8 | 100 → 100 |
| yeu | 48% → 75% | 9.8 → 9.2 | 100 → 100 |

### Đọc kết quả (trung thực)
- **Tông Chiến là chỗ lệch nhất:** Phượng 51→83%, Yêu 48→75%, Ma 43→60%, Nhân/Long ~+8–9 điểm; Linh không đổi. Đây là cận trên (người chơi bấm đúng lúc, hồi chiêu ×3) và mức PvP vốn đã có chênh lệch tộc ~66–78% (đã ghi ở KNOWN_ISSUES V21.7) — nên **Tông Chiến vẫn để `legacy`** cho tới khi bạn quyết định hệ số hồi chiêu (đề nghị thử ×6 hoặc ×10).
- Boss: Phượng +11–12%, Ma +12% sát thương/đòn; Long giảm phản công ~12%; Yêu +3%; Nhân/Linh ≈ 0 (trong nhiễu).
- Chứng Đạo: không ảnh hưởng tỉ lệ vượt kiếp trong mô hình này (100% cả hai — người chơi trung bình đã thừa sức); Nhân/Long giữ thêm ~15 điểm HP cuối; Ma mất HP (hiến tế).
- Bí Cảnh #1: Long 39→65% là thay đổi rõ nhất (Hộ Thể); Phượng 100% cả hai bên (đã mạnh từ trước kernel). Bí Cảnh vẫn `legacy` mặc định.
