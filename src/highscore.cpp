#include "highscore.h"
#include <Preferences.h>

static const char *TABLE_KEY = "scores-v3";
static const uint8_t TABLE_VERSION = 1;
static const int RECORD_HEADER = 2;
static const int ENTRY_BYTES = 8;
static const int RECORD_BYTES
        = RECORD_HEADER + HIGHSCORE_CAPACITY * ENTRY_BYTES;
static HighScoreEntry table[HIGHSCORE_CAPACITY] = {};
static int entry_count = 0;

static bool valid_initials(const char *initials) {
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

static bool decode_record(const uint8_t *record) {
    if (record[0] != TABLE_VERSION || record[1] > HIGHSCORE_CAPACITY) {
        return false;
    }
    HighScoreEntry loaded[HIGHSCORE_CAPACITY] = {};
    for (int i = 0; i < HIGHSCORE_CAPACITY; i++) {
        int offset = RECORD_HEADER + i * ENTRY_BYTES;
        for (int byte = 0; byte < 4; byte++) {
            loaded[i].score |= uint32_t(record[offset + byte]) << (8 * byte);
            loaded[i].initials[byte] = char(record[offset + 4 + byte]);
        }
        if (i < record[1]) {
            if (!loaded[i].score || loaded[i].score > HIGHSCORE_MAX
                || !valid_initials(loaded[i].initials)
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
    memcpy(table, loaded, sizeof(table));
    entry_count = record[1];
    return true;
}

void highscore_init() {
    memset(table, 0, sizeof(table));
    entry_count = 0;
    Preferences preferences = {};
    if (!preferences.begin("asteroids", true)) {
        return;
    }
    uint8_t record[RECORD_BYTES] = {};
    if (preferences.getBytesLength(TABLE_KEY) == sizeof(record)
        && preferences.getBytes(TABLE_KEY, record, sizeof(record))
                   == sizeof(record)) {
        decode_record(record);
    }
    preferences.end();
}

uint32_t highscore_best() {
    return entry_count ? table[0].score : 0;
}

int highscore_count() {
    return entry_count;
}

const HighScoreEntry *highscore_entries() {
    return table;
}

bool highscore_qualifies(uint32_t score) {
    return score > 0 && score <= HIGHSCORE_MAX
           && (entry_count < HIGHSCORE_CAPACITY
               || score > table[HIGHSCORE_CAPACITY - 1].score);
}

static bool save_table(const HighScoreEntry *candidate, int count) {
    uint8_t record[RECORD_BYTES] = {};
    record[0] = TABLE_VERSION;
    record[1] = count;
    for (int i = 0; i < count; i++) {
        int offset = RECORD_HEADER + i * ENTRY_BYTES;
        for (int byte = 0; byte < 4; byte++) {
            record[offset + byte] = candidate[i].score >> (8 * byte);
            record[offset + 4 + byte] = candidate[i].initials[byte];
        }
    }
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
    if (!highscore_qualifies(score) || !valid_initials(initials)) {
        return -1;
    }
    int rank = 0;
    while (rank < entry_count && table[rank].score >= score) {
        rank++;
    }
    HighScoreEntry candidate[HIGHSCORE_CAPACITY] = {};
    memcpy(candidate, table, sizeof(table));
    for (int i = HIGHSCORE_CAPACITY - 1; i > rank; i--) {
        candidate[i] = candidate[i - 1];
    }
    candidate[rank].score = score;
    memcpy(candidate[rank].initials, initials, 4);
    int count = min(entry_count + 1, HIGHSCORE_CAPACITY);
    if (!save_table(candidate, count)) {
        return -1;
    }
    memcpy(table, candidate, sizeof(table));
    entry_count = count;
    return rank;
}
