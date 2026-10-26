"""Boss and mini-boss sprites in the style of the boss-destroyed draft: chunky 4 px
blocks, flat low-poly facets, a dark silhouette with amber light on its upper-left
edge. Each function draws one frame; make-bosses.py packs them. Geometry (spike
lengths, ring radii, hardpoint positions, panel radius) matches the collision shapes in
native/boss_fights.h, so only the look changed. See boss_facets.py for the painter.
"""
import math
import random
import numpy as np
from PIL import Image
from boss_art import *  # noqa: F401,F403  (INK, projectile, Px for the shot sheet)
from boss_facets import *  # noqa: F401,F403


def wedge(c, cx, cy, r0, r1, a0, a1, palette, shade, steps=6, speckle=.08):
    """An annular sector as one facet."""
    outer = [(cx + math.cos(a0 + (a1 - a0) * i / steps) * r1, cy + math.sin(a0 + (a1 - a0) * i / steps) * r1) for i in range(steps + 1)]
    inner = [(cx + math.cos(a1 - (a1 - a0) * i / steps) * r0, cy + math.sin(a1 - (a1 - a0) * i / steps) * r0) for i in range(steps + 1)]
    return c.facet(outer + inner, palette, shade, speckle)


def ring_facets(c, cx, cy, r0, r1, n, palette, rot=0.0, bias=0.0, light=None, speckle=.1):
    """A ring of n quads; each is lit by the way it faces (or by `light(angle)`)."""
    for i in range(n):
        a0, a1 = rot + i * math.tau / n, rot + (i + 1) * math.tau / n
        mid = (a0 + a1) / 2
        shade = light(mid) if light else lit(math.cos(mid), math.sin(mid), bias)
        wedge(c, cx, cy, r0, r1, a0, a1, palette, shade, 1, speckle)


def fan_facets(c, cx, cy, rx, ry, n, palette, rot=0.0, bias=0.0, speckle=.08, light=None):
    """A disc as n triangles fanned from its centre."""
    pts = c.disc(cx, cy, rx, ry, n, rot)
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        mid = ((a[0] + b[0]) / 2 - cx, (a[1] + b[1]) / 2 - cy)
        shade = light(math.atan2(mid[1], mid[0])) if light else lit(mid[0], mid[1], bias)
        c.facet([(cx, cy), a, b], palette, shade, speckle)


def blocks(c, points, colour, w=1, h=1):
    for x, y in points:
        c.px_block(x, y, colour, w, h)


CREAM = (250, 236, 200)
AMBER = (240, 168, 72)


# ============================================================ SENTINEL / PICKET
def sentinel(open_amt=0.0, glow=0.0, size=220, bare=False, only=None):
    """`bare` leaves out the plates (the defeat sequence blasts them off); `only=k` draws plate k alone."""
    c = Canvas(size, size, seed=11)
    cx = cy = size / 2
    if only is not None:
        return _sentinel_plates(c, cx, cy, open_amt, only)
    spike_facets(c, cx, cy, 8, 74, 106, .17, STEEL, rot=math.radians(22.5))
    ring_facets(c, cx, cy, 50, 73, 16, STEEL, rot=.2, bias=-.1)
    fan_facets(c, cx, cy, 46, 46, 14, STEEL, bias=-1.6, speckle=.05)                       # the dark socket
    fan_facets(c, cx, cy, 33, 33, 12, FIRE, bias=.2 + .8 * glow + .7 * open_amt, speckle=.05)  # the eye
    c.facet([(cx - 4, cy - 28), (cx, cy - 36), (cx + 4, cy - 28), (cx + 4, cy + 28), (cx, cy + 36), (cx - 4, cy + 28)], [INK], 0, 0)
    c.px_block(cx - 16, cy - 19, CREAM, 2, 2)
    for sgn in (-1, 1):                                                                      # angry brows
        c.facet([(cx + sgn * 6, cy - 42), (cx + sgn * 42, cy - 26), (cx + sgn * 38, cy - 10), (cx + sgn * 8, cy - 28)], STEEL, 0 if sgn > 0 else 1, .06)
    if not bare:
        _sentinel_plates(c, cx, cy, open_amt, None)
    return c.finish()


