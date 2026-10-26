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


STAR_KINDS = {
    'sun-yellow':  dict(R=16, stops=[(0, '#c8500c'), (.45, '#f5a31e'), (.8, '#ffd860'), (1, '#fff4b0')], glow=(255, 190, 90), glow_r=2.3, gran=7),
    'red-giant':   dict(R=30, stops=[(0, '#4a0c06'), (.4, '#a82a10'), (.75, '#e8602a'), (1, '#ffa860')], glow=(220, 70, 40), glow_r=1.7, gran=3.4, limb=.35),
    'blue-white':  dict(R=13, stops=[(0, '#4a70c8'), (.5, '#a8c8ff'), (1, '#ffffff')], glow=(150, 190, 255), glow_r=2.6, gran=8, spikes=4, spike_len=2.2, limb=.7),
    'blue-soft':   dict(R=13, stops=[(0, '#4a70c8'), (.5, '#a8c8ff'), (1, '#ffffff')], glow=(150, 190, 255), glow_r=2.4, gran=8, limb=.7),
    'red-dwarf':   dict(R=9, stops=[(0, '#2a0604'), (.5, '#7a1a10'), (1, '#c8442a')], glow=(160, 40, 30), glow_r=1.9, gran=6),
    'white-dwarf': dict(R=4, stops=[(0, '#c8dcff'), (1, '#ffffff')], glow=(200, 220, 255), glow_r=3.4, gran=2, spikes=2, limb=.9),
    'orange-dwarf': dict(R=12, stops=[(0, '#7a2a08'), (.5, '#d8721e'), (1, '#ffc060')], glow=(255, 140, 60), glow_r=2.1, gran=7),
}


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


_STAR_CACHE = {}


# ================================================================== nebulae


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


