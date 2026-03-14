#include "game.h"
#include "config.h"
#include "input.h"
#include "ship.h"
#include "asteroid.h"
#include "bullet.h"
#include "display.h"
#include "sound.h"
#include "highscore.h"
#include "particle.h"
#include "demo.h"
#include "saucer.h"

// ── Game state ───
static GameState state = STATE_SPLASH;
static Ship ship;

// Timing
static unsigned long gameStartMs = 0;
static unsigned long stateEnterMs = 0;

// Score
static uint32_t score = 0;
static uint8_t multiplier = 1;
static uint8_t bestStreak = 1;       // highest multiplier reached this game
static uint8_t streakKills = 0;
static unsigned long lastKillMs = 0;

// High score state
static bool    isNewHighScore = false;
static int     hsRank = -1;
static char    hsInitials[4] = "AAA";
static uint8_t hsCharIdx = 0;         // 0-2: which char being edited

// Menu
static int menuSelection = 0;  // 0 = START, 1 = HIGH SCORES

// Stats
static uint16_t shotsFired = 0;
static uint16_t shotsHit = 0;
static uint16_t asteroidsDestroyed = 0;
static uint16_t timeSurvivedSec = 0;

// Game over page (0 = score, 1 = stats)
static int gameOverPage = 0;

// Death animation
static float deathLines[8][2];  // angle + length for explosion lines
static unsigned long deathAnimStart = 0;
#define DEATH_ANIM_DURATION 500  // ms

// Countdown
static int countdownNum = 3;

// ── Helpers ──
static void setState(GameState s) {
  state = s;
  stateEnterMs = millis();
}

static unsigned long timeElapsed() {
  return millis() - gameStartMs;
}

static unsigned long timeLeftMs() {
  unsigned long elapsed = timeElapsed();
  if (elapsed >= GAME_DURATION) return 0;
  return GAME_DURATION - elapsed;
}

static void startDeathAnim(float x, float y) {
  deathAnimStart = millis();
  for (int i = 0; i < 8; i++) {
    deathLines[i][0] = random(0, 628) / 100.0f;  // random angle 0..TWO_PI
    deathLines[i][1] = random(3, 8);              // random initial length
  }
}

static void resetGame() {
  shipInit(ship);
  asteroidsInit();
  bulletsInit();
  saucerInit();
  score = 0;
  multiplier = 1;
  bestStreak = 1;
  streakKills = 0;
  lastKillMs = 0;
  isNewHighScore = false;
  hsRank = -1;
  strcpy(hsInitials, "AAA");
  hsCharIdx = 0;
  shotsFired = 0;
  shotsHit = 0;
  asteroidsDestroyed = 0;
  timeSurvivedSec = 0;
  gameOverPage = 0;
  gameStartMs = millis();
}

// ── Update functions per state ──

static void updateSplash() {
  Adafruit_SSD1306& d = displayGet();
  d.clearDisplay();

  // "ASTEROIDS" title
  d.setTextSize(2);
  d.setTextColor(SSD1306_WHITE);
  d.setCursor(10, 10);
  d.print("ASTEROIDS");

  d.setTextSize(1);
  d.setCursor(25, 35);
  d.print("ESP32 Edition");

  // Loading and animated dots
  int dots = ((millis() / 300) % 4);
  d.setCursor(40, 50);
  d.print("Loading");
  for (int i = 0; i < dots; i++) d.print(".");

  d.display();

  // Auto-advance after 2 seconds
  if (millis() - stateEnterMs > 2000) {
    setState(STATE_MENU);
  }
}

