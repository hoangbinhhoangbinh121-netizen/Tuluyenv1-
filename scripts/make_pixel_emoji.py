#!/usr/bin/env python3
"""
make_pixel_emoji.py — vẽ bộ emoji pixel tu tiên cho Tu Luyện Bot.

Mỗi icon vẽ trên lưới 32x32, tự thêm viền nâu đậm + bevel sáng/tối, rồi phóng
x4 (nearest-neighbor) thành PNG 128x128 trong suốt (chuẩn emoji Discord, nhẹ
hơn nhiều so với giới hạn 256 KB).

Chạy:  python make_pixel_emoji.py            -> ghi vào assets/emoji/
       python make_pixel_emoji.py --sheet    -> thêm ảnh xem trước emoji_preview.png
"""
import math
import os
import sys
from PIL import Image

N = 32
SCALE = 4

# ---------------------------------------------------------------- palette
OUT = (42, 26, 18)            # viền nâu đậm (cùng tông viền ngôi sao đột phá)
WHITE = (255, 255, 255)
G1, G2, G3, G4 = (255, 240, 150), (255, 205, 55), (225, 150, 20), (150, 85, 10)
S1, S2, S3, S4 = (245, 250, 255), (195, 210, 230), (135, 155, 185), (82, 98, 130)
J1, J2, J3, J4 = (200, 255, 225), (95, 228, 165), (30, 172, 112), (10, 105, 78)
C1, C2, C3, C4 = (205, 250, 255), (110, 225, 250), (40, 160, 215), (20, 88, 160)
R1, R2, R3, R4 = (255, 240, 160), (255, 170, 50), (238, 78, 30), (150, 28, 22)
P1, P2, P3, P4 = (240, 210, 255), (185, 125, 245), (118, 62, 192), (58, 24, 110)
W1, W2, W3, W4 = (200, 140, 88), (150, 98, 54), (100, 62, 34), (62, 36, 20)
T1, T2, T3, T4 = (210, 210, 222), (156, 156, 172), (104, 104, 124), (62, 62, 82)
L1, L2, L3, L4 = (200, 255, 150), (115, 212, 72), (52, 150, 52), (20, 88, 40)
Q1, Q2, Q3 = (250, 120, 108), (205, 52, 52), (140, 26, 36)
K1, K2, K3 = (255, 205, 220), (255, 130, 175), (215, 70, 125)   # hồng sen
PAPER1, PAPER2, PAPER3 = (255, 244, 205), (238, 218, 165), (196, 164, 108)


class Layer:
    """Một lớp pixel 32x32 (None = trong suốt)."""

    def __init__(self):
        self.g = [[None] * N for _ in range(N)]

    # --- primitives -----------------------------------------------------
    def px(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < N and 0 <= y < N:
            self.g[y][x] = c

    def rect(self, x0, y0, x1, y1, c):
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                self.px(x, y, c)

    def ellipse(self, cx, cy, rx, ry, c, rot=0.0):
        cs, sn = math.cos(rot), math.sin(rot)
        m = int(max(rx, ry)) + 2
        for y in range(int(cy) - m, int(cy) + m + 1):
            for x in range(int(cx) - m, int(cx) + m + 1):
                dx, dy = x - cx, y - cy
                u = dx * cs + dy * sn
                v = -dx * sn + dy * cs
                if (u / (rx + 0.4)) ** 2 + (v / (ry + 0.4)) ** 2 <= 1.0:
                    self.px(x, y, c)

    def circle(self, cx, cy, r, c):
        self.ellipse(cx, cy, r, r, c)

    def poly(self, pts, c):
        ys = [p[1] for p in pts]
        for y in range(int(min(ys)), int(max(ys)) + 1):
            xs = []
            n = len(pts)
            for i in range(n):
                (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
                if y0 == y1:
                    continue
                if min(y0, y1) <= y + 0.5 < max(y0, y1):
                    xs.append(x0 + (y + 0.5 - y0) * (x1 - x0) / (y1 - y0))
            xs.sort()
            for i in range(0, len(xs) - 1, 2):
                for x in range(int(round(xs[i])), int(round(xs[i + 1]))):
                    self.px(x, y, c)

    def line(self, x0, y0, x1, y1, c, w=1):
        steps = int(max(abs(x1 - x0), abs(y1 - y0))) * 2 + 1
        for i in range(steps + 1):
            t = i / steps
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            if w <= 1:
                self.px(x, y, c)
            else:
                self.ellipse(x, y, w / 2, w / 2, c)

    def sparkle(self, x, y, c=WHITE, big=False):
        self.px(x, y, c)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            self.px(x + dx, y + dy, c)
        if big:
            for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)):
                self.px(x + dx, y + dy, c)

    # --- helpers --------------------------------------------------------
    def mask(self):
        return [[self.g[y][x] is not None for x in range(N)] for y in range(N)]

    def bevel(self, light, dark):
        """Cạnh trên-trái sáng, cạnh dưới-phải tối (trong phạm vi lớp này)."""
        m = self.mask()
        new = [row[:] for row in self.g]
        for y in range(N):
            for x in range(N):
                if not m[y][x]:
                    continue
                up = y == 0 or not m[y - 1][x]
                left = x == 0 or not m[y][x - 1]
                down = y == N - 1 or not m[y + 1][x]
                right = x == N - 1 or not m[y][x + 1]
                if down or right:
                    new[y][x] = dark
                elif up or left:
                    new[y][x] = light
        self.g = new
        return self

    def paste(self, other):
        for y in range(N):
            for x in range(N):
                if other.g[y][x] is not None:
                    self.g[y][x] = other.g[y][x]
        return self

    def clip_to(self, other):
        """Chỉ giữ pixel nằm trong mask của `other`."""
        m = other.mask()
        for y in range(N):
            for x in range(N):
                if not m[y][x]:
                    self.g[y][x] = None
        return self

    def outline(self, c=OUT):
        m = self.mask()
        for y in range(N):
            for x in range(N):
                if m[y][x]:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < N and 0 <= yy < N and m[yy][xx]:
                        self.g[y][x] = c
                        break
        return self

    def render(self):
        im = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        for y in range(N):
            for x in range(N):
                c = self.g[y][x]
                if c is not None:
                    im.putpixel((x, y), (c[0], c[1], c[2], 255))
        return im.resize((N * SCALE, N * SCALE), Image.NEAREST)


