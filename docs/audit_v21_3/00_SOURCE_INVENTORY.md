# 00 — Kiểm kê mã nguồn (baseline V21.2 → V21.3)

Số liệu ĐẾM THẬT trên cây mã V21.2 (trước khi sửa V21.3), bỏ node_modules/.env/db/logs:

| Hạng mục | Số đếm | Plan ghi |
|---|---|---|
| Tổng file | 883 (V21.3: 893 sau khi thêm) | ≈874 |
| File JS (src+scripts+index) | 226 | 221 |
| File JS trong `src/` | 180 | — |
| Dòng JS (src+scripts) | 24 134 | ≈23 705 |
| Dòng JS trong `src/` | 21 186 | — |
| Emoji PNG (`assets/emoji`) | 570 | 570 ✔ |
| File test (`scripts/test_*.js`) | 36 (V21.3: 38) | — |

Chênh lệch với plan do V21.0–21.2 (cửa hàng, `.od`) thêm file sau khi plan được viết. Plan **không** sai hướng, chỉ là số cũ.

## Thành phần chính (đường dẫn thật)
- Lõi nhân vật: `src/game/cultivator.js`, `realm.js`, `constants.js`, `balance.js`, `talent.js`, `cpfx.js`, `fx17.js`, `fx19.js`.
- Chiến đấu: `pvpCore.js` (công thức 1 hiệp `roundAction`), `pvp.js` (phiên tương tác), `petCombat.js`, `boss.js`, `bicanh19.js`, `chungdao19.js`, `sectwar.js`.
- Kinh tế: `inventory.js`/`invsvc.js` (kho), `trade.js`, `shop21.js` (Nguyên Bảo), `craft17.js`, `field17/20.js`.
- DB: `src/db/index.js` + `schema*.js` (V16–V21, V21.3 thêm `schema_v213.js`).
- **Mới V21.3**: `stat21.js` (Stat Snapshot), `combat21.js` (vòng đấu PvP), `schema_v213.js`.

## Không tìm thấy trong mã (plan nhắc tới nhưng KHÔNG tồn tại)
- Hệ **chủng tộc / huyết mạch** của nhân vật (race/bloodline) — chỉ có "huyết mạch" của Linh Thú (`petData.js`). → xem 06.
- `EffectEngine`/`ProgressionEngine`/`EconomyEngine` dạng module riêng — chưa có; chức năng nằm rải trong các file trên.
