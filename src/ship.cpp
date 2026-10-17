#include "ship.h"
#include "config.h"

void ship_respawn(Ship& ship,
                  float position_x,
                  float position_y,
                  unsigned long game_ms) {
    weapon_reset(ship.weapon, game_ms);
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

    float speed = SHIP_MAX_SPEED * weapon_speed_scale(ship.weapon);
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

static void draw_heat_bar(const Ship& ship,
                          Adafruit_SSD1306& display,
                          unsigned long game_ms) {
    int position_x = int(ship.position_x) - HEAT_BAR_HALF_WIDTH;
    int position_y = int(ship.position_y) + HEAT_BAR_Y_OFFSET;
    bool outline_visible
            = !ship.weapon.overheated
              || ((game_ms - ship.weapon.overheat_started_ms) / WEAPON_BLINK_MS)
                                 % 2
                         == 0;
    if (outline_visible) {
        display.drawRect(position_x,
                         position_y,
                         HEAT_BAR_WIDTH,
                         HEAT_BAR_HEIGHT,
                         SSD1306_WHITE);
    }
    int fill_width = ship.weapon.heat_milliunits * (HEAT_BAR_WIDTH - 2)
                     / (WEAPON_HEAT_MAX * WEAPON_HEAT_SCALE);
    if (fill_width > 0) {
        display.fillRect(position_x + 1,
                         position_y + 1,
                         fill_width,
                         HEAT_BAR_HEIGHT - 2,
                         SSD1306_WHITE);
    }
}

void ship_draw(const Ship& ship,
               Adafruit_SSD1306& display,
               unsigned long game_ms) {
    if (!ship.alive) {
        return;
    }
    draw_heat_bar(ship, display, game_ms);
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

    if (ship.lives) {
        ship.lives--;
    }
}
