#!/usr/bin/env python3
"""
build_race_emoji_from_sheet_v21_7.py — cắt 31 emoji CHỦNG TỘC từ BẢNG TRANH DO NGƯỜI DÙNG TỰ VẼ (assets/source/race_sheet_v21_7.png, PNG có kênh alpha:
nền trong suốt, mỗi icon có nhãn tên key ở dưới). Thay bản tôi vẽ bằng code (make_pixel_emoji_v21_5.py) — chỉ ghi đè 31 khóa chủng tộc, KHÔNG đụng emoji khác.
Chạy:  python3 scripts/build_race_emoji_from_sheet_v21_7.py [bảng.png] [--preview out.png]
Không đổi tên file emoji ⇒ phải thêm hậu tố vào assets/emoji_revisions.json (script này tự ghi 'b' cho 31 khóa nếu chưa có hậu tố khác).
"""
import os, sys, json
import numpy as np, cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'assets', 'emoji'))
REV = os.path.normpath(os.path.join(HERE, '..', 'assets', 'emoji_revisions.json'))
_a = sys.argv[1:]; PREV = _a[_a.index('--preview') + 1] if '--preview' in _a else None
args = [x for i, x in enumerate(_a) if not x.startswith('--') and not (PREV and i > 0 and _a[i - 1] == '--preview')]
SHEET = args[0] if args else os.path.normpath(os.path.join(HERE, '..', 'assets', 'source', 'race_sheet_v21_7.png'))

# Thứ tự ô trên bảng (trái→phải, trên→dưới): hàng 1-4 mỗi hàng 6 ô, hàng 5 có 7 ô. Nhãn trên bảng "bl_nhat_ban" = khoá `bl_niet_ban` của bot.
ROWS = [['race_nhan', 'race_long', 'race_phuong', 'race_ma', 'race_linh', 'race_yeu'],
        ['bl_nhan_hoang', 'bl_chien_than', 'bl_thuong_long', 'bl_hac_long', 'bl_chu_tuoc', 'bl_niet_ban'],
        ['bl_huyet_ma', 'bl_co_ma', 'bl_phong_linh', 'bl_moc_linh', 'bl_ho_yeu', 'bl_ho_vuong'],
        ['rev_nhan', 'rev_long', 'rev_phuong', 'rev_ma', 'rev_linh', 'rev_yeu'],
        ['aw_1', 'aw_2', 'aw_3', 'race_awaken', 'race_bloodline', 'race_evolve', 'race_change']]
LABEL = np.array([15, 22, 43])


def label_top(rgb, a, x0, x1, ylo, yhi):
    """Hàng đầu tiên của nhãn (khối ≥ 18 hàng, mỗi hàng ≥ 22 điểm màu nền nhãn). None nếu không thấy."""
    near = (np.abs(rgb[:, x0:x1] - LABEL).max(axis=2) < 20) & (a[:, x0:x1] > 200)
    cnt = near.sum(axis=1)
    for r in range(ylo, yhi - 18):
        if all(cnt[r + k] >= 22 for k in range(18)): return r
    return None