static void updateMenu() {
  const InputState& inp = inputGet();
  Adafruit_SSD1306& d = displayGet();
  d.clearDisplay();

  d.setTextSize(2);
  d.setTextColor(SSD1306_WHITE);
  d.setCursor(10, 5);
  d.print("ASTEROIDS");

  d.setTextSize(1);

  // Menu options with cursor
  d.setCursor(20, 35);
  d.print(menuSelection == 0 ? "> START GAME" : "  START GAME");

  d.setCursor(20, 48);
  d.print(menuSelection == 1 ? "> HIGH SCORES" : "  HIGH SCORES");

  // Blinking prompt
  if ((millis() / 500) % 2 == 0) {
    d.setCursor(17, 56);
    d.print("Click to select");
  }

  d.display();

  // Joystick Y to navigate menu
  if (inp.joyY > 0.4f && menuSelection < 1) { menuSelection = 1; soundPlay(SFX_MENU_SELECT); }
  if (inp.joyY < -0.4f && menuSelection > 0) { menuSelection = 0; soundPlay(SFX_MENU_SELECT); }

  // Fire to select
  if (inp.firePressed) {
    soundPlay(SFX_MENU_SELECT);
    if (menuSelection == 0) {
      setState(STATE_COUNTDOWN);
      countdownNum = 3;
    } else {
      setState(STATE_HIGH_SCORES);
    }
  }

  // Joystick or fire resets idle timer
  bool anyInput = (fabsf(inp.joyX) > 0.3f || fabsf(inp.joyY) > 0.3f || inp.firePressed || inp.pauseTriggered);
  if (anyInput) {
    stateEnterMs = millis();  // reset idle timer
  }

  // Attract mode: start demo after 15s idle
  if (millis() - stateEnterMs > 15000) {
    demoInit();
    setState(STATE_DEMO);
  }
}

static void updateCountdown() {
  Adafruit_SSD1306& d = displayGet();
  d.clearDisplay();

  unsigned long elapsed = millis() - stateEnterMs;
  int num = 3 - (int)(elapsed / 700);  // 700ms per number

  if (num > 0) {
    d.setTextSize(3);
    d.setTextColor(SSD1306_WHITE);
    d.setCursor(55, 20);
    d.print(num);
  } else {
    d.setTextSize(2);
    d.setTextColor(SSD1306_WHITE);
    d.setCursor(38, 22);
    d.print("GO!!!");
  }

  d.display();

  // Total countdown: 3 × 700ms + 500ms for "GO!"
  if (elapsed > 3 * 700 + 500) {
    resetGame();
    setState(STATE_PLAYING);
  }
}

static void updatePlaying() {
  const InputState& inp = inputGet();
  Adafruit_SSD1306& d = displayGet();

  // ── Pause check ──
  if (inp.pauseTriggered) {
    setState(STATE_PAUSED);
    return;
  }

  // ── Update ship ──
  shipUpdate(ship, inp.joyX);

  // ── Update asteroids ──
  asteroidsUpdate(timeElapsed());

  // ── Update saucer ──
  saucerUpdate(timeElapsed(), ship.x, ship.y);

  // ── Asteroid–ship collision ──
  if (!ship.invincible && asteroidHitsShip(ship.x, ship.y)) {
    startDeathAnim(ship.x, ship.y);
    shipDie(ship);
    streakKills = 0;
    multiplier  = 1;
    soundPlay(SFX_DEATH);
    displayShake(6);
    setState(STATE_DEATH_ANIM);
    return;
  }

  // ── Saucer bullet–ship collision ──
  if (!ship.invincible && saucerHitsShip(ship.x, ship.y)) {
    startDeathAnim(ship.x, ship.y);
    shipDie(ship);
    streakKills = 0;
    multiplier  = 1;
    soundPlay(SFX_DEATH);
    displayShake(6);
    setState(STATE_DEATH_ANIM);
    return;
  }

  // ── Fire button ──
  if (inp.firePressed) {
    if (bulletsFire(ship.x, ship.y - (SHIP_RADIUS + 1))) {
      soundPlay(SFX_SHOOT);
      shotsFired++;
    }
  }

  // ── Update bullets + check asteroid hits ──
  bulletsUpdate();
  uint32_t pts = bulletsCheckAsteroids();
  if (pts > 0) {
    score += pts * multiplier;
    streakKills++;
    shotsHit++;
    asteroidsDestroyed++;
    lastKillMs = millis();
    if (streakKills % 3 == 0 && multiplier < 8) {
      multiplier++;
      if (multiplier > bestStreak) bestStreak = multiplier;
      soundPlay(SFX_STREAK_UP);
    }
  }

  // ── Check player bullets → saucer ──
  uint32_t saucerPts = bulletsCheckSaucer();
  if (saucerPts > 0) {
    score += saucerPts * multiplier;
    streakKills++;
    shotsHit++;
    lastKillMs = millis();
    soundPlay(SFX_ASTEROID_LARGE);  // reuse explosion sound
  }

  // ── Streak timer decay ──
  if (streakKills > 0 && millis() - lastKillMs > STREAK_WINDOW) {
    if (multiplier > 1) soundPlay(SFX_STREAK_LOST);
    streakKills = 0;
    multiplier  = 1;
  }

  // ── Time up check ──
  if (timeLeftMs() == 0) {
    setState(STATE_GAME_OVER);
    soundPlay(SFX_GAMEOVER);
    return;
  }

  // ── UFO warble sound ──
  if (saucerIsActive()) {
    soundPlay(SFX_UFO);
  }

  // ── Update particles ──
  particlesUpdate();

  // ── Render ──
  d.clearDisplay();
  displayHUD(ship.lives, timeLeftMs(), score, multiplier, timeElapsed());
  asteroidsDraw(d);
  saucerDraw(d);
  bulletsDraw(d);
  particlesDraw(d);
  shipDraw(ship, d);   // ship on top

  displayShakeUpdate();
  displayFlip();
}

