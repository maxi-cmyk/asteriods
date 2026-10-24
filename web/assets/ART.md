# Background art: inventory and conventions

## Inventory by role

Stock previews in `../../inspo/` remain inspiration only. Gameplay-region art
is original and procedural (`../backgrounds.mjs`). Home retains the previously
approved blue-moon poster derived from the supplied unwatermarked reference 03,
with independently drawn rays/particles in `../presentation.mjs`. Font licenses
are packaged alongside the font files.

| Role | Reference mood | Runtime art | Source |
| --- | --- | --- | --- |
| Home backdrop | 03 blue moons and warp | `home-scene.png` (existing) plus the animated overlay in `../presentation.mjs` | existing asset, code overlay |
| Waves 1–5 Celestial frontier | 06 | three small worlds, low dim ridge | `backgrounds.mjs` |
| Waves 6–10 Violet orbit | 09, 01 | banded gas giant, scrolling cloud bands | `backgrounds.mjs` |
| Waves 11–15 Ember orbit | 07 | red world, two drifting pink terrain layers | `backgrounds.mjs` |
| Waves 16–20 Ruined moon | 08 | pale cratered moon, low edge-weighted skyline | `backgrounds.mjs` |
| Waves 21–25 Lunar passage | 03 | two calm blue moons, dense stars | `backgrounds.mjs` |
| Waves 26+ Outer rift | 05 | black disc, animated accretion ring (no gravity or distortion) | `backgrounds.mjs` |
| Ship, asteroid, pickup, effect sprites | 02, 04 | unchanged (task 4E) | `sprites.png` |

## Conventions

- Native grid: 480×270, the gameplay playfield, drawn at integer scale with
  nearest-neighbour filtering. No stretching or cropping.
- Light comes from the upper left, as in the sprite atlas.
- Colour: each region uses a four- or five-step ramp per object and a
  four-step 4×4 Bayer dither for gradients and shading. No smoothed gradients.
- Layer order, back to front: gradient backdrop, far stars (1.6 px/s), near
  stars (4 px/s), scenery, optional animated layer, then a gameplay dim of 38%.
  Sprites, bullets, pickups, and warnings are drawn after all of it.
- Direction of drift is right to left, like the asteroids. Nothing upward or
  streaking that could read as a shot. Bright streaks stay on Home.
- Manifest: `../regions.mjs` records each region's id, name, wave range, entry
  transition and timing, and fallback colour. Layer bounds and anchors are
  constants in `backgrounds.mjs` (for example the Violet planet centre and the
  Rift ring centre). Motion loops are periodic, so they never visibly reset.
- Fallback: if a region fails to build, its flat fallback colour is shown and
  play continues.


All five destination transitions are implemented: orbital limb pass, atmospheric
sweep, skyline emergence, cloud clearance, and ring convergence. Each settles
with the same destination transform used by its idle scene. They run below the
existing sprites and spawn warnings, with static/reduced-motion fallbacks.
`assets.html` includes busy synthetic midpoint fixtures for visual inspection.
The sentinel is code-native pixel geometry with its own core/health telegraphs;
it does not replace or resize any player/asteroid sprite or collision shape.
