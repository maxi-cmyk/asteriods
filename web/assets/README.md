# Pixel assets

`sprites.png` is an original, palette-limited sprite atlas for this project.
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
eight rotation frames each; pickups 12×12; bullets 6×2; explosions 32×32.
All sprites have transparent backgrounds. Colours: light hull, blue-grey rock,
cyan shield/multishot fire, amber heat/fire/explosions. Light comes from above
and left. Exhaust and explosion animation are decorative, without hitboxes.
