#!/usr/bin/env python3
# (V16: bộ emoji Công Pháp dùng tranh do người dùng cung cấp — build_congphap_emoji_from_sheet_v16.py; script vẽ pixel này chỉ còn để tham chiếu, ĐỪNG chạy lại vì sẽ ghi đè.)
"""
make_pixel_emoji_v16_congphap.py — vẽ emoji pixel MỚI cho Công Pháp v16 (72 cái), cùng phong cách bộ emoji hiện có
(lưới 64x64 phóng x2 → PNG 128x128, viền nâu đậm, sáng/tối bevel, tia sáng). KHÔNG đụng emoji cũ.
  cpb_1001..1040  40 quyển sách (màu bìa = nhóm, biểu tượng = loại, chấm gáy = thứ tự trong nhóm)
  cpc_<loại>      13 biểu tượng loại công pháp          cpg_<nhóm>  5 huy hiệu nhóm (cu/nhan/linh/tien/doc)
  cpp_1..7        7 viên ngọc phẩm cấp                  cpm_<mã>    6 mảnh bí tịch
  tangkinh        Tàng Kinh Các (lầu các)
Chạy:  python3 scripts/make_pixel_emoji_v16_congphap.py [--sheet đường_dẫn.png]
"""
import json, os, re, sys
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_pixel_emoji_v12_streak import G, OUTLINE, canvas, part, compose, sparkle, save  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'assets', 'emoji'))
GOLD, GOLD_D, GOLD_L = (236, 178, 52, 255), (176, 112, 30, 255), (255, 226, 120, 255)
WHITE = (250, 250, 250, 255)
PAPER, PAPER_D = (246, 232, 196, 255), (214, 190, 140, 255)
INK = (70, 44, 28, 255)
GROUP_COL = {  # (bìa, bìa tối, bìa sáng, quầng)
    'cu': ((150, 150, 158, 255), (96, 96, 108, 255), (200, 200, 210, 255), (200, 200, 220)),
    'nhan': ((72, 168, 84, 255), (36, 106, 52, 255), (140, 220, 140, 255), (120, 240, 140)),
    'linh': ((70, 130, 226, 255), (36, 76, 160, 255), (140, 188, 255, 255), (120, 170, 255)),
    'tien': ((244, 196, 56, 255), (186, 124, 24, 255), (255, 232, 130, 255), (255, 220, 110)),
    'doc': ((216, 58, 66, 255), (136, 24, 40, 255), (255, 130, 130, 255), (255, 110, 110)),
}
CATC = {  # màu biểu tượng theo loại
    'tu': (130, 230, 170, 255), 'luyenthe': (255, 190, 120, 255), 'loi': (255, 240, 90, 255), 'bang': (190, 240, 255, 255),
    'am': (210, 190, 255, 255), 'than': (200, 255, 230, 255), 'nguhanh': (255, 255, 255, 255), 'hoa': (255, 130, 50, 255),
    'sinhco': (130, 230, 110, 255), 'tho': (206, 160, 100, 255), 'kiem': (225, 235, 250, 255), 'toanien': (255, 255, 255, 255),
    'phongngu': (170, 200, 240, 255),
}
CATS = list(CATC.keys())


