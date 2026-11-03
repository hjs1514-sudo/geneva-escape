"""Canva 그림의 바깥 배경(흰색·밝은 단색)을 지워 투명 PNG로 만든다.
사용: python3 tools/cutout.py 원본.png 결과.png [최대폭] [허용차]
가장자리에서 이어진 배경색만 지우므로 건물 안쪽의 흰 대리석은 남는다."""
import sys
from collections import deque
from PIL import Image, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
maxw = int(sys.argv[3]) if len(sys.argv) > 3 else 900
tol = int(sys.argv[4]) if len(sys.argv) > 4 else 26
# 그림자 허용차: 배경에서 이어진 옅은 회색 그림자를 반투명한 진짜 그림자로 바꾼다(흰 대리석이 많은 건물은 tol과 같게)
shadow_tol = int(sys.argv[5]) if len(sys.argv) > 5 else tol

im = Image.open(src).convert('RGB')
w, h = im.size
px = im.load()
corners = [px[1, 1], px[w - 2, 1], px[1, h - 2], px[w - 2, h - 2]]
bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
dist = lambda c: max(abs(c[0] - bg[0]), abs(c[1] - bg[1]), abs(c[2] - bg[2]))
near = lambda c: dist(c) <= shadow_tol

mask = Image.new('L', (w, h), 255)
mk = mask.load()
q = deque()
for x in range(w):
    q.append((x, 0)); q.append((x, h - 1))
for y in range(h):
    q.append((0, y)); q.append((w - 1, y))
while q:
    x, y = q.popleft()
    if mk[x, y] == 0 or not near(px[x, y]):
        continue
    mk[x, y] = 0
    if x > 0: q.append((x - 1, y))
    if x < w - 1: q.append((x + 1, y))
    if y > 0: q.append((x, y - 1))
    if y < h - 1: q.append((x, y + 1))

shadow = Image.new('L', (w, h), 0)
sh = shadow.load()
for y in range(h):
    for x in range(w):
        if mk[x, y] == 0:
            d = dist(px[x, y])
            if d > tol:
                sh[x, y] = min(150, int((d - tol) * 2.2) + 40)
mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
shadow = shadow.filter(ImageFilter.GaussianBlur(3))
out = im.convert('RGBA')
out.putalpha(mask)
if shadow_tol > tol:
    dark = Image.new('RGBA', (w, h), (30, 30, 20, 0))
    dark.putalpha(shadow)
    out = Image.alpha_composite(dark, out)
box = mask.point(lambda v: 255 if v > 40 else 0).getbbox()
if box:
    out = out.crop(box)
if out.width > maxw:
    out = out.resize((maxw, round(out.height * maxw / out.width)), Image.LANCZOS)
out.save(dst, optimize=True)
print(dst, out.size, 'bg', bg)
