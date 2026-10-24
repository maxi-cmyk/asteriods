#include "core/scoring.h"

static const uint8_t MULTIPLIER_MAX = 5;
static const uint8_t KILLS_PER_MULTIPLIER = 3;

void score_reset(ScoringState *state) {
    state->multiplier = 1;
    state->chain_kills = 0;
    state->chain_active = false;
    state->last_kill_ms = 0;
}

void score_update(ScoringState *state, unsigned long game_ms) {
    if (state->chain_active
        && game_ms - state->last_kill_ms >= SCORE_CHAIN_WINDOW_MS) {
        score_reset(state);
    }
}

uint32_t
score_award(ScoringState *state, uint32_t base_points, unsigned long game_ms) {
    score_update(state, game_ms);

    if (!base_points) {
        return 0;
    }

    uint32_t awarded = base_points * state->multiplier;
    state->last_kill_ms = game_ms;
    state->chain_active = true;

    if (state->multiplier < MULTIPLIER_MAX) {
        state->chain_kills++;
        if (state->chain_kills == KILLS_PER_MULTIPLIER) {
            state->multiplier++;
            state->chain_kills = 0;
        }
    }

    return awarded;
}

unsigned long score_chain_left(const ScoringState *state,
                               unsigned long game_ms) {
    if (!state->chain_active
        || game_ms - state->last_kill_ms >= SCORE_CHAIN_WINDOW_MS) {
        return 0;
    }

    return SCORE_CHAIN_WINDOW_MS - (game_ms - state->last_kill_ms);
}
