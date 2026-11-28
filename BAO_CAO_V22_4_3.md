# BÁO CÁO V22.4.3 (gồm V22.4.2) — Lôi Kiếp Chứng Đạo nặng hơn · khoá Thần Giới + tự hạ · luyện đan tự nhận thành phẩm

Bot vẫn giữ đúng **100 lệnh slash**. Không đổi cấu trúc bảng DB (chỉ ghi thêm 1 cờ `v2243_thangioi_demoted` trong `bot_flags`).

## 1. Lôi Kiếp Chứng Đạo — đau hơn, tỉ lệ thất bại cao (`chungdao19.js`)
- Sát thương mỗi đạo (tính theo % sinh mệnh tối đa): hệ số **K 1,25 → 1,6**, bảng 12 đạo tăng từ 8…25% lên **8, 9, 11, 12, 13, 15, 16, 18, 20, 23, 26, 32%** (tổng 12 đạo ≈ 325% sinh mệnh trước giảm, cũ ≈ 214%; số hiển thị trong `/chungdao` là số đã nhân K).
- **Chí mạng Thiên Lôi** 15% mỗi đạo (×1,4) — có dòng log "CHÍ MẠNG THIÊN LÔI".
- Sàn sát thương (dù giảm tối đa) **25% → 47%** uy lực; đạo 10–12 **xuyên giáp** (đạo 10/11 ≈ 33%, đạo 12 = 55% phòng ngự bị bỏ qua).
- Núm chỉnh runtime `chungdao19.CFG` (K, PCT_MUL, CRIT_P, CRIT_M, MIN_TAKE, PIERCE_MUL); mô phỏng `node scripts/sim_chungdao19.js` (env `CDCFG`, `N`).
- Kết quả mô phỏng (500 lượt/ô, người chơi "thông minh" dùng đủ 3 Huyết Nguyên Đan + pháp bảo + công pháp + phá lôi + dốc lực; số liệu mô phỏng, KHÔNG phải người thật):

| Cấu hình đồ | Thắng | Cũ (v22.4.2) |
|---|---|---|
| Tay không | 7% | ~13% |
| Trung bình (đồ + 3 công pháp) | 16% | 100% |
| Khá (đồ tốt, giảm sát thương 15%/15%) | 32% | 100% |
| Tối đa (Bản Mệnh + Đế Binh + bảo mệnh + giảm tối đa) | 100%, còn ~16% máu | 100% |
| Không ứng phó gì | 0% ở mọi cấu hình | ≤99% ở bộ đồ tối đa |

## 2. Thần Giới chưa mở — chặn Phi Thăng + tự hạ (`realm.js`, `ascension.js`, `cultivator.js`, `thanGioi.js`, `phithang.js`)
- Bậc thế giới tối đa đang mở = **Tiên Giới (2)**. Thiên Kiếp / Sứ Giả / Phi Thăng từ Tiên Giới lên Thần Giới đều trả "🚧 Thần Giới chưa mở…"; không mất vật phẩm, Linh Thạch hay tu vi. `/dieukienphithang` ở Tiên Giới hiện "Thần Giới — chưa mở".
- **Tự hạ**: mỗi lần khởi động bot hạ mọi người có `world_tier > 2` về Tiên Giới (chỉ đổi `world_tier`, gỡ danh hiệu có chữ "Thần Giới", xoá bảng hạng Phi Thăng của các bậc đó). **Sao lưu VACUUM INTO trước khi sửa** (`db_backups/tutien_PRE_V22_4_3_*.db`; không sao lưu được thì không hạ hàng loạt). Danh sách người bị hạ lưu ở `bot_flags.v2243_thangioi_demoted` để khôi phục.
- Bảo hiểm: `getCultivator` cũng tự hạ người lọt qua giữa hai lần khởi động.
- Mở lại khi Thần Giới xây xong: đặt `bot_settings.thangioi = on` (không cần sửa code). Cảnh giới, tu vi, vật phẩm, công pháp của người bị hạ giữ nguyên.

## 3. Luyện đan "luyện xong không cộng" — tự nhận thành phẩm (`craft17.js`, `ngheViews.js`, `background.js`)
- Nguyên nhân còn sót: thành phẩm + EXP chỉ được cộng **khi bấm "Nhận thành phẩm"**; xong lò mà không bấm thì kho/EXP không đổi → người chơi thấy "không cộng". (Lỗi trần EXP và tên buff đã sửa ở v22.4.2.)
- Sửa: (a) vòng nền mỗi 20 giây **tự nhận** mọi lệnh đã xong (đan vào kho, EXP, thành tựu, hook cũ); (b) mở bất kỳ bảng nghề/đan/kho nào cũng tự nhận nốt và hiện "🔔 Tự động nhận thành phẩm" (một lần); (c) nút Nhận thủ công vẫn dùng được. Công tắc: `bot_settings.autoclaim = off` để về như cũ.
- Nếu lỗi vẫn còn, xin gửi ảnh màn hình đúng bước bị (đang luyện / lúc nhận / kho).

## 4. Tệp sửa/thêm
Mới: `src/game/thanGioi.js`, `scripts/test_thangioi243.js`, `BAO_CAO_V22_4_3.md`. Sửa: `src/game/chungdao19.js`, `src/ui/chungdaoViews.js`, `src/game/realm.js`, `src/game/ascension.js`, `src/game/cultivator.js`, `src/ui/phithang.js`, `src/bot.js`, `src/game/craft17.js`, `src/ui/ngheViews.js`, `src/background.js`, `src/data/guide.json`, `scripts/sim_chungdao19.js`, `scripts/test_chungdao19.js`, `scripts/test_craft_exp225.js`, `package.json` (22.4.3), `README.md`, `KNOWN_ISSUES.md`.

## 5. Kiểm thử
| Hạng mục | Kết quả |
|---|---|
| `test_thangioi243.js` (23): hạ khi khởi động + sao lưu + cờ khôi phục, danh hiệu, không động tới tu vi, chạy lại, getCultivator tự hạ, chặn Phi Thăng/Thiên Kiếp/Sứ Giả, Linh→Tiên không bị chặn, công tắc mở/đóng, Lôi Kiếp nặng hơn + chí mạng | PASS |
| `test_craft_exp225.js` (46): thêm tự nhận nền, nhận khi mở bảng, không nhận lặp, thông báo 1 lần, công tắc tắt | PASS |
| `test_chungdao19.js` (112; đổi bảng % lôi) | PASS |
| Hồi quy toàn bộ (56 file test, `TG_STRICT_UI=1`) | 54 đạt; chỉ `test_emoji19`, `test_realms_v18` lỗi sẵn có (thiếu ảnh nguồn đã bỏ khỏi zip) |
| Discord thật | **NOT TESTED** |

## 6. Giới hạn / vấn đề còn tồn tại
1. Số cân bằng Lôi Kiếp là đề xuất từ mô phỏng; bộ "Tối đa" vẫn thắng chắc (cố ý: thưởng cho chuẩn bị tối đa). Muốn khó hơn nữa chỉnh `CFG.K`/`MIN_TAKE`.
2. Người bị hạ khỏi Thần Giới không được thông báo riêng (chỉ thấy bậc thế giới đổi khi mở hồ sơ).
3. Tự nhận thành phẩm: thông báo chỉ nằm trong bộ nhớ (mất khi restart), nhưng đồ/EXP đã vào kho và có trong Lịch Sử nghề.
4. Chưa kiểm thử trên Discord thật.
