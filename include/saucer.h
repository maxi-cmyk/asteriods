#pragma once
#include <Arduino.h>
#include <Adafruit_SSD1306.h>

enum SaucerType { SAUCER_LARGE, SAUCER_SMALL };

// Reset saucer state (call on game start)
void saucerInit();

// Spawn timing, movement, auto-fire.
// elapsedMs = time since game start; shipX/Y = player position for aimed shots.
void saucerUpdate(unsigned long elapsedMs, float shipX, float shipY);

// Render saucer + its bullets
void saucerDraw(Adafruit_SSD1306& display);

// Returns true if any saucer bullet hits the ship at (sx, sy)
bool saucerHitsShip(float sx, float sy);

// Test if a player bullet at (bx, by) hits the saucer.
// Returns points scored (0 = no hit). Deactivates saucer on hit.
uint32_t saucerHitByBullet(float bx, float by);

// True if the saucer is currently on screen
bool saucerIsActive();
