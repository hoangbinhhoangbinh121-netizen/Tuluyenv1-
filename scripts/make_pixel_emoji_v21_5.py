#!/usr/bin/env python3
"""
make_pixel_emoji_v21_5.py — vẽ emoji pixel MỚI cho V21.5 Chủng Tộc: 6 tộc (race_*), 12 huyết mạch (bl_*), 6 dạng tiến hóa (rev_*),
3 bậc thức tỉnh (aw_1..3) và 4 icon thao tác (race_awaken / race_bloodline / race_evolve / race_change).
Cùng bộ vẽ & phong cách với v19.9/v20 (lưới 64 → PNG 128 nền trong suốt). KHÔNG ghi đè emoji đã có (khóa tồn tại bị bỏ qua).
Chạy:  python3 scripts/make_pixel_emoji_v21_5.py [--sheet contact.png]
Kiểm kê: trước khi vẽ in số PNG hiện có và liệt kê khóa MỚI; khóa đã có trong assets/emoji hoặc emoji_fallback.json (có hình) sẽ bị bỏ qua.
"""
import json, math, os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_pixel_emoji_v19_9 import *  # noqa: F401,F403
import make_pixel_emoji_v19_9 as B  # noqa: E402

TEAL = rgb(50, 170, 170); TEAL2 = rgb(40, 150, 140); DRAKE = rgb(36, 40, 60); BONE = rgb(230, 224, 200); BLOOD = rgb(170, 20, 40); FOX = rgb(238, 128, 40)
SKIN = rgb(240, 200, 160); ROBE = rgb(70, 110, 190); DEMON = rgb(120, 40, 140); SPIRIT = rgb(110, 230, 235); LEAF = rgb(90, 190, 100)


# ------------------------------------------------------------ 6 TỘC
def race_nhan():    # người ngồi thiền, hào quang vàng
    def halo(d): ring(d, 32, 26, 20, 2, GOLD)
    def body(d): poly(d, [(12, 58), (18, 40), (32, 34), (46, 40), (52, 58)], ROBE); poly(d, [(26, 40), (32, 54), (38, 40)], WHITE)
    def head(d): circ(d, 32, 22, 9, SKIN); poly(d, [(22, 20), (26, 10), (38, 10), (42, 20), (38, 14), (26, 14)], INK)
    def hands(d): poly(d, [(26, 48), (38, 48), (36, 54), (28, 54)], SKIN)
    return compose([P(halo, 0, 0), P(body), P(head), P(hands, 0, 0)], glow=GOLD[:3], sparks=[(8, 12, 3), (56, 14, 2)])

def race_long():    # đầu rồng
    def horn(d): poly(d, [(18, 20), (10, 4), (24, 14)], GOLD); poly(d, [(46, 20), (54, 4), (40, 14)], GOLD)
    def head(d): poly(d, [(14, 26), (26, 12), (38, 12), (50, 26), (52, 44), (40, 58), (24, 58), (12, 44)], TEAL2); poly(d, [(26, 12), (38, 12), (32, 40)], light(TEAL2, .35))
    def snout(d): poly(d, [(22, 40), (42, 40), (40, 56), (24, 56)], TEAL); circ(d, 28, 48, 2, DRAKE); circ(d, 36, 48, 2, DRAKE)
    def eyes(d): poly(d, [(18, 28), (28, 30), (26, 35), (18, 33)], GOLD_L); poly(d, [(46, 28), (36, 30), (38, 35), (46, 33)], GOLD_L); rect(d, 22, 29, 24, 34, DRAKE); rect(d, 40, 29, 42, 34, DRAKE)
    def whisk(d): thick(d, (12, 46), (4, 54), 2, GOLD_L); thick(d, (52, 46), (60, 54), 2, GOLD_L)
    return compose([P(whisk, 0, 0), P(horn), P(head), P(snout), P(eyes, 0, 0)], glow=TEAL[:3], sparks=[(6, 12, 2), (58, 10, 3)])

