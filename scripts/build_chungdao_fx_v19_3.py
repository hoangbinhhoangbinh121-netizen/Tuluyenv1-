#!/usr/bin/env python3
"""V19.3 — dựng bộ hiệu ứng Chứng Đạo Thành Đế từ gói gốc `chung_dao_thanh_de_assets_v2_nhe.zip`.
Dùng:  python3 -I scripts/build_chungdao_fx_v19_3.py <thư_mục_gốc_đã_giải_nén> [thư_mục_ra=assets/chungdao]
Dùng ĐỦ 30 file gốc (MANIFEST bên dưới liệt kê file → nơi dùng). Kết quả được nén nhẹ để zip dự án < 30 MiB.
"""
import os, sys, random
from PIL import Image, ImageEnhance, ImageOps

SRC = sys.argv[1]; OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', 'assets', 'chungdao')
os.makedirs(OUT, exist_ok=True)
W, H = 1200, 675
Q = 72

# file gốc → nơi dùng (test_chungdao_fx19 kiểm tra mọi file đều có trong bảng này)
MANIFEST = {
  '01_thien_dia_di_bien.jpg': 'intro.jpg, loi_01', '02_van_dao_cong_minh.jpg': 'loi_07', '03_tu_tieu_than_loi.jpg': 'loi_02',
  '04_cuu_thien_kim_loi.jpg': 'loi_03', '05_hon_nguyen_diet_the_loi.jpg': 'loi_04', '06_thoi_khong_than_loi.jpg': 'loi_05',
  '07_luan_hoi_chi_kiep.jpg': 'loi_08', '08_dai_dao_chi_kiep.jpg': 'loi_06', '09_thien_dao_tham_phan.jpg': 'loi_09',
  '10_vo_thuong_de_kiep.jpg': 'loi_10', '11_chung_dao_thanh_de.jpg': 'win_a, win_b', '12_de_toa.jpg': 'de_toa.jpg, win_d',
  '13_de_hoan.png': 'de_hoan.png (tab Đế Hiệu)', '14_de_an.png': 'de_an.png (Tổng quan + kết quả thắng)',
  '15_de_quan_giang_the.jpg': 'win_c, binh.jpg', '16_cuu_trong_de_kiep.jpg': 'loi_11, loi_12, fail.jpg',
  'anim_dai_dao_luan_ban.gif': 'anim_luan_ban.gif (tab Đế Đạo + cảnh thắng)', 'anim_than_quang.gif': 'anim_than_quang.gif (cảnh thắng)',
  'anim_thien_loi.gif': 'anim_thien_loi.gif (mỗi đạo lôi đánh xuống)',
  'fx_bach_ho.png': 'win_c', 'fx_chu_tuoc.png': 'win_b', 'fx_dai_dao_luan_ban.png': 'win_a', 'fx_kim_lien.png': 'win_c, win_d',
  'fx_kim_long.png': 'win_b', 'fx_than_quang.png': 'loi_12, win_c, win_d', 'fx_thien_loi_tim.png': 'loi_01..06', 'fx_thien_loi_vang.png': 'loi_07..12',
  'fx_tuong_van_1.png': 'win_b', 'fx_tuong_van_2.png': 'win_b, win_d', 'fx_tuong_van_3.png': 'win_c',
}
def p(n): return os.path.join(SRC, n)
def scene(n):
    return ImageOps.fit(Image.open(p(n)).convert('RGB'), (W, H), Image.LANCZOS)
def sprite(n, h=None, w=None, alpha=1.0):
    im = Image.open(p(n)).convert('RGBA'); bb = im.getbbox()
    if bb: im = im.crop(bb)
    if h: im = im.resize((max(1, int(im.width * h / im.height)), h), Image.LANCZOS)
    if w: im = im.resize((w, max(1, int(im.height * w / im.width))), Image.LANCZOS)
    if alpha < 1: a = im.getchannel('A').point(lambda v: int(v * alpha)); im.putalpha(a)
    return im
def paste(base, im, cx, cy):
    base.alpha_composite(im, (int(cx - im.width / 2), int(cy - im.height / 2)))
def save_jpg(img, name):
    img.convert('RGB').save(os.path.join(OUT, name), 'JPEG', quality=Q, optimize=True, progressive=True)

def with_rgba(img): return img.convert('RGBA')
# ---------- 12 đạo lôi: cảnh nền + tia sét (tím cho Thiên Địa/Hỗn Độn, vàng cho Đế Đạo/Chung Cực)
LOI_BASE = ['01_thien_dia_di_bien.jpg', '03_tu_tieu_than_loi.jpg', '04_cuu_thien_kim_loi.jpg', '05_hon_nguyen_diet_the_loi.jpg',
            '06_thoi_khong_than_loi.jpg', '08_dai_dao_chi_kiep.jpg', '02_van_dao_cong_minh.jpg', '07_luan_hoi_chi_kiep.jpg',
            '09_thien_dao_tham_phan.jpg', '10_vo_thuong_de_kiep.jpg', '16_cuu_trong_de_kiep.jpg', '16_cuu_trong_de_kiep.jpg']
