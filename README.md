# Tiên Giới Bot v19.8 — Node.js + discord.js + SQLite

> **v19.8** — Hồi chiêu **Thiên Nhân Ngũ Suy chỉnh lên 12 giờ mỗi giai đoạn** (v19.4 để 2 giờ; bản gốc 24 giờ) → vượt đủ 5 giai đoạn mất ít nhất ~2,5 ngày. Chỉnh ở `COOLDOWN_THIENNHANNGUSUY` trong `src/game/cooldowns.js`.

> **v19.7** — (1) **Tiên Giới bị khóa sau Ngũ Suy + Phi Thăng**: muốn đột phá từ Chân Tiên trở lên (kể cả bước Độ Kiếp Viên Mãn → Chân Tiên), vào Bí Cảnh Tiên Giới, Chứng Đạo và sự kiện Tiên Giới đều BẮT BUỘC đã vượt **Thiên Nhân Ngũ Suy** và **Phi Thăng Tiên Giới**; thiếu thì bot báo rõ từng điều kiện và không tốn tu vi. Admin đặt cảnh giới Tiên trong `/quantri` được coi như đã qua Ngũ Suy (không cộng thưởng). (2) **Phi Thăng âm thầm**: người chơi bật bằng nút 🤫 trong menu Phi Thăng hoặc lệnh tiền tố `?phithangamtham` (không tốn ô slash) — khi Phi Thăng Linh Giới / Tiên Giới, kết quả và hiệu ứng chỉ mình họ thấy (slash: ephemeral; tiền tố: nhắn riêng). Test: `scripts/test_tiengate_v19_7.js`.

> **v19.6** — `/quantri` → **Nhân Vật** → nút **👑 Miễn Ngũ Suy**: admin nhập ID/@ người chơi để cho họ vượt cả 5 giai đoạn Thiên Nhân Ngũ Suy ngay (đúng như thắng thật: +% thuộc tính vĩnh viễn và danh hiệu Thiên Nhân; người đã vượt rồi thì không cộng lần hai). Có ghi Nhật Ký Admin (`mien_ngusuy`).

> **v19.5** — **Cảnh giới Tiên khó hơn nhưng tu nhanh hơn**: EXP đột phá từ **Chân Tiên trở lên** nhân chồng thêm — Chân Tiên → Đại La Kim Tiên **×3** (tổng ×21), từ Chuẩn Tiên Vương trở lên **×4** (tổng ×140, các cảnh giới rất cao tiệm cận **trần mềm** 9e15 nên tăng ít hơn ×4 nhưng vẫn tăng dần); đồng thời **tốc độ Tu Luyện / Bế Quan / Treo ở cảnh giới Tiên ×3** (chỉ nhân tu vi). Cửa Độ Kiếp Viên Mãn → Chân Tiên giữ ×7. Chỉnh trong `/quantri` → Kinh tế → Hệ số Tiên (5 ô) hoặc env `TIEN_MID_EXTRA_MULT` / `TIEN_HIGH_EXTRA_MULT` / `TIEN_SPEED_MULT`. Test: `scripts/test_tien_v19_5.js`.

> **v19.4** — (1) **Thiên Nhân Ngũ Suy** hồi chiêu giữa 2 giai đoạn giảm từ **24 giờ xuống 2 giờ** (`COOLDOWN_THIENNHANNGUSUY` trong `src/game/cooldowns.js`; người đang chờ được áp ngay). (2) **Bí Cảnh Tiên Giới**: thông báo "chưa vào được" nay nói rõ — cần ĐÃ Phi Thăng Tiên Giới (thế giới 2) chứ không chỉ cảnh giới — và liệt kê từng điều kiện Phi Thăng còn thiếu (Lực Chiến, Linh Thạch, Lĩnh Ngộ 100%, Bí Cảnh Thượng Cổ ≥10, Thủ Hộ, Ngũ Suy…); thiếu cảnh giới thì chỉ đường `/dotpha`. Test: `scripts/test_gate_v19_3.js`.

