#!/usr/bin/env python3
"""
build_emoji_from_sheet_v19_9.py — cắt emoji a19_* từ BẢNG TRANH NGƯỜI DÙNG TỰ VẼ (lưới 8 cột × 5 hàng, nền mờ gradient không đồng nhất).
Tách nền theo ĐỘ NÉT cục bộ (icon pixel sắc, nền mờ), lấp lỗ, xuất PNG 128x128 nền trong suốt.
Chỉ ghi đè các khóa a19_* được liệt kê trong MAP (ô nào hợp nghĩa mới dùng; còn lại giữ bản vẽ bằng code của make_pixel_emoji_v19_9.py).
KHÔNG đụng emoji nào khác.   Chạy:  python3 scripts/build_emoji_from_sheet_v19_9.py <sheet.png> [--preview out.png]
(Bảng ~2 MB nên không đưa vào zip giao hàng — giữ ở máy người dùng; script nhận đường dẫn bảng qua tham số.)
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'assets', 'emoji'))
ROWS, COLS = 5, 8
# (hàng, cột) từ 0 → khóa emoji
MAP = {'a19_atk': (0, 0), 'a19_item': (0, 4), 'a19_tuyet': (1, 3), 'a19_gift': (1, 7), 'a19_sk': (2, 0), 'a19_than': (2, 2), 'a19_warn': (2, 4),
       'a19_trong': (2, 5), 'a19_ll': (2, 6), 'a19_dead': (2, 7), 'a19_win': (3, 1), 'a19_crown': (3, 5), 'a19_next': (4, 0), 'a19_log': (4, 1),
       'a19_rest': (4, 3), 'a19_map': (4, 5), 'a19_retreat': (4, 6)}


def masks(im):
    a = np.asarray(im.convert('RGB'), dtype=np.float32); g = a.mean(-1)
    mu = ndi.uniform_filter(g, 5); sd = np.sqrt(np.maximum(ndi.uniform_filter(g * g, 5) - mu * mu, 0))
    m = ndi.binary_opening(ndi.binary_fill_holes(ndi.binary_closing(sd > 14, iterations=4)), iterations=2)
    H, W = m.shape; ch, cw = H / ROWS, W / COLS; out = {}
    lab, n = ndi.label(m); objs = ndi.find_objects(lab); area = ndi.sum(m, lab, range(1, n + 1)); cen = ndi.center_of_mass(m, lab, range(1, n + 1))
    for r in range(ROWS):
        for c in range(COLS):
            y0, y1, x0, x1 = r * ch, (r + 1) * ch, c * cw, (c + 1) * cw
            inside = [i for i in range(n) if y0 <= cen[i][0] < y1 and x0 <= cen[i][1] < x1 and area[i] > 150]
            if not inside: continue
            main = max(inside, key=lambda i: area[i]); sl = objs[main]
            by0, by1, bx0, bx1 = sl[0].start - 30, sl[0].stop + 30, sl[1].start - 30, sl[1].stop + 30
            keep = np.zeros_like(m)
            for i in inside:
                cy, cx = cen[i]
                if i == main or (area[i] > 0.06 * area[main] and by0 <= cy <= by1 and bx0 <= cx <= bx1): keep |= (lab == i + 1)
            out[(r, c)] = keep
    return a, out


def to_emoji(a, mask):
    mask = ndi.binary_erosion(mask, iterations=2)   # ăn bớt quầng nền mờ bám quanh icon
    ys, xs = np.where(mask); l, t, r, b = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    rgba = Image.fromarray(a[t:b, l:r].astype(np.uint8)).convert('RGBA')
    rgba.putalpha(Image.fromarray((mask[t:b, l:r] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.9)))
    w, h = rgba.size; s = 120.0 / max(w, h)
    ic = rgba.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    o = Image.new('RGBA', (128, 128), (0, 0, 0, 0)); o.alpha_composite(ic, ((128 - ic.size[0]) // 2, (128 - ic.size[1]) // 2)); return o


if __name__ == '__main__':
    av = [x for x in sys.argv[1:] if not x.startswith('--')]
    pv = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    sheet = av[0]; a, ms = masks(Image.open(sheet))
    for key, rc in MAP.items(): to_emoji(a, ms[rc]).save(os.path.join(OUT, f'{key}.png'))
    print('đã cắt', len(MAP), 'emoji a19_* từ bảng người dùng')
    if pv:
        keys = list(MAP); cell = 140; cols = 6; rows = (len(keys) + cols - 1) // cols
        sh = Image.new('RGBA', (cols * cell, rows * cell), (54, 57, 63, 255))
        for i, k in enumerate(keys):
            e = Image.open(os.path.join(OUT, f'{k}.png')).convert('RGBA'); x, y = (i % cols) * cell + 6, (i // cols) * cell + 6
            sh.alpha_composite(e, (x, y)); sh.alpha_composite(e.resize((32, 32), Image.LANCZOS), (x + 92, y + 92))
        sh.convert('RGB').save(pv)