def solid(draw_fn, light, dark):
    """Tạo lớp có bevel từ một hàm vẽ."""
    l = Layer()
    draw_fn(l)
    return l.bevel(light, dark)


# ================================================================ ICONS
ICONS = {}


def icon(name):
    def deco(fn):
        ICONS[name] = fn
        return fn
    return deco


@icon("tienkim")  # Tiên Kim — quặng vàng tiên
def _tienkim():
    c = Layer()
    blob = [(5, 22), (7, 15), (12, 10), (19, 8), (25, 13), (28, 21), (24, 27), (10, 27)]
    base = Layer(); base.poly(blob, G3); base.bevel(G1, G4)
    c.paste(base)
    top = Layer(); top.poly([(8, 16), (12, 12), (19, 10), (24, 14), (18, 17), (11, 19)], G2)
    top.clip_to(base); c.paste(top)
    c.poly([(12, 23), (18, 20), (25, 23), (22, 26), (13, 26)], G4)
    for p in ((10, 18), (16, 13), (21, 15)):
        c.px(*p, G1)
    for p in ((14, 22), (20, 24), (9, 23)):
        c.px(*p, S1)          # vân bạc
    c.outline()
    c.sparkle(5, 6); c.sparkle(27, 5, G1)
    return c


@icon("tienngoc")  # Tiên Ngọc — ngọc bích tiên
def _tienngoc():
    c = Layer()
    c.poly([(9, 9), (23, 9), (29, 15), (16, 29), (3, 15)], J3)
    c.poly([(9, 9), (23, 9), (20, 15), (12, 15)], J1)       # mặt trên
    c.poly([(3, 15), (9, 9), (12, 15), (16, 29)], J2)        # mặt trái
    c.poly([(29, 15), (23, 9), (20, 15), (16, 29)], J4)      # mặt phải
    c.poly([(12, 15), (20, 15), (16, 29)], J3)               # mặt giữa
    c.line(9, 9, 12, 15, WHITE); c.line(23, 9, 20, 15, J1)
    c.px(11, 11, WHITE); c.px(12, 11, WHITE)
    c.outline()
    c.sparkle(5, 5); c.sparkle(27, 7, J1)
    return c


@icon("thienhoatinh")  # Thiên Hỏa Tinh — tinh thể lửa
def _thienhoatinh():
    c = Layer()
    # ngọn lửa cháy phía sau
    c.poly([(3, 28), (2, 17), (6, 9), (8, 16), (11, 12), (11, 28)], R2)
    c.poly([(21, 28), (21, 12), (25, 8), (28, 17), (29, 28)], R2)
    c.poly([(14, 12), (16, 2), (19, 12)], R2)
    c.poly([(5, 27), (5, 19), (7, 14), (9, 20), (9, 27)], R1)
    c.poly([(23, 27), (24, 16), (26, 19), (27, 27)], R1)
    # tinh thể (đỏ thẫm -> hồng đỏ, khác tông với ngọn lửa cam)
    c.poly([(16, 8), (24, 14), (22, 27), (10, 27), (8, 14)], (200, 40, 70))
    c.poly([(16, 8), (8, 14), (10, 27), (16, 27)], (130, 20, 60))
    c.poly([(16, 8), (24, 14), (22, 27), (16, 27)], (240, 70, 80))
    c.poly([(16, 12), (19, 16), (19, 22), (16, 25), (13, 22), (13, 16)], R1)
    c.line(16, 9, 16, 26, WHITE)
    c.outline()
    c.sparkle(4, 5, R1); c.sparkle(28, 4, G1)
    return c


@icon("hukhongkettinh")  # Hư Không Kết Tinh — tinh thể hư không
def _hukhong():
    c = Layer()
    c.poly([(7, 28), (4, 15), (9, 9), (12, 16), (12, 28)], P2)          # mảnh trái
    c.poly([(20, 28), (20, 16), (24, 8), (28, 14), (27, 28)], P3)       # mảnh phải
    c.poly([(11, 29), (10, 14), (16, 2), (22, 14), (21, 29)], P3)       # mảnh chính
    c.poly([(16, 2), (10, 14), (11, 29), (16, 29)], P2)
    c.poly([(16, 2), (22, 14), (21, 29), (16, 29)], P4)
    c.line(16, 4, 16, 27, P1)
    c.outline()
    for p in ((3, 5), (28, 4), (6, 23), (26, 22)):
        c.sparkle(*p, C1)
    c.px(14, 12, WHITE); c.px(18, 18, C2)
    return c


@icon("thiendaothach")  # Thiên Đạo Thạch — đá khắc lôi văn
def _thiendaothach():
    c = Layer()
    st = Layer(); st.poly([(8, 6), (24, 6), (27, 10), (26, 26), (23, 29), (9, 29), (6, 26), (5, 10)], T2)
    st.bevel(T1, T4)
    c.paste(st)
    c.rect(9, 9, 12, 12, T1)
    # tia sét vàng
    bolt = [(19, 7), (10, 18), (15, 18), (12, 28), (23, 14), (17, 14)]
    c.poly(bolt, G2)
    c.poly([(18, 9), (13, 17), (16, 17)], G1)
    c.outline()
    c.sparkle(4, 4, C1); c.sparkle(28, 26, G1)
    return c


@icon("manhtiengioilenh")  # Mảnh Tiên Giới Lệnh — mảnh vỡ của lệnh bài ngọc
def _manh():
    c = Layer()
    shard = [(3, 27), (5, 10), (13, 4), (22, 7), (28, 14), (21, 17), (25, 23), (17, 28), (10, 25)]
    b = Layer(); b.poly(shard, J3); b.bevel(J1, J4)
    c.paste(b)
    c.line(7, 12, 5, 25, G2); c.line(8, 9, 13, 6, G2); c.line(13, 6, 20, 9, G2)   # viền vàng còn sót
    c.circle(13, 17, 4, G2); c.circle(13, 17, 2, J4); c.px(13, 17, G1)
    c.line(18, 12, 21, 12, J1); c.line(17, 24, 20, 22, J4)
    c.line(21, 17, 18, 20, J4)                                                      # vết nứt
    c.outline()
    c.sparkle(27, 5, WHITE); c.sparkle(5, 4, J1)
    return c


