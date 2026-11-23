# 04 — Audit kinh tế / kho đồ

- Kho: mọi thay đổi vật phẩm đi qua `invsvc.js`/`inventory.js` (bảng `inv_items`: chỉ `invsvc.js` ghi trực tiếp — đã grep).
- Linh Thạch (**đã đính chính ở 07**): SQL trực tiếp ở `trade.js`, `sectwar.js`, `ascension.js`; ngoài ra ~33 file đi qua `Cu.updateCultivator` (Delta tương đối có guard, hoặc tuyệt đối đọc-rồi-ghi không nguyên tử). Tên `economy.js` đã bị chiếm (Pháp Bảo/Khí Vận). Đều có điều kiện `>=` hoặc nằm trong transaction (đã đọc `sectwar.js:232–243`: có kiểm số dư trước khi trừ). **Chưa gom về 1 EconomyEngine** — NOT DONE (đổi 4 file + test hồi quy rộng, cần duyệt).
- Nguyên Bảo (V21): ví có sổ cái `v21_ledger` luôn bằng số dư; đơn nạp chốt idempotent; 288 kiểm tra `test_shop21.js` PASS.
- PvP: cược tu vi chuyển trong 1 transaction, `MAX(0, …)` chặn âm; bảo toàn tổng tu vi được test (`test_pvp21`).
