#!/usr/bin/env python3
"""
make_pixel_emoji_v18_canhgioi.py — vẽ emoji pixel cho 15 cảnh giới MỚI (v18.0) + 4 emoji tiểu cảnh giới, cùng phong cách bộ emoji hiện có
(lưới 64x64 phóng x2 → PNG 128x128 nền trong suốt, viền nâu đậm, bevel sáng/tối, quầng sáng nhẹ, tia sáng; đọc rõ ở 32x32, không chữ, đặt giữa).

  canhgioi_14 Chuẩn Tiên Vương  vương ấn đang hình thành      canhgioi_15 Tiên Vương      vương miện tiên giới
  canhgioi_16 Chuẩn Tiên Tôn    thần kích                     canhgioi_17 Tiên Tôn        thánh liên
  canhgioi_18 Chuẩn Tiên Đế     đế ấn                         canhgioi_19 Tiên Đế         GIỮ NGUYÊN tranh vương miện của Tiên Đế cũ (không vẽ lại — sao chép từ bản cũ)
  canhgioi_20 Chuẩn Tiên Tổ     bản nguyên hỗn độn            canhgioi_21 Tiên Tổ         cổ thụ bản nguyên
  canhgioi_22 Chuẩn Đạo Tổ      Thái Cực đang hình thành      canhgioi_23 Đạo Tổ          Thái Cực hoàn chỉnh
  canhgioi_24 Chuẩn Thiên Đạo   thiên nhãn thức tỉnh          canhgioi_25 Thiên Đạo       thiên nhãn hoàn chỉnh
  canhgioi_26 Đại Đạo Chí Tôn   vòng xoáy đại đạo             canhgioi_27 Vô Thượng Chí Tôn thần ấn tối cao
  canhgioi_28 Siêu Thoát        cổng vượt ngoài vũ trụ
  so_ky / trung_ky / hau_ky / vien_man   4 tiểu cảnh giới (đĩa ngọc đầy 1/4, 1/2, 3/4, trọn vẹn)

KHÔNG đụng canhgioi_0..13. Ghi luôn emoji Unicode dự phòng vào src/data/emoji_fallback.json.
Chạy:  python3 scripts/make_pixel_emoji_v18_canhgioi.py [--sheet contact_sheet.png]
"""
import json, math, os, shutil, sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_pixel_emoji_v12_streak import G, canvas, part, compose as _compose, sparkle, save  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'assets', 'emoji'))
FB = os.path.normpath(os.path.join(HERE, '..', 'src', 'data', 'emoji_fallback.json'))


def compose(parts, glow=None):
    return _compose(parts, glow=tuple(glow[:3]) if glow else None)


def rgb(r, g, b): return (r, g, b, 255)
def dark(c, f=.62): return (int(c[0] * f), int(c[1] * f), int(c[2] * f), 255)
def light(c, f=.5): return (int(c[0] + (255 - c[0]) * f), int(c[1] + (255 - c[1]) * f), int(c[2] + (255 - c[2]) * f), 255)
def mix(a, b, t): return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3)) + (255,)
def P(fn): return part(fn)
def polyc(d, pts, c, o=.55): d.polygon(pts, fill=c, outline=dark(c, o))
def ell(d, box, c, o=.55): d.ellipse(box, fill=c, outline=dark(c, o))


GOLD = rgb(240, 190, 60); GOLD_D = rgb(176, 112, 30); GOLD_L = rgb(255, 232, 130)
JADE = rgb(70, 200, 150); CYAN = rgb(80, 220, 230); BLUE = rgb(80, 150, 240); VIOLET = rgb(150, 100, 235)
PURPLE = rgb(170, 100, 220); PINK = rgb(245, 140, 190); WHITE = rgb(246, 246, 250); SILVER = rgb(205, 212, 225)
RED = rgb(225, 70, 60); NAVY = rgb(36, 30, 78); INK = rgb(46, 34, 60); BROWN = rgb(120, 78, 44); GREEN = rgb(84, 180, 90)


