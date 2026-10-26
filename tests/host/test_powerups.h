#pragma once
// Powerups: multishot, pickups, shield, double fire, unlimited primary fire.
#include "harness.h"

static void clear_test_world() {
    begin_game();
    set_state(STATE_PLAYING);
    pending_asteroids = 0;
    memset(rocks, 0, sizeof(rocks));
    ship_respawn(ship, 50, 35);
}

static void test_multishot_allocation_and_sweep() {
    bullets_init();
    assert(bullets_fire(20, 35, true));
    assert(active_bullet_count() == 3);
    bullets_update();
    assert(bullets[0].position_y == 35);
    assert(bullets[1].position_y < 35 && bullets[2].position_y > 35);
    assert(fabsf(hypotf(bullets[1].velocity_x, bullets[1].velocity_y)
                 - BULLET_SPEED)
           < 0.001f);
    for (int free = 0; free <= 3; free++) {
        bullets_init();
        for (int i = 0; i < BULLET_MAX - free; i++) {
            assert(bullets_fire(20, 35));
        }
        assert(bullets_fire(20, 35, true) == (free > 0));
        int added = free == 3 ? 3 : (free > 0 ? 1 : 0);
        assert(active_bullet_count() == BULLET_MAX - free + added);
    }

    memset(rocks, 0, sizeof(rocks));
    spawn_asteroid(50, 35, AST_SMALL, 0, 0);
    assert(asteroids_hit_segment(40, 25, 60, 45) == SCORE_SMALL);
    spawn_asteroid(50, 35, AST_SMALL, 0, 0);
    assert(asteroids_hit_segment(60, 45, 40, 25) == SCORE_SMALL);
    spawn_asteroid(50, 35, AST_SMALL, 0, 0);
    assert(asteroids_hit_segment(40, 20, 60, 30) == 0);
    assert(asteroids_hit_segment(50, 35, 50, 35) == SCORE_SMALL);
    spawn_asteroid(60, 45, AST_SMALL, 0, 0);
    spawn_asteroid(50, 35, AST_SMALL, 0, 0);
    assert(asteroids_hit_segment(40, 25, 70, 55) == SCORE_SMALL);
    assert(rocks[0].active && !rocks[1].active);

    bullets_init();
    memset(rocks, 0, sizeof(rocks));
    assert(bullets_fire(20, HUD_HEIGHT, true));
    bullets_update();
    bullets_check_asteroids();
    assert(!bullets[1].active && bullets[0].active && bullets[2].active);
    bullets_init();
    assert(bullets_fire(20, SCREEN_H - 1, true));
    bullets_update();
    bullets_check_asteroids();
    assert(!bullets[2].active);
}

static void force_pickup(PickupKind kind, float x, float y) {
    pickup = {x, y, kind, true};
}

static void test_pickup_drops_and_collection() {
    clear_test_world();
    // Controlled hardware words verify the exact 10/100 boundary and kinds.
    random_words = {110, 0};
    powerups_drop(-20, 100);
    assert(!pickup.active);
    random_words = {109, 0};
    powerups_drop(-20, 100);
    assert(pickup.active && pickup.kind == PICKUP_MULTISHOT);
    assert(pickup.position_x == SHIP_MIN_X);
    assert(pickup.position_y == SHIP_MAX_Y);
    unsigned reads = random_word_reads;
    powerups_drop(50, 35);
    assert(random_word_reads == reads && pickup.position_x == SHIP_MIN_X);
    pickup.active = false;
    random_words = {100, 1};
    powerups_drop(50, 35);
    assert(pickup.kind == PICKUP_SHIELD);
    powerups_update(ship);
    assert(!pickup.active && ship.effects.shield && collection_cue_left);
    force_pickup(PICKUP_SHIELD, 50, 35);
    powerups_update(ship);
    assert(ship.effects.shield);
    force_pickup(PICKUP_MULTISHOT, 50, 35);
    powerups_update(ship);
    assert(ship.effects.shield);
    assert(ship.effects.multishot_left_ms == MULTISHOT_DURATION_MS);
    powerups_update(ship);
    assert(ship.effects.multishot_left_ms
           == MULTISHOT_DURATION_MS - FRAME_TIME_MS);
    force_pickup(PICKUP_MULTISHOT, 50, 35);
    powerups_update(ship);
    assert(ship.effects.multishot_left_ms == MULTISHOT_DURATION_MS);
    for (unsigned long i = 0; i < MULTISHOT_DURATION_MS / FRAME_TIME_MS - 1;
         i++) {
        powerups_update(ship);
    }
    assert(ship.effects.multishot_left_ms == FRAME_TIME_MS);
    powerups_update(ship);
    assert(ship.effects.multishot_left_ms == 0 && ship.effects.shield);
    force_pickup(PICKUP_MULTISHOT, -PICKUP_RADIUS, 35);
    powerups_update(ship);
    assert(!pickup.active);

    // Only a successful destruction rolls for a drop (including fragments).
    clear_test_world();
    spawn_asteroid(60, 35, AST_SMALL, 0, 0);
    assert(bullets_fire(50, 35));
    bullets[0].position_x = 70;
    random_words = {100, 1};
    bullets_check_asteroids(nullptr, powerups_drop);
    assert(pickup.active && pickup.kind == PICKUP_SHIELD);
    assert(pickup.position_x == 60 && pickup.position_y == 35);
    random_words.clear();
}

