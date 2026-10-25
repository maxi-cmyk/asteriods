"""Builds assets/ships.png and ships.json: sixteen 32x32 aiming cells for each
Hangar hull, plus a 24x16 `icon` cell, laid out one hull per row.

Needs Pillow + NumPy; run from the repo root:
    v/bin/python web/tools/make-ships.py
The stock Vanguard hull lives in sprites.png and is not regenerated here.
"""
import json
import sys
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ships import SHIPS, NAMES, ship_body, outlined, aim_cell  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / 'assets'
COLUMNS = 17  # 16 aiming cells + the icon
atlas = Image.new('RGBA', (COLUMNS * 32, len(SHIPS) * 32), (0, 0, 0, 0))
cells = {}
for row, (hull, spec) in enumerate(SHIPS.items()):
    body = ship_body(spec)
    for direction in range(16):
        atlas.paste(aim_cell(body, direction), (direction * 32, row * 32))
        cells[f'hull-{hull}-aim-{direction}'] = dict(x=direction * 32, y=row * 32, w=32, h=32)
    atlas.paste(outlined(body), (16 * 32 + 4, row * 32 + 8))
    cells[f'hull-{hull}-icon'] = dict(x=16 * 32 + 4, y=row * 32 + 8, w=24, h=16)
atlas.save(OUT / 'ships.png', optimize=True)
meta = {'cells': cells, 'hulls': [dict(id=h, name=NAMES[h][0], blurb=NAMES[h][1], accent=s['accent']) for h, s in SHIPS.items()]}
(OUT / 'ships.json').write_text(json.dumps(meta, indent=1) + '\n')
print('wrote', OUT / 'ships.png', len(cells), 'cells')
