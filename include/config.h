#pragma once

// ── Pin Definitions ──────────────────────────
#define PIN_JOY_X     34
#define PIN_JOY_Y     35
#define PIN_JOY_CLK   32
#define PIN_FIRE      25
#define PIN_BUZZER    27

// ── Display ──────────────────────────────────
#define SCREEN_W      128
#define SCREEN_H      64
#define OLED_ADDR     0x3C
#define HUD_HEIGHT    10
#define PLAY_AREA_Y   HUD_HEIGHT
#define PLAY_AREA_H   (SCREEN_H - HUD_HEIGHT)

// ── Ship ─────────────────────────────────────
#define SHIP_RADIUS     3
#define SHIP_DRAG       0.98f
#define SHIP_THRUST     0.2f     // acceleration in thrust zone
#define SHIP_CRUISE_MAX 0.03f    // acceleration per frame at full deflection
#define SHIP_ROTATE_SPD 0.06f    // radians/frame at full deflection
#define SHIP_MAX_SPEED  1.6f
#define SHIP_INVINCIBLE_MS 2000

// ── Joystick ─────────────────────────────────
#define JOY_DEADZONE      30     // percent
#define JOY_THRUST_ZONE   85     // percent deflection for thrust
#define JOY_SMOOTH_SAMPLES 4
#define JOY_CLICK_FREEZE_MS 50   // ignore axis after click (wobble fix)

// ── Buttons ──────────────────────────────────
#define DEBOUNCE_MS       50
#define DBLCLICK_WINDOW   300    // ms for double-click pause

// ── Bullets ──────────────────────────────────
#define BULLET_SPEED    5.0f
#define BULLET_LIFETIME 40       // frames
#define BULLET_MAX      4
#define BULLET_COOLDOWN 150      // ms

// ── Asteroids ────────────────────────────────
#define ASTEROID_LARGE_R   11
#define ASTEROID_MEDIUM_R  6
#define ASTEROID_SMALL_R   4
#define ASTEROID_MAX       15
#define ASTEROID_INITIAL   3     // large asteroids at game start
#define ASTEROID_VERTICES  8
#define SPAWN_SAFE_DIST    30    // min pixels from ship
#define ASTEROID_SPEED_MIN 0.15f
#define ASTEROID_SPEED_MAX 0.4f
#define ASTEROID_ROT_MAX   0.03f // max rotation speed (rad/frame)

// ── Difficulty Scaling (5 tiers over 5 minutes) ──
#define DIFFICULTY_LEVELS    5
#define DIFFICULTY_INTERVAL  60000  // ms per tier (60 seconds)

// ── Scoring ──────────────────────────────────
#define STREAK_WINDOW   3000     // ms to maintain streak
#define SCORE_LARGE     20
#define SCORE_MEDIUM    50
#define SCORE_SMALL     100

// ── Game ─────────────────────────────────────
#define LIVES_START     3
#define GAME_DURATION   300000   // 5 minutes in ms
#define RESPAWN_INV     2000     // invincibility ms

// ── Timing ───────────────────────────────────
#define TARGET_FPS      50
#define FRAME_TIME_MS   (1000 / TARGET_FPS)

// ── Saucer (UFO) ─────────────────────────────
#define SAUCER_LARGE_R        4       // half-width (8px wide)
#define SAUCER_SMALL_R        3       // half-width (5px wide)
#define SAUCER_SPEED          0.3f    // px/frame horizontal
#define SAUCER_FIRE_INTERVAL  2000    // ms between shots
#define SAUCER_DURATION       8000    // ms on screen before exit
#define SAUCER_SPAWN_MIN      45000   // min ms between spawns
#define SAUCER_SPAWN_MAX      60000   // max ms between spawns
#define SAUCER_FIRST_APPEAR   60000   // elapsedMs before first saucer (1:00)
#define SAUCER_SMALL_APPEAR   150000  // elapsedMs before small saucer (2:30)
#define SCORE_SAUCER_LARGE    200
#define SCORE_SAUCER_SMALL    1000
#define SAUCER_BULLET_SPEED   1.5f
#define SAUCER_BULLET_LIFETIME 60     // frames

// ── Buzzer ───────────────────────────────────
#define BUZZ_CHANNEL    0
#define BUZZ_FREQ       1000
#define BUZZ_RES        8
