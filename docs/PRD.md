# Simple side-scrolling Asteroids

## Goal

A forgiving arcade game on a 128×64 OLED using the existing joystick and one fire button. Keep the action understandable at a glance: move in two dimensions, shoot right, dodge rocks approaching from the right.

## Gameplay

- Ship starts at x=12, faces right, and uses direct analog X/Y movement with no inertia. Clamp the whole ship within the playfield. Cap diagonal magnitude at one while preserving smaller analog deflections. Shots originate just ahead of the actual nose.
- Playfield below a 10-pixel HUD displaying lives, score, multiplier, and a compact chain-expiry underline.
- One shot per debounced fire press, no firing cooldown or automatic repeat; at most 12 bullets.
- Three lives; collisions cost one life, missed rocks cost none.
- Rocks move left with slight vertical drift and bounce vertically; exiting left removes them.
- Large → two medium → two small; fragments separate vertically and continue left.
- Base scores: 20, 50, 100. Start at x1; every three kills increase the multiplier by one, capped at x5. Award each destruction at the current multiplier, then advance the chain. Process simultaneous hits in bullet-pool index order; fragments count separately. Expire the chain after 3,000 ms without a kill and reset it on death/new run. Misses and escaped rocks do not immediately break it. Gameplay time freezes during pause/death animation. Cap the displayed and persisted score at 999,999. No time limit.
- Interpolate wave profiles between the anchors below; floor interpolated populations. Saturate the profile at wave 24 and saturate the wave counter at 65,535. Fragments inherit speed with an 8% increase per split.

| Wave | Speed (px/update) | Base spawn gap (ms) | Large rocks | Max vertical drift |
| --- | --- | --- | --- | --- |
| 1 | 0.34 | 2000 | 3 | 0.02 |
| 3 | 0.40 | 1800 | 4 | 0.03 |
| 4 | 0.42 | 1700 | 4 | 0.04 |
| 7 | 0.55 | 1400 | 5 | 0.06 |
| 8 | 0.57 | 1350 | 5 | 0.07 |
| 12 | 0.72 | 1100 | 6 | 0.09 |
| 13 | 0.74 | 1050 | 6 | 0.10 |
| 24+ | 0.85 | 900 | 8 | 0.12 |

- Choose spaced singles in waves 1–3; add alternating top/bottom heights from wave 4 and staggered pairs from wave 8. Pairs use the base gap between members and add 350 ms after each pair. Choose pattern and initial lane using the shared hardware random source. Show a wave cue for the first 800 ms.
- Before spawning, require three free rock slots and a clear entrance corridor with a 12-pixel margin beyond rock radii. Otherwise retry after 100 ms, preserving the telegraphed height and pending count. Schedule future gaps from the actual spawn time to avoid catch-up bursts.
- Wait 1.5 seconds after the last active/pending rock before the next wave. Preview the next entrance height with a small right-edge marker for 700 ms before its scheduled spawn, including the first rock of a run or wave. Warning timing freezes with gameplay.
- At pool capacity, a splitting hit leaves the parent intact until both children can fit; never silently lose a child.
- Search for a safe 2D respawn, preferring the starting left lane; if crowded, search left to right for sufficient clearance, falling back to the clearest sampled position. Retain two seconds of blinking protection. Pause and death animation freeze the world; brief particles continue during death.

## Flow and storage

Title (saved leader's initials and score, V3 rules, controls) → 1.5-second countdown → gameplay → qualifying initials entry → game over (final score and top five). Non-qualifying runs skip initials entry.

Double-click the joystick to pause/resume. Capture the final score once at the end of the last death animation. Freeze the completed run throughout name entry and game over. A nonzero score qualifies if there is space or it strictly beats fifth place. Sort descending, placing new equal scores after existing ties. Scores are bounded at 999,999.

Initials start at `AAA`, with exactly three A–Z letters and a terminator. Up/down cycles the active letter with wrapping; left/right selects a position, clamped at the ends. Use a 0.55 normalized deadzone and 250 ms navigation repeat. Highlight the active letter. Require fire release followed by a fresh press to confirm. Gameplay firing and pause are inactive here. Save only on confirmation; a storage error keeps entry active with an error hint and requires another release/press to retry. An unconfirmed result is lost on power-off. After saving, highlight the inserted row. Game-over retry requires release after a 400 ms guard and then a fresh press; confirmation cannot also retry.

Store the complete table in one Preferences blob under `asteroids/scores-v3`. Record version 1 uses 42 bytes: one version byte, one entry-count byte, then five slots of four little-endian score bytes and four initials bytes. Unused slots are zero. Validate exact length, version, count, nonzero bounded scores, descending order, uppercase letters, terminators, and empty slots. Missing/invalid data loads an empty table without writing. Check open/read/write results; update the in-memory table only after a successful complete write. Preserve legacy `magic`, `played`, `tbl`, `best-v2`, and `best-v3` keys without importing scores from them.

## Implementation and verification

Arduino C++ / PlatformIO, fixed-size entity pools, 50 Hz target update rate. Gameplay timers use simulation time so pausing cannot expire invincibility or advance waves. If the OLED/loop cannot sustain 50 Hz, simulation slows rather than skipping collisions.

Use horizontal segment-circle bullet collisions and bounded rock outlines. Keep particles brief and shake subtle. Reset transient entities between runs. Keep saucers, extra statistics, and demo absent until their planned tasks are implemented. Shared per-hit scoring is available to future powered-up weapons; the current game has ordinary single shots.

Build with `pio run`. Run `sh tests/run_host.sh` for host gameplay checks. Physical acceptance: check direction and neutral drift, rapid fire presses versus holding, legibility, comfortable dodge spacing, pause during invincibility, repeated retries, and confirmed leaderboard retention across reset and a power cycle. Initials/leaderboard host checks and firmware build cover implementation; physical OLED readability and flash persistence remain pending.


## Randomness and validation boundary

All randomized rock decisions use `rock_random_bounded` / `rock_random_range`,
backed directly by `esp_random()` with rejection sampling. The installed
Arduino core switches to software PRNG when `randomSeed` is called; that seed
call has been removed. Start station-mode Wi-Fi with auto-reconnect and modem
sleep disabled to keep the RF entropy source available, without calling
`WiFi.begin`, scanning, or connecting. Fail startup if initialization fails.
Do not enable the bootloader ADC entropy source during joystick reads.

Host tests substitute a deterministic source solely for reproducible checks.
They validate scoring, wave bounds, spawn deferral, pattern constraints, and
range rejection; they cannot establish physical entropy quality or gameplay
fairness. ESP32 checks must cover radio startup, ADC stability, frame rate,
multiplier readability, early/middle/late-wave dodge time, and persistence.
Heat and power-up interaction playtests remain pending those implementations.
