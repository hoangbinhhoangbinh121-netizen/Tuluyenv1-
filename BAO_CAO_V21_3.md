# Báo cáo V21.3 — Thiên Tông Bot

## 1. Đã làm
- **Đổi tên → Thiên Tông Bot**: banner khởi động, footer mọi embed, README, `package.json` (`thien-tong-bot` 21.3.0), script redeploy. "Tiên Giới" (tên cảnh giới/thế giới trong game) giữ nguyên.
- **Stat Snapshot** `src/game/stat21.js`: phân rã từng nguồn (công pháp cổ điển/pháp bảo/đặc biệt/công pháp mới/trang bị-trận-đan/Đế Đạo-Đế Binh, Ngũ Suy, Thể Chất+Linh Căn, Rương), tự đối chiếu `Cu.effective*` (lệch → cảnh báo trong xem nhân vật của admin).
- **PvP viết lại vòng đấu** `src/game/combat21.js` (dùng chung cho đấu tương tác và đấu tự động):
  - bỏ giới hạn 5 hiệp; bỏ "hết giờ = tự đánh thường"; bỏ tung đồng xu khi hòa;
  - AFK = bỏ lượt, 2 lần liên tiếp = xử thua; cả hai AFK = hòa; KO đồng thời = hòa; bế tắc 15 hiệp không ai chạm sinh lực thấp mới = hòa;
  - nút **Đầu Hàng** (xác nhận 2 bước);
  - bảng `v213_battles` (thắng/thua/hòa/huỷ + log + tổng sát thương), chốt trận đúng 1 lần cùng transaction với đổi tu vi;
  - `/lichsupvp ma_tran:<mã>`: nhật ký phân trang + lọc; thống kê có số trận Hòa;
  - khởi động lại bot: trận dở bị huỷ, không ai mất gì;
  - embed chỉ hiện 3 hiệp gần nhất → không bao giờ vượt giới hạn Discord.
- **Audit** (7 file) ở `docs/audit_v21_3/`.

## 2. Chưa làm (cần bạn duyệt/thiết kế) — xem `docs/audit_v21_3/06`
Chủng tộc/huyết mạch người chơi · EffectEngine · thay hẳn hàm chỉ số bằng Snapshot · HP PvP thật · khôi phục trận sau restart · EconomyEngine · gộp công thức Boss/Bí Cảnh/Tông Chiến.

## 3. Kết quả kiểm thử (mock discord.js + SQLite thật)
38/38 file test PASS, gồm mới: `test_stat21` (363), `test_pvp21` (~560). Test cũ không đổi: bicanh19 437, boss 374, congphap_v16 35906, shop21 288, v20 1203, views19 2793, realms_v18 2855…
**NOT TESTED:** Discord thật (nút/ephemeral/DM), tải đồng thời.

## 4. Lưu ý chính sách (mặc định đề xuất)
`pvp_afk_forfeit=2`, `pvp_stalemate_rounds=15`, `pvp_safety_rounds=300`; đổi bằng `bot_settings`. Hòa không đổi tu vi, vẫn tiêu cooldown.
