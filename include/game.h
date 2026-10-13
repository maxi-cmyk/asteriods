#pragma once
#include <Arduino.h>
enum GameState { STATE_MENU, STATE_COUNTDOWN, STATE_PLAYING, STATE_PAUSED, STATE_DEATH_ANIM, STATE_GAME_OVER };
void gameInit();
void gameUpdate();
GameState gameGetState();
