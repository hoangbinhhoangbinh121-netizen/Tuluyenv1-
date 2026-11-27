# BÁO CÁO V22.4.2 (gồm V22.4.1) — Combat Engine dùng chung + AI quái/Boss + Bí Cảnh Nhân/Linh đánh theo lượt + sửa EXP luyện đan + cập nhật hướng dẫn

Bản này gồm v22.4.1. Bot vẫn giữ đúng **100 lệnh slash**. Không đổi cấu trúc DB (không migration mới); toàn bộ hệ thống/phần thưởng/hồi chiêu/DB cũ được giữ.
Tên gói: `thien-tong-bot-v22_4_2.zip` (= "THIEN-TONG-BOT-V22.4.2"; dùng dấu gạch dưới cho tên file phẳng).

## 1. Tính năng nâng cấp
### 1.1 Engine chiến đấu dùng chung (`bicanh19.js`, nâng cấp)
- Động cơ lượt của Bí Cảnh Tiên Giới (thuần hàm: `newState/step/stepCore/spawnEnemy/enemyTurn`) giờ nhận **hồ sơ (`st.prof`)** → cùng một engine chạy Tiên Giới, Nhân Giới, Linh Giới, Bí Cảnh Đặc Biệt.
- **HP quái động**: HP = Công Kích trung bình đội × hệ số loại quái × số người × độ chênh phòng thủ × nhiễu ±7%; chốt lúc xuất hiện, lưu trong state (an toàn khi restart).

### 1.2 AI quái/Boss (`combatAI.js`, MỚI) — cấp AI: Nhân=1, Linh=2, Tiên=3
Né (không né khi đang tụ chiêu; Boss né chiêu nặng tốt hơn; trần 30%), tự hồi, khiên, Kim Thân (giảm sát thương 2 lượt), thế phản kích, kháng hiệu ứng, nổi giận 1 lần, **ghi nhớ/thích nghi** (người chơi thủ liên tục → "Phá Thủ"; spam chiêu nặng → đổi cách), nghỉ thủ sau khi phòng ngự, ưu tiên phòng thủ khi máu thấp. Đòn tụ lực có hồi/“pity”; chiêu diện rộng chỉ khi nhiều mục tiêu. `e.ai` là JSON → sống qua restart. Công tắc khẩn: `bcai=off` (về hành vi v22.4.1).

### 1.3 Bí Cảnh Nhân Giới / Linh Giới thành chiến đấu theo lượt thật (`bcFight.js`, MỚI)
- Bí Cảnh thường (4 bậc), Đặc Biệt (Nhân Giới/Linh Giới), Linh Giới 3 tầng phụ: chọn xong → vào trận (`runView` có nút đánh thường/chiêu/thủ/đan/rút lui).
- **Thắng mới nhận thưởng** (đúng 1 lần, qua `doBicanh/doBicanhDacBiet/doBicanhLinhgioi` với `{paid, boss}`); **thua/rút lui: không thưởng**, Vé & hồi chiêu đã tiêu ở lúc vào không hoàn. Boss quyết định ngay lúc vào (Thượng Cổ vẫn tính tiến độ).
- Công tắc khẩn: `bcfight=off` → quay về khám phá tức thì như v22.4.1.
### 1.4 Phi Thăng Tiên Giới: Lực Chiến yêu cầu **10 tỷ → 5 tỷ** (`TIENGIOI_LUC_CHIEN_CAN`). *Lưu ý: file spec txt ghi "không đổi điều kiện Phi Thăng"; theo yêu cầu mới của chủ bot, mục này ghi đè.*
### 1.5 Sửa lỗi luyện đan "không tính / không cộng / không có" (`craft17.js`, `ngheViews.js`, `adminGift21.js`)
- **EXP nghề bị chặn trần**: `addExp` cắt EXP ở ngưỡng cấp kế → khi chạm ngưỡng mà chưa đủ điều kiện thăng cấp (số lần chế/phí/cảnh giới), mọi mẻ đều **+0 EXP**. Nay EXP tích luỹ bình thường; thăng cấp **vẫn** yêu cầu đủ EXP + số lần chế + cảnh giới + phí (luật thăng cấp không đổi). Thông báo nhận đan hiện "đủ EXP — Thăng cấp" thay vì "chạm ngưỡng". Mỗi lần nhận tối thiểu +1 EXP.
- **Tên buff đan sai**: bảng "Buff đang chạy" (Dùng Đan + Tổng Quan Nghề) tra sai khoá nên mọi buff hiện cùng 1 tên (Tụ Khí Đan…). Đã sửa tra đúng khoá (kể cả đan Tâm Cảnh khoá mặc định, đan v20).
- Admin cộng EXP nghề không còn báo "chạm ngưỡng". Tàn Quyển Đan Phương cộng đủ.
### 1.6 Cập nhật hướng dẫn `/huongdan` (`guide.json`, `guide.js`)
Từ 81 → **114/114 lệnh** có trong hướng dẫn (thêm hoihp, trangthaiboss, dungdan, lệnh admin `!bxh !tangexp !kernel !socai !pvpset !phienban`, PvP, Sự Kiện, v.v.); mô tả mới cho Bí Cảnh theo lượt, 5 tỷ Phi Thăng, luyện đan. Embed nhóm tách ≤1024 ký tự/field (nhóm Admin 30 lệnh không vượt giới hạn Discord).

