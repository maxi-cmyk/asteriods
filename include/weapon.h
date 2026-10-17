#pragma once

#include <Arduino.h>

struct WeaponState {
    uint32_t heat_milliunits;
    unsigned long updated_ms;
    unsigned long last_shot_ms;
    unsigned long overheat_started_ms;
    bool overheated;
};

void weapon_reset(WeaponState& weapon, unsigned long game_ms = 0);
void weapon_update(WeaponState& weapon, unsigned long game_ms);
bool weapon_can_fire(const WeaponState& weapon, unsigned long game_ms);
// Call once per successfully spawned shot/volley, after checking can_fire.
void weapon_shot_succeeded(WeaponState& weapon, unsigned long game_ms);
float weapon_speed_scale(const WeaponState& weapon);