def race_phuong():  # phượng lửa
    def tail(d): poly(d, [(32, 40), (14, 62), (24, 52), (32, 64), (40, 52), (50, 62)], ORANGE); poly(d, [(32, 44), (24, 58), (32, 56), (40, 58)], GOLD)
    def wings(d): poly(d, [(32, 30), (4, 14), (10, 34), (22, 42)], RED); poly(d, [(32, 30), (60, 14), (54, 34), (42, 42)], RED); poly(d, [(32, 32), (10, 20), (14, 34), (24, 40)], ORANGE); poly(d, [(32, 32), (54, 20), (50, 34), (40, 40)], ORANGE)
    def body(d): poly(d, [(32, 18), (40, 28), (38, 46), (32, 52), (26, 46), (24, 28)], GOLD); poly(d, [(32, 18), (32, 52), (26, 46), (24, 28)], GOLD_L)
    def head(d): circ(d, 32, 14, 7, GOLD); poly(d, [(38, 12), (46, 14), (38, 17)], ORANGE); circ(d, 34, 12, 1, INK); poly(d, [(28, 8), (24, 2), (32, 6), (36, 0), (34, 8)], RED)
    return compose([P(tail), P(wings), P(body), P(head)], glow=ORANGE[:3], sparks=[(6, 8, 3), (58, 6, 2), (8, 52, 2)])

def race_ma():      # mặt ma, sừng, mắt đỏ
    def horn(d): poly(d, [(16, 24), (6, 4), (26, 16)], DRAKE); poly(d, [(48, 24), (58, 4), (38, 16)], DRAKE)
    def face(d): poly(d, [(12, 24), (32, 14), (52, 24), (50, 44), (38, 58), (26, 58), (14, 44)], DEMON); poly(d, [(32, 14), (52, 24), (50, 44), (32, 40)], dark(DEMON, .8))
    def eyes(d): poly(d, [(16, 30), (28, 34), (26, 40), (16, 36)], RED); poly(d, [(48, 30), (36, 34), (38, 40), (48, 36)], RED); circ(d, 22, 36, 1, WHITE); circ(d, 42, 36, 1, WHITE)
    def mouth(d): poly(d, [(22, 48), (42, 48), (38, 54), (26, 54)], DRAKE); [poly(d, [(24 + i * 6, 48), (27 + i * 6, 48), (25.5 + i * 6, 53)], WHITE) for i in range(3)]
    return compose([P(horn), P(face), P(eyes, 0, 0), P(mouth, 0, 0)], glow=PURPLE[:3], sparks=[(6, 30, 2), (58, 32, 3)])

def race_linh():    # linh thể: giọt sáng + dải gió
    def wind(d): [ring(d, 32, 32, 26 - i * 6, 1, light(SPIRIT, .3)) for i in range(3)]
    def drop(d): poly(d, [(32, 4), (46, 26), (48, 40), (40, 54), (24, 54), (16, 40), (18, 26)], SPIRIT); poly(d, [(32, 4), (18, 26), (16, 40), (24, 54), (32, 52)], light(SPIRIT, .45))
    def core(d): gem(d, 32, 34, 10, WHITE); gem(d, 32, 34, 5, CYAN)
    def leaf(d): poly(d, [(40, 46), (54, 40), (50, 54)], LEAF); poly(d, [(22, 20), (10, 18), (16, 30)], LEAF)
    return compose([P(wind, 0, 0), P(drop), P(core, 0, 0), P(leaf)], glow=SPIRIT[:3], sparks=[(8, 8, 3), (56, 10, 2), (56, 56, 2)])

def race_yeu():     # mặt hồ ly
    def ears(d): poly(d, [(10, 32), (12, 4), (30, 20)], FOX); poly(d, [(54, 32), (52, 4), (34, 20)], FOX); poly(d, [(14, 26), (15, 11), (25, 20)], PINK); poly(d, [(50, 26), (49, 11), (39, 20)], PINK)
    def face(d): poly(d, [(8, 34), (32, 18), (56, 34), (44, 54), (32, 60), (20, 54)], FOX); poly(d, [(8, 34), (30, 46), (32, 60), (20, 54)], WHITE); poly(d, [(56, 34), (34, 46), (32, 60), (44, 54)], WHITE)
    def eyes(d): poly(d, [(16, 32), (26, 36), (24, 40), (16, 37)], INK); poly(d, [(48, 32), (38, 36), (40, 40), (48, 37)], INK); circ(d, 23, 37, 1, GOLD_L); circ(d, 41, 37, 1, GOLD_L)
    def nose(d): circ(d, 32, 52, 3, INK)
    return compose([P(ears), P(face), P(eyes, 0, 0), P(nose, 0, 0)], glow=FOX[:3], sparks=[(6, 10, 3), (58, 12, 2)])


