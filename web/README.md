# Asteroids — pixel flight

The web version uses a 480×270 playfield with smaller, detailed pixel sprites,
a limited colour palette, and a compact HUD outside the movement area. The
original gameplay C++ still runs through WebAssembly. Web-only configuration
sets world geometry; the ESP32 source configuration stays unchanged.

## Run locally

Requires Node.js, Clang with WebAssembly support, and `wasm-ld`.
On macOS: `brew install llvm lld`.

```sh
cd web
npm run build
npm start
```

Open http://127.0.0.1:4173. Use http://127.0.0.1:4173/assets.html to inspect
the comparison scene and sprite atlas. No npm dependencies or install step
are needed. `PORT=8080 npm start` selects another port. Rebuild after editing
firmware or browser source. Use localhost or HTTPS for controller support.
Set `CLANGXX` and `WASM_LD` to use another compatible toolchain.

## Art and rendering

`renderer.mjs` reads a versioned scene buffer exported by `native/bridge.cpp`.
It renders entity state directly; it does not enlarge the old OLED framebuffer.
`assets/sprites.png` and `assets/sprites.json` contain 105 original sprite cells:

| Asset | Native size | Animation / variation |
| --- | --- | --- |
| Ship | 24×16 core, 32×32 aiming cells | Sixteen aiming directions; pixel exhaust |
| Large / medium / small rock | 32×32 / 20×20 / 12×12 | Three variants, eight rotation frames each |
| Multishot / shield pickup | 12×12 | Different symbols and colours |
| Bullet | 6×2 | Amber normal / cyan powered |
| Explosion | 32×32 | Eight frames over 320 ms |

The palette uses light hulls, blue-grey rock, cyan shields and powered shots,
and amber impacts. Stars remain dim. Art references and provenance
are in [assets/README.md](assets/README.md). No third-party pack sprites are
copied. The classic Adafruit font retains its existing attribution.

Regenerate the PNG atlas from its authored source with:

```sh
python3 web/tools/make-assets.py  # From repository root
```

Canvas disables smoothing and fills the game frame with nearest-neighbour
scaling. The frame spans the panel width; fullscreen fits the largest 16:9
frame around the HUD and controls. Its visible edges are the playfield edges.
Pause freezes stars, exhaust, rotation, pickups, and impact animation.

## Web world and gameplay

`native/config.h` loads the original configuration, then applies overrides
only for `WEB_HD`. The default browser build defines this flag. The world is
480×270 with a seven-pixel ship collision radius and asteroid radii 16/10/6.
The ship's central body is collidable; wing/nose tips and exhaust are forgiving
decoration. Movement bounds reserve the rotated hull, shield ring, and indicators. Rock collision circles bound the visible irregular sprites.

Movement is 3.65625 px/update: 25% below the initial HD response of 4.875.
The multiplier applies to analog and digital movement after normalization,
including diagonals, without changing the deadzone or initials navigation.
Bullets remain 18.75 px/update with the previous multishot angle. Wave
speed/drift and pickup drift retain their 3.75× OLED scale, approximately
preserving crossing time as screen width grows. All simulation updates remain 20 ms. Extra world height
and smaller relative collision sizes change available dodge space; balance
still needs hands-on playtesting.

Primary fire has no heat, overheating, firing cooldown, or movement penalty.
One shot per press and the 12-bullet pool still apply. Browser combat adds
aimed weapons and manual shield activation. Its laser destroys every target
it hits without splitting, with a 3-second windup and 7-second cooldown.
The HUD exposes laser charge/cooldown, shield state, and precision movement.
See [COMBAT.md](COMBAT.md) for exact ability rules.

## Controls

| Action | PS4 / standard-mapped gamepad | Keyboard / mouse |
| --- | --- | --- |
| Move / initials | Left stick or D-pad | Arrows or WASD |
| Aim weapons | Right stick | Mouse movement or IJKL |
| Primary fire / confirm | R2 or Cross | Space or Enter |
| Charge laser | Hold L2 for 3 seconds | Hold F |
| Precision movement | Hold R1 + L1 together | Hold Shift |
| Arm stored shield | Tap L1 alone (activates on release) | Tap Q alone |
| Pause / resume | Options | Escape or P |
| Original double-click pause | Double-click L3 | Double-tap C |

