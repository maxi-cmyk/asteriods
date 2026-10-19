#include "weapon.h"

void weapon_reset(WeaponState& weapon, unsigned long game_ms) {
    weapon.last_shot_ms = game_ms;
}

void weapon_shot_succeeded(WeaponState& weapon, unsigned long game_ms) {
    weapon.last_shot_ms = game_ms;
}
