#pragma once
// Reading the game: pixels, state, stats and the scene.
// Included inside bridge.cpp's extern "C" block.

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
// Contact circles of the boss on screen: a count, then x, y, r for each. Read-only; the Home
// demo's pilot and the fairness tests steer around them.
const float *web_boss_body() {
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
