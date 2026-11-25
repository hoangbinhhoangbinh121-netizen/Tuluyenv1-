# 15 — Combat Kernel (V22.0)

## Mục tiêu và phạm vi
Cho Boss Thế Giới, Bí Cảnh, Chứng Đạo, Tông Chiến dùng chung phần "trong trận" mà PvP đã có từ V21.6/21.7: **EffectEngine** (độc, chảy máu, thiêu đốt, choáng, băng phong, suy nhược, hộ thể, cuồng huyết, linh thân) và **kỹ năng chủ động chủng tộc**.

**Không** viết lại công thức sát thương của từng hệ thống. Mỗi nơi giữ nguyên số liệu và chỉ số bền vững (đã đọc `talent.bundle`, `Cu.effective*`, `fx17`). Kernel chỉ thêm lớp theo hiệp phía trên, nên không có module trùng chức năng. Không có chỉ số bền vững nào bị cộng hai lần (đúng quy ước StatEngine giai đoạn 2).

## Công tắc (mặc định TẮT)
- Mỗi hệ thống: `kernel_boss`, `kernel_bicanh`, `kernel_chungdao`, `kernel_tongchien` ∈ `legacy` | `kernel`. **Mặc định `legacy` = hành vi y như V21.7.1.**
- `kernel_all = off`: cắt khẩn cấp, mọi hệ thống về legacy.
- Admin: `!kernel` (xem), `!kernel boss kernel`, `!kernel all off`, `!kernel foe 5`, `!kernel race off`, `!kernel cd_bicanh 10`.

## Cách hoạt động của từng adapter (chỉ khi bật `kernel`)
| Hệ thống | Lưu trạng thái | Việc kernel làm |
|---|---|---|
| Boss Thế Giới (`boss.attack`) | bộ nhớ theo (boss, người), xoá khi Boss kết thúc | đầu đòn: DoT/choáng; kỹ năng tộc tự phát; sát thương × `outMult`; phản công × Hộ Thể × Suy Nhược lên Boss; Linh Thân né phản công; DoT lên Boss tính vào sát thương của người đó |
| Bí Cảnh (`step`) | `m.kx` trong JSON trạng thái run (sống sót qua restart) | như Boss; đổi quái/tầng thì xoá hiệu ứng lên quái cũ; đòn của quái lên thành viên × Hộ Thể/Suy Nhược/Linh Thân của thành viên đó |
| Chứng Đạo (`strike`) | `k.kx` trong kiếp | chỉ kỹ năng tộc **tự thân** (hồi máu/hộ thể…) trước mỗi đạo lôi; Hộ Thể giảm uy lực lôi. Không có đòn tấn công/né. |
| Tông Chiến (`doAttack`) | bộ nhớ theo (trận, người) | như Boss (đối thủ là người chơi: 1 điểm = 1% sinh lực tối đa của họ); né của đối thủ cộng Linh Thân của họ; admin giáng thiên phạt không đổi |

## Quy ước đơn vị / chống lạm dụng (ĐỀ XUẤT, chờ duyệt)
1. **Điểm thanh:** số liệu hiệu ứng tính theo "điểm 1% sinh lực tối đa". Người chơi: `maxHp/100`. Kẻ địch PvE: `foe.unit = kernel_foe_dot_pct (5%) × một đòn điển hình` — để Thiêu Đốt không bằng 2% HP của Boss hàng nghìn tỉ.
2. **Boss/Thủ Lĩnh/Chứng Đạo/Tông Chiến miễn nhiễm Choáng** (`ctrlImmune`), không thể khoá cứng.
3. **Hồi chiêu kỹ năng tộc nhân theo hệ thống** (`CD_MULT`: boss ×6, bicanh ×10, chungdao ×1, tongchien ×3). Lý do: 1 trận PvP ≈ 8 hiệp, còn Bí Cảnh ≈ hàng trăm thao tác. Với ×1, benchmark đầu tiên cho thấy tộc Nhân thắng Bí Cảnh 7% → 100% (xem `bench_k22_cd1` bên dưới).
4. Kỹ năng tộc **tự phát** khi hồi xong (không thêm nút ở 4 giao diện); tắt bằng `!kernel race off`.
5. Hiệu ứng ngẫu nhiên 22% sau mỗi đòn (có ở PvP) **KHÔNG** có trong PvE — không thêm số cân bằng mới ngoài những gì kỹ năng tộc đã có.

## Giới hạn đã biết
- Hiệu ứng lên kẻ địch trong Bí Cảnh theo từng thành viên (mỗi người một sổ), không dùng chung cả đội.
- Thành viên khác bị nhắm: hiệu ứng của họ chỉ giảm hạn khi chính họ hành động.
- Trạng thái Boss/Tông Chiến nằm trong bộ nhớ: restart bot thì mất hiệu ứng đang chạy (không mất tiền/vật phẩm).
- `cpfx.battleState` (hộ thể/né/suy yếu của công pháp mới, đếm theo đòn) và EffectEngine vẫn là hai lớp riêng cho PvP; chưa gộp. PvE chưa dùng `cpfx.battleState`.
- Giao diện 4 hệ thống chỉ hiện thêm vài dòng nhật ký (Boss: `kernelLines`; Bí Cảnh: nhật ký run; Chứng Đạo: dòng kết quả; Tông Chiến: nối vào chuỗi kết quả). Không đổi nút.
- Kiểm thử: `scripts/test_kernel22.js`, `scripts/bench_kernel22.js` (mock + SQLite thật). Discord thật: **NOT TESTED**.

