#!/usr/bin/env python3
"""
build_emoji_from_sheet.py — cắt assets/source/sprite_sheet.png thành emoji pixel của bot (assets/emoji/<key>.png, 128x128, nền trong suốt).

  python3 scripts/build_emoji_from_sheet.py            # ghi đè các key có trong MAP
  python3 scripts/build_emoji_from_sheet.py --preview  # thêm assets/emoji_preview_v7.png

Ô trong sprite được ghi "hàng.cột" (đếm từ 0), đúng theo assets/source/sprite_boxes.json.
Các key KHÔNG có trong MAP (thanh bar_*/warbar_* và vài ký hiệu chức năng ✕ ✓ ＋ ↻ ⬆ ℹ ✏) giữ nguyên icon vẽ sẵn.
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'assets', 'source')
OUT = os.path.join(ROOT, 'assets', 'emoji')
SIZE, FIT = 128, 112          # khung 128, icon vừa trong 112 (cỡ "vừa" như emoji game)

MAP = {
 # menu chính / hành động
 'tuluyen': '8.5', 'bequan': '3.7', 'dotpha': '4.0', 'kiem': '3.1', 'caidat': '8.4', 'shop': '10.2', 'congkich': '3.2',
 'luyendan': '2.1', 'khivan': '10.5', 'phongngu': '10.6', 'linhcan': '7.6', 'linhgioilenh': '0.8', 'nguyenlieu': '11.2',
 'congphap': '4.1', 'phapbao': '5.1', 'phithangdau': '5.3', 'phithang': '10.0', 'cup': '5.3', 'thegioi': '6.1',
 'linhtinh': '4.2', 'linhthach': '0.1', 'linhmach': '6.5', 'thechat': '3.8', 'danduoc': '1.4', 'linhluc': '4.3',
 'dongphu': '1.2', 'dongthanh': '3.5', 'tongmon': '1.0', 'linhngo': '0.5', 'giaodich': '10.3', 'thanphap': '7.3',
 'vebicanhdacbiet': '0.6', 'linhphu': '7.1', 'daolu': '10.1', 'daolu_ketdoi': '1.8', 'daolu_chiatay': '11.9',
 'bicanh': '6.0', 'bicanhlinhgioi': '2.0', 'linhngothiendao': '0.4', 'thienkiepchiluc': '7.9', 'thienkiep': '7.2',
 'thiennhan': '11.3', 'thiennhanngusuy': '7.8', 'taytuydan': '0.0', 'khodo': '5.9', 'ruong': '0.7',
 'sukiendaiphu': '0.3', 'sk_coin': '10.3', 'sk_tien': '0.3', 'sk_thitruong': '9.7', 'sk_tang': '6.4', 'sk_giam': '6.3',
 'sk_mua': '10.2', 'sk_taisan': '5.9', 'sk_thienco': '5.1', 'sk_ngaunhien': '8.2', 'sk_nhiemvu': '5.0', 'sk_thuongvu': '3.4',
 'sk_baohiem': '10.6', 'sk_xephang': '4.0', 'sk_danhhieu': '5.3', 'sk_phanthuong': '5.2', 'sk_canhbao': '3.0',
 'sk_camkhoa': '7.1', 'sk_thoigian': '10.4', 'sk_luat': '8.6', 'sk_nganKho': '5.2',
 'bando': '2.7', 'batdautran': '3.0', 'bonhiem': '7.1', 'bosstg': '1.6', 'conghien': '4.8', 'daonguyentinh': '8.3',
 'dieukien': '8.6', 'gianhap': '6.9', 'hoihp': '11.2', 'hp': '10.1', 'mp': '7.7', 'hukhongkettinh': '8.1',
 'hukhongtinhhoa': '2.3', 'kenhrieng': '5.8', 'khac': '11.0', 'linhduocdacbiet': '2.2', 'loa': '4.6',
 'manhphapbao': '4.9', 'manhtiengioilenh': '4.8', 'nghenghiep': '3.9', 'nhangioi': '6.6', 'nhapcode': '10.8',
 'nhapid': '5.5', 'phagioidan': '2.5', 'roicudiem': '9.7', 'roitongmon': '8.9', 'satchieu': '6.8', 'satthuong': '7.5',
 'thanhvien': '3.6', 'thiendaoan': '4.7', 'thiendaothach': '0.2', 'thienhoatinh': '11.6', 'thuhoach': '2.6',
 'tienkim': '10.3', 'tienngoc': '8.0', 'tientinh': '4.9', 'thuongcothuho': '6.2', 'vundap': '8.7', 'yeuhach': '0.6',
 # phẩm chất (cờ hiệu 5 màu + mây trắng cho Phàm)
 'rar_pham': '1.1', 'rar_phothong': '9.0', 'rar_hiem': '9.1', 'rar_suthi': '9.2', 'rar_truyenthuyet': '9.3', 'rar_thanthoai': '9.4',
 # 15 cảnh giới
 'canhgioi_0': '11.9', 'canhgioi_1': '12.0', 'canhgioi_2': '12.5', 'canhgioi_3': '12.2', 'canhgioi_4': '12.1',
 'canhgioi_5': '12.3', 'canhgioi_6': '12.9', 'canhgioi_7': '12.4', 'canhgioi_8': '12.6', 'canhgioi_9': '7.2',
 'canhgioi_10': '12.8', 'canhgioi_11': '4.0', 'canhgioi_12': '6.3', 'canhgioi_13': '6.4', 'canhgioi_14': '5.3',
}

def load():
    im = Image.open(os.path.join(SRC, 'sprite_sheet.png')).convert('RGB')
    boxes = {f'{r}.{c}': b for r, c, b in json.load(open(os.path.join(SRC, 'sprite_boxes.json')))}
    return im, boxes

def cut(im, box):
    y0, y1, x0, x1 = box
    pad = 4
    crop = im.crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad))
    a = np.asarray(crop).astype(float)
    bg = np.array([33, 37, 47.0])
    d = np.abs(a - bg).sum(2)
    near = d < 40
    lab, _ = ndi.label(near)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgmask = np.isin(lab, list(edge))
    alpha = np.where(bgmask, 0.0, 1.0)
    soft = ndi.binary_dilation(bgmask, iterations=1) & ~bgmask      # viền mềm 1px
    alpha[soft] = np.clip((d[soft] - 25) / 60, 0, 1)
    # nhấc màu viền tối về gần màu icon để không còn quầng xám
    rgba = np.dstack([a, alpha * 255]).astype(np.uint8)
    tile = Image.fromarray(rgba, 'RGBA')
    bb = tile.getbbox()
    tile = tile.crop(bb) if bb else tile
    w, h = tile.size
    s = FIT / max(w, h)
    tile = tile.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(tile, ((SIZE - tile.width) // 2, (SIZE - tile.height) // 2), tile)
    return canvas

def main():
    im, boxes = load()
    os.makedirs(OUT, exist_ok=True)
    cache = {}
    for key, cell in MAP.items():
        if cell not in cache:
            cache[cell] = cut(im, boxes[cell])
        cache[cell].save(os.path.join(OUT, f'{key}.png'))
    print(f'Đã ghi {len(MAP)} emoji từ {len(cache)} ô sprite.')
    if '--preview' in sys.argv:
        files = sorted(f for f in os.listdir(OUT) if f.endswith('.png'))
        cols = 14; cell = 96
        sheet = Image.new('RGBA', (cols * cell, ((len(files) + cols - 1) // cols) * cell), (32, 36, 46, 255))
        for i, f in enumerate(files):
            t = Image.open(os.path.join(OUT, f)).convert('RGBA').resize((80, 80), Image.LANCZOS)
            sheet.alpha_composite(t, ((i % cols) * cell + 8, (i // cols) * cell + 8))
        sheet.save(os.path.join(ROOT, 'assets', 'emoji_preview_v7.png'))

if __name__ == '__main__':
    main()
