#pragma once
#include <cstdint>
#define SSD1306_WHITE 1
#define SSD1306_BLACK 0
class Adafruit_SSD1306 {
    public:
    int outline_calls = 0;
    int fill_calls = 0;
    int triangle_calls = 0;
    int bar_x = 0;
    int bar_y = 0;
    int bar_width = 0;
    int bar_height = 0;
    int fill_width = 0;
    void drawRect(int x, int y, int width, int height, int) {
        ++outline_calls;
        bar_x = x;
        bar_y = y;
        bar_width = width;
        bar_height = height;
    }
    void fillRect(int, int, int width, int, int) {
        ++fill_calls;
        fill_width = width;
    }
    template <class... T> void drawTriangle(T...) {
        ++triangle_calls;
    }

    template <class... T> void drawLine(T...) {
    }

    template <class... T> void drawFastHLine(T...) {
    }

    template <class... T> void drawPixel(T...) {
    }

    template <class... T> void setTextSize(T...) {
    }

    template <class... T> void setTextColor(T...) {
    }

    template <class... T> void setCursor(T...) {
    }

    template <class... T> void print(T...) {
    }

    template <class... T> void printf(T...) {
    }

    void clearDisplay() {
    }
};
