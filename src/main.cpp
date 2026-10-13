#include <Arduino.h>
#include "config.h"
#include "input.h"
#include "display.h"
#include "sound.h"
#include "game.h"

static unsigned long lastFrameMs = 0;

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== ASTEROIDS ===\n");

  // Initialize display first (shows splash)
  if (!displayInit()) {
    Serial.println("ERROR: OLED not found!");
    // Beep buzzer as error signal
    soundInit();
    for (int i = 0; i < 5; i++) {
      soundPlay(SFX_SHOOT);
      delay(200);
    }
    while (1);  // halt
  }

  // Show brief init message
  Adafruit_SSD1306& d = displayGet();
  d.clearDisplay();
  d.setTextSize(1);
  d.setTextColor(SSD1306_WHITE);
  d.setCursor(20, 28);
  d.print("Calibrating...");
  d.display();

  // Seed RNG from ESP32 hardware entropy so asteroids vary each run
  randomSeed(esp_random());

  // Initialize subsystems
  inputInit();   // Calibrates joystick
  soundInit();
  gameInit();

  // Startup beep
  soundPlay(SFX_MENU_SELECT);

  lastFrameMs = millis();
  Serial.println("Init complete. Game starting.");
}

void loop() {
  unsigned long now = millis();

  // ── Frame rate limiter ──
  if (now - lastFrameMs < FRAME_TIME_MS) {
    return;  // Not time for a new frame yet
  }
  lastFrameMs = now;

  // ── Per-frame update sequence ──
  inputUpdate();    // Read all inputs
  gameUpdate();     // State machine + physics + render
  soundUpdate();    // Advance sound patterns

}