@icon("daonguyentinh")  # Đạo Nguyên Tinh — thái cực nguyên tinh
def _daonguyen():
    c = Layer()
    c.circle(16, 16, 13, C2)         # quầng sáng
    c.circle(16, 16, 11, S1)
    # thái cực
    for y in range(N):
        for x in range(N):
            if (x - 16) ** 2 + (y - 16) ** 2 <= 10 ** 2:
                c.px(x, y, (20, 52, 125) if x < 16 else (240, 252, 255))
    c.circle(16, 11, 5, (20, 52, 125))
    c.circle(16, 21, 5, (240, 252, 255))
    c.circle(16, 11, 2, (240, 252, 255))
    c.circle(16, 21, 2, (20, 52, 125))
    c.outline()
    c.sparkle(4, 4, WHITE); c.sparkle(28, 5, C1); c.sparkle(27, 27, WHITE)
    return c


@icon("thiendaoan")  # Thiên Đạo Ấn — ấn ngọc triện đỏ, quai vàng
def _thiendaoan():
    c = Layer()
    body = Layer(); body.rect(6, 15, 26, 28, Q2); body.bevel(Q1, Q3)
    c.paste(body)
    base = Layer(); base.rect(5, 24, 27, 28, G3); base.bevel(G1, G4)
    c.paste(base)
    knob = Layer(); knob.poly([(12, 5), (20, 5), (22, 9), (20, 15), (12, 15), (10, 9)], G2); knob.bevel(G1, G4)
    c.paste(knob)
    c.rect(14, 8, 18, 10, G4)              # lỗ quai
    # ký tự triện trên thân
    for p in ((10, 18), (11, 18), (12, 18), (15, 18), (16, 18), (19, 18), (20, 18), (21, 18),
              (10, 21), (13, 21), (14, 21), (17, 21), (18, 21), (21, 21)):
        c.px(*p, G2)
    c.outline()
    c.sparkle(4, 8, G1); c.sparkle(28, 9, WHITE)
    return c


@icon("thuongcothuho")  # Thượng Cổ Thủ Hộ — khiên đá cổ khắc văn
def _thuongco():
    c = Layer()
    sh = [(4, 5), (28, 5), (28, 17), (16, 30), (4, 17)]
    b = Layer(); b.poly(sh, G3); b.bevel(G1, G4)
    c.paste(b)
    inner = Layer(); inner.poly([(7, 8), (25, 8), (25, 16), (16, 26), (7, 16)], T3)
    inner.bevel(T2, T4)
    c.paste(inner)
    # mắt/rune xanh phát sáng
    c.poly([(16, 11), (20, 16), (16, 21), (12, 16)], C3)
    c.poly([(16, 13), (18, 16), (16, 19), (14, 16)], C1)
    c.px(16, 16, WHITE)
    c.line(9, 10, 12, 10, T1); c.line(20, 10, 23, 10, T1)
    c.outline()
    c.sparkle(3, 3, C1)
    return c


@icon("thiennhanngusuy")  # Thiên Nhân Ngũ Suy — hoa năm cánh tàn úa
def _ngusuy():
    c = Layer()
    cols = [P2, P3, (150, 110, 170), (125, 115, 140), (100, 100, 115)]
    for i in range(5):
        a = -math.pi / 2 + i * 2 * math.pi / 5
        cx, cy = 16 + math.cos(a) * 7, 14 + math.sin(a) * 7
        c.ellipse(cx, cy, 6, 3.2, cols[i], rot=a)
    c.circle(16, 14, 3, P4)
    c.circle(16, 14, 1, G2)
    # cánh rơi
    c.ellipse(9, 27, 2.4, 1.4, (150, 110, 170), rot=0.5); c.ellipse(22, 28, 2.4, 1.4, (125, 115, 140), rot=-0.4)
    c.ellipse(27, 22, 1.8, 1.2, P3, rot=0.8)
    c.outline()
    c.sparkle(4, 5, P1)
    return c


@icon("phagioidan")  # Đan Dược Phá Giới — đan đỏ vết nứt vàng + đồng hồ
def _phagioi():
    c = Layer()
    pill = Layer(); pill.circle(14, 19, 10, R3); pill.bevel(R2, R4)
    c.paste(pill)
    c.ellipse(10, 14, 3, 2, R1, rot=-0.6)
    # vết nứt sét vàng
    c.line(14, 10, 17, 15, G1); c.line(17, 15, 12, 19, G1); c.line(12, 19, 17, 25, G1)
    # đồng hồ nhỏ
    clk = Layer(); clk.circle(25, 8, 6, S1); clk.bevel(WHITE, S3)
    c.paste(clk)
    c.circle(25, 8, 4, WHITE)
    c.line(25, 8, 25, 5, OUT); c.line(25, 8, 27, 9, OUT)
    c.outline()
    c.sparkle(4, 5, G1)
    return c


@icon("linhduocdacbiet")  # Linh Dược Đặc Biệt — linh thảo phát sáng
def _linhduoc():
    c = Layer()
    c.line(16, 29, 16, 13, L3, 2)
    c.ellipse(10, 20, 6, 3, L2, rot=-0.6)
    c.ellipse(22, 17, 6, 3, L2, rot=0.6)
    c.ellipse(11, 26, 4, 2, L3, rot=-0.4)
    c.ellipse(21, 25, 4, 2, L3, rot=0.4)
    c.px(8, 19, L1); c.px(9, 19, L1); c.px(20, 16, L1); c.px(21, 16, L1)
    # nụ phát sáng
    c.poly([(16, 3), (20, 8), (19, 13), (16, 15), (13, 13), (12, 8)], C2)
    c.poly([(16, 5), (18, 9), (17, 12), (16, 13), (15, 12), (14, 9)], C1)
    c.outline()
    c.sparkle(5, 8, C1); c.sparkle(27, 7, L1); c.sparkle(26, 24, C1)
    return c