# ------------------------------------------------------------ 12 HUYẾT MẠCH
def bl_nhan_hoang():   # vương miện + mặt trời
    def sun(d): [thick(d, (32, 34), (32 + math.cos(a) * 28, 34 + math.sin(a) * 28), 2, GOLD_L) for a in [i * math.pi / 6 for i in range(12)]]; circ(d, 32, 34, 15, GOLD)
    def crown(d): poly(d, [(14, 44), (14, 22), (24, 32), (32, 16), (40, 32), (50, 22), (50, 44)], GOLD_D); poly(d, [(16, 42), (16, 26), (24, 35), (32, 20), (40, 35), (48, 26), (48, 42)], GOLD_L); rect(d, 14, 44, 50, 50, GOLD)
    def jewel(d): gem(d, 32, 40, 4, RED); gem(d, 20, 42, 2, CYAN); gem(d, 44, 42, 2, CYAN)
    return compose([P(sun, 0, 0), P(crown), P(jewel, 0, 0)], glow=GOLD[:3], sparks=[(6, 6, 3), (58, 8, 2)])

def bl_chien_than():   # kiếm + khiên
    def shield(d): poly(d, [(14, 14), (50, 14), (50, 36), (32, 58), (14, 36)], ROBE); poly(d, [(14, 14), (32, 14), (32, 58), (14, 36)], light(ROBE, .25)); rect(d, 14, 14, 50, 18, GOLD)
    def sword(d): poly(d, [(30, 2), (36, 2), (36, 40), (33, 46), (30, 40)], SILVER); rect(d, 24, 36, 42, 40, GOLD); rect(d, 31, 40, 35, 54, BROWN)
    return compose([P(shield), P(sword)], glow=BLUE[:3], sparks=[(8, 8, 2), (56, 44, 3)])

def bl_thuong_long():  # ngọc xanh + rồng cuộn quanh
    def pearl(d): circ(d, 32, 34, 14, BLUE); circ(d, 32, 34, 11, light(BLUE, .25)); circ(d, 27, 29, 4, WHITE)
    def coil(d): ring(d, 32, 34, 24, 7, TEAL2); ring(d, 32, 34, 24, 2, light(TEAL2, .5))
    def head(d): poly(d, [(40, 2), (60, 8), (58, 20), (44, 18)], TEAL); poly(d, [(42, 2), (44, -2 + 2), (48, 4)], GOLD); poly(d, [(46, 3), (50, 0), (52, 6)], GOLD); circ(d, 54, 11, 2, GOLD_L)
    def tail(d): poly(d, [(6, 52), (14, 60), (4, 62)], TEAL2)
    return compose([P(coil), P(pearl), P(head), P(tail)], glow=BLUE[:3], sparks=[(6, 12, 2), (58, 46, 3)])

def bl_hac_long():     # mắt rồng đen + gai
    def spikes(d): [poly(d, [(32 + math.cos(a) * 20, 32 + math.sin(a) * 20), (32 + math.cos(a + .2) * 31, 32 + math.sin(a + .2) * 31), (32 + math.cos(a + .4) * 20, 32 + math.sin(a + .4) * 20)], DRAKE) for a in [i * math.pi / 5 for i in range(10)]]
    def disc(d): circ(d, 32, 32, 22, DRAKE); circ(d, 32, 32, 18, dark(DEMON, .7))
    def eye(d): poly(d, [(10, 32), (32, 18), (54, 32), (32, 46)], RED); poly(d, [(15, 32), (32, 23), (49, 32), (32, 41)], ORANGE)
    def slit(d): poly(d, [(29, 21), (35, 21), (35, 43), (29, 43)], DRAKE); thick(d, (32, 22), (32, 42), 1, PURPLE)
    return compose([P(spikes), P(disc), P(eye, 0, 0), P(slit, 0, 0)], glow=PURPLE[:3], sparks=[(6, 8, 2), (58, 10, 3)])

