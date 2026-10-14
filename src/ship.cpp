#include "ship.h"
#include "config.h"

void ship_respawn(Ship& ship, float position_x, float position_y) {
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

    ship.position_x = constrain(ship.position_x + joystick_x * SHIP_MAX_SPEED,
                                float(SHIP_MIN_X),
                                float(SHIP_MAX_X));
    ship.position_y = constrain(ship.position_y + joystick_y * SHIP_MAX_SPEED,
                                float(SHIP_MIN_Y),
                                float(SHIP_MAX_Y));

    if (ship.invincible_left > FRAME_TIME_MS) {
        ship.invincible_left -= FRAME_TIME_MS;
    } else {
        ship.invincible_left = 0;
    }
}

void ship_draw(const Ship& ship, Adafruit_SSD1306& display) {
    if (!ship.alive
        || (ship.invincible_left
            && (ship.invincible_left / SHIP_BLINK_MS) % 2 == 0)) {
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

    if (ship.lives) {
        ship.lives--;
    }
}