@icon("ruong")  # Rương Thần Bí — rương gỗ viền vàng, ánh tím
def _ruong():
    c = Layer()
    body = Layer(); body.rect(4, 16, 28, 29, W2); body.bevel(W1, W4)
    c.paste(body)
    lid = Layer(); lid.poly([(4, 16), (4, 12), (8, 8), (24, 8), (28, 12), (28, 16)], W2); lid.bevel(W1, W3)
    c.paste(lid)
    for x in (7, 22):                              # đai vàng
        c.rect(x, 8, x + 3, 29, G3)
        c.line(x, 9, x, 28, G1)
    c.rect(4, 15, 28, 16, G4)
    c.rect(13, 14, 19, 22, G2); c.rect(13, 14, 19, 14, G1)
    c.rect(15, 17, 17, 19, P4); c.px(16, 20, P4)       # lỗ khoá
    c.outline()
    c.sparkle(16, 3, P1, True); c.sparkle(6, 5, P2); c.sparkle(26, 5, P2)
    return c


@icon("sk_nganKho")  # Ngân Khố — nguyên bảo bạc
def _ngankho():
    c = Layer()
    bowl = Layer(); bowl.poly([(2, 14), (9, 19), (23, 19), (30, 14), (26, 26), (6, 26)], S2); bowl.bevel(S1, S3)
    c.paste(bowl)
    bump = Layer(); bump.ellipse(16, 13, 8, 5, S1); bump.bevel(WHITE, S3)
    c.paste(bump)
    c.ellipse(16, 12, 5, 3, S3)
    c.ellipse(16, 11, 4, 2, S2)
    c.line(8, 23, 24, 23, S3)
    c.outline()
    c.sparkle(4, 6, WHITE, True); c.sparkle(28, 6, G1)
    c.px(16, 12, WHITE)
    return c


@icon("sk_luat")  # Luật — cuộn thẻ luật đóng ấn đỏ
def _luat():
    c = Layer()
    paper = Layer(); paper.rect(8, 6, 24, 26, PAPER1); paper.bevel(WHITE, PAPER3)
    c.paste(paper)
    for y in (10, 13, 16, 19):                      # dòng chữ
        c.line(11, y, 21, y, W3)
    c.line(11, 22, 16, 22, W3)
    for y in (3, 24):                               # trục cuộn
        r = Layer(); r.rect(5, y, 27, y + 3, W2); r.bevel(W1, W4); c.paste(r)
        c.rect(3, y, 5, y + 3, G2); c.rect(27, y, 29, y + 3, G2)
    seal = Layer(); seal.rect(18, 18, 23, 23, Q2); seal.bevel(Q1, Q3)
    c.paste(seal)
    c.px(20, 20, Q1); c.px(21, 21, Q1)
    c.outline()
    return c


# ---------------------------------------------------------------- menu / nút
@icon("nghenghiep")  # Nghề Nghiệp / Luyện Khí — đe rèn có tia lửa
def _nghenghiep():
    c = Layer()
    top = Layer(); top.poly([(2, 12), (8, 10), (27, 10), (27, 16), (8, 16)], S3); top.bevel(S2, S4)
    c.paste(top)
    waist = Layer(); waist.poly([(10, 16), (22, 16), (20, 22), (12, 22)], S4); waist.bevel(S3, T4)
    c.paste(waist)
    base = Layer(); base.rect(7, 22, 25, 27, S3); base.bevel(S2, S4)
    c.paste(base)
    c.line(9, 11, 25, 11, S1)
    c.outline()
    for p in ((10, 4), (16, 3), (22, 5)):
        c.px(*p, R1); c.px(p[0], p[1] + 1, R2)
    c.px(13, 7, R2); c.px(19, 7, R3); c.px(7, 6, R2)
    return c


@icon("khac")  # Khác — càn khôn túi
def _khac():
    c = Layer()
    bag = Layer(); bag.ellipse(16, 20, 11, 9, C3); bag.bevel(C2, C4)
    c.paste(bag)
    neck = Layer(); neck.poly([(11, 8), (21, 8), (22, 13), (10, 13)], C3); neck.bevel(C2, C4)
    c.paste(neck)
    frill = Layer(); frill.poly([(9, 4), (11, 6), (13, 4), (16, 6), (19, 4), (21, 6), (23, 4), (21, 9), (11, 9)], C2)
    frill.bevel(C1, C3)
    c.paste(frill)
    c.rect(10, 11, 22, 12, Q2); c.px(10, 11, Q1)               # dây buộc
    c.line(16, 12, 13, 16, Q2); c.line(16, 12, 19, 16, Q2)      # đuôi dây
    c.circle(16, 22, 4, G2); c.px(16, 22, G4); c.px(15, 20, G1)  # ấn vàng
    c.outline()
    c.sparkle(5, 6, WHITE); c.sparkle(27, 8, C1)
    return c


@icon("hoihp")  # Hồi HP — hồ lô thuốc ngọc
def _hoihp():
    c = Layer()
    top = Layer(); top.circle(16, 9, 5, J2); top.bevel(J1, J4)
    bot = Layer(); bot.circle(16, 21, 9, J2); bot.bevel(J1, J4)
    c.paste(bot); c.paste(top)
    c.rect(13, 14, 19, 15, J3)
    c.rect(14, 2, 18, 4, Q2); c.px(14, 2, Q1)       # nút bần đỏ
    c.line(13, 14, 19, 14, Q2)                      # dây
    # dấu cộng trắng
    c.rect(15, 18, 17, 24, WHITE); c.rect(13, 20, 19, 22, WHITE)
    c.outline()
    c.sparkle(5, 8, J1); c.sparkle(27, 12, WHITE)
    return c


