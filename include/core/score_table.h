#ifndef ASTEROIDS_CORE_SCORE_TABLE_H
#define ASTEROIDS_CORE_SCORE_TABLE_H

#include <stdbool.h>
#include <stdint.h>

#define HIGHSCORE_CAPACITY 5
#define HIGHSCORE_MAX 999999U
#define SCORE_RECORD_BYTES 42
#define SCORE_RECORD_HEADER 2
#define SCORE_ENTRY_BYTES 8

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    uint32_t score;
    char initials[4];
} HighScoreEntry;

typedef struct {
    HighScoreEntry entries[HIGHSCORE_CAPACITY];
    int count;
} ScoreTable;

bool score_valid_initials(const char *initials);
bool score_decode(ScoreTable *table, const uint8_t *record);
void score_encode(const ScoreTable *table, uint8_t *record);
bool score_qualifies(const ScoreTable *table, uint32_t score);
int score_insert(ScoreTable *table, uint32_t score, const char *initials);

#ifdef __cplusplus
}
#endif
#endif
