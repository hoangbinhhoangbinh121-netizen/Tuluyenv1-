#!/usr/bin/env python3
"""
make_pixel_emoji_v19.py — vẽ emoji pixel MỚI cho V19.x (cùng phong cách bộ hiện có: lưới 64x64 phóng x2 → PNG 128x128 nền trong suốt,
viền nâu đậm, bevel sáng/tối, quầng sáng nhẹ, tia sáng; đọc rõ ở 32x32, không chữ).

Chỉ GHI FILE MỚI trong assets/emoji (khóa bên dưới) và THÊM emoji Unicode dự phòng vào src/data/emoji_fallback.json — KHÔNG đụng/ghi đè emoji cũ
(khóa đã tồn tại bị bỏ qua, trừ khi --force).   Chạy:  python3 scripts/make_pixel_emoji_v19.py [--sheet contact_sheet.png] [--force]

Nhóm:  bicanh19 / chungdao / dekiep / dean / dehieu / benmenh / dedao / debinh / sukien19 / linhngo19 / thucngo19 / doi19      (chức năng)
       mob_thuong / mob_tinhanh / mob_mini / mob_canh / boss19                                                           (loại kẻ địch)
       dd_* (6 Đế Đạo) · db_* (5 Đế Binh) · ev_* (4 sự kiện) · bc19_00..18 (19 Bí Cảnh Tiên Giới)
"""
import json, math, os, sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_pixel_emoji_v12_streak import G, canvas, part, compose as _compose, sparkle, save  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'assets', 'emoji'))
FB = os.path.normpath(os.path.join(HERE, '..', 'src', 'data', 'emoji_fallback.json'))


def rgb(r, g, b): return (r, g, b, 255)
def dark(c, f=.62): return (int(c[0] * f), int(c[1] * f), int(c[2] * f), 255)
def light(c, f=.5): return (int(c[0] + (255 - c[0]) * f), int(c[1] + (255 - c[1]) * f), int(c[2] + (255 - c[2]) * f), 255)
def mix(a, b, t): return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3)) + (255,)


GOLD = rgb(240, 190, 60); GOLD_D = rgb(176, 112, 30); GOLD_L = rgb(255, 232, 130)
JADE = rgb(70, 200, 150); CYAN = rgb(80, 220, 230); BLUE = rgb(80, 150, 240); VIOLET = rgb(150, 100, 235); PURPLE = rgb(170, 100, 220)
PINK = rgb(245, 140, 190); WHITE = rgb(246, 246, 250); SILVER = rgb(205, 212, 225); STEEL = rgb(150, 162, 182)
RED = rgb(225, 70, 60); RED_D = rgb(140, 36, 40); NAVY = rgb(36, 30, 78); INK = rgb(46, 34, 60); BROWN = rgb(120, 78, 44)
GREEN = rgb(84, 180, 90); LIME = rgb(160, 225, 90); ORANGE = rgb(240, 130, 40); STONE = rgb(138, 146, 162); STONE_D = rgb(88, 94, 112)
TEAL = rgb(50, 170, 170); BRONZE = rgb(190, 130, 60); CREAM = rgb(246, 232, 190)


def compose(parts, glow=None, sparks=()):
    im = _compose(parts, glow=tuple(glow[:3]) if glow else None)
    for x, y, r in sparks: sparkle(im, x, y, r)
    return im


