## 1. Project Overview

A breadboard-based Asteroids arcade game built on an ESP32, rendered on a 128×64 SSD1306 OLED, with an analog joystick for all movement (including thrust via velocity threshold), a fire button, and an active buzzer for sound effects. Powered via USB-C (always on when plugged in). Features include persistent high scores (top 10), scaling difficulty over a 5-minute match, and a multiplier streak system.

---

## 2. Hardware

### 2.1 Bill of Materials

| #   | Component                                | Qty | Notes                                                           |
| --- | ---------------------------------------- | --- | --------------------------------------------------------------- |
| 1   | ESP32 DevKit v1 (38-pin)                 | 1   | Use a board with enough GPIOs; avoid ESP32-C3 (limited pins)    |
| 2   | SSD1306 OLED 128×64, I²C, 4-pin          | 1   | 0.96″ or 1.3″ — the 1.3″ is nicer for gameplay                  |
| 3   | Dual-axis analog joystick (KY-023 style) | 1   | VRx, VRy analog outs + SW click for pause                       |
| 4   | Tactile push button (6mm)                | 1   | Fire button                                                     |
| 5   | Active buzzer                            | 1   | Built-in oscillator; volume controlled via PWM duty cycle       |
| 6   | Resistor — 10kΩ                          | 1   | Pull-down for fire button (or use INPUT_PULLUP and wire to GND) |
| 7   | Breadboard + jumper wires                | —   | Standard full-size breadboard recommended                       |
| 8   | USB-C cable                              | 1   | Powers the ESP32 directly; game turns on when plugged in        |

### 2.2 Pin Assignments

```
ESP32 Pin       →  Component
─────────────────────────────────────────
GPIO 21 (SDA)   →  OLED SDA
GPIO 22 (SCL)   →  OLED SCL
3.3V            →  OLED VCC
GND             →  OLED GND

GPIO 34 (ADC)   →  Joystick VRx (analog, input-only pin)
GPIO 35 (ADC)   →  Joystick VRy (analog, input-only pin)
GPIO 32         →  Joystick SW (double-click to pause)
3.3V            →  Joystick +5V (works fine on 3.3V)
GND             →  Joystick GND

GPIO 25         →  Fire button (wire to GND, use INPUT_PULLUP)

GPIO 27 (PWM)   →  Active buzzer signal (other pin to GND)
```

**Why these specific pins:**

- GPIOs 34/35 are input-only and have clean ADC — perfect for joystick axes
- GPIO 32 supports internal pull-up for the joystick click button
- GPIO 25 has clean digital input for the fire button
- GPIO 27 supports PWM for buzzer volume control
- Avoid GPIO 0, 2, 12, 15 (boot-sensitive strapping pins)

### 2.3 Wiring Diagram Notes

```
                    ┌──────────────┐
     OLED ◄── I²C ─┤  ESP32 Dev   ├─ PWM ──► Buzzer
                    │    Board     │
  Joystick ◄─ ADC ─┤              │
  (axes + click)    │              │
                    │     (USB-C)  │
   Fire btn ──► GPIO┤              │
                    └──────────────┘
```

### 2.4 Power

USB-C directly into the ESP32 dev board. The game boots automatically when power is connected — no switch needed. The ESP32's onboard voltage regulator handles 5V USB → 3.3V for all components. All peripherals (OLED, joystick, buzzer) draw from the ESP32's 3.3V rail, which can comfortably supply the ~80mA total draw of this project.

---

## 3. Game Mechanics

### 3.1 Controls

| Input                         | Action                                                                   |
| ----------------------------- | ------------------------------------------------------------------------ |
| Joystick X-axis               | Rotate ship left/right (proportional to deflection)                      |
| Joystick Y-axis               | Move ship — gentle at partial tilt, thrust kicks in when slammed forward |
| Fire button (GPIO 25)         | Shoot bullet in facing direction                                         |
| Joystick click — double-click | Pause / resume                                                           |
| Joystick click — single click | Menu select (on menu screens only)                                       |

**Joystick Y-axis velocity curve:**

```
Speed
  ▲
  │            ┌─── THRUST ZONE (85–100%)
  │           ╱     Full acceleration, thruster visual
  │         ╱
  │       ╱ ── CRUISE ZONE (15–85%)
  │     ╱      Proportional speed, smooth control
  │   ╱
  │──╱ ── DEAD ZONE (0–15%)
  │        No movement, prevents phantom drift
  └──────────────────────────► Joystick deflection %
```

