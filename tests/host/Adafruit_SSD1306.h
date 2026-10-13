#pragma once
#include <cstdint>
#define SSD1306_WHITE 1
#define SSD1306_BLACK 0
class Adafruit_SSD1306 {
    public:
    template <class... T> void drawTriangle(T...) {
    }

    template <class... T> void drawLine(T...) {
    }

    template <class... T> void drawFastHLine(T...) {
    }

    template <class... T> void drawPixel(T...) {
    }

    template <class... T> void fillRect(T...) {
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
