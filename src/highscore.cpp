#include "highscore.h"
#include <Preferences.h>

static uint32_t best = 0;

void highscore_init() {
    Preferences preferences = {};
    preferences.begin("asteroids", true);
    best = preferences.getUInt("best-v2", 0);
    preferences.end();
}

uint32_t highscore_best() {
    return best;
}

bool highscore_record(uint32_t score) {
    if (score <= best) {
        return false;
    }

    best = score;

    Preferences preferences = {};
    preferences.begin("asteroids", false);
    preferences.putUInt("best-v2", best);
    preferences.end();
    return true;
}
