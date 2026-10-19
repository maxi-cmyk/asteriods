#include "ship.h"
#include "config.h"

void ship_respawn(Ship& ship,
                  float position_x,
                  float position_y,
                  unsigned long game_ms) {
    weapon_reset(ship.weapon, game_ms);
    ship.effects = {};
    ship.position_x
            = constrain(position_x, float(SHIP_MIN_X), float(SHIP_MAX_X));
    ship.position_y
            = constrain(position_y, float(SHIP_MIN_Y), float(SHIP_MAX_Y));
    ship.alive = true;
    ship.invincible_left = SHIP_INVINCIBLE_MS;
}

void ship_init(Ship& ship) {
    ship.lives = LIVES_START;
    ship_respawn(ship, SHIP_X, (HUD_HEIGHT + SCREEN_H) / 2.0f);
}

void ship_update(Ship& ship, float joystick_x, float joystick_y) {
    if (!ship.alive) {
        return;
    }

    float magnitude = sqrtf(joystick_x * joystick_x + joystick_y * joystick_y);

    // Cap full diagonals without amplifying small stick deflections.
    if (magnitude > 1.0f) {
        joystick_x /= magnitude;
        joystick_y /= magnitude;
    }

    float speed = SHIP_MAX_SPEED;
    ship.position_x = constrain(ship.position_x + joystick_x * speed,
                                float(SHIP_MIN_X),
                                float(SHIP_MAX_X));
    ship.position_y = constrain(ship.position_y + joystick_y * speed,
                                float(SHIP_MIN_Y),
                                float(SHIP_MAX_Y));

    if (ship.invincible_left > FRAME_TIME_MS) {
        ship.invincible_left -= FRAME_TIME_MS;
    } else {
        ship.invincible_left = 0;
    }
}

static void draw_powerup_indicators(const Ship& ship,
                                    Adafruit_SSD1306& display) {
    if (ship.effects.multishot_left_ms) {
        int width = (ship.effects.multishot_left_ms * (EFFECT_BAR_WIDTH - 2)
                     + MULTISHOT_DURATION_MS - 1)
                    / MULTISHOT_DURATION_MS;
        display.drawFastHLine(int(ship.position_x) - EFFECT_BAR_HALF_WIDTH + 1,
                              int(ship.position_y) + EFFECT_BAR_Y_OFFSET
                                      + EFFECT_BAR_HEIGHT,
                              width,
                              SSD1306_WHITE);
    }
    if (ship.effects.shield) {
        display.drawTriangle(ship.position_x + SHIP_NOSE_OFFSET + 1,
                             ship.position_y,
                             ship.position_x - SHIP_TAIL_OFFSET - 1,
                             ship.position_y - SHIP_RADIUS - 1,
                             ship.position_x - SHIP_TAIL_OFFSET - 1,
                             ship.position_y + SHIP_RADIUS + 1,
                             SSD1306_WHITE);
    }
}

void ship_draw(const Ship& ship,
               Adafruit_SSD1306& display,
               unsigned long game_ms) {
    if (!ship.alive) {
        return;
    }
    (void)game_ms;
    draw_powerup_indicators(ship, display);
    if (ship.invincible_left
        && (ship.invincible_left / SHIP_BLINK_MS) % 2 == 0) {
        return;
    }
    display.drawTriangle(ship.position_x + SHIP_NOSE_OFFSET,
                         ship.position_y,
                         ship.position_x - SHIP_TAIL_OFFSET,
                         ship.position_y - SHIP_RADIUS,
                         ship.position_x - SHIP_TAIL_OFFSET,
                         ship.position_y + SHIP_RADIUS,
                         SSD1306_WHITE);
}

void ship_die(Ship& ship) {
    ship.alive = false;
    ship.effects = {};

    if (ship.lives) {
        ship.lives--;
    }
}
