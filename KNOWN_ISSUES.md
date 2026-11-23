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


## v11.0
- Chưa kiểm chứng trên Discord thật (chỉ giả lập). Nếu tu luyện vẫn lỗi với người khác: gửi mã Exxx + logs/error.log.
- Emoji pixel: Application Emoji bị giới hạn tốc độ khi tải lần đầu; phần thiếu dùng Unicode rồi tải nền.
- Ký hiệu chức năng (✕ ✓ ＋ ↻ ⬆ ℹ ✎) và ô thanh bar còn là icon vẽ sẵn vì sprite không có.

- (đã sửa v9-v11) Bảng sects thiếu cột exp_buff_until/treasury/title gây lỗi tu luyện cho người đã vào tông môn.

## v12.0 — chống đầy đĩa + tự cứu DB (gộp v11.1)
- `SQLITE_FULL` ("database or disk is full"): thêm `src/db/diskguard.js` — dọn bản sao lưu thừa (theo số lượng + tổng dung lượng `BACKUP_MAX_MB`, mặc định 500), bỏ qua auto-backup khi ổ đĩa sắp đầy, xoá file backup dở dang, giới hạn file WAL (16 MB). Khi gặp SQLITE_FULL bot tự dọn khẩn cấp rồi thử ghi lại 1 lần.
- `no such column/table`: mọi lệnh đọc/ghi DB tự chạy lại migrate 1 lần rồi thử lại.
- Khởi động in 1 dòng báo cáo: DB / WAL / backup / log / ổ đĩa trống. Lệnh admin mới: `/dungluong`.
- Biến môi trường mới (tuỳ chọn): `BACKUP_MAX_MB`, `BACKUP_KEEP_MANUAL` (5), `BACKUP_KEEP_PRE` (3).
- v12: SQLite dùng `temp_store=MEMORY` (không phụ thuộc /tmp của host), bỏ giới hạn `max_page_count`, bớt ghi DB khi xem Tổng Quan liên tục.
- v12: khi khởi động và khi gõ `/dungluong` bot in báo cáo: dung lượng DB/WAL/backup, thử GHI THẬT 1 MB vào thư mục DB + thư mục tạm, và 6 file lớn nhất — để biết chính xác cái gì làm đầy.
- v12.1: sao lưu tự động CHỈ GIỮ BẢN MỚI NHẤT (mỗi loại: tự động / thủ công / trước-khôi-phục giữ 1 bản), bản cũ tự xoá; tạo bản mới ngay 1 phút sau khi bot khởi động rồi mỗi `AUTO_BACKUP_HOURS` giờ. Muốn giữ nhiều hơn: đặt `AUTO_BACKUP_KEEP`, `BACKUP_KEEP_MANUAL`, `BACKUP_KEEP_PRE`.
- v12.2: **cấu hình tự động** (`src/autoconfig.js`) — chỉ cần `DISCORD_TOKEN`. Biến thiếu tự lấy mặc định; chủ bot tự là admin; slash tự đăng ký ngay cho mọi server (và server mới); intent bị từ chối thì tự hạ cấu hình (content+members → content → members → không); nhóm biến sao lưu cố định ở mức "giữ bản mới nhất" (bỏ qua biến trên host trừ khi `CONFIG_FROM_ENV=1`); lỗi tự nhắn riêng cho chủ bot (5 phút/lần).

## V20.3 — còn hạn chế (chi tiết: BAO_CAO_V20.md mục 5)
- Gia Cố không áp cho trận có giới hạn lượt; không có cơ chế "hỏng trận" nên không có "sửa" riêng cho Trận.
- Thức tỉnh nhân toàn bộ chỉ số của món. Dấu ấn đan không gắn từng viên (chặn ≤ số viên, dọn mỗi lần lấy đan ra).
- Chưa thử trên Discord thật (chỉ discord.js giả lập chặt + SQLite thật); số cân bằng của Khai Thác / Đơn Hàng / bảng rơi V20 cần chỉnh sau vài ngày chạy thật.

