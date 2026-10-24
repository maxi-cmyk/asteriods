#include "highscore.h"
#include <Preferences.h>

static const char *TABLE_KEY = "scores-v3";
static ScoreTable score_table = {};

void highscore_init() {
    score_table = {};
    Preferences preferences = {};
    if (!preferences.begin("asteroids", true)) {
        return;
    }
    uint8_t record[SCORE_RECORD_BYTES] = {};
    if (preferences.getBytesLength(TABLE_KEY) == sizeof(record)
        && preferences.getBytes(TABLE_KEY, record, sizeof(record))
                   == sizeof(record)) {
        score_decode(&score_table, record);
    }
    preferences.end();
}

uint32_t highscore_best() {
    return score_table.count ? score_table.entries[0].score : 0;
}

int highscore_count() {
    return score_table.count;
}

const HighScoreEntry *highscore_entries() {
    return score_table.entries;
}

bool highscore_qualifies(uint32_t score) {
    return score_qualifies(&score_table, score);
}

static bool save_table(const ScoreTable *candidate) {
    uint8_t record[SCORE_RECORD_BYTES] = {};
    score_encode(candidate, record);
    Preferences preferences = {};
    if (!preferences.begin("asteroids", false)) {
        return false;
    }
    bool saved = preferences.putBytes(TABLE_KEY, record, sizeof(record))
                 == sizeof(record);
    preferences.end();
    return saved;
}

int highscore_record(uint32_t score, const char *initials) {
    // Commit memory only after persistence succeeds, preserving retry behavior.
    ScoreTable candidate = score_table;
    int rank = score_insert(&candidate, score, initials);
    if (rank < 0 || !save_table(&candidate)) {
        return -1;
    }
    score_table = candidate;
    return rank;
}
