#pragma once

#include <Adafruit_SSD1306.h>

bool display_init();
Adafruit_SSD1306& display_get();
void display_hud(uint8_t lives,
                 uint32_t score,
                 uint8_t multiplier,
                 unsigned long chain_left_ms);
void display_flip();
void display_shake(uint8_t frames);
void display_shake_update();
