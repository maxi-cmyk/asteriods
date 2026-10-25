"""Stars, compact objects, binaries and nebulae for the space asset set."""
import math
import numpy as np
from PIL import Image, ImageDraw
from space_lib import *  # noqa: F401,F403


def blur(a, sigma):
    """Separable gaussian blur on a 2D float array."""
    r = max(1, int(sigma * 3)); k = np.exp(-np.arange(-r, r + 1) ** 2 / (2 * sigma ** 2)); k /= k.sum()
    a = np.apply_along_axis(lambda m: np.convolve(m, k, 'same'), 0, a)
    return np.apply_along_axis(lambda m: np.convolve(m, k, 'same'), 1, a)


def grid(h, w=None):
    w = w or h
    ys, xs = np.mgrid[0:h, 0:w].astype(float)
    return xs, ys


def starfield(h, w, count, seed=1, bright=1.0, warm=.4):
    rng = np.random.default_rng(seed)
    rgb = np.zeros((h, w, 3)); a = np.zeros((h, w))
    for _ in range(count):
        x, y = int(rng.integers(0, w)), int(rng.integers(0, h)); b = rng.random() ** 2.2 * bright
        c = np.array([255, 235, 205]) if rng.random() < warm else np.array([200, 220, 255])
        rgb[y, x] = c; a[y, x] = .25 + .75 * b
        if b > .75 and 1 < x < w - 2 and 1 < y < h - 2:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)): rgb[y + dy, x + dx] = c; a[y + dy, x + dx] = .55
    return rgb, a


def over_rgb(base, layer_rgb, layer_a):
    return base * (1 - layer_a[..., None]) + layer_rgb * layer_a[..., None]


# ============================================================================ stars
def star_sprite(R, stops, glow=(255, 200, 120), glow_r=2.0, spikes=0, gran=6, seed=1, limb=.5, spike_len=4.0, size=None):
    S = size or int(2 * R * max(glow_r, 1.2)) + 8
    xs, ys = grid(S)
    x = (xs - S / 2 + .5) / R; y = (ys - S / 2 + .5) / R
    rr = np.hypot(x, y); inside = rr <= 1
    z = np.sqrt(np.clip(1 - rr * rr, 0, 1))
    n = fbm3(x * gran + 4, y * gran + 4, z * gran, seed, 4)
    cells = ridged(fbm3(x * gran * .6, y * gran * .6, z * gran * .6, seed + 5, 3))
    t = .25 + .5 * n + .25 * z ** .6 - .22 * smoothstep(.8, .96, cells)
    col = ramp(t, stops) * (limb + (1 - limb) * z ** .7)[..., None]
    gl = np.array(glow, float)
    halo = np.exp(-np.clip(rr - 1, 0, None) * (3.2 / max(glow_r - 1, .2))) * (rr > 1)
    alpha = np.where(inside, 1.0, halo * .8)
    rgb = np.where(inside[..., None], col, gl)
    if spikes:
        for k in range(spikes):
            a = math.pi * k / spikes + .0
            ca, sa = math.cos(a), math.sin(a)
            along = np.abs(x * ca + y * sa); perp = np.abs(-x * sa + y * ca)
            s = np.exp(-perp * R / 0.7) * np.exp(-np.clip(along - 1, 0, None) / spike_len) * (along > 0.9)
            alpha = np.maximum(alpha, s * .75); rgb = np.where((s > .05)[..., None] & ~inside[..., None], np.array([255, 250, 240]), rgb)
    return to_image(rgb, alpha, levels=16)


