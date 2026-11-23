# 02 — Pipeline chỉ số thực tế + Stat Snapshot (V21.3)

Công thức hiện chạy (cultivator.js, KHÔNG đổi ở V21.3):

```
bracket = 1 + cổ điển×0.4 + pháp bảo×0.4 + đặc biệt×0.4 + công pháp mới(cpfx) + trang bị/trận/đan(fx17) + Đế Đạo/Đế Binh(fx19)
chỉ số = int( gốc × bracket × Ngũ Suy × (Thể Chất + Linh Căn) ) + cộng phẳng Rương
  • Tốc độ: không nhân Thể Chất/Linh Căn.   • HP: hpScale = (bracket × NgũSuy) × Thể Chất (kết hợp trước khi nhân gốc).
```

`src/game/stat21.js → snapshot(row)` chạy lại đúng các thành phần này, ghi **sourceBreakdown**
(mỗi modifier: sourceId, sourceType, stat, operation add|mul|flat, value, stackingGroup) và tự đối chiếu với `Cu.effective*`.

| Plan yêu cầu | Trạng thái |
|---|---|
| Snapshot có breakdown | **PASS** — `scripts/test_stat21.js` (60 nhân vật ngẫu nhiên × atk/def/spd/hp/lực chiến: 363 kiểm tra) |
| Không double-count | **PASS** — snapshot == `Cu.effective*` chính xác từng đơn vị (`check.ok`); lệch sẽ hiện ⚠️ trong `/quantri` → xem nhân vật |
| Pipeline là nguồn DUY NHẤT thay hàm cũ | **PARTIAL** — Snapshot là *adapter chỉ-đọc* chạy song song; `Cu.effective*` vẫn là hàm gốc. Thay hẳn cần duyệt (đổi ~22 file gọi). |
| Thứ tự "chủng tộc → huyết mạch → …" | **BLOCKED** — hệ chủng tộc/huyết mạch người chơi chưa tồn tại, chưa có thiết kế/số liệu được duyệt (06). |
| Modifier có `duration`/`condition` (buff tạm) | **NOT IMPLEMENTED** — buff tạm hiện nằm trong fx17 (đan/trận) chưa tách thời hạn trong Snapshot. |
