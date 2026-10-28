# Asteroids — pixel flight

The web version uses a 480×270 playfield with smaller, detailed pixel sprites,
a limited colour palette, and a compact HUD outside the movement area. The
original gameplay C++ still runs through WebAssembly. Web-only configuration
sets world geometry; the ESP32 source configuration stays unchanged.

The web game targets laptop and desktop browsers with keyboard/mouse or
controllers. Mobile gameplay and touch controls are outside scope. Responsive
layouts accommodate resized desktop windows, browser zoom, and screen sizes.

## Run locally

Requires Node.js, Clang with WebAssembly support, and `wasm-ld`.
On macOS: `brew install llvm lld`.

```sh
cd web
npm run build
npm start
```

Open http://127.0.0.1:4173. Use http://127.0.0.1:4173/assets.html to inspect
the comparison scene and sprite atlas. The game has no runtime dependencies, so playing needs no install step (`npm install` adds the
development tools: Prettier, ESLint, PostCSS). `PORT=8080 npm start` selects another port. Rebuild after editing
firmware or browser source. Use localhost or HTTPS for controller support.
Set `CLANGXX` and `WASM_LD` to use another compatible toolchain.

## Development

[ARCHITECTURE.md](ARCHITECTURE.md) maps the source tree. From `web/`: `npm test` builds the test
engines and runs every suite; `npm run check` also runs Prettier and ESLint; `npm run format`
formats. Characterisation tests (`tests/*-golden.test.mjs`) pin the engine scene, the rendering
and the boss sound design; regenerate them with `UPDATE_GOLDEN=1` only for a deliberate change.

## Art and rendering

`src/render/renderer.mjs` reads a versioned scene buffer written by `native/scene.h` (see [ARCHITECTURE.md](ARCHITECTURE.md)).
It renders entity state directly; it does not enlarge the old OLED framebuffer.
`assets/sprites.png` and `assets/sprites.json` contain 99 original sprite cells:

| Asset | Native size | Animation / variation |
| --- | --- | --- |
| Ship | 24×16 core, 32×32 aiming cells | Sixteen aiming directions; exhaust drawn in code. Six more hulls in `ships.png` |
| Large / medium / small rock | 32×32 / 20×20 / 12×12 | Three variants, eight rotation frames each |
| Multishot / shield pickup | 12×12 | Different symbols and colours |
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
Bullets remain 18.75 px/update. Web multishot side shots are now about 8.6°
from aim (previously 17.5°), with equal speed and unchanged collision,
lifetime, and damage rules. At 100/300 pixels forward, each side shot is
about 15/46 pixels off center instead of 31/94. OLED spread stays unchanged. Wave
speed/drift and pickup drift retain their 3.75× OLED scale, approximately
preserving crossing time as screen width grows. All simulation updates remain 20 ms. Extra world height
and smaller relative collision sizes change available dodge space; balance
still needs hands-on playtesting.

Primary fire has no heat, overheating, firing cooldown, or movement penalty.
One event per press (two with the temporary 2× pickup) and the 12-bullet pool apply. Browser combat adds
aimed weapons and manual shield activation. Its laser destroys every target
it hits without splitting, with a 1.5-second windup and 5-second cooldown.
The HUD exposes laser charge/cooldown, shield state, and precision movement.
See [COMBAT.md](COMBAT.md) for exact ability rules.

## Controls

| Action | PS4 / standard-mapped gamepad | Keyboard / mouse |
| --- | --- | --- |
| Move / initials | Left stick or D-pad | Arrows or WASD |
| Aim weapons | Right stick | Mouse movement or IJKL |
| Primary fire / confirm | R2 or Cross | Space or Enter |
| Charge laser | Hold L2 for 1.5 seconds | Hold F |
| Precision movement | Hold R1 + L1 together | Hold Shift |
| Arm stored shield | Tap L1 alone (activates on release) | Tap Q alone |
| Pause / resume | Options | Escape or P |
| Original double-click pause | Double-click L3 | Double-tap C |

