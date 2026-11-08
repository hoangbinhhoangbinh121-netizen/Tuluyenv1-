#!/usr/bin/env python3
"""
make_pixel_emoji_v14_pets.py — vẽ emoji pixel Linh Thú v14.0: 45 loài (pet_<id>), 9 huy hiệu phẩm cấp (pet_tier1..9),
trứng (pet_trung), 3 khế ước (pet_khe_binhdang/chuto/banmenh) và vật phẩm (luong, phu, huyet, chau).
Dùng lại bộ vẽ của make_pixel_emoji_v12_streak.py (lưới 64x64 -> PNG 128x128, viền nâu, sáng/tối). KHÔNG ghi đè emoji cũ.
Chạy:  python3 scripts/make_pixel_emoji_v14_pets.py [--preview file.png]
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_pixel_emoji_v12_streak import canvas, part, compose, sparkle, save, G
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets', 'emoji')
# hành: (chính, tối, sáng)
PAL = [((205, 212, 228, 255), (140, 148, 172, 255), (250, 252, 255, 255)),   # Kim
       ((88, 184, 88, 255), (46, 120, 56, 255), (170, 235, 140, 255)),       # Mộc
       ((70, 144, 232, 255), (36, 86, 170, 255), (150, 210, 255, 255)),      # Thủy
       ((238, 92, 42, 255), (170, 46, 24, 255), (255, 190, 80, 255)),        # Hỏa
       ((196, 144, 74, 255), (128, 88, 40, 255), (240, 200, 130, 255))]      # Thổ
GLOW = [(220, 230, 255), (120, 230, 120), (110, 190, 255), (255, 140, 60), (230, 180, 90)]
TIERC = [(236, 236, 236, 255), (90, 210, 100, 255), (70, 140, 240, 255), (170, 110, 60, 255), (170, 90, 230, 255),
         (250, 205, 50, 255), (255, 140, 40, 255), (235, 50, 50, 255), (90, 40, 140, 255)]
EYE = (30, 20, 30, 255)
WHITE = (255, 255, 255, 255)


def body_kim(m, dk, lt):   # sói kim: thân thon, tai nhọn, đuôi như lưỡi kiếm
    def a(d):
        d.polygon([(6, 36), (20, 30), (22, 40), (10, 46)], fill=dk)                         # đuôi
        d.ellipse([14, 28, 44, 50], fill=m)
        d.rectangle([17, 46, 21, 56], fill=dk); d.rectangle([36, 46, 40, 56], fill=dk)      # chân
        d.ellipse([34, 14, 56, 36], fill=m)                                                  # đầu
        d.polygon([(36, 16), (38, 5), (44, 14)], fill=m); d.polygon([(48, 14), (52, 5), (55, 18)], fill=m)  # tai
        d.polygon([(50, 26), (62, 30), (52, 34)], fill=lt)                                   # mõm
    def b(d):
        d.rectangle([44, 21, 47, 24], fill=(255, 70, 70, 255)); d.point((45, 22), fill=WHITE)  # mắt
        d.polygon([(22, 32), (40, 32), (34, 40), (26, 40)], fill=lt)                          # ngực sáng
        d.line([(16, 34), (30, 30)], fill=lt)
    return [part(a), part(b, 40, 40)]


def body_moc(m, dk, lt):   # hươu mộc: gạc nhánh lá
    def a(d):
        d.ellipse([10, 30, 42, 52], fill=m)
        for x in (14, 18, 34, 38): d.rectangle([x, 46, x + 3, 58], fill=dk)
        d.rectangle([34, 20, 42, 36], fill=m)                                                  # cổ
        d.ellipse([36, 12, 56, 30], fill=m)
        d.polygon([(50, 22), (62, 26), (52, 30)], fill=lt)
        d.ellipse([8, 34, 14, 42], fill=lt)                                                     # đuôi
    def g(d):   # gạc
        d.line([(40, 12), (36, 3)], fill=dk, width=2); d.line([(46, 12), (52, 3)], fill=dk, width=2)
        d.line([(38, 8), (32, 6)], fill=dk, width=2); d.line([(50, 8), (57, 6)], fill=dk, width=2)
        for p in [(36, 3), (52, 3), (32, 6), (57, 6)]: d.ellipse([p[0] - 2, p[1] - 2, p[0] + 2, p[1] + 2], fill=lt)
    def b(d):
        d.rectangle([47, 18, 49, 20], fill=EYE)
        d.ellipse([16, 33, 26, 40], fill=lt); d.ellipse([27, 38, 35, 44], fill=lt)             # lá trên lưng
    return [part(a), part(g, 60, 60), part(b, 40, 40)]


def body_thuy(m, dk, lt):  # cá/giao long thủy
    def a(d):
        d.polygon([(4, 20), (18, 32), (4, 46)], fill=dk)                                       # đuôi
        d.ellipse([12, 18, 54, 48], fill=m)
        d.polygon([(26, 18), (36, 6), (42, 18)], fill=dk)                                       # vây lưng
        d.polygon([(26, 46), (34, 58), (40, 46)], fill=dk)                                      # vây bụng
    def b(d):
        d.ellipse([20, 32, 48, 46], fill=lt)                                                    # bụng
        d.ellipse([42, 26, 50, 34], fill=WHITE); d.rectangle([46, 28, 48, 31], fill=EYE)
        for x, y in [(22, 24), (28, 27), (34, 24)]: d.arc([x, y, x + 6, y + 5], 200, 340, fill=lt)  # vảy
        d.line([(52, 36), (56, 36)], fill=dk)
    def bub(d):
        for x, y, r in [(56, 14, 3), (52, 8, 2), (58, 24, 2)]: d.ellipse([x - r, y - r, x + r, y + r], outline=lt)
    return [part(a), part(b, 60, 40), part(bub, 0, 0)]


def body_hoa(m, dk, lt):   # phượng hỏa
    def a(d):
        d.polygon([(2, 40), (16, 34), (20, 44), (4, 58), (10, 46)], fill=dk)                    # đuôi lửa
        d.polygon([(2, 28), (18, 36), (6, 40)], fill=m)
        d.ellipse([14, 26, 42, 52], fill=m)
        d.ellipse([34, 12, 54, 32], fill=m)
        d.polygon([(52, 20), (62, 24), (52, 28)], fill=(250, 200, 50, 255))                     # mỏ
        d.polygon([(38, 12), (40, 3), (45, 11)], fill=lt); d.polygon([(44, 11), (49, 2), (50, 12)], fill=m)  # mào lửa
    def w(d):
        d.polygon([(18, 30), (34, 34), (30, 50), (14, 46)], fill=dk)
        d.polygon([(20, 34), (30, 36), (27, 46), (17, 44)], fill=lt)
    def b(d):
        d.ellipse([44, 17, 48, 21], fill=EYE); d.point((45, 17), fill=WHITE)
        d.rectangle([22, 50, 24, 58], fill=(250, 200, 50, 255)); d.rectangle([30, 50, 32, 58], fill=(250, 200, 50, 255))
    return [part(a), part(w, 70, 70), part(b, 30, 30)]


def body_tho(m, dk, lt):   # huyền vũ thổ: mai rùa lục giác
    def a(d):
        d.ellipse([46, 28, 62, 44], fill=dk)                                                    # đầu
        d.rectangle([12, 44, 22, 56], fill=dk); d.rectangle([36, 44, 46, 56], fill=dk)           # chân
        d.polygon([(2, 46), (10, 44), (8, 52)], fill=dk)                                         # đuôi
        d.pieslice([8, 10, 50, 62], 180, 360, fill=m)                                            # mai
        d.rectangle([8, 36, 50, 46], fill=m)
    def b(d):
        for pts in [[(22, 20), (34, 20), (38, 28), (34, 36), (22, 36), (18, 28)]]: d.polygon(pts, outline=dk, fill=lt)
        d.line([(18, 28), (10, 28)], fill=dk); d.line([(38, 28), (46, 28)], fill=dk)
        d.line([(22, 20), (16, 14)], fill=dk); d.line([(34, 20), (40, 14)], fill=dk)
        d.rectangle([54, 32, 56, 34], fill=EYE); d.point((55, 32), fill=WHITE)
    return [part(a), part(b, 40, 60)]


BODY = [body_kim, body_moc, body_thuy, body_hoa, body_tho]


def wings(col):
    def w(d):
        d.polygon([(30, 30), (4, 6), (6, 22), (0, 24), (8, 34), (26, 38)], fill=col)
        d.polygon([(34, 30), (60, 6), (58, 22), (63, 24), (56, 34), (38, 38)], fill=col)
    return part(w, 60, 90)


def halo(col):
    def h(d):
        d.ellipse([18, 0, 46, 8], outline=col, width=2)
    return part(h, 60, 40)


def species(line, tier):
    m, dk, lt = PAL[line]
    parts = []
    tc = TIERC[tier - 1]
    if tier >= 6:
        parts.append(wings((tc[0], tc[1], tc[2], 235)))
    parts += BODY[line](m, dk, lt)
    if tier >= 7:
        parts.append(halo(tc))
    # hàng chấm phẩm cấp (n chấm) ở đáy — nhìn nhanh biết phẩm
    def pips(d):
        n = tier; w = n * 4 - 1; x0 = 32 - w // 2
        for i in range(n): d.rectangle([x0 + i * 4, 60, x0 + i * 4 + 2, 62], fill=tc)
    parts.append(part(pips, 70, 70))
    glow = GLOW[line] if tier >= 4 else None
    if tier == 9: glow = (150, 80, 220)
    im = compose(parts, glow=glow)
    if tier >= 3:
        for x, y, r in [(6, 8, 2 + tier // 4), (58, 10, 2)][: 1 + (tier >= 5)]: sparkle(im, x, y, r, col=(255, 244, 190, 255))
    if tier >= 8:
        sparkle(im, 56, 52, 3, col=(255, 200, 200, 255))
    return im


def tier_badge(tier):
    tc = TIERC[tier - 1]; dk = tuple(int(c * 0.55) for c in tc[:3]) + (255,)
    def a(d):
        d.ellipse([8, 8, 56, 56], fill=dk); d.ellipse([13, 13, 51, 51], fill=tc)
    def b(d):
        n = tier; pts = []
        import math
        for i in range(n):
            ang = -math.pi / 2 + 2 * math.pi * i / n if n > 1 else 0
            r = 0 if n == 1 else 12
            pts.append((32 + r * math.cos(ang), 32 + r * math.sin(ang)))
        for x, y in pts: d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(255, 255, 255, 255))
    return compose([part(a, 90, 90), part(b, 0, 60)], glow=tc[:3] if tier >= 4 else None)


def egg():
    def a(d):
        d.ellipse([14, 12, 50, 58], fill=(246, 236, 210, 255))
    def b(d):
        for x, y, r, c in [(24, 28, 4, (240, 110, 80, 255)), (40, 36, 5, (90, 180, 240, 255)), (28, 46, 4, (110, 200, 110, 255)), (38, 22, 3, (250, 200, 60, 255))]:
            d.ellipse([x - r, y - r, x + r, y + r], fill=c)
        d.line([(22, 20), (26, 16)], fill=WHITE, width=2)
    return compose([part(a, 100, 90), part(b, 40, 40)], glow=(255, 230, 160))


def contract(kind):
    def ring(d, col):
        d.ellipse([10, 20, 40, 50], outline=col, width=5)
    if kind == 'binhdang':       # hai vòng nối nhau
        a = part(lambda d: d.ellipse([6, 20, 36, 50], outline=(120, 200, 255, 255), width=5), 90, 90)
        b = part(lambda d: d.ellipse([26, 20, 56, 50], outline=(255, 210, 90, 255), width=5), 90, 90)
        return compose([a, b], glow=(200, 230, 255))
    if kind == 'chuto':          # xích + vòng cổ
        a = part(lambda d: d.ellipse([12, 28, 52, 58], outline=(190, 70, 60, 255), width=6), 90, 90)
        def s(d): d.rectangle([28, 8, 36, 30], fill=(190, 190, 205, 255)); d.rectangle([24, 4, 40, 10], fill=(150, 150, 170, 255))
        return compose([a, part(s)], glow=(255, 120, 100))
    def h(d):                    # bản mệnh: trái tim huyết trong vòng
        d.ellipse([8, 8, 56, 56], outline=(250, 205, 60, 255), width=3)
        d.ellipse([16, 18, 32, 34], fill=(225, 40, 60, 255)); d.ellipse([32, 18, 48, 34], fill=(225, 40, 60, 255))
        d.polygon([(16, 29), (48, 29), (32, 48)], fill=(225, 40, 60, 255))
    def hl(d): d.ellipse([20, 21, 25, 26], fill=(255, 190, 190, 255))
    return compose([part(h, 90, 90), part(hl, 0, 0)], glow=(255, 100, 120))


def luong():
    def a(d):
        d.polygon([(10, 26), (54, 26), (48, 56), (16, 56)], fill=(196, 140, 70, 255))
        d.rectangle([8, 20, 56, 28], fill=(150, 100, 48, 255))
    def b(d):
        for x, y, c in [(20, 14, (240, 90, 60, 255)), (30, 10, (110, 200, 90, 255)), (40, 14, (250, 200, 60, 255))]:
            d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=c)
        d.line([(20, 38), (44, 38)], fill=(240, 200, 130, 255), width=2)
    return compose([part(a), part(b, 60, 40)], glow=(255, 200, 120))


def phu():
    def a(d): d.rectangle([16, 6, 48, 58], fill=(246, 226, 150, 255))
    def b(d):
        d.rectangle([16, 6, 48, 10], fill=(200, 60, 50, 255)); d.rectangle([16, 54, 48, 58], fill=(200, 60, 50, 255))
        d.line([(32, 16), (32, 48)], fill=(200, 50, 50, 255), width=3)
        d.line([(22, 24), (42, 24)], fill=(200, 50, 50, 255), width=2); d.line([(22, 36), (42, 36)], fill=(200, 50, 50, 255), width=2)
        d.ellipse([27, 28, 37, 34], outline=(200, 50, 50, 255))
    return compose([part(a, 100, 80), part(b, 30, 30)], glow=(255, 220, 120))


def huyet():
    def a(d):
        d.polygon([(32, 4), (48, 30), (48, 44), (40, 56), (24, 56), (16, 44), (16, 30)], fill=(220, 30, 60, 255))
    def b(d):
        d.polygon([(28, 14), (24, 30), (28, 44), (24, 30)], fill=(255, 150, 160, 255)); d.ellipse([22, 20, 28, 32], fill=(255, 170, 180, 255))
        d.polygon([(34, 40), (42, 40), (40, 50), (34, 50)], fill=(150, 10, 40, 255))
    return compose([part(a, 100, 100), part(b, 20, 20)], glow=(255, 70, 100))


def chau():
    def a(d): d.ellipse([10, 10, 54, 54], fill=(150, 90, 230, 255))
    def b(d):
        d.ellipse([16, 16, 30, 30], fill=(215, 190, 255, 255)); d.arc([14, 14, 50, 50], 20, 100, fill=(90, 40, 170, 255), width=3)
        d.ellipse([34, 36, 40, 42], fill=(255, 230, 120, 255))
    return compose([part(a, 100, 100), part(b, 30, 40)], glow=(190, 140, 255))


def build():
    spec = json.load(open(os.path.join(HERE, 'pet_species_v14.json')))
    out = {}
    for s in spec:
        out['pet_' + s['id']] = species(s['line'], s['tier'])
    for t in range(1, 10): out[f'pet_tier{t}'] = tier_badge(t)
    out['pet_trung'] = egg()
    out['pet_khe_binhdang'] = contract('binhdang'); out['pet_khe_chuto'] = contract('chuto'); out['pet_khe_banmenh'] = contract('banmenh')
    out['luong'] = luong(); out['phu'] = phu(); out['huyet'] = huyet(); out['chau'] = chau()
    return spec, out


def preview(spec, out, path):
    cell = 128; cols = 9
    names = [k for k in out]
    rows = (len(names) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cell, rows * (cell + 14)), (36, 38, 48, 255))
    d = ImageDraw.Draw(sheet)
    try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 10)
    except Exception: f = None
    for i, k in enumerate(names):
        x, y = (i % cols) * cell, (i // cols) * (cell + 14)
        sheet.alpha_composite(out[k].resize((128, 128), Image.NEAREST), (x, y))
        d.text((x + 3, y + 129), k[4:] if k.startswith('pet_') else k, fill=(220, 220, 220, 255), font=f)
    sheet.convert('RGB').save(path)


if __name__ == '__main__':
    spec, out = build()
    if '--preview' in sys.argv:
        preview(spec, out, sys.argv[sys.argv.index('--preview') + 1])
    if '--no-write' not in sys.argv:
        os.makedirs(OUT, exist_ok=True)
        for k, im in out.items():
            p = os.path.join(OUT, k + '.png')
            if k in ('luong', 'phu', 'huyet', 'chau') and os.path.exists(p) and '--force' not in sys.argv:
                continue
            save(im, k, OUT)
        print('đã vẽ', len(out), 'emoji')
