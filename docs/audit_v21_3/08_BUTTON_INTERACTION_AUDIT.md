# 08 — Audit nút / select / modal / router (V21.4)

## Router (`src/ui/kit.js: routeComponent`)
| Nhánh | Kiểm tra quyền | Ghi chú |
|---|---|---|
| Static (`prefix|…`, 15 prefix) | **Router KHÔNG tự kiểm tra** — từng handler tự xác minh | xem bảng dưới |
| View (`<viewId>|<key>`) | `view.checkOwner && ownerId` → "không phải menu của bạn"; `globalClickAllowed` 0,4s (chỉ khi `ownerId !== null`) | đã test |
| View đã stop/timeout | registry xoá ⇒ "Menu đã hết hạn" | đã test |
| customId không có `|` | trả `false` (bỏ qua) | đã test |
| Key không tồn tại | **V21.3: im lặng ⇒ lỗi "không phản hồi"; V21.4: có phản hồi** | đã sửa |
| Handler ném lỗi | bắt, trả mã lỗi, không sập | đã test |
| Quá 3s | `skin.wrapInteraction` watchdog 2,2s → `deferReply` ephemeral (mọi loại interaction); sau đó `update` → `editReply` | **NOT TESTED trên Discord thật** (chỉ đọc mã) |

## 15 static handler — kiểm quyền theo nghiệp vụ
| Prefix | File | Kiểm quyền | Đánh giá |
|---|---|---|---|
| `b19` | bicanh19Views | menu `m`: chủ menu; phòng chờ/trận: theo thành viên run (server) | OK; V21.4 thêm `x` (hủy phòng, chỉ đội trưởng) |
| `pl` | pvpViews | V21.4: chỉ 2 người trận + admin | đã thêm |
| `wb` | bossViews | công khai theo thiết kế (ai cũng đánh Boss Thế Giới) | OK |
| `ev19` | event19Views | công khai (tham gia tranh đoạt), `joinContest` tự kiểm điều kiện | OK |
| `sw` | sectWarViews | `jn` công khai nhưng kiểm tông môn/tu vi; `st` kiểm admin | OK |
| `qt`, `codeappr` | quantri, khodo | admin/approver | OK |
| `sp`, `od` | shop21Views | chủ phiên / khách / admin theo hành động | OK (288 test) |
| `cd19`,`bm19`,`tk`,`tg`,`ng`,`lt` | chungdao/congphap/menus/nghe/pet | chủ menu (uid trong customId) | OK (test_views19, ngheviews, petviews) |

## Component limits (ui/validate.js, áp dụng cả runtime và test)
≤5 hàng · ≤5 nút/hàng · select đứng riêng · ≤25 lựa chọn · custom_id ≤100 và **không trùng trong 1 tin nhắn** · nhãn ≤80 · nút phải có nhãn hoặc emoji · embed ≤25 field, ≤6000 ký tự tổng, field name ≤256/value ≤1024.
Runtime: lỗi chỉ ghi log (không chặn gửi). Test: `TG_STRICT_UI=1` ném lỗi.

## Kết quả test nút (`test_buttons214.js`, mock — 47 kiểm tra PASS)
14 tình huống router: 13 PASS; **#11 "Handler quá thời gian Discord" = NOT TESTED** (mock không có đồng hồ 3s của Discord). #14 "nút dùng một lần": Chấp Nhận / Xác Nhận đầu hàng / Bắt Đầu — PASS ở mức DB (chốt một lần).
PvP (§3.3): Chấp Nhận, Từ Chối, Đánh Thường (đúng 1 lần/lượt), Phòng Thủ (giảm sát thương TB ≥20% — thống kê 400 lần), Sát Chiêu (ghi nhận; xem F-2), Đầu Hàng 2 bước, Xác Nhận (đúng người/đúng hiệp/không lặp), Hủy đầu hàng (bỏ qua xác nhận → trận tiếp tục), Xem/Lọc nhật ký, Trang tiếp/trước — **PASS (mock)**.

## Discord thật (§3.4)
**NOT TESTED.** Cần server thử nghiệm + 2–3 tài khoản. Xem `DISCORD_STAGING_CHECKLIST.md` (kịch bản + bảng ghi: Interaction ID, custom ID, user ID, thời điểm nhận/phản hồi, lỗi API).
