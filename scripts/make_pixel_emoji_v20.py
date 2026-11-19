#!/usr/bin/env python3
"""
make_pixel_emoji_v20.py — vẽ emoji pixel MỚI cho V20 (Đại Hoàn Thiện Nghề Nghiệp): Khai Thác, Đơn Hàng, Dị Hỏa, Sổ Tay, Thành Tựu, 10 huy hiệu giai đoạn,
bản vẽ / cuộn thất truyền / hỏa chủng / phế đan và 4 dấu ấn đan dược. Khóa mới tiền tố n20_*. KHÔNG ghi đè bất kỳ emoji nào đã có (khóa tồn tại bị bỏ qua).
Chạy:  python3 scripts/make_pixel_emoji_v20.py [--sheet contact.png]
"""
import json, math, os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_pixel_emoji_v19_9 import *  # noqa: F401,F403  (màu, P, poly, circ, rect, gem, ring, thick, star, compose, save, OUT, FB)
import make_pixel_emoji_v19_9 as B  # noqa: E402


def pick():   # cuốc chim
    def handle(d): thick(d, (14, 52), (44, 22), 4, BROWN); thick(d, (15, 51), (43, 23), 1, GOLD_D)
    def head(d): poly(d, [(26, 8), (46, 10), (58, 24), (52, 26), (44, 18), (34, 16)], STEEL); poly(d, [(26, 8), (46, 10), (40, 14), (30, 14)], SILVER)
    def tip(d): poly(d, [(58, 24), (60, 30), (52, 26)], WHITE); poly(d, [(26, 8), (20, 12), (30, 14)], SILVER)
    def rock(d): poly(d, [(6, 54), (16, 46), (26, 52), (24, 60), (8, 60)], STONE); circ(d, 12, 54, 2, SKY)
    return compose([P(rock), P(handle), P(head), P(tip, 0, 0)], glow=SKY[:3], sparks=[(52, 8, 3), (8, 36, 2), (58, 44, 2)])

def ore():   # tinh thể khoáng
    def base(d): poly(d, [(8, 56), (16, 42), (30, 48), (28, 58)], STONE); poly(d, [(30, 58), (36, 46), (54, 44), (58, 58)], STONE_D)
    def big(d): poly(d, [(22, 44), (28, 14), (36, 6), (44, 16), (46, 44)], CYAN); poly(d, [(28, 14), (36, 6), (36, 44), (22, 44)], light(CYAN, .45))
    def small(d): poly(d, [(46, 46), (50, 30), (56, 28), (58, 46)], BLUE)
    def sh(d): thick(d, (30, 16), (30, 38), 1, WHITE)
    return compose([P(base), P(small), P(big), P(sh, 0, 0)], glow=CYAN[:3], sparks=[(10, 14, 3), (54, 12, 2)])

def herb():   # giỏ hái linh dược
    def basket(d): poly(d, [(8, 34), (56, 34), (50, 58), (14, 58)], BROWN); [thick(d, (10 + i * 6, 36), (14 + i * 5, 56), 1, GOLD_D) for i in range(8)]
    def rim(d): rect(d, 6, 30, 58, 36, GOLD_D); rect(d, 6, 30, 58, 32, GOLD)
    def leaf(d): poly(d, [(32, 30), (18, 18), (20, 6), (32, 14)], GREEN); poly(d, [(32, 30), (46, 16), (44, 4), (32, 14)], LIME); thick(d, (32, 30), (32, 12), 1, dark(GREEN))
    def flower(d): [circ(d, 32 + math.cos(a) * 6, 10 + math.sin(a) * 6, 3, PINK) for a in [i * math.pi / 2.5 for i in range(5)]]; circ(d, 32, 10, 3, GOLD_L)
    return compose([P(leaf), P(flower, 0, 0), P(basket), P(rim)], glow=LIME[:3], sparks=[(6, 14, 2), (58, 18, 3)])

