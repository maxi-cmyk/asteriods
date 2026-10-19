#pragma once

#include <Arduino.h>
#include <Adafruit_SSD1306.h>

struct PowerupEffects {
    unsigned long multishot_left_ms;
    bool shield;
};

struct Ship;

void powerups_init();
void powerups_drop(float position_x, float position_y);
void powerups_update(Ship& ship);
void powerups_draw(Adafruit_SSD1306& display);
