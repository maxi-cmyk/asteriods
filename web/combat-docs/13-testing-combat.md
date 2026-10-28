# 13 · Testing combat

## Two wasm builds

`web/build.mjs` makes `dist/game.wasm` (served) and, with `--test`, `dist/test.wasm`
(`-DWEB_TEST`, never served — `serve.mjs` returns 404 for it). The test build adds these exports
(`native/exports/test.h`):

| Export | Purpose |
| --- | --- |
| `web_scenario(n)` | start a run, enter PLAYING, clear the rocks, then apply a preset: 1 multishot, 2 stored-style shield plus an overlapping rock, 3 one life and a rock on the ship, 5 mixed rocks and a pickup, 9+ ship mid-field with the spawner parked (17/18 double-fire pickup, 19/10 a rock ahead) |
| `web_test_boss(wave, players, health)` | start the boss/mini for `wave`; optionally set health |
| `web_test_boss_set(field, value)` | edit state: 0 damage, 1 health, 2 skip rest, 3/4 ship x/y, 5 invincibility, 6 reset Cinderforge window + part hp, 7 long warnings, 8 remove all parts |
| `web_test_boss_stats()` | 16 floats: violations, max shots, max hazards, entrance hits, min corridor, hits taken, health, phase, defeated mask, kind, life lost, maximum |
| `web_test_boss_body()` | count + (x, y, r) triples of the body circles |
| `web_test_coop(owner, field, value)` | edit a co-op player (position, lives, effects, force a hit, spawn a rock …) |
| `web_test_pickup(kind)`, `web_test_overlap()` | put a pickup on the ship / put a small rock on the ship |

Fairness counters live in `BossState` itself (`violations`, `max_shots`, `max_hazards`,
`entrance_hits`, `min_corridor`, `spawn_in_body`) and are also in the scene (12), so the browser
tests and the bot can read them too. `min_corridor` is computed only under `WEB_TEST`
(it scans 9 lines every tick).

## Seeded runs

Tests build the runtime with an injected linear-congruential `random`, so every attack, drop and
spawn is repeatable:

```js
let state = seed;
createRuntime(bytes, { random: () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) });
```

Different seeds explore different attack orders (the boss tests run kinds with seeds `100 + kind`).

## `tests/boss.test.mjs` — what is asserted

| Test | Rule |
| --- | --- |
| wave → boss, health, tier mapping | `bs_kind_for`, `bs_tier_for`, health formula, `K` table |
| entrance harmless, then the body hurts | fairness rule 1 |
| Sentinel only damaged while plates are open | gate circles |
| laser is one 8-point hit and cannot repeat on a hold | 02 |
| dying never resets the boss; threats cleared; return protected | rule 6 |
| flawless pays +50%, a lost life pays the base | 05 |
| mini shares its wave and holds it open | 06 |
| practice and a fresh retry inherit nothing | `boss = {}` resets |
| practice never costs a life | `combat_ship_hit` |
| multishot + 2× accounting while hitting the boss | 02 |
| stored shield absorbs a lance; holds do not repeat | 03 |
| assists: +30% warnings, calm lens | 06 |
| boss pickups once per phase boundary | `bs_pickups` |
| **every fight keeps its promises** (all 12 kinds × tiers 0–2, bot-driven) | violations 0, ≤ 48 shots, ≤ 6 hazards, entrance hits 0, corridor ≥ 42, body left edge ≥ x 215, beaten within 150 s |
| tiers shorten rests, tier 2 adds the frenzy | `bs_rest_scaled`, `bs_phase_for` |
| per-boss mechanics (Ringwarden blades, Cinderforge panels and fire, Bastion hardpoints, Tidecaller bubbles, Warden plates, mirror, cloak, full attack gallery) | 10 |
| shootable projectiles (missile 2 hp, lob split, mine, spore) | 07 |
| boss practice from a later phase | `start_phase` |
| Ringwarden drops a shield every 7 s | `bs_timed_shield` |

Other relevant suites: `combat.test.mjs` (aim, fire, laser, shield, precision), `coop.test.mjs`
(ordering, friendly fire, respawn, attribution), `stats-powerup.test.mjs` (pickups, CPS, accuracy),
`runtime.test.mjs`, and the goldens (`scene-golden`, `render-golden`, `sound-golden`).

## The boss bot (`tests/boss-bot.mjs`)

A scripted pilot that reads **only the scene** (the same data a player's screen shows):
- chooses the sub-target a person would (open window, part, bubble, star …),
- avoids every shot, every lethal hazard (including ones in warning), and the body circles,
- fires at a human rate (about 6 shots/s, perfect aim) with careful dodging.

It proves a fight is **beatable**, measures its length, and drives the fairness test. It is not a
speed-run; people take about 1.5× as long. After any attack change, re-run the bot and record the
new clear times (`nextSteps.md` S0.1).

**Exercise: PCA of the bot's movement.** The bot's `(x, y)` per tick is a cloud of points. Centre it
(`Xc = X − mean`), form the 2×2 covariance `C = XcᵀXc/(n − 1)`, and take its eigenvectors: the first
axis is the direction the pilot uses most, and `λ₁/λ₂` says how one-dimensional the dodging is. Do
the same on bullet impact points on a boss for the aim spread. Predict the axis before you run it.
(`RunRecorder` stores results only, so log positions from the scene in a test.) Not run.

## How to add a test for a new attack

1. Use `practiceGame(kind, tier, seed)` and `until(game, …)` to reach the phase (or
   `web_boss_practice(kind, tier, phase)` to start there).
2. Step ticks (`game.step(input)`); read `bossHazards(scene)`, `bossShots(scene)`, `bossParts(scene)`
   from `src/boss/scene.mjs`.
3. Assert the warning (`warn_total ≥ 900`), the geometry, the projectile count and the end time.
4. Run the all-fights fairness test; it must stay green.
5. If scene output changes, regenerate goldens and read the diff.

## Commands

```bash
cd web && npm run build && npm test            # builds both wasm files, runs every suite
cd web && node --test tests/boss.test.mjs      # one suite
sh tests/run_host.sh                           # portable C17 core + firmware host tests (UBSan)
```
