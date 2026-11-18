#!/usr/bin/env python3
"""
make_pixel_emoji_v19_9.py — vẽ emoji pixel MỚI (V19.9) thay cho emoji hệ thống xấu ở nút / nhật ký của Bí Cảnh Tiên Giới.
Cùng phong cách bộ hiện có (lưới 64x64 phóng x2 → PNG 128x128 nền trong suốt, viền nâu đậm, bevel sáng/tối, quầng sáng, tia sáng).
Chỉ ghi các khóa a19_* MỚI (tiền tố a19_ = "action V19") và thêm emoji Unicode dự phòng vào src/data/emoji_fallback.json.
LƯU Ý: 17/33 khóa a19_* đã được thay bằng tranh người dùng (build_emoji_from_sheet_v19_9.py) — KHÔNG chạy lại với --force, sẽ ghi đè tranh của người dùng; để chạy lại an toàn hãy chạy build_emoji_from_sheet_v19_9.py sau cùng.
KHÔNG đụng / ghi đè bất kỳ emoji nào đã có (khóa tồn tại bị bỏ qua, trừ --force chỉ áp cho khóa a19_*).
Chạy:  python3 scripts/make_pixel_emoji_v19_9.py [--sheet contact.png] [--force]
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
CREAM = rgb(246, 232, 190); SKY = rgb(150, 210, 255)


def compose(parts, glow=None, sparks=()):
    im = _compose(parts, glow=tuple(glow[:3]) if glow else None)
    for x, y, r in sparks: sparkle(im, x, y, r)
    return im


def P(fn, la=80, da=80): return part(fn, la, da)
def poly(d, pts, c): d.polygon(pts, fill=c)
def circ(d, cx, cy, r, c): d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c)
def rect(d, x0, y0, x1, y1, c): d.rectangle([x0, y0, x1, y1], fill=c)
def gem(d, cx, cy, r, c): poly(d, [(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], c)
def ring(d, cx, cy, r, w, c): d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=c, width=w)
def thick(d, a, b, w, c): d.line([a, b], fill=c, width=w)
def star(d, cx, cy, ro, ri, n, c, rot=-90):
    pts = []
    for i in range(n * 2):
        a = math.radians(rot + i * 180 / n); r = ro if i % 2 == 0 else ri
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    poly(d, pts, c)


# ------------------------------------------------------------ hành động chiến đấu
def atk():   # kiếm chéo
    def blade(d): poly(d, [(50, 6), (58, 8), (56, 16), (24, 44), (18, 38)], SILVER); poly(d, [(50, 6), (58, 8), (56, 16)], WHITE)
    def groove(d): thick(d, (22, 40), (54, 10), 1, STEEL)
    def guard(d): poly(d, [(12, 36), (20, 30), (34, 44), (28, 52)], GOLD); rect(d, 18, 30, 21, 33, GOLD_L)
    def hilt(d): poly(d, [(14, 44), (22, 52), (11, 61), (4, 58), (4, 52)], BROWN); circ(d, 7, 58, 3, GOLD)
    return compose([P(blade), P(groove, 0, 0), P(guard), P(hilt)], glow=SKY[:3], sparks=[(10, 14, 3), (56, 38, 2), (30, 8, 2)])


def trong():   # đòn nặng — vụ nổ va chạm
    def burst(d): star(d, 32, 32, 29, 14, 9, ORANGE); star(d, 32, 32, 22, 10, 9, GOLD); circ(d, 32, 32, 9, GOLD_L)
    def core(d): circ(d, 32, 32, 5, WHITE)
    def crack(d): [thick(d, (32, 32), (32 + math.cos(math.radians(a)) * 26, 32 + math.sin(math.radians(a)) * 26), 1, RED) for a in (15, 95, 170, 250, 320)]
    return compose([P(burst), P(crack, 0, 0), P(core, 0, 0)], glow=ORANGE[:3], sparks=[(6, 8, 3), (58, 56, 3)])


def than():   # thần thông — cầu năng lượng + sao 4 cánh
    def orb(d): circ(d, 32, 32, 16, BLUE); circ(d, 32, 32, 11, CYAN)
    def hl(d): circ(d, 27, 27, 4, WHITE)
    def sp(d): poly(d, [(32, 2), (36, 28), (62, 32), (36, 36), (32, 62), (28, 36), (2, 32), (28, 28)], GOLD_L)
    def rg(d): ring(d, 32, 32, 22, 1, CYAN)
    return compose([P(rg, 0, 0), P(sp, 90, 30), P(orb), P(hl, 0, 0)], glow=CYAN[:3], sparks=[(8, 8, 2), (56, 56, 2)])


def tuyet():   # tuyệt kỹ — sao băng
    def tail(d): poly(d, [(2, 6), (44, 28), (30, 44)], mix(ORANGE, GOLD, .4)); poly(d, [(8, 22), (38, 34), (26, 46)], GOLD)
    def head(d): circ(d, 44, 40, 14, GOLD_L); circ(d, 44, 40, 9, WHITE)
    def ring_(d): ring(d, 44, 40, 17, 1, ORANGE)
    return compose([P(tail), P(head), P(ring_, 0, 0)], glow=GOLD[:3], sparks=[(8, 40, 3), (24, 8, 3), (58, 14, 2)])


def bi():   # bí pháp cấm kỵ — đầu lâu lửa tím
    def fire(d):
        poly(d, [(8, 40), (10, 20), (18, 28), (22, 8), (30, 22), (36, 4), (42, 22), (50, 10), (52, 30), (58, 22), (56, 42)], PURPLE)
    def skull(d): circ(d, 32, 34, 15, WHITE); rect(d, 23, 42, 41, 54, WHITE); rect(d, 27, 54, 37, 57, WHITE)
    def face(d):
        circ(d, 25, 36, 5, INK); circ(d, 39, 36, 5, INK); circ(d, 25, 36, 2, rgb(190, 255, 120)); circ(d, 39, 36, 2, rgb(190, 255, 120)); poly(d, [(30, 44), (34, 44), (32, 48)], INK)
        for x in (27, 31, 35, 39): thick(d, (x, 52), (x, 56), 1, INK)
    return compose([P(fire), P(skull), P(face, 0, 0)], glow=PURPLE[:3], sparks=[(6, 6, 2), (58, 50, 3)])


def sk():   # kỹ công pháp — sách mở
    def pages(d): poly(d, [(4, 14), (30, 20), (30, 56), (4, 50)], CREAM); poly(d, [(60, 14), (34, 20), (34, 56), (60, 50)], CREAM)
    def cover(d): poly(d, [(2, 48), (30, 54), (30, 58), (2, 52)], BROWN); poly(d, [(62, 48), (34, 54), (34, 58), (62, 52)], BROWN); rect(d, 30, 18, 34, 58, GOLD_D)
    def rune(d): gem(d, 17, 33, 6, VIOLET); gem(d, 47, 33, 6, VIOLET); gem(d, 17, 33, 2, WHITE); gem(d, 47, 33, 2, WHITE)
    def lines(d): [thick(d, (8, 22 + k * 5), (26, 26 + k * 5), 1, STEEL) for k in range(0, 1)] + [thick(d, (56, 22 + k * 5), (38, 26 + k * 5), 1, STEEL) for k in range(0, 1)]
    return compose([P(pages), P(cover), P(rune, 0, 0), P(lines, 0, 0)], glow=VIOLET[:3], sparks=[(32, 6, 3), (6, 8, 2), (58, 8, 2)])


def guard():   # phòng thủ — khiên
    def shield(d): poly(d, [(8, 8), (56, 8), (56, 34), (32, 60), (8, 34)], BLUE)
    def rim(d): poly(d, [(8, 8), (56, 8), (56, 14), (8, 14)], GOLD); poly(d, [(8, 8), (14, 8), (14, 34), (32, 54), (32, 60), (8, 34)], light(BLUE, .25))
    def emb(d): poly(d, [(30, 18), (34, 18), (34, 28), (44, 28), (44, 32), (34, 32), (34, 46), (30, 46), (30, 32), (20, 32), (20, 28), (30, 28)], GOLD_L)
    return compose([P(shield), P(rim, 0, 0), P(emb, 60, 60)], glow=BLUE[:3], sparks=[(6, 4, 2), (60, 40, 2)])


def rest():   # điều tức — hoa sen (cánh bầu)
    def water(d): d.ellipse([4, 50, 59, 62], fill=mix(CYAN, BLUE, .4)); d.ellipse([12, 52, 51, 60], fill=CYAN)
    def side(d): d.ellipse([2, 24, 24, 54], fill=PINK); d.ellipse([40, 24, 62, 54], fill=PINK)
    def mid(d): d.ellipse([10, 14, 32, 52], fill=rgb(255, 170, 205)); d.ellipse([32, 14, 54, 52], fill=rgb(255, 170, 205))
    def front(d): d.ellipse([22, 6, 42, 54], fill=rgb(255, 225, 240))
    def core(d): circ(d, 32, 40, 3, GOLD_L); thick(d, (32, 14), (32, 30), 1, PINK)
    return compose([P(water), P(side), P(mid), P(front), P(core, 0, 0)], glow=PINK[:3], sparks=[(8, 10, 3), (56, 8, 2)])


def item():   # đan dược — bình thuốc
    def cork(d): rect(d, 26, 4, 38, 12, BROWN); rect(d, 24, 12, 40, 16, GOLD_D)
    def neck(d): rect(d, 26, 16, 38, 26, SKY)
    def body(d): d.ellipse([8, 22, 56, 62], fill=SKY)
    def liquid(d): d.pieslice([10, 32, 54, 62], 0, 180, fill=RED); rect(d, 10, 47, 53, 47, RED); d.chord([10, 32, 54, 62], 0, 180, fill=RED)
    def shine(d): circ(d, 18, 38, 3, WHITE); rect(d, 29, 18, 30, 24, WHITE); circ(d, 36, 52, 2, light(RED, .6))
    return compose([P(cork), P(neck), P(body), P(liquid, 40, 90), P(shine, 0, 0)], glow=RED[:3], sparks=[(8, 12, 2), (56, 20, 3)])


def auto():   # tự chiến — bánh răng
    def gear(d):
        for a in range(0, 360, 45):
            x = 32 + math.cos(math.radians(a)) * 24; y = 32 + math.sin(math.radians(a)) * 24
            d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=STEEL)
        circ(d, 32, 32, 21, STEEL)
    def face(d): circ(d, 32, 32, 16, SILVER)
    def hole(d): circ(d, 32, 32, 9, NAVY)
    def play(d): poly(d, [(28, 25), (28, 39), (40, 32)], GOLD_L)
    return compose([P(gear), P(face), P(hole, 20, 20), P(play, 0, 0)], glow=SKY[:3], sparks=[(6, 6, 2), (58, 58, 2)])


def look():   # xem kẻ địch — con mắt
    def eye(d): poly(d, [(2, 32), (16, 18), (32, 14), (48, 18), (62, 32), (48, 46), (32, 50), (16, 46)], WHITE)
    def iris(d): circ(d, 32, 32, 13, VIOLET); circ(d, 32, 32, 7, INK)
    def hl(d): circ(d, 28, 28, 3, WHITE)
    def lid(d): thick(d, (2, 32), (16, 18), 2, INK); thick(d, (16, 18), (32, 14), 2, INK); thick(d, (32, 14), (48, 18), 2, INK); thick(d, (48, 18), (62, 32), 2, INK)
    return compose([P(eye), P(iris), P(hl, 0, 0)], glow=VIOLET[:3], sparks=[(8, 8, 2), (56, 54, 2)])


def refresh():   # làm mới — hai mũi tên vòng
    def arcs(d):
        d.arc([8, 8, 55, 55], 200, 320, fill=GREEN, width=7); d.arc([8, 8, 55, 55], 20, 140, fill=LIME, width=7)
    def heads(d): poly(d, [(46, 6), (58, 24), (36, 24)], GREEN); poly(d, [(18, 58), (6, 40), (28, 40)], LIME)
    return compose([P(arcs), P(heads)], glow=GREEN[:3], sparks=[(8, 8, 2), (56, 56, 2)])


def retreat():   # rút lui — mũi tên quay đầu + cánh
    def arrow(d): poly(d, [(2, 34), (24, 12), (24, 26), (60, 26), (60, 42), (24, 42), (24, 56)], ORANGE)
    def stripe(d): poly(d, [(26, 28), (58, 28), (58, 32), (26, 32)], GOLD_L)
    return compose([P(arrow), P(stripe, 0, 0)], glow=ORANGE[:3], sparks=[(58, 10, 3), (8, 56, 2)])


def nxt():   # sang tầng kế — cổng + mũi tên lên
    def gate(d): d.pieslice([8, 4, 55, 52], 180, 360, fill=STONE); rect(d, 8, 28, 55, 60, STONE); d.pieslice([16, 12, 47, 44], 180, 360, fill=NAVY); rect(d, 16, 28, 47, 60, NAVY)
    def glow_(d): d.pieslice([20, 16, 43, 40], 180, 360, fill=mix(NAVY, CYAN, .4)); rect(d, 20, 28, 43, 60, mix(NAVY, CYAN, .4))
    def arrow(d): poly(d, [(32, 22), (42, 34), (35, 34), (35, 52), (29, 52), (29, 34), (22, 34)], GOLD_L)
    return compose([P(gate), P(glow_, 0, 0), P(arrow, 60, 60)], glow=CYAN[:3], sparks=[(8, 6, 2), (58, 8, 3)])


def join():   # tham gia — người + dấu cộng
    def man(d): circ(d, 24, 18, 9, CREAM); d.pieslice([6, 30, 42, 66], 180, 360, fill=BLUE); rect(d, 6, 48, 42, 58, BLUE)
    def plus(d): circ(d, 49, 46, 12, GREEN); rect(d, 47, 38, 51, 54, WHITE); rect(d, 41, 44, 57, 48, WHITE)
    return compose([P(man), P(plus, 60, 60)], glow=GREEN[:3], sparks=[(52, 8, 3), (6, 6, 2)])


def leave():   # rời — cửa mở + mũi tên
    def door(d): rect(d, 10, 6, 40, 58, BROWN); rect(d, 14, 10, 36, 54, mix(BROWN, GOLD_D, .5))
    def open_(d): poly(d, [(40, 6), (54, 12), (54, 52), (40, 58)], dark(BROWN, .8)); circ(d, 34, 32, 2, GOLD_L)
    def arrow(d): poly(d, [(44, 28), (56, 28), (56, 22), (64, 32), (56, 42), (56, 36), (44, 36)], RED)
    return compose([P(door), P(open_), P(arrow, 60, 60)], glow=RED[:3], sparks=[(6, 6, 2)])


def start():   # bắt đầu — nút play
    def disc(d): circ(d, 32, 32, 27, GREEN)
    def inner(d): circ(d, 32, 32, 21, mix(GREEN, LIME, .4))
    def tri(d): poly(d, [(25, 18), (25, 46), (47, 32)], WHITE)
    return compose([P(disc), P(inner, 0, 0), P(tri, 40, 60)], glow=GREEN[:3], sparks=[(8, 8, 3), (56, 56, 2)])


def cancel():   # hủy — dấu X đỏ
    def disc(d): circ(d, 32, 32, 27, RED)
    def inner(d): circ(d, 32, 32, 21, light(RED, .15))
    def x(d): thick(d, (22, 22), (42, 42), 6, WHITE); thick(d, (42, 22), (22, 42), 6, WHITE)
    return compose([P(disc), P(inner, 0, 0), P(x, 30, 50)], glow=RED[:3], sparks=[(8, 8, 2)])


def done():   # kết thúc — cờ caro
    def pole(d): rect(d, 8, 4, 12, 60, BROWN); circ(d, 10, 4, 3, GOLD)
    def flag(d):
        rect(d, 12, 8, 56, 36, WHITE)
        for r in range(4):
            for c in range(7):
                if (r + c) % 2 == 0: rect(d, 12 + c * 6 + (0 if c < 6 else 0), 8 + r * 7, min(56, 12 + c * 6 + 5), 8 + r * 7 + 6, INK)
    return compose([P(pole), P(flag, 40, 60)], glow=GOLD[:3], sparks=[(58, 6, 2), (6, 58, 2)])


def warn():   # cảnh báo tụ lực
    def tri(d): poly(d, [(32, 4), (61, 56), (3, 56)], ORANGE); poly(d, [(32, 12), (54, 51), (10, 51)], GOLD)
    def mark(d): rect(d, 30, 22, 34, 40, INK); rect(d, 30, 44, 34, 48, INK)
    return compose([P(tri), P(mark, 0, 0)], glow=ORANGE[:3], sparks=[(8, 8, 2), (58, 10, 2)])


def weak():   # suy yếu — mũi tên đỏ đi xuống
    def arrow(d): poly(d, [(22, 4), (42, 4), (42, 30), (56, 30), (32, 60), (8, 30), (22, 30)], RED)
    def shine(d): poly(d, [(26, 8), (30, 8), (30, 34), (16, 34)], light(RED, .35))
    return compose([P(arrow), P(shine, 0, 0)], glow=RED[:3], sparks=[(8, 8, 2), (58, 56, 2)])


def dead():   # gục ngã — bia mộ
    def stone(d): d.pieslice([12, 6, 51, 46], 180, 360, fill=STONE); rect(d, 12, 26, 51, 56, STONE)
    def base(d): rect(d, 6, 54, 57, 60, STONE_D)
    def cross(d): rect(d, 30, 16, 33, 40, STONE_D); rect(d, 24, 22, 39, 25, STONE_D)
    def moss(d): poly(d, [(12, 54), (20, 48), (26, 54)], GREEN)
    return compose([P(stone), P(base), P(cross, 0, 0), P(moss, 0, 0)], glow=rgb(150, 160, 190), sparks=[(54, 12, 2)])


def alive():   # còn sống — giọt sinh mệnh xanh
    def drop(d): poly(d, [(32, 3), (50, 30), (52, 42), (46, 54), (32, 60), (18, 54), (12, 42), (14, 30)], GREEN)
    def hl(d): circ(d, 24, 38, 5, light(GREEN, .6)); circ(d, 22, 30, 2, WHITE)
    def cross(d): rect(d, 30, 34, 34, 52, WHITE); rect(d, 24, 40, 40, 44, WHITE)
    return compose([P(drop), P(hl, 0, 0), P(cross, 20, 40)], glow=GREEN[:3], sparks=[(8, 10, 2)])


def log_():   # diễn biến — cuộn giấy
    def sheet(d): rect(d, 12, 8, 52, 54, CREAM)
    def rolls(d): d.ellipse([6, 2, 58, 16], fill=mix(CREAM, GOLD, .3)); d.ellipse([6, 46, 58, 62], fill=mix(CREAM, GOLD, .3)); d.ellipse([8, 4, 18, 14], fill=GOLD_D); d.ellipse([46, 48, 56, 60], fill=GOLD_D)
    def text(d): [thick(d, (18, 20 + k * 7), (46 - (k % 2) * 8, 20 + k * 7), 1, STONE_D) for k in range(4)]
    return compose([P(sheet), P(rolls), P(text, 0, 0)], glow=GOLD[:3], sparks=[(58, 6, 2)])


def gift():   # phần thưởng — hộp quà
    def box(d): rect(d, 8, 26, 56, 58, RED); rect(d, 6, 18, 58, 30, dark(RED, .8))
    def band(d): rect(d, 28, 18, 36, 58, GOLD)
    def bow(d): poly(d, [(32, 18), (18, 4), (10, 12), (22, 18)], GOLD_L); poly(d, [(32, 18), (46, 4), (54, 12), (42, 18)], GOLD_L); circ(d, 32, 17, 4, GOLD)
    return compose([P(box), P(band), P(bow)], glow=GOLD[:3], sparks=[(6, 8, 3), (58, 12, 3)])


def win():   # chinh phục — cúp vàng
    def cup(d): poly(d, [(14, 6), (50, 6), (46, 34), (32, 44), (18, 34)], GOLD); d.pieslice([2, 8, 20, 30], 90, 270, fill=GOLD_D); d.pieslice([44, 8, 62, 30], 270, 90, fill=GOLD_D)
    def hl(d): poly(d, [(18, 10), (24, 10), (24, 32), (20, 30)], GOLD_L)
    def stem(d): rect(d, 28, 42, 36, 52, GOLD_D); rect(d, 16, 52, 48, 60, BROWN); rect(d, 20, 50, 44, 54, GOLD)
    def star_(d): star(d, 32, 22, 8, 3, 5, WHITE)
    return compose([P(cup), P(hl, 0, 0), P(stem), P(star_, 0, 0)], glow=GOLD[:3], sparks=[(6, 4, 3), (58, 6, 3), (32, 2, 2)])


def mapi():   # 5 tầng — bản đồ
    def paper(d): poly(d, [(4, 10), (22, 6), (42, 12), (60, 8), (60, 52), (42, 58), (22, 52), (4, 56)], CREAM)
    def fold(d): rect(d, 21, 8, 22, 54, STEEL); rect(d, 42, 12, 43, 58, STEEL)
    def route(d): thick(d, (10, 44), (22, 30), 2, RED); thick(d, (22, 30), (36, 38), 2, RED); thick(d, (36, 38), (50, 20), 2, RED); circ(d, 50, 18, 4, RED); circ(d, 10, 45, 3, BLUE)
    return compose([P(paper), P(fold, 0, 0), P(route, 0, 0)], glow=GOLD[:3], sparks=[(58, 4, 2)])


def chart():   # tiến độ — cột tăng
    def bars(d): rect(d, 6, 40, 18, 58, GREEN); rect(d, 22, 28, 34, 58, CYAN); rect(d, 38, 16, 50, 58, GOLD); rect(d, 4, 58, 60, 61, STONE_D)
    def arrow(d): poly(d, [(8, 30), (28, 14), (28, 20), (46, 6), (46, 12), (58, 4), (54, 18), (50, 14), (30, 28), (30, 34)], RED)
    return compose([P(bars), P(arrow, 40, 60)], glow=GOLD[:3], sparks=[(58, 30, 2)])


def ll():   # linh lực — ngọn lửa xanh
    def flame(d): poly(d, [(32, 2), (46, 24), (54, 40), (48, 56), (32, 62), (16, 56), (10, 40), (20, 26), (24, 16)], BLUE)
    def inner(d): poly(d, [(32, 22), (42, 38), (38, 54), (32, 58), (26, 54), (22, 38)], CYAN)
    def core(d): poly(d, [(32, 36), (37, 46), (32, 54), (27, 46)], WHITE)
    return compose([P(flame), P(inner, 60, 60), P(core, 0, 0)], glow=BLUE[:3], sparks=[(8, 10, 2), (56, 14, 2)])


def crown():   # đội trưởng — vương miện
    def c(d): poly(d, [(4, 50), (4, 16), (18, 30), (32, 8), (46, 30), (60, 16), (60, 50)], GOLD); rect(d, 4, 46, 60, 56, GOLD_D)
    def jew(d): gem(d, 32, 40, 5, RED); gem(d, 14, 42, 3, CYAN); gem(d, 50, 42, 3, CYAN)
    return compose([P(c), P(jew, 0, 0)], glow=GOLD[:3], sparks=[(6, 6, 2), (58, 8, 3)])


def lock():   # khóa
    def sh(d): ring(d, 32, 22, 12, 5, STEEL)
    def body(d): rect(d, 12, 28, 52, 58, GOLD); rect(d, 12, 28, 52, 32, GOLD_L)
    def hole(d): circ(d, 32, 40, 4, INK); rect(d, 30, 40, 34, 50, INK)
    return compose([P(sh), P(body), P(hole, 0, 0)], glow=GOLD[:3], sparks=[(8, 8, 2)])


def check():   # ✅
    def disc(d): circ(d, 32, 32, 27, GREEN)
    def inner(d): circ(d, 32, 32, 21, mix(GREEN, LIME, .4))
    def tick(d): thick(d, (19, 33), (28, 42), 6, WHITE); thick(d, (28, 42), (46, 21), 6, WHITE)
    return compose([P(disc), P(inner, 0, 0), P(tick, 30, 50)], glow=GREEN[:3], sparks=[(8, 8, 2)])


def cross():   # ❌
    def disc(d): circ(d, 32, 32, 27, RED_D)
    def inner(d): circ(d, 32, 32, 21, RED)
    def x(d): thick(d, (22, 22), (42, 42), 6, WHITE); thick(d, (42, 22), (22, 42), 6, WHITE)
    return compose([P(disc), P(inner, 0, 0), P(x, 30, 50)], glow=RED[:3], sparks=[(8, 8, 2)])


# ------------------------------------------------------------ REGISTRY: key → (hàm vẽ, emoji Unicode dự phòng)
FEATURES = {
    'a19_atk': (atk, '⚔️'), 'a19_trong': (trong, '💢'), 'a19_than': (than, '✨'), 'a19_tuyet': (tuyet, '🌠'), 'a19_bi': (bi, '☠️'),
    'a19_sk': (sk, '📖'), 'a19_guard': (guard, '🛡️'), 'a19_rest': (rest, '🧘'), 'a19_item': (item, '💊'), 'a19_auto': (auto, '🤖'),
    'a19_look': (look, '👁️'), 'a19_refresh': (refresh, '🔄'), 'a19_retreat': (retreat, '🏃'), 'a19_next': (nxt, '🚪'), 'a19_join': (join, '🤝'),
    'a19_leave': (leave, '🚪'), 'a19_start': (start, '▶️'), 'a19_cancel': (cancel, '✖️'), 'a19_done': (done, '🏁'), 'a19_warn': (warn, '⚠️'),
    'a19_weak': (weak, '⬇️'), 'a19_dead': (dead, '💀'), 'a19_alive': (alive, '🟢'), 'a19_log': (log_, '📜'), 'a19_gift': (gift, '🎁'),
    'a19_win': (win, '🏆'), 'a19_map': (mapi, '🗺️'), 'a19_chart': (chart, '📈'), 'a19_ll': (ll, '✨'), 'a19_crown': (crown, '👑'),
    'a19_lock': (lock, '🔒'), 'a19_check': (check, '✅'), 'a19_cross': (cross, '❌'),
}


def build(sheet=None, force=False):
    fb = json.load(open(FB, encoding='utf-8')); done_ = []; skipped = []
    for key, (fn, uni) in FEATURES.items():
        path = os.path.join(OUT, f'{key}.png')
        if os.path.exists(path) and not force:
            skipped.append(key); continue
        save(fn(), key, OUT); done_.append(key)
        fb.setdefault(key, uni)
    json.dump(fb, open(FB, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); open(FB, 'a').write('\n')
    print(f'đã vẽ {len(done_)} emoji mới; bỏ qua {len(skipped)} (đã có)')
    if sheet:
        keys = list(FEATURES); cols = 8; cell = 140; rows = (len(keys) + cols - 1) // cols
        im = Image.new('RGBA', (cols * cell, rows * cell), (54, 57, 63, 255))
        for i, k in enumerate(keys):
            e = Image.open(os.path.join(OUT, f'{k}.png')).convert('RGBA'); x, y = (i % cols) * cell + 6, (i // cols) * cell + 6
            im.alpha_composite(e, (x, y)); im.alpha_composite(e.resize((32, 32), Image.LANCZOS), (x + 92, y + 92))
        im.convert('RGB').save(sheet); print('contact sheet →', sheet)


if __name__ == '__main__':
    build(sys.argv[sys.argv.index('--sheet') + 1] if '--sheet' in sys.argv else None, '--force' in sys.argv)