static void updatePaused() {
  const InputState& inp = inputGet();
  Adafruit_SSD1306& d = displayGet();
  
  d.clearDisplay();
  displayHUD(ship.lives, timeLeftMs(), score, multiplier, timeElapsed());
  shipDraw(ship, d);

  // Darken overlay: draw a filled rect pattern (checkerboard for "dim" effect)
  for (int y = PLAY_AREA_Y; y < SCREEN_H; y += 2) {
    for (int x = y % 4 == 0 ? 0 : 2; x < SCREEN_W; x += 4) {
      d.drawPixel(x, y, SSD1306_BLACK);
    }
  }

  // PAUSED text
  d.setTextSize(2);
  d.setTextColor(SSD1306_WHITE);
  d.setCursor(26, 28);
  d.print("PAUSED");

  displayFlip();

  // Double-click to resume
  if (inp.pauseTriggered) {
    setState(STATE_PLAYING);
    soundPlay(SFX_MENU_SELECT);
  }
}

static void updateDeathAnim() {
  Adafruit_SSD1306& d = displayGet();
  unsigned long elapsed = millis() - deathAnimStart;
  float progress = elapsed / (float)DEATH_ANIM_DURATION;

  d.clearDisplay();
  displayHUD(ship.lives, timeLeftMs(), score, multiplier, timeElapsed());

  // Draw explosion lines expanding from ship's last position
  float cx = ship.x;
  float cy = ship.y;
  for (int i = 0; i < 8; i++) {
    float angle = deathLines[i][0];
    float len = deathLines[i][1] * (1.0f + progress * 3.0f);
    int x1 = (int)(cx + cos(angle) * len * 0.3f);
    int y1 = (int)(cy + sin(angle) * len * 0.3f);
    int x2 = (int)(cx + cos(angle) * len);
    int y2 = (int)(cy + sin(angle) * len);
    d.drawLine(x1, y1, x2, y2, SSD1306_WHITE);
  }

  displayFlip();

  if (elapsed >= DEATH_ANIM_DURATION) {
    if (ship.lives > 0) {
      shipRespawn(ship);
      setState(STATE_PLAYING);
    } else {
      setState(STATE_GAME_OVER);
      soundPlay(SFX_GAMEOVER);
    }
  }
}

