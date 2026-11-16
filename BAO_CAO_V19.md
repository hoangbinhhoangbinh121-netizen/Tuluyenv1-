# BÁO CÁO V19.0 / V19.1 / V19.2 — Bí Cảnh Tiên Giới · Chứng Đạo Thành Đế · Đế Đạo / Đế Binh / Đế Hiệu · Bản Mệnh · Sự kiện thế giới

> Nền: V18.2 (29 đại cảnh giới). Mọi cơ chế cũ giữ nguyên; V19 **mở rộng** các hệ thống sẵn có (công pháp V16, vật phẩm V17, Boss Thế Giới v7) thay vì dựng hệ thống thứ ba → không cộng dồn chỉ số hai lần, vẫn chịu các trần cũ.

## 0. V19.1 / V19.2 — Emoji pixel mới (51 cái)
> **V19.2:** người dùng chọn bộ tranh TỰ VẼ thay cho bản tôi vẽ ("Dùng cái này đi"). 51 emoji bên dưới nay là tranh của bạn — cắt từ `assets/source/v19_1_sheet.png` bằng `scripts/build_emoji_from_sheet_v19_1.py` (tách icon theo thành phần liên thông vì tranh không nằm đều ô, nền trong suốt, 128×128). Vài ô bạn vẽ khác ý nghĩa vị trí nên gán lại theo ngữ nghĩa: hồ lô → `linhngo19` (Lĩnh Ngộ), kiếm lửa xanh → `debinh` (Đế Binh), mặt trời trên mây → `sukien19` (Sự kiện). `make_pixel_emoji_v19.py` (bản vẽ bằng code) giờ chỉ tạo khóa còn thiếu, không bao giờ ghi đè.

`scripts/make_pixel_emoji_v19.py` vẽ (lưới 64×64 phóng ×2 → PNG 128×128, cùng phong cách bộ cũ) và chỉ **thêm file mới** vào `assets/emoji/` + thêm emoji Unicode dự phòng vào `src/data/emoji_fallback.json`. Khóa đã có (kể cả `linhngo` cũ — nên cái mới đặt tên `linhngo19`) KHÔNG bị ghi đè; `test_emoji19` băm toàn bộ emoji cũ trước/sau để chứng minh.
- **Chức năng (12):** `bicanh19` `chungdao` `dekiep` `dean` `dehieu` `benmenh` `dedao` `debinh` `sukien19` `linhngo19` `thucngo19` `doi19` · **Kẻ địch (5):** `mob_thuong` `mob_tinhanh` `mob_mini` `mob_canh` `boss19`
- **Đế Đạo (6):** `dd_satphat` `dd_sinhmenh` `dd_thoikhong` `dd_luanhoi` `dd_hondon` `dd_huydiet` · **Đế Binh (5):** `db_kiem` `db_chung` `db_ban` `db_an` `db_thap` · **Sự kiện (4):** `ev_dibien` `ev_dicanh` `ev_truyenthua` `ev_sieuthoat`
- **19 Bí Cảnh:** `bc19_00` … `bc19_18` — mỗi bí cảnh một cảnh vật riêng (cổ động tinh thể, cột vàng đổ nát, quả cầu hỗn nguyên, thiên cung trên mây, cổ mộ, điện ngai vàng, cửu u, thần điện, bậc thang đế đạo, đế cung, đảo nổi, lăng kim tự tháp, trận phong ấn, cầu vồng vạn đạo, cổng thiên nhãn, hạt bản nguyên, thiên hà tàn tích, ngai đen xích đỏ, biển ánh sáng).
- Hiển thị qua `src/ui/emo19.js` (tên bí cảnh trong menu/mục chọn, loại kẻ địch trong trận, Đế Đạo/Đế Binh, tab Đế, sự kiện, nút Tổ Đội/Lĩnh Ngộ/Thức Tỉnh…). Tổng emoji ứng dụng: 511 (giới hạn Discord 2000).
- Emoji pixel là tranh tôi vẽ bằng code; nếu bạn có bộ tranh tự vẽ, gửi sheet lên là có thể thay (cùng tên khóa) như các bản trước.