| Y-axis deflection | Behavior                                            | Speed factor         |
| ----------------- | --------------------------------------------------- | -------------------- |
| 0–15%             | Dead zone — no movement                             | 0%                   |
| 15–85%            | Proportional cruise — smooth repositioning          | 5–60% of max speed   |
| 85–100%           | Thrust mode — full acceleration in facing direction | 60–100% of max speed |

**Thrust mode details:**

- Activates when joystick Y exceeds 85% deflection
- Ship accelerates in facing direction at full power
- Show a small thruster flame sprite behind the ship (2–3 pixels, toggling on/off each frame for flicker)
- Buzzer plays thrust sound pattern while in thrust zone
- Pulling joystick back past -85% applies reverse thrust (braking)

**Tuning notes:**

- The 85% threshold should feel like a deliberate slam, not something you accidentally trigger while cruising. Test this value early — it may need adjusting per joystick module.
- Rotation speed (X-axis) should scale with deflection: gentle tilt = slow turn, full tilt = fast spin.
- Apply smoothing: average 3–4 ADC readings per frame to prevent jitter.

**Double-click pause detection:**

- Two joystick clicks within 300ms = pause toggle
- Single click is ignored during gameplay (prevents accidental pauses)
- During pause, display "PAUSED" overlay — joystick and fire button are disabled
- Double-click again to resume
- On menu screens, single click = select (no double-click needed)

### 3.2 Ship Physics

- X-movement for simplicity, screen is too small for y-movement
- Edges of screen are hard-coded barriers
- **Invincibility on respawn:** 2 seconds of invincibility with ship blinking on screen.

### 3.3 Asteroids

**Sizes and splitting behavior:**

| Size   | Pixel radius | Splits into         | Points |
| ------ | ------------ | ------------------- | ------ |
| Large  | 10–12 px     | 2 Medium            | 20     |
| Medium | 6–7 px       | 2 Small             | 50     |
| Small  | 3–4 px       | Nothing (destroyed) | 100    |

- Asteroids are rendered as irregular polygons (6–8 vertices with random offsets from a circle) — not perfect circles. This is key to the classic look.
- Each asteroid has a random rotation speed for visual variety.
- Asteroids have random velocity vectors. Speed range increases with difficulty.

### 3.4 Bullets

- Max 4 bullets on screen at once (prevents spray-and-pray)
- Bullet speed: ~5 pixels/frame (must be faster than ship)
- Bullet lifetime: ~40 frames (~0.67 seconds at 60fps) or until they travel ~80% of screen width
- Cooldown: ~150ms between shots to prevent button-mashing exploits

### 3.5 Scoring & Multiplier Streaks

**Base scoring:** See points table above.

**Streak multiplier system:**

| Streak    | Multiplier | Requirement                            |
| --------- | ---------- | -------------------------------------- |
| 0–2 kills | ×1         | —                                      |
| 3–5 kills | ×2         | Each kill within 3 seconds of the last |
| 6–9 kills | ×3         | Streak maintained                      |
| 10+ kills | ×5         | Streak maintained                      |

- **Streak timer:** You have 3 seconds after each kill to get another kill, or the streak resets to 0.
- **Visual feedback:** Show a small "×2", "×3", "×5" indicator on the HUD. Flash it when it increases.
- **Audio feedback:** Play an ascending tone on streak increase, descending tone on streak break.

### 3.6 Difficulty Scaling

The game lasts a maximum of 5 minutes (300 seconds). Difficulty scales linearly with time:

| Time      | Asteroid count | Asteroid speed | Spawn rate               | Special                                 |
| --------- | -------------- | -------------- | ------------------------ | --------------------------------------- |
| 0:00–0:30 | 3              | Slow           | —                        | Grace period, no small asteroids        |
| 0:30–1:30 | 4–5            | Medium         | New wave when <2 remain  | —                                       |
| 1:30–3:00 | 5–7            | Medium-Fast    | New wave when <3 remain  | Small asteroids move faster             |
| 3:00–4:00 | 6–8            | Fast           | Continuous trickle spawn | Asteroids occasionally spawn from edges |
| 4:00–5:00 | 8–10           | Very fast      | Aggressive spawning      | "Survival mode" — max chaos             |

**Spawn safety:** Never spawn an asteroid within 30 pixels of the ship. If the chosen spawn location is too close, re-roll or place it on the opposite screen edge.

### 3.7 Lives & Game Over