def order():   # đơn hàng: cuộn giấy + ấn đỏ
    def scroll(d): rect(d, 12, 8, 52, 52, CREAM); rect(d, 12, 8, 52, 12, light(CREAM, .5)); rect(d, 8, 4, 56, 10, GOLD); rect(d, 8, 50, 56, 58, GOLD)
    def lines(d): [rect(d, 18, 18 + i * 8, 46, 19 + i * 8, BROWN) for i in range(4)]
    def seal(d): circ(d, 44, 46, 9, RED); circ(d, 44, 46, 5, RED_D); rect(d, 42, 40, 46, 52, RED)
    def tick(d): thick(d, (36, 44), (42, 50), 2, WHITE); thick(d, (42, 50), (52, 40), 2, WHITE)
    return compose([P(scroll), P(lines, 0, 0), P(seal), P(tick, 0, 0)], glow=GOLD[:3], sparks=[(8, 16, 2), (58, 22, 3)])

def fire():   # dị hỏa: ngọn lửa trong cầu
    def orb(d): circ(d, 32, 34, 24, rgb(60, 36, 90)); circ(d, 32, 34, 20, rgb(90, 50, 120))
    def flame(d): poly(d, [(32, 8), (44, 26), (48, 40), (40, 54), (24, 54), (16, 40), (22, 28), (28, 20)], ORANGE)
    def inner(d): poly(d, [(32, 22), (40, 36), (38, 48), (26, 48), (24, 36)], GOLD); poly(d, [(32, 34), (36, 44), (28, 44)], GOLD_L)
    def core(d): circ(d, 32, 46, 3, WHITE)
    return compose([P(orb), P(flame), P(inner, 0, 0), P(core, 0, 0)], glow=ORANGE[:3], sparks=[(8, 12, 3), (56, 10, 2), (58, 50, 2)])

def note():   # sổ tay
    def cover(d): rect(d, 10, 6, 50, 58, rgb(60, 100, 170)); rect(d, 10, 6, 14, 58, rgb(36, 60, 120))
    def pages(d): rect(d, 14, 8, 52, 56, CREAM); rect(d, 16, 10, 50, 54, WHITE)
    def lines(d): [rect(d, 20, 16 + i * 8, 44, 17 + i * 8, STEEL) for i in range(5)]
    def ribbon(d): poly(d, [(40, 6), (46, 6), (46, 28), (43, 24), (40, 28)], RED)
    def pen(d): thick(d, (42, 56), (58, 30), 3, GOLD); poly(d, [(42, 56), (40, 62), (46, 58)], INK)
    return compose([P(cover), P(pages), P(lines, 0, 0), P(ribbon), P(pen)], glow=BLUE[:3], sparks=[(6, 14, 2), (58, 10, 2)])

def trophy():   # thành tựu
    def cup(d): poly(d, [(14, 8), (50, 8), (46, 32), (32, 40), (18, 32)], GOLD); poly(d, [(14, 8), (32, 8), (32, 40), (18, 32)], GOLD_L)
    def hnd(d): ring(d, 12, 18, 7, 2, GOLD_D); ring(d, 52, 18, 7, 2, GOLD_D)
    def stem(d): rect(d, 28, 40, 36, 50, GOLD_D); rect(d, 18, 50, 46, 58, BROWN); rect(d, 18, 50, 46, 52, GOLD)
    def stars(d): star(d, 32, 22, 8, 3, 5, WHITE)
    return compose([P(hnd), P(cup), P(stem), P(stars, 0, 0)], glow=GOLD[:3], sparks=[(6, 6, 3), (58, 6, 3), (32, 2, 2)])

def seedfire():   # hỏa chủng
    def seed(d): poly(d, [(32, 8), (48, 30), (44, 52), (32, 58), (20, 52), (16, 30)], rgb(140, 50, 40)); poly(d, [(32, 8), (16, 30), (20, 52), (32, 58)], rgb(190, 70, 50))
    def fl(d): poly(d, [(32, 18), (40, 32), (36, 46), (28, 46), (24, 32)], GOLD); poly(d, [(32, 30), (35, 40), (29, 40)], WHITE)
    def vein(d): thick(d, (32, 10), (32, 56), 1, RED_D)
    return compose([P(seed), P(vein, 0, 0), P(fl, 0, 0)], glow=ORANGE[:3], sparks=[(8, 10, 2), (56, 14, 3)])

