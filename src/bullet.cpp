#include "bullet.h"
#include "asteroid.h"
#include "config.h"

static Bullet bullets[BULLET_MAX] = {};

void bullets_init() {
    memset(bullets, 0, sizeof(bullets));
}

static void spawn_bullet(int slot,
                         float position_x,
                         float position_y,
                         float velocity_x,
                         float velocity_y) {
    bullets[slot] = {position_x,
                     position_x,
                     position_y,
                     position_y,
                     velocity_x,
                     velocity_y,
                     true};
}

bool bullets_fire(float position_x, float position_y, bool multishot) {
    int slots[3] = {};
    int available = 0;
    for (int i = 0; i < BULLET_MAX && available < 3; i++) {
        if (!bullets[i].active) {
            slots[available++] = i;
        }
    }
    if (!available) {
        return false;
    }
    spawn_bullet(slots[0], position_x, position_y, BULLET_SPEED, 0);
    if (multishot && available == 3) {
        float horizontal
                = sqrtf(BULLET_SPEED * BULLET_SPEED
                        - MULTISHOT_DIAGONAL_SPEED * MULTISHOT_DIAGONAL_SPEED);
        spawn_bullet(slots[1],
                     position_x,
                     position_y,
                     horizontal,
                     -MULTISHOT_DIAGONAL_SPEED);
        spawn_bullet(slots[2],
                     position_x,
                     position_y,
                     horizontal,
                     MULTISHOT_DIAGONAL_SPEED);
    }
    return true;
}

void bullets_update() {
    for (int i = 0; i < BULLET_MAX; i++) {
        if (bullets[i].active) {
            bullets[i].previous_x = bullets[i].position_x;
            bullets[i].previous_y = bullets[i].position_y;
            bullets[i].position_x += bullets[i].velocity_x;
            bullets[i].position_y += bullets[i].velocity_y;
        }
    }
}

uint32_t bullets_check_asteroids(AsteroidHitHandler on_hit,
                                 PickupDropHandler on_destroy) {
    uint32_t total_points = 0;

    for (int i = 0; i < BULLET_MAX; i++) {
        Bullet& bullet = bullets[i];

        if (!bullet.active) {
            continue;
        }

        uint32_t points = asteroids_hit_segment(bullet.previous_x,
                                                bullet.previous_y,
                                                bullet.position_x,
                                                bullet.position_y,
                                                on_destroy);

        if (points) {
            total_points += points;
            if (on_hit) {
                on_hit(points);
            }
            bullet.active = false;
        } else if (bullet.position_x >= SCREEN_W
                   || bullet.position_y < HUD_HEIGHT
                   || bullet.position_y >= SCREEN_H) {
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
