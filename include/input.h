#pragma once
#include <Arduino.h>

// Joystick movement zone
enum JoyZone {
  ZONE_DEAD,
  ZONE_CRUISE,
  ZONE_THRUST
};

struct InputState {
  // Joystick axes: -1.0 to 1.0 (after deadzone + smoothing)
  float joyX;          // left/right rotation
  float joyY;          // forward/back movement

  // Deflection percentage 0-100 (absolute, for zone detection)
  int joyXDeflect;
  int joyYDeflect;

  // Axis zones
  JoyZone xZone;
  JoyZone yZone;

  // Buttons (true = pressed this frame)
  bool firePressed;    // rising edge
  bool fireHeld;       // currently held, prevent double fire

  // Pause (double-click on joystick detected)
  bool pauseTriggered; // true for one frame on double-click

  // Raw calibration values (for debug)
  int rawX;
  int rawY;
};

void inputInit();          // Setup pins + calibrate joystick center
void inputUpdate();        // Call once per frame
const InputState& inputGet();  // Get current state
