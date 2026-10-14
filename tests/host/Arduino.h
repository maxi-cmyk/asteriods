#pragma once
#include <cstdint>
#include <cstring>
#include <cmath>
#include <algorithm>
#include <cstdlib>
using std::max;
using std::min;
constexpr float TWO_PI = 6.283185307f;
constexpr int INPUT_PULLUP = 2;
constexpr int TEST_FIRE_PIN = 25;
constexpr int TEST_ADC_CENTER = 2048;
inline unsigned long fake_millis = 0;
inline int joystick_raw_x = TEST_ADC_CENTER;
inline int joystick_raw_y = TEST_ADC_CENTER;
inline bool fire_raw_high = true;
inline bool click_raw_high = true;
inline unsigned long millis() {
    return fake_millis;
}

inline void delay(unsigned long duration_ms) {
    fake_millis += duration_ms;
}

inline void pinMode(int, int) {
}

inline void analogReadResolution(int) {
}

inline int analogRead(int pin) {
    return pin == 34 ? joystick_raw_x : joystick_raw_y;
}

inline int digitalRead(int pin) {
    if (pin == TEST_FIRE_PIN) {
        return fire_raw_high;
    }

    return click_raw_high;
}

inline long random(long high) {
    if (high > 0) {
        return std::rand() % high;
    }

    return 0;
}

inline long random(long low, long high) {
    return low + random(high - low);
}

inline long map(long value,
                long input_min,
                long input_max,
                long output_min,
                long output_max) {
    return (value - input_min) * (output_max - output_min)
                   / (input_max - input_min)
           + output_min;
}

template <class T> T constrain(T value, T low, T high) {
    return min(max(value, low), high);
}
