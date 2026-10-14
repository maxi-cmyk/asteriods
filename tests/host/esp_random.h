#pragma once

#include <cstdint>
#include <deque>

inline std::deque<uint32_t> random_words = {};
inline uint32_t random_test_state = 12345;
inline unsigned random_word_reads = 0;
inline uint32_t esp_random() {
    random_word_reads++;
    if (!random_words.empty()) {
        uint32_t value = random_words.front();
        random_words.pop_front();
        return value;
    }

    // Deterministic fake for host tests only; never used by device firmware.
    random_test_state = random_test_state * 1664525U + 1013904223U;
    return random_test_state;
}
