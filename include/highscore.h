#pragma once

#include <Arduino.h>

void highscore_init();
uint32_t highscore_best();
bool highscore_record(uint32_t score);
