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

void displayHUD(uint8_t lives, uint32_t score) {
  oled.setTextSize(1); oled.setTextColor(SSD1306_WHITE);
  for (int i = 0; i < lives; ++i) {
    int x = 2+i*8;
    oled.drawTriangle(x+5, 4, x, 1, x, 7, SSD1306_WHITE);
  }
  oled.setCursor(38, 1); oled.printf("%lu", (unsigned long)score);
  oled.drawFastHLine(0, HUD_HEIGHT-1, SCREEN_W, SSD1306_WHITE);
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
