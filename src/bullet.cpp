#include "bullet.h"
#include "asteroid.h"
#include "config.h"
static Bullet bullets[BULLET_MAX];
void bulletsInit() { memset(bullets, 0, sizeof(bullets)); }
bool bulletsFire(float x, float y) {
  for (auto& b : bullets) if (!b.active) {
    b = {x, x, y, true};
    return true;
  }
  return false;
}
void bulletsUpdate() {
  for (auto& b : bullets) if (b.active) { b.previousX = b.x; b.x += BULLET_SPEED; }
}
uint32_t bulletsCheckAsteroids() {
  uint32_t score = 0;
  for (auto& b : bullets) {
    if (!b.active) continue;
    uint32_t points = asteroidsHitBullet(b.previousX, b.x, b.y);
    if (points) { score += points; b.active = false; }
    else if (b.x >= SCREEN_W) b.active = false;
  }
  return score;
}
void bulletsDraw(Adafruit_SSD1306& d) {
  for (const auto& b : bullets) if (b.active) d.drawFastHLine(b.x, b.y, 3, SSD1306_WHITE);
}
