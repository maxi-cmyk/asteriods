# Art inventory and conventions

Every shipped asset is original, and every image is regenerable from a script in
`../tools/`. Stock previews in `../../inspo/` were references only and never ship.

## What ships

| File | What it is | Rebuilt by |
| --- | --- | --- |
| `sprites.png` / `sprites.json` | Stock atlas: Vanguard ship (24×16 and 16 aiming cells), 72 rock cells, two pickups, 8 explosion frames (99 cells) | `tools/make-assets.py` (no dependencies) |
| `font.png` | Adafruit 5×8 bitmap font used by canvas text | `tools/make-assets.py` |
| `ships.png` / `ships.json` | Six Hangar hulls: 16 aiming cells and a 24×16 icon each | `tools/make-ships.py` (Pillow, NumPy) |
| `worlds.png` / `worlds.json` | Region scenery: 16 rotation frames per world plus a static Sagittarius A* | `tools/make-worlds.py` (Pillow, NumPy) |
| `home-scene.png` | Home backdrop (nebula, gas giant, lit rocks) | `tools/make-home-scene.py` (Pillow, NumPy) |
| `ui/` | HUD glyphs (bolt, shield, 2×), selection chevron, ship-life icon | hand-authored 7×7 pixel grids |
| `fonts/` | Jersey 10 (display) and Pixelify Sans (body), SIL OFL, with licence texts | Google Fonts |

Procedural, no image: region skies, nebulae and stars (`backgrounds.mjs`), explosions,
glows and the Sentinel finale (`fx.mjs`), Home overlay and launch warp
(`presentation.mjs`), ship re-lighting (`art-grade.mjs`).

## Regions

| Waves | Region | Scenery |
| --- | --- | --- |
| 1–5 | Celestial frontier | storm giant, two cratered moons, low ridge |
| 6–10 | Violet orbit | ringed ice giant, ice moon |
| 11–15 | Ember orbit | lava world, hot Jupiter, two drifting terrain layers |
| 16–20 | Ruined moon | large cratered moon, ruined skyline |
| 21–25 | Lunar passage | ocean world, ice moon, small moon |
| 26+ | Outer rift | Sagittarius A* with four slowly orbiting stars |

Worlds turn once every 2 to 5 minutes by crossfading frames; reduced motion holds
frame 0. Region ids, wave ranges, transitions and fallback colours are in
`../regions.mjs`.

## Conventions

- Native grid 480×270, drawn at integer scale with nearest-neighbour filtering.
- Light comes from the upper left, in every sprite and background.
- Colour is posterised with 4×4 ordered dither; no smoothed gradients except
  additive glows.
- Layer order, back to front: sky and nebula, far stars, near stars, scenery,
  a violet gameplay dim of 20%, then sprites, bullets, pickups and warnings.
- Region drift runs right to left, like the asteroids. Nothing streaks upward.
- If a region's scenery cannot load or build, its sky, nebula and stars still draw
  and play continues.
- The five region transitions (orbital pass, atmospheric sweep, skyline emergence,
  cloud clearance, ring convergence) run below the sprites with static fallbacks;
  `../assets.html` has synthetic midpoint fixtures.
- The Sentinel boss is code-native geometry; it does not replace any sprite or
  collision shape.