def _sentinel_plates(c, cx, cy, open_amt, only):
    shift = open_amt * 20
    for k in range(4):
        if only is not None and k != only:
            continue
        ang = math.radians(45 + 90 * k)
        span = math.radians(86)
        px_, py_ = cx + math.cos(ang) * shift, cy + math.sin(ang) * shift
        for side, (a0, a1) in enumerate(((ang - span / 2, ang), (ang, ang + span / 2))):
            arc = [(px_ + math.cos(a0 + (a1 - a0) * i / 5) * 70, py_ + math.sin(a0 + (a1 - a0) * i / 5) * 70) for i in range(6)]
            half = (a0 + a1) / 2
            c.facet([(px_, py_)] + arc, STEEL, lit(math.cos(half), math.sin(half), -1.0), .12)
            inner = [(px_ + math.cos(a0 + (a1 - a0) * i / 5) * 40, py_ + math.sin(a0 + (a1 - a0) * i / 5) * 40) for i in range(6)]
            c.facet([(px_, py_)] + inner, STEEL, lit(math.cos(half), math.sin(half), -.2), .1)
        c.line([(px_ + math.cos(ang - span / 2 + span * i / 9) * 68, py_ + math.sin(ang - span / 2 + span * i / 9) * 68) for i in range(10)], AMBER)
        for edge in (ang - span / 2, ang + span / 2):
            c.line([(px_, py_), (px_ + math.cos(edge) * 69, py_ + math.sin(edge) * 69)], INK)
        for rr in (22, 40, 56):
            c.px_block(px_ + math.cos(ang) * rr, py_ + math.sin(ang) * rr, CREAM)
    return c.finish() if only is not None else None


def picket_gate(open_amt=0.0, glow=0.0, size=150):
    c = Canvas(size, size, seed=21)
    cx = cy = size / 2
    spike_facets(c, cx, cy, 6, 34, 62, .2, STEEL, rot=math.radians(30))
    hexp = [(cx + math.cos(math.radians(60 * i)) * 44, cy + math.sin(math.radians(60 * i)) * 44) for i in range(6)]
    for i in range(6):
        a, b = hexp[i], hexp[(i + 1) % 6]
        c.facet([(cx, cy), a, b], STEEL, lit((a[0] + b[0]) / 2 - cx, (a[1] + b[1]) / 2 - cy, .2), .08)
    fan_facets(c, cx, cy, 24, 24, 10, STEEL, bias=-1.6, speckle=.04)
    fan_facets(c, cx, cy, 17, 17, 10, FIRE, bias=.2 + .7 * glow + .6 * open_amt, speckle=.05)
    c.facet([(cx - 2, cy - 15), (cx + 2, cy - 15), (cx + 2, cy + 15), (cx - 2, cy + 15)], [INK], 0, 0)
    lift = open_amt * 15
    hexmask = c.mask(hexp)
    c.clip = hexmask
    c.facet([(cx - 28, cy - 2 - lift), (cx + 28, cy - 2 - lift), (cx + 22, cy - 28 - lift), (cx - 22, cy - 28 - lift)], STEEL, 3, .08)
    c.facet([(cx - 28, cy + 2 + lift), (cx + 28, cy + 2 + lift), (cx + 22, cy + 28 + lift), (cx - 22, cy + 28 + lift)], STEEL, 1, .08)
    c.line([(cx - 26, cy - 2 - lift), (cx + 26, cy - 2 - lift)], AMBER)
    c.line([(cx - 26, cy + 2 + lift), (cx + 26, cy + 2 + lift)], (190, 100, 40))
    c.clip = None
    return c.finish()


# ============================================================ RINGWARDEN / SHARDLING
def _gem(c, cx, cy, hw, hh, palette, bias=0.0):
    top, right, bottom, left = (cx, cy - hh), (cx + hw, cy), (cx, cy + hh), (cx - hw, cy)
    c.facet([top, left, (cx, cy)], palette, min(4, 4 + int(bias)), .06)
    c.facet([top, right, (cx, cy)], palette, 3, .06)
    c.facet([left, bottom, (cx, cy)], palette, 2, .06)
    c.facet([right, bottom, (cx, cy)], palette, 1, .06)


def ringwarden_core(glow=0.0, size=150):
    c = Canvas(size, size, seed=31)
    cx = cy = size / 2
    fan_facets(c, cx, cy, 66, 66, 14, VOID, bias=-1.2 + .8 * glow, speckle=.06)
    _gem(c, cx, cy, 34, 52, ICE, glow)
    _gem(c, cx - 3, cy - 4, 18, 30, ICE, 0)
    fan_facets(c, cx, cy, 12, 24, 8, VIOLET, bias=.2 + .8 * glow, speckle=0)
    c.facet([(cx - 2, cy - 22), (cx + 2, cy - 22), (cx + 2, cy + 22), (cx - 2, cy + 22)], [CREAM], 0, 0)
    return c.finish()


