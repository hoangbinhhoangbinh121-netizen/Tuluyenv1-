#!/usr/bin/env python3
"""
make_pixel_emoji_v12_streak.py — vẽ 2 emoji pixel MỚI (v12.5): `treoquan` (đồng hồ cát bế quan treo máy) và `chuoi` (chuỗi lửa streak).
Lưới 64x64 phóng x2 (nearest) -> PNG 128x128 nền trong suốt, viền nâu đậm + sáng/tối, tia sáng — cùng phong cách bộ emoji hiện có.
Chỉ ghi 2 file này, KHÔNG đụng emoji khác.   Chạy:  python3 scripts/make_pixel_emoji_v12_streak.py
"""
import os
from PIL import Image, ImageDraw, ImageChops, ImageFilter

G = 64
OUTLINE = (58, 34, 20, 255)


def canvas():
    return Image.new('RGBA', (G, G), (0, 0, 0, 0))


def mask_of(im):
    return im.split()[3].point(lambda v: 255 if v > 0 else 0)


def shade(im, light=(255, 255, 255), dark=(0, 0, 0), la=70, da=70):
    """Sáng ở mép trên-trái, tối ở mép dưới-phải của từng mảng màu (hiệu ứng bevel pixel)."""
    m = mask_of(im)
    up = ImageChops.offset(m, 0, 1)      # pixel có "trên" trống => mép trên
    lf = ImageChops.offset(m, 1, 0)
    dn = ImageChops.offset(m, 0, -1)
    rt = ImageChops.offset(m, -1, 0)
    top = ImageChops.multiply(m, ImageChops.invert(ImageChops.multiply(up, lf).point(lambda v: v)))
    edge_l = ImageChops.subtract(m, ImageChops.multiply(up, lf))
    edge_d = ImageChops.subtract(m, ImageChops.multiply(dn, rt))
    out = im.copy()
    out.paste(Image.new('RGBA', (G, G), light + (la,)), (0, 0), edge_l)
    out.paste(Image.new('RGBA', (G, G), dark + (da,)), (0, 0), edge_d)
    out.putalpha(m)
    return out


def part(draw_fn, light_a=80, dark_a=80):
    c = canvas()
    draw_fn(ImageDraw.Draw(c))
    return shade(c, la=light_a, da=dark_a)


def compose(parts, glow=None):
    base = canvas()
    for p in parts:
        base.alpha_composite(p)
    m = mask_of(base)
    # viền nâu 1px bám sát hình (tính TRƯỚC quầng sáng)
    ring = ImageChops.subtract(m.filter(ImageFilter.MaxFilter(3)), m)
    outl = Image.new('RGBA', (G, G), OUTLINE)
    outl.putalpha(ring)
    shape = canvas()
    shape.alpha_composite(outl)
    shape.alpha_composite(base)
    res = canvas()
    if glow:   # quầng sáng rất nhẹ nằm dưới hình
        full = mask_of(shape)
        g = full.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2)).point(lambda v: int(v * 0.30))
        gl = Image.new('RGBA', (G, G), glow + (0,))
        gl.putalpha(g)
        res.alpha_composite(gl)
    res.alpha_composite(shape)
    return res


def sparkle(im, x, y, r=3, col=(255, 244, 190, 255)):
    d = ImageDraw.Draw(im)
    d.line([(x - r, y), (x + r, y)], fill=col)
    d.line([(x, y - r), (x, y + r)], fill=col)
    d.point((x, y), fill=(255, 255, 255, 255))


GOLD, GOLD_D, GOLD_L = (236, 178, 52, 255), (176, 112, 30, 255), (255, 226, 120, 255)
GLASS = (176, 226, 250, 255)
SAND = (250, 196, 70, 255)


def treoquan():
    def frame(d):
        d.rectangle([14, 6, 49, 11], fill=GOLD)          # nắp trên
        d.rectangle([14, 53, 49, 58], fill=GOLD)         # nắp dưới
        d.rectangle([16, 12, 19, 52], fill=GOLD_D)       # trụ trái
        d.rectangle([44, 12, 47, 52], fill=GOLD_D)       # trụ phải
    def glass(d):
        d.polygon([(21, 12), (42, 12), (34, 31), (29, 31)], fill=GLASS)
        d.polygon([(29, 33), (34, 33), (42, 52), (21, 52)], fill=GLASS)
        d.rectangle([29, 31, 34, 33], fill=(150, 205, 238, 255))
    def sand(d):
        d.polygon([(26, 22), (37, 22), (34, 31), (29, 31)], fill=SAND)       # cát còn ở trên
        d.polygon([(32, 42), (39, 52), (25, 52)], fill=SAND)                  # đống cát dưới
        d.line([(31, 32), (31, 44)], fill=SAND)                               # dòng cát rơi
        d.line([(32, 32), (32, 44)], fill=(255, 226, 130, 255))
    f = part(frame)
    g = part(glass, 110, 60)
    s = part(sand, 90, 80)
    im = compose([f, g, s], glow=(120, 200, 255))
    # vệt phản chiếu thủy tinh
    d = ImageDraw.Draw(im)
    d.line([(24, 14), (30, 26)], fill=(255, 255, 255, 200))
    d.line([(24, 38), (25, 48)], fill=(255, 255, 255, 170))
    # gờ sáng nắp
    d.line([(15, 7), (48, 7)], fill=GOLD_L)
    d.line([(15, 54), (48, 54)], fill=GOLD_L)
    for x, y, r in [(8, 14, 3), (56, 22, 3), (10, 46, 2), (55, 50, 2), (52, 8, 2)]:
        sparkle(im, x, y, r)
    return im


FL_O, FL_Y, FL_W = (240, 110, 20, 255), (255, 200, 50, 255), (255, 246, 200, 255)


def chuoi():
    def ring_a(d):
        d.ellipse([6, 32, 38, 56], outline=GOLD, width=6)
    def ring_b(d):
        d.ellipse([26, 32, 58, 56], outline=(220, 150, 40, 255), width=6)
    def ring_a_over(d):   # đoạn vòng A đè lên vòng B để tạo cảm giác móc vào nhau
        d.arc([6, 32, 38, 56], start=-60, end=40, fill=GOLD, width=6)
    def flame(d):
        d.polygon([(32, 4), (41, 16), (44, 26), (40, 34), (24, 34), (20, 26), (23, 16), (28, 18)], fill=FL_O)
        d.polygon([(32, 12), (38, 22), (39, 29), (35, 33), (28, 33), (25, 28), (28, 21)], fill=FL_Y)
        d.polygon([(32, 21), (35, 27), (34, 32), (30, 32), (29, 27)], fill=FL_W)
    a = part(ring_a, 90, 90)
    b = part(ring_b, 90, 90)
    aov = part(ring_a_over, 90, 90)
    fl = part(flame, 60, 90)
    im = compose([a, b, aov, fl], glow=(255, 150, 40))
    for x, y, r in [(9, 12, 3), (56, 14, 3), (50, 3, 2), (6, 58, 2)]:
        sparkle(im, x, y, r)
    return im


def save(im, name, outdir):
    big = im.resize((128, 128), Image.NEAREST)
    big.save(os.path.join(outdir, f'{name}.png'))


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'emoji')
    os.makedirs(out, exist_ok=True)
    save(treoquan(), 'treoquan', out)
    save(chuoi(), 'chuoi', out)
    print('Đã vẽ: treoquan.png, chuoi.png ->', os.path.normpath(out))
