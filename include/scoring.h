#pragma once

#include <Arduino.h>

void scoring_reset();
void scoring_update(unsigned long game_ms);
uint32_t scoring_award(uint32_t base_points, unsigned long game_ms);
uint8_t scoring_multiplier();
unsigned long scoring_chain_left(unsigned long game_ms);
