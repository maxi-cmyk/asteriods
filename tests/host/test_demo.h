#pragma once
// The demo controller and its lifecycle.
#include "harness.h"

static void test_demo_controller() {
    clear_test_world();
    DemoController controller = {};
    demo_reset(controller);
    ship_respawn(ship, SHIP_X, 35);
    memset(rocks, 0, sizeof(rocks));
    spawn_asteroid(75, 35, AST_LARGE, -0.4f, 0);
    spawn_asteroid(5, 35, AST_SMALL, -0.4f, 0);
    spawn_asteroid(15, 28, AST_SMALL, -0.4f, 0);
    InputState decision = demo_update(controller, ship, rocks, 0);
    assert(controller.target == 0 && decision.fire_pressed);
    assert(controller.dodging);
    int direction = controller.dodge_direction;
    for (unsigned long ms = 20; ms < 300; ms += 20) {
        decision = demo_update(controller, ship, rocks, ms);
        assert(controller.dodge_direction == direction);
    }
    // Nearby targets cannot steal a valid lock; aligned aiming stays still.
    rocks[1].active = false;
    rocks[2].active = false;
    spawn_asteroid(55, 48, AST_SMALL, -0.4f, 0);
    decision = demo_update(controller, ship, rocks, 1000);
    assert(controller.target == 0 && decision.joystick_y == 0);
    rocks[0].active = false;
    decision = demo_update(controller, ship, rocks, 1020);
    assert(controller.target == 1 && decision.joystick_y > 0);
    memset(rocks, 0, sizeof(rocks));
    decision = demo_update(controller, ship, rocks, 2000);
    assert(controller.target == -1 && !decision.fire_pressed);
    assert(decision.joystick_y == 0);
    // Behind/offscreen rocks are excluded, including from shooting.
    spawn_asteroid(0, 35, AST_SMALL, -0.4f, 0);
    spawn_asteroid(SCREEN_W + 1, 35, AST_SMALL, -0.4f, 0);
    decision = demo_update(controller, ship, rocks, 2200);
    assert(controller.target == -1 && !decision.fire_pressed);
    // All corners remain bounded even with nearby threats.
    for (float x : {float(SHIP_MIN_X), float(SHIP_MAX_X)}) {
        for (float y : {float(SHIP_MIN_Y), float(SHIP_MAX_Y)}) {
            ship_respawn(ship, x, y);
            for (int frame = 0; frame < 100; frame++) {
                decision = demo_update(
                        controller, ship, rocks, 3000 + frame * 20);
                ship_update(ship, decision.joystick_x, decision.joystick_y);
                assert(ship.position_x >= SHIP_MIN_X
                       && ship.position_x <= SHIP_MAX_X);
                assert(ship.position_y >= SHIP_MIN_Y
                       && ship.position_y <= SHIP_MAX_Y);
            }
        }
    }
}

static void test_demo_lifecycle() {
    fire_raw_high = true;
    joystick_raw_x = 2048;
    joystick_raw_y = 2048;
    input_init();
    game_init();
    tick(DEMO_IDLE_MS);
    assert(state == STATE_DEMO && demo_running);
    int writes = Preferences::writes;
    for (int frame = 0; frame < 15000; frame++) {
        tick();
        assert(state != STATE_INITIALS && state != STATE_GAME_OVER);
    }
    assert(Preferences::writes == writes);
    // Exit press is consumed; holding cannot start a run.
    begin_game();
    demo_running = true;
    set_state(STATE_DEMO);
    fire(true);
    assert(state == STATE_MENU && !demo_running);
    fire(true);
    assert(state == STATE_MENU);
    fire(false);
    fire(true);
    assert(state == STATE_COUNTDOWN);
    fire(false);
}

