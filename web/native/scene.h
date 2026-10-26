// Serialises the game into the flat float array the browser reads (the scene ABI).
// Offsets come from scene_layout.h, generated from scene-layout.mjs: add or move a
// field there, never here.
#pragma once
#include "scene_layout.h"

static_assert(ASTEROID_MAX == SCENE_ROCKS_COUNT, "rock block size");
static_assert(BULLET_MAX == SCENE_BULLETS_COUNT, "bullet block size");
static_assert(PARTICLE_MAX == SCENE_PARTICLES_COUNT, "particle block size");
static_assert(HIGHSCORE_CAPACITY == SCENE_HIGHSCORES_COUNT, "highscore block size");
#ifdef WEB_HD
static_assert(BOSS_PARTS == SCENE_BOSS_PARTS_COUNT, "boss part block size");
static_assert(BOSS_SHOTS == SCENE_BOSS_SHOTS_COUNT, "boss shot block size");
static_assert(BOSS_HAZARDS == SCENE_BOSS_HAZARDS_COUNT, "boss hazard block size");
#endif

static void scene_core(float *scene) {
    scene[SCENE_STATE] = state;
    scene[SCENE_BROWSER_MS] = browser_ms;
    scene[SCENE_GAME_MS] = game_ms;
    scene[SCENE_STATE_AGE_MS] = browser_ms - state_entered_ms;
    scene[SCENE_SHIP_X] = ship.position_x;
    scene[SCENE_SHIP_Y] = ship.position_y;
    scene[SCENE_SHIP_ALIVE] = ship.alive;
    scene[SCENE_LIVES] = ship.lives;
    scene[SCENE_INVINCIBLE_MS] = ship.invincible_left;
    // Heat/delay slots 9, 10, 12 and 13 are reserved; primary fire is unrestricted.
    scene[SCENE_LAST_SHOT_MS] = ship.weapon.last_shot_ms;
    scene[SCENE_MULTISHOT_MS] = ship.effects.multishot_left_ms;
    scene[SCENE_SHIELD] = ship.effects.shield;
    scene[SCENE_SCORE] = score;
    scene[SCENE_MULTIPLIER] = scoring_multiplier();
    scene[SCENE_CHAIN_MS] = scoring_chain_left(game_ms);
    scene[SCENE_WAVE] = wave_number;
    scene[SCENE_PENDING_ROCKS] = pending_asteroids;
    scene[SCENE_SPAWN_Y] = pending_spawn_y;
    scene[SCENE_SPAWN_WARNING] = pending_asteroids
                                 && (game_ms >= next_spawn_ms
                                     || next_spawn_ms - game_ms <= SPAWN_WARNING_MS);
    scene[SCENE_WAVE_CUE] = game_ms - wave_started_ms < WAVE_CUE_MS;
    scene[SCENE_COLLECT_CUE_MS] = collection_cue_left;
    scene[SCENE_COLLECT_X] = collection_x;
    scene[SCENE_COLLECT_Y] = collection_y;
    scene[SCENE_FINAL_SCORE] = final_score;
    scene[SCENE_SELECTED_INITIAL] = selected_initial;
    scene[SCENE_SAVED_RANK] = saved_rank;
    scene[SCENE_SAVE_FAILED] = save_failed;
    scene[SCENE_SCORE_COUNT] = highscore_count();
    for (int i = 0; i < SCENE_INITIALS_COUNT; i++) {
        scene[SCENE_INITIALS_AT + i] = entered_initials[i];
    }
    scene[SCENE_SHIP_RADIUS] = SHIP_RADIUS;
    scene[SCENE_WAVE_SPEED] = wave_difficulty.speed;
    scene[SCENE_VISUAL_MS] = visual_ms;
    scene[SCENE_SCREEN_W] = SCREEN_W;
    scene[SCENE_SCREEN_H] = SCREEN_H;
    scene[SCENE_SHIP_MAX_SPEED] = SHIP_MAX_SPEED;
    scene[SCENE_SHIP_MIN_X] = SHIP_MIN_X;
    scene[SCENE_SHIP_MAX_X] = SHIP_MAX_X;
    scene[SCENE_SHIP_MIN_Y] = SHIP_MIN_Y;
    scene[SCENE_SHIP_MAX_Y] = SHIP_MAX_Y;
#ifdef WEB_HD
    scene[SCENE_AIM_X] = combat.aim_x;
    scene[SCENE_AIM_Y] = combat.aim_y;
    scene[SCENE_CHARGING] = combat.charging;
    scene[SCENE_CHARGE_MS] = combat.charging ? game_ms - combat.charge_started_ms : 0;
    scene[SCENE_LASER_COOLDOWN_MS] = combat.cooldown_left_ms;
    scene[SCENE_BEAM_MS] = combat.beam_left_ms;
    scene[SCENE_BEAM_X] = combat.beam_x;
    scene[SCENE_BEAM_Y] = combat.beam_y;
    scene[SCENE_BEAM_DX] = combat.beam_direction_x;
    scene[SCENE_BEAM_DY] = combat.beam_direction_y;
    scene[SCENE_SHIELD_STORED] = combat.shield_stored;
    scene[SCENE_PRECISION] = combat_input.precision && state == STATE_PLAYING;
    scene[SCENE_PRACTICE] = practice_mode;
    scene[SCENE_PRACTICE_GOALS] = practice_goals;
#endif
    scene[SCENE_RUN_DESTROYED] = run_destroyed;
    scene[SCENE_RUN_BEST_MULTIPLIER] = run_best_multiplier;
    scene[SCENE_RUN_PRIOR_BEST] = run_prior_best;
    scene[SCENE_SHAKE_OFFSET] = display_get().display_offset;
    scene[SCENE_PENDING_FAST] = pending_spawn_size() == AST_SMALL;
}