> **v19.3** — **Hiệu ứng Chứng Đạo Thành Đế** (30 file bạn gửi, dùng đủ): mỗi đạo lôi trong `/chungdao` có ảnh nền riêng + GIF lôi đánh xuống giữa các đạo; chứng đạo thành công chiếu chuỗi 6 cảnh (lôi cuối → Thần Quang → Đại Đạo Luân Bàn → Vạn Đạo Cộng Minh → Kim Long/Chu Tước → Đế Quân Giáng Thế) rồi cảnh Đế Tọa + Đế Ấn; thất bại có cảnh riêng; tab Đế (Tổng Quan/Đế Đạo/Đế Binh/Đế Hiệu) và thông báo toàn server đều có ảnh. Ảnh dựng bằng `scripts/build_chungdao_fx_v19_3.py` → `assets/chungdao/` (~3,7 MB). Thiếu file hoặc gửi ảnh lỗi → tự về giao diện chữ cũ, không ảnh hưởng dữ liệu. Test: `scripts/test_chungdao_fx19.js`.

> **v19.2** — 51 emoji V19 nay dùng **TRANH DO BẠN TỰ VẼ** (bảng `assets/source/v19_1_sheet.png`, cắt bằng `scripts/build_emoji_from_sheet_v19_1.py`), thay bản tôi vẽ bằng code ở v19.1. Script vẽ bằng code không còn ghi đè.

> **v19.1** — **51 emoji pixel mới** cho các chức năng V19 (Bí Cảnh Tiên Giới + riêng từng bí cảnh 1–19, Chứng Đạo/Đế Kiếp, Đế Ấn, Đế Hiệu, Bản Mệnh, 6 Đế Đạo, 5 Đế Binh, 4 sự kiện thế giới, Tổ Đội, loại kẻ địch + Boss). Giữ NGUYÊN toàn bộ emoji cũ; tự tải lên như bộ cũ, chưa tải được thì dùng emoji Unicode dự phòng. Vẽ bằng `scripts/make_pixel_emoji_v19.py`.

> **v19.0** — **Bí Cảnh Tiên Giới** (`/bicanhtiengioi`: 19 bí cảnh × 5 tầng, solo/tổ đội 2–5 người, boss 3 giai đoạn) · **Chứng Đạo Thành Đế** (`/chungdao`: 12 đạo Đế Kiếp tại Chuẩn Tiên Đế Viên Mãn) · **Đế Đạo / Đế Binh / Đế Hiệu** · **Công Pháp Bản Mệnh** (`/benmenh`) · 15 công pháp mới (tier 1041–1055, cấp 1–100) · 25 vật phẩm mới · **sự kiện thế giới** (Dị Biến, Truyền Thừa, Đế Cảnh Xuất Thế, Siêu Thoát Chi Môn; `/sukienthegioi`). Đúng 100 lệnh slash (giới hạn Discord). Chi tiết & giả định thiết kế: `BAO_CAO_V19.md`.

> **v18.2** — Tiên cao (từ Chuẩn Tiên Vương) cần thêm **x5 EXP đột phá** (tổng x35 so với trước v17.1); chỉnh bằng `/quantri` hoặc env `HIGH_TIEN_EXP_MULT`.
>
> **v18.0** — MỞ RỘNG CẢNH GIỚI: từ 15 lên **29 đại cảnh giới** (… Đại La Kim Tiên → Chuẩn Tiên Vương · Tiên Vương · Chuẩn Tiên Tôn · Tiên Tôn · Chuẩn Tiên Đế · **Tiên Đế** · Chuẩn Tiên Tổ · Tiên Tổ · Chuẩn Đạo Tổ · Đạo Tổ · Chuẩn Thiên Đạo · Thiên Đạo · Đại Đạo Chí Tôn · Vô Thượng Chí Tôn · **Siêu Thoát**), từ Chân Tiên trở lên mỗi cảnh giới đúng 4 tiểu cảnh giới Sơ Kỳ/Trung Kỳ/Hậu Kỳ/Viên Mãn. Siêu Thoát Viên Mãn là đỉnh cao nhất hiện tại. **Migration tự động** (có sao lưu, chạy 1 lần, đối chiếu, rollback): Tiên Đế cũ (index 14) → Tiên Đế mới (index 19) Viên Mãn — không mất dữ liệu. Emoji cảnh giới 14–28 dùng TRANH DO BẠN TỰ VẼ (v18.1) + 4 emoji tiểu cảnh giới. Chi tiết: `BAO_CAO_V18.md`.

