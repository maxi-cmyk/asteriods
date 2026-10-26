#pragma once

// Region bosses and mini-bosses (design: nextSteps.md, Part A).
//
// One BossState holds the live fight. Solo and co-op drive the same code:
// `boss_hulls` points at the pilots, `boss_hit_hook` damages a pilot and
// `boss_award_hook` pays the defeat score. Every fight is a script of attacks
// (warn -> live -> rest) that spawn hostile shots, telegraphed hazards and
// shootable parts. All timing comes from `game_ms`; all randomness from the
// run's seeded generator, so tests and replays agree.
//
// Fairness rules enforced here (and measured by the test build):
//   1 the entrance is harmless; 2 a lethal hazard always has its warning;
//   3 a 42 px safe corridor exists; 4 at most 48 shots / 6 hazards;
//   6 dying never resets the boss; 7 the body stays in the right 55%.


#include "boss/core.h"
#include "boss/kinds.h"
#include "boss/hazards.h"
#include "boss/shots.h"
#include "boss/hits.h"
#include "boss/scheduler.h"
#include "boss/lifecycle.h"
#include "boss_fights.h"
