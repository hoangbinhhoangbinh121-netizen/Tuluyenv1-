#!/usr/bin/env python3
"""
build_emoji_from_sheet_v19_1.py — cắt 51 emoji V19 từ BẢNG TRANH DO NGƯỜI DÙNG TỰ VẼ (assets/source/v19_1_sheet.png: lưới 10 cột × 6 hàng, nền xanh navy đồng nhất,
thứ tự = thứ tự bảng xem thử của make_pixel_emoji_v19.py). Tách nền theo khoảng cách màu, lấp lỗ, giữ tia sáng sát icon; xuất PNG 128x128 nền trong suốt, đặt giữa.
Chỉ GHI đè 51 khóa V19 (thay bản tôi vẽ bằng code); KHÔNG đụng emoji nào khác.   Chạy:  python3 scripts/build_emoji_from_sheet_v19_1.py [sheet] [--preview out.png]
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'assets', 'emoji'))
_av = sys.argv[1:]; _pv = _av.index('--preview') if '--preview' in _av else -1
args = [a for i, a in enumerate(_av) if not a.startswith('--') and not (_pv >= 0 and i == _pv + 1)]
SHEET = args[0] if args else os.path.normpath(os.path.join(HERE, '..', 'assets', 'source', 'v19_1_sheet.png'))

# Thứ tự ô trên bảng (trái→phải, trên→dưới). Một vài ô người dùng vẽ khác ý nghĩa vị trí nên đổi chỗ cho đúng ngữ nghĩa:
#   ô 8 (hồ lô) → linhngo19 · ô 9 (kiếm lửa xanh) → debinh · ô 10 (mặt trời trên mây) → sukien19
ORDER = ['bicanh19', 'chungdao', 'dekiep', 'dean', 'dehieu', 'benmenh', 'dedao', 'linhngo19', 'debinh', 'sukien19',
         'thucngo19', 'doi19', 'mob_thuong', 'mob_tinhanh', 'mob_mini', 'mob_canh', 'boss19', 'dd_satphat', 'dd_sinhmenh', 'dd_thoikhong',
         'dd_luanhoi', 'dd_hondon', 'dd_huydiet', 'db_kiem', 'db_chung', 'db_ban', 'db_an', 'db_thap', 'ev_dibien', 'ev_dicanh',
         'ev_truyenthua', 'ev_sieuthoat'] + [f'bc19_{i:02d}' for i in range(19)]
COLS = 10


def segment(im):
    """Tách 51 icon bằng thành phần liên thông (icon vẽ không đều ô). Trả về [(mask_toàn_ảnh, bbox)] theo thứ tự trái→phải, trên→dưới."""
    a = np.asarray(im.convert('RGB'), dtype=np.float32)
    bg = np.median(np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]), axis=0)
    m = np.sqrt(((a - bg) ** 2).sum(-1)) > 30
    lab, n = ndi.label(ndi.binary_dilation(m, iterations=6))
    sizes = ndi.sum(m, lab, range(1, n + 1)); big = [i + 1 for i, sz in enumerate(sizes) if sz > 1500]
    if len(big) != len(ORDER): raise SystemExit(f'tìm thấy {len(big)} icon, cần {len(ORDER)}')
    cy = {k: ndi.center_of_mass(lab == k) for k in big}
    srt = sorted(big, key=lambda k: cy[k][0]); rows = [srt[i:i + COLS] for i in range(0, len(srt), COLS)]
    order = [k for r in rows for k in sorted(r, key=lambda k: cy[k][1])]
    # hạt/tia sáng nhỏ rời: gán cho icon gần nhất trong 30px
    dist = {k: ndi.distance_transform_edt(lab != k) for k in big}
    masks = {k: (lab == k) & m for k in big}
    for i in range(1, n + 1):
        if i in big: continue
        comp = (lab == i) & m
        if not comp.any(): continue
        k = min(big, key=lambda k: dist[k][comp].min())
        if dist[k][comp].min() <= 30: masks[k] |= comp
    return a, [masks[k] for k in order]


def to_emoji(a, mask):
    ys, xs = np.where(mask); l, t, r, b = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    mm = ndi.binary_fill_holes(ndi.binary_closing(mask[t:b, l:r], iterations=2))
    rgba = Image.fromarray(a[t:b, l:r].astype(np.uint8)).convert('RGBA')
    rgba.putalpha(Image.fromarray((mm * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7)))
    w, h = rgba.size; s = 120.0 / max(w, h)
    ic = rgba.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    out = Image.new('RGBA', (128, 128), (0, 0, 0, 0)); out.alpha_composite(ic, ((128 - ic.size[0]) // 2, (128 - ic.size[1]) // 2)); return out


if __name__ == '__main__':
    im = Image.open(SHEET); done = []
    assert len(ORDER) == 51
    arr, masks = segment(im)
    for key, mk in zip(ORDER, masks):
        to_emoji(arr, mk).save(os.path.join(OUT, f'{key}.png')); done.append(key)
    print('đã cắt', len(done), 'emoji V19 từ', SHEET)
    if '--preview' in sys.argv:
        out = sys.argv[sys.argv.index('--preview') + 1]; cell = 140
        sh = Image.new('RGBA', (10 * cell, 6 * cell), (54, 57, 63, 255))
        for i, k in enumerate(ORDER):
            e = Image.open(os.path.join(OUT, f'{k}.png')).convert('RGBA'); x, y = (i % 10) * cell + 6, (i // 10) * cell + 6
            sh.alpha_composite(e, (x, y)); sh.alpha_composite(e.resize((32, 32), Image.LANCZOS), (x + 92, y + 92))
        sh.convert('RGB').save(out)
