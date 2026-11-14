#!/usr/bin/env python3
"""
build_emoji_from_sheet_v17.py — cắt assets/source/nghe_sheet_v17.png (sheet AI do người dùng cung cấp, lưới 14 cột x 11 hàng = 147 icon)
thành emoji V17: i17_<id> (118 vật phẩm), c17_<CAT> (11), r17_1..7, p17_<nghề> (4), s17_<ô> (7). Thứ tự ô = đúng thứ tự trong scripts/make_pixel_emoji_v17_nghe.py.
Nền trong suốt 128x128, dùng bộ tách nền GrabCut của v14.1.
  python3 scripts/build_emoji_from_sheet_v17.py [--preview out.png] [--light] [--no-write]
"""
import json, os, sys
import numpy as np
import cv2
from scipy import ndimage as ndi
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pet_emoji_from_sheet_v14_1 as P

HERE = os.path.dirname(os.path.abspath(__file__))
SHEET = os.path.join(HERE, '..', 'assets', 'source', 'nghe_sheet_v17.png')
OUT = os.path.join(HERE, '..', 'assets', 'emoji')
COLS, ROWS = 14, 11
CATS = ['LINH_DUOC', 'KHOANG_VAT', 'YEU_THU_TAI_LIEU', 'TRAN_DAO_TAI_LIEU', 'LINH_THUC', 'THIEN_DIA_CHI_BAO', 'NGUYEN_LIEU_TRUNG_GIAN', 'DAN_DUOC', 'TRAN_PHAP', 'VAT_PHAM_KHAC', 'LINH_TINH_TAI_LIEU']
ITEMS = json.load(open(os.path.join(HERE, 'emoji_v17_items.json'), encoding='utf-8'))
NAMES = ([it['key'] for it in ITEMS] + [f'c17_{c}' for c in CATS] + [f'r17_{r}' for r in range(1, 8)]
         + [f'p17_{p}' for p in ('dan', 'khi', 'tran', 'thuc')] + [f's17_{s}' for s in ('weapon', 'armor', 'jade', 'mirror', 'boots', 'ring', 'bell')])
assert len(NAMES) == 147 and len(NAMES) <= COLS * ROWS, len(NAMES)
FILL = ('i17_tp_', 'i17_pk_', 'i17_tv_', 'i17_td_tran_ban', 'i17_tdc_tien_gioi_lenh', 'i17_tdc_dan_hoa', 'p17_', 's17_', 'c17_TRAN_PHAP', 'r17_')
HULL = ('i17_kv_', 'i17_tdc_kim_nguyen', 'i17_tdc_moc_nguyen', 'i17_tdc_thuy_nguyen', 'i17_tdc_hoa_nguyen', 'i17_tdc_tho_nguyen')


# Các ô vật thể tối/xanh navy hoặc trắng mỏng: GrabCut nhầm với nền núi → dùng tách theo màu (navy / bright)
COLOR_MODE = {'i17_kv_huyen_thiet': 'goldhull', 'i17_kl_huyen': 'goldhull', 'p17_dan': 'goldhull', 'p17_khi': 'goldhull',
              's17_armor': 'poly', 's17_jade': 'teal', 'i17_yt_yeu_cot': 'bright', 'c17_TRAN_DAO_TAI_LIEU': 'cream'}
DISC = ('i17_tdc_hon_don_nguyen_khi',)


