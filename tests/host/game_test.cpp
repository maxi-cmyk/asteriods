#include <cassert>
#include <iostream>
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
void display_hud(uint8_t, uint32_t) {
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
    assert(asteroid_wave() > 1 && wave_speed() < 0.831f);
    wave_number = 65535;
    assert(wave_speed() < 0.831f);
}

static void test_ship_movement() {
    // Movement stops on release and clamps inside the display.
    Ship test_ship = {};
    ship_init(test_ship);
    for (int i = 0; i < 100; ++i) {
        ship_update(test_ship, -1);
    }
    assert(test_ship.position_y >= HUD_HEIGHT + SHIP_RADIUS);
    float position_y = test_ship.position_y;
    ship_update(test_ship, 0);
    assert(test_ship.position_y == position_y);
    for (int i = 0; i < 100; ++i) {
        ship_update(test_ship, 1);
    }
    assert(test_ship.position_y + SHIP_RADIUS < SCREEN_H);
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
    for (int i = 0; i < 100; ++i) {
        tick();
    }
    assert(game_ms == frozen_time && ship.invincible_left == invincibility_left
           && rocks[0].position_x == rock_x);
}

static void test_respawn_location() {
    // Respawn chooses the clearest position along the ship's vertical
    // lane.
    memset(rocks, 0, sizeof(rocks));
    spawn_asteroid(SHIP_X, 20, AST_LARGE, -0.4f, 0);
    assert(asteroid_safe_respawn_y() > 40);
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

int main() {
    test_bullet_collisions();
    test_wave_progression();
    test_ship_movement();
    test_bullet_capacity();

    // Exercise a continuous session: fire, pause, die, retry, and save.
    test_fire_input_edges();
    test_pause_state();
    test_respawn_location();
    int expected_writes = test_best_score_and_retry();
    test_joystick_click();
    test_repeated_runs(expected_writes);

    std::cout << "Host gameplay checks passed\n";
}