@icon("vundap")  # Vun Đắp — đoá sen hồng
def _vundap():
    c = Layer()
    c.ellipse(9, 27, 7, 2, L3, rot=-0.15); c.ellipse(23, 27, 7, 2, L3, rot=0.15)
    c.ellipse(8, 18, 4, 9, K3, rot=-0.7); c.ellipse(24, 18, 4, 9, K3, rot=0.7)
    c.ellipse(11, 16, 4, 10, K2, rot=-0.3); c.ellipse(21, 16, 4, 10, K2, rot=0.3)
    c.ellipse(16, 14, 4, 10, K1)
    c.ellipse(16, 12, 1.6, 5, WHITE)
    c.circle(16, 22, 3, G2); c.px(16, 22, G4)
    c.outline()
    c.sparkle(5, 5, K1); c.sparkle(27, 6, WHITE)
    return c


@icon("bosstg")  # Boss Thế Giới — đầu rồng
def _bosstg():
    c = Layer()
    c.poly([(11, 11), (8, 2), (16, 8)], G2)                       # sừng
    c.poly([(17, 9), (19, 2), (23, 11)], G2)
    c.poly([(3, 15), (7, 10), (14, 8), (22, 10), (29, 14), (28, 18), (19, 17), (9, 18)], R3)   # hàm trên
    c.poly([(8, 19), (19, 19), (28, 20), (25, 25), (14, 26), (7, 24)], R4)                        # hàm dưới
    c.poly([(3, 15), (1, 21), (7, 20), (9, 18)], R4)                                              # bờm
    c.poly([(5, 9), (3, 4), (9, 8)], R4)
    for x in (12, 16, 20, 24):                                                                    # răng
        c.poly([(x, 18), (x + 2, 18), (x + 1, 21)], WHITE)
    c.rect(14, 12, 17, 14, G2); c.rect(15, 12, 16, 14, OUT)       # mắt rồng
    c.px(26, 15, OUT); c.px(26, 16, OUT)                          # lỗ mũi
    c.line(13, 10, 18, 9, R2)
    c.outline()
    c.px(28, 19, R2); c.px(29, 20, R1)
    c.sparkle(5, 28, R2)
    return c


@icon("nhapcode")  # Nhập Code — chìa khoá vàng khảm ngọc
def _nhapcode():
    c = Layer()
    c.line(13, 13, 25, 25, G3, 4)
    c.line(13, 13, 25, 25, G2, 2)
    c.line(21, 25, 25, 21, G3, 3); c.line(24, 28, 28, 24, G3, 3)        # răng khoá
    ring = Layer(); ring.circle(10, 10, 8, G2); ring.bevel(G1, G4)
    c.paste(ring)
    c.circle(10, 10, 4, OUT)
    c.circle(10, 10, 3, J2); c.px(9, 9, J1)
    c.outline()
    c.sparkle(27, 5, WHITE); c.sparkle(4, 27, G1)
    return c


@icon("bando")  # Bản Đồ / Khai Phá Động Phủ — bản đồ da dê
def _bando():
    c = Layer()
    m = Layer(); m.poly([(3, 7), (28, 6), (29, 13), (27, 19), (29, 26), (4, 27), (5, 20), (3, 14)], PAPER2)
    m.bevel(PAPER1, PAPER3)
    c.paste(m)
    c.poly([(7, 20), (11, 13), (15, 20)], L3); c.poly([(13, 20), (18, 11), (24, 20)], L2)
    c.px(18, 12, WHITE); c.px(11, 14, WHITE)
    for x in (8, 12, 16, 20):                      # đường đi chấm đỏ
        c.px(x, 23, Q2)
    c.px(23, 22, Q2); c.px(24, 21, Q2)
    c.line(21, 8, 26, 13, Q3); c.line(26, 8, 21, 13, Q3)   # dấu X
    c.outline()
    c.sparkle(5, 3, WHITE)
    return c


@icon("tientinh")  # Tiên Tinh — tiền cổ vàng viền linh quang
def _tientinh():
    c = Layer()
    c.circle(16, 16, 14, C2)
    coin = Layer(); coin.circle(16, 16, 12, G2); coin.bevel(G1, G4)
    c.paste(coin)
    c.circle(16, 16, 9, G3)
    c.circle(16, 16, 8, G2)
    c.rect(13, 13, 19, 19, OUT)                     # lỗ vuông
    c.line(8, 8, 11, 8, G1); c.line(8, 8, 8, 11, G1)
    c.px(16, 6, G4); c.px(16, 26, G4); c.px(6, 16, G4); c.px(26, 16, G4)
    c.outline()
    c.sparkle(3, 3, WHITE); c.sparkle(29, 28, C1)
    return c


@icon("yeuhach")  # Yêu Hạch — lõi yêu thú, mắt dọc
def _yeuhach():
    c = Layer()
    orb = Layer(); orb.circle(16, 17, 12, R3); orb.bevel(R2, R4)
    c.paste(orb)
    c.circle(16, 17, 8, R4)
    c.ellipse(16, 17, 6, 4, G2)                       # tròng mắt
    c.ellipse(16, 17, 1.4, 4, OUT)                    # con ngươi dọc
    c.px(12, 15, G1); c.px(13, 14, G1)
    c.poly([(7, 8), (5, 2), (12, 6)], P3); c.poly([(25, 8), (27, 2), (20, 6)], P3)   # sừng nhỏ
    c.outline()
    c.sparkle(4, 25, R2); c.sparkle(28, 27, P2)
    return c



# ------------------------------------------------ tài nguyên Vạn Linh Cốc
@icon("hukhongtinhhoa")  # Hư Không Tinh Hoa — xoáy tinh hoa hư không
def _hukhongtinhhoa():
    c = Layer()
    orb = Layer(); orb.circle(16, 16, 12, P4); orb.bevel(P3, (30, 12, 70))
    c.paste(orb)
    # xoáy ốc 2 nhánh
    for arm, col in ((0.0, C2), (math.pi, P2)):
        t = 0.0
        while t < 4.6:
            r = 1.5 + t * 2.0
            x = 16 + math.cos(t + arm) * r
            y = 16 + math.sin(t + arm) * r
            c.circle(x, y, 1.1, col)
            t += 0.12
    c.circle(16, 16, 2, WHITE)
    c.outline()
    c.sparkle(4, 5, C1); c.sparkle(28, 6, P1); c.sparkle(27, 27, C1)
    return c


