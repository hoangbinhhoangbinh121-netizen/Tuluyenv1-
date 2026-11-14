# BÁO CÁO V17 — Bách Nghề · Kinh Tế Vật Phẩm Hợp Nhất

> Nền: v16.7 (không đổi dữ liệu người chơi). Mọi con số bên dưới lấy từ mã nguồn/test, không ước lượng.
> **Chưa chạy trên Discord thật** — chỉ test bằng discord.js giả lập nghiêm ngặt + SQLite thật (xem mục 8).

## 1. Tóm tắt
- 4 nghề × 9 cấp (EXP, kỹ thuật, thành tựu, thành thạo công thức, số lò đồng thời, mẻ chế tối đa).
- 118 vật phẩm / 11 danh mục / 7 phẩm cấp (độc lập với phẩm chất sản phẩm 1–5); 71 nguyên liệu mới trong kho V17, 21 vật phẩm V16 ánh xạ vào cột cũ, 10 vật phẩm nhiệm vụ/Phi Thăng/Thiên Đạo.
- 49 công thức (Đan Sư 21 · Luyện Khí Sư 16 · Trận Pháp Sư 10 · Linh Thực Sư 2), 22 nguồn rơi, 10 mặt hàng NPC bán.
- 25 sản phẩm: 15 đan hiệu ứng mới (+ Tụ Khí Đan, Phá Giới, 2 Tẩy Tủy từ V16 = 19 đan), 7 trận pháp, 8 trang bị 7 ô (không nằm trong 118 vì là thực thể riêng có phẩm chất/cường hoá/độ bền).
- Một lớp **Inventory Service** (`src/game/invsvc.js`) làm chủ mọi thao tác thêm/trừ/khoá/chuyển; một lớp **fx17** gom mọi hiệu ứng (trang bị + đan + trận + kỹ thuật) rồi chặn trần.

## 2. File đổi / file mới
**Mới:** `src/data/items_v17.js`, `src/data/craft_v17.js`, `src/db/schema_v17.js`, `src/game/{catalog17,invsvc,fx17,craft17,dan17,gear17,tran17,field17,drops17,npc17,migrateV17}.js`, `src/ui/{emo17,ngheViews}.js`, `src/commands/nghe.js`, `scripts/make_pixel_emoji_v17_nghe.py`, `scripts/emoji_v17_items.json`, `scripts/gen_doichieu_v17.js`, `scripts/test_{economy,hooks,migrate,ngheviews}_v17.js`, `BANG_DOI_CHIEU_V17.md`, 126 PNG emoji mới (+21 sao chép từ emoji cũ).
**Sửa:** `db/index.js` (transaction lồng nhau, gộp schema_v17), `cultivator.js`, `talent.js`, `balance.js`, `pvp.js`, `pvpCore.js`, `boss.js`, `bossViews.js`, `sectwar.js`, `bicanh.js`, `dotpha.js`, `ascension.js`, `actionsBasic.js`, `pets.js`, `petBalance.js`, `petViews.js`, `trade.js`, `social.js`, `inventory.js`, `dan.js` (luyện đan/khí cũ trỏ sang nghề), `commands/dan.js`, `ui/menus.js`, `ui/khodo.js`, `game/inspect.js`, `data/guide.json`, `bot.js`, README, package.json.

## 3. Migration DB
- Chạy 1 lần khi khởi động (cờ `v17_migrated`), trước `syncPixelEmoji`.
- Sao lưu `db_backups/tutien_PRE_V17_<thời gian>.db` bằng `VACUUM INTO`.
- Bảng mới (`inv_items`, `inv_lock`, `inv_daily`, `inv_log`, `prof_*`, `craft_*`, `gear`, `fx_buffs`, `linh_dien*`) + cột `cultivators.fx17`, `sects.tran_*`; **không chuyển đổi/xoá dữ liệu cũ**.
- Đối chiếu trước/sau (số người, Linh Thạch, ATK/DEF/Tu Vi, Linh Thú, mảnh bí tịch, từng loại vật phẩm) — lệch thì log lỗi lớn. `/doichieuv17` (admin) xuất bảng thực tế.
- `rollback()` gỡ cờ + bộ nhớ đệm; `{ dropV17Data: true }` xoá dữ liệu V17; khôi phục hoàn toàn dùng file sao lưu.

## 4. Hệ thống liên kết
Tu luyện/Bế quan/Bí Cảnh (tốc độ tu vi) · PvP · Boss Thế Giới (rơi + phản đòn) · Chiến Tông Môn (Hộ Tông) · Đột Phá/Cửu Lôi Kiếp/Thiên Kiếp (đan Phá Cảnh, Độ Kiếp, giữ tu vi khi thất bại) · Cảm Ngộ · Linh Thú (Yêu Đan/Tinh Huyết, rơi) · Giao Dịch (chỉ chuyển vật phẩm cho phép, trong transaction) · Code · Kho Đồ · Inspect admin.

## 5. Chống lạm dụng (đã có test)
Trần hiệu ứng `fx17.CAP` · đan có giới hạn mềm/cứng mỗi ngày · buff không cộng dồn · trận có phí duy trì + giới hạn/ngày + tối đa 3 trận cá nhân · rơi có trần cap/ngày/tuần + trần chung phẩm 5–7 · hệ số may mắn ≤ ×1,30 · NPC mua < giá nguyên liệu, NPC bán = 1,5× và có giới hạn/ngày · Linh Điền lỗ ở giá NPC · chế/nhận/thu hoạch dùng cập nhật có điều kiện (không nhận 2 lần) · `takeMany` nguyên tử.

