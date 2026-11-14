#!/usr/bin/env python3
"""
build_emoji_from_sheet_v18_canhgioi.py — cắt emoji cảnh giới 14–28 từ BẢNG TRANH DO NGƯỜI DÙNG TỰ VẼ (assets/source/canhgioi_sheet_v18_1.png).
Nền panel là màu xanh navy đồng nhất → tách theo khoảng cách màu với nền cục bộ + lấp lỗ, xuất PNG 128x128 nền trong suốt, đặt giữa.
Chỉ ghi canhgioi_14..28; KHÔNG đụng canhgioi_0..13 và các emoji khác.
Chạy:  python3 scripts/build_emoji_from_sheet_v18_canhgioi.py [đường_dẫn_sheet]
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'assets', 'emoji'))
SHEET = sys.argv[1] if len(sys.argv) > 1 else os.path.normpath(os.path.join(HERE, '..', 'assets', 'source', 'canhgioi_sheet_v18_1.png'))

# (khoảng x, khoảng y) vùng chứa icon (trên nhãn chữ) — toạ độ trên ảnh gốc 1536x1024
BOX = {
    14: (560, 760, 425, 545), 15: (790, 975, 425, 545), 16: (1000, 1190, 425, 545), 17: (1235, 1400, 425, 545),
    18: (152, 320, 585, 700), 19: (360, 540, 585, 700), 20: (580, 760, 585, 700), 21: (790, 975, 585, 700), 22: (1000, 1190, 585, 700), 23: (1220, 1390, 585, 700),
    24: (172, 340, 740, 875), 25: (370, 570, 740, 875), 26: (590, 820, 740, 875), 27: (840, 1060, 740, 875), 28: (1110, 1320, 740, 875),
}


def cut(im, box, thr=34):
    x0, x1, y0, y1 = box
    a = np.asarray(im.convert('RGB'), dtype=np.float32)[y0:y1, x0:x1]
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((a - bg) ** 2).sum(-1))
    m = dist > thr
    m = ndi.binary_closing(m, iterations=3)
    m = ndi.binary_fill_holes(m)
    lab, n = ndi.label(m)
    if n == 0: raise SystemExit(f'không tách được icon trong {box}')
    sizes = ndi.sum(m, lab, range(1, n + 1)); main = int(np.argmax(sizes)) + 1
    near = ndi.distance_transform_edt(lab != main) <= 22          # giữ thêm tia sáng/hạt linh khí sát icon, bỏ mảng nền (núi, mép panel) ở xa
    keep = [i + 1 for i, sz in enumerate(sizes) if sz >= 12 and (i + 1 == main or near[lab == i + 1].any() and sz < sizes.max() * 0.5)]
    m = np.isin(lab, keep)
    m = ndi.binary_opening(m, iterations=1)
    ys, xs = np.where(m)
    return Image.fromarray(a.astype(np.uint8)).convert('RGBA'), m, (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)


def to_emoji(im, box):
    rgba, m, (l, t, r, b) = cut(im, box)
    alpha = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    rgba.putalpha(alpha)
    ic = rgba.crop((l, t, r, b)); w, h = ic.size; s = 120.0 / max(w, h)
    ic = ic.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    out = Image.new('RGBA', (128, 128), (0, 0, 0, 0)); out.alpha_composite(ic, ((128 - ic.size[0]) // 2, (128 - ic.size[1]) // 2)); return out


if __name__ == '__main__':
    im = Image.open(SHEET)
    for idx, box in BOX.items():
        to_emoji(im, box).save(os.path.join(OUT, f'canhgioi_{idx}.png'))
    print('đã cắt', len(BOX), 'emoji cảnh giới 14–28 từ', SHEET)
