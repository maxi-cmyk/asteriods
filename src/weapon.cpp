#include "weapon.h"
#include "config.h"

void weapon_reset(WeaponState& weapon, unsigned long game_ms) {
    weapon = {};
    weapon.updated_ms = game_ms;
    weapon.last_shot_ms = game_ms;
}

void weapon_update(WeaponState& weapon, unsigned long game_ms) {
    unsigned long elapsed_ms = game_ms - weapon.updated_ms;
    weapon.updated_ms = game_ms;
    if (weapon.overheated) {
        unsigned long recovery_ms = game_ms - weapon.overheat_started_ms;
        if (recovery_ms >= WEAPON_RECOVERY_MS) {
            weapon.heat_milliunits = 0;
            weapon.overheated = false;
        } else {
            weapon.heat_milliunits = WEAPON_HEAT_MAX * WEAPON_HEAT_SCALE
                                     * (WEAPON_RECOVERY_MS - recovery_ms)
                                     / WEAPON_RECOVERY_MS;
        }
        return;
    }

    unsigned long since_shot_ms = game_ms - weapon.last_shot_ms;
    if (since_shot_ms <= WEAPON_COOL_DELAY_MS) {
        return;
    }
    unsigned long cooling_ms
            = min(elapsed_ms, since_shot_ms - WEAPON_COOL_DELAY_MS);
    // One milliunit per unit/second per millisecond avoids frame rounding.
    unsigned long needed_ms
            = (weapon.heat_milliunits + WEAPON_COOL_PER_SECOND - 1)
              / WEAPON_COOL_PER_SECOND;
    cooling_ms = min(cooling_ms, needed_ms);
    uint32_t cooling = cooling_ms * WEAPON_COOL_PER_SECOND;
    weapon.heat_milliunits -= min(weapon.heat_milliunits, cooling);
}

bool weapon_can_fire(const WeaponState& weapon, unsigned long game_ms) {
    return !weapon.overheated
           || game_ms - weapon.last_shot_ms >= WEAPON_OVERHEAT_SHOT_MS;
}

void weapon_shot_succeeded(WeaponState& weapon, unsigned long game_ms) {
    weapon.last_shot_ms = game_ms;
    if (weapon.overheated) {
        return;
    }
    weapon.heat_milliunits
            = min(weapon.heat_milliunits
                          + uint32_t(WEAPON_HEAT_PER_SHOT * WEAPON_HEAT_SCALE),
                  uint32_t(WEAPON_HEAT_MAX * WEAPON_HEAT_SCALE));
    if (weapon.heat_milliunits == WEAPON_HEAT_MAX * WEAPON_HEAT_SCALE) {
        weapon.overheated = true;
        weapon.overheat_started_ms = game_ms;
    }
}

float weapon_speed_scale(const WeaponState& weapon) {
    return weapon.overheated ? WEAPON_OVERHEAT_SPEED : 1.0f;
}