- **3 lives** per game
- **Collision detection:** Circle-to-circle (ship radius vs asteroid radius). Simple and cheap to compute.
- **Death sequence:** Ship "explodes" (show 6–8 lines radiating outward for 0.5 seconds). Buzzer plays descending tone.
- **Respawn:** Ship appears at center, 2 seconds invincibility, nearby asteroids are pushed away.
- **Game over conditions:**
  1. All 3 lives lost → Game Over screen
  2. 5-minute timer expires → "TIME'S UP" screen → show final score
- **Game over screen:** Show score, whether it's a new high score, prompt to play again.

### 3.8 UFO / Saucer (Bonus Feature — Recommended)

Add a UFO that appears every 45–60 seconds starting at 1:00:

| Type         | Size     | Behavior        | Points |
| ------------ | -------- | --------------- | ------ |
| Large saucer | 8px wide | Shoots randomly | 200    |
| Small saucer | 5px wide | Aims at player  | 1000   |

- Small saucer only appears after 2:30
- Saucer enters from a random screen edge, travels horizontally
- Fires 1 shot every 2 seconds
- If not destroyed, exits after 8 seconds
- Buzzer plays a distinct warbling tone while saucer is active

---

## 4. Display Layout

```
┌────────────────────────────────┐
│ ♥♥♥   0:00   12450  ×3        │  ← HUD row (top 8 pixels)
│                                │
│                                │
│         Game Area              │
│        (128 × 54)              │
│                                │
│              ▲ (ship)          │
│                                │
└────────────────────────────────┘
```

**HUD elements (top 8 pixels):**

- Left: Lives (heart icons or ship icons)
- Center-left: Timer (M:SS countdown)
- Center-right: Score
- Right: Multiplier (when active)

**Edge case:** On a 128×64 display, every pixel matters. The HUD uses a 5×7 font at 1× scale. The playfield is 128×54 pixels — small but workable. All game objects must be designed to be readable at this scale.

---

## 5. Sound Design (Active Buzzer)

An active buzzer has a built-in oscillator at a fixed frequency (~2.5kHz typical). You can't change pitch, but you can control volume and rhythm by varying the PWM duty cycle on the signal pin. This gives you on/off patterns, pulsing, and volume swells.

**How it works:** PWM duty cycle controls perceived volume. 100% duty = full volume, 50% = softer, 0% = silent. Rapid on/off toggling creates rhythmic patterns.

| Event                      | Pattern                                          | Duration                                       |
| -------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| Shoot                      | Single short beep (100% → off)                   | 30ms                                           |
| Asteroid destroyed (small) | Quick double-tap                                 | 2× 20ms, 20ms gap                              |
| Asteroid destroyed (large) | Triple-tap, descending volume                    | 3× 25ms at 100%, 70%, 40%                      |
| Thrust active              | Rapid pulse (on/off repeating)                   | 15ms on / 15ms off, continuous while thrusting |
| Ship death                 | Long buzz → fade out (ramp duty cycle down)      | 500ms                                          |
| Streak increase            | Quick ascending pulse burst (volume ramp up)     | 3× 30ms at 40%, 70%, 100%                      |
| Streak lost                | Single medium beep                               | 80ms                                           |
| UFO active                 | Slow alternating pulse (on/off)                  | 200ms on / 200ms off, continuous               |
| Game over                  | Long descending fade (duty cycle ramp 100% → 0%) | 1000ms                                         |
| New high score             | Rapid celebratory burst                          | 5× 40ms, 30ms gaps                             |
| Menu select                | Single short click                               | 15ms                                           |

**Sound priority** (highest first): Ship death > Streak increase > Shoot > Asteroid destroy > Thrust Use a simple sound queue — if a higher priority sound triggers, it interrupts the current one.

**Implementation approach:**

```
// PWM channel for buzzer volume control
ledcSetup(channel, 2500, 8);  // 2.5kHz base, 8-bit resolution
ledcWrite(channel, 200);       // ~78% duty = loud
ledcWrite(channel, 50);        // ~20% duty = quiet
ledcWrite(channel, 0);         // silent
```

**Note:** The exact fixed frequency of your buzzer may differ (1kHz–4kHz). The perceived "harshness" varies — if it's too shrill, lower the max duty cycle to cap the volume.

---

## 6. Menus & Flow