def ghost(d, pts, col=GOLD_L, step=3):
    """Đường nét đứt (hình đang hình thành)."""
    n = len(pts)
    for i in range(n):
        (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
        L = max(1, int(math.hypot(x1 - x0, y1 - y0)))
        for k in range(0, L, step * 2):
            for j in range(step):
                t = min(L, k + j) / L
                d.point((int(x0 + (x1 - x0) * t), int(y0 + (y1 - y0) * t)), fill=col)


def rays(d, cx, cy, r0, r1, col, n=12, w=1, phase=0):
    for i in range(n):
        a = math.radians(i * 360 / n + phase)
        d.line([(cx + math.cos(a) * r0, cy + math.sin(a) * r0), (cx + math.cos(a) * r1, cy + math.sin(a) * r1)], fill=col, width=w)


# ---------------------------------------------------------------- 14 Chuẩn Tiên Vương — vương ấn đang hình thành
def e14():
    base = P(lambda d: (polyc(d, [(14, 54), (50, 54), (50, 38), (14, 38)], GOLD), d.rectangle([14, 38, 50, 41], fill=GOLD_L)))
    knob = P(lambda d: (ell(d, [26, 24, 38, 36], GOLD_L), polyc(d, [(28, 36), (36, 36), (38, 40), (26, 40)], GOLD)))
    face = P(lambda d: (d.rectangle([20, 44, 44, 50], fill=GOLD_D), d.line([(24, 47), (40, 47)], fill=GOLD_L), d.line([(32, 44), (32, 50)], fill=GOLD_L)))

    def ghost_top(d):
        ghost(d, [(14, 38), (50, 38), (50, 22), (14, 22)], rgb(255, 238, 170))
        ghost(d, [(22, 22), (42, 22), (36, 12), (28, 12)], rgb(255, 238, 170), 2)
    im = compose([base, knob, face], glow=GOLD)
    g = canvas(); ghost_top(ImageDraw.Draw(g)); im.alpha_composite(g)
    for x, y in ((9, 16), (55, 20), (32, 6)): sparkle(im, x, y, 3)
    return im


# ---------------------------------------------------------------- 15 Tiên Vương — vương miện tiên giới (bạc-ngọc, khác vương miện vàng của Tiên Đế)
def e15():
    band = P(lambda d: (polyc(d, [(10, 50), (54, 50), (54, 40), (10, 40)], SILVER), d.rectangle([10, 40, 54, 42], fill=WHITE), d.rectangle([10, 48, 54, 50], fill=dark(SILVER, .7))))
    peaks = P(lambda d: (polyc(d, [(10, 40), (14, 18), (22, 32), (32, 10), (42, 32), (50, 18), (54, 40)], SILVER)))
    gems = P(lambda d: (ell(d, [28, 42, 36, 49], rgb(80, 200, 220)), ell(d, [15, 43, 21, 48], JADE), ell(d, [43, 43, 49, 48], JADE),
                        ell(d, [30, 16, 34, 22], rgb(255, 120, 150)), d.point((29, 43), fill=WHITE)))
    tips = P(lambda d: [ell(d, [x - 2, y - 2, x + 2, y + 2], CYAN) for x, y in ((14, 17), (32, 9), (50, 17))])
    im = compose([peaks, band, gems, tips], glow=CYAN)
    for x, y in ((6, 12), (58, 12), (32, 4)): sparkle(im, x, y, 3, rgb(210, 250, 255))
    return im


# ---------------------------------------------------------------- 16 Chuẩn Tiên Tôn — thần kích
def e16():
    shaft = P(lambda d: (d.line([(14, 58), (46, 10)], fill=BROWN, width=4), d.line([(13, 57), (45, 9)], fill=GOLD, width=1)))
    blade = P(lambda d: (polyc(d, [(46, 10), (40, 22), (50, 24)], SILVER), polyc(d, [(46, 10), (54, 6), (58, 20), (50, 30), (44, 26)], CYAN),
                         polyc(d, [(46, 12), (52, 10), (54, 18), (49, 24)], WHITE)))
    spike = P(lambda d: polyc(d, [(46, 10), (50, 2), (53, 8)], SILVER))
    tassel = P(lambda d: (ell(d, [36, 22, 42, 28], RED), d.line([(39, 28), (36, 38)], fill=RED, width=2), d.line([(40, 28), (40, 40)], fill=rgb(255, 120, 100), width=1)))
    pommel = P(lambda d: ell(d, [9, 54, 17, 62], GOLD))
    im = compose([shaft, tassel, blade, spike, pommel], glow=CYAN)
    for x, y in ((24, 20), (58, 34), (8, 38)): sparkle(im, x, y, 3, rgb(210, 250, 255))
    return im


# ---------------------------------------------------------------- 17 Tiên Tôn — thánh liên
def e17():
    def lotus(d):
        for dx, dy, h in ((-18, 8, 18), (18, 8, 18), (-10, 4, 24), (10, 4, 24)):
            polyc(d, [(32, 50), (32 + dx - 4, 50 - h), (32 + dx + dy // 2, 50 - h - 6), (32 + dx + 4, 50 - h + 2)], PINK, .5)
        polyc(d, [(32, 50), (24, 28), (32, 12), (40, 28)], light(PINK, .55), .5)
        d.line([(32, 20), (32, 44)], fill=light(PINK, .85))
    petals = P(lotus)
    core = P(lambda d: (ell(d, [27, 38, 37, 48], GOLD), d.point((30, 41), fill=WHITE)))
    pad = P(lambda d: (d.ellipse([8, 48, 56, 60], fill=rgb(60, 160, 110), outline=dark(rgb(60, 160, 110), .5)), d.ellipse([16, 50, 48, 56], fill=rgb(90, 200, 140))))
    im = compose([pad, petals, core], glow=PINK)
    for x, y in ((8, 14), (56, 14), (32, 4), (4, 40), (60, 40)): sparkle(im, x, y, 2, rgb(255, 230, 245))
    return im


# ---------------------------------------------------------------- 18 Chuẩn Tiên Đế — đế ấn
def e18():
    base = P(lambda d: (polyc(d, [(10, 56), (54, 56), (54, 36), (10, 36)], PURPLE), d.rectangle([10, 36, 54, 39], fill=light(PURPLE, .5)),
                        d.rectangle([10, 52, 54, 56], fill=dark(PURPLE, .6))))
    gold = P(lambda d: (d.rectangle([10, 36, 54, 38], fill=GOLD), d.rectangle([10, 54, 54, 56], fill=GOLD), d.rectangle([10, 36, 12, 56], fill=GOLD), d.rectangle([52, 36, 54, 56], fill=GOLD),
                        polyc(d, [(18, 36), (46, 36), (42, 28), (22, 28)], GOLD, .5), ell(d, [26, 14, 38, 28], GOLD_L), d.point((29, 17), fill=WHITE)))
    rune = P(lambda d: (d.rectangle([22, 42, 42, 50], fill=dark(PURPLE, .5)), d.line([(26, 46), (38, 46)], fill=GOLD_L), d.line([(32, 43), (32, 49)], fill=GOLD_L),
                        d.point((26, 44), fill=GOLD_L), d.point((38, 48), fill=GOLD_L)))
    im = compose([base, gold, rune], glow=PURPLE)
    for x, y in ((8, 24), (56, 24), (32, 6)): sparkle(im, x, y, 3, rgb(240, 220, 255))
    return im


# ---------------------------------------------------------------- 20 Chuẩn Tiên Tổ — bản nguyên hỗn độn
def swirl_orb(cx, cy, r, cols, turns=2.2, ghost_half=False):
    def f(d):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=NAVY, outline=dark(NAVY, .5))
        for k, c in enumerate(cols):
            for i in range(0, 220):
                t = i / 220.0
                a = (t * turns * 2 * math.pi) + k * 2 * math.pi / len(cols)
                rr = t * (r - 2)
                x, y = cx + math.cos(a) * rr, cy + math.sin(a) * rr
                d.ellipse([x - 1.5, y - 1.5, x + 1.5, y + 1.5], fill=c)
    return P(f)


def e20():
    orb = swirl_orb(32, 32, 24, [VIOLET, CYAN, rgb(255, 120, 200)])
    core = P(lambda d: (ell(d, [28, 28, 36, 36], WHITE, .8)))
    shine = P(lambda d: (d.arc([12, 12, 52, 52], 200, 260, fill=light(VIOLET, .7), width=2)))
    im = compose([orb, shine, core], glow=VIOLET)
    for x, y in ((6, 10), (58, 14), (8, 52), (57, 52)): sparkle(im, x, y, 2, rgb(225, 210, 255))
    return im


# ---------------------------------------------------------------- 21 Tiên Tổ — cổ thụ bản nguyên
def e21():
    trunk = P(lambda d: (polyc(d, [(27, 56), (29, 36), (35, 36), (37, 56)], BROWN), polyc(d, [(29, 50), (14, 58), (20, 52)], BROWN), polyc(d, [(35, 50), (50, 58), (44, 52)], BROWN),
                         polyc(d, [(30, 40), (18, 28), (22, 26), (31, 34)], BROWN), polyc(d, [(34, 40), (46, 28), (42, 26), (33, 34)], BROWN)))

    def crown(d):
        for x, y, r in ((32, 14, 11), (18, 22, 10), (46, 22, 10), (24, 14, 8), (40, 14, 8), (32, 26, 10)):
            ell(d, [x - r, y - r, x + r, y + r], GREEN, .55)
        for x, y, r in ((30, 12, 6), (16, 20, 5), (44, 20, 5)):
            ell(d, [x - r, y - r, x + r, y + r], light(GREEN, .35), .6)
    leaves = P(crown)
    orbs = P(lambda d: [ell(d, [x - 2, y - 2, x + 2, y + 2], GOLD_L) for x, y in ((24, 20), (38, 10), (46, 22), (14, 24), (32, 24))])
    im = compose([trunk, leaves, orbs], glow=rgb(150, 255, 150))
    for x, y in ((5, 10), (59, 10), (32, 3)): sparkle(im, x, y, 2, rgb(230, 255, 200))
    return im


# ---------------------------------------------------------------- Thái Cực
def taiji(cx, cy, r, half=False):
    def f(d):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE, outline=INK)
        d.pieslice([cx - r, cy - r, cx + r, cy + r], 90, 270, fill=rgb(34, 30, 50))
        d.ellipse([cx - r // 2, cy - r, cx + r // 2, cy], fill=rgb(34, 30, 50))
        d.ellipse([cx - r // 2, cy, cx + r // 2, cy + r], fill=WHITE)
        d.ellipse([cx - r // 6 - 1, cy - r // 2 - r // 6, cx + r // 6 + 1, cy - r // 2 + r // 6], fill=WHITE)
        d.ellipse([cx - r // 6 - 1, cy + r // 2 - r // 6, cx + r // 6 + 1, cy + r // 2 + r // 6], fill=rgb(34, 30, 50))
        d.arc([cx - r, cy - r, cx + r, cy + r], 0, 360, fill=GOLD, width=2)
    return P(f)


def e23():
    ring = P(lambda d: (d.ellipse([4, 4, 60, 60], outline=GOLD_L, width=2)))
    im = compose([ring, taiji(32, 32, 22)], glow=GOLD)
    for x, y in ((6, 8), (58, 8), (6, 56), (58, 56)): sparkle(im, x, y, 3)
    return im


def e22():
    # đang hình thành: nửa phải mờ (nét đứt), nửa trái đã thành hình
    t = taiji(32, 32, 22)
    px = t.load()
    for y in range(G):
        for x in range(32, G):
            if px[x, y][3] > 0 and x > 33: px[x, y] = (0, 0, 0, 0)
    g = canvas(); d = ImageDraw.Draw(g)
    for a in range(-90, 90, 8): d.point((int(32 + math.cos(math.radians(a)) * 22), int(32 + math.sin(math.radians(a)) * 22)), fill=GOLD_L)
    d.point((40, 22), fill=GOLD_L); d.point((42, 40), fill=GOLD_L); d.point((38, 32), fill=GOLD_L)
    for a in range(-90, 90, 5): d.point((int(32 + math.cos(math.radians(a)) * 14), int(32 + math.sin(math.radians(a)) * 14 * (1 if a < 0 else 1))), fill=rgb(210, 200, 255))
    im = compose([t], glow=VIOLET)
    im.alpha_composite(g)
    for x, y in ((50, 14), (54, 32), (50, 50), (8, 8)): sparkle(im, x, y, 2, rgb(255, 245, 190))
    return im


# ---------------------------------------------------------------- Thiên nhãn
def eye(cx, cy, w, h, iris_r, open_frac, iris=CYAN):
    def f(d):
        top = cy - h * open_frac
        pts = [(cx - w, cy)]
        for i in range(1, 12):
            t = i / 12; x = cx - w + 2 * w * t
            pts.append((x, cy - (cy - top) * math.sin(math.pi * t)))
        pts.append((cx + w, cy))
        for i in range(11, 0, -1):
            t = i / 12; x = cx - w + 2 * w * t
            pts.append((x, cy + h * math.sin(math.pi * t)))
        d.polygon(pts, fill=WHITE, outline=INK)
        # tròng
        mask = Image.new('L', (G, G), 0); md = ImageDraw.Draw(mask); md.polygon(pts, fill=255)
        ir = Image.new('RGBA', (G, G), (0, 0, 0, 0)); idr = ImageDraw.Draw(ir)
        idr.ellipse([cx - iris_r, cy - iris_r, cx + iris_r, cy + iris_r], fill=iris, outline=dark(iris, .5))
        idr.ellipse([cx - iris_r // 2, cy - iris_r // 2, cx + iris_r // 2, cy + iris_r // 2], fill=INK)
        idr.point((cx - iris_r // 2, cy - iris_r // 2), fill=WHITE)
        ir.putalpha(Image.composite(ir.split()[3], Image.new('L', (G, G), 0), mask))
        d._image.alpha_composite(ir)
    return P(f)


def e24():
    # mắt mới mở một phần, mi trên hạ thấp, tia sáng mờ
    lid = P(lambda d: (d.line([(6, 32), (14, 24), (32, 20), (50, 24), (58, 32)], fill=INK, width=2)))
    im = compose([eye(32, 32, 24, 11, 9, .45, CYAN)], glow=CYAN)
    g = canvas(); d = ImageDraw.Draw(g)
    for dx in (-18, -9, 0, 9, 18): d.line([(32 + dx, 14), (32 + dx * 1.2, 8)], fill=rgb(200, 245, 255))
    im.alpha_composite(g)
    for x, y in ((6, 14), (58, 14), (32, 52)): sparkle(im, x, y, 2, rgb(210, 250, 255))
    return im


def e25():
    im = compose([eye(32, 32, 26, 15, 12, 1.0, GOLD)], glow=GOLD)
    g = canvas(); d = ImageDraw.Draw(g)
    rays(d, 32, 32, 29, 33, GOLD_L, n=16)
    for dx in (-18, -9, 0, 9, 18): d.line([(32 + dx, 10), (32 + dx * 1.2, 3)], fill=GOLD_L)
    im.alpha_composite(g)
    for x, y in ((5, 12), (59, 12), (5, 52), (59, 52)): sparkle(im, x, y, 3)
    return im


# ---------------------------------------------------------------- 26 Đại Đạo Chí Tôn — vòng xoáy đại đạo
def e26():
    def vortex(d):
        d.ellipse([6, 6, 58, 58], fill=rgb(30, 22, 70), outline=dark(rgb(30, 22, 70), .4))
        cols = [VIOLET, rgb(255, 150, 210), GOLD]
        for k in range(3):
            for i in range(0, 300):
                t = i / 300.0; a = t * 1.5 * 2 * math.pi + k * 2 * math.pi / 3; rr = 3 + t * 20
                x, y = 32 + math.cos(a) * rr, 32 + math.sin(a) * rr
                s = 1.1 + t * 1.5
                d.ellipse([x - s, y - s, x + s, y + s], fill=cols[k])
        d.ellipse([28, 28, 36, 36], fill=WHITE)
        d.ellipse([6, 6, 58, 58], outline=BLUE, width=2)
    im = compose([P(vortex)], glow=VIOLET)
    for x, y in ((4, 8), (60, 10), (4, 56), (60, 56)): sparkle(im, x, y, 2, rgb(225, 215, 255))
    return im


# ---------------------------------------------------------------- 27 Vô Thượng Chí Tôn — thần ấn tối cao
def e27():
    disc = P(lambda d: (ell(d, [6, 6, 58, 58], GOLD_L), ell(d, [11, 11, 53, 53], GOLD), ell(d, [16, 16, 48, 48], WHITE, .4)))
    def runes(d):
        rays(d, 32, 32, 18, 22, GOLD_D, n=12, w=2)
        for i in range(8):
            a = math.radians(i * 45 + 22.5)
            d.ellipse([32 + math.cos(a) * 19 - 1, 32 + math.sin(a) * 19 - 1, 32 + math.cos(a) * 19 + 1, 32 + math.sin(a) * 19 + 1], fill=rgb(255, 255, 255))
        polyc(d, [(32, 18), (36, 28), (46, 32), (36, 36), (32, 46), (28, 36), (18, 32), (28, 28)], rgb(255, 110, 150), .5)
        ell(d, [28, 28, 36, 36], WHITE, .6)
    ring = P(runes)
    im = compose([disc, ring], glow=GOLD)
    g = canvas(); d = ImageDraw.Draw(g); rays(d, 32, 32, 28, 31, rgb(255, 255, 220), n=24)
    im.alpha_composite(g)
    for x, y in ((3, 6), (61, 6), (3, 58), (61, 58)): sparkle(im, x, y, 3, rgb(255, 250, 210))
    return im


# ---------------------------------------------------------------- 28 Siêu Thoát — cổng vượt ngoài vũ trụ
def e28():
    def gate(d):
        d.rectangle([8, 12, 56, 58], fill=SILVER, outline=dark(SILVER, .5))
        d.pieslice([8, 0, 56, 48], 180, 360, fill=SILVER, outline=dark(SILVER, .5))
        d.rectangle([8, 48, 56, 58], fill=dark(SILVER, .7))
    frame = P(gate)

    def void(d):
        d.rectangle([16, 24, 48, 58], fill=NAVY)
        d.pieslice([16, 8, 48, 40], 180, 360, fill=NAVY)
        for i in range(0, 30):
            y = 58 - i * 1.4; t = i / 30.0
            c = mix(rgb(120, 80, 240), rgb(255, 230, 200), t)
            d.line([(16, y), (48, y)], fill=c) if t > 0.8 else None
        d.rectangle([29, 22, 35, 58], fill=rgb(255, 245, 210))
        d.polygon([(29, 22), (35, 22), (42, 58), (22, 58)], fill=rgb(255, 235, 170))
        d.rectangle([30, 22, 34, 58], fill=WHITE)
    inner = P(void)
    stars = P(lambda d: [d.point(p, fill=WHITE) for p in ((20, 18), (44, 20), (24, 30), (42, 34), (18, 40), (46, 44), (32, 12), (38, 26))])
    cap = P(lambda d: (ell(d, [28, 2, 36, 10], GOLD), d.rectangle([12, 56, 52, 59], fill=GOLD)))
    im = compose([frame, inner, stars, cap], glow=rgb(255, 230, 160))
    for x, y in ((4, 20), (60, 20), (32, 62)): sparkle(im, x, y, 2, rgb(255, 245, 210))
    return im


# ---------------------------------------------------------------- Tiểu cảnh giới (đĩa ngọc đầy dần)
def stage_disc(frac, col, final=False):
    def f(d):
        d.ellipse([8, 8, 56, 56], fill=rgb(48, 54, 74), outline=dark(rgb(48, 54, 74), .5))
        if frac >= 1: d.ellipse([8, 8, 56, 56], fill=col, outline=dark(col, .5))
        else: d.pieslice([8, 8, 56, 56], -90, -90 + 360 * frac, fill=col, outline=dark(col, .5))
        d.ellipse([20, 20, 44, 44], fill=rgb(36, 40, 60) if frac < 1 else light(col, .35), outline=dark(col, .55))
    disc = P(f)
    parts = [disc]
    if final: parts.append(P(lambda d: polyc(d, [(32, 22), (35, 30), (42, 32), (35, 35), (32, 43), (29, 35), (22, 32), (29, 30)], WHITE, .6)))
    im = compose(parts, glow=col)
    if final:
        for x, y in ((5, 8), (59, 8), (5, 56), (59, 56)): sparkle(im, x, y, 3, rgb(255, 245, 190))
    return im


STAGES = {'so_ky': (0.25, rgb(110, 200, 130), '🌱'), 'trung_ky': (0.5, rgb(80, 190, 220), '🌓'), 'hau_ky': (0.75, rgb(170, 110, 235), '🌔'), 'vien_man': (1.0, GOLD, '🌕')}

REALMS = {
    14: (e14, '🔱'), 15: (e15, '🤴'), 16: (e16, '🔱'), 17: (e17, '🪷'), 18: (e18, '🏯'),
    20: (e20, '🌀'), 21: (e21, '🌳'), 22: (e22, '☯️'), 23: (e23, '☯️'), 24: (e24, '👁️'), 25: (e25, '👁️‍🗨️'),
    26: (e26, '🌌'), 27: (e27, '🔆'), 28: (e28, '🚪'),
}
UNI = {14: '📜', 15: '👑', 16: '🔱', 17: '🪷', 18: '🏯', 19: '👑', 20: '🌀', 21: '🌳', 22: '☯️', 23: '☯️', 24: '👁️', 25: '🧿', 26: '🌌', 27: '🔆', 28: '🚪'}


def build(sheet=None):
    fb = json.load(open(FB, encoding='utf-8'))
    cells = []
    # Tiên Đế (19): giữ NGUYÊN tranh vương miện cũ. File canhgioi_19.png do bước chuyển (sao chép canhgioi_14 cũ) tạo — script KHÔNG ghi đè.
    if not os.path.exists(os.path.join(OUT, 'canhgioi_19.png')):
        raise SystemExit('thiếu canhgioi_19.png (bản sao vương miện Tiên Đế cũ): chạy `cp assets/emoji/canhgioi_14.png assets/emoji/canhgioi_19.png` TRƯỚC khi vẽ lại canhgioi_14')
    for idx, (fn, _uni) in REALMS.items():
        im = fn(); save(im, f'canhgioi_{idx}', OUT)
    for idx, uni in UNI.items(): fb[f'canhgioi_{idx}'] = uni
    for key, (frac, col, uni) in STAGES.items():
        save(stage_disc(frac, col, final=(frac >= 1)), key, OUT); fb[key] = uni
    json.dump(fb, open(FB, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); open(FB, 'a').write('\n')
    for i in range(14, 29): cells.append(Image.open(os.path.join(OUT, f'canhgioi_{i}.png')).convert('RGBA'))
    for k in STAGES: cells.append(Image.open(os.path.join(OUT, f'{k}.png')).convert('RGBA'))
    print(f'đã vẽ {len(REALMS)} cảnh giới + {len(STAGES)} tiểu cảnh giới (canhgioi_19 giữ tranh cũ)')
    if sheet:
        cols = 10; cell = 140; rows = (len(cells) + cols - 1) // cols
        im = Image.new('RGBA', (cols * cell, rows * cell + 40), (54, 57, 63, 255))
        for i, e in enumerate(cells): im.alpha_composite(e, ((i % cols) * cell + 6, (i // cols) * cell + 6))
        # hàng thu nhỏ 32x32 để kiểm tra độ đọc
        for i, e in enumerate(cells): im.alpha_composite(e.resize((32, 32), Image.LANCZOS), ((i % cols) * cell + 100, (i // cols) * cell + 100))
        im.convert('RGB').save(sheet); print('contact sheet →', sheet)


if __name__ == '__main__':
    build(sys.argv[sys.argv.index('--sheet') + 1] if '--sheet' in sys.argv else None)
