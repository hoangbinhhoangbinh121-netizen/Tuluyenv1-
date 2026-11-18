# BÁO CÁO V19.0 / V19.1 / V19.2 / V19.3 / V19.4 / V19.5 / V19.6 / V19.7 / V19.8 / V19.9 / V19.10 — Bí Cảnh Tiên Giới · Chứng Đạo Thành Đế · Đế Đạo / Đế Binh / Đế Hiệu · Bản Mệnh · Sự kiện thế giới

> Nền: V18.2 (29 đại cảnh giới). Mọi cơ chế cũ giữ nguyên; V19 **mở rộng** các hệ thống sẵn có (công pháp V16, vật phẩm V17, Boss Thế Giới v7) thay vì dựng hệ thống thứ ba → không cộng dồn chỉ số hai lần, vẫn chịu các trần cũ.

## 000000000. V19.10 — Emoji a19_* thay bằng tranh người dùng
- Bảng người dùng 8×5 (nền mờ gradient) → tách nền bằng độ nét cục bộ (icon pixel sắc, nền mờ), chọn ô theo nghĩa: atk=kiếm, item=hồ lô, tuyet=phượng vàng, gift=rương, sk=sách tím, than=cầu tím, warn=chuông, trong=kiếm tối, ll=lửa xanh, dead=bia đá, win=cờ 仙, crown=vương miện, next=cổng thiên môn, log=cuộn giấy, rest=thiền định, map=họa đồ, retreat=bồ câu. 16 khóa còn lại giữ bản code. Không đụng emoji cũ.

## 00000000. V19.9 — Boss ×10–20 + emoji pixel Bí Cảnh Tiên Giới
- **Công thức mới (game/bicanh19.js `bossPower`)**: HP kẻ địch = (công trung bình đội) × (hệ số loại × độ khó cũ) × `POW_HP`; `POW_HP` đi tuyến tính 10 → 20 từ bí cảnh 0 → 18, nhân tỉ lệ loại (`KIND_HP`: Boss cuối 1, canh cửa 0,8, mini 0,6, tinh anh 0,35, thường 0,2). Sát thương: `POW_ATK` 1 → 1,6 × `KIND_ATK` (1 / 0,9 / 0,8 / 0,6 / 0,4). Cả hai nhân thêm `BC19_HP_MULT` / `BC19_ATK_MULT` (mặc định 1, chỉnh trong `/quantri`).
- **Vì sao Đại La từng "mạnh hơn" Chuẩn Tiên Vương**: Boss bí cảnh tính theo chỉ số của CHÍNH người chơi nên chênh lệch giữa hai bí cảnh liền kề chỉ 5–8% — nhỏ hơn dao động ngẫu nhiên của hệ số HP (35–45) → cảm giác thứ tự bị đảo. Nay mỗi bí cảnh liền kề cách nhau ~5,5% HP *chắc chắn* cộng với dải ngẫu nhiên nhỏ hơn đường cong, và test kiểm tra tăng nghiêm ngặt (`test_boss_v19_9.js`). Nếu muốn chênh lệch rõ hơn nữa: tăng `POW_HP[1]` (trần ×20) trong `CFG`.
- **Boss Thế Giới** (`game/boss.js`): `suggestedHp` × `WB_HP_MULT` (15) × (1 + 0,5 × (cấp − 7) từ cấp 8); phản đòn × `WB_ATK_MULT` (2,5), vẫn không bao giờ giết hẳn người đánh.
- **Cân bằng (mô phỏng, KHÔNG phải người chơi thật)**: `KIT=1 node scripts/sim_bicanh19.js 0,4,9,14,18 1 10` — người chơi "có đồ vừa phải" solo thắng 100% bí cảnh 0–9, ~80% bí cảnh 14, ~10% bí cảnh 18; tổ đội 3 người thắng 100% cả bí cảnh 18. Một lần vào bí cảnh dài hơn rất nhiều (Boss cuối ≈ 100–250 đòn solo) → nút **Tự Chiến** nay chạy tối đa 20 lượt/lần. Nếu thấy quá khó/dễ, chỉnh ngay trong `/quantri` → Kinh Tế → **Sức mạnh Boss**.
- Trần sát thương/HP trong trận `DMG_CAP` 9e15 → 9e17 (để Boss ×20 không bị chặn phẳng ở cảnh giới cao).
- **Emoji**: 33 emoji pixel mới `a19_*` (kiếm, nổ, cầu thần thông, sao băng, đầu lâu, sách, khiên, hoa sen, bình đan, bánh răng, mắt, 2 mũi tên làm mới, rút lui, cổng sang tầng, người+cộng, cửa, nút play, X, cờ caro, cảnh báo, mũi tên yếu, bia mộ, giọt sinh mệnh, cuộn giấy, hộp quà, cúp, bản đồ, biểu đồ, ngọn lửa linh lực, vương miện, khóa, dấu tick, dấu X) — gắn vào mọi nút và nhật ký trận của Bí Cảnh Tiên Giới. Nhật ký đã lưu trong DB vẫn là Unicode, được đổi sang pixel **lúc hiển thị** (`emo19.px`). Emoji cũ không đổi (tổng 511 + 33 = 544).

