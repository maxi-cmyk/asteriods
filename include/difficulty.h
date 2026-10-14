#pragma once

#include <Arduino.h>

struct WaveDifficulty {
    float speed;
    unsigned long spawn_interval_ms;
    uint8_t population;
    float drift;
    uint8_t pattern_level;
    unsigned long recovery_ms;
};

WaveDifficulty difficulty_for_wave(uint16_t wave);
