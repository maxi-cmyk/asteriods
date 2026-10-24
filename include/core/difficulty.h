#ifndef ASTEROIDS_CORE_DIFFICULTY_H
#define ASTEROIDS_CORE_DIFFICULTY_H

#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    float speed;
    unsigned long spawn_interval_ms;
    uint8_t population;
    float drift;
    uint8_t pattern_level;
    unsigned long recovery_ms;
} WaveDifficulty;

WaveDifficulty core_difficulty_for_wave(uint16_t wave);

#ifdef __cplusplus
}
#endif
#endif