Connect by USB or Bluetooth, focus the game, and press a controller button.
Standard mapping is checked before accepting input. Unmapped devices show a
keyboard fallback message. Axes retain the firmware deadzone and normalization;
browser fire uses fresh press edges without mechanical debounce. Holding never repeats. Losing
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
variant. Integration checks cover existing game flow, controller input,
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
- Settings pause gameplay. Choose Player 1 or Player 2 to use an independent
  saved profile for input bindings, response, deadzone, volume, and shake.
  The selected profile persists too. This prepares profiles for multiplayer;
  only one profile controls the current single-player game.
- Mouse aim response is separate from controller/keyboard aim response. Both
  limit angular turning speed per 20 ms tick, from 0.25× to 2×. Existing
  single-response settings migrate to both values without losing bindings.
- Controller movement response (0.25×–2×) shapes partial stick deflection
  radially after the deadzone: output magnitude = input magnitude raised to
  `1 / response`. Higher responds sooner; full-stick speed is unchanged.
  Keyboard/D-pad movement is digital. Diagonals remain bounded and precision
  still halves movement speed. Mouse position sets aim rather than movement.
  Maths: the deadzone is *radial* (`radial()` in `src/input/controls.mjs`). It keeps the stick's
  direction and remaps its length, `(min(1, ‖v‖) − d)/(1 − d)`, so `[d, 1] → [0, 1]`; a per-axis
  deadzone would clip a square and bend diagonals towards the axes. The response curve is
  `v ↦ v·‖v‖^(1/s − 1)`. Both change only the magnitude, and `min(1, ‖v‖)` is a projection onto the
  unit disc. The aim-response limit clamps the angle difference per tick (`atan2(sin Δ, cos Δ)`
  wraps it); see `combat-docs/02`.
- Test your controls shows both sticks' raw/adjusted vectors and the deadzone.
  Sample stick drift measures two hands-off seconds, takes the largest radial
  deviation across both sticks, and adds three percentage points of margin
  (minimum 5%, maximum 45%). Movement above 40% or a disconnection rejects the
  sample. Use suggested deadzone selects the suggestion; Apply commits it.
- Focus the preview to try movement keys, mouse/keyboard aiming, and precision;
  controller sticks work while settings are open. The preview uses the same
  input transforms without advancing gameplay or firing weapons. No controller
  leaves sampling disabled; keyboard/mouse preview and manual tuning still work.
- Profiles use a version-2 envelope under the existing
  `asteroids.web.settings-v1` key. Legacy values migrate to Player 1; Player 2
  starts with defaults. Reset this profile leaves the other profile intact.
  Reassigning an occupied binding swaps it with the previous binding. Arrows,
  Enter and Escape remain navigation alternatives. Edits, profile selection,
  suggested deadzones, and resets remain pending until Apply. Close/Escape
  discards edits since the last Apply; the calibration preview uses the draft.
  If storage is blocked, Apply keeps settings for the visit and reports that
  they could not be saved. Sound toggling outside settings still saves directly.
- Practice starts from the menu: unlimited lives, stationary targets that
  replenish after clearance, replenishing shield inventory, a multishot trial,
  target reset, and five skill goals. Practice cannot enter initials or write
  leaderboard scores. End practice returns to the menu; a normal run resets
  the practice score and effects.

Feature checks run with `npm test`: settings validation/persistence, quick mouse
clicks, remapping, legacy profile migration, independent response settings,
drift sampling, actual bounded movement/precision, multishot spread/pool limits,
practice isolation,
actual destruction counts, multiplier peaks, and laser audio event timing.

## Manual Home demo

Choose **Watch demo** on Home. The browser never launches it after idle time.
Any key/controller menu action or **Return to Home** stops it; the exit action
is consumed and a fresh action is needed to play. `web/demo/engine.mjs` owns a
separate WASM instance without storage or audio. `web/demo/controller.cpp` holds
the shared autopilot; `src/demo.cpp` forwards to it for firmware builds.
Firmware idle-demo behavior is unchanged.

## Tasks 1–2 validation (2026-10-21)