STAR_KINDS = {
    'sun-yellow':  dict(R=16, stops=[(0, '#c8500c'), (.45, '#f5a31e'), (.8, '#ffd860'), (1, '#fff4b0')], glow=(255, 190, 90), glow_r=2.3, gran=7),
    'red-giant':   dict(R=30, stops=[(0, '#4a0c06'), (.4, '#a82a10'), (.75, '#e8602a'), (1, '#ffa860')], glow=(220, 70, 40), glow_r=1.7, gran=3.4, limb=.35),
    'blue-white':  dict(R=13, stops=[(0, '#4a70c8'), (.5, '#a8c8ff'), (1, '#ffffff')], glow=(150, 190, 255), glow_r=2.6, gran=8, spikes=4, spike_len=2.2, limb=.7),
    'blue-soft':   dict(R=13, stops=[(0, '#4a70c8'), (.5, '#a8c8ff'), (1, '#ffffff')], glow=(150, 190, 255), glow_r=2.4, gran=8, limb=.7),
    'red-dwarf':   dict(R=9, stops=[(0, '#2a0604'), (.5, '#7a1a10'), (1, '#c8442a')], glow=(160, 40, 30), glow_r=1.9, gran=6),
    'white-dwarf': dict(R=4, stops=[(0, '#c8dcff'), (1, '#ffffff')], glow=(200, 220, 255), glow_r=3.4, gran=2, spikes=2, limb=.9),
    'orange-dwarf': dict(R=12, stops=[(0, '#7a2a08'), (.5, '#d8721e'), (1, '#ffc060')], glow=(255, 140, 60), glow_r=2.1, gran=7),
}


def stars():
    out = {}
    for k, v in STAR_KINDS.items(): out[k] = star_sprite(seed=hash(k) % 97, **v)
    out['pulsar'] = pulsar(0.6)
    out['magnetar'] = pulsar(1.9, magnetar=True)
    out['quasi-star'] = quasi_star()
    out['binary-mass-transfer'] = binary(.3)
    out['brown-dwarf'] = brown_dwarf()
    out['circumbinary-kepler16'] = circumbinary(.15)
    return out


# ============================================================= compact objects
def _stack(layers, S):
    pm = np.zeros((S, S, 3)); al = np.zeros((S, S))
    for rgb, a in layers:
        pm = rgb * a[..., None] + pm * (1 - a[..., None]); al = a + al * (1 - a)
    return np.where(al[..., None] > 0, pm / np.maximum(al, 1e-6)[..., None], 0), al


def pulsar(phase, S=112, tilt=26, magnetar=False):
    """Neutron star with twin lighthouse beams and dipole field lines."""
    xs, ys = grid(S); x = xs - S / 2 + .5; y = ys - S / 2 + .5
    r = np.hypot(x, y) + 1e-6; ang = np.arctan2(y, x)
    beam_col = np.array([255, 140, 235]) if magnetar else np.array([140, 225, 255])
    layers = []
    for k in range(2):
        th = phase + k * math.pi
        d = np.arctan2(np.sin(ang - th), np.cos(ang - th))
        wide = np.exp(-(d / .38) ** 2) * np.exp(-r / (S * .3)) * .3 * (r > 4)
        core_b = np.exp(-(d / .12) ** 2) * np.exp(-r / (S * .4)) * (r > 4)
        layers.append((np.broadcast_to(beam_col, (S, S, 3)), np.clip(wide + core_b, 0, 1) * .95))
    mag_axis = phase + math.pi / 2 - math.radians(tilt)
    ca, sa = math.cos(mag_axis), math.sin(mag_axis)
    fl = np.zeros((S, S))
    for Lr in (9, 15, 23, 34):
        for lam in np.linspace(-1.4, 1.4, 220):
            rad = Lr * math.cos(lam) ** 2
            px, py = rad * math.cos(lam), rad * math.sin(lam)
            for side in (1, -1):
                ix = int(round(S / 2 + side * (px * ca - py * sa))); iy = int(round(S / 2 + side * (px * sa + py * ca)))
                if 0 <= ix < S and 0 <= iy < S: fl[iy, ix] = .75
    layers.append((np.broadcast_to(np.array([255, 120, 200]) if magnetar else np.array([150, 125, 255]), (S, S, 3)), fl))
    layers.append((np.broadcast_to(beam_col, (S, S, 3)), np.exp(-r / 9) * .55))
    layers.append((np.broadcast_to(np.array([240, 250, 255]), (S, S, 3)), np.clip(np.exp(-(r / 3.4) ** 2) * 1.4, 0, 1)))
    rgb, a = _stack(layers, S)
    return to_image(np.clip(rgb, 0, 255), a, levels=16)