## 0000000. V19.8 — Ngũ Suy hồi chiêu 12 giờ
- `COOLDOWN_THIENNHANNGUSUY` = 12 giờ/giai đoạn (đổi từ 2 giờ của v19.4). Tính theo mốc thời gian đã lưu: ai vừa thử từ lâu hơn 12 giờ thì thử tiếp được ngay, ai vừa thử gần đây phải chờ tới đủ 12 giờ kể từ lần thử.

## 000000. V19.7 — Khóa Tiên Giới + Phi Thăng âm thầm
- Luật mới (`ascension.tienUnlocked/tienGateMsg`): `world_tier ≥ 2` VÀ `thiennhanngusuy_passed`. Áp cho: đột phá khi đang ở hoặc sắp vào Chân Tiên trở lên (kiểm tra TRƯỚC tu vi, không tốn gì), Bí Cảnh Tiên Giới, Chứng Đạo, tranh đoạt Truyền Thừa. Người đã lỡ ở Chân Tiên mà chưa phi thăng (kẽ hở cũ) sẽ bị khóa đột phá tiếp tới khi Phi Thăng; không bị mất cảnh giới.
- Admin: `/quantri` đặt cảnh giới Tiên → tự nâng thế giới 2 và đánh dấu đã qua Ngũ Suy (không cộng thưởng); `Miễn Ngũ Suy` vẫn dùng để cho thưởng thật.
- Phi Thăng âm thầm: cột `phithang_quiet` (migration tự thêm). Bật → `/phithang` (cả thất bại), hiệu ứng Tiên Giới và nút Phi Thăng trong menu đều riêng tư; lệnh tiền tố nhắn riêng (không nhắn được thì mới hiện công khai để không mất kết quả). Mặc định TẮT (giữ hành vi cũ).
- Test cũ đã chỉnh dữ liệu mẫu (người chơi Tiên Giới giả lập nay cần cờ đã qua Ngũ Suy).

## 00000. V19.6 — Admin miễn Thiên Nhân Ngũ Suy
- `/quantri` → Nhân Vật → **Miễn Ngũ Suy** (modal nhập người chơi). Dùng chung hàm `grantNgusuyPass` với đường thắng thật nên kết quả y hệt: giai đoạn 5/5, +% HP/Công/Thủ/Thân Pháp, danh hiệu Thiên Nhân, điều kiện Phi Thăng Tiên Giới tick xanh. Đã vượt rồi → báo không đổi, không cộng lần hai. Nút nằm hàng riêng (Discord tối đa 5 nút/hàng).

## 0000. V19.5 — EXP Tiên ×3/×4, tốc độ Tiên ×3
- Cách hiểu yêu cầu: "tăng EXP lên x3 x4" = EXP đột phá nhân thêm **×3 cho Chân Tiên→Đại La Kim Tiên** và **×4 cho Tiên cao (từ Chuẩn Tiên Vương)**, nhân chồng với ×7 / ×5 đã có; "tốc độ tu luyện khi lên Tiên ×3" = Tu Luyện / Bế Quan / Treo từ Chân Tiên trở lên ×3 (không nhân Linh Thạch). Cả ba chỉnh được ở `/quantri` hoặc env.
- Hệ số tổng EXP đột phá so với trước V19.5: Chân Tiên→Đại La ×21 (7×3), Tiên cao ×140 (7×5×4). Cửa Độ Kiếp Viên Mãn → Chân Tiên vẫn ×7.
- Giới hạn kỹ thuật: mốc tu vi không thể vượt ~9e15 (giới hạn số nguyên an toàn của JS). Thay vì chặn phẳng (làm các cảnh giới đỉnh bằng nhau), V19.5 dùng **trần mềm** (`R.softCap`): mốc ≤ 6e15 giữ nguyên ×3/×4 chính xác (tới Chuẩn Tiên Tổ), trên đó tăng chậm dần và tiệm cận 9e15 — Đạo Tổ…Siêu Thoát tăng khoảng ×1,4–×3,5 thay vì ×4 nhưng vẫn LUÔN tăng dần theo cảnh giới. Muốn ×4 đủ cho cả đỉnh cần đổi sang số lớn (BigInt) — chưa làm.
- Người chơi đang ở Tiên: mốc đột phá cao lên ngay, tu vi đang có được giữ nguyên; tốc độ nhận tu vi ×3.

