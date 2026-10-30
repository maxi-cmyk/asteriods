#pragma once

// Web combat remains separate from the fixed-facing OLED game.
static const unsigned long LASER_WINDUP_MS = 1500;
static const unsigned long LASER_COOLDOWN_MS = 5000;
static const unsigned long LASER_BEAM_MS = 400;
static const float PRECISION_SPEED_SCALE = 0.5f;
static const float AIM_DEADZONE = 0.25f;

struct CombatInput {
    float aim_x;
    float aim_y;
    bool laser;
    bool precision;
    bool shield;
};
struct CombatState {
    uint32_t primary_presses = 0;
    uint32_t primary_volleys = 0;
    uint32_t primary_pool_blocked = 0;
    uint32_t primary_laser_blocked = 0;
    // One input event per 20ms tick: 64 slots cover a full active second.
    unsigned long press_times[64] = {};
    unsigned press_cursor = 0;
    unsigned cps = 0, peak_cps = 0;
    unsigned spawned = 0, hits = 0, laser_shots = 0, laser_kills = 0;
    unsigned chain = 0, longest_chain = 0, highest_wave = 1;
    unsigned long last_scoring_kill = 0;
    // At most four events can be waiting for the 80ms gap at 50Hz.
    unsigned long pending_shots[8] = {};
    float aim_x = 1;
    float aim_y = 0;
    bool laser_was_held = false;
    bool charging = false;
    bool shield_stored = false;
    unsigned long charge_started_ms = 0;
    unsigned long cooldown_left_ms = 0;
    unsigned long beam_left_ms = 0;
    float beam_x = 0;
    float beam_y = 0;
    float beam_direction_x = 1;
    float beam_direction_y = 0;
};
static CombatInput combat_input = {};
static CombatState combat = {};
static bool practice_mode = false;
// Practice pickups the player has switched on: held at full time until switched off.
static bool practice_hold_multishot = false;
static bool practice_hold_double_fire = false;
static unsigned long practice_empty_since = 0;
static unsigned practice_goals = 0;

static void practice_targets() {
    memset(rocks, 0, sizeof(rocks));
    for (int i = 0; i < 3; i++) {
        spawn_asteroid(340 + i * 35, 65 + i * 70, AsteroidSize(i), 0, 0);
    }
    practice_empty_since = 0;
}

static void combat_reset() {
    combat = {};
    // A held trigger in a menu must be released before charging in play.
    combat.laser_was_held = combat_input.laser;
}

static void combat_update_aim() {
    float length = sqrtf(combat_input.aim_x * combat_input.aim_x
                         + combat_input.aim_y * combat_input.aim_y);
    if (length > AIM_DEADZONE) {
        combat.aim_x = combat_input.aim_x / length;
        combat.aim_y = combat_input.aim_y / length;
    }
}

static void combat_move_ship(const InputState& input) {
    float length = max(1.0f,
                       sqrtf(input.joystick_x * input.joystick_x
                             + input.joystick_y * input.joystick_y));
    float scale = combat_input.precision ? PRECISION_SPEED_SCALE : 1.0f;
    ship_update(ship,
                input.joystick_x / length * scale,
                input.joystick_y / length * scale);
}

static void combat_collect_and_arm_shield() {
    bool active_before = ship.effects.shield;
    powerups_update(ship);
    if (practice_mode) {
        if (practice_hold_multishot) ship.effects.multishot_left_ms = MULTISHOT_DURATION_MS;
        if (practice_hold_double_fire) ship.effects.double_fire_left_ms = 6000;
    }
    if (!active_before && ship.effects.shield) {
        combat.shield_stored = true;
        ship.effects.shield = false;
    }
    if (combat_input.shield && combat.shield_stored) {
        if (practice_mode) {
            practice_goals |= 16;
        }
        ship.effects.shield = true;
        combat.shield_stored = false;
    }
}

