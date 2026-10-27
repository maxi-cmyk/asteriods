# 04 · Asteroids, waves, pickups

Source: `src/asteroid.cpp`, `src/core/difficulty.c`, `src/difficulty.cpp`, `src/powerup.cpp`,
`web/native/bridge.cpp` (HD difficulty wrapper).

## Rock pool

`Asteroid rocks[ASTEROID_MAX = 24]`. Fields: position, velocity, `angle`, `rotation_speed`,
`offsets[8]` (outline), `size`, `radius`, `active`.

| Size | Web radius | Base points |
| --- | --- | --- |
| Large | 16 | 20 |
| Medium | 10 | 50 |
| Small | 6 | 100 |

`spawn_asteroid` takes the first free slot (no slot → silently nothing). Outline offsets are
`−random(0..range)` so the drawn shape never exceeds the collision circle.

## Waves

State: `wave_number`, `pending_asteroids`, `next_spawn_ms`, `wave_difficulty`, `wave_pattern`,
`spawned_in_wave`, `pattern_top_first`, `waiting_for_next_wave`, `wave_cleared_ms`.

`prepare_wave(now)`:
1. `wave_difficulty = difficulty_for_wave(wave_number)` — on the web this wraps the OLED curve and
   multiplies `speed` and `drift` by **3.75** (`bridge.cpp`).
2. `pending_asteroids = population`.
3. `wave_pattern = random(0 … pattern_level)`; `pattern_top_first = random bit`.
4. First spawn at `now + SPAWN_WARNING_MS (700)`; `pending_spawn_y` chosen now so the edge marker
   can warn 700 ms ahead.

`update_wave`: when nothing is pending **and** no rock is active, wait `recovery_ms (1500)`, then
`wave_number++` and `prepare_wave`.

### Difficulty curve (`core_difficulty_for_wave`)

Anchors, linearly interpolated, held at the wave-24 row afterwards (speed here is the OLED value;
multiply by 3.75 for the web):

| Wave | Speed | Spawn gap ms | Large rocks | Max drift |
| --- | --- | --- | --- | --- |
| 1 | 0.34 | 2000 | 3 | 0.02 |
| 3 | 0.40 | 1800 | 4 | 0.03 |
| 4 | 0.42 | 1700 | 4 | 0.04 |
| 7 | 0.55 | 1400 | 5 | 0.06 |
| 8 | 0.57 | 1350 | 5 | 0.07 |
| 12 | 0.72 | 1100 | 6 | 0.09 |
| 13 | 0.74 | 1050 | 6 | 0.10 |
| 24 | 0.85 | 900 | 8 | 0.12 |

`pattern_level`: 0 below wave 4, 1 from 4, 2 from 8, 3 from 12. Population is floored.

### Spawning (`spawn_pending_asteroid`)

Spawns only when `now ≥ next_spawn_ms`, at least `SPAWN_MIN_FREE_SLOTS = 3` slots are free, and
`spawn_corridor_clear()` (no rock closer than `radius + radius + 12` in both axes to the entry
point). Otherwise it retries every 100 ms (`SPAWN_RETRY_MS`) — pending rocks are never lost.

- Size: from wave 6, every 4th spawn (`spawned_in_wave % 4 == 3`) is **small and 1.45× faster**.
- Entry: `x = SCREEN_W + radius`, `y = pending_spawn_y`, `vx = −speed`, `vy = random(±drift)`.
- Height by pattern (`choose_spawn_height`): 0 anywhere; 1 and 2 alternate a 5 px band at the
  top and bottom (order from `pattern_top_first`); 3 three fixed lanes (±2 px) in order.
- Spacing: base `spawn_interval_ms`; pattern 2 pairs / pattern 3 triples use 2/3 of it (not below
  700 ms) between members, then add `PAIR_RECOVERY_MS = 350` after the last member.

### Movement

`move_asteroid`: add velocity, spin, bounce off top/bottom (clamped with 1 px gap, `vy` flips),
deactivate once `x + radius < 0` (no penalty for escaped rocks).

## Bullet vs rock

`asteroids_hit_segment` → `find_bullet_hit` (earliest swept entry). Then:
- If the parent is not small and **no slot is free** the hit is **rejected** (returns 0, bullet
  keeps flying) so a split can never fail halfway.
- Otherwise: parent removed, particles, sound, shake for large, and (if not small)
  `split_asteroid`: two children one size down, spawned at `y ∓ child radius`, `vx ×1.08`,
  `vy = ∓0.18`. Then the destroy hook rolls a pickup drop and the points are returned.

Laser kills skip splitting (see 02). Co-op resolves splits after all of a tick's impacts (11).

## Pickups (`src/powerup.cpp`)

One `pickup` slot (no second one while one is on screen).

- **Drop:** `powerups_drop(x, y)` on every destroyed rock: if no pickup is active and
  `random(100) < 10`, spawn at the rock's position (clamped to ship bounds). Kind is uniform over
  `{multishot, shield, double fire}` (web) or `{multishot, shield}` (OLED).
- **Motion:** `x −= PICKUP_SPEED (1.125)` per tick; disappears when `x + 6 < 0`.
- **Collect:** circle overlap of pickup radius 6 and ship radius 7 while alive.
  Multishot: `multishot_left_ms = 6000`. Double fire: `double_fire_left_ms = 6000`. Shield: stored
  (web) or armed (OLED). A 400 ms cue (`PICKUP_CUE_MS`) is shown at the collection point.
- **Clearing:** `powerups_init()` on death/new run empties the slot.
- **Boss pickups:** guaranteed drops at `(SCREEN_W − 24, random 70…200)`: shield when a boss
  enters phase 2, multishot at phase 3 (`bs_pickups`, one each per fight via `boss.drops` bits);
  Ringwarden also drops a shield every 7 s. Mini-bosses drop nothing. See 06.

## Who owns the wave while a boss lives

`boss_controls_wave()` (06) returns true to stop `asteroids_update`. A full boss clears rocks and
`pending_asteroids` and keeps the spawner off until `BOSS_RECOVERY_MS (1200)` after its defeat; a
mini-boss halves the pending rocks and holds the wave open (a fake pending rock far in the future)
so rocks and the mini share the field.
