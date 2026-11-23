# 11 — EFFECT ENGINE, KỸ NĂNG CHỦNG TỘC, STAT ENGINE (V21.6)

## 1. Vấn đề đã tìm thấy ở audit V21.3 và cách V21.6 xử lý
| Mã | Vấn đề | Xử lý V21.6 | Công tắc quay lui |
|---|---|---|---|
| F-1 | 6 hiệu ứng ngẫu nhiên PvP (Trúng Độc, Choáng Váng, Xuất Huyết, Băng Phong, Thiêu Đốt, Suy Nhược) **chỉ hiện trong nhật ký, không có tác dụng** | EffectEngine: hiệu ứng có thời hạn thật (DoT trừ sinh lực, Choáng mất đúng 1 lượt + miễn nhiễm 1 hiệp, Băng Phong giảm tốc/né, Suy Nhược giảm sát thương gây ra) | `bot_settings.pvp_effects_mode = log` (hành vi cũ) |
| F-2 | Sát Chiêu không hồi chiêu (có thể dùng mọi hiệp, ≈ ×2.25 sát thương) | Hồi chiêu 3 hiệp (nút hiện số hiệp còn hồi) | `pvp_killmove_cd = 0` (tắt) |
| F-3 | PvP chuẩn hoá HP = 100 | **Chưa sửa** — V21.7 | — |

Tỉ lệ xuất hiện hiệu ứng vẫn 22%/đòn trúng như trước (`EFFECT_PROC`). Hiệu ứng mới chỉ làm cho 22% đó có tác dụng thật.

## 2. Các mô-đun
| File | Vai trò |
|---|---|
| `src/data/effects21.js` | Nguồn số liệu duy nhất: 9 hiệu ứng, ánh xạ tên cũ → id, 6 kỹ năng tộc, hằng số hồi chiêu |
| `src/game/effectEngine.js` | Store theo trận (`toJSON/fromJSON` để khôi phục trận ở V21.7), `apply / startRound / consumeStun / endRound / cleanse / modifiers / describe / persistent` |
| `src/game/raceSkill21.js` | Kỹ năng chủ động của tộc: mở khoá, hồi chiêu, tự thân (`castSelf`) hoặc tấn công (`params`+`after`), bộ chọn đấu tự động |
| `src/game/statEngine.js` | Chồng hiệu ứng trong trận lên chỉ số bền vững của `stat21.snapshot` (không tính lại công thức → không double-count); `explain()` |
| `src/game/combat21.js` (sửa) | `playRound` tích hợp: DoT đầu hiệp → choáng → hồi chiêu → kỹ năng tộc → StatEngine → `roundAction`; chính sách `effectsMode`, `killCd` |
| `src/game/pvpCore.js` (sửa 3 chỗ) | `skillDmg` (kỹ năng tộc), `dmgMult`, hiệu ứng ngẫu nhiên gọi `mods.effects.proc` khi có |
| `src/game/pvp.js` (sửa) | Nút **Kỹ Năng Tộc** (hàng 2), Sát Chiêu kiểm tra hồi chiêu, dòng trạng thái hồi chiêu + hiệu ứng |

### Quan hệ với hệ thống cũ (không xoá, không nhân đôi)
- `fx_buffs`/`fx17`: buff **bền vững** (đan, trận pháp) đã nằm trong `Cu.effective*` ⇒ EffectEngine chỉ đọc (`persistent()`), **không** cộng lại.
- `cpfx.battleState`: hiệu ứng guard/dodge/weak theo ĐÒN của Công Pháp mới — **giữ nguyên**. Chồng chức năng với EffectEngine (guard/evasion/weaken) sẽ gộp ở V22.0 (Combat Kernel); hiện hai lớp nhân với nhau (dr gộp kiểu `1-(1-a)(1-b)`, đã chặn trần 60% ở EffectEngine).
- Chủng tộc: nội tại + huyết mạch vẫn vào `talent.bundle` (V21.5); kỹ năng chủ động là lớp riêng, chỉ dùng trong PvP.

## 3. Chính sách chồng hiệu ứng
`refresh · stackDuration · stackIntensity · strongest · replace · unique`. Dùng: Trúng Độc = stackIntensity (tối đa 3 tầng), Xuất Huyết = strongest, Thiêu Đốt = refresh, Choáng = unique + miễn nhiễm 1 hiệp, Băng Phong = refresh, Suy Nhược/Hộ Thể = strongest, Cuồng Huyết/Linh Thân = refresh. Thời hạn tối đa 6 hiệp. `dur` = số hiệp còn lại sau hiệp bị áp (hiệu ứng vừa áp không bị trừ ở cuối hiệp đó); DoT tính ở **đầu** hiệp kế.

## 4. Kỹ năng Chủng Tộc (mở khoá khi Thức Tỉnh ≥ 1; Tiến Hóa: hồi chiêu −1)
| Tộc | Kỹ năng | Loại | Hồi | Tác dụng |
|---|---|---|---|---|
| Nhân | Ý Chí Bất Khuất | tự thân, không mất lượt | 5 | hồi 5 sinh lực, xoá hiệu ứng xấu, giảm 8% sát thương nhận 2 hiệp |
| Long | Long Uy | tự thân, không mất lượt | 5 | giảm 18% sát thương nhận (2 hiệp) + đối thủ gây ít hơn 20% (2 hiệp) |
| Phượng | Niết Bàn Hỏa | tấn công | 3 | ×1.25 sát thương, Thiêu Đốt 2 hiệp khi trúng |
| Ma | Huyết Tế | tự thân, không mất lượt | 5 | hiến 3 sinh lực (không tự giết), +30% sát thương gây ra 2 hiệp |
| Linh | Linh Thân | tự thân, không mất lượt | 5 | hồi 2, xoá hiệu ứng xấu, +12% né 2 hiệp |
| Yêu | Hoang Dã Nhào Tới | tấn công | 4 | ×1.3 sát thương, +25% bạo kích, bạo kích ⇒ Xuất Huyết 2 hiệp |