def bl_chu_tuoc():     # cánh phượng đỏ nhiều lông
    def feathers(d):
        cols = [RED_D, RED, ORANGE, GOLD, GOLD_L]
        for i, c in enumerate(cols):
            a = math.radians(-100 + i * 22); L = 50 - i * 3
            tip = (10 + math.cos(a) * L, 56 + math.sin(a) * L); mid1 = (10 + math.cos(a - .18) * L * .6, 56 + math.sin(a - .18) * L * .6); mid2 = (10 + math.cos(a + .18) * L * .6, 56 + math.sin(a + .18) * L * .6)
            poly(d, [(10, 56), mid1, tip, mid2], c)
    def base(d): circ(d, 10, 56, 7, GOLD_D); circ(d, 10, 56, 4, GOLD_L)
    def f(d): poly(d, [(50, 54), (44, 38), (52, 26), (58, 40), (56, 54)], GOLD); poly(d, [(52, 52), (50, 42), (53, 36), (55, 44)], WHITE)
    return compose([P(feathers), P(base, 0, 0), P(f)], glow=RED[:3], sparks=[(56, 8, 3), (30, 4, 2)])

def bl_niet_ban():     # vòng lửa + hạt tro tái sinh
    def r(d): ring(d, 32, 34, 22, 5, ORANGE); ring(d, 32, 34, 14, 2, GOLD)
    def egg(d): poly(d, [(32, 18), (42, 32), (40, 46), (32, 50), (24, 46), (22, 32)], CREAM); poly(d, [(32, 18), (22, 32), (24, 46), (32, 50)], WHITE)
    def fl(d): poly(d, [(32, 2), (40, 14), (32, 20), (24, 14)], RED); poly(d, [(32, 8), (36, 14), (32, 17), (28, 14)], GOLD)
    def ash(d): [circ(d, x, 58 - (x % 3), 2, STONE) for x in (14, 26, 38, 50)]
    return compose([P(r, 0, 0), P(egg), P(fl), P(ash, 0, 0)], glow=ORANGE[:3], sparks=[(6, 10, 2), (58, 12, 3)])

def bl_huyet_ma():     # giọt máu + nanh
    def drop(d): poly(d, [(32, 2), (50, 30), (50, 44), (40, 58), (24, 58), (14, 44), (14, 30)], BLOOD); poly(d, [(32, 2), (14, 30), (14, 44), (24, 58), (32, 56)], light(RED, .2))
    def shine(d): poly(d, [(22, 32), (26, 26), (28, 40), (24, 44)], light(RED, .6))
    def fang(d): poly(d, [(22, 44), (28, 44), (25, 54)], WHITE); poly(d, [(36, 44), (42, 44), (39, 54)], WHITE)
    return compose([P(drop), P(shine, 0, 0), P(fang, 0, 0)], glow=RED[:3], sparks=[(8, 12, 2), (56, 8, 3)])

def bl_co_ma():        # đầu lâu cổ ma + rune
    def sk(d): poly(d, [(12, 28), (18, 8), (46, 8), (52, 28), (46, 40), (44, 54), (20, 54), (18, 40)], BONE); poly(d, [(12, 28), (18, 8), (32, 8), (32, 54), (20, 54), (18, 40)], WHITE)
    def eye(d): poly(d, [(16, 26), (28, 26), (28, 38), (16, 36)], DRAKE); poly(d, [(48, 26), (36, 26), (36, 38), (48, 36)], DRAKE); circ(d, 22, 32, 2, PURPLE); circ(d, 42, 32, 2, PURPLE)
    def nose(d): poly(d, [(32, 38), (28, 46), (36, 46)], DRAKE)
    def teeth(d): [rect(d, 22 + i * 6, 48, 24 + i * 6, 54, DRAKE) for i in range(4)]
    def rune(d): star(d, 32, 16, 5, 2, 4, PURPLE)
    return compose([P(sk), P(eye, 0, 0), P(nose, 0, 0), P(teeth, 0, 0), P(rune, 0, 0)], glow=PURPLE[:3], sparks=[(6, 8, 2), (58, 10, 2)])

def bl_phong_linh():   # xoáy gió
    def sw(d): [ring(d, 32, 32, 26 - i * 7, 3, [SKY, CYAN, SPIRIT, WHITE][i]) for i in range(4)]
    def mask(d): rect(d, 28, 4, 40, 62, rgb(0, 0, 0, 0)) if False else None
    def tail(d): poly(d, [(8, 40), (28, 30), (20, 44)], WHITE); poly(d, [(56, 24), (38, 34), (46, 20)], WHITE)
    def eye(d): gem(d, 32, 32, 6, WHITE); circ(d, 32, 32, 2, BLUE)
    return compose([P(sw, 0, 0), P(tail), P(eye, 0, 0)], glow=SKY[:3], sparks=[(6, 8, 3), (58, 54, 2)])

