# Pixel assets

`sprites.png` is an original, palette-limited sprite atlas for this project (99 cells).
`sprites.json` records exact cell bounds. `../tools/make-assets.py` is its
reproducible source; run `python3 web/tools/make-assets.py` from the repo root.

The art direction draws inspiration from these references; no sprites from
these packs were copied or redistributed:

- Ansimuz, Warped Space Shooter: https://ansimuz.itch.io/warped-space-shooter
- Kenney, Pixel Shmup: https://kenney.nl/assets/pixel-shmup
- Gustavo Vituri, Space Shooter: https://gvituri.itch.io/space-shooter
- Deep-Fold, Pixel Planet Generator: https://deep-fold.itch.io/pixel-planet-generator

`font.png` contains the same classic bitmap font as the OLED version, from
Adafruit GFX Library 1.12.5. See `../vendor/LICENSE.txt` and the distributed
`THIRD-PARTY-LICENSE.txt`. The font has not been redrawn by this project.

Native sizes: ship 24×16, plus sixteen 32×32 aiming frames; rocks 32×32, 20×20, 12×12 with three variants and
eight rotation frames each; pickups 12×12; explosions 32×32. Bullets and exhaust are drawn in code.
All sprites have transparent backgrounds. Colours: light hull, blue-grey rock,
cyan shield/multishot fire, amber heat/fire/explosions. Light comes from above
and left. Exhaust and explosion animation are decorative, without hitboxes.

`fonts/` holds Jersey 10 (display: logo, headings, score, menus) and Pixelify Sans
(body and reading text), both SIL Open Font License 1.1, as Latin-subset WOFF2
from Google Fonts. The license texts are alongside (`OFL-*.txt`) and ship in
`dist/assets/fonts/`. Characters outside Latin (for example arrows) fall back to
the system font.

Background art for each five-wave region is original and procedural; see `ART.md`.

See [ART.md](ART.md) for the full inventory of shipped images and the script that rebuilds each.

## Previews: seeing every asset

Everything ships to a static page set, so any preview is one command away. From the
repo root:

```sh
cd web && npm run build && npm start       # then open http://127.0.0.1:4173/
```

| What | Where |
| --- | --- |
| The game | `/` (Home → Practice → Pause → **Boss practice** fights any boss or mini-boss at any tier, starting in any phase) |
| Every shipped image: sprite atlas, Hangar hulls, world strips (incl. the tier 3+ quasi-star, pulsar and magnetar), boss sheets, HUD glyphs, region transition fixtures | `/assets.html` (also **Developer tools → Pixel assets** in the app) |
| Every boss and mini-boss attack with its warning and answer, buttons that play the charge and release sounds, and a replayable **defeat sequence** for all twelve | `/boss-attacks.html` (linked from `/assets.html`) |
| Ships | **Hangar** in the app, with a live stage and locked states |
| Regions and scenery in play | Practice shows the opening region; a normal run travels all six. Boss practice tier IV shows the tier 3+ backdrops |
| Sounds | `/boss-attacks.html` for the boss sound design; the rest play in the game itself (turn Sound on) |

To regenerate art: `web/tools/make-*.py` (see `ART.md`); the Python scripts need
`python3 -m venv v && v/bin/pip install pillow numpy fonttools brotli`.
