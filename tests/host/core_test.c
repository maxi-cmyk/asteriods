#include "core/difficulty.h"
#include "core/score_table.h"
#include "core/scoring.h"
#include <assert.h>
#include <limits.h>

int main(void) {
    ScoringState first = {0};
    ScoringState second = {0};
    score_reset(&first);
    score_reset(&second);
    for (int i = 0; i < 3; i++) {
        assert(score_award(&first, 20, 100) == 20);
    }
    assert(first.multiplier == 2);
    assert(second.multiplier == 1);
    assert(score_award(&second, 20, ULONG_MAX - 10) == 20);
    assert(score_chain_left(&second, 5) == SCORE_CHAIN_WINDOW_MS - 16);
    score_update(&first, 3100);
    assert(first.multiplier == 1);
    assert(second.chain_active);

    ScoreTable table = {0};
    uint8_t record[SCORE_RECORD_BYTES] = {0};
    assert(score_insert(&table, 1234, "ABC") == 0);
    assert(score_insert(&table, 1234, "XYZ") == 1);
    score_encode(&table, record);
    assert(record[0] == 1 && record[1] == 2);
    assert(record[2] == 210 && record[3] == 4);
    assert(record[6] == 'A' && record[9] == 0);
    ScoreTable loaded = {0};
    assert(score_decode(&loaded, record));
    assert(loaded.count == 2 && loaded.entries[1].initials[0] == 'X');
    record[41] = 1;
    assert(!score_decode(&loaded, record));
    assert(loaded.count == 2 && loaded.entries[0].score == 1234);
    assert(score_insert(&loaded, 999999, "BAD!") == -1);
    assert(loaded.count == 2);

    assert(core_difficulty_for_wave(0).speed
           == core_difficulty_for_wave(1).speed);
    assert(core_difficulty_for_wave(24).population
           == core_difficulty_for_wave(65535).population);
    return 0;
}
