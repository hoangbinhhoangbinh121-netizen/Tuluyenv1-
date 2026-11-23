# Báo cáo V21.4 — Audit, siết nút, sửa lỗi Bí Cảnh

## 1. Sửa lỗi theo yêu cầu: Bí Cảnh không lập được đội
**Gốc lỗi (đã tái hiện bằng test):** phòng chờ có 2 nút cùng custom ID `b19|l|<id>` ("Rời Đội" và "Hủy Phòng"). Discord từ chối cả tin nhắn nên không hiện phòng, trong khi phòng đã lưu vào DB → lần sau báo "đang ở trong một lần thám hiểm khác".
**Sửa:** nút Hủy Phòng riêng (`b19|x|`), chỉ đội trưởng; lập/vào đội tự rời hoặc đóng phòng chờ cũ; phòng chờ bỏ quên 30 phút tự đóng (quét mỗi 5 phút); lần thám hiểm treo 6 giờ cũng được quét định kỳ (trước đây chỉ quét khi có người mở màn Sự Kiện).
Test: `test_bicanh_party214` (31 kiểm tra) — chạy với bản cũ thì FAIL đúng chỗ "custom_id TRÙNG".

## 2. Các lỗi khác tìm thấy và sửa
- Router im lặng khi nút không tồn tại → nay có phản hồi.
- Nhật ký PvP: chỉ hai người trong trận + admin xem được.
- Bộ test cũ không phát hiện được lỗi trùng custom_id → thêm `src/ui/validate.js` (runtime: log lỗi; test `TG_STRICT_UI=1`: ném lỗi); 36 test cũ chạy lại nghiêm ngặt đều PASS.

## 3. Đính chính báo cáo V21.3
"38/38 PASS" là sai: zip V21.3 có **36** file test, 36/36 PASS. "Linh Thạch ghi ở 4 file" cũng thiếu: thực tế ~33 file qua `Cu.updateCultivator`. Chi tiết: `docs/audit_v21_3/07_V21_3_RECHECK.md`.

## 4. Phát hiện chưa sửa (cần quyết định)
F-1 hiệu ứng PvP "giả", F-2 Sát Chiêu vượt trội — xem KNOWN_ISSUES.md.

## 5. Kiểm thử
Xem bảng cuối (kết quả chạy toàn bộ). Mới: `test_buttons214` (47), `test_bicanh_party214` (31).
**NOT TESTED:** Discord thật; handler >3s; tải đồng thời. Checklist: `docs/audit_v21_3/DISCORD_STAGING_CHECKLIST.md`.

## 6. Chưa làm (các đợt sau, theo kế hoạch V21.4→V22.0)
V21.5 Chủng Tộc · V21.6 EffectEngine + StatEngine · V21.7 HP thật + khôi phục trận + EconomyEngine · V22.0 Combat Kernel. Chủng tộc cần bạn chốt số liệu cân bằng (kế hoạch cấm tự bịa số) nên sẽ đề xuất bảng thiết kế để bạn duyệt trước khi code.

## Bảng kết quả chạy toàn bộ (TG_STRICT_UI=1, mock discord.js + SQLite thật)
| File | Kết quả |
|---|---|
| test_ascend_fx_v17_2.js | PASS — ✅ test_ascend_fx_v17_2 OK (39 kiểm tra) |
| test_bicanh19.js | PASS — ✅ test_bicanh19: 437 kiểm tra đạt |
| test_bicanh_party214.js | PASS — ✅ test_bicanh_party214: 31 kiểm tra PASS |
| test_boss_v19_9.js | PASS — ✅ test_boss_v19_9 OK (374 kiểm tra) |
| test_buff_v16_2.js | PASS — ✅ test_buff_v16_2 OK (217 kiểm tra) |
| test_buttons214.js | PASS — ✅ test_buttons214: 47 kiểm tra PASS |
| test_chungdao19.js | PASS — ✅ test_chungdao19: 112 kiểm tra đạt |
| test_chungdao_fx19.js | PASS — ✓ test_chungdao_fx19: 208 kiểm tra |
| test_chungdao_guide_v19_11.js | PASS — test_chungdao_guide_v19_11: 248 kiểm tra OK |
| test_code_denbu_v16_5.js | PASS — ✅ test_code_denbu_v16_5 OK (8 kiểm tra) |
| test_congphap_v16.js | PASS — ✅ test_congphap_v16 OK (35906 kiểm tra) |
| test_economy_v17.js | PASS — ✅ test_economy_v17 OK (3915 kiểm tra · tỉ lệ bán-sản-phẩm/nguyên-liệu cao nhất 88%) |
| test_emoji19.js | PASS — ✅ test_emoji19 OK (887 kiểm tra) |
| test_emoji_sync_v18.js | PASS — ✅ test_emoji_sync_v18 OK (24 kiểm tra) |
| test_event19.js | PASS — ✅ test_event19: 58 kiểm tra đạt |
| test_fatigue_exp_v16.js | PASS — ✅ test_fatigue_exp_v16 OK (127 kiểm tra) |
| test_gate_v19_3.js | PASS — ✓ test_gate_v19_3: 17 kiểm tra |
| test_hooks_v17.js | PASS — ✅ test_hooks_v17 OK (34 kiểm tra) |
| test_inspect_v16_7.js | PASS — ✅ test_inspect_v16_7 OK (52 kiểm tra) |
| test_migrate_v17.js | PASS — ✅ test_migrate_v17 OK |
| test_migrate_v18.js | PASS — ✅ test_migrate_v18 OK (54 kiểm tra) — MIGRATION V18: đã chạy 2026-11-22T02:15:31.000Z · chuyển 0 người T |
| test_ngheviews_v17.js | PASS — ✅ 50 lượt bấm nút/menu tĩnh không lỗi |
| test_pets_v14.js | PASS — ✅ test_pets_v14 OK |
| test_petviews_limits_v14_3.js | PASS — ✅ 33 lượt bấm nút/menu tĩnh không lỗi |
| test_pvp21.js | PASS — ✅ test_pvp21: 569 kiểm tra PASS |
| test_quantri_v17_2.js | PASS — ✅ test_quantri_v17_2 OK (285 kiểm tra) |
| test_realms_v18.js | PASS — ✅ test_realms_v18 OK (2855 kiểm tra) |
| test_sectwar_v14.js | PASS — ✅ test_sectwar_v14 OK |
| test_shop21.js | PASS — ✅ test_shop21: 288 kiểm tra đạt. |
| test_stale_v14_5.js | PASS — ✅ test_stale_v14_5 OK |
| test_stat21.js | PASS — ✅ test_stat21: 363 kiểm tra PASS |
| test_tien_exp_v17_1.js | PASS — ✅ test_tien_exp_v17_1 OK (804 mốc) |
| test_tien_v19_5.js | PASS — ✓ test_tien_v19_5: 116 kiểm tra |
| test_tiengate_v19_7.js | PASS — ✓ test_tiengate_v19_7: 23 kiểm tra |
| test_treo_baotri_v14_2.js | PASS — ✅ test_treo_baotri_v14_2 OK |
| test_upgrade_many_v16_4.js | PASS — ✅ test_upgrade_many_v16_4 (phần giới hạn) OK (134 kiểm tra) |
| test_v20.js | PASS — ✅ test_v20: 1206 kiểm tra đạt. |
| test_views19.js | PASS — ✓ test_views19: 2951 kiểm tra |

**38/38 file PASS.**
