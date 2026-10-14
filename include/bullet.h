#pragma once

#include <Arduino.h>
#include <Adafruit_SSD1306.h>

struct Bullet {
    float position_x;
    float previous_x;
    float position_y;
    bool active;
};

void bullets_init();
bool bullets_fire(float position_x, float position_y);
void bullets_update();
void bullets_draw(Adafruit_SSD1306& display);
using AsteroidHitHandler = void (*)(uint32_t base_points);
uint32_t bullets_check_asteroids(AsteroidHitHandler on_hit = nullptr);
