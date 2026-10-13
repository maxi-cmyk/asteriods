#include "highscore.h"
#include <Preferences.h>
static uint32_t best;
void highscoreInit() {
  Preferences prefs;
  prefs.begin("asteroids", true);
  best = prefs.getUInt("best-v2", 0);
  prefs.end();
}
uint32_t highscoreBest() { return best; }
bool highscoreRecord(uint32_t score) {
  if (score <= best) return false;
  best = score;
  Preferences prefs;
  prefs.begin("asteroids", false);
  prefs.putUInt("best-v2", best);
  prefs.end();
  return true;
}
