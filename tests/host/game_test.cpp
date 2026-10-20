#include <cassert>
#include <iostream>
#include "../../src/rock_random.cpp"
#include "../../src/difficulty.cpp"
#include "../../src/scoring.cpp"
#include "../../src/asteroid.cpp"
#include "../../src/bullet.cpp"
#include "../../src/weapon.cpp"
#include "../../src/ship.cpp"
#include "../../src/powerup.cpp"
#include "../../src/particle.cpp"
#include "../../src/highscore.cpp"
#include "../../src/demo.cpp"
#include "../../src/game.cpp"
static Adafruit_SSD1306 screen = {};
Adafruit_SSD1306& display_get() {
    return screen;
}
void display_hud(uint8_t, uint32_t, uint8_t, unsigned long) {
}
void display_flip() {
}
void display_shake(uint8_t) {
}
void display_shake_update() {
}
static int shot_sounds = 0;
void sound_play(SoundFX effect) {
    if (effect == SFX_SHOOT) {
        shot_sounds++;
    }
}
void sound_stop() {
}
static void tick(unsigned long ms = FRAME_TIME_MS) {
    fake_millis += ms;
    input_update();
    game_update();
}
static void fire(bool pressed) {
    fire_raw_high = !pressed;
    tick();
    tick();
}

static int active_bullet_count() {
    int count = 0;

    for (int i = 0; i < BULLET_MAX; i++) {
        count += bullets[i].active;
    }

    return count;
}

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

static void test_scoring_chain() {
    scoring_reset();
    assert(scoring_multiplier() == 1 && scoring_chain_left(0) == 0);
    assert(scoring_award(20, 0) == 20);
    assert(scoring_award(50, 10) == 50);
    assert(scoring_award(100, 20) == 100);
    assert(scoring_multiplier() == 2);
    assert(scoring_award(20, 30) == 40);
    for (int i = 0; i < 8; i++) {
        scoring_award(100, 40);
    }
    assert(scoring_multiplier() == 5);
    assert(scoring_award(100, 50) == 500);
    assert(scoring_chain_left(3049) == 1);
    scoring_update(3049);
    assert(scoring_multiplier() == 5);
    scoring_update(3050);
    assert(scoring_multiplier() == 1 && scoring_chain_left(3050) == 0);
    assert(scoring_award(100, 3050) == 100);
    assert(scoring_award(0, 4000) == 0);
    assert(scoring_chain_left(6050) == 0);

    // Unsigned elapsed-time arithmetic also handles clock rollover.
    scoring_reset();
    unsigned long near_wrap = ~0UL - 100;
    scoring_award(100, near_wrap);
    assert(scoring_chain_left(near_wrap + 2999) == 1);
    scoring_update(near_wrap + 3000);
    assert(scoring_chain_left(near_wrap + 3000) == 0);
}

static void test_individual_hit_scoring() {
    begin_game();
    memset(rocks, 0, sizeof(rocks));
    pending_asteroids = 0;
    game_ms = 100;
    for (int i = 0; i < 4; i++) {
        spawn_asteroid(52, 20 + i * 10, AST_SMALL, -0.4f, 0);
        assert(bullets_fire(45, 20 + i * 10));
        bullets[i].position_x = 60;
    }
    assert(bullets_check_asteroids(award_asteroid_score) == 400);
    assert(score == 500 && scoring_multiplier() == 2);
    assert(asteroid_active_count() == 0);

    // The parent and each fragment are distinct kills with their own award.
    scoring_reset();
    score = 0;
    spawn_asteroid(60, 35, AST_MEDIUM, -0.4f, 0);
    assert(bullets_fire(40, 35));
    bullets[0].position_x = 70;
    bullets_check_asteroids(award_asteroid_score);
    assert(score == 50 && asteroid_active_count() == 2);
    for (int i = 0; i < 2; i++) {
        assert(bullets_fire(40, rocks[i].position_y));
        bullets[0].position_x = 70;
        bullets_check_asteroids(award_asteroid_score);
    }
    assert(score == 250 && scoring_multiplier() == 2);
    score = SCORE_MAX - 1;
    award_asteroid_score(100);
    assert(score == SCORE_MAX);

    // Neither pause nor the frozen death animation advances chain time.
    unsigned long frozen_time = game_ms;
    unsigned long chain_left = scoring_chain_left(game_ms);
    set_state(STATE_PAUSED);
    tick(5000);
    assert(game_ms == frozen_time);
    assert(scoring_chain_left(game_ms) == chain_left);
    ship.lives = 1;
    set_state(STATE_DEATH_ANIM);
    tick(DEATH_ANIMATION_MS - 1);
    assert(game_ms == frozen_time);
    assert(scoring_chain_left(game_ms) == chain_left);

    // A real collision clears the chain; a new run also starts at x1.
    set_state(STATE_PLAYING);
    ship.invincible_left = 0;
    memset(rocks, 0, sizeof(rocks));
    spawn_asteroid(ship.position_x, ship.position_y, AST_LARGE, -0.4f, 0);
    InputState neutral = {};
    update_playing(neutral);
    assert(game_get_state() == STATE_DEATH_ANIM);
    assert(scoring_multiplier() == 1 && scoring_chain_left(game_ms) == 0);
    begin_game();
    assert(score == 0 && scoring_multiplier() == 1);
}

