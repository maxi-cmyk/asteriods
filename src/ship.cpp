#include "ship.h"
#include "config.h"
void shipRespawn(Ship& s, float y) {
  s.x = SHIP_X;
  s.y = y;
  s.alive = true;
  s.invincibleLeft = SHIP_INVINCIBLE_MS;
}
void shipInit(Ship& s) {
  s.lives = LIVES_START;
  shipRespawn(s, (HUD_HEIGHT + SCREEN_H) / 2.0f);
}
void shipUpdate(Ship& s, float joyY) {
  if (!s.alive) return;
  s.y = constrain(s.y + joyY * SHIP_MAX_SPEED,
                  float(HUD_HEIGHT + SHIP_RADIUS + 1), float(SCREEN_H - SHIP_RADIUS - 2));
  s.invincibleLeft = s.invincibleLeft > FRAME_TIME_MS ? s.invincibleLeft - FRAME_TIME_MS : 0;
}
void shipDraw(const Ship& s, Adafruit_SSD1306& d) {
  if (!s.alive || (s.invincibleLeft && (s.invincibleLeft / 100) % 2 == 0)) return;
  d.drawTriangle(s.x + 5, s.y, s.x - 3, s.y - 3, s.x - 3, s.y + 3, SSD1306_WHITE);
}
void shipDie(Ship& s) {
  s.alive = false;
  if (s.lives) --s.lives;
}
