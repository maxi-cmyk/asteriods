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
