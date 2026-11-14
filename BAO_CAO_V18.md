# BÁO CÁO V18.0 — Mở rộng Cảnh Giới (29 đại cảnh giới)

> Nền: V17.2 (đã có x7 EXP đột phá Tiên, hiệu ứng Phi Thăng, `/quantri`). Mọi cơ chế/hệ số V17.1 giữ nguyên, trừ MỘT chỗ buộc phải đổi về kỹ thuật (xem mục 3).

## 1. Hệ cảnh giới mới (nguồn dữ liệu duy nhất: `src/game/constants.js` → `REALMS`)

| # | Cảnh giới | Tiểu cảnh giới | # | Cảnh giới | Tiểu cảnh giới |
|---|---|---|---|---|---|
| 0 | Phàm Nhân | — | 15 | Tiên Vương | Sơ/Trung/Hậu Kỳ · Viên Mãn |
| 1–5 | Luyện Khí … Hóa Thần | Tầng 1–20 | 16 | Chuẩn Tiên Tôn | ″ |
| 6–9 | Luyện Hư … Độ Kiếp | Tầng 1–23 | 17 | Tiên Tôn | ″ |
| 10 | Chân Tiên | Sơ/Trung/Hậu Kỳ · Viên Mãn | 18 | Chuẩn Tiên Đế | ″ |
| 11 | Kim Tiên | ″ | **19** | **Tiên Đế** | ″ |
| 12 | Thái Ất Kim Tiên | ″ | 20 | Chuẩn Tiên Tổ | ″ |
| 13 | Đại La Kim Tiên | ″ | 21 | Tiên Tổ | ″ |
| 14 | Chuẩn Tiên Vương | ″ | 22 | Chuẩn Đạo Tổ | ″ |
| | | | 23 | Đạo Tổ | ″ |
| | | | 24 | Chuẩn Thiên Đạo | ″ |
| | | | 25 | Thiên Đạo | ″ |
| | | | 26 | Đại Đạo Chí Tôn | ″ |
| | | | 27 | Vô Thượng Chí Tôn | ″ |
| | | | **28** | **Siêu Thoát** | ″ — **Siêu Thoát Viên Mãn = đỉnh cao nhất hiện tại** |

- Chỉ đột phá sang đại cảnh giới kế khi đang ở Viên Mãn; thành công → Sơ Kỳ của cảnh giới kế; không nhảy cóc (`nextStage`).
- `/dotpha` ở Siêu Thoát Viên Mãn báo đúng: *"Bạn đã đạt đến Siêu Thoát · Viên Mãn — cảnh giới cao nhất hiện tại…"* (kiểm tra TRƯỚC điều kiện tu vi; câu cũ sai "Tiên Đế là tối cao" đã bỏ).
- Hiển thị: `[Emoji] Tên cảnh giới · Tên tiểu cảnh giới` (qua `realmDisplay`, dùng chung cho hồ sơ, đột phá, bảng xếp hạng, thông báo toàn server, PvP, tông môn chiến, Phi Thăng, quản trị…). Hồ sơ thêm emoji tiểu cảnh giới.

## 2. Migration (`src/game/migrateV18.js`, chạy tự động đầu tiên khi khởi động)
Tiên Đế cũ (`realm_index=14`, không tiểu cảnh giới) → Tiên Đế mới (`realm_index=19`, `stage_index=3` Viên Mãn). Cảnh giới 0–13 không đụng tới. Tu vi, chỉ số, linh căn, thể chất, vật phẩm, công pháp, pháp bảo, linh thú… giữ nguyên.
1. **Sao lưu trước** (`VACUUM INTO db_backups/tutien_PRE_V18_<giờ>.db`) rồi MỞ LẠI bản sao kiểm tra đủ số người; không sao lưu được (kể cả nơi dự phòng thư mục tạm) → **huỷ migration và dừng khởi động**, không đổi dữ liệu.
2. Toàn bộ trong 1 transaction, đối chiếu băm trước/sau (mọi cột trừ realm/stage của người được chuyển; nhóm 0–13 phải y hệt hoàn toàn; tổng tu vi/linh thạch/atk/hp/số linh thú). Lệch → rollback, không đặt cờ.
3. Cờ `v18_migrated` → chạy đúng 1 lần. Mất cờ mà dữ liệu đã dạng mới → chỉ đặt lại cờ.
4. `migrateV18.rollback()` đưa người còn ở Tiên Đế Viên Mãn về 14/0 (người đã đột phá tiếp thì cần khôi phục từ bản sao lưu `PRE_V18`).

