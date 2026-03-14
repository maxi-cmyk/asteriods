#include "display.h"
#include "config.h"
#include <Wire.h>

static Adafruit_SSD1306 oled(SCREEN_W, SCREEN_H, &Wire, -1);

bool displayInit() {
  Wire.begin(21, 22);
  Wire.setClock(400000);  // 400kHz fast mode

  if (!oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    return false;
  }
  oled.clearDisplay();
  oled.display();
  return true;
}

Adafruit_SSD1306& displayGet() {
  return oled;
}

void displayHUD(uint8_t lives, unsigned long timeLeftMs, uint32_t score, uint8_t multiplier, unsigned long timeElapsedMs) {
  oled.setTextSize(1);
  oled.setTextColor(SSD1306_WHITE);

  // Calculate burn-in prevention offset: shift by 1px every 30 seconds
  // Cycle through 0, 1, 2, 3 offsets
  int shift = (timeElapsedMs / 30000) % 4;
  int ox = (shift == 1 || shift == 2) ? 1 : 0;
  int oy = (shift == 2 || shift == 3) ? 1 : 0;

  // ── Lives (left side) ──
  for (int i = 0; i < lives; i++) {
    int bx = 2 + i * 8 + ox;
    int by = 1 + oy;
    oled.drawTriangle(
      bx + 3, by,
      bx,     by + 6,
      bx + 6, by + 6,
      SSD1306_WHITE
    );
  }

  // ── Timer (center-left) ──
  unsigned long secs = timeLeftMs / 1000;
  int mins = secs / 60;
  int sec = secs % 60;
  oled.setCursor(35 + ox, 1 + oy);
  oled.printf("%d:%02d", mins, sec);

  // ── Score (center-right) ──
  char scoreBuf[10];
  snprintf(scoreBuf, sizeof(scoreBuf), "%lu", (unsigned long)score);
  int scoreWidth = strlen(scoreBuf) * 6;
  oled.setCursor(95 - scoreWidth + ox, 1 + oy);
  oled.print(scoreBuf);

  // ── Multiplier (right side) ──
  if (multiplier > 1) {
    oled.setCursor(100 + ox, 1 + oy);
    oled.printf("x%d", multiplier);
  }

  // ── HUD separator line ──
  // The line itself can stay fixed, or move with Y
  oled.drawFastHLine(0, HUD_HEIGHT - 1 + oy, SCREEN_W, SSD1306_WHITE);
}

void displayFlip() {
  oled.display();
}

// ── Screen shake ──
static uint8_t shakeFramesLeft = 0;

void displayShake(uint8_t frames) {
  shakeFramesLeft = frames;
}

void displayShakeUpdate() {
  if (shakeFramesLeft > 0) {
    shakeFramesLeft--;
    // Random ±1-2px vertical offset via SSD1306 hardware register
    int offset = (random(2) + 1) * (random(2) == 0 ? 1 : -1);
    oled.ssd1306_command(SSD1306_SETDISPLAYOFFSET);
    oled.ssd1306_command((uint8_t)(offset & 0x3F));
  } else {
    // Reset to no offset
    oled.ssd1306_command(SSD1306_SETDISPLAYOFFSET);
    oled.ssd1306_command(0);
  }
}
