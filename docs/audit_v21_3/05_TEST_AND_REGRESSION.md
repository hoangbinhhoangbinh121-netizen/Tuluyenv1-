# 05 — Kiểm thử V21.3 (PASS/FAIL/BLOCKED/NOT TESTED)

Kết quả chạy toàn bộ `scripts/test_*.js` xem `BAO_CAO_V21_3.md` (bảng cuối). Mock discord.js + SQLite thật.

| Hạng mục | Kết quả |
|---|---|
| Stat Snapshot == `Cu.effective*` (60 nhân vật) | PASS |
| PvP engine: 150 trận mô phỏng, AFK, đầu hàng, bế tắc, KO đôi, chốt 1 lần, restart, nhật ký, phân trang | PASS (566 kiểm tra) |
| Embed PvP ≤25 field, ≤6000 ký tự dù trận dài | PASS |
| Toàn bộ test cũ (V16–V21.2) | xem báo cáo |
| **Trên Discord thật** (nút, tin nhắn, ephemeral, DM) | **NOT TESTED** — chỉ giả lập |
| Tải đồng thời nhiều trận / nhiều shard | NOT TESTED |