static void test_powerup_game_rules() {
    clear_test_world();
    force_pickup(PICKUP_MULTISHOT, 50, 35);
    InputState pressed = {};
    pressed.fire_pressed = true;
    update_playing(pressed);
    assert(active_bullet_count() == 3);
    assert(ship.weapon.last_shot_ms == game_ms);
    InputState idle = {};
    update_playing(idle);
    assert(active_bullet_count() == 3);
    unsigned long remaining = ship.effects.multishot_left_ms;
    force_pickup(PICKUP_SHIELD, 100, 35);
    float pickup_x = pickup.position_x;
    InputState pause = {};
    pause.pause_triggered = true;
    update_playing(pause);
    for (int i = 0; i < 400; i++) {
        update_paused(idle);
    }
    assert(ship.effects.multishot_left_ms == remaining);
    assert(pickup.position_x == pickup_x);
    set_state(STATE_PLAYING);
    // Consecutive multishot volleys have no firing delay.
    bullets_init();
    update_playing(pressed);
    assert(active_bullet_count() == 3);
    update_playing(pressed);
    assert(active_bullet_count() == 6);
    // Expiry immediately restores single fire.
    ship.effects.multishot_left_ms = FRAME_TIME_MS;
    bullets_init();
    update_playing(pressed);
    assert(active_bullet_count() == 1);

    clear_test_world();
    ship.invincible_left = 0;
    ship.effects.shield = true;
    ship.effects.multishot_left_ms = MULTISHOT_DURATION_MS;
    for (int i = 0; i < 3; i++) {
        award_asteroid_score(SCORE_SMALL);
    }
    uint32_t preserved_score = score;
    spawn_asteroid(50, 35, AST_SMALL, 0, 0);
    update_playing(idle);
    assert(state == STATE_PLAYING && ship.lives == LIVES_START);
    assert(!ship.effects.shield
           && ship.invincible_left == SHIELD_PROTECTION_MS);
    assert(score == preserved_score && scoring_multiplier() == 2);
    for (unsigned long i = 0; i < SHIELD_PROTECTION_MS / FRAME_TIME_MS - 1;
         i++) {
        update_playing(idle);
    }
    assert(ship.alive && ship.lives == LIVES_START);
    update_playing(idle);
    assert(state == STATE_DEATH_ANIM && ship.lives == LIVES_START - 1);
    assert(ship.effects.multishot_left_ms == 0 && !ship.effects.shield);
    assert(!pickup.active && scoring_multiplier() == 1);
    ship_respawn(ship, 50, 35, game_ms);
    assert(!ship.effects.shield && ship.effects.multishot_left_ms == 0);
    force_pickup(PICKUP_SHIELD, 50, 35);
    ship.effects.shield = true;
    begin_game();
    assert(!pickup.active && !ship.effects.shield);
}

static void test_powerup_input_and_rendering() {
    clear_test_world();
    input_init();
    fire(false);
    ship.effects.multishot_left_ms = MULTISHOT_DURATION_MS;
    int sounds = shot_sounds;
    fire(true);
    assert(active_bullet_count() == 3 && shot_sounds == sounds + 1);
    for (int i = 0; i < 10; i++) {
        tick();
    }
    assert(shot_sounds == sounds + 1);
    fire(false);
    fire(true);
    assert(shot_sounds == sounds + 2);
    fire(false);

    // Record the shield alone while the inner ship blinks off, at all corners.
    Ship powered_ship = {};
    ship_init(powered_ship);
    powered_ship.effects = {MULTISHOT_DURATION_MS, true};
    powered_ship.invincible_left = 2 * SHIP_BLINK_MS;
    for (int x : {SHIP_MIN_X, SHIP_MAX_X}) {
        for (int y : {SHIP_MIN_Y, SHIP_MAX_Y}) {
            powered_ship.position_x = x;
            powered_ship.position_y = y;
            Adafruit_SSD1306 drawing = {};
            ship_draw(powered_ship, drawing);
            assert(drawing.triangle_calls == 1);
            assert(drawing.triangle_min_x >= 0);
            assert(drawing.triangle_max_x < SCREEN_W);
            assert(drawing.triangle_min_y >= HUD_HEIGHT);
            assert(drawing.triangle_max_y < SCREEN_H);
            assert(drawing.line_x >= 0);
            assert(drawing.line_x + drawing.line_width <= SCREEN_W);
            assert(drawing.line_y < SCREEN_H && drawing.line_y >= HUD_HEIGHT);
            powered_ship.effects.multishot_left_ms = 1;
            ship_draw(powered_ship, drawing);
            assert(drawing.line_width == 1);
        }
    }
}

static void test_unlimited_primary_fire() {
    clear_test_world();
    InputState pressed = {};
    pressed.fire_pressed = true;
    for (int i = 0; i < 100; i++) {
        bullets_init();
        update_playing(pressed);
        assert(active_bullet_count() == 1);
        assert(ship.weapon.last_shot_ms == game_ms);
    }
    float start_x = ship.position_x;
    ship_update(ship, 1, 0);
    assert(fabsf(ship.position_x - start_x - SHIP_MAX_SPEED) < 0.001f);
    // Full pools reject quietly; the next available frame can shoot.
    bullets_init();
    for (int i = 0; i < BULLET_MAX; i++) {
        assert(bullets_fire(0, 35));
    }
    int sounds = shot_sounds;
    unsigned long last_shot = ship.weapon.last_shot_ms;
    update_playing(pressed);
    assert(shot_sounds == sounds && ship.weapon.last_shot_ms == last_shot);
    bullets_init();
    InputState held = {};
    held.fire_held = true;
    update_playing(held);
    assert(active_bullet_count() == 0);
    update_playing(pressed);
    assert(active_bullet_count() == 1 && shot_sounds == sounds + 1);
    Adafruit_SSD1306 drawing = {};
    ship_draw(ship, drawing);
    assert(drawing.outline_calls == 0 && drawing.fill_calls == 0);
}