def blueprint():   # bản vẽ
    def sheet(d): rect(d, 6, 10, 58, 54, rgb(50, 100, 190)); rect(d, 6, 10, 58, 13, rgb(90, 150, 230))
    def grid(d): [thick(d, (6 + i * 8, 13), (6 + i * 8, 54), 1, rgb(110, 160, 230)) for i in range(1, 7)]; [thick(d, (6, 13 + i * 8), (58, 13 + i * 8), 1, rgb(110, 160, 230)) for i in range(1, 5)]
    def draw(d): ring(d, 32, 32, 12, 2, WHITE); thick(d, (14, 46), (50, 20), 2, WHITE); poly(d, [(50, 20), (44, 20), (48, 26)], WHITE)
    return compose([P(sheet), P(grid, 0, 0), P(draw, 0, 0)], glow=BLUE[:3], sparks=[(8, 6, 2), (58, 56, 2)])

def oldscroll():   # cuộn thất truyền
    def body(d): rect(d, 14, 10, 50, 54, rgb(214, 190, 140)); rect(d, 14, 10, 50, 14, rgb(240, 222, 170))
    def roll(d): rect(d, 10, 4, 54, 12, BROWN); rect(d, 10, 52, 54, 60, BROWN); circ(d, 10, 8, 4, GOLD_D); circ(d, 54, 8, 4, GOLD_D); circ(d, 10, 56, 4, GOLD_D); circ(d, 54, 56, 4, GOLD_D)
    def rune(d): ring(d, 32, 32, 10, 2, PURPLE); star(d, 32, 32, 8, 3, 6, VIOLET); circ(d, 32, 32, 2, GOLD_L)
    return compose([P(body), P(roll), P(rune, 0, 0)], glow=VIOLET[:3], sparks=[(8, 22, 2), (58, 30, 3), (32, 2, 2)])

def broken():   # phế đan
    def pill(d): circ(d, 32, 34, 20, rgb(110, 100, 105)); circ(d, 32, 34, 15, rgb(140, 128, 132))
    def crack(d): thick(d, (22, 20), (30, 32), 2, INK); thick(d, (30, 32), (26, 40), 2, INK); thick(d, (26, 40), (36, 50), 2, INK); thick(d, (30, 32), (42, 30), 2, INK)
    def smoke(d): circ(d, 44, 14, 5, SILVER); circ(d, 38, 8, 4, STEEL); circ(d, 50, 8, 3, SILVER)
    return compose([P(pill), P(crack, 0, 0), P(smoke, 40, 40)], glow=STEEL[:3], sparks=[])

def mark(c1, c2, shape):
    def f():
        def pill(d): circ(d, 32, 36, 18, c1); circ(d, 32, 36, 13, light(c1, .3)); circ(d, 26, 30, 4, WHITE)
        def sym(d):
            if shape == 'van': [ring(d, 32, 36, 22 - i * 4, 1, c2) for i in range(1)]; thick(d, (14, 14), (22, 22), 2, c2); thick(d, (50, 14), (42, 22), 2, c2); thick(d, (14, 58), (22, 50), 2, c2); thick(d, (50, 58), (42, 50), 2, c2)
            elif shape == 'huong': [poly(d, [(18 + i * 14, 14), (22 + i * 14, 8), (16 + i * 14, 2), (20 + i * 14, -2)], c2) for i in range(0)]; thick(d, (20, 16), (24, 4), 2, c2); thick(d, (32, 14), (36, 2), 2, c2); thick(d, (44, 16), (48, 4), 2, c2)
            elif shape == 'linh': star(d, 32, 10, 8, 3, 4, c2); circ(d, 50, 18, 3, c2); circ(d, 14, 20, 2, c2)
            else: star(d, 32, 36, 24, 14, 8, c2)
        return compose([P(sym, 0, 0), P(pill), P(sym, 80, 0) if shape == 'xx' else P(lambda d: None, 0, 0)], glow=c2[:3], sparks=[(8, 8, 2), (56, 52, 2)])
    return f

