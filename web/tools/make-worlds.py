"""Builds assets/worlds.png and worlds.json: the planets, moons and black hole
that sit behind each region, as strips of rotation frames.

Needs Pillow + NumPy; run from the repo root:
    python3 -m venv v && v/bin/pip install pillow numpy
    v/bin/python web/tools/make-worlds.py
Every world is lit from the upper left, like the rest of the game. Each strip
holds FRAMES evenly spaced rotation steps; the game crossfades between them at
a very slow rate (backgrounds.mjs), so the spin never pulls the eye.
"""
import json
import math
import sys
from pathlib import Path
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from space_lib import *  # noqa: F401,F403,E402
import space_objects as so  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / 'assets'
FRAMES = 16
TAU = math.tau


def storm_giant(spin):
    stops = [(0, '#8a4a2a'), (.3, '#d09860'), (.55, '#f0dcb4'), (.75, '#b86a3c'), (1, '#6a3a24')]
    spot = (-.35, 1.2, .5, .22, [(0, '#8a2418'), (.5, '#c8452a'), (1, '#f0a070')])
    return render_sphere(64, tex_bands(stops, k=13, turb=.5, seed=31, spot=spot), tilt=12, roll=-8, spin=spin, atmosphere=(255, 200, 150))


def ice_giant(spin):
    stops = [(0, '#2a4a8a'), (.4, '#4a7ac8'), (.7, '#8ab8ec'), (1, '#c8e4fa')]
    r_a = (1.3, 1.55, ring_density(None, base=.97, seed=8), ring_colour([(0, '#6a8ab0'), (1, '#b8d0ea')], 1.3, 1.55))
    r_b = (1.8, 2.3, ring_density(None, gaps=[(2.05, 2.1)], base=.97, seed=9), ring_colour([(0, '#4a6a9a'), (1, '#a0c0e0')], 1.8, 2.3))
    return render_sphere(44, tex_bands(stops, k=7, turb=.3, seed=23), tilt=30, roll=-34, spin=spin, rings=[r_a, r_b], atmosphere=(160, 230, 255))


def lava_world(spin):
    t, e = tex_lava()
    return render_sphere(54, t, tilt=26, roll=15, spin=spin, emissive=e, night=(36, 8, 4), atmosphere=(255, 120, 60), ambient=.06)


def ocean_world(spin):
    return render_sphere(44, tex_ocean(), tilt=24, roll=-10, spin=spin, atmosphere=(150, 210, 255), specular=.28)


def moon(radius, count, seed):
    return lambda spin: render_sphere(radius, tex_craters([(0, '#2a2a34'), (.5, '#8a8a96'), (1, '#e0e0ea')], count, seed), tilt=30, spin=spin, atmosphere=(220, 220, 240))


def ice_moon(spin):
    return render_sphere(18, tex_ice(), tilt=22, spin=spin, atmosphere=(200, 230, 255))


def hot_jupiter(spin):
    """A dark, scorched giant; its atmosphere streams away from the sun (lower right)."""
    body = render_sphere(20, tex_bands([(0, '#3a1018'), (.5, '#8a2a28'), (1, '#e0623a')], k=9, turb=.5, seed=47), tilt=10, spin=spin,
                         atmosphere=(255, 120, 80), ambient=.1, gamma=.6)
    W, H = body.width + 70, body.height + 44
    sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0)); px = sheet.load()
    rng = np.random.default_rng(5); ang = math.radians(32); ca, sa = math.cos(ang), math.sin(ang)
    cx, cy = body.width / 2, body.height / 2
    for _ in range(520):
        t = rng.random() ** 1.5; along = 14 + t * 66; across = rng.normal() * (1.5 + 8 * t)
        x = cx + ca * along - sa * across; y = cy + sa * along + ca * across
        if 0 <= int(x) < W and 0 <= int(y) < H:
            px[int(x), int(y)] = (255, int(190 - 120 * t), int(100 - 60 * t), int(255 * (1 - t) * .9))
    sheet.alpha_composite(body, (0, 0))
    return sheet


WORLDS = [  # name, renderer, whether it spins
    ('storm-giant', storm_giant, True), ('ice-giant', ice_giant, True), ('lava-world', lava_world, True),
    ('ocean-world', ocean_world, True), ('moon-large', moon(58, 44, 41), True), ('moon-small', moon(20, 22, 43), True),
    ('moon-tiny', moon(11, 12, 45), True), ('ice-moon', ice_moon, True), ('hot-jupiter', hot_jupiter, True),
]


def main():
    rows, meta = [], {}
    for name, fn, _ in WORLDS:
        frames = [fn(i * TAU / FRAMES) for i in range(FRAMES)]
        w, h = frames[0].size
        strip = Image.new('RGBA', (w * FRAMES, h), (0, 0, 0, 0))
        for i, f in enumerate(frames): strip.paste(f, (i * w, 0))
        rows.append((name, strip, w, h))
    # Static black hole: no orbiting stars baked in (the game animates them).
    bh = so.sgr_a(orbits=False)
    arr = np.asarray(bh).copy(); n = arr.shape[0]
    ys, xs = np.mgrid[0:n, 0:n]; edge = np.clip((1 - np.hypot(xs - n / 2 + .5, ys - n / 2 + .5) / (n / 2)) * 3.2, 0, 1)
    arr[..., 3] = ((edge > bayer(n, n) * .8 + .1) * 255).astype(np.uint8)   # dithered fade into the sky
    bh = Image.fromarray(arr, 'RGBA')
    rows.append(('sgr-a', bh, bh.width, bh.height))
    sheet_w = max(r[1].width for r in rows); y = 0
    sheet = Image.new('RGBA', (sheet_w, sum(r[1].height for r in rows)), (0, 0, 0, 0))
    for name, strip, w, h in rows:
        sheet.paste(strip, (0, y))
        meta[name] = dict(x=0, y=y, w=w, h=h, frames=FRAMES if name != 'sgr-a' else 1)
        y += h
    sheet.save(OUT / 'worlds.png', optimize=True)
    (OUT / 'worlds.json').write_text(json.dumps(meta, indent=1) + '\n')
    print('wrote', OUT / 'worlds.png', sheet.size, {k: (v['w'], v['h']) for k, v in meta.items()})


if __name__ == '__main__':
    main()