@icon("huyenthiet")  # Huyền Thiết — thỏi sắt đen huyền
def _huyenthiet():
    c = Layer()
    back = Layer(); back.poly([(9, 8), (24, 8), (27, 15), (6, 15)], (70, 76, 104)); back.bevel((130, 140, 175), (36, 40, 62))
    c.paste(back)
    front = Layer(); front.poly([(3, 16), (29, 16), (26, 27), (6, 27)], (52, 58, 86)); front.bevel((115, 125, 160), (26, 28, 46))
    c.paste(front)
    c.line(6, 18, 26, 18, (150, 160, 195))
    c.line(10, 10, 22, 10, (150, 160, 195))
    for p in ((10, 23), (16, 22), (22, 24)):
        c.px(*p, P2)                                   # ánh huyền tím
    c.outline()
    c.sparkle(5, 4, P1); c.sparkle(27, 6, C1)
    return c


@icon("manhphapbao")  # Mảnh Pháp Bảo — mảnh vỡ pháp bảo vàng khảm ngọc
def _manhphapbao():
    c = Layer()
    shard = [(4, 24), (6, 12), (13, 5), (20, 8), (27, 6), (26, 15), (21, 19), (24, 27), (14, 27), (9, 29)]
    b = Layer(); b.poly(shard, G3); b.bevel(G1, G4)
    c.paste(b)
    c.poly([(9, 13), (14, 8), (19, 11), (14, 15)], G2)
    c.circle(15, 20, 4, P3); c.circle(15, 20, 2, P1); c.px(14, 19, WHITE)      # ngọc khảm
    c.line(21, 11, 25, 9, G4); c.line(8, 25, 11, 27, G4)
    c.outline()
    c.sparkle(4, 5, WHITE); c.sparkle(28, 22, P1)
    return c



# ------------------------------------------------ nút & menu còn lại (v10)
SKIN = (255, 224, 186)
HAIR = (52, 40, 66)


@icon("xacnhan")  # ✅ Xác nhận / Chấp nhận — vòng ngọc có dấu tích
def _xacnhan():
    c = Layer()
    d = Layer(); d.circle(16, 16, 13, J3); d.bevel(J1, J4)
    c.paste(d)
    c.line(9, 17, 14, 22, WHITE, 3); c.line(14, 22, 23, 10, WHITE, 3)
    c.outline()
    c.sparkle(4, 4, J1); c.sparkle(28, 27, WHITE)
    return c


@icon("tuchoi")  # ❌ Từ chối / Huỷ — vòng đỏ có dấu chéo
def _tuchoi():
    c = Layer()
    d = Layer(); d.circle(16, 16, 13, Q2); d.bevel(Q1, Q3)
    c.paste(d)
    c.line(10, 10, 22, 22, WHITE, 3); c.line(22, 10, 10, 22, WHITE, 3)
    c.outline()
    c.sparkle(4, 4, Q1); c.sparkle(28, 27, WHITE)
    return c


@icon("lammoi")  # 🔄 Làm mới — hai mũi tên xoay vòng
def _lammoi():
    c = Layer()
    ring = Layer(); ring.circle(16, 16, 12, C3); ring.bevel(C2, C4)
    inner = Layer(); inner.circle(16, 16, 8, WHITE)
    for y in range(N):
        for x in range(N):
            if inner.g[y][x] is not None:
                ring.g[y][x] = None
            elif ring.g[y][x] is not None:
                a = math.degrees(math.atan2(y - 16, x - 16)) % 360
                for gap in (40, 220):
                    if min(abs(a - gap), 360 - abs(a - gap)) < 19:
                        ring.g[y][x] = None
    c.paste(ring)
    for a_deg in (20, 200):                              # đầu mũi tên theo chiều kim đồng hồ
        a = math.radians(a_deg)
        bx, by = 16 + math.cos(a) * 10, 16 + math.sin(a) * 10
        tx, ty = -math.sin(a), math.cos(a)
        nx, ny = math.cos(a), math.sin(a)
        c.poly([(bx + nx * 6.5, by + ny * 6.5), (bx - nx * 6.5, by - ny * 6.5), (bx + tx * 8, by + ty * 8)], C2)
    c.outline()
    c.sparkle(4, 4, C1); c.sparkle(28, 28, WHITE)
    return c


@icon("kenhrieng")  # Kênh Riêng — ổ khoá ngọc
def _kenhrieng():
    c = Layer()
    c.ellipse(16, 12, 8, 9, G3); c.ellipse(16, 13, 4.2, 6, None)
    body = Layer(); body.rect(6, 14, 26, 28, J3); body.bevel(J1, J4)
    c.paste(body)
    c.rect(6, 17, 26, 18, G2)
    c.circle(16, 22, 2.4, OUT); c.rect(15, 23, 17, 26, OUT)
    c.outline()
    c.sparkle(4, 5, J1); c.sparkle(28, 6, WHITE)
    return c


@icon("thuhoach")  # Thu Hoạch — giỏ linh thảo
def _thuhoach():
    c = Layer()
    for x, y, rot, col in ((10, 12, -0.7, L2), (22, 12, 0.7, L2), (16, 9, 0, L1)):
        c.ellipse(x, y, 3, 7, col, rot=rot)
    c.px(16, 4, C1); c.px(16, 5, C1)
    b = Layer(); b.poly([(5, 17), (27, 17), (24, 29), (8, 29)], W2); b.bevel(W1, W4)
    c.paste(b)
    c.rect(4, 16, 28, 18, W3)
    for y in (21, 25):
        c.line(7, y, 25, y, W3)
    for x in (11, 16, 21):
        c.line(x, 18, x - 1, 28, W3)
    c.outline()
    c.sparkle(4, 8, L1); c.sparkle(28, 6, C1)
    return c


@icon("nangcap")  # Nâng Cấp — mũi tên linh quang đi lên
def _nangcap():
    c = Layer()
    a = Layer(); a.poly([(16, 2), (28, 15), (21, 15), (21, 29), (11, 29), (11, 15), (4, 15)], J2); a.bevel(J1, J4)
    c.paste(a)
    c.line(16, 8, 16, 24, J1)
    c.outline()
    c.sparkle(4, 24, G1); c.sparkle(28, 26, WHITE); c.sparkle(5, 5, J1)
    return c


