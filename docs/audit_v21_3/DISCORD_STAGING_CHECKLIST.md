# Checklist thử trên Discord thật (server thử riêng) — V21.4
Chuẩn bị: 1 server riêng, bot + 3 tài khoản (A, B, X ngoài trận), `LOG_LEVEL` bình thường. Với mỗi bước ghi vào bảng: thời điểm · custom ID · user · kết quả · mã lỗi (nếu có, đọc `logs/`).

| # | Kịch bản | Cách làm | Kỳ vọng |
|---|---|---|---|
| 1 | Bí Cảnh lập đội | A `/bicanhtiengioi` → Tổ Đội; B, C bấm Tham Gia; X bấm Bắt Đầu; A bấm Bắt Đầu | Tin nhắn hiện đủ 4 nút; X bị từ chối; A bắt đầu được |
| 2 | Hủy phòng | A lập đội → B vào → B bấm Hủy Phòng → A bấm Hủy Phòng | B bị từ chối; A đóng phòng |
| 3 | PvP kéo dài | A khiêu chiến B → B Chấp Nhận → đánh ≥8 hiệp | embed chỉ 3 hiệp gần nhất, không lỗi 50035 |
| 4 | Đầu hàng | Bấm Đầu Hàng → bỏ qua → đánh tiếp; lần sau Xác nhận | trận chỉ kết thúc khi Xác nhận |
| 5 | AFK | Cả hai/một bên không bấm 2 hiệp | bỏ lượt → xử thua/hòa theo luật |
| 6 | Restart giữa trận | Đang đánh thì restart bot | tin nhắn đổi thành "bị huỷ", không mất tu vi |
| 7 | Nhật ký | `/lichsupvp` → mã trận → ▶ ◀ Lọc; X thử xem | A,B xem được; X bị từ chối |
| 8 | Bấm đúp | Bấm nhanh 2 lần Đánh Thường | chỉ tính 1 lần |
| 9 | Đồng thời | A và B bấm cùng lúc | qua hiệp đúng 1 lần |

## Bổ sung V21.5 — Chủng Tộc (chưa chạy trên Discord thật)
| # | Kịch bản | Cách làm | Kỳ vọng |
|---|---|---|---|
| R1 | Slash `/chungtoc` có hiện | Gõ `/chungtoc`; `/dungluong` không còn là slash (dùng `!dungluong`) | Menu 6 tộc; tổng slash = 100, không lỗi đăng ký |
| R2 | Chọn tộc | Chọn tộc trong select → xem trước → Xác nhận | Hồ sơ hiện tộc; không trừ Linh Thạch; chọn lần 2 bị từ chối |
| R3 | Người khác bấm | B bấm nút trên menu của A | "Đây không phải menu của bạn" |
| R4 | Thức tỉnh / huyết mạch / tiến hóa | Đủ & thiếu điều kiện | Thiếu → báo rõ, KHÔNG trừ; đủ → trừ đúng phí, lịch sử ghi |
| R5 | Bấm đúp | Bấm nhanh 2 lần Thức Tỉnh khi chỉ đủ tiền 1 lần | Chỉ 1 lần thành công |
| R6 | Đổi tộc | Chọn tộc khác → xác nhận | Trừ 1.000.000; reset tiến trình; lần 2 trong 7 ngày bị chặn |
| R7 | Chỉ số | So `/thuoctinh`, Lực Chiến trước/sau khi chọn tộc | Đổi đúng hướng (Ma: công↑ thủ↓); `/xemnguoichoi` khớp |
| R8 | Tương thích | Người chơi chưa chọn tộc | Chỉ số không đổi so với V21.4 |

## Bổ sung V21.6 — Hiệu ứng / Kỹ năng tộc / Lỗi mạng (chưa chạy trên Discord thật)
| # | Kịch bản | Cách làm | Kỳ vọng |
|---|---|---|---|
| E1 | Nút Kỹ Năng Tộc | A (đã chọn tộc + thức tỉnh ≥1) khiêu chiến B | Hàng 2 có nút "Kỹ Năng Tộc"; B chưa có tộc bấm → báo "chưa mở khoá" |
| E2 | Kỹ năng tự thân | A (Nhân/Long/Ma/Linh) bấm Kỹ Năng Tộc | Nhật ký có dòng thi triển + vẫn ra đòn thường; nút báo "còn hồi N hiệp" khi bấm lại |
| E3 | Kỹ năng tấn công | A (Phượng/Yêu) bấm Kỹ Năng Tộc | Đòn mạnh hơn; Phượng gây Thiêu Đốt, Yêu gây Xuất Huyết khi bạo kích |
| E4 | Sát Chiêu hồi chiêu | Dùng Sát Chiêu 2 hiệp liên tiếp | Lần 2 báo "còn hồi 2 hiệp" (không ra đòn) và không bị trừ lượt |
| E5 | DoT thật | Đánh đến khi có Trúng Độc/Xuất Huyết/Thiêu Đốt | Dòng "−N sinh lực" đầu hiệp sau; thanh sinh lực giảm khớp |
| E6 | Choáng | Khi bị Choáng Váng | Mất đúng 1 lượt; hiệp kế tiếp không bị choáng lại |
| E7 | Công tắc | `bot_settings`: `pvp_effects_mode=log`, `pvp_killmove_cd=0` | Quay lại hành vi V21.5 (hiệu ứng chỉ ghi chữ, Sát Chiêu dùng liên tục) |
| E8 | Embed | Trận dài ≥10 hiệp có nhiều hiệu ứng | Embed không vượt giới hạn, không lỗi 50035 |
| N1 | Lỗi mạng | Chặn DNS `discord.com` tạm thời rồi gõ `!tuluyen` | Không có "Lỗi `xxxx`"; bot tự gửi lại; `/loigannhat` hiện "🌐 N lần mạng chập chờn" |

