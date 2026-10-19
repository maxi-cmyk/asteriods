#include "Adafruit_SSD1306.h"
#include "../vendor/glcdfont.c"

void Adafruit_SSD1306::write_character(char c) {
    if (c == '\n') {
        cursor_x = 0;
        cursor_y += 8 * text_size;
        return;
    }
    if (c == '\r') {
        return;
    }
    if (cursor_x + 6 * text_size > 128) {
        cursor_x = 0;
        cursor_y += 8 * text_size;
    }
    for (int column = 0; column < 5; column++) {
        uint8_t bits = font[uint8_t(c) * 5 + column];
        for (int row = 0; row < 8; row++) {
            if ((bits >> row) & 1) {
                fillRect(cursor_x + column * text_size,
                         cursor_y + row * text_size,
                         text_size,
                         text_size,
                         text_color);
            }
        }
    }
    cursor_x += 6 * text_size;
}

static void format_number(char *out, unsigned long value, int width) {
    char reverse[16] = {};
    int count = 0;
    do {
        reverse[count++] = '0' + value % 10;
        value /= 10;
    } while (value);
    int pos = 0;
    for (int i = count; i < width; i++) {
        out[pos++] = ' ';
    }
    while (count) {
        out[pos++] = reverse[--count];
    }
    out[pos] = 0;
}

void Adafruit_SSD1306::print(int value) {
    if (value < 0) {
        write_character('-');
        value = -value;
    }
    char text[24] = {};
    format_number(text, value, 0);
    print(text);
}

void Adafruit_SSD1306::printf(const char *format, ...) {
    va_list args;
    va_start(args, format);
    while (*format) {
        if (*format++ != '%') {
            write_character(format[-1]);
            continue;
        }
        int width = 0;
        while (*format >= '0' && *format <= '9') {
            width = width * 10 + *format++ - '0';
        }
        bool is_long = *format == 'l';
        if (is_long) {
            format++;
        }
        char type = *format++;
        if (type == 's') {
            print(va_arg(args, const char *));
            continue;
        }
        if (type == 'c') {
            write_character(va_arg(args, int));
            continue;
        }
        unsigned long value = is_long ? va_arg(args, unsigned long)
                                      : va_arg(args, unsigned int);
        char text[24] = {};
        format_number(text, value, width);
        print(text);
    }
    va_end(args);
}
