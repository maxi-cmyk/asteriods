#include "Arduino.h"
#include "config.h"
#include "input.h"
#include "display.h"
#include "sound.h"
#include "rock_random.h"

// Compile the production gameplay unchanged. Sharing a translation unit also
// lets the read-only browser snapshot expose state without firmware debug APIs.
#include "../../src/input.cpp"
#ifdef WEB_HD
#define difficulty_for_wave oled_difficulty_for_wave
#include "../../src/difficulty.cpp"
#undef difficulty_for_wave
WaveDifficulty difficulty_for_wave(uint16_t wave) {
    WaveDifficulty result = oled_difficulty_for_wave(wave);
    result.speed *= 3.75f;
    result.drift *= 3.75f;
    return result;
}
#else
#include "../../src/difficulty.cpp"
#endif
#include "../../src/scoring.cpp"
#include "../../src/asteroid.cpp"
#include "../../src/bullet.cpp"
#include "../../src/weapon.cpp"
#include "../../src/ship.cpp"
#include "../../src/powerup.cpp"
#include "../../src/particle.cpp"
#include "../../src/highscore.cpp"
#include "../demo/controller.cpp"
#include "../../src/game.cpp"

unsigned long browser_ms = 0;
int browser_x = 2048, browser_y = 2048;
bool browser_fire = false, browser_click = false;
static bool browser_fire_edge = false;
static unsigned long visual_ms = 0;

extern "C" void *memcpy(void *dest, const void *src, size_t count) {
    auto *d = (uint8_t *)dest;
    auto *s = (const uint8_t *)src;
    for (size_t i = 0; i < count; i++) {
        d[i] = s[i];
    }
    return dest;
}
extern "C" void *memset(void *dest, int value, size_t count) {
    auto *d = (uint8_t *)dest;
    for (size_t i = 0; i < count; i++) {
        d[i] = value;
    }
    return dest;
}

bool rock_random_init() {
    return true;
}
uint32_t rock_random_bounded(uint32_t upper) {
    if (!upper) {
        return 0;
    }
    uint32_t threshold = uint32_t(-upper) % upper;
    for (int i = 0; i < 32; i++) {
        uint32_t value = browser_random();
        if (value >= threshold) {
            return value % upper;
        }
    }
    __builtin_trap();
}
long rock_random_range(long lower, long upper) {
    return upper <= lower ? lower : lower + rock_random_bounded(upper - lower);
}

#ifdef WEB_HD
#include "combat.h"
#endif