> **v17.2** — (1) Hiệu ứng **Phi Thăng Tiên Giới**: 5 cảnh pixel động (cảnh báo → Thiên Môn → Thiên Kiếp → độ kiếp thành công → Tiên Giới đón khách) rồi cảnh cuối kèm kết quả; chạy SAU khi giao dịch đã commit nên lỗi ảnh không ảnh hưởng dữ liệu. (2) Admin: `/quantri` — một lệnh có menu + biểu mẫu: cho/thu vật phẩm V17, cho trang bị, đặt cấp nghề, hoàn tất lò; đặt cảnh giới/tu vi/Linh Thạch/Linh Tinh, hồi phục; chỉnh EXP đột phá, hệ số Tiên, rơi đồ, giá NPC ngay trong game; sự kiện tăng tốc tu luyện / tăng tỉ lệ rơi có thời hạn; thông báo toàn server; nhật ký admin (`admin_log17`).

> **v17.1** — Đột phá TRÊN Độ Kiếp Viên Mãn (cửa ải Độ Kiếp Viên Mãn → Chân Tiên và toàn bộ cảnh giới Tiên) cần tu vi **x7** (`TIEN_EXP_MULT`, chỉnh bằng env; tốc độ/phần thưởng tu vi không đổi).

> **v17.0** — BÁCH NGHỀ · KINH TẾ VẬT PHẨM HỢP NHẤT. 4 nghề (Đan Sư · Luyện Khí Sư · Trận Pháp Sư · Linh Thực Sư) với 9 cấp, EXP, kỹ thuật, thành tựu, thành thạo công thức; 118 vật phẩm / 11 danh mục / 7 phẩm cấp tách khỏi phẩm chất sản phẩm; 49 công thức; 16 đan dược có tác dụng thật (giới hạn mỗi ngày); 8 trang bị 7 ô (cường hoá/tinh luyện/sửa/phân giải, không còn cộng chỉ số vĩnh viễn); 7 trận pháp triển khai thật (phí duy trì, số lượt, Hộ Tông do Tông Chủ); Linh Điền; rơi nguyên liệu có trần ở Bí Cảnh/Boss/Linh Thú; NPC thu mua/bán; kho đồ phân loại. MỌI hiệu ứng đi qua một lớp chặn trần (`fx17`); Inventory Service là chủ sở hữu duy nhất của vật phẩm; dữ liệu V16 giữ nguyên trong cột cũ. Lệnh mới: `/nghenghiep` `/trangbi` `/linhdien` `/khophanloai` `/npcthumua` (+ admin `/doichieuv17`). Xem `BANG_DOI_CHIEU_V17.md`, `BAO_CAO_V17.md`.
>
> > **v16.7** (trước đó) — LOẠI BỎ việc giao dịch / đổi Linh Căn và Thể Chất giữa người chơi (Giao Dịch chỉ còn Linh Thạch + Đan Dược; đề xuất cũ có đổi căn cốt tự huỷ, không mất gì). Thêm lệnh admin `/xemnguoichoi` (7 mục + xuất file đầy đủ, chỉ đọc, riêng tư). Sửa kit: emoji trong Select phải là object.
> **v16.6** — Mã đền bù thêm 1 Đan Tẩy Tủy Nửa Tác Dụng (xem v16.5). **v16.5** — Mã đền bù sự cố mất dữ liệu: `DENBUMATDULIEU` (mỗi tài khoản đổi 1 lần, không giới hạn lượt, không cần admin duyệt): 5.000.000 Linh Thạch + 100 Linh Tinh + 3 Rương Thần Bí + 2 Đan Phá Giới + 10 Đan Dược + 1 Đan Tẩy Tủy Nửa Tác Dụng. Mã code hỗ trợ thêm trường `linh_tinh`. Sửa quà trong `src/data/constants.json` → `CODE_DEFINITIONS`.
> **v16.4** — Nút **Nâng Tối Đa** (nâng liên tục tới khi hết Linh Thạch/Linh Tinh thì tự dừng ở cấp đó) và **Nâng +10 cấp** trong Tàng Kinh Các, dùng cho cả công pháp cũ lẫn mới. Công pháp mới có thêm hiệu ứng **Lực Chiến** (+% lực chiến, tính 1 lần), đà tăng trưởng theo cấp ×2,8 ở Cấp 100 (trước ×2,2), trần tổng nâng lên (Công/Thủ 4,5 · HP 5,4 · Tốc 4,0 · Tu vi 8,0 · Boss 2,5 · Lực Chiến 3,0). Test: `scripts/test_upgrade_many_v16_4.js`.
> **v16.3** — Quyển ĐỘC QUYỀN và Tiên Giới ("xịn") luôn cao hơn công pháp cũ: độc quyền vượt Tầng 201 ở mọi chỉ số / tu vi / buff Đấu Pháp (1040 mạnh nhất), Tiên Giới vượt Tầng 102 (nửa trên ≥ Tầng 201), Tiên Giới Tu Luyện vượt công pháp cũ. Nâng trần tổng: Công/Thủ 3,0 · HP 3,6 · Tốc 2,7 · Tu vi 7,0 · Boss 1,8. Chiêu độc quyền mạnh hơn.
> **v16.2** — Công pháp mới mạnh hơn công pháp cũ: chỉ số ×1,9–2,2 (quyển đa chỉ số ×2,8), tu vi nhận được ×2,2–3,2, buff Đấu Pháp ×2,2–2,6; nâng trần tổng (Công/Thủ 2,0 · HP 2,4 · Tốc 1,8 · Tu vi 5,0); thêm 5 kiểu hiệu ứng: Tu Luyện nhân đôi, giữ tu vi khi đột phá hỏng, giảm sát thương Lôi Kiếp, né Lôi Kiếp, +Linh Thạch Bí Cảnh. Tự tính lại buff Đấu Pháp đã lưu khi khởi động. Test: `scripts/test_buff_v16_2.js`.
> **v16.1** — Giảm EXP đột phá thêm một nửa so với v16.0: cổng tầng nhỏ 0,40 → 0,20, cổng đại cảnh giới 0,25 → 0,12. Tốc độ tu luyện không đổi. Chỉnh bằng env `EXP_GATE_MINOR_MULT` / `EXP_GATE_MAJOR_MULT`.
> **v16.0** — Tàng Kinh Các: +40 Công Pháp mới (Nhân/Linh/Tiên Giới + 10 độc quyền), 4 chiêu thức thật trong Đấu Pháp, nâng cấp tới Cấp 100, mảnh bí tịch, Kỳ Ngộ (module mới). Gộp Bế Quan Treo V15 (10%, không nhân đôi, không giới hạn giờ). EXP đột phá giảm mạnh, nerf nhẹ Tu Luyện bấm dồn dập, công pháp cộng nhẹ tốc độ tu luyện. 72 emoji Công Pháp bằng tranh người dùng cung cấp (`assets/source/congphap_sheet_v16.png`, cắt bằng `scripts/build_congphap_emoji_from_sheet_v16.py`). Migration tự backup (`db_backups/`) + `migrateV16.rollback()`. Chi tiết: `CAN_BANG_V16.txt`.
> **v14.5** — Lỗi `Unknown interaction (10062)`: không còn bị tính là lỗi code/spam kênh admin; thêm đo độ trễ nhận lượt bấm + cảnh báo vòng lặp bị chặn để tìm nguyên nhân bot trả lời chậm.
> **v14.4** — Sửa lỗi `cd72` (menu chọn thú hiến tế ở mục Huyết Mạch `/linhthu`: `default` bị null thay vì true/false). Test giả lập discord.js nay kiểm tra chặt như thư viện thật + bấm thử mọi nút/menu của `/linhthu`.
> **v14.3** — Sửa lỗi `65dd` của `/linhthu` (ô embed vượt 1024 ký tự khi dùng emoji tùy chỉnh; menu chọn dùng emoji sai kiểu) + chặn lỗi tương tự ở Tông Môn Chiến, Kho Đồ.
> **v14.2** — Sửa Bế Quan Treo (treo đúng 5% tốc độ Tu Luyện bấm tay — trước đó tính thiếu nên xuất quan gần như không nhận tu vi), bỏ giới hạn 4 giờ, tách `/xuatquan` khỏi `/treoquan`; thêm `/baotri` bảo trì toàn bộ bot.
> **v14.1** — Thay emoji pixel Linh Thú (45 loài + 9 huy hiệu phẩm cấp) bằng bộ tranh người dùng cung cấp (`assets/source/pet_sheet_v14_1.png`, cắt bằng `scripts/build_pet_emoji_from_sheet_v14_1.py`). Không đổi logic.
> **v14.0** — Linh Thú & Khế Ước làm lại (45 loài, 3 loại khế ước, `/linhthu`), Tông Môn Chiến tách Nhân Giới / Linh Giới, giảm EXP đột phá. Chi tiết: `CAN_BANG_V14.0.txt`.

