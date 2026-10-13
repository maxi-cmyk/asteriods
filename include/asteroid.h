#pragma once
#include <Arduino.h>
#include <Adafruit_SSD1306.h>
enum AsteroidSize { AST_LARGE, AST_MEDIUM, AST_SMALL };
struct Asteroid {
  float x, y, vx, vy, angle, rotSpeed;
  int8_t offsets[8];
  AsteroidSize size;
  uint8_t radius;
  bool active;
};
void asteroidsInit();
void asteroidsUpdate(unsigned long gameMs);
void asteroidsDraw(Adafruit_SSD1306& display);
bool asteroidHitsShip(float x, float y);
uint32_t asteroidsHitBullet(float fromX, float toX, float y);
int asteroidActiveCount();
float asteroidSafeRespawnY();
uint16_t asteroidWave();
