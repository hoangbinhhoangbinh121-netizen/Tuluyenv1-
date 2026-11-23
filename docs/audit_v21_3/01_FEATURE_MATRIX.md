# 01 — Ma trận tính năng ↔ nguồn chỉ số (kết quả audit)

Cột "Đọc chỉ số qua" = số lần gọi `Cu.effectiveAtk/Def/Spd/MaxHp/calcLucChien` trong file (grep thật).

| Chế độ | File | Đọc chỉ số qua `Cu.effective*` | Ghi chú |
|---|---|---|---|
| PvP tương tác | pvp.js → combat21.js | CÓ (qua `createBattle`, kèm snapshot đối chiếu) | V21.3 viết lại vòng đấu |
| PvP tự động (`doPvp`) | pvpCore.js → combat21.js | CÓ | trước đây trùng logic với pvp.js; nay dùng chung engine |
| Boss thế giới | boss.js | CÓ (3) | không đổi |
| Bí Cảnh | bicanh19.js | CÓ (2) | không đổi |
| Chứng Đạo | chungdao19.js | CÓ (3) | không đổi |
| Tông Môn Chiến | sectwar.js | CÓ (3) | không đổi |
| Đột phá | dotpha.js | CÓ (2) | không đổi |
| Linh Thú chiến đấu | petCombat.js | Không đọc chỉ số người chơi trực tiếp; cộng qua `buildArena`/`mods` | không đổi |
| Xem nhân vật | inspect.js | CÓ (5) | V21.3 thêm dòng đối chiếu Snapshot |

**Kết luận audit:** mọi chế độ đã dùng chung MỘT nguồn (`Cu.effective*`), không có chế độ nào tự nhân/cộng chỉ số riêng.
Rủi ro "lệch giữa các tính năng" nằm ở **vòng đấu PvP** (xem 03), không phải ở công thức chỉ số.
