#pragma once

#include <Arduino.h>
#include "weapon.h"
#include "powerup.h"
#include <Adafruit_SSD1306.h>

struct Ship {
    WeaponState weapon;
    PowerupEffects effects;
    float position_x;
    float position_y;
    bool alive;
    uint8_t lives;
    unsigned long invincible_left;
};

void ship_init(Ship& ship);
void ship_update(Ship& ship, float joystick_x, float joystick_y);
void ship_draw(const Ship& ship,
               Adafruit_SSD1306& display,
               unsigned long game_ms = 0);
void ship_die(Ship& ship);
void ship_respawn(Ship& ship,
                  float position_x,
                  float position_y,
                  unsigned long game_ms = 0);