static void scene_entities(float *scene) {
    for (int i = 0; i < SCENE_ROCKS_COUNT; i++) {
        float *at = scene + SCENE_ROCKS_AT + i * SCENE_ROCKS_STRIDE;
        at[0] = rocks[i].active;
        at[1] = rocks[i].position_x;
        at[2] = rocks[i].position_y;
        at[3] = rocks[i].radius;
        at[4] = rocks[i].angle;
        at[5] = rocks[i].size;
        at[6] = rocks[i].velocity_x;
        at[7] = rocks[i].velocity_y;
    }
    for (int i = 0; i < SCENE_BULLETS_COUNT; i++) {
        float *at = scene + SCENE_BULLETS_AT + i * SCENE_BULLETS_STRIDE;
        at[0] = bullets[i].active;
        at[1] = bullets[i].position_x;
        at[2] = bullets[i].position_y;
        at[3] = bullets[i].velocity_x;
        at[4] = bullets[i].velocity_y;
    }
    for (int i = 0; i < SCENE_PARTICLES_COUNT; i++) {
        float *at = scene + SCENE_PARTICLES_AT + i * SCENE_PARTICLES_STRIDE;
        at[0] = pool[i].active;
        at[1] = pool[i].position_x;
        at[2] = pool[i].position_y;
        at[3] = pool[i].life;
    }
    scene[SCENE_PICKUP_ACTIVE] = pickup.active;
    scene[SCENE_PICKUP_X] = pickup.position_x;
    scene[SCENE_PICKUP_Y] = pickup.position_y;
    scene[SCENE_PICKUP_KIND] = pickup.kind;
}

static void scene_highscores(float *scene) {
    for (int i = 0; i < SCENE_HIGHSCORES_COUNT; i++) {
        float *at = scene + SCENE_HIGHSCORES_AT + i * SCENE_HIGHSCORES_STRIDE;
        at[0] = highscore_entries()[i].score;
        for (int j = 0; j < 3; j++) {
            at[1 + j] = highscore_entries()[i].initials[j];
        }
    }
}