def ice_blade(k, length, width, size):
    c = Canvas(size, size, seed=40 + k)
    cx = cy = size / 2
    a = k * math.pi / 8
    rx, ry = math.cos(a), math.sin(a)
    tip = (cx + rx * length, cy + ry * length)
    tail = (cx - rx * length * .6, cy - ry * length * .6)
    s1 = (cx - ry * width, cy + rx * width)
    s2 = (cx + ry * width, cy - rx * width)
    c.facet([tip, s1, tail], ICE, lit(-ry, rx, .4), .08)
    c.facet([tip, s2, tail], ICE, lit(ry, -rx, .4), .08)
    mid1 = (cx + (s1[0] - cx) * .55 + rx * length * .1, cy + (s1[1] - cy) * .55 + ry * length * .1)
    c.facet([tip, mid1, (cx - rx * length * .2, cy - ry * length * .2)], ICE, min(4, lit(-ry, rx, .4) + 1), 0)
    c.line([(cx - rx * length * .3, cy - ry * length * .3), (cx + rx * length * .85, cy + ry * length * .85)], CREAM)
    return c.finish()


def shardling_core(glow=0.0, size=110):
    c = Canvas(size, size, seed=51)
    cx = cy = size / 2
    fan_facets(c, cx, cy, 26, 26, 10, VOID, bias=-1 + .8 * glow, speckle=.05)
    _gem(c, cx, cy, 15, 24, ICE, glow)
    c.facet([(cx - 1, cy - 10), (cx + 1, cy - 10), (cx + 1, cy + 10), (cx - 1, cy + 10)], [CREAM], 0, 0)
    return c.finish()


# ============================================================ CINDERFORGE / CINDERLING
def _sphere(c, cx, cy, R, lat_n, lon_n, heat, seed, windows=(0, 5, 2), open_cells=(), prongs=14):
    rng = np.random.default_rng(seed)
    spike_facets(c, cx, cy, prongs, R - 6, R * 1.32, .11, CHAR, rot=.1)
    tilt, yaw = .42, .3
    ct, st = math.cos(tilt), math.sin(tilt)

    def at(lat, lon):
        x, y, z = math.cos(lat) * math.sin(lon + yaw), math.sin(lat), math.cos(lat) * math.cos(lon + yaw)
        y, z = y * ct - z * st, y * st + z * ct
        return (cx + R * x, cy + R * y), (x, y, z)
    facets = []
    for i in range(lat_n):
        for j in range(lon_n):
            lat0, lat1 = -math.pi / 2 + math.pi * i / lat_n, -math.pi / 2 + math.pi * (i + 1) / lat_n
            lon0, lon1 = -math.pi / 2 + math.pi * j / lon_n * 1.0, -math.pi / 2 + math.pi * (j + 1) / lon_n
            corners = [at(lat0, lon0), at(lat0, lon1), at(lat1, lon1), at(lat1, lon0)]
            _, (nx, ny, nz) = at((lat0 + lat1) / 2, (lon0 + lon1) / 2)
            if nz < -.05:
                continue
            facets.append((nz, i, j, [p for p, _ in corners], nx, ny))
    for nz, i, j, quad, nx, ny in sorted(facets):
        base = lit(nx * 1.4, ny * 1.4, .1 - (1 - max(nz, 0)) * .7)
        window = ((i * 7 + j * 13 + windows[0]) % windows[1]) < windows[2] and 0 < i < lat_n - 1
        if (j, i) in open_cells or (i, j) in open_cells:
            window = True
        c.facet(quad, CHAR, base, .12)
        if window:
            cxq, cyq = sum(p[0] for p in quad) / 4, sum(p[1] for p in quad) / 4
            inner = [(cxq + (p[0] - cxq) * .68, cyq + (p[1] - cyq) * .68) for p in quad]
            c.facet(quad, CHAR, 0, 0)
            level = int(np.clip(round(1 + heat * 2.6 + rng.uniform(-.8, .8)), 1, 4))
            c.facet(inner, FIRE, level, .15)
        else:
            c.line([quad[0], quad[1]], (60, 36, 40))
            c.line([quad[1], quad[2]], (60, 36, 40))