**Vì sao "không mất lượt":** bản đầu (kỹ năng tự thân tốn cả lượt) cho kết quả lệch nặng — Phượng 74%, Yêu 74% vs Ma 25%, Long 35%, vì 4 tộc tự thân bỏ phí một đòn. Quá trình chỉnh (200–300 trận/cặp, vòng tròn 6 tộc, Viên Mãn): bản gốc 25–74% → tự thân miễn lượt 44–62% → chỉnh số lần 1 46–52% → **bản chốt 48–52%**.

## 5. Kết quả benchmark bản chốt (`scripts/bench_effects21.js 600`)
### 1) F-1 / F-2 (người chơi không tộc, 600 trận / ô)
| Chế độ | Hai bên ngang nhau | Bên mạnh hơn +10% công |
|---|---|---|
| CŨ (log-only, Sát Chiêu không hồi) | A 53.2% / B 44.7% / hòa 2.2% · 7.74 hiệp | mạnh hơn +10% công thắng 51.5% (trận 7.73 hiệp) |
| MỚI (hiệu ứng thật, Sát Chiêu hồi 3) | A 49.5% / B 49.3% / hòa 1.2% · 7.75 hiệp | mạnh hơn +10% công thắng 52.5% (trận 7.81 hiệp) |
| Chỉ F-2 (log + hồi 3) | A 50.2% / B 48.5% / hòa 1.3% · 7.70 hiệp | mạnh hơn +10% công thắng 51.2% (trận 7.59 hiệp) |
| Chỉ F-1 (hiệu ứng thật, không hồi) | A 48.2% / B 51.2% / hòa 0.7% · 7.76 hiệp | mạnh hơn +10% công thắng 53.8% (trận 7.75 hiệp) |

### 2) Tộc vs tộc (thức tỉnh Viên Mãn, dùng kỹ năng tộc tự động 70% khi sẵn sàng)
| Tộc | Thắng TB | Chi tiết (% thắng, hòa = ½) |
|---|---|---|
| nhan | 46.0% | long 48.0 · phuong 44.8 · ma 44.0 · linh 47.2 · yeu 46.2 |
| long | 48.0% | nhan 51.2 · phuong 42.5 · ma 52.3 · linh 43.3 · yeu 50.7 |
| phuong | 52.8% | nhan 54.5 · long 52.5 · ma 54.3 · linh 51.0 · yeu 51.7 |
| ma | 51.1% | nhan 54.3 · long 53.3 · phuong 47.5 · linh 50.5 · yeu 49.7 |
| linh | 49.7% | nhan 49.8 · long 48.7 · phuong 46.5 · ma 54.2 · yeu 49.2 |
| yeu | 51.1% | nhan 51.5 · long 50.2 · phuong 48.5 · ma 51.8 · linh 53.5 |

### 3) Tộc (Viên Mãn) vs người không tộc cùng chỉ số gốc
| Tộc | Thắng | Hiệp TB |
|---|---|---|
| nhan | 72.7% | 8.19 |
| long | 79.7% | 8.21 |
| phuong | 72.7% | 7.17 |
| ma | 73.3% | 6.76 |
| linh | 75.7% | 8.20 |
| yeu | 76.7% | 7.00 |

**Đọc kết quả**
1. F-1/F-2 không làm lệch cân bằng chung: hai bên ngang nhau vẫn ~50/50, độ dài trận ≈ 7,7 hiệp (sai khác nằm trong nhiễu mẫu ±2 điểm).
2. Vòng tròn 6 tộc: 44–53% — tộc thấp nhất Nhân (46%, đúng ý "đa năng nhưng không mạnh nhất").
3. ⚠️ **Tộc vs người chưa chọn tộc: thắng 73–80%.** V21.5 đã chênh (38–45% cho người không tộc); kỹ năng tộc làm chênh thêm. Vì chọn tộc lần đầu miễn phí và thức tỉnh bậc 1 chỉ cần 100.000 Linh Thạch + cảnh giới 2, thực tế gần như mọi người chơi sẽ có kỹ năng. **Cần bạn quyết định**: (a) giữ nguyên (tộc là bắt buộc về mặt cân bằng), (b) cho người chưa có tộc một kỹ năng chung yếu hơn, hoặc (c) giảm sức mạnh kỹ năng.

## 6. Kiểm thử
`scripts/test_effects21.js` (354 kiểm tra): chính sách chồng, DoT đúng số tick, choáng + miễn nhiễm, cleanse, modifiers + trần, JSON, mở khoá kỹ năng, hồi chiêu Sát Chiêu / kỹ năng tộc, chế độ `log` = hành vi cũ, từng kỹ năng trong trận, `Huyết Tế` không tự giết, mô phỏng 60 trận không treo, StatEngine không double-count. `scripts/test_neterr21.js` (17 kiểm tra): lỗi mạng. `test_pvp21` (569) và `test_race21` (376) giữ nguyên PASS.