def brown_dwarf():
    from space_lib import tex_bands
    return render_sphere(24, tex_bands([(0, '#2a0a24'), (.4, '#7a2a5a'), (.7, '#c0684a'), (1, '#e8a070')], k=12, turb=.7, seed=77),
                         tilt=16, roll=-10, atmosphere=(255, 110, 150), emissive=lambda c: np.clip(1 - c.lam, 0, 1)[..., None] * np.array([40, 8, 18]))


def quasi_star(R=40):
    """A giant red envelope with a black hole feeding on it at the centre."""
    S = R * 3 + 8
    xs, ys = grid(S); x = (xs - S / 2 + .5) / R; y = (ys - S / 2 + .5) / R
    rr = np.hypot(x, y); inside = rr <= 1; z = np.sqrt(np.clip(1 - rr * rr, 0, 1))
    cells = fbm3(x * 3.2 + 7, y * 3.2 + 7, z * 3.2, 61, 4)
    ridge = smoothstep(.82, .97, ridged(fbm3(x * 2.4, y * 2.4, z * 2.4, 63, 3)))
    t = .22 + .55 * cells * (.5 + .5 * z) - .3 * ridge
    col = ramp(t, [(0, '#3a0a06'), (.35, '#a02a12'), (.7, '#e0662a'), (1, '#ffc078')]) * (.4 + .6 * z ** .6)[..., None]
    hot = np.exp(-(rr / .22) ** 2)
    col = col + hot[..., None] * np.array([255, 235, 190]) * .9
    pin = (rr < .035)
    col = np.where(pin[..., None], 0, col)
    ring = np.exp(-((rr - .075) / .02) ** 2)
    col = col + ring[..., None] * np.array([255, 230, 170]) * .8
    halo = np.exp(-np.clip(rr - 1, 0, None) * 2.6) * (rr > 1)
    rgb = np.where(inside[..., None], col, np.array([210, 60, 40]))
    a = np.where(inside, 1.0, halo * .85)
    return to_image(np.clip(rgb, 0, 255), a, levels=16)


def _paste(canvas, im, cx, cy):
    canvas.alpha_composite(im, (int(round(cx - im.width / 2)), int(round(cy - im.height / 2))))


_STAR_CACHE = {}
def _star(kind, scale=1.0):
    key = (kind, scale)
    if key not in _STAR_CACHE:
        v = dict(STAR_KINDS[kind]); v['R'] = max(2, int(round(v['R'] * scale)))
        _STAR_CACHE[key] = star_sprite(seed=hash(kind) % 97, **v)
    return _STAR_CACHE[key]