# ---------------------------------------------------------------- biểu tượng loại (vẽ quanh tâm cx,cy, bán kính ~r)
def glyph(d, cat, cx, cy, r, col, dark=INK, bg=(0, 0, 0, 0)):
    if cat == 'tu':        # hoa sen / thiền
        for k, (dx, dy) in enumerate([(-r * .55, 0), (r * .55, 0), (0, -r * .2)]):
            d.ellipse([cx + dx - r * .38, cy + dy - r * .7, cx + dx + r * .38, cy + dy + r * .5], fill=col, outline=dark)
        d.ellipse([cx - r * .9, cy + r * .35, cx + r * .9, cy + r * .85], fill=col, outline=dark)
    elif cat == 'luyenthe':  # nắm đấm
        d.rounded_rectangle([cx - r * .7, cy - r * .35, cx + r * .7, cy + r * .8], radius=3, fill=col, outline=dark)
        for i in range(4):
            x = cx - r * .62 + i * r * .42
            d.rounded_rectangle([x, cy - r * .8, x + r * .36, cy - r * .1], radius=2, fill=col, outline=dark)
    elif cat == 'loi':       # tia sét
        d.polygon([(cx + r * .2, cy - r), (cx - r * .6, cy + r * .1), (cx - r * .05, cy + r * .1), (cx - r * .25, cy + r), (cx + r * .65, cy - r * .2), (cx + r * .1, cy - r * .2)], fill=col, outline=dark)
    elif cat == 'bang':      # bông tuyết
        for a in range(0, 180, 60):
            import math
            dx, dy = math.cos(math.radians(a)) * r, math.sin(math.radians(a)) * r
            d.line([(cx - dx, cy - dy), (cx + dx, cy + dy)], fill=col, width=3)
        d.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=WHITE, outline=dark)
    elif cat == 'am':        # trăng khuyết
        d.ellipse([cx - r * .85, cy - r * .85, cx + r * .85, cy + r * .85], fill=col, outline=dark)
        d.ellipse([cx - r * .35, cy - r * .95, cx + r * 1.1, cy + r * .75], fill=bg)
        d.ellipse([cx - r * .3, cy - r * .85, cx + r * .95, cy + r * .7], fill=bg)
    elif cat == 'than':      # gió cuộn
        for k, y in enumerate([-r * .6, 0, r * .6]):
            d.arc([cx - r + k * 2, cy + y - r * .35, cx + r * .6, cy + y + r * .35], 200, 20, fill=col, width=3)
        d.ellipse([cx + r * .35, cy - r * .1, cx + r * .75, cy + r * .3], outline=col, width=2)
    elif cat == 'nguhanh':   # ngũ giác 5 chấm
        import math
        pts = [(cx + math.cos(math.radians(-90 + 72 * k)) * r, cy + math.sin(math.radians(-90 + 72 * k)) * r) for k in range(5)]
        d.polygon(pts, outline=dark, fill=(90, 70, 50, 255))
        cols = [(250, 220, 90, 255), (110, 200, 110, 255), (90, 150, 250, 255), (250, 100, 70, 255), (190, 140, 90, 255)]
        for p, c in zip(pts, cols):
            d.ellipse([p[0] - 3, p[1] - 3, p[0] + 3, p[1] + 3], fill=c, outline=dark)
    elif cat == 'hoa':       # ngọn lửa
        d.polygon([(cx, cy - r), (cx + r * .7, cy + r * .1), (cx + r * .45, cy + r * .9), (cx - r * .45, cy + r * .9), (cx - r * .7, cy + r * .1), (cx - r * .15, cy - r * .35)], fill=col, outline=dark)
        d.polygon([(cx, cy - r * .15), (cx + r * .3, cy + r * .5), (cx, cy + r * .85), (cx - r * .3, cy + r * .5)], fill=(255, 226, 120, 255))
    elif cat == 'sinhco':    # lá cây
        d.ellipse([cx - r * .7, cy - r * .85, cx + r * .7, cy + r * .5], fill=col, outline=dark)
        d.line([(cx, cy - r * .6), (cx, cy + r * .95)], fill=dark, width=2)
        d.line([(cx, cy), (cx + r * .4, cy - r * .3)], fill=dark, width=1)
        d.line([(cx, cy + r * .2), (cx - r * .4, cy - r * .1)], fill=dark, width=1)
    elif cat == 'tho':       # núi
        d.polygon([(cx - r, cy + r * .8), (cx - r * .25, cy - r * .7), (cx + r * .25, cy + r * .8)], fill=col, outline=dark)
        d.polygon([(cx - r * .1, cy + r * .8), (cx + r * .45, cy - r * .2), (cx + r, cy + r * .8)], fill=(176, 130, 80, 255), outline=dark)
        d.polygon([(cx - r * .25, cy - r * .7), (cx - r * .5, cy - r * .3), (cx - r * .25, cy - r * .35), (cx, cy - r * .3)], fill=WHITE)
    elif cat == 'kiem':      # kiếm chéo
        d.polygon([(cx + r * .85, cy - r * .95), (cx + r * .95, cy - r * .75), (cx - r * .5, cy + r * .6), (cx - r * .7, cy + r * .5)], fill=col, outline=dark)
        d.line([(cx - r * .7, cy + r * .2), (cx - r * .1, cy + r * .8)], fill=GOLD, width=3)
        d.line([(cx - r * .55, cy + r * .6), (cx - r * .95, cy + r * .95)], fill=INK, width=3)
    elif cat == 'toanien':   # âm dương
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE, outline=dark)
        d.pieslice([cx - r, cy - r, cx + r, cy + r], 90, 270, fill=(40, 40, 54, 255))
        d.ellipse([cx - r / 2, cy - r, cx + r / 2, cy], fill=WHITE)
        d.ellipse([cx - r / 2, cy, cx + r / 2, cy + r], fill=(40, 40, 54, 255))
        d.ellipse([cx - r * .14, cy - r * .64, cx + r * .14, cy - r * .36], fill=(40, 40, 54, 255))
        d.ellipse([cx - r * .14, cy + r * .36, cx + r * .14, cy + r * .64], fill=WHITE)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=dark)
    elif cat == 'phongngu':  # khiên
        d.polygon([(cx - r * .8, cy - r * .8), (cx + r * .8, cy - r * .8), (cx + r * .8, cy + r * .1), (cx, cy + r), (cx - r * .8, cy + r * .1)], fill=col, outline=dark)
        d.polygon([(cx, cy - r * .55), (cx + r * .5, cy - r * .55), (cx + r * .5, cy), (cx, cy + r * .55)], fill=(110, 150, 220, 255))
        d.line([(cx, cy - r * .7), (cx, cy + r * .8)], fill=GOLD, width=2)


