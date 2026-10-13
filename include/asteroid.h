#pragma once

#include "config.h"
#include <Arduino.h>
#include <Adafruit_SSD1306.h>

enum AsteroidSize {
    AST_LARGE,
    AST_MEDIUM,
    AST_SMALL
};

struct Asteroid {
    float position_x;
    float position_y;
    float velocity_x;
    float velocity_y;
    float angle;
    float rotation_speed;
    int8_t offsets[ASTEROID_VERTICES];
    AsteroidSize size;
    uint8_t radius;
    bool active;
};

void asteroids_init();
void asteroids_update(unsigned long game_ms);
void asteroids_draw(Adafruit_SSD1306& display);
bool asteroid_hits_ship(float position_x, float position_y);
uint32_t asteroids_hit_bullet(float from_x, float to_x, float position_y);
int asteroid_active_count();
float asteroid_safe_respawn_y();
uint16_t asteroid_wave();