def cinderforge(core=0.5, size=300, **_):
    c = Canvas(size, size, seed=61)
    _sphere(c, size / 2, size / 2, 118, 6, 8, core, 61)
    return c.finish()


def cinderling(core=0.4, open_cells=(), size=150):
    c = Canvas(size, size, seed=71)
    _sphere(c, size / 2, size / 2, 52, 4, 4, core, 71, windows=(1, 4, 1), open_cells=open_cells, prongs=9)
    return c.finish()


def forge_panel(state, frame=0, size=44):
    c = Canvas(size, size, seed=81 + frame + state * 3)
    cx = cy = size / 2
    rng = np.random.default_rng(5 + frame)
    if state == 0:
        fan_facets(c, cx, cy, 18, 18, 8, STEEL, bias=.4, speckle=.05)
        fan_facets(c, cx, cy, 12, 12, 8, STEEL, bias=-.4, speckle=0)
        c.line([(cx - 12, cy), (cx + 12, cy)], INK)
        c.line([(cx, cy - 12), (cx, cy + 12)], INK)
        blocks(c, [(cx - 14, cy - 14), (cx + 12, cy - 14), (cx - 14, cy + 12), (cx + 12, cy + 12)], CREAM)
    else:
        broken = state == 2
        n = 9 if broken else 8
        rim = [(cx + math.cos(i * math.tau / n) * (18 + (rng.random() * 5 if broken else 0)),
                cy + math.sin(i * math.tau / n) * (18 + (rng.random() * 5 if broken else 0))) for i in range(n)]
        for i in range(n):
            c.facet([(cx, cy), rim[i], rim[(i + 1) % n]], CHAR, lit(rim[i][0] - cx, rim[i][1] - cy, -.3 if broken else .2), .1)
        bias = 1 if frame else 0
        fan_facets(c, cx, cy, 11, 11, 8, FIRE, bias=(.2 if broken else .8) + bias * .7, speckle=.2)
        if not broken:
            c.facet([(cx - 1, cy - 9), (cx + 1, cy - 9), (cx + 1, cy + 9), (cx - 1, cy + 9)], [CREAM], 0, 0)
    return c.finish()


# ============================================================ BASTION / GUNNERY
def _hull_layers(c, hull_pts, top_edge, base_y):
    """Two planes and armour bands for a wedge hull, clipped to its outline."""
    hullmask = c.mask(hull_pts)
    c.clip = hullmask
    return hullmask