static void test_difficulty_profiles() {
    WaveDifficulty previous = difficulty_for_wave(1);
    assert(previous.population == 3 && previous.spawn_interval_ms == 2000);
    assert(fabsf(previous.speed - 0.34f) < 0.001f);
    for (int wave = 2; wave <= 65535; wave++) {
        WaveDifficulty current = difficulty_for_wave(wave);
        assert(current.speed >= previous.speed && current.speed <= 0.851f);
        assert(current.spawn_interval_ms <= previous.spawn_interval_ms);
        assert(current.spawn_interval_ms >= 900);
        assert(current.population >= previous.population);
        assert(current.population <= 8);
        assert(current.drift >= previous.drift && current.drift <= 0.121f);
        assert(current.recovery_ms == 1500);
        previous = current;
    }
    assert(difficulty_for_wave(3).population == 4);
    assert(difficulty_for_wave(7).population == 5);
    assert(difficulty_for_wave(12).population == 6);
    assert(difficulty_for_wave(24).population == 8);
    assert(difficulty_for_wave(3).pattern_level == 0);
    assert(difficulty_for_wave(4).pattern_level == 1);
    assert(difficulty_for_wave(8).pattern_level == 2);
}

static void test_deferred_spawns_and_patterns() {
    asteroids_init();
    float preview_y = pending_spawn_y;
    spawn_asteroid(SCREEN_W, preview_y, AST_LARGE, -0.4f, 0);
    spawn_pending_asteroid(SPAWN_WARNING_MS);
    assert(pending_asteroids == wave_difficulty.population);
    assert(pending_spawn_y == preview_y);
    assert(next_spawn_ms == SPAWN_WARNING_MS + SPAWN_RETRY_MS);
    memset(rocks, 0, sizeof(rocks));
    unsigned long resumed_ms = next_spawn_ms + 10000;
    spawn_pending_asteroid(resumed_ms);
    assert(asteroid_active_count() == 1);
    assert(next_spawn_ms == resumed_ms + wave_difficulty.spawn_interval_ms);
    spawn_pending_asteroid(resumed_ms);
    assert(asteroid_active_count() == 1);

    // Reserve slots for splits; deferred spawns never consume pending rocks.
    memset(rocks, 0, sizeof(rocks));
    for (int i = 0; i < ASTEROID_MAX - 2; i++) {
        spawn_asteroid(40, 35, AST_SMALL, -0.4f, 0);
    }
    int pending_before = pending_asteroids;
    spawn_pending_asteroid(next_spawn_ms);
    assert(pending_asteroids == pending_before);

    for (int pattern = 1; pattern <= 2; pattern++) {
        memset(rocks, 0, sizeof(rocks));
        wave_number = 12;
        prepare_wave(0);
        wave_pattern = pattern;
        pattern_top_first = true;
        pending_spawn_y = choose_spawn_height();
        float first_y = pending_spawn_y;
        spawn_pending_asteroid(next_spawn_ms);
        float second_y = pending_spawn_y;
        assert(second_y - first_y >= 26);
        memset(rocks, 0, sizeof(rocks));
        unsigned long second_ms = next_spawn_ms;
        spawn_pending_asteroid(second_ms);
        unsigned long expected_gap = wave_difficulty.spawn_interval_ms;
        if (pattern == 2) {
            expected_gap += PAIR_RECOVERY_MS;
        }
        assert(next_spawn_ms == second_ms + expected_gap);
    }

    // Three-lane clusters keep a full warning interval between members.
    memset(rocks, 0, sizeof(rocks));
    wave_number = 12;
    prepare_wave(0);
    assert(wave_difficulty.pattern_level == 3);
    wave_pattern = 3;
    pattern_top_first = true;
    float heights[3] = {};
    for (int i = 0; i < 3; i++) {
        heights[i] = choose_spawn_height();
        pending_spawn_y = heights[i];
        unsigned long at = next_spawn_ms;
        spawn_pending_asteroid(at);
        assert(next_spawn_ms - at >= SPAWN_WARNING_MS);
        memset(rocks, 0, sizeof(rocks));
    }
    assert(heights[0] < heights[1] && heights[1] < heights[2]);
    // Every fourth entrance from wave six is a faster small rock. Its preview
    // and pending identity survive a blocked entrance.
    wave_number = 6;
    prepare_wave(0);
    spawned_in_wave = 3;
    assert(pending_spawn_size() == AST_SMALL);
    float fast_y = pending_spawn_y;
    spawn_asteroid(SCREEN_W, fast_y, AST_LARGE, 0, 0);
    unsigned long blocked_at = next_spawn_ms;
    spawn_pending_asteroid(blocked_at);
    assert(pending_spawn_y == fast_y && spawned_in_wave == 3);
    memset(rocks, 0, sizeof(rocks));
    spawn_pending_asteroid(next_spawn_ms);
    assert(rocks[0].size == AST_SMALL);
    assert(fabsf(rocks[0].velocity_x + wave_difficulty.speed * 1.45f) < 0.001f);
    wave_number = 5;
    assert(pending_spawn_size() == AST_LARGE);

    // The last wave saturates, rather than wrapping to the opening profile.
    memset(rocks, 0, sizeof(rocks));
    wave_number = 65535;
    prepare_wave(0);
    pending_asteroids = 0;
    update_wave(0);
    update_wave(1500);
    assert(wave_number == 65535 && wave_difficulty.population == 8);
    asteroids_init();
    assert(wave_number == 1 && wave_difficulty.population == 3);
}

