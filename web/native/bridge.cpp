#include "Arduino.h"
#include "config.h"
#include "input.h"
#include "display.h"
#include "sound.h"
#include "rock_random.h"

// Compile the production gameplay unchanged. Sharing a translation unit also
// lets the read-only browser snapshot expose state without firmware debug APIs.
#include "../../src/input.cpp"
#ifdef WEB_HD
#define difficulty_for_wave oled_difficulty_for_wave
#include "../../src/difficulty.cpp"
#undef difficulty_for_wave
WaveDifficulty difficulty_for_wave(uint16_t wave) {
    WaveDifficulty result = oled_difficulty_for_wave(wave);
    result.speed *= 3.75f;
    result.drift *= 3.75f;
    return result;
}
#else
#include "../../src/difficulty.cpp"
#endif
#include "../../src/scoring.cpp"
#include "../../src/asteroid.cpp"
#include "../../src/bullet.cpp"
#include "../../src/weapon.cpp"
#include "../../src/ship.cpp"
#include "../../src/powerup.cpp"
#include "../../src/particle.cpp"
#include "../../src/highscore.cpp"
#include "../demo/controller.cpp"
#include "../../src/game.cpp"

unsigned long browser_ms = 0;
int browser_x = 2048, browser_y = 2048;
bool browser_fire = false, browser_click = false;
static bool browser_fire_edge = false;
static unsigned long visual_ms = 0;

extern "C" void *memcpy(void *dest, const void *src, size_t count) {
    auto *d = (uint8_t *)dest;
    auto *s = (const uint8_t *)src;
    for (size_t i = 0; i < count; i++) {
        d[i] = s[i];
    }
    return dest;
}
extern "C" void *memset(void *dest, int value, size_t count) {
    auto *d = (uint8_t *)dest;
    for (size_t i = 0; i < count; i++) {
        d[i] = value;
    }
    return dest;
}

bool rock_random_init() {
    return true;
}
uint32_t rock_random_bounded(uint32_t upper) {
    if (!upper) {
        return 0;
    }
    uint32_t threshold = uint32_t(-upper) % upper;
    for (int i = 0; i < 32; i++) {
        uint32_t value = browser_random();
        if (value >= threshold) {
            return value % upper;
        }
    }
    __builtin_trap();
}
long rock_random_range(long lower, long upper) {
    return upper <= lower ? lower : lower + rock_random_bounded(upper - lower);
}

#ifdef WEB_HD
#include "combat.h"
#include "coop.h"
extern "C" void web_coop_pause(int pause);
#endif
#include "scene.h"

extern "C" {
#include "exports/game.h"
#include "exports/practice.h"
#include "exports/read.h"
#include "exports/coop.h"
#ifdef WEB_TEST
#include "exports/test.h"
#endif
}
