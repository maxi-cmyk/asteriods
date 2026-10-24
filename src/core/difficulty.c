#include "core/difficulty.h"

typedef struct {
    uint16_t wave;
    float speed;
    unsigned long spawn_interval_ms;
    uint8_t population;
    float drift;
} DifficultyAnchor;

// Wave, speed (px/update), spawn gap (ms), large-rock count, max drift.
static const DifficultyAnchor DIFFICULTY_ANCHORS[]
        = {{1, 0.34f, 2000, 3, 0.02f},
           {3, 0.40f, 1800, 4, 0.03f},
           {4, 0.42f, 1700, 4, 0.04f},
           {7, 0.55f, 1400, 5, 0.06f},
           {8, 0.57f, 1350, 5, 0.07f},
           {12, 0.72f, 1100, 6, 0.09f},
           {13, 0.74f, 1050, 6, 0.10f},
           {24, 0.85f, 900, 8, 0.12f}};
static const int DIFFICULTY_ANCHOR_COUNT
        = sizeof(DIFFICULTY_ANCHORS) / sizeof(DIFFICULTY_ANCHORS[0]);
static const unsigned long WAVE_RECOVERY_MS = 1500;

WaveDifficulty core_difficulty_for_wave(uint16_t wave) {
    if (wave < 1) {
        wave = 1;
    }
    int upper = 1;

    // Find the neighboring tuning anchors for this wave.
    while (upper < DIFFICULTY_ANCHOR_COUNT - 1
           && wave > DIFFICULTY_ANCHORS[upper].wave) {
        upper++;
    }

    const DifficultyAnchor *start = &DIFFICULTY_ANCHORS[upper - 1];
    const DifficultyAnchor *end = &DIFFICULTY_ANCHORS[upper];
    // Blend between anchors; cap difficulty at the wave-24 settings.
    float progress
            = (float)(wave - start->wave) / (float)(end->wave - start->wave);
    if (progress > 1.0f) {
        progress = 1.0f;
    }
    WaveDifficulty result = {0};
    result.speed = start->speed + progress * (end->speed - start->speed);
    result.spawn_interval_ms = start->spawn_interval_ms
                               - (unsigned long)(progress
                                                 * (start->spawn_interval_ms
                                                    - end->spawn_interval_ms));
    // Round down the rock count to a whole number.
    result.population
            = start->population
              + (uint8_t)(progress * (end->population - start->population));
    result.drift = start->drift + progress * (end->drift - start->drift);
    // Unlock alternating heights at wave 4 and staggered pairs at wave 8.
    if (wave >= 12) {
        result.pattern_level = 3;
    } else if (wave >= 8) {
        result.pattern_level = 2;
    } else if (wave >= 4) {
        result.pattern_level = 1;
    }
    result.recovery_ms = WAVE_RECOVERY_MS;
    return result;
}
