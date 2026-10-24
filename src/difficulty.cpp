#include "difficulty.h"

WaveDifficulty difficulty_for_wave(uint16_t wave) {
    return core_difficulty_for_wave(wave);
}