static void test_hardware_random_ranges() {
    assert(WiFi.started && !WiFi.sleep && !WiFi.reconnect);
    random_words = {0, 5, 6, 9, 10};
    unsigned before = random_word_reads;
    assert(rock_random_bounded(10) == 6);
    assert(random_word_reads == before + 3);
    assert(rock_random_bounded(10) == 9);
    assert(rock_random_bounded(10) == 0);
    random_words = {0, UINT32_MAX};
    assert(rock_random_bounded(2) == 0);
    assert(rock_random_bounded(2) == 1);
    assert(rock_random_bounded(0) == 0);
    assert(rock_random_range(4, 4) == 4);
    for (int wave : {1, 5, 12, 65535}) {
        asteroids_init();
        wave_number = wave;
        before = random_word_reads;
        prepare_wave(0);
        assert(random_word_reads > before);
        before = random_word_reads;
        spawn_pending_asteroid(next_spawn_ms);
        assert(random_word_reads > before);
        assert(rocks[0].position_y >= 20 && rocks[0].position_y < 55);
        assert(fabsf(rocks[0].velocity_y) <= wave_difficulty.drift);
        for (int vertex = 0; vertex < ASTEROID_VERTICES; vertex++) {
            assert(rocks[0].offsets[vertex] <= 0);
            assert(rocks[0].offsets[vertex] > -OTHER_ROCK_OUTLINE_RANGE);
        }
    }
}

