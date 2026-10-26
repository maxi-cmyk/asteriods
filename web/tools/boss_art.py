"""Toolkit for the boss and mini-boss art: the 8-bit pixel painter (Px), palettes,
masks, region backdrops and combat effects used by the concept sheets. The shipped
sprites are built from it by make-bosses.py (design: nextSteps.md).

Original art. NASA/ESA imagery was never traced; shapes follow the designs in
nextSteps.md. Needs Pillow + NumPy (+ fontTools and brotli for the label font).
"""
import math, random, sys, tempfile
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
from space_lib import ramp, quant, bayer, smoothstep, fbm3, ridged, hexrgb, to_image  # noqa: E402
from space_objects import blur, starfield  # noqa: E402
import json  # noqa: E402

W, H = 480, 270
OUTLINE = (16, 8, 30)


# ------------------------------------------------------------------ fonts
_font_cache = {}
def font(size, name='Jersey10-Regular'):
    key = (name, size)
    if key not in _font_cache:
        out = Path(tempfile.gettempdir()) / f'{name}.ttf'
        if not out.exists():
            from fontTools.ttLib import TTFont
            f = TTFont(str(ROOT / 'web' / 'assets' / 'fonts' / f'{name}.woff2')); f.flavor = None; f.save(str(out))
        _font_cache[key] = ImageFont.truetype(str(out), size)
    return _font_cache[key]


# ------------------------------------------------------------------ masks and volumes
def new_mask(S):
    return Image.new('L', S, 0)

def ellipse(S, cx, cy, rx, ry=None):
    m = new_mask(S); ImageDraw.Draw(m).ellipse((cx - rx, cy - (ry or rx), cx + rx, cy + (ry or rx)), fill=255); return m

def poly(S, pts):
    m = new_mask(S); ImageDraw.Draw(m).polygon(pts, fill=255); return m

def rect(S, x0, y0, x1, y1):
    m = new_mask(S); ImageDraw.Draw(m).rectangle((x0, y0, x1, y1), fill=255); return m

def line(S, pts, width):
    m = new_mask(S); ImageDraw.Draw(m).line(pts, fill=255, width=width, joint='curve'); return m

def arc_band(S, cx, cy, r0, r1, a0, a1):
    """Annular sector between angles a0..a1 (radians, y down)."""
    ys, xs = np.mgrid[0:S[1], 0:S[0]].astype(float)
    r = np.hypot(xs - cx + .5, ys - cy + .5); a = np.arctan2(ys - cy + .5, xs - cx + .5)
    da = (a - a0 + math.pi) % (2 * math.pi) - math.pi
    span = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
    inside = (r >= r0) & (r <= r1) & (da >= 0) & (da <= span if span >= 0 else da <= span + 2 * math.pi)
    return Image.fromarray((inside * 255).astype(np.uint8))

def union(*ms):
    out = np.zeros(np.asarray(ms[0]).shape, bool)
    for m in ms: out |= np.asarray(m) > 127
    return Image.fromarray((out * 255).astype(np.uint8))

def subtract(a, b):
    return Image.fromarray(((np.asarray(a) > 127) & ~(np.asarray(b) > 127)).astype(np.uint8) * 255)

def inter(a, b):
    return Image.fromarray(((np.asarray(a) > 127) & (np.asarray(b) > 127)).astype(np.uint8) * 255)

def volume(mask, stops, depth=2.6, k=6.0, base=.3, tint=None, tex=None, seed=0):
    """Light a mask like a bevelled solid from the upper left. Returns (rgb, bool mask)."""
    m = np.asarray(mask) > 127
    b = blur(m.astype(float), depth)
    gy, gx = np.gradient(b)
    lit = np.clip(.5 + (-(gx * .7 + gy * .7)) * k, 0, 1)
    t = base + .42 * b ** .8 + .5 * (lit - .5)
    if tex is not None: t = t + tex
    col = ramp(np.clip(t, 0, 1), stops)
    if tint is not None: col = col * np.asarray(tint)
    return col, m

def paint(canvas, mask, stops, outline=OUTLINE, **kw):
    """Composite a lit volume with a 1px outline onto an RGBA canvas (numpy float)."""
    col, m = volume(mask, stops, **kw)
    return paste_rgb(canvas, col, m, outline)

