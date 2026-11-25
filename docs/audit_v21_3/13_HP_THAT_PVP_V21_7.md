# 13 — HP thật trong PvP, lưu & khôi phục trận (V21.7) — đóng F-3

## Vấn đề (F-3)
PvP V21.3–V21.6 chuẩn hoá sinh lực mỗi bên = 100. Hệ quả: `hp`/`regen` của chủng tộc, thể chất, linh căn **không có tác dụng** trong PvP; `lifesteal` bị chặn cứng `< 100`.

## Thiết kế: "HP thật có giới hạn"
- Công thức sát thương **không đổi**. Chỉ **trần thanh sinh lực** mỗi bên thay đổi:
  `trần = round(100 × clamp((maxHp / tham_chiếu)^exp, lo, hi))`, `tham_chiếu = trung bình maxHp hai bên` (`src/game/hpbar.js`).
- Mặc định: `exp = 0.15`, `lo = 0.85`, `hi = 1.20` ⇒ trần mỗi bên chỉ dao động **85–120**. Lý do: HP đã tính vào Lực Chiến/chỉ số nên không cần thưởng thêm mạnh.
- Hồi phục mỗi hiệp = `trần × regenPm‰ × chỉ số regen` (regen kẹp 0–1.5, lấy từ `talent.bundle`). Mặc định 10‰.
- Mọi ngưỡng từng dựa vào "100" (lifesteal, hộ thể, kỹ năng tộc, thú) nay đọc trần qua `hpbar.cap(hp, side)` — mặc định 100 nếu không có (tương thích ngược).
- Công tắc: `!pvpset pvp_hp_mode norm` quay về chuẩn hoá 100 như cũ (áp cho trận mới).

## Cấu hình (`!pvpset`)
| Khoá | Mặc định | Khoảng |
|---|---|---|
| pvp_hp_mode | real | real / norm |
| pvp_hp_exp_pct | 15 | 5–100 |
| pvp_hp_lo_pct | 85 | 30–100 |
| pvp_hp_hi_pct | 120 | 100–300 |
| pvp_regen_permille | 10 | 0–100 |
| pvp_resume_window | 900 (giây) | 0–86400 (0 = không khôi phục) |
| pvp_effects_mode | real | real / log |
| pvp_killmove_cd | 3 | 0–10 |

## Benchmark (`scripts/bench_hp217.js`, 600 trận/ô, mock + SQLite thật)
**1) HP gốc ×k (cùng công/thủ/tốc) — % thắng của bên nhiều HP hơn**
| HP ×k | norm (cũ) | real (mới) | hiệp TB real |
|---|---|---|---|
| ×1 | 52.0% | 50.3% | 7.8 |
| ×1.3 | 65.3% | 64.8% | 7.7 |
| ×2 | 78.1% | 88.9% | 7.3 |
| ×4 | 97.6% | 99.8% | 6.3 |
| ×10 | 98.3% | 100.0% | 5.9 |

**2) Công +10% nhưng HP ×0.5:** A thắng norm 30.2% → real 18.0%.
**3) Tộc Viên Mãn vs không tộc (cùng chỉ số gốc):** nhan 69.0→73.2 · long 79.7→77.8 · phuong 73.7→78.7 · ma 68.2→66.0 · linh 68.5→66.2 · yeu 67.2→71.2 (%). Chênh lệch có tộc ↔ không tộc **vẫn cao** — chưa giải quyết (xem KNOWN_ISSUES).
**4) Ngang nhau:** A 50.4% · hòa 1.5% · 7.8 hiệp (cân đối).

Nhận xét trung thực: ở ×2 HP, lợi thế tăng từ 78% lên 89% — HP có ý nghĩa hơn đúng như mục tiêu, nhưng đây là **đề xuất chưa qua người chơi thật**.

## Lưu & khôi phục trận
- Bảng `v217_battle_state(battle_id PK, a_id, b_id, round, state, saved_at)` (`src/db/schema_v217.js`).
- `combat21.serialize/saveState/rehydrate/dropState`: lưu sau `record` và sau mỗi hiệp chưa kết thúc; chứa chỉ số đóng băng, HP, trần, hiệu ứng (`FXE.toJSON`), hồi chiêu, tổng sát thương, trạng thái `cpfx`, `arena.*.st` (thú), 60 hiệp nhật ký gần nhất.
- `pvp.recoverStale` khi bot khởi động: trận `active` có ảnh chụp **và** còn trong `pvp_resume_window` ⇒ dựng lại + báo hai người; quá hạn/không có ảnh ⇒ huỷ an toàn như V21.3 (không mất gì).
- `settlePvpAtomic` xoá dòng trạng thái trong cùng transaction với kết toán.
- **Giới hạn:** lựa chọn của hiệp đang dở bị mất khi khôi phục; nhật ký sau khôi phục chỉ còn 60 hiệp cuối.

## Kiểm thử
`scripts/test_hp217.js` (47 kiểm tra), cập nhật `test_pvp21.js`. Discord thật: **NOT TESTED**.