def cut_circle(cell, shrink=0.96):
    """Vật thể tròn tối trên nền núi: tìm đường tròn bằng Hough rồi cắt theo đó."""
    pad = 10
    img = cv2.copyMakeBorder(cell, pad, pad, pad, pad, cv2.BORDER_REPLICATE)
    H, W = img.shape[:2]
    g = cv2.medianBlur(cv2.cvtColor(img, cv2.COLOR_RGB2GRAY), 5)
    cs = cv2.HoughCircles(g, cv2.HOUGH_GRADIENT, 1, W, param1=90, param2=22, minRadius=int(W * 0.25), maxRadius=int(W * 0.45))
    if cs is None:
        return P.cut_cell(cell, disc=True)
    # chọn vòng gần tâm nhất
    cs = sorted(cs[0], key=lambda c: (c[0] - W / 2) ** 2 + (c[1] - H / 2) ** 2)[0]
    m = np.zeros((H, W), np.uint8)
    cv2.circle(m, (int(cs[0]), int(cs[1])), int(cs[2] * shrink), 1, -1)
    a = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 0.8)
    a = np.clip((a - 0.25) / 0.5, 0, 1)
    tile = Image.fromarray(np.dstack([img, (a * 255).astype(np.uint8)]).astype(np.uint8), 'RGBA')
    bb = tile.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    if bb: tile = tile.crop(bb)
    sc = P.FIT / max(tile.size)
    tile = tile.resize((max(1, round(tile.width * sc)), max(1, round(tile.height * sc))), Image.LANCZOS)
    can = Image.new('RGBA', (P.SIZE, P.SIZE), (0, 0, 0, 0))
    can.paste(tile, ((P.SIZE - tile.width) // 2, (P.SIZE - tile.height) // 2), tile)
    return can


MINFRAC = {'s17_armor': 0.3}


BOX = {'p17_khi': (0.2, 0.2, 0.9, 0.8), 'i17_kv_huyen_thiet': (0.12, 0.25, 0.97, 0.85), 's17_armor': (0.12, 0.0, 0.85, 0.74)}


POLY = {'s17_armor': [(0.15, 0.06), (0.83, 0.06), (0.83, 0.62), (0.70, 0.76), (0.28, 0.76), (0.15, 0.62)]}


def cut_color(cell, kind, minfrac=0.06, box=None, key=None):
    h, w = cell.shape[:2]
    pad = 10
    img = cv2.copyMakeBorder(cell, pad, pad, pad, pad, cv2.BORDER_REPLICATE)
    H, W = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV).astype(np.int32)
    hh, ss, vv = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    if kind == 'poly':      # khung đa giác cắt tay (tỉ lệ ô gốc): tấm giáp hình thang
        m = np.zeros((H, W), np.uint8)
        pts = np.array([[pad + x * w, pad + y * h] for x, y in POLY[key]], np.int32)
        cv2.fillPoly(m, [pts], 1)
        fg = m.astype(bool)
    elif kind in ('goldhull', 'teal'):
        if kind == 'goldhull':
            fg = ((hh >= 12) & (hh <= 38) & (ss >= 90) & (vv >= 120)) | ((hh >= 100) & (hh <= 135) & (ss >= 90) & (vv <= 120))
        else:
            fg = (hh >= 70) & (hh <= 100) & (ss >= 115) & (vv >= 110)
        yy, xx = np.mgrid[:H, :W]
        fg &= ((yy - H / 2) / (H * 0.5)) ** 2 + ((xx - W / 2) / (W * 0.5)) ** 2 <= 1.0
        if box:      # khung cắt tay (tỉ lệ ô gốc) cho vật thể có mảng nền xanh tối dính sát
            bm = np.zeros_like(fg)
            bm[pad + int(box[1] * h):pad + int(box[3] * h), pad + int(box[0] * w):pad + int(box[2] * w)] = True
            fg &= bm
        fg = cv2.morphologyEx(fg.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))).astype(bool)
        lab, n = ndi.label(fg)
        if n:
            sizes = ndi.sum(fg, lab, range(1, n + 1)); big = max(sizes)
            fg = np.isin(lab, [i + 1 for i, z in enumerate(sizes) if z >= max(30, big * (0.25 if kind == 'teal' else minfrac))])
        pts = cv2.findNonZero(fg.astype(np.uint8))
        hm = np.zeros(fg.shape, np.uint8)
        if kind == 'teal':
            if pts is not None:
                (cx, cy), rad = cv2.minEnclosingCircle(pts)
                cv2.circle(hm, (int(cx), int(cy)), int(rad), 1, -1)
        elif pts is not None:
            cv2.fillConvexPoly(hm, cv2.convexHull(pts), 1)
        fg = hm.astype(bool)
        if kind == 'goldhull':      # bỏ phần nền xám-xanh nằm trong bao lồi (kẽ chân, góc)
            bgc = (ss < 75) & (vv >= 55) & (vv <= 150) & (hh >= 70) & (hh <= 115)
            fg &= ~bgc
            fg = cv2.morphologyEx(fg.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))).astype(bool)
            fg = ndi.binary_fill_holes(cv2.morphologyEx(fg.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))).astype(bool))
            lab, n = ndi.label(fg)
            if n:
                sizes = ndi.sum(fg, lab, range(1, n + 1)); big = max(sizes)
                fg = np.isin(lab, [i + 1 for i, z in enumerate(sizes) if z >= big * 0.1])
    elif kind == 'cream':
        fg = (vv >= 150) & (hh >= 8) & (hh <= 35) & (ss >= 25)
        yy, xx = np.mgrid[:H, :W]
        fg = cv2.morphologyEx(fg.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))).astype(bool)
        fg = ndi.binary_fill_holes(fg)
        lab, n = ndi.label(fg)
        if n:
            sizes = ndi.sum(fg, lab, range(1, n + 1)); fg = lab == (1 + int(np.argmax(sizes)))
        pts = cv2.findNonZero(fg.astype(np.uint8)); hm = np.zeros(fg.shape, np.uint8)
        if pts is not None: cv2.fillConvexPoly(hm, cv2.convexHull(pts), 1)
        fg = hm.astype(bool)
    elif kind == 'navy':
        navy = (hh >= 100) & (hh <= 135) & (ss >= 70) & (vv <= 150)
        gold = (hh >= 12) & (hh <= 38) & (ss >= 90) & (vv >= 120)
        dark = vv <= 50
        fg = navy | gold | dark
    else:   # bright
        fg = (vv >= 165) & (ss <= 70)
    yy, xx = np.mgrid[:H, :W]
    fg &= ((yy - H / 2) / (H * 0.5)) ** 2 + ((xx - W / 2) / (W * 0.5)) ** 2 <= 1.0
    if kind in ('navy', 'bright'):
        fg = ndi.binary_opening(fg, iterations=1)
        k = 9 if kind == 'navy' else 5
        fg = cv2.morphologyEx(fg.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))).astype(bool)
        fg = ndi.binary_fill_holes(fg)
        lab, n = ndi.label(fg)
        if n:
            sizes = ndi.sum(fg, lab, range(1, n + 1)); big = max(sizes)
            fg = np.isin(lab, [i + 1 for i, z in enumerate(sizes) if z >= max(30, big * 0.08)])
    a = cv2.GaussianBlur(fg.astype(np.float32), (0, 0), 0.8)
    a = np.clip((a - 0.25) / 0.5, 0, 1)
    tile = Image.fromarray(np.dstack([img, (a * 255).astype(np.uint8)]).astype(np.uint8), 'RGBA')
    bb = tile.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    if bb: tile = tile.crop(bb)
    s = P.FIT / max(tile.size)
    tile = tile.resize((max(1, round(tile.width * s)), max(1, round(tile.height * s))), Image.LANCZOS)
    can = Image.new('RGBA', (P.SIZE, P.SIZE), (0, 0, 0, 0))
    can.paste(tile, ((P.SIZE - tile.width) // 2, (P.SIZE - tile.height) // 2), tile)
    return can


def build():
    im = np.asarray(Image.open(SHEET).convert('RGB'))
    H, W = im.shape[:2]
    cw, ch = W / COLS, H / ROWS
    out = {}
    for i, k in enumerate(NAMES):
        r, c = divmod(i, COLS)
        cell = im[int(r * ch):int((r + 1) * ch), int(c * cw):int((c + 1) * cw)]
        mode = 'fill' if k.startswith(FILL) else None
        if k in COLOR_MODE: out[k] = cut_color(cell, COLOR_MODE[k], MINFRAC.get(k, 0.06), BOX.get(k), k)
        elif k in DISC: out[k] = cut_circle(cell)
        else: out[k] = P.cut_cell(cell, mode=mode)
    return out


def preview(out, path, bg=(36, 38, 48)):
    names = list(out); cell = 96; cols = 14
    rows = (len(names) + cols - 1) // cols
    sh = Image.new('RGBA', (cols * cell, rows * cell), bg + (255,))
    for i, k in enumerate(names):
        sh.alpha_composite(out[k].resize((cell - 4, cell - 4), Image.LANCZOS), ((i % cols) * cell + 2, (i // cols) * cell + 2))
    sh.convert('RGB').save(path)


if __name__ == '__main__':
    out = build()
    if '--preview' in sys.argv:
        p = sys.argv[sys.argv.index('--preview') + 1]
        preview(out, p)
        if '--light' in sys.argv: preview(out, p.replace('.png', '_light.png'), (235, 235, 240))
    if '--no-write' not in sys.argv:
        for k, im in out.items():
            im.save(os.path.join(OUT, k + '.png'))
        print('đã ghi', len(out), 'emoji')