def paste_rgb(canvas, col, m, outline=OUTLINE):
    out = canvas
    if outline is not None:
        grown = m.copy()
        grown[1:] |= m[:-1]; grown[:-1] |= m[1:]; grown[:, 1:] |= m[:, :-1]; grown[:, :-1] |= m[:, 1:]
        ring = grown & ~m
        out[ring, :3] = outline; out[ring, 3] = 1
    out[m, :3] = col[m]; out[m, 3] = 1
    return out

def canvas(S):
    return np.zeros((S[1], S[0], 4))

def to_sprite(c, levels=16):
    rgb = quant(c[..., :3], levels, None)
    a = (c[..., 3] > .5) * 255
    return Image.fromarray(np.dstack([rgb, a]).astype(np.uint8), 'RGBA')


# ------------------------------------------------------------------ palettes
STEEL = [(0, '#141a2c'), (.3, '#2c3c5c'), (.62, '#5e7aa4'), (1, '#c0d4ea')]
STEEL_DARK = [(0, '#0c1020'), (.5, '#242e48'), (1, '#6a84aa')]
AMBER_CORE = [(0, '#8e2a08'), (.45, '#ff8a1e'), (.8, '#ffd26a'), (1, '#fff6d0')]
ICE = [(0, '#1c3a78'), (.4, '#4a8ad0'), (.75, '#a8e0f8'), (1, '#ffffff')]
CHAR = [(0, '#0a0508'), (.45, '#241418'), (.8, '#4a2e2c'), (1, '#7a524a')]
STONE = [(0, '#1a1c2c'), (.4, '#42485e'), (.75, '#7a829e'), (1, '#c8d0e4')]
RUST = [(0, '#2a1208'), (.5, '#7a3a1c'), (1, '#d08a54')]
JELLY = [(0, '#0c4a62'), (.4, '#3aa8c0'), (.8, '#b0f0f4'), (1, '#ffffff')]
VOID = [(0, '#05020c'), (.5, '#1c0e3a'), (1, '#5a3c98')]
WARDEN = [(0, '#120a2c'), (.5, '#3a2468'), (.85, '#7a5ab8'), (1, '#c8aef0')]
HALO = [(0, '#3a0a00'), (.35, '#c0420c'), (.7, '#ffa030'), (1, '#fff0b8')]
LAVA = [(0, '#8e1408'), (.5, '#ff6a1e'), (1, '#ffe27a')]


# ------------------------------------------------------------------ effects
def glow_layer(size, spots):
    """Additive glow image (float RGB) from [(x, y, radius, (r,g,b), strength)]."""
    ys, xs = np.mgrid[0:size[1], 0:size[0]].astype(float)
    out = np.zeros((size[1], size[0], 3))
    for x, y, r, col, s in spots:
        d = np.hypot(xs - x, ys - y) / max(r, 1)
        g = np.clip(1 - d, 0, 1) ** 2
        out += g[..., None] * np.array(col) * s
    return out

