#!/usr/bin/env python3
"""
make_pixel_emoji_v17_nghe.py — vẽ emoji pixel cho V17 (Bách Nghề · vật phẩm hợp nhất), cùng phong cách bộ emoji hiện có
(lưới 64x64 phóng x2 → PNG 128x128, viền nâu đậm, bevel sáng/tối, tia sáng). KHÔNG đụng emoji cũ.

  i17_<id>   118 vật phẩm (vật phẩm V16 đã có emoji riêng thì SAO CHÉP đúng tranh cũ — không vẽ lại)
  c17_<CAT>  11 danh mục        r17_1..7  7 phẩm cấp        p17_<nghề> 4 nghề        s17_<ô> 7 ô trang bị
Đồng thời ghi emoji Unicode dự phòng (cho lúc emoji pixel chưa tải lên Discord) vào src/data/emoji_fallback.json.
Chạy:  python3 scripts/make_pixel_emoji_v17_nghe.py [--sheet contact_sheet.png]
"""
import json, math, os, shutil, sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_pixel_emoji_v12_streak import G, OUTLINE, canvas, part, compose as _compose, sparkle, save  # noqa: E402


def compose(parts, glow=None):
    return _compose(parts, glow=tuple(glow[:3]) if glow else None)


HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'assets', 'emoji'))
FB = os.path.normpath(os.path.join(HERE, '..', 'src', 'data', 'emoji_fallback.json'))
ITEMS = json.load(open(os.path.join(HERE, 'emoji_v17_items.json'), encoding='utf-8'))
WHITE = (250, 250, 250, 255); INK = (70, 44, 28, 255)


def rgb(r, g, b): return (r, g, b, 255)
def dark(c, f=.62): return (int(c[0] * f), int(c[1] * f), int(c[2] * f), 255)
def light(c, f=.5): return (int(c[0] + (255 - c[0]) * f), int(c[1] + (255 - c[1]) * f), int(c[2] + (255 - c[2]) * f), 255)


COL = {  # tên màu → RGB
    'green': (92, 176, 84), 'jade': (70, 200, 150), 'purple': (170, 100, 220), 'pink': (240, 130, 190), 'blue': (80, 150, 240), 'ice': (160, 225, 250),
    'red': (225, 70, 60), 'orange': (245, 150, 50), 'yellow': (245, 210, 70), 'gold': (240, 190, 60), 'brown': (170, 120, 70), 'grey': (160, 165, 175),
    'black': (70, 70, 90), 'white': (240, 240, 245), 'cyan': (80, 220, 230), 'teal': (50, 160, 160), 'bronze': (190, 130, 70), 'silver': (205, 212, 225),
    'violet': (130, 90, 230), 'rose': (250, 110, 130), 'lime': (170, 225, 80), 'earth': (190, 150, 90), 'wood': (110, 190, 90), 'water': (70, 140, 240), 'fire': (240, 100, 50), 'metal': (225, 225, 235),
}
RAR = {1: (170, 170, 178), 2: (80, 200, 110), 3: (80, 150, 240), 4: (180, 100, 230), 5: (245, 200, 60), 6: (245, 140, 50), 7: (240, 80, 90)}


# ---------------------------------------------------------------- hình khối cơ bản (mỗi hàm trả 1 ảnh đã viền)
def P(fn): return part(fn)
def polyc(d, pts, c): d.polygon(pts, fill=c, outline=dark(c, .55))


def herb(c, top='bud'):
    g = rgb(*COL['green']); cc = rgb(*c)
    stem = P(lambda d: (d.line([(32, 56), (32, 30)], fill=dark(g, .9), width=3), polyc(d, [(32, 50), (14, 40), (20, 52)], g), polyc(d, [(32, 44), (50, 32), (44, 48)], g)))
    def head(d):
        if top == 'lotus':
            for dx in (-10, 10): d.ellipse([32 + dx - 7, 14, 32 + dx + 7, 36], fill=light(cc, .2), outline=dark(cc, .5))
            d.ellipse([25, 10, 39, 36], fill=cc, outline=dark(cc, .5))
        elif top == 'bloom':
            for a in range(0, 360, 60): d.ellipse([32 + math.cos(math.radians(a)) * 9 - 6, 22 + math.sin(math.radians(a)) * 9 - 6, 32 + math.cos(math.radians(a)) * 9 + 6, 22 + math.sin(math.radians(a)) * 9 + 6], fill=cc, outline=dark(cc, .5))
            d.ellipse([27, 17, 37, 27], fill=rgb(*COL['gold']), outline=dark(rgb(*COL['gold']), .5))
        elif top == 'leaf':
            for dx, dy in ((-12, 10), (0, 2), (12, 10)): polyc(d, [(32 + dx, 30 + dy), (26 + dx, 16 + dy), (32 + dx, 8 + dy), (38 + dx, 16 + dy)], cc)
        else:
            d.ellipse([24, 12, 40, 32], fill=cc, outline=dark(cc, .5)); d.ellipse([28, 15, 32, 20], fill=light(cc, .7))
    return compose([stem, P(head)], glow=cc)


def fruit(c, star=False):
    cc = rgb(*c)
    body = P(lambda d: (d.ellipse([14, 18, 50, 54], fill=cc, outline=dark(cc, .5)), d.ellipse([20, 23, 28, 31], fill=light(cc, .75))))
    leaf = P(lambda d: (polyc(d, [(32, 20), (46, 8), (50, 18), (36, 24)], rgb(*COL['green'])), d.line([(32, 20), (32, 12)], fill=INK, width=2)))
    parts = [body, leaf]
    im = compose(parts, glow=cc)
    if star: sparkle(im, 50, 46, 4); sparkle(im, 12, 14, 3)
    return im


