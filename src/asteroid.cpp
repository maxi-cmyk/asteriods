#include "asteroid.h"
#include "config.h"
#include "particle.h"
#include "display.h"
#include "sound.h"
#include "difficulty.h"
#include "rock_random.h"

static const uint16_t WAVE_NUMBER_MAX = 65535;
static const unsigned long SPAWN_RETRY_MS = 100;
static const unsigned long PAIR_RECOVERY_MS = 350;
static const unsigned long WAVE_CUE_MS = 800;
static const int SPAWN_MIN_FREE_SLOTS = 3;
static const int SPAWN_DODGE_GAP = 12;
static const int PATTERN_HEIGHT_RANGE = 5;
static const unsigned long SPAWN_WARNING_MS = 700;
static const int SPAWN_WARNING_WIDTH = 3;
static const int RANDOM_ANGLE_STEPS = 628;
static const float RANDOM_ANGLE_SCALE = 100.0f;
static const int RANDOM_DRIFT_STEPS = 101;
static const int RANDOM_DRIFT_CENTER = 50;
static const float ROTATION_RANDOM_SCALE = 4000.0f;
static const float VERTICAL_DRIFT_SCALE = 50.0f;
static const int SMALL_ROCK_OUTLINE_RANGE = 2;
static const int OTHER_ROCK_OUTLINE_RANGE = 3;
static const float FRAGMENT_SPEED_MULTIPLIER = 1.08f;
static const float FRAGMENT_VERTICAL_SPEED = 0.18f;
static const int LARGE_ROCK_SHAKE_FRAMES = 2;
static const int ROCK_BORDER_GAP = 1;
static const int RESPAWN_SEARCH_STEP = 4;
static const float RESPAWN_SAFE_CLEARANCE = 12.0f;
static const float CLEARANCE_SEARCH_LIMIT = 1000.0f;

static Asteroid rocks[ASTEROID_MAX] = {};
static uint16_t wave_number = 0;
static uint8_t pending_asteroids = 0;
static unsigned long next_spawn_ms = 0;
static unsigned long wave_cleared_ms = 0;
static bool waiting_for_next_wave = false;
static unsigned long current_game_ms = 0;
static float pending_spawn_y = 0;
static WaveDifficulty wave_difficulty = {};
static uint8_t wave_pattern = 0;
static uint8_t spawned_in_wave = 0;
static bool pattern_top_first = false;
static unsigned long wave_started_ms = 0;

static int free_slots() {
    int count = 0;

    for (int i = 0; i < ASTEROID_MAX; i++) {
        if (!rocks[i].active) {
            count++;
        }
    }

    return count;
}

static uint8_t asteroid_radius(AsteroidSize size) {
    if (size == AST_LARGE) {
        return ASTEROID_LARGE_R;
    } else if (size == AST_MEDIUM) {
        return ASTEROID_MEDIUM_R;
    } else {
        return ASTEROID_SMALL_R;
    }
}

static uint32_t asteroid_points(AsteroidSize size) {
    if (size == AST_LARGE) {
        return SCORE_LARGE;
    } else if (size == AST_MEDIUM) {
        return SCORE_MEDIUM;
    } else {
        return SCORE_SMALL;
    }
}

static void spawn_asteroid(float position_x,
                           float position_y,
                           AsteroidSize size,
                           float velocity_x,
                           float velocity_y) {
    for (int i = 0; i < ASTEROID_MAX; i++) {
        if (rocks[i].active) {
            continue;
        }

        Asteroid& asteroid = rocks[i];
        asteroid = {};
        asteroid.active = true;
        asteroid.position_x = position_x;
        asteroid.position_y = position_y;
        asteroid.velocity_x = velocity_x;
        asteroid.velocity_y = velocity_y;
        asteroid.size = size;
        asteroid.radius = asteroid_radius(size);
        asteroid.angle
                = rock_random_bounded(RANDOM_ANGLE_STEPS) / RANDOM_ANGLE_SCALE;
        asteroid.rotation_speed = (int(rock_random_bounded(RANDOM_DRIFT_STEPS))
                                   - RANDOM_DRIFT_CENTER)
                                  / ROTATION_RANDOM_SCALE;

        int outline_range = OTHER_ROCK_OUTLINE_RANGE;

        if (size == AST_SMALL) {
            outline_range = SMALL_ROCK_OUTLINE_RANGE;
        }

        // Keep the outline inside the collision circle, even for small rocks.
        for (int j = 0; j < ASTEROID_VERTICES; j++) {
            asteroid.offsets[j] = -int(rock_random_bounded(outline_range));
        }

        return;
    }
}

