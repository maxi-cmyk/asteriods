#pragma once
// Gameplay: bullets, waves, ship movement, input, pause, respawn, retry.
#include "harness.h"

static void test_bullet_collisions() {
    // A segment crossing a small rock hits even if neither endpoint is inside.
    asteroids_init();
    memset(rocks, 0, sizeof(rocks));
    spawn_asteroid(52, 35, AST_SMALL, -0.4f, 0);
    assert(asteroids_hit_bullet(45, 60, 35) == SCORE_SMALL);
    assert(asteroid_active_count() == 0);
    // Nearest target consumes the bullet, leaving a farther target untouched.
    spawn_asteroid(70, 35, AST_SMALL, -0.4f, 0);
    spawn_asteroid(50, 35, AST_SMALL, -0.4f, 0);
    assert(asteroids_hit_bullet(40, 80, 35) == SCORE_SMALL);
    assert(rocks[0].active && !rocks[1].active);
    // Splitting preserves both children; a full pool leaves the parent intact.
    memset(rocks, 0, sizeof(rocks));
    spawn_asteroid(60, 35, AST_LARGE, -0.4f, 0);
    assert(asteroids_hit_bullet(40, 70, 35) == SCORE_LARGE);
    assert(asteroid_active_count() == 2
           && rocks[0].position_y != rocks[1].position_y);
    for (int i = 2; i < ASTEROID_MAX; ++i) {
        spawn_asteroid(100, 35, AST_SMALL, -0.4f, 0);
    }
    assert(asteroids_hit_bullet(50, 65, rocks[0].position_y) == 0);
    assert(asteroid_active_count() == ASTEROID_MAX);
}

static void test_wave_progression() {
    // Escaped rocks complete waves and difficulty remains capped.
    asteroids_init();
    for (unsigned long time_ms = 20; time_ms < 60000; time_ms += 20) {
        asteroids_update(time_ms);
    }
    assert(asteroid_wave() > 1 && wave_difficulty.speed <= 0.851f);
    wave_number = 65535;
    prepare_wave(60000);
    assert(wave_difficulty.speed <= 0.851f);
}

static void test_ship_movement() {
    Ship test_ship = {};
    ship_init(test_ship);
    ship_respawn(test_ship, 50, 35);
    ship_update(test_ship, 0.3f, 0.4f);
    assert(fabsf(test_ship.position_x - 50 - 0.3f * SHIP_MAX_SPEED) < 0.001f);
    assert(fabsf(test_ship.position_y - 35 - 0.4f * SHIP_MAX_SPEED) < 0.001f);
    float position_x = test_ship.position_x;
    float position_y = test_ship.position_y;
    ship_update(test_ship, 0, 0);
    assert(test_ship.position_x == position_x);
    assert(test_ship.position_y == position_y);
    ship_update(test_ship, 1, 1);
    float distance_x = test_ship.position_x - position_x;
    float distance_y = test_ship.position_y - position_y;
    assert(fabsf(hypotf(distance_x, distance_y) - SHIP_MAX_SPEED) < 0.001f);

    for (int i = 0; i < 200; i++) {
        ship_update(test_ship, -1, -1);
    }
    assert(test_ship.position_x == SHIP_MIN_X);
    assert(test_ship.position_y == SHIP_MIN_Y);
    assert(test_ship.position_x - SHIP_TAIL_OFFSET >= 0);
    assert(test_ship.position_y - SHIP_RADIUS >= HUD_HEIGHT);
    for (int i = 0; i < 200; i++) {
        ship_update(test_ship, 1, 1);
    }
    assert(test_ship.position_x == SHIP_MAX_X);
    assert(test_ship.position_y == SHIP_MAX_Y);
    assert(test_ship.position_x + SHIP_NOSE_OFFSET < SCREEN_W);
    assert(test_ship.position_y + SHIP_RADIUS < SCREEN_H);
    ship_die(test_ship);
    ship_update(test_ship, -1, -1);
    assert(test_ship.position_x == SHIP_MAX_X);
    assert(test_ship.position_y == SHIP_MAX_Y);
}

