#include "bullet.h"
#include "asteroid.h"
#include "saucer.h"
#include "config.h"

static Bullet          pool[BULLET_MAX];
static unsigned long   lastFireMs = 0;

void bulletsInit() {
  memset(pool, 0, sizeof(pool));
  lastFireMs = 0;
}

bool bulletsFire(float x, float y) {
  if (millis() - lastFireMs < BULLET_COOLDOWN) return false;

  for (int i = 0; i < BULLET_MAX; i++) {
    if (pool[i].active) continue;
    pool[i].x          = x;
    pool[i].y          = y;
    pool[i].framesLeft = BULLET_LIFETIME;
    pool[i].active     = true;
    lastFireMs         = millis();
    return true;
  }
  return false;  // all slots occupied
}

void bulletsUpdate() {
  for (int i = 0; i < BULLET_MAX; i++) {
    if (!pool[i].active) continue;

    pool[i].y -= BULLET_SPEED;
    pool[i].framesLeft--;

    if (pool[i].framesLeft == 0 || pool[i].y < 0) {
      pool[i].active = false;
    }
  }
}

void bulletsDraw(Adafruit_SSD1306& display) {
  for (int i = 0; i < BULLET_MAX; i++) {
    if (!pool[i].active) continue;
    int x1 = (int)pool[i].x;
    int y1 = (int)pool[i].y;
    display.drawFastVLine(x1, y1 - 2, 3, SSD1306_WHITE);
  }
}

uint32_t bulletsCheckAsteroids() {
  uint32_t total = 0;
  for (int i = 0; i < BULLET_MAX; i++) {
    if (!pool[i].active) continue;
    uint32_t pts = asteroidsHitBullet(pool[i].x, pool[i].y);
    if (pts > 0) {
      pool[i].active = false;  // bullet consumed on hit
      total += pts;
    }
  }
  return total;
}

uint32_t bulletsCheckSaucer() {
  uint32_t total = 0;
  for (int i = 0; i < BULLET_MAX; i++) {
    if (!pool[i].active) continue;
    uint32_t pts = saucerHitByBullet(pool[i].x, pool[i].y);
    if (pts > 0) {
      pool[i].active = false;
      total += pts;
    }
  }
  return total;
}
