#include "rock_random.h"
#include <WiFi.h>
#include <esp_random.h>
#include <cstdlib>

static bool entropy_ready = false;
static const int RANDOM_REJECTION_LIMIT = 32;

bool rock_random_init() {
    // RF provides continuous entropy without taking over the joystick ADC.
    // No credentials, association, scanning, or network service is needed.
    WiFi.persistent(false);
    WiFi.setAutoReconnect(false);
    entropy_ready = WiFi.mode(WIFI_STA) && WiFi.setSleep(false);
    return entropy_ready;
}

uint32_t rock_random_bounded(uint32_t upper) {
    if (!entropy_ready) {
        abort();
    }

    if (!upper) {
        return 0;
    }

    // Reject the incomplete interval at the bottom of the 32-bit range.
    uint32_t threshold = uint32_t(-upper) % upper;

    for (int attempt = 0; attempt < RANDOM_REJECTION_LIMIT; attempt++) {
        uint32_t value = esp_random();
        if (value >= threshold) {
            return value % upper;
        }
    }

    // Never silently substitute a biased result or software PRNG.
    abort();
}

long rock_random_range(long lower, long upper) {
    if (upper <= lower) {
        return lower;
    }

    return lower + long(rock_random_bounded(uint32_t(upper - lower)));
}
