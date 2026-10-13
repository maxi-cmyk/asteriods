#include "particle.h"
#include "config.h"

static const int PARTICLE_MIN_COUNT = 4;
static const int PARTICLE_COUNT_RANGE = 3;
static const int PARTICLE_ANGLE_STEPS = 628;
static const float PARTICLE_ANGLE_SCALE = 100.0f;
static const float PARTICLE_MIN_SPEED = 1.0f;
static const int PARTICLE_SPEED_STEPS = 200;
static const float PARTICLE_SPEED_SCALE = 100.0f;
static const int PARTICLE_MIN_LIFE = 10;
static const int PARTICLE_LIFE_RANGE = 6;

struct Particle {
    float position_x;
    float position_y;
    float velocity_x;
    float velocity_y;
    uint8_t life; // frames remaining
    bool active;
};

static Particle pool[PARTICLE_MAX] = {};

void particles_init() {
    memset(pool, 0, sizeof(pool));
}

void particles_spawn(float position_x, float position_y) {
    int count = PARTICLE_MIN_COUNT + random(PARTICLE_COUNT_RANGE);

    for (int particle_index = 0; particle_index < count; particle_index++) {
        for (int i = 0; i < PARTICLE_MAX; i++) {
            if (pool[i].active) {
                continue;
            }

            Particle& particle = pool[i];
            particle.position_x = position_x;
            particle.position_y = position_y;

            float angle = random(PARTICLE_ANGLE_STEPS) / PARTICLE_ANGLE_SCALE;
            float speed = PARTICLE_MIN_SPEED
                          + random(PARTICLE_SPEED_STEPS) / PARTICLE_SPEED_SCALE;
            particle.velocity_x = cosf(angle) * speed;
            particle.velocity_y = sinf(angle) * speed;
            particle.life = PARTICLE_MIN_LIFE + random(PARTICLE_LIFE_RANGE);
            particle.active = true;
            break;
        }
    }
}

void particles_update() {
    for (int i = 0; i < PARTICLE_MAX; i++) {
        if (!pool[i].active) {
            continue;
        }

        Particle& particle = pool[i];
        particle.position_x += particle.velocity_x;
        particle.position_y += particle.velocity_y;
        particle.life--;

        if (particle.life == 0) {
            particle.active = false;
        }
    }
}

void particles_draw(Adafruit_SSD1306& display) {
    for (int i = 0; i < PARTICLE_MAX; i++) {
        if (!pool[i].active) {
            continue;
        }

        const Particle& particle = pool[i];
        int pixel_x = (int)particle.position_x;
        int pixel_y = (int)particle.position_y;

        if (pixel_x >= 0 && pixel_x < SCREEN_W && pixel_y >= HUD_HEIGHT
            && pixel_y < SCREEN_H) {
            display.drawPixel(pixel_x, pixel_y, SSD1306_WHITE);
        }
    }
}