STAGE_COL = [rgb(160, 160, 170), rgb(90, 200, 120), rgb(70, 130, 230), rgb(190, 130, 70), rgb(90, 220, 230), rgb(245, 150, 200), rgb(245, 200, 60), rgb(170, 100, 230), rgb(230, 70, 60), rgb(250, 250, 255)]
def badge(n):
    def f():
        c = STAGE_COL[n - 1]
        def hexa(d): poly(d, [(32, 2), (56, 14), (56, 40), (32, 52), (8, 40), (8, 14)], dark(c, .6)); poly(d, [(32, 6), (52, 16), (52, 38), (32, 48), (12, 38), (12, 16)], c)
        def inner(d): poly(d, [(32, 11), (44, 20), (44, 34), (32, 43), (20, 34), (20, 20)], light(c, .35)); gem(d, 32, 27, 8, WHITE if n < 10 else GOLD_L)
        def pips(d):
            for i in range(n): circ(d, 32 + (i - (n - 1) / 2) * 5.2, 57, 2, GOLD_L)
        return compose([P(hexa), P(inner, 0, 0), P(pips, 0, 0)], glow=c[:3], sparks=[(6, 6, 2), (58, 8, 2)])
    return f

def field_adv():   # Linh Điền nâng cao
    def soil(d): poly(d, [(4, 40), (32, 28), (60, 40), (32, 58)], BROWN); poly(d, [(8, 42), (32, 32), (56, 42), (32, 54)], rgb(90, 60, 36))
    def plants(d): [poly(d, [(x, 40), (x - 4, 30), (x, 22), (x + 4, 30)], GREEN) for x in (20, 32, 44)]; circ(d, 32, 20, 3, GOLD_L)
    def aura(d): ring(d, 32, 34, 28, 1, CYAN)
    return compose([P(aura, 0, 0), P(soil), P(plants)], glow=LIME[:3], sparks=[(8, 12, 2), (56, 10, 3)])

FEATURES = {
    'n20_khaithac': (pick, '⛏️'), 'n20_khoang': (ore, '💎'), 'n20_thuthap': (herb, '🧺'), 'n20_donhang': (order, '📋'), 'n20_dihoa': (fire, '🔥'), 'n20_sotay': (note, '📒'),
    'n20_thanhtuu': (trophy, '🏆'), 'n20_hoachung': (seedfire, '🌰'), 'n20_banve': (blueprint, '📐'), 'n20_cuon': (oldscroll, '📜'), 'n20_phedan': (broken, '💨'),
    'n20_van': (mark(rgb(80, 170, 240), CYAN, 'van'), '🔷'), 'n20_huong': (mark(rgb(130, 210, 110), LIME, 'huong'), '🌿'), 'n20_linh': (mark(rgb(200, 150, 240), VIOLET, 'linh'), '🔮'),
    'n20_dibien': (mark(rgb(240, 140, 60), GOLD, 'xx'), '🌟'), 'n20_dien': (field_adv, '🌱'),
}
for _n in range(1, 11): FEATURES[f'n20_gd{_n}'] = (badge(_n), '🔰')


def build(sheet=None):
    fb = json.load(open(FB, encoding='utf-8')); done_ = []; skipped = []
    for key, (fn, uni) in FEATURES.items():
        path = os.path.join(OUT, f'{key}.png')
        if os.path.exists(path): skipped.append(key); continue
        save(fn(), key, OUT); done_.append(key); fb.setdefault(key, uni)
    json.dump(fb, open(FB, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); open(FB, 'a').write('\n')
    print(f'đã vẽ {len(done_)} emoji mới; bỏ qua {len(skipped)} (đã có)')
    if sheet:
        keys = list(FEATURES); cols = 9; cell = 140; rows = (len(keys) + cols - 1) // cols
        im = Image.new('RGBA', (cols * cell, rows * cell), (54, 57, 63, 255))
        for i, k in enumerate(keys):
            e = Image.open(os.path.join(OUT, f'{k}.png')).convert('RGBA'); x, y = (i % cols) * cell + 6, (i // cols) * cell + 6
            im.alpha_composite(e, (x, y)); im.alpha_composite(e.resize((32, 32), Image.LANCZOS), (x + 92, y + 92))
        im.convert('RGB').save(sheet); print('contact sheet →', sheet)


if __name__ == '__main__':
    build(sys.argv[sys.argv.index('--sheet') + 1] if '--sheet' in sys.argv else None)
