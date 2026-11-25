# BÁO CÁO V21.7 — HP thật PvP · Khôi phục trận · Sổ Cái

Kế hoạch V21.4 → V22.0, bước V21.7. Gồm cả v21.6.4 (Tặng & EXP admin, bán trang bị hàng loạt) đã giao trước đó.

## Kết quả
| Hạng mục | Trạng thái |
|---|---|
| HP thật có giới hạn (F-3) | PASS (test_hp217 47/47; benchmark trong docs 13) |
| Lưu trạng thái trận + khôi phục khi restart | PASS (mock + SQLite thật) |
| Sổ Cái tiền tệ (`ledger.js`) | PASS (test_ledger217 26/26) — chỉ phủ luồng đã nối |
| `!socai`, `!pvpset` (admin, tiền tố) | PASS (chạy thử với mock) |
| Discord thật | **NOT TESTED** |
| Số liệu cân bằng | ĐỀ XUẤT — chưa qua người chơi thật |

## Thay đổi chính
- `src/game/hpbar.js` (mới): trần thanh theo HP. `combat21.js`, `pvpCore.js`, `pvp.js`, `cpfx.js`, `raceSkill21.js`, `petCombat.js` đọc trần qua `hpbar.cap`.
- `combat21.js`: `serialize/saveState/rehydrate/dropState`, hồi phục mỗi hiệp. `pvp.recoverStale` viết lại: khôi phục trận còn hạn.
- `src/db/schema_v217.js` (mới): `v217_battle_state`, `ledger_entries` (migration thêm bảng, không đụng bảng cũ).
- `src/game/ledger.js` (mới) + nối vào `race21`, `npc17`, `admin17.currency`, `trade`.
- `src/commands/admin.js`: `!socai`, `!pvpset` (prefixOnly — vẫn đúng 100 lệnh slash).
- Test mới: `test_hp217.js`, `test_ledger217.js`, `bench_hp217.js`; cập nhật `test_pvp21.js`.

## Cần bạn quyết định
1. Chênh lệch có tộc ↔ không tộc (~66–78%): giữ hay giảm?
2. Duyệt số liệu HP (exp 0.15, 85–120, regen 10‰) — ở HP ×2, bên nhiều HP thắng 89% (trước 78%).
3. "Bán trang bị": hiện là bán hàng loạt cho NPC; có muốn chợ người↔người không?

## Giới hạn trung thực
- Sổ Cái chưa phủ thưởng nhiệm vụ/Boss/Bí Cảnh/chế tạo/Cửa Hàng Nguyên Bảo.
- Khôi phục trận mất lựa chọn hiệp đang dở; nhật ký còn 60 hiệp cuối.
- Mọi kiểm thử dùng discord.js giả + SQLite thật; chưa chạy trên Discord thật.
- Regression đầy đủ: 46/48 file đạt; `test_emoji19`, `test_realms_v18` fail chỉ vì thiếu ảnh nguồn (không nằm trong zip). `test_gift2164` từng fail ngẫu nhiên vì tên công pháp cũ là ngẫu nhiên và có thể trùng nhau (VD tầng 3 và 102 cùng tên) — bot đúng khi báo "khớp nhiều, dùng mã"; đã sửa test chọn tầng có tên duy nhất (8/8 lần chạy lại PASS).

## Tiếp theo
V22.0 — Combat Kernel + adapter Boss/Bí Cảnh/Chứng Đạo/Tông Chiến.
