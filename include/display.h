#pragma once
#include <Adafruit_SSD1306.h>
bool displayInit();
Adafruit_SSD1306& displayGet();
void displayHUD(uint8_t lives, uint32_t score);
void displayFlip();
void displayShake(uint8_t frames);
void displayShakeUpdate();