def bl_moc_linh():     # cây linh
    def trunk(d): poly(d, [(28, 58), (30, 34), (34, 34), (36, 58)], BROWN); thick(d, (32, 44), (20, 34), 3, BROWN); thick(d, (32, 40), (44, 30), 3, BROWN)
    def crown(d): circ(d, 32, 20, 16, GREEN); circ(d, 18, 30, 10, LEAF); circ(d, 46, 28, 10, LEAF); circ(d, 32, 14, 8, LIME)
    def glow(d): [circ(d, x, y, 2, GOLD_L) for x, y in ((24, 18), (40, 22), (32, 26), (18, 32), (46, 32))]
    return compose([P(trunk), P(crown), P(glow, 0, 0)], glow=LIME[:3], sparks=[(6, 8, 2), (58, 10, 3)])

def bl_ho_yeu():       # đuôi cáo + trăng khuyết
    def moon(d): circ(d, 44, 20, 15, CREAM); circ(d, 51, 15, 13, rgb(54, 57, 63))
    def tail(d): poly(d, [(6, 60), (8, 42), (18, 28), (34, 22), (50, 30), (58, 44), (46, 40), (34, 44), (28, 52), (24, 60)], FOX); poly(d, [(34, 22), (50, 30), (58, 44), (46, 40), (40, 30)], WHITE)
    def sh(d): thick(d, (12, 52), (22, 34), 2, light(FOX, .5))
    return compose([P(moon, 0, 0), P(tail), P(sh, 0, 0)], glow=FOX[:3], sparks=[(8, 10, 2), (58, 6, 3)])

def bl_ho_vuong():     # vằn hổ + chữ 王
    def face(d): poly(d, [(8, 14), (56, 14), (52, 48), (32, 60), (12, 48)], rgb(240, 160, 50)); poly(d, [(8, 14), (32, 14), (32, 60), (12, 48)], rgb(250, 190, 90))
    def st(d): [poly(d, [(8 + i * 3, 22 + i * 10), (20, 24 + i * 10), (8 + i * 3, 27 + i * 10)], INK) for i in range(3)]; [poly(d, [(56 - i * 3, 22 + i * 10), (44, 24 + i * 10), (56 - i * 3, 27 + i * 10)], INK) for i in range(3)]
    def king(d): rect(d, 24, 16, 40, 19, INK); rect(d, 26, 24, 38, 27, INK); rect(d, 22, 32, 42, 35, INK); rect(d, 30, 16, 33, 35, INK)
    def eyes(d): poly(d, [(16, 38), (26, 40), (24, 44), (16, 42)], GOLD_L); poly(d, [(48, 38), (38, 40), (40, 44), (48, 42)], GOLD_L); circ(d, 22, 41, 1, INK); circ(d, 42, 41, 1, INK)
    return compose([P(face), P(st, 0, 0), P(king, 0, 0), P(eyes, 0, 0)], glow=ORANGE[:3], sparks=[(6, 6, 2), (58, 8, 2)])


# ------------------------------------------------------------ 6 DẠNG TIẾN HÓA (khung vàng + huy hiệu riêng)
def _frame(c):
    def f(d): poly(d, [(32, 0), (62, 14), (62, 46), (32, 62), (2, 46), (2, 14)], GOLD_D); poly(d, [(32, 4), (58, 16), (58, 44), (32, 58), (6, 44), (6, 16)], c)
    return f

def rev_nhan():    # Nhân Đạo Chí Tôn — vương miện + mắt đạo
    def cr(d): poly(d, [(14, 38), (14, 20), (24, 28), (32, 12), (40, 28), (50, 20), (50, 38)], GOLD); rect(d, 14, 38, 50, 44, GOLD_D); gem(d, 32, 31, 5, WHITE)
    return compose([P(_frame(rgb(60, 90, 170))), P(cr), P(lambda d: star(d, 32, 51, 4, 2, 5, GOLD_L), 0, 0)], glow=GOLD[:3], sparks=[(4, 6, 3), (60, 8, 3)])

def rev_long():    # Chân Long — mắt rồng vàng
    def eye(d): poly(d, [(8, 32), (32, 16), (56, 32), (32, 48)], GOLD); poly(d, [(14, 32), (32, 22), (50, 32), (32, 42)], GOLD_L); poly(d, [(28, 24), (36, 24), (36, 40), (28, 40)], DRAKE)
    return compose([P(_frame(TEAL2)), P(eye, 0, 0)], glow=TEAL[:3], sparks=[(4, 6, 3), (60, 8, 3)])