## 6. Giả định / quyết định cần bạn biết
- Nhóm "Tinh Hoa" (LINH_TINH_TAI_LIEU) = 7 loại Nguyên Tinh/Linh Tủy.
- Vật phẩm V16 ở lại cột cũ; V17 chỉ ánh xạ (không sao chép), nên không thể nhân đôi.
- Luyện Khí cũ: chỉ số đã cộng giữ nguyên; từ V17 không cộng thêm. `/luyendan` vẫn thu mẻ cũ đang chạy.
- Tẩy Tủy Đan chế ra chỉ là **Nửa Tác Dụng**.
- Không Gian Trận Bàn thay 1 Vé Bí Cảnh Đặc Biệt mỗi lượt; Mê Tung tăng tỉ lệ rơi (vì hồi chiêu Bí Cảnh vốn chỉ 60–90 giây).
- Còn 96/100 slash command (giới hạn của Discord).

## 7. Phần chưa làm / hạn chế
- **Chưa test trên Discord thật.** Emoji mới sẽ tự tải lên lúc bot khởi động (tên `tg7_i17_*`); nếu chưa kịp thì hiện Unicode dự phòng.
- Danh sách trang bị trong menu chọn tối đa 25 món (còn lại xem sau khi phân giải/bán bớt).
- Cân bằng số (giá, tỉ lệ rơi, thời gian chế) là bản khởi điểm đã kiểm không có vòng lời vô hạn, chưa đo bằng dữ liệu người chơi thật — nên theo dõi `/doichieuv17` và `inv_log` vài ngày đầu.
- Hồi chiêu/hao mòn độ bền trang bị dùng hằng số khởi điểm.
- Test cạnh tranh thật sự (2 tiến trình cùng lúc) không có; chống bằng cập nhật có điều kiện trong 1 tiến trình Node đơn luồng.

## 8. Kết quả test
| Test | Kết quả |
|---|---|
| `test_economy_v17` | 1260 kiểm tra OK (danh mục, không vòng lời, rơi có trần, Linh Điền, 49 công thức chế/nhận đúng 1 lần, kho/khoá/NPC, đan, trang bị, trận) |
| `test_hooks_v17` | 34 kiểm tra OK (chỉ số thật, trong trần, hết hạn, Hộ Tông, hồi HP/tu vi, rơi Bí Cảnh) |
| `test_migrate_v17` | OK (đối chiếu khớp, chạy 1 lần, backup, rollback) |
| `test_ngheviews_v17` | 1074 màn hình × (emoji tùy chỉnh/Unicode) hợp lệ giới hạn Discord + 50 lượt bấm nút tĩnh + hiệu ứng thật |
| Test cũ v14–v16 + `selfcheck` | xem log cuối mục giao hàng |


## Emoji V17 (cập nhật)
Toàn bộ 147 emoji V17 (`i17_/c17_/r17_/p17_/s17_`) được cắt từ **sheet 14×11 do bạn cung cấp** (file gốc không đóng kèm zip vì giới hạn dung lượng; script cần đặt lại ở `assets/source/nghe_sheet_v17.png`) bằng `scripts/build_emoji_from_sheet_v17.py` (GrabCut + tách theo màu cho các ô tối: rương/giáp/lò/ngọc/hòn đá). Bản vẽ pixel cũ của tôi bị thay thế; emoji V16 trở về trước không đổi. Một vài icon tối (lò luyện khí, thỏi huyền) cắt tay nên viền hơi thô — nên xem thử trên Discord.

## V17.1
Đột phá TRÊN Độ Kiếp Viên Mãn cần tu vi x7 (`TIEN_EXP_MULT`, env chỉnh được): áp cho cửa ải Độ Kiếp Viên Mãn → Chân Tiên và mọi tầng Chân Tiên → Tiên Đế. Tốc độ tu luyện/phần thưởng tu vi (mốc GỐC) và mốc Lực Chiến Thiên Kiếp không đổi, nên Tiên tu chậm hơn đúng 7 lần.

## V17.2
**Hiệu ứng Phi Thăng Tiên Giới** (`src/ui/ascendFx.js`, 6 GIF trong `assets/phithang/`): chỉ chiếu khi phi thăng LÊN Tiên Giới (bậc 2) thành công, ở `/phithang` (slash/tiền tố) và nút Phi Thăng. Giao dịch phi thăng (`ascension.doPhithangEx`) commit xong rồi mới chiếu; nếu gửi ảnh lỗi thì vẫn giao kết quả chữ. Phi thăng Linh Giới giữ nguyên (không hiệu ứng). Công khai trong kênh (không ẩn) để mọi người thấy. Mỗi lần chiếu ≈ 18 giây, 6 lần sửa tin nhắn.
**/quantri** (admin của bot, `ADMIN_CODE_APPROVER_IDS`): 6 mục — Tổng quan, Vật phẩm & Nghề, Nhân vật, Kinh tế, Sự kiện & Thông báo, Nhật ký. Hệ số kinh tế lưu `bot_settings` (khóa `eco_*`, `ev_drop_*`), nạp lại khi khởi động, có biên an toàn: EXP gốc 1–100000, tiểu/đại cảnh giới 0.01–10, Tiên 1–1000, rơi đồ 0–5, giá thu NPC 0.1–3, giá bán NPC 0.1–5. Hệ số rơi đồ chỉ nhân xác suất — trần cap/ngày/tuần/phẩm cấp vẫn áp dụng. Mọi thao tác ghi `admin_log17`.
**Giới hạn đã biết:** chưa thử trên Discord thật (chỉ mock nghiêm ngặt); hiệu ứng GIF cần quyền gửi file/đính kèm của bot trong kênh; nếu kênh chặn đính kèm thì chỉ hiện kết quả chữ. Không có chức năng "reset nhân vật" trong `/quantri` (đã có `/restore_db`, `/usedb`).