static void test_input_movement_and_firing() {
    begin_game();
    set_state(STATE_PLAYING);
    pending_asteroids = 0;
    ship_respawn(ship, 50, 35);
    input_init();
    joystick_raw_x = 4095;
    joystick_raw_y = 0;
    tick();
    assert(ship.position_x > 50 && ship.position_y < 35);
    joystick_raw_x = TEST_ADC_CENTER;
    joystick_raw_y = TEST_ADC_CENTER;
    float position_x = ship.position_x;
    float position_y = ship.position_y;
    tick();
    assert(ship.position_x == position_x && ship.position_y == position_y);
    InputState shot_input = {};
    shot_input.fire_pressed = true;
    update_playing(shot_input);
    assert(bullets[0].active);
    assert(bullets[0].previous_x == ship.position_x + SHIP_BULLET_OFFSET);
    assert(bullets[0].position_y == ship.position_y);
    assert(bullets[0].position_x > bullets[0].previous_x);
}

static void test_spawn_warning() {
    asteroids_init();
    float warning_y = pending_spawn_y;
    asteroids_update(SPAWN_WARNING_MS - 1);
    assert(asteroid_active_count() == 0);
    asteroids_update(SPAWN_WARNING_MS);
    assert(asteroid_active_count() == 1);
    assert(fabsf(rocks[0].position_y - warning_y) < 1.0f);
    assert(next_spawn_ms
           == SPAWN_WARNING_MS + wave_difficulty.spawn_interval_ms);
}

static void test_bullet_capacity() {
    // Rapid presses shoot without a cooldown; the pool still has a hard bound.
    bullets_init();
    for (int i = 0; i < BULLET_MAX; ++i) {
        assert(bullets_fire(18, 35));
    }
    assert(!bullets_fire(18, 35));
}

static void test_fire_input_edges() {
    // Input edges: holding does not repeat, bounce does not shoot, release
    // rearms.
    input_init();
    game_init();
    fire_raw_high = false;
    tick();
    fire_raw_high = true;
    tick();
    assert(game_get_state() == STATE_MENU);
    fire(true);
    assert(game_get_state() == STATE_COUNTDOWN);
    tick(1600);
    assert(game_get_state() == STATE_PLAYING);
    tick();
    int count = active_bullet_count();
    assert(count == 0); // button held across countdown does not auto-fire
    fire(false);
    fire(true);
    count = active_bullet_count();
    assert(count == 1);
    for (int i = 0; i < 5; ++i) {
        tick();
    }
    count = active_bullet_count();
    assert(count == 1);
    fire(false);
    fire(true);
    count = active_bullet_count();
    assert(count == 2);
}

static void test_pause_state() {
    // Pause freezes simulation time, invincibility, and asteroid movement.
    set_state(STATE_PAUSED);
    unsigned long frozen_time = game_ms;
    unsigned long invincibility_left = ship.invincible_left;
    float rock_x = rocks[0].position_x;
    float ship_x = ship.position_x;
    float ship_y = ship.position_y;
    unsigned long warning_time = current_game_ms;
    for (int i = 0; i < 100; ++i) {
        tick();
    }
    assert(game_ms == frozen_time && ship.invincible_left == invincibility_left
           && rocks[0].position_x == rock_x);
    assert(ship.position_x == ship_x && ship.position_y == ship_y);
    assert(current_game_ms == warning_time);
}