static bool combat_fire_volley() {
    bool free_before[BULLET_MAX] = {};
    for (int i = 0; i < BULLET_MAX; i++) {
        free_before[i] = !bullets[i].active;
    }
    bool fired
            = bullets_fire(ship.position_x + combat.aim_x * SHIP_BULLET_OFFSET,
                           ship.position_y + combat.aim_y * SHIP_BULLET_OFFSET,
                           ship.effects.multishot_left_ms > 0);
    for (int i = 0; i < BULLET_MAX; i++) {
        if (free_before[i] && bullets[i].active) {
            combat.spawned++;
            float old_x = bullets[i].velocity_x;
            float old_y = bullets[i].velocity_y;
            bullets[i].velocity_x = old_x * combat.aim_x - old_y * combat.aim_y;
            bullets[i].velocity_y = old_x * combat.aim_y + old_y * combat.aim_x;
        }
    }
    return fired;
}

static void combat_award(uint32_t points) {
    if (points) {
        if (!combat.chain || game_ms - combat.last_scoring_kill >= SCORE_CHAIN_WINDOW_MS) {
            combat.chain = 0;
        }
        combat.chain++;
        combat.longest_chain = max(combat.longest_chain, combat.chain);
        combat.last_scoring_kill = game_ms;
    }
    award_asteroid_score(points);
}

static void combat_primary_hit(uint32_t points) {
    // Shared collision code calls this once per consumed projectile.
    combat.hits++;
    combat_award(points);
}

static void combat_update_cps(bool pressed) {
    if (pressed) {
        combat.press_times[combat.press_cursor++ % 64] = game_ms;
    }
    combat.cps = 0;
    for (unsigned long time : combat.press_times) {
        if (time && game_ms - time < 1000) combat.cps++;
    }
    combat.peak_cps = max(combat.peak_cps, combat.cps);
}

static void combat_primary_event() {
    if (combat_fire_volley()) {
        combat.primary_volleys++;
        if (practice_mode) practice_goals |= 4;
        weapon_shot_succeeded(ship.weapon, game_ms);
        sound_play(SFX_SHOOT);
    } else {
        // A full pool drops this event; it is never retried later.
        combat.primary_pool_blocked++;
    }
}

static bool combat_beam_hits(const Asteroid& rock) {
    float x = rock.position_x - combat.beam_x;
    float y = rock.position_y - combat.beam_y;
    float along = x * combat.beam_direction_x + y * combat.beam_direction_y;
    float across = x * combat.beam_direction_y - y * combat.beam_direction_x;
    float radius = rock.radius + 2.0f;
    bool intersects = along >= 0 ? across * across <= radius * radius
                                 : x * x + y * y <= radius * radius;
    return intersects && rock.position_x >= 0 && rock.position_x < SCREEN_W
           && rock.position_y >= 0 && rock.position_y < SCREEN_H;
}

static void combat_destroy_laser_targets() {
    // Damage each original target once, without producing fragments.
    bool targets[ASTEROID_MAX] = {};
    for (int i = 0; i < ASTEROID_MAX; i++) {
        targets[i] = rocks[i].active && combat_beam_hits(rocks[i]);
    }
    for (int i = 0; i < ASTEROID_MAX; i++) {
        if (!targets[i]) {
            continue;
        }
        Asteroid parent = rocks[i];
        rocks[i].active = false;
        particles_spawn(parent.position_x, parent.position_y);
        combat.laser_kills++;
        combat_award(asteroid_points(parent.size));
        powerups_drop(parent.position_x, parent.position_y);
    }
}

static void combat_fire_laser() {
    combat.laser_shots++;
    combat.charging = false;
    combat.cooldown_left_ms = LASER_COOLDOWN_MS;
    combat.beam_left_ms = LASER_BEAM_MS;
    combat.beam_x = ship.position_x + combat.aim_x * SHIP_BULLET_OFFSET;
    combat.beam_y = ship.position_y + combat.aim_y * SHIP_BULLET_OFFSET;
    combat.beam_direction_x = combat.aim_x;
    combat.beam_direction_y = combat.aim_y;
    combat_destroy_laser_targets();
    if (practice_mode) {
        practice_goals |= 8;
    }
    sound_play(SFX_ASTEROID_LARGE);
    display_shake(2);
}

static bool combat_update_laser(bool pressed) {
    combat.cooldown_left_ms
            -= min(combat.cooldown_left_ms, (unsigned long)FRAME_TIME_MS);
    combat.beam_left_ms
            -= min(combat.beam_left_ms, (unsigned long)FRAME_TIME_MS);
    if (pressed && !combat.cooldown_left_ms) {
        combat.charging = true;
        combat.charge_started_ms = game_ms;
    }
    if (!combat.charging) {
        return false;
    }
    if (!combat_input.laser) {
        combat.charging = false;
        return false;
    }
    if (game_ms - combat.charge_started_ms >= LASER_WINDUP_MS) {
        combat_fire_laser();
        return true;
    }
    return false;
}

