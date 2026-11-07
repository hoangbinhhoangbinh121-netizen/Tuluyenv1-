#!/usr/bin/env python3
"""
make_pixel_emoji_v13_talent.py — vẽ 13 emoji pixel MỚI cho Thể Chất / Linh Căn / Tăng Tốc (v13.9).
Cùng phong cách bộ cũ (lưới 64x64 phóng x2, viền nâu, sáng/tối, quầng sáng) — chỉ ghi 13 file mới, KHÔNG đụng emoji cũ.
Chạy:  python3 scripts/make_pixel_emoji_v13_talent.py [thư_mục_xuất]   (mặc định assets/emoji)
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
from make_pixel_emoji_v12_streak import part, compose, sparkle, save, GOLD, GOLD_D, GOLD_L

RED, RED_D = (214, 58, 52, 255), (150, 28, 34, 255)
GRN, GRN_D, GRN_L = (84, 200, 96, 255), (40, 130, 66, 255), (170, 240, 150, 255)
CYAN, CYAN_L = (90, 200, 236, 255), (200, 246, 255, 255)
WHITE = (255, 255, 255, 255)
BLUE, BLUE_D = (70, 130, 230, 255), (36, 76, 170, 255)
ORG, YEL = (240, 110, 20, 255), (255, 200, 50, 255)
BRN, BRN_D = (150, 98, 56, 255), (104, 64, 34, 255)
STONE, STONE_D, STONE_L = (150, 150, 160, 255), (100, 100, 114, 255), (206, 206, 216, 255)
PAPER, PAPER_D = (244, 226, 176, 255), (206, 180, 120, 255)


def orb_base(col, col_d):
    def orb(d):
        d.ellipse([10, 8, 53, 51], fill=col)
        d.ellipse([16, 14, 47, 45], fill=col_d)
        d.ellipse([18, 16, 45, 43], fill=col)
    def stand(d):
        d.rectangle([20, 50, 43, 55], fill=GOLD)
        d.rectangle([24, 55, 39, 58], fill=GOLD_D)
    def shine(d):
        d.ellipse([17, 13, 26, 21], fill=(255, 255, 255, 210))
    return [part(stand), part(orb, 110, 90), part(shine, 0, 0)]


def bao_thechat():
    def fig(d):
        d.ellipse([28, 20, 35, 27], fill=GOLD_L)                 # đầu
        d.polygon([(32, 28), (42, 31), (40, 42), (24, 42), (22, 31)], fill=GOLD_L)   # thân
        d.rectangle([29, 42, 34, 44], fill=GOLD)
    im = compose(orb_base(RED, RED_D) + [part(fig, 60, 80)], glow=(255, 120, 80))
    for x, y, r in [(8, 12, 3), (57, 20, 3), (54, 54, 2)]:
        sparkle(im, x, y, r)
    return im


def bao_linhcan():
    def sprout(d):
        d.polygon([(31, 42), (33, 42), (33, 30), (31, 30)], fill=GRN_L)
        d.polygon([(32, 32), (22, 30), (19, 22), (30, 24)], fill=GRN_L)
        d.polygon([(33, 28), (43, 26), (45, 18), (35, 20)], fill=(210, 255, 190, 255))
    im = compose(orb_base(GRN_D, (24, 90, 60, 255)) + [part(sprout, 60, 90)], glow=(120, 255, 150))
    for x, y, r in [(8, 14, 3), (57, 16, 3), (55, 54, 2)]:
        sparkle(im, x, y, r)
    return im


def truyenthua():
    def roll(d):
        d.rectangle([14, 14, 49, 50], fill=PAPER)
        d.rectangle([10, 10, 53, 17], fill=BRN)       # trục trên
        d.rectangle([10, 47, 53, 54], fill=BRN)       # trục dưới
        d.rectangle([8, 9, 11, 18], fill=GOLD)
        d.rectangle([52, 9, 55, 18], fill=GOLD)
        d.rectangle([8, 46, 11, 55], fill=GOLD)
        d.rectangle([52, 46, 55, 55], fill=GOLD)
    def text(d):
        for y in (22, 27, 32):
            d.line([(19, y), (44, y)], fill=PAPER_D)
        d.line([(19, 37), (36, 37)], fill=PAPER_D)
    def seal(d):
        d.ellipse([34, 36, 47, 49], fill=RED)
        d.ellipse([37, 39, 44, 46], fill=RED_D)
        d.point((40, 42), fill=GOLD_L)
    im = compose([part(roll), part(text, 0, 0), part(seal, 90, 90)], glow=(255, 220, 120))
    for x, y, r in [(6, 4, 2), (58, 6, 3), (58, 58, 2)]:
        sparkle(im, x, y, r)
    return im


def thuctinh():
    def eye(d):
        d.polygon([(6, 32), (20, 18), (44, 18), (58, 32), (44, 46), (20, 46)], fill=WHITE)
    def iris(d):
        d.ellipse([22, 20, 41, 43], fill=GOLD)
        d.ellipse([27, 25, 36, 38], fill=(60, 30, 90, 255))
        d.ellipse([29, 27, 32, 31], fill=WHITE)
    def rays(d):
        for (x1, y1, x2, y2) in [(32, 3, 32, 10), (14, 8, 18, 13), (50, 8, 46, 13), (32, 54, 32, 61), (14, 57, 18, 52), (50, 57, 46, 52)]:
            d.line([(x1, y1), (x2, y2)], fill=GOLD, width=2)
    im = compose([part(rays, 60, 60), part(eye, 70, 90), part(iris, 90, 90)], glow=(255, 210, 90))
    for x, y, r in [(5, 18, 2), (59, 18, 2)]:
        sparkle(im, x, y, r)
    return im


def tienhoa():
    def arrow(col):
        def f(d):
            d.polygon([(32, 6), (52, 28), (41, 28), (41, 40), (23, 40), (23, 28), (12, 28)], fill=col)
        return f
    def chev(d):
        d.polygon([(32, 44), (50, 56), (50, 60), (32, 50), (14, 60), (14, 56)], fill=GOLD)
    im = compose([part(arrow(GRN), 100, 90), part(chev, 90, 90)], glow=(130, 255, 140))
    d = ImageDraw.Draw(im)
    d.line([(30, 12), (24, 26)], fill=(220, 255, 210, 220))
    for x, y, r in [(9, 12, 3), (56, 10, 3), (8, 50, 2)]:
        sparkle(im, x, y, r)
    return im


def conghuong():
    def a(d):
        d.ellipse([4, 12, 38, 46], outline=RED, width=5)
    def b(d):
        d.ellipse([26, 12, 60, 46], outline=GRN, width=5)
    def mid(d):
        d.polygon([(32, 20), (36, 29), (45, 29), (38, 35), (41, 44), (32, 38), (23, 44), (26, 35), (19, 29), (28, 29)], fill=GOLD_L)
    im = compose([part(a, 90, 90), part(b, 90, 90), part(mid, 80, 90)], glow=(255, 220, 140))
    for x, y, r in [(8, 6, 3), (56, 6, 3), (32, 56, 3)]:
        sparkle(im, x, y, r)
    return im


def tinhkhiet():
    def gem(d):
        d.polygon([(32, 4), (54, 22), (32, 60), (10, 22)], fill=CYAN)
    def facet(d):
        d.polygon([(32, 4), (44, 22), (32, 22)], fill=CYAN_L)
        d.polygon([(32, 22), (44, 22), (32, 60)], fill=(60, 160, 214, 255))
        d.polygon([(10, 22), (20, 22), (32, 60)], fill=(120, 214, 244, 255))
    im = compose([part(gem, 100, 90), part(facet, 0, 0)], glow=(120, 230, 255))
    d = ImageDraw.Draw(im)
    d.line([(32, 4), (54, 22), (32, 60), (10, 22), (32, 4)], fill=(58, 34, 20, 255))
    d.line([(10, 22), (54, 22)], fill=(58, 34, 20, 140))
    for x, y, r in [(10, 8, 3), (57, 38, 3), (8, 50, 2)]:
        sparkle(im, x, y, r)
    return im


def hanh_kim():
    def bar(d):
        d.polygon([(8, 36), (16, 22), (48, 22), (56, 36)], fill=GOLD_L)
        d.polygon([(8, 36), (56, 36), (52, 50), (12, 50)], fill=GOLD)
    def shade_(d):
        d.polygon([(12, 50), (52, 50), (56, 36), (48, 36)], fill=GOLD_D)
    im = compose([part(bar, 90, 90), part(shade_, 0, 70)], glow=(255, 230, 120))
    for x, y, r in [(10, 14, 3), (54, 14, 3), (32, 8, 2)]:
        sparkle(im, x, y, r)
    return im


def hanh_moc():
    def trunk(d):
        d.rectangle([28, 40, 35, 58], fill=BRN)
    def crown(d):
        d.ellipse([12, 8, 52, 40], fill=GRN)
        d.ellipse([8, 20, 34, 44], fill=GRN)
        d.ellipse([30, 20, 56, 44], fill=GRN)
    def lit(d):
        d.ellipse([16, 12, 30, 24], fill=GRN_L)
    im = compose([part(trunk), part(crown, 90, 90), part(lit, 0, 0)], glow=(120, 255, 150))
    for x, y, r in [(5, 10, 2), (58, 12, 3)]:
        sparkle(im, x, y, r)
    return im


def hanh_thuy():
    def drop(d):
        d.polygon([(32, 4), (46, 28), (50, 38), (32, 60), (14, 38), (18, 28)], fill=BLUE)
        d.ellipse([14, 28, 50, 60], fill=BLUE)
    def lit(d):
        d.ellipse([20, 34, 28, 48], fill=(190, 230, 255, 255))
    im = compose([part(drop, 100, 90), part(lit, 0, 0)], glow=(110, 190, 255))
    for x, y, r in [(9, 12, 3), (56, 22, 3)]:
        sparkle(im, x, y, r)
    return im


def hanh_hoa():
    def fl(d):
        d.polygon([(32, 2), (44, 18), (52, 34), (46, 54), (32, 60), (18, 54), (12, 34), (20, 22), (26, 28)], fill=ORG)
        d.polygon([(32, 20), (42, 36), (40, 52), (32, 56), (24, 52), (22, 38)], fill=YEL)
        d.polygon([(32, 36), (37, 46), (32, 54), (27, 46)], fill=(255, 246, 200, 255))
    im = compose([part(fl, 70, 90)], glow=(255, 150, 40))
    for x, y, r in [(8, 10, 3), (57, 12, 3)]:
        sparkle(im, x, y, r)
    return im


def hanh_tho():
    def back(d):
        d.polygon([(2, 56), (22, 22), (34, 38), (44, 14), (62, 56)], fill=STONE_D)
    def front(d):
        d.polygon([(10, 56), (28, 28), (40, 44), (46, 34), (58, 56)], fill=BRN)
        d.rectangle([8, 54, 60, 58], fill=BRN_D)
    def snow(d):
        d.polygon([(44, 14), (49, 23), (44, 21), (39, 24)], fill=WHITE)
    im = compose([part(back, 90, 90), part(front, 90, 90), part(snow, 0, 0)], glow=(220, 170, 100))
    for x, y, r in [(8, 10, 3), (56, 6, 2)]:
        sparkle(im, x, y, r)
    return im


def tangtoc():
    def bolt(d):
        d.polygon([(36, 2), (14, 34), (28, 34), (22, 62), (50, 26), (35, 26), (46, 2)], fill=GOLD)
    def core(d):
        d.polygon([(37, 8), (22, 32), (33, 32), (29, 50), (42, 28), (31, 28), (40, 8)], fill=GOLD_L)
    def lines(d):
        for y, x1 in [(14, 4), (30, 2), (46, 6)]:
            d.line([(x1, y), (x1 + 9, y)], fill=(180, 235, 255, 255), width=2)
        for y, x1 in [(22, 54), (40, 56)]:
            d.line([(x1, y), (x1 + 6, y)], fill=(180, 235, 255, 255), width=2)
    im = compose([part(lines, 0, 0), part(bolt, 90, 90), part(core, 0, 0)], glow=(255, 230, 90))
    for x, y, r in [(54, 8, 3), (8, 56, 2)]:
        sparkle(im, x, y, r)
    return im


ALL = {
    'bao_thechat': bao_thechat, 'bao_linhcan': bao_linhcan, 'truyenthua': truyenthua, 'thuctinh': thuctinh,
    'tienhoa': tienhoa, 'conghuong': conghuong, 'tinhkhiet': tinhkhiet,
    'hanh_kim': hanh_kim, 'hanh_moc': hanh_moc, 'hanh_thuy': hanh_thuy, 'hanh_hoa': hanh_hoa, 'hanh_tho': hanh_tho,
    'tangtoc': tangtoc,
}

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'emoji')
    os.makedirs(out, exist_ok=True)
    for k, fn in ALL.items():
        save(fn(), k, out)
    print(f'Đã vẽ {len(ALL)} emoji mới ->', os.path.normpath(out))