static void test_respawn_location() {
    memset(rocks, 0, sizeof(rocks));
    spawn_asteroid(SHIP_X, 20, AST_LARGE, -0.4f, 0);
    float respawn_x = 0;
    float respawn_y = 0;
    asteroid_safe_respawn(respawn_x, respawn_y);
    assert(respawn_x == SHIP_X && respawn_y > 40);

    // Fill the old vertical lane: the search must find another safe lane.
    memset(rocks, 0, sizeof(rocks));
    for (int position_y = SHIP_MIN_Y; position_y <= SHIP_MAX_Y;
         position_y += 8) {
        spawn_asteroid(SHIP_X, position_y, AST_LARGE, -0.4f, 0);
    }
    asteroid_safe_respawn(respawn_x, respawn_y);
    assert(respawn_x > SHIP_X && respawn_x < SCREEN_W / 2);
    assert(respawn_clearance(respawn_x, respawn_y) >= RESPAWN_SAFE_CLEARANCE);
    ship_respawn(ship, respawn_x, respawn_y);
    assert(ship.alive && ship.invincible_left == SHIP_INVINCIBLE_MS);
    assert(!asteroid_hits_ship(ship.position_x, ship.position_y));
    assert(respawn_x >= SHIP_MIN_X && respawn_x <= SHIP_MAX_X);
    assert(respawn_y >= SHIP_MIN_Y && respawn_y <= SHIP_MAX_Y);
}

static int test_best_score_and_retry() {
    // Confirmation saves once; death and held buttons cannot save or retry.
    ship.lives = 0;
    score = 100;
    set_state(STATE_DEATH_ANIM);
    tick(600);
    assert(game_get_state() == STATE_INITIALS && highscore_best() == 0);
    assert(final_score == 100 && !confirm_ready);
    int before = Preferences::writes;
    unsigned long frozen_ms = game_ms;
    float frozen_x = ship.position_x;
    for (int i = 0; i < 100; i++) {
        tick();
    }
    assert(Preferences::writes == before);
    assert(game_ms == frozen_ms && ship.position_x == frozen_x);
    assert(final_score == 100 && score == 100);
    fire(false);
    Preferences::fail_write = true;
    fire(true);
    assert(game_get_state() == STATE_INITIALS && save_failed);
    assert(highscore_count() == 0);
    Preferences::fail_write = false;
    fire(false);
    fire(true);
    assert(game_get_state() == STATE_GAME_OVER && highscore_best() == 100);
    assert(saved_rank == 0);
    int writes = Preferences::writes;
    for (int i = 0; i < 100; ++i) {
        tick();
    }
    assert(Preferences::writes == writes
           && game_get_state() == STATE_GAME_OVER);
    fire(false);
    fire(true);
    assert(game_get_state() == STATE_COUNTDOWN);
    assert(score == 0 && ship.lives == LIVES_START);
    highscore_init();
    assert(highscore_best() == 100);
    assert(!highscore_qualifies(0) && Preferences::writes == writes);

    return writes;
}

static void test_joystick_click() {
    // A single joystick click is not pause; the second click triggers once.
    click_raw_high = false;
    fake_millis += 20;
    input_update();
    fake_millis += 20;
    input_update();
    assert(!input_get().pause_triggered);
    click_raw_high = true;
    fake_millis += 20;
    input_update();
    fake_millis += 20;
    input_update();
    click_raw_high = false;
    fake_millis += 20;
    input_update();
    fake_millis += 20;
    input_update();
    assert(input_get().pause_triggered);
    fake_millis += 20;
    input_update();
    assert(!input_get().pause_triggered);
}

static void test_repeated_runs(int expected_writes) {
    // Further low-scoring runs reset cleanly and do not rewrite the best.
    for (int run = 0; run < 3; ++run) {
        ship.lives = 0;
        score = 0;
        set_state(STATE_DEATH_ANIM);
        tick(600);
        assert(game_get_state() == STATE_GAME_OVER && highscore_best() == 100);
        fire(false);
        tick(500);
        fire(true);
        assert(game_get_state() == STATE_COUNTDOWN && score == 0
               && ship.lives == 3);
    }
    assert(Preferences::writes == expected_writes);
}

