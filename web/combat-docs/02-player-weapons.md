# 02 · Player weapons and movement

Source: `native/combat.h`, `src/bullet.cpp`, `src/ship.cpp`. Constants: `native/config.h`.

## Aim and movement

- **Aim** (`combat_update_aim`): `combat_input.aim` (−1…1). If its length exceeds
  `AIM_DEADZONE = 0.25`, `combat.aim` becomes the normalised vector; otherwise the **last aim
  is kept**. Movement never changes aim.
- **Move** (`combat_move_ship`): stick vector divided by `max(1, length)` (full diagonals are not
  faster), times `PRECISION_SPEED_SCALE = 0.5` when `combat_input.precision`. Then `ship_update`
  adds `× SHIP_MAX_SPEED (3.65625)` per tick, clamps to bounds, and counts down
  `invincible_left`.
- The web speed is 25% below the OLED-proportional value (comment in `native/config.h`).

## Primary fire

Trigger: a **fresh press** (`input.fire_pressed`, a rising edge made in `web_step`). Holding does
nothing. No heat or cooldown.

```
combat_primary_event()
  combat_fire_volley():
     remember which of the 12 bullet slots are free
     bullets_fire(muzzle = ship + aim * SHIP_BULLET_OFFSET (13), multishot?)
     for each newly activated slot: rotate its velocity by the aim vector   // spread follows aim
  if fired: primary_volleys++, weapon_shot_succeeded, sound
  else:     primary_pool_blocked++   // event is DROPPED, never queued
```

`bullets_fire` (`src/bullet.cpp`):
- Looks for up to 3 free slots among `BULLET_MAX = 12`. None free → returns false.
- Straight bullet: velocity `(BULLET_SPEED 18.75, 0)` before rotation.
- Multishot (pickup active **and** 3 free slots): two more bullets with vertical component
  `±2.8125` and horizontal `sqrt(18.75² − 2.8125²)`, so all three keep speed 18.75 and the side
  shots fly about 8.6° off-axis. With fewer than 3 free slots it fires the single straight shot
  (atomic allocation, no partial volleys).

## Bullet motion and collisions

- `bullets_update`: `previous = position; position += velocity`.
- Collision is a **swept segment** `previous → position` against circles (never "point in
  circle"), so an 18.75 px/tick bullet cannot tunnel through a 6 px rock.
- Rocks: `find_bullet_hit` picks the **earliest** circle entry on the segment (entry time
  `t ∈ [0,1]`, shots that start inside a circle have `t = 0`).
- Boss targets use the same maths (`bs_first_circle`, see 09).
- Off-screen cleanup: `bullets_check_asteroids` clears bullets with `x ≥ SCREEN_W` or `y` outside;
  `combat_update_playing` clears `x < 0`.
- Hits call `combat_primary_hit` once per consumed bullet: `combat.hits++` then `combat_award`.

## 2× fire (the third pickup)

`ship.effects.double_fire_left_ms` (6000 ms). On a fresh press while it is active, a second event is
queued: the first free slot in `combat.pending_shots[8]` gets `due = game_ms + 80`. Each tick, any
slot with `game_ms >= due` is cleared and fires one `combat_primary_event` — unless a charge is in
progress or the laser fired this tick (then `primary_laser_blocked++`). At 50 Hz at most four
events can wait at once, so 8 slots always suffice. A queued echo is dropped on death (`memset`).

## Laser

State: `charging`, `charge_started_ms`, `cooldown_left_ms`, `beam_left_ms`, `beam_x/y`,
`beam_direction_x/y`, `laser_was_held`. Constants: windup 1500 ms, cooldown 5000 ms, beam
display 400 ms.

Each playing tick (`combat_update_laser`):
1. `cooldown_left_ms` and `beam_left_ms` count down by 20.
2. A **press edge** with `cooldown_left_ms == 0` sets `charging = true` and `charge_started_ms`.
3. If charging and the trigger is released → `charging = false`, **no cooldown** is charged.
4. If charging and `game_ms − charge_started_ms ≥ 1500` → `combat_fire_laser()`.

`combat_fire_laser`: cooldown ← 5000, beam display ← 400, beam origin = `ship + aim * 13`,
direction = aim, then `combat_destroy_laser_targets()`:

- A rock is hit when `rock.radius + 2` reaches the beam line: for points ahead of the origin
  (`along ≥ 0`) the perpendicular distance must be ≤ `radius + 2`; behind, distance to the origin.
  The rock centre must be on screen.
- Every hit rock is destroyed **outright** (no fragments, even if the pool is full), gives normal
  score through `combat_award`, and rolls a pickup drop.
- The boss gets `boss_update(laser_fired = true)` later in the same tick (see 09).

Rules that fall out of the code:
- Holding L2 after discharge cannot repeat: `laser_was_held` must clear first (new press edge).
- Primary fire is suppressed while `charging` or on the tick the laser fires.
- Pause freezes everything (the update only runs while PLAYING); releasing the trigger while
  paused cancels the windup. Death cancels windup and beam but **the cooldown persists**.
  `combat_reset()` (new run) clears the cooldown; it sets `laser_was_held` to the current input so
  a trigger held from a menu must be released before charging.

## Shield (manual)

- Picking up a shield sets `ship.effects.shield`; `combat_collect_and_arm_shield` immediately moves
  it to `combat.shield_stored = true` and clears the effect (only one stored).
- A `combat_input.shield` edge arms it: `ship.effects.shield = true`, `shield_stored = false`.
- Consumption is in `combat_ship_hit` (see 03). Holding both shoulders (precision) does not use
  the shield; the browser side only sends the shield edge on L1 release alone.

## Statistics kept (`CombatState`)

`primary_presses`, `primary_volleys`, `primary_pool_blocked`, `primary_laser_blocked`, `spawned`
(bullets), `hits`, `laser_shots`, `laser_kills`, `chain`, `longest_chain`, `highest_wave`,
`cps`/`peak_cps` (ring of 64 press times over the last second). Read by `web_stats` for Results.

## Practice mode

`practice_mode` swaps the rock spawner for three fixed dummy rocks (re-spawned 1500 ms after they
are all gone), stores a shield permanently, and tracks `practice_goals` bits: 1 moved, 2 aimed,
4 fired, 8 laser, 16 shield. `combat_ship_hit` returns early in practice, so no life is lost.
