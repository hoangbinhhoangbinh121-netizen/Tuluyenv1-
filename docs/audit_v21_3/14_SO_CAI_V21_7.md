# 14 — Sổ Cái tiền tệ (V21.7)

Tên module: `src/game/ledger.js` (KHÔNG đặt `economy.js` để tránh trùng với các module kinh tế sẵn có). Bảng `ledger_entries` (`src/db/schema_v217.js`):
`entry_id, user_id, currency, delta, balance_after, reason, ref, idem_key UNIQUE, created_at` + chỉ mục theo người/thời gian.

## API
`apply({user, currency, delta, reason, ref, idemKey})` (idempotent theo `idem_key`; ghi số dư sau), `note(...)` (ghi nhận khi tiền đã đổi nơi khác), `recent(user, n)`, `summary(user)`, `exists(key)`, `nonce(prefix)`.

## Luồng ĐÃ nối sổ cái
| Luồng | Khoá idem |
|---|---|
| Chủng tộc (chọn/đổi/thức tỉnh…) — `race21.apply`, điền `race_history.ledger_ref` | `race:<user>:<event>:v<ver>:<t>` |
| NPC bán vật phẩm / mua | nonce `npcsell` / `npcbuy` |
| Bán trang bị 1 món | `gearsell:<gear_id>` |
| Bán trang bị hàng loạt | nonce `gearbulk` |
| Giao dịch người↔người (`trade.acceptOffer`) | `trade:<from>:<to>:<created_at>:f|t` |
| Admin cộng/trừ tiền (`admin17.currency`) | nonce `admin` |

## CHƯA nối (không khẳng định đầy đủ)
Phần thưởng nhiệm vụ/Boss/Bí Cảnh, chế tạo, chợ, Cửa Hàng Nguyên Bảo, các khoản trừ phí lẻ khác. Sổ cái hiện **không phải nguồn sự thật duy nhất** về số dư — chỉ là nhật ký các luồng đã nối. Dự kiến nối dần ở V22.x.

## Xem
`!socai @người` hoặc `!socai <ID>` (admin, tiền tố): 15 dòng gần nhất + tổng vào/ra Linh Thạch.

## Kiểm thử
`scripts/test_ledger217.js` (26 kiểm tra). Discord thật: **NOT TESTED**.
