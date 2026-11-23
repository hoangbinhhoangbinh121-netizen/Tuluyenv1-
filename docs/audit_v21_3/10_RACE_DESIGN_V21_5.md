# 10 — THIẾT KẾ CHỦNG TỘC V21.5 (hồ sơ thiết kế + luồng dữ liệu + benchmark)

Trạng thái: **ĐỀ XUẤT đã benchmark trong engine PvP — chờ người thiết kế duyệt số liệu.** Mọi con số nằm ở `src/data/race21.js` (sửa 1 file, logic không chứa số).

## 1. Quyết định thiết kế (Phụ lục A của kế hoạch)
| Câu hỏi | Quyết định V21.5 | Lý do |
|---|---|---|
| Lưu JSON hay bảng chuẩn hoá? | Bảng chuẩn hoá `race_state` (cột riêng) + `state_json`/`schema_ver` dành cho kỹ năng V21.6 | Truy vấn/validate được, khoá lạc quan `version`; JSON chỉ cho phần chưa có |
| Chuyển chủng tộc? | Có: 1.000.000 Linh Thạch + hồi chiêu 7 ngày + **mất toàn bộ** thức tỉnh/huyết mạch/tiến hóa; lần chọn đầu miễn phí | Chống đổi tộc theo trận đấu (exploit); tiến trình là khoản đầu tư |
| Chủng tộc vs huyết mạch | Tộc = nội tại gốc; huyết mạch = 1 trong 2 nhánh **của tộc đó** (không dùng lại dữ liệu huyết mạch Linh Thú) | Plan 7.3 |
| Xác suất? | Không. Thức tỉnh/huyết mạch/tiến hóa **tất định** (trả đủ điều kiện là thành công) | Không reroll/pity → không khe exploit; dễ test |
| Chưa chọn tộc | Không có hàng `race_state` ⇒ chỉ số y hệt V21.4 | Tương thích dữ liệu V21.3/V21.4 |

## 2. Luồng dữ liệu
```
/chungtoc ─▶ ui/raceViews (View, chủ menu) ─▶ game/race21 (choose|change|awaken|pickBloodline|upgradeBloodline|evolve)
   ─▶ D.transaction { Cu.updateCultivator(linh_thach Delta + guard) ─▶ UPDATE race_state … WHERE version=? ─▶ INSERT race_history }
race_state ─▶ race21.fxOf(row) ─▶ talent.bundle(row) [mục "Chủng Tộc", chung trần CAPS] ─▶ statMult / combatMods / tu / absorb / loot / bt / regen …
   ─▶ stat21.snapshot (check.ok) ─▶ PvP (combat21) · Bí Cảnh · Boss · Đột Phá · Tu Luyện (các nơi đã đọc bundle)
```
Caller của `race21`: `talent.bundle` (fxOf), `ui/raceViews`, `ui/embeds` (dòng hồ sơ), `commands/race`. Dependency: `db`, `cultivator`, `data/race21`, `constants`(REALMS), `emoji`.

## 3. Hồ sơ từng tộc (số = hiệu ứng ở giai đoạn 0, trước nhân thức tỉnh ×1.0/1.15/1.30/1.50)
| Tộc | Vai trò | Ưu | Nhược | Nhánh huyết mạch | Khắc chế |
|---|---|---|---|---|---|
| Nhân | Đa năng | tu +3%, ngộ +2%, đột phá +1%, cơ duyên +2%, công/thủ +2% | không (nhưng không điểm nào vượt trội) | Nhân Hoàng (tu luyện) · Chiến Thần (chiến đấu) | thua tộc chuyên biệt |
| Long | Chống chịu | HP +5%, thủ +4%, giảm sát thương +2%, công +1.5% | tu −2%, né −3% | Thương Long (hồi/Lôi Kiếp) · Hắc Long (xuyên giáp/bạo) | khó né; xuyên giáp |
| Phượng | Hỏa lực–hồi phục | công +4.5%, hồi +40%, hút máu +1.5%, bạo +1.5% | thủ −3%, HP −2% | Chu Tước (bạo phát) · Niết Bàn (tái sinh) | mỏng thủ |
| Ma | Áp chế–bạo phát | công +4.5%, sát thương bạo +8%, bạo +2%, xuyên giáp +3% | thủ −4%, đột phá −2%, giữ tu vi −1% | Huyết Ma (hút máu) · Cổ Ma (xuyên giáp/giảm sát thương) | thủ yếu; kéo dài trận |
| Linh | Thân pháp–linh lực | né +3.5%, hấp thu +10%, ngộ +3%, tu +2% | HP −4%, thủ −2% | Phong Linh (né/bạo) · Mộc Linh (hấp thu/hồi/cơ duyên) | mỏng máu; đòn chắc trúng |
| Yêu | Bản năng | cơ duyên +5%, bạo +2%, HP +3%, công +2% | thủ −2%, đột phá −1% | Hồ Yêu (né/ngộ/cơ duyên) · Hổ Vương (công/bạo/HP) | thủ thấp |

