# 07 — Đối chiếu lại V21.3 (kết quả kiểm tra THỰC, V21.4)

## A. Số liệu — đính chính các con số trong báo cáo V21.3
| Mục | V21.3 báo | Kiểm lại thực tế | Kết luận |
|---|---|---|---|
| Số file test trong ZIP | "38/38 PASS" | `unzip -l` ⇒ **36** file `scripts/test_*.js`; log chạy có đúng 36 dòng, danh sách trùng khớp từng file | **SAI → đính chính: 36/36 PASS** (không có 2 file thiếu; con số 38 là lỗi của mình) |
| Stat Snapshot | 363 phép kiểm tra | 60 nhân vật × 6 + 3 = **363** (chạy lại đúng 363) | ĐÚNG |
| PvP | "566" / "~560" | `test_pvp21` đếm **không cố định**: 566 ở lần chạy riêng, 561 trong lần chạy toàn bộ (một số nhánh `if (!s.settled)` tuỳ RNG). Chạy ≥2 lần mới ổn định về PASS, không ổn định về TỔNG SỐ | Ghi là "≈560–566, luôn PASS". Số đếm không phải chỉ tiêu chất lượng |
| `inv_items` | "chỉ invsvc.js ghi" | grep `INSERT/UPDATE/DELETE … inv_items` ⇒ chỉ `invsvc.js:57` (INSERT…ON CONFLICT) và `invsvc.js:74` (UPDATE trừ). `migrateV17/V20.js` chỉ ĐỌC/chèn lúc migrate | ĐÚNG |
| Nơi ghi Linh Thạch | "4 file" | **SAI.** Ghi trực tiếp bằng SQL: `trade.js`, `sectwar.js`, `ascension.js`. Ngoài ra **~33 file** thay đổi Linh Thạch qua `Cu.updateCultivator(uid, { linh_thach: … })` (loại tương đối `new Delta(±n)` có `guard`, và loại tuyệt đối `row.linh_thach + x` — đọc-rồi-ghi, KHÔNG nguyên tử): pets, bicanh, npc17, dan, tran20, gear17, field17, craft17, boss, dongphu, actionsBasic, inventory… | **Đính chính: điểm nghẽn thật là `Cu.updateCultivator`**, không phải 4 file |
| Tên module | Plan V21.4 đề xuất tạo `src/game/economy.js` | **`economy.js` ĐÃ TỒN TẠI** (Pháp Bảo / Đổi Linh Tinh / Cửa Hàng Khí Vận; caller: `commands/dan.js`, `ui/shopViews.js`) | Không được ghi đè. EconomyEngine mới phải đặt tên khác (đề xuất `ledger.js`) |

## B. Hiệu ứng trong PvP: THẬT hay chỉ ghi nhật ký? (đọc `pvpCore.roundAction`)
| Hiệu ứng | Nguồn | Thực chất |
|---|---|---|
| Né, Giảm sát thương (`dm.dr`), Xuyên giáp, Bạo kích, Hút máu | `talent.combatMods` | **THẬT** — đổi số khi tính sát thương/HP |
| Hiệu ứng công pháp mới (hộ thể, suy yếu, buff né, hồi…) | `cpfx.battleState/applySkill` | **THẬT** — có trạng thái theo bên, đếm lượt |
| Linh Thú (khiên, Hộ Chủ, phản thương, choáng) | `petCombat` (arena) | **THẬT** — `pre/outgoing/incoming/post` |
| Phản kích 18% | roundAction | **THẬT** (trừ HP) |
| **"Trúng Độc / Choáng Váng / Xuất Huyết / Băng Phong / Thiêu Đốt / Suy Nhược" 22%** (`PVP_EFFECT_LIST`) | roundAction l.128–132 | **CHỈ GHI NHẬT KÝ** — không lưu trạng thái, không tác dụng gì. Người chơi đọc thấy "nhận Choáng Váng (2 hiệp)" nhưng không có gì xảy ra |
| `spirit_beast_triggered` khi KHÔNG có arena | roundAction l.134 | Chỉ nhật ký (nhánh dự phòng cũ; có arena thì dùng petCombat) |
→ **FINDING F-1**: 6 hiệu ứng ngẫu nhiên là *hiệu ứng giả*. Sửa đúng = EffectEngine (V21.6) hoặc bỏ dòng. Chưa đổi ở V21.4 vì đổi là thay đổi cân bằng.
→ **FINDING F-2**: "Sát Chiêu" (`💢`) luôn dùng được, không hồi chiêu, không chi phí, sát thương ×1.5 và **ép bạo kích** (×1.5) ⇒ ≈×2.25 so với Đánh Thường mọi hiệp ⇒ chiến thuật chiếm ưu thế tuyệt đối. Chưa đổi (cần quyết định thiết kế: hồi chiêu/tiêu hao). Có test ghi nhận.
→ **FINDING F-3**: `lifesteal` giới hạn cứng `< 100`; còn nhiều ngưỡng khác dựa trên thanh 100 (xem plan §8.1) — phải quy đổi đồng loạt khi chuyển HP thật.

## C. Module thực sự được gọi (đồ thị `require` thật — xem 09)
Mọi module game/ui đều có ít nhất 1 caller, trừ `src/ui/index.js` (không ai require).
`stat21.js` ← combat21, inspect. `combat21.js` ← pvp, pvpCore, commands/pvp, pvpViews. `petCombat.js` ← **chỉ** PvP (Boss/Bí Cảnh/Chứng Đạo/Tông Chiến KHÔNG dùng Linh Thú chiến đấu).

## D. Lỗi tìm thấy khi kiểm lại (đã sửa trong V21.4)
1. **Bí Cảnh — không lập được đội**: phòng chờ có 2 nút cùng `custom_id` (`b19|l|<id>`: "Rời Đội" và "Hủy Phòng") ⇒ Discord từ chối cả tin nhắn (50035), trong khi phòng đã ghi vào DB ⇒ lần sau báo "đang ở trong một lần thám hiểm khác". Sửa: nút Hủy Phòng riêng (`b19|x|`), chỉ đội trưởng; tự rời/đóng phòng chờ cũ khi lập/vào đội; tự dọn phòng bỏ quên 30 phút.
2. **Router im lặng** khi View còn nhưng key nút không tồn tại (`if (!item) return true`) ⇒ Discord hiện "ứng dụng không phản hồi". Sửa: trả lời "Nút này không còn hiệu lực".
3. **Nhật ký PvP**: ai biết mã trận cũng xem được. Sửa: chỉ 2 người trong trận + admin.
4. **Mock discord.js (bộ test) không kiểm tra** trùng custom_id / số hàng ở cấp tin nhắn nên 36 test cũ không bắt được lỗi 1. Sửa: `src/ui/validate.js` (+ `TG_STRICT_UI=1` ném lỗi); chạy lại 36 test cũ ở chế độ nghiêm ngặt: **36/36 PASS** — không còn trùng custom_id nào khác ở các luồng đã test. Quét tĩnh toàn bộ `rowOf(...)/addComponents(...)`: không còn khối nào trùng template custom_id.
