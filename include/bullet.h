#pragma once
#include <Arduino.h>
#include <Adafruit_SSD1306.h>

struct Bullet {
  float   x, y;
  uint8_t framesLeft;
  bool    active;
};

void     bulletsInit();
void     bulletsUpdate();
void     bulletsDraw(Adafruit_SSD1306& display);

// Attempt to fire from (x, y). Enforces cooldown + BULLET_MAX cap.
// Returns true if a bullet was spawned.
bool     bulletsFire(float x, float y);

// Test every active bullet against all asteroids.
// Deactivates bullets that connect. Returns total points scored.
uint32_t bulletsCheckAsteroids();

// Test every active bullet against the saucer.
// Deactivates bullet on hit. Returns points scored (0 = no hit).
uint32_t bulletsCheckSaucer();