def rev_phuong():  # Thần Phượng — cánh lửa vàng
    def w(d): poly(d, [(32, 44), (6, 14), (12, 36), (22, 46)], GOLD); poly(d, [(32, 44), (58, 14), (52, 36), (42, 46)], GOLD); poly(d, [(32, 10), (40, 28), (32, 50), (24, 28)], ORANGE); poly(d, [(32, 22), (36, 32), (32, 42), (28, 32)], WHITE)
    return compose([P(_frame(RED_D)), P(w, 0, 0)], glow=ORANGE[:3], sparks=[(4, 6, 3), (60, 8, 3)])

def rev_ma():      # Ma Tôn — vương miện sừng
    def cr(d): poly(d, [(12, 40), (10, 12), (22, 26), (32, 8), (42, 26), (54, 12), (52, 40)], DRAKE); poly(d, [(14, 38), (14, 20), (22, 30), (32, 14), (42, 30), (50, 20), (50, 38)], DEMON); rect(d, 12, 40, 52, 46, GOLD_D); gem(d, 32, 32, 5, RED)
    return compose([P(_frame(rgb(60, 24, 80))), P(cr), P(lambda d: [gem(d, 20 + i * 12, 50, 2, RED) for i in range(3)], 0, 0)], glow=PURPLE[:3], sparks=[(4, 6, 3), (60, 8, 3)])

def rev_linh():    # Thiên Linh — vầng sáng + sao
    def halo(d): ring(d, 32, 30, 18, 3, WHITE); ring(d, 32, 30, 11, 2, SPIRIT); star(d, 32, 30, 8, 3, 4, GOLD_L); circ(d, 32, 30, 2, WHITE)
    return compose([P(_frame(TEAL)), P(halo, 0, 0)], glow=SPIRIT[:3], sparks=[(4, 6, 3), (60, 8, 3)])

def rev_yeu():     # Đại Yêu — ngôi sao chín đuôi
    def tails(d): [poly(d, [(32, 32), (32 + math.cos(a) * 24, 32 + math.sin(a) * 24), (32 + math.cos(a + .35) * 18, 32 + math.sin(a + .35) * 18)], FOX) for a in [math.radians(-160 + i * 35) for i in range(9)]]; circ(d, 32, 32, 8, WHITE); circ(d, 32, 32, 4, FOX)
    return compose([P(_frame(rgb(110, 50, 30))), P(tails, 0, 0)], glow=FOX[:3], sparks=[(4, 6, 3), (60, 8, 3)])


# ------------------------------------------------------------ THỨC TỈNH + thao tác
def aw(n):
    def f():
        c = [rgb(120, 190, 240), rgb(170, 130, 240), rgb(255, 200, 70)][n - 1]
        def orb(d): circ(d, 32, 32, 22, dark(c, .55)); circ(d, 32, 32, 18, c); circ(d, 27, 26, 5, light(c, .6))
        def rays(d): [thick(d, (32, 32), (32 + math.cos(a) * 30, 32 + math.sin(a) * 30), 1, light(c, .55)) for a in [i * math.pi / 4 for i in range(8)]]
        def pips(d): [circ(d, 32 + (i - (n - 1) / 2) * 10, 32, 3, WHITE) for i in range(n)]
        return compose([P(rays, 0, 0), P(orb), P(pips, 0, 0)], glow=c[:3], sparks=[(6, 8, 2), (58, 10, 3)])
    return f

def op_awaken():    # bông sen thức tỉnh
    def petals(d):
        for k, (ang, ln) in enumerate([(-62, 30), (62, 30), (-32, 36), (32, 36), (0, 42)]):
            a = math.radians(ang); tip = (32 + math.sin(a) * ln, 54 - math.cos(a) * ln); mx, my = 32 + math.sin(a) * ln * .5, 54 - math.cos(a) * ln * .5
            nx, ny = math.cos(a) * 8, math.sin(a) * 8
            poly(d, [(32, 54), (mx - nx, my + ny), tip, (mx + nx, my - ny)], [PINK, PINK, light(PINK, .3), light(PINK, .3), light(PINK, .55)][k])
    def pond(d): poly(d, [(8, 56), (56, 56), (48, 62), (16, 62)], BLUE)
    def core(d): circ(d, 32, 40, 4, GOLD_L)
    return compose([P(pond), P(petals), P(core, 0, 0)], glow=PINK[:3], sparks=[(6, 10, 3), (58, 8, 2)])