## 2. Tệp đã sửa / thêm
Mới: `src/game/combatAI.js`, `src/game/bcFight.js`, `scripts/test_bcfight224.js`, `scripts/sim_bcfight.js`, `scripts/test_craft_exp225.js`, `scripts/test_guide225.js`, `BAO_CAO_V22_4_2.md`.
Sửa: `src/game/bicanh19.js`, `src/game/bicanh.js`, `src/ui/bicanh19Views.js`, `src/ui/chienDau.js`, `src/game/craft17.js`, `src/ui/ngheViews.js`, `src/game/adminGift21.js`, `src/commands/guide.js`, `src/data/guide.json`, `src/data/constants.json`, `scripts/sim_bicanh19.js`, `scripts/test_boss_v19_9.js` (khoảng HP Boss theo HP động), `scripts/test_gift2164.js` (kỳ vọng cũ "EXP bị chặn trần" đổi theo luật mới), `package.json` (22.4.2), `README.md`, `KNOWN_ISSUES.md`.

## 3. Kết quả kiểm thử
| Hạng mục | Kết quả |
|---|---|
| `test_bcfight224.js` (171): hồ sơ, vào trận/Vé/hồi chiêu, thắng→thưởng 1 lần, thua/rút→không thưởng, Boss Linh, tương thích state cũ, công tắc, HP động, AI (né/phản kích/Kim Thân/Boss 3 pha/đa dạng), UI | PASS, ổn định 6 lần chạy liên tiếp |
| `test_craft_exp225.js` (30): EXP tích luỹ, thông báo nhận đan, tối thiểu +1, Tàn Quyển, tên buff đúng ở 2 màn hình | PASS |
| `test_guide225.js` (250): 114/114 lệnh, không trùng/không lệnh ma, embed trong giới hạn | PASS |
| Mô phỏng hàng loạt Nhân/Linh (60 lượt/ô, solo): nhân vật trần thắng ~88–100% trận thường; Boss VLC nhân vật trần ~10–25%, có trang bị ~90%+; Độ Kiếp III + Boss trần 22%, có trang bị 98%; 6–60 lượt/trận | Số liệu mô phỏng (không phải người thật) |
| Mô phỏng Tiên Giới sau AI | Có trang bị bc9 ~96%, nhân vật trần bc0 ~76% (trước: 100%) |
| Hồi quy toàn bộ (55 file test, `TG_STRICT_UI=1`) | 52 đạt; `test_emoji19`, `test_realms_v18` lỗi sẵn có; `test_boss_v19_9` lỗi do khoảng HP Boss cũ hẹp hơn HP động mới → đã nới khoảng kiểm tra, chạy lại 3 lần PASS (374 kiểm tra) |
| Discord thật | **NOT TESTED** (chỉ discord.js giả lập + SQLite thật) |

## 4. Vấn đề còn tồn tại / giới hạn trung thực
1. Bí Cảnh Nhân/Linh hiện **đánh 1 người** (engine hỗ trợ đội, đã test ở mức engine, chưa nối UI đội).
2. Vé/hồi chiêu **trừ lúc vào trận**, thua/rút lui không hoàn.
3. Bí Cảnh Tiên Giới **khó hơn một chút** và trận dài hơn ~50% do AI mới; nhân vật trần thắng 100%→~76% ở bậc đầu. Có núm chỉnh `combatAI.CFG` (dodgeMul, healMul, shieldP, defstP, ctrP) và công tắc `bcai`.
4. Số liệu cân bằng (HP_K/ATK_K, CFG) là **đề xuất**, cần theo dõi người chơi thật.
5. Văn bản thưởng dài có thể bị cắt trong panel.
6. Hồi quy toàn bộ: `test_emoji19`, `test_realms_v18` lỗi sẵn có (thiếu ảnh nguồn đã bỏ khỏi zip).
7. Chưa kiểm thử trên Discord thật.