def cat_icon(cat):
    """Huy hiệu tròn + biểu tượng loại."""
    def bg(d):
        d.ellipse([6, 6, 57, 57], fill=(54, 40, 66, 255))
    def ring(d):
        d.ellipse([9, 9, 54, 54], outline=GOLD, width=2)
    def gl(d):
        glyph(d, cat, 32, 32, 16, CATC[cat])
    return compose([part(bg), part(ring, 60, 60), part(gl, 70, 80)], glow=CATC[cat][:3])


# ---------------------------------------------------------------- quyển sách (cpb_*)
def book(group, cat, idx):
    cover, cover_d, cover_l, glow = GROUP_COL[group]
    def body(d):
        d.rounded_rectangle([12, 6, 52, 58], radius=4, fill=cover_d)          # lưng/gáy
        d.rounded_rectangle([14, 6, 52, 56], radius=3, fill=cover)             # bìa
        d.rectangle([8, 10, 14, 56], fill=PAPER)                               # cạnh trang
        d.rectangle([8, 10, 9, 56], fill=PAPER_D)
    def spine(d):
        for k in range(5):
            y = 12 + k * 9
            d.line([(14, y), (50, y)], fill=cover_d, width=1)
    def label(d):
        d.rounded_rectangle([20, 12, 48, 40], radius=3, fill=(40, 28, 44, 255), outline=GOLD)
        glyph(d, cat, 34, 26, 9, CATC[cat], bg=(40, 28, 44, 255))
    def title(d):
        d.rectangle([20, 44, 48, 47], fill=GOLD)
        d.rectangle([22, 49, 46, 51], fill=GOLD_D)
    def pips(d):  # chấm thứ tự 1..10: hàng trên 5 chấm vàng/xám
        for k in range(10):
            x = 20 + (k % 5) * 6; y = 53 if k < 5 else 56
            if k < idx:
                d.rectangle([x, y, x + 2, y + 1], fill=(255, 244, 150, 255))
    im = compose([part(body, 90, 90), part(label, 60, 60), part(title, 40, 40)], glow=glow)
    ImageDraw.Draw(im).rectangle([12, 4, 14, 5], fill=(0, 0, 0, 0))
    # chấm thứ tự vẽ sau cùng (không bị viền che)
    d = ImageDraw.Draw(im)
    for k in range(idx):
        x = 20 + (k % 5) * 6; y = 53 if k < 5 else 57
        d.rectangle([x, y, x + 3, y + 1], fill=(255, 250, 170, 255))
    return im


