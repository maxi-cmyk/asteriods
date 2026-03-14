#pragma once
#include <Arduino.h>
#include <Adafruit_SSD1306.h>

enum AsteroidSize { AST_LARGE, AST_MEDIUM, AST_SMALL };

struct Asteroid {
  float x, y;
  float vx, vy;
  float angle;         // current rotation (radians)
  float rotSpeed;      // radians per frame, can be negative
  uint8_t numVerts;    // 6–8
  int8_t  offsets[8];  // per-vertex radius tweak for irregular look
  AsteroidSize size;
  uint8_t radius;
  bool active;
};

void     asteroidsInit();
void     asteroidsUpdate(unsigned long elapsedMs);
void     asteroidsDraw(Adafruit_SSD1306& display);

// Circle–circle collision against ship position + radius
bool     asteroidHitsShip(float sx, float sy);

// Call when a bullet at (bx, by) should test all asteroids.
// Returns points scored (0 = no hit). Handles splitting internally.
uint32_t asteroidsHitBullet(float bx, float by);

int      asteroidActiveCount();

// Find nearest asteroid to (sx,sy). Returns true if found, sets outX/outY.
bool     asteroidNearest(float sx, float sy, float& outX, float& outY);
