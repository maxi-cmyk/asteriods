#include "display.h"
#include "config.h"
#include <Wire.h>

static const int OLED_SDA_PIN = 21;
static const int OLED_SCL_PIN = 22;
static const int OLED_RESET_PIN = -1;
static const unsigned long OLED_I2C_CLOCK_HZ = 400000;
static const int LIFE_ICON_X = 2;
static const int LIFE_ICON_SPACING = 8;
static const int LIFE_ICON_TIP_OFFSET = 5;
static const int LIFE_ICON_MIDDLE_Y = 4;
static const int LIFE_ICON_TOP_Y = 1;
static const int LIFE_ICON_BOTTOM_Y = 7;
static const int HUD_SCORE_X = 32;
static const int HUD_SCORE_Y = 1;
static const int HUD_MULTIPLIER_X = 108;
static const int HUD_CHAIN_WIDTH = 12;
static const unsigned long HUD_CHAIN_WINDOW_MS = 3000;
static const int SHAKE_OFFSET_CHOICES = 2;
static const int OLED_OFFSET_MASK = 0x3F;

static Adafruit_SSD1306 oled(SCREEN_W, SCREEN_H, &Wire, OLED_RESET_PIN);

bool display_init() {
    Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);
    Wire.setClock(OLED_I2C_CLOCK_HZ);

    if (!oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
        return false;
    }

    oled.clearDisplay();
    oled.display();
    return true;
}

Adafruit_SSD1306& display_get() {
    return oled;
}

void display_hud(uint8_t lives,
                 uint32_t score,
                 uint8_t multiplier,
                 unsigned long chain_left_ms) {
    oled.setTextSize(1);
    oled.setTextColor(SSD1306_WHITE);

    for (int i = 0; i < lives; ++i) {
        int position_x = LIFE_ICON_X + i * LIFE_ICON_SPACING;
        oled.drawTriangle(position_x + LIFE_ICON_TIP_OFFSET,
                          LIFE_ICON_MIDDLE_Y,
                          position_x,
                          LIFE_ICON_TOP_Y,
                          position_x,
                          LIFE_ICON_BOTTOM_Y,
                          SSD1306_WHITE);
    }

    oled.setCursor(HUD_SCORE_X, HUD_SCORE_Y);
    oled.printf("%lu", (unsigned long)score);
    oled.setCursor(HUD_MULTIPLIER_X, HUD_SCORE_Y);
    oled.printf("x%u", unsigned(multiplier));
    oled.drawFastHLine(HUD_MULTIPLIER_X,
                       HUD_HEIGHT - 2,
                       HUD_CHAIN_WIDTH * chain_left_ms / HUD_CHAIN_WINDOW_MS,
                       SSD1306_WHITE);
    oled.drawFastHLine(0, HUD_HEIGHT - 1, SCREEN_W, SSD1306_WHITE);
}

void display_flip() {
    oled.display();
}

static uint8_t shake_frames_left = 0;

void display_shake(uint8_t frames) {
    shake_frames_left = frames;
}

void display_shake_update() {
    if (shake_frames_left > 0) {
        shake_frames_left--;
        // Random ±1-2px vertical offset via SSD1306 hardware register
        int magnitude = random(SHAKE_OFFSET_CHOICES) + 1;
        int direction = -1;

        if (random(SHAKE_OFFSET_CHOICES) == 0) {
            direction = 1;
        }

        int offset = magnitude * direction;
        oled.ssd1306_command(SSD1306_SETDISPLAYOFFSET);
        oled.ssd1306_command((uint8_t)(offset & OLED_OFFSET_MASK));
    } else {
        oled.ssd1306_command(SSD1306_SETDISPLAYOFFSET);
        oled.ssd1306_command(0);
    }
}
