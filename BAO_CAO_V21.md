# BÁO CÁO V21.0 — Cửa Hàng Nguyên Bảo · Gói Nạp · Admin "Done Đơn"

> ⚠️ Chưa chạy trên Discord thật — chỉ kiểm bằng discord.js giả lập chặt + SQLite thật (`scripts/test_shop21.js`: 288 kiểm tra đạt).
> ⚠️ **Không có cổng thanh toán tự động.** Bot không thể biết tiền đã vào tài khoản. Luồng nạp: khách tạo đơn → chuyển khoản → **admin đối chiếu sao kê rồi bấm Done** → bot cộng Nguyên Bảo.

## 1. Cách hoạt động
**Tiền tệ:** 💠 **Nguyên Bảo** (ví riêng, bảng `v21_wallet`; không đụng Linh Thạch/Linh Tinh). 1 Nguyên Bảo = 100đ.

| Gói | Nhận | Ghi chú |
|---|---|---|
| 10.000đ | 100 💠 | |
| 20.000đ | 210 💠 | tặng +10 |
| 50.000đ | 550 💠 | tặng +50 |
| 100.000đ | 1.150 💠 | tặng +150 |

**Người chơi:** `/cuahang` (hoặc `?nap` / `!nap` mở thẳng màn nạp) → duyệt 14 danh mục / tìm tên (không cần dấu) → chọn món → chọn phẩm (với đan & trang bị) → Mua ×1/5/10/50 (trang bị ×1/3/5/10).
**Nạp:** Nạp → chọn gói → bot tạo **đơn #N** + hiện **mã QR nhận tiền của shop** (v21.1: `assets/ui/qr_nap.jpg` — QR Zalopay/liên ngân hàng, chủ TK HOANG SAO AN BINH), số tiền và **nội dung `TG<N>`**. Đây là QR **tĩnh**: khách tự nhập số tiền + nội dung (nếu app không cho ghi nội dung, nhắc khách gửi biên lai). Nếu admin cài tài khoản ngân hàng (VietQR động) thì dùng **ảnh VietQR tự điền sẵn số tiền + nội dung** (dịch vụ img.vietqr.io, chỉ là đường dẫn ảnh) thay cho QR tĩnh → khách bấm "Tôi đã chuyển khoản" → bot nhắn riêng admin → admin xác nhận → khách nhận tin nhắn + Nguyên Bảo vào ví.

## 2. Cửa hàng bán gì (418 mặt hàng)
- **Mọi vật phẩm kho đồ** không phải vật phẩm nhiệm vụ (350): Đan Dược 89, Linh Dược, Linh Thực, Khoáng Vật, Tài Liệu Yêu Thú/Trận Đạo, Thiên Địa Chí Bảo, Nguyên Liệu Trung Gian, Trận Pháp… (đan có chọn phẩm Hạ→Thánh).
- **Thiên Bảo Thể Chất · Thiên Bảo Linh Căn · Truyền Thừa Ngọc Giản** (150 / 150 / 400 💠).
- **Vật phẩm Linh Thú** (22): Linh Thú Lương/Đan, Thu Phục Phù, Khế Ước Phù, Kỹ Năng Ngọc Giản, Hóa Linh Châu, Tinh Hoa…
- **Trang bị** (43 mẫu, gồm cả trang bị giai đoạn V20, chọn phẩm 1–5).
- **KHÔNG bán:** 12 vật phẩm nhiệm vụ (`is_quest_item`): Thiên Đạo Thạch, Đạo Nguyên Tinh, Thiên Đạo Ấn, Mảnh Tiên Giới Lệnh, Mảnh ghép Phi Thăng, Linh/Tiên Giới Lệnh, Linh/Tiên Phù, Điểm Linh Ngộ, Đế Đạo Chứng Nhận, Đế Ấn. Admin ẩn thêm từng món được.

**Giá:** `⌈2·√(giá trị gốc/1000)⌉` × hệ số phẩm (0,7 / 1 / 1,6 / 2,8 / 5) × hệ số admin; hàng "NPC không thu mua" (Hỏa Chủng, Đan Tẩy Tủy, vật liệu Chứng Đạo) ×3. Ví dụ: Tụ Khí Đan 5 💠 · Thanh Phong Kiếm 12 💠 · Bất Hủ Đế Cốt 165 💠 · Đan Tẩy Tủy 6.000 💠. Dải giá 1 → ~8.500 💠 (không phình triệu lần theo giá trị gốc).

