# Asteroids

A simple side-scrolling Asteroids rendition for an ESP32 and a 128×64 SSD1306 OLED. The ship moves freely within the playfield and shoots right at incoming rocks. One analog joystick and one fire button are all you need.

## Controls

| Input | Action |
| --- | --- |
| Joystick X/Y | Move left/right and up/down; release to stop |
| Fire button press | Shoot one bullet to the right |
| Double-click joystick | Pause / resume |
| Fire on title / game over | Start / retry |
| Initials: joystick up/down, left/right | Cycle A–Z, select one of three letters |
| Initials: fresh fire press | Confirm and save; retry a failed save |

Every shot or multishot volley requires a fresh debounced press. Primary fire
has no cooldown, heat, overheating, or movement penalty on either version.
The 12-bullet pool still limits simultaneous projectiles. Full-pool presses
are consumed without queuing or playing a shoot sound. A 20 ms debounce
filters mechanical bouncing; both press and release must register.
Diagonal movement speed is capped at straight-line speed (the stick vector is divided by its length when that exceeds 1, a projection onto the unit disc, so the corner of the square stick range cannot exceed full speed).

## Rules

- Start with three lives. Only touching a rock costs a life; missed rocks can exit left without penalty.
- Large rocks split into two medium rocks; medium rocks split into two small rocks.
- Earn 20 / 50 / 100 base points for large / medium / small rocks, multiplied by the current chain multiplier. Every three destructions raise it by one, up to x5. Each kill uses the current multiplier before advancing the chain. A three-second gap between kills or a death resets it to x1. Fragments count separately; misses and escaped rocks do not immediately break the chain. Score caps at 999,999.
- The HUD shows the multiplier beside the score, with a shrinking underline for the remaining chain time. Pause freezes the chain timer.
- Wave one starts with three large rocks at 0.34 pixels/update, two seconds apart. Profiles gradually increase speed, population, and drift while reducing spawn gaps. Wave 24 reaches the caps: 0.85 pixels/update, eight entrances, and a 0.9-second base spawn gap. After all rocks are destroyed or leave, there is a 1.5-second breather followed by the next entrance warning.
- Waves 4+ can alternate high/low entrances; waves 8+ can use staggered pairs with an extra 350 ms recovery after each pair. Pattern and height choices vary within wave difficulty bounds. Crowded entrance corridors and limited pool space defer spawns without losing pending rocks or creating catch-up bursts. A short wave cue appears at wave starts.
- Rocks drift slightly vertically and bounce inside the playfield; objects do not wrap. A small right-edge marker previews the next rock's height for 700 ms before its scheduled entrance.
- Respawn at a safe 2D position, favoring the left side, with two seconds of blinking invincibility. The world freezes briefly during the death effect.
- Pause freezes movement, wave scheduling, bullets, invincibility, effect timers.
- Destroyed rocks have a 10% chance to drop a pickup while none is visible. Pickups drift left: three prongs give six seconds of multishot; a dotted box gives one shield charge. Collecting again refreshes multishot or retains one shield. Both can coexist, freeze during pause, and clear on death/new runs.
- Multishot fires straight plus two shallow diagonal shots per press. If fewer than three bullet slots are free, it fires one straight shot when possible. A shrinking line beneath the ship shows remaining multishot time.
- A shield appears as an outer ship outline. One asteroid collision consumes it, preserving the life and score chain and granting 800 ms of blinking protection to escape the overlap.
- Runs end when all three lives are lost. There is no time limit or saucer. After ten idle seconds on the title, an automated demo begins. Move the joystick, click it, or press fire to return to the title; release and press fire again to start. Demo scores are never saved.
- The top five completed nonzero scores qualify for three-letter initials entry, starting at `AAA`. Existing equal scores stay ahead of new ties; a tie with fifth place does not qualify. Joystick navigation repeats every 250 ms while held. A fresh fire press confirms and saves. A failed save stays on the entry screen for a deliberate retry.
- The title shows the saved leader; game over shows the final score and top five, highlighting the saved entry. Release fire after the retry guard, then press again to start a new run.
- Preferences stores one 42-byte versioned table under `asteroids/scores-v3` (record version 1). Missing or invalid records load an empty table without writing. Older `best-v3`, `best-v2`, and legacy leaderboard keys remain untouched; their scores are not imported.

