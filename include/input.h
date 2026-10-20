#pragma once

#include <Arduino.h>

struct InputState {
    float joystick_x;
    float joystick_y;
    int raw_x;
    int raw_y;
    bool fire_held;
    bool fire_pressed;
    bool pause_triggered;
    bool joystick_held;
};

void input_init();
void input_update();
const InputState& input_get();