## 1. Lệnh mới
| Lệnh | Việc |
|---|---|
| `/bicanhtiengioi` | Menu Bí Cảnh Tiên Giới: chọn 1/19 bí cảnh, **Tiến vào (Solo)**, **Lập Tổ Đội** (2–5 người), **Xem Boss**, tiếp tục / thoát. Trong trận: Đánh · Công Pháp/Kỹ năng · Phòng Thủ · Nghỉ · Dùng vật phẩm · Tự động · Thoát. |
| `/chungdao` | Trước Đế: điều kiện + 12 đạo lôi + nút Bắt Đầu. Trong kiếp: bảng đạo 1–12, 6 cách ứng phó. Sau Đế: Tổng quan · **Đế Đạo** · **Đế Binh** · **Đế Hiệu**. |
| `/benmenh` | Công Pháp Bản Mệnh: đặt/đổi, Lĩnh Ngộ, Thức Tỉnh (cấp 30/60/90). |
| `/sukienthegioi` | Xem sự kiện đang chạy + bảng thành tích Siêu Thoát. Admin: tham số `khoi` (dibien/truyenthua/dicanh/sieuthoat) để mở thủ công. |
| `?dehieu <tên>` | Đặt Đế Hiệu bằng lệnh chữ (slash dùng nút trong `/chungdao`). |

**Giới hạn Discord 100 lệnh slash/phạm vi:** bản V18.2 đã dùng 97 → V19 thêm 4 slash = 100 (hết chỗ trống). `/bicanhlinhgioi` (đã là bản sao của `/bicanh`) và `/dehieu` chuyển sang cờ `prefixOnly` (vẫn gõ được `?bicanhlinhgioi`, không đăng ký slash). Muốn thêm lệnh slash mới sau này cần gộp/bỏ bớt.