def bastion_layers(size=(340, 196)):
    w, h = size
    layers = {}
    c = Canvas(w, h, seed=91)
    hull_pts = [(4, 98), (258, 14), (298, 22), (326, 46), (326, 150), (298, 174), (258, 182)]
    c.facet(hull_pts, GUN, 2, 0)
    c.clip = c.mask(hull_pts)
    c.facet([(0, 0), (w, 0), (w, 98), (0, 98)], GUN, 3, .08)                       # upper plane catches the light
    c.facet([(0, 98), (w, 98), (w, h), (0, h)], GUN, 1, .08)                       # lower plane in shade
    for k, x0 in enumerate(range(40, 300, 38)):                                    # stepped armour bands
        c.facet([(x0, 0), (x0 + 34, 0), (x0 + 34, 98), (x0, 98)], GUN, 3 + (k % 2), .12)
        c.facet([(x0, 98), (x0 + 34, 98), (x0 + 34, h), (x0, h)], GUN, 1 + (k % 2) * 1, .12)
        c.line([(x0 + 34, 0), (x0 + 34, h)], (10, 12, 28))
    c.facet([(20, 98), (260, 86), (260, 110)], GUN, 0, .05)                        # the lit trench
    blocks(c, [(x, 96) for x in range(40, 260, 16)], (255, 110, 40), 1, 1)
    for pts in ([(230, 22), (252, 52), (240, 74)], [(150, 44), (170, 66)], [(90, 142), (112, 128), (124, 146)]):
        c.line(pts, (255, 150, 40))
    blocks(c, [(x, (98 - 84 * (x - 4) / 254) + 5) for x in range(60, 250, 20)] + [(x, (98 + 84 * (x - 4) / 254) - 8) for x in range(60, 250, 20)], CREAM)
    c.clip = None
    # bridge tower
    c.facet([(246, 52), (316, 52), (316, 146), (246, 146)], GUN, 2, .08)
    c.facet([(246, 52), (316, 52), (306, 44), (256, 44)], GUN, 4, .08)
    c.facet([(262, 66), (306, 66), (306, 132), (262, 132)], GUN, 0, .05)
    for dx in (270, 298):
        fan_facets(c, dx, 62, 11, 11, 8, GUN, bias=.6, speckle=.06)
        c.facet([(dx - 1, 52), (dx + 1, 52), (dx + 1, 72), (dx - 1, 72)], [(210, 70, 40)], 0, 0)
    fan_facets(c, 284, 100, 17, 17, 10, FIRE, bias=.2, speckle=.05)
    c.facet([(282, 88), (286, 88), (286, 112), (282, 112)], [INK], 0, 0)
    for ey in (52, 98, 144):
        c.facet([(318, ey - 14), (334, ey - 14), (334, ey + 14), (318, ey + 14)], GUN, 0, .06)
        c.facet([(330, ey - 11), (340, ey - 11), (340, ey + 11), (330, ey + 11)], FIRE, 3, .1)
    layers['hull'] = c.finish()
    c = Canvas(w, h, seed=92)
    for ey in (52, 98, 144):
        c.facet([(330, ey - 11), (342, ey - 11), (342, ey + 11), (330, ey + 11)], FIRE, 4, 0)
        c.facet([(342, ey - 7), (350, ey - 7), (350, ey + 7), (342, ey + 7)], FIRE, 3, 0)
    layers['flare'] = c.finish(rim=False)
    c = Canvas(w, h, seed=93)
    for tx, ty in ((130, 54), (178, 40), (226, 27)):
        c.facet([(tx - 30, ty - 4), (tx, ty - 4), (tx, ty + 4), (tx - 30, ty + 4)], GUN, 3, .05)
        fan_facets(c, tx, ty, 11, 11, 8, GUN, bias=.8, speckle=.06)
        c.px_block(tx - 2, ty - 2, (255, 160, 40), 1, 1)
    layers['cannon'] = c.finish()
    for name, opened in (('pods', 0), ('pods_open', 1)):
        c = Canvas(w, h, seed=94)
        for px_, py_ in ((116, 150), (168, 160)):
            c.facet([(px_ - 18, py_ - 12), (px_ + 18, py_ - 12), (px_ + 18, py_ + 12), (px_ - 18, py_ + 12)], GUN, 2, .08)
            c.facet([(px_ - 18, py_ - 12), (px_ + 18, py_ - 12), (px_ + 14, py_ - 8), (px_ - 14, py_ - 8)], GUN, 4, 0)
            for i in range(3):
                c.px_block(px_ - 12 + i * 10, py_ - 1, (230, 40, 30) if opened else (10, 8, 20), 2, 2)
        layers[name] = c.finish()
    for name, opened in (('mine', 0), ('mine_open', 1)):
        c = Canvas(w, h, seed=95)
        c.facet([(196, 140), (244, 140), (244, 168), (196, 168)], GUN, 0, .06)
        c.facet([(204, 148), (236, 148), (236, 160), (204, 160)], FIRE, 4 if opened else 1, .08)
        layers[name] = c.finish()

    def wreck(boxes, seed):
        cc = Canvas(w, h, seed=seed)
        rng = random.Random(seed)
        for (x0, y0, x1, y1) in boxes:
            cc.facet([(x0, y0 + 4), (x0 + 12, y0), (x1 - 8, y0 + 3), (x1, y0 + 12), (x1 - 4, y1), (x0 + 6, y1 - 3)], CHAR, 1, .2)
            for _ in range(6):
                cc.px_block(rng.uniform(x0 + 4, x1 - 4), rng.uniform(y0 + 4, y1 - 4), (255, 120, 30) if rng.random() < .4 else (60, 30, 26))
        return cc.finish()
    layers['cannon_dead'] = wreck([(104, 40, 150, 62), (156, 28, 196, 50), (206, 14, 244, 36)], 3)
    layers['pods_dead'] = wreck([(98, 138, 134, 162), (150, 148, 186, 172)], 4)
    layers['mine_dead'] = wreck([(196, 140, 244, 168)], 5)
    return layers


