# BÁO CÁO V22.4.4 (gồm V22.4.3) — Màn "Dùng Đan Dược" không thấy đan đã luyện

## Nguyên nhân
Menu chọn đan chỉ có **tối đa 25 lựa chọn** và danh sách xếp theo độ hiếm giảm dần, rồi bị cắt ở 25 (`slice(0, 25)`). Người có nhiều loại/phẩm đan thì các đan **thường** (độ hiếm thấp — loại hay luyện nhất) rơi ra ngoài 25 mục đầu nên **không hiện**, dù đã có trong kho và đã được cộng.

## Sửa (`src/ui/ngheViews.js`)
- **Phân trang**: 25 loại/trang, nút **◀ Trang trước / Trang sau ▶**, chân trang "Trang x/y · N loại đan"; chọn 1 đan thì tự nhảy đúng trang chứa nó.
- Đan dùng được xếp lên trước các vật phẩm DAN_DUOC khác.
- Giữ nguyên toàn bộ luật dùng đan (giới hạn ngày, buff không cộng dồn…).

## Kiểm thử
`test_craft_exp225.js` (139 kiểm tra; thêm mục phân trang: mọi loại đan dùng được đều xuất hiện ở một trang nào đó, trang 1 ≤ 25 lựa chọn, nút điều hướng, tự nhảy trang) PASS · `test_ngheviews_v17.js` (3317 màn hình + 50 lượt bấm, TG_STRICT_UI=1) PASS · Discord thật: **NOT TESTED**.
Hồi quy toàn bộ đã chạy ở v22.4.3 (54/56, chỉ emoji19/realms_v18 lỗi sẵn có); v22.4.4 chỉ đổi màn Dùng Đan.
