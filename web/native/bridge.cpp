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
#include "coop.h"
extern "C" void web_coop_pause(int pause);
#endif
#include "scene.h"

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
#ifdef WEB_HD
    if (coop_active) {
        if (pause && (state == STATE_PLAYING || state == STATE_COUNTDOWN)) {
            web_coop_pause(1);
        } else if (pause && state == STATE_PAUSED) {
            web_coop_pause(0);
        } else {
            if (state == STATE_PLAYING) visual_ms += FRAME_TIME_MS;
            coop_update();
        }
        sound_update();
        return;
    }
#endif
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
    coop_active = false;
    boss_bind_solo();
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
    coop_active = false;
    practice_mode = false;
    ship.effects.double_fire_left_ms = 0;
    combat_reset();
    boss = {};
    boss_bind_solo();
#endif
    sound_stop();
    set_state(STATE_MENU);
}
// Boss practice: pick a boss (0-5) or mini-boss (6-11) and a tier. Lives are
// never lost; the fight is the whole room.
void web_boss_practice(int kind, int tier, int phase) {
#ifdef WEB_HD
    coop_active = false;
    boss_bind_solo();
    practice_mode = true;
    practice_goals = 0;
    begin_game();
    combat_reset();
    boss = {};
    boss_begin_practice(constrain(kind, 0, int(BK_COUNT) - 1), constrain(tier, 0, 3));
    if (phase > 1) {
        unsigned top = bs_phases() + (boss.tier >= 2 && !boss.mini ? 1 : 0);
        boss.start_phase = constrain(unsigned(phase), 1u, top);
        boss.health = bs_phase_health(boss.start_phase);
    }
    pending_asteroids = 0;
    ship.invincible_left = 0;
    ship.effects.double_fire_left_ms = 0;
    set_state(STATE_PLAYING);
#else
    (void)kind;
    (void)tier;
    (void)phase;
#endif
}
void web_boss_assist(int longer_warnings, int calm) {
#ifdef WEB_HD
    boss_assist_long = longer_warnings != 0;
    boss_assist_calm = calm != 0;
#else
    (void)longer_warnings;
    (void)calm;
#endif
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
    static float scene[SCENE_FLOATS];
    scene_fill(scene);
    return scene;
}
// Co-op ABI version 1: two independent inputs, legacy read-only player scenes.
void web_coop_start(int friendly) {
#ifdef WEB_HD
    coop_begin(friendly != 0);
#endif
}
void web_coop_pause(int pause) {
#ifdef WEB_HD
    if (!coop_active) return;
    if (pause && (state == STATE_PLAYING || state == STATE_COUNTDOWN)) {
        coop_pause_state = state;
        coop_paused_at = browser_ms - state_entered_ms;
        set_state(STATE_PAUSED);
    } else if (!pause && state == STATE_PAUSED) {
        state = coop_pause_state;
        // Countdown elapsed before pause is stored separately below.
        state_entered_ms = browser_ms - coop_paused_at;
    }
#endif
}
void web_coop_input(int owner, float x, float y, int fire, float aim_x,
                    float aim_y, int laser, int precision, int shield) {
#ifdef WEB_HD
    if (owner < 0 || owner > 1 || !coop_active) return;
    auto finite_axis = [](float value) {
        return __builtin_isfinite(value) ? constrain(value, -1.0f, 1.0f) : 0.0f;
    };
    CoopPlayer& player = coop_players[owner];
    player.input = {};
    player.input.joystick_x = finite_axis(x);
    player.input.joystick_y = finite_axis(y);
    player.input.fire_pressed = fire != 0;
    player.actions = {finite_axis(aim_x), finite_axis(aim_y), bool(laser),
                      bool(precision), bool(shield)};
    if (state == STATE_PAUSED && !laser) player.weapons.charging = false;
#endif
}
const float *web_coop_player(int owner) {
    static float snapshot[SCENE_FLOATS];
#ifdef WEB_HD
    if (coop_active && owner >= 0 && owner < 2) {
        coop_load(owner);
        memcpy(snapshot, web_scene(), sizeof(snapshot));
        snapshot[SCENE_COOP_VERSION] = 1; // ABI version
        snapshot[SCENE_COOP_ID] = owner;
        snapshot[SCENE_COOP_RESPAWN_AT] = coop_players[owner].respawn_at;
        snapshot[SCENE_COOP_PARTICIPATION] = coop_players[owner].boss_participation;
        snapshot[SCENE_COOP_TEAM_SCORE] = coop_players[0].points + coop_players[1].points;
        snapshot[SCENE_COOP_FRIENDLY_FIRE] = coop_friendly;
        // Statistics share the existing stats field ordering.
        memcpy(snapshot + SCENE_COOP_STATS_AT, web_stats(), SCENE_COOP_STATS_COUNT * sizeof(float));
        coop_load(0);
    }
#endif
    return snapshot;
}
#ifdef WEB_TEST
void web_test_coop(int owner, int field, float value) {
#ifdef WEB_HD
    if (owner < 0 || owner > 1) return;
    CoopPlayer& player = coop_players[owner];
    if (field == 0) { set_state(STATE_PLAYING); pending_asteroids = 1;
        next_spawn_ms = game_ms + 1000000; memset(rocks, 0, sizeof(rocks)); }
    if (field == 1) player.hull.position_x = value;
    if (field == 2) player.hull.position_y = value;
    if (field == 3) player.hull.invincible_left = value;
    if (field == 4) player.hull.lives = value;
    if (field == 5) player.hull.effects.multishot_left_ms = value;
    if (field == 6) player.hull.effects.double_fire_left_ms = value;
    if (field == 7) coop_hit(owner);
    if (field == 8) player.weapons.shield_stored = value;
    if (field == 9) pickup = {player.hull.position_x, player.hull.position_y,
                              PickupKind(int(value)), true};
    if (field == 10) spawn_asteroid(value, player.hull.position_y, AST_SMALL, 0, 0);
    coop_load(0);
#endif
}
void web_test_boss(int wave, int players, int health) {
#ifdef WEB_HD
    wave_number = wave;
    boss_begin(players);
    if (health > 0) boss.health = health;
#endif
}
// Fairness telemetry gathered by the test build: warnings, caps, corridor.
const float *web_test_boss_stats() {
    static float values[16];
#ifdef WEB_HD
    values[0] = boss.violations;
    values[1] = boss.max_shots;
    values[2] = boss.max_hazards;
    values[3] = boss.entrance_hits;
    values[4] = boss.min_corridor;
    values[5] = boss.hits_taken;
    values[6] = boss.health;
    values[7] = boss.phase;
    values[8] = boss.defeated_mask;
    values[9] = boss.kind;
    values[10] = boss.life_lost;
    values[11] = boss.maximum;
#endif
    return values;
}
// Contact circles (count, then x, y, r triples) for fairness and bot tests.
const float *web_test_boss_body() {
    static float values[1 + 3 * 32];
    memset(values, 0, sizeof(values));
#ifdef WEB_HD
    float body[96];
    unsigned n = boss.active ? bs_kind_body(body) : 0;
    values[0] = n;
    for (unsigned i = 0; i < n * 3; i++) values[1 + i] = body[i];
#endif
    return values;
}
void web_test_boss_set(int field, float value) {
#ifdef WEB_HD
    if (field == 0) bs_damage(0, boss.health > unsigned(value) ? boss.health - unsigned(value) : 0);
    if (field == 1) { boss.health = unsigned(value); }
    if (field == 2) boss.rest_until = 0;
    if (field == 3) { ship.position_x = value; }
    if (field == 4) { ship.position_y = value; }
    if (field == 5) { ship.invincible_left = unsigned(value); }
    if (field == 6) { boss.stamp[0] = 0; for (BossPart& p : boss.parts) if (p.exists) { p.hp = 1; } }
    if (field == 7) { boss_assist_long = value != 0; }
    if (field == 8) { for (BossPart& p : boss.parts) p.exists = false; }
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
