# Combat engine internals

Reference for how combat works in the C++ engine. `../COMBAT.md` is the player-facing
rulebook (what the rules are); these files say **which function does it, in what order, with what
numbers**. Source of truth is always the code; every file names the functions it describes.

Read order: 01 → 02 → 03 → 06 → 07 → 08 → 09 for the solo path, then 11 for co-op.

| File | Aspect | Main source |
| --- | --- | --- |
| [01-tick-and-states.md](01-tick-and-states.md) | The per-tick loop, game states, the two clocks, update order | `src/game.cpp`, `native/combat.h`, `native/exports/game.h` |
| [02-player-weapons.md](02-player-weapons.md) | Aim, movement, primary fire, multishot, 2× fire, laser, shield | `native/combat.h`, `src/bullet.cpp` |
| [03-ship-damage-lives.md](03-ship-damage-lives.md) | The hit rule, shield, invincibility, death, respawn | `src/ship.cpp`, `combat_ship_hit` |
| [04-asteroids-waves-pickups.md](04-asteroids-waves-pickups.md) | Rock pool, spawner, difficulty curve, splitting, pickups | `src/asteroid.cpp`, `src/core/difficulty.c`, `src/powerup.cpp` |
| [05-scoring-combo.md](05-scoring-combo.md) | Chain, multiplier, boss payouts, flawless | `src/core/scoring.c`, `combat_award`, `bs_defeat` |
| [06-boss-framework.md](06-boss-framework.md) | `BossState`, `BossOps`, lifecycle, phases, scheduler, tiers | `native/boss/core.h`, `lifecycle.h`, `scheduler.h`, `kinds.h` |
| [07-boss-projectiles.md](07-boss-projectiles.md) | Hostile shot pool, families, motion, endings | `native/boss/shots.h` |
| [08-boss-hazards-fairness.md](08-boss-hazards-fairness.md) | Lanes, beams, rings, pools, telegraphs, the fairness rules | `native/boss/hazards.h` |
| [09-boss-hit-detection.md](09-boss-hit-detection.md) | Hit circles, sweeps, damage, soak, deflect, defeat | `native/boss/hits.h` |
| [10-boss-fight-scripts.md](10-boss-fight-scripts.md) | Each boss and mini-boss: numbers and attack timelines | `native/boss/fights/*.h` |
| [11-coop-combat.md](11-coop-combat.md) | The load/save context swap, ordering, friendly fire | `native/coop.h` |
| [12-combat-in-the-scene.md](12-combat-in-the-scene.md) | What combat state the UI can see, aux slots | `native/scene.h`, `src/runtime/scene-layout.mjs` |
| [13-testing-combat.md](13-testing-combat.md) | Test hooks, the boss bot, fairness counters | `native/exports/test.h`, `tests/boss*.mjs` |

## Conventions used everywhere

- **Playfield** (web, `WEB_HD`): 480 × 270 px, origin top-left, y grows down. The 128 × 64 OLED
  build uses `include/config.h` unchanged; `native/config.h` overrides sizes for the web.
- **Tick** = 20 ms (`FRAME_TIME_MS`). All speeds in this folder are **px per tick** unless a
  unit says otherwise (3.66 px/tick = 183 px/s).
- **`game_ms`** advances 20 ms per playing tick and is the only clock combat reads (see 01).
- **Ship**: radius 7 (`SHIP_RADIUS`), max speed 3.65625, bounds x 16–464, y 16–248.
- **Angles** are radians, 0 = +x (right), π/2 = +y (down), π = left (toward the player).
- **Pools** are fixed arrays; there is no allocation. A full pool silently drops a spawn.
- **`static` globals in one translation unit.** `bridge.cpp` includes the firmware `.cpp` files
  and the web headers into one unit, so `rocks`, `bullets`, `ship`, `score`, `boss` and friends
  are plain globals shared by every file. Co-op works by swapping them (see 11).
- **Name prefixes:** `combat_*` player combat (web), `coop_*` co-op, `bs_*` boss helpers,
  `boss_*` boss entry points, `web_*` exported to JS.
- **Determinism:** randomness comes only from `rock_random_bounded` / `bs_rand`; see
  `../../DESIGN-DECISIONS.md` card 3 for what "same game" requires.

## One-page call graph (solo, playing)

```
web_step ─► combat_game_update ─► combat_update_playing
              │                      ├─ scoring_update, aim, move, pickups/shield
              │                      ├─ asteroids_update      (or boss_controls_wave: boss owns the wave)
              │                      ├─ laser update, 2× fire queue, primary fire
              │                      ├─ bullets_update ─► bullets_check_asteroids ─► combat_primary_hit ─► combat_award
              │                      ├─ particles_update, combat_collisions ─► combat_ship_hit
              │                      └─ boss_update
              │                           ├─ boss_tick: entrance|update+scheduler+pickups, shots, hazards, contact
              │                           └─ boss_player_hits: laser (bs_laser) then bullets vs circles (bs_circle_hit)
              └─ (other states) game_update   (firmware state machine)
```