Bot Discord game tu tiên, chuyển từ bản Python (`tuluyenv1_daolu_fixed_v10`) sang **Node.js**.
Dữ liệu lưu trong **1 file SQLite** (`data/tutien.db`) đi kèm bot — không cần PostgreSQL hay dịch vụ database riêng.

> ✅ **Đã chuyển toàn bộ** tính năng của bản Python (xem `MIGRATION_STATUS.md`). Bản `beta`: đã chạy thử logic trên DB thật nhưng chưa chạy với Discord thật — hãy thử trên server thử trước.

> 📄 **v11.0**: xem `HUONG_DAN_V11.txt` (đổi emoji pixel theo sprite, sửa tu luyện, boss thế giới mới, UI đồng bộ).

## Cài đặt
1. Cài Node.js ≥ 18 (khuyên dùng 20+). `npm install`
2. Sao chép `.env.example` → `.env`, điền `DISCORD_TOKEN` (và `GUILD_ID` để lệnh slash hiện ngay).
3. Trên Discord Developer Portal → Bot: bật **Message Content Intent** nếu dùng lệnh tiền tố `!`
   (hoặc đặt `ENABLE_PREFIX_COMMANDS=0` để chỉ dùng slash). Lệnh chữ dùng tiền tố **`?`** (như bản Python, vd `?tuluyen`, `?danhboss`) và **`!`**; đổi bằng `COMMAND_PREFIX=?,!`. Muốn bot tự cho người rời server rời cứ điểm Tông Môn Chiến: bật **Server Members Intent** và đặt `ENABLE_MEMBERS_INTENT=1`.
