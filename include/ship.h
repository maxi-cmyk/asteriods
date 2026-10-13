#pragma once
#include <Arduino.h>
#include <Adafruit_SSD1306.h>
struct Ship {
  float x, y;
  bool alive;
  uint8_t lives;
  unsigned long invincibleLeft;
};
void shipInit(Ship& ship);
void shipUpdate(Ship& ship, float joyY);
void shipDraw(const Ship& ship, Adafruit_SSD1306& display);
void shipDie(Ship& ship);
void shipRespawn(Ship& ship, float y);
