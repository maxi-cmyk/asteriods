#include "scoring.h"
#include "core/scoring.h"

static ScoringState score_state = {1, 0, false, 0};

void scoring_reset() {
    score_reset(&score_state);
}

void scoring_update(unsigned long game_ms) {
    score_update(&score_state, game_ms);
}

uint32_t scoring_award(uint32_t base_points, unsigned long game_ms) {
    return score_award(&score_state, base_points, game_ms);
}

uint8_t scoring_multiplier() {
    return score_state.multiplier;
}

unsigned long scoring_chain_left(unsigned long game_ms) {
    return score_chain_left(&score_state, game_ms);
}