Tiến trình (mọi tộc): Thức tỉnh 3 giai đoạn (cảnh giới ≥ 2/4/6; 100k/500k/3M Linh Thạch) · Huyết mạch: chọn nhánh (thức tỉnh ≥1, cảnh giới ≥3, 200k) rồi Lv.2–5 (300k/1M/3M/8M; cảnh giới 4/6/7/8) · Tiến hóa (thức tỉnh 3 + huyết mạch Lv.5 + cảnh giới ≥8, 30M). Mốc bám bảng thức tỉnh Thể Chất/Linh Căn hiện có (100k…20M, cảnh giới ≤8).
Tất cả khoá hiệu ứng ∈ `talent.CAPS` ⇒ chịu cùng trần với Thể Chất/Linh Căn/Công Pháp (vd công ≤ +15%). Test `test_race21` kiểm trạng thái tối đa của cả 6 tộc không vượt trần/sàn.

## 4. Benchmark (scripts/bench_race21.js, engine combat21, 400 trận/cặp, đổi phe luân phiên)
Điều kiện: hai nhân vật cùng chỉ số gốc; chỉ khác chủng tộc/huyết mạch; hành động ngẫu nhiên như đấu tự động. Tỉ lệ thắng = (thắng + ½ hòa)/trận, trung bình trên mọi đối thủ (13 cấu hình).
**Giai đoạn tối đa (thức tỉnh 3 + huyết mạch Lv.5 + tiến hóa):**
```
BENCH chủng tộc — giai đoạn=max, 400 trận/cặp
linh/phong_linh        56.7%
long/hac_long          56.3%
phuong/chu_tuoc        56.0%
ma/huyet_ma            54.7%
yeu/ho_yeu             53.6%
ma/co_ma               50.4%
long/thuong_long       49.4%
yeu/ho_vuong           49.1%
nhan/chien_than        49.0%
linh/moc_linh          47.8%
phuong/niet_ban        45.8%
nhan/nhan_hoang        43.4%
không tộc              37.8%
--- theo tộc (TB 2 huyết mạch):
linh         52.3%
long         52.8%
phuong       50.9%
ma           52.5%
yeu          51.4%
nhan         46.2%
không tộc    37.8%
```
**Giai đoạn giữa (thức tỉnh 2 + huyết mạch Lv.3, chưa tiến hóa):**
```
BENCH chủng tộc — giai đoạn=mid, 400 trận/cặp
linh/phong_linh        56.7%
yeu/ho_yeu             53.6%
yeu/ho_vuong           51.9%
ma/huyet_ma            51.8%
ma/co_ma               51.7%
phuong/chu_tuoc        50.8%
long/hac_long          50.3%
linh/moc_linh          49.5%
nhan/chien_than        49.4%
phuong/niet_ban        47.4%
nhan/nhan_hoang        46.9%
long/thuong_long       45.2%
không tộc              44.9%
--- theo tộc (TB 2 huyết mạch):
linh         53.1%
yeu          52.7%
ma           51.8%
phuong       49.1%
long         47.8%
nhan         48.1%
không tộc    44.9%
```
Đọc kết quả: (1) các nhánh thiên chiến đấu nằm trong ~48–56%; (2) nhánh thiên tu luyện/hồi phục/cơ duyên (Nhân Hoàng, Niết Bàn, Mộc Linh) thấp hơn trong PvP — đúng ý đồ, bù ở PvE/tu luyện; (3) tộc nào cũng hơn "không tộc" (vì đã trả phí lớn) — Nhân Tộc thấp nhất trong 6 tộc (không phải lựa chọn mặc định mạnh nhất); (4) **PvP hiện chuẩn hoá HP=100 nên `hp`/`regen` không có tác dụng** — Long/Phượng sẽ đổi vị thế khi có HP PvP thật (V21.7), cần benchmark lại.
Benchmark là công cụ cân bằng, KHÔNG phải chứng minh cân bằng với người chơi thật (không có bộ chọn hành động thông minh, không có Linh Thú/trang bị khác nhau).

## 5. Ma trận tích hợp
| Hệ thống | Trạng thái | Ghi chú |
|---|---|---|
| Chỉ số (atk/def/hp) | ✅ qua `talent.bundle` → `statMult` | test: Ma công↑ thủ↓; snapshot `check.ok` |
| Tu luyện / hấp thu / ngộ / đột phá / giữ tu vi | ✅ qua `bundle` (tu, absorb, ngo, bt, failKeep) | bundle đã được các module này đọc sẵn |
| PvP (crit, dodge, dr, pierce, lifesteal) | ✅ `combatMods` | test: Ma xuyên giáp > Long |
| Bí Cảnh / Boss (loot, thach, kiepDmg…) | ✅ qua `bundle` | không test riêng từng chế độ (NOT TESTED riêng) |
| Linh Thú (Yêu Tộc) | ❌ chưa | cần quyết định thiết kế (v14: pet không cộng chỉ số người) |
| Kỹ năng chủ động | ❌ chưa | chờ EffectEngine V21.6 |
| Emoji pixel | ❌ chưa | Unicode dự phòng; chờ ảnh |
| Sổ cái Linh Thạch | ❌ chưa | `race_history.cost` ghi số tiền; `ledger_ref` để trống đến V21.7 |
| Migration | ✅ CREATE TABLE IF NOT EXISTS, chạy lại nhiều lần; không đụng bảng cũ | rollback = bỏ 2 bảng (không bảng cũ nào tham chiếu); backup DB thủ công trước khi triển khai |
