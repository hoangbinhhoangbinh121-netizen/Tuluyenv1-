# KNOWN_ISSUES — việc còn dang dở & lỗi cần theo dõi (v6-7)

> File này để **lần sau làm tiếp**. Mỗi mục ghi: triệu chứng → nguyên nhân/giả thuyết → cách xử lý → trạng thái.
> Quy ước: 🔴 chưa sửa · 🟡 đã sửa nhưng CHƯA kiểm chứng trên Discord thật · 🟢 đã sửa & đã thử bằng mô phỏng.

## A. Chưa kiểm chứng trên Discord thật (quan trọng nhất)
Toàn bộ lớp Discord (nút, menu, modal, embed, lệnh slash) mới chỉ được thử với **bản giả lập discord.js** (môi trường dựng không có mạng). Logic game đã chạy trên DB thật (62 người chơi, không lỗi). Khi chạy thật, nếu có lỗi hãy làm theo mục **E. Cách báo lỗi**.

## B. Đã xử lý trong lượt này
| # | Triệu chứng | Nguyên nhân | Trạng thái |
|---|---|---|---|
| B1 | Gõ `?tuluyen`, `?danhboss` bot im lặng | Bản Python dùng tiền tố **`?`**, bản Node mặc định `!` | 🟢 Nay chấp nhận cả `?` và `!` (đổi bằng `COMMAND_PREFIX=?,!`) |
| B2 | Bot "đang chạy" nhưng offline, không phản hồi gì | Chưa bật **Message Content Intent** → `Used disallowed intents` | 🟢 Tự đăng nhập lại không cần intent (lệnh `/` vẫn chạy, lệnh `?`/`!` cần bật intent) |
| B3 | Crash `Could not locate the bindings file` | `better-sqlite3` không có bản dựng cho Node 24 | 🟢 Dùng `node:sqlite` có sẵn; bỏ better-sqlite3 khỏi package.json |
| B4 | `Cannot find module './schema'` | Upload nhầm file `index.js` đè lên `index.js` gốc | 🟢 Dùng `sua-loi-*.zip` giữ đúng đường dẫn |
| B5 | Biểu tượng hiện thành chữ `:tuluyen:` | 66 emoji tuỳ chỉnh thuộc ứng dụng/server khác | 🟡 Tự đổi sang emoji Unicode nếu bot không dùng được (xem mục C2) |
| B6 | Lỗi chung chung "Có lỗi xảy ra" | Không biết nguyên nhân | 🟢 Nay có **mã lỗi** + file `logs/error.log` + lệnh admin `/loigannhat` |
| B7 | Giao Dịch bước 2 lỗi | Discord không cho mở modal thứ 2 sau modal thứ 1 | 🟢 Thêm nút "Tiếp tục — Bước 2/2" |
| B8 | 2 lệnh bấm sát nhau bị báo "quá nhanh" ngay sau khi bot khởi động | Đồng hồ chống spam tính từ lúc bật bot | 🟢 Dùng giờ hệ thống |

## C. Việc còn lại / nghi vấn (🔴)
- **C1. "Tu luyện" và "đánh Boss" báo lỗi trên Discord thật** — chưa có log nên chưa xác định. Giả thuyết đã loại trừ: logic (đã chạy `tuluyen/dongquan/canngo/linhmach/hoihp/dotpha/danhboss` cho **toàn bộ 62 người chơi** thật: 0 lỗi). Giả thuyết còn lại: tiền tố lệnh (B1 — rất có thể là đây), emoji (B5), quyền bot, interaction quá 3 giây. Cần: gửi mã lỗi hoặc `logs/error.log`.
- **C2. Emoji tuỳ chỉnh**: để có icon pixel đẹp thay vì Unicode, cần upload PNG cho cả 66 key này (hiện chỉ có PNG cho 47 key khác) — xem `assets/emoji/` và `scripts/make_pixel_emoji.py`.
- **C3. Boss Thế Giới theo server**: DB cũ lưu boss ở `guild_id = 0`. Bot Node tạo boss riêng cho từng server (HP khởi đầu 8.000) → boss "reset" so với bản Python. Cần quyết định: giữ `guild_id=0` làm boss chung hay copy trạng thái sang server thật.
- **C4. Thượng Cổ / Tông Môn Chiến cần quyền**: bot cần `Manage Channels` (Động Phủ), và Server Members Intent + `ENABLE_MEMBERS_INTENT=1` (tự rút người rời server khỏi cứ điểm).
- **C5. Bảng "người đầu tiên phi thăng" tính chung theo server** (giống bản Python) — có thể muốn tách theo từng thế giới.
- **C6. Gemini** (tên công pháp/đan dược, kể trận PvP) chưa thử với API key thật; luôn có fallback.
- **C7. Tiền tố `!` cho lệnh admin ẩn** (`!hoang`, `!tongmonchien_*`) cần Message Content Intent.
- **C8. Lệnh `/restore_db`** chỉ ghi đè file; nên **khởi động lại bot** sau khi dùng.

## D. Điều cần biết khi vận hành
- Cần Node ≥ 22.5 (host Node 24 ổn). Database: `data/tutien.db` (đặt `TULUYEN_DB_PATH` vào ổ bền vững).
- ID admin: `ADMIN_IDS=id1,id2` trong `.env` (cộng thêm vào danh sách mặc định lấy từ bản Python).
- Tự sao lưu mỗi 6 giờ vào `data/db_backups/` (giữ 8 bản).

## E. Cách báo lỗi (để lần sau sửa nhanh)
1. Khi người chơi thấy "❌ Có lỗi xảy ra (mã lỗi `ab12`)": admin gõ `/loigannhat ma_loi:ab12` hoặc mở file `logs/error.log` trên host.
2. Copy **nguyên khối lỗi** (dòng có `Error:` và 5–6 dòng `at ...` bên dưới) gửi lại. Đừng gửi token.
3. Nếu bot không lên: chụp toàn bộ Console từ dòng `Tiên Giới Bot v6-7` trở xuống.


## v7.0
- Chưa kiểm chứng trên Discord thật (chỉ giả lập). Nếu tu luyện vẫn lỗi với người khác: gửi mã Exxx + logs/error.log.
- Emoji pixel: Application Emoji bị giới hạn tốc độ khi tải lần đầu; phần thiếu dùng Unicode rồi tải nền.
- Ký hiệu chức năng (✕ ✓ ＋ ↻ ⬆ ℹ ✎) và ô thanh bar còn là icon vẽ sẵn vì sprite không có.