## 3. Công thức (thay đổi kỹ thuật BẮT BUỘC)
Công thức cũ `100·3^realm·50^thế_giới` ×hệ số tốc độ `1,35^realm` sẽ TRÀN số nguyên ở Siêu Thoát (3^28 ≫ 2^53) và làm linh thạch bế quan lạm phát ~100 lần. Vì vậy **chỉ từ SAU Đại La Kim Tiên (13)**:
- Mốc tu vi mỗi đại cảnh giới ×3^(1/6) (thay vì ×3); hệ số tốc độ ×1,35^(1/6) (thay vì ×1,35). Hệ quả: Tiên Đế mới (19) có mức tu vi/tốc độ/linh thạch **đúng bằng Tiên Đế cũ** → người chuyển sang không bị lạm phát/thiếu hụt.
- Trần mốc tu vi `TU_VI_REQUIRED_CAP = 9×10^15` (< 2^53). Chỉ chạm trần ở thế giới bậc ≥3 cảnh giới rất cao (trước đây các trường hợp này đã sai số do vượt 2^53).
- Cảnh giới 0–13: giá trị **không đổi** (test đối chiếu). Tỉ lệ đột phá `0,72 − 0,005·realm` (sàn 15%), chỉ số/realm, x7 EXP Tiên, Cửu Lôi Kiếp… giữ nguyên.
- Vì tu vi mỗi bậc không còn ×3, một người Tiên Đế cũ tích tu vi lớn có thể đủ tu vi cho vài bậc kế (vẫn phải ĐỘT PHÁ từng bậc, có tỉ lệ + Cửu Lôi Kiếp, không tự nhảy).

## 4. Emoji
- `canhgioi_0–13`: giữ nguyên. `canhgioi_19` = **vương miện Tiên Đế cũ (giữ nguyên tranh)**. `canhgioi_14–18, 20–28`: 14 tranh pixel 128×128 mới (vương ấn đang hình thành · vương miện bạc-ngọc · thần kích · thánh liên · đế ấn · bản nguyên hỗn độn · cổ thụ bản nguyên · Thái Cực đang hình thành · Thái Cực hoàn chỉnh · thiên nhãn thức tỉnh · thiên nhãn hoàn chỉnh · vòng xoáy đại đạo · thần ấn tối cao · cổng vượt ngoài vũ trụ). Tiểu cảnh giới: `so_ky, trung_ky, hau_ky, vien_man` (đĩa đầy 1/4 → trọn vẹn). Script vẽ: `scripts/make_pixel_emoji_v18_canhgioi.py`.
- `realmEmoji(0..28)` (kẹp ngoài khoảng), `stageEmoji()`; fallback Unicode cho đủ 29 + 4 trong `src/data/emoji_fallback.json`.
- **Vấn đề trên Discord thật**: emoji ứng dụng `tg7_canhgioi_14` ĐÃ tồn tại với tranh vương miện cũ và bot không bao giờ thay emoji đã có. Giải pháp: cảnh giới 14 mới tải lên dưới tên `tg7_canhgioi_14_v18`; bộ nhớ đệm ID cũ bị bỏ qua. Không cần xoá gì trên Discord (emoji `tg7_canhgioi_14` cũ nằm không dùng, xoá tay được nếu muốn).

