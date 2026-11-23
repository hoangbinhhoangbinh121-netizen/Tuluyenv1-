# BÁO CÁO V21.6.1 — THAY 31 EMOJI CHỦNG TỘC BẰNG BẢN NGƯỜI DÙNG TỰ VẼ

- Nguồn: ảnh bảng 31 icon bạn gửi (PNG có kênh alpha, mỗi icon có nhãn key). Chép vào `assets/source/race_sheet_v21_7.png` để chạy lại script (file 3 MB **không kèm trong zip** để giữ dưới 30 MiB).
- Cắt bằng `scripts/build_race_emoji_from_sheet_v21_7.py`: tách theo alpha, bỏ nhãn tên, giữ viền sáng sát icon, co về 128×128 trong suốt (≤ 35 KB/file). Chỉ ghi đè 31 khoá chủng tộc; 570 emoji khác không đổi.
- Ánh xạ theo thứ tự ô: nhãn `bl_nhat_ban` trên bảng được hiểu là `bl_niet_ban` (Niết Bàn Phượng Huyết, ô 12) — icon là gương/ngọc vàng viền hoa tím.
- Lưu ý ý nghĩa (chỉ là hình, không ảnh hưởng chức năng): `bl_ho_vuong` (Hổ Vương) là cuộn giấy chữ Z, `bl_ho_yeu` (Hồ Yêu) là trăng khuyết, `rev_long` (Chân Long) là Thái Cực, `bl_phong_linh` là Thái Cực tím. Muốn đổi cái nào, vẽ lại + đổi hậu tố trong `assets/emoji_revisions.json` (b → c).
- `assets/emoji_revisions.json`: 31 khoá hậu tố `b` ⇒ bot tải lên Discord tên `tg7_<key>_b` (Discord không cho thay ảnh emoji cùng tên). Emoji cũ trên Discord không cần xoá.
- Kiểm thử: `test_emoji_race215` 283 PASS (có kiểm tra revisions), `test_emoji19`, `test_emoji_sync_v18`, `test_boss_v19_9`, `test_race21` PASS; toàn bộ regression xem bên dưới. Hiển thị thật trên Discord: **NOT TESTED**.
- Regression đầy đủ (43 file `scripts/test_*.js`, strict UI, mỗi file một tiến trình, chạy sau khi thay emoji): **43/43 exit=0**.
