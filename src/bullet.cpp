#include "bullet.h"
#include "asteroid.h"
#include "config.h"

static Bullet bullets[BULLET_MAX] = {};

void bullets_init() {
    memset(bullets, 0, sizeof(bullets));
}

bool bullets_fire(float position_x, float position_y) {
    for (int i = 0; i < BULLET_MAX; i++) {
        if (!bullets[i].active) {
            bullets[i] = {position_x, position_x, position_y, true};
            return true;
        }
    }

    return false;
}

void bullets_update() {
    for (int i = 0; i < BULLET_MAX; i++) {
        if (bullets[i].active) {
            bullets[i].previous_x = bullets[i].position_x;
            bullets[i].position_x += BULLET_SPEED;
        }
    }
}

uint32_t bullets_check_asteroids() {
    uint32_t total_points = 0;

    for (int i = 0; i < BULLET_MAX; i++) {
        Bullet& bullet = bullets[i];

        if (!bullet.active) {
            continue;
        }

        uint32_t points = asteroids_hit_bullet(
                bullet.previous_x, bullet.position_x, bullet.position_y);

        if (points) {
            total_points += points;
            bullet.active = false;
        } else if (bullet.position_x >= SCREEN_W) {
            bullet.active = false;
        }
    }

    return total_points;
}

void bullets_draw(Adafruit_SSD1306& display) {
    for (int i = 0; i < BULLET_MAX; i++) {
        if (bullets[i].active) {
            display.drawFastHLine(bullets[i].position_x,
                                  bullets[i].position_y,
                                  BULLET_DRAW_LENGTH,
                                  SSD1306_WHITE);
        }
    }
}