for n in range(1, 13):
    stage = (n - 1) // 3; rnd = random.Random(1900 + n)
    img = with_rgba(scene(LOI_BASE[n - 1]))
    bolt = 'fx_thien_loi_tim.png' if stage < 2 else 'fx_thien_loi_vang.png'
    cnt = stage + 1                                  # 1..4 tia theo tầng kiếp
    xs = [W * (i + 1) / (cnt + 1) + rnd.randint(-70, 70) for i in range(cnt)]
    for i, x in enumerate(xs):
        s = sprite(bolt, h=int(H * (0.55 + 0.1 * rnd.random())), alpha=0.9)
        if rnd.random() < 0.5: s = ImageOps.mirror(s)
        paste(img, s, x, H * 0.36)
    if n == 12:                                      # đạo cuối: hào quang Thần Quang bùng nổ giữa trời
        paste(img, sprite('fx_than_quang.png', h=int(H * 0.95), alpha=0.55), W / 2, H * 0.42)
    save_jpg(img, f'loi_{n:02d}.jpg')

# ---------- mở màn (dị biến thiên địa nguyên bản) + thất bại + đế tọa + binh
save_jpg(scene('01_thien_dia_di_bien.jpg'), 'intro.jpg')
f = ImageEnhance.Color(scene('16_cuu_trong_de_kiep.jpg')).enhance(0.35); f = ImageEnhance.Brightness(f).enhance(0.75)
red = Image.new('RGB', (W, H), (150, 20, 20)); save_jpg(Image.blend(f, red, 0.22), 'fail.jpg')
save_jpg(scene('12_de_toa.jpg'), 'de_toa.jpg')
save_jpg(scene('15_de_quan_giang_the.jpg'), 'binh.jpg')

# ---------- cảnh chứng đạo thành công (4 cảnh)
a = with_rgba(scene('11_chung_dao_thanh_de.jpg'))                               # a: Đại Đạo Luân Bàn xoay sau lưng
paste(a, sprite('fx_dai_dao_luan_ban.png', h=int(H * 1.05), alpha=0.38), W / 2, H * 0.47); save_jpg(a, 'win_a.jpg')
b = with_rgba(scene('11_chung_dao_thanh_de.jpg'))                               # b: Kim Long + Chu Tước + tường vân
paste(b, sprite('fx_kim_long.png', h=int(H * 0.62)), W * 0.14, H * 0.40)
paste(b, sprite('fx_chu_tuoc.png', h=int(H * 0.40)), W * 0.86, H * 0.30)
paste(b, sprite('fx_tuong_van_1.png', w=int(W * 0.17)), W * 0.30, H * 0.86)
paste(b, sprite('fx_tuong_van_2.png', w=int(W * 0.15)), W * 0.74, H * 0.80); save_jpg(b, 'win_b.jpg')
c = with_rgba(scene('15_de_quan_giang_the.jpg'))                                # c: Đế Quân giáng thế, Bạch Hổ + Kim Liên + thần quang
paste(c, sprite('fx_than_quang.png', h=int(H * 1.0), alpha=0.45), W / 2, H * 0.40)
paste(c, sprite('fx_bach_ho.png', h=int(H * 0.40)), W * 0.12, H * 0.72)
paste(c, sprite('fx_kim_lien.png', w=int(W * 0.30), alpha=0.9), W / 2, H * 0.90)
paste(c, sprite('fx_tuong_van_3.png', w=int(W * 0.14)), W * 0.88, H * 0.18); save_jpg(c, 'win_c.jpg')
d = with_rgba(scene('12_de_toa.jpg'))                                           # d: Đế Tọa — cảnh cuối
paste(d, sprite('fx_than_quang.png', h=int(H * 0.9), alpha=0.35), W / 2, H * 0.45)
paste(d, sprite('fx_kim_lien.png', w=int(W * 0.26), alpha=0.9), W / 2, H * 0.93)
paste(d, sprite('fx_tuong_van_2.png', w=int(W * 0.12)), W * 0.1, H * 0.15); save_jpg(d, 'win_d.jpg')

# ---------- Đế Ấn / Đế Hoàn (thu nhỏ + lượng tử hóa nhẹ)
for src, dst in (('14_de_an.png', 'de_an.png'), ('13_de_hoan.png', 'de_hoan.png')):
    im = Image.open(p(src)).convert('RGBA').resize((384, 384), Image.LANCZOS)
    im.quantize(colors=128, method=Image.FASTOCTREE, dither=Image.Dither.NONE).save(os.path.join(OUT, dst), optimize=True)

# ---------- GIF (thu nhỏ, giảm màu)
def gif(src, dst, size, colors, step=1):
    im = Image.open(p(src)); frames = []; durs = []
    for i in range(im.n_frames):
        im.seek(i)
        if i % step: durs[-1] += im.info.get('duration', 60); continue
        fr = im.convert('RGB').resize(size, Image.LANCZOS)
        frames.append(fr.quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.Dither.NONE)); durs.append(im.info.get('duration', 60))
    frames[0].save(os.path.join(OUT, dst), save_all=True, append_images=frames[1:], duration=durs, loop=0, optimize=True, disposal=1)
gif('anim_thien_loi.gif', 'anim_thien_loi.gif', (480, 270), 40)
gif('anim_than_quang.gif', 'anim_than_quang.gif', (256, 256), 32)
gif('anim_dai_dao_luan_ban.gif', 'anim_luan_ban.gif', (256, 256), 32)
for fn in sorted(os.listdir(OUT)): print(fn, os.path.getsize(os.path.join(OUT, fn)) // 1024, 'KB')
print('tổng', sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)) // 1024, 'KB')
