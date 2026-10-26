# 05 · Scoring, chain and boss payouts

Source: `src/core/scoring.c` (portable C17), `src/scoring.cpp`, `award_asteroid_score` in
`src/game.cpp`, `combat_award` in `native/combat.h`, `bs_defeat` in `native/boss/hits.h`.

## The chain (portable core)

`ScoringState { multiplier, chain_kills, chain_active, last_kill_ms }`.

| Rule | Value |
| --- | --- |
| Multiplier range | 1…5 (`MULTIPLIER_MAX`) |
| Kills to raise it | 3 (`KILLS_PER_MULTIPLIER`), counted only while below the cap |
| Chain window | 3000 ms (`SCORE_CHAIN_WINDOW_MS`) from the last scoring kill |
| Expiry | `score_update` resets the whole state when the window has passed |

`score_award(state, base, game_ms)`:
1. `score_update` (expire an old chain first).
2. `base == 0` → return 0.
3. `awarded = base × multiplier` — **uses the multiplier before this kill advances it**.
4. `last_kill_ms = game_ms`, `chain_active = true`.
5. If below the cap: `chain_kills++`; on the 3rd kill `multiplier++`, `chain_kills = 0`.

Death calls `scoring_reset()`. Pausing freezes `game_ms`, so it freezes the window.

`src/scoring.cpp` wraps one global `score_state`; co-op keeps one `ScoringState` per player and
swaps it in and out (11).

## Awarding points (web)

```
combat_award(base):                       // every rock hit, laser kill and boss payout
   if base > 0: update combat.chain / longest_chain (separate display stat, same 3 s window)
   award_asteroid_score(base):
       if base > 0: run_destroyed++
       awarded = scoring_award(base, game_ms)
       run_best_multiplier = max(.., multiplier)
       score += min(awarded, 999999 − score)        // hard cap
```

So **bosses advance the chain**, score through the current multiplier, and count toward
`run_best_multiplier`. `boss_award_solo` compensates by `run_destroyed--` so boss kills are not
counted as asteroid kills (they have `boss.kills` and `defeated_mask`).

Base values: large 20, medium 50, small 100 (`asteroid_points`). Splitting means one large rock is
worth 20 + 2×50 + 4×100 = 520 base if all fragments are destroyed.

## Boss payouts (`bs_defeat`)

```
if !boss.practice:
   mini:  base = 400 + 100 × (kind % 6)
   boss:  base = 1500 + 250 × min(10, wave / 5)          // integer division
   if !boss.life_lost: base = base × 3 / 2               // flawless, integer
   boss_award_hook(owner, base)                          // → combat_award (through the multiplier)
```

| Boss | Wave | Base | Flawless |
| --- | --- | --- | --- |
| Sentinel | 5 | 1750 | 2625 |
| Ringwarden | 10 | 2000 | 3000 |
| Cinderforge | 15 | 2250 | 3375 |
| Bastion | 20 | 2500 | 3750 |
| Tidecaller | 25 | 2750 | 4125 |
| Horizon Warden | 30 | 3000 | 4500 |

Multiply by the multiplier at the moment of the kill (up to ×5). The 250-step stops growing at
wave 50 (`min(10, …)`). Minis: 400, 500, 600, 700, 800, 900 base.

`life_lost` is a latch set when total lives drop below the count at the fight's start; a shield hit
keeps the fight flawless (03).

## Where each stat ends up

| Stat | Source | Used by |
| --- | --- | --- |
| `score`, `run_destroyed`, `run_best_multiplier`, `run_prior_best` | `game.cpp` globals | Results, Records |
| `combat.hits/spawned/laser_*`, `chain`, `longest_chain`, `peak_cps` | `CombatState` | accuracy, CPS, chain stats |
| `boss.kills`, `defeated_mask`, `hits_taken` | `BossState` | Results "Defeated: …", unlock toast |

Accuracy counts consumed projectiles that hit; the laser does not count as a projectile.

## Planned: maximum-combo bonus (see `nextSteps.md` S2)

It would extend `score_award` in the core (bonus when already at ×5 *before* the event) so the
handheld shares it, plus a co-op assist rule in `coop.h`. Not implemented.
