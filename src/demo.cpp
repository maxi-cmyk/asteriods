#include "demo.h"
#include "config.h"
#include "input.h"
#include "ship.h"
#include "asteroid.h"
#include "bullet.h"
#include "display.h"
#include "sound.h"
#include "particle.h"
#include "saucer.h"

static Ship demoShip;
static unsigned long demoStartMs = 0;
static unsigned long lastDemoShot = 0;
#define DEMO_FIRE_INTERVAL 400  // ms between AI shots
#define DANGER_DIST 25.0f       // px — dodge threshold

void demoInit() {
  shipInit(demoShip);
  asteroidsInit();
  bulletsInit();
  saucerInit();
  demoStartMs = millis();
  lastDemoShot = 0;
}

  // Check if any asteroid is dangerously close and heading toward the ship.
// Returns true + the threat's X position so the AI can dodge away from it.
static bool findThreat(float sx, float sy, float& threatX) {
  // First check if saucer bullet is near
  // We don't have direct access to saucer bullets, so we just rely on saucer hits
  // A simpler way: if saucer is active and near, dodge it.
  if (saucerIsActive()) {
    // Actually saucer hit check is handled, but let's just make AI dodge the saucer itself
    // We don't have public getters for saucer X/Y. In demo, the aim is just to show action.
    // If it dies, it just respawns, so it's fine if it doesn't try too hard to dodge saucer.
  }

  // Use asteroidNearest's pool — we need to scan all asteroids directly
  float ax, ay;
  if (!asteroidNearest(sx, sy, ax, ay)) return false;

  float dx = ax - sx;
  float dy = ay - sy;
  float dist = sqrtf(dx * dx + dy * dy);

  // Only a threat if close AND the asteroid is above or at the ship's Y
  // (coming toward us from above or beside)
  if (dist < DANGER_DIST && dy < 10.0f) {
    threatX = ax;
    return true;
  }
  return false;
}

bool demoUpdate() {
  const InputState& inp = inputGet();
  Adafruit_SSD1306& d = displayGet();

  // Any input exits demo
  bool anyInput = (fabsf(inp.joyX) > 0.3f || fabsf(inp.joyY) > 0.3f ||
                   inp.firePressed || inp.pauseTriggered);
  if (anyInput) return true;

  unsigned long elapsed = millis() - demoStartMs;
  unsigned long now = millis();

  // AI decision: dodge first, then aim
  float aiJoyX = 0;
  float aiJoyY = 0.0f;
  float threatX;
  bool dodging = findThreat(demoShip.x, demoShip.y, threatX);

  // Always find the nearest target (needed for aiming AND fire decision)
  float tX, tY;
  bool hasTarget = asteroidNearest(demoShip.x, demoShip.y, tX, tY);

  if (dodging) {
    // Dodge AWAY from the threat
    float dx = threatX - demoShip.x;
    if (fabsf(dx) < 5.0f) {
      aiJoyX = (demoShip.x > SCREEN_W / 2) ? -1.0f : 1.0f;
    } else {
      aiJoyX = (dx > 0) ? -1.0f : 1.0f;
    }
  } else if (hasTarget) {
    // No threat — steer toward nearest asteroid to shoot it
    float dx = tX - demoShip.x;
    if (dx > 3.0f)       aiJoyX = 1.0f;
    else if (dx < -3.0f) aiJoyX = -1.0f;
    else                 aiJoyX = 0;
  }

  // Update ship with AI input
  shipUpdate(demoShip, aiJoyX);
  asteroidsUpdate(elapsed);
  saucerUpdate(elapsed, demoShip.x, demoShip.y);

  // AI auto-fire — only shoot if an asteroid is roughly in line of fire
  bool aligned = hasTarget && fabsf(tX - demoShip.x) < 8.0f && tY < demoShip.y;
  if (aligned && now - lastDemoShot > DEMO_FIRE_INTERVAL) {
    if (bulletsFire(demoShip.x, demoShip.y - (SHIP_RADIUS + 1))) {
      soundPlay(SFX_SHOOT);
      lastDemoShot = now;
    }
  }

  // Bullet-asteroid hits (no score tracking)
  bulletsUpdate();
  bulletsCheckAsteroids();
  bulletsCheckSaucer();

  // Ship collision — just respawn
  if (!demoShip.invincible && (asteroidHitsShip(demoShip.x, demoShip.y) || saucerHitsShip(demoShip.x, demoShip.y))) {
    shipRespawn(demoShip);
    displayShake(4);
  }

  // Particles
  particlesUpdate();

  // Render
  d.clearDisplay();
  displayHUD(demoShip.lives, 0, 0, 1, elapsed);
  asteroidsDraw(d);
  saucerDraw(d);
  bulletsDraw(d);
  particlesDraw(d);
  shipDraw(demoShip, d);

  // Blinking DEMO label
  if ((now / 600) % 2 == 0) {
    d.setCursor(48, 56);
    d.print("- DEMO -");
  }

  displayShakeUpdate();
  displayFlip();
  return false;
}