def gunnery_hull(charge=0.0, size=(200, 108)):
    w, h = size
    c = Canvas(w, h, seed=101)
    hull = [(4, 54), (150, 12), (182, 20), (196, 36), (196, 72), (182, 88), (150, 96)]
    c.facet(hull, GUN, 2, 0)
    c.clip = c.mask(hull)
    c.facet([(0, 0), (w, 0), (w, 54), (0, 54)], GUN, 3, .1)
    c.facet([(0, 54), (w, 54), (w, h), (0, h)], GUN, 1, .1)
    c.facet([(16, 54), (150, 48), (150, 60)], GUN, 0, .04)
    blocks(c, [(x, 52) for x in range(30, 150, 16)], (255, 110, 40))
    c.clip = None
    c.facet([(142, 30), (190, 30), (190, 78), (142, 78)], GUN, 2, .08)
    c.facet([(142, 30), (190, 30), (184, 24), (148, 24)], GUN, 4, 0)
    fan_facets(c, 168, 54, 15, 15, 10, FIRE, bias=.2 + .8 * charge, speckle=.05)
    c.facet([(166, 44), (170, 44), (170, 64), (166, 64)], [INK], 0, 0)
    for off in (-12, 12):
        y = 54 + off * .8
        c.facet([(34, y - 4), (74, y - 4), (74, y + 4), (34, y + 4)], GUN, 3, .05)
        fan_facets(c, 74, y, 9, 9, 8, GUN, bias=.8, speckle=.05)
    c.facet([(192, 40), (202, 40), (202, 68), (192, 68)], GUN, 0, .05)
    c.facet([(198, 44), (206, 44), (206, 64), (198, 64)], FIRE, 3, .1)
    return c.finish()


# ============================================================ TIDECALLER / MOONJELLY
def _tendrils(w, h, cx, top, count, spread, rows, step, phase, width, seed):
    """Tendrils on their own layer (no amber rim: it would stripe thin shapes)."""
    c = Canvas(w, h, seed=seed)
    for i in range(count):
        base = cx + (i - (count - 1) / 2) * spread
        pts = [(base + math.sin(phase * 2.2 + j * .26 + i * .9) * (2 + j * .55), top + j * step) for j in range(rows)]
        for j in range(rows - 1):
            (x0, y0), (x1, y1) = pts[j], pts[j + 1]
            c.facet([(x0 - width / 2, y0), (x0 + width / 2, y0), (x1 + width / 2, y1), (x1 - width / 2, y1)], TEAL, 2 if i % 2 else 3, .1)
            if j % 5 == 2:
                c.px_block(x0 - 1, y0, (255, 150, 230))
        tip = pts[-1]
        c.facet([(tip[0] - 7, tip[1] - 4), (tip[0], tip[1] + 16), (tip[0] + 7, tip[1] - 4)], MAG, 3, .05)
    return c.finish(rim=False)


def _jelly(c, cx, cy, rx, ry, glow, eye_rx, eye_ry, fangs, seed):
    n = 12
    arc = [(cx + math.cos(math.pi + i * math.pi / n) * rx, cy + math.sin(math.pi + i * math.pi / n) * ry) for i in range(n + 1)]
    for i in range(n):
        mid = (math.pi + (i + .5) * math.pi / n)
        c.facet([(cx, cy), arc[i], arc[i + 1]], TEAL, lit(math.cos(mid), math.sin(mid) * .9, .5 + .7 * glow), .1)
    inner = [(cx + (p[0] - cx) * .62, cy + (p[1] - cy) * .62 - 4) for p in arc]
    for i in range(n):
        mid = (math.pi + (i + .5) * math.pi / n)
        c.facet([inner[i], inner[i + 1], (cx, cy - 6)], TEAL, min(4, lit(math.cos(mid), math.sin(mid), 1.2)), .08)
    for k in range(fangs):                                                         # the fanged skirt
        bx = cx - rx + k * (2 * rx / fangs)
        c.facet([(bx - 2, cy - 2), (bx + rx / fangs, cy + 26 + (k % 2) * 8), (bx + 2 * rx / fangs + 2, cy - 2)], TEAL, 3 - (k % 2), .06)
    fan_facets(c, cx, cy - 20, eye_rx, eye_ry, 10, MAG, bias=.1 + .8 * glow, speckle=.05)
    c.facet([(cx - 3, cy - 38), (cx + 3, cy - 38), (cx + 3, cy - 2), (cx - 3, cy - 2)], [INK], 0, 0)
    c.px_block(cx - 14, cy - 30, CREAM, 2, 2)