def binary(phase, W=200, H=130, sep=52):
    """A blue-white star and an orange donor in a close orbit, trading gas."""
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); cx, cy = W / 2, H / 2
    ca, sa = math.cos(phase), math.sin(phase)
    ax, ay = cx - sep * .32 * ca, cy - sep * .32 * .5 * sa      # heavy blue star (small orbit)
    bx, by = cx + sep * .68 * ca, cy + sep * .68 * .5 * sa      # lighter donor
    d = ImageDraw.Draw(im)
    for i in range(160):                                         # orbit track
        t = i / 160 * 2 * math.pi
        d.point((cx + sep * math.cos(t), cy + sep * .5 * math.sin(t)), fill=(150, 120, 230, 70))
    # stream from the donor's inner point curling onto a disc around the blue star
    dx, dy = ax - bx, ay - by; ln = math.hypot(dx, dy) or 1
    for i in range(70):
        u = i / 70; curl = math.sin(u * math.pi) * 8 * (1 if ca > 0 else -1)
        px = bx + dx * u * .86 + (-dy / ln) * curl; py = by + dy * u * .86 + (dx / ln) * curl
        fade = .35 + .65 * u
        d.point((px, py), fill=(255, int(190 - 80 * u), int(110 - 50 * u), int(255 * fade)))
        if i % 3 == 0: d.point((px + 1, py), fill=(255, 160, 90, int(200 * fade)))
    # accretion disc: a tilted ellipse of embers around the heavy star
    for i in range(110):
        t = i / 110 * 2 * math.pi; rad = 9 + (i % 5)
        d.point((ax + rad * math.cos(t), ay + rad * .35 * math.sin(t)), fill=(255, int(150 + 80 * (i % 5) / 5), 90, 210))
    # draw the farther star first
    order = sorted([('blue-soft', ax, ay, 1.15), ('orange-dwarf', bx, by, 1.0)], key=lambda s: s[2])
    for kind, x, y, sc in order: _paste(im, _star(kind, sc), x, y)
    # donor is stretched toward its companion: a teardrop highlight
    d = ImageDraw.Draw(im)
    tx, ty = bx + dx / ln * 9, by + dy / ln * 9
    d.ellipse((tx - 3, ty - 2, tx + 3, ty + 2), fill=(255, 200, 130, 220))
    return im


def circumbinary(phase, W=200, H=120):
    """Kepler-16 style: two small suns circling each other, one planet circling both."""
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); cx, cy = W / 2, H / 2
    d = ImageDraw.Draw(im)
    a, b = 82, 30
    for i in range(240):
        t = i / 240 * 2 * math.pi
        d.point((cx + a * math.cos(t), cy + b * math.sin(t)), fill=(160, 170, 255, 90))
    sp = phase * 7.0
    ox, oy = 10 * math.cos(sp), 5 * math.sin(sp)
    s1 = (cx + ox, cy + oy, 'orange-dwarf', .75); s2 = (cx - ox * 1.9, cy - oy * 1.9, 'red-dwarf', .75)
    px, py = cx + a * math.cos(phase), cy + b * math.sin(phase)
    order = sorted([s1, s2, (px, py, 'planet', 1)], key=lambda s: s[1])
    planet = None
    for x, y, kind, sc in order:
        if kind == 'planet':
            if planet is None:
                from space_lib import tex_bands
                planet = render_sphere(8, tex_bands([(0, '#6e5a40'), (.5, '#e6c88e'), (1, '#8a6c46')], k=7, turb=.2, seed=2), tilt=14, atmosphere=(255, 214, 160))
            _paste(im, planet, x, y)
        else: _paste(im, _star(kind, sc), x, y)
    return im


