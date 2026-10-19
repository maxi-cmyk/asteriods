#pragma once
#include <cstdint>
#include <algorithm>
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
    int triangle_min_x = 0;
    int triangle_max_x = 0;
    int triangle_min_y = 0;
    int triangle_max_y = 0;
    int line_x = 0;
    int line_y = 0;
    int line_width = 0;
    void drawTriangle(int x1, int y1, int x2, int y2, int x3, int y3, int) {
        ++triangle_calls;
        triangle_min_x = std::min(x1, std::min(x2, x3));
        triangle_max_x = std::max(x1, std::max(x2, x3));
        triangle_min_y = std::min(y1, std::min(y2, y3));
        triangle_max_y = std::max(y1, std::max(y2, y3));
    }

    template <class... T> void drawLine(T...) {
    }

    void drawFastHLine(int x, int y, int width, int) {
        line_x = x;
        line_y = y;
        line_width = width;
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
