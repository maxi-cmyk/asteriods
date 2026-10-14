# Simple side-scrolling Asteroids

## Goal

A forgiving arcade game on a 128×64 OLED using the existing joystick and one fire button. Keep the action understandable at a glance: move in two dimensions, shoot right, dodge rocks approaching from the right.

## Gameplay

- Ship starts at x=12, faces right, and uses direct analog X/Y movement with no inertia. Clamp the whole ship within the playfield. Cap diagonal magnitude at one while preserving smaller analog deflections. Shots originate just ahead of the actual nose.
- Playfield below a 10-pixel HUD displaying lives and score.
- One shot per debounced fire press, no firing cooldown or automatic repeat; at most 12 bullets.
- Three lives; collisions cost one life, missed rocks cost none.
- Rocks move left with slight vertical drift and bounce vertically; exiting left removes them.
- Large → two medium → two small; fragments separate vertically and continue left.
- Scores: 20, 50, 100. No multiplier or time limit.
- Three large rocks in wave one; one extra every two waves, capped at six. Entrances staggered 1.8 seconds apart.
- Base speed 0.38 pixels/update, increasing 0.045 per wave to a cap of 0.83. Fragments inherit speed with an 8% increase per split.
- Wait 1.5 seconds after the last active/pending rock before the next wave. Preview the next entrance height with a small right-edge marker for 700 ms before its scheduled spawn, including the first rock of a run or wave. Warning timing freezes with gameplay.
- At pool capacity, a splitting hit leaves the parent intact until both children can fit; never silently lose a child.
- Search for a safe 2D respawn, preferring the starting left lane; if crowded, search left to right for sufficient clearance, falling back to the clearest sampled position. Retain two seconds of blinking protection. Pause and death animation freeze the world; brief particles continue during death.

## Flow and storage

Title (best score, controls, fire to start) → 1.5-second countdown → gameplay → game over (score, best, fire to retry).

Double-click the joystick to pause/resume. Game-over retry requires a release after a short guard period and then a fresh press. Best score is written once on entry to game over, only if improved. Store under `asteroids/best-v2`; retain old leaderboard data without modification because the scoring rules have changed.

## Implementation and verification

Arduino C++ / PlatformIO, fixed-size entity pools, 50 Hz target update rate. Gameplay timers use simulation time so pausing cannot expire invincibility or advance waves. If the OLED/loop cannot sustain 50 Hz, simulation slows rather than skipping collisions.

Use horizontal segment-circle bullet collisions and bounded rock outlines. Keep particles brief and shake subtle. Reset transient entities between runs. Remove saucers, multipliers, initials, extra statistics, demo, and related settings.

Build with `pio run`. Run `sh tests/run_host.sh` for host gameplay checks. Physical acceptance: check direction and neutral drift, rapid fire presses versus holding, legibility, comfortable dodge spacing, pause during invincibility, repeated retries, and best-score retention across a power cycle.
