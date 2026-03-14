#pragma once
#include <Arduino.h>
#include <Adafruit_SSD1306.h>

struct Ship {
  float x, y;          // position
  float vx, vy;        // velocity
  float angle;         // facing direction in radians (0 = up)
  bool thrusting;      // in thrust zone this frame
  bool alive;
  bool invincible;
  unsigned long invincibleUntil;
  unsigned long diedAt;
  uint8_t lives;
};

void shipInit(Ship& ship);
void shipUpdate(Ship& ship, float joyX);
void shipDraw(Ship& ship, Adafruit_SSD1306& display);
void shipDie(Ship& ship);
void shipRespawn(Ship& ship);
void shipWrap(Ship& ship);  // screen edge wrapping
