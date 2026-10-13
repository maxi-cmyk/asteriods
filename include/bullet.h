#pragma once
#include <Arduino.h>
#include <Adafruit_SSD1306.h>
struct Bullet { float x, previousX, y; bool active; };
void bulletsInit();
bool bulletsFire(float x, float y);
void bulletsUpdate();
void bulletsDraw(Adafruit_SSD1306& display);
uint32_t bulletsCheckAsteroids();
