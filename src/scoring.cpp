#include "scoring.h"

static const uint8_t MULTIPLIER_MAX = 5;
static const uint8_t KILLS_PER_MULTIPLIER = 3;
static const unsigned long CHAIN_WINDOW_MS = 3000;
static uint8_t multiplier = 1;
static uint8_t chain_kills = 0;
static bool chain_active = false;
static unsigned long last_kill_ms = 0;

void scoring_reset() {
    multiplier = 1;
    chain_kills = 0;
    chain_active = false;
    last_kill_ms = 0;
}

void scoring_update(unsigned long game_ms) {
    if (chain_active && game_ms - last_kill_ms >= CHAIN_WINDOW_MS) {
        scoring_reset();
    }
}

uint32_t scoring_award(uint32_t base_points, unsigned long game_ms) {
    scoring_update(game_ms);

    if (!base_points) {
        return 0;
    }

    uint32_t awarded = base_points * multiplier;
    last_kill_ms = game_ms;
    chain_active = true;

    if (multiplier < MULTIPLIER_MAX) {
        chain_kills++;
        if (chain_kills == KILLS_PER_MULTIPLIER) {
            multiplier++;
            chain_kills = 0;
        }
    }

    return awarded;
}

uint8_t scoring_multiplier() {
    return multiplier;
}

unsigned long scoring_chain_left(unsigned long game_ms) {
    if (!chain_active || game_ms - last_kill_ms >= CHAIN_WINDOW_MS) {
        return 0;
    }

    return CHAIN_WINDOW_MS - (game_ms - last_kill_ms);
}