@icon("gianhap")  # Gia Nhập — cổng tông môn
def _gianhap():
    c = Layer()
    roof = Layer(); roof.poly([(1, 9), (4, 5), (28, 5), (31, 9), (27, 12), (5, 12)], (70, 84, 128)); roof.bevel((130, 150, 200), (36, 44, 80))
    c.paste(roof)
    c.rect(8, 6, 24, 7, G2)
    for x in (6, 23):
        p = Layer(); p.rect(x, 12, x + 3, 29, Q2); p.bevel(Q1, Q3); c.paste(p)
    beam = Layer(); beam.rect(5, 15, 27, 18, Q2); beam.bevel(Q1, Q3); c.paste(beam)
    c.rect(13, 8, 19, 12, G2); c.rect(15, 9, 17, 11, Q3)
    c.rect(10, 19, 21, 29, (40, 36, 70))
    c.line(10, 29, 21, 29, G3)
    c.outline()
    c.sparkle(4, 25, G1); c.sparkle(28, 25, WHITE)
    return c


@icon("conghien")  # Cống Hiến — hộp lễ vật đỏ thắt nơ vàng
def _conghien():
    c = Layer()
    box = Layer(); box.rect(6, 14, 26, 28, Q2); box.bevel(Q1, Q3); c.paste(box)
    lid = Layer(); lid.rect(4, 10, 28, 15, Q1); lid.bevel((255, 170, 160), Q3); c.paste(lid)
    rib = Layer(); rib.rect(14, 10, 18, 28, G2); rib.bevel(G1, G4); c.paste(rib)
    c.ellipse(11, 6, 4.5, 3, G2, rot=-0.5); c.ellipse(21, 6, 4.5, 3, G2, rot=0.5); c.circle(16, 8, 2.2, G3)
    c.outline()
    c.sparkle(4, 20, G1); c.sparkle(28, 22, WHITE)
    return c


@icon("thanhvien")  # Thành Viên — hai đạo hữu
def _thanhvien():
    c = Layer()
    for cx, robe in ((10, C3), (22, P3)):
        c.poly([(cx - 7, 29), (cx - 5, 17), (cx + 5, 17), (cx + 7, 29)], robe)
        c.poly([(cx - 1, 17), (cx + 1, 17), (cx, 25)], WHITE)
        c.circle(cx, 11, 5, SKIN)
        c.ellipse(cx, 7, 5.2, 3, HAIR); c.circle(cx, 4, 2.2, HAIR)
    c.outline()
    c.sparkle(3, 4, WHITE); c.sparkle(29, 4, C1)
    return c


@icon("roitongmon")  # Rời Tông Môn — cờ hiệu tông môn đuôi nhạn
def _roitongmon():
    c = Layer()
    c.rect(4, 2, 28, 4, W3)
    ban = Layer(); ban.poly([(7, 4), (25, 4), (25, 27), (16, 22), (7, 27)], Q2); ban.bevel(Q1, Q3)
    c.paste(ban)
    c.line(10, 7, 22, 7, G2); c.line(10, 19, 14, 19, G2); c.line(18, 19, 22, 19, G2)
    c.circle(16, 13, 4, G2); c.circle(16, 13, 2, Q3)
    c.outline()
    c.sparkle(2, 24, Q1); c.sparkle(30, 26, WHITE)
    return c


@icon("doiten")  # Đổi Tên — bút lông
def _doiten():
    c = Layer()
    c.line(26, 3, 13, 17, W2, 4)
    c.line(26, 3, 13, 17, W1, 2)
    c.line(14, 16, 11, 19, G3, 4)
    c.ellipse(8, 23, 5, 2.4, (48, 44, 70), rot=0.95)
    c.poly([(5, 27), (3, 29), (7, 27)], (48, 44, 70))
    c.outline()
    for p in ((3, 30), (7, 30), (11, 29)):
        c.px(*p, (48, 44, 70))
    c.sparkle(26, 24, WHITE); c.sparkle(5, 5, P1)
    return c


@icon("bonhiem")  # Bổ Nhiệm — huân chương ngọc, dải lụa đỏ
def _bonhiem():
    c = Layer()
    c.poly([(8, 2), (16, 2), (20, 15), (13, 15)], Q2); c.poly([(16, 2), (24, 2), (19, 15), (12, 15)], C3)
    med = Layer(); med.circle(16, 21, 9, G2); med.bevel(G1, G4); c.paste(med)
    c.circle(16, 21, 6, G3)
    c.poly([(16, 16), (18, 20), (22, 20), (19, 23), (20, 27), (16, 25), (12, 27), (13, 23), (10, 20), (14, 20)], G1)
    c.outline()
    c.sparkle(4, 8, WHITE); c.sparkle(28, 12, G1)
    return c


@icon("nhapid")  # Nhập ID — thẻ bài ghi tên, con trỏ gõ
def _nhapid():
    c = Layer()
    tag = Layer(); tag.rect(4, 8, 28, 25, PAPER1); tag.bevel(WHITE, PAPER3); c.paste(tag)
    c.rect(4, 8, 28, 10, G3)
    c.circle(8, 16, 2.4, SKIN); c.rect(5, 19, 11, 22, C3)
    c.line(14, 15, 24, 15, W3); c.line(14, 19, 22, 19, W3)
    c.rect(23, 18, 24, 22, C3)
    c.line(16, 3, 16, 8, Q2, 2); c.circle(16, 3, 1.6, Q2)
    c.outline()
    c.sparkle(29, 4, WHITE)
    return c


@icon("dieukien")  # Điều Kiện — thẻ trúc buộc dây đỏ
def _dieukien():
    c = Layer()
    for i in range(5):
        x = 4 + i * 5
        s = Layer(); s.rect(x, 4, x + 3, 28, (214, 196, 120)); s.bevel((250, 238, 170), (150, 126, 60)); c.paste(s)
        for y in (9, 14, 19):
            c.px(x + 1, y, W3)
    c.rect(3, 8, 28, 9, Q2); c.rect(3, 22, 28, 23, Q2)
    c.outline()
    c.sparkle(29, 4, G1)
    return c


