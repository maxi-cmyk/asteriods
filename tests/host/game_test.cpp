#include <cassert>
#include <iostream>
#include "../../src/asteroid.cpp"
#include "../../src/bullet.cpp"
#include "../../src/ship.cpp"
#include "../../src/particle.cpp"
#include "../../src/highscore.cpp"
#include "../../src/game.cpp"
static Adafruit_SSD1306 screen;
Adafruit_SSD1306& displayGet() { return screen; }
void displayHUD(uint8_t, uint32_t) {}
void displayFlip() {}
void displayShake(uint8_t) {}
void displayShakeUpdate() {}
void soundPlay(SoundFX) {}
void soundStop() {}
static void tick(unsigned long ms = 20) { fakeMillis += ms; inputUpdate(); gameUpdate(); }
static void fire(bool down) {
  fireRawHigh = !down;
  tick(); tick();
}
int main() {
  // A segment crossing a small rock hits even if neither endpoint is inside.
  asteroidsInit(); memset(rocks, 0, sizeof(rocks));
  spawn(52, 35, AST_SMALL, -0.4f, 0);
  assert(asteroidsHitBullet(45, 60, 35) == SCORE_SMALL);
  assert(asteroidActiveCount() == 0);
  // Nearest target consumes the bullet, leaving a farther target untouched.
  spawn(70,35,AST_SMALL,-0.4f,0); spawn(50,35,AST_SMALL,-0.4f,0);
  assert(asteroidsHitBullet(40,80,35) == SCORE_SMALL);
  assert(rocks[0].active && !rocks[1].active);
  // Splitting preserves both children; a full pool leaves the parent intact.
  memset(rocks,0,sizeof(rocks)); spawn(60,35,AST_LARGE,-0.4f,0);
  assert(asteroidsHitBullet(40,70,35) == SCORE_LARGE);
  assert(asteroidActiveCount()==2 && rocks[0].y != rocks[1].y);
  for (int i=2;i<ASTEROID_MAX;++i) spawn(100,35,AST_SMALL,-0.4f,0);
  assert(asteroidsHitBullet(50,65,rocks[0].y)==0);
  assert(asteroidActiveCount()==ASTEROID_MAX);
  // Escaped rocks complete waves and difficulty remains capped.
  asteroidsInit();
  for (unsigned long t=20;t<60000;t+=20) asteroidsUpdate(t);
  assert(asteroidWave()>1 && waveSpeed()<0.831f);
  wave=65535; assert(waveSpeed()<0.831f);
  // Movement stops on release and clamps inside the display.
  Ship s; shipInit(s);
  for(int i=0;i<100;++i) shipUpdate(s,-1);
  assert(s.y>=HUD_HEIGHT+SHIP_RADIUS);
  float y=s.y; shipUpdate(s,0); assert(s.y==y);
  for(int i=0;i<100;++i) shipUpdate(s,1);
  assert(s.y+SHIP_RADIUS<SCREEN_H);
  // Rapid presses shoot without a cooldown; the pool still has a hard bound.
  bulletsInit();
  for(int i=0;i<BULLET_MAX;++i) assert(bulletsFire(18,35));
  assert(!bulletsFire(18,35));
  // Input edges: holding does not repeat, bounce does not shoot, release rearms.
  inputInit(); gameInit();
  fireRawHigh=false; tick(); fireRawHigh=true; tick();
  assert(gameGetState()==STATE_MENU);
  fire(true); assert(gameGetState()==STATE_COUNTDOWN);
  tick(1600); assert(gameGetState()==STATE_PLAYING);
  tick();
  int count=0; for(const auto& b:bullets) count+=b.active;
  assert(count==0); // button held across countdown does not auto-fire
  fire(false); fire(true);
  count=0; for(const auto& b:bullets) count+=b.active;
  assert(count==1);
  for(int i=0;i<5;++i) tick();
  count=0; for(const auto& b:bullets) count+=b.active;
  assert(count==1);
  fire(false); fire(true);
  count=0; for(const auto& b:bullets) count+=b.active;
  assert(count==2);
  // Pause freezes simulation time, invincibility, and asteroid movement.
  setState(STATE_PAUSED);
  unsigned long frozenTime=gameMs, inv=ship.invincibleLeft;
  float rockX=rocks[0].x;
  for(int i=0;i<100;++i) tick();
  assert(gameMs==frozenTime && ship.invincibleLeft==inv && rocks[0].x==rockX);
  // Respawn chooses the clearest position along the ship's vertical lane.
  memset(rocks,0,sizeof(rocks)); spawn(SHIP_X,20,AST_LARGE,-0.4f,0);
  assert(asteroidSafeRespawnY()>40);
  // Death records best exactly once and holding fire cannot retry.
  ship.lives=0; score=100; setState(STATE_DEATH_ANIM); tick(600);
  assert(gameGetState()==STATE_GAME_OVER && highscoreBest()==100);
  int writes=Preferences::writes;
  for(int i=0;i<100;++i) tick();
  assert(Preferences::writes==writes && gameGetState()==STATE_GAME_OVER);
  fire(false); fire(true); assert(gameGetState()==STATE_COUNTDOWN);
  assert(score==0 && ship.lives==LIVES_START);
  highscoreInit(); assert(highscoreBest()==100);
  assert(!highscoreRecord(50) && Preferences::writes==writes);
  // A single joystick click is not pause; the second click triggers once.
  clickRawHigh=false; fakeMillis+=20; inputUpdate(); fakeMillis+=20; inputUpdate();
  assert(!inputGet().pauseTriggered);
  clickRawHigh=true; fakeMillis+=20; inputUpdate(); fakeMillis+=20; inputUpdate();
  clickRawHigh=false; fakeMillis+=20; inputUpdate(); fakeMillis+=20; inputUpdate();
  assert(inputGet().pauseTriggered);
  fakeMillis+=20; inputUpdate(); assert(!inputGet().pauseTriggered);
  // Further low-scoring runs reset cleanly and do not rewrite the best.
  for (int run=0;run<3;++run) {
    ship.lives=0; score=10; setState(STATE_DEATH_ANIM); tick(600);
    assert(gameGetState()==STATE_GAME_OVER && highscoreBest()==100);
    fire(false); tick(500); fire(true);
    assert(gameGetState()==STATE_COUNTDOWN && score==0 && ship.lives==3);
  }
  assert(Preferences::writes==writes);
  std::cout << "Host gameplay checks passed\n";
}
