#pragma once

#include <Arduino.h>
#include <Adafruit_SSD1306.h>

#define PARTICLE_MAX 30 // enough for several simultaneous explosions

void particles_init();

// Spawn 4-6 particles at (position_x, position_y) flying outward
void particles_spawn(float position_x, float position_y);

void particles_update();
void particles_draw(Adafruit_SSD1306& display);
