#include <Arduino.h>
#include "config.h"
#include "input.h"
#include "display.h"
#include "sound.h"
#include "game.h"
#include "rock_random.h"

static unsigned long last_frame_ms = 0;
static const unsigned long SERIAL_BAUD = 115200;
static const int DISPLAY_ERROR_BEEPS = 5;
static const unsigned long DISPLAY_ERROR_BEEP_DELAY_MS = 200;
static const int CALIBRATION_TEXT_X = 20;
static const int CALIBRATION_TEXT_Y = 28;

static void initialize_display() {
    // Display must be ready before showing the calibration message.
    if (!display_init()) {
        Serial.println("ERROR: OLED not found!");
        sound_init();

        for (int i = 0; i < DISPLAY_ERROR_BEEPS; i++) {
            sound_play(SFX_SHOOT);
            delay(DISPLAY_ERROR_BEEP_DELAY_MS);
        }

        while (true) {
            // Halt because the game cannot run without its display.
        }
    }
}

static void show_calibration_message() {
    Adafruit_SSD1306& display = display_get();
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(CALIBRATION_TEXT_X, CALIBRATION_TEXT_Y);
    display.print("Calibrating...");
    display.display();
}

void setup() {
    Serial.begin(SERIAL_BAUD);
    Serial.println("\n=== ASTEROIDS ===\n");

    initialize_display();
    show_calibration_message();

    if (!rock_random_init()) {
        Serial.println("ERROR: hardware RNG entropy initialization failed");
        while (true) {
            delay(1000);
        }
    }
    Serial.println("Hardware RNG ready: RF entropy, no network connection");

    input_init(); // Calibrates joystick
    sound_init();
    game_init();

    sound_play(SFX_MENU_SELECT);

    last_frame_ms = millis();
    Serial.println("Init complete. Game starting.");
}

void loop() {
    unsigned long now = millis();
    unsigned long elapsed = now - last_frame_ms;

    if (elapsed < FRAME_TIME_MS) {
        // Sleep out the rest of the frame instead of spinning on millis(): the core idles
        // (and FreeRTOS can run other tasks) for most of every 20 ms.
        delay(FRAME_TIME_MS - elapsed);
        now = millis();
    }

    last_frame_ms = now;

    input_update();
    game_update();
    sound_update();
}
