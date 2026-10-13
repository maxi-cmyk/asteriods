#pragma once
#include <Arduino.h>
void highscoreInit();
uint32_t highscoreBest();
bool highscoreRecord(uint32_t score);