# ================================================================== nebulae
def pillars(W=144, H=176, seed=4):
    xs, ys = grid(H, W)
    bgn = fbm2(H, W, 38, seed, 4)
    base = ramp(.1 + .35 * (1 - ys / H) + .55 * bgn * (1 - .4 * ys / H), [(0, '#050c2a'), (.35, '#0f2c78'), (.65, '#2f64c4'), (1, '#8cc0f6')])
    srgb, sa = starfield(H, W, 260, seed + 3, bright=1.0, warm=.35)
    rgb = over_rgb(base, srgb, sa)
    warpx = (fbm2(H, W, 22, seed + 1, 3) - .5) * 18; warpy = (fbm2(H, W, 22, seed + 2, 3) - .5) * 14
    X, Y = xs + warpx, ys + warpy
    caps = [(18, 190, 58, 72, 24, 9), (54, 196, 96, 36, 27, 11), (92, 190, 124, 96, 17, 7), (-6, 190, 16, 128, 30, 12)]
    D = np.full((H, W), -9.0)
    for x0, y0, x1, y1, r0, r1 in caps:
        vx, vy = x1 - x0, y1 - y0; L2 = vx * vx + vy * vy
        t = np.clip(((X - x0) * vx + (Y - y0) * vy) / L2, 0, 1)
        dist = np.hypot(X - (x0 + vx * t), Y - (y0 + vy * t)); rad = r0 + (r1 - r0) * t ** .8
        D = np.maximum(D, 1 - dist / rad)
    D = np.maximum(D, 1.2 - (H - ys) / 22 + (fbm2(H, W, 14, seed + 6, 3) - .5) * .8)   # bank of dust at the base
    Db = blur(np.clip(D, -1, 1), 2.4)
    gy, gx = np.gradient(Db)
    lit = np.clip(-(gx * .6 + gy * .85) * 5, 0, 1)
    tex = fbm2(H, W, 7, seed + 8, 4)
    col = ramp(.1 + .28 * tex + .62 * lit + .1 * np.clip(D, 0, 1), [(0, '#160806'), (.25, '#5a2410'), (.5, '#b2521e'), (.75, '#e8923a'), (1, '#ffe08a')])
    alpha = smoothstep(.0, .1, D)
    halo = smoothstep(-.45, 0, D) * .5
    halo_rgb = ramp(.35 + .3 * fbm2(H, W, 10, seed + 9, 3), [(0, '#3a1a10'), (1, '#c2662a')])
    rgb = over_rgb(rgb, halo_rgb, halo * (1 - alpha))
    rgb = over_rgb(rgb, col, alpha)
    for x0, y0, x1, y1, r0, r1 in caps:                          # bright young-star tips
        ex, ey = int(x1 + (x1 - x0) * .02), int(y1 - r1 * .5)
        if 2 < ex < W - 3 and 2 < ey < H - 3:
            g = np.exp(-(((xs - ex) / 4) ** 2 + ((ys - ey) / 3) ** 2))
            rgb = rgb + g[..., None] * np.array([255, 200, 120]) * .7
    return to_image(np.clip(rgb, 0, 255), None, levels=16)


def crab(W=160, H=150, seed=6):
    xs, ys = grid(H, W)
    rgb = np.dstack([np.zeros((H, W)) + 5, np.zeros((H, W)) + 4, np.zeros((H, W)) + 14])
    srgb, sa = starfield(H, W, 120, seed, .8); rgb = over_rgb(rgb, srgb, sa)
    cx, cy = W * .5, H * .52
    wx = (fbm2(H, W, 30, seed + 1, 3) - .5) * 26; wy = (fbm2(H, W, 30, seed + 2, 3) - .5) * 26
    u = (xs + wx - cx) / (W * .36); v = (ys + wy - cy) / (H * .39)
    rr = np.hypot(u, v); ang = np.arctan2(v, u)
    edge = 1 + .12 * np.sin(ang * 3 + 1) + .07 * np.sin(ang * 7)
    inside = rr < edge
    glow = np.exp(-(rr / (edge * .85)) ** 2.4) * (.55 + .45 * fbm2(H, W, 26, seed + 3, 4))
    rgb = rgb + ramp(glow * .9, [(0, '#050a1c'), (.35, '#164a78'), (.7, '#5aa8d0'), (1, '#c8f0ff')]) * (glow > 0.03)[..., None] * .9
    f = ridged(fbm3((xs + wx) / 14, (ys + wy) / 14, np.full_like(xs, 2.0), seed + 4, 4))
    f2 = ridged(fbm3((xs + wy) / 9, (ys + wx) / 9, np.full_like(xs, 5.0), seed + 5, 3))
    fil = smoothstep(.93, .97, np.maximum(f, f2 * .99)) * (rr < edge + .05) * (rr > .18)
    shade = ramp(.25 + .7 * (rr / edge) ** 1.2 * (.6 + .6 * fbm2(H, W, 8, seed + 6, 3)), [(0, '#5a1208'), (.4, '#c8461c'), (.75, '#ff9a3a'), (1, '#ffe2a0')])
    blue = (fbm2(H, W, 18, seed + 7, 2) > .62)[..., None]
    shade = np.where(blue, np.array([120, 170, 255]), shade)
    bloom = blur(fil, 1.6)
    rgb = rgb + shade * bloom[..., None] * .55
    rgb = rgb * (1 - fil[..., None]) + shade * fil[..., None]
    rim = np.exp(-((rr - edge) / .06) ** 2) * (.4 + .6 * fbm2(H, W, 5, seed + 8, 3))
    rgb = rgb + rim[..., None] * np.array([230, 90, 40]) * .8
    px, py = int(cx), int(cy)
    g = np.exp(-(((xs - px) / 2.4) ** 2 + ((ys - py) / 2.4) ** 2)); rgb = rgb + g[..., None] * 255
    jet = np.exp(-((((xs - px) * .7 + (ys - py) * .7) / 2) ** 2)) * np.exp(-np.hypot(xs - px, ys - py) / 26)
    rgb = rgb + jet[..., None] * np.array([200, 235, 255]) * .6
    return to_image(np.clip(rgb, 0, 255), None, levels=16)


