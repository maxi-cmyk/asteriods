#include "input.h"
#include "config.h"

static InputState state;

// Calibration
static int centerX = 2048;
static int centerY = 2048;

// Button debounce
static unsigned long lastFireChange = 0;
static bool lastFireRaw = false;
static bool fireStable = false;

// Double-click detection
static unsigned long lastClickTime = 0;
static bool lastClickRaw = false;
static bool clickStable = false;
static unsigned long lastClickChange = 0;

// Click wobble freeze
static unsigned long clickFreezeUntil = 0;

// ── Smoothed ADC read ────
static int readSmoothed(int pin) {
  long sum = 0;
  for (int i = 0; i < JOY_SMOOTH_SAMPLES; i++) {
    sum += analogRead(pin);
  }
  return sum / JOY_SMOOTH_SAMPLES;
}

// ── Calibrate center on boot ───
void inputInit() {
  pinMode(PIN_JOY_CLK, INPUT_PULLUP);
  pinMode(PIN_FIRE, INPUT_PULLUP);
  analogReadResolution(12);

  // Read center position (joystick must be untouched)
  long xSum = 0, ySum = 0;
  const int samples = 32;
  for (int i = 0; i < samples; i++) {
    xSum += analogRead(PIN_JOY_X);
    ySum += analogRead(PIN_JOY_Y);
    delay(5);
  }
  centerX = xSum / samples;
  centerY = ySum / samples;

  memset(&state, 0, sizeof(state));
}

// ── Debounce helper ──
static bool debounce(bool raw, bool& lastRaw, bool& stable, unsigned long& lastChange) {
  if (raw != lastRaw) {
    lastChange = millis();
    lastRaw = raw;
  }
  if (millis() - lastChange >= DEBOUNCE_MS) {
    stable = raw;
  }
  return stable;
}

// ── Update (call once per frame) ───
void inputUpdate() {
  unsigned long now = millis();

  // ── Read joystick axes ──
  int rawX = readSmoothed(PIN_JOY_X);
  int rawY = readSmoothed(PIN_JOY_Y);
  state.rawX = rawX;
  state.rawY = rawY;

  // If within click freeze window, use center values
  if (now < clickFreezeUntil) {
    rawX = centerX;
    rawY = centerY;
  }

  // Map to -100..100 relative to calibrated center
  // Range is 0..4095, center is ~2048
  int pctX = 0;
  int pctY = 0;

  if (rawX > centerX) {
    pctX = map(rawX, centerX, 4095, 0, 100);
  } else {
    pctX = map(rawX, 0, centerX, -100, 0);
  }

  if (rawY > centerY) {
    pctY = map(rawY, centerY, 4095, 0, 100);
  } else {
    pctY = map(rawY, 0, centerY, -100, 0);
  }

  pctX = constrain(pctX, -100, 100);
  pctY = constrain(pctY, -100, 100);

  // Apply deadzone
  if (abs(pctX) < JOY_DEADZONE) pctX = 0;
  if (abs(pctY) < JOY_DEADZONE) pctY = 0;

  // Remap post-deadzone to 0..1 range
  // So edge of deadzone = 0.0, full deflection = 1.0
  if (pctX != 0) {
    int sign = (pctX > 0) ? 1 : -1;
    int magnitude = abs(pctX) - JOY_DEADZONE;
    state.joyX = sign * (magnitude / (float)(100 - JOY_DEADZONE));
  } else {
    state.joyX = 0;
  }

  if (pctY != 0) {
    int sign = (pctY > 0) ? 1 : -1;
    int magnitude = abs(pctY) - JOY_DEADZONE;
    state.joyY = sign * (magnitude / (float)(100 - JOY_DEADZONE));
  } else {
    state.joyY = 0;
  }

  // Deflection for zone detection
  state.joyXDeflect = abs(pctX);
  state.joyYDeflect = abs(pctY);

  // Determine zones
  auto toZone = [](int deflect) -> JoyZone {
    if (deflect < JOY_DEADZONE)      return ZONE_DEAD;
    if (deflect >= JOY_THRUST_ZONE)  return ZONE_THRUST;
    return ZONE_CRUISE;
  };
  state.xZone = toZone(state.joyXDeflect);
  state.yZone = toZone(state.joyYDeflect);

  // ── Fire button ──
  bool fireRaw = !digitalRead(PIN_FIRE);  // active low
  bool prevFire = state.fireHeld;
  state.fireHeld = debounce(fireRaw, lastFireRaw, fireStable, lastFireChange);
  state.firePressed = state.fireHeld && !prevFire;  // rising edge

  // ── Joystick click + double-click ──
  bool clickRaw = !digitalRead(PIN_JOY_CLK);  // active low
  bool prevClick = clickStable;
  debounce(clickRaw, lastClickRaw, clickStable, lastClickChange);
  bool clickRising = clickStable && !prevClick;

  state.pauseTriggered = false;

  if (clickRising) {
    // Freeze axes to prevent wobble
    clickFreezeUntil = now + JOY_CLICK_FREEZE_MS;

    // Double-click detection
    if (now - lastClickTime <= DBLCLICK_WINDOW) {
      state.pauseTriggered = true;
      lastClickTime = 0;  // reset so triple-click doesn't re-trigger
    } else {
      lastClickTime = now;
    }
  }
}

const InputState& inputGet() {
  return state;
}
