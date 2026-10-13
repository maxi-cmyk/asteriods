#include "input.h"
#include "config.h"

static const int ADC_BITS = 12;
static const int ADC_MAX = 4095;
static const int ADC_DEFAULT_CENTER = 2048;
static const int JOYSTICK_PERCENT_MAX = 100;
static const int CALIBRATION_SAMPLES = 32;
static const unsigned long CALIBRATION_DELAY_MS = 5;

static InputState input_state = {};
static int center_x = ADC_DEFAULT_CENTER;
static int center_y = ADC_DEFAULT_CENTER;

static unsigned long last_fire_change = 0;
static bool last_fire_raw = false;
static bool fire_stable = false;

static unsigned long last_click_time = 0;
static bool awaiting_second_click = false;
static bool last_click_raw = false;
static bool click_stable = false;
static unsigned long last_click_change = 0;
static unsigned long click_freeze_until = 0;

static int read_smoothed(int pin) {
    long sum = 0;

    for (int i = 0; i < JOY_SMOOTH_SAMPLES; i++) {
        sum += analogRead(pin);
    }

    return sum / JOY_SMOOTH_SAMPLES;
}

void input_init() {
    pinMode(PIN_JOY_CLK, INPUT_PULLUP);
    pinMode(PIN_FIRE, INPUT_PULLUP);
    analogReadResolution(ADC_BITS);

    // Leave the joystick untouched while measuring its resting position.
    long x_sum = 0;
    long y_sum = 0;

    for (int i = 0; i < CALIBRATION_SAMPLES; i++) {
        x_sum += analogRead(PIN_JOY_X);
        y_sum += analogRead(PIN_JOY_Y);
        delay(CALIBRATION_DELAY_MS);
    }

    center_x = x_sum / CALIBRATION_SAMPLES;
    center_y = y_sum / CALIBRATION_SAMPLES;
    memset(&input_state, 0, sizeof(input_state));
}

static bool
debounce(bool raw, bool& last_raw, bool& stable, unsigned long& last_change) {
    if (raw != last_raw) {
        last_change = millis();
        last_raw = raw;
    }

    if (millis() - last_change >= DEBOUNCE_MS) {
        stable = raw;
    }

    return stable;
}

static float normalize_axis(int raw, int center) {
    int percent = 0;

    if (raw > center) {
        percent = map(raw, center, ADC_MAX, 0, JOYSTICK_PERCENT_MAX);
    } else {
        percent = map(raw, 0, center, -JOYSTICK_PERCENT_MAX, 0);
    }

    percent = constrain(percent, -JOYSTICK_PERCENT_MAX, JOYSTICK_PERCENT_MAX);

    if (abs(percent) < JOY_DEADZONE) {
        percent = 0;
    }

    if (percent == 0) {
        return 0;
    }

    int direction = 1;

    if (percent < 0) {
        direction = -1;
    }

    // Remap the deadzone boundary to zero and full deflection to one.
    int magnitude = abs(percent) - JOY_DEADZONE;
    return direction
           * (magnitude / (float)(JOYSTICK_PERCENT_MAX - JOY_DEADZONE));
}

static void update_axes(unsigned long now) {
    int raw_x = read_smoothed(PIN_JOY_X);
    int raw_y = read_smoothed(PIN_JOY_Y);
    input_state.raw_x = raw_x;
    input_state.raw_y = raw_y;

    // Clicking can wobble the stick; briefly ignore its axis displacement.
    if (now < click_freeze_until) {
        raw_x = center_x;
        raw_y = center_y;
    }

    input_state.joystick_x = normalize_axis(raw_x, center_x);
    input_state.joystick_y = normalize_axis(raw_y, center_y);
}

static void update_fire_button() {
    bool fire_raw = !digitalRead(PIN_FIRE);
    bool previous_fire = input_state.fire_held;
    input_state.fire_held
            = debounce(fire_raw, last_fire_raw, fire_stable, last_fire_change);
    input_state.fire_pressed = input_state.fire_held && !previous_fire;
}

static void update_joystick_click(unsigned long now) {
    bool click_raw = !digitalRead(PIN_JOY_CLK);
    bool previous_click = click_stable;
    debounce(click_raw, last_click_raw, click_stable, last_click_change);
    bool click_rising = click_stable && !previous_click;
    input_state.pause_triggered = false;

    if (click_rising) {
        click_freeze_until = now + JOY_CLICK_FREEZE_MS;

        if (awaiting_second_click && now - last_click_time <= DBLCLICK_WINDOW) {
            input_state.pause_triggered = true;
            awaiting_second_click = false;
        } else {
            last_click_time = now;
            awaiting_second_click = true;
        }
    }
}

void input_update() {
    unsigned long now = millis();
    update_axes(now);
    update_fire_button();
    update_joystick_click(now);
}

const InputState& input_get() {
    return input_state;
}
