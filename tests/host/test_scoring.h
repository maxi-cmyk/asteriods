#pragma once
// Scoring, difficulty, spawn patterns, random ranges, score table, initials.
#include "harness.h"

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
    for (int byte = 0; byte < SCORE_ENTRY_BYTES; byte++) {
        std::swap(Preferences::blobs[TABLE_KEY][SCORE_RECORD_HEADER + byte],
                  Preferences::blobs[TABLE_KEY]
                                    [SCORE_RECORD_HEADER + SCORE_ENTRY_BYTES + byte]);
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

