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
#define SHIP_BLINK_MS 100
#define BULLET_DRAW_LENGTH 3
#define ASTEROID_VERTICES 8
#define MILLISECONDS_PER_SECOND 1000