static float choose_spawn_height() {
    int minimum = HUD_HEIGHT + ASTEROID_LARGE_R + ROCK_BORDER_GAP;
    int maximum = SCREEN_H - ASTEROID_LARGE_R;

    if (wave_pattern == 3) {
        int lane = spawned_in_wave % 3;
        if (!pattern_top_first) {
            lane = 2 - lane;
        }
        int middle = minimum + (maximum - minimum) * lane / 2;
        minimum = max(minimum, middle - 2);
        maximum = min(maximum, middle + 2);
    } else if (wave_pattern) {
        bool top = (spawned_in_wave % 2 == 0) == pattern_top_first;
        if (top) {
            maximum = minimum + PATTERN_HEIGHT_RANGE;
        } else {
            minimum = maximum - PATTERN_HEIGHT_RANGE;
        }
    }

    return rock_random_range(minimum, maximum);
}

static void prepare_wave(unsigned long now) {
    wave_difficulty = difficulty_for_wave(wave_number);
    pending_asteroids = wave_difficulty.population;
    wave_pattern = rock_random_bounded(wave_difficulty.pattern_level + 1);
    pattern_top_first = rock_random_bounded(2) != 0;
    spawned_in_wave = 0;
    wave_started_ms = now;
    next_spawn_ms = now + SPAWN_WARNING_MS;
    pending_spawn_y = choose_spawn_height();
    waiting_for_next_wave = false;
}

void asteroids_init() {
    memset(rocks, 0, sizeof(rocks));
    wave_number = 1;
    current_game_ms = 0;
    wave_cleared_ms = 0;
    prepare_wave(0);
}

int asteroid_active_count() {
    int count = 0;

    for (int i = 0; i < ASTEROID_MAX; i++) {
        if (rocks[i].active) {
            count++;
        }
    }

    return count;
}

uint16_t asteroid_wave() {
    return wave_number;
}

static AsteroidSize pending_spawn_size() {
    return wave_number >= 6 && spawned_in_wave % 4 == 3 ? AST_SMALL : AST_LARGE;
}

static bool spawn_corridor_clear() {
    float pending_radius = asteroid_radius(pending_spawn_size());
    for (int i = 0; i < ASTEROID_MAX; i++) {
        const Asteroid& asteroid = rocks[i];
        float horizontal_gap = SCREEN_W + pending_radius - asteroid.position_x;
        float vertical_gap = fabsf(pending_spawn_y - asteroid.position_y);
        float safe_gap = asteroid.radius + pending_radius + SPAWN_DODGE_GAP;

        if (asteroid.active && horizontal_gap < safe_gap
            && vertical_gap < safe_gap) {
            return false;
        }
    }

    return true;
}

static void spawn_pending_asteroid(unsigned long now) {
    if (!pending_asteroids || now < next_spawn_ms) {
        return;
    }

    if (free_slots() < SPAWN_MIN_FREE_SLOTS || !spawn_corridor_clear()) {
        next_spawn_ms = now + SPAWN_RETRY_MS;
        return;
    }

    float vertical_speed = (int(rock_random_bounded(RANDOM_DRIFT_STEPS))
                            - RANDOM_DRIFT_CENTER)
                           / VERTICAL_DRIFT_SCALE * wave_difficulty.drift;
    AsteroidSize size = pending_spawn_size();
    float speed = wave_difficulty.speed * (size == AST_SMALL ? 1.45f : 1.0f);
    spawn_asteroid(SCREEN_W + asteroid_radius(size),
                   pending_spawn_y,
                   size,
                   -speed,
                   vertical_speed);
    pending_asteroids--;
    spawned_in_wave++;
    next_spawn_ms = now + wave_difficulty.spawn_interval_ms;
    if ((wave_pattern == 2 && spawned_in_wave % 2 != 0)
        || (wave_pattern == 3 && spawned_in_wave % 3 != 0)) {
        next_spawn_ms = now
                        + max(SPAWN_WARNING_MS,
                              wave_difficulty.spawn_interval_ms * 2 / 3);
    }
    if ((wave_pattern == 2 && spawned_in_wave % 2 == 0)
        || (wave_pattern == 3 && spawned_in_wave % 3 == 0)) {
        next_spawn_ms += PAIR_RECOVERY_MS;
        pattern_top_first = rock_random_bounded(2) != 0;
    }
    pending_spawn_y = choose_spawn_height();
}