```
POWER ON
   │
   ▼
SPLASH SCREEN (1.5s)
"ASTEROIDS" in large text, ship animation
   │
   ▼
MAIN MENU
├── ▶ START GAME
├──   HIGH SCORES
└──   (future: SETTINGS)
   │
   ▼ (START)
COUNTDOWN (3-2-1-GO)
   │
   ▼
GAMEPLAY (up to 5 min)
   │
   ├──► PAUSE (double-click joystick)
   │     ├── RESUME (double-click again)
   │     └── QUIT → MAIN MENU (hold joystick click 2s)
   │
   ▼ (lives = 0 or timer = 0)
GAME OVER SCREEN
├── Show score + multiplier stats
├── "NEW HIGH SCORE!" if applicable
├── Enter initials (3 chars) if high score
└── Press fire to return to MAIN MENU
```

**High score initial entry:**

- Joystick up/down scrolls through A–Z and 0–9
- Joystick right moves to next character
- Joystick click confirms (single-click, since this is a menu screen)
- Default: "AAA"

---

## 7. Persistent Storage (High Scores)

Use ESP32's **EEPROM emulation** (Preferences library) or **SPIFFS/LittleFS** for non-volatile storage.

**Recommended: `Preferences` library** (simplest, wear-leveled, built into ESP32 Arduino core)

```
Stored data structure (per entry):
{
  char initials[4];   // "ABC\0"
  uint32_t score;     // max ~4 billion, more than enough
  uint8_t max_streak; // highest multiplier reached
  uint16_t time;      // survival time in seconds
}
```

**Storage layout:**

- 10 entries × ~12 bytes = ~120 bytes total
- Also store: total games played (uint16_t), all-time highest streak (uint8_t)

**Edge cases to handle:**

- First boot: Initialize all 10 slots to score=0, initials="---"
- Corrupt data: Store a magic byte (0xA5) as validation; if missing, reinitialize
- Score ties: Most recent score gets higher placement
- Storage full: 10 slots max; lowest score gets replaced if new score is higher

---

## 8. Edge Cases & Gotchas

### Hardware

- **Joystick center drift:** Calibrate on boot — read center values during splash screen and use those as the reference. ADC readings vary between joystick modules.
- **Button bouncing:** Software debounce at 50ms. Use `millis()` comparison, not `delay()`.
- **OLED burn-in:** Shift the HUD position by 1 pixel every 30 seconds (subtle, prevents static element burn).
- **I²C speed:** Run OLED at 400kHz (fast mode). Default 100kHz is too slow for 60fps full-screen redraws.
- **ADC noise on ESP32:** Use `analogReadMilliVolts()` if available, or average 3–4 readings per frame for joystick smoothing.

### Gameplay