## 5. File thay đổi
MỚI: `src/game/migrateV18.js`, `scripts/make_pixel_emoji_v18_canhgioi.py`, `scripts/test_realms_v18.js`, `scripts/test_migrate_v18.js`, `scripts/test_emoji_sync_v18.js`, `BAO_CAO_V18.md`, 18 PNG emoji (`canhgioi_15–28`, `canhgioi_19`, `so_ky`, `trung_ky`, `hau_ky`, `vien_man`).
SỬA: `src/game/constants.js` (REALMS 29 + hằng số), `src/game/realm.js` (công thức, trần, tốc độ), `src/game/dotpha.js` (đỉnh cao nhất), `src/game/emoji.js` (realmEmoji 0–28, stageEmoji, tên emoji Discord có phiên bản), `src/bot.js` (gọi migration đầu tiên), `src/ui/templates/character.js` & `breakthrough.js`, `src/data/emoji_fallback.json`, `src/data/guide.json`, `assets/emoji/canhgioi_14.png` (tranh mới), `src/ui/skin.js`, `src/ui/theme/typography.js`, `package.json` (18.0.0), `README.md`, `scripts/test_tien_exp_v17_1.js` (thêm trần).
Các module còn lại (tu luyện/bế quan, bí cảnh, boss, PvP, tông môn, công pháp, trang bị, nghề, linh thú, thể chất/linh căn, shop, bảng xếp hạng, thông báo, `/quantri`, guide) đọc cảnh giới qua `K.REALMS`/`realm_index` nên tự đồng bộ; đã rà soát — không còn nơi nào coi Tiên Đế là cảnh giới cuối, không mở khoá thêm vật phẩm/phần thưởng nào.

## 6. Kết quả kiểm thử (chạy thật, DB SQLite thật + discord.js giả nghiêm ngặt)
| Test | Kết quả |
|---|---|
| `test_realms_v18` | ✅ 2.822 kiểm tra: 29 cảnh giới đúng tên/thứ tự; ≥ #10 đều đúng 4 tiểu cảnh giới, không "Tầng N" từ Đại La trở lên; đi liên tiếp mọi bước tới Siêu Thoát Viên Mãn rồi nextStage = null; **đột phá thật bằng `doDotpha` từ Luyện Khí tới Siêu Thoát Viên Mãn** rồi bị chặn đúng thông báo; không tràn số ở mọi thế giới 0–5; cảnh giới thấp giữ công thức cũ; 29 emoji (128×128, khác nhau, fallback đủ) |
| `test_migrate_v18` | ✅ 54: Tiên Đế cũ → 19/Viên Mãn, mọi cột khác y hệt, nhóm 0–13 nguyên vẹn; sao lưu hỏng → huỷ & không đổi dữ liệu; chạy lặp bỏ qua; mất cờ; rollback; DB rỗng |
| `test_emoji_sync_v18` | ✅ 24: Discord giả có sẵn `tg7_canhgioi_14` cũ → 14 mới lên `_v18`, 19 tải bản vương miện, emoji cũ không tải lại, lần 2 không tải thêm |
| Toàn bộ test V14–V17.2 (ascend fx, buff, code đền bù, công pháp 34.829, kinh tế, mệt mỏi, hooks, inspect, migrate v17, nghề views custom/unicode, pets, petviews, quantri, tông chiến, stale, tien_exp, treo/bảo trì, nâng nhiều) + `selfcheck.js` + `node --check` mọi file | ✅ đều qua |

## 7. Giới hạn trung thực
- CHƯA thử trên Discord thật (không có token trong môi trường kiểm thử): đã kiểm bằng SQLite thật + discord.js giả nghiêm ngặt + Discord REST giả cho emoji. Lần đầu chạy nên xem log khởi động: dòng `🌌 Cảnh giới v18: chuyển N người…` và `🎨 Emoji pixel: …`.
- Tải lên ~18 emoji mới có thể mất thêm vài chục giây ở lần khởi động đầu (phần dư tải tiếp ở nền).
- Cân bằng ở các cảnh giới 14–28 (tỉ lệ đột phá, mốc tu vi) là suy ra từ công thức hiện có, chưa có dữ liệu người chơi thật.

## 8. Hướng dẫn sao lưu / khôi phục
1. Trước khi đẩy bản mới: tải file `data/tutien.db` (cùng `-wal`/`-shm` nếu có) về máy làm bản dự phòng thủ công.
2. Bot tự tạo thêm `db_backups/tutien_PRE_V18_*.db` trước khi chuyển đổi.
3. Khôi phục: tắt bot → thay `data/tutien.db` bằng file sao lưu → xoá `-wal`/`-shm` → chạy lại (bản v17.2 để hoàn nguyên, hoặc v18 để migrate lại).