def P(fn, la=80, da=80): return part(fn, la, da)
def poly(d, pts, c): d.polygon(pts, fill=c)
def circ(d, cx, cy, r, c): d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c)
def rect(d, x0, y0, x1, y1, c): d.rectangle([x0, y0, x1, y1], fill=c)
def gem(d, cx, cy, r, c): poly(d, [(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], c)
def star4(d, cx, cy, r, c): poly(d, [(cx, cy - r), (cx + r // 3, cy - r // 3), (cx + r, cy), (cx + r // 3, cy + r // 3), (cx, cy + r), (cx - r // 3, cy + r // 3), (cx - r, cy), (cx - r // 3, cy - r // 3)], c)
def ring(d, cx, cy, r, w, c): d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=c, width=w)
def bolt(d, x, y, s, c): poly(d, [(x + 6 * s, y), (x + 1 * s, y + 9 * s), (x + 5 * s, y + 9 * s), (x, y + 20 * s), (x + 11 * s, y + 6 * s), (x + 6 * s, y + 6 * s), (x + 10 * s, y)], c)


# ============================================================ CHỨC NĂNG
def bicanh19():
    def stone(d):
        d.pieslice([8, 6, 55, 46], 180, 360, fill=STONE); rect(d, 8, 26, 55, 56, STONE)
        rect(d, 5, 54, 58, 59, STONE_D); rect(d, 13, 18, 16, 22, STONE_D); rect(d, 47, 18, 50, 22, STONE_D)
    def hole(d):
        d.pieslice([17, 17, 46, 47], 180, 360, fill=NAVY); rect(d, 17, 32, 46, 54, NAVY)
    def swirl(d):
        for r, c in [(11, VIOLET), (8, BLUE), (5, CYAN), (2, WHITE)]: ring(d, 31, 40, r, 3, c)
        d.pieslice([19, 19, 44, 45], 180, 360, outline=mix(VIOLET, NAVY, .4), width=1)
    def rune(d):
        for x in (21, 24, 38, 41): rect(d, x, 20, x + 1, 22, GOLD_L)
        gem(d, 31, 13, 4, GOLD); gem(d, 31, 13, 2, WHITE)
    return compose([P(stone), P(hole, 10, 40), P(swirl, 50, 40), P(rune)], glow=VIOLET[:3], sparks=[(8, 10, 3), (56, 14, 2), (31, 36, 3)])


def chungdao():
    def crown(d):
        poly(d, [(14, 52), (12, 36), (23, 44), (32, 32), (41, 44), (52, 36), (50, 52)], GOLD); rect(d, 14, 52, 50, 57, GOLD_D)
        for x, c in [(32, RED), (20, CYAN), (44, CYAN)]: gem(d, x, 49, 3, c)
    def cloud(d):
        for cx, cy, r in [(18, 10, 8), (30, 7, 9), (43, 10, 8), (24, 14, 7), (38, 14, 7)]: circ(d, cx, cy, r, mix(INK, STEEL, .45))
    def zap2(d): poly(d, [(33, 10), (24, 28), (31, 28), (26, 44), (42, 24), (34, 24), (40, 10)], rgb(255, 236, 110))
    return compose([P(crown), P(cloud, 40, 90), P(zap2, 100, 40)], glow=(255, 230, 120), sparks=[(10, 20, 3), (56, 24, 3), (9, 56, 2)])


def dekiep():
    def cloud(d):
        for cx, cy, r in [(14, 14, 9), (27, 9, 10), (42, 11, 10), (51, 17, 7), (22, 19, 8), (38, 19, 8)]: circ(d, cx, cy, r, mix(INK, PURPLE, .35))
    def b1(d): poly(d, [(30, 22), (20, 42), (29, 42), (23, 60), (42, 34), (33, 34), (40, 22)], WHITE)
    def b2(d): poly(d, [(46, 24), (41, 36), (46, 36), (42, 46), (53, 32), (48, 32), (52, 24)], rgb(190, 140, 255))
    def b3(d): poly(d, [(15, 26), (11, 36), (15, 36), (12, 45), (21, 33), (17, 33), (20, 26)], rgb(190, 140, 255))
    return compose([P(cloud, 50, 90), P(b3), P(b2), P(b1, 110, 30)], glow=PURPLE[:3], sparks=[(55, 8, 2), (7, 40, 3)])


def dean():
    def base(d): rect(d, 10, 36, 53, 56, RED); rect(d, 10, 52, 53, 56, RED_D)
    def top(d):
        rect(d, 16, 30, 47, 38, GOLD); poly(d, [(32, 6), (39, 12), (39, 18), (36, 22), (28, 22), (25, 18), (25, 12)], GOLD_L)
        rect(d, 27, 22, 36, 30, GOLD)
        for x in (28, 33): rect(d, x, 12, x + 1, 17, GOLD_D)
    def glyph(d):
        rect(d, 18, 41, 45, 42, GOLD_L); rect(d, 18, 47, 45, 48, GOLD_L); rect(d, 31, 40, 32, 50, GOLD_L); rect(d, 24, 44, 39, 45, GOLD_L)
    return compose([P(base), P(top), P(glyph, 30, 20)], glow=(255, 200, 80), sparks=[(8, 14, 3), (56, 18, 3), (54, 58, 2)])


def dehieu():
    def bar(d): rect(d, 6, 10, 57, 14, GOLD); rect(d, 6, 48, 57, 52, GOLD); circ(d, 6, 12, 4, GOLD_D); circ(d, 57, 12, 4, GOLD_D); circ(d, 6, 50, 4, GOLD_D); circ(d, 57, 50, 4, GOLD_D)
    def board(d): rect(d, 10, 14, 53, 48, RED_D); rect(d, 12, 16, 51, 46, RED)
    def crest(d):
        poly(d, [(18, 36), (17, 24), (24, 30), (32, 20), (40, 30), (47, 24), (46, 36)], GOLD_L); rect(d, 18, 36, 46, 39, GOLD)
        gem(d, 32, 31, 3, CYAN)
    def tassel(d): rect(d, 31, 52, 32, 58, GOLD_D); poly(d, [(28, 58), (36, 58), (32, 62)], RED)
    return compose([P(board), P(bar), P(crest), P(tassel)], glow=(255, 190, 80), sparks=[(5, 30, 2), (58, 32, 2), (32, 5, 3)])


def benmenh():
    def book(d):
        poly(d, [(8, 40), (31, 46), (31, 58), (8, 52)], BLUE); poly(d, [(55, 40), (32, 46), (32, 58), (55, 52)], mix(BLUE, WHITE, .2))
        poly(d, [(10, 38), (31, 44), (31, 47), (10, 41)], CREAM); poly(d, [(53, 38), (32, 44), (32, 47), (53, 41)], CREAM)
    def orb(d):
        circ(d, 32, 24, 14, CYAN); circ(d, 32, 24, 10, rgb(150, 245, 250)); circ(d, 28, 20, 4, WHITE)
        ring(d, 32, 24, 17, 1, GOLD_L)
    def rays(d):
        for a in range(0, 360, 45):
            x = 32 + math.cos(math.radians(a)) * 21; y = 24 + math.sin(math.radians(a)) * 21
            d.line([(32 + math.cos(math.radians(a)) * 18, 24 + math.sin(math.radians(a)) * 18), (x, y)], fill=GOLD_L, width=1)
    return compose([P(book), P(orb, 110, 40), P(rays, 0, 0)], glow=CYAN[:3], sparks=[(8, 10, 3), (56, 8, 2)])


def taiji(d, cx, cy, r, a=WHITE, b=INK):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=a); d.pieslice([cx - r, cy - r, cx + r, cy + r], 270, 90, fill=b)
    circ(d, cx, cy - r // 2, r // 2, a); circ(d, cx, cy + r // 2, r // 2, b); circ(d, cx, cy - r // 2, max(1, r // 6), b); circ(d, cx, cy + r // 2, max(1, r // 6), a)


def dedao():
    def ringp(d): circ(d, 32, 38, 21, GOLD); circ(d, 32, 38, 18, GOLD_D)
    def tj(d): taiji(d, 32, 38, 16)
    def crown(d):
        poly(d, [(20, 18), (19, 7), (26, 12), (32, 4), (38, 12), (45, 7), (44, 18)], GOLD_L); rect(d, 20, 18, 44, 20, GOLD)
        gem(d, 32, 14, 2, RED)
    return compose([P(ringp), P(tj, 40, 40), P(crown)], glow=(255, 210, 90), sparks=[(6, 28, 3), (58, 30, 3), (8, 58, 2)])


def debinh():
    def blade(d): poly(d, [(32, 3), (37, 10), (37, 40), (32, 44), (27, 40), (27, 10)], SILVER); rect(d, 31, 6, 32, 40, WHITE)
    def guard(d): rect(d, 17, 40, 46, 44, GOLD); gem(d, 32, 42, 4, RED); poly(d, [(14, 42), (18, 38), (18, 46)], GOLD_D); poly(d, [(49, 42), (45, 38), (45, 46)], GOLD_D)
    def hilt(d): rect(d, 30, 44, 33, 56, BROWN); circ(d, 32, 58, 3, GOLD)
    def halo(d): ring(d, 32, 24, 22, 2, GOLD_L)
    return compose([P(halo, 0, 0), P(blade, 120, 40), P(guard), P(hilt)], glow=CYAN[:3], sparks=[(10, 12, 3), (54, 10, 3), (50, 52, 2)])


def sukien19():
    def tail(d):
        poly(d, [(8, 56), (20, 36), (30, 26), (34, 32), (24, 42)], mix(CYAN, WHITE, .3)); poly(d, [(14, 58), (24, 44), (30, 38), (32, 41), (22, 52)], BLUE)
    def core(d): circ(d, 42, 22, 14, GOLD); circ(d, 42, 22, 10, GOLD_L); circ(d, 39, 19, 4, WHITE)
    def rays(d):
        for a in range(0, 360, 30):
            d.line([(42 + math.cos(math.radians(a)) * 16, 22 + math.sin(math.radians(a)) * 16), (42 + math.cos(math.radians(a)) * 21, 22 + math.sin(math.radians(a)) * 21)], fill=GOLD_L, width=1)
    return compose([P(tail), P(core, 110, 50), P(rays, 0, 0)], glow=(255, 230, 130), sparks=[(10, 14, 3), (54, 52, 3), (18, 52, 2)])


def linhngo():
    def petals(d):
        for pts, c in [([(32, 26), (20, 40), (32, 54)], PINK), ([(32, 26), (44, 40), (32, 54)], PINK), ([(32, 20), (26, 38), (32, 54), (38, 38)], light(PINK, .4)), ([(32, 30), (12, 38), (24, 52)], mix(PINK, PURPLE, .4)), ([(32, 30), (52, 38), (40, 52)], mix(PINK, PURPLE, .4))]: poly(d, pts, c)
    def eye(d):
        poly(d, [(18, 14), (32, 6), (46, 14), (32, 22)], WHITE); circ(d, 32, 14, 5, CYAN); circ(d, 32, 14, 2, INK); circ(d, 30, 12, 1, WHITE)
    def pad(d): d.ellipse([10, 54, 54, 62], fill=mix(GREEN, INK, .3))
    return compose([P(pad), P(petals), P(eye, 110, 40)], glow=PINK[:3], sparks=[(8, 28, 3), (56, 26, 3), (32, 2, 2)])


def thucngo19():
    def sun(d):
        for a in range(0, 360, 30):
            r2 = 29 if a % 60 == 0 else 24
            d.line([(32 + math.cos(math.radians(a)) * 12, 32 + math.sin(math.radians(a)) * 12), (32 + math.cos(math.radians(a)) * r2, 32 + math.sin(math.radians(a)) * r2)], fill=GOLD, width=2)
    def disc(d): circ(d, 32, 32, 14, GOLD); circ(d, 32, 32, 10, GOLD_L)
    def eye(d): poly(d, [(22, 32), (32, 25), (42, 32), (32, 39)], WHITE); circ(d, 32, 32, 4, PURPLE); circ(d, 32, 32, 2, INK)
    return compose([P(sun, 0, 0), P(disc, 100, 50), P(eye, 110, 40)], glow=(255, 210, 90), sparks=[(6, 8, 3), (58, 56, 3)])


def doi19():
    def man(cx, top, w, body, head):
        def f(d):
            circ(d, cx, top + 5, 5, head); d.pieslice([cx - w, top + 12, cx + w, top + 12 + 2 * w], 180, 360, fill=body); rect(d, cx - w, top + 12 + w, cx + w, top + 30, body)
            rect(d, cx - 1, top + 14, cx, top + 30, dark(body, .75))
        return P(f)
    return compose([man(15, 22, 10, BLUE, CREAM), man(49, 22, 10, GREEN, CREAM), man(32, 12, 12, RED, CREAM)], glow=GOLD[:3], sparks=[(32, 3, 3), (6, 14, 2), (58, 12, 2)])


# ============================================================ LOẠI KẺ ĐỊCH
def mob_thuong():
    def body(d): d.pieslice([8, 16, 55, 62], 180, 360, fill=LIME); rect(d, 8, 40, 55, 52, LIME); d.ellipse([8, 44, 55, 58], fill=LIME)
    def face(d):
        circ(d, 24, 36, 5, WHITE); circ(d, 40, 36, 5, WHITE); circ(d, 25, 37, 2, INK); circ(d, 41, 37, 2, INK)
        d.arc([24, 42, 40, 52], 20, 160, fill=INK, width=2)
    def shine(d): circ(d, 18, 26, 3, light(LIME, .7)); circ(d, 23, 22, 2, light(LIME, .7))
    return compose([P(body), P(shine, 0, 0), P(face, 0, 0)], glow=LIME[:3], sparks=[(8, 12, 2), (56, 14, 2)])


def mob_tinhanh():
    def horns(d): poly(d, [(14, 28), (6, 8), (22, 20)], CREAM); poly(d, [(50, 28), (58, 8), (42, 20)], CREAM)
    def head(d): poly(d, [(12, 24), (32, 16), (52, 24), (54, 44), (42, 58), (22, 58), (10, 44)], rgb(110, 90, 130))
    def face(d):
        poly(d, [(16, 32), (28, 36), (16, 40)], RED); poly(d, [(48, 32), (36, 36), (48, 40)], RED)
        poly(d, [(22, 48), (26, 56), (30, 48), (34, 48), (38, 56), (42, 48)], WHITE); rect(d, 22, 47, 42, 49, INK)
        circ(d, 32, 42, 1, INK)
    return compose([P(horns), P(head), P(face, 0, 0)], glow=RED[:3], sparks=[(6, 40, 2), (58, 40, 2), (32, 6, 2)])


def mob_mini():
    def skull(d): circ(d, 32, 28, 17, WHITE); rect(d, 22, 38, 42, 52, WHITE); rect(d, 26, 52, 38, 55, WHITE)
    def eyes(d): circ(d, 25, 30, 5, INK); circ(d, 39, 30, 5, INK); circ(d, 25, 30, 2, RED); circ(d, 39, 30, 2, RED); poly(d, [(30, 38), (34, 38), (32, 42)], INK)
    def teeth(d):
        for x in (26, 30, 34, 38): rect(d, x, 47, x, 54, INK)
    def crown(d): poly(d, [(18, 14), (17, 3), (24, 8), (32, 1), (40, 8), (47, 3), (46, 14)], GOLD)
    return compose([P(skull), P(eyes, 0, 0), P(teeth, 0, 0), P(crown)], glow=(255, 220, 120), sparks=[(8, 38, 2), (56, 40, 2)])


def mob_canh():
    def helm(d): d.pieslice([14, 8, 50, 44], 180, 360, fill=STEEL); rect(d, 14, 26, 49, 52, STEEL); poly(d, [(14, 52), (24, 58), (40, 58), (49, 52)], STONE_D)
    def visor(d): rect(d, 18, 30, 45, 36, INK); rect(d, 30, 14, 33, 52, STONE_D); rect(d, 20, 31, 28, 33, CYAN); rect(d, 35, 31, 43, 33, CYAN)
    def plume(d): poly(d, [(32, 2), (38, 8), (36, 16), (28, 16), (26, 8)], RED)
    def spear(d): rect(d, 55, 8, 56, 56, BROWN); poly(d, [(55, 2), (59, 10), (52, 10)], SILVER)
    return compose([P(plume), P(helm), P(visor, 0, 0), P(spear)], glow=BLUE[:3], sparks=[(6, 12, 2), (8, 50, 2)])


def boss19():
    def horns(d): poly(d, [(12, 30), (3, 4), (24, 20)], GOLD); poly(d, [(52, 30), (61, 4), (40, 20)], GOLD)
    def head(d): poly(d, [(10, 24), (32, 14), (54, 24), (56, 44), (44, 60), (20, 60), (8, 44)], rgb(86, 40, 100))
    def face(d):
        poly(d, [(14, 30), (28, 36), (14, 42)], rgb(255, 90, 60)); poly(d, [(50, 30), (36, 36), (50, 42)], rgb(255, 90, 60))
        poly(d, [(14, 33), (24, 36), (14, 39)], GOLD_L); poly(d, [(50, 33), (40, 36), (50, 39)], GOLD_L)
        rect(d, 20, 47, 44, 49, INK)
        for x in (22, 28, 34, 40): poly(d, [(x, 49), (x + 3, 49), (x + 1, 56)], WHITE)
    def jewel(d): gem(d, 32, 22, 5, RED); gem(d, 32, 22, 2, WHITE)
    def flame(d):
        poly(d, [(26, 12), (28, 3), (32, 9), (36, 3), (38, 12)], ORANGE)
    return compose([P(flame), P(horns), P(head), P(face, 0, 0), P(jewel)], glow=RED[:3], sparks=[(5, 50, 3), (58, 52, 3), (32, 1, 2)])


# ============================================================ 6 ĐẾ ĐẠO
def dd_sat():
    def b1(d): poly(d, [(8, 6), (14, 6), (56, 48), (50, 54)], SILVER); poly(d, [(10, 8), (12, 8), (54, 50), (52, 52)], WHITE)
    def b2(d): poly(d, [(56, 6), (50, 6), (8, 48), (14, 54)], rgb(230, 150, 150)); poly(d, [(54, 8), (52, 8), (10, 50), (12, 52)], WHITE)
    def hilts(d): rect(d, 4, 50, 14, 54, GOLD_D); rect(d, 8, 54, 10, 60, BROWN); rect(d, 50, 50, 60, 54, GOLD_D); rect(d, 54, 54, 56, 60, BROWN)
    def blood(d): circ(d, 32, 28, 6, RED); circ(d, 32, 28, 3, RED_D)
    return compose([P(b1), P(b2), P(hilts), P(blood, 90, 60)], glow=RED[:3], sparks=[(32, 8, 3), (8, 28, 2), (56, 28, 2)])


def dd_sinh():
    def trunk(d): rect(d, 29, 34, 34, 58, BROWN); poly(d, [(29, 50), (20, 58), (29, 56)], BROWN); poly(d, [(34, 50), (43, 58), (34, 56)], BROWN)
    def leaves(d):
        for cx, cy, r, c in [(32, 18, 14, GREEN), (18, 28, 10, LIME), (46, 28, 10, LIME), (32, 30, 9, GREEN)]: circ(d, cx, cy, r, c)
    def heart(d): poly(d, [(32, 34), (24, 26), (24, 20), (29, 18), (32, 22), (35, 18), (40, 20), (40, 26)], rgb(255, 120, 150))
    return compose([P(trunk), P(leaves, 120, 50), P(heart)], glow=GREEN[:3], sparks=[(7, 12, 3), (57, 12, 3), (8, 52, 2)])


def dd_thoikhong():
    def glass(d):
        rect(d, 14, 4, 49, 9, GOLD); rect(d, 14, 54, 49, 59, GOLD)
        poly(d, [(18, 10), (45, 10), (35, 30), (28, 30)], rgb(190, 200, 255)); poly(d, [(28, 33), (35, 33), (45, 53), (18, 53)], rgb(190, 200, 255))
    def sand(d): poly(d, [(24, 14), (39, 14), (34, 24), (29, 24)], VIOLET); poly(d, [(32, 40), (41, 53), (23, 53)], VIOLET); rect(d, 31, 28, 32, 42, PURPLE)
    def spiral(d):
        for r, c in [(26, CYAN), (22, BLUE)]: d.arc([32 - r, 32 - r, 32 + r, 32 + r], 200, 330, fill=c, width=2); d.arc([32 - r, 32 - r, 32 + r, 32 + r], 20, 150, fill=c, width=2)
    return compose([P(spiral, 0, 0), P(glass, 110, 50), P(sand)], glow=VIOLET[:3], sparks=[(7, 22, 3), (57, 40, 3)])


def dd_luanhoi():
    def wheel(d): ring(d, 32, 32, 22, 6, mix(PURPLE, WHITE, .2)); ring(d, 32, 32, 12, 3, GOLD); circ(d, 32, 32, 5, WHITE)
    def spokes(d):
        for a in range(0, 360, 60): d.line([(32, 32), (32 + math.cos(math.radians(a)) * 21, 32 + math.sin(math.radians(a)) * 21)], fill=GOLD, width=2)
    def arrows(d):
        poly(d, [(46, 8), (56, 12), (48, 18)], CYAN); d.arc([6, 6, 58, 58], 280, 350, fill=CYAN, width=3)
        poly(d, [(18, 56), (8, 52), (16, 46)], PINK); d.arc([6, 6, 58, 58], 100, 170, fill=PINK, width=3)
    return compose([P(spokes, 0, 0), P(wheel), P(arrows, 60, 60)], glow=PURPLE[:3], sparks=[(8, 12, 3), (56, 54, 3)])


def dd_hondon():
    def vortex(d):
        for r, c in [(28, NAVY), (23, rgb(80, 50, 150)), (18, rgb(60, 110, 200)), (13, rgb(200, 90, 180)), (8, rgb(255, 190, 90)), (4, WHITE)]: circ(d, 32, 32, r, c)
    def arms(d):
        for a0, c in [(0, CYAN), (120, PINK), (240, GOLD_L)]: d.arc([8, 8, 56, 56], a0, a0 + 100, fill=c, width=3); d.arc([16, 16, 48, 48], a0 + 40, a0 + 140, fill=c, width=2)
    return compose([P(vortex, 40, 60), P(arms, 0, 0)], glow=VIOLET[:3], sparks=[(6, 8, 3), (58, 12, 3), (56, 56, 2), (8, 56, 2)])


def dd_huydiet():
    def blast(d):
        pts = []
        for i in range(16):
            a = math.radians(i * 22.5); r = 28 if i % 2 == 0 else 15
            pts.append((32 + math.cos(a) * r, 32 + math.sin(a) * r))
        poly(d, pts, ORANGE)
    def mid(d):
        pts = []
        for i in range(16):
            a = math.radians(i * 22.5 + 11); r = 20 if i % 2 == 0 else 11
            pts.append((32 + math.cos(a) * r, 32 + math.sin(a) * r))
        poly(d, pts, rgb(255, 210, 70))
    def skull(d): circ(d, 32, 30, 9, INK); rect(d, 26, 34, 38, 42, INK); circ(d, 28, 30, 3, RED); circ(d, 36, 30, 3, RED); poly(d, [(31, 36), (33, 36), (32, 38)], RED)
    return compose([P(blast), P(mid), P(skull, 40, 40)], glow=RED[:3], sparks=[(6, 6, 3), (58, 58, 3)])


# ============================================================ 5 ĐẾ BINH
def db_kiem():
    def blade(d): poly(d, [(32, 2), (38, 10), (38, 42), (32, 47), (26, 42), (26, 10)], rgb(210, 235, 255)); rect(d, 31, 5, 32, 42, WHITE); rect(d, 36, 12, 37, 40, rgb(120, 190, 240))
    def rune(d):
        for y in (14, 20, 26, 32): rect(d, 29, y, 34, y + 1, CYAN)
    def guard(d): poly(d, [(14, 44), (32, 40), (50, 44), (46, 49), (32, 46), (18, 49)], GOLD); gem(d, 32, 44, 3, RED)
    def hilt(d): rect(d, 30, 47, 33, 57, BROWN); circ(d, 32, 59, 3, GOLD)
    return compose([P(blade, 120, 40), P(rune, 0, 0), P(guard), P(hilt)], glow=CYAN[:3], sparks=[(10, 12, 3), (54, 16, 3), (50, 54, 2)])


def db_chung():
    def hang(d): rect(d, 6, 4, 57, 9, BROWN); rect(d, 29, 9, 34, 16, GOLD_D)
    def bell(d): poly(d, [(22, 16), (42, 16), (47, 34), (52, 50), (12, 50), (17, 34)], BRONZE); d.ellipse([12, 46, 52, 56], fill=BRONZE)
    def bands(d): rect(d, 19, 28, 45, 31, GOLD); rect(d, 15, 40, 49, 43, GOLD)
    def hondon(d): d.ellipse([22, 33, 42, 49], fill=mix(NAVY, PURPLE, .3)); circ(d, 32, 41, 4, CYAN); ring(d, 32, 41, 7, 1, PINK)
    def clap(d): circ(d, 32, 58, 3, GOLD_D)
    return compose([P(hang), P(bell, 120, 60), P(bands), P(hondon, 0, 20), P(clap)], glow=(255, 190, 90), sparks=[(8, 24, 3), (56, 30, 3)])


def db_ban():
    def disc(d): circ(d, 32, 32, 26, STONE_D); circ(d, 32, 32, 23, STONE)
    def inner(d): circ(d, 32, 32, 17, NAVY); taiji(d, 32, 32, 12, WHITE, NAVY)
    def marks(d):
        for a in range(0, 360, 30):
            x = 32 + math.cos(math.radians(a)) * 21; y = 32 + math.sin(math.radians(a)) * 21; circ(d, int(x), int(y), 1, GOLD_L)
    def ringg(d): ring(d, 32, 32, 26, 2, GOLD)
    return compose([P(disc), P(ringg, 60, 60), P(inner, 40, 60), P(marks, 0, 0)], glow=PURPLE[:3], sparks=[(6, 8, 3), (58, 56, 3)])


def db_an():
    def base(d): poly(d, [(12, 32), (52, 32), (56, 54), (8, 54)], rgb(40, 90, 190)); rect(d, 8, 54, 56, 58, NAVY)
    def top(d): poly(d, [(32, 4), (46, 14), (50, 32), (14, 32), (18, 14)], GOLD); rect(d, 12, 30, 52, 35, GOLD_D)
    def eye(d): poly(d, [(18, 20), (32, 11), (46, 20), (32, 29)], WHITE); circ(d, 32, 20, 6, CYAN); circ(d, 32, 20, 3, INK); circ(d, 30, 18, 1, WHITE)
    def glyph(d):
        rect(d, 16, 42, 47, 43, GOLD_L); rect(d, 22, 47, 41, 48, GOLD_L); rect(d, 31, 39, 32, 52, GOLD_L)
    return compose([P(base), P(top), P(eye, 90, 40), P(glyph, 0, 0)], glow=BLUE[:3], sparks=[(6, 14, 3), (58, 16, 3)])


def db_thap():
    def tier(d, y, w, h, c, roof):
        def f(dd):
            rect(dd, 32 - w // 2, y, 32 + w // 2, y + h, c); poly(dd, [(32 - w // 2 - 4, y), (32, y - 5), (32 + w // 2 + 4, y), (32 + w // 2, y + 3), (32 - w // 2, y + 3)], roof)
            rect(dd, 30, y + 2, 33, y + h, INK)
        return P(f)
    parts = [tier(None, 46, 34, 10, rgb(150, 120, 190), GOLD), tier(None, 36, 28, 8, rgb(130, 100, 180), GOLD), tier(None, 26, 22, 8, rgb(150, 120, 190), GOLD), tier(None, 16, 16, 8, rgb(130, 100, 180), GOLD), tier(None, 8, 10, 6, rgb(150, 120, 190), GOLD)]
    def spire(d): rect(d, 31, 0, 32, 5, GOLD_L); gem(d, 31, 2, 2, CYAN)
    def base(d): rect(d, 6, 58, 57, 61, STONE_D)
    return compose([P(base)] + parts[::-1] + [P(spire)], glow=(255, 220, 120), sparks=[(8, 18, 3), (56, 30, 3), (10, 50, 2)])


# ============================================================ 4 SỰ KIỆN THẾ GIỚI
def ev_dibien():
    def sky(d): d.pieslice([4, 6, 59, 62], 180, 360, fill=NAVY); rect(d, 4, 34, 59, 40, NAVY)
    def aur(d):
        poly(d, [(10, 34), (14, 22), (22, 12), (26, 30)], JADE); poly(d, [(24, 34), (28, 20), (36, 10), (40, 30)], CYAN); poly(d, [(38, 34), (44, 18), (52, 20), (50, 34)], VIOLET)
    def swirl(d): ring(d, 32, 44, 12, 3, GOLD_L); ring(d, 32, 44, 7, 2, WHITE); circ(d, 32, 44, 2, WHITE)
    def ground(d): d.ellipse([4, 52, 59, 62], fill=mix(GREEN, INK, .4))
    return compose([P(sky, 30, 60), P(aur, 80, 20), P(ground), P(swirl, 60, 40)], glow=CYAN[:3], sparks=[(10, 10, 3), (54, 8, 2), (30, 12, 2)])


def ev_dicanh():
    def pillars(d): rect(d, 8, 22, 17, 56, GOLD); rect(d, 46, 22, 55, 56, GOLD); rect(d, 5, 54, 58, 59, GOLD_D); rect(d, 8, 22, 17, 25, GOLD_L); rect(d, 46, 22, 55, 25, GOLD_L)
    def lintel(d): rect(d, 5, 14, 58, 21, GOLD_D); poly(d, [(2, 14), (32, 6), (61, 14)], RED_D)
    def door(d): rect(d, 18, 24, 45, 55, rgb(255, 245, 200)); rect(d, 22, 28, 41, 55, WHITE)
    def crown(d): poly(d, [(22, 46), (21, 34), (27, 40), (32, 32), (37, 40), (43, 34), (42, 46)], GOLD); rect(d, 22, 46, 42, 49, GOLD_D); gem(d, 32, 44, 2, RED)
    return compose([P(door, 120, 20), P(pillars), P(lintel), P(crown)], glow=(255, 225, 120), sparks=[(6, 8, 3), (58, 8, 3), (32, 2, 2)])


def ev_truyenthua():
    def tab(d): rect(d, 14, 6, 49, 56, rgb(120, 140, 130)); rect(d, 17, 9, 46, 53, rgb(160, 185, 170))
    def top(d): rect(d, 10, 3, 53, 8, GOLD); rect(d, 10, 54, 53, 59, GOLD)
    def rune(d):
        circ(d, 32, 30, 10, NAVY); ring(d, 32, 30, 10, 1, CYAN); star4(d, 32, 30, 7, GOLD_L)
        for y in (46, 50): rect(d, 22, y, 41, y, INK)
    def hand(d): poly(d, [(26, 62), (22, 52), (28, 50), (32, 54), (36, 50), (42, 52), (38, 62)], mix(CREAM, GOLD, .3))
    return compose([P(tab), P(top), P(rune, 60, 40), P(hand, 40, 70)], glow=JADE[:3], sparks=[(6, 28, 3), (58, 24, 3), (8, 8, 2)])


def ev_sieuthoat():
    def void(d): d.ellipse([4, 4, 59, 59], fill=INK)
    def stars(d):
        for x, y in [(10, 20), (52, 14), (46, 50), (14, 48), (30, 8), (56, 36), (8, 34)]: rect(d, x, y, x + 1, y + 1, WHITE)
    def door(d): d.pieslice([20, 10, 43, 40], 180, 360, fill=WHITE); rect(d, 20, 25, 43, 54, WHITE); d.pieslice([24, 15, 39, 36], 180, 360, fill=rgb(255, 250, 220)); rect(d, 24, 26, 39, 54, rgb(255, 250, 220))
    def frame(d): d.arc([18, 8, 45, 42], 180, 360, fill=GOLD, width=2); rect(d, 18, 25, 19, 56, GOLD); rect(d, 44, 25, 45, 56, GOLD); rect(d, 14, 56, 49, 58, GOLD_D)
    def beam(d): poly(d, [(26, 56), (37, 56), (50, 62), (13, 62)], rgb(255, 250, 200))
    return compose([P(void, 20, 60), P(stars, 0, 0), P(door, 100, 30), P(frame), P(beam, 40, 10)], glow=(255, 250, 200), sparks=[(8, 10, 3), (56, 50, 3)])


# ============================================================ 19 BÍ CẢNH TIÊN GIỚI  (mỗi bí cảnh một cảnh vật + màu chủ đạo theo tầng cảnh giới)
def scene_base(c1, c2):
    def f(d): d.pieslice([4, 4, 59, 60], 180, 360, fill=c1); d.ellipse([4, 30, 59, 60], fill=c2); rect(d, 4, 32, 59, 44, c1)
    return P(f, 60, 80)


def bc_hill(d, c, y=44, w=26, h=22): poly(d, [(32 - w, y + h // 2), (32, y - h // 2), (32 + w, y + h // 2)], c)
def bc_gate(d, c, x0, x1, y0, y1): rect(d, x0, y0, x0 + 4, y1, c); rect(d, x1 - 4, y0, x1, y1, c); rect(d, x0 - 2, y0 - 4, x1 + 2, y0, c)


BC_COL = [CYAN, GOLD, BLUE, rgb(240, 240, 255), STONE, GOLD, PURPLE, BLUE, ORANGE, RED, GREEN, TEAL, rgb(120, 120, 150), rgb(255, 150, 200), VIOLET, rgb(255, 245, 190), rgb(100, 120, 255), rgb(190, 40, 70), rgb(250, 250, 255)]


def bc19(i):
    col = BC_COL[i]
    def draw():
        if i == 0:  # cổ động + tinh thể
            return compose([P(lambda d: (poly(d, [(2, 60), (6, 26), (18, 10), (32, 6), (46, 10), (58, 26), (62, 60)], STONE_D), poly(d, [(18, 60), (20, 36), (32, 26), (44, 36), (46, 60)], NAVY))),
                            P(lambda d: [poly(d, [(x, 58), (x + 3, 42 + dy), (x + 6, 58)], col) for x, dy in [(22, 0), (30, -6), (38, 2)]]), P(lambda d: star4(d, 32, 34, 4, WHITE), 0, 0)], glow=col[:3], sparks=[(8, 10, 2), (56, 12, 2)])
        if i == 1:  # thần khư — cột vàng đổ nát
            return compose([scene_base(NAVY, mix(NAVY, GOLD, .3)), P(lambda d: [rect(d, x, 20 + dy, x + 7, 58, GOLD) for x, dy in [(10, 6), (28, 0), (46, 12)]]), P(lambda d: [poly(d, [(x - 2, 20 + dy), (x + 4, 15 + dy), (x + 9, 20 + dy)], GOLD_L) for x, dy in [(10, 6), (28, 0), (46, 12)]])], glow=GOLD[:3], sparks=[(8, 10, 3), (56, 8, 2)])
        if i == 2:  # hỗn nguyên giới — quả cầu + vòng
            return compose([P(lambda d: circ(d, 32, 32, 16, col)), P(lambda d: circ(d, 28, 28, 5, WHITE)), P(lambda d: (d.ellipse([4, 24, 59, 40], outline=GOLD, width=3), d.ellipse([14, 6, 49, 58], outline=CYAN, width=2)), 40, 40)], glow=col[:3], sparks=[(8, 8, 3), (56, 56, 3)])
        if i == 3:  # thiên cung trên mây
            return compose([P(lambda d: [circ(d, x, 54, r, WHITE) for x, r in [(14, 8), (28, 10), (44, 10), (54, 7)]]), P(lambda d: (rect(d, 12, 30, 51, 48, CREAM), poly(d, [(6, 30), (32, 12), (57, 30)], BLUE), rect(d, 29, 36, 34, 48, RED_D), poly(d, [(28, 12), (32, 3), (36, 12)], GOLD))), P(lambda d: [rect(d, x, 34, x + 2, 48, GOLD) for x in (16, 44)], 0, 0)], glow=rgb(200, 230, 255), sparks=[(6, 8, 3), (58, 12, 2)])
        if i == 4:  # cổ mộ — bia + vương miện
            return compose([P(lambda d: d.ellipse([6, 50, 58, 62], fill=mix(INK, GREEN, .3))), P(lambda d: (d.pieslice([16, 8, 47, 40], 180, 360, fill=STONE), rect(d, 16, 24, 47, 56, STONE), rect(d, 20, 28, 43, 54, STONE_D))), P(lambda d: (poly(d, [(23, 24), (22, 16), (27, 20), (32, 13), (37, 20), (42, 16), (41, 24)], GOLD), rect(d, 24, 32, 39, 33, STEEL), rect(d, 26, 38, 37, 39, STEEL))), P(lambda d: circ(d, 50, 20, 4, rgb(140, 255, 200)), 0, 0)], glow=(120, 255, 190), sparks=[(10, 12, 2), (56, 34, 3)])
        if i == 5:  # tiên vương điện — ngai + cột
            return compose([P(lambda d: (rect(d, 6, 8, 57, 56, NAVY),)), P(lambda d: [rect(d, x, 8, x + 6, 56, GOLD) for x in (8, 49)]), P(lambda d: (poly(d, [(22, 56), (22, 28), (28, 20), (36, 20), (42, 28), (42, 56)], RED_D), rect(d, 26, 36, 38, 56, RED))), P(lambda d: (poly(d, [(26, 18), (25, 10), (29, 13), (32, 8), (35, 13), (39, 10), (38, 18)], GOLD_L)))], glow=GOLD[:3], sparks=[(32, 3, 2), (6, 6, 2)])
        if i == 6:  # cửu u — hỏa u minh + sọ
            return compose([scene_base(INK, mix(INK, PURPLE, .5)), P(lambda d: [poly(d, [(x, 56), (x - 6, 40), (x - 1, 30 + dy), (x + 3, 38), (x + 6, 28 + dy), (x + 8, 44), (x + 6, 56)], col) for x, dy in [(18, 4), (38, 0)]]), P(lambda d: [poly(d, [(x, 56), (x - 3, 46), (x, 40), (x + 3, 46)], rgb(190, 240, 255)) for x in (20, 41)], 0, 0), P(lambda d: (circ(d, 32, 22, 6, WHITE), rect(d, 29, 26, 35, 31, WHITE), circ(d, 30, 22, 1, INK), circ(d, 34, 22, 1, INK)))], glow=PURPLE[:3], sparks=[(8, 12, 2), (56, 8, 2)])
        if i == 7:  # tôn giả thần điện
            return compose([P(lambda d: [rect(d, x, 24, x + 6, 56, SILVER) for x in (10, 22, 35, 47)]), P(lambda d: (rect(d, 6, 18, 57, 24, col), poly(d, [(4, 18), (32, 4), (59, 18)], mix(col, WHITE, .2)), rect(d, 4, 54, 59, 59, STONE_D))), P(lambda d: gem(d, 32, 12, 3, GOLD_L), 0, 0)], glow=col[:3], sparks=[(8, 8, 3), (56, 10, 2)])
        if i == 8:  # đế đạo cổ lộ — đường bậc thang lên sao
            return compose([P(lambda d: poly(d, [(26, 62), (38, 62), (35, 36), (29, 36)], STONE)), P(lambda d: [rect(d, 32 - w, y, 32 + w, y + 2, GOLD_L) for y, w in [(58, 8), (52, 7), (46, 6), (41, 5), (37, 4)]], 0, 0), P(lambda d: (poly(d, [(2, 62), (22, 40), (28, 62)], mix(INK, STONE, .5)), poly(d, [(62, 62), (42, 36), (36, 62)], mix(INK, STONE, .5)))), P(lambda d: star4(d, 32, 16, 12, GOLD), 90, 40)], glow=col[:3], sparks=[(8, 10, 2), (56, 12, 3)])
        if i == 9:  # vô thượng đế cung — mái vương miện
            return compose([P(lambda d: (rect(d, 10, 32, 53, 56, RED_D), rect(d, 14, 36, 49, 56, RED))), P(lambda d: (poly(d, [(4, 32), (14, 18), (24, 26), (32, 8), (40, 26), (50, 18), (60, 32)], GOLD), rect(d, 4, 32, 60, 36, GOLD_D))), P(lambda d: (rect(d, 27, 42, 36, 56, INK), gem(d, 32, 22, 3, RED))), P(lambda d: [circ(d, x, 40, 2, GOLD_L) for x in (18, 44)], 0, 0)], glow=RED[:3], sparks=[(6, 8, 3), (58, 10, 3)])
        if i == 10:  # tiên tổ di giới — đảo nổi + cây
            return compose([P(lambda d: poly(d, [(8, 40), (56, 40), (44, 60), (32, 62), (20, 60)], mix(BROWN, INK, .3))), P(lambda d: d.ellipse([6, 34, 58, 46], fill=GREEN)), P(lambda d: (rect(d, 30, 20, 34, 38, BROWN), circ(d, 32, 14, 10, col), circ(d, 22, 20, 7, LIME), circ(d, 42, 20, 7, LIME))), P(lambda d: [circ(d, x, y, 1, WHITE) for x, y in [(30, 12), (38, 16), (24, 20)]], 0, 0)], glow=GREEN[:3], sparks=[(8, 12, 3), (56, 10, 2)])
        if i == 11:  # tiên tổ lăng — kim tự tháp bậc
            return compose([P(lambda d: [poly(d, [(32 - w, y + 9), (32 - w + 4, y), (32 + w - 4, y), (32 + w, y + 9)], c) for w, y, c in [(28, 48, STONE), (22, 39, STONE_D), (16, 30, STONE), (10, 21, STONE_D)]]), P(lambda d: (poly(d, [(26, 21), (32, 6), (38, 21)], col), rect(d, 29, 50, 35, 58, INK))), P(lambda d: gem(d, 32, 14, 3, WHITE), 0, 0)], glow=col[:3], sparks=[(8, 14, 3), (56, 12, 2)])
        if i == 12:  # đạo nguyên cấm khu — xích + trận
            return compose([P(lambda d: (ring(d, 32, 32, 24, 3, col), ring(d, 32, 32, 16, 2, PINK))), P(lambda d: star4(d, 32, 32, 12, rgb(190, 90, 220))), P(lambda d: [(d.line([(x0, y0), (32, 32)], fill=STEEL, width=3)) for x0, y0 in [(6, 6), (58, 6), (6, 58), (58, 58)]]), P(lambda d: [circ(d, x, y, 3, GOLD) for x, y in [(6, 6), (58, 6), (6, 58), (58, 58)]])], glow=PURPLE[:3], sparks=[(32, 3, 2)])
        if i == 13:  # vạn đạo thiên vực — cầu vồng nhiều đường
            return compose([P(lambda d: [d.arc([6 + k * 4, 14 + k * 4, 57 - k * 4, 74 - k * 4], 180, 360, fill=c, width=4) for k, c in enumerate([RED, ORANGE, GOLD, GREEN, CYAN, BLUE, VIOLET])]), P(lambda d: (circ(d, 14, 52, 7, WHITE), circ(d, 50, 52, 7, WHITE), circ(d, 24, 54, 7, WHITE), circ(d, 40, 54, 7, WHITE))), P(lambda d: star4(d, 32, 14, 6, GOLD_L), 0, 0)], glow=PINK[:3], sparks=[(8, 10, 2), (56, 12, 3)])
        if i == 14:  # thiên đạo chi môn — cổng + mắt
            return compose([P(lambda d: (d.pieslice([8, 4, 55, 48], 180, 360, fill=STONE), rect(d, 8, 26, 55, 58, STONE), d.pieslice([16, 12, 47, 44], 180, 360, fill=NAVY), rect(d, 16, 28, 47, 58, NAVY))), P(lambda d: (poly(d, [(18, 32), (32, 22), (46, 32), (32, 42)], WHITE), circ(d, 32, 32, 6, col), circ(d, 32, 32, 3, INK), circ(d, 30, 30, 1, WHITE)), 100, 40), P(lambda d: [rect(d, 10, 22 + k * 6, 13, 24 + k * 6, GOLD_D) for k in range(5)], 0, 0)], glow=col[:3], sparks=[(6, 8, 3), (58, 10, 2)])
        if i == 15:  # thiên đạo bản nguyên — hạt giống sáng
            return compose([P(lambda d: circ(d, 32, 32, 22, mix(col, WHITE, .1))), P(lambda d: (circ(d, 32, 32, 15, GOLD_L), circ(d, 32, 32, 8, WHITE))), P(lambda d: [d.line([(32, 32), (32 + math.cos(math.radians(a)) * 29, 32 + math.sin(math.radians(a)) * 29)], fill=GOLD, width=1) for a in range(0, 360, 45)], 0, 0), P(lambda d: poly(d, [(32, 14), (36, 26), (32, 30), (28, 26)], GREEN), 90, 40)], glow=(255, 240, 160), sparks=[(8, 8, 3), (56, 56, 3), (56, 8, 2)])
        if i == 16:  # đại đạo thần khư — tàn tích + thiên hà
            return compose([P(lambda d: circ(d, 32, 24, 20, NAVY)), P(lambda d: [d.arc([12, 4, 52, 44], a, a + 120, fill=c, width=3) for a, c in [(0, col), (120, CYAN), (240, PINK)]], 0, 0), P(lambda d: circ(d, 32, 24, 4, WHITE), 0, 0), P(lambda d: [rect(d, x, 40 + dy, x + 7, 58, STONE) for x, dy in [(8, 6), (24, 0), (42, 10)]]), P(lambda d: rect(d, 4, 57, 59, 61, STONE_D))], glow=col[:3], sparks=[(8, 10, 3), (56, 8, 2)])
        if i == 17:  # chí tôn cấm địa — ngai đen + xích đỏ
            return compose([P(lambda d: (poly(d, [(16, 58), (16, 26), (24, 8), (40, 8), (48, 26), (48, 58)], INK), rect(d, 20, 40, 44, 58, mix(INK, col, .3)))), P(lambda d: (poly(d, [(24, 14), (24, 6), (28, 10), (32, 4), (36, 10), (40, 6), (40, 14)], col), gem(d, 32, 24, 4, col))), P(lambda d: [d.line([(4, y), (60, y + 6)], fill=STEEL, width=2) for y in (22, 40)], 0, 0), P(lambda d: [circ(d, x, y, 3, col) for x, y in [(8, 24), (32, 33), (54, 40), (10, 42)]])], glow=col[:3], sparks=[(8, 8, 2), (56, 12, 3)])
        # 18 siêu thoát chi hải — biển ánh sáng + cổng trắng
        return compose([P(lambda d: d.pieslice([6, 6, 57, 58], 180, 360, fill=rgb(60, 70, 150))), P(lambda d: circ(d, 32, 30, 14, WHITE), 100, 40), P(lambda d: [d.arc([x, 40, x + 20, 56], 180, 360, fill=c, width=3) for x, c in [(2, CYAN), (14, WHITE), (26, CYAN), (38, WHITE)]]), P(lambda d: d.ellipse([2, 50, 61, 62], fill=mix(BLUE, WHITE, .2))), P(lambda d: [d.arc([x, 46, x + 14, 58], 180, 360, fill=WHITE, width=2) for x in (6, 22, 38)], 0, 0)], glow=WHITE[:3], sparks=[(8, 8, 3), (56, 10, 3), (32, 6, 2)])
    return draw()


# ============================================================ REGISTRY
FEATURES = {
    'bicanh19': (bicanh19, '🌀'), 'chungdao': (chungdao, '⚡'), 'dekiep': (dekiep, '🌩️'), 'dean': (dean, '🔱'), 'dehieu': (dehieu, '🏷️'),
    'benmenh': (benmenh, '🧿'), 'dedao': (dedao, '☯️'), 'debinh': (debinh, '🗡️'), 'sukien19': (sukien19, '🌠'), 'linhngo19': (linhngo, '🪷'),
    'thucngo19': (thucngo19, '🌟'), 'doi19': (doi19, '👥'),
    'mob_thuong': (mob_thuong, '👾'), 'mob_tinhanh': (mob_tinhanh, '👹'), 'mob_mini': (mob_mini, '💀'), 'mob_canh': (mob_canh, '🛡️'), 'boss19': (boss19, '👿'),
    'dd_satphat': (dd_sat, '⚔️'), 'dd_sinhmenh': (dd_sinh, '💚'), 'dd_thoikhong': (dd_thoikhong, '🌀'), 'dd_luanhoi': (dd_luanhoi, '♻️'), 'dd_hondon': (dd_hondon, '🌌'), 'dd_huydiet': (dd_huydiet, '💥'),
    'db_kiem': (db_kiem, '🗡️'), 'db_chung': (db_chung, '🔔'), 'db_ban': (db_ban, '☯️'), 'db_an': (db_an, '🔱'), 'db_thap': (db_thap, '🗼'),
    'ev_dibien': (ev_dibien, '🌠'), 'ev_dicanh': (ev_dicanh, '👑'), 'ev_truyenthua': (ev_truyenthua, '📜'), 'ev_sieuthoat': (ev_sieuthoat, '🌌'),
}
BC_FALLBACK = ['🕳️', '🏛️', '🔮', '☁️', '⚰️', '🏯', '👻', '⛩️', '🛤️', '🏰', '🏝️', '🔺', '⛓️', '🌈', '🚪', '✨', '🌌', '🪑', '🌊']
for _i in range(19): FEATURES[f'bc19_{_i:02d}'] = ((lambda k: (lambda: bc19(k)))(_i), BC_FALLBACK[_i])


def build(sheet=None, force=False):
    fb = json.load(open(FB, encoding='utf-8')); done = []; skipped = []
    for key, (fn, uni) in FEATURES.items():
        path = os.path.join(OUT, f'{key}.png')
        if os.path.exists(path) and not force:
            skipped.append(key); continue
        save(fn(), key, OUT); done.append(key)
        if key not in fb: fb[key] = uni
    json.dump(fb, open(FB, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); open(FB, 'a').write('\n')
    print(f'đã vẽ {len(done)} emoji mới; bỏ qua {len(skipped)} (đã có: {", ".join(skipped)})' if skipped else f'đã vẽ {len(done)} emoji mới')
    if sheet:
        keys = list(FEATURES); cols = 10; cell = 140; rows = (len(keys) + cols - 1) // cols
        im = Image.new('RGBA', (cols * cell, rows * cell), (54, 57, 63, 255))
        for i, k in enumerate(keys):
            e = Image.open(os.path.join(OUT, f'{k}.png')).convert('RGBA'); x, y = (i % cols) * cell + 6, (i // cols) * cell + 6
            im.alpha_composite(e, (x, y)); im.alpha_composite(e.resize((32, 32), Image.LANCZOS), (x + 92, y + 92))
        im.convert('RGB').save(sheet); print('contact sheet →', sheet)


NEW_THIS_RUN = set()   # khóa vừa tạo trong lần chạy này (cho phép chạy lại script để chỉnh tranh mà không cần --force)
if __name__ == '__main__':
    # v19.2: 51 emoji này nay là TRANH DO NGƯỜI DÙNG TỰ VẼ (scripts/build_emoji_from_sheet_v19_1.py) → script vẽ bằng code CHỈ tạo khóa còn thiếu, không bao giờ ghi đè (trừ --force).
    force = '--force' in sys.argv
    NEW_THIS_RUN.update(k for k in FEATURES if force or not os.path.exists(os.path.join(OUT, f'{k}.png')))
    build(sys.argv[sys.argv.index('--sheet') + 1] if '--sheet' in sys.argv else None, force)
