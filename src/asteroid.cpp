#include "asteroid.h"
#include "config.h"
#include "particle.h"
#include "display.h"
#include "sound.h"

static const float WAVE_START_SPEED = 0.38f;
static const float WAVE_SPEED_INCREMENT = 0.045f;
static const int WAVE_SPEED_STEPS = 10;
static const int WAVE_INITIAL_ROCKS = 3;
static const int WAVE_MAX_ROCKS = 6;
static const int WAVES_PER_EXTRA_ROCK = 2;
static const uint16_t WAVE_NUMBER_MAX = 65535;
static const unsigned long WAVE_SPAWN_INTERVAL_MS = 1800;
static const unsigned long WAVE_CLEAR_DELAY_MS = 1500;
static const unsigned long SPAWN_WARNING_MS = 700;
static const int SPAWN_WARNING_WIDTH = 3;
static const int RANDOM_ANGLE_STEPS = 628;
static const float RANDOM_ANGLE_SCALE = 100.0f;
static const int RANDOM_DRIFT_STEPS = 101;
static const int RANDOM_DRIFT_CENTER = 50;
static const float ROTATION_RANDOM_SCALE = 4000.0f;
static const float VERTICAL_DRIFT_SCALE = 500.0f;
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

static float wave_speed() {
    int speed_steps = min(int(wave_number - 1), WAVE_SPEED_STEPS);
    return WAVE_START_SPEED + speed_steps * WAVE_SPEED_INCREMENT;
}

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
        asteroid.angle = random(RANDOM_ANGLE_STEPS) / RANDOM_ANGLE_SCALE;
        asteroid.rotation_speed
                = (random(RANDOM_DRIFT_STEPS) - RANDOM_DRIFT_CENTER)
                  / ROTATION_RANDOM_SCALE;

        int outline_range = OTHER_ROCK_OUTLINE_RANGE;

        if (size == AST_SMALL) {
            outline_range = SMALL_ROCK_OUTLINE_RANGE;
        }

        // Keep the outline inside the collision circle, even for small rocks.
        for (int j = 0; j < ASTEROID_VERTICES; j++) {
            asteroid.offsets[j] = -random(outline_range);
        }

        return;
    }
}

static float choose_spawn_height() {
    return random(HUD_HEIGHT + ASTEROID_LARGE_R + ROCK_BORDER_GAP,
                  SCREEN_H - ASTEROID_LARGE_R);
}

void asteroids_init() {
    memset(rocks, 0, sizeof(rocks));
    wave_number = 1;
    pending_asteroids = WAVE_INITIAL_ROCKS;
    current_game_ms = 0;
    next_spawn_ms = SPAWN_WARNING_MS;
    pending_spawn_y = choose_spawn_height();
    wave_cleared_ms = 0;
    waiting_for_next_wave = false;
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

static void spawn_pending_asteroid(unsigned long now) {
    if (pending_asteroids && now >= next_spawn_ms && free_slots()) {
        float vertical_speed
                = (random(RANDOM_DRIFT_STEPS) - RANDOM_DRIFT_CENTER)
                  / VERTICAL_DRIFT_SCALE;
        spawn_asteroid(SCREEN_W + ASTEROID_LARGE_R,
                       pending_spawn_y,
                       AST_LARGE,
                       -wave_speed(),
                       vertical_speed);
        pending_asteroids--;
        next_spawn_ms = now + WAVE_SPAWN_INTERVAL_MS;
        pending_spawn_y = choose_spawn_height();
    }
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
        } else if (now - wave_cleared_ms >= WAVE_CLEAR_DELAY_MS) {
            if (wave_number < WAVE_NUMBER_MAX) {
                wave_number++;
            }

            pending_asteroids
                    = min(WAVE_INITIAL_ROCKS
                                  + int(wave_number - 1) / WAVES_PER_EXTRA_ROCK,
                          WAVE_MAX_ROCKS);
            next_spawn_ms = now + SPAWN_WARNING_MS;
            pending_spawn_y = choose_spawn_height();
            waiting_for_next_wave = false;
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
    }

    for (int i = 0; i < ASTEROID_MAX; i++) {
        if (rocks[i].active) {
            draw_asteroid(rocks[i], display);
        }
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

static int find_bullet_hit(float from_x, float to_x, float position_y) {
    int hit_index = -1;
    float first_intersection = to_x + 1;

    // Choose the first intersected rock along the horizontal bullet segment.
    for (int i = 0; i < ASTEROID_MAX; i++) {
        const Asteroid& asteroid = rocks[i];

        if (!asteroid.active) {
            continue;
        }

        float distance_y = position_y - asteroid.position_y;
        float radius = asteroid.radius;

        if (fabsf(distance_y) > radius) {
            continue;
        }

        float half_chord = sqrtf(radius * radius - distance_y * distance_y);
        float entry_x = max(from_x, asteroid.position_x - half_chord);

        if (asteroid.position_x + half_chord >= from_x && entry_x <= to_x
            && entry_x < first_intersection) {
            first_intersection = entry_x;
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
    int hit_index = find_bullet_hit(from_x, to_x, position_y);

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
