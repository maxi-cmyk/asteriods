#include "saucer.h"
#include "config.h"
#include "particle.h"
#include "display.h"

// ── Saucer bullet ──────────────────────────────────────────────────────────────

struct SaucerBullet {
  float x, y, vx, vy;
  uint8_t framesLeft;
  bool active;
};

#define SAUCER_BULLET_MAX 3

static SaucerBullet sBullets[SAUCER_BULLET_MAX];

// ── Saucer state ───────────────────────────────────────────────────────────────

static bool   active     = false;
static float  sx, sy;               // position
static float  sVx;                  // horizontal velocity (positive = right)
static uint8_t sRadius;
static SaucerType sType;
static unsigned long spawnTime   = 0;   // millis() when spawned
static unsigned long lastShotMs  = 0;   // millis() of last bullet fired
static unsigned long nextSpawnAt = 0;   // elapsedMs threshold for next spawn

// ── Init ───────────────────────────────────────────────────────────────────────

void saucerInit() {
  active = false;
  memset(sBullets, 0, sizeof(sBullets));
  nextSpawnAt = SAUCER_FIRST_APPEAR
              + random(SAUCER_SPAWN_MIN, SAUCER_SPAWN_MAX);
}

// ── Internal: fire a bullet ────────────────────────────────────────────────────

static void saucerFire(float shipX, float shipY) {
  for (int i = 0; i < SAUCER_BULLET_MAX; i++) {
    if (sBullets[i].active) continue;

    SaucerBullet& b = sBullets[i];
    b.x = sx;
    b.y = sy;

    if (sType == SAUCER_LARGE) {
      // Random direction
      float angle = random(628) / 100.0f;  // 0..TWO_PI
      b.vx = cosf(angle) * SAUCER_BULLET_SPEED;
      b.vy = sinf(angle) * SAUCER_BULLET_SPEED;
    } else {
      // Aimed at ship
      float dx = shipX - sx;
      float dy = shipY - sy;
      float dist = sqrtf(dx * dx + dy * dy);
      if (dist < 1.0f) dist = 1.0f;
      b.vx = (dx / dist) * SAUCER_BULLET_SPEED;
      b.vy = (dy / dist) * SAUCER_BULLET_SPEED;
    }

    b.framesLeft = SAUCER_BULLET_LIFETIME;
    b.active = true;
    return;
  }
}

// ── Update ─────────────────────────────────────────────────────────────────────

void saucerUpdate(unsigned long elapsedMs, float shipX, float shipY) {
  unsigned long now = millis();

  // ── Update active saucer bullets regardless of saucer state ──
  for (int i = 0; i < SAUCER_BULLET_MAX; i++) {
    if (!sBullets[i].active) continue;
    SaucerBullet& b = sBullets[i];
    b.x += b.vx;
    b.y += b.vy;
    b.framesLeft--;
    if (b.framesLeft == 0 || b.x < -4 || b.x > SCREEN_W + 4
        || b.y < 0 || b.y > SCREEN_H + 4) {
      b.active = false;
    }
  }

  // ── Spawn logic ──
  if (!active) {
    if (elapsedMs >= nextSpawnAt) {
      active    = true;
      spawnTime = now;
      lastShotMs = now;

      // Decide type
      if (elapsedMs >= SAUCER_SMALL_APPEAR && random(2) == 0) {
        sType   = SAUCER_SMALL;
        sRadius = SAUCER_SMALL_R;
      } else {
        sType   = SAUCER_LARGE;
        sRadius = SAUCER_LARGE_R;
      }

      // Spawn from left or right edge at 3/4 down the play area
      bool fromLeft = random(2) == 0;
      sx  = fromLeft ? -(float)sRadius : (float)(SCREEN_W + sRadius);
      sVx = fromLeft ? SAUCER_SPEED : -SAUCER_SPEED;
      sy  = PLAY_AREA_Y + (PLAY_AREA_H * 3) / 4;

      // Schedule next spawn after this one finishes
      nextSpawnAt = elapsedMs + SAUCER_DURATION
                  + random(SAUCER_SPAWN_MIN, SAUCER_SPAWN_MAX);
    }
    return;
  }

  // ── Move saucer ──
  sx += sVx;

  // ── Exit conditions ──
  bool timed_out  = (now - spawnTime) >= SAUCER_DURATION;
  bool off_screen = (sVx > 0 && sx - sRadius > SCREEN_W)
                 || (sVx < 0 && sx + sRadius < 0);
  if (timed_out || off_screen) {
    active = false;
    return;
  }

  // ── Auto-fire (scales with difficulty) ──
  int tier = (int)(elapsedMs / DIFFICULTY_INTERVAL);
  if (tier >= DIFFICULTY_LEVELS) tier = DIFFICULTY_LEVELS - 1;
  // Fire interval: 2000ms at tier 0 → 800ms at tier 4
  unsigned long fireInterval = SAUCER_FIRE_INTERVAL - (unsigned long)(tier * 300);
  if (now - lastShotMs >= fireInterval) {
    saucerFire(shipX, shipY);
    lastShotMs = now;
  }
}

