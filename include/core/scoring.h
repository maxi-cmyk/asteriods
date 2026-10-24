#ifndef ASTEROIDS_CORE_SCORING_H
#define ASTEROIDS_CORE_SCORING_H

#include <stdbool.h>
#include <stdint.h>

#define SCORE_CHAIN_WINDOW_MS 3000UL

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    uint8_t multiplier;
    uint8_t chain_kills;
    bool chain_active;
    unsigned long last_kill_ms;
} ScoringState;

void score_reset(ScoringState *state);
void score_update(ScoringState *state, unsigned long game_ms);
uint32_t
score_award(ScoringState *state, uint32_t base_points, unsigned long game_ms);
unsigned long score_chain_left(const ScoringState *state,
                               unsigned long game_ms);

#ifdef __cplusplus
}
#endif
#endif