- `npm test`: 46 passing tests across OLED-compatible and HD WASM builds.
  Coverage includes rotated tight volleys, constant projectile speed,
  limited/full bullet pools, legacy migration, independent profiles and aim
  responses, movement/precision/bounds, and simulated drift/disconnects.
- `node web/build.mjs`: production build passed.
- Host gameplay checks with UBSan passed using
  `SDKROOT=/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk sh tests/run_host.sh`.
  The default Command Line Tools SDK failed to link due to unsupported
  architecture entries; the Xcode SDK run resolved that environmental issue.
- Safari: desktop and 390×844 responsive settings inspected; sliders, profile
  isolation, reload persistence, reset, dialog scrolling, keyboard preview
  movement, and the disconnected-controller state checked. Test settings were
  reset afterward. The narrow viewport check covers compact desktop windows;
  mobile gameplay is outside scope.
- The design detector reported no regex findings, but its parser dependencies
  were unavailable; that degraded scan is not a complete accessibility audit.
- No physical controller was connected. Controller feel, actual resting drift,
  and two-player device combinations remain physical acceptance work; the last
  also depends on the future multiplayer task. No ESP32 flash was performed.

## Pause settings and rapid R2 input (2026-10-21)

- Pausing reveals a Settings button in the playfield and the hint
  “PS4: press X to open settings.” Click the button or press a fresh Cross/X
  while paused. A held Cross from play or controller reconnection cannot open
  settings accidentally. Close returns to pause; Options/Escape resumes.
- Apply commits pending edits for the selected profiles and saves locally.
  Closing without Apply restores the last applied values. Remapping, profile
  switching, sensitivity, reset, and calibration suggestions use this flow.
- The HD browser build bypasses the mechanical fire-button debounce inherited
  from ESP32. A detected press fires on its first simulation tick, and one
  detected release tick rearms it. OLED/ESP32 button debounce stays unchanged.
- Analog triggers activate at 15% travel and rearm below 10%, with hysteresis
  against jitter. Pads without analog values use their digital pressed flag.
  There is no primary-fire weapon cooldown, heat delay, or shots-per-second
  limiter. Holding never repeats. Browser/controller polling and the 20 ms
  simulation still limit input resolution; the 12-projectile pool can reject
  shots when full, and primary fire remains blocked during laser charging.
- Validation: 52 web tests passed, including 100 consecutive alternating
  press/release cycles (25 presses/sec) with no missed shot timestamp,
  trigger jitter, held-input guards, pause/resume, draft discard/Apply,
  and blocked storage. Production build and whitespace checks passed.
- Safari desktop checks confirmed the pause button/hint, mouse opening,
  pending rebinding, Close rollback, and Apply saving; the temporary test
  binding was restored without resetting the player's other preferences.
  Controller shortcut and R2 cadence tests used simulated inputs; actual
  physical trigger feel still needs player acceptance. The design detector
  flagged the existing small 11px UI typography; it is not a full a11y pass.

## Right-stick drift and off-tick R2 releases (2026-10-21 follow-up)

The earlier rapid-fire tests aligned every release with a 20 ms physics tick.
That did not test brief releases between ticks. The browser now observes
available controller samples with a 4 ms input-only timer and at rendering
frames, queues fresh fire edges, and passes each edge explicitly into WASM.
A release no longer needs its own physics tick to rearm a subsequent press.
Browser/hardware polling can still miss transitions it never exposes. Holding
R2 never generates repeated edges. Pending events clear on menu/state changes,
settings, blur, or device changes; finite projectile capacity still applies.

Right-stick aiming has a separate saved deadzone (default 35%, adjustable
5–80%). Older profiles keep their movement deadzone and migrate right-stick
neutral to at least 35%. Aim starts five percentage points beyond the deadzone
and returns to neutral at the deadzone, suppressing boundary jitter. Drift
sampling suggests independent left/right values, committed through Apply.
A centered right stick retains controller aim; a stale mouse target cannot
reclaim aim until the mouse actually moves or clicks again.