4. `npm start`

## Chuyển dữ liệu từ bản Python
```
node scripts/import-old-db.js đường/dẫn/tutien_20260816_064733.db
```
Schema giữ nguyên nên toàn bộ nhân vật, tông môn, PvP, event... được giữ lại. Script tự sao lưu DB hiện có, rồi thêm các cột mới còn thiếu.
ID Discord (>2^53) được xử lý dạng chuỗi nên **không bị sai số**.

## Sao lưu (admin — chỉ ID trong `ADMIN_CODE_APPROVER_IDS`)
`/backupdb` (tạo + gửi file) · `/listdb` · `/usedb <số>` (có xác nhận) · `/restore_db [file .db]`
Bot còn **tự sao lưu mỗi 6 giờ** (`AUTO_BACKUP_HOURS`), giữ 8 bản gần nhất.

## Hosting 24/7
Bot cần chạy liên tục trên máy/hosting. **Nếu hosting xoá ổ đĩa mỗi lần khởi động lại, database sẽ mất** →
gắn ổ đĩa bền vững (Volume) và đặt `TULUYEN_DB_PATH=/data/tutien.db`, hoặc tải backup định kỳ về.

## Emoji pixel
`assets/emoji/*.png` được tự upload thành *Application Emoji* lúc khởi động (cần token hợp lệ).
Tắt bằng `TULUYEN_EMOJI_AUTOSYNC=0`. `scripts/make_pixel_emoji.py` là công cụ vẽ gốc (chỉ dùng khi muốn vẽ lại).

