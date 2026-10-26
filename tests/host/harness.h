#pragma once
// Shared host-test harness: the firmware sources compiled together, display and sound
// stubs, and helpers that advance the game one frame at a time.
#include <cassert>
#include <iostream>
#include "../../src/rock_random.cpp"
#include "../../src/difficulty.cpp"
#include "../../src/scoring.cpp"
#include "../../src/asteroid.cpp"
#include "../../src/bullet.cpp"
#include "../../src/weapon.cpp"
#include "../../src/ship.cpp"
#include "../../src/powerup.cpp"
#include "../../src/particle.cpp"
#include "../../src/highscore.cpp"
#include "../../src/demo.cpp"
#include "../../src/game.cpp"
static Adafruit_SSD1306 screen = {};
Adafruit_SSD1306& display_get() {
    return screen;
}
void display_hud(uint8_t, uint32_t, uint8_t, unsigned long) {
}
void display_flip() {
}
void display_shake(uint8_t) {
}
void display_shake_update() {
}
static int shot_sounds = 0;
void sound_play(SoundFX effect) {
    if (effect == SFX_SHOOT) {
        shot_sounds++;
    }
}
void sound_stop() {
}
static void tick(unsigned long ms = FRAME_TIME_MS) {
    fake_millis += ms;
    input_update();
    game_update();
}
static void fire(bool pressed) {
    fire_raw_high = !pressed;
    tick();
    tick();
}

static int active_bullet_count() {
    int count = 0;

    for (int i = 0; i < BULLET_MAX; i++) {
        count += bullets[i].active;
    }

    return count;
}

