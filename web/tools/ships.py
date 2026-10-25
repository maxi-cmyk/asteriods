"""Hull designs for the Hangar: original 24x16 right-facing pixel ships, plus
the code that turns each into the sixteen 32x32 aiming cells the renderer
expects (22.5 degree steps, clockwise, index 0 = facing right).

Silhouettes are inspired by the rocket/fighter mix of inspo/04 but nothing is
traced from it. Light comes from the upper left, so hulls facing left are
mirrored top-to-bottom before rotating to keep the lit side up.
Needs Pillow + NumPy.
"""
import math
import numpy as np
from PIL import Image, ImageDraw

rgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
NAMES = {
    'dart': ('Dart', 'Swept wings and a quick nose. The all-rounder.'),
    'lancer': ('Lancer', 'A long needle with tiny wings. Cuts straight.'),
    'wasp': ('Wasp', 'Forward-swept blades. Looks mean, flies fine.'),
    'hammer': ('Hammer', 'Broad, armoured and proud of it.'),
    'moth': ('Moth', 'Wide delta wings that catch the light.'),
    'comet': ('Comet', 'A rounded capsule with side pods.'),
}

HULL = [rgb('#4a4a82'), rgb('#8088b8'), rgb('#b8c4e0'), rgb('#f0f4ff')]
OUTLINE = rgb('#120a28')
CANOPY = rgb('#7af0ff')
# Upper-half polygons in a 24x16 right-facing grid (nose at x=23); mirrored about y=8.
SHIPS = {
    'dart':   dict(accent='#5ee4ff', body=[(1, 8), (3, 6), (14, 5), (23, 8)], wing=[(4, 6), (9, 1), (13, 1), (12, 6)],
                   stripe=[(8, 3), (10, 2), (12, 2), (11, 4)], canopy=(15, 6, 19, 8), engine=(0, 6, 2, 8)),
    'lancer': dict(accent='#ffc860', body=[(0, 8), (2, 7), (16, 6), (23, 8)], wing=[(6, 7), (8, 3), (12, 3), (12, 7)],
                   stripe=[(7, 5), (9, 4), (11, 4), (11, 6)], canopy=(14, 7, 19, 8), engine=(0, 7, 2, 8)),
    'wasp':   dict(accent='#ff6ec7', body=[(2, 8), (4, 6), (14, 6), (23, 8)], wing=[(15, 6), (7, 0), (4, 0), (10, 6)],
                   stripe=[(6, 2), (8, 1), (10, 3), (8, 4)], canopy=(14, 6, 18, 8), engine=(1, 6, 3, 8)),
    'hammer': dict(accent='#ff8a4a', body=[(0, 8), (1, 4), (16, 4), (23, 8)], wing=[(3, 4), (4, 1), (11, 1), (13, 4)],
                   stripe=[(5, 2), (10, 2), (10, 3), (5, 3)], canopy=(15, 5, 20, 8), engine=(0, 4, 2, 8)),
    'moth':   dict(accent='#9a7aff', body=[(3, 8), (5, 7), (15, 7), (22, 8)], wing=[(2, 7), (1, 0), (14, 2), (16, 7)],
                   stripe=[(4, 2), (10, 3), (10, 4), (4, 4)], canopy=(14, 7, 18, 8), engine=(2, 6, 4, 8)),
    'comet':  dict(accent='#7aff9a', body=[(2, 8), (4, 5), (12, 4), (20, 6), (23, 8)], wing=[(8, 4), (9, 1), (13, 1), (14, 4)],
                   stripe=[(9, 2), (12, 2), (12, 3), (9, 3)], canopy=(15, 6, 19, 8), engine=(1, 5, 3, 8)),
}

def ship_body(spec):
    mask = Image.new('L', (24, 16), 0)
    layers = {k: Image.new('L', (24, 16), 0) for k in ('wing', 'stripe', 'canopy', 'engine')}
    md = ImageDraw.Draw(mask)
    def paint(draw, poly, v=255):
        draw.polygon(poly, fill=v)
        draw.polygon([(x, 15 - y) for x, y in poly], fill=v)
    paint(md, spec['body']); paint(md, spec['wing'])
    for k in ('wing', 'stripe'): paint(ImageDraw.Draw(layers[k]), spec[k])
    x0, y0, x1, y1 = spec['canopy']
    for ox in (0,):
        ImageDraw.Draw(layers['canopy']).ellipse((x0, y0, x1, y1), fill=255)
        ImageDraw.Draw(layers['canopy']).ellipse((x0, 15 - y1, x1, 15 - y0), fill=255)
    ex0, ey0, ex1, ey1 = spec['engine']
    ImageDraw.Draw(layers['engine']).rectangle((ex0, ey0, ex1, 15 - ey0), fill=255)
    m = np.asarray(mask) > 0
    wing, stripe = np.asarray(layers['wing']) > 0, np.asarray(layers['stripe']) > 0
    canopy, engine = np.asarray(layers['canopy']) > 0, np.asarray(layers['engine']) > 0
    out = np.zeros((16, 24, 4), np.uint8)
    accent = rgb(spec['accent'])
    for x in range(24):
        col = np.where(m[:8, x])[0]
        top = col.min() if len(col) else 0
        for y in range(16):
            if not m[y, x]: continue
            # Top-lit: the upper edge is brightest, then it falls off with depth; the lower half sits in shade.
            if y < 8:
                depth = y - top
                tone = 3 if depth == 0 else 2 if depth <= 2 else 1
            else:
                tone = 1 if y <= 10 else 0
            c = HULL[tone]
            if wing[y, x] and y < 8: c = HULL[min(3, tone + 1)] if depth > 0 else HULL[3]
            if stripe[y, x]: c = accent if y < 8 else tuple(int(v * .6) for v in accent)
            if engine[y, x]: c = HULL[0]
            if canopy[y, x]: c = CANOPY if y < 8 else tuple(int(v * .6) for v in CANOPY)
            out[y, x] = (*c, 255)
    return Image.fromarray(out, 'RGBA')


def outlined(im):
    out = np.asarray(im).copy()
    m = out[..., 3] > 0
    pad = np.pad(m, 1)
    for y in range(out.shape[0]):
        for x in range(out.shape[1]):
            if m[y, x]: continue
            if pad[y, x + 1] or pad[y + 2, x + 1] or pad[y + 1, x] or pad[y + 1, x + 2]:
                out[y, x] = (*OUTLINE, 255)
    return Image.fromarray(out, 'RGBA')


def ship_sprite(spec):
    return outlined(ship_body(spec))


def aim_cell(body, direction):
    """One 32x32 cell: the hull rotated to `direction` (0..15), then outlined."""
    angle = direction * 22.5
    cell = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    cell.paste(body, (4, 8))
    if 90 < angle < 270: cell = cell.transpose(Image.FLIP_TOP_BOTTOM)
    cell = cell.rotate(-angle, resample=Image.NEAREST, center=(16, 16))
    return outlined(cell)