static void updateGameOver() {
  const InputState& inp = inputGet();
  Adafruit_SSD1306& d = displayGet();

  // One-time high score check on entering this state
  if (hsRank == -1 && !isNewHighScore) {
    timeSurvivedSec = (uint16_t)(timeElapsed() / 1000);
    highscoreIncrementPlayed();
    if (highscoreQualifies(score)) {
      isNewHighScore = true;
    }
  }

  d.clearDisplay();
  d.setTextSize(1);
  d.setTextColor(SSD1306_WHITE);

  if (gameOverPage == 0) {
    // ── Page 0: Score summary ──
    bool timeUp = timeLeftMs() == 0 && ship.lives > 0;

    if (timeUp) {
      d.setCursor(30, 5);
      d.print("TIME'S UP!");
    } else {
      d.setCursor(30, 5);
      d.print("GAME OVER");
    }

    d.setCursor(20, 18);
    d.printf("Score: %lu", (unsigned long)score);

    d.setCursor(20, 28);
    d.printf("Best streak: x%d", bestStreak);

    if (isNewHighScore) {
      if ((millis() / 400) % 2 == 0) {
        d.setCursor(12, 40);
        d.print("* NEW HIGH SCORE! *");
      }
      d.setCursor(10, 52);
      d.print("Input name (fire)");
    } else {
      // Scroll hint
      d.setCursor(4, 42);
      d.print("Push down for stats");
      if ((millis() / 500) % 2 == 0) {
        d.setCursor(10, 54);
        d.print("Fire to play again!");
      }
    }
  } else {
    // ── Page 1: Stats breakdown ──
    d.setCursor(30, 0);
    d.print("- STATS -");

    uint16_t survived = timeSurvivedSec;
    int accuracy = shotsFired > 0 ? (shotsHit * 100) / shotsFired : 0;

    d.setCursor(4, 14);
    d.printf("Destroyed: %d", asteroidsDestroyed);

    d.setCursor(4, 24);
    d.printf("Shots: %d", shotsFired);

    d.setCursor(4, 34);
    d.printf("Accuracy: %d%%", accuracy);

    d.setCursor(4, 44);
    d.printf("Survived: %d:%02d", survived / 60, survived % 60);

    d.setCursor(4, 54);
    d.print("Push up to go back");
  }

  displayFlip();

  // Joystick Y to scroll between pages
  if (inp.joyY > 0.4f && gameOverPage < 1) { gameOverPage = 1; soundPlay(SFX_MENU_SELECT); }
  if (inp.joyY < -0.4f && gameOverPage > 0) { gameOverPage = 0; soundPlay(SFX_MENU_SELECT); }

  // Fire button
  if (inp.firePressed) {
    soundPlay(SFX_MENU_SELECT);
    if (isNewHighScore) {
      setState(STATE_ENTER_INITIALS);
    } else {
      setState(STATE_COUNTDOWN);
    }
  }
}

// ── Initials entry screen ──

static unsigned long lastJoyInputMs = 0;
#define JOY_REPEAT_MS 200  // debounce for joystick scrolling

static void updateEnterInitials() {
  const InputState& inp = inputGet();
  Adafruit_SSD1306& d = displayGet();
  unsigned long now = millis();

  d.clearDisplay();
  d.setTextSize(1);
  d.setTextColor(SSD1306_WHITE);

  d.setCursor(15, 2);
  d.print("ENTER YOUR INITIALS");

  // Draw the 3 characters large
  d.setTextSize(3);
  for (int i = 0; i < 3; i++) {
    int cx = 20 + i * 35;
    d.setCursor(cx, 20);
    d.print(hsInitials[i]);

    // Underline the active character
    if (i == hsCharIdx) {
      d.drawLine(cx, 46, cx + 16, 46, SSD1306_WHITE);
      // Blink arrows
      if ((millis() / 300) % 2 == 0) {
        d.setTextSize(1);
        d.setCursor(cx + 4, 12);
        d.print("^");
        d.setCursor(cx + 4, 49);
        d.print("v");
        d.setTextSize(3);
      }
    }
  }

  d.setTextSize(1);
  d.setCursor(20, 56);
  d.print("Fire to confirm");

  displayFlip();

  // Joystick Y scrolls through A-Z, 0-9
  if (now - lastJoyInputMs >= JOY_REPEAT_MS) {
    if (inp.joyY < -0.4f) {
      // Up — next char
      char& c = hsInitials[hsCharIdx];
      if (c >= 'A' && c < 'Z')      c++;
      else if (c == 'Z')            c = '0';
      else if (c >= '0' && c < '9') c++;
      else if (c == '9')            c = 'A';
      lastJoyInputMs = now;
    } else if (inp.joyY > 0.4f) {
      // Down — prev char
      char& c = hsInitials[hsCharIdx];
      if (c > 'A' && c <= 'Z')      c--;
      else if (c == 'A')            c = '9';
      else if (c > '0' && c <= '9') c--;
      else if (c == '0')            c = 'Z';
      lastJoyInputMs = now;
    }
    // Joystick X moves to next/prev character slot
    if (inp.joyX > 0.5f && hsCharIdx < 2) {
      hsCharIdx++;
      lastJoyInputMs = now;
      soundPlay(SFX_MENU_SELECT);
    } else if (inp.joyX < -0.5f && hsCharIdx > 0) {
      hsCharIdx--;
      lastJoyInputMs = now;
      soundPlay(SFX_MENU_SELECT);
    }
  }

  // Fire confirms
  if (inp.firePressed) {
    uint16_t survived = (uint16_t)(timeElapsed() / 1000);
    hsRank = highscoreInsert(hsInitials, score, bestStreak, survived);
    soundPlay(SFX_STREAK_UP);
    setState(STATE_HIGH_SCORES);
  }
}

