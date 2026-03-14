# 🛠️ Hardware Projects
A collection of my experiments with hardware components. I mainly use ESP32 and Arduino boards.

# ESP32 Asteroids

A breadboard-based Asteroids arcade game built on an ESP32, rendered on a 128×64 SSD1306 OLED display. It features analog joystick controls, a fire button, and an active buzzer for retro sound effects. Powered via USB-C, the game boots instantly and includes persistent high scores, scaling difficulty, and a multiplier streak system.

## Features

- **X-Axis Snap Movement:** Optimized for horizontal-only gallery shooting with zero-drift physics.
- **Improved Audio:** Custom PWM sound engine generating classic arcade blips, thrust noise, and UFO warbling on a passive buzzer.
- **Progressive Difficulty:** Math-driven difficulty scaling over a 5-minute match. Asteroids get faster, split into smaller pieces, and their shapes become more jagged as time goes on.
- **Multiplier Streaks:** Chain kills within 3 seconds to build up to a 5x score multiplier.
- **UFO/Saucer:** Bonus enemies that spawn periodically. Large saucers fire randomly; small saucers directly target the player.
- **"Juice":** Screen shake on large explosions, a particle system for debris, and an OLED burn-in prevention system.
- **Attract Mode:** If left idle on the main menu, the game plays an AI-driven demo game.
- **Persistent Storage:** Top 10 high scores with 3-letter initials are saved to the ESP32's non-volatile memory via the Preferences library.

## Hardware Requirements

| Qty | Component                 | Notes                                   |
| --- | ------------------------- | --------------------------------------- |
| 1   | ESP32 DevKit v1 (38-pin)  | Ensure enough GPIOs (avoid ESP32-C3).   |
| 1   | SSD1306 OLED 128×64       | I²C, 4-pin (0.96″ or 1.3″).             |
| 1   | Dual-axis analog joystick | KY-023 style (VRx, VRy + switch click). |
| 1   | Tactile push button (6mm) | Used for the Fire button.               |
| 1   | Passive buzzer            | Frequency controlled via PWM.           |
| -   | Breadboard & jumper wires | Full-size recommended.                  |
| 1   | USB-C cable               | For direct power to the ESP32.          |

## Pin Assignments & Wiring

```text
ESP32 Pin       →  Component
─────────────────────────────────────────
GPIO 21 (SDA)   →  OLED SDA
GPIO 22 (SCL)   →  OLED SCL
3.3V            →  OLED VCC
GND             →  OLED GND

GPIO 34 (ADC)   →  Joystick VRx (analog, input-only pin)
GPIO 35 (ADC)   →  Joystick VRy (analog, input-only pin)
GPIO 32         →  Joystick SW (double-click to pause)
3.3V            →  Joystick +5V
GND             →  Joystick GND

GPIO 25         →  Fire button (wire to GND, use INPUT_PULLUP)
GPIO 27 (PWM)   →  Passive buzzer signal
```

_Note: The ESP32's onboard voltage regulator handles 5V USB → 3.3V. All peripherals draw from the 3.3V rail safely._

## Building and Flashing

This project is built using PlatformIO.

1. Install [PlatformIO](https://platformio.org/).
2. Clone this repository.
3. Plug in your ESP32.
4. Build and upload using the PlatformIO CLI:
   ```bash
   pio run --target upload
   ```

## Controls

| Input                     | Action                                          |
| ------------------------- | ----------------------------------------------- |
| **Joystick X-axis**       | Move ship left/right (snappy 1D movement)       |
| **Fire button**           | Shoot bullet upwards                            |
| **Double-click Joystick** | Pause / Resume gameplay                         |
| **Single-click Joystick** | Menu select (on menu screens only)              |

## Game Mechanics

1. **Scoring:** Large Asteroid (20 pts), Medium Asteroid (50 pts), Small Asteroid (100 pts). Large Saucer (200 pts), Small Saucer (1000 pts).
2. **Streaks:** Getting kills within 3 seconds of each other builds a multiplier streak (up to 5x).
3. **Lives & Time:** The player starts with 3 lives. The game runs for a maximum of 5 minutes.
4. **Respawning:** Dying costs 1 life. The ship respawns with 2 seconds of blinking invincibility.
5. **High Scores:** If the timer reaches 0:00 or lives reach 0, the game ends. If your score falls in the top 10, you can enter your 3-letter initials.

## Architecture

The project is structured into functional modules:

- Core game state and loops (`game.cpp`, `main.cpp`).
- Entities (`ship.cpp`, `asteroid.cpp`, `bullet.cpp`, `saucer.cpp`).
- Hardware abstractions (`display.cpp` for OLED, `input.cpp` for smoothing/ADC, `sound.cpp` for frequency audio).
- Storage and UI (`highscore.cpp`, `demo.cpp`).

## Troubleshooting 

Refer to docs -> SETUP.md
