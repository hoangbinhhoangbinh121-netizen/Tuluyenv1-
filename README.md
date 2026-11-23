# Thiên Tông Bot v21.6 — Node.js + discord.js + SQLite (trước đây: "Tiên Giới Bot")

> **v21.6.1** — Thay 31 emoji chủng tộc bằng bản **bạn tự vẽ** (cắt từ bảng ảnh bạn gửi — không kèm zip vì dung lượng — bằng `scripts/build_race_emoji_from_sheet_v21_7.py`); `assets/emoji_revisions.json` đặt hậu tố `b` cho 31 khoá để bot tải ảnh mới lên Discord (tên `tg7_<key>_b`). Mọi thứ khác giữ nguyên v21.6.
>
> **v21.6** — **Hiệu ứng thật + Kỹ năng Chủng Tộc + sửa lỗi mạng**: EffectEngine (độc/chảy máu/thiêu đốt trừ sinh lực, choáng mất lượt, băng phong, suy nhược… trước đây chỉ hiện chữ trong nhật ký PvP), Sát Chiêu có hồi chiêu 3 hiệp, mỗi tộc có 1 kỹ năng chủ động trong PvP (nút **Kỹ Năng Tộc**), StatEngine chồng hiệu ứng lên chỉ số; lỗi DNS/mạng tạm thời (`EAI_AGAIN`…) không còn sinh "mã lỗi" giả — bot tự thử lại; Đan Tẩy Tủy ×30 giá; 31 emoji chủng tộc + `assets/emoji_revisions.json` để thay emoji vẽ lại. Xem `BAO_CAO_V21_6.md`, `docs/audit_v21_3/11_EFFECT_ENGINE_V21_6.md`, `docs/audit_v21_3/12_EMOJI_GHI_CHU_VE_LAI_V21_5.md`. Công tắc: `pvp_effects_mode` (`real`/`log`), `pvp_killmove_cd` (mặc định 3, `0` = tắt).
>
> **v21.5** — **Chủng Tộc & Huyết Mạch**: 6 tộc (Nhân/Long/Phượng/Ma/Linh/Yêu), lệnh `/chungtoc` (chọn tộc lần đầu miễn phí, thức tỉnh 3 giai đoạn, huyết mạch Lv.1–5, tiến hóa, đổi tộc có phí + hồi chiêu), bảng `race_state`/`race_history`; cộng vào đúng gói hiệu ứng `talent.bundle` (chung trần CAPS) nên mọi hệ thống tự nhận; số liệu đã benchmark PvP (`scripts/bench_race21.js`). Chưa có kỹ năng chủng tộc chủ động (chờ EffectEngine V21.6). Xem `BAO_CAO_V21_5.md`, `docs/audit_v21_3/10_RACE_DESIGN_V21_5.md`. **v21.4** — sửa lỗi Bí Cảnh không lập được đội (2 nút phòng chờ trùng custom_id → Discord từ chối tin nhắn); bộ kiểm tra component `src/ui/validate.js`; siết router/nút; nhật ký PvP chỉ người trong trận xem; audit 07–09 + `DISCORD_STAGING_CHECKLIST.md`. Xem `BAO_CAO_V21_4.md`. **v21.3** — đổi tên **Thiên Tông Bot**; Stat Snapshot có phân rã nguồn (`src/game/stat21.js`); viết lại vòng đấu PvP (`combat21.js`): không giới hạn hiệp, AFK = bỏ lượt, hòa/đầu hàng, nhật ký trận `/lichsupvp ma_tran:<mã>`, huỷ trận an toàn khi bot khởi động lại. Xem `BAO_CAO_V21_3.md`, `docs/audit_v21_3/`. **v21.2** — lệnh `.od <vật phẩm> [xSL] [@khách]` tạo đơn mua trực tiếp (QR + mã TG…, admin Done → giao hàng). **v21.1** — đơn nạp hiện đúng mã QR nhận tiền của shop (`assets/ui/qr_nap.jpg`). **v21.0** — Cửa Hàng Nguyên Bảo (`/cuahang`, `?nap`): bán mọi vật phẩm/trang bị/Truyền Thừa Ngọc Giản trừ vật phẩm nhiệm vụ; gói nạp 10k/20k/50k/100k; admin "done đơn" ở `/quantri → Cửa Hàng & Đơn Nạp`. Xem `BAO_CAO_V21.md`. **v20.4** — Thiên Nhân Ngũ Suy: tỉ lệ thành công mỗi giai đoạn cố định 99% (env `NGUSUY_SUCCESS_RATE`). **v20.3** — hoàn thiện nghề nghiệp: Khảm & Thức Tỉnh trang bị, Trận (nâng phẩm / thu hồi / gia cố), Linh Điền (Linh Thổ / ghép giống / lai tạo), thành phẩm Tuyệt Phẩm, dọn dấu ấn khi bán. **v20.2** — Emoji Dị Hỏa + Hỏa Chủng thay bằng ảnh người dùng cung cấp. **v20.0** — Đại Hoàn Thiện Nghề Nghiệp: 10 giai đoạn chế tạo, Dị Hỏa Đan Sư, Khai Thác (mỏ + khu thu thập), Đơn Hàng ngày, Sổ Tay, học công thức thất truyền, dấu ấn đan, Phế Đan. Chỉ THÊM — dữ liệu và công thức V17–V19 giữ nguyên. Chi tiết: `BAO_CAO_V20.md`. Lịch sử các bản cũ: `BAO_CAO_V17.md`, `BAO_CAO_V18.md`, `BAO_CAO_V19.md`.

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
1. Giải nén `thien-tong-bot-v21_3.zip`, **upload NỘI DUNG thư mục `thien-tong-bot/`** (không phải cả thư mục) vào gốc `/home/container` sao cho thấy `index.js`, `package.json`, `src/`, `assets/` ngay ở gốc.
2. Tab **Startup**: file khởi động là `index.js` (mặc định). Nếu host có ô "Additional Node packages"/"npm install" thì bật; nếu không, mở Console chạy: `npm install`.
3. Tạo file `.env` ở gốc (copy từ `.env.example`) và điền `DISCORD_TOKEN`, `GUILD_ID`.
4. Bấm **Start**. Database nằm ở `data/tutien.db` trong ổ của server (ổ này giữ nguyên khi khởi động lại).
Node 22+ không cần `better-sqlite3` (bot tự dùng SQLite có sẵn của Node). Bản `index.js` này cũng chạy được trên Node 18–24.

### Lệnh admin không phản hồi?
* Gõ đúng **`!restore_db`** (có gạch dưới, không có dấu cách). Hoặc dùng **`/restore_db`** và đính kèm file `.db` — cách này không cần bật Message Content Intent.
* Lệnh `!` chỉ chạy khi đã bật **Message Content Intent** trong Discord Developer Portal → Bot → Privileged Gateway Intents.
* ID Discord của bạn phải nằm trong danh sách admin: đặt `ADMIN_IDS=ID_CUA_BAN` trong `.env` (lấy ID: Cài đặt Discord → Nâng cao → bật Chế độ nhà phát triển → nhấn giữ tên bạn → Sao chép ID).

> Danh sách lỗi đã biết / việc làm tiếp: xem **`KNOWN_ISSUES.md`**.
