#!/usr/bin/env python3
"""
build_congphap_emoji_from_sheet_v16.py — cắt assets/source/congphap_sheet_v16.png (sheet AI do người dùng cung cấp,
lưới 12 cột x 6 hàng = 72 icon) thành emoji Công Pháp V16: cpb_1001..1040, cpc_*, cpg_*, cpp_1..7, cpm_*, tangkinh.
Nền trong suốt 128x128. Dùng lại bộ tách nền GrabCut của v14.1.
  python3 scripts/build_congphap_emoji_from_sheet_v16.py [--preview out.png] [--light] [--no-write]
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pet_emoji_from_sheet_v14_1 as P

HERE = os.path.dirname(os.path.abspath(__file__))
SHEET = os.path.join(HERE, '..', 'assets', 'source', 'congphap_sheet_v16.png')
OUT = os.path.join(HERE, '..', 'assets', 'emoji')
COLS, ROWS = 12, 6
LABEL_CUT = 24          # bỏ dải chữ nhãn ở đáy mỗi ô
NAMES = ([f'cpb_{t}' for t in range(1001, 1041)]
         + [f'cpc_{c}' for c in 'tu luyenthe loi bang am than nguhanh hoa sinhco tho kiem toanien phongngu'.split()]
         + [f'cpg_{g}' for g in 'cu nhan linh tien doc'.split()]
         + [f'cpp_{p}' for p in range(1, 8)]
         + [f'cpm_manh_{m}' for m in 'cuu_tieu long_tuong hu_thien diet_hon vo_thuong thien_ha'.split()]
         + ['tangkinh'])
assert len(NAMES) == COLS * ROWS


def build():
    im = np.asarray(Image.open(SHEET).convert('RGB'))
    H, W = im.shape[:2]
    cw, ch = W / COLS, H / ROWS
    out = {}
    for i, k in enumerate(NAMES):
        r, c = divmod(i, COLS)
        cell = im[int(r * ch):int((r + 1) * ch) - LABEL_CUT, int(c * cw):int((c + 1) * cw)]
        mode = 'fill' if k.startswith(('cpb_', 'cpc_', 'cpg_')) else ('hull' if k.startswith('cpp_') else None)
        out[k] = P.cut_cell(cell, mode=mode)
    return out


def preview(out, path, bg=(36, 38, 48)):
    names = list(out); cell = 128; cols = 12
    rows = (len(names) + cols - 1) // cols
    sh = Image.new('RGBA', (cols * cell, rows * (cell + 14)), bg + (255,))
    d = ImageDraw.Draw(sh)
    try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 10)
    except Exception: f = None
    for i, k in enumerate(names):
        x, y = (i % cols) * cell, (i // cols) * (cell + 14)
        sh.alpha_composite(out[k], (x, y)); d.text((x + 3, y + 129), k, fill=(220, 220, 220, 255), font=f)
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
