#!/usr/bin/env python3
"""
make_pixel_emoji_v7.py — bộ emoji pixel ĐỒNG BỘ cho Tiên Giới Bot v7.0

Mọi icon: lưới 32x32, viền nâu đậm + bevel sáng/tối, phóng x4 (nearest) -> PNG 128x128 nền trong suốt.
(Cùng chuẩn với 46 icon gốc của make_pixel_emoji.py; bản này vẽ thêm các icon còn thiếu và vẽ lại `bequan`
 vốn là ảnh thật 256px.)

Chạy:  python3 scripts/make_pixel_emoji_v7.py            -> ghi toàn bộ vào assets/emoji/ (cũ + mới)
       python3 scripts/make_pixel_emoji_v7.py --sheet    -> thêm assets/emoji_preview_v7.png (xem trước)
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_pixel_emoji as base  # noqa: E402  (dùng lại Layer + bảng màu + 46 icon gốc)
from make_pixel_emoji import (  # noqa: E402
    Layer, N, OUT, WHITE, G1, G2, G3, G4, S1, S2, S3, S4, J1, J2, J3, J4, C1, C2, C3, C4,
    R1, R2, R3, R4, P1, P2, P3, P4, W1, W2, W3, W4, T1, T2, T3, T4, L1, L2, L3, L4,
    Q1, Q2, Q3, K1, K2, K3, PAPER1, PAPER2, PAPER3, SKIN, HAIR, icon, ICONS,
)
from PIL import Image  # noqa: E402

NEW = []  # thứ tự các icon mới


def new(name):
    def deco(fn):
        ICONS[name] = fn
        NEW.append(name)
        return fn
    return deco


# ------------------------------------------------------------------ helpers
def rotpts(pts, ang, cx=16, cy=16):
    a = math.radians(ang)
    ca, sa = math.cos(a), math.sin(a)
    return [(cx + (x - cx) * ca - (y - cy) * sa, cy + (x - cx) * sa + (y - cy) * ca) for x, y in pts]


def shape(pts, col, light, dark, ang=0):
    l = Layer()
    l.poly(rotpts(pts, ang) if ang else pts, col)
    return l.bevel(light, dark)


def disc(cx, cy, r, col, light, dark):
    l = Layer()
    l.circle(cx, cy, r, col)
    return l.bevel(light, dark)


def heart(c, cx, cy, s, col, light=None, dark=None):
    l = Layer()
    l.circle(cx - s * 0.5, cy - s * 0.25, s * 0.55, col)
    l.circle(cx + s * 0.5, cy - s * 0.25, s * 0.55, col)
    l.poly([(cx - s * 1.02, cy - s * 0.05), (cx + s * 1.02, cy - s * 0.05), (cx, cy + s * 1.15)], col)
    if light:
        l.bevel(light, dark)
    c.paste(l)
    return l


def mix(c1, c2, t):
    return tuple(int(round(a + (b - a) * t)) for a, b in zip(c1, c2))


def tri(col):
    """Từ 1 màu -> (sáng, giữa, tối)."""
    return mix(col, WHITE, 0.55), col, mix(col, (20, 10, 30), 0.55)


def wave_pts(x0, x1, y, amp, period, phase=0):
    return [(x, y + math.sin((x - x0) / period * 2 * math.pi + phase) * amp) for x in range(x0, x1 + 1)]


def finish(c, sp=((4, 5, WHITE), (28, 26, WHITE))):
    c.outline()
    for x, y, col in sp:
        c.sparkle(x, y, col)
    return c


# ================================================================== ICON CORE (nút & menu)
@new("tuluyen")  # Tu luyện — người ngồi thiền trên đài sen
def _tuluyen():
    c = Layer()
    lotus = Layer(); lotus.ellipse(16, 25, 11, 3.3, K2); lotus.bevel(K1, K3)
    c.paste(lotus)
    for x in (7, 11, 21, 25):
        c.poly([(x, 25), (x + 1.5, 20), (x + 3, 25)], K1)
    body = shape([(16, 12), (22, 17), (24, 23), (8, 23), (10, 17)], C3, C2, C4)
    c.paste(body)
    c.circle(16, 8, 3.6, SKIN); c.rect(13, 5, 19, 6, HAIR); c.px(12, 7, HAIR); c.px(20, 7, HAIR)
    c.circle(16, 19, 1.6, SKIN)
    c.line(12, 17, 16, 19, C4); c.line(20, 17, 16, 19, C4)
    return finish(c, ((4, 6, C1), (27, 8, WHITE), (6, 26, K1)))


@new("bequan")  # Bế quan — cổng đá niêm phong
def _bequan():
    c = Layer()
    frame = shape([(5, 9), (27, 9), (27, 28), (5, 28)], T3, T1, T4)
    c.paste(frame)
    c.poly([(3, 9), (16, 3), (29, 9)], T2)                       # mái
    c.rect(9, 12, 22, 28, T4)                                    # cửa tối
    c.rect(9, 12, 15, 28, T3); c.rect(16, 12, 22, 28, T4)
    c.line(15.5, 12, 15.5, 28, S4)
    c.rect(13, 15, 18, 23, PAPER1)                               # bùa niêm phong
    c.rect(13, 15, 18, 16, Q2)
    c.line(14, 18, 17, 18, Q2); c.line(14, 20, 17, 20, Q2); c.line(15.5, 17, 15.5, 22, Q3)
    return finish(c, ((3, 4, C1), (28, 22, C1)))


@new("dotpha")  # Đột phá — bùng nổ + mũi tên lên
def _dotpha():
    c = Layer()
    pts = []
    for i in range(16):
        r = 14 if i % 2 == 0 else 8
        a = math.pi * 2 * i / 16 - math.pi / 2
        pts.append((16 + math.cos(a) * r, 16 + math.sin(a) * r))
    c.paste(shape(pts, G2, G1, G3))
    c.paste(shape([(16, 5), (24, 15), (19, 15), (19, 26), (13, 26), (13, 15), (8, 15)], J2, J1, J4))
    return finish(c, ((3, 3, WHITE), (28, 28, G1)))


@new("kiem")  # Kiếm
def _kiem():
    c = Layer()
    c.paste(shape([(16, 1), (19.5, 5), (19.5, 20), (12.5, 20), (12.5, 5)], S2, S1, S4, 45))
    c.paste(shape([(8, 20), (24, 20), (24, 22.5), (8, 22.5)], G2, G1, G4, 45))
    c.paste(shape([(14.5, 22.5), (17.5, 22.5), (17.5, 28), (14.5, 28)], W3, W2, W4, 45))
    c.paste(shape([(14, 28), (18, 28), (18, 31), (14, 31)], G2, G1, G4, 45))
    return finish(c, ((4, 4, WHITE), (27, 27, C1)))


@new("dongmenu")  # Đóng — bảng xám có dấu X
def _dongmenu():
    c = Layer()
    c.paste(shape([(5, 5), (27, 5), (27, 27), (5, 27)], T3, T2, T4))
    c.line(10, 10, 22, 22, WHITE, 3); c.line(22, 10, 10, 22, WHITE, 3)
    return finish(c, ((3, 3, T1),))


@new("caidat")  # Cài đặt — bánh răng
def _caidat():
    c = Layer()
    for i in range(8):
        a = i * 45
        c.paste(shape([(13.5, 3), (18.5, 3), (18.5, 9), (13.5, 9)], S3, S2, S4, a))
    c.paste(disc(16, 16, 9, S3, S2, S4))
    hole = Layer(); hole.circle(16, 16, 3.5, WHITE)
    for y in range(N):
        for x in range(N):
            if hole.g[y][x] is not None:
                c.g[y][x] = None
    return finish(c, ((3, 3, WHITE),))


@new("shop")  # Cửa hàng — quầy có mái che
def _shop():
    c = Layer()
    c.paste(shape([(5, 14), (27, 14), (27, 27), (5, 27)], W2, W1, W4))
    awn = Layer()
    for i, x in enumerate(range(4, 28, 4)):
        awn.poly([(x, 6), (x + 4, 6), (x + 4, 14), (x, 14)], Q2 if i % 2 == 0 else WHITE)
    awn.bevel(Q1, Q3)
    c.paste(awn)
    for x in range(4, 28, 4):
        c.circle(x + 2, 14, 2, Q2 if (x - 4) // 4 % 2 == 0 else S1)
    c.circle(11, 21, 2.6, G2); c.circle(11, 21, 1, G4)
    c.rect(17, 18, 23, 24, J2); c.rect(17, 18, 23, 19, J1)
    return finish(c, ((3, 3, G1), (28, 3, WHITE)))


@new("congkich")  # Công kích — nắm đấm
def _congkich():
    c = Layer()
    c.paste(shape([(8, 11), (24, 11), (25, 22), (21, 27), (11, 27), (7, 22)], R2, R1, R4))
    for y in (15, 19):
        c.line(10, y, 22, y, R3)
    c.paste(shape([(4, 14), (9, 14), (10, 22), (5, 22)], R2, R1, R4))
    for x in (12, 16, 20):
        c.line(x, 11, x, 14, R3)
    return finish(c, ((3, 5, Q1), (28, 6, R1)))


@new("luyendan")  # Luyện đan — đỉnh lò
def _luyendan():
    c = Layer()
    c.paste(shape([(6, 11), (26, 11), (24, 23), (8, 23)], G3, G2, G4))
    c.paste(shape([(4, 9), (28, 9), (28, 13), (4, 13)], G2, G1, G4))
    for x in (9, 20):
        c.paste(shape([(x, 23), (x + 3, 23), (x + 2, 28), (x + 1, 28)], G4, G3, G4))
    c.circle(16, 18, 2.5, G1)
    c.poly([(12, 8), (16, 1), (20, 8)], R2); c.poly([(14, 8), (16, 4), (18, 8)], R1)
    return finish(c, ((3, 4, R1), (28, 5, R1)))


@new("khivan")  # Khí vận — cỏ bốn lá
def _khivan():
    c = Layer()
    c.line(16, 16, 20, 29, L4, 2)
    for dx, dy in ((-4.5, -4.5), (4.5, -4.5), (-4.5, 4.5), (4.5, 4.5)):
        c.paste(disc(16 + dx, 15 + dy, 5, L2, L1, L3))
    c.circle(16, 15, 2, L1)
    return finish(c, ((3, 3, L1), (28, 5, G1)))


@new("phongngu")  # Phòng ngự — khiên
def _phongngu():
    c = Layer()
    c.paste(shape([(5, 5), (16, 2), (27, 5), (25, 18), (16, 29), (7, 18)], G3, G2, G4))
    c.paste(shape([(8, 8), (16, 5.5), (24, 8), (22.5, 17), (16, 25.5), (9.5, 17)], C3, C2, C4))
    c.rect(15, 8, 17, 21, G2); c.rect(10, 13, 22, 15, G2)
    return finish(c, ((3, 3, WHITE), (28, 26, C1)))


@new("linhcan")  # Linh căn — mầm cây + rễ phát sáng
def _linhcan():
    c = Layer()
    c.paste(shape([(5, 25), (9, 21), (23, 21), (27, 25), (27, 28), (5, 28)], W2, W1, W4))
    c.line(16, 21, 16, 11, L3, 2)
    c.paste(shape([(16, 12), (9, 6), (4, 12), (10, 15)], L2, L1, L3))
    c.paste(shape([(16, 10), (23, 3), (28, 9), (21, 13)], L2, L1, L3))
    for x in (9, 16, 23):
        c.px(x, 26, C1); c.px(x + 1, 25, C2)
    return finish(c, ((3, 3, C1), (29, 17, C1)))


@new("linhgioilenh")  # Linh giới lệnh — lệnh bài ngọc
def _linhgioilenh():
    c = Layer()
    c.paste(shape([(7, 4), (25, 4), (25, 26), (7, 26)], G3, G2, G4))
    c.paste(shape([(9, 6), (23, 6), (23, 24), (9, 24)], C3, C2, C4))
    c.circle(16, 9, 1.6, WHITE)
    c.circle(13, 17, 2.5, C1); c.circle(18, 16, 3.2, C1); c.circle(20, 18, 2.2, C1)
    c.line(16, 26, 16, 30, Q2, 2); c.px(15, 30, Q2); c.px(17, 30, Q2)
    return finish(c, ((3, 4, WHITE), (28, 8, C1)))


@new("nguyenlieu")  # Nguyên liệu — quặng + thảo dược
def _nguyenlieu():
    c = Layer()
    c.paste(shape([(4, 24), (6, 15), (13, 11), (21, 12), (27, 19), (25, 27), (9, 27)], T3, T2, T4))
    c.poly([(8, 17), (13, 13), (19, 14), (13, 19)], T1)
    c.paste(shape([(18, 14), (24, 4), (29, 9), (22, 15)], L2, L1, L3))
    c.line(21, 15, 21, 20, L4, 1)
    return finish(c, ((3, 6, C1), (28, 27, WHITE)))


@new("congphap")  # Công pháp — bí tịch
def _congphap():
    c = Layer()
    c.paste(shape([(5, 4), (24, 4), (24, 27), (5, 27)], C4, C3, C4))
    c.rect(24, 6, 27, 26, PAPER1); c.line(25, 7, 25, 25, PAPER3)
    c.rect(5, 4, 8, 27, C3)
    c.circle(15, 14, 5, G2); c.circle(15, 14, 5, G2)
    for y in range(N):
        for x in range(N):
            if c.g[y][x] == G2 and x > 15:
                c.g[y][x] = Q2 if (x - 15) ** 2 + (y - 14) ** 2 < 26 else G2
    c.circle(15, 11.5, 1, Q2); c.circle(15, 16.5, 1, G2)
    c.line(10, 22, 20, 22, G2)
    return finish(c, ((3, 3, C1), (28, 28, WHITE)))


@new("phapbao")  # Pháp bảo — châu pháp trên đế
def _phapbao():
    c = Layer()
    c.paste(shape([(8, 23), (24, 23), (21, 28), (11, 28)], G3, G2, G4))
    c.paste(disc(16, 13, 10, P2, P1, P3))
    c.circle(12, 9, 2, WHITE); c.px(14, 8, P1)
    pts = [(x, y) for x, y in wave_pts(10, 22, 15, 2, 8)]
    for x, y in pts:
        c.px(x, y, P1)
    return finish(c, ((3, 4, P1), (28, 4, WHITE), (27, 22, P1)))


# ================================================================== BATCH 2
@new("cup")  # Cúp
def _cup():
    c = Layer()
    for sx in (-1, 1):
        c.paste(shape([(16 + sx * 9, 6), (16 + sx * 13, 6), (16 + sx * 13, 13), (16 + sx * 9, 15)], G3, G2, G4))
    c.paste(shape([(7, 4), (25, 4), (22, 17), (18, 20), (14, 20), (10, 17)], G2, G1, G3))
    c.paste(shape([(14, 20), (18, 20), (18, 24), (14, 24)], G3, G2, G4))
    c.paste(shape([(9, 24), (23, 24), (23, 28), (9, 28)], G4, G3, G4))
    c.sparkle(16, 11, WHITE, True)
    return finish(c, ((3, 3, G1), (28, 3, WHITE)))


@new("phithangdau")  # Phi thăng đấu — cúp tím có cánh
def _phithangdau():
    c = Layer()
    for sx in (-1, 1):
        c.paste(shape([(16 + sx * 8, 14), (16 + sx * 15, 5), (16 + sx * 14, 12), (16 + sx * 15, 15),
                       (16 + sx * 12, 17), (16 + sx * 8, 19)], S1, WHITE, S3))
    c.paste(shape([(10, 4), (22, 4), (20, 15), (17, 18), (15, 18), (12, 15)], P2, P1, P3))
    c.paste(shape([(14, 18), (18, 18), (18, 22), (14, 22)], G3, G2, G4))
    c.paste(shape([(10, 22), (22, 22), (22, 27), (10, 27)], G4, G3, G4))
    c.sparkle(16, 10, WHITE)
    return finish(c, ((3, 3, P1), (28, 3, G1)))


@new("phithang")  # Phi thăng — bay lên mây
def _phithang():
    c = Layer()
    c.paste(shape([(16, 2), (23, 12), (19, 12), (19, 20), (13, 20), (13, 12), (9, 12)], G2, G1, G3))
    cl = Layer()
    for cx, cy, r in ((9, 24, 5), (16, 22, 6.5), (23, 24, 5), (16, 26, 5)):
        cl.circle(cx, cy, r, S1)
    c.paste(cl.bevel(WHITE, S3))
    return finish(c, ((3, 4, G1), (28, 6, WHITE), (6, 14, C1)))


@new("thegioi")  # Thế giới — quả cầu
def _thegioi():
    c = Layer()
    g = disc(16, 16, 12, C3, C2, C4)
    land = Layer()
    land.poly([(8, 9), (14, 7), (17, 12), (12, 16), (7, 14)], L2)
    land.poly([(18, 16), (25, 14), (26, 21), (21, 25), (17, 21)], L2)
    land.clip_to(g)
    c.paste(g); c.paste(land)
    c.px(11, 9, WHITE); c.px(12, 9, WHITE)
    return finish(c, ((3, 3, C1), (28, 28, WHITE)))


@new("linhtinh")  # Linh tinh — tinh thể sao
def _linhtinh():
    c = Layer()
    c.paste(shape([(16, 2), (20, 12), (30, 16), (20, 20), (16, 30), (12, 20), (2, 16), (12, 12)], C2, C1, C4))
    c.paste(shape([(16, 9), (18, 14), (23, 16), (18, 18), (16, 23), (14, 18), (9, 16), (14, 14)], C1, WHITE, C3))
    return finish(c, ((4, 4, WHITE), (27, 27, WHITE)))


@new("linhthach")  # Linh thạch — ngọc linh
def _linhthach():
    c = Layer()
    base_g = shape([(16, 3), (27, 13), (16, 29), (5, 13)], J2, J1, J4)
    top = Layer(); top.poly([(16, 3), (27, 13), (5, 13)], J1); top.clip_to(base_g)
    left = Layer(); left.poly([(5, 13), (16, 13), (16, 29)], J3); left.clip_to(base_g)
    right = Layer(); right.poly([(16, 13), (27, 13), (16, 29)], J4); right.clip_to(base_g)
    for l in (base_g, top, left, right):
        c.paste(l)
    c.line(5, 13, 27, 13, J1)
    return finish(c, ((3, 4, WHITE), (28, 5, J1)))


@new("linhmach")  # Linh mạch — dòng linh khí
def _linhmach():
    c = Layer()
    c.paste(disc(16, 16, 13, C4, C3, C4))
    for y0, col in ((10, C1), (16, C2), (22, C1)):
        for x, y in wave_pts(6, 26, y0, 2, 10, y0):
            c.px(x, y, col); c.px(x, y + 1, col)
    return finish(c, ((3, 3, C1), (28, 28, WHITE)))


@new("thechat")  # Thể chất — cánh tay cơ bắp
def _thechat():
    c = Layer()
    c.paste(shape([(9, 28), (7, 14), (13, 12), (19, 28)], SKIN, (255, 240, 220), (200, 140, 100)))
    c.paste(disc(21, 12, 6, SKIN, (255, 240, 220), (200, 140, 100)))
    c.paste(shape([(13, 12), (20, 6), (27, 10), (26, 18), (19, 21), (15, 17)], SKIN, (255, 240, 220), (200, 140, 100)))
    c.line(17, 12, 23, 14, (200, 140, 100))
    return finish(c, ((3, 4, WHITE), (28, 26, G1)))


@new("danduoc")  # Đan dược — bình đan
def _danduoc():
    c = Layer()
    c.paste(shape([(9, 11), (23, 11), (25, 26), (7, 26)], C1, WHITE, C3))
    c.paste(shape([(11, 6), (21, 6), (21, 11), (11, 11)], W2, W1, W4))
    for cx, cy, col in ((13, 22, R2), (19, 22, G2), (16, 18, J2)):
        c.circle(cx, cy, 2.6, col); c.px(cx - 1, cy - 1, WHITE)
    return finish(c, ((3, 5, C1), (28, 6, G1)))


@new("linhluc")  # Linh lực — giọt linh khí
def _linhluc():
    c = Layer()
    c.paste(shape([(16, 2), (24, 14), (25, 20), (22, 26), (16, 29), (10, 26), (7, 20), (8, 14)], C3, C2, C4))
    c.rect(11, 16, 12, 22, WHITE); c.px(12, 14, WHITE)
    c.sparkle(18, 20, C1)
    return finish(c, ((3, 4, C1), (28, 6, WHITE)))


@new("dongphu")  # Động phủ — hang núi
def _dongphu():
    c = Layer()
    c.paste(shape([(2, 27), (10, 8), (16, 14), (22, 5), (30, 27)], T3, T2, T4))
    c.paste(shape([(11, 27), (11, 19), (16, 14), (21, 19), (21, 27)], T4, T3, T4))
    c.paste(shape([(14, 27), (14, 22), (16, 20), (18, 22), (18, 27)], Q3, Q2, Q3))
    for x, y in ((5, 25), (7, 23), (25, 24), (27, 26)):
        c.circle(x, y, 2, L2)
    c.line(22, 5, 22, 1, W3); c.poly([(22, 1), (27, 2), (22, 4)], Q2)
    return finish(c, ((3, 4, WHITE),))


@new("dongthanh")  # Đồng hành — dấu chân linh thú
def _dongthanh():
    c = Layer()
    c.paste(shape([(8, 19), (12, 14), (20, 14), (24, 19), (23, 25), (16, 26), (9, 25)], K2, K1, K3))
    for x, y, r in ((7, 11, 3), (13, 6, 3), (20, 6, 3), (26, 11, 3)):
        c.paste(disc(x, y, r, K2, K1, K3))
    return finish(c, ((3, 3, K1), (28, 27, WHITE)))


@new("tongmon")  # Tông môn — bảo tháp
def _tongmon():
    c = Layer()
    for i, (y, w) in enumerate(((22, 12), (14, 9), (7, 6))):
        c.paste(shape([(16 - w, y + 5), (16 + w, y + 5), (16 + w - 2, y + 9), (16 - w + 2, y + 9)], W1, W1, W3))
        c.paste(shape([(16 - w - 3, y + 5), (16 + w + 3, y + 5), (16 + w, y + 1), (16 - w, y + 1)], Q2, Q1, Q3))
    c.poly([(16, 0), (17, 3), (15, 3)], G2)
    c.rect(11, 27, 21, 29, T3)
    return finish(c, ((3, 12, G1), (28, 12, G1)))


@new("linhngo")  # Linh ngộ — bóng đèn giác ngộ
def _linhngo():
    c = Layer()
    c.paste(disc(16, 13, 8, G1, WHITE, G2))
    c.paste(shape([(12, 20), (20, 20), (19, 24), (13, 24)], S3, S2, S4))
    c.rect(13, 25, 19, 27, S4)
    c.rect(14, 10, 15, 16, G3); c.rect(17, 10, 18, 16, G3)
    for a in (-60, -30, 0, 30, 60):
        ra = math.radians(a - 90)
        c.line(16 + math.cos(ra) * 11, 13 + math.sin(ra) * 11, 16 + math.cos(ra) * 14, 13 + math.sin(ra) * 14, G2)
    return finish(c, ((3, 25, G1), (28, 25, G1)))


@new("giaodich")  # Giao dịch — hai chiều
def _giaodich():
    c = Layer()
    c.paste(disc(16, 16, 13, G3, G2, G4))
    c.paste(shape([(7, 11), (19, 11), (19, 8), (26, 13), (19, 18), (19, 15), (7, 15)], J2, J1, J4))
    c.paste(shape([(25, 20), (13, 20), (13, 17), (6, 22), (13, 27), (13, 24), (25, 24)], C2, C1, C4))
    return finish(c, ((3, 3, G1), (28, 28, WHITE)))


@new("thanphap")  # Thân pháp — hài có cánh
def _thanphap():
    c = Layer()
    c.paste(shape([(10, 6), (18, 6), (18, 18), (27, 22), (27, 28), (10, 28)], W2, W1, W4))
    c.rect(10, 6, 18, 8, S2)
    c.paste(shape([(8, 12), (1, 7), (3, 12), (1, 15), (5, 16), (8, 18)], WHITE, WHITE, S3))
    for y in (22, 26):
        c.line(1, y, 7, y, C2)
    return finish(c, ((28, 4, C1), (3, 29, C1)))


# ================================================================== BATCH 3
@new("vebicanhdacbiet")  # Vé bí cảnh đặc biệt
def _ve():
    c = Layer()
    c.paste(shape([(3, 8), (29, 8), (29, 14), (27, 16), (29, 18), (29, 24), (3, 24), (3, 18), (5, 16), (3, 14)], P2, P1, P3))
    c.line(21, 9, 21, 23, P1)
    c.paste(shape([(11, 12), (13, 15), (17, 15), (14, 17.5), (15, 21), (11.5, 19), (8, 21), (9, 17.5), (6, 15), (10, 15)], G2, G1, G3))
    return finish(c, ((3, 4, P1), (28, 28, WHITE)))


@new("linhphu")  # Linh phù — bùa vàng
def _linhphu():
    c = Layer()
    c.paste(shape([(9, 3), (23, 3), (23, 29), (9, 29)], PAPER1, WHITE, PAPER3))
    c.rect(9, 3, 23, 5, Q2); c.rect(9, 27, 23, 29, Q2)
    for y in (9, 13, 17, 21):
        c.line(12, y, 20, y, Q2)
    c.line(16, 7, 16, 24, Q3)
    c.circle(16, 15, 2, Q2)
    return finish(c, ((4, 5, G1), (28, 26, G1)))


@new("daolu")  # Đạo lữ — đôi tim
def _daolu():
    c = Layer()
    heart(c, 11, 11, 7, K2, K1, K3)
    heart(c, 21, 16, 8, Q2, Q1, Q3)
    return finish(c, ((3, 25, K1), (28, 5, WHITE)))


@new("daolu_ketdoi")  # Kết đôi — nhẫn
def _ketdoi():
    c = Layer()
    ring = Layer(); ring.circle(16, 19, 9, G2)
    hole = Layer(); hole.circle(16, 19, 5.5, WHITE)
    for y in range(N):
        for x in range(N):
            if hole.g[y][x] is not None:
                ring.g[y][x] = None
    c.paste(ring.bevel(G1, G4))
    c.paste(shape([(16, 2), (21, 7), (16, 12), (11, 7)], C2, C1, C4))
    return finish(c, ((4, 4, WHITE), (28, 6, C1)))


@new("daolu_chiatay")  # Chia tay — tim vỡ
def _chiatay():
    c = Layer()
    left = Layer(); heart(left, 16, 12, 10, Q2)
    right = Layer(); right.g = [row[:] for row in left.g]
    for y in range(N):
        for x in range(N):
            cut = 16 + math.sin(y * 0.9) * 2.4
            if x >= cut - 1.2:
                left.g[y][x] = None
            if x < cut + 1.2:
                right.g[y][x] = None
    for y in range(N):
        for x in range(N):
            if right.g[y][x] is not None:
                right.g[y][x - 0] = right.g[y][x]
    sh = Layer()
    for y in range(N):
        for x in range(N):
            if right.g[y][x] is not None and x + 2 < N:
                sh.g[y + 1 if y + 1 < N else y][x + 2] = right.g[y][x]
    c.paste(left.bevel(Q1, Q3)); c.paste(sh.bevel(Q1, Q3))
    return finish(c, ((3, 4, Q1), (28, 28, T1)))


@new("bicanh")  # Bí cảnh — cổng không gian
def _bicanh():
    c = Layer()
    c.paste(shape([(4, 29), (4, 12), (10, 4), (22, 4), (28, 12), (28, 29)], T3, T2, T4))
    inner = Layer()
    inner.ellipse(16, 17, 8, 11, P3)
    inner.ellipse(16, 17, 6, 9, C3)
    inner.ellipse(16, 17, 4, 6.5, P2)
    inner.ellipse(16, 17, 2, 3.5, C1)
    c.paste(inner)
    return finish(c, ((3, 3, C1), (29, 3, P1)))


@new("bicanhlinhgioi")  # Bí cảnh linh giới — núi lửa tinh thể
def _bicanhlg():
    c = Layer()
    c.paste(shape([(2, 28), (10, 12), (13, 10), (19, 10), (22, 12), (30, 28)], T4, T3, T4))
    c.poly([(12, 10), (14, 6), (18, 6), (20, 10)], R2); c.poly([(14, 9), (16, 5), (18, 9)], R1)
    c.paste(shape([(7, 28), (9, 20), (11, 28)], P2, P1, P3))
    c.paste(shape([(21, 28), (23, 18), (26, 28)], P2, P1, P3))
    c.line(16, 11, 15, 27, R2)
    return finish(c, ((4, 5, P1), (27, 5, R1)))


@new("linhngothiendao")  # Linh ngộ thiên đạo — thái cực
def _taiji():
    c = Layer()
    g = Layer()
    for y in range(N):
        for x in range(N):
            dx, dy = x - 15.5, y - 15.5
            if dx * dx + dy * dy <= 13 ** 2:
                top = (dx * dx + (dy + 6.5) ** 2) <= 6.5 ** 2
                bot = (dx * dx + (dy - 6.5) ** 2) <= 6.5 ** 2
                if bot:
                    col = WHITE
                    if dx * dx + (dy - 6.5) ** 2 <= 2.2 ** 2:
                        col = (40, 44, 60)
                elif top:
                    col = (40, 44, 60)
                    if dx * dx + (dy + 6.5) ** 2 <= 2.2 ** 2:
                        col = WHITE
                else:
                    col = WHITE if dx < 0 else (40, 44, 60)
                g.g[y][x] = col
    c.paste(g)
    return finish(c, ((3, 3, C1), (29, 29, G1)))


@new("thienkiepchiluc")  # Thiên kiếp chi lực — mây sấm + tinh thể tím
def _tkcl():
    c = Layer()
    cl = Layer()
    for cx, cy, r in ((9, 11, 6), (17, 8, 7), (24, 12, 5.5), (16, 14, 7)):
        cl.circle(cx, cy, r, T3)
    c.paste(cl.bevel(T2, T4))
    c.paste(shape([(18, 13), (11, 22), (16, 22), (13, 30), (23, 18), (17, 18), (21, 13)], G2, G1, G3))
    return finish(c, ((3, 25, P1), (28, 26, P1)))


@new("thienkiep")  # Thiên kiếp — sấm sét
def _thienkiep():
    c = Layer()
    c.paste(shape([(19, 2), (7, 17), (14, 17), (11, 30), (26, 12), (18, 12), (23, 2)], G2, G1, G3))
    return finish(c, ((4, 5, P1), (27, 24, P1), (26, 6, WHITE)))


@new("thiennhan")  # Thiên nhân — người có vầng hào quang
def _thiennhan():
    c = Layer()
    for sx in (-1, 1):
        c.paste(shape([(16 + sx * 4, 14), (16 + sx * 14, 6), (16 + sx * 14, 14), (16 + sx * 10, 20), (16 + sx * 4, 22)], S1, WHITE, S3))
    c.paste(shape([(16, 13), (21, 17), (22, 28), (10, 28), (11, 17)], S1, WHITE, S3))
    c.circle(16, 10, 3.4, SKIN); c.rect(13, 6, 19, 7, HAIR)
    ring = Layer(); ring.ellipse(16, 3, 5.5, 2, G2)
    hole = Layer(); hole.ellipse(16, 3, 3.5, 0.9, WHITE)
    for y in range(N):
        for x in range(N):
            if hole.g[y][x] is not None:
                ring.g[y][x] = None
    c.paste(ring)
    return finish(c, ((3, 4, G1), (28, 4, G1)))


@new("taytuydan")  # Tẩy tủy đan — bình thuốc sủi bọt
def _taytuy():
    c = Layer()
    c.paste(shape([(12, 3), (20, 3), (20, 12), (27, 26), (5, 26), (12, 12)], C1, WHITE, C3))
    c.paste(shape([(10, 19), (22, 19), (27, 26), (5, 26)], J2, J1, J4))
    c.rect(11, 1, 21, 3, W2)
    for x, y, r in ((13, 22, 1.6), (18, 21, 1.2), (16, 15, 1.4), (15, 10, 1)):
        c.circle(x, y, r, WHITE)
    return finish(c, ((3, 8, C1), (28, 10, J1)))


@new("khodo")  # Kho đồ — túi trữ vật
def _khodo():
    c = Layer()
    c.paste(shape([(8, 12), (24, 12), (28, 26), (4, 26)], C3, C2, C4))
    c.paste(shape([(11, 6), (21, 6), (23, 12), (9, 12)], C4, C3, C4))
    c.rect(9, 11, 23, 13, G2)
    c.paste(shape([(16, 16), (18.5, 20), (16, 24), (13.5, 20)], G2, G1, G3))
    return finish(c, ((3, 5, C1), (28, 6, WHITE)))


def bar_cell(light, mid, dark):
    """Ô thanh tiến trình: dải liền mạch kín ngang (0..31) để nối nhiều ô thành 1 thanh."""
    c = Layer()
    for y in range(6, 26):
        for x in range(0, 32):
            c.g[y][x] = mid
    for x in range(32):
        c.g[6][x] = OUT; c.g[25][x] = OUT
        c.g[7][x] = light; c.g[8][x] = light
        c.g[23][x] = dark; c.g[24][x] = dark
    return c


def _bar(name, light, mid, dark):
    ICONS[name] = lambda: bar_cell(light, mid, dark)
    NEW.append(name)


_bar("warbar_fill", Q1, Q2, Q3)
_bar("bar_hp", Q1, Q2, Q3)
_bar("bar_tuvi", C1, C3, C4)
_bar("bar_mp", (170, 190, 255), (80, 110, 235), (40, 50, 150))
_bar("bar_lucchien", R1, R2, R3)
_bar("bar_green", L1, L2, L3)
_bar("bar_gold", G1, G2, G3)
_bar("bar_purple", P1, P2, P3)
_bar("warbar_empty", (88, 98, 116), (60, 70, 88), (40, 46, 60))
_bar("bar_empty", (88, 98, 116), (60, 70, 88), (40, 46, 60))


# ================================================================== BATCH 4 — Đại Phú
@new("sukiendaiphu")  # Sự kiện đại phú — túi tiền
def _daiphu():
    c = Layer()
    c.paste(shape([(8, 12), (24, 12), (28, 26), (4, 26)], G3, G2, G4))
    c.paste(shape([(11, 5), (21, 5), (19, 12), (13, 12)], G3, G2, G4))
    c.rect(10, 11, 22, 13, Q2)
    c.circle(16, 20, 4, G1); c.circle(16, 20, 2, G3)
    return finish(c, ((3, 4, G1), (28, 5, WHITE), (28, 28, G1)))


@new("sk_coin")
def _coin():
    c = Layer()
    c.paste(disc(16, 16, 12, G2, G1, G4))
    c.circle(16, 16, 8, G3); c.rect(14, 10, 17, 21, G1); c.rect(11, 13, 21, 15, G1); c.rect(11, 18, 21, 19, G1)
    return finish(c, ((3, 4, WHITE), (28, 27, G1)))


@new("sk_tien")
def _tien():
    c = Layer()
    c.paste(shape([(3, 9), (29, 9), (29, 23), (3, 23)], J2, J1, J4))
    c.circle(16, 16, 4, J1); c.rect(15, 13, 16, 19, J4)
    c.circle(7, 16, 1.5, J4); c.circle(25, 16, 1.5, J4)
    return finish(c, ((3, 4, J1), (28, 27, WHITE)))


@new("sk_thitruong")
def _thitruong():
    c = Layer()
    c.paste(shape([(3, 3), (29, 3), (29, 29), (3, 29)], S4, S3, S4))
    for x, h, col in ((6, 8, C2), (12, 14, J2), (18, 10, G2), (24, 19, Q2)):
        c.paste(shape([(x, 27 - h), (x + 4, 27 - h), (x + 4, 27), (x, 27)], col, WHITE, S4))
    return finish(c, ())


@new("sk_tang")
def _tang():
    c = Layer()
    c.paste(shape([(4, 8), (28, 8), (28, 28), (4, 28)], S4, S3, S4))
    c.line(6, 24, 12, 18, J2, 3); c.line(12, 18, 17, 21, J2, 3); c.line(17, 21, 25, 11, J2, 3)
    c.paste(shape([(27, 6), (27, 15), (19, 11)], J1, WHITE, J3, 0))
    return finish(c, ())


@new("sk_giam")
def _giam():
    c = Layer()
    c.paste(shape([(4, 4), (28, 4), (28, 24), (4, 24)], S4, S3, S4))
    c.line(6, 8, 12, 14, Q2, 3); c.line(12, 14, 17, 11, Q2, 3); c.line(17, 11, 25, 21, Q2, 3)
    c.paste(shape([(27, 27), (27, 18), (19, 22)], Q1, WHITE, Q3, 0))
    return finish(c, ())


@new("sk_mua")
def _mua():
    c = Layer()
    c.paste(shape([(7, 11), (27, 11), (24, 22), (10, 22)], W2, W1, W4))
    c.line(2, 4, 6, 4, S3, 2); c.line(5, 4, 9, 18, S3, 2); c.line(9, 18, 24, 18, S3, 1)
    c.circle(11, 26, 2.2, S3); c.circle(22, 26, 2.2, S3)
    c.circle(16, 14, 2, G2)
    return finish(c, ((28, 5, G1),))


@new("sk_taisan")
def _taisan():
    c = Layer()
    c.paste(shape([(10, 6), (22, 6), (22, 10), (10, 10)], W4, W3, W4))
    c.paste(shape([(3, 10), (29, 10), (29, 27), (3, 27)], W2, W1, W4))
    c.rect(3, 17, 29, 18, W4); c.rect(14, 15, 18, 20, G2)
    return finish(c, ((3, 4, G1),))


@new("sk_thienco")
def _thienco():
    c = Layer()
    c.paste(shape([(8, 24), (24, 24), (21, 29), (11, 29)], G3, G2, G4))
    c.paste(disc(16, 14, 11, P2, P1, P3))
    c.circle(12, 9, 2.4, WHITE)
    c.sparkle(20, 17, P1)
    return finish(c, ((3, 4, P1), (28, 5, WHITE)))


@new("sk_ngaunhien")
def _ngaunhien():
    c = Layer()
    c.paste(shape([(4, 4), (28, 4), (28, 28), (4, 28)], WHITE, WHITE, S3))
    for x, y in ((9, 9), (23, 9), (16, 16), (9, 23), (23, 23)):
        c.circle(x, y, 2.2, Q2)
    return finish(c, ())


@new("sk_nhiemvu")
def _nhiemvu():
    c = Layer()
    c.paste(disc(16, 16, 13, WHITE, WHITE, S3))
    c.circle(16, 16, 10, Q2); c.circle(16, 16, 7, WHITE); c.circle(16, 16, 4, Q2); c.circle(16, 16, 1.5, WHITE)
    c.line(16, 16, 27, 5, W3, 1); c.poly([(27, 2), (30, 5), (27, 8)], G2)
    return finish(c, ())


@new("sk_thuongvu")
def _thuongvu():
    c = Layer()
    for i, (x, y) in enumerate(((6, 20), (13, 16), (20, 12))):
        c.paste(disc(x + 3, y + 3, 6, G2, G1, G4))
        c.circle(x + 3, y + 3, 3, G3)
    return finish(c, ((3, 4, G1), (28, 5, WHITE)))


@new("sk_baohiem")
def _baohiem():
    c = Layer()
    c.paste(shape([(5, 5), (16, 2), (27, 5), (25, 18), (16, 29), (7, 18)], J2, J1, J4))
    c.rect(14, 9, 18, 21, WHITE); c.rect(10, 13, 22, 17, WHITE)
    return finish(c, ((3, 3, J1), (28, 27, WHITE)))


@new("sk_xephang")
def _xephang():
    c = Layer()
    c.paste(shape([(8, 2), (14, 2), (18, 14), (12, 14)], C3, C2, C4))
    c.paste(shape([(18, 2), (24, 2), (20, 14), (14, 14)], Q2, Q1, Q3))
    c.paste(disc(16, 21, 8, G2, G1, G4))
    c.rect(15, 17, 17, 25, G4); c.rect(13, 18, 15, 19, G4)
    return finish(c, ((3, 24, G1), (28, 26, WHITE)))


@new("sk_danhhieu")
def _danhhieu():
    c = Layer()
    c.paste(shape([(3, 24), (3, 9), (10, 16), (16, 5), (22, 16), (29, 9), (29, 24)], G2, G1, G3))
    c.rect(3, 24, 29, 28, G3)
    for x, col in ((7, Q2), (16, C2), (25, J2)):
        c.circle(x, 21, 2, col)
    return finish(c, ((4, 3, G1), (27, 3, WHITE)))


@new("sk_phanthuong")
def _phanthuong():
    c = Layer()
    c.paste(shape([(4, 15), (28, 15), (28, 28), (4, 28)], Q2, Q1, Q3))
    c.paste(shape([(3, 10), (29, 10), (29, 15), (3, 15)], Q1, K1, Q3))
    c.rect(14, 10, 18, 28, G2)
    c.paste(shape([(16, 10), (8, 4), (6, 9), (12, 11)], G2, G1, G3))
    c.paste(shape([(16, 10), (24, 4), (26, 9), (20, 11)], G2, G1, G3))
    return finish(c, ((3, 4, G1), (28, 3, WHITE)))


@new("sk_canhbao")
def _canhbao():
    c = Layer()
    c.paste(shape([(16, 3), (30, 28), (2, 28)], G2, G1, G4))
    c.rect(15, 11, 17, 21, OUT); c.rect(15, 23, 17, 25, OUT)
    return finish(c, ((3, 4, G1),))


@new("sk_camkhoa")
def _camkhoa():
    c = Layer()
    sh = Layer(); sh.circle(16, 11, 8, S3)
    hole = Layer(); hole.circle(16, 11, 4.6, WHITE)
    for y in range(N):
        for x in range(N):
            if hole.g[y][x] is not None or y > 13:
                sh.g[y][x] = None
    c.paste(sh.bevel(S2, S4))
    c.paste(shape([(6, 13), (26, 13), (26, 28), (6, 28)], Q2, Q1, Q3))
    c.circle(16, 20, 2.2, OUT); c.rect(15, 21, 17, 25, OUT)
    return finish(c, ())


@new("sk_thoigian")
def _thoigian():
    c = Layer()
    c.paste(shape([(7, 3), (25, 3), (25, 6), (7, 6)], W2, W1, W4))
    c.paste(shape([(7, 26), (25, 26), (25, 29), (7, 29)], W2, W1, W4))
    c.paste(shape([(9, 6), (23, 6), (17, 16), (23, 26), (9, 26), (15, 16)], C1, WHITE, C3))
    c.poly([(12, 24), (20, 24), (16, 19)], G2)
    c.poly([(14, 7), (18, 7), (16, 11)], G2)
    return finish(c, ((3, 4, C1), (28, 28, WHITE)))


# ================================================================== BATCH 5 — mới trong v7
@new("hp")
def _hp():
    c = Layer()
    heart(c, 16, 12, 9, Q2, Q1, Q3)
    c.circle(11, 10, 1.6, WHITE)
    return finish(c, ((3, 3, Q1), (28, 27, WHITE)))


@new("mp")
def _mp():
    c = Layer()
    c.paste(shape([(16, 2), (24, 14), (25, 20), (22, 26), (16, 29), (10, 26), (7, 20), (8, 14)], (90, 120, 240), (170, 190, 255), (40, 50, 150)))
    c.rect(11, 17, 12, 23, WHITE)
    return finish(c, ((3, 4, C1), (28, 6, WHITE)))


@new("satthuong")  # Sát thương
def _satthuong():
    c = Layer()
    pts = []
    for i in range(20):
        r = 14 if i % 2 == 0 else 7
        a = math.pi * 2 * i / 20
        pts.append((16 + math.cos(a) * r, 16 + math.sin(a) * r))
    c.paste(shape(pts, R2, R1, R4))
    c.circle(16, 16, 5, WHITE)
    return finish(c, ())


@new("thongtin")
def _thongtin():
    c = Layer()
    c.paste(disc(16, 16, 13, C3, C2, C4))
    c.rect(14, 14, 17, 24, WHITE); c.rect(14, 8, 17, 11, WHITE)
    return finish(c, ((3, 3, C1), (28, 28, WHITE)))


@new("loa")  # Loa thông báo
def _loa():
    c = Layer()
    c.paste(shape([(4, 12), (11, 12), (24, 4), (24, 28), (11, 20), (4, 20)], G2, G1, G4))
    c.rect(11, 20, 15, 28, G3)
    for r in (3, 6):
        for a in range(-50, 51, 8):
            ra = math.radians(a)
            c.px(25 + math.cos(ra) * r, 16 + math.sin(ra) * r * 1.6, WHITE)
    return finish(c, ((3, 4, G1),))


# ---------------------------------------------------------- phẩm chất (6 bậc)
RARITY = [
    ("rar_pham", (170, 178, 189)), ("rar_phothong", (117, 201, 139)), ("rar_hiem", (101, 189, 235)),
    ("rar_suthi", (185, 154, 232)), ("rar_truyenthuyet", (214, 181, 109)), ("rar_thanthoai", (227, 108, 117)),
]


def _rar(name, col):
    def draw():
        c = Layer()
        li, mi, da = tri(col)
        base_g = shape([(16, 3), (27, 13), (16, 29), (5, 13)], mi, li, da)
        top = Layer(); top.poly([(16, 3), (27, 13), (5, 13)], li); top.clip_to(base_g)
        left = Layer(); left.poly([(5, 13), (16, 13), (16, 29)], mix(mi, da, 0.2)); left.clip_to(base_g)
        right = Layer(); right.poly([(16, 13), (27, 13), (16, 29)], da); right.clip_to(base_g)
        for l in (base_g, top, left, right):
            c.paste(l)
        c.line(5, 13, 27, 13, li)
        return finish(c, ((3, 4, WHITE), (28, 5, li)))
    ICONS[name] = draw
    NEW.append(name)


for _n, _c in RARITY:
    _rar(_n, _c)


# ---------------------------------------------------------- 15 đại cảnh giới
REALM_COL = [
    (150, 156, 170), (117, 201, 139), (101, 189, 235), (90, 130, 230), (185, 154, 232),
    (230, 130, 200), (140, 110, 230), (80, 210, 200), (214, 181, 109), (227, 108, 117),
    (235, 235, 245), (255, 215, 90), (255, 160, 70), (255, 110, 110), (255, 230, 120),
]


def _realm(i, col):
    def draw():
        c = Layer()
        li, mi, da = tri(col)
        c.paste(disc(16, 16, 13, mi, li, da))
        ring = Layer(); ring.circle(16, 16, 10, mix(mi, WHITE, 0.25))
        hole = Layer(); hole.circle(16, 16, 8, WHITE)
        for y in range(N):
            for x in range(N):
                if hole.g[y][x] is not None:
                    ring.g[y][x] = None
        c.paste(ring)
        inner = mix(mi, (15, 15, 30), 0.65)
        c.circle(16, 16, 8, inner)
        sym = mix(col, WHITE, 0.6)
        if i == 0:
            c.circle(16, 17, 3, T2)
        elif i == 1:
            c.poly([(16, 9), (21, 15), (16, 23), (11, 15)], L2)
        elif i == 2:
            c.rect(12, 12, 20, 20, G2)
        elif i == 3:
            c.circle(16, 16, 4, R2); c.circle(15, 15, 1.2, WHITE)
        elif i == 4:
            c.circle(16, 12, 2.5, SKIN); c.poly([(16, 15), (21, 22), (11, 22)], P2)
        elif i == 5:
            c.poly([(16, 8), (21, 17), (16, 23), (11, 17)], C2); c.poly([(16, 13), (18, 18), (14, 18)], WHITE)
        elif i == 6:
            for r, cc in ((6, P2), (4, C2), (2, WHITE)):
                c.circle(16, 16, r, cc)
        elif i == 7:
            c.circle(13, 16, 4, sym); c.circle(19, 16, 4, G2)
        elif i == 8:
            for a in range(0, 360, 60):
                ra = math.radians(a)
                c.circle(16 + math.cos(ra) * 4, 16 + math.sin(ra) * 4, 2.2, K2)
            c.circle(16, 16, 2, G2)
        elif i == 9:
            c.poly([(18, 8), (12, 17), (16, 17), (14, 24), (21, 14), (17, 14)], G2)
        elif i == 10:
            c.poly([(16, 8), (18, 14), (24, 14), (19, 18), (21, 24), (16, 20), (11, 24), (13, 18), (8, 14), (14, 14)], WHITE)
        elif i == 11:
            c.poly([(16, 8), (18, 14), (24, 14), (19, 18), (21, 24), (16, 20), (11, 24), (13, 18), (8, 14), (14, 14)], G2)
        elif i == 12:
            c.circle(16, 16, 6, G2); c.circle(16, 16, 4, inner); c.circle(16, 16, 2, G1)
        elif i == 13:
            c.circle(16, 16, 4, R2)
            for a in range(0, 360, 45):
                ra = math.radians(a)
                c.line(16 + math.cos(ra) * 5, 16 + math.sin(ra) * 5, 16 + math.cos(ra) * 8, 16 + math.sin(ra) * 8, R1)
        else:
            c.poly([(9, 22), (9, 11), (13, 16), (16, 9), (19, 16), (23, 11), (23, 22)], G2)
        pips = 0 if i in (0,) else (i % 5)
        for k in range(pips):
            c.px(6 + k * 2, 27, sym)
        return finish(c, ((3, 3, li), (29, 29, WHITE)))
    ICONS[f"canhgioi_{i}"] = draw
    NEW.append(f"canhgioi_{i}")


for _i, _c in enumerate(REALM_COL):
    _realm(_i, _c)


# ================================================================== xuất file
def render_all(out_dir, with_old=True):
    os.makedirs(out_dir, exist_ok=True)
    names = (list(base.ORDER) if with_old else []) + [n for n in NEW if n not in base.ORDER]
    ims = {}
    for name in names:
        if name not in ICONS:
            continue
        im = ICONS[name]().render()
        assert im.size == (128, 128), name
        im.save(os.path.join(out_dir, f"{name}.png"), optimize=True)
        ims[name] = im
    return ims


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(root, "assets", "emoji")
    # `bequan` gốc là ảnh thật 256px → bản v7 vẽ lại bằng pixel (đã có trong NEW) nên bỏ khỏi ORDER của bản cũ
    ims = render_all(out_dir)
    print(f"✅ Đã vẽ {len(ims)} emoji pixel (128x128) -> {out_dir}")
    if "--sheet" in sys.argv:
        names = list(ims)
        cols = 12
        rows = (len(names) + cols - 1) // cols
        cell = 76
        sheet = Image.new("RGBA", (cols * cell, rows * cell), (32, 36, 44, 255))
        for i, n in enumerate(names):
            im = ims[n].resize((68, 68), Image.NEAREST)
            sheet.alpha_composite(im, ((i % cols) * cell + 4, (i // cols) * cell + 4))
        sheet.save(os.path.join(root, "assets", "emoji_preview_v7.png"))
        small = Image.new("RGBA", (cols * 30, rows * 30), (49, 51, 56, 255))
        for i, n in enumerate(names):
            s = ims[n].resize((22, 22), Image.LANCZOS)
            small.alpha_composite(s, ((i % cols) * 30 + 4, (i // cols) * 30 + 4))
        small.resize((small.width * 3, small.height * 3), Image.NEAREST).save(os.path.join(root, "assets", "emoji_preview_v7_small.png"))
        print("🖼️  Đã ghi assets/emoji_preview_v7.png")


if __name__ == "__main__":
    main()
