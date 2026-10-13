#pragma once
#include <Arduino.h>
struct InputState {
  float joyX, joyY;
  int rawX, rawY;
  bool fireHeld, firePressed, pauseTriggered;
};
void inputInit();
void inputUpdate();
const InputState& inputGet();
