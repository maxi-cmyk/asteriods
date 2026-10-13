#pragma once
#include <cstdint>
#include <cstring>
#include <cmath>
#include <algorithm>
#include <cstdlib>
using std::min; using std::max;
constexpr float TWO_PI = 6.283185307f;
constexpr int INPUT_PULLUP = 2;
inline unsigned long fakeMillis = 0;
inline bool fireRawHigh = true, clickRawHigh = true;
inline unsigned long millis() { return fakeMillis; }
inline void delay(unsigned long ms) { fakeMillis += ms; }
inline void pinMode(int, int) {}
inline void analogReadResolution(int) {}
inline int analogRead(int) { return 2048; }
inline int digitalRead(int pin) { return pin == 25 ? fireRawHigh : clickRawHigh; }
inline long random(long high) { return high > 0 ? std::rand() % high : 0; }
inline long random(long low, long high) { return low + random(high-low); }
inline long map(long v, long a, long b, long c, long d) { return (v-a)*(d-c)/(b-a)+c; }
template<class T> T constrain(T v, T low, T high) { return min(max(v,low),high); }
