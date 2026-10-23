#include "powerup.h"
#include "ship.h"
#include "config.h"
#include "rock_random.h"

enum PickupKind {
    PICKUP_MULTISHOT,
    PICKUP_SHIELD,
#ifdef WEB_HD
    PICKUP_DOUBLE_FIRE,
#endif
};

struct Pickup {
    float position_x;
    float position_y;
    PickupKind kind;
    bool active;
};

static Pickup pickup = {};
static unsigned long collection_cue_left = 0;
static float collection_x = 0;
static float collection_y = 0;

void powerups_init() {
    pickup = {};
    collection_cue_left = 0;
}

void powerups_drop(float position_x, float position_y) {
    if (pickup.active || rock_random_bounded(100) >= PICKUP_DROP_PERCENT) {
        return;
    }
    pickup.position_x
            = constrain(position_x, float(SHIP_MIN_X), float(SHIP_MAX_X));
    pickup.position_y
            = constrain(position_y, float(SHIP_MIN_Y), float(SHIP_MAX_Y));
#ifdef WEB_HD
    pickup.kind = PickupKind(rock_random_bounded(3));
#else
    pickup.kind = PickupKind(rock_random_bounded(2));
#endif
    pickup.active = true;
}

static void collect_pickup(Ship& ship) {
    if (pickup.kind == PICKUP_MULTISHOT) {
        ship.effects.multishot_left_ms = MULTISHOT_DURATION_MS;
#ifdef WEB_HD
    } else if (pickup.kind == PICKUP_DOUBLE_FIRE) {
        ship.effects.double_fire_left_ms = 6000;
#endif
    } else {
        ship.effects.shield = true;
    }
    collection_x = pickup.position_x;
    collection_y = pickup.position_y;
    collection_cue_left = PICKUP_CUE_MS;
    pickup.active = false;
}

void powerups_update(Ship& ship) {
#ifdef WEB_HD
    ship.effects.double_fire_left_ms -= min(ship.effects.double_fire_left_ms,
                                             (unsigned long)FRAME_TIME_MS);
#endif
    ship.effects.multishot_left_ms -= min(ship.effects.multishot_left_ms,
                                          (unsigned long)FRAME_TIME_MS);
    collection_cue_left
            -= min(collection_cue_left, (unsigned long)FRAME_TIME_MS);
    if (!pickup.active) {
        return;
    }
    pickup.position_x -= PICKUP_SPEED;
    if (pickup.position_x + PICKUP_RADIUS < 0) {
        pickup.active = false;
        return;
    }
    float distance_x = pickup.position_x - ship.position_x;
    float distance_y = pickup.position_y - ship.position_y;
    float radius = PICKUP_RADIUS + SHIP_RADIUS;
    if (ship.alive
        && distance_x * distance_x + distance_y * distance_y
                   <= radius * radius) {
        collect_pickup(ship);
    }
}

void powerups_draw(Adafruit_SSD1306& display) {
    if (pickup.active) {
        int position_x = int(pickup.position_x);
        int position_y = int(pickup.position_y);
        if (pickup.kind == PICKUP_MULTISHOT) {
            // Three prongs for the three-shot volley.
            for (int offset = -PICKUP_RADIUS; offset <= PICKUP_RADIUS;
                 offset += PICKUP_RADIUS) {
                display.drawLine(position_x - PICKUP_RADIUS,
                                 position_y,
                                 position_x + PICKUP_RADIUS,
                                 position_y + offset,
                                 SSD1306_WHITE);
            }
        } else {
            display.drawRect(position_x - PICKUP_RADIUS,
                             position_y - PICKUP_RADIUS,
                             PICKUP_RADIUS * 2 + 1,
                             PICKUP_RADIUS * 2 + 1,
                             SSD1306_WHITE);
            display.drawPixel(position_x, position_y, SSD1306_WHITE);
        }
    }
    if (collection_cue_left) {
        display.drawRect(int(collection_x) - PICKUP_RADIUS,
                         int(collection_y) - PICKUP_RADIUS,
                         PICKUP_RADIUS * 2 + 1,
                         PICKUP_RADIUS * 2 + 1,
                         SSD1306_WHITE);
    }
}
