#pragma once

#include <Arduino.h>

static const int HIGHSCORE_CAPACITY = 5;
static const uint32_t HIGHSCORE_MAX = 999999;

struct HighScoreEntry {
    uint32_t score;
    char initials[4];
};

void highscore_init();
uint32_t highscore_best();
int highscore_count();
const HighScoreEntry *highscore_entries();
bool highscore_qualifies(uint32_t score);
// Returns the saved rank, or -1 on invalid input or a storage failure.
int highscore_record(uint32_t score, const char *initials);