#include "boss.h"

static void combat_ship_hit() {
    if (ship.invincible_left) {
        return;
    }
    if (ship.effects.shield) {
        ship.effects.shield = false;
        ship.invincible_left = SHIELD_PROTECTION_MS;
        return;
    }
    if (practice_mode) {
        return;
    }
    ship_die(ship);
    // Dying never resets a boss, but its attacks are cleared so the return is fair.
    if (boss.active) bs_clear_threats();
    memset(combat.pending_shots, 0, sizeof(combat.pending_shots));
    combat.chain = 0;
    combat.charging = false;
    combat.beam_left_ms = 0;
    combat.shield_stored = false;
    powerups_init();
    scoring_reset();
    particles_spawn(ship.position_x, ship.position_y);
    sound_play(SFX_DEATH);
    display_shake(DEATH_SHAKE_FRAMES);
    set_state(STATE_DEATH_ANIM);
}

static void combat_collisions() {
    if (asteroid_hits_ship(ship.position_x, ship.position_y)) combat_ship_hit();
}
static void combat_update_playing(bool laser_pressed) {
    const InputState& input = input_get();
    if (input.pause_triggered) {
        sound_stop();
        set_state(STATE_PAUSED);
        return;
    }
    game_ms += FRAME_TIME_MS;
    scoring_update(game_ms);
    combat_update_aim();
    combat_move_ship(input);
    combat_collect_and_arm_shield();
    if (boss.practice) {
        // Boss practice: no rocks, no lost lives; the fight is the whole room.
    } else if (practice_mode) {
        if (fabsf(input.joystick_x) + fabsf(input.joystick_y) > 0.1f) {
            practice_goals |= 1;
        }
        if (fabsf(combat_input.aim_x) + fabsf(combat_input.aim_y) > 0.25f) {
            practice_goals |= 2;
        }
        if (!ship.effects.shield) {
            combat.shield_stored = true;
        }
        if (!asteroid_active_count()) {
            if (!practice_empty_since) {
                practice_empty_since = game_ms;
            }
            if (game_ms - practice_empty_since >= 1500) {
                practice_targets();
            }
        }
    } else {
        if (!boss_controls_wave()) asteroids_update(game_ms);
    }
    bool laser_fired = combat_update_laser(laser_pressed);
    combat_update_cps(input.fire_pressed);
    combat.highest_wave = max(combat.highest_wave, unsigned(wave_number));
    for (unsigned long& due : combat.pending_shots) {
        if (due && game_ms >= due) {
            due = 0;
            if (!combat.charging && !laser_fired) combat_primary_event();
            else combat.primary_laser_blocked++;
        }
    }
    if (input.fire_pressed) {
        combat.primary_presses++;
        if (combat.charging || laser_fired) {
            combat.primary_laser_blocked++;
        } else {
            combat_primary_event();
            if (ship.effects.double_fire_left_ms) {
                for (unsigned long& due : combat.pending_shots) {
                    if (!due) { due = game_ms + 80; break; }
                }
            }
        }
    }
    bullets_update();
    bullets_check_asteroids(combat_primary_hit, powerups_drop);
    for (Bullet& bullet : bullets) {
        if (bullet.active && bullet.position_x < 0) {
            bullet.active = false;
        }
    }
    particles_update();
    combat_collisions();
    if (state == STATE_PLAYING && (!practice_mode || boss.practice)) boss_update(laser_fired);
}

static void combat_game_update() {
    bool laser_pressed = combat_input.laser && !combat.laser_was_held;
    combat.laser_was_held = combat_input.laser;
    if (state == STATE_PLAYING) {
        combat_update_playing(laser_pressed);
        display_shake_update();
        display_flip();
    } else {
        GameState previous = state;
        game_update();
        if (state == STATE_COUNTDOWN && previous != STATE_COUNTDOWN) {
            combat_reset();
            boss = {};
        }
        if (state == STATE_PAUSED && !combat_input.laser) {
            combat.charging = false;
        }
    }
}
