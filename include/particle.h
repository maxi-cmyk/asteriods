#pragma once
#include <Arduino.h>
#include <Adafruit_SSD1306.h>

#define PARTICLE_MAX 30  // enough for several simultaneous explosions

// Spawn 4-6 particles at (x, y) flying outward
void particlesSpawn(float x, float y);

void particlesUpdate();
void particlesDraw(Adafruit_SSD1306& display);
