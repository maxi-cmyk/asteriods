#pragma once
#include <Arduino.h>

// Sound effect IDs (in priority order, highest first)
enum SoundFX {
  SFX_NONE = 0,
  SFX_DEATH,          // highest priority
  SFX_SHOOT,
  SFX_ASTEROID_SMALL,
  SFX_ASTEROID_LARGE,
  SFX_MENU_SELECT,
  SFX_HIGHSCORE,
  SFX_GAMEOVER,
};

void soundInit();
void soundPlay(SoundFX fx);   // Queue a sound (higher priority overrides)
void soundUpdate();            // Call every frame to advance patterns
void soundStop();              // Silence immediately