// ── Draw ───────────────────────────────────────────────────────────────────────

void saucerDraw(Adafruit_SSD1306& display) {
  // Draw saucer bullets first (always, even after saucer gone)
  for (int i = 0; i < SAUCER_BULLET_MAX; i++) {
    if (!sBullets[i].active) continue;
    display.drawPixel((int)sBullets[i].x, (int)sBullets[i].y, SSD1306_WHITE);
  }

  if (!active) return;

  // Classic saucer shape: horizontal body + dome
  int ix = (int)sx;
  int iy = (int)sy;
  int r  = sRadius;

  // Body — wide ellipse (horizontal line + slight bulge)
  display.drawFastHLine(ix - r, iy, r * 2 + 1, SSD1306_WHITE);          // center line
  display.drawFastHLine(ix - r + 1, iy - 1, r * 2 - 1, SSD1306_WHITE); // top of body
  display.drawFastHLine(ix - r + 1, iy + 1, r * 2 - 1, SSD1306_WHITE); // bottom of body

  // Dome (small arc above)
  int dw = r / 2 + 1;
  display.drawFastHLine(ix - dw, iy - 2, dw * 2 + 1, SSD1306_WHITE);
  if (r >= 4) {
    // Taller dome for large saucer
    display.drawFastHLine(ix - 1, iy - 3, 3, SSD1306_WHITE);
  }

  // Bottom detail — small indent
  display.drawPixel(ix - 1, iy + 2, SSD1306_WHITE);
  display.drawPixel(ix,     iy + 2, SSD1306_WHITE);
  display.drawPixel(ix + 1, iy + 2, SSD1306_WHITE);
}

// ── Collision: saucer bullet → ship ────────────────────────────────────────────

bool saucerHitsShip(float shipX, float shipY) {
  for (int i = 0; i < SAUCER_BULLET_MAX; i++) {
    if (!sBullets[i].active) continue;
    float dx = sBullets[i].x - shipX;
    float dy = sBullets[i].y - shipY;
    float rSum = (float)SHIP_RADIUS;
    if (dx * dx + dy * dy < rSum * rSum) {
      sBullets[i].active = false;
      return true;
    }
  }
  return false;
}

// ── Collision: player bullet → saucer ──────────────────────────────────────────

uint32_t saucerHitByBullet(float bx, float by) {
  if (!active) return 0;

  float dx = bx - sx;
  float dy = by - sy;
  float r  = (float)sRadius;
  if (dx * dx + dy * dy < r * r) {
    active = false;
    particlesSpawn(sx, sy);
    displayShake(4);
    return (sType == SAUCER_LARGE) ? SCORE_SAUCER_LARGE : SCORE_SAUCER_SMALL;
  }
  return 0;
}

// ── Query ──────────────────────────────────────────────────────────────────────

bool saucerIsActive() {
  return active;
}