## V21.0 — Cửa Hàng & Nạp (chi tiết: BAO_CAO_V21.md mục 4)
- **Không có cổng thanh toán tự động.** Nạp = chuyển khoản thủ công + admin bấm "Done đơn". Bot không biết tiền đã vào; admin phải đối chiếu sao kê.
- Giá Nguyên Bảo của từng mặt hàng là công thức ước lượng (√giá trị gốc), chưa kiểm với người chơi thật → chỉnh bằng hệ số giá / ẩn hàng trong `/quantri`.
- `.od`: đơn mua trực tiếp cũng là QR tĩnh (khách tự nhập số tiền + nội dung); giá VNĐ = 💠 × 100đ. Thẻ đơn hiện công khai trong kênh (có QR/tên chủ TK, không có số dư/ví của khách).
- Công Pháp (sách tầng) chưa nằm trong cửa hàng Nguyên Bảo (còn gate cảnh giới riêng); hiện mua bằng cửa hàng Công Pháp cũ.
- Hàng "bán trong cửa hàng" làm vật phẩm khó (Hỏa Chủng, Đan Tẩy Tủy, vật liệu Chứng Đạo) mua được với giá ×3 — đây là quyết định theo yêu cầu "mọi thứ nhận được đều bán trừ nhiệm vụ", có thể ẩn từng món.


## V21.3 — còn hạn chế / chờ duyệt (chi tiết: BAO_CAO_V21_3.md, docs/audit_v21_3/06)
- Chưa có hệ chủng tộc/huyết mạch cho người chơi (không có trong game, cần thiết kế); chưa có EffectEngine (buff tạm có thời hạn/stacking); Snapshot là adapter chỉ-đọc, `Cu.effective*` vẫn là hàm gốc.
- PvP: thanh sinh mệnh vẫn chuẩn hoá 100 (đổi HP thật = quyết định cân bằng). Restart giữa trận = HUỶ trận (không ai mất gì), chưa khôi phục tiếp tục. Chính sách AFK/bế tắc là mặc định đề xuất (`pvp_afk_forfeit=2`, `pvp_stalemate_rounds=15`, `pvp_safety_rounds=300` trong bot_settings).
- Lời kể AI (Gemini) chỉ áp dụng khi trận ≤5 hiệp và có kết quả thắng/thua; trận dài dùng nhật ký có sẵn.
- Linh Thạch vẫn được ghi trực tiếp ở trade/sectwar/ascension/cultivator (chưa gom EconomyEngine).
- Chưa thử trên Discord thật: chỉ có mock discord.js + SQLite thật.

## V21.4 — phát hiện chưa xử lý (chi tiết: docs/audit_v21_3/07)
- F-1: 6 hiệu ứng ngẫu nhiên trong PvP (Trúng Độc, Choáng Váng, Xuất Huyết, Băng Phong, Thiêu Đốt, Suy Nhược) CHỈ hiện trong nhật ký, không có tác dụng thật → sửa đúng bằng EffectEngine (V21.6) hoặc bỏ dòng.
- F-2: "Sát Chiêu" không hồi chiêu/không tiêu hao, ≈×2.25 sát thương so với Đánh Thường mọi hiệp → cần quyết định thiết kế.
- Linh Thạch ghi qua ~33 file (`Cu.updateCultivator`), một phần là đọc-rồi-ghi không nguyên tử; `economy.js` đã là module Pháp Bảo nên EconomyEngine phải đặt tên khác.
- Chưa thử trên Discord thật (xem DISCORD_STAGING_CHECKLIST.md). Handler >3s trên Discord: NOT TESTED.