- **Empty screen lockup:** If all asteroids are destroyed and no new wave spawns, the game stalls. Always trigger a new wave when asteroid count < minimum threshold.
- **Asteroid spawn overlap:** New asteroids can spawn on top of each other. Check spawn positions against existing asteroids.
- **Bullet-asteroid same-frame double hit:** If a bullet passes through a small asteroid in a single frame, it might miss. Use swept collision (check along the bullet's path) for fast bullets.
- **Wrap-around collision edge case:** Objects near screen edges need to check collisions across the wrap boundary. For an object at x=126, check collision with objects at x=2 (effectively adjacent).
- **Max objects on screen:** Cap total objects (asteroids + bullets + particles + saucer) to avoid frame drops. Suggested max: ~25 active objects.
- **Frame rate consistency:** Use `millis()` delta timing, not fixed frame assumptions. If a frame takes longer (garbage collection, I²C stall), physics should still be correct.
- **Score overflow:** uint32_t caps at ~4.3 billion. Not realistically reachable in 5 minutes, but guard against it anyway.
- **Simultaneous fire + thrust:** The player may be slamming the joystick forward (thrust zone) while mashing fire. Make sure input handling reads all inputs at the start of each frame, not sequentially with blocking.
- **Rapid fire exploit:** Without a cooldown, a mechanical button can be toggled extremely fast. Enforce minimum 150ms between bullets.
- **Pause during invincibility:** If player double-clicks to pause during the 2-second respawn invincibility, the invincibility timer should pause too — don't let them exploit a free safe period.
- **Double-click false positives:** The 300ms double-click window must not interfere with menu navigation. On menu screens, use single-click for selection. Only require double-click during active gameplay.

### Display

- **Flickering:** Use a frame buffer (Adafruit SSD1306 library supports this). Draw everything to the buffer, then push the whole buffer at once. Never draw directly to the screen.
- **Object clipping at edges:** When drawing an asteroid partially off-screen, the wrapping logic should render the visible portion on both sides of the screen.
- **Font rendering:** Use the smallest built-in font (5×7) for the HUD. Don't use custom fonts — they eat flash memory.
- **Screen tearing at high speeds:** The SSD1306 at 400kHz I²C can push a full frame in ~14ms. At 60fps (16.6ms/frame), you have ~2.6ms for game logic. If that's too tight, target 30fps — still very playable for Asteroids.

---

## 9. Performance Budget

| Task                             | Target time per frame |
| -------------------------------- | --------------------- |
| Input reading                    | < 0.5ms               |
| Game logic (physics, collision)  | < 2ms                 |
| Rendering to buffer              | < 3ms                 |
| Buffer push to OLED (I²C 400kHz) | ~14ms                 |
| **Total**                        | **< 20ms (~50fps)**   |

If frame rate drops below 30fps, reduce particle effects first, then cap asteroid count.

---

## 10. Software Architecture

```
src/
├── main.cpp              // Setup, main loop, state machine
├── game.h / game.cpp     // Core game state, update loop
├── ship.h / ship.cpp     // Ship physics, rendering
├── asteroid.h / asteroid.cpp  // Asteroid behavior, splitting
├── bullet.h / bullet.cpp      // Bullet pool
├── saucer.h / saucer.cpp      // UFO behavior
├── input.h / input.cpp   // Joystick + button reading, debounce
├── display.h / display.cpp    // OLED abstraction, HUD drawing
├── sound.h / sound.cpp   // Buzzer tone queue
├── highscore.h / highscore.cpp  // Preferences-based storage
├── menu.h / menu.cpp     // Menu screens, initial entry
└── config.h              // Pin definitions, tuning constants
```

**Key libraries:**

- `Adafruit_SSD1306` + `Adafruit_GFX` — display driver and graphics primitives
- `Preferences` — non-volatile storage (built into ESP32 core)
- Standard Arduino `analogRead`, `digitalRead`, `tone()`

**Game state machine:**

```
enum GameState {
  STATE_SPLASH,
  STATE_MENU,
  STATE_COUNTDOWN,
  STATE_PLAYING,
  STATE_PAUSED,
  STATE_DEATH_ANIM,
  STATE_GAME_OVER,
  STATE_HIGH_SCORES,
  STATE_ENTER_INITIALS
};
```

---

## 11. Additional Features

### 11.1 Screen Shake

On ship death or large asteroid destruction, offset the entire frame buffer by ±1–2 pixels for 4–6 frames. Cheap, dramatic, and feels amazing on a tiny screen.

### 11.2 Particle System

When an asteroid is destroyed, spawn 4–6 single-pixel particles that fly outward and fade after 10–15 frames. Costs very little performance and adds tons of juice.

### 11.3 Hyperspace Jump (Classic Feature)

Joystick click during gameplay = hyperspace. Ship disappears and reappears at a random location. 20% chance of exploding on re-entry. 5 second cooldown. Adds a risk/reward panic button.

### 11.4 Progressive Asteroid Shapes

As difficulty increases, give asteroids more angular, jagged vertex offsets. Early asteroids look rounder and friendlier; late asteroids look sharp and menacing.

### 11.5 Stats Screen

After game over, show a mini stats breakdown: asteroids destroyed, accuracy (shots fired vs hits), longest streak, time survived. Stored alongside high score.

### 11.6 Attract Mode / Demo

If idle on the main menu for 15 seconds, run an AI demo game (simple: ship rotates toward nearest asteroid and shoots). Classic arcade behavior.

---

## 12. Breadboard Layout Tips

- Use a **full-size breadboard** (830 tie points). The ESP32 dev board straddles the center channel. OLED and joystick go on opposite ends to keep wires short.
- **Secure the OLED** with a small piece of mounting tape or a 3D-printed clip — it'll wobble otherwise.
- **Joystick placement matters** — mount it at the left edge of the breadboard so your left thumb rests naturally on it. Buttons on the right side.
- Keep the **buzzer near the ESP32** to minimize wire length (long wires pick up noise on PWM signals).
- Route **I²C wires (SDA/SCL) away from the buzzer PWM wire** to avoid interference.
- Use **short jumper wires** where possible — long dangling wires are the #1 cause of intermittent bugs on breadboards.
- If you want to tidy things up later, a **perfboard solder job** is the natural next step from breadboard without needing to design a full PCB.

---