## 000. V19.4 — Ngũ Suy nhanh hơn · giải thích rõ điều kiện Bí Cảnh Tiên Giới
- Thiên Nhân Ngũ Suy: hồi chiêu 24 giờ → **2 giờ** mỗi giai đoạn (5 giai đoạn ≈ 10 giờ thay vì 5 ngày). Tính theo mốc thời gian đã lưu nên người đang chờ được lợi ngay. Chỉnh ở `COOLDOWN_THIENNHANNGUSUY`.
- Bí Cảnh Tiên Giới cần **cả hai**: ĐÃ Phi Thăng Tiên Giới (thế giới 2) **và** cảnh giới ≥ yêu cầu của bí cảnh (bí cảnh 1 = Chân Tiên, mỗi bí cảnh +1 cảnh giới). Trường hợp cảnh giới đã đủ nhưng còn ở Linh Giới, thông báo nay ghi rõ và liệt kê từng điều kiện Phi Thăng còn thiếu (cũng hiện trong menu `/bicanhtiengioi`). Đã kiểm bằng test: người đủ điều kiện Phi Thăng → phi thăng thành công → tạo được trận Bí Cảnh.
- Lưu ý thiết kế: người ở Linh Giới vẫn có thể đột phá vượt Độ Kiếp Viên Mãn (không bị áp chế như Phàm Giới) nên có trường hợp cảnh giới cao hơn thế giới — tôi giữ nguyên, chỉ làm thông báo rõ ràng.

## 00. V19.3 — Hiệu ứng Chứng Đạo Thành Đế
- Nguồn: gói `chung_dao_thanh_de_assets_v2_nhe.zip` (**30 file**: 16 cảnh, 3 GIF, 11 sprite). Dùng đủ cả 30 — bảng file → nơi dùng nằm ở `MANIFEST` trong `scripts/build_chungdao_fx_v19_3.py` (test kiểm đủ 30).
- Dựng sẵn vào `assets/chungdao/` (19 JPG 1200×675 q72, 2 PNG 384², 3 GIF thu nhỏ; tổng ≈3,7 MB): `loi_01..12` (cảnh nền + tia sét tím cho Thiên Địa/Hỗn Độn, vàng cho Đế Đạo/Chung Cực; số tia tăng theo tầng kiếp; đạo 12 thêm Thần Quang), `intro`, `fail`, `de_toa`, `binh`, `win_a..d`, `de_an`, `de_hoan`, `anim_*`.
- Luồng: Bắt đầu → ảnh đạo 1; mỗi lần ứng phó → GIF lôi đánh xuống ~1,5 giây rồi sang đạo kế (nút bị gỡ trong lúc chiếu, lỗi sửa tin thì tự thử lại 1 lần; không hiện được thì gõ `/chungdao`). Thắng → 6 cảnh ≈16 giây + cảnh cuối Đế Tọa/Đế Ấn + kết quả + thông báo server kèm ảnh. Thua/bỏ cuộc → cảnh riêng + ảnh `fail`.
- Tab Đế: Tổng Quan = Đế Tọa + Đế Ấn; Đế Đạo = GIF Đại Đạo Luân Bàn; Đế Binh = Đế Quân Giáng Thế; Đế Hiệu = Đế Hoàn.
- An toàn: hiệu ứng chạy SAU khi DB đã commit; mọi lỗi ảnh/hết hạn tương tác → rơi về chữ, dữ liệu không đổi. Dùng `attachments: []` để thay ảnh cũ khi đổi tab.
- Gọn zip: bỏ `assets/source/v19_1_sheet.png` và `assets/emoji_preview_v7*.png` khỏi gói (không dùng lúc chạy; file đã có trên repo thì giữ nguyên).

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

## v19.11 — Hướng dẫn lụm vật phẩm Chứng Đạo
- `src/game/chungdaoGuide.js` (dữ liệu thuần, sinh từ REQ + nguồn rơi + `expectedDrop`), giao diện `chungdaoViews.guideView` (5 trang, select menu), nút trong `/chungdao`, lệnh chữ `?huongdanchungdao` (prefixOnly — slash đã đủ 100).
- **Vá**: Bất Hủ Đế Cốt chỉ rơi ở bc9–12 (cần Tiên Đế) nên không thể đủ ×5 để Chứng Đạo. Nay thêm bc8 (Đế Đạo Cổ Lộ): Boss cuối lần đầu chắc chắn 1, sau đó `DE_COT_BOSS8` = 30%; `MAT_BOOST` Đế Cốt [1,2].
- Test: `scripts/test_chungdao_guide_v19_11.js`.
