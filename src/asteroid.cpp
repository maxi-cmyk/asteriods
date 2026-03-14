#include "asteroid.h"
#include "config.h"
#include "particle.h"
#include "display.h"

static Asteroid pool[ASTEROID_MAX];

// ── Difficulty tier table ──────────────────────────────────────────────────────
// { minAsteroids, speedMultiplier, spawnCooldownMs }
struct DifficultyTier {
  uint8_t  minAsteroids;
  float    speedMult;
  uint16_t spawnCooldownMs;
};

static const DifficultyTier tiers[DIFFICULTY_LEVELS] = {
  { 3, 1.0f, 3000 },   // 0:00–1:00  Slow, grace period
  { 4, 1.5f, 2500 },   // 1:00–2:00  Medium
  { 5, 2.0f, 2000 },   // 2:00–3:00  Medium-Fast
  { 6, 2.5f, 1500 },   // 3:00–4:00  Fast
  { 8, 3.0f, 1000 },   // 4:00–5:00  Very fast (survival)
};

static unsigned long clearTimeMs = 0;  // when the screen first became empty (0 = not empty)
#define WAVE_DELAY_MS 2000               // wait before spawning next wave

// ── Internal spawn helper ─────────────────────────────────────────────────────

static int currentJag = 0;  // cached for split children

static void spawnAt(float x, float y, AsteroidSize size, float speedMult, int jag) {
  for (int i = 0; i < ASTEROID_MAX; i++) {
    if (pool[i].active) continue;
    Asteroid& a = pool[i];

    a.x    = x;
    a.y    = y;
    a.size = size;

    switch (size) {
      case AST_LARGE:  a.radius = ASTEROID_LARGE_R;  break;
      case AST_MEDIUM: a.radius = ASTEROID_MEDIUM_R; break;
      default:         a.radius = ASTEROID_SMALL_R;  break;
    }

    // Fall straight down with a small random horizontal drift
    float spd = ASTEROID_SPEED_MIN
              + (random(100) / 100.0f) * (ASTEROID_SPEED_MAX - ASTEROID_SPEED_MIN);
    spd *= speedMult;  // scale by current difficulty
    a.vx = (random(100) - 50) / 50.0f * spd * 0.4f;  // ±40% lateral drift
    a.vy = spd;                                         // always downward

    // Random rotation
    a.angle    = random(628) / 100.0f;
    a.rotSpeed = (random(201) - 100) / 100.0f * ASTEROID_ROT_MAX;

    // Progressive shapes: jag 0 = rounder (±2), jag 4 = jagged (±6)
    int offsetRange = 5 + jag * 2;  // 5, 7, 9, 11, 13
    int offsetShift = 2 + jag;      // 2, 3, 4, 5, 6
    a.numVerts = 6 + random(3);
    for (int v = 0; v < 8; v++) {
      a.offsets[v] = (int8_t)(random(offsetRange) - offsetShift);
    }

    a.active = true;
    return;
  }
}

// Spawn an asteroid just above the visible screen (won't trigger Y-wrap)
static void spawnFromTop(AsteroidSize size, float speedMult, int jag) {
  float r = (size == AST_LARGE) ? ASTEROID_LARGE_R : 
            (size == AST_MEDIUM) ? ASTEROID_MEDIUM_R : ASTEROID_SMALL_R;
  float x = r + random((int)(SCREEN_W - 2 * r));
  float y = -(r - 1);  // just above screen, y+r = 1 > 0, so no wrap
  spawnAt(x, y, size, speedMult, jag);
}

// ── Public interface ──

void asteroidsInit() {
  memset(pool, 0, sizeof(pool));
  clearTimeMs = 0;

  for (int i = 0; i < ASTEROID_INITIAL; i++) {
    spawnFromTop(AST_LARGE, 1.0f, 0);  // tier 0 = rounder
  }
}