S_ORBITS = [(38, 20, .5, '#9ad0ff'), (56, 30, 2.2, '#ffe9a0'), (74, 24, 4.1, '#ffb070'), (30, 16, 3.2, '#ffffff')]


def sgr_a(W=176, H=176, seed=8, phase=0.0, orbits=True):
    xs, ys = grid(H, W)
    bg = np.dstack([np.zeros((H, W)) + 6, np.zeros((H, W)) + 4, np.zeros((H, W)) + 12])
    cx, cy = W / 2, H / 2
    cloud = fbm2(H, W, 34, seed, 4)
    rgb = bg + ramp(cloud * .8, [(0, '#07030f'), (.5, '#3a1050'), (1, '#9a2a8a')]) * (.45 * smoothstep(.45, .75, cloud))[..., None]
    plume = np.exp(-((((xs - cx - 20) * .8 - (ys - cy + 20) * .6) / 12) ** 2)) * np.exp(-np.hypot(xs - cx, ys - cy) / 50)
    rgb = rgb + plume[..., None] * np.array([70, 120, 255]) * .5
    srgb, sa = starfield(H, W, 520, seed + 2, 1.0, warm=.8); rgb = over_rgb(rgb, srgb, sa)
    r = np.hypot(xs - cx, ys - cy); phi = np.arctan2(ys - cy, xs - cx)
    r0 = 22; doppler = .5 + .5 * np.cos(phi - 2.4)
    ringI = np.exp(-((r - r0) / 3.2) ** 2) * (.25 + .85 * doppler)
    disk = np.exp(-((r - r0 * 1.35) / 7) ** 2) * (.1 + .4 * doppler)
    arc = np.exp(-((r - r0 * 1.62) / 2.0) ** 2) * (.1 + .5 * doppler ** 2)
    I = np.clip(ringI + disk * .5 + arc * .6, 0, 1.4)
    rgb = rgb + ramp(I / 1.4, [(0, '#2a0800'), (.3, '#b8380a'), (.6, '#ff9a28'), (.85, '#ffe9a0'), (1, '#ffffff')]) * (I > .02)[..., None] * 1.0
    rgb = np.where((r < 13.5)[..., None], np.array([0, 0, 0]), rgb)   # shadow
    # S-stars on tight orbits, one of them caught mid-pass
    d = Image.new('RGBA', (W, H), (0, 0, 0, 0)); dd = ImageDraw.Draw(d)
    s_orbits = (S_ORBITS if orbits else [])
    for ia, ib, rot, c in s_orbits:
        co, so = math.cos(rot), math.sin(rot)
        for i in range(120):
            t = i / 120 * 2 * math.pi
            x = cx + ia * math.cos(t) * co - ib * math.sin(t) * so; y = cy + ia * math.cos(t) * so + ib * math.sin(t) * co
            dd.point((x, y), fill=(160, 150, 210, 70))
        t = phase * (60 / ia) + rot
        x = cx + ia * math.cos(t) * co - ib * math.sin(t) * so; y = cy + ia * math.cos(t) * so + ib * math.sin(t) * co
        col = tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))
        dd.rectangle((x - 1, y - 1, x + 1, y + 1), fill=col + (255,))
    base = to_image(np.clip(rgb, 0, 255), None, levels=16)
    base.alpha_composite(d)
    return base