def add_glow(img, spots):
    """8-bit glow: four dithered steps of the glow colour, never a smooth gradient."""
    a = np.asarray(img.convert('RGB')).astype(float)
    h, w, _ = a.shape; ys, xs = np.mgrid[0:h, 0:w]
    bay = np.tile(np.array([[0, 2], [3, 1]]) / 4.0, (h // 2 + 1, w // 2 + 1))[:h, :w]
    for x, y, r, col, s in spots:
        d = np.hypot(xs - x, ys - y) / max(r, 1)
        lvl = np.clip(1 - d, 0, 1) ** 1.3 * min(1.3, s * 1.25)
        q = np.clip(np.floor(lvl * 4 + bay - .25) / 4, 0, 1)
        mix = (q * min(.92, .45 + .35 * s))[..., None]
        a = a * (1 - mix) + np.array(col, float) * mix
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).convert('RGBA')


def dashed(draw, p0, p1, color, dash=5, gap=4, width=1):
    x0, y0 = p0; x1, y1 = p1
    L = math.hypot(x1 - x0, y1 - y0); n = int(L // (dash + gap)) + 1
    ux, uy = (x1 - x0) / (L or 1), (y1 - y0) / (L or 1)
    for i in range(n):
        s = i * (dash + gap); e = min(L, s + dash)
        draw.line((x0 + ux * s, y0 + uy * s, x0 + ux * e, y0 + uy * e), fill=color, width=width)

def ring_marker(draw, cx, cy, r, color, dots=28):
    for i in range(dots):
        a = i / dots * math.tau
        draw.point((cx + math.cos(a) * r, cy + math.sin(a) * r * .55), fill=color)

def projectile(img, x, y, kind='needle', t=0):
    """Hostile projectile sprites: pink-orange with a dark rim; shootable ones get a white rim."""
    d = ImageDraw.Draw(img)
    if kind == 'needle':
        d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=OUTLINE + (255,)); d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(255, 130, 140, 255)); d.point((x - 1, y - 1), fill=(255, 235, 220, 255))
    elif kind == 'shard':
        d.polygon([(x - 4, y), (x, y - 3), (x + 4, y), (x, y + 3)], fill=OUTLINE + (255,)); d.polygon([(x - 3, y), (x, y - 2), (x + 3, y), (x, y + 2)], fill=(190, 235, 255, 255))
    elif kind == 'bolt':
        d.rectangle((x - 6, y - 2, x + 3, y + 2), fill=OUTLINE + (255,)); d.rectangle((x - 5, y - 1, x + 2, y + 1), fill=(255, 150, 120, 255)); d.rectangle((x - 1, y - 1, x + 2, y), fill=(255, 245, 220, 255))
    elif kind == 'sine':
        d.ellipse((x - 5, y - 5, x + 5, y + 5), fill=OUTLINE + (255,)); d.ellipse((x - 4, y - 4, x + 4, y + 4), fill=(110, 230, 235, 255)); d.ellipse((x - 2, y - 3, x, y - 1), fill=(240, 255, 255, 255))
    elif kind == 'spiral':
        d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=OUTLINE + (255,)); d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(255, 190, 90, 255))
    elif kind == 'missile':
        d.polygon([(x - 7, y), (x - 3, y - 3), (x + 4, y - 3), (x + 6, y), (x + 4, y + 3), (x - 3, y + 3)], fill=(255, 255, 255, 255))
        d.polygon([(x - 6, y), (x - 3, y - 2), (x + 4, y - 2), (x + 5, y), (x + 4, y + 2), (x - 3, y + 2)], fill=(255, 120, 100, 255)); d.point((x + 4, y), fill=(255, 240, 200, 255))
    elif kind == 'mine':
        d.ellipse((x - 6, y - 6, x + 6, y + 6), fill=(255, 255, 255, 255)); d.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(70, 30, 50, 255))
        for a in range(0, 360, 60): d.point((x + math.cos(math.radians(a)) * 7, y + math.sin(math.radians(a)) * 7), fill=(255, 220, 220, 255))
        d.ellipse((x - 1, y - 1, x + 1, y + 1), fill=(255, 90, 90, 255) if int(t * 6) % 2 else (255, 200, 120, 255))
    elif kind == 'lob':
        d.ellipse((x - 6, y - 6, x + 6, y + 6), fill=OUTLINE + (255,)); d.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(255, 106, 30, 255)); d.ellipse((x - 3, y - 3, x + 1, y + 1), fill=(255, 226, 122, 255))
    elif kind == 'spore':
        d.ellipse((x - 9, y - 9, x + 9, y + 9), fill=(255, 255, 255, 255)); d.ellipse((x - 8, y - 8, x + 8, y + 8), fill=(60, 150, 140, 255)); d.ellipse((x - 4, y - 5, x + 1, y), fill=(190, 255, 240, 255))
    elif kind == 'bubble':
        d.ellipse((x - 8, y - 8, x + 8, y + 8), outline=(255, 255, 255, 255), width=1); d.ellipse((x - 5, y - 6, x - 2, y - 3), fill=(255, 255, 255, 255)); d.ellipse((x - 7, y - 7, x + 7, y + 7), fill=(120, 230, 240, 60))


