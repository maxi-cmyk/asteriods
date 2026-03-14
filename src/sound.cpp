#include "sound.h"
#include "config.h"

// Passive buzzer: variable frequency oscillator.
// Control pitch via frequency in Hz.
// Pattern = array of {freq, durationMs} steps.

struct SoundStep {
  uint16_t freq;       // 0 = silent, else frequency in Hz
  uint16_t durationMs;
};

// ── Sound patterns ──

static const SoundStep PAT_SHOOT[] = {
  {1000, 10}, {800, 10}, {600, 10},
  {0, 0}
};

static const SoundStep PAT_ASTEROID_SMALL[] = {
  {1200, 20}, {0, 20}, {1200, 20},
  {0, 0}
};

static const SoundStep PAT_ASTEROID_LARGE[] = {
  {200, 25}, {0, 15}, {150, 25}, {0, 15}, {100, 25},
  {0, 0}
};

static const SoundStep PAT_DEATH[] = {
  {300, 100}, {250, 100}, {200, 100}, {150, 100}, {100, 100},
  {0, 0}
};

static const SoundStep PAT_STREAK_UP[] = {
  {440, 30}, {0, 10}, {554, 30}, {0, 10}, {659, 30}, // A4, C#5, E5
  {0, 0}
};

static const SoundStep PAT_STREAK_LOST[] = {
  {150, 80},
  {0, 0}
};

static const SoundStep PAT_THRUST[] = {
  {100, 15}, {150, 15},
  {0, 0}
};

static const SoundStep PAT_MENU_SELECT[] = {
  {880, 15}, // A5
  {0, 0}
};

static const SoundStep PAT_HIGHSCORE[] = {
  {523, 40}, {0, 30}, {523, 40}, {0, 30}, {523, 40}, {0, 30}, {659, 40}, {0, 30}, {784, 60}, // C5, E5, G5
  {0, 0}
};

static const SoundStep PAT_GAMEOVER[] = {
  {200, 200}, {180, 200}, {160, 200}, {140, 200}, {120, 200},
  {0, 0}
};

static const SoundStep PAT_UFO[] = {
  {1000, 200}, {500, 200},
  {0, 0}
};

// ── State ──
static SoundFX currentFX = SFX_NONE;
static const SoundStep* currentPattern = nullptr;
static int currentStep = 0;
static unsigned long stepStartMs = 0;

// Map SFX enum to pattern
static const SoundStep* getPattern(SoundFX fx) {
  switch (fx) {
    case SFX_SHOOT:          return PAT_SHOOT;
    case SFX_ASTEROID_SMALL: return PAT_ASTEROID_SMALL;
    case SFX_ASTEROID_LARGE: return PAT_ASTEROID_LARGE;
    case SFX_DEATH:          return PAT_DEATH;
    case SFX_STREAK_UP:      return PAT_STREAK_UP;
    case SFX_STREAK_LOST:    return PAT_STREAK_LOST;
    case SFX_THRUST:         return PAT_THRUST;
    case SFX_MENU_SELECT:    return PAT_MENU_SELECT;
    case SFX_HIGHSCORE:      return PAT_HIGHSCORE;
    case SFX_GAMEOVER:       return PAT_GAMEOVER;
    case SFX_UFO:            return PAT_UFO;
    default:                 return nullptr;
  }
}

// ── Helpers ──
static void setBuzzer(uint16_t freq) {
  if (freq > 0) {
    ledcWriteTone(BUZZ_CHANNEL, freq);
  } else {
    ledcWriteTone(BUZZ_CHANNEL, 0);
    ledcWrite(BUZZ_CHANNEL, 0); // Force PWM duty to 0 to be safe
  }
}

void soundInit() {
  ledcSetup(BUZZ_CHANNEL, BUZZ_FREQ, BUZZ_RES);
  ledcAttachPin(PIN_BUZZER, BUZZ_CHANNEL);
  setBuzzer(0);
  currentFX = SFX_NONE;
  currentPattern = nullptr;
}

void soundPlay(SoundFX fx) {
  if (fx == SFX_NONE) return;

  // Priority: lower enum value = higher priority
  // Only override if new sound has higher or equal priority
  if (currentFX != SFX_NONE && fx > currentFX) {
    return;  // current sound has higher priority
  }

  const SoundStep* pat = getPattern(fx);
  if (!pat) return;

  currentFX = fx;
  currentPattern = pat;
  currentStep = 0;
  stepStartMs = millis();
  
  setBuzzer(pat[0].freq);
}

void soundUpdate() {
  if (!currentPattern) return;

  unsigned long now = millis();
  const SoundStep& step = currentPattern[currentStep];

  // Check if current step duration has elapsed
  if (now - stepStartMs >= step.durationMs) {
    currentStep++;

    // Check if pattern is finished (terminated by {0, 0})
    if (currentPattern[currentStep].durationMs == 0) {
      // Pattern done
      setBuzzer(0);
      currentFX = SFX_NONE;
      currentPattern = nullptr;
      return;
    }

    // Advance to next step
    stepStartMs = now;
    setBuzzer(currentPattern[currentStep].freq);
  }
}

void soundStop() {
  setBuzzer(0);
  currentFX = SFX_NONE;
  currentPattern = nullptr;
}
