#include "demo.h"
#include "config.h"

static const unsigned long DEMO_SHOT_INTERVAL_MS = 180;
static const unsigned long DEMO_DODGE_COMMIT_MS = 300;
static const float DEMO_AIM_ENTER = 2.0f;
static const float DEMO_AIM_EXIT = 4.0f;

void demo_reset(DemoController& demo) {
    demo = {};
    demo.target = -1;
}

static bool demo_target_visible(const Asteroid& rock, const Ship& ship) {
    return rock.active && rock.position_x > ship.position_x + SHIP_BULLET_OFFSET
           && rock.position_x < SCREEN_W && rock.position_y >= HUD_HEIGHT
           && rock.position_y < SCREEN_H;
}

static int demo_select_target(const Ship& ship, const Asteroid *asteroids) {
    int selected = -1;
    float best_distance = SCREEN_W + SCREEN_H;
    for (int i = 0; i < ASTEROID_MAX; i++) {
        const Asteroid& rock = asteroids[i];
        if (!demo_target_visible(rock, ship)) {
            continue;
        }
        float distance = rock.position_x - ship.position_x
                         + fabsf(rock.position_y - ship.position_y);
        if (distance < best_distance) {
            best_distance = distance;
            selected = i;
        }
    }
    return selected;
}

static float demo_route_clearance(const Ship& ship,
                                  const Asteroid *asteroids,
                                  int direction) {
    float destination
            = constrain(ship.position_y + direction * SHIP_RADIUS * 5.0f,
                        float(SHIP_MIN_Y),
                        float(SHIP_MAX_Y));
    float clearance = SCREEN_H;
    for (int i = 0; i < ASTEROID_MAX; i++) {
        const Asteroid& rock = asteroids[i];
        if (rock.active
            && fabsf(rock.position_x - ship.position_x)
                       < rock.radius + SHIP_RADIUS * 8) {
            clearance = min(clearance,
                            fabsf(rock.position_y - destination) - rock.radius);
        }
    }
    return clearance;
}

static void demo_dodge(DemoController& demo,
                       const Ship& ship,
                       const Asteroid *asteroids,
                       unsigned long game_ms) {
    bool threat = false;
    for (int i = 0; i < ASTEROID_MAX; i++) {
        const Asteroid& rock = asteroids[i];
        float margin = demo.dodging ? SHIP_RADIUS * 4 : SHIP_RADIUS * 2;
        threat |= rock.active
                  && fabsf(rock.position_x - ship.position_x)
                             < rock.radius + margin + SHIP_RADIUS * 3
                  && fabsf(rock.position_y - ship.position_y)
                             < rock.radius + margin;
    }
    if (demo.dodging && game_ms < demo.dodge_until_ms) {
        return;
    }
    if (!threat) {
        demo.dodging = false;
        return;
    }
    if (!demo.dodging) {
        demo.dodge_direction
                = demo_route_clearance(ship, asteroids, -1)
                                  > demo_route_clearance(ship, asteroids, 1)
                          ? -1
                          : 1;
    }
    // Change direction only when the committed route reaches an edge.
    if (ship.position_y <= SHIP_MIN_Y + SHIP_RADIUS) {
        demo.dodge_direction = 1;
    } else if (ship.position_y >= SHIP_MAX_Y - SHIP_RADIUS) {
        demo.dodge_direction = -1;
    }
    demo.dodging = true;
    demo.dodge_until_ms = game_ms + DEMO_DODGE_COMMIT_MS;
}

InputState demo_update(DemoController& demo,
                       const Ship& ship,
                       const Asteroid *asteroids,
                       unsigned long game_ms) {
    InputState result = {};
    if (demo.target < 0 || !demo_target_visible(asteroids[demo.target], ship)) {
        demo.target = demo_select_target(ship, asteroids);
        demo.aiming = false;
    }
    if (demo.target >= 0) {
        float offset = asteroids[demo.target].position_y - ship.position_y;
        float deadband = demo.aiming ? DEMO_AIM_ENTER : DEMO_AIM_EXIT;
        demo.aiming = fabsf(offset) > deadband;
        if (demo.aiming) {
            result.joystick_y = constrain(offset / SHIP_MAX_SPEED, -1.0f, 1.0f);
        }
    }
    demo_dodge(demo, ship, asteroids, game_ms);
    if (demo.dodging) {
        result.joystick_y = demo.dodge_direction;
    }
    // Return gently to the left lane, leaving room for incoming warnings.
    float lane_offset = SHIP_X - ship.position_x;
    if (fabsf(lane_offset) > SHIP_RADIUS) {
        result.joystick_x
                = constrain(lane_offset / SHIP_MAX_SPEED, -1.0f, 1.0f);
    }
    // Shooting searches independently of the aim target and dodge decision.
    Ship moved = ship;
    ship_update(moved, result.joystick_x, result.joystick_y);
    for (int i = 0; i < ASTEROID_MAX; i++) {
        const Asteroid& rock = asteroids[i];
        if (demo_target_visible(rock, moved)
            && fabsf(rock.position_y - moved.position_y)
                       <= max(1.0f, rock.radius - 1.0f)
            && game_ms >= demo.next_shot_ms) {
            result.fire_pressed = true;
            demo.next_shot_ms = game_ms + DEMO_SHOT_INTERVAL_MS;
            break;
        }
    }
    return result;
}
