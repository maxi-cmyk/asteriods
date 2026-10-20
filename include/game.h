#pragma once

#include <Arduino.h>

enum GameState {
    STATE_MENU,
    STATE_COUNTDOWN,
    STATE_PLAYING,
    STATE_PAUSED,
    STATE_DEATH_ANIM,
    STATE_INITIALS,
    STATE_GAME_OVER,
    STATE_DEMO
};

void game_init();
void game_update();
GameState game_get_state();