def main():
    im = np.asarray(Image.open(SHEET).convert('RGBA')); H, W = im.shape[:2]
    rgb = im[..., :3].astype(int); a = im[..., 3].copy()
    a[a < 6] = 0
    # cột/hàng: tìm thành phần lớn theo từng hàng (hàng dải y gần đúng)
    bands = [(0, 235), (236, 430), (431, 612), (613, 805), (806, H)]
    solid = (a > 200).astype(np.uint8)
    res = {}
    for (y0, y1), keys in zip(bands, ROWS):
        n = len(keys)
        # chia cột bằng khoảng trống theo x (cột alpha>200 theo hàng này)
        col = solid[y0:y1].sum(axis=0) > 0
        xs = np.where(col)[0]
        groups = []; s = xs[0]; p = xs[0]
        for x in xs[1:]:
            if x - p > 6: groups.append((s, p)); s = x
            p = x
        groups.append((s, p))
        groups = [g for g in groups if g[1] - g[0] > 60]          # bỏ tia sáng lẻ
        if len(groups) != n:
            # gộp nhóm gần nhau (huy hiệu dính) hoặc chia theo lưới đều
            cuts = np.linspace(0, W, n + 1).astype(int); groups = [(cuts[i], cuts[i + 1] - 1) for i in range(n)]
        for (gx0, gx1), k in zip(groups, keys):
            cx = (gx0 + gx1) // 2; x0 = max(0, gx0 - 12); x1 = min(W, gx1 + 12)
            lt = label_top(rgb, a, max(0, cx - 60), min(W, cx + 60), y0 + 120, y1)
            cut = (lt - 2) if lt is not None else y1 - 28
            sub = im[y0:cut, x0:x1].copy()
            # giữ các thành phần gắn với icon chính (loại tia sáng "+" xa) — nhưng giữ cả tia sáng sát icon
            m = (sub[..., 3] > 200).astype(np.uint8)
            m = cv2.dilate(m, np.ones((9, 9), np.uint8))
            nlab, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
            big = 1 + int(np.argmax(st[1:, 4]))
            keep = (lab == big)
            sub[..., 3] = np.where(keep, sub[..., 3], 0)
            ys, xx = np.where(sub[..., 3] > 40)
            sub = sub[ys.min():ys.max() + 1, xx.min():xx.max() + 1]
            res[k] = sub
    return res


def to128(sub):
    h, w = sub.shape[:2]; pad = 4; box = 128 - 2 * pad
    sc = min(box / w, box / h)
    nw, nh = max(1, round(w * sc)), max(1, round(h * sc))
    # nền trong suốt dưới RGB rác → nhân alpha trước khi co (tránh viền màu lạ)
    f = sub.astype(np.float32); al = f[..., 3:4] / 255.0
    pm = np.concatenate([f[..., :3] * al, f[..., 3:4]], axis=2)
    r = cv2.resize(pm, (nw, nh), interpolation=cv2.INTER_AREA if sc < 1 else cv2.INTER_LANCZOS4)
    a2 = np.clip(r[..., 3:4], 0, 255); rgb2 = np.where(a2 > 0.5, r[..., :3] / np.maximum(a2 / 255.0, 1e-3), 0)
    out = np.zeros((128, 128, 4), np.float32); ox, oy = (128 - nw) // 2, (128 - nh) // 2
    out[oy:oy + nh, ox:ox + nw, :3] = np.clip(rgb2, 0, 255); out[oy:oy + nh, ox:ox + nw, 3:4] = a2
    out[..., 3][out[..., 3] < 8] = 0
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


if __name__ == '__main__':
    res = main(); order = [k for r in ROWS for k in r]; assert len(res) == 31
    if PREV:
        sheet = Image.new('RGBA', (8 * 136, 4 * 136), (48, 52, 60, 255)); light = Image.new('RGBA', (8 * 136, 4 * 136), (245, 245, 247, 255))
        for i, k in enumerate(order):
            e = to128(res[k]); x, y = (i % 8) * 136 + 4, (i // 8) * 136 + 4; sheet.alpha_composite(e, (x, y)); light.alpha_composite(e, (x, y))
        comb = Image.new('RGBA', (8 * 136, 8 * 136)); comb.paste(sheet, (0, 0)); comb.paste(light, (0, 4 * 136)); comb.convert('RGB').save(PREV); print('preview', PREV)
    else:
        os.makedirs(OUT, exist_ok=True)
        for k in order: to128(res[k]).save(os.path.join(OUT, f'{k}.png'), optimize=True)
        try: rev = json.load(open(REV, encoding='utf8'))
        except Exception: rev = {}
        for k in order: rev.setdefault(k, 'b')
        json.dump(rev, open(REV, 'w', encoding='utf8'), indent=1, ensure_ascii=False); print('đã ghi', len(order), 'emoji +', REV)
