#pragma once
#include <Arduino.h>

// Initialize demo state (call before entering demo mode)
void demoInit();

// Run one frame of the demo. Returns true when demo should exit (user input).
bool demoUpdate();