## Cấu trúc
```
src/db/        schema (tự sinh từ Python), kết nối SQLite (better-sqlite3 hoặc node:sqlite)
src/data/      constants.json — toàn bộ số liệu game, TRÍCH TỰ ĐỘNG từ file Python
src/game/      logic game (port 1:1)      src/ui/  View/embed/menu      src/commands/  lệnh
```

## Lệnh admin
* Slash (ID trong `ADMIN_CODE_APPROVER_IDS`): `/backupdb /listdb /usedb /restore_db /thuhoilinhthach`.
* Slash (quyền Administrator trong server): `/mopvp /khoapvp /mosukienphu /mokhoacode /thientongcode`.
* Ẩn (chỉ ID trong `ADMIN_DISCORD_IDS`, gõ `!hoang` để xem): `!tongmonchien_start|stop|reset|addpoint|debug`, `!restore_db` (đính file .db).
* Đặt `TULUYEN_PVP_LOCKED=1` nếu muốn PvP khoá mặc định khi chưa từng chạy `/mopvp`.

## Chạy trên VibeHost / Pterodactyl
1. Giải nén `tien-gioi-bot-v6-7.zip`, **upload NỘI DUNG thư mục `tien-gioi-bot/`** (không phải cả thư mục) vào gốc `/home/container` sao cho thấy `index.js`, `package.json`, `src/`, `assets/` ngay ở gốc.
2. Tab **Startup**: file khởi động là `index.js` (mặc định). Nếu host có ô "Additional Node packages"/"npm install" thì bật; nếu không, mở Console chạy: `npm install`.
3. Tạo file `.env` ở gốc (copy từ `.env.example`) và điền `DISCORD_TOKEN`, `GUILD_ID`.
4. Bấm **Start**. Database nằm ở `data/tutien.db` trong ổ của server (ổ này giữ nguyên khi khởi động lại).
Node 22+ không cần `better-sqlite3` (bot tự dùng SQLite có sẵn của Node). Bản `index.js` này cũng chạy được trên Node 18–24.

### Lệnh admin không phản hồi?
* Gõ đúng **`!restore_db`** (có gạch dưới, không có dấu cách). Hoặc dùng **`/restore_db`** và đính kèm file `.db` — cách này không cần bật Message Content Intent.
* Lệnh `!` chỉ chạy khi đã bật **Message Content Intent** trong Discord Developer Portal → Bot → Privileged Gateway Intents.
* ID Discord của bạn phải nằm trong danh sách admin: đặt `ADMIN_IDS=ID_CUA_BAN` trong `.env` (lấy ID: Cài đặt Discord → Nâng cao → bật Chế độ nhà phát triển → nhấn giữ tên bạn → Sao chép ID).

> Danh sách lỗi đã biết / việc làm tiếp: xem **`KNOWN_ISSUES.md`**.
