#include "core/score_table.h"

static const int TABLE_VERSION = 1;
static const int RECORD_HEADER = 2;
static const int ENTRY_BYTES = 8;

bool score_valid_initials(const char *initials) {
    if (!initials) {
        return false;
    }
    for (int i = 0; i < 3; i++) {
        if (initials[i] < 'A' || initials[i] > 'Z') {
            return false;
        }
    }
    return initials[3] == '\0';
}

bool score_decode(ScoreTable *table, const uint8_t *record) {
    if (record[0] != TABLE_VERSION || record[1] > HIGHSCORE_CAPACITY) {
        return false;
    }
    HighScoreEntry loaded[HIGHSCORE_CAPACITY] = {0};
    for (int i = 0; i < HIGHSCORE_CAPACITY; i++) {
        int offset = RECORD_HEADER + i * ENTRY_BYTES;
        for (int byte = 0; byte < 4; byte++) {
            loaded[i].score |= (uint32_t)record[offset + byte] << (8 * byte);
            loaded[i].initials[byte] = (char)record[offset + 4 + byte];
        }
        if (i < record[1]) {
            if (!loaded[i].score || loaded[i].score > HIGHSCORE_MAX
                || !score_valid_initials(loaded[i].initials)
                || (i > 0 && loaded[i].score > loaded[i - 1].score)) {
                return false;
            }
        } else {
            for (int byte = 0; byte < ENTRY_BYTES; byte++) {
                if (record[offset + byte] != 0) {
                    return false;
                }
            }
        }
    }
    for (int i = 0; i < HIGHSCORE_CAPACITY; i++) {
        table->entries[i] = loaded[i];
    }
    table->count = record[1];
    return true;
}

void score_encode(const ScoreTable *table, uint8_t *record) {
    for (int i = 0; i < SCORE_RECORD_BYTES; i++) {
        record[i] = 0;
    }
    record[0] = TABLE_VERSION;
    record[1] = table->count;
    for (int i = 0; i < table->count; i++) {
        int offset = RECORD_HEADER + i * ENTRY_BYTES;
        for (int byte = 0; byte < 4; byte++) {
            record[offset + byte] = table->entries[i].score >> (8 * byte);
            record[offset + 4 + byte] = table->entries[i].initials[byte];
        }
    }
}

bool score_qualifies(const ScoreTable *table, uint32_t score) {
    return score > 0 && score <= HIGHSCORE_MAX
           && (table->count < HIGHSCORE_CAPACITY
               || score > table->entries[HIGHSCORE_CAPACITY - 1].score);
}

int score_insert(ScoreTable *table, uint32_t score, const char *initials) {
    if (!score_qualifies(table, score) || !score_valid_initials(initials)) {
        return -1;
    }
    int rank = 0;
    while (rank < table->count && table->entries[rank].score >= score) {
        rank++;
    }
    HighScoreEntry candidate[HIGHSCORE_CAPACITY] = {0};
    for (int i = 0; i < HIGHSCORE_CAPACITY; i++) {
        candidate[i] = table->entries[i];
    }
    for (int i = HIGHSCORE_CAPACITY - 1; i > rank; i--) {
        candidate[i] = candidate[i - 1];
    }
    candidate[rank].score = score;
    for (int i = 0; i < 4; i++) {
        candidate[rank].initials[i] = initials[i];
    }
    int count = table->count < HIGHSCORE_CAPACITY ? table->count + 1
                                                  : HIGHSCORE_CAPACITY;
    for (int i = 0; i < HIGHSCORE_CAPACITY; i++) {
        table->entries[i] = candidate[i];
    }
    table->count = count;
    return rank;
}
