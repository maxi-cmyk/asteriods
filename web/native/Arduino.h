#pragma once
#include <stdint.h>
#include <stddef.h>
#include <stdarg.h>
#define TWO_PI 6.283185307f
#define INPUT_PULLUP 2
#define PROGMEM
extern "C" {
void *memcpy(void *, const void *, size_t);
void *memset(void *, int, size_t);
float sinf(float);
float cosf(float);
uint32_t browser_random();
void browser_tone(int);
}
inline float sqrtf(float x) {
    return __builtin_sqrtf(x);
}
inline float fabsf(float x) {
    return __builtin_fabsf(x);
}
inline int abs(int x) {
    return x < 0 ? -x : x;
}
template <class T> T min(T a, T b) {
    return a < b ? a : b;
}
template <class T> T max(T a, T b) {
    return a > b ? a : b;
}
template <class T> T constrain(T v, T lo, T hi) {
    return min(max(v, lo), hi);
}
extern unsigned long browser_ms;
extern int browser_x, browser_y;
extern bool browser_fire, browser_click;
inline unsigned long millis() {
    return browser_ms;
}
inline void delay(unsigned long ms) {
    browser_ms += ms;
}
inline void pinMode(int, int) {
}
inline void analogReadResolution(int) {
}
inline int analogRead(int pin) {
    return pin == 34 ? browser_x : browser_y;
}
inline int digitalRead(int pin) {
    return !(pin == 25 ? browser_fire : browser_click);
}
inline long map(long v, long a, long b, long c, long d) {
    return (v - a) * (d - c) / (b - a) + c;
}
inline long random(long upper) {
    return upper > 0 ? browser_random() % upper : 0;
}
inline void ledcSetup(int, int, int) {
}
inline void ledcAttachPin(int, int) {
}
inline void ledcWriteTone(int, int frequency) {
    browser_tone(frequency);
}
inline void ledcWrite(int, int) {
}
