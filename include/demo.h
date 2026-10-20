#pragma once

#include "asteroid.h"
#include "ship.h"
#include "input.h"

struct DemoController {
    int target;
    bool aiming;
    bool dodging;
    int dodge_direction;
    unsigned long dodge_until_ms;
    unsigned long next_shot_ms;
};

void demo_reset(DemoController& demo);
InputState demo_update(DemoController& demo,
                       const Ship& ship,
                       const Asteroid *asteroids,
                       unsigned long game_ms);
