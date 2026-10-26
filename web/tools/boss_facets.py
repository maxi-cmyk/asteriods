"""Facet painter for the boss sprites: the look of the boss-destroyed draft
(web/assets/screenshots/design-draft-boss.png). Chunky blocks (one logical pixel is Q
screen pixels), flat low-poly facets in four or five flat shades, no gradients and
no fine dither, a dark silhouette, an amber rim where the light catches an edge, and
a sprinkle of single-block speckle for texture. Light comes from the upper left.
"""
import math
import numpy as np
from PIL import Image, ImageDraw

Q = 4
LIGHT = np.array([-.55, -.8]) / np.hypot(.55, .8)
INK = (14, 8, 28)
RIM = (240, 168, 72)


def hexc(value):
    value = value.lstrip('#')
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def pal(*hexes):
    return [hexc(h) for h in hexes]


# five shades, dark to light
STEEL = pal('#14102c', '#2a2460', '#4a4a9c', '#8a8ad8', '#dcdcff')
VIOLET = pal('#10082a', '#2a1660', '#5a36a8', '#9a70e0', '#d8c0ff')
BONE = pal('#1a1228', '#3a2a52', '#7a5a78', '#d9a97a', '#f6e0b8')       # the draft's own shards
ICE = pal('#10164a', '#2a3c9c', '#5a8ae0', '#a4d4ff', '#f0fcff')
FIRE = pal('#4a0a08', '#b01c10', '#f0541c', '#ffa830', '#fff0b0')
CHAR = pal('#0a0610', '#201418', '#443034', '#7a564c', '#b88a70')
GUN = pal('#0c0e1c', '#1c2440', '#34447a', '#5e74b0', '#a4bce8')
TEAL = pal('#04202c', '#0c4a62', '#1c88a0', '#58cce0', '#c8fcff')
MAG = pal('#2a0828', '#6a1060', '#b4249c', '#f060cc', '#ffc8f4')
VOID = pal('#04020a', '#0c0618', '#1c1038', '#341e68', '#5a3aa8')
HALO = pal('#3a0a00', '#a02a08', '#e0580c', '#ffa024', '#fff2c0')


def lit(nx, ny, bias=0.0):
    """Shade 0..4 for a facet whose outward normal points along (nx, ny)."""
    n = math.hypot(nx, ny) or 1
    v = (nx * LIGHT[0] + ny * LIGHT[1]) / n
    return int(np.clip(round(2 + 2.2 * v + bias), 0, 4))


class Canvas:
    def __init__(self, width, height, q=Q, seed=1):
        self.q, self.w, self.h = q, width, height
        self.lw, self.lh = (width + q - 1) // q, (height + q - 1) // q
        self.px = np.zeros((self.lh, self.lw, 4), np.uint8)
        self.rng = np.random.default_rng(seed)
        self.clip = None

    # -------------------------------------------------------------- masks
    def mask(self, pts):
        m = Image.new('L', (self.lw, self.lh), 0)
        ImageDraw.Draw(m).polygon([(x / self.q, y / self.q) for x, y in pts], fill=255)
        out = np.asarray(m) > 127
        return out if self.clip is None else out & self.clip

    def disc(self, cx, cy, rx, ry=None, n=24, rot=0.0):
        ry = rx if ry is None else ry
        return [(cx + math.cos(rot + i * math.tau / n) * rx, cy + math.sin(rot + i * math.tau / n) * ry) for i in range(n)]

    # -------------------------------------------------------------- drawing
    def facet(self, pts, palette, shade, speckle=.1):
        """One flat facet; `speckle` is the share of blocks dropped a shade (and a few lifted)."""
        m = self.mask(pts)
        if not m.any():
            return m
        shade = int(np.clip(shade, 0, len(palette) - 1))
        colours = np.empty((self.lh, self.lw), np.int8)
        colours[:] = shade
        if speckle:
            roll = self.rng.random((self.lh, self.lw))
            colours = np.where(roll < speckle, max(0, shade - 1), colours)
        table = np.array(palette, np.uint8)
        self.px[m, :3] = table[colours[m]]
        self.px[m, 3] = 255
        return m

    def poly_lit(self, pts, palette, bias=0.0, speckle=.1, centre=None):
        """A facet shaded by its own outward direction from `centre` (or its edge normal)."""
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)
        if centre is None:
            # flat polygon: use the direction of its longest edge's normal toward outside the centroid of all pts
            nx, ny = 0.0, -1.0
        else:
            nx, ny = cx - centre[0], cy - centre[1]
        return self.facet(pts, palette, lit(nx, ny, bias), speckle)

    def px_block(self, x, y, colour, w=1, h=1):
        """A single logical block at screen coordinates (x, y)."""
        lx, ly = int(x / self.q), int(y / self.q)
        for j in range(h):
            for i in range(w):
                if 0 <= lx + i < self.lw and 0 <= ly + j < self.lh and (self.clip is None or self.clip[ly + j, lx + i]):
                    self.px[ly + j, lx + i, :3] = colour
                    self.px[ly + j, lx + i, 3] = 255

    def line(self, pts, colour, width=1):
        m = Image.new('L', (self.lw, self.lh), 0)
        ImageDraw.Draw(m).line([(x / self.q, y / self.q) for x, y in pts], fill=255, width=width)
        arr = np.asarray(m) > 127
        if self.clip is not None:
            arr &= self.clip
        self.px[arr, :3] = colour
        self.px[arr, 3] = 255

    def solid(self):
        return self.px[..., 3] > 0

    # -------------------------------------------------------------- finishing
    def finish(self, outline=True, rim=True):
        a = self.solid()
        if rim:
            # amber where the light grazes the silhouette (upper-left edges), broken up
            up = np.zeros_like(a); up[1:] = a[:-1]
            left = np.zeros_like(a); left[:, 1:] = a[:, :-1]
            edge = a & (~up | ~left)
            pick = edge & (self.rng.random(a.shape) < .75)
            self.px[pick, :3] = RIM
            # and a dark underside on the lower-right edges
            down = np.zeros_like(a); down[:-1] = a[1:]
            right = np.zeros_like(a); right[:, :-1] = a[:, 1:]
            shade = a & (~down | ~right) & ~pick
            self.px[shade, :3] = (self.px[shade, :3] * .55).astype(np.uint8)
        if outline:
            grown = a.copy()
            grown[1:] |= a[:-1]; grown[:-1] |= a[1:]; grown[:, 1:] |= a[:, :-1]; grown[:, :-1] |= a[:, 1:]
            ring = grown & ~a
            self.px[ring, :3] = INK
            self.px[ring, 3] = 255
        img = Image.fromarray(self.px, 'RGBA').resize((self.lw * self.q, self.lh * self.q), Image.NEAREST)
        return img.crop((0, 0, self.w, self.h))


