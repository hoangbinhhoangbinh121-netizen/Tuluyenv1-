# Tiên Giới Bot v14.4 — Node.js + discord.js + SQLite

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
