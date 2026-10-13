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
static GameState state;
static Ship ship;
static unsigned long entered, gameMs;
static uint32_t score;
static bool newBest, retryReady;
static void setState(GameState s) { state = s; entered = millis(); }
static void beginGame() {
  shipInit(ship); asteroidsInit(); bulletsInit(); particlesInit();
  score = 0; gameMs = 0; newBest = false;
  setState(STATE_COUNTDOWN);
}
static void drawWorld() {
  auto& d = displayGet();
  asteroidsDraw(d); bulletsDraw(d); particlesDraw(d); shipDraw(ship, d);
  // Draw HUD last so effects never obscure the score.
  d.fillRect(0, 0, SCREEN_W, HUD_HEIGHT, SSD1306_BLACK);
  displayHUD(ship.lives, score);
}
static void label(int x, int y, const char* text, int size = 1) {
  auto& d = displayGet(); d.setTextSize(size); d.setCursor(x,y); d.print(text);
}
void gameInit() {
  highscoreInit(); setState(STATE_MENU);
}
GameState gameGetState() { return state; }
void gameUpdate() {
  const auto& in = inputGet();
  auto& d = displayGet();
  d.clearDisplay(); d.setTextColor(SSD1306_WHITE); d.setTextSize(1);
  switch (state) {
    case STATE_MENU:
      label(10, 5, "ASTEROIDS", 2);
      d.setTextSize(1); d.setCursor(25, 27); d.printf("BEST %lu", (unsigned long)highscoreBest());
      label(4, 41, "Up/down: move"); label(4, 52, "Fire to start");
      if (in.firePressed) { soundPlay(SFX_MENU_SELECT); beginGame(); }
      break;
    case STATE_COUNTDOWN: {
      unsigned long elapsed = millis()-entered;
      int n = 3-int(elapsed/500);
      if (n > 0) { d.setTextSize(3); d.setCursor(55,22); d.print(n); }
      else { setState(STATE_PLAYING); }
      break;
    }
    case STATE_PLAYING:
      if (in.pauseTriggered) { soundStop(); setState(STATE_PAUSED); drawWorld(); break; }
      gameMs += FRAME_TIME_MS;
      shipUpdate(ship, in.joyY);
      asteroidsUpdate(gameMs);
      if (in.firePressed && bulletsFire(ship.x+6, ship.y)) soundPlay(SFX_SHOOT);
      bulletsUpdate(); score += bulletsCheckAsteroids(); particlesUpdate();
      if (!ship.invincibleLeft && asteroidHitsShip(ship.x, ship.y)) {
        shipDie(ship); particlesSpawn(ship.x, ship.y); soundPlay(SFX_DEATH);
        displayShake(3); setState(STATE_DEATH_ANIM);
      }
      drawWorld();
      break;
    case STATE_PAUSED:
      drawWorld();
      d.fillRect(17, 24, 95, 30, SSD1306_BLACK);
      label(28, 26, "PAUSED", 2); label(19, 45, "Double-click joy");
      if (in.pauseTriggered) setState(STATE_PLAYING);
      break;
    case STATE_DEATH_ANIM:
      particlesUpdate(); drawWorld();
      if (millis()-entered >= 500) {
        bulletsInit();
        if (ship.lives) { shipRespawn(ship, asteroidSafeRespawnY()); setState(STATE_PLAYING); }
        else {
          newBest = highscoreRecord(score); retryReady = false;
          soundStop(); soundPlay(SFX_GAMEOVER); setState(STATE_GAME_OVER);
        }
      }
      break;
    case STATE_GAME_OVER:
      label(10, 4, "GAME OVER", 2);
      d.setTextSize(1); d.setCursor(15, 25); d.printf("SCORE %lu", (unsigned long)score);
      d.setCursor(15, 36); d.printf("BEST  %lu", (unsigned long)highscoreBest());
      if (newBest) label(15, 46, "NEW BEST!");
      label(15, 56, "Fire to retry");
      if (!in.fireHeld && millis()-entered >= 400) retryReady = true;
      if (retryReady && in.firePressed) beginGame();
      break;
  }
  displayShakeUpdate(); displayFlip();
}
