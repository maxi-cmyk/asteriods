#pragma once
#include "Arduino.h"
#define SSD1306_WHITE 1
#define SSD1306_BLACK 0
#define SSD1306_SWITCHCAPVCC 0
#define SSD1306_SETDISPLAYOFFSET 0xD3

// Same monochrome raster, classic font, and GFX line/triangle primitives.
class Adafruit_SSD1306 {
    int cursor_x = 0, cursor_y = 0;
    int text_size = 1;
    uint16_t text_color = 1;
    bool expecting_offset = false;
    void write_character(char character);

    public:
    uint8_t pixels[128 * 64] = {};
    int display_offset = 0;
    Adafruit_SSD1306(int, int, void *, int) {
    }
    bool begin(int, int) {
        return true;
    }
    void clearDisplay() {
        memset(pixels, 0, sizeof(pixels));
    }
    void display() {
    }
    void ssd1306_command(uint8_t command) {
        if (expecting_offset) {
            display_offset = command > 31 ? int(command) - 64 : command;
            expecting_offset = false;
        } else {
            expecting_offset = command == SSD1306_SETDISPLAYOFFSET;
        }
    }
    void drawPixel(int16_t x, int16_t y, uint16_t color) {
        if (x >= 0 && x < 128 && y >= 0 && y < 64) {
            pixels[y * 128 + x] = color != 0;
        }
    }
    void startWrite() {
    }
    void endWrite() {
    }
    void writePixel(int16_t x, int16_t y, uint16_t c) {
        drawPixel(x, y, c);
    }
    void writeLine(int16_t, int16_t, int16_t, int16_t, uint16_t);
    void drawLine(int16_t, int16_t, int16_t, int16_t, uint16_t);
    void drawTriangle(
            int16_t, int16_t, int16_t, int16_t, int16_t, int16_t, uint16_t);
    void drawRect(int16_t, int16_t, int16_t, int16_t, uint16_t);
    void drawFastHLine(int16_t x, int16_t y, int16_t w, uint16_t c) {
        for (int i = 0; i < w; i++) {
            drawPixel(x + i, y, c);
        }
    }
    void drawFastVLine(int16_t x, int16_t y, int16_t h, uint16_t c) {
        for (int i = 0; i < h; i++) {
            drawPixel(x, y + i, c);
        }
    }
    void writeFastHLine(int16_t x, int16_t y, int16_t w, uint16_t c) {
        drawFastHLine(x, y, w, c);
    }
    void writeFastVLine(int16_t x, int16_t y, int16_t h, uint16_t c) {
        drawFastVLine(x, y, h, c);
    }
    void fillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t c) {
        for (int i = 0; i < h; i++) {
            drawFastHLine(x, y + i, w, c);
        }
    }
    void setTextSize(int s) {
        text_size = s > 0 ? s : 1;
    }
    void setTextColor(uint16_t c) {
        text_color = c;
    }
    void setCursor(int x, int y) {
        cursor_x = x;
        cursor_y = y;
    }
    void print(const char *text) {
        while (*text) {
            write_character(*text++);
        }
    }
    void print(int value);
    void printf(const char *format, ...);
};