void asteroidsUpdate(unsigned long elapsedMs) {
  // ── Determine current difficulty tier ──
  int tier = elapsedMs / DIFFICULTY_INTERVAL;
  if (tier >= DIFFICULTY_LEVELS) tier = DIFFICULTY_LEVELS - 1;
  const DifficultyTier& diff = tiers[tier];

  // ── Wave spawning: when all asteroids destroyed, wait 2s then spawn fresh wave ──
  int active = asteroidActiveCount();
  unsigned long now = millis();

  if (active == 0) {
    if (clearTimeMs == 0) {
      clearTimeMs = now;  // mark the moment the screen became empty
    } else if (now - clearTimeMs >= WAVE_DELAY_MS) {
      // Wipe the pool and spawn a fresh wave
      memset(pool, 0, sizeof(pool));
      currentJag = tier;  // cache for split children
      for (int i = 0; i < diff.minAsteroids; i++) {
        spawnFromTop(AST_LARGE, diff.speedMult, tier);
      }
      clearTimeMs = 0;
    }
  } else {
    clearTimeMs = 0;  // screen not empty, reset timer
  }

  // ── Move all active asteroids ──
  for (int i = 0; i < ASTEROID_MAX; i++) {
    if (!pool[i].active) continue;
    Asteroid& a = pool[i];

    a.x     += a.vx;
    a.y     += a.vy;
    a.angle += a.rotSpeed;
    if (a.angle >= TWO_PI) a.angle -= TWO_PI;
    if (a.angle <  0)      a.angle += TWO_PI;

    // Wrap with radius padding so asteroid fully exits before reappearing
    float r = (float)a.radius;
    if (a.x + r < 0)         a.x = SCREEN_W + r;
    if (a.x - r > SCREEN_W)  a.x = -r;
    if (a.y + r < 0)         a.y = SCREEN_H + r;
    if (a.y - r > SCREEN_H)  a.y = -r;
  }
}

void asteroidsDraw(Adafruit_SSD1306& display) {
  for (int i = 0; i < ASTEROID_MAX; i++) {
    if (!pool[i].active) continue;
    const Asteroid& a = pool[i];

    for (int v = 0; v < a.numVerts; v++) {
      int  next = (v + 1) % a.numVerts;
      float a1  = a.angle + TWO_PI * v    / a.numVerts;
      float a2  = a.angle + TWO_PI * next / a.numVerts;
      float r1  = a.radius + a.offsets[v];
      float r2  = a.radius + a.offsets[next];

      int x1 = (int)(a.x + cosf(a1) * r1);
      int y1 = (int)(a.y + sinf(a1) * r1);
      int x2 = (int)(a.x + cosf(a2) * r2);
      int y2 = (int)(a.y + sinf(a2) * r2);

      display.drawLine(x1, y1, x2, y2, SSD1306_WHITE);
    }
  }
}

bool asteroidHitsShip(float sx, float sy) {
  for (int i = 0; i < ASTEROID_MAX; i++) {
    if (!pool[i].active) continue;
    const Asteroid& a = pool[i];
    float dx   = a.x - sx;
    float dy   = a.y - sy;
    float rSum = (float)(a.radius + SHIP_RADIUS);
    if (dx * dx + dy * dy < rSum * rSum) return true;
  }
  return false;
}

uint32_t asteroidsHitBullet(float bx, float by) {
  for (int i = 0; i < ASTEROID_MAX; i++) {
    if (!pool[i].active) continue;
    Asteroid& a = pool[i];
    float dx = a.x - bx;
    float dy = a.y - by;
    float r  = (float)a.radius;
    if (dx * dx + dy * dy >= r * r) continue;

    // Hit — record spawn info before deactivating
    uint32_t     pts      = 0;
    AsteroidSize child    = AST_SMALL;
    bool         splits   = true;
    float        cx = a.x, cy = a.y;

    switch (a.size) {
      case AST_LARGE:  pts = SCORE_LARGE;  child = AST_MEDIUM; break;
      case AST_MEDIUM: pts = SCORE_MEDIUM; child = AST_SMALL;  break;
      case AST_SMALL:  pts = SCORE_SMALL;  splits = false;     break;
    }

    a.active = false;
    particlesSpawn(cx, cy);
    if (a.size == AST_LARGE) displayShake(4);  // shake on large destruction

    if (splits) {
      spawnAt(cx, cy, child, 1.0f, currentJag);
      spawnAt(cx, cy, child, 1.0f, currentJag);
    }

    return pts;
  }
  return 0;
}

int asteroidActiveCount() {
  int n = 0;
  for (int i = 0; i < ASTEROID_MAX; i++) {
    if (pool[i].active) n++;
  }
  return n;
}

bool asteroidNearest(float sx, float sy, float& outX, float& outY) {
  float bestDist = 1e9f;
  bool found = false;
  for (int i = 0; i < ASTEROID_MAX; i++) {
    if (!pool[i].active) continue;
    float dx = pool[i].x - sx;
    float dy = pool[i].y - sy;
    float d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      outX = pool[i].x;
      outY = pool[i].y;
      found = true;
    }
  }
  return found;
}