static void move_asteroid(Asteroid& asteroid) {
    asteroid.position_x += asteroid.velocity_x;
    asteroid.position_y += asteroid.velocity_y;
    asteroid.angle += asteroid.rotation_speed;

    if (asteroid.position_y < HUD_HEIGHT + asteroid.radius + ROCK_BORDER_GAP) {
        asteroid.position_y = HUD_HEIGHT + asteroid.radius + ROCK_BORDER_GAP;
        asteroid.velocity_y = fabsf(asteroid.velocity_y);
    }

    if (asteroid.position_y > SCREEN_H - asteroid.radius - ROCK_BORDER_GAP) {
        asteroid.position_y = SCREEN_H - asteroid.radius - ROCK_BORDER_GAP;
        asteroid.velocity_y = -fabsf(asteroid.velocity_y);
    }

    if (asteroid.position_x + asteroid.radius < 0) {
        asteroid.active = false;
    }
}

static void update_wave(unsigned long now) {
    if (!pending_asteroids && !asteroid_active_count()) {
        if (!waiting_for_next_wave) {
            waiting_for_next_wave = true;
            wave_cleared_ms = now;
        } else if (now - wave_cleared_ms >= wave_difficulty.recovery_ms) {
            if (wave_number < WAVE_NUMBER_MAX) {
                wave_number++;
            }

            prepare_wave(now);
        }
    }
}

void asteroids_update(unsigned long now) {
    current_game_ms = now;
    spawn_pending_asteroid(now);

    for (int i = 0; i < ASTEROID_MAX; i++) {
        if (rocks[i].active) {
            move_asteroid(rocks[i]);
        }
    }

    update_wave(now);
}

static void draw_asteroid(const Asteroid& asteroid, Adafruit_SSD1306& display) {
    for (int i = 0; i < ASTEROID_VERTICES; i++) {
        int next_vertex = (i + 1) % ASTEROID_VERTICES;
        float start_angle = asteroid.angle + TWO_PI * i / ASTEROID_VERTICES;
        float end_angle
                = asteroid.angle + TWO_PI * next_vertex / ASTEROID_VERTICES;
        float start_radius = asteroid.radius + asteroid.offsets[i];
        float end_radius = asteroid.radius + asteroid.offsets[next_vertex];

        display.drawLine(asteroid.position_x + cosf(start_angle) * start_radius,
                         asteroid.position_y + sinf(start_angle) * start_radius,
                         asteroid.position_x + cosf(end_angle) * end_radius,
                         asteroid.position_y + sinf(end_angle) * end_radius,
                         SSD1306_WHITE);
    }
}

void asteroids_draw(Adafruit_SSD1306& display) {
    if (pending_asteroids
        && (current_game_ms >= next_spawn_ms
            || next_spawn_ms - current_game_ms <= SPAWN_WARNING_MS)) {
        display.drawFastHLine(SCREEN_W - SPAWN_WARNING_WIDTH,
                              pending_spawn_y,
                              SPAWN_WARNING_WIDTH,
                              SSD1306_WHITE);
        if (pending_spawn_size() == AST_SMALL) {
            display.drawFastHLine(SCREEN_W - SPAWN_WARNING_WIDTH,
                                  pending_spawn_y + 2,
                                  SPAWN_WARNING_WIDTH,
                                  SSD1306_WHITE);
        }
    }

    for (int i = 0; i < ASTEROID_MAX; i++) {
        if (rocks[i].active) {
            draw_asteroid(rocks[i], display);
        }
    }

    if (current_game_ms - wave_started_ms < WAVE_CUE_MS) {
        display.setTextSize(1);
        display.setCursor(40, HUD_HEIGHT + 2);
        display.printf("WAVE %u", unsigned(wave_number));
    }
}

bool asteroid_hits_ship(float position_x, float position_y) {
    for (int i = 0; i < ASTEROID_MAX; i++) {
        const Asteroid& asteroid = rocks[i];
        float distance_x = asteroid.position_x - position_x;
        float distance_y = asteroid.position_y - position_y;
        float collision_radius = asteroid.radius + SHIP_RADIUS;

        if (asteroid.active
            && distance_x * distance_x + distance_y * distance_y
                       < collision_radius * collision_radius) {
            return true;
        }
    }

    return false;
}

static int find_bullet_hit(float from_x, float from_y, float to_x, float to_y) {
    int hit_index = -1;
    float first_intersection = 2.0f;
    float delta_x = to_x - from_x;
    float delta_y = to_y - from_y;
    float length_squared = delta_x * delta_x + delta_y * delta_y;

    // Solve segment-circle entry time, including shots starting inside a rock.
    for (int i = 0; i < ASTEROID_MAX; i++) {
        const Asteroid& asteroid = rocks[i];
        if (!asteroid.active) {
            continue;
        }
        float offset_x = from_x - asteroid.position_x;
        float offset_y = from_y - asteroid.position_y;
        float outside = offset_x * offset_x + offset_y * offset_y
                        - float(asteroid.radius * asteroid.radius);
        float entry = 0;
        if (outside > 0) {
            float projection = offset_x * delta_x + offset_y * delta_y;
            float discriminant
                    = projection * projection - length_squared * outside;
            if (length_squared == 0 || discriminant < 0) {
                continue;
            }
            entry = (-projection - sqrtf(discriminant)) / length_squared;
        }
        if (entry >= 0 && entry <= 1 && entry < first_intersection) {
            first_intersection = entry;
            hit_index = i;
        }
    }
    return hit_index;
}