## 2. Bí Cảnh Tiên Giới (spec Phần 2)
- 19 bí cảnh (theo từng đại cảnh giới Chân Tiên → Siêu Thoát) × 5 tầng; mỗi tầng: quái thường · tinh anh · mini boss · quái canh cửa · **Boss cuối** (3 giai đoạn: ATK +15% ở 70%, +30% ở 35%, hồi 5% HP mỗi mốc; đòn nặng có **dấu hiệu tụ lực** 1 lượt trước).
- Sát thương: `ATK × HệSốKỹNăng × Rand(0,9–1,1) × 100/(100+DEF)`.
- Tổ đội 2–5 người: HP boss × (1 + 0,65·(N−1)); người chơi mới có "tín dụng hành động" để kẻ địch không ra đòn quá dày khi đông người.
- 3 lượt vào/ngày/bí cảnh, tự bỏ lượt sau 90 giây treo, dọn trận treo 6 giờ; trạng thái lưu DB nên nút bấm sống sót qua restart.
- Phần thưởng theo từng tầng (bảng rơi theo spec), Dị Biến ×1,5 thưởng / ×1,3 rơi.
## 3. Công Pháp & Bản Mệnh (Phần 4)
- 15 công pháp mới (tier 1041–1055) trong nhóm `de`; cấp 1–100 với hệ số theo giai đoạn 100/110/120/135/150/170%; vật liệu giai đoạn ở cấp 10/30/50/70/90; 6 phẩm cấp mới.
- **Bản Mệnh:** mỗi người 1 quyển (lần đầu miễn phí, đổi tốn tài nguyên và reset), cộng hưởng +15% hiệu ứng khi đang trang bị / +40% khi để ngoài, +12% mỗi lần thức tỉnh (vẫn qua trần chung). Thức tỉnh 30/60/90: Hộ Thể (khiên 5%), Cộng Minh (+6% tu vi), Thần Thông (kỹ năng +0,8 hệ số, hồi chiêu −1).
## 4. Chứng Đạo Thành Đế (Phần 5)
- Cổng: **Chuẩn Tiên Đế · Viên Mãn**; `/dotpha` thường bị chặn tại đây và chỉ đường tới `/chungdao`.
- Tài nguyên: 100 Đế Đạo Bản Nguyên · 1 Đế Đạo Chứng Nhận · 5 Bất Hủ Đế Cốt · 10 Tiên Tôn Đạo Quả (trừ ngay khi bắt đầu).
- 12 đạo lôi: 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, **25%** sinh mệnh tối đa (đạo 12 bỏ qua 25% phòng ngự). Mỗi đạo bạn chọn ứng phó: Cứng Rắn / Đan Dược (≤3 viên) / Pháp Bảo / Công Pháp / Kỹ Năng / Dốc Toàn Lực — mỗi cách có hồi chiêu hoặc cái giá nên không thể spam một nút.
- Thành công → Tiên Đế Sơ Kỳ + Đế Ấn + lịch sử + thông báo toàn server. Thất bại → giữ cảnh giới, mất 10–20% tu vi, 10% sinh mệnh, **Thiên Kiếp Trọng Thương**, khoá 24 giờ, hoàn 50% tài nguyên (trừ Chứng Nhận). Treo >30 phút = thất bại.
- Người đã là Tiên Đế từ trước V19 được **công nhận sẵn** (không bắt chứng lại, có ngay Đế Đạo/Đế Binh/Đế Hiệu).
## 5. Đế Đạo · Đế Binh · Đế Hiệu (Phần 6–7)
- 6 Đế Đạo (Sát Phạt, Sinh Mệnh, Thời Không, Luân Hồi, Hỗn Độn, Hủy Diệt): chọn 1 (đổi tốn ×3 và mất cấp), cấp 1–10, thức tỉnh ở cấp 5 & 10.
- 5 Đế Binh đúng spec (Vạn Cổ Đế Kiếm, Hỗn Độn Chung, Luân Hồi Thiên Bàn, Thiên Đạo Thần Ấn, Vĩnh Hằng Thần Tháp): chế tạo, mang 1 món, cường hóa +10 (mỗi cấp +8% hiệu ứng gốc).
- Đế Hiệu 2–24 ký tự (chỉ chữ/số/khoảng trắng, chặn mention/link) hiển thị ở **menu chính, hồ sơ, bảng xếp hạng, PvP, thông báo toàn server**.
## 6. Sự kiện thế giới (Phần 8)
Thiên Địa Dị Biến (15–30 phút, thưởng Bí Cảnh ×1,5) · Vạn Cổ Truyền Thừa (5 phút, ≤20 người, nút **Tranh Đoạt**, mỗi người chỉ thắng 1 lần/ngày) · Đế Cảnh Xuất Thế (Boss Thế Giới cấp 10, từ Chân Tiên, ≤60 người) · Siêu Thoát Chi Môn (Boss cấp 11, chỉ Đại Đạo Chí Tôn+, ≤25 người, bảng thành tích riêng). Tự xuất hiện ngẫu nhiên **chỉ ở server đã `/datkenhthegioi`**, cách nhau tối thiểu 45 phút; tắt bằng env `EVENT19_AUTO=0`.

## 7. Ghi chú thiết kế / giả định (cần bạn biết)
1. File spec bị cắt ở §9.3 (Menu Boss) → giao diện Boss dùng lại bảng HP/giai đoạn đã làm, phần còn lại tôi tự thiết kế hợp lý.
2. Phòng ngự (DEF) được coi là **%** trong công thức `100/(100+DEF)` (DEF gốc game lớn tới hàng triệu nếu tính thô sẽ miễn nhiễm mọi đòn).
3. Chỉ số kẻ địch = hệ số × chỉ số trung bình người chơi, đã **nới 10%** sau mô phỏng cân bằng (`CFG` trong `src/game/bicanh19.js`, chỉnh được một chỗ). Số liệu spec về HP/ATK tuyệt đối không dùng được vì người chơi có thang chỉ số rất khác nhau.
4. Hiệu ứng công pháp V19 chỉ tác dụng trong Bí Cảnh/Chứng Đạo/Boss, **không** vào PvP.
5. Bản Mệnh, chi phí Đế Đạo/Đế Binh, và cơ chế Truyền Thừa là thiết kế của tôi (spec chỉ nêu khung).
6. Không có emoji tranh mới: vật phẩm V19 dùng emoji theo loại.
7. **Chưa thử trên Discord thật.** Đã kiểm bằng discord.js mô phỏng nghiêm ngặt + SQLite thật: `test_bicanh19` (437), `test_chungdao19` (112), `test_event19` (58), `test_views19` (2522 kiểm tra render/giới hạn Discord/luồng nút).