# ---------------------------------------------------------------- huy hiệu nhóm (cpg_*)
def group_icon(g):
    cover, cover_d, cover_l, glow = GROUP_COL[g]
    def disc(d):
        d.ellipse([5, 5, 58, 58], fill=cover_d); d.ellipse([8, 8, 55, 55], fill=cover)
    def sym(d):
        if g == 'cu':      # cuộn giấy
            d.rounded_rectangle([18, 18, 46, 46], radius=3, fill=PAPER, outline=INK)
            d.ellipse([14, 16, 22, 48], fill=PAPER_D, outline=INK); d.ellipse([42, 16, 50, 48], fill=PAPER_D, outline=INK)
            for y in (24, 30, 36): d.line([(25, y), (40, y)], fill=INK)
        elif g == 'nhan':  # mầm cây
            d.line([(32, 48), (32, 28)], fill=INK, width=3)
            d.ellipse([20, 18, 34, 32], fill=(150, 235, 130, 255), outline=INK); d.ellipse([31, 14, 46, 29], fill=(110, 210, 110, 255), outline=INK)
            d.ellipse([22, 44, 42, 52], fill=(150, 110, 70, 255), outline=INK)
        elif g == 'linh':  # tinh thể
            d.polygon([(32, 12), (46, 28), (32, 52), (18, 28)], fill=(170, 220, 255, 255), outline=INK)
            d.polygon([(32, 12), (46, 28), (32, 28)], fill=(220, 245, 255, 255)); d.polygon([(32, 28), (46, 28), (32, 52)], fill=(110, 170, 240, 255))
            d.line([(18, 28), (46, 28)], fill=INK)
        elif g == 'tien':  # mây + vầng hào quang
            d.ellipse([16, 12, 48, 24], outline=GOLD_L, width=2)
            for bx, by, br in [(22, 40, 9), (32, 36, 11), (43, 40, 9)]: d.ellipse([bx - br, by - br, bx + br, by + br], fill=WHITE, outline=(150, 170, 200, 255))
            d.rectangle([14, 40, 52, 49], fill=WHITE)
        else:              # sao nổ
            import math
            pts = []
            for k in range(16):
                rr = 22 if k % 2 == 0 else 10; a = math.radians(-90 + k * 22.5)
                pts.append((32 + math.cos(a) * rr, 32 + math.sin(a) * rr))
            d.polygon(pts, fill=GOLD_L, outline=INK); d.ellipse([26, 26, 38, 38], fill=(255, 90, 90, 255), outline=INK)
    return compose([part(disc, 80, 80), part(sym, 50, 60)], glow=glow)


# ---------------------------------------------------------------- ngọc phẩm (cpp_*)
GEMS = [((176, 128, 84, 255), 'Hoàng'), ((90, 140, 230, 255), 'Huyền'), ((90, 200, 110, 255), 'Địa'), ((250, 210, 70, 255), 'Thiên'),
        ((190, 110, 240, 255), 'Tiên'), ((240, 70, 80, 255), 'Thần'), ((250, 250, 255, 255), 'Hỗn Độn')]
def gem(i):
    c = GEMS[i][0]
    def body(d):
        d.polygon([(32, 8), (50, 22), (44, 52), (20, 52), (14, 22)], fill=c)
    def facet(d):
        lit = tuple(min(255, v + 60) for v in c[:3]) + (255,)
        dk = tuple(max(0, v - 70) for v in c[:3]) + (255,)
        d.polygon([(32, 8), (50, 22), (32, 26), (14, 22)], fill=lit)
        d.polygon([(32, 26), (50, 22), (44, 52)], fill=dk)
        d.polygon([(32, 26), (14, 22), (20, 52)], fill=c)
    im = compose([part(body, 40, 40), part(facet, 30, 50)], glow=c[:3])
    sparkle(im, 26, 20, 3)
    if i == 6: sparkle(im, 44, 40, 3, (180, 230, 255, 255)); sparkle(im, 20, 44, 2, (255, 200, 240, 255))
    return im


# ---------------------------------------------------------------- mảnh bí tịch (cpm_*)
FRAG = {'manh_cuu_tieu': 'loi', 'manh_long_tuong': 'luyenthe', 'manh_hu_thien': 'than', 'manh_diet_hon': 'am', 'manh_vo_thuong': 'kiem', 'manh_thien_ha': 'tu'}
def fragment(cat):
    def body(d):
        d.polygon([(10, 16), (34, 8), (54, 18), (50, 34), (56, 46), (36, 56), (20, 50), (12, 36), (16, 26)], fill=PAPER)
    def crease(d):
        d.line([(22, 20), (30, 36), (24, 48)], fill=PAPER_D, width=1)
        for y in (24, 30): d.line([(34, y), (48, y + 2)], fill=PAPER_D)
    def sym(d):
        glyph(d, cat, 34, 33, 11, CATC[cat], bg=PAPER)
    im = compose([part(body, 70, 70), part(crease, 20, 20), part(sym, 40, 60)], glow=CATC[cat][:3])
    sparkle(im, 52, 10, 3); return im