static void test_score_versioning() {
    Preferences::values.clear();
    Preferences::blobs.clear();
    Preferences::values["best-v2"] = 99999;
    Preferences::values["best-v3"] = 777;
    Preferences::blobs["tbl"] = {1, 2, 3};
    highscore_init();
    assert(highscore_best() == 0 && highscore_count() == 0);
    assert(!highscore_qualifies(0) && !highscore_qualifies(1000000));
    assert(highscore_record(100, "AAA") == 0);
    assert(highscore_record(100, "BBB") == 1);
    assert(highscore_record(50, "CCC") == 2);
    assert(highscore_record(200, "DDD") == 0);
    assert(highscore_record(25, "EEE") == 4);
    assert(!highscore_qualifies(25));
    assert(highscore_record(100, "FFF") == 3);
    assert(highscore_count() == 5);
    assert(strcmp(highscore_entries()[1].initials, "AAA") == 0);
    assert(strcmp(highscore_entries()[2].initials, "BBB") == 0);
    assert(highscore_entries()[4].score == 50);
    int writes = Preferences::writes;
    assert(highscore_record(300, "aaA") == -1);
    assert(highscore_record(300, "AB") == -1);
    assert(highscore_record(300, "ABCD") == -1);
    assert(Preferences::writes == writes);
    Preferences::fail_begin = true;
    assert(highscore_record(300, "ABC") == -1);
    Preferences::fail_begin = false;
    Preferences::fail_write = true;
    assert(highscore_record(300, "ABC") == -1);
    assert(highscore_best() == 200);
    Preferences::fail_write = false;
    assert(highscore_record(HIGHSCORE_MAX, "XYZ") == 0);
    highscore_init();
    assert(highscore_best() == HIGHSCORE_MAX);
    assert(strcmp(highscore_entries()[0].initials, "XYZ") == 0);
    assert(Preferences::values["best-v2"] == 99999);
    assert(Preferences::values["best-v3"] == 777);
    assert(Preferences::blobs["tbl"].size() == 3);
    auto valid = Preferences::blobs[TABLE_KEY];
    Preferences::fail_begin = true;
    highscore_init();
    assert(highscore_count() == 0);
    Preferences::fail_begin = false;
    Preferences::fail_read = true;
    highscore_init();
    assert(highscore_count() == 0);
    Preferences::fail_read = false;
    // A valid score in the wrong order must also reject the whole table.
    for (int byte = 0; byte < ENTRY_BYTES; byte++) {
        std::swap(Preferences::blobs[TABLE_KEY][RECORD_HEADER + byte],
                  Preferences::blobs[TABLE_KEY]
                                    [RECORD_HEADER + ENTRY_BYTES + byte]);
    }
    highscore_init();
    assert(highscore_count() == 0);
    Preferences::blobs[TABLE_KEY] = valid;
    Preferences::blobs[TABLE_KEY][1] = 0;
    highscore_init();
    assert(highscore_count() == 0);
    for (int offset : {0, 1, 2, 6, 9, 13}) {
        Preferences::blobs[TABLE_KEY] = valid;
        Preferences::blobs[TABLE_KEY][offset] = 255;
        highscore_init();
        assert(highscore_count() == 0);
    }
    Preferences::blobs[TABLE_KEY] = valid;
    Preferences::blobs[TABLE_KEY].pop_back();
    highscore_init();
    assert(highscore_count() == 0);
    Preferences::blobs.clear();
    Preferences::values.clear();
    Preferences::writes = 0;
}

static void test_initials_navigation() {
    memcpy(entered_initials, "AAA", 4);
    selected_initial = 0;
    navigation_direction = 0;
    InputState input = {};
    input.joystick_y = -1;
    navigate_initials(input);
    assert(strcmp(entered_initials, "BAA") == 0);
    navigate_initials(input);
    assert(strcmp(entered_initials, "BAA") == 0);
    fake_millis += INITIALS_REPEAT_MS;
    navigate_initials(input);
    assert(strcmp(entered_initials, "CAA") == 0);
    input.joystick_x = 1;
    navigate_initials(input);
    assert(selected_initial == 1);
    input.joystick_x = 0;
    input.joystick_y = 1;
    navigate_initials(input);
    assert(strcmp(entered_initials, "CZA") == 0);
    input.joystick_y = -1;
    navigate_initials(input);
    assert(strcmp(entered_initials, "CAA") == 0);
    input.joystick_x = 1;
    navigate_initials(input);
    fake_millis += INITIALS_REPEAT_MS;
    navigate_initials(input);
    assert(selected_initial == 2 && entered_initials[3] == '\0');
    input.joystick_x = -1;
    for (int i = 0; i < 4; i++) {
        fake_millis += INITIALS_REPEAT_MS;
        navigate_initials(input);
    }
    assert(selected_initial == 0);
    input.joystick_x = 0.1f;
    input.joystick_y = 0.1f;
    navigate_initials(input);
    assert(navigation_direction == 0);
}

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