extern "C" {
void web_init() {
    display_init();
    input_init();
    sound_init();
    game_init();
#ifdef WEB_HD
    combat_reset();
#endif
    sound_play(SFX_MENU_SELECT);
    game_update();
}
const uint32_t *web_fire_diagnostics() {
    static uint32_t values[4] = {};
#ifdef WEB_HD
    values[0] = combat.primary_presses;
    values[1] = combat.primary_volleys;
    values[2] = combat.primary_pool_blocked;
    values[3] = combat.primary_laser_blocked;
#endif
    return values;
}
void web_fire_press(int pressed) {
    browser_fire_edge = pressed != 0;
}
void web_step(int raw_x, int raw_y, int fire, int click, int pause) {
    browser_ms += FRAME_TIME_MS;
    // Browser demos start only through the explicit Home action.
    if (state == STATE_MENU) state_entered_ms = browser_ms;
    browser_x = constrain(raw_x, 0, 4095);
    browser_y = constrain(raw_y, 0, 4095);
    browser_fire = fire;
    browser_click = click;
#ifdef WEB_HD
    bool previous_fire_held = input_state.fire_held;
#endif
    input_update();
#ifdef WEB_HD
    // Browser buttons are already digital samples, not mechanical contacts.
    // Do not make a quick press/release survive the OLED debounce window.
    input_state.fire_held = browser_fire;
    input_state.fire_pressed
            = browser_fire_edge || (browser_fire && !previous_fire_held);
    browser_fire_edge = false;
    // Web controls apply the configurable radial deadzone before conversion.
    input_state.joystick_x
            = (browser_x - 2048) / (browser_x >= 2048 ? 2047.0f : 2048.0f);
    input_state.joystick_y
            = (browser_y - 2048) / (browser_y >= 2048 ? 2047.0f : 2048.0f);
#endif
    // Options / Escape is an additional browser shortcut; L3 still uses the
    // production double-click debounce path.
    if (pause) {
        input_state.pause_triggered = true;
    }
    if (state == STATE_PLAYING || state == STATE_DEATH_ANIM
        || state == STATE_DEMO) {
        visual_ms += FRAME_TIME_MS;
    }
#ifdef WEB_HD
    combat_game_update();
#else
    game_update();
#endif
    sound_update();
}
void web_audio_step() {
    sound_advance(FRAME_TIME_MS);
}
void web_start(int practice) {
#ifdef WEB_HD
    practice_mode = practice != 0;
    practice_goals = 0;
    begin_game();
    combat_reset();
    boss = {};
    if (practice_mode) {
        pending_asteroids = 0;
        practice_targets();
        combat.shield_stored = true;
        ship.invincible_left = 0;
        set_state(STATE_PLAYING);
    }
#else
    (void)practice;
    begin_game();
#endif
}
void web_demo() {
    begin_game();
    demo_reset(demo);
    demo_running = true;
    set_state(STATE_DEMO);
}
void web_reload_scores() {
    highscore_init();
    saved_rank = -1;
}
void web_menu() {
    demo_running = false;
    menu_input_ready = false;
#ifdef WEB_HD
    practice_mode = false;
    ship.effects.double_fire_left_ms = 0;
    combat_reset();
    boss = {};
#endif
    sound_stop();
    set_state(STATE_MENU);
}
void web_practice_targets() {
#ifdef WEB_HD
    if (practice_mode) {
        practice_targets();
    }
#endif
}
void web_practice_double_fire() {
#ifdef WEB_HD
    if (practice_mode) ship.effects.double_fire_left_ms = 6000;
#endif
}
const float *web_stats() {
    static float values[16] = {};
#ifdef WEB_HD
    values[0] = combat.cps;
    values[1] = combat.peak_cps;
    values[2] = combat.spawned;
    values[3] = combat.hits;
    values[4] = combat.longest_chain;
    values[5] = combat.highest_wave;
    values[6] = ship.effects.double_fire_left_ms;
    values[7] = combat.laser_shots;
    values[8] = combat.laser_kills;
    values[9] = combat.primary_presses;
    values[10] = 0;
    for (unsigned long due : combat.pending_shots) values[10] += due != 0;
#endif
    return values;
}
void web_practice_multishot() {
#ifdef WEB_HD
    if (practice_mode) {
        ship.effects.multishot_left_ms = MULTISHOT_DURATION_MS;
    }
#endif
}
void web_actions(
        float aim_x, float aim_y, int laser, int precision, int shield) {
#ifdef WEB_HD
    if (!__builtin_isfinite(aim_x) || !__builtin_isfinite(aim_y)) {
        aim_x = 0;
        aim_y = 0;
    }
    combat_input = {constrain(aim_x, -1.0f, 1.0f),
                    constrain(aim_y, -1.0f, 1.0f),
                    bool(laser),
                    bool(precision),
                    bool(shield)};
#else
    (void)aim_x;
    (void)aim_y;
    (void)laser;
    (void)precision;
    (void)shield;
#endif
}
uint8_t *web_pixels() {
    return display_get().pixels;
}
int web_offset() {
    return display_get().display_offset;
}
int web_state() {
    return game_get_state();
}
const float *web_snapshot() {
    static float values[16];
    int bullet_count = 0;
    for (const Bullet& bullet : bullets) {
        bullet_count += bullet.active;
    }
    values[0] = state;
    values[1] = ship.position_x;
    values[2] = ship.position_y;
    values[3] = ship.lives;
    values[4] = score;
    values[5] = game_ms;
    // Preserve legacy heat/delay slots in the browser snapshot layout.
    values[6] = 0;
    values[7] = 0;
    values[8] = 0;
    values[9] = bullet_count;
    values[10] = asteroid_active_count();
    values[11] = asteroid_wave();
    values[12] = ship.effects.multishot_left_ms;
    values[13] = ship.effects.shield;
    values[14] = highscore_count();
    values[15] = highscore_best();
    return values;
}
int web_width() {
    return SCREEN_W;
}
int web_height() {
    return SCREEN_H;
}
const float *web_scene() {
    // First 512 floats retain the original layout; 64 tail floats expose bosses.
    static float scene[576];
    memset(scene, 0, sizeof(scene));
    scene[0] = state;
    scene[1] = browser_ms;
    scene[2] = game_ms;
    scene[3] = browser_ms - state_entered_ms;
    scene[4] = ship.position_x;
    scene[5] = ship.position_y;
    scene[6] = ship.alive;
    scene[7] = ship.lives;
    scene[8] = ship.invincible_left;
    // Reserved legacy heat/delay slots; primary fire is unrestricted.
    scene[9] = 0;
    scene[10] = 0;
    scene[11] = ship.weapon.last_shot_ms;
    scene[12] = 0;
    scene[13] = 0;
    scene[14] = ship.effects.multishot_left_ms;
    scene[15] = ship.effects.shield;
    scene[16] = score;
    scene[17] = scoring_multiplier();
    scene[18] = scoring_chain_left(game_ms);
    scene[19] = wave_number;
    scene[20] = pending_asteroids;
    scene[21] = pending_spawn_y;
    scene[22] = pending_asteroids
                && (game_ms >= next_spawn_ms
                    || next_spawn_ms - game_ms <= SPAWN_WARNING_MS);
    scene[23] = game_ms - wave_started_ms < WAVE_CUE_MS;
    scene[24] = collection_cue_left;
    scene[25] = collection_x;
    scene[26] = collection_y;
    scene[27] = final_score;
    scene[28] = selected_initial;
    scene[29] = saved_rank;
    scene[30] = save_failed;
    scene[31] = highscore_count();
    for (int i = 0; i < 3; i++) {
        scene[32 + i] = entered_initials[i];
    }
    scene[35] = SHIP_RADIUS;
    scene[36] = wave_difficulty.speed;
    scene[37] = visual_ms;
    scene[38] = SCREEN_W;
    scene[39] = SCREEN_H;
    scene[40] = SHIP_MAX_SPEED;
    scene[41] = SHIP_MIN_X;
    scene[42] = SHIP_MAX_X;
    scene[43] = SHIP_MIN_Y;
    scene[44] = SHIP_MAX_Y;
#ifdef WEB_HD
    scene[45] = combat.aim_x;
    scene[46] = combat.aim_y;
    scene[47] = combat.charging;
    scene[48] = combat.charging ? game_ms - combat.charge_started_ms : 0;
    scene[49] = combat.cooldown_left_ms;
    scene[50] = combat.beam_left_ms;
    scene[51] = combat.beam_x;
    scene[52] = combat.beam_y;
    scene[53] = combat.beam_direction_x;
    scene[54] = combat.beam_direction_y;
    scene[55] = combat.shield_stored;
    scene[56] = combat_input.precision && state == STATE_PLAYING;
    scene[60] = practice_mode;
    scene[62] = practice_goals;
#endif
    scene[57] = run_destroyed;
    scene[58] = run_best_multiplier;
    scene[59] = run_prior_best;
    scene[61] = display_get().display_offset;
    scene[63] = pending_spawn_size() == AST_SMALL;
    for (int i = 0; i < ASTEROID_MAX; i++) {
        int offset = 64 + i * 8;
        scene[offset] = rocks[i].active;
        scene[offset + 1] = rocks[i].position_x;
        scene[offset + 2] = rocks[i].position_y;
        scene[offset + 3] = rocks[i].radius;
        scene[offset + 4] = rocks[i].angle;
        scene[offset + 5] = rocks[i].size;
        scene[offset + 6] = rocks[i].velocity_x;
        scene[offset + 7] = rocks[i].velocity_y;
    }
    for (int i = 0; i < BULLET_MAX; i++) {
        int offset = 256 + i * 6;
        scene[offset] = bullets[i].active;
        scene[offset + 1] = bullets[i].position_x;
        scene[offset + 2] = bullets[i].position_y;
        scene[offset + 3] = bullets[i].velocity_x;
        scene[offset + 4] = bullets[i].velocity_y;
    }
    for (int i = 0; i < PARTICLE_MAX; i++) {
        int offset = 328 + i * 5;
        scene[offset] = pool[i].active;
        scene[offset + 1] = pool[i].position_x;
        scene[offset + 2] = pool[i].position_y;
        scene[offset + 3] = pool[i].life;
    }
    scene[478] = pickup.active;
    scene[479] = pickup.position_x;
    scene[480] = pickup.position_y;
    scene[481] = pickup.kind;
#ifdef WEB_HD
    scene[512] = boss.active;
    scene[513] = BOSS_X;
    scene[514] = BOSS_Y;
    scene[515] = boss.health;
    scene[516] = boss.maximum;
    scene[517] = boss.phase;
    scene[518] = game_ms - boss.phase_started;
    scene[519] = boss.target_y;
    scene[520] = boss.cycle % 2;
    scene[521] = boss.players;
    scene[522] = boss.wave;
    scene[523] = boss.kills;
    scene[524] = boss.target_x;
    for (int i = 0; i < 6; i++) {
        scene[528 + i * 4] = boss.shots[i].active;
        scene[529 + i * 4] = boss.shots[i].x;
        scene[530 + i * 4] = boss.shots[i].y;
    }
#endif
    for (int i = 0; i < HIGHSCORE_CAPACITY; i++) {
        int offset = 486 + i * 5;
        scene[offset] = highscore_entries()[i].score;
        for (int j = 0; j < 3; j++) {
            scene[offset + 1 + j] = highscore_entries()[i].initials[j];
        }
    }
    return scene;
}
#ifdef WEB_TEST
void web_test_boss(int wave, int players, int health) {
#ifdef WEB_HD
    wave_number = wave;
    boss_begin(players);
    if (health > 0) boss.health = health;
#endif
}
void web_test_pickup(int kind) {
    pickup = {ship.position_x, ship.position_y, PickupKind(kind), true};
}
void web_test_overlap() {
    ship.invincible_left = 0;
    spawn_asteroid(ship.position_x, ship.position_y, AST_SMALL, 0, 0);
}
void web_scenario(int scenario) {
    begin_game();
    set_state(STATE_PLAYING);
    pending_asteroids = 0;
    memset(rocks, 0, sizeof(rocks));
    ship.invincible_left = 0;
#ifdef WEB_HD
    combat_reset();
    boss = {};
#endif
    if (scenario == 1) {
        ship.effects.multishot_left_ms = MULTISHOT_DURATION_MS;
    }
    if (scenario == 2) {
        ship.effects.shield = true;
        spawn_asteroid(ship.position_x, ship.position_y, AST_SMALL, 0, 0);
    }
    if (scenario == 3) {
        ship.lives = 1;
        score = 1234;
        spawn_asteroid(ship.position_x, ship.position_y, AST_SMALL, 0, 0);
    }
    if (scenario == 4) {
        // Repeated primary fire scenario.
    }
    if (scenario == 5) {
        spawn_asteroid(240, 135, AST_LARGE, 0, 0);
        spawn_asteroid(320, 70, AST_MEDIUM, 0, 0);
        spawn_asteroid(390, 200, AST_SMALL, 0, 0);
        pickup = {160, 190, PICKUP_MULTISHOT, true};
        ship.effects.shield = true;
        ship.effects.multishot_left_ms = MULTISHOT_DURATION_MS;
    }
#ifdef WEB_HD
    if (scenario == 17 || scenario == 18) {
        pickup = {ship.position_x, ship.position_y, PICKUP_DOUBLE_FIRE, true};
        if (scenario == 18) ship.effects.multishot_left_ms = MULTISHOT_DURATION_MS;
    }
    if (scenario == 19) {
        spawn_asteroid(320, 135, AST_SMALL, 0, 0);
    }
    if (scenario >= 9) {
        ship.position_x = 240;
        ship.position_y = 135;
        pending_asteroids = 1;
        next_spawn_ms = game_ms + 1000000;
        if (scenario == 17 || scenario == 18) {
            pickup.position_x = ship.position_x;
            pickup.position_y = ship.position_y;
        }
    }
    if (scenario == 10) {
        spawn_asteroid(320, 135, AST_SMALL, 0, 0);
        spawn_asteroid(400, 135, AST_LARGE, 0, 0);
        spawn_asteroid(160, 135, AST_SMALL, 0, 0);
        spawn_asteroid(320, 180, AST_SMALL, 0, 0);
    }
    if (scenario == 15 || scenario == 16) {
        // Keep existing bullets stationary so the test can fill the pool.
        ship.effects.multishot_left_ms = MULTISHOT_DURATION_MS;
        for (int i = 0; i < BULLET_MAX - (scenario == 15 ? 2 : 0); i++) {
            spawn_bullet(i, 20, 20, 0, 0);
        }
    }
    if (scenario == 14) {
        for (int i = 0; i < ASTEROID_MAX; i++) {
            spawn_asteroid(300 + i * 3, 135, AST_LARGE, 0, 0);
        }
    }
    if (scenario == 11) {
        pickup = {ship.position_x, ship.position_y, PICKUP_SHIELD, true};
    }
    if (scenario == 12) {
        combat.shield_stored = true;
        spawn_asteroid(ship.position_x, ship.position_y, AST_SMALL, 0, 0);
    }
    if (scenario == 13) {
        for (int i = 0; i < 100; i++) {
            weapon_shot_succeeded(ship.weapon, game_ms);
        }
    }
#endif
    if (scenario == 7 || scenario == 8) {
        float separation = SHIP_RADIUS + ASTEROID_SMALL_R;
        spawn_asteroid(ship.position_x + separation + (scenario == 7 ? -1 : 1),
                       ship.position_y,
                       AST_SMALL,
                       0,
                       0);
    }
    if (scenario == 6) {
        pending_asteroids = 1;
        next_spawn_ms = game_ms + SPAWN_WARNING_MS;
        pending_spawn_y = SCREEN_H / 2;
    }
}
#endif
}
