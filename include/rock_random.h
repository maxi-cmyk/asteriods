#pragma once

#include <Arduino.h>

bool rock_random_init();
uint32_t rock_random_bounded(uint32_t upper);
long rock_random_range(long lower, long upper);
