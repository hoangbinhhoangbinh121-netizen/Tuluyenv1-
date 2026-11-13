# 🏪 TuTienStore (v16.8) — Nạp tiền thật, nhận vật phẩm vào Tiên Giới Bot

Khách **nạp tiền thật → nhận Thiên Tệ** (nạp càng nhiều thưởng càng cao) → **mua vật phẩm bằng Thiên Tệ**, bot tự giao vào nhân vật. Nạp bằng **mã đơn + QR**, tiền về là bot tự cộng Thiên Tệ và báo "✅ Thanh toán thành công". **Mọi tin nhắn đều ẩn** (ephemeral / DM), không lộ ra kênh chung.

## Lệnh
| Lệnh | Ai | Việc |
|---|---|---|
| `/tutienstore` | người chơi | Mở cửa hàng (menu danh mục → vật phẩm → số lượng → Tạo đơn → QR) |
| `/donhang` | người chơi | Xem 8 đơn gần nhất |
| `/storeadmin` | admin bot | `xem` · `ds` · `duyet` · `giaolai` · `huy` · `gia` · `bat` · `tat` · `sp` · `thongke` · `vi` · `congtt` · `hoantien` · `kiemtra` |

Chỉ dùng được bằng **slash** (để tin nhắn ẩn). Người không phải admin gõ `/storeadmin` chỉ nhận thông báo ẩn.

## 🪙 Thiên Tệ — tiền ảo của shop (nạp tiền thật → mua vật phẩm)
**Thiên Tệ không phải Linh Thạch**: là ví riêng của shop (bảng `store_wallet`, có sổ cái `store_ledger` ghi mọi biến động). Luồng: **Nạp tiền thật → có Thiên Tệ → mua vật phẩm bằng Thiên Tệ** (giao vào nhân vật ngay, không cần QR mỗi lần).

**Nạp:** `/tutienstore` → *Nạp Thiên Tệ* → chọn mức nhanh hoặc ✏️ nhập số tiền tuỳ ý (`75000`, `75k`, `1tr`). Tối thiểu 10.000đ, tròn nghìn, tối đa 20.000.000đ/đơn. Nạp càng nhiều thưởng càng cao (thưởng % trên toàn bộ số Thiên Tệ quy đổi):

| Số tiền nạp | Thưởng | Thiên Tệ / 1.000đ |
|---|---|---|
| từ 10.000đ | gốc | 10 |
| từ 50.000đ | +5% | 10,5 |
| từ 100.000đ | +10% | 11 |
| từ 200.000đ | +15% | 11,5 |
| từ 500.000đ | +20% | 12 |
| từ 1.000.000đ | +30% | 13 |

Ví dụ nạp 100.000đ → **1.100 Thiên Tệ**.
**Giá vật phẩm bằng Thiên Tệ** = giá VNĐ ÷ 100 (theo tỉ lệ gốc), ví dụ gói 10 Đan Dược 15.000đ = 150 Thiên Tệ. Nạp bậc cao thì cùng món rẻ hơn tính theo tiền thật. Đổi tỉ lệ gốc bằng `STORE_TT_PER_1K`, đổi bậc thưởng trong `src/store/topup.js`, đổi giá món bằng `/storeadmin gia`. Mọi con số là **mặc định tham khảo** — hãy cân đối theo kinh tế server.

**Mua:** chọn món → **🪙 Mua bằng Thiên Tệ** (trừ ví + giao ngay). Giao lỗi mà chưa giao gì → bot **tự hoàn** Thiên Tệ. `STORE_DIRECT_BUY=0` để tắt chuyển khoản trực tiếp từng món, chỉ bán qua Thiên Tệ.
**Ví:** nút *Ví Thiên Tệ* trong shop xem số dư + 8 giao dịch gần nhất. Admin: `/storeadmin vi <ID>`, `congtt <ID> <số>` (âm = trừ), `hoantien <mã đơn>`.
**An toàn:** DB không cho số dư âm; trừ tiền bằng lệnh có điều kiện nên 2 lượt mua cùng lúc không tiêu quá số dư; mỗi đơn nạp/mua/hoàn chỉ ghi sổ 1 lần (UNIQUE) nên không bị cộng-trừ đôi. Doanh thu chỉ tính tiền thật nhận được (mua bằng Thiên Tệ không tính lại).