static void test_demo_controller() {
    clear_test_world();
    DemoController controller = {};
    demo_reset(controller);
    ship_respawn(ship, SHIP_X, 35);
    memset(rocks, 0, sizeof(rocks));
    spawn_asteroid(75, 35, AST_LARGE, -0.4f, 0);
    spawn_asteroid(5, 35, AST_SMALL, -0.4f, 0);
    spawn_asteroid(15, 28, AST_SMALL, -0.4f, 0);
    InputState decision = demo_update(controller, ship, rocks, 0);
    assert(controller.target == 0 && decision.fire_pressed);
    assert(controller.dodging);
    int direction = controller.dodge_direction;
    for (unsigned long ms = 20; ms < 300; ms += 20) {
        decision = demo_update(controller, ship, rocks, ms);
        assert(controller.dodge_direction == direction);
    }
    // Nearby targets cannot steal a valid lock; aligned aiming stays still.
    rocks[1].active = false;
    rocks[2].active = false;
    spawn_asteroid(55, 48, AST_SMALL, -0.4f, 0);
    decision = demo_update(controller, ship, rocks, 1000);
    assert(controller.target == 0 && decision.joystick_y == 0);
    rocks[0].active = false;
    decision = demo_update(controller, ship, rocks, 1020);
    assert(controller.target == 1 && decision.joystick_y > 0);
    memset(rocks, 0, sizeof(rocks));
    decision = demo_update(controller, ship, rocks, 2000);
    assert(controller.target == -1 && !decision.fire_pressed);
    assert(decision.joystick_y == 0);
    // Behind/offscreen rocks are excluded, including from shooting.
    spawn_asteroid(0, 35, AST_SMALL, -0.4f, 0);
    spawn_asteroid(SCREEN_W + 1, 35, AST_SMALL, -0.4f, 0);
    decision = demo_update(controller, ship, rocks, 2200);
    assert(controller.target == -1 && !decision.fire_pressed);
    // All corners remain bounded even with nearby threats.
    for (float x : {float(SHIP_MIN_X), float(SHIP_MAX_X)}) {
        for (float y : {float(SHIP_MIN_Y), float(SHIP_MAX_Y)}) {
            ship_respawn(ship, x, y);
            for (int frame = 0; frame < 100; frame++) {
                decision = demo_update(
                        controller, ship, rocks, 3000 + frame * 20);
                ship_update(ship, decision.joystick_x, decision.joystick_y);
                assert(ship.position_x >= SHIP_MIN_X
                       && ship.position_x <= SHIP_MAX_X);
                assert(ship.position_y >= SHIP_MIN_Y
                       && ship.position_y <= SHIP_MAX_Y);
            }
        }
    }
}

static void test_demo_lifecycle() {
    fire_raw_high = true;
    joystick_raw_x = 2048;
    joystick_raw_y = 2048;
    input_init();
    game_init();
    tick(DEMO_IDLE_MS);
    assert(state == STATE_DEMO && demo_running);
    int writes = Preferences::writes;
    for (int frame = 0; frame < 15000; frame++) {
        tick();
        assert(state != STATE_INITIALS && state != STATE_GAME_OVER);
    }
    assert(Preferences::writes == writes);
    // Exit press is consumed; holding cannot start a run.
    begin_game();
    demo_running = true;
    set_state(STATE_DEMO);
    fire(true);
    assert(state == STATE_MENU && !demo_running);
    fire(true);
    assert(state == STATE_MENU);
    fire(false);
    fire(true);
    assert(state == STATE_COUNTDOWN);
    fire(false);
}

int main() {
    assert(rock_random_init());
    test_demo_controller();
    test_demo_lifecycle();
    test_unlimited_primary_fire();
    test_multishot_allocation_and_sweep();
    test_pickup_drops_and_collection();
    test_powerup_game_rules();
    test_powerup_input_and_rendering();
    test_hardware_random_ranges();
    test_difficulty_profiles();
    test_deferred_spawns_and_patterns();
    test_scoring_chain();
    test_individual_hit_scoring();
    test_score_versioning();
    test_initials_navigation();
    test_bullet_collisions();
    test_wave_progression();
    test_ship_movement();
    test_bullet_capacity();
    test_spawn_warning();
    test_input_movement_and_firing();
    set_state(STATE_MENU);

    // Exercise a continuous session: fire, pause, die, retry, and save.
    test_fire_input_edges();
    test_pause_state();
    test_respawn_location();
    int expected_writes = test_best_score_and_retry();
    test_joystick_click();
    test_repeated_runs(expected_writes);

    std::cout << "Host gameplay checks passed\n";
}