# ------------------------------------------------------------------ shared shapes
def spike_facets(c, cx, cy, n, r0, r1, half, palette, rot=0.0, bias=0.0):
    """Spikes as two triangles each, split down the axis: one catches the light."""
    for k in range(n):
        a = rot + k * math.tau / n
        base_l = (cx + math.cos(a - half) * r0, cy + math.sin(a - half) * r0)
        base_r = (cx + math.cos(a + half) * r0, cy + math.sin(a + half) * r0)
        mid = (cx + math.cos(a) * r0 * .92, cy + math.sin(a) * r0 * .92)
        tip = (cx + math.cos(a) * r1, cy + math.sin(a) * r1)
        # normals of the two half-faces
        left_n = (math.cos(a - math.pi / 2) + math.cos(a) * .4, math.sin(a - math.pi / 2) + math.sin(a) * .4)
        right_n = (math.cos(a + math.pi / 2) + math.cos(a) * .4, math.sin(a + math.pi / 2) + math.sin(a) * .4)
        c.facet([base_l, mid, tip], palette, lit(*left_n, bias), .06)
        c.facet([mid, base_r, tip], palette, lit(*right_n, bias), .06)


def dome_facets(c, cx, cy, radius, rings, segments, palette, rot=0.0, jitter=.0, seed=3, bias=0.0, skip=None):
    """A low-poly dome seen face-on: concentric rings of quads around a fan of triangles."""
    rng = np.random.default_rng(seed)
    radii = [radius * (i / rings) for i in range(rings + 1)]
    verts = []
    for ri, r in enumerate(radii):
        ring = []
        for si in range(segments):
            a = rot + si * math.tau / segments + (rng.random() - .5) * jitter * (ri > 0)
            rr = r * (1 + (rng.random() - .5) * jitter * .5 * (0 < ri < rings))
            ring.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
        verts.append(ring)
    for ri in range(rings):
        for si in range(segments):
            sj = (si + 1) % segments
            a, b = verts[ri][si], verts[ri][sj]
            d, e = verts[ri + 1][si], verts[ri + 1][sj]
            mid = (cx + (a[0] + b[0] + d[0] + e[0]) / 4 - cx, cy + (a[1] + b[1] + d[1] + e[1]) / 4 - cy)
            shade_bias = bias - (ri / rings) * .9 + .25          # edges fall off, the crown catches light
            if skip and skip(ri, si):
                continue
            pts = [a, d, e, b] if ri else [a, d, e]
            tilt = (mid[0] - cx, mid[1] - cy)
            nx, ny = tilt[0] / max(radius, 1) * 1.2, tilt[1] / max(radius, 1) * 1.2
            c.facet(pts, palette, lit(nx, ny, shade_bias), .1)
    return verts
