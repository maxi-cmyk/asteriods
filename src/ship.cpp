#include "ship.h"
#include "config.h"

#define SHIP_Y  (SCREEN_H - 8)   // fixed vertical position near bottom

void shipInit(Ship& ship) {
  ship.x     = SCREEN_W / 2.0f;
  ship.y     = SHIP_Y;
  ship.vx    = 0;
  ship.vy    = 0;
  ship.angle = 0;        // tip always points up
  ship.thrusting  = false;
  ship.alive      = true;
  ship.invincible = true;
  ship.invincibleUntil = millis() + SHIP_INVINCIBLE_MS;
  ship.diedAt = 0;
  ship.lives  = LIVES_START;
}

void shipUpdate(Ship& ship, float joyX) {
  if (!ship.alive) return;

  // 1. Direct Snappy Movement (X-axis only, no friction)
  if (joyX != 0.0f) {
    ship.x += joyX * SHIP_MAX_SPEED;
  }
  
  // 3. Reset velocity as we're not using it anymore for sliding
  ship.vx = 0.0f;
  ship.vy = 0.0f;

  // 4. Hard border clamps
  if (ship.x < SHIP_RADIUS) {
    ship.x = SHIP_RADIUS;
  }
  if (ship.x >= SCREEN_W - SHIP_RADIUS) {
    ship.x = SCREEN_W - SHIP_RADIUS;
  }

  // Invincibility timer
  if (ship.invincible && millis() >= ship.invincibleUntil) {
    ship.invincible = false;
  }
}

void shipWrap(Ship& ship) {
  // Unused
}

void shipDraw(Ship& ship, Adafruit_SSD1306& display) {
  if (!ship.alive) return;

  // Blink during invincibility
  if (ship.invincible && (millis() / 100) % 2 == 0) return;

  // angle = 0 always: cosA = 1, sinA = 0 → tip points straight up
  float noseLen    = SHIP_RADIUS + 2;
  float wingLen    = SHIP_RADIUS + 1;
  float wingSpread = SHIP_RADIUS;

  int nx = (int)(ship.x);
  int ny = (int)(ship.y - noseLen);
  int lx = (int)(ship.x - wingSpread);
  int ly = (int)(ship.y + wingLen);
  int rx = (int)(ship.x + wingSpread);
  int ry = (int)(ship.y + wingLen);

  display.drawTriangle(nx, ny, lx, ly, rx, ry, SSD1306_WHITE);
}

void shipDie(Ship& ship) {
  ship.alive  = false;
  ship.diedAt = millis();
  ship.lives--;
  ship.vx = 0;
}

void shipRespawn(Ship& ship) {
  ship.x     = SCREEN_W / 2.0f;
  ship.y     = SHIP_Y;
  ship.vx    = 0;
  ship.vy    = 0;
  ship.angle = 0;
  ship.thrusting  = false;
  ship.alive      = true;
  ship.invincible = true;
  ship.invincibleUntil = millis() + SHIP_INVINCIBLE_MS;
}
