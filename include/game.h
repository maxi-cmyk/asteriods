#pragma once
#include <Arduino.h>

enum GameState {
  STATE_SPLASH,
  STATE_MENU,
  STATE_COUNTDOWN,
  STATE_PLAYING,
  STATE_PAUSED,
  STATE_DEATH_ANIM,
  STATE_GAME_OVER,
  STATE_HIGH_SCORES,
  STATE_ENTER_INITIALS,
  STATE_DEMO,
};

void gameInit();
void gameUpdate();  // Call once per frame — handles state machine + rendering
GameState gameGetState();
