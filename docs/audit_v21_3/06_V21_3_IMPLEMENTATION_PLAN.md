# 06 — Kế hoạch V21.3: đã làm / chưa làm (trung thực)

## Đã làm trong V21.3
1. Đổi tên bot → **Thiên Tông Bot** (banner, footer embed, README, package `thien-tong-bot`). "Tiên Giới" (tên cảnh giới/thế giới trong game) giữ nguyên.
2. `stat21.js` Stat Snapshot + sourceBreakdown + đối chiếu tự động (+ hiển thị trong xem nhân vật).
3. `combat21.js` + viết lại PvP (mục 03), bảng `v213_battles`, `/lichsupvp ma_tran`, thống kê Hòa.
4. Audit 00–06, test mới `test_stat21.js`, `test_pvp21.js`.

## CHƯA làm — cần bạn duyệt/cung cấp thiết kế (plan cấm tự bịa số)
| Hạng mục plan | Lý do |
|---|---|
| Chủng tộc / huyết mạch người chơi đồng bộ vào Stat | Không tồn tại trong game hiện tại; cần thiết kế (danh sách chủng, chỉ số, công thức) |
| Thay hẳn `Cu.effective*` bằng Snapshot ở 22 file | Rủi ro hồi quy cao; hiện đã đối chiếu bằng test nên chưa cấp bách |
| EffectEngine (buff tạm có thời hạn/điều kiện/stacking) | Cần chốt luật cộng dồn cho đan/trận/pet |
| Chuyển HP PvP sang HP thật | Quyết định cân bằng |
| Khôi phục trận PvP sau restart (thay vì huỷ) | Cần lưu trạng thái đầy đủ + dựng lại View |
| EconomyEngine gom ghi Linh Thạch | Chạm 4 file + test hồi quy |
| Combat engine dùng chung cho Boss/Bí Cảnh/Tông Chiến | Các chế độ này có công thức riêng đang cân bằng; gộp cần duyệt |
