# BÁO CÁO V21.6.4 — "Tặng & EXP cho admin + Bán trang bị hàng loạt"

**Nền:** zip v21.6.3 của bạn (sửa ack nút/biểu mẫu) + ghép thêm chẩn đoán trùng bản bot (`src/instance.js`, cảnh báo trùng trong `/loigannhat`, lệnh `!phienban`, footer hiện đúng version) và khoá tuần tự `pend/settle` trong `skin.js` (phản hồi thật đợi lời ack tự động của watchdog xong → tránh 40060).

## 1. /quantri → mục mới **🎁 Tặng & EXP**
| Nút | Làm gì |
|---|---|
| 📈 Cộng EXP | 1 người, chọn hệ thống: `tuvi`, `nghe` (cả 4 nghề) hoặc tên nghề, `thu` (mọi linh thú), `tongmon` (EXP tông, tự thăng cấp), `conghien`, `benmenh`, `dihoa` (mọi ngọn), `daolu` (đồng bộ 2 người), hoặc **`all`** = mọi hệ thống người đó có. Hệ thống không áp dụng được thì báo "bỏ qua + lý do". |
| 🌐 EXP toàn server | Như trên cho mọi người chơi — bắt buộc gõ `DONGY`. |
| 🔮 Pháp Bảo | tầng 1–5 / tên / `tatca`; chế độ `tang` · `thu` (thu hồi, tự tháo nếu đang dùng) · `trangbi` (tặng + trang bị). |
| 📜 Công Pháp | mã (1–7, 101, 102, 201, 1001–1055) / tên / `tatca`, kèm đặt cấp tối thiểu (không bao giờ hạ cấp). |
| 💊 Đan Dược | `Tên (Phẩm) x số, …` hoặc `tatca (Phẩm) x số`; chỉ nhận danh mục Đan Dược (chặn nhầm vật phẩm khác). |
| 🛡️ Trang bị | nhiều món một lần: `Tên x2, Tên khác` hoặc `tatca` (mỗi mẫu 1 món), phẩm chất 1–5, tối đa 60 món/lần. |
| 🌐 Tặng toàn server | vật phẩm/đan cho mọi người chơi, `DONGY`, tối đa 1000/loại. |

Quy tắc an toàn: đi qua lớp game sẵn có (Inventory Service, `gear17`, `pets.addExpRaw`, `benmenh19`, `dihoa20`…), **tôn trọng trần** (nghề không vượt ngưỡng cấp kế, thú theo cảnh giới chủ, bản mệnh tối đa 100), ghi **Nhật Ký Admin** mọi thao tác, lỗi một người không làm hỏng cả đợt. Module mới: `src/game/adminGift21.js` (mở rộng `admin17`, không thay thế).

## 2. Người chơi: **Bán trang bị hàng loạt**
Nghề → Trang Bị → **🧾 Bán hàng loạt**: chọn "phẩm chất tối đa" → xem trước số món + tiền → xác nhận.
Luôn **giữ lại**: món đang mặc, món 🔒 khoá, món đã cường hoá / tinh luyện / khảm ngọc / thức tỉnh. Mỗi món xoá bằng điều kiện `equipped=0 AND locked=0` trong transaction → bấm đôi không bán 2 lần.
Đổi nhỏ: giá NPC thu trang bị nay nhân **hệ số "NPC thu"** admin đặt (trước đây chỉ vật phẩm bị ảnh hưởng, trang bị thì không).

## 3. Kiểm thử
- `scripts/test_gift2164.js`: **63 PASS** (EXP từng hệ thống + trần, toàn server cần DONGY, pháp bảo/công pháp/đan/trang bị, chặn sai loại, nhật ký, form hợp lệ ≤5 ô & nhãn ≤45 ký tự, bán hàng loạt: giữ đồ bảo vệ, không bán đôi, hệ số NPC, UI strict).
- Hồi quy toàn bộ: xem `KET_QUA_HOI_QUY` cuối file này.
- **Chưa kiểm thử trên Discord thật** (chỉ discord.js mô phỏng + SQLite thật).

## 4. Hạn chế / chưa làm
- "Bán trang bị" mình hiểu là **bán hàng loạt cho NPC** (bán lẻ từng món đã có từ trước). Nếu bạn muốn **bán giữa người chơi (chợ)** thì cần thiết kế riêng — nói mình biết.
- EXP linh thú không vượt trần cảnh giới chủ (đúng luật game); muốn bỏ trần cần quyết định cân bằng.
- V21.7 (HP PvP thật + khôi phục trận + sổ cái Linh Thạch) và V22.0 chưa làm trong bản này.

## KET_QUA_HOI_QUY
46 file test: 43 PASS; test_emoji19 và test_realms_v18 FAIL chỉ vì zip không chứa ảnh nguồn vẽ emoji (assets/source/*_sheet*.png, đã loại cho nhẹ — chạy ở bản đầy đủ thì PASS); test_gift2164 báo exit=1 một lần khi chạy song song với lần chạy tay của mình (nghi tranh chấp thư mục db_backups dùng chung), chạy riêng 9/9 lần PASS.