## Hai chế độ nhận tiền
| | VietQR động (tự động) | QR tĩnh — ZaloPay (duyệt tay) |
|---|---|---|
| Cần | Tài khoản **ngân hàng** + SePay | Ảnh QR (`assets/store/qr.jpg`, đã kèm sẵn) |
| QR | Có sẵn số tiền + nội dung | Khách **tự nhập** số tiền + lời nhắn = mã đơn |
| Cộng Thiên Tệ | Tiền về là **tự cộng** | Khách bấm **✅ Tôi đã chuyển** → bot báo admin → admin kiểm tra lịch sử ví rồi `/storeadmin duyet <mã đơn>` |
Điền `STORE_BANK_ID/ACCOUNT_NO/ACCOUNT_NAME` thì bot dùng VietQR động; để trống thì dùng QR tĩnh. Ví ZaloPay cá nhân **không có webhook** nên không thể tự động.

## Cài đặt nhanh (5 bước)
1. Giải nén đè lên bot cũ. Không cần cài thêm thư viện, DB tự tạo bảng `store_*` khi khởi động.
2. Điền `.env` (xem `.env.example`, khối *TuTienStore*): `STORE_BANK_ID`, `STORE_ACCOUNT_NO`, `STORE_ACCOUNT_NAME`.
3. **Nhận tiền tự động:** tạo tài khoản [SePay](https://sepay.vn), liên kết ngân hàng, vào *Tích hợp Webhooks* → thêm webhook:
   - URL: `https://<tên-miền-hoặc-IP>:<cổng>/sepay`
   - Kiểu chứng thực: **API Key**, giá trị = `STORE_SEPAY_API_KEY` trong `.env`
   - Sự kiện: *Có tiền vào*
   Bot phải có **cổng public** (VPS mở cổng, hoặc Pterodactyl allocation, hoặc cloudflared/ngrok). Heroku-kiểu `worker` không nhận được HTTP — đổi sang `web`.
4. Khởi động lại bot, chạy `/storeadmin kiemtra` để xem cấu hình đủ chưa.
5. Chỉnh giá: `/storeadmin sp` xem mã & giá → `/storeadmin gia <mã> <giá>`. Không có SePay thì vẫn chạy: khách chuyển khoản, admin gõ `/storeadmin duyet <mã đơn>`.

## Danh mục (lấy từ dữ liệu game — không bán thứ game không có)
💎 Tài Nguyên (Linh Thạch, Linh Tinh, Khí Vận, Rương Thần Bí, Nguyên Liệu) · 🧪 Đan Dược/Phá Giới/Tẩy Tủy/Nhẫn Cầu Hôn · 🌱 Linh Căn (đặt thẳng phẩm) · 💪 Thể Chất (đặt thẳng phẩm) · 🛡️ 5 Pháp Bảo · 📜 40 Công Pháp V16 (Nhân/Linh/Tiên/Độc Quyền) + 9 Công Pháp cổ · 🐾 Vật phẩm Linh Thú (thức ăn, Thu Phục Phù, Khế Ước, Bản Mệnh Tinh Huyết, Huyết Mạch, Kỹ Năng) · 🔥 Hóa Linh Châu & Nguyên Tố Tinh Hoa.

**Không bán:** Linh Thú sống/trứng (thu phục qua Bí Cảnh), Công Pháp Tầng 201 (chỉ rơi từ Boss), Hồng Mông Tử Khí Quyết (chỉ từ Rương). Giá trong code là **giá mặc định tham khảo** — hãy chỉnh theo kinh tế server của bạn.

## Chống gian lận / sai sót (đã có test)
- **Không tin ảnh chuyển khoản.** Chỉ giao khi webhook SePay (có API key) báo tiền VỀ đúng mã đơn, hoặc admin duyệt tay.
- Mỗi giao dịch ngân hàng xử lý **đúng 1 lần** (`store_tx`); webhook gửi lặp / chuyển 2 lần cùng mã → không giao thêm, báo admin để hoàn tiền.
- Chuyển **thiếu** → cộng dồn, nhắc khách chuyển bù cùng nội dung; chuyển **dư** → vẫn giao, báo khách liên hệ admin.
- Đơn **quá hạn QR** vẫn giao nếu tiền về; đơn **đã huỷ** mà tiền về → không tự giao, báo admin.
- Giao hàng theo từng bước, ghi tiến độ cùng transaction → lỗi giữa chừng/giao lại không bị **cộng đôi**. Lỗi → đơn `error` + báo admin, sửa xong `/storeadmin giaolai`.
- Linh Căn/Thể Chất **chỉ bán phẩm cao hơn** phẩm đang có (không để khách tụt phẩm); Pháp Bảo/Công Pháp đã sở hữu thì không bán lại. Thu hồi Linh Căn/Thể Chất vẫn dùng `/thuhoituchat` của game.
- Giới hạn: tối đa 3 đơn chờ/người, Bản Mệnh Tinh Huyết 2 gói/ngày (như shop trong game).

## Kiểm thử
`node scripts/test_store_v16_8.js` (28 nhóm: đối soát, giao hàng, chống trùng, lỗi giao) · `node scripts/test_store_webhook_v16_8.js` (xác thực webhook).
