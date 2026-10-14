# Asteroids

A simple side-scrolling Asteroids rendition for an ESP32 and a 128×64 SSD1306 OLED. The ship moves freely within the playfield and shoots right at incoming rocks. One analog joystick and one fire button are all you need.

## Controls

| Input | Action |
| --- | --- |
| Joystick X/Y | Move left/right and up/down; release to stop |
| Fire button press | Shoot one bullet to the right |
| Double-click joystick | Pause / resume |
| Fire on title / game over | Start / retry |

There is **no hold-to-fire and no shot cooldown**. Each debounced press fires once, including rapid repeated presses. A 20 ms debounce filters mechanical bouncing; both press and release must register. The 12-bullet pool bounds memory use. Full diagonal speed is capped at straight-line speed.

## Rules

- Start with three lives. Only touching a rock costs a life; missed rocks can exit left without penalty.
- Large rocks split into two medium rocks; medium rocks split into two small rocks.
- Earn 20 / 50 / 100 base points for large / medium / small rocks, multiplied by the current chain multiplier. Every three destructions raise it by one, up to x5. Each kill uses the current multiplier before advancing the chain. A three-second gap between kills or a death resets it to x1. Fragments count separately; misses and escaped rocks do not immediately break the chain. Score caps at 999,999.
- The HUD shows the multiplier beside the score, with a shrinking underline for the remaining chain time. Pause freezes the chain timer.
- Wave one starts with three large rocks at 0.34 pixels/update, two seconds apart. Profiles gradually increase speed, population, and drift while reducing spawn gaps. Wave 24 reaches the caps: 0.85 pixels/update, eight large rocks, and a 0.9-second base spawn gap. After all rocks are destroyed or leave, there is a 1.5-second breather followed by the next entrance warning.
- Waves 4+ can alternate high/low entrances; waves 8+ can use staggered pairs with an extra 350 ms recovery after each pair. Pattern and height choices vary within wave difficulty bounds. Crowded entrance corridors and limited pool space defer spawns without losing pending rocks or creating catch-up bursts. A short wave cue appears at wave starts.
- Rocks drift slightly vertically and bounce inside the playfield; objects do not wrap. A small right-edge marker previews the next rock's height for 700 ms before its scheduled entrance.
- Respawn at a safe 2D position, favoring the left side, with two seconds of blinking invincibility. The world freezes briefly during the death effect.
- Pause freezes movement, wave scheduling, bullets, and invincibility.
- Runs end when all three lives are lost. There is no time limit, saucer, initials entry, or attract demo.
- The best score is stored in ESP32 Preferences and updated only when a completed run beats it. The multiplier/difficulty rules use a separate `best-v3` key, labeled V3 on the title screen; `best-v2` and previous leaderboard data remain untouched.

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

Overheating, power-ups, the attract demo, and initials entry remain planned in `nextSteps.md`. Difficulty tuning still needs physical playtesting, especially after overheating and power-ups are implemented.

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

The host checks compile production gameplay and input code with simulated hardware, UndefinedBehaviorSanitizer. They cover firing edges, swept collisions, splitting and pool capacity, wave progression, 2D movement bounds, diagonal speed, nose-relative firing, spawn warnings, pause, respawn selection, retry handling, per-hit multiplier scoring, expiry/reset, all wave-profile bounds, deferred entrance patterns, unbiased random ranges with a deterministic test source, and versioned best-score storage logic. They do not verify physical joystick feel, OLED output, buzzer sound, or ESP32 flash persistence; test those on the board after uploading.

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