Connect by USB or Bluetooth, focus the game, and press a controller button.
Standard mapping is checked before accepting input. Unmapped devices show a
keyboard fallback message. Axes retain the firmware deadzone and normalization;
fire retains its 20 ms press/release debounce. Holding never repeats. Losing
focus or disconnecting the active controller pauses a live run. Sound starts
muted and uses the original buzzer frequency sequences via Web Audio.

## Scores and storage

The exact versioned 42-byte leaderboard format is unchanged. The HD game uses
`asteroids.web.hd.scores-v3` in localStorage, preserving the original clone's
scores under `asteroids.web.scores-v3` and all ESP32 storage. A separate table
avoids mixing scores earned with different geometry. Clearing browser data
removes browser scores. Failed writes retain the original retry flow.

## Verification and baseline

```sh
npm test
# From the repository root:
sh tests/run_host.sh
```

The test command builds both the original 128×64 WASM baseline and the HD
variant. Twenty-eight integration checks cover existing game flow, controller input,
rapid fire, multishot, shield, persistence, and new world bounds, native sprite sizes,
projectile origins, collision radii, scaled wave speed, entrance timing,
paused scene/animation data, leaderboard isolation, actual aimed bullet paths,
laser timing/cancellation/penetration, shield storage/activation, chord
suppression, and death/respawn cooldown behavior.

The original raster adapter and attributed GFX primitives remain for baseline
regression tests. `node build.mjs --oled` can build that core separately;
the browser UI now expects the HD scene renderer. Scenario exports are only
in test binaries, which the preview server refuses to serve.

Safari was checked for startup/countdown, live pixel gameplay, pause, connected
DualShock 4 detection, and a 390-pixel responsive layout. The comparison page
was checked visually. The combat build was observed running with the laser
cooldown and shield/precision indicators visible. These checks do not establish physical controller feel,
audio acoustics, or game balance. RNG uses browser cryptographic randomness
with the same rejection sampling; individual runs differ from the ESP32.

## Flight improvements

- Mouse movement aims continuously; left click fires one shot, and right click
  charges the laser. Pointer capture keeps releases reliable outside the canvas;
  focus loss clears held inputs. Keyboard and controller alternatives remain.
- Laser charging has a rising tone, discharge has a falling burst, and cooldown
  completion produces a ready chime and an in-world message. Enable sound or
  adjust volume to hear these cues. Laser readiness and shield state sit beside
  the ship as well as in the HUD.
- Shared waves unlock alternating lanes at wave 4, pairs at wave 8, and
  three-lane clusters at wave 12. Starting at wave 6, every fourth entrance is
  a small rock moving at 1.45× the wave speed. All members receive at least
  700 ms warning, with a FAST label for small rocks. ESP32 uses the same schedule
  and a double-line warning for fast rocks. Blocked entrances retain their
  announced lane and size and retry without consuming the pending rock.
- Run results report wave reached, active survival time, asteroids destroyed
  (including individually destroyed fragments), peak multiplier, and personal
  best against the leaderboard's best score at the start of the run. Pause and
  death animation do not add survival time; respawns retain run totals.
- Settings pause gameplay and save volume, deadzone, aim response, shake, key
  bindings, and controller ability buttons in `asteroids.web.settings-v1`.
  Aim response limits angular turning speed, without changing movement speed.
  Reassigning an occupied binding swaps it with the previous binding. Arrows,
  Enter and Escape remain navigation alternatives. If storage is blocked,
  settings work for the current visit and display a clear persistence message.
- Practice starts from the menu: unlimited lives, stationary targets that
  replenish after clearance, replenishing shield inventory, a multishot trial,
  target reset, and five skill goals. Practice cannot enter initials or write
  leaderboard scores. End practice returns to the menu; a normal run resets
  the practice score and effects.

Feature checks run with `npm test`: settings validation/persistence, quick mouse
clicks, remapping, configurable deadzones/aim response, practice isolation,
actual destruction counts, multiplier peaks, and laser audio event timing.