def tidecaller(phase=0.0, bubbles=0, glow=0.0, deflate=0.0, size=(230, 290)):
    w, h = size
    under = _tendrils(w, h, w / 2, 118, 6, 24, 23, 7.4, phase, 9, 111)
    c = Canvas(w, h, seed=111)
    _jelly(c, w / 2, 108, 98, 84, glow, 36, 30, 10, 111)
    for k in range(5):
        c.px_block(w / 2 - 64 + k * 32, 56 + (k % 2) * 8, (255, 160, 230), 2, 2)
    under.alpha_composite(c.finish())
    return under


def moonjelly(phase=0.0, glow=0.0, size=(150, 190)):
    w, h = size
    under = _tendrils(w, h, w / 2, 76, 4, 22, 14, 7.5, phase, 8, 121)
    c = Canvas(w, h, seed=121)
    _jelly(c, w / 2, 70, 58, 52, glow, 22, 18, 6, 121)
    under.alpha_composite(c.finish())
    return under


# ============================================================ HORIZON WARDEN / LENS IMP
def _halo_light(glow):
    return lambda a: int(np.clip(round(2 + 2.2 * math.cos(a - 2.4) + glow), 0, 4))


def warden(glow=0.0, size=(330, 330), orbits=False, **_):
    w, h = size
    c = Canvas(w, h, seed=131)
    cx, cy = w / 2, h / 2
    spike_facets(c, cx, cy, 12, 112, 150, .12, VIOLET, rot=.15)
    for k in range(6):                                                              # six armour plates
        a0 = k / 6 * math.tau + .08
        a1 = a0 + math.tau / 6 - .16
        mid = (a0 + a1) / 2
        for side, (b0, b1) in enumerate(((a0, mid), (mid, a1))):
            wedge(c, cx, cy, 84, 116, b0, b1, VIOLET, lit(math.cos((b0 + b1) / 2), math.sin((b0 + b1) / 2), .5), 4)
            wedge(c, cx, cy, 90, 104, b0, b1, VIOLET, min(4, lit(math.cos((b0 + b1) / 2), math.sin((b0 + b1) / 2), 1.2)), 4, .06)
        c.line([(cx + math.cos(a0 + (a1 - a0) * i / 9) * 113, cy + math.sin(a0 + (a1 - a0) * i / 9) * 113) for i in range(10)], AMBER)
    ring_facets(c, cx, cy, 50, 73, 28, HALO, rot=.05, light=_halo_light(glow * 1.2), speckle=.1)
    ring_facets(c, cx, cy, 48, 52, 28, [CREAM], rot=.05, light=lambda a: 0, speckle=0)
    fan_facets(c, cx, cy, 48, 48, 20, VOID, bias=-3, speckle=.03)
    c.facet([(cx - 2, cy - 34), (cx, cy - 46), (cx + 2, cy - 34), (cx + 2, cy + 34), (cx, cy + 46), (cx - 2, cy + 34)], [CREAM], 0, 0)
    return c.finish()


def lensimp(glow=0.0, size=(170, 170), orbits=False, **_):
    w, h = size
    c = Canvas(w, h, seed=141)
    cx, cy = w / 2, h / 2
    spike_facets(c, cx, cy, 8, 44, 66, .15, VIOLET, rot=.2)
    ring_facets(c, cx, cy, 34, 50, 20, HALO, rot=.1, light=_halo_light(glow * 1.2), speckle=.1)
    fan_facets(c, cx, cy, 33, 33, 14, VOID, bias=-3, speckle=.03)
    c.facet([(cx - 2, cy - 22), (cx, cy - 30), (cx + 2, cy - 22), (cx + 2, cy + 22), (cx, cy + 30), (cx - 2, cy + 22)], [CREAM], 0, 0)
    return c.finish()


def star_sprite(rgb, size=19):
    c = Canvas(size, size, q=3, seed=151)
    cx = cy = size / 2
    palette = [tuple(int(v * f) for v in rgb) for f in (.3, .55, .8, 1.0)] + [(255, 255, 255)]
    top, right, bottom, left = (cx, 1), (size - 1, cy), (cx, size - 1), (1, cy)
    c.facet([top, left, (cx, cy)], palette, 4, 0)
    c.facet([top, right, (cx, cy)], palette, 3, 0)
    c.facet([left, bottom, (cx, cy)], palette, 2, 0)
    c.facet([right, bottom, (cx, cy)], palette, 1, 0)
    return c.finish()
