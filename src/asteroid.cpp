#include "asteroid.h"
#include "config.h"
#include "particle.h"
#include "display.h"
#include "sound.h"
static Asteroid rocks[ASTEROID_MAX];
static uint16_t wave;
static uint8_t pending;
static unsigned long nextSpawn;
static unsigned long clearAt;
static bool waiting;
static float waveSpeed() { return 0.38f + min(int(wave - 1), 10) * 0.045f; }
static int freeSlots() {
  int count = 0;
  for (const auto& a : rocks) if (!a.active) ++count;
  return count;
}
static void spawn(float x, float y, AsteroidSize size, float vx, float vy) {
  for (auto& a : rocks) {
    if (a.active) continue;
    a = {};
    a.active = true;
    a.x = x; a.y = y; a.vx = vx; a.vy = vy; a.size = size;
    a.radius = size == AST_LARGE ? ASTEROID_LARGE_R : size == AST_MEDIUM ? ASTEROID_MEDIUM_R : ASTEROID_SMALL_R;
    a.angle = random(628) / 100.0f;
    a.rotSpeed = (random(101) - 50) / 4000.0f;
    // Keep the outline inside the collision circle, even for small rocks.
    for (auto& offset : a.offsets) offset = -random(size == AST_SMALL ? 2 : 3);
    return;
  }
}
void asteroidsInit() {
  memset(rocks, 0, sizeof(rocks));
  wave = 1; pending = 3; nextSpawn = 0; clearAt = 0; waiting = false;
}
int asteroidActiveCount() {
  int n = 0;
  for (const auto& a : rocks) if (a.active) ++n;
  return n;
}
uint16_t asteroidWave() { return wave; }
void asteroidsUpdate(unsigned long now) {
  if (pending && now >= nextSpawn && freeSlots()) {
    float y = random(HUD_HEIGHT + ASTEROID_LARGE_R + 1, SCREEN_H - ASTEROID_LARGE_R);
    spawn(SCREEN_W + ASTEROID_LARGE_R, y, AST_LARGE, -waveSpeed(), (random(101) - 50) / 500.0f);
    --pending;
    nextSpawn = now + 1800;
  }
  for (auto& a : rocks) {
    if (!a.active) continue;
    a.x += a.vx; a.y += a.vy; a.angle += a.rotSpeed;
    if (a.y < HUD_HEIGHT + a.radius + 1) {
      a.y = HUD_HEIGHT + a.radius + 1; a.vy = fabsf(a.vy);
    }
    if (a.y > SCREEN_H - a.radius - 1) {
      a.y = SCREEN_H - a.radius - 1; a.vy = -fabsf(a.vy);
    }
    if (a.x + a.radius < 0) a.active = false;
  }
  if (!pending && !asteroidActiveCount()) {
    if (!waiting) { waiting = true; clearAt = now; }
    else if (now - clearAt >= 1500) {
      if (wave < 65535) ++wave;
      pending = min(3 + int(wave - 1) / 2, 6);
      nextSpawn = now; waiting = false;
    }
  }
}
void asteroidsDraw(Adafruit_SSD1306& d) {
  for (const auto& a : rocks) {
    if (!a.active) continue;
    for (int v = 0; v < 8; ++v) {
      int n = (v + 1) % 8;
      float t = a.angle + TWO_PI * v / 8, u = a.angle + TWO_PI * n / 8;
      float r = a.radius + a.offsets[v], s = a.radius + a.offsets[n];
      d.drawLine(a.x + cosf(t)*r, a.y + sinf(t)*r, a.x + cosf(u)*s, a.y + sinf(u)*s, SSD1306_WHITE);
    }
  }
}
bool asteroidHitsShip(float x, float y) {
  for (const auto& a : rocks) {
    float dx = a.x-x, dy = a.y-y, r = a.radius + SHIP_RADIUS;
    if (a.active && dx*dx + dy*dy < r*r) return true;
  }
  return false;
}
uint32_t asteroidsHitBullet(float fromX, float toX, float y) {
  // Find the first intersected rock along this horizontal bullet segment.
  int hit = -1;
  float first = toX + 1;
  for (int i = 0; i < ASTEROID_MAX; ++i) {
    const auto& a = rocks[i];
    if (!a.active) continue;
    float dy = y - a.y, r = a.radius;
    if (fabsf(dy) > r) continue;
    float half = sqrtf(r*r - dy*dy);
    float entry = max(fromX, a.x-half);
    if (a.x+half >= fromX && entry <= toX && entry < first) { first = entry; hit = i; }
  }
  if (hit < 0) return 0;
  Asteroid parent = rocks[hit];
  // If the pool is full, leave the parent intact until both fragments fit.
  if (parent.size != AST_SMALL && freeSlots() < 1) return 0;
  rocks[hit].active = false;
  particlesSpawn(parent.x, parent.y);
  soundPlay(parent.size == AST_SMALL ? SFX_ASTEROID_SMALL : SFX_ASTEROID_LARGE);
  if (parent.size == AST_LARGE) displayShake(2);
  if (parent.size != AST_SMALL) {
    AsteroidSize child = parent.size == AST_LARGE ? AST_MEDIUM : AST_SMALL;
    float offset = child == AST_MEDIUM ? ASTEROID_MEDIUM_R : ASTEROID_SMALL_R;
    spawn(parent.x, parent.y-offset, child, parent.vx*1.08f, -0.18f);
    spawn(parent.x, parent.y+offset, child, parent.vx*1.08f, 0.18f);
  }
  return parent.size == AST_LARGE ? SCORE_LARGE : parent.size == AST_MEDIUM ? SCORE_MEDIUM : SCORE_SMALL;
}
float asteroidSafeRespawnY() {
  float bestY = (HUD_HEIGHT + SCREEN_H)/2.0f, bestClearance = -1000;
  for (int y = HUD_HEIGHT + SHIP_RADIUS + 2; y < SCREEN_H - SHIP_RADIUS - 2; ++y) {
    float clearance = 1000;
    for (const auto& a : rocks) {
      if (!a.active) continue;
      float dx = a.x-SHIP_X, dy = a.y-y;
      clearance = min(clearance, sqrtf(dx*dx+dy*dy)-a.radius-SHIP_RADIUS);
    }
    if (clearance > bestClearance) { bestClearance = clearance; bestY = y; }
  }
  return bestY;
}
