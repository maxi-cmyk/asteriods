# 01 · The tick, the states, the clocks

## Entry point

The host calls `web_step(raw_x, raw_y, fire, click, pause)` once per 20 ms tick
(`native/exports/game.h`). It does, in order:

1. `browser_ms += 20`. This clock advances on **every** step, including menus and pause.
2. If co-op is active: handle pause toggling, `coop_update()`, `sound_update()`, return (see 11).
3. Solo: clamp the raw stick to 0–4095, `input_update()` (firmware debounce), then override for
   the web: `fire_held = browser_fire`, `fire_pressed = browser_fire_edge || rising edge`, stick
   scaled to −1…1 (the radial deadzone is applied in JS before this).
4. `pause` forces `pause_triggered`.
5. `visual_ms += 20` while PLAYING / DEATH_ANIM / DEMO (animation clock only).
6. `combat_game_update()` (web) or `game_update()` (OLED build).
7. `sound_update()`.

`web_actions(aim_x, aim_y, laser, precision, shield)` sets `combat_input` before the step; it is
a separate call so the firmware `InputState` stays unchanged. Non-finite aim is zeroed.

## The two clocks

| Clock | Advances | Used for |
| --- | --- | --- |
| `browser_ms` (`millis()`) | every `web_step` | state timers: countdown, death animation, retry guard, menu idle |
| `game_ms` | `+20` per tick **only inside PLAYING** | everything in combat: cooldowns, chain window, boss timers, hazards |

Consequences: pausing, the countdown and the death animation all **freeze** `game_ms`, so boss
attacks, hazard timers and pickups pause exactly with the game, and dying does not advance the
fight while the death animation plays.

## States (`GameState`, `src/game.cpp`)

`MENU → COUNTDOWN → PLAYING ⇄ PAUSED`, `PLAYING → DEATH_ANIM → PLAYING | INITIALS | GAME_OVER`,
plus `DEMO` (autopilot). `set_state` stamps `state_entered_ms = millis()`.

| State | Duration / exit | Notes |
| --- | --- | --- |
| COUNTDOWN | 3 × 500 ms (browser clock) | entered by `begin_game()`; `combat_reset()` and `boss = {}` run when it is entered |
| PLAYING | until pause or death | the only state where combat runs |
| PAUSED | until pause toggled | stops sound; laser windup cancelled if the trigger is released |
| DEATH_ANIM | 500 ms (`DEATH_ANIMATION_MS`) | then respawn (lives left) or game over |
| INITIALS / GAME_OVER | player input | `RETRY_GUARD_MS` 400 before retry is accepted |

`begin_game()` resets: ship (3 lives), rocks (wave 1), bullets, particles, pickups, `score`,
`run_destroyed`, `run_best_multiplier`, scoring state, `game_ms = 0`.

## `combat_game_update` (web wrapper)

```
laser_pressed = laser_input && !laser_was_held   // rising edge
laser_was_held = laser_input
if state == PLAYING:  combat_update_playing(laser_pressed); display shake; flip
else:                 game_update()               // firmware handles menu/countdown/etc.
                      if COUNTDOWN just entered: combat_reset(); boss = {}
                      if PAUSED and laser released: charging = false
```

## Update order inside `combat_update_playing`

Order matters (it decides who wins ties within a tick):

| # | Step | Function |
| --- | --- | --- |
| 1 | Pause request → PAUSED, return | `input.pause_triggered` |
| 2 | `game_ms += 20` | |
| 3 | Chain expiry check | `scoring_update` |
| 4 | Aim direction | `combat_update_aim` |
| 5 | Move ship (precision scale) | `combat_move_ship` → `ship_update` (also counts down invincibility) |
| 6 | Pickups: timers, drift, collect; shield → stored; arm shield | `combat_collect_and_arm_shield` |
| 7 | Rocks: practice targets, or `asteroids_update`, skipped if `boss_controls_wave()` | |
| 8 | Laser cooldown/beam timers; start or finish windup; maybe discharge | `combat_update_laser` |
| 9 | CPS window, highest wave | `combat_update_cps` |
| 10 | Due 2× shots (queued 80 ms earlier) | `combat.pending_shots` |
| 11 | Primary fire on a fresh press (and queue a 2× echo) | `combat_primary_event` |
| 12 | Move bullets; bullets vs rocks (swept) | `bullets_update`, `bullets_check_asteroids` |
| 13 | Remove bullets that left the left edge | |
| 14 | Particles | `particles_update` |
| 15 | Rock vs ship | `combat_collisions` → `combat_ship_hit` |
| 16 | Boss, if active or in boss practice | `boss_update(laser_fired)` |

Notes:
- Bullets are resolved against **rocks first (12)**, boss targets last (16). A bullet that kills a
  rock in step 12 is gone before the boss sees it. This is why rocks in front of a boss shield it.
- Boss shots and hazards that hit the ship during step 16 call `combat_ship_hit` too; the same
  tick's rock collision (15) has already run.
- In the OLED/firmware build `update_playing` in `src/game.cpp` runs a simpler version (no aim, no
  laser, no boss).

## Entry points that start or reset a run (`exports/`)

| Export | Does |
| --- | --- |
| `web_start(practice)` | solo run; `boss_bind_solo()`, `begin_game()`, `combat_reset()`; practice spawns three dummy rocks and starts PLAYING with a stored shield |
| `web_boss_practice(kind, tier, phase)` | practice + `boss_begin_practice`; optional start phase with matching health |
| `web_coop_start(friendly)` | `coop_begin` (see 11) |
| `web_menu()` / `web_demo()` | back to menu / autopilot demo |
| `web_boss_assist(long, calm)` | sets `boss_assist_long` (+30% warnings) and `boss_assist_calm` |
