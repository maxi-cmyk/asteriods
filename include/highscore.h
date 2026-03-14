#pragma once
#include <Arduino.h>

#define HS_MAX_ENTRIES 10
#define HS_MAGIC       0xA5

struct HighScoreEntry {
  char     initials[4];   // "ABC\0"
  uint32_t score;
  uint8_t  maxStreak;     // highest multiplier reached
  uint16_t timeSurvived;  // seconds
};

// Call once in setup() — loads from NVS or initialises defaults
void highscoreInit();

// Returns pointer to sorted table (index 0 = highest score)
const HighScoreEntry* highscoreGetTable();

// Returns total games played
uint16_t highscoreGamesPlayed();

// Check if a score qualifies for the top 10
bool highscoreQualifies(uint32_t score);

// Insert a new entry (shifts lower scores down). Saves to NVS.
// Returns the rank (0–9) where it was placed.
int highscoreInsert(const char* initials, uint32_t score,
                    uint8_t maxStreak, uint16_t timeSurvived);

// Increment games-played counter and save
void highscoreIncrementPlayed();

// Reset all high scores to defaults
void highscoreClear();
