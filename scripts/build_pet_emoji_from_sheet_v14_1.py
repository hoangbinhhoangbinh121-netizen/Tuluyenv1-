#!/usr/bin/env python3
"""
build_pet_emoji_from_sheet_v14_1.py — cắt assets/source/pet_sheet_v14_1.png (sheet AI do người dùng cung cấp, lưới 9 cột x 7 hàng)
thành emoji Linh Thú: 45 loài (pet_<id>) + 9 huy hiệu phẩm (pet_tier1..9), nền trong suốt 128x128.
Hàng cuối (trứng, khế ước, vật phẩm) giữ bản vẽ pixel của scripts/make_pixel_emoji_v14_pets.py (sheet chỉ vẽ lại y hệt).
Tách nền bằng GrabCut + giữ thành phần liên thông chứa thân thú.
  python3 scripts/build_pet_emoji_from_sheet_v14_1.py [--preview out.png] [--no-write]
"""
import json, os, sys
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
SHEET = os.path.join(HERE, '..', 'assets', 'source', 'pet_sheet_v14_1.png')
OUT = os.path.join(HERE, '..', 'assets', 'emoji')
SIZE, FIT = 128, 116
COLS, ROWS = 9, 7


def cut_cell(cell, disc=False, mode=None):
    """cell: ndarray RGB (h,w,3) -> Image RGBA đã tách nền, đã cắt sát + căn giữa 128x128."""
    h, w = cell.shape[:2]
    pad = 10                                                   # đệm để hào quang không dính mép ô
    img = cv2.copyMakeBorder(cell, pad, pad, pad, pad, cv2.BORDER_REPLICATE)
    H, W = img.shape[:2]
    bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    # mô hình nền: màu viền
    ring = np.concatenate([img[:6].reshape(-1, 3), img[-6:].reshape(-1, 3), img[:, :6].reshape(-1, 3), img[:, -6:].reshape(-1, 3)]).astype(np.float32)
    _, _, cent = cv2.kmeans(ring, 4, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 0.5), 3, cv2.KMEANS_PP_CENTERS)
    d = np.min(np.linalg.norm(img.astype(np.float32)[:, :, None, :] - cent[None, None, :, :], axis=3), axis=2)
    mask = np.full((H, W), cv2.GC_PR_BGD, np.uint8)
    mask[d > 38] = cv2.GC_PR_FGD
    mask[d > 85] = cv2.GC_FGD
    mask[:8], mask[-8:], mask[:, :8], mask[:, -8:] = cv2.GC_BGD, cv2.GC_BGD, cv2.GC_BGD, cv2.GC_BGD
    # vùng chắc chắn là nền: gần màu nền & xa tâm
    yy, xx = np.mgrid[:H, :W]
    far = ((yy - H / 2) / (H / 2)) ** 2 + ((xx - W / 2) / (W / 2)) ** 2 > 0.95
    mask[far & (d < 30)] = cv2.GC_BGD
    bgd, fgd = np.zeros((1, 65)), np.zeros((1, 65))
    try:
        cv2.grabCut(bgr, mask, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
    except cv2.error:
        pass
    fg = ((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD))
    fg = ndi.binary_opening(fg, iterations=1)
    fg = ndi.binary_closing(fg, iterations=2)
    lab, n = ndi.label(fg)
    if n:
        sizes = ndi.sum(fg, lab, range(1, n + 1))
        big = max(sizes)
        keep = [i + 1 for i, s in enumerate(sizes) if s >= max(30, big * 0.04)]     # giữ thân + các mảnh hào quang lớn
        fg = np.isin(lab, keep)
    if disc:      # huy hiệu phẩm cấp: viên cầu tròn — cắt theo hình tròn quanh tâm ô (nền mây trắng làm GrabCut hỏng phẩm 1)
        yy2, xx2 = np.mgrid[:H, :W]
        fg = ((yy2 - H / 2) ** 2 + (xx2 - W / 2) ** 2) <= 51 ** 2
    else:
        # bỏ các mảng còn mang màu nền (kẽ chân, gạc, vây) — không lấp lỗ như trước
        imf = img.astype(np.int32)
        bluish = imf[:, :, 2] >= imf[:, :, 1] - 2          # nền núi mây ngả xanh lam; thân thú xanh lá/vàng/đỏ không dính
        fg &= ~((d < 34) & bluish & (imf.max(axis=2) < 150))   # chỉ gỡ mảng nền TỐI; bóng trắng-xanh của thú trắng giữ lại
        holes = ndi.binary_fill_holes(fg) & ~fg
        hl, hn = ndi.label(holes)
        for i in range(1, hn + 1):
            if (hl == i).sum() < 20:
                fg[hl == i] = True
        fg = ndi.binary_opening(fg, iterations=1)
        lab, n = ndi.label(fg)
        if n:
            sizes = ndi.sum(fg, lab, range(1, n + 1)); big = max(sizes)
            fg = np.isin(lab, [i + 1 for i, z in enumerate(sizes) if z >= max(30, big * 0.04)])
    if mode == 'fill':      # v16: biển/huy hiệu đặc — lấp kín phần ruột tối (chữ rune/biểu tượng tối bị GrabCut coi là nền)
        fg = ndi.binary_closing(fg, iterations=7)
        fg = ndi.binary_fill_holes(fg)
    elif mode == 'hull':    # v16: tinh thể — lấy bao lồi của thân chính
        pts = cv2.findNonZero(fg.astype(np.uint8))
        if pts is not None:
            hm = np.zeros(fg.shape, np.uint8)
            cv2.fillConvexPoly(hm, cv2.convexHull(pts), 1)
            fg = hm.astype(bool)
    a = fg.astype(np.float32)
    a = cv2.GaussianBlur(a, (0, 0), 0.8)
    a = np.clip((a - 0.25) / 0.5, 0, 1)
    rgba = np.dstack([img, (a * 255).astype(np.uint8)]).astype(np.uint8)
    tile = Image.fromarray(rgba, 'RGBA')
    bb = tile.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    if bb:
        tile = tile.crop(bb)
    w2, h2 = tile.size
    s = FIT / max(w2, h2)
    tile = tile.resize((max(1, round(w2 * s)), max(1, round(h2 * s))), Image.LANCZOS)
    can = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    can.paste(tile, ((SIZE - tile.width) // 2, (SIZE - tile.height) // 2), tile)
    return can


def build():
    spec = json.load(open(os.path.join(HERE, 'pet_species_v14.json')))
    im = np.asarray(Image.open(SHEET).convert('RGB'))
    H, W = im.shape[:2]
    cw, ch = W / COLS, H / ROWS
    out = {}
    names = ['pet_' + s['id'] for s in spec] + [f'pet_tier{t}' for t in range(1, 10)]
    for i, k in enumerate(names):
        r, c = divmod(i, COLS)
        cell = im[int(r * ch):int((r + 1) * ch), int(c * cw):int((c + 1) * cw)]
        out[k] = cut_cell(cell, disc=k.startswith('pet_tier'))
    return out


def preview(out, path, bg=(36, 38, 48)):
    names = list(out); cell = 128; cols = 9
    rows = (len(names) + cols - 1) // cols
    sh = Image.new('RGBA', (cols * cell, rows * (cell + 14)), bg + (255,))
    d = ImageDraw.Draw(sh)
    try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 10)
    except Exception: f = None
    for i, k in enumerate(names):
        x, y = (i % cols) * cell, (i // cols) * (cell + 14)
        sh.alpha_composite(out[k], (x, y)); d.text((x + 3, y + 129), k[4:], fill=(220, 220, 220, 255), font=f)
    sh.convert('RGB').save(path)


if __name__ == '__main__':
    out = build()
    if '--preview' in sys.argv:
        preview(out, sys.argv[sys.argv.index('--preview') + 1])
        if '--light' in sys.argv: preview(out, sys.argv[sys.argv.index('--preview') + 1].replace('.png', '_light.png'), (235, 235, 240))
    if '--no-write' not in sys.argv:
        for k, im in out.items():
            im.save(os.path.join(OUT, k + '.png'))
        print('đã ghi', len(out), 'emoji')