@icon("satchieu")  # Sát Chiêu — kiếm khí bùng nổ
def _satchieu():
    c = Layer()
    pts = []
    for i in range(16):
        r = 14 if i % 2 == 0 else 7
        a = i * math.pi / 8 - math.pi / 2
        pts.append((16 + math.cos(a) * r, 16 + math.sin(a) * r))
    c.poly(pts, Q2)
    pts2 = []
    for i in range(16):
        r = 9 if i % 2 == 0 else 4.5
        a = i * math.pi / 8 - math.pi / 2
        pts2.append((16 + math.cos(a) * r, 16 + math.sin(a) * r))
    c.poly(pts2, R2)
    c.line(6, 26, 26, 6, WHITE, 3)
    c.line(9, 26, 26, 9, S2)
    c.outline()
    return c


@icon("nhangioi")  # Nhân Giới — nhà tranh và cây
def _nhangioi():
    c = Layer()
    c.ellipse(16, 27, 14, 3, L3)
    wall = Layer(); wall.rect(5, 16, 18, 27, PAPER2); wall.bevel(PAPER1, PAPER3); c.paste(wall)
    roof = Layer(); roof.poly([(2, 17), (11, 7), (21, 17)], Q2); roof.bevel(Q1, Q3); c.paste(roof)
    c.rect(9, 20, 13, 27, W3); c.rect(14, 19, 16, 21, C2)
    c.rect(24, 19, 26, 28, W3)
    c.circle(25, 14, 6, L2); c.circle(23, 12, 3, L1)
    c.outline()
    c.sparkle(4, 5, L1); c.sparkle(28, 5, WHITE)
    return c


@icon("thamgia")  # Tham Gia — lệnh bài tròn có dấu cộng
def _thamgia():
    c = Layer()
    d = Layer(); d.circle(16, 16, 13, G3); d.bevel(G1, G4); c.paste(d)
    j = Layer(); j.circle(16, 16, 10, J3); j.bevel(J2, J4); c.paste(j)
    c.rect(14, 9, 18, 23, WHITE); c.rect(9, 14, 23, 18, WHITE)
    c.outline()
    c.sparkle(4, 4, G1); c.sparkle(28, 28, J1)
    return c


@icon("batdautran")  # Bắt Đầu Trận — trống trận và dùi
def _batdautran():
    c = Layer()
    c.line(7, 3, 14, 11, W2, 3); c.line(25, 3, 18, 11, W2, 3)
    c.circle(6, 3, 2, G2); c.circle(26, 3, 2, G2)
    body = Layer(); body.rect(5, 12, 27, 26, Q2); body.bevel(Q1, Q3); c.paste(body)
    top = Layer(); top.ellipse(16, 12, 11, 4, PAPER2); top.bevel(PAPER1, PAPER3); c.paste(top)
    c.ellipse(16, 26, 11, 3, Q3)
    for x in (8, 12, 16, 20, 24):
        c.px(x, 15, G2); c.px(x, 23, G2)
    c.line(5, 19, 27, 19, G3)
    c.outline()
    c.sparkle(3, 24, R2); c.sparkle(29, 25, R1)
    return c


@icon("roicudiem")  # Rời Cứ Điểm — cờ trắng rút lui
def _roicudiem():
    c = Layer()
    c.line(7, 3, 7, 29, W3, 2)
    c.circle(7, 3, 2, G2)
    f = Layer(); f.poly([(8, 4), (27, 6), (23, 11), (27, 17), (8, 16)], S1); f.bevel(WHITE, S3); c.paste(f)
    c.line(11, 8, 22, 9, S2); c.line(11, 12, 20, 13, S2)
    c.rect(4, 28, 11, 29, W2)
    c.outline()
    c.sparkle(26, 24, WHITE); c.sparkle(20, 26, S2)
    return c


# ================================================================== main
ORDER = [
    "tienkim", "tienngoc", "thienhoatinh", "hukhongkettinh", "thiendaothach",
    "manhtiengioilenh", "daonguyentinh", "thiendaoan", "thuongcothuho", "thiennhanngusuy",
    "phagioidan", "linhduocdacbiet", "ruong", "sk_nganKho", "sk_luat",
    "nghenghiep", "khac", "hoihp", "vundap", "bosstg", "nhapcode", "bando",
    "tientinh", "yeuhach",
    "hukhongtinhhoa", "huyenthiet", "manhphapbao",
    # v10 — nút & menu còn lại
    "xacnhan", "tuchoi", "lammoi", "kenhrieng", "thuhoach", "nangcap", "gianhap",
    "conghien", "thanhvien", "roitongmon", "doiten", "bonhiem", "nhapid", "dieukien",
    "satchieu", "nhangioi", "thamgia", "batdautran", "roicudiem",
]


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.join(here, "assets", "emoji")
    os.makedirs(out_dir, exist_ok=True)
    ims = {}
    for name in ORDER:
        layer = ICONS[name]()
        im = layer.render()
        im.save(os.path.join(out_dir, f"{name}.png"), optimize=True)
        ims[name] = im
    print(f"✅ Đã vẽ {len(ims)} emoji pixel -> {out_dir}")
    if "--sheet" in sys.argv:
        cols = 6
        rows = (len(ORDER) + cols - 1) // cols
        cell = 150
        sheet = Image.new("RGBA", (cols * cell, rows * cell), (54, 57, 63, 255))
        for i, name in enumerate(ORDER):
            im = ims[name]
            sheet.paste(im, ((i % cols) * cell + 11, (i // cols) * cell + 11), im)
        sheet.save(os.path.join(here, "emoji_preview.png"))
        # bản nhỏ 22px y như hiển thị trên nút Discord
        small = Image.new("RGBA", (cols * 40, rows * 40), (54, 57, 63, 255))
        for i, name in enumerate(ORDER):
            s = ims[name].resize((32, 32), Image.LANCZOS)
            small.paste(s, ((i % cols) * 40 + 4, (i // cols) * 40 + 4), s)
        small = small.resize((small.width * 3, small.height * 3), Image.NEAREST)
        small.save(os.path.join(here, "emoji_preview_small.png"))
        print("🖼️  Đã ghi emoji_preview.png")


if __name__ == "__main__":
    main()