# ------------------------------------------------------------------ region backdrops
REGIONS = {
    'frontier': dict(sky=['#09061c', '#1a0c3a', '#4a185c', '#96346a'], neb=[(70, 20, 120), (20, 70, 130)], bloom=(255, 150, 90), ridge=True,
                     worlds=[('storm-giant', 398, 222), ('moon-small', 82, 74), ('moon-tiny', 304, 46)]),
    'violet': dict(sky=['#08051a', '#140a30', '#2c1248', '#5a2060'], neb=[(90, 30, 130), (30, 60, 150)], bloom=(255, 140, 100),
                   worlds=[('ice-giant', 352, 168), ('ice-moon', 120, 70)]),
    'ember': dict(sky=['#1c0a1a', '#3a1424', '#6a2430', '#8c3a3c'], neb=[(120, 40, 60)], bloom=(255, 170, 110), hills=True,
                  worlds=[('lava-world', 122, 100), ('hot-jupiter', 408, 62)]),
    'ruins': dict(sky=['#080c1c', '#10162e', '#1c2442', '#2c3656'], neb=[(40, 56, 110)], bloom=(220, 190, 170), skyline=True,
                  worlds=[('moon-large', 338, 104)]),
    'lunar': dict(sky=['#050c20', '#0a1a3c', '#123058', '#1a4470'], neb=[(20, 90, 130)], bloom=(160, 220, 255),
                  worlds=[('ocean-world', 128, 98), ('ice-moon', 356, 172), ('moon-tiny', 430, 52)]),
    'rift': dict(sky=['#030208', '#080414', '#100a22'], neb=[(70, 24, 90)], bloom=None,
                 worlds=[('sgr-a', 318, 132)]),
}
_worlds = {}
def worlds_sheet():
    if not _worlds:
        _worlds['img'] = Image.open(ROOT / 'web' / 'assets' / 'worlds.png').convert('RGBA')
        _worlds['meta'] = json.loads((ROOT / 'web' / 'assets' / 'worlds.json').read_text())
    return _worlds['img'], _worlds['meta']

def world(name, frame=0):
    img, meta = worlds_sheet(); w = meta[name]
    return img.crop((w['x'] + frame * w['w'], w['y'], w['x'] + (frame + 1) * w['w'], w['y'] + w['h']))

_bg_cache = {}
def backdrop(region, scenery=True):
    key = (region, scenery)
    if key in _bg_cache: return _bg_cache[key].copy()
    cfg = REGIONS[region]; seed = abs(hash(region)) % 97
    ys, xs = np.mgrid[0:H, 0:W].astype(float)
    stops = [(i / (len(cfg['sky']) - 1), c) for i, c in enumerate(cfg['sky'])]
    sky = ramp(ys / (H - 1), stops)
    from space_lib import fbm3 as f3
    n1 = f3(xs / 90, ys / 90, np.full_like(xs, seed * .3), seed, 4); n2 = f3(xs / 40, ys / 40, np.full_like(xs, seed * .7), seed + 3, 4)
    for i, col in enumerate(cfg['neb']):
        n = n1 if i == 0 else n2
        wgt = np.clip((n - (.42 if i == 0 else .5)) * (2.4 if i == 0 else 2.8), 0, 1) * (.8 if i == 0 else .55)
        sky = sky + wgt[..., None] * np.array(col)
    if cfg['bloom']:
        d = np.hypot(xs - 40, ys - 14); sky = sky + (np.clip(1 - d / 210, 0, 1) ** 2)[..., None] * np.array(cfg['bloom']) * .3
    img = Image.fromarray(quant(sky, 20, bayer(H, W) * .9).astype(np.uint8)).convert('RGBA')
    rng = random.Random(seed); d = ImageDraw.Draw(img)
    for n, b in ((170, .35), (80, .6), (24, 1.0)):
        for _ in range(n):
            c = rng.choice([(255, 255, 255), (190, 210, 255), (255, 220, 190), (230, 190, 255)]); a = b * rng.uniform(.5, 1)
            d.point((rng.randrange(W), rng.randrange(H - 30)), fill=tuple(int(v * a) for v in c) + (255,))
    if scenery:
        for name, x, y in cfg['worlds']:
            wsp = world(name); img.alpha_composite(wsp, (int(x - wsp.width / 2), int(y - wsp.height / 2)))
        arr = np.asarray(img).copy(); hx = np.arange(W)
        if cfg.get('ridge'):
            r = 252 + 8 * (np.sin(hx / 21.0) + .6 * np.sin(hx / 8.3 + 1))
            for x in range(W):
                t = int(r[x]); arr[t:, x, :3] = (4, 3, 15); arr[t, x, :3] = (138, 58, 88)
        if cfg.get('hills'):
            for base, col, edge in ((236, (74, 28, 52), (122, 48, 80)), (256, (46, 18, 40), (90, 36, 66))):
                r = base - 9 * (np.sin(hx / 38.0 + base) + .5 * np.sin(hx / 14.0 + 1.4 * base))
                for x in range(W):
                    t = int(r[x]); arr[t:, x, :3] = col; arr[t, x, :3] = edge
        if cfg.get('skyline'):
            rr = random.Random(41); x = 0
            while x < W:
                w = 8 + int(rr.random() * 14); edge = min(x, W - x) / 150
                h = int(8 + (1 - min(1, edge)) * (30 + rr.random() * 28) + rr.random() * 6)
                arr[H - h:, x:x + w - 1, :3] = (7, 10, 22)
                for wy in range(H - h + 4, H - 4, 6):
                    for wx in range(x + 2, x + w - 3, 4):
                        if rr.random() > .93: arr[wy:wy + 2, wx:wx + 2, :3] = (122, 106, 74)
                x += w
        img = Image.fromarray(arr)
    _bg_cache[key] = img
    return img.copy()