Validation: 57 tests passed, including 100 complete R2 release/repress cycles
between simulation ticks, queued presses, no held repeats, independent drift
filtering in WASM, saved deadzones, and mouse/controller aim ownership. The
production build passed. Physical trigger timing/feel remains player acceptance.

## Live X/R2 diagnosis

Open `/?input-fix` to enable a temporary controller input check above the game.
It displays raw Cross/X, R2 and L2 readings; controller press edges observed
since the tab opened; gameplay presses and successful volleys in the current
run; and rejected shots due to a full projectile pool or laser charging.
It reads the actual gameplay counters rather than inferring shots from pixels.
No input readings are transmitted or written to storage. Ordinary URLs keep
this panel hidden.

Cross and the mapped primary-fire button now keep separate press-edge state.
A held R2 cannot swallow fresh Cross presses, and a held Cross cannot swallow
fresh R2 presses. Holding either still never repeats by itself. The existing
pool and laser exclusions remain visible rejection reasons, not cooldowns.

Validation: 59 web tests passed, including 50 Cross presses while R2 remains
held and diagnostic classification of full-pool versus laser rejection. The
production build passed. This addresses a reproducible input-combination flaw;
the reported physical missed-tap problem remains under live diagnosis until
controller observations establish its cause and the player confirms behavior.

## Stats and personal bests (tasks 5–6)

The HUD shows rolling active-game CPS, primary projectile accuracy with hit/shot
counts, longest kill chain, and remaining 2× fire time. The run summary adds
score, highest wave, peak CPS, accuracy, longest chain, and separate laser stats.
Use Practice → Try 2× fire to try the pickup without losing lives.

`asteroids.web.personal-bests-v1` stores independent records for Player 1 and
Player 2 input profiles. A run keeps the profile selected at its start even
if controls switch while paused. Records save automatically at final death;
practice saves when End practice is chosen. The Personal bests disclosure lets
you browse either profile and normal/practice runs after reload. Best accuracy
requires at least 50 spawned projectiles in a run and shows its hit/shot sample.
Other records take each metric's best value independently. Reset needs a
second click, clears only the selected profile's personal bests, and preserves
all existing top-five leaderboards. Storage failures show a status and keep
records for the current visit; the next completed run retries saving.

Record keys separate mode, friendly-fire setting, sorted run modifiers, and
practice. Solo and local co-op now have separate record contexts; co-op also isolates
friendly-fire on/off and stores team leaderboards separately. Network and versus
modes remain planned.

Validation on 2026-10-23: all 73 web tests passed, along with the production HD
build, UBSan host gameplay checks using Xcode's SDK, and `pio run` for ESP32.
The default host script still encounters the installed CommandLineTools SDK's
malformed `.tbd` linker error; explicitly selecting Xcode's compiler/SDK works.
Safari checks covered the practice HUD, boosted fire and pause, final practice
summary, persisted practice records after reload, record selectors, and browser
zoom through the responsive breakpoint. The design detector flagged compact
text sizes consistent with the existing HUD; the existing visual style was
retained. Physical controller feel/balance and two-player acceptance remain
unverified. No firmware upload or physical-device acceptance was performed.

## End-of-run screen order

After the final death animation, results fill the gameplay panel. Review score,
peak CPS, primary accuracy, longest chain, highest wave, survival time, kills,
best multiplier, and separate laser stats there. Choose **Continue to score
saving** (or release fire and press again) to enter initials if the score
qualifies. Other runs continue to the leaderboard. Practice shows the same
in-game results layout and returns to the menu on Continue.

Results freeze simulation and native score-entry input until continued. The
Continue press is consumed; held fire cannot skip results or save initials.
The initials screen still requires release and a new press to save. Personal
bests continue saving automatically at final death or End practice.

Validation: 76 automated checks pass, including qualifying/non-qualifying
results ordering, frozen state, held-fire/Continue guards, exactly-once score
saving, and practice results without idle-demo progression. The production
web build passes; Safari visually confirmed the panel inside the playfield.


## Focused navigation shell

Home now opens Play, Practice, Records, Settings, or How to Play as separate
views. Records, Settings, Help, and developer tools have stable hash links;
reloading a live-play URL returns safely to Home. Browser history never
restores a serialized run.

