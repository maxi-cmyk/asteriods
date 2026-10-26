"""Shared helpers for the space-asset generator: noise, colour ramps, dithered
quantising, and a small 3D renderer for lit spheres with tilted rings.

All artwork is original and procedural. NASA / ESA / STScI imagery was only
looked at for shapes and palettes (Pillars of Creation, Crab Nebula, Sagittarius
A*, Kepler systems, ringed and tilted worlds); nothing is traced or copied.
"""
import math
import numpy as np
from PIL import Image

BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
LIGHT = np.array([-.7, -.55, .6]); LIGHT = LIGHT / np.linalg.norm(LIGHT)


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def bayer(h, w):
    return np.tile(BAYER4, (h // 4 + 1, w // 4 + 1))[:h, :w]


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def ramp(t, stops):
    """t array 0..1 -> (...,3) RGB using [(pos, '#hex'), ...]."""
    t = np.clip(np.asarray(t, float), 0, 1)
    pos = [p for p, _ in stops]; cols = np.array([hexrgb(c) for _, c in stops])
    out = np.zeros(t.shape + (3,))
    for ch in range(3): out[..., ch] = np.interp(t, pos, cols[:, ch])
    return out


def quant(rgb, levels, dither=None):
    """Posterise to `levels` per channel; `dither` is a 0..1 array added before flooring."""
    d = 0 if dither is None else dither[..., None]
    return np.clip(np.floor(rgb / 255.0 * (levels - 1) + d) / (levels - 1) * 255, 0, 255)


# ----------------------------------------------------------------------- noise
_LATTICES = {}


def _lattice(seed, n=32):
    key = (seed, n)
    if key not in _LATTICES:
        _LATTICES[key] = np.random.default_rng(seed).random((n, n, n))
    return _LATTICES[key]


def noise3(x, y, z, seed=0, n=32):
    """Value noise, trilinear with smoothstep. Inputs are lattice-space coordinates."""
    g = _lattice(seed, n)
    x0, y0, z0 = np.floor(x).astype(int), np.floor(y).astype(int), np.floor(z).astype(int)
    fx, fy, fz = x - x0, y - y0, z - z0
    sx, sy, sz = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy), fz * fz * (3 - 2 * fz)
    def at(i, j, k): return g[(x0 + i) % n, (y0 + j) % n, (z0 + k) % n]
    c00 = at(0, 0, 0) * (1 - sx) + at(1, 0, 0) * sx
    c10 = at(0, 1, 0) * (1 - sx) + at(1, 1, 0) * sx
    c01 = at(0, 0, 1) * (1 - sx) + at(1, 0, 1) * sx
    c11 = at(0, 1, 1) * (1 - sx) + at(1, 1, 1) * sx
    return (c00 * (1 - sy) + c10 * sy) * (1 - sz) + (c01 * (1 - sy) + c11 * sy) * sz


def fbm3(x, y, z, seed=0, octaves=4, gain=.5, freq=1.0):
    out = 0; amp = 1; total = 0
    for o in range(octaves):
        out = out + noise3(x * freq * 2 ** o, y * freq * 2 ** o, z * freq * 2 ** o, seed + o) * amp
        total += amp; amp *= gain
    return out / total


def fbm2(h, w, scale, seed=0, octaves=4, gain=.5, ox=0.0, oy=0.0):
    ys, xs = np.mgrid[0:h, 0:w].astype(float)
    return fbm3((xs + ox) / scale, (ys + oy) / scale, np.full_like(xs, seed * .37), seed, octaves, gain)


def ridged(n):
    """1 on the thin lines where noise crosses its midpoint: filaments, cracks."""
    return 1 - np.abs(n - .5) * 2


# --------------------------------------------------------------------- output
def to_image(rgb, alpha=None, levels=14, dither=True, hard_alpha=True):
    h, w = rgb.shape[:2]
    bay = bayer(h, w)
    out = quant(rgb, levels, bay * .85 if dither else None)
    if alpha is None: a = np.full((h, w), 255, np.uint8)
    elif hard_alpha: a = ((alpha > (bay * .6 + .15)) * 255).astype(np.uint8)
    else: a = (np.clip(alpha, 0, 1) * 255).astype(np.uint8)
    return Image.fromarray(np.dstack([out.astype(np.uint8), a]), 'RGBA')


# ------------------------------------------------------------------- spheres
def _unit(v): return v / np.linalg.norm(v)


class SphereCtx:
    """Per-pixel sphere coordinates in the planet's own frame, for texture functions."""
    def __init__(self, lat, lon, P, N, lam, light_n):
        self.lat, self.lon, self.P, self.N, self.lam, self.light_n = lat, lon, P, N, lam, light_n


def render_sphere(R, tex, tilt=75, roll=0, spin=0.0, rings=None, atmosphere=None, ambient=.14, gamma=.85,
                  emissive=None, night=None, canvas=None, seed=0, levels=14, shadow_from_rings=True, specular=0):
    """Lit sphere with optional tilted rings.

    tex(ctx) -> (rgb float 0..255, optional alpha) ; R in pixels; tilt = elevation of the
    camera above the equatorial plane in degrees (90 = pole-on, ~0 = edge-on); roll rotates
    the whole system in the picture plane. rings = [(r_in, r_out, density_fn, colour_fn)].
    emissive(ctx) -> rgb added unshaded (lava glow). night: rgb mix for dark side glow.
    """
    rmax = max([1.0] + [r[1] for r in (rings or [])])
    S = canvas or int(math.ceil(2 * R * rmax)) + 6
    ys, xs = np.mgrid[0:S, 0:S].astype(float)
    x = (xs - S / 2 + .5) / R; y = (ys - S / 2 + .5) / R
    a, t = math.radians(max(tilt, 3)), math.radians(roll)
    n = np.array([math.cos(a) * math.sin(t), -math.cos(a) * math.cos(t), math.sin(a)])
    e1 = np.array([1.0, 0, 0]) - n * n[0]
    e1 = _unit(e1 if np.linalg.norm(e1) > 1e-6 else np.array([0, 1.0, 0]))
    e2 = np.cross(n, e1)
    rr = x * x + y * y; inside = rr <= 1
    z = np.sqrt(np.clip(1 - rr, 0, 1))
    N = np.stack([x, y, z], -1)
    pa, pb, pc = N @ e1, N @ e2, N @ n
    lat = np.arcsin(np.clip(pc, -1, 1)); lon = np.arctan2(pb, pa) + spin
    c, s = np.cos(spin), np.sin(spin)
    P = np.stack([pa * c - pb * s, pa * s + pb * c, pc], -1)   # spun planet-frame position
    lam = np.clip(N @ LIGHT, 0, 1)
    ctx = SphereCtx(lat, lon, P, N, lam, n)

    col, alpha_t = tex(ctx), None
    if isinstance(col, tuple): col, alpha_t = col
    shade = ambient + (1 - ambient) * lam ** gamma
    # Rings cast a shadow on the planet.
    if rings and shadow_from_rings:
        nl = float(n @ LIGHT)
        if abs(nl) > .02:
            sdist = -(N @ n) / nl
            H = N + sdist[..., None] * LIGHT
            rh = np.linalg.norm(H, axis=-1)
            dens = np.zeros_like(rh)
            for r_in, r_out, dens_fn, _ in rings:
                m = (rh >= r_in) & (rh <= r_out) & (sdist > 0)
                dens = np.where(m, np.maximum(dens, dens_fn(rh)), dens)
            shade = shade * (1 - .75 * dens)
    lit = col * shade[..., None]
    if night is not None: lit = lit + (1 - smoothstep(0, .35, lam))[..., None] * np.array(night)
    if emissive is not None: lit = lit + emissive(ctx)
    if specular: lit = lit + (np.clip(N @ _unit(LIGHT + np.array([0, 0, 1.0])), 0, 1) ** 40 * specular)[..., None] * 255
    if atmosphere is not None:
        rim = np.clip((rr - .55) / .45, 0, 1) ** 2 * np.clip(lam * 1.4 + .12, 0, 1) * .9
        lit = lit + rim[..., None] * np.array(atmosphere)
    planet_alpha = inside.astype(float) if alpha_t is None else inside * alpha_t
    base = np.zeros((S, S, 4)); base[..., :3] = lit; base[..., 3] = planet_alpha

    ring_back = np.zeros((S, S, 4)); ring_front = np.zeros((S, S, 4))
    if rings:
        nz = n[2]
        zr = -(n[0] * x + n[1] * y) / nz
        P3 = np.stack([x, y, zr], -1); r = np.linalg.norm(P3, axis=-1)
        # Is the ring point in the planet's shadow? Cast a ray toward the sun.
        b = P3 @ LIGHT; cc = r * r - 1
        disc = b * b - cc
        shadowed = (b < 0) & (disc > 0) & ((-b - np.sqrt(np.clip(disc, 0, None))) > 0)
        lit_k = .25 + .75 * min(1.0, abs(float(n @ LIGHT)) * 1.6 + .25)
        for r_in, r_out, dens_fn, col_fn in rings:
            m = (r >= r_in) & (r <= r_out)
            d = np.where(m, dens_fn(r), 0)
            c3 = col_fn(r) * lit_k * np.where(shadowed, .22, 1.0)[..., None]
            layer = np.zeros((S, S, 4)); layer[..., :3] = c3; layer[..., 3] = d
            tgt = ring_front if True else ring_back
            front = zr > 0
            for L, sel in ((ring_front, front), (ring_back, ~front)):
                L[..., :3] = np.where((sel & (layer[..., 3] > L[..., 3]))[..., None], layer[..., :3], L[..., :3])
                L[..., 3] = np.where(sel, np.maximum(L[..., 3], layer[..., 3]), L[..., 3])

    def over(top, bottom):
        a = top[..., 3:4]; b = bottom[..., 3:4]
        oa = a + b * (1 - a)
        rgb = np.where(oa > 0, (top[..., :3] * a + bottom[..., :3] * b * (1 - a)) / np.maximum(oa, 1e-6), 0)
        return np.concatenate([rgb, oa], -1)
    out = over(ring_front, over(base, ring_back))
    return to_image(out[..., :3], out[..., 3], levels=levels)


# -------------------------------------------------------------- ring profiles
def ring_density(bands, gaps=(), base=.85, seed=1):
    """Radial density with fine banding and clear gaps (Cassini-style)."""
    rng = np.random.default_rng(seed); ph = rng.random(4) * 6.28
    def fn(r):
        d = base * (.9 + .06 * np.sin(r * 38 + ph[0]) + .03 * np.sin(r * 91 + ph[1]) + .02 * np.sin(r * 173 + ph[2]))
        for g0, g1 in gaps: d = d * (1 - smoothstep(g0 - .01, g0 + .01, r) * (1 - smoothstep(g1 - .01, g1 + .01, r)))
        return np.clip(d, 0, 1)
    return fn


def ring_colour(stops, r0, r1):
    def fn(r):
        r = np.asarray(r)
        stripe = .8 + .2 * np.sin(r * 62) * np.sin(r * 27 + 1)
        return ramp((r - r0) / (r1 - r0), stops) * stripe[..., None]
    return fn


# ======================================================================= textures
def tex_bands(stops, k=9, turb=.4, seed=3, spot=None, tint=None):
    def fn(c):
        px, py, pz = c.P[..., 0], c.P[..., 1], c.P[..., 2]
        n = fbm3(px * 2.2 + 3, py * 2.2 + 3, pz * 1.1, seed, 4)
        wind = np.sin(c.lat * 3.1) * .25
        v = np.sin((c.lat + (n - .5) * turb + wind * .3) * k) * .5 + .5
        col = ramp(v, stops)
        fine = fbm3(px * 9, py * 9, pz * 3, seed + 9, 3)
        col = col * (.9 + .2 * fine)[..., None]
        if spot:
            lat0, lon0, rx, ry, spot_stops = spot
            dl = np.arctan2(np.sin(c.lon - lon0), np.cos(c.lon - lon0))
            d = np.hypot(dl / rx, (c.lat - lat0) / ry)
            swirl = np.sin(d * 7 + np.arctan2(c.lat - lat0, dl) * 1.5) * .5 + .5
            m = (1 - smoothstep(.78, 1.0, d))[..., None]
            col = col * (1 - m) + ramp(swirl * .6 + .2, spot_stops) * m
        if tint is not None: col = col * np.array(tint)
        return col
    return fn


def tex_lava(seed=5):
    crust = [(0, '#120a10'), (.5, '#28161a'), (1, '#4a2a26')]
    glowc = [(0, '#8e1408'), (.5, '#ff6a1e'), (1, '#ffe27a')]
    def split(c):
        px, py, pz = c.P[..., 0], c.P[..., 1], c.P[..., 2]
        h = fbm3(px * 3 + 1, py * 3 + 1, pz * 3 + 1, seed, 5)
        crack = ridged(fbm3(px * 2.6, py * 2.6, pz * 2.6, seed + 4, 4))
        return h, smoothstep(.93, .985, crack)
    def tex(c):
        h, k = split(c)
        return ramp(h, crust)
    def emis(c):
        h, k = split(c)
        pool = smoothstep(.62, .78, h) * .8
        g = np.clip(k + pool, 0, 1)
        return ramp(.25 + .75 * g, glowc) * g[..., None] * (.55 + .45 * (1 - c.lam[..., None]))
    return tex, emis


def tex_ocean(seed=7):
    def fn(c):
        px, py, pz = c.P[..., 0], c.P[..., 1], c.P[..., 2]
        h = fbm3(px * 1.7 + 5, py * 1.7 + 5, pz * 1.7 + 5, seed, 5)
        land = h > .52
        deep = ramp(h / .52, [(0, '#0a1f4a'), (.7, '#14498a'), (1, '#2d82b8')])
        lc = ramp(np.clip((h - .52) / .3, 0, 1), [(0, '#3f7a3a'), (.4, '#8a8a46'), (.8, '#8a6a46'), (1, '#c8c0a8')])
        col = np.where(land[..., None], lc, deep)
        cl = fbm3(px * 3.3 + 20, py * 3.3 + 20, pz * 3.3 + 20, seed + 11, 5)
        cloud = smoothstep(.54, .72, cl)[..., None]
        col = col * (1 - cloud * .88) + np.array([246, 248, 252]) * cloud * .88
        cap = smoothstep(1.0, 1.15, np.abs(c.lat))[..., None]
        return col * (1 - cap) + np.array([240, 246, 252]) * cap
    return fn


def tex_ice(seed=9):
    def fn(c):
        px, py, pz = c.P[..., 0], c.P[..., 1], c.P[..., 2]
        base = fbm3(px * 3, py * 3, pz * 3, seed, 4)
        col = ramp(base, [(0, '#b8d4e8'), (.6, '#e6f2fa'), (1, '#ffffff')])
        crack = ridged(fbm3(px * 3.6 + 2, py * 3.6, pz * 3.6, seed + 3, 3))
        line = smoothstep(.92, .975, crack)[..., None]
        patch = smoothstep(.55, .8, fbm3(px * 4.5, py * 4.5, pz * 4.5, seed + 6, 3))[..., None]
        col = col * (1 - patch * .35) + np.array([168, 108, 84]) * patch * .35
        return col * (1 - line * .6) + np.array([112, 78, 70]) * line * .6
    return fn


def tex_craters(base_stops, count=30, seed=13, mare=None):
    rng = np.random.default_rng(seed)
    cs = rng.normal(size=(count, 3)); cs /= np.linalg.norm(cs, axis=1, keepdims=True)
    rad = .08 + rng.random(count) ** 2 * .35
    def fn(c):
        px, py, pz = c.P[..., 0], c.P[..., 1], c.P[..., 2]
        h = fbm3(px * 4, py * 4, pz * 4, seed, 4)
        e = np.zeros_like(h)
        for ctr, r in zip(cs, rad):
            d = np.arccos(np.clip(px * ctr[0] + py * ctr[1] + pz * ctr[2], -1, 1)) / r
            e += -np.exp(-(d * 1.5) ** 2) * .5 + np.exp(-((d - 1.0) * 5) ** 2) * .35
        v = np.clip(h * .5 + .35 + e * .6, 0, 1)
        col = ramp(v, base_stops)
        if mare is not None:
            m = smoothstep(.48, .56, fbm3(px * 1.2 + 3, py * 1.2, pz * 1.2, seed + 7, 3))[..., None]
            col = col * (1 - m * .4) + np.array(mare) * m * .4
        return col
    return fn


