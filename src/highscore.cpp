#include "highscore.h"
#include <Preferences.h>

static HighScoreEntry table[HS_MAX_ENTRIES];
static uint16_t gamesPlayed = 0;

// ── NVS: entire table stored as one blob for speed ──

static void saveAll() {
  Preferences prefs;
  prefs.begin("asteroids", false);
  prefs.putUChar("magic", HS_MAGIC);
  prefs.putUShort("played", gamesPlayed);
  prefs.putBytes("tbl", table, sizeof(table));
  prefs.end();
}

void highscoreInit() {
  Preferences prefs;
  prefs.begin("asteroids", true);

  uint8_t magic = prefs.getUChar("magic", 0);
  if (magic != HS_MAGIC) {
    prefs.end();
    memset(table, 0, sizeof(table));
    for (int i = 0; i < HS_MAX_ENTRIES; i++) {
      strcpy(table[i].initials, "---");
    }
    gamesPlayed = 0;
    saveAll();
    return;
  }

  gamesPlayed = prefs.getUShort("played", 0);
  prefs.getBytes("tbl", table, sizeof(table));
  prefs.end();
}

const HighScoreEntry* highscoreGetTable() {
  return table;
}

uint16_t highscoreGamesPlayed() {
  return gamesPlayed;
}

bool highscoreQualifies(uint32_t score) {
  if (score == 0) return false;
  return score >= table[HS_MAX_ENTRIES - 1].score;
}

int highscoreInsert(const char* initials, uint32_t score,
                    uint8_t maxStreak, uint16_t timeSurvived) {
  int rank = HS_MAX_ENTRIES;
  for (int i = 0; i < HS_MAX_ENTRIES; i++) {
    if (score >= table[i].score) {
      rank = i;
      break;
    }
  }
  if (rank >= HS_MAX_ENTRIES) return -1;

  // Shift lower entries down
  for (int i = HS_MAX_ENTRIES - 1; i > rank; i--) {
    table[i] = table[i - 1];
  }

  strncpy(table[rank].initials, initials, 3);
  table[rank].initials[3] = '\0';
  table[rank].score        = score;
  table[rank].maxStreak    = maxStreak;
  table[rank].timeSurvived = timeSurvived;

  saveAll();
  return rank;
}

void highscoreIncrementPlayed() {
  gamesPlayed++;
  Preferences prefs;
  prefs.begin("asteroids", false);
  prefs.putUShort("played", gamesPlayed);
  prefs.end();
}

void highscoreClear() {
  memset(table, 0, sizeof(table));
  for (int i = 0; i < HS_MAX_ENTRIES; i++) {
    strcpy(table[i].initials, "---");
  }
  gamesPlayed = 0;
  saveAll();
}