Pause keeps the same runtime alive. Settings and Help return to Pause without
advancing bullets, effects, or timers. Unapplied settings offer Apply, Discard,
or Stay; leaving an active run asks before quitting. Resume requires fresh
input. Controller menus reserve Cross for selection and Circle for Back; the
configured pause button resumes from Pause after release.

The playfield fits available space at 16:9 with the existing 480×270 simulation
and mouse mapping. Practice tools appear only during practice. Longer utility
views scroll internally; Home and desktop gameplay fit the window. Hidden
views are inert, and only a manually started Home demo advances. The first demo
exit action is consumed. Developer tools hold diagnostics and the asset gallery.

The Home poster is an unchanged frame from the approved blue-moon preview.
Task 4 adds a separate, pixel-stepped ray/particle overlay and a launch sequence.

Validation on 2026-10-23: 86 automated web checks and the production HD build
pass. Navigation tests compare complete runtime snapshots, scene buffers,
and stats across utility visits; they also cover draft/quit decisions, safe
routes, sizing, and held controller inputs. Safari visually confirmed the
focused Home/Records/Settings/Help views, practice pause, Help returning to
Pause, draft discard, and explicit quit. Physical controller feel and the
full device/viewport acceptance matrix remain unverified.


## Task 3 utility screens and post-run flow

Settings has Controls, Calibration, Audio, and Display categories. Profile,
category navigation, and Apply/Reset remain visible while category content
scrolls. One draft spans categories and both profiles; only Apply persists it.
Back offers Apply, Discard, or Stay. The shared sound shortcut is disabled while
editing; Audio edits belong to the same draft.

Records separates the initials leaderboard from per-profile normal/practice
personal bests, with individual metric values, accuracy samples, rules context,
empty states, storage feedback, and a retry action for failed personal-best saves.
Help shows current bindings for the connected controller or keyboard/mouse,
plus short ability explanations. Practice is available from Home and Help;
paused Help keeps the active run intact.

Results remain first, followed by qualifying initials entry (including failed
save/retry), then the leaderboard with Play Again and Home. Leaving unsaved
score review through browser history asks explicitly. Sound and fullscreen
have stable positions in the shared top bar. Menu release/reconnection gates
prevent held controller input from resuming or firing into a run.

Validation: all 88 web tests, the production HD build, and Xcode-SDK UBSan host
gameplay checks pass. New tests cover manual-only demos, independent demo/player
state and storage, freezing after Stop, and leaving unsaved results/initials.
Safari checks covered Watch demo/exit, Settings categories and cross-category
draft discard, current keyboard help, practice launch/results, and Records.
The design scan had one static padding finding; the rendered utility panels
were inspected. Physical controller reconnection and the full viewport matrix
still require acceptance.


## Task 4 presentation and navigation

Home adds a 20 fps pixel-stepped overlay: stationary moons, outward particles,
clockwise 5°/second rays, local flicker, and masking to keep rays behind moons.
Play opens a 3.2-second first-person cockpit warp. Skip launch / Enter / Cross
advances it, Esc / Circle cancels, and held input cannot leak into the new run.
The run/countdown begins only after launch; blur freezes the presentation clock.
Reduced motion uses a calm 250 ms scene change. Background motion and scenery
brightness are pending-draft Display preferences; essential gameplay remains full
contrast. Nothing here changes asteroid movement or timing.

Each five-wave region has data-driven art and a distinct 500–650 ms transition.
Effects stay below player sprites, bullets, pickups, and warnings. Pause/blur
freeze travel and region identity appears in Results. The existing sprite set is
retained; optional replacement artwork remains a separate approval/design task.

Menus support D-pad/stick up/down focus, left/right field adjustment, Cross
selection, Circle Back, and bounded repeats. Cross/Enter edits select fields;
up/down then changes their options, and Back exits editing first. Rebinding
cancels before leaving Settings. Controller remaps never change these reserved
menu actions. Keyboard arrows navigate categories and fields without accidentally
changing the profile. Shared self-hosted pixel fonts, focus/disabled/destructive
states, and static reading-screen backdrops are packaged in the production build.