def kepler_snr(W=136, H=136, seed=10):
    xs, ys = grid(H, W)
    rgb = np.dstack([np.zeros((H, W)) + 5, np.zeros((H, W)) + 5, np.zeros((H, W)) + 14])
    srgb, sa = starfield(H, W, 150, seed, .9); rgb = over_rgb(rgb, srgb, sa)
    cx, cy = W / 2 + 4, H / 2 - 2
    r = np.hypot(xs - cx, ys - cy); phi = np.arctan2(ys - cy, xs - cx)
    R = 44 + 4 * np.sin(phi * 2 + .5) + 3 * np.sin(phi * 5) + 6 * (np.sin(phi + 2.2) > .5)   # a bulge on one side
    shell = np.exp(-((r - R) / (1.6 + 2.6 * fbm2(H, W, 9, seed, 3))) ** 2)
    knots = smoothstep(.62, .78, fbm2(H, W, 7, seed + 1, 4))
    fil = smoothstep(.8, .92, ridged(fbm3(xs / 10, ys / 10, np.full_like(xs, 1.0), seed + 2, 4)))
    beam = .45 + .55 * (.5 + .5 * np.cos(phi - 2.6))                                    # brighter lower-left
    I = np.clip(shell * (.5 + .6 * knots + .5 * fil) * beam, 0, 1)
    blue = (fbm2(H, W, 30, seed + 3, 2) > .5)[..., None]
    c = np.where(blue, ramp(I, [(0, '#0a1a4a'), (.5, '#3a78d8'), (1, '#d8f0ff')]), ramp(I, [(0, '#3a0a0a'), (.5, '#e0502a'), (1, '#ffe2a0')]))
    rgb = rgb + c * (I > .03)[..., None] + blur(I, 2.2)[..., None] * c * .5
    inner = np.exp(-(r / (R * .7)) ** 3) * .22
    rgb = rgb + inner[..., None] * np.array([60, 110, 200])
    return to_image(np.clip(rgb, 0, 255), None, levels=16)


def ring_nebula(W=128, H=128, seed=12):
    xs, ys = grid(H, W)
    rgb = np.dstack([np.zeros((H, W)) + 4, np.zeros((H, W)) + 4, np.zeros((H, W)) + 12])
    srgb, sa = starfield(H, W, 110, seed, .9); rgb = over_rgb(rgb, srgb, sa)
    cx, cy = W / 2, H / 2
    u = (xs - cx) / 34; v = ((ys - cy) / 42) * 1.0
    th = math.radians(-24); uu = u * math.cos(th) - v * math.sin(th); vv = u * math.sin(th) + v * math.cos(th)
    rr = np.hypot(uu, vv * 1.35)
    knots = .55 + .45 * fbm2(H, W, 4.5, seed, 4)
    outer = np.exp(-((rr - 1.0) / .17) ** 2) * knots
    mid = np.exp(-((rr - .86) / .15) ** 2) * knots
    inner = np.exp(-(rr / .8) ** 2.2) * .45
    halo = np.exp(-((rr - 1.28) / .2) ** 2) * .28 * fbm2(H, W, 10, seed + 4, 3)
    rgb = rgb + outer[..., None] * np.array([255, 70, 50]) * .95 + mid[..., None] * np.array([90, 230, 140]) * .75 \
        + inner[..., None] * np.array([70, 110, 255]) + halo[..., None] * np.array([200, 60, 120])
    g = np.exp(-(((xs - cx) / 2) ** 2 + ((ys - cy) / 2) ** 2)); rgb = rgb + g[..., None] * 255
    return to_image(np.clip(rgb, 0, 255), None, levels=16)


