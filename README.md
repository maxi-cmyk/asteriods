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
- Earn 20 / 50 / 100 points for large / medium / small rocks.
- Wave one has three large rocks entering from the right, 1.8 seconds apart. After all rocks are destroyed or leave, there is a 1.5-second breather.
- Add one large rock every two waves, up to six. Speed increases gradually through wave eleven, then stays capped.
- Rocks drift slightly vertically and bounce inside the playfield; objects do not wrap. A small right-edge marker previews the next rock's height for 700 ms before its scheduled entrance.
- Respawn at a safe 2D position, favoring the left side, with two seconds of blinking invincibility. The world freezes briefly during the death effect.
- Pause freezes movement, wave scheduling, bullets, and invincibility.
- Runs end when all three lives are lost. There is no time limit, multiplier, saucer, initials entry, or attract demo.
- The best score is stored in ESP32 Preferences and updated only when a completed run beats it. The simplified game uses a separate `best-v2` key; previous leaderboard data remains untouched.

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

The host checks compile production gameplay and input code with simulated hardware, UndefinedBehaviorSanitizer. They cover firing edges, swept collisions, splitting and pool capacity, wave progression, 2D movement bounds, diagonal speed, nose-relative firing, spawn warnings, pause, respawn selection, retry handling, and best-score storage logic. They do not verify physical joystick feel, OLED output, buzzer sound, or ESP32 flash persistence; test those on the board after uploading.

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
