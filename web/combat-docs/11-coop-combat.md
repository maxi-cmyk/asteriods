# 11 · Co-op combat

Source: `native/coop.h`, hooks in `native/boss/core.h`, exports in `native/exports/coop.h`.

## The central trick: swap, don't duplicate

The firmware code uses single global state (`ship`, `score`, `bullets`, `combat`, `input_state`,
`score_state`, …). Rather than rewrite it for two players, co-op keeps a `CoopPlayer` per pilot and
**swaps** the globals in and out around existing single-player functions:

```
coop_load(owner):  ship = P.hull;  combat = P.weapons;  combat_input = P.actions;
                   input_state = P.input;  score_state = P.chain;  score = P.points;
                   run_destroyed = P.kills;  run_best_multiplier = P.best;  bullets = P.shots
coop_save():       the reverse for the fields combat may have changed
```

`CoopPlayer`: `hull`, `weapons` (CombatState), `actions`, `input`, `chain` (ScoringState), `shots[12]`,
`points`, `kills`, `best`, `respawn_at`, `boss_participation`, `boss_touched`, `laser_fired`.

The comment in the source is the rule: **shared legacy globals are a scratch context, never a second
world.** The world (rocks, pickup, boss, particles) exists once.

Always end a co-op update with `coop_load(0)` so the rest of the engine sees player 0.

## Per-tick order — `coop_update`

```
if PAUSED: return          if COUNTDOWN: advance on browser clock; return
game_ms += 20;  coop_tick++
reset boss_touched when a new boss wave begins
if !boss_controls_wave(2): asteroids_update          // players = 2 latched into the boss
for p in 0,1:  coop_respawn(p);  coop_weapons(p)     // movement, charge, fire events, bullets_update
coop_pickup_update()
coop_boss_update()                                   // boss_tick (no solo hit resolution)
coop_lasers()                                        // rocks, boss (bs_laser), teammate
coop_projectiles()                                   // bullets vs rocks / boss / teammate
rock vs ship for both pilots → coop_hit
particles, shake
both lives == 0 → GAME_OVER
coop_load(0)
```

### Fair ordering

Wherever two pilots could race (lasers, projectile impacts, pickup contest), the order is
`(i + coop_tick) % 2`, which alternates who goes first each tick. Respawn and weapon updates run in
fixed order 0, 1, which is safe because each only touches that pilot's own state. (As an analogy:
alternating the order is the permutation matrix `[[0, 1], [1, 0]]`, with eigenvalue +1 on the
team-sum direction `(1, 1)/√2` and −1 on the difference `(1, −1)/√2`; it squares to the identity,
so over two ticks each pilot goes first exactly once and the antisymmetric part cancels.) Pickups go to the
**nearest** alive pilot (ties by the alternating order).

## Shots and impacts — `coop_projectiles`

Not one bullet at a time per player, but a **global earliest-impact resolution**:

1. Snapshot which rocks exist ("originals") and their parents; build boss circles.
2. Up to `2 × BULLET_MAX` times: scan every active bullet of both players against boss circles
   (flag 1), original rocks, and (with friendly fire) the other pilot; pick the smallest entry time
   `t ≤ 1`; resolve that one impact (consume the bullet and apply its effect); repeat.
3. Because the scan repeats, a second bullet can proceed to its next target after the first one
   destroyed a rock, **but never to a fragment created this tick**.
4. Splits are applied after the loop (`split_asteroid(parent)`), and the loop tracks
   `pending_fragments` so a pool without room for both children rejects the hit like solo does.

(Closest approach is the midpoint of the two roots of the ray/circle quadratic and entry time is the
smaller root; 09 derives it.)

Entry-time (not closest-approach) ordering is deliberate: a friendly ship in front of a farther
enemy blocks the shot at high speed.

Friendly fire (`coop_friendly`, fixed per run): a bullet entering the other pilot's circle
(radius 7) calls `coop_hit(other)`; it awards **no score** and is not an enemy hit. Lasers likewise
test the teammate's circle.

## Damage in co-op — `coop_hit(owner)`

Same rule as `combat_ship_hit` (03), applied to that pilot's `CoopPlayer`: ignored while dead or
protected; shield → consumed + 800 ms; otherwise `ship_die`, `respawn_at = game_ms + 500`, charge and
beam cleared, stored shield lost, chain reset, **their bullets removed**. Differences from solo:
- Boss threats are **not** cleared on a death (the partner is still fighting).
- Only that pilot's pickups/chain are reset; `powerups_init()` is not called.
- The game ends only when **both** pilots have 0 lives.

## Respawn — `coop_respawn`

When `!alive`, `lives > 0` and `game_ms ≥ respawn_at`: start from `asteroid_safe_respawn`; if a boss
is active, search a grid (x from `SHIP_MIN_X` to 160 step 24, y step 16) for the spot with the best
**clearance** = the minimum of: distance to rocks, to boss body circles (minus radii), −1 if inside a
lethal hazard that goes live within 1500 ms, and distance to each boss shot minus 11. Then
`ship_respawn` (2000 ms protection).

## Boss in co-op

`coop_bind_boss()` points the boss at both hulls and installs hooks:

| Hook | Co-op version |
| --- | --- |
| `boss_hit_hook(i)` | `coop_hit(i)` |
| `boss_stat_hook(i)` | `coop_players[i].weapons.hits++` |
| `boss_award_hook(i, pts)` | credits `boss_participation` for pilots that touched the boss, then `coop_award(i, pts, true)` — the **killer** is paid |

- Health × 2 (`players = 2`, latched at `boss_begin`); caps (48 shots, 6 hazards) do not double.
- `bs_acquire` alternates pilots: first attack the nearer, then the farther, so neither can hide.
- `bs_nearest` (homing, live aiming) uses all alive pilots; a dead pilot is never a target.
- Hazards that affect pilots (`PULL`, `BURN`, lethal kinds) loop over both hulls.
- Roster is latched at start: a disconnect never changes `players` or boss health.

## Scoring in co-op

Each pilot has a separate `ScoringState`, so combos are independent. Awards go through
`coop_award(owner, …)` which `coop_load(owner)` → `combat_award` → `coop_save()`. Team score =
`points[0] + points[1]` (exported in the co-op snapshot).

## Exports (`exports/coop.h`)

| Function | Purpose |
| --- | --- |
| `web_coop_start(friendly)` | `coop_begin` — init both hulls (lives 3, y = 95 and 175), bind boss |
| `web_coop_input(owner, x, y, fire, aim_x, aim_y, laser, precision, shield)` | store inputs for that pilot |
| `web_coop_pause(pause)` | save and restore the pre-pause state and countdown remainder |
| `web_coop_player(owner)` | copy of the scene with that pilot loaded and the co-op header filled (version, id, respawn time, participation, team score, friendly fire, stats) |

JS asks for one scene per pilot (`web_coop_player(0|1)`); the renderer draws both ships from them.