def spiral_galaxy(W=144, H=104, seed=14):
    xs, ys = grid(H, W)
    rgb = np.dstack([np.zeros((H, W)) + 4, np.zeros((H, W)) + 3, np.zeros((H, W)) + 10])
    cx, cy = W / 2, H / 2
    tilt = .55; rot = math.radians(-22)
    x = xs - cx; y = ys - cy
    u = x * math.cos(rot) + y * math.sin(rot); v = (-x * math.sin(rot) + y * math.cos(rot)) / tilt
    r = np.hypot(u, v) + 1e-6; th = np.arctan2(v, u)
    arms = .5 + .5 * np.cos(2 * (th - 1.9 * np.log(r / 6)))
    disc = np.exp(-r / 34) * (.25 + .9 * arms ** 1.6) * smoothstep(0, 5, r)
    clump = fbm2(H, W, 3.2, seed, 4)
    I = np.clip(disc * (.55 + .9 * clump), 0, 1.2)
    rgb = rgb + ramp(np.clip(I, 0, 1), [(0, '#0a0a30'), (.35, '#3a58c8'), (.7, '#a8c0ff'), (1, '#ffffff')]) * np.clip(I * 6, 0, 1)[..., None]
    bulge = np.exp(-(r / 8) ** 1.4) * 1.0
    rgb = rgb + bulge[..., None] * np.array([255, 214, 150])
    pink = smoothstep(.75, .95, clump) * arms * disc * 2.2
    rgb = rgb + pink[..., None] * np.array([255, 90, 150]) * .6
    srgb, sa = starfield(H, W, 80, seed + 1, .8); rgb = over_rgb(rgb, srgb, sa)
    return to_image(np.clip(rgb, 0, 255), None, levels=16)


def gargantua(W=176, H=120, seed=16):
    """A black hole seen almost edge-on: the disc is lensed into arcs over and under the shadow."""
    xs, ys = grid(H, W)
    rgb = np.dstack([np.zeros((H, W)) + 4, np.zeros((H, W)) + 3, np.zeros((H, W)) + 10])
    srgb, sa = starfield(H, W, 200, seed, .9); rgb = over_rgb(rgb, srgb, sa)
    cx, cy = W / 2, H / 2; x = xs - cx; y = ys - cy; r = np.hypot(x, y)
    disc = np.exp(-(y / 2.4) ** 2) * np.exp(-np.clip(np.abs(x) - 14, 0, None) / 38) * (np.abs(x) > 15) * (.5 + .5 * np.cos(np.arctan2(y, x) * 0 + (x / 60)))
    lens_top = np.exp(-((r - 19) / 2.2) ** 2) * (y < 0) * (.4 + .6 * np.exp(-(x / 26) ** 2))
    lens_bot = np.exp(-((r - 17) / 1.8) ** 2) * (y > 0) * (.25 + .6 * np.exp(-(x / 22) ** 2))
    I = np.clip(disc + lens_top + lens_bot, 0, 1.2)
    rgb = rgb + ramp(I / 1.2, [(0, '#2a0800'), (.3, '#c0400c'), (.65, '#ffa032'), (.9, '#fff0b8'), (1, '#ffffff')]) * (I > .02)[..., None]
    rgb = np.where((r < 13)[..., None], 0, rgb)
    return to_image(np.clip(rgb, 0, 255), None, levels=16)


def nebulae():
    return {'pillars-of-creation': pillars(), 'crab-nebula': crab(), 'sagittarius-a-star': sgr_a(), 'kepler-supernova-remnant': kepler_snr(),
            'ring-nebula': ring_nebula(), 'spiral-galaxy': spiral_galaxy(), 'black-hole-edge-on': gargantua()}