def mushroom(c):
    cc = rgb(*c)
    stem = P(lambda d: d.rounded_rectangle([26, 34, 38, 54], radius=3, fill=rgb(240, 230, 205), outline=dark(rgb(240, 230, 205), .55)))
    cap = P(lambda d: (d.pieslice([8, 10, 56, 50], 180, 360, fill=cc, outline=dark(cc, .5)), [d.ellipse([x, y, x + 6, y + 5], fill=light(cc, .8)) for x, y in ((16, 24), (28, 17), (40, 25), (33, 29))]))
    return compose([stem, cap], glow=cc)


def root(c):
    cc = rgb(*c)
    body = P(lambda d: (polyc(d, [(32, 22), (46, 28), (44, 44), (36, 58), (30, 58), (22, 44), (18, 28)], cc), d.line([(24, 36), (40, 36)], fill=dark(cc, .6)), d.line([(26, 46), (38, 46)], fill=dark(cc, .6))))
    lv = P(lambda d: [polyc(d, [(32, 22), (32 + dx, 6), (32 + dx // 2, 24)], rgb(*COL['green'])) for dx in (-14, 0, 14)])
    return compose([body, lv], glow=cc)


def ore(c, crystal=None):
    cc = rgb(*c); rock = rgb(*COL['grey'])
    r = P(lambda d: (polyc(d, [(8, 48), (14, 26), (28, 16), (46, 22), (56, 40), (50, 54), (20, 56)], rock), d.line([(28, 16), (30, 36)], fill=dark(rock, .6))))
    def veins(d):
        for pts in ([(16, 42), (24, 30), (30, 40)], [(34, 44), (42, 28), (50, 42)], [(26, 52), (34, 40), (42, 52)]): polyc(d, pts, cc)
    return compose([r, P(veins)], glow=cc)


def ingot(c):
    cc = rgb(*c)
    a = P(lambda d: (polyc(d, [(8, 44), (16, 28), (48, 28), (56, 44)], cc), d.rectangle([8, 44, 56, 54], fill=dark(cc, .75), outline=dark(cc, .5))))
    b = P(lambda d: d.polygon([(18, 32), (46, 32), (50, 40), (14, 40)], fill=light(cc, .45)))
    im = compose([a, b], glow=cc); sparkle(im, 50, 20, 4); return im


def gemstone(c, big=True):
    cc = rgb(*c)
    g = P(lambda d: (polyc(d, [(32, 6), (52, 22), (32, 58), (12, 22)], cc), d.polygon([(32, 6), (42, 22), (32, 22), (22, 22)], fill=light(cc, .55)), d.line([(12, 22), (52, 22)], fill=dark(cc, .55)), d.line([(32, 22), (32, 58)], fill=dark(cc, .75))))
    im = compose([g], glow=cc); sparkle(im, 50, 12, 4); return im


def orb(c, mark=None):
    cc = rgb(*c)
    o = P(lambda d: (d.ellipse([10, 10, 54, 54], fill=cc, outline=dark(cc, .5)), d.ellipse([16, 15, 28, 27], fill=light(cc, .8))))
    def m(d):
        if mark == 'swirl': d.arc([22, 22, 44, 44], 30, 300, fill=dark(cc, .5), width=3)
        elif mark == 'bolt': polyc(d, [(36, 18), (26, 34), (33, 34), (28, 48), (40, 30), (33, 30)], rgb(*COL['yellow']))
        elif mark == 'eye': d.ellipse([24, 28, 40, 38], fill=WHITE, outline=INK); d.ellipse([29, 29, 35, 37], fill=INK)
        elif mark == 'star': polyc(d, [(32, 20), (35, 29), (44, 29), (37, 35), (40, 44), (32, 38), (24, 44), (27, 35), (20, 29), (29, 29)], WHITE)
    return compose([o, P(m)], glow=cc)


def drop(c, dragon=False):
    cc = rgb(*c)
    dp = P(lambda d: (polyc(d, [(32, 6), (46, 34), (46, 46), (32, 58), (18, 46), (18, 34)], cc), d.ellipse([24, 32, 30, 40], fill=light(cc, .8))))
    im = compose([dp], glow=cc)
    if dragon: sparkle(im, 50, 14, 4); sparkle(im, 14, 20, 3)
    return im


def bone(c):
    cc = rgb(*c)
    b = P(lambda d: (d.polygon([(18, 46), (46, 18), (50, 22), (22, 50)], fill=cc, outline=dark(cc, .55)), [d.ellipse([x, y, x + 12, y + 12], fill=cc, outline=dark(cc, .55)) for x, y in ((10, 44), (14, 52), (44, 8), (50, 14))]))
    return compose([b], glow=cc)


def scale(c):
    cc = rgb(*c)
    s = P(lambda d: (polyc(d, [(32, 6), (54, 18), (54, 40), (32, 58), (10, 40), (10, 18)], cc), d.arc([18, 16, 46, 44], 200, 340, fill=dark(cc, .55), width=2), d.arc([18, 26, 46, 54], 200, 340, fill=dark(cc, .55), width=2), d.ellipse([18, 14, 26, 22], fill=light(cc, .7))))
    return compose([s], glow=cc)


def wisp(c):
    cc = rgb(*c)
    w = P(lambda d: (polyc(d, [(32, 4), (48, 24), (46, 44), (38, 58), (26, 58), (18, 44), (16, 24)], light(cc, .15)), d.ellipse([22, 24, 28, 32], fill=INK), d.ellipse([36, 24, 42, 32], fill=INK), d.arc([24, 36, 40, 48], 20, 160, fill=INK, width=2)))
    return compose([w], glow=cc)


def feather(c):
    cc = rgb(*c)
    f = P(lambda d: (polyc(d, [(12, 54), (20, 24), (44, 6), (56, 10), (50, 34), (28, 50)], cc), d.line([(12, 54), (50, 12)], fill=dark(cc, .5), width=2), [d.line([(20 + i * 5, 46 - i * 5), (30 + i * 5, 38 - i * 5)], fill=light(cc, .6)) for i in range(5)]))
    im = compose([f], glow=cc); sparkle(im, 52, 40, 4); return im


def bottle(c, label=None):
    cc = rgb(*c); glass = rgb(*COL['ice'])
    b = P(lambda d: (d.rounded_rectangle([14, 26, 50, 58], radius=8, fill=glass, outline=dark(glass, .5)), d.rectangle([26, 12, 38, 28], fill=glass, outline=dark(glass, .5)), d.rectangle([24, 8, 40, 14], fill=rgb(*COL['brown']), outline=INK)))
    liq = P(lambda d: d.rounded_rectangle([17, 36, 47, 56], radius=6, fill=cc))
    return compose([b, liq], glow=cc)


def talisman(c):
    cc = rgb(*c); paper = rgb(246, 232, 190)
    p = P(lambda d: (d.rectangle([18, 6, 46, 58], fill=paper, outline=dark(paper, .5)), [d.line([(24, y), (40, y)], fill=cc, width=2) for y in (14, 24, 34)], d.ellipse([27, 40, 37, 50], outline=cc, width=2), d.line([(32, 14), (32, 50)], fill=cc, width=1)))
    return compose([p], glow=cc)


def runestone(c):
    cc = rgb(*c); st = rgb(*COL['grey'])
    s = P(lambda d: (d.rounded_rectangle([10, 10, 54, 54], radius=8, fill=st, outline=dark(st, .55)), d.line([(22, 22), (42, 22)], fill=cc, width=3), d.line([(32, 22), (32, 46)], fill=cc, width=3), d.line([(22, 46), (42, 46)], fill=cc, width=3)))
    return compose([s], glow=cc)


def flag(c):
    cc = rgb(*c)
    f = P(lambda d: (d.rectangle([14, 6, 18, 58], fill=rgb(*COL['brown']), outline=INK), polyc(d, [(18, 8), (54, 14), (46, 26), (54, 38), (18, 36)], cc), d.ellipse([28, 16, 38, 26], fill=light(cc, .7))))
    return compose([f], glow=cc)


def plate(c, sym='ring'):
    cc = rgb(*c); st = rgb(*COL['grey'])
    def base(d):
        pts = [(32 + math.cos(math.radians(22.5 + 45 * k)) * 27, 32 + math.sin(math.radians(22.5 + 45 * k)) * 27) for k in range(8)]
        polyc(d, pts, st); d.ellipse([14, 14, 50, 50], outline=cc, width=3)
    def inner(d):
        if sym == 'ring': d.ellipse([24, 24, 40, 40], fill=cc, outline=dark(cc, .5))
        elif sym == 'cross': d.line([(22, 22), (42, 42)], fill=cc, width=4); d.line([(42, 22), (22, 42)], fill=cc, width=4)
        elif sym == 'sword': d.line([(32, 20), (32, 44)], fill=cc, width=4); d.line([(24, 36), (40, 36)], fill=cc, width=3)
        elif sym == 'shield': polyc(d, [(32, 20), (44, 24), (42, 38), (32, 46), (22, 38), (20, 24)], cc)
        elif sym == 'spiral': d.arc([22, 22, 42, 42], 20, 330, fill=cc, width=3); d.ellipse([30, 30, 34, 34], fill=cc)
        elif sym == 'lock': d.rectangle([24, 30, 40, 44], fill=cc, outline=dark(cc, .5)); d.arc([26, 18, 38, 34], 180, 360, fill=cc, width=3)
        elif sym == 'star': polyc(d, [(32, 18), (36, 29), (47, 29), (38, 36), (42, 47), (32, 40), (22, 47), (26, 36), (17, 29), (28, 29)], cc)
        elif sym == 'portal': d.ellipse([22, 20, 42, 44], outline=cc, width=3); d.ellipse([28, 26, 36, 38], fill=cc)
    return compose([P(base), P(inner)], glow=cc)


def sand(c):
    cc = rgb(*c)
    s = P(lambda d: polyc(d, [(6, 54), (22, 30), (32, 16), (42, 30), (58, 54)], cc))
    im = compose([s], glow=cc)
    for x, y in ((22, 22), (44, 24), (32, 8)): sparkle(im, x, y, 3)
    return im


def cloud(c):
    cc = rgb(*c)
    cl = P(lambda d: ([d.ellipse([x, y, x + w, y + w], fill=light(cc, .35), outline=dark(cc, .5)) for x, y, w in ((8, 28, 22), (22, 16, 26), (36, 26, 20))], d.arc([22, 28, 44, 50], 20, 320, fill=cc, width=3)))
    return compose([cl], glow=cc)


def scroll(c, seal=None):
    cc = rgb(*c); paper = rgb(246, 232, 190)
    s = P(lambda d: (d.rectangle([14, 12, 50, 52], fill=paper, outline=dark(paper, .5)), d.ellipse([8, 8, 20, 20], fill=cc, outline=dark(cc, .5)), d.ellipse([8, 44, 20, 56], fill=cc, outline=dark(cc, .5)), d.ellipse([44, 8, 56, 20], fill=cc, outline=dark(cc, .5)), d.ellipse([44, 44, 56, 56], fill=cc, outline=dark(cc, .5)), [d.line([(22, y), (42, y)], fill=INK) for y in (22, 30, 38)]))
    return compose([s], glow=cc)


def shard(c, n=3):
    cc = rgb(*c)
    s = P(lambda d: [polyc(d, [(x, 56), (x + 6, 22 + o), (x + 12, 56)], cc) for x, o in ((10, 4), (24, -10), (38, 8))][:n])
    im = compose([s], glow=cc); sparkle(im, 32, 8, 4); return im


def pill(c, k=0):
    cc = rgb(*c)
    dish = P(lambda d: d.ellipse([8, 42, 56, 58], fill=rgb(*COL['brown']), outline=INK))
    def body(d):
        d.ellipse([14, 10, 50, 50], fill=cc, outline=dark(cc, .5)); d.ellipse([20, 16, 30, 26], fill=light(cc, .8))
        if k == 1: d.arc([18, 14, 46, 46], 200, 340, fill=dark(cc, .5), width=3)
        elif k == 2: d.line([(18, 30), (46, 30)], fill=dark(cc, .5), width=3)
        elif k == 3: [d.ellipse([x, y, x + 4, y + 4], fill=dark(cc, .55)) for x, y in ((32, 28), (24, 36), (38, 38))]
        elif k == 4: d.ellipse([26, 24, 38, 36], outline=dark(cc, .5), width=3)
    im = compose([dish, P(body)], glow=cc); sparkle(im, 52, 12, 4); return im


def seedbag(c):
    cc = rgb(*c)
    b = P(lambda d: (polyc(d, [(18, 28), (46, 28), (54, 56), (10, 56)], rgb(*COL['brown'])), d.rectangle([22, 22, 42, 30], fill=rgb(*COL['brown']), outline=INK), d.line([(22, 28), (42, 28)], fill=INK, width=2)))
    sp = P(lambda d: (d.line([(32, 22), (32, 10)], fill=rgb(*COL['green']), width=3), polyc(d, [(32, 14), (20, 8), (24, 18)], rgb(*COL['green'])), polyc(d, [(32, 12), (44, 6), (40, 16)], rgb(*COL['green'])), d.ellipse([26, 38, 38, 50], fill=cc, outline=dark(cc, .5))))
    return compose([b, sp], glow=cc)


def soil(c):
    cc = rgb(*c)
    s = P(lambda d: (polyc(d, [(6, 54), (18, 34), (32, 24), (46, 34), (58, 54)], cc), [d.ellipse([x, y, x + 5, y + 4], fill=light(cc, .35)) for x, y in ((20, 44), (34, 38), (42, 48), (28, 50))]))
    sp = P(lambda d: (d.line([(32, 24), (32, 12)], fill=rgb(*COL['green']), width=2), polyc(d, [(32, 16), (24, 10), (26, 18)], rgb(*COL['green'])), polyc(d, [(32, 14), (42, 8), (40, 16)], rgb(*COL['green']))))
    return compose([s, sp], glow=cc)


def jar(c):
    cc = rgb(*c)
    j = P(lambda d: (d.rounded_rectangle([12, 22, 52, 58], radius=12, fill=rgb(*COL['brown']), outline=INK), d.rectangle([20, 14, 44, 24], fill=dark(rgb(*COL['brown']), .85), outline=INK), d.rounded_rectangle([18, 32, 46, 50], radius=6, fill=cc)))
    return compose([j], glow=cc)


def part_(c):  # phôi khí: bánh răng
    cc = rgb(*c)
    def g(d):
        for a in range(0, 360, 45): d.rectangle([32 + math.cos(math.radians(a)) * 20 - 4, 32 + math.sin(math.radians(a)) * 20 - 4, 32 + math.cos(math.radians(a)) * 20 + 4, 32 + math.sin(math.radians(a)) * 20 + 4], fill=cc, outline=dark(cc, .5))
        d.ellipse([12, 12, 52, 52], fill=cc, outline=dark(cc, .5)); d.ellipse([24, 24, 40, 40], fill=(0, 0, 0, 0), outline=dark(cc, .5))
    return compose([P(g)], glow=cc)


def tablet(c):
    cc = rgb(*c); st = rgb(*COL['grey'])
    t = P(lambda d: (d.rounded_rectangle([14, 6, 50, 58], radius=6, fill=st, outline=dark(st, .55)), [d.line([(20, y), (44, y)], fill=cc, width=2) for y in (16, 26, 36, 46)], d.ellipse([28, 20, 36, 28], outline=cc, width=2)))
    return compose([t], glow=cc)


def coin(c, hole=True):
    cc = rgb(*c)
    k = P(lambda d: (d.ellipse([8, 8, 56, 56], fill=cc, outline=dark(cc, .5)), d.ellipse([14, 14, 50, 50], outline=dark(cc, .6), width=2), d.rectangle([26, 26, 38, 38], fill=(0, 0, 0, 0), outline=dark(cc, .5), width=2)))
    im = compose([k], glow=cc); sparkle(im, 52, 12, 4); return im


def seal(c):
    cc = rgb(*c)
    s = P(lambda d: (d.rectangle([14, 26, 50, 54], fill=cc, outline=dark(cc, .5)), d.ellipse([24, 8, 40, 28], fill=cc, outline=dark(cc, .5)), d.rectangle([20, 34, 44, 48], outline=dark(cc, .5), width=2), d.line([(24, 40), (40, 40)], fill=dark(cc, .5), width=2)))
    return compose([s], glow=cc)


def ticket(c):
    cc = rgb(*c)
    t = P(lambda d: (d.rounded_rectangle([6, 16, 58, 48], radius=5, fill=cc, outline=dark(cc, .5)), d.line([(22, 18), (22, 46)], fill=dark(cc, .5), width=2), d.ellipse([30, 24, 50, 40], outline=dark(cc, .5), width=2)))
    return compose([t], glow=cc)


def star(c):
    cc = rgb(*c)
    s = P(lambda d: polyc(d, [(32, 6), (39, 24), (58, 24), (43, 36), (49, 56), (32, 44), (15, 56), (21, 36), (6, 24), (25, 24)], cc))
    im = compose([s], glow=cc); sparkle(im, 52, 10, 4); return im


def chest(c):
    cc = rgb(*c)
    ch = P(lambda d: (d.rectangle([8, 28, 56, 56], fill=rgb(*COL['brown']), outline=INK), d.pieslice([8, 10, 56, 46], 180, 360, fill=dark(rgb(*COL['brown']), .85), outline=INK), d.rectangle([28, 30, 36, 42], fill=cc, outline=INK)))
    return compose([ch], glow=cc)


# ---------------------------------------------------------------- bảng gán: id → (hàm vẽ, màu, tham số, unicode)
def spec_for(id_):
    s = id_
    T = {
        # Linh Dược
        'ld_thanh_linh_thao': (herb, 'green', {'top': 'leaf'}, '🌿'), 'ld_tu_van_hoa': (herb, 'violet', {'top': 'bloom'}, '🌸'), 'ld_ngoc_tuy_sam': (root, 'white', {}, '🥕'),
        'ld_han_nguyet_lien': (herb, 'ice', {'top': 'lotus'}, '🪷'), 'ld_xich_diem_hoa': (herb, 'red', {'top': 'bloom'}, '🌺'), 'ld_dia_mach_chi': (mushroom, 'earth', {}, '🍄'),
        'ld_huyet_ngoc_qua': (fruit, 'red', {}, '🍎'), 'ld_cuu_diep_linh_chi': (mushroom, 'violet', {}, '🍄'), 'ld_bat_lao_tien_qua': (fruit, 'gold', {'star': True}, '🍑'), 'ld_hon_nguyen_dao_qua': (fruit, 'violet', {'star': True}, '🍇'),
        # Khoáng vật
        'kv_thanh_dong': (ore, 'jade', {}, '⛏️'), 'kv_huyen_tinh': (ore, 'black', {}, '⛏️'), 'kv_xich_huyet_thiet': (ore, 'red', {}, '⛏️'), 'kv_bang_phach_ngoc': (gemstone, 'ice', {}, '💎'),
        'kv_tu_kim_thach': (ore, 'purple', {}, '⛏️'), 'kv_thien_ngoai_van_thiet': (ore, 'cyan', {}, '☄️'), 'kv_cuu_thien_kim_tinh': (ingot, 'gold', {}, '🪙'), 'kv_hon_nguyen_kim_tinh': (ingot, 'white', {}, '🪙'),
        # Yêu thú
        'yt_yeu_dan': (orb, 'orange', {'mark': 'swirl'}, '🔮'), 'yt_tinh_huyet': (drop, 'red', {}, '🩸'), 'yt_yeu_cot': (bone, 'white', {}, '🦴'), 'yt_lan_giap': (scale, 'teal', {}, '🐉'),
        'yt_thu_hon': (wisp, 'ice', {}, '👻'), 'yt_hon_tinh': (orb, 'violet', {'mark': 'eye'}, '🔮'), 'yt_long_huyet': (drop, 'gold', {'dragon': True}, '🐲'), 'yt_phuong_vu': (feather, 'orange', {}, '🪶'),
        # Trận đạo
        'td_linh_mac': (bottle, 'black', {}, '🖋️'), 'td_phu_chi': (talisman, 'red', {}, '📜'), 'td_tran_van_thach': (runestone, 'cyan', {}, '🪨'), 'td_tran_ky': (flag, 'violet', {}, '🚩'),
        'td_tran_ban_co_thach': (plate, 'gold', {'sym': 'cross'}, '🔯'), 'td_thien_dien_sa': (sand, 'yellow', {}, '⏳'), 'td_khong_gian_phu_van': (cloud, 'violet', {}, '🌀'),
        # Tinh hoa / chí bảo
        'tdc_kim_nguyen_tinh': (gemstone, 'metal', {}, '🪙'), 'tdc_moc_nguyen_tinh': (gemstone, 'wood', {}, '🌳'), 'tdc_thuy_nguyen_tinh': (gemstone, 'water', {}, '💧'), 'tdc_hoa_nguyen_tinh': (gemstone, 'fire', {}, '🔥'), 'tdc_tho_nguyen_tinh': (gemstone, 'earth', {}, '🟤'),
        'tdc_phong_linh_tuy': (orb, 'lime', {'mark': 'swirl'}, '🌪️'), 'tdc_loi_linh_tuy': (orb, 'yellow', {'mark': 'bolt'}, '⚡'), 'tdc_hu_khong_toai_phien': (shard, 'violet', {}, '💠'), 'tdc_hon_don_nguyen_khi': (orb, 'black', {'mark': 'swirl'}, '🌑'),
        'tdc_tan_quyen_dan_phuong': (scroll, 'red', {}, '📜'), 'tdc_manh_ban_ve': (scroll, 'cyan', {}, '🗺️'), 'tdc_co_tran_do': (scroll, 'gold', {}, '🗺️'), 'tdc_dan_hoa_tinh': (orb, 'fire', {'mark': 'star'}, '🔥'),
        'tdc_khi_linh_hach': (orb, 'cyan', {'mark': 'star'}, '🔮'), 'tdc_thien_co_phu_van': (talisman, 'gold', {}, '📿'),
        'tdc_tien_gioi_lenh': (coin, 'white', {}, '🪙'), 'tdc_manh_ghep_phithang': (shard, 'gold', {'n': 2}, '🧩'), 'tdc_tien_phu': (talisman, 'gold', {}, '📿'), 'tdc_diem_linh_ngo': (star, 'cyan', {}, '✨'),
        # Linh thực
        'lt_chung_thanh_linh': (seedbag, 'green', {}, '🌱'), 'lt_chung_tu_van': (seedbag, 'violet', {}, '🌱'), 'lt_chung_han_nguyet': (seedbag, 'ice', {}, '🌱'), 'lt_chung_xich_diem': (seedbag, 'red', {}, '🌱'),
        'lt_linh_tho': (soil, 'brown', {}, '🟫'), 'lt_linh_tuyen_thuy': (bottle, 'water', {}, '💧'), 'lt_thuc_sinh_dich': (bottle, 'lime', {}, '🧪'), 'lt_duong_mach_dich': (bottle, 'gold', {}, '🧪'),
        # Trung gian
        'dd_so': (jar, 'green', {}, '🏺'), 'dd_trung': (jar, 'blue', {}, '🏺'), 'dd_cao': (jar, 'violet', {}, '🏺'), 'dd_tien': (jar, 'gold', {}, '🏺'),
        'kl_dong': (ingot, 'bronze', {}, '🧱'), 'kl_huyen': (ingot, 'black', {}, '🧱'), 'kl_tu': (ingot, 'purple', {}, '🧱'), 'kl_hon': (ingot, 'white', {}, '🧱'),
        'pk_tho': (part_, 'grey', {}, '⚙️'), 'pk_trung': (part_, 'blue', {}, '⚙️'), 'pk_cao': (part_, 'violet', {}, '⚙️'), 'pk_tien': (part_, 'gold', {}, '⚙️'),
        'tv_so': (tablet, 'cyan', {}, '🪧'), 'tv_trung': (tablet, 'blue', {}, '🪧'), 'tv_cao': (tablet, 'violet', {}, '🪧'),
        # Đan dược
        'dan_ngung_nguyen': (pill, 'blue', {'k': 1}, '💊'), 'dan_huyet_nguyen': (pill, 'red', {'k': 1}, '💊'), 'dan_thanh_tam': (pill, 'jade', {'k': 4}, '💊'), 'dan_ho_mach': (pill, 'green', {'k': 2}, '💊'),
        'dan_pha_canh': (pill, 'violet', {'k': 3}, '💊'), 'dan_ngung_than': (pill, 'ice', {'k': 4}, '💊'), 'dan_cuong_the': (pill, 'orange', {'k': 2}, '💊'), 'dan_kim_cuong': (pill, 'metal', {'k': 3}, '💊'),
        'dan_long_luc': (pill, 'gold', {'k': 1}, '💊'), 'dan_tat_phong': (pill, 'lime', {'k': 2}, '💊'), 'dan_han_ngoc': (pill, 'ice', {'k': 1}, '💊'), 'dan_liet_duong': (pill, 'fire', {'k': 3}, '💊'),
        'dan_do_kiep': (pill, 'yellow', {'k': 4}, '💊'), 'dan_tien_nguyen': (pill, 'white', {'k': 4}, '💊'), 'dan_tay_tuy_nua': (pill, 'pink', {'k': 2}, '💊'),
        # Trận pháp
        'tp_tu_linh': (plate, 'jade', {'sym': 'spiral'}, '🧿'), 'tp_ho_than': (plate, 'blue', {'sym': 'shield'}, '🧿'), 'tp_sat_phat': (plate, 'red', {'sym': 'sword'}, '🧿'), 'tp_me_tung': (plate, 'violet', {'sym': 'ring'}, '🧿'),
        'tp_phong_an': (plate, 'orange', {'sym': 'lock'}, '🧿'), 'tp_ho_tong': (plate, 'gold', {'sym': 'star'}, '🏯'), 'tp_khong_gian': (plate, 'cyan', {'sym': 'portal'}, '🌀'),
    }
    return T.get(s)


# Vật phẩm V16 đã có emoji riêng → SAO CHÉP tranh cũ (không vẽ lại)
LEGACY = {
    'ld_dac_biet': 'linhduocdacbiet', 'kv_huyen_thiet': 'huyenthiet', 'kv_tien_kim': 'tienkim', 'kv_tien_ngoc': 'tienngoc', 'tdc_hu_khong_tinh_hoa': 'hukhongtinhhoa', 'tdc_hu_khong_ket_tinh': 'hukhongkettinh',
    'tdc_thien_hoa_tinh': 'thienhoatinh', 'tdc_thien_kiep_chi_luc': 'thienkiepchiluc', 'tdc_thien_dao_thach': 'thiendaothach', 'tdc_dao_nguyen_tinh': 'daonguyentinh', 'tdc_thien_dao_an': 'thiendaoan',
    'tdc_manh_tien_gioi_lenh': 'manhtiengioilenh', 'tdc_linh_gioi_lenh': 'linhgioilenh', 'tdc_linh_phu': 'linhphu', 'nl_tap': 'nguyenlieu', 'nl_manh_phap_bao': 'manhphapbao', 'dan_tu_khi': 'danduoc',
    'dan_pha_gioi': 'phagioidan', 'dan_tay_tuy_ts': 'taytuydan', 'vp_ruong_than_bi': 'ruong', 'vp_ve_bicanh_db': 'vebicanhdacbiet',
}
CAT_SPEC = {
    'LINH_DUOC': (herb, 'green', {'top': 'leaf'}, '🌿'), 'KHOANG_VAT': (ore, 'cyan', {}, '⛏️'), 'YEU_THU_TAI_LIEU': (bone, 'white', {}, '🦴'), 'TRAN_DAO_TAI_LIEU': (talisman, 'red', {}, '🔯'),
    'LINH_THUC': (seedbag, 'green', {}, '🌱'), 'THIEN_DIA_CHI_BAO': (star, 'gold', {}, '🌌'), 'NGUYEN_LIEU_TRUNG_GIAN': (jar, 'blue', {}, '⚗️'), 'DAN_DUOC': (pill, 'red', {'k': 1}, '💊'),
    'TRAN_PHAP': (plate, 'jade', {'sym': 'spiral'}, '🧿'), 'VAT_PHAM_KHAC': (chest, 'gold', {}, '🎁'), 'LINH_TINH_TAI_LIEU': (orb, 'violet', {'mark': 'star'}, '🌠'),
}


# ---------------------------------------------------------------- phẩm cấp, nghề, ô trang bị
def rarity_gem(r):
    cc = rgb(*RAR[r])
    gm = P(lambda d: (polyc(d, [(32, 8), (52, 24), (44, 52), (20, 52), (12, 24)], cc), d.polygon([(32, 8), (42, 24), (22, 24)], fill=light(cc, .55)), d.line([(12, 24), (52, 24)], fill=dark(cc, .55))))
    im = compose([gm], glow=cc)
    if r >= 5: sparkle(im, 52, 10, 4); sparkle(im, 12, 12, 3)
    if r >= 7: sparkle(im, 54, 40, 3)
    return im


def prof_icon(p):
    brown = rgb(*COL['brown']); metal = rgb(*COL['metal'])
    if p == 'dan':      # đan lô
        body = P(lambda d: (d.ellipse([10, 22, 54, 58], fill=rgb(*COL['black']), outline=INK), d.rectangle([8, 20, 56, 28], fill=rgb(*COL['bronze']), outline=INK), d.line([(14, 56), (10, 62)], fill=INK, width=3), d.line([(50, 56), (54, 62)], fill=INK, width=3)))
        fl = P(lambda d: polyc(d, [(32, 4), (42, 18), (38, 24), (26, 24), (22, 18)], rgb(*COL['fire'])))
        return compose([fl, body], glow=rgb(*COL['fire']))
    if p == 'khi':      # đe + búa
        an = P(lambda d: (polyc(d, [(10, 30), (54, 30), (46, 40), (40, 40), (42, 54), (22, 54), (24, 40), (18, 40)], rgb(*COL['black'])), d.rectangle([10, 26, 54, 32], fill=rgb(*COL['grey']), outline=INK)))
        ha = P(lambda d: (d.line([(22, 6), (44, 24)], fill=brown, width=4), d.rectangle([14, 4, 28, 14], fill=metal, outline=INK)))
        im = compose([an, ha], glow=rgb(*COL['orange'])); sparkle(im, 48, 20, 4); return im
    if p == 'tran':     # bát quái
        return plate(COL['gold'], 'star')
    sp = P(lambda d: (polyc(d, [(8, 58), (56, 58), (50, 46), (14, 46)], rgb(*COL['brown'])), [d.line([(x, 46), (x, 36)], fill=rgb(*COL['green']), width=2) for x in (18, 32, 46)], [polyc(d, [(x, 38), (x - 6, 28), (x + 6, 28)], rgb(*COL['green'])) for x in (18, 32, 46)]))
    return compose([sp], glow=rgb(*COL['green']))


def slot_icon(s):
    metal = rgb(*COL['metal']); brown = rgb(*COL['brown'])
    if s == 'weapon':
        k = P(lambda d: (polyc(d, [(32, 2), (38, 14), (38, 40), (26, 40), (26, 14)], metal), d.rectangle([18, 40, 46, 46], fill=rgb(*COL['gold']), outline=INK), d.rectangle([29, 46, 35, 58], fill=brown, outline=INK)))
        return compose([k], glow=rgb(*COL['cyan']))
    if s == 'armor':
        k = P(lambda d: (polyc(d, [(8, 14), (22, 8), (42, 8), (56, 14), (50, 32), (46, 56), (18, 56), (14, 32)], rgb(*COL['black'])), d.line([(32, 12), (32, 54)], fill=rgb(*COL['grey']), width=2), d.ellipse([27, 22, 37, 32], fill=rgb(*COL['gold']))))
        return compose([k])
    if s == 'jade':
        k = P(lambda d: (d.arc([14, 4, 50, 40], 200, 340, fill=rgb(*COL['gold']), width=3), d.ellipse([16, 26, 48, 58], fill=rgb(*COL['jade']), outline=dark(rgb(*COL['jade']), .5)), d.ellipse([28, 38, 36, 46], fill=(0, 0, 0, 0), outline=dark(rgb(*COL['jade']), .5), width=2)))
        return compose([k], glow=rgb(*COL['jade']))
    if s == 'mirror':
        k = P(lambda d: (d.ellipse([10, 6, 54, 50], fill=rgb(*COL['gold']), outline=INK), d.ellipse([16, 12, 48, 44], fill=rgb(*COL['ice']), outline=dark(rgb(*COL['ice']), .5)), d.rectangle([28, 50, 36, 60], fill=brown, outline=INK), d.line([(22, 22), (30, 16)], fill=WHITE, width=2)))
        return compose([k], glow=rgb(*COL['cyan']))
    if s == 'boots':
        k = P(lambda d: (polyc(d, [(18, 8), (36, 8), (38, 34), (56, 42), (56, 54), (14, 54)], brown), d.rectangle([14, 52, 56, 58], fill=rgb(*COL['black']), outline=INK), d.rectangle([18, 8, 36, 14], fill=rgb(*COL['gold']), outline=INK)))
        return compose([k])
    if s == 'ring':
        k = P(lambda d: (d.ellipse([10, 18, 54, 58], outline=rgb(*COL['gold']), width=6), polyc(d, [(32, 4), (42, 16), (32, 26), (22, 16)], rgb(*COL['cyan']))))
        im = compose([k], glow=rgb(*COL['gold'])); sparkle(im, 50, 10, 4); return im
    k = P(lambda d: (d.pieslice([10, 10, 54, 60], 180, 360, fill=rgb(*COL['gold']), outline=INK), d.rectangle([10, 34, 54, 40], fill=rgb(*COL['bronze']), outline=INK), d.ellipse([28, 40, 36, 50], fill=rgb(*COL['gold']), outline=INK), d.rectangle([29, 4, 35, 12], fill=brown, outline=INK)))
    return compose([k], glow=rgb(*COL['gold']))


# ---------------------------------------------------------------- chạy
def build():
    os.makedirs(OUT, exist_ok=True)
    fb = json.load(open(FB, encoding='utf-8')); made = {}
    drawn = copied = 0; sheet = []
    for it in ITEMS:
        id_ = it['id']; key = it['key']; path = os.path.join(OUT, f'{key}.png')
        if id_ in LEGACY:
            src = os.path.join(OUT, f'{LEGACY[id_]}.png'); shutil.copyfile(src, path); copied += 1; fb.setdefault(key, fb.get(LEGACY[id_], '📦')); sheet.append((key, Image.open(path))); continue
        sp = spec_for(id_)
        if not sp: raise SystemExit(f'thiếu cấu hình vẽ cho {id_}')
        fn, col, kw, uni = sp; im = fn(COL[col], **kw); save(im, key, OUT); drawn += 1; fb[key] = uni; sheet.append((key, Image.open(path)))
    for c, (fn, col, kw, uni) in CAT_SPEC.items():
        save(fn(COL[col], **kw), f'c17_{c}', OUT); fb[f'c17_{c}'] = uni; drawn += 1; sheet.append((f'c17_{c}', Image.open(os.path.join(OUT, f'c17_{c}.png'))))
    for r, uni in zip(range(1, 8), ['⚪', '🟢', '🔵', '🟣', '🟡', '🟠', '🔴']):
        save(rarity_gem(r), f'r17_{r}', OUT); fb[f'r17_{r}'] = uni; drawn += 1; sheet.append((f'r17_{r}', Image.open(os.path.join(OUT, f'r17_{r}.png'))))
    for p, uni in {'dan': '⚗️', 'khi': '⚒️', 'tran': '🔯', 'thuc': '🌱'}.items():
        save(prof_icon(p), f'p17_{p}', OUT); fb[f'p17_{p}'] = uni; drawn += 1; sheet.append((f'p17_{p}', Image.open(os.path.join(OUT, f'p17_{p}.png'))))
    for s, uni in {'weapon': '⚔️', 'armor': '🛡️', 'jade': '📿', 'mirror': '🪞', 'boots': '👢', 'ring': '💍', 'bell': '🔔'}.items():
        save(slot_icon(s), f's17_{s}', OUT); fb[f's17_{s}'] = uni; drawn += 1; sheet.append((f's17_{s}', Image.open(os.path.join(OUT, f's17_{s}.png'))))
    json.dump(fb, open(FB, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); open(FB, 'a').write('\n')
    print(f'đã vẽ {drawn} · sao chép emoji cũ {copied} · tổng {drawn + copied}')
    if '--sheet' in sys.argv:
        out = sys.argv[sys.argv.index('--sheet') + 1]; cols = 14; cell = 96; rows = (len(sheet) + cols - 1) // cols
        im = Image.new('RGBA', (cols * cell, rows * cell), (54, 57, 63, 255))
        for i, (_, e) in enumerate(sheet): im.alpha_composite(e.resize((cell - 8, cell - 8), Image.NEAREST), ((i % cols) * cell + 4, (i // cols) * cell + 4))
        im.convert('RGB').save(out); print('contact sheet →', out)


if __name__ == '__main__':
    build()
