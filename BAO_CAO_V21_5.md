# BÁO CÁO V21.5 — CHỦNG TỘC & HUYẾT MẠCH (Thiên Tông Bot)

Phạm vi: Đợt 2 của kế hoạch V21.4→V22.0. Chủ đề: Race Engine, 6 chủng tộc, huyết mạch, thức tỉnh, tiến hóa, UI, migration, test. **Không** làm: kỹ năng chủ động (chờ EffectEngine V21.6), tương tác Linh Thú, emoji pixel, sổ cái Linh Thạch.

## 1. Đã làm
- `src/data/race21.js` (MỚI): dữ liệu 6 tộc (nội tại, 2 huyết mạch, dạng tiến hóa, chi phí/mốc) — nguồn số liệu duy nhất.
- `src/db/schema_v215.js` (MỚI) + hook `src/db/index.js`: bảng `race_state`, `race_history` (CREATE IF NOT EXISTS; chạy lại được; không đụng bảng cũ).
- `src/game/race21.js` (MỚI): chọn/đổi tộc, thức tỉnh, huyết mạch, tiến hóa; mỗi thao tác 1 transaction (trừ Linh Thạch nguyên tử → ghi trạng thái theo khoá lạc quan `version` → ghi lịch sử); lỗi giữa chừng ⇒ rollback.
- `src/game/talent.js` (SỬA 1 chỗ): `bundle()` cộng hiệu ứng tộc (mục "Chủng Tộc") — cùng gói, cùng trần CAPS; chưa chọn tộc ⇒ không đổi gì.
- `src/ui/raceViews.js`, `src/commands/race.js` (MỚI): `/chungtoc`; `src/ui/embeds.js` (SỬA): dòng "Chủng Tộc" ở hồ sơ; `src/bot.js`: nạp lệnh + banner v21.5; `src/commands/admin.js`: `/dungluong` → tiền tố (giữ 100 slash).
- `scripts/test_race21.js` (MỚI, 376 kiểm tra), `scripts/bench_race21.js` (MỚI, benchmark); docs `10_RACE_DESIGN_V21_5.md`, checklist Discord bổ sung.
- Giữ nguyên: mọi công thức chỉ số/PvP/kinh tế cũ; Thể Chất/Linh Căn; bảng cũ.

## 2. Kết quả kiểm thử (mock discord.js + SQLite thật, `TG_STRICT_UI=1`)
| Hạng mục | Kết quả |
|---|---|
| Toàn bộ 39 file test (38 cũ + `test_race21`) | **PASS 39/39** (exit=0) |
| `test_race21`: DB/migration lặp, 6 tộc chọn/phí/lịch sử, thức tỉnh, huyết mạch, tiến hóa, đổi tộc + hồi chiêu, rollback khi xung đột, bấm đúp, trần CAPS ở trạng thái tối đa của cả 6 tộc, snapshot khớp, PvP có mod tộc, UI qua nút thật | **PASS** 376 kiểm tra |
| Tương thích người chơi cũ (chưa chọn tộc) | PASS — không có nguồn "Chủng Tộc", chỉ số không đổi |
| Benchmark PvP (xem docs/10 §4) | 6 tộc ở trạng thái tối đa: 50.9–52.8% (Nhân 46.2% — thấp nhất, đúng ý "không phải lựa chọn mặc định mạnh nhất") |
| Discord thật (staging R1–R8) | **NOT TESTED** |
| Bí Cảnh / Boss riêng với tộc | **NOT TESTED riêng** (đi qua cùng `bundle`) |

## 3. Chưa làm / cần quyết định
1. Kỹ năng chủ động của tộc — làm ở V21.6 (cần EffectEngine).
2. Yêu Tộc × Linh Thú: v14 quy định Linh Thú không cộng chỉ số người chơi — bạn muốn thay đổi quy định này không?
3. Emoji chủng tộc: đang dùng Unicode (🧑 🐉 🔥 😈 ✨ 🦊). Nếu bạn gửi sheet pixel AI-vẽ (6 tộc + 12 huyết mạch + 6 tiến hóa), tôi cắt và nối vào như các lần trước.
4. **Duyệt số liệu**: toàn bộ ở `src/data/race21.js` (nội tại, hệ số thức tỉnh, chi phí 100k→30M, mốc cảnh giới, phí đổi tộc 1M + 7 ngày).
5. PvP vẫn chuẩn hoá HP=100 ⇒ `hp`/`regen` vô tác dụng trong PvP (ảnh hưởng Long/Phượng) — xử lý ở V21.7.