def op_bloodline(): # giọt huyết + vòng
    def drop(d): poly(d, [(32, 4), (48, 30), (48, 44), (40, 56), (24, 56), (16, 44), (16, 30)], BLOOD); poly(d, [(32, 4), (16, 30), (16, 44), (24, 56), (32, 54)], light(RED, .2))
    def dna(d): thick(d, (24, 24), (40, 50), 2, WHITE); thick(d, (40, 24), (24, 50), 2, WHITE); [thick(d, (26 + i * 3, 30 + i * 5), (38 - i * 3, 30 + i * 5), 1, GOLD_L) for i in range(4)]
    return compose([P(drop), P(dna, 0, 0)], glow=RED[:3], sparks=[(8, 12, 2), (56, 8, 3)])
def op_evolve():    # mũi tên tiến hóa + sao
    def arrow(d): poly(d, [(32, 4), (54, 30), (40, 30), (40, 58), (24, 58), (24, 30), (10, 30)], GREEN); poly(d, [(32, 4), (10, 30), (24, 30), (24, 58), (32, 58)], LIME)
    return compose([P(arrow), P(lambda d: star(d, 32, 30, 7, 3, 4, GOLD_L), 0, 0)], glow=LIME[:3], sparks=[(6, 8, 3), (58, 12, 2)])
def op_change():    # hai mũi tên đổi
    def a1(d): poly(d, [(6, 20), (36, 20), (36, 10), (58, 26), (36, 42), (36, 32), (6, 32)], BLUE)
    def a2(d): poly(d, [(58, 40), (28, 40), (28, 30), (6, 46), (28, 62), (28, 52), (58, 52)], ORANGE)
    return compose([P(a1), P(a2)], glow=SKY[:3], sparks=[(8, 4, 2), (58, 8, 2)])


FEATURES = {
    'race_nhan': (race_nhan, '🧑'), 'race_long': (race_long, '🐉'), 'race_phuong': (race_phuong, '🔥'), 'race_ma': (race_ma, '😈'), 'race_linh': (race_linh, '✨'), 'race_yeu': (race_yeu, '🦊'),
    'bl_nhan_hoang': (bl_nhan_hoang, '👑'), 'bl_chien_than': (bl_chien_than, '🛡️'), 'bl_thuong_long': (bl_thuong_long, '🌊'), 'bl_hac_long': (bl_hac_long, '🐾'),
    'bl_chu_tuoc': (bl_chu_tuoc, '🪽'), 'bl_niet_ban': (bl_niet_ban, '♻️'), 'bl_huyet_ma': (bl_huyet_ma, '🩸'), 'bl_co_ma': (bl_co_ma, '💀'),
    'bl_phong_linh': (bl_phong_linh, '🌀'), 'bl_moc_linh': (bl_moc_linh, '🌳'), 'bl_ho_yeu': (bl_ho_yeu, '🌙'), 'bl_ho_vuong': (bl_ho_vuong, '🐯'),
    'rev_nhan': (rev_nhan, '👑'), 'rev_long': (rev_long, '🐲'), 'rev_phuong': (rev_phuong, '🔥'), 'rev_ma': (rev_ma, '😈'), 'rev_linh': (rev_linh, '🌟'), 'rev_yeu': (rev_yeu, '🦊'),
    'aw_1': (aw(1), '🔹'), 'aw_2': (aw(2), '🔷'), 'aw_3': (aw(3), '🌟'),
    'race_awaken': (op_awaken, '🪷'), 'race_bloodline': (op_bloodline, '🩸'), 'race_evolve': (op_evolve, '🌌'), 'race_change': (op_change, '🔁'),
}


def build(sheet=None):
    have = [f for f in os.listdir(OUT) if f.endswith('.png')]
    fb = json.load(open(FB, encoding='utf-8')); done_ = []; skipped = []
    print(f'kiểm kê: {len(have)} PNG hiện có trong assets/emoji; {len(FEATURES)} khóa V21.5 dự kiến')
    for key, (fn, uni) in FEATURES.items():
        path = os.path.join(OUT, f'{key}.png')
        fb.setdefault(key, uni)
        if os.path.exists(path): skipped.append(key); continue
        save(fn(), key, OUT); done_.append(key)
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
    build(sys.argv[sys.argv.index('--sheet') + 1] if '--sheet' in sys.argv else None)
