#pragma once

#include <Arduino.h>

struct WeaponState {
    unsigned long last_shot_ms;
};

void weapon_reset(WeaponState& weapon, unsigned long game_ms = 0);
// Record only successfully spawned shots/volleys; primary fire has no cooldown.
void weapon_shot_succeeded(WeaponState& weapon, unsigned long game_ms);
