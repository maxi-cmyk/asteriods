#pragma once

#include <Arduino.h>

// Sound effect IDs (in priority order, highest first)
enum SoundFX {
    SFX_NONE = 0,
    SFX_DEATH, // highest priority
    SFX_SHOOT,
    SFX_ASTEROID_SMALL,
    SFX_ASTEROID_LARGE,
    SFX_MENU_SELECT,
    SFX_HIGHSCORE,
    SFX_GAMEOVER,
};

void sound_init();
void sound_play(SoundFX effect); // Queue a sound (higher priority overrides)
void sound_update();             // Call every frame to advance patterns
// Presentation-only ticks may finish audio while simulation is frozen.
void sound_advance(unsigned long elapsed_ms);
void sound_stop();               // Silence immediately