# ------------------------------------------------------------------ player and HUD
_atlas = {}
def player_ship(direction=0):
    if not _atlas:
        _atlas['img'] = Image.open(ROOT / 'web' / 'assets' / 'sprites.png').convert('RGBA')
        _atlas['meta'] = json.loads((ROOT / 'web' / 'assets' / 'sprites.json').read_text())
    m = _atlas['meta'][f'ship-aim-{direction}']
    s = _atlas['img'].crop((m['x'], m['y'], m['x'] + m['w'], m['y'] + m['h']))
    a = np.asarray(s).astype(float); a[..., :3] = np.clip(a[..., :3] * 1.2 + 14, 0, 255)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')

def draw_player(img, x, y, shots=()):
    img2 = add_glow(img, [(x - 14, y, 14, (255, 130, 60), .55), (x - 11, y, 7, (120, 220, 255), .4)])
    d = ImageDraw.Draw(img2)
    for i, (c, ln) in enumerate([((255, 245, 210), 6), ((255, 170, 70), 11), ((255, 110, 50), 16)]):
        d.rectangle((x - 11 - ln, y - (1 if i < 2 else 0), x - 11, y + (1 if i < 2 else 0)), fill=c + (255,))
    s = player_ship(0); img2.alpha_composite(s, (x - 16, y - 16))
    for bx, by, col in shots:
        img2 = add_glow(img2, [(bx, by, 6, col, .6)])
        d = ImageDraw.Draw(img2); d.rectangle((bx - 6, by, bx, by), fill=tuple(int(v * .5) for v in col) + (255,)); d.rectangle((bx, by - 1, bx + 3, by), fill=(255, 255, 255, 255))
    return img2

