#include "particle.h"

struct Particle {
  float x, y;
  float vx, vy;
  uint8_t life;   // frames remaining
  bool active;
};

static Particle pool[PARTICLE_MAX];

void particlesSpawn(float x, float y) {
  int count = 4 + random(3);  // 4-6 particles
  for (int n = 0; n < count; n++) {
    // Find a free slot
    for (int i = 0; i < PARTICLE_MAX; i++) {
      if (pool[i].active) continue;
      Particle& p = pool[i];
      p.x  = x;
      p.y  = y;
      // Random direction, speed 1-3 px/frame
      float angle = random(628) / 100.0f;
      float speed = 1.0f + random(200) / 100.0f;
      p.vx = cosf(angle) * speed;
      p.vy = sinf(angle) * speed;
      p.life   = 10 + random(6);  // 10-15 frames
      p.active = true;
      break;
    }
  }
}

void particlesUpdate() {
  for (int i = 0; i < PARTICLE_MAX; i++) {
    if (!pool[i].active) continue;
    Particle& p = pool[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.life == 0) p.active = false;
  }
}

void particlesDraw(Adafruit_SSD1306& display) {
  for (int i = 0; i < PARTICLE_MAX; i++) {
    if (!pool[i].active) continue;
    const Particle& p = pool[i];
    int px = (int)p.x;
    int py = (int)p.y;
    if (px >= 0 && px < 128 && py >= 0 && py < 64) {
      display.drawPixel(px, py, SSD1306_WHITE);
    }
  }
}