#ifdef WEB_HD
static void scene_boss(float *scene) {
    scene[SCENE_BOSS_ACTIVE] = boss.active;
    scene[SCENE_BOSS_X] = boss.x;
    scene[SCENE_BOSS_Y] = boss.y;
    scene[SCENE_BOSS_HEALTH] = boss.health;
    scene[SCENE_BOSS_MAXIMUM] = boss.maximum;
    scene[SCENE_BOSS_STAGE] = boss.phase;
    scene[SCENE_BOSS_STAGE_MS] = bs_since(boss.phase_started);
    scene[SCENE_BOSS_TARGET_Y] = boss.target_y;
    scene[SCENE_BOSS_CYCLE] = boss.cycle % 2;
    scene[SCENE_BOSS_PLAYERS] = boss.players;
    scene[SCENE_BOSS_WAVE] = boss.wave;
    scene[SCENE_BOSS_KILLS] = boss.kills;
    scene[SCENE_BOSS_TARGET_X] = boss.target_x;
    float *b = scene + SCENE_BOSS_AT;
    b[SCENE_BOSS_KIND] = boss.kind;
    b[SCENE_BOSS_MINI] = boss.mini;
    b[SCENE_BOSS_TIER] = boss.tier;
    b[SCENE_BOSS_DAMAGE] = boss.maximum == 0 ? 0
                           : boss.health * 3 > boss.maximum * 2 ? 0
                           : boss.health * 3 > boss.maximum ? 1 : 2;
    b[SCENE_BOSS_FLASH_MS] = game_ms < boss.flash_until ? boss.flash_until - game_ms : 0;
    b[SCENE_BOSS_ATTACK] = boss.atk;
    b[SCENE_BOSS_ATTACK_MS] = boss.atk ? game_ms - boss.atk_t0 : 0;
    b[SCENE_BOSS_GATE] = boss.aux[0];
    b[SCENE_BOSS_ENTRANCE] = bs_since(boss.born) >= BOSS_ENTRANCE_MS
                                 ? 1
                                 : bs_since(boss.born) / float(BOSS_ENTRANCE_MS);
    b[SCENE_BOSS_PRACTICE] = boss.practice;
    b[SCENE_BOSS_DEFEATED_MASK] = boss.defeated_mask;
    b[SCENE_BOSS_HITS_TAKEN] = boss.hits_taken;
    b[SCENE_BOSS_VIOLATIONS] = boss.violations;
    b[SCENE_BOSS_MAX_SHOTS] = boss.max_shots;
    b[SCENE_BOSS_MAX_HAZARDS] = boss.max_hazards;
    b[SCENE_BOSS_MIN_CORRIDOR] = boss.min_corridor;
    for (int i = 0; i < SCENE_BOSS_AUX_COUNT; i++) b[SCENE_BOSS_AUX + i] = boss.aux[i];
    for (unsigned i = 0; i < BOSS_PARTS; i++) {
        const BossPart& p = boss.parts[i];
        float *at = scene + SCENE_BOSS_PARTS_AT + i * SCENE_BOSS_PARTS_STRIDE;
        at[0] = p.exists;
        at[1] = p.kind;
        at[2] = p.x;
        at[3] = p.y;
        at[4] = p.r;
        at[5] = p.hp;
        at[6] = p.state;
        at[7] = p.slot;
    }
    for (unsigned i = 0; i < BOSS_SHOTS; i++) {
        const BossShot& sh = boss.shots[i];
        float *at = scene + SCENE_BOSS_SHOTS_AT + i * SCENE_BOSS_SHOTS_STRIDE;
        at[0] = sh.active;
        at[1] = sh.family;
        at[2] = sh.x;
        at[3] = sh.y;
        at[4] = bs_atan2(sh.dy, sh.dx);
        at[5] = sh.hp;
        at[6] = game_ms - sh.born;
        at[7] = sh.family == SF_LOB ? sh.life : sh.amp;
    }
    for (unsigned i = 0; i < BOSS_HAZARDS; i++) {
        const BossHazard& h = boss.hz[i];
        float *at = scene + SCENE_BOSS_HAZARDS_AT + i * SCENE_BOSS_HAZARDS_STRIDE;
        at[0] = h.active;
        at[1] = h.kind;
        at[2] = h.x;
        at[3] = h.y;
        at[4] = h.a;
        at[5] = h.b;
        at[6] = h.c;
        at[7] = h.d;
        at[8] = h.e;
        at[9] = h.warn_left;
        at[10] = h.warn_total;
        at[11] = h.live_left;
    }
}
#endif

static void scene_fill(float *scene) {
    memset(scene, 0, SCENE_FLOATS * sizeof(float));
    scene_core(scene);
    scene_entities(scene);
#ifdef WEB_HD
    scene_boss(scene);
#endif
    scene_highscores(scene);
}