def hud_bar(img, name, health, phases=(.66, .33), tag=None):
    """Boss name and a slim health bar with phase notches, top centre."""
    d = ImageDraw.Draw(img, 'RGBA')
    f = font(20); tw = d.textlength(name, font=f)
    x0, x1, y = W // 2 - 80, W // 2 + 80, 28
    d.text((W // 2 - tw / 2 + 1, 5 + 1), name, font=f, fill=(52, 14, 74, 255)); d.text((W // 2 - tw / 2, 5), name, font=f, fill=(255, 233, 196, 255))
    d.rectangle((x0, y, x1, y + 4), fill=(20, 8, 44, 230), outline=(90, 60, 152, 255))
    d.rectangle((x0 + 1, y + 1, x0 + 1 + int((x1 - x0 - 2) * health), y + 3), fill=(255, 190, 110, 255))
    for p in phases: d.line((x0 + int((x1 - x0) * p), y - 1, x0 + int((x1 - x0) * p), y + 5), fill=(255, 244, 214, 255))
    if tag:
        f2 = font(16); d.text((6, 4), tag, font=f2, fill=(190, 150, 230, 255))
    return img

def label(img, text, sub=None):
    d = ImageDraw.Draw(img, 'RGBA')
    f = font(22); d.rectangle((0, H - 22, 230, H), fill=(10, 5, 24, 200)); d.text((6, H - 21), text, font=f, fill=(255, 220, 160, 255))
    if sub: d.text((6 + d.textlength(text, font=f) + 8, H - 19), sub, font=font(17), fill=(190, 150, 230, 255))
    return img


# ------------------------------------------------------------------ spawn / death helpers
def reveal(sprite, t, seed=1):
    """Warp-in: reveal rows from the top by ordered dither with a bright scan edge. t 0..1."""
    t = min(1.0, t * 1.28)
    a = np.asarray(sprite).astype(float)
    h, w = a.shape[:2]; bay = bayer(h, w)
    rows = np.arange(h)[:, None] / max(h - 1, 1)
    thresh = (t * 1.25 - rows) * 1.6
    keep = thresh > bay * .9
    out = a.copy(); out[..., 3] = np.where(keep, a[..., 3], 0)
    edge = np.abs(thresh - .03) < .03
    glow = (edge & (a[..., 3] > 0))
    out[glow, :3] = (255, 214, 150)
    out[glow, 3] = 255
    return Image.fromarray(out.astype(np.uint8), 'RGBA')

def shatter(sprite, t, cx, cy, n=9, spread=70, seed=3, inward=False):
    """Voronoi-split the sprite and fly the pieces outward (or inward). Returns a full-size RGBA overlay layer list."""
    a = np.asarray(sprite); h, w = a.shape[:2]
    rs = np.random.default_rng(seed)
    pts = np.stack([rs.uniform(w * .15, w * .85, n), rs.uniform(h * .15, h * .85, n)], 1)
    gy, gx = np.mgrid[0:h, 0:w]
    owner = np.argmin(np.stack([np.hypot(gx - px, gy - py) for px, py in pts]), 0)
    pieces = []
    ease = 1 - (1 - min(1, t * 1.3)) ** 2
    for i, (px, py) in enumerate(pts):
        m = (owner == i) & (a[..., 3] > 0)
        if not m.any(): continue
        piece = a.copy(); piece[~m, 3] = 0
        dx, dy = px - w / 2, py - h / 2; L = math.hypot(dx, dy) or 1
        sign = -1 if inward else 1
        off = (spread * ease * (.6 + .8 * rs.random()))
        ox, oy = sign * dx / L * off, sign * dy / L * off + t * t * 14 * (0 if inward else 1)
        pieces.append((Image.fromarray(piece, 'RGBA'), ox, oy, 1 - max(0, t - .55) / .45))
    return pieces

def blast_fx(img, cx, cy, t, size=60, loud=True):
    """Fireball, shock ring, rays and sparks around (cx, cy). t 0..1."""
    rng = random.Random(7)
    ease = lambda v: 1 - (1 - min(1, max(0, v))) ** 2
    fade = max(0, 1 - max(0, t - .35) / .5)
    spots = [(cx, cy, size * 1.05, (255, 140, 60) if loud else (170, 105, 95), .85 * fade),
             (cx, cy, size * .55, (255, 232, 176) if loud else (210, 180, 150), 1.0 * fade)]
    if t < .3: spots.append((cx, cy, size * .6, (255, 252, 236), 1 - t / .3))
    img = add_glow(img, spots)
    d = ImageDraw.Draw(img, 'RGBA')
    if loud and t < .6:
        r = ease(t / .6) * size * 2.0
        for a in range(240): ang = a / 240 * math.tau; d.point((cx + math.cos(ang) * r, cy + math.sin(ang) * r * .86), fill=(255, 232, 190, int(255 * (1 - t / .6))))
    if loud and t < .45:
        for i in range(36):
            ang = i / 36 * math.tau + rng.random() * .08; s0 = size * .45 + ease(t / .45) * size * .8; ln = (8 + rng.random() * size * .6) * (1 - t / .45)
            col = rng.choice([(255, 230, 160), (255, 150, 72), (255, 255, 255)])
            for k in range(int(ln)): d.point((cx + math.cos(ang) * (s0 + k), cy + math.sin(ang) * (s0 + k)), fill=col + (255,))
    for i in range(80 if loud else 24):
        ang = rng.random() * math.tau; run = ease(t * 1.5) * (size * .5 + rng.random() * size * 1.7); life = .4 + rng.random() * .6
        if t < life: d.point((cx + math.cos(ang) * run, cy + math.sin(ang) * run * .85 + t * 16), fill=rng.choice([(255, 220, 140), (255, 150, 72), (255, 255, 255), (255, 120, 120)]) + (255,))
    return img


# ------------------------------------------------------------------ scene
def place(img, sprite, cx, cy):
    img.alpha_composite(sprite, (int(round(cx - sprite.width / 2)), int(round(cy - sprite.height / 2))))

def finish(img, vignette=.5):
    a = np.asarray(img.convert('RGB')).astype(float)
    ys, xs = np.mgrid[0:H, 0:W].astype(float)
    v = np.clip(1 - (((xs - W / 2) / (W * .62)) ** 2 + ((ys - H / 2) / (H * .72)) ** 2) * vignette, .45, 1)
    a *= v[..., None]; a[1::3] *= .95
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def sheet(panels, cols=3, scale=2, gap=6, title=None):
    rows = (len(panels) + cols - 1) // cols
    top = 36 * scale // 2 if title else 0
    out = Image.new('RGB', (cols * W * scale + (cols + 1) * gap, rows * H * scale + (rows + 1) * gap + top), (10, 5, 24))
    d = ImageDraw.Draw(out)
    if title: d.text((gap + 4, 4), title, font=font(30), fill=(255, 220, 160))
    for i, p in enumerate(panels):
        x = gap + (i % cols) * (W * scale + gap); y = top + gap + (i // cols) * (H * scale + gap)
        out.paste(p.resize((W * scale, H * scale), Image.NEAREST), (x, y))
    return out


# ====================================================================== 8-bit pixel toolkit
# Strict pixel style: fixed palettes, ordered-dither shading, hard alpha, 2px outlines.
B2 = np.array([[0, 2], [3, 1]]) / 4.0
INK = (10, 5, 16)


def pal(*hexes):
    return np.array([hexrgb(h) for h in hexes])

def bay2(h, w):
    return np.tile(B2, (h // 2 + 1, w // 2 + 1))[:h, :w]

def shift(m, dx, dy):
    out = np.zeros_like(m)
    h, w = m.shape
    xs0, xs1 = max(0, dx), min(w, w + dx); ys0, ys1 = max(0, dy), min(h, h + dy)
    out[ys0:ys1, xs0:xs1] = m[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx]
    return out

def dilate(m, n=1):
    out = m.copy()
    for _ in range(n):
        o = out.copy(); o |= shift(out, 1, 0); o |= shift(out, -1, 0); o |= shift(out, 0, 1); o |= shift(out, 0, -1); out = o
    return out

def erode(m, n=1):
    return ~dilate(~m, n)

def bm(mask):
    return np.asarray(mask) > 127


class Px:
    """A pixel-art canvas: parts are shaded from a palette and outlined, back to front."""
    def __init__(self, size):
        self.w, self.h = size
        self.a = np.zeros((self.h, self.w, 4), np.uint8)

    def fill(self, mask, palette, outline=INK, ow=2, light=1.0, tex=None, radial=None, bias=0.0, dither=True):
        m = bm(mask)
        if not m.any(): return self
        h, w = m.shape; ys, xs = np.mgrid[0:h, 0:w]
        yy, xx = np.where(m); x0, x1, y0, y1 = xx.min(), xx.max(), yy.min(), yy.max()
        if radial:
            cx, cy, r = radial
            d = np.hypot(xs - (cx - r * .25), ys - (cy - r * .3)) / (r * 1.25)
            t = .86 - .8 * d
        else:
            u = (xs - x0) / max(1, x1 - x0); v = (ys - y0) / max(1, y1 - y0)
            t = .74 - .5 * (.5 * u + .5 * v)
        t = t + bias + .2 * light * (m & ~shift(m, 1, 1)) + .12 * light * (m & ~shift(m, 2, 2)) \
            - .22 * (m & ~shift(m, -1, -1)) - .12 * (m & ~shift(m, -2, -2))
        if tex is not None: t = t + tex
        n = len(palette)
        q = np.clip(t, 0, .999) * (n - 1)
        idx = np.floor(q + (bay2(h, w) - .25 if dither else 0)).astype(int)
        idx = np.clip(idx, 0, n - 1)
        col = palette[idx]
        if outline is not None and ow:
            ring = dilate(m, ow) & ~m
            self.a[ring, :3] = outline; self.a[ring, 3] = 255
        self.a[m, :3] = col[m].astype(np.uint8); self.a[m, 3] = 255
        return self

    def flat(self, mask, rgb):
        m = bm(mask); self.a[m, :3] = rgb; self.a[m, 3] = 255; return self

    def dots(self, mask, rgb, every=2):
        m = bm(mask); h, w = m.shape; ys, xs = np.mgrid[0:h, 0:w]
        k = m & ((xs + ys) % every == 0); self.a[k, :3] = rgb; self.a[k, 3] = 255; return self

    def halo(self, cx, cy, r, rgb, power=1.6, below=True):
        """Dithered glow: whole pixels of one colour, never blended."""
        ys, xs = np.mgrid[0:self.h, 0:self.w]
        d = np.hypot(xs - cx, ys - cy) / r
        lvl = np.clip(1 - d, 0, 1) ** power
        hit = (lvl > bay2(self.h, self.w) * .9) & (lvl > 0)
        if below: hit &= (self.a[..., 3] == 0)
        self.a[hit, :3] = rgb; self.a[hit, 3] = 255
        return self

    def img(self):
        return Image.fromarray(self.a, 'RGBA')


def pxline(S, pts, width=1):
    return line(S, pts, width)


# palettes: dark to light
P_STEEL = pal('#0c0c1c', '#1c2240', '#34447a', '#5a76b0', '#90b0e0', '#dcecff')
P_DARK = pal('#08060e', '#14121e', '#262236', '#3e3a56', '#605c82', '#9c98c0')
P_EYE = pal('#3a0408', '#8a0c14', '#e42a1a', '#ff7a22', '#ffcc50', '#fff8d0')
P_ICE = pal('#0c1040', '#1c2c78', '#3a62c0', '#78b8f4', '#c4ecff', '#ffffff')
P_VIOLET = pal('#10062a', '#2a1060', '#5a2ca8', '#9a64e0', '#d0a8ff', '#ffffff')
P_FIRE = pal('#2a0402', '#8a1004', '#e03a0c', '#ff8a1c', '#ffd048', '#fff6c8')
P_BRASS = pal('#1c0c08', '#4a2812', '#8a5424', '#c8883c', '#f0c070', '#fff0b8')
P_CHAR = pal('#08040a', '#1c1014', '#3a2024', '#5c3a38', '#8a5e54', '#c08c78')
P_HULL = pal('#06080e', '#12182a', '#222c48', '#38476e', '#5e72a0', '#9ab0d8')
P_TEAL = pal('#03161e', '#0a3446', '#126a86', '#22a8c0', '#6ae0e4', '#e0ffff')
P_MAG = pal('#2a0828', '#6a1060', '#b4249c', '#f060cc', '#ffa0e8', '#ffffff')
P_VOID = pal('#030208', '#0c0618', '#1c1038', '#34226a', '#5a3ca8', '#a088f0')
P_WARD = pal('#0c0620', '#221446', '#3c2874', '#6a4cb0', '#a68ae8', '#e4d4ff')
P_HALO = pal('#2a0800', '#8a1c04', '#e0480c', '#ff9a24', '#ffe070', '#fffbe0')