Every fifth wave closes its region with one of six bosses (Sentinel, Ringwarden,
Cinderforge, Bastion, Tidecaller, Horizon Warden) and every region has a mini-boss
on its third wave, each with an entrance card, health bar, telegraphed attacks and
a defeat sequence. Boss practice is in the Pause menu of a practice run. See `COMBAT.md` for damage, scaling,
points, shields, and local co-op policy. LAN/server multiplayer remains planned.

Developer tools → Pixel assets includes static synthetic transition/boss stress
fixtures. These use the production renderer, but are not recorded gameplay or
performance telemetry. Review GIFs are in the root `assets/` folder; the runtime
uses Canvas drawing rather than continuously decoding full-frame GIFs.

Validation on 2026-10-24: 114 automated checks cover OLED/HD WASM, navigation,
field adjustment, decoration preference migration, launch monotonicity/freeze,
region boundaries/reduced motion, boss health/damage/dodging/shields/rewards,
multishot plus 2× accounting, and demo/record isolation. Production build passes.
Safari verified Home, launch, keyboard-only category selection, Display controls,
zoom, fullscreen, and busy synthetic transition/boss frames. Physical controller
reconnect/feel, co-op/friendly-fire/network acceptance, and representative-device
performance soaks remain open for task 5 and the later multiplayer milestones.

## Browser record reset and refresh

Records offers a scoped personal-best reset and an explicit **Clear this
browser’s records** action. Confirming the latter clears this version's top-five
leaderboard and both profiles' normal/practice personal bests, including the live
WASM table. Controls, audio, and unrelated/legacy storage keys remain intact.
Storage failures are shown; a partial write attempts to restore the prior data.
Tests verify empty records after a new runtime/reload and rollback on failure.

Refresh retains local storage by design. The preview server serves assets with
`Cache-Control: no-store`; run `npm --prefix web run build` after source changes,
then refresh to load the new `web/dist` output. Refresh is not a record reset.
Task 5 implementation is complete. See [architecture](../docs/ARCHITECTURE.md)
for module ownership, portable C boundaries, coding conventions and formatter
commands, and [acceptance](../docs/ACCEPTANCE.md) for current evidence and the
remaining physical-device/performance checks.

## Audio

Sound effects and music have separate, per-profile toggles in the top bar and
Settings → Audio. Both default off for existing profiles without a preference.
Volume applies to both. Original procedural Home and flight chiptunes require
no external files, streamed music, third-party license or network request.
Music pauses on utility screens, Pause, Results, demo, launch and hidden tabs.
The warp sound follows the Sound toggle and stops on skip, cancel or blur.
Audio unlocks after a user gesture; browser autoplay restrictions still apply.

The game-over low-tone tail is 665 ms (about 700 ms on the 20 ms simulation
cadence). Audio-only ticks allow it to finish on Results without advancing the
run or changing the displayed statistics.

## Two-player local co-op (2026-10-25)

Choose Play → Local Co-op. Assign different devices and profiles, ready both
pilots, then Launch together. Supported combinations are keyboard/mouse +
controller and two standard-mapped controllers. Both ships use one fixed arena;
P1/P2 labels and diamond/square markers match the cyan/amber HUD strips.

Each pilot starts with three lives and owns their weapons, pickups, score,
combo and statistics. Friendly fire defaults off and is fixed for the run.
Death affects only that pilot; a remaining life respawns them with protection,
otherwise they spectate. No revives. Either pilot pauses the whole game. A lost
assigned controller pauses and requires explicit reassignment before Resume.

Results show individual statistics and team total. A separate team initials
leaderboard supports the full sum of both individual scores and separates
friendly-fire rules. Records offers Solo / Co-op FF off / Co-op FF on. Existing
solo scores/settings are preserved. Controls and detailed combat rules are in
`COMBAT.md`; implementation/evidence are in `../docs/ARCHITECTURE.md` and
`../docs/ACCEPTANCE.md`. Physical two-person acceptance remains open.
