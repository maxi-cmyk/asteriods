#pragma once

#include <Arduino.h>
#include <Adafruit_SSD1306.h>

struct Ship {
    float position_x;
    float position_y;
    bool alive;
    uint8_t lives;
    unsigned long invincible_left;
};

void ship_init(Ship& ship);
void ship_update(Ship& ship, float joystick_x, float joystick_y);
void ship_draw(const Ship& ship, Adafruit_SSD1306& display);
void ship_die(Ship& ship);
void ship_respawn(Ship& ship, float position_x, float position_y);
