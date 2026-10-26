"""Builds web/assets/bosses/*.png and *.json: the sprites of the six region bosses and
six mini-bosses, one sheet per region (loaded when that region is first reached), plus
a shared sheet of hostile projectiles.

Needs Pillow + NumPy (fontTools and brotli are only used by the concept sheets):
    python3 -m venv v && v/bin/pip install pillow numpy fonttools brotli
    v/bin/python web/tools/make-bosses.py

Every sprite is drawn in the game's 8-bit style (one 1 px grid, six-shade palettes,
ordered dither, hard alpha, 2 px outline); see boss_art.py. Each cell is cropped to
its opaque pixels and records where it sits in the original frame (ox, oy inside
W x H), so the renderer places a frame by the body's centre. Damage is two overlay
cells per boss (cracked, critical) drawn over any frame.
"""
import json
import math
import random
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from boss_sprites import *  # noqa: F401,F403,E402

OUT = Path(__file__).resolve().parents[1] / 'assets' / 'bosses'
SHEET_WIDTH = 1024
SECTION = {'frontier': 'frontier', 'violet': 'violet', 'ember': 'ember', 'ruins': 'ruins', 'lunar': 'lunar', 'rift': 'rift'}


class Sheet:
    """Shelf-packs cropped cells and remembers their frame geometry."""
    def __init__(self):
        self.cells = []

    def add(self, name, img):
        img = img.convert('RGBA')
        box = img.getchannel('A').point(lambda v: 255 if v else 0).getbbox()
        if box is None:
            box = (0, 0, 1, 1)
        self.cells.append((name, img.crop(box), box[0], box[1], img.width, img.height))

    def save(self, stem):
        x = y = shelf = 0
        placed = []
        for name, crop, ox, oy, W, H in sorted(self.cells, key=lambda c: -c[1].height):
            if x + crop.width + 1 > SHEET_WIDTH:
                x, y, shelf = 0, y + shelf + 1, 0
            placed.append((name, crop, x, y, ox, oy, W, H))
            x += crop.width + 1
            shelf = max(shelf, crop.height)
        height = y + shelf + 1
        sheet = Image.new('RGBA', (SHEET_WIDTH, height), (0, 0, 0, 0))
        meta = {}
        for name, crop, px, py, ox, oy, W, H in placed:
            sheet.paste(crop, (px, py))
            meta[name] = {'x': px, 'y': py, 'w': crop.width, 'h': crop.height, 'ox': ox, 'oy': oy, 'W': W, 'H': H}
        OUT.mkdir(parents=True, exist_ok=True)
        sheet.save(OUT / f'{stem}.png', optimize=True)
        (OUT / f'{stem}.json').write_text(json.dumps(meta, sort_keys=True, separators=(',', ':')))
        return sheet.size


def alpha(img):
    return np.asarray(img)[..., 3] > 0


