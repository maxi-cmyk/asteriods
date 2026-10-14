#include <cassert>
#include <iostream>
#include "../../src/rock_random.cpp"
#include "../../src/difficulty.cpp"
#include "../../src/scoring.cpp"
#include "../../src/asteroid.cpp"
#include "../../src/bullet.cpp"
#include "../../src/ship.cpp"
#include "../../src/particle.cpp"
#include "../../src/highscore.cpp"
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
void sound_play(SoundFX) {
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
    // Death records best exactly once and holding fire cannot retry.
    ship.lives = 0;
    score = 100;
    set_state(STATE_DEATH_ANIM);
    tick(600);
    assert(game_get_state() == STATE_GAME_OVER && highscore_best() == 100);
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
    assert(!highscore_record(50) && Preferences::writes == writes);

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
        score = 10;
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
    Preferences::values["best-v2"] = 99999;
    highscore_init();
    assert(highscore_best() == 0);
    assert(highscore_record(100));
    assert(Preferences::values["best-v2"] == 99999);
    assert(Preferences::values["best-v3"] == 100);
    highscore_init();
    assert(highscore_best() == 100);
    Preferences::values.clear();
    Preferences::writes = 0;
}

int main() {
    assert(rock_random_init());
    test_hardware_random_ranges();
    test_difficulty_profiles();
    test_deferred_spawns_and_patterns();
    test_scoring_chain();
    test_individual_hit_scoring();
    test_score_versioning();
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
