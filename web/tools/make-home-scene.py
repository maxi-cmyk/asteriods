"""Regenerates assets/home-scene.png: the Home backdrop (violet nebula, banded
gas giant, teal moon, lit rocks). Original, procedural art.

Needs Pillow + NumPy; run from the repo root:
    python3 -m venv v && v/bin/pip install pillow numpy
    v/bin/python web/tools/make-home-scene.py
The animated overlay (twinkle, drifting dust, shooting star) is drawn at
runtime by presentation.mjs; this image stays static. In-game rocks and the
ship are re-lit at load by art-grade.mjs; this script applies the same ramp.
"""
import json, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

from pathlib import Path
ROOT = str(Path(__file__).resolve().parents[1] / 'assets') + '/'
W, H = 480, 270
yy, xx = np.mgrid[0:H, 0:W].astype(float)

atlas = Image.open(ROOT + 'sprites.png').convert('RGBA')
meta = json.load(open(ROOT + 'sprites.json'))
def spr(name):
    m = meta[name]
    return atlas.crop((m['x'], m['y'], m['x'] + m['w'], m['y'] + m['h']))

BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
def bayer(h, w): return np.tile(BAYER, (h // 4 + 1, w // 4 + 1))[:h, :w]

def ramp(t, stops):
    t = np.clip(t, 0, 1); out = np.zeros(t.shape + (3,))
    for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
        m = (t >= p0) & (t <= p1)
        u = ((t - p0) / (p1 - p0))[..., None]
        out[m] = (np.array(c0) * (1 - u) + np.array(c1) * u)[m]
    return out

def quant(rgb, levels, dith):
    x = np.floor(rgb / 255.0 * (levels - 1) + dith[..., None])
    return np.clip(x / (levels - 1) * 255, 0, 255)

def noise(rng, h, w, scale, oct=4):
    out = np.zeros((h, w)); amp = 1; tot = 0
    for o in range(oct):
        s = max(2, int(scale / 2 ** o))
        g = rng.random((h // s + 3, w // s + 3))
        im = Image.fromarray((g * 255).astype(np.uint8)).resize(((w // s + 3) * s, (h // s + 3) * s), Image.BICUBIC)
        out += np.asarray(im, float)[:h, :w] / 255 * amp; tot += amp; amp *= .5
    return out / tot

def additive(img, fn, blur, k=1.6):
    g = Image.new('RGBA', img.size, (0, 0, 0, 0)); fn(ImageDraw.Draw(g))
    g = g.filter(ImageFilter.GaussianBlur(blur))
    a = np.asarray(img).astype(float); b = np.asarray(g).astype(float)
    a[..., :3] = np.clip(a[..., :3] + b[..., :3] * (b[..., 3:] / 255) * k, 0, 255)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')

def glow(img, x, y, r, col, a=255, blur=None, k=1.6):
    return additive(img, lambda d: d.ellipse((x - r, y - r, x + r, y + r), fill=col + (a,)), blur or r * .6, k)

def outlined(d, xy, text, font, fill, edge=(14, 6, 32, 255), off=1):
    x, y = xy
    for ox, oy in ((-off, 0), (off, 0), (0, -off), (0, off), (off, off)):
        d.text((x + ox, y + oy), text, font=font, fill=edge)
    d.text((x, y), text, font=font, fill=fill)

# ------------------------------------------------------------------ background
def make_bg(seed=7, sun=(40, 18), bloom=.35, dark=1.0):
    rng = np.random.default_rng(seed); random.seed(seed)
    sky = ramp(yy / H, [(0, (9, 6, 28)), (.45, (26, 12, 58)), (.8, (74, 24, 92)), (1, (150, 52, 104))])
    n1 = noise(rng, H, W, 90); n2 = noise(rng, H, W, 40)
    neb = np.clip((n1 - .42) * 2.4, 0, 1) * np.clip(1.15 - yy / H * .6, 0, 1)
    neb2 = np.clip((n2 - .5) * 2.8, 0, 1) * np.clip((xx / W) * 1.2, 0, 1) * .6
    sky += neb[..., None] * np.array([70, 20, 120]) * .8 + neb2[..., None] * np.array([20, 70, 130]) * .7
    d = np.hypot(xx - sun[0], yy - sun[1])
    sky += np.clip(1 - d / 210, 0, 1)[..., None] ** 2 * np.array([255, 150, 90]) * bloom
    sky *= dark
    img = Image.fromarray(quant(sky, 20, bayer(H, W) * .9).astype(np.uint8)).convert('RGBA')
    d = ImageDraw.Draw(img)
    def stars(n, b):
        for _ in range(n):
            c = random.choice([(255, 255, 255), (190, 210, 255), (255, 220, 190), (230, 190, 255)])
            a = b * random.uniform(.5, 1)
            d.point((random.randrange(W), random.randrange(H - 40)), fill=tuple(int(v * a) for v in c) + (255,))
    stars(200, .35); stars(90, .6); stars(26, 1)
    for _ in range(9):
        x, y = random.randrange(10, W - 10), random.randrange(10, H - 70)
        d.point((x, y), fill=(255, 255, 255, 255))
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)): d.point((x + dx, y + dy), fill=(150, 170, 255, 255))
        d.point((x + 2, y), fill=(90, 100, 190, 255)); d.point((x - 2, y), fill=(90, 100, 190, 255))
    return img

def planet(img, cx, cy, r, bands, stops, light=(-.7, -.55), atmo=(255, 160, 110), seed=0, dim=1.0):
    rng = np.random.default_rng(seed)
    S = int(r * 2 + 6)
    ys, xs = np.mgrid[0:S, 0:S].astype(float)
    ux = (xs - S / 2) / r; uy = (ys - S / 2) / r
    rr = ux ** 2 + uy ** 2; disc = rr <= 1
    z = np.sqrt(np.clip(1 - rr, 0, 1))
    lx, ly = light; lz = .6; nl = math.sqrt(lx * lx + ly * ly + lz * lz)
    lam = np.clip((ux * lx + uy * ly + z * lz) / nl, 0, 1)
    wn = noise(rng, S, S, 20, 3)
    b = np.sin((uy + wn * .16) * bands) * .5 + .5
    shade = lam ** .85
    col = ramp(b, stops) * (.16 + .95 * shade)[..., None] * dim
    col += (1 - shade)[..., None] * np.array([6, 10, 40])
    rim = np.clip((rr - .72) / .28, 0, 1) ** 2 * np.clip(lam * 1.4 + .15, 0, 1)
    col += rim[..., None] * np.array(atmo) * .85 * dim
    col = quant(col, 14, bayer(S, S) * .8)
    im = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).convert('RGBA')
    im.putalpha(Image.fromarray((disc * 255).astype(np.uint8)))
    g = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse((cx - r - 3, cy - r - 3, cx + r + 3, cy + r + 3), fill=atmo + (int(70 * dim),))
    img.alpha_composite(g.filter(ImageFilter.GaussianBlur(5)))
    img.alpha_composite(im, (int(cx - S / 2), int(cy - S / 2)))

PURPLE = [(0, (92, 34, 120)), (.35, (168, 70, 150)), (.6, (230, 130, 150)), (.8, (120, 48, 140)), (1, (70, 28, 110))]
TEAL = [(0, (40, 70, 110)), (.5, (80, 150, 170)), (1, (50, 90, 130))]
DUST = [(0, (110, 70, 80)), (.5, (180, 130, 110)), (1, (120, 80, 90))]

def ridge(img, base=238, amp=1.0, seed=0):
    arr = np.asarray(img).copy(); hx = np.arange(W)
    r = base + amp * (7 * np.sin(hx / 21.0 + seed) + 5 * np.sin(hx / 8.3 + 1 + seed) + 3 * np.sin(hx / 3.7))
    for x in range(W):
        t = int(r[x])
        arr[t:H, x, :3] = (arr[t:H, x, :3] * .12 + np.array([4, 3, 14]) * .9).astype(np.uint8)
        arr[t, x, :3] = np.clip(arr[t, x, :3].astype(int) + [120, 60, 70], 0, 255)
    return Image.fromarray(arr)

def lit_rock(name, scale=1, tint=1.0):
    s = spr(name); a = np.asarray(s).astype(float); h, w = a.shape[:2]
    lum = (a[..., 0] * .3 + a[..., 1] * .59 + a[..., 2] * .11) / 255
    ys, xs = np.mgrid[0:h, 0:w].astype(float)
    ld = -((xs / w - .5) * .75 + (ys / h - .5) * .65) * 1.6
    t = np.clip(lum * 1.15 + ld * .55 - .05, 0, 1)
    col = ramp(t, [(0, (14, 8, 34)), (.3, (50, 28, 78)), (.55, (116, 72, 112)), (.78, (214, 150, 128)), (1, (255, 230, 190))])
    col += np.clip(-ld, 0, 1)[..., None] * np.array([6, 20, 52]) * .6
    col = quant(col, 12, np.zeros((h, w))) * tint
    out = np.concatenate([np.clip(col, 0, 255), a[..., 3:]], axis=2).astype(np.uint8)
    al = a[..., 3] > 0
    for y in range(1, h):
        for x in range(1, w):
            if al[y, x] and (not al[y - 1, x] or not al[y, x - 1]):
                out[y, x, :3] = np.clip(out[y, x, :3].astype(int) * .5 + np.array([255, 200, 150]) * .6, 0, 255)
    im = Image.fromarray(out, 'RGBA')
    if scale != 1: im = im.resize((int(w * scale), int(h * scale)), Image.NEAREST)
    return im

def brighten(im, k=1.25, add=22):
    a = np.asarray(im).astype(float); a[..., :3] = np.clip(a[..., :3] * k + add, 0, 255)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')

def ship_fx(img, sx, sy, shield=True, thrust=1.0, flame=True):
    img = glow(img, sx - 25, sy, 13, (255, 130, 60), 255, 6)
    img = glow(img, sx - 19, sy, 6, (120, 220, 255), 255, 3)
    d = ImageDraw.Draw(img)
    if flame:
        for i, (c, ln) in enumerate([((255, 245, 210), 8), ((255, 170, 70), 14), ((255, 110, 50), 20), ((200, 60, 90), 28)]):
            ln = int(ln * thrust); h = max(1, 3 - i // 2)
            d.rectangle((sx - 12 - ln, sy - h // 2, sx - 12, sy + h // 2), fill=c + (255,))
        for _ in range(14):
            d.point((sx - 14 - random.randrange(6, int(44 * thrust) + 7), sy + random.randint(-4, 4)), fill=(255, random.randint(120, 200), 70, 255))
    img = glow(img, sx, sy, 12, (90, 200, 255), 140, 5)
    sh = brighten(spr('ship-aim-1'))
    img.alpha_composite(sh, (sx - sh.width // 2, sy - sh.height // 2))
    if shield:
        d = ImageDraw.Draw(img)
        for a in range(0, 360, 12):
            d.point((sx + int(math.cos(math.radians(a)) * 17), sy + int(math.sin(math.radians(a)) * 17)), fill=(110, 240, 255, 150))
    return img

def bullets(img, sy, mx, shots):
    img = glow(img, mx, sy, 5, (255, 220, 150), 255, 3)
    d = ImageDraw.Draw(img); d.polygon([(mx, sy - 3), (mx + 6, sy), (mx, sy + 3)], fill=(255, 250, 220, 255))
    for bx, by, c, tl in shots:
        img = additive(img, lambda dd, bx=bx, by=by, c=c: dd.ellipse((bx - 7, by - 3, bx + 7, by + 3), fill=c + (255,)), 3)
        d = ImageDraw.Draw(img)
        d.rectangle((bx - tl, by, bx - 1, by), fill=tuple(int(v * .45) for v in c) + (255,))
        d.rectangle((bx, by - 1, bx + 4, by), fill=(255, 255, 255, 255))
        d.rectangle((bx - 3, by - 1, bx - 1, by), fill=c + (255,))
    return img


def main():
    random.seed(21)
    img = make_bg(seed=5, sun=(30, 10), bloom=.30)
    planet(img, 372, 214, 150, 15, PURPLE, light=(-.8, -.5), atmo=(255, 150, 120), seed=4)
    planet(img, 420, 52, 14, 5, TEAL, atmo=(140, 220, 255), seed=6)
    planet(img, 248, 36, 5, 3, DUST, atmo=(255, 190, 140), seed=8)
    for n, (x, y) in [('rock-0-0-4', (448, 118)), ('rock-1-1-2', (300, 176)), ('rock-2-0-5', (330, 96)), ('rock-1-2-6', (420, 160))]:
        r = lit_rock(n)
        img.alpha_composite(r, (x - r.width // 2, y - r.height // 2))
    # The ship and the sun glare are animated at runtime by presentation.mjs.
    # A soft dark gradient on the left keeps the menu column readable without a box.
    arr = np.asarray(img).astype(float)
    arr[..., :3] *= (1 - np.clip(1 - xx / 230, 0, 1) ** 1.4 * .62)[..., None]
    out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA').convert('RGB')
    out.resize((W * 2, H * 2), Image.NEAREST).save(ROOT + 'home-scene.png', optimize=True)
    print('wrote', ROOT + 'home-scene.png')


if __name__ == '__main__':
    main()

