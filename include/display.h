#pragma once
#include <Adafruit_SSD1306.h>

// Initialize OLED at 400kHz I2C. Returns false if OLED not found.
bool displayInit();

// Get reference to the display object (for drawing)
Adafruit_SSD1306& displayGet();

// Draw the HUD bar (lives, timer, score, multiplier)
// Pass timeElapsedMs for HUD burn-in shifting
void displayHUD(uint8_t lives, unsigned long timeLeftMs, uint32_t score, uint8_t multiplier, unsigned long timeElapsedMs);

// Push frame buffer to screen
void displayFlip();

// Screen shake: call displayShake to trigger, displayShakeUpdate each frame
void displayShake(uint8_t frames);  // start shaking for N frames
void displayShakeUpdate();          // call each frame (before displayFlip)