// ── High scores display ──

static uint8_t  hsFireClicks = 0;
static unsigned long hsFirstClickMs = 0;
#define HS_TRIPLE_WINDOW 800  // ms to land 3 clicks

static void updateHighScores() {
  const InputState& inp = inputGet();
  Adafruit_SSD1306& d = displayGet();
  unsigned long now = millis();

  d.clearDisplay();
  d.setTextSize(1);
  d.setTextColor(SSD1306_WHITE);

  d.setCursor(25, 0);
  d.print("HIGH SCORES");

  const HighScoreEntry* hs = highscoreGetTable();

  // Show top 5 (screen space is limited on 128x64)
  for (int i = 0; i < 5; i++) {
    int y = 12 + i * 10;
    d.setCursor(2, y);

    // Highlight the just-inserted rank
    if (i == hsRank) {
      if ((now / 300) % 2 == 0) {
        d.print(">");
      } else {
        d.print(" ");
      }
    } else {
      d.printf("%d", i + 1);
    }

    d.setCursor(12, y);
    d.printf("%.3s %6lu x%d", hs[i].initials, (unsigned long)hs[i].score, hs[i].maxStreak);
  }

  // Prompt
  if ((now / 500) % 2 == 0) {
    d.setCursor(18, 56);
    d.print("Fire to continue");
  }

  displayFlip();

  // Triple-click detection to clear history
  if (inp.firePressed) {
    if (hsFireClicks == 0 || now - hsFirstClickMs > HS_TRIPLE_WINDOW) {
      // Start new sequence
      hsFireClicks = 1;
      hsFirstClickMs = now;
    } else {
      hsFireClicks++;
      if (hsFireClicks >= 3) {
        // Triple click — clear all scores
        highscoreClear();
        soundPlay(SFX_GAMEOVER);
        hsFireClicks = 0;
        hsRank = -1;
        return;  // stay on screen to show cleared table
      }
    }
  }

  // Single click timeout — go back to menu
  if (hsFireClicks == 1 && now - hsFirstClickMs > HS_TRIPLE_WINDOW) {
    soundPlay(SFX_MENU_SELECT);
    hsFireClicks = 0;
    hsRank = -1;
    isNewHighScore = false;
    setState(STATE_MENU);
  }
}

// ── Public interface ───

void gameInit() {
  highscoreInit();
  shipInit(ship);
  asteroidsInit();
  bulletsInit();
  saucerInit();
  setState(STATE_SPLASH);
}

void gameUpdate() {
  switch (state) {
    case STATE_SPLASH:         updateSplash();         break;
    case STATE_MENU:           updateMenu();           break;
    case STATE_COUNTDOWN:      updateCountdown();      break;
    case STATE_PLAYING:        updatePlaying();        break;
    case STATE_PAUSED:         updatePaused();         break;
    case STATE_DEATH_ANIM:     updateDeathAnim();      break;
    case STATE_GAME_OVER:      updateGameOver();       break;
    case STATE_ENTER_INITIALS: updateEnterInitials();  break;
    case STATE_HIGH_SCORES:    updateHighScores();     break;
    case STATE_DEMO:           if (demoUpdate()) setState(STATE_MENU); break;
    default: break;
  }
}

GameState gameGetState() {
  return state;
}
