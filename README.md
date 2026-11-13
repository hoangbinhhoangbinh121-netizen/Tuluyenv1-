# Tiên Giới Bot v16.7 — Node.js + discord.js + SQLite
> 🏪 **v16.8:** thêm **TuTienStore** — nạp tiền thật (VietQR + SePay), tự giao vật phẩm, tin nhắn ẩn. Xem `TUTIENSTORE.md`.
> 🔒 **v16.8:** thêm lệnh admin **`/khoatuluyen`** — khóa/mở khóa tu luyện của 1 người chơi (tạm thời theo giờ hoặc vô thời hạn, tùy chọn khóa cả Đột Phá). Chặn Tu Luyện, Bế Quan, Cảm Ngộ, Linh Mạch, Bế Quan Treo ở cả lệnh gõ lẫn nút bấm; khóa lưu DB, hết hạn tự gỡ; khi khóa phiên treo đang chạy bị hủy. Test: `npm run test:lock`.

> **v16.7** — LOẠI BỎ việc giao dịch / đổi Linh Căn và Thể Chất giữa người chơi (Giao Dịch chỉ còn Linh Thạch + Đan Dược; đề xuất cũ có đổi căn cốt tự huỷ, không mất gì). Thêm lệnh admin `/xemnguoichoi` (7 mục + xuất file đầy đủ, chỉ đọc, riêng tư). Sửa kit: emoji trong Select phải là object.
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