def overlay(size, frames, level, seed, q=4):
    """Cracks (level 1) and cracks, scorch and glowing fissures (level 2) on the same
    chunky grid as the sprites, clipped to the pixels every frame shares so the damage
    never floats off a moving plate."""
    W, H = size
    lw, lh = (W + q - 1) // q, (H + q - 1) // q
    mask = np.ones((lh, lw), bool)
    for f in frames:
        sample = alpha(f)[q // 2::q, q // 2::q][:lh, :lw]
        mask &= np.pad(sample, ((0, lh - sample.shape[0]), (0, lw - sample.shape[1])))
    mask = erode(mask, 1)
    out = np.zeros((lh, lw, 4), np.uint8)
    if mask.any():
        rng = random.Random(seed)
        ys, xs = np.nonzero(mask)
        scale = max(W, H) / 220
        img = Image.new('L', (lw, lh), 0)
        glow = Image.new('L', (lw, lh), 0)
        d, g = ImageDraw.Draw(img), ImageDraw.Draw(glow)
        for _ in range(int((5 if level == 1 else 10) * max(.6, scale))):
            i = rng.randrange(len(xs))
            x, y, ang = float(xs[i]), float(ys[i]), rng.random() * math.tau
            pts = [(x, y)]
            for _ in range(rng.randint(4, 9)):
                ang += rng.uniform(-.8, .8)
                step = rng.uniform(1.5, 3.2)
                x += math.cos(ang) * step
                y += math.sin(ang) * step
                pts.append((x, y))
            d.line(pts, fill=255, width=1)
            g.line([(px + 1, py + 1) for px, py in pts], fill=255, width=1)
        crack, fissure = np.asarray(img) > 0, np.asarray(glow) > 0
        out[crack, :3] = INK
        out[crack, 3] = 255
        if level == 2:
            lit_ = fissure & ~crack
            out[lit_, :3] = (255, 140, 40)
            out[lit_, 3] = 255
            gy, gx = np.mgrid[0:lh, 0:lw]
            for _ in range(int(4 * max(.6, scale))):
                i = rng.randrange(len(xs))
                blot = (np.hypot(gx - xs[i], gy - ys[i]) < rng.uniform(2, 4)) & ((gx + gy) % 2 == 0) & (out[..., 3] == 0)
                out[blot, :3] = (24, 12, 16)
                out[blot, 3] = 255
        out[~mask] = 0
    return Image.fromarray(out, 'RGBA').resize((lw * q, lh * q), Image.NEAREST).crop((0, 0, W, H))


def with_damage(sheet, stem, frames, size, seed):
    for level in (1, 2):
        sheet.add(f'{stem}-d{level}', overlay(size, frames, level, seed + level))


# ------------------------------------------------------------------ region sheets
def frontier():
    sh = Sheet()
    sent = [sentinel(o, 0) for o in (0, 1 / 3, 2 / 3, 1)]
    for i, im in enumerate(sent):
        sh.add(f'sentinel-{i}', im)
    sh.add('sentinel-glow', sentinel(1, 1))
    sh.add('sentinel-bare', sentinel(1, 1, bare=True))
    for k in range(4):
        sh.add(f'sentinel-plate-{k}', sentinel(0, 0, only=k))
    with_damage(sh, 'sentinel', [sent[0], sent[3]], (220, 220), 10)
    pick = [picket_gate(o, 0) for o in (0, .5, 1)]
    for i, im in enumerate(pick):
        sh.add(f'picket-{i}', im)
    with_damage(sh, 'picket', pick, (150, 150), 20)
    return sh


def violet():
    sh = Sheet()
    cores = [ringwarden_core(0), ringwarden_core(1)]
    for i, im in enumerate(cores):
        sh.add(f'ringwarden-core-{i}', im)
    with_damage(sh, 'ringwarden', cores, (150, 150), 30)
    for k in range(16):
        sh.add(f'blade-outer-{k}', ice_blade(k, 42, 15, 100))
        sh.add(f'blade-inner-{k}', ice_blade(k, 32, 13, 80))
    cores = [shardling_core(0), shardling_core(1)]
    for i, im in enumerate(cores):
        sh.add(f'shardling-{i}', im)
    with_damage(sh, 'shardling', cores, (110, 110), 40)
    return sh


def ember():
    sh = Sheet()
    forge = [cinderforge(core=c) for c in (.35, .65, .95)]
    for i, im in enumerate(forge):
        sh.add(f'forge-{i}', im)
    with_damage(sh, 'forge', forge, (300, 300), 50)
    sh.add('panel-0', forge_panel(0))
    for state in (1, 2):
        for frame in (0, 1):
            sh.add(f'panel-{state}{"ab"[frame]}', forge_panel(state, frame))
    ling = [cinderling(.4), cinderling(.9, open_cells=[(1, 1), (2, 1), (1, 2), (2, 2)])]
    for i, im in enumerate(ling):
        sh.add(f'cinderling-{i}', im)
    with_damage(sh, 'cinderling', ling, (150, 150), 60)
    return sh


def ruins():
    sh = Sheet()
    layers = bastion_layers()
    for name, im in layers.items():
        sh.add(f'bastion-{name.replace("_", "-")}', im)
    with_damage(sh, 'bastion', [layers['hull']], (340, 196), 70)
    gun = [gunnery_hull(0), gunnery_hull(1)]
    for i, im in enumerate(gun):
        sh.add(f'gunnery-{i}', im)
    with_damage(sh, 'gunnery', gun, (200, 108), 80)
    return sh


def lunar():
    sh = Sheet()
    tide = {}
    for k in range(4):
        for g in (0, 1):
            tide[(k, g)] = tidecaller(phase=k * math.tau / 2.2 / 4, bubbles=0, glow=g)
            sh.add(f'tide-{k}-{g}', tide[(k, g)])
    with_damage(sh, 'tide', list(tide.values())[:4], (230, 290), 90)
    jelly = [moonjelly(phase=k * math.tau / 2.2 / 4) for k in range(4)]
    for k, im in enumerate(jelly):
        sh.add(f'moonjelly-{k}', im)
    with_damage(sh, 'moonjelly', jelly, (150, 190), 100)
    return sh


def rift():
    sh = Sheet()
    war = [warden(glow=g, orbits=False) for g in (0, 1)]
    for i, im in enumerate(war):
        sh.add(f'warden-{i}', im)
    with_damage(sh, 'warden', war, (330, 330), 110)
    imp = [lensimp(glow=g, orbits=False) for g in (0, 1)]
    for i, im in enumerate(imp):
        sh.add(f'lensimp-{i}', im)
    with_damage(sh, 'lensimp', imp, (170, 170), 120)
    for i, rgb in enumerate([(154, 208, 255), (255, 233, 160), (255, 176, 112), (255, 255, 255)]):
        sh.add(f'star-{i}', star_sprite(rgb))
    return sh


# ------------------------------------------------------------------ projectiles
def shots():
    sh = Sheet()

    def canvas(n):
        return Image.new('RGBA', (n, n), (0, 0, 0, 0))

    def draw(kind, n, t=0):
        im = canvas(n)
        projectile(im, n // 2, n // 2, kind, t)
        return im
    sh.add('needle', draw('needle', 9))
    sh.add('shard', draw('shard', 11))
    sh.add('bolt', draw('bolt', 15))
    sh.add('sine', draw('sine', 13))
    sh.add('pellet', draw('spiral', 9))
    sh.add('missile', draw('missile', 17))
    sh.add('mine-0', draw('mine', 19, 0))
    sh.add('mine-1', draw('mine', 19, 1 / 6))
    sh.add('lob-0', draw('lob', 15))
    sh.add('bubble', draw('bubble', 36))
    # fast shards: a longer, brighter diamond so the aim line reads
    f = canvas(15); d = ImageDraw.Draw(f)
    d.polygon([(1, 7), (7, 4), (13, 7), (7, 10)], fill=INK + (255,))
    d.polygon([(3, 7), (7, 5), (11, 7), (7, 9)], fill=(255, 220, 190, 255)); d.point((7, 7), fill=(255, 255, 255, 255))
    sh.add('fast', f)
    for i, rgb in enumerate([(255, 140, 70), (255, 214, 120)]):               # embers, two flicker frames
        e = canvas(9); d = ImageDraw.Draw(e)
        d.ellipse((1, 1, 7, 7), fill=INK + (255,)); d.ellipse((2, 2, 6, 6), fill=rgb + (255,)); d.point((3, 3), fill=(255, 250, 220, 255))
        sh.add(f'ember-{i}', e)
    c = canvas(11); d = ImageDraw.Draw(c)
    d.ellipse((0, 0, 10, 10), fill=INK + (255,)); d.ellipse((1, 1, 9, 9), fill=(255, 120, 230, 255)); d.ellipse((2, 2, 4, 4), fill=(255, 255, 255, 255))
    sh.add('curve', c)
    for frame in (0, 1):                                                      # spore cloud: dithered, white rim
        s = Px((42, 42)); cx = cy = 21
        s.fill(ellipse((42, 42), cx, cy, 18), P_TEAL, outline=(255, 255, 255), ow=1, radial=(cx, cy, 18), bias=.05 + .08 * frame, tex=.12 * np.sin(np.mgrid[0:42, 0:42][1] * .8 + frame * 2))
        for dx, dy in ((-6, -5), (5, -7), (-2, 5), (7, 4)):
            s.flat(ellipse((42, 42), cx + dx, cy + dy + frame, 3), (190, 255, 240))
        sh.add(f'spore-{frame}', s.img())
    for i in range(3):                                                        # bubble pop sparkles
        im = canvas(36); d = ImageDraw.Draw(im)
        r = 6 + i * 6
        for a in range(0, 360, 45):
            x = 18 + math.cos(math.radians(a)) * r; y = 18 + math.sin(math.radians(a)) * r
            d.rectangle((x - 1, y - 1, x, y), fill=(255, 255, 255, 255 - i * 70))
        sh.add(f'pop-{i}', im)
    return sh


def main():
    for stem, build in (('frontier', frontier), ('violet', violet), ('ember', ember), ('ruins', ruins),
                        ('lunar', lunar), ('rift', rift), ('shots', shots)):
        print(stem, build().save(stem))


if __name__ == '__main__':
    main()
