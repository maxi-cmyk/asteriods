#pragma once

// Hardware pins
#define PIN_JOY_X 34
#define PIN_JOY_Y 35
#define PIN_JOY_CLK 32
#define PIN_FIRE 25
#define PIN_BUZZER 27

// Display
#define SCREEN_W 128
#define SCREEN_H 64
#define OLED_ADDR 0x3C
#define HUD_HEIGHT 10
#define PLAY_AREA_Y HUD_HEIGHT

// Ship movement and protection
#define SHIP_RADIUS 3
#define SHIP_X 12
#define SHIP_MAX_SPEED 1.3f
#define SHIP_INVINCIBLE_MS 2000

// Joystick and button input
#define JOY_DEADZONE 30
#define JOY_SMOOTH_SAMPLES 4
#define JOY_CLICK_FREEZE_MS 50
#define DEBOUNCE_MS 20
#define DBLCLICK_WINDOW 300

// Bullets
#define BULLET_SPEED 5.0f
#define BULLET_MAX 12

// Weapon heat (fixed-point milliunits preserve fractional cooling).
#define WEAPON_HEAT_MAX 120
#define WEAPON_HEAT_PER_SHOT 20
#define WEAPON_HEAT_SCALE 1000UL
#define WEAPON_COOL_PER_SECOND 20UL
#define WEAPON_COOL_DELAY_MS 250UL
#define WEAPON_RECOVERY_MS 2000UL
#define WEAPON_OVERHEAT_SHOT_MS 500UL
#define WEAPON_OVERHEAT_SPEED 0.3f
#define WEAPON_BLINK_MS 100UL

// Asteroid pools and sizes
#define ASTEROID_LARGE_R 9
#define ASTEROID_MEDIUM_R 5
#define ASTEROID_SMALL_R 3
#define ASTEROID_MAX 24

// Scoring and lives
#define SCORE_LARGE 20
#define SCORE_MEDIUM 50
#define SCORE_SMALL 100
#define LIVES_START 3

// Frame timing
#define TARGET_FPS 50
#define FRAME_TIME_MS (MILLISECONDS_PER_SECOND / TARGET_FPS)

// Buzzer
#define BUZZ_CHANNEL 0
#define BUZZ_FREQ 1000
#define BUZZ_RES 8

// Shape dimensions and spacing, in pixels.
#define SHIP_NOSE_OFFSET 5
#define SHIP_TAIL_OFFSET 3
#define SHIP_BULLET_OFFSET 6
#define SHIP_TOP_GAP 1
#define SHIP_BOTTOM_GAP 2
#define HEAT_BAR_WIDTH 9
#define HEAT_BAR_HEIGHT 3
#define HEAT_BAR_HALF_WIDTH (HEAT_BAR_WIDTH / 2)
#define HEAT_BAR_GAP 2
#define HEAT_BAR_Y_OFFSET (SHIP_RADIUS + HEAT_BAR_GAP)
#define SHIP_MIN_X HEAT_BAR_HALF_WIDTH
#define SHIP_MAX_X (SCREEN_W - 1 - SHIP_NOSE_OFFSET)
#define SHIP_MIN_Y (HUD_HEIGHT + SHIP_RADIUS + SHIP_TOP_GAP)
#define SHIP_MAX_Y                                                             \
    (SCREEN_H - HEAT_BAR_Y_OFFSET - HEAT_BAR_HEIGHT - SHIP_BOTTOM_GAP)
#define SHIP_BLINK_MS 100
#define BULLET_DRAW_LENGTH 3
#define ASTEROID_VERTICES 8
#define MILLISECONDS_PER_SECOND 1000