## V21.5 — Chủng Tộc: còn thiếu / chờ duyệt (chi tiết: BAO_CAO_V21_5.md, docs/audit_v21_3/10)
- ~~Chưa có kỹ năng chủng tộc chủ động~~ → đã có ở V21.6 (xem mục V21.6). Ban đầu chỉ có nội tại + huyết mạch + thức tỉnh + tiến hóa.
- **Yêu Tộc × Linh Thú** chưa có tương tác riêng (v14 quy định Linh Thú không cộng chỉ số người chơi — cần quyết định thiết kế).
- Emoji chủng tộc: đang dùng Unicode dự phòng (🧑 🐉 🔥 😈 ✨ 🦊), CHƯA có pixel art; key dự kiến `race_nhan`…`race_yeu` (khi có ảnh, `E['race_<id>']` tự được dùng).
- Trong PvP hiện tại (thanh sinh mệnh chuẩn hoá 100) các hiệu ứng `hp` và `regen` KHÔNG có tác dụng → Long Tộc / Phượng Tộc / nhánh hồi phục yếu hơn trong PvP so với PvE; sẽ cân lại khi có HP PvP thật (V21.7).
- Số liệu cân bằng (nội tại, chi phí, mốc cảnh giới) là ĐỀ XUẤT đã benchmark trong engine PvP, chưa qua người chơi thật; toàn bộ nằm ở `src/data/race21.js`.
- Chi phí chủng tộc chỉ bằng Linh Thạch (không vật phẩm mới); chưa có sổ cái Linh Thạch (`race_history.ledger_ref` để trống đến V21.7).
- Slash: `/dungluong` (admin) chuyển sang tiền tố `!dungluong` để nhường chỗ `/chungtoc` (giữ đúng 100 lệnh slash).

## V21.6 — Hiệu ứng / kỹ năng tộc / StatEngine: còn thiếu / chờ duyệt (chi tiết: BAO_CAO_V21_6.md, docs/audit_v21_3/11)
- **Chênh lệch có tộc ↔ chưa chọn tộc**: tộc Viên Mãn thắng người chưa chọn tộc ~73–80% (V21.5 đã 55–62%). Cần quyết định thiết kế (giữ / kỹ năng chung cho người chưa chọn tộc / giảm sức kỹ năng).
- Số liệu hiệu ứng & kỹ năng tộc là ĐỀ XUẤT đã benchmark trong engine PvP (vòng tròn 6 tộc 44–53%), chưa qua người chơi thật; toàn bộ ở `src/data/effects21.js`.
- Kỹ năng tộc **chỉ dùng trong PvP** (Boss/Bí Cảnh/Chứng Đạo/Tông Chiến chưa có — V22.0 Combat Kernel).
- `cpfx.battleState` (guard/dodge/weak theo đòn) và EffectEngine còn chồng chức năng; hai lớp nhân với nhau (trần giảm sát thương 60% ở EffectEngine). Gộp ở V22.0.
- Sinh lực PvP vẫn chuẩn hoá 100 (F-3) nên `hp`/`regen` của tộc vẫn vô tác dụng trong PvP — V21.7.
- Trạng thái hiệu ứng nằm trong bộ nhớ trận (`toJSON/fromJSON` đã sẵn); restart giữa trận vẫn huỷ trận (không mất gì) — khôi phục ở V21.7.
- Lỗi mạng/DNS tạm thời: bot tự thử lại **chỉ** khi gửi tin (reply/followUp/…) và chỉ với lỗi chắc chắn chưa gửi được (`EAI_AGAIN`, `ENOTFOUND`, `ECONNREFUSED`…). Nếu host mất mạng kéo dài, người chơi vẫn không nhận được phản hồi — cần kiểm tra mạng của host (VibeHost). Không test được trên mạng thật.
- Emoji chủng tộc (31 cái) là bản tạm tự vẽ bằng code; chờ bạn vẽ lại (xem docs 12). Emoji vẽ lại cần ghi hậu tố vào `assets/emoji_revisions.json`.
- Discord thật: **NOT TESTED** (chỉ mock discord.js + SQLite thật).