## 2b. Lệnh `.od` — đơn mua trực tiếp (v21.2)
`.od <tên vật phẩm> [xSL] [p1-5] [@khách]` (tiền tố **`.`** luôn dùng được cho riêng lệnh này, dù `COMMAND_PREFIX` chỉ đặt `!`; `?od`/`!od` cũng được).
- `.od truyền thừa` · `.od truyền thừa x3` · `.od đan tụ khí x10 p3` · `.od thiên bảo thể chất @khách` (admin tạo hộ) · `.od i:dan_tu_khi` (theo mã: `i:` kho, `t:` Thiên Bảo/Truyền Thừa, `p:` Linh Thú, `g:` trang bị). Tên gõ không cần dấu; "truyền thừa", "tt" = Truyền Thừa Ngọc Giản. Tên mơ hồ → bot liệt kê tối đa 10 mã để chọn.
- Bot gửi **thẻ đơn** trong kênh: vật phẩm, số lượng, **số tiền = giá 💠 × 100đ (tối thiểu 1.000đ)**, QR, mã `TG<số>`, 3 nút: *Tôi đã chuyển khoản* (chỉ khách của đơn) · *Done đơn (admin)* (chỉ admin) · *Huỷ*.
- Admin Done → bot **giao thẳng vật phẩm vào túi khách** (không qua ví Nguyên Bảo, không cộng tiền nạp) và nhắn riêng khách. Nếu kho khách đầy chỉ nhận được một phần, phần còn lại được **hoàn thành 💠 vào ví** (không mất tiền). Mỗi đơn chỉ giao 1 lần.
- Người thường chỉ tạo đơn cho **chính mình** (@người khác bị từ chối); tối đa 3 đơn chờ/khách (admin tạo hộ tới 10). Vật phẩm nhiệm vụ / hàng bị ẩn / cửa hàng đóng → không tạo đơn. Đơn mua cũng hiện trong tab `/quantri → Cửa Hàng & Đơn Nạp` (ghi rõ vật phẩm) để Done từ đó.
- DB: thêm 4 cột vào `v21_orders` (kind, item_key, item_q, item_qty) — tự ALTER khi khởi động nên DB đã chạy v21.0/v21.1 vẫn nâng cấp được (đã test).

## 3. Admin — `/quantri → 🏪 Cửa Hàng & Đơn Nạp`
Chỉ admin (`ADMIN_CODE_APPROVER_IDS`). Mọi thao tác ghi **Nhật Ký Admin**.
- **Done đơn**: chọn đơn ở menu → ✅ Done (hoặc "Done theo mã" gõ `TG12`). Đơn "đã báo chuyển" xếp lên đầu. Nhắn riêng người chơi khi xong.
- **Huỷ đơn**, **Cộng/trừ 💠** thủ công, **Xem ví** (số dư, đã nạp, đơn gần nhất).
- **Tài khoản nhận tiền** (tuỳ chọn, mã ngân hàng VietQR + số TK + tên) — hoặc env `SHOP_BANK_ID/ACC/NAME`. Không bắt buộc nếu dùng QR tĩnh có sẵn; **không có cả hai thì khách chưa nạp được.** Đổi QR tĩnh: thay file `assets/ui/qr_nap.jpg` (hoặc env `SHOP_QR_FILE`).
- **Giá · Mở/đóng** (hệ số giá ×0,1–20; đóng cửa hàng chặn cả mua lẫn nạp), **Ẩn/hiện hàng**.
- Bảng doanh thu đã xác nhận: hôm nay / 30 ngày / tổng.

## 4. An toàn & hạn chế (nói thẳng)
- Mỗi đơn cộng **đúng 1 lần** (UPDATE có điều kiện trong transaction); bấm Done lần 2 không cộng thêm. Đơn đã huỷ không Done được. Đơn quá 24 giờ chuyển "hết hạn" nhưng admin vẫn Done được nếu khách chuyển muộn.
- Người chơi **không thể tự cộng tiền**: nút "Tôi đã chuyển" chỉ báo admin. Người thường (hoặc admin khác mượn bảng) bấm nút Done đều bị từ chối (test).
- Số dư ví không âm; mua = kiểm đủ tiền → phát hàng → trừ tiền trong 1 transaction; kho đầy thì chỉ tính tiền phần nhận được; sổ cái `v21_ledger` luôn khớp số dư (test).
- Mỗi người tối đa 3 đơn chờ. Chỉ nhận đúng 4 gói.
- **Chưa làm:** cổng thanh toán tự động / webhook ngân hàng (cần tài khoản & khoá của bạn); hoàn tiền tự động; mua Công Pháp bằng Nguyên Bảo; giới hạn mua theo ngày (hiện không giới hạn — nếu lo lạm phát, dùng hệ số giá hoặc ẩn hàng).
- **Cân bằng:** bán vật phẩm hiếm/đồ giai đoạn cao bằng tiền thật làm mạnh người nạp (đúng yêu cầu "mọi thứ nhận được đều bán trừ nhiệm vụ") và làm giảm giá trị việc cày. Giá là ước lượng, cần chỉnh sau vài ngày chạy thật.
- Ví Nguyên Bảo không có chuyển/giao dịch giữa người chơi.

## 5. Kỹ thuật
Bảng mới (`schema_v21.js`, CREATE IF NOT EXISTS): `v21_wallet`, `v21_orders`, `v21_buys`, `v21_ledger`. Mã: `game/shop21.js` (logic), `ui/shop21Views.js` (nút tĩnh `sp|uid|act|a|b`), tab `dn` trong `ui/quantriViews.js`, `commands/shop21.js`. `/cuahang` chiếm 1 chỗ slash (đã nhường bằng cách chuyển `doichieuv17` — lệnh admin chỉ-đọc — thành lệnh chữ); `?nap` là lệnh chữ nên tổng slash vẫn 100.