## Benchmark (cấu hình mặc định: hồi chiêu ×6/×10/×1/×3; N=30 mỗi ô; mock + SQLite thật)
**Độ nhiễu:** với N=30, sai số tiêu chuẩn mỗi ô thắng/thua ≈ ±9 điểm %. Dòng "không tộc" thực tế KHÔNG bị kernel tác động (không có kỹ năng tộc) nhưng vẫn lệch 30% → 17% — đó là nhiễu, nên chênh dưới ~15 điểm % không đáng kết luận.

### Bí Cảnh #1 solo, người chơi đúng cảnh giới yêu cầu — thắng / lượt TB / HP còn lại cuối run (legacy → kernel)
| Tộc | thắng | lượt | HP cuối |
|---|---|---|---|
| không tộc | 30% → 17% | 807 → 780 | 15% → 7% |
| nhan | 27% → 30% | 819 → 874 | 13% → 15% |
| long | 63% → 63% | 995 → 1024 | 29% → 29% |
| phuong | 100% → 100% | 1000 → 910 | 52% → 52% |
| ma | 13% → 20% | 709 → 724 | 6% → 9% |
| linh | 47% → 50% | 918 → 941 | 22% → 24% |
| yeu | 30% → 23% | 792 → 767 | 13% → 11% |

### Boss Thế Giới — sát thương TB/đòn · phản công TB/đòn (legacy → kernel)
| Tộc | sát thương | phản công |
|---|---|---|
| không tộc | 54082 → 55904 | 152685 → 149461 |
| nhan | 55872 → 55909 | 148147 → 145265 |
| long | 56326 → 56128 | 154781 → 132402 |
| phuong | 58108 → 64878 | 143627 → 143879 |
| ma | 57617 → 66007 | 145788 → 147721 |
| linh | 54696 → 54841 | 139533 → 134381 |
| yeu | 56329 → 58933 | 152979 → 149966 |

### Chứng Đạo — tỉ lệ vượt kiếp / HP cuối (legacy → kernel), người chơi trung bình (có trang bị + 3 công pháp, không đan)
| Tộc | vượt kiếp | HP cuối |
|---|---|---|
| không tộc | 100% → 100% | 27% → 25% |
| nhan | 100% → 100% | 25% → 41% |
| long | 100% → 100% | 25% → 38% |
| phuong | 100% → 100% | 23% → 23% |
| ma | 100% → 100% | 23% → 14% |
| linh | 100% → 100% | 23% → 29% |
| yeu | 100% → 100% | 23% → 23% |

**Đọc kết quả (trung thực):**
- Boss Thế Giới: phản công/đòn gần như không đổi trừ tộc Long (−14%, Long Uy làm Boss yếu đi); sát thương tăng ~+12–15% ở tộc Phượng và Ma (kỹ năng tấn công / Cuồng Huyết). Các tộc còn lại trong nhiễu.
- Bí Cảnh: không có thay đổi vượt nhiễu sau khi nhân hồi chiêu ×10.
- Chứng Đạo: người chơi trung bình đã vượt 100% ở cả hai chế độ; kernel chỉ đổi HP còn lại (Nhân/Long tăng +13–16 điểm %, Ma giảm −9 điểm % vì hiến tế HP). Chứng Đạo chưa phân biệt được độ khó bằng tỉ lệ vượt kiếp trong mô hình này.
- Chưa đo Tông Chiến bằng số (đối thủ là người chơi thật, phụ thuộc đội hình) — chỉ có test chức năng.

**Vì sao phải nhân hồi chiêu (bench lần đầu, hồi chiêu ×1, N=14):**

### Bí Cảnh #1 solo, người chơi đúng cảnh giới yêu cầu — thắng / lượt TB / HP còn lại cuối run (legacy → kernel)
| Tộc | thắng | lượt | HP cuối |
|---|---|---|---|
| không tộc | 29% → 21% | 829 → 760 | 15% → 10% |
| nhan | 7% → 100% | 748 → 1061 | 4% → 50% |
| long | 43% → 100% | 932 → 1041 | 20% → 46% |
| phuong | 100% → 100% | 978 → 813 | 49% → 52% |
| ma | 29% → 21% | 791 → 618 | 14% → 9% |
| linh | 43% → 100% | 932 → 1079 | 20% → 46% |
| yeu | 29% → 36% | 771 → 738 | 13% → 16% |

Với ×1, tộc Nhân/Long/Linh thắng Bí Cảnh 100% (so với 7–43%), vì hồi máu/hộ thể cứ vài thao tác lại phát một lần trong một run dài hàng trăm thao tác. Đây là lý do mặc định phải là `legacy` và hồi chiêu PvE phải nhân hệ số.