## Hardware and wiring

| Component / signal | ESP32 connection |
| --- | --- |
| SSD1306 SDA / SCL | GPIO 21 / 22 |
| OLED power | 3.3V / GND |
| Joystick VRx / VRy | GPIO 34 / 35 |
| Joystick SW | GPIO 32 |
| Joystick power | 3.3V / GND |
| Fire button | GPIO 25 to GND, internal pull-up |
| Passive buzzer signal | GPIO 27 |

Uses an ESP32 DevKit (`esp32dev`), an I²C SSD1306 at `0x3C`, a dual-axis joystick with a built-in click switch, a tactile fire button, and a passive buzzer. No wiring changes are needed from the previous version. Leave the joystick centered during power-up calibration.

Rock generation uses direct ESP32 hardware RNG calls with unbiased bounded ranges. The Wi-Fi radio stays enabled, with modem sleep disabled, to supply continuous entropy; no network connection or credentials are needed. This adds radio power consumption. GPIO 34/35 use ADC1, so joystick sampling does not use the ADC-based entropy source. The game stops at startup if radio entropy initialization fails; it never substitutes a software PRNG for rocks. See [Espressif RNG prerequisites](https://docs.espressif.com/projects/esp-idf/en/release-v4.4/esp32/api-reference/system/random.html).

From wave 6, every fourth entrance is a faster small rock (1.45× wave speed);
wave 12 unlocks three-lane clusters. Pairs and clusters retain at least 700 ms
warning for each entrance. Fast rocks use a double-line warning on OLED.

Multishot and shield implement task 6 in `nextSteps.md`; the attract demo implements task 3. Other power-up ideas remain planned. Difficulty tuning still needs physical playtesting, including pickup balance, and shield escape time.

## Browser version

The pixel-art browser version lives in [web/](web/README.md). It compiles
this project's gameplay C++ to WebAssembly, with a web-only 480×270 playfield,
smaller detailed sprites, and PS4/standard-gamepad and keyboard controls. Run `cd web`, `npm run build`, then `npm start`; open
`http://127.0.0.1:4173`. The ESP32 firmware is built and flashed separately.

## Build and upload

```sh
pio run
pio run --target upload
pio device monitor --baud 115200
```

If `pio` is not on your PATH, use `~/.platformio/penv/bin/pio`.

## Verification

```sh
sh tests/run_host.sh
```

The host checks compile production gameplay and input code with simulated hardware, UndefinedBehaviorSanitizer. They cover firing edges, swept collisions, splitting and pool capacity, wave progression, 2D movement bounds, diagonal speed, nose-relative firing, spawn warnings, pause, respawn selection, retry handling, per-hit multiplier scoring, expiry/reset, all wave-profile bounds, deferred entrance patterns, unbiased random ranges with a deterministic test source, and leaderboard ranking, initials navigation, held-button guards, one-time confirmation, reload, malformed records, failed storage writes, rapid primary fire, full-pool rejection, frozen timers, and full-speed movement. Power-up checks cover drop thresholds, collection, refresh, expiry, pause, atomic volleys/fallbacks, diagonal swept collisions, held fire, shield overlap protection, resets, and indicator bounds. They do not verify physical joystick feel, OLED output, buzzer sound, or ESP32 flash persistence; test those on the board after uploading.

To additionally enable AddressSanitizer on a compatible host, run `SANITIZERS=address,undefined sh tests/run_host.sh`. AddressSanitizer currently hangs on the development Mac, so it has not passed here.

See [setup](docs/SETUP.md) and [game specification](docs/PRD.md).

## Coding style

Project-owned code follows the CS101 conventions summarized in
[nextSteps.md](nextSteps.md): four-space indentation, 80-column lines, braces
for every control-flow body, descriptive snake_case names, initialized
variables, and short functions. Arduino and library API names retain their
original spelling. `.clang-format` captures the formatting rules.

With clang-format installed, check formatting using:

```sh
clang-format --dry-run --Werror src/*.cpp include/*.h tests/host/*.h \
    tests/host/*.cpp
```
