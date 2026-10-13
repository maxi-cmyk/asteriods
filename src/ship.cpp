#include "ship.h"
#include "config.h"

void ship_respawn(Ship& ship, float position_y) {
    ship.position_x = SHIP_X;
    ship.position_y = position_y;
    ship.alive = true;
    ship.invincible_left = SHIP_INVINCIBLE_MS;
}

void ship_init(Ship& ship) {
    ship.lives = LIVES_START;
    ship_respawn(ship, (HUD_HEIGHT + SCREEN_H) / 2.0f);
}

void ship_update(Ship& ship, float joystick_y) {
    if (!ship.alive) {
        return;
    }

    ship.position_y
            = constrain(ship.position_y + joystick_y * SHIP_MAX_SPEED,
                        float(HUD_HEIGHT + SHIP_RADIUS + SHIP_TOP_GAP),
                        float(SCREEN_H - SHIP_RADIUS - SHIP_BOTTOM_GAP));

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
