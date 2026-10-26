# 06 · Boss framework

Source: `native/boss/core.h` (types, pools, helpers), `kinds.h` (ops adapters), `lifecycle.h`
(setup/entrance/tick), `scheduler.h` (attack sequencing), `ops.h` (kind table). Fights live in
`boss/fights/*.h` (10). Included in this order by `native/boss.h` (a unity build, so order matters).

## Data

### `BossState boss` (one global, one live fight)

| Group | Fields |
| --- | --- |
| Identity | `active`, `mini`, `practice`, `kind` (0–11), `tier`, `wave`, `players` |
| Health | `health`, `maximum` (in **sub-hits**), `kills`, `defeated_mask` (bit per kind) |
| Phase | `phase` (0 = entrance, then 1…4), `phase_started`, `start_phase` (practice) |
| Time | `born`, `defeated`, `flash_until` (hit flash 80 ms) |
| Position | `x,y`, `home_x,home_y`, `target_x,target_y` (the pilot the current attack aims at) |
| Attack | `atk` (id, 0 = resting), `atk_t0`, `rest_until`, `seq`, `seq_total`, `cycle` |
| Free state | `aux[16]` (exported to the UI), `scratch[8]` (this attack's random picks), `stamp[6]` (private timestamps) |
| Pools | `shots[48]`, `hz[10]`, `parts[32]` |
| Bookkeeping | `touched[2]`, `killer`, `life_lost`, `lives_at_start`, `drops`, `shield_at`, `deflect_at[2]`, `hold`, `armor`, `hits_taken` |
| Test counters | `violations`, `max_shots`, `max_hazards`, `entrance_hits`, `min_corridor`, `spawn_in_body` |

Constants: `BOSS_ENTRANCE_MS 1400`, `BOSS_RECOVERY_MS 1200`, `BOSS_SHOTS 48`, `BOSS_HAZARDS 10`,
`BOSS_LETHAL_CAP 6`, `BOSS_PARTS 32`, `BOSS_CIRCLES 112`.

### `BossOps` — how a kind differs

The framework never switches on `kind`; each kind supplies one row (`BOSS_OPS[]` in `ops.h`).

| Field | Meaning |
| --- | --- |
| `home_x, home_y` | resting position after the entrance |
| `k` | **sub-hits per design hit** (`BOSS_K`); primary shot = 1 sub-hit, laser = 8 × k |
| `phases` | phases before the tier-2 frenzy |
| `cut[2]` | health % where phases 2 and 3 start (0 = none) |
| `rest[3]` | rest between attacks in phases 1, 2, 3+ (ms) |
| `begin` | create parts/state at the start (nullable) |
| `update` | passive motion each tick (also during the entrance) |
| `pick` | next attack id, 0 = none |
| `run(id, t)` | advance an attack; `t` = ms since it began; returns true when over |
| `circles` | emit hit circles for player shots (09) |
| `body` | contact circles hurting the ship (x, y, r triples) |
| `phase(n)` | a new phase began (nullable) |
| `soak(damage, laser)` | armour in front of the core (nullable) |
| `hit(part, owner, damage, laser)` | a sub-target was hit (nullable) |

`kinds.h` wraps each in `bs_kind_*` helpers (`bs_kind_rest` picks `rest[min(phase,3) − 1]`).

## Creating a fight

Waves: `boss_wave_is_boss(w)` = `w ≥ 3` and `w % 5 ∈ {0, 3}`. `bs_kind_for(w)`:
`w % 5 == 0` → boss `(w/5 − 1) % 6`; else mini `BK_PICKET + ((w − 3)/5) % 6`.
`bs_tier_for(w)` = `(w/5 − 1)/6` for boss waves, `((w−3)/5)/6` for minis.

`bs_setup(kind, tier, players, wave, practice)` (keeps `kills` and `defeated_mask`, resets the rest):

```
mini:  base = 6 + 2 × region                       (region = kind % 6)
boss:  base = 18 + 6 × (min(10, wave/5) − 1)
practice boss: base = 18 + 6 × region
tier ≥ 1: base = base × 12 / 10
maximum = base × players(1…2) × ops.k ;  health = maximum
```

Example: Sentinel wave 5 solo: `18 × 3 = 54` sub-hits. Warden wave 30 solo: `48 × 4 = 192`.

`boss_begin(players)` (called from `boss_controls_wave` the first tick of a boss wave):
- full boss: `pending_asteroids = 0`, rocks cleared, `waiting_for_next_wave = false`.
- mini: `pending_asteroids` halved (rounded up), `boss.hold = true`.

`boss_controls_wave(players)` is the spawner gate called from `combat_update_playing`:
returns true (rocks off) while a full boss is active or within `BOSS_RECOVERY_MS` of its defeat.
A mini keeps the wave open by inserting a fake pending rock (`next_spawn_ms = now + 1,000,000`) once
nothing else is pending; `bs_defeat` releases it (`pending_asteroids = 0`).

## Per-tick: `boss_tick` (only if `boss.active`)

```
life_lost = lives_total < lives_at_start
if phase == 0:   entering = bs_entrance();  ops.update();  if entering: return   // harmless
else:            ops.update();  bs_scheduler();  bs_pickups()
bs_shots_update();  bs_hazards_update();
bs_contact()            // body vs ship
(test build) record min corridor
```

`bs_entrance`: for 1400 ms the body slides in from `home_x + 160` with a quadratic ease-out; no
attacks, shots, hazards or contact run (rule 1, "the entrance is harmless"). On completion:
`phase = start_phase` (1 normally), `x,y = home`, `rest_until = now + 500`.

Then `boss_player_hits(laser_fired)` (09) resolves the player's weapons against this tick's circles.

## Phases

`bs_phase_for(health)`: start at 1; +1 for each `cut[i]` with `health × 100 ≤ cut × maximum`;
tier ≥ 2 full bosses jump to `phases + 1` (the **frenzy**) at ≤ 15%.

| Boss | phases | cut | rest ms (p1/p2/p3+) | k |
| --- | --- | --- | --- | --- |
| Sentinel | 2 | 60 | 950 / 800 / 800 | 3 |
| Ringwarden | 3 | 66, 33 | 1200 / 1100 / 1000 | 6 |
| Cinderforge | 3 | 66, 33 | 900 / 750 / 650 | 7 |
| Bastion | 2 | 50 | 1300 / 1000 / 1000 | 5 |
| Tidecaller | 3 | 70, 35 | 800 / 700 / 520 | 5 |
| Horizon Warden | 3 | 70, 35 | 1000 / 850 / 700 | 4 |
| Picket / Shardling / Cinderling / Gunnery / Moonjelly / Lens Imp | 1 | – | ~900–1300 flat | 5 / 8 / 5 / 8 / 8 / 6 |

On a phase change (`bs_damage`): `phase_started = now`, `seq = 0`, `rest_until = now + 700`,
`ops.phase(n)`, shake; phase ≥ 2 also calls `bs_pickups`. Phases only go **up**.

`bs_pickups`: not for minis. Phase 2 → one shield, phase 3 → one multishot, each once per fight
(`drops` bits), only if no pickup is on screen. Ringwarden replaces the phase-2 shield with a timed
shield every 7000 ms (`bs_timed_shield`).

## The scheduler (`bs_scheduler`)

```
if no attack running:
     wait until game_ms >= rest_until
     id = ops.pick();  if id == 0: rest_until = now + 500; return
     atk = id; atk_t0 = now; seq++; seq_total++; cycle++; bs_acquire()
if ops.run(atk, game_ms − atk_t0):     // attack finished
     atk = 0;  rest_until = now + bs_rest_scaled(ops.rest[phase])
```

Key idioms:
- **`bs_at(t, ms)`** is true for exactly one tick (`ms ≤ t < ms + 20`). Attacks are `run` every
  tick with `t` a multiple of 20, so `if (bs_at(t, 700)) fire();` fires once. A time that is not a
  multiple of 20 still fires on the first tick at or after it.
- Attack functions are re-entered each tick and keep **no local state**; anything remembered goes
  in `aux`, `scratch` or `stamp`.
- `bs_acquire` chooses the **target pilot**: one pilot alive → that one; two alive → the nearer on
  odd `seq_total`, the farther on even (so the first attack of a fight targets the nearer).
- Attack sequences are `BossRow`s `{count, id…}` per phase; `bs_seq_pick` cycles
  `(seq − 1) % total`. **Tier ≥ 1** appends the next phase's last attack to each row.
- `bs_rest_scaled`: tier ≥ 1 → ×0.85; tier ≥ 2 in the frenzy → ×0.7.
- `bs_density(n)`: tier ≥ 2 → `(5n + 3)/4` (×1.25 projectile counts).

## Defeat (`bs_defeat`, in 09)

`active = false`, `kills++`, `defeated_mask |= 1 << kind`, release a mini's hold, clear all threats
and parts, pay the score (05), particles, sound, shake. The 1200 ms recovery is enforced by
`boss_controls_wave`.

## Practice

`boss_begin_practice(kind, tier, players)` sets a plausible `wave_number`, `practice = true`
(no award, no life loss via `combat_ship_hit`), clears rocks. `start_phase` and a matching health
(`bs_phase_health`) let practice begin in a later phase.

## Assists and tiers (flags and rules)

| Setting | Effect |
| --- | --- |
| `boss_assist_long` | every hazard warning × 1.3 (`bs_hazard`) |
| `boss_assist_calm` | no gravity pull, Lens shots do not curve |
| Tier 1 (waves 35–60) | health × 1.2, rests × 0.85, +1 attack per row |
| Tier 2 (65–90) | density × 1.25, frenzy phase at 15% |
| Tier 3+ (95+) | same as 2; the renderer adds quasi-star / pulsar / magnetar scenery |