static void split_asteroid(const Asteroid& parent) {
    AsteroidSize child_size = AST_SMALL;
    float vertical_offset = ASTEROID_SMALL_R;

    if (parent.size == AST_LARGE) {
        child_size = AST_MEDIUM;
        vertical_offset = ASTEROID_MEDIUM_R;
    }

    spawn_asteroid(parent.position_x,
                   parent.position_y - vertical_offset,
                   child_size,
                   parent.velocity_x * FRAGMENT_SPEED_MULTIPLIER,
                   -FRAGMENT_VERTICAL_SPEED);
    spawn_asteroid(parent.position_x,
                   parent.position_y + vertical_offset,
                   child_size,
                   parent.velocity_x * FRAGMENT_SPEED_MULTIPLIER,
                   FRAGMENT_VERTICAL_SPEED);
}

uint32_t asteroids_hit_bullet(float from_x, float to_x, float position_y) {
    return asteroids_hit_segment(from_x, position_y, to_x, position_y);
}

uint32_t asteroids_hit_segment(float from_x,
                               float from_y,
                               float to_x,
                               float to_y,
                               AsteroidDestroyedHandler on_destroy) {
    int hit_index = find_bullet_hit(from_x, from_y, to_x, to_y);

    if (hit_index < 0) {
        return 0;
    }

    Asteroid parent = rocks[hit_index];

    // Removing the parent frees one slot; require one more for both fragments.
    if (parent.size != AST_SMALL && free_slots() < 1) {
        return 0;
    }

    rocks[hit_index].active = false;
    particles_spawn(parent.position_x, parent.position_y);

    if (parent.size == AST_SMALL) {
        sound_play(SFX_ASTEROID_SMALL);
    } else {
        sound_play(SFX_ASTEROID_LARGE);
    }

    if (parent.size == AST_LARGE) {
        display_shake(LARGE_ROCK_SHAKE_FRAMES);
    }

    if (parent.size != AST_SMALL) {
        split_asteroid(parent);
    }

    if (on_destroy) {
        on_destroy(parent.position_x, parent.position_y);
    }
    return asteroid_points(parent.size);
}

static float respawn_clearance(int position_x, int position_y) {
    float clearance = CLEARANCE_SEARCH_LIMIT;

    for (int i = 0; i < ASTEROID_MAX; i++) {
        const Asteroid& asteroid = rocks[i];

        if (!asteroid.active) {
            continue;
        }

        float distance_x = asteroid.position_x - position_x;
        float distance_y = asteroid.position_y - position_y;
        clearance = min(clearance,
                        sqrtf(distance_x * distance_x + distance_y * distance_y)
                                - asteroid.radius - SHIP_RADIUS);
    }

    return clearance;
}

static float best_respawn_height(int position_x, float& best_y) {
    float best_clearance = respawn_clearance(position_x, int(best_y));

    for (int position_y = SHIP_MIN_Y; position_y <= SHIP_MAX_Y; position_y++) {
        float clearance = respawn_clearance(position_x, position_y);

        if (clearance > best_clearance) {
            best_clearance = clearance;
            best_y = position_y;
        }
    }

    return best_clearance;
}

void asteroid_safe_respawn(float& position_x, float& position_y) {
    position_x = SHIP_X;
    position_y = (HUD_HEIGHT + SCREEN_H) / 2.0f;
    float best_clearance = best_respawn_height(SHIP_X, position_y);

    if (best_clearance >= RESPAWN_SAFE_CLEARANCE) {
        return;
    }

    // Search left to right; favor the first lane with adequate clearance.
    // If every lane is crowded, use the clearest available position.
    for (int candidate_x = SHIP_MIN_X; candidate_x <= SHIP_MAX_X;
         candidate_x += RESPAWN_SEARCH_STEP) {
        float candidate_y = position_y;
        float clearance = best_respawn_height(candidate_x, candidate_y);

        if (clearance > best_clearance) {
            best_clearance = clearance;
            position_x = candidate_x;
            position_y = candidate_y;
        }

        if (best_clearance >= RESPAWN_SAFE_CLEARANCE) {
            return;
        }
    }
}
