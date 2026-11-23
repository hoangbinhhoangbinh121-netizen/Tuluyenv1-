# BÁO CÁO V21.6 — EFFECT ENGINE, KỸ NĂNG CHỦNG TỘC, STAT ENGINE, FIX LỖI MẠNG (Thiên Tông Bot)

Phạm vi: Đợt 3 của kế hoạch V21.4→V22.0 + 3 việc bạn yêu cầu thêm (Đan Tẩy Tủy ×30, emoji chủng tộc, lỗi `EAI_AGAIN`). **Không** làm: HP thật cho PvP, sổ cái Linh Thạch, khôi phục trận sau restart (V21.7); Combat Kernel cho Boss/Bí Cảnh/Chứng Đạo/Tông Chiến (V22.0).

## 1. Đã làm
- **EffectEngine** (`src/data/effects21.js`, `src/game/effectEngine.js`): 9 hiệu ứng có thời hạn, 6 chính sách chồng, DoT, choáng + miễn nhiễm, cleanse, trần/sàn modifiers, `toJSON/fromJSON`.
- **F-1 sửa**: 6 hiệu ứng ngẫu nhiên PvP trước đây chỉ là chữ trong nhật ký → giờ có tác dụng thật (công tắc `pvp_effects_mode=log` để quay lại cũ).
- **F-2 sửa**: Sát Chiêu hồi 3 hiệp (`pvp_killmove_cd`, `0` = tắt); nút Sát Chiêu báo số hiệp còn hồi.
- **Kỹ năng Chủng Tộc** (`src/game/raceSkill21.js`): 6 kỹ năng, mở khoá khi Thức Tỉnh ≥ 1, hồi chiêu theo hiệp (tiến hóa −1), nút "Kỹ Năng Tộc" trong PvP; đấu tự động dùng 70% khi sẵn sàng. Chi tiết số liệu: `docs/audit_v21_3/11_EFFECT_ENGINE_V21_6.md`.
- **StatEngine** (`src/game/statEngine.js`): chồng hiệu ứng trong trận lên `stat21.snapshot`; không tính lại công thức cũ ⇒ không double-count. `Cu.effective*` vẫn giữ nguyên cho mọi nơi khác (chuyển dần ở V22.0).
- **Đan Tẩy Tủy ×30**: giá Linh Thạch & Nửa Tẩy Tủy ×30 (`shop21.PRICE_MULT`, `constants.json`): 180.000 / 127.350 NB — test riêng 8 kiểm tra.
- **31 emoji chủng tộc** (6 tộc, 12 huyết mạch, 6 tiến hóa, 3 thức tỉnh, 4 thao tác) đã vẽ + `docs/audit_v21_3/12_EMOJI_GHI_CHU_VE_LAI_V21_5.md` (ghi chú từng cái + ảnh đánh số) để bạn vẽ lại; cơ chế `assets/emoji_revisions.json` để thay emoji cùng tên.
- **Lỗi `EAI_AGAIN discord.com` (mã 1940)**: là DNS của host chập chờn, **không phải bug game**. Bot giờ: nhận diện lỗi mạng tạm thời (không sinh mã lỗi, không báo admin từng lần, 1 dòng cảnh báo/30 giây), tự thử lại tối đa 2 lần khi gửi tin (chỉ với lỗi chắc chắn chưa gửi được ⇒ không trả lời 2 lần; không chờ quá hạn 3 giây của Discord), hiện thông báo "Mạng đang chập chờn" thay vì mã lỗi, `/loigannhat` có dòng thống kê mạng, thêm `client.on('error'/'shardError')` để lỗi gateway không làm sập tiến trình. **Giới hạn:** nếu mạng host mất hẳn, người chơi vẫn không nhận được phản hồi — cần kiểm tra mạng VibeHost / khởi động lại.

## 2. Kết quả kiểm thử (mock discord.js + SQLite thật, `TG_STRICT_UI=1`)
| Hạng mục | Kết quả |
|---|---|
| `test_effects21` (MỚI) | **354 PASS** |
| `test_neterr21` (MỚI) | **17 PASS** |
| `test_pvp21` / `test_race21` | giữ nguyên **569 / 376 PASS** |
| `test_emoji_race215` | **221 PASS** (thêm kiểm tra revisions) |
| Toàn bộ regression | xem mục 3 |
| Benchmark | `scripts/bench_effects21.js` (số liệu trong docs/11 §5) |
| Discord thật (staging E1–E8, N1) | **NOT TESTED** |
| Mạng/DNS thật (mô phỏng lỗi DNS) | **NOT TESTED** (chỉ mô phỏng bằng mock) |

## 3. Regression đầy đủ
- Chạy toàn bộ 43 file `scripts/test_*.js` (strict UI, mỗi file một tiến trình): **lần 1** 41/43 exit=0 — 2 test cũ hard-code số liệu bị đổi có chủ đích: `test_boss_v19_9` (tổng số emoji 570 → 601 vì thêm 31 emoji chủng tộc) và `test_shop21` (dải giá: Tẩy Tủy ×30 làm tỉ lệ cao nhất/thấp nhất vượt 20.000) — đã cập nhật con số + ghi chú, chạy lại PASS.
- **Lần 2 (sạch)**: 42/43 exit=0; `test_effects21` fail ngẫu nhiên 2/12 lần do **assert sai của chính test mới** (kiểm tra Huyết Tế "không tự giết" sau cả hiệp, trong khi đối thủ có thể hạ gục hợp lệ bằng đòn phản). Đã sửa để kiểm tra đúng bước hiến tế; chạy lặp 25/25 PASS. Không phải lỗi code game.
- Kết luận: 43/43 PASS sau khi sửa 3 test; **nhưng chưa có lần chạy toàn bộ liền mạch cuối cùng sau khi sửa test cuối** (chỉ chạy lặp riêng `test_effects21`).

## 4. Cần bạn quyết định
1. **Chênh lệch có tộc ↔ chưa chọn tộc ~73–80%** (docs/11 §5): giữ nguyên / cho người chưa chọn tộc kỹ năng chung yếu hơn / giảm sức kỹ năng?
2. Duyệt số liệu hiệu ứng & kỹ năng tộc (`src/data/effects21.js`) — đề xuất, chưa qua người chơi thật.
3. Yêu Tộc × Linh Thú (còn treo từ V21.5).
4. Emoji: vẽ lại theo docs/12 rồi gửi mình (hoặc ghi `emoji_revisions.json`).

## 5. Còn thiếu / để các đợt sau
- V21.7: HP thật PvP (sửa F-3: `hp`/`regen` của tộc đang vô tác dụng trong PvP), lưu trạng thái trận mỗi hiệp + khôi phục sau restart, sổ cái Linh Thạch.
- V22.0: Combat Kernel; Boss/Bí Cảnh/Chứng Đạo/Tông Chiến dùng chung hiệu ứng/kỹ năng tộc; gộp `cpfx.battleState` với EffectEngine.