# ---------------------------------------------------------------- Tàng Kinh Các
def tangkinh():
    def base(d):
        d.rectangle([10, 46, 54, 56], fill=(176, 150, 120, 255)); d.rectangle([14, 38, 50, 46], fill=(214, 70, 60, 255))
    def mid(d):
        d.rectangle([16, 24, 48, 38], fill=(246, 232, 196, 255)); d.rectangle([30, 28, 34, 38], fill=INK)
        for x in (18, 42): d.rectangle([x, 26, x + 4, 36], fill=(120, 176, 230, 255))
    def roof(d):
        d.polygon([(6, 24), (32, 8), (58, 24), (50, 24), (32, 14), (14, 24)], fill=(60, 130, 100, 255))
        d.polygon([(10, 24), (32, 10), (54, 24)], fill=(80, 170, 130, 255)); d.rectangle([29, 4, 35, 10], fill=GOLD)
    im = compose([part(base, 70, 70), part(mid, 60, 60), part(roof, 80, 80)], glow=(255, 220, 130))
    sparkle(im, 8, 10, 3); sparkle(im, 56, 12, 2); return im


def build_all():
    ims = {}
    py = open(os.path.join(HERE, '..', 'src', 'data', 'congphap_v16.js'), encoding='utf8').read()
    books = re.findall(r"\[(10\d\d), 'cp_\w+', '[^']+', '[^']*', '(\w+)', '(\w+)'", py)
    assert len(books) == 40, len(books)
    idx = {}
    for tier, group, cat in books:
        idx[group] = idx.get(group, 0) + 1
        ims[f'cpb_{tier}'] = book(group, cat, idx[group])
    for c in CATS: ims[f'cpc_{c}'] = cat_icon(c)
    for g in GROUP_COL: ims[f'cpg_{g}'] = group_icon(g)
    for i in range(7): ims[f'cpp_{i + 1}'] = gem(i)
    for k, c in FRAG.items(): ims[f'cpm_{k}'] = fragment(c)
    ims['tangkinh'] = tangkinh()
    return ims


def contact_sheet(ims, path):
    names = list(ims); cols = 12; cell = 112; rows = (len(names) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cell, rows * (cell + 16)), (44, 36, 56, 255))
    d = ImageDraw.Draw(sheet)
    for n, k in enumerate(names):
        x = (n % cols) * cell; y = (n // cols) * (cell + 16)
        sheet.alpha_composite(ims[k].resize((96, 96), Image.NEAREST), (x + 8, y + 2))
        d.text((x + 4, y + cell - 4), k.replace('cpb_', '').replace('cpm_manh_', 'm_')[:14], fill=(235, 235, 245, 255))
    sheet.convert('RGB').save(path)


if __name__ == '__main__':
    ims = build_all()
    os.makedirs(OUT, exist_ok=True)
    for k, im in ims.items(): save(im, k, OUT)
    sheet = sys.argv[sys.argv.index('--sheet') + 1] if '--sheet' in sys.argv else None
    if sheet: contact_sheet(ims, sheet)
    # Unicode dự phòng cho emoji_fallback.json
    fb_path = os.path.join(HERE, '..', 'src', 'data', 'emoji_fallback.json')
    fb = json.load(open(fb_path, encoding='utf8'))
    ICON = {'tu': '🧘', 'luyenthe': '💪', 'loi': '⚡', 'bang': '❄️', 'am': '🌙', 'than': '🌪️', 'nguhanh': '☯️', 'hoa': '🔥', 'sinhco': '🌿', 'tho': '⛰️', 'kiem': '🗡️', 'toanien': '🌀', 'phongngu': '🛡️'}
    for c in CATS: fb[f'cpc_{c}'] = ICON[c]
    for tier, group, cat in re.findall(r"\[(10\d\d), 'cp_\w+', '[^']+', '[^']*', '(\w+)', '(\w+)'", open(os.path.join(HERE, '..', 'src', 'data', 'congphap_v16.js'), encoding='utf8').read()): fb[f'cpb_{tier}'] = ICON[cat]
    fb.update({'cpg_cu': '📜', 'cpg_nhan': '🌱', 'cpg_linh': '🔮', 'cpg_tien': '☁️', 'cpg_doc': '🌟', 'tangkinh': '🏯'})
    for i, e in enumerate(['🟫', '🟦', '🟩', '🟨', '🟪', '🟥', '⬜']): fb[f'cpp_{i + 1}'] = e
    for k in FRAG: fb[f'cpm_{k}'] = '🧩'
    json.dump(fb, open(fb_path, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print(f'Đã vẽ {len(ims)} emoji ->', OUT)
