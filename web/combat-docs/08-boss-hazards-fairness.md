# 08 · Boss hazards, telegraphs and the fairness rules

Source: `native/boss/hazards.h`, constructor `bs_hazard` and helpers in `core.h`.

## The pool

`BossHazard boss.hz[10]` (`BOSS_HAZARDS`). Fields: `active`, `kind`, geometry floats `x, y, a, b, c,
d, e`, and timers `warn_total`, `warn_left`, `live_left` (ms).

`bs_hazard(kind, x, y, a, b, c, warn, live)`:
- Refuses (returns `nullptr`) a **lethal** hazard if 6 lethal ones are already alive
  (`BOSS_LETHAL_CAP`), or if no slot is free.
- With `boss_assist_long`, `warn × 13/10`.
- Records `boss.max_hazards` (lethal high-water mark).

## Kinds and what each float means

| Kind | Lethal | x, y | a | b | c | d | e | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `HK_LANE` | yes | origin | angle | length | half-width | – | – | rectangular strip |
| `HK_BEAM` | yes | origin | current angle | – | – | angular speed/tick | end angle (unused in hit) | length fixed 520, half-width 5, sweeps |
| `HK_ARM` | yes | pivot | angle | length | – | angular speed/tick | – | tendril; half-width `5 + 0.3·shipR` |
| `HK_POOL` | yes | centre | – | – | radius | – | – | plasma pool; becomes scorch |
| `HK_RING` | yes | centre | gap centre angle | radius | half-gap angle | radius change/tick | gap spin/tick | thin band, 4 + 0.6·shipR; inside the gap is safe |
| `HK_TELL` | no | centre | – | radius | – | – | – | pulsing floor ring (area warning) |
| `HK_ARC` | no | origin | angle | half-width angle | length | – | – | dotted wedge (spread warning) |
| `HK_AIM` | no | origin | angle | length | – | – | – | thin aim line (aimed-shot warning) |
| `HK_PULL` | force | centre | – | pull px/tick | – | – | – | drags every pilot toward the centre |
| `HK_BURN` | hurts | centre | – | – | radius | timer P1 | timer P2 | scorched ground |

`bs_lethal_kind(k)` is `k ≤ HK_ARM` (lane, pool, beam, ring, arm).

## Geometry test — `bs_hazard_hits(h, px, py, r)`

- **Lane / beam / arm:** rotate the pilot into the hazard frame (`along`, `across`); hit when
  `0 ≤ along ≤ length` and `|across| < half-width + r`.
- **Pool:** `dist² < (c + r)²`.

#### The geometry test as a projection

For a unit vector `u`, the orthogonal projector onto `span(u)` is `P = uuᵀ`: `Px = (u·x)u`, `P² = P`,
`Pᵀ = P`, rank 1, eigenvalues `{1, 0}`. `bs_hazard_hits` computes, with `d = p − origin`:

```
[along ]   [ ca  sa ] [dx]       ca, sa = cos h.a, sin h.a
[across] = [−sa  ca ] [dy]  =  R(−a)·d
```

- `along = d·u` is the scalar projection onto the hazard axis; `across = d×u` is the signed length of
  the rejected part `(I − P)d`.
- In that frame the lane is an **axis-aligned box**, so the test is two interval checks. The rotation
  is a change of basis that makes the problem trivial, which is what an eigenbasis does: it is the
  eigenbasis of the hazard's projector, `P = R(a)·diag(1, 0)·R(a)ᵀ`, with `along` on the `λ = 1` axis
  and `across` on the `λ = 0` axis.
- The lane ends use the ship's centre; only the sides add the ship radius `r`.
- The ring is the exception: it needs `‖d‖` and the angle of `d` relative to the gap centre
  (`bs_atan2`, `bs_wrap`), i.e. polar coordinates, which are nonlinear.
- Naming trap: an orthogonal projector is idempotent and singular. A renderer's "projection matrix"
  (12) is generally invertible and not idempotent.
- **Ring:** `|dist − b| < 4 + 0.6 r` **and** the angle to the pilot differs from the gap centre by at
  least `c` (inside `c` is the safe gap).

## Timeline per tick — `bs_hazards_update`

```
for each active hazard:
   if warn_left > 0:                     // warning phase: harmless
        warn_left -= 20
        if it just reached 0 and lethal and warn_total < bs_warn_min(kind): boss.violations++
        if no live time: deactivate
        continue
   if live_left <= 20:  deactivate  (a POOL leaves scorched ground: radius × .85, 6000 ms)
   live_left -= 20
   beam/arm: a += d              ring: b += d; a += e; if shrinking and b < 32: b = 32, d = 0
   pull:  (unless calm) move each alive pilot `b` px toward the centre, clamped to bounds
   burn:  per pilot: outside → timer = 500; inside → timer -= 20; at <= 0: timer = 800 and bs_hit_pilot
   lethal kinds: bs_hit_pilot(p) for every alive pilot overlapping
```

- Minimum warnings (`bs_warn_min`): **900 ms** for every lethal kind, **700 ms** for rings.
- A lethal hazard calls the hit hook on **every tick** it overlaps a pilot. What stops one lance from
  costing several lives is the protection after a hit (03): a shield hit grants 800 ms
  (`SHIELD_PROTECTION_MS`), a respawn grants 2000 ms (`SHIP_INVINCIBLE_MS`), and a dead ship is
  not `alive`, so `bs_alive` skips it.

## Scorched ground — `bs_scorch(x, y, r, live, warn)`

A burn hazard. At most **three** live at once: a fourth replaces the one with the least `live_left`.
First burn 500 ms after stepping in, then every 800 ms. Created by: pool death (r × 0.85, 6 s),
shot-down lob (r 13, 3 s, 900 ms visible warning), geyser base (r 12, 4.5 s).

## Fairness rules and how each is enforced

| # | Rule | Enforced by | Verified by |
| --- | --- | --- | --- |
| 1 | The entrance is harmless for 1.4 s | `boss_tick` returns before shots, hazards, contact while `phase == 0` | `entrance_hits == 0` |
| 2 | A lethal hazard always has its warning | every attack passes `warn ≥ 900` (rings 700); `violations` counts any that go live short | `violations == 0` |
| 3 | A safe path ≥ 42 px wide always exists | design of attacks; `bs_corridor()` measures it | `min_corridor ≥ 42` (test build) |
| 4 | At most 48 shots, 6 lethal hazards | pool sizes and `BOSS_LETHAL_CAP` | `max_shots ≤ 48`, `max_hazards ≤ 6` |
| 5 | First attack of a fight is the simplest | `SEQ_*` rows start with the easiest attack | review |
| 6 | Dying never resets the boss | `combat_ship_hit` clears threats only | `boss.test.mjs` |
| 7 | Body stays in the right 55% | each `home_x` and motion range | `boss.test.mjs`: body left edge ≥ x 215 (the left 45% of 480) |

### The corridor metric — `bs_corridor()`

Scans four vertical lines (`x = 40, 100, 160, 220`, y from 16 to 248) and five horizontal rows
(`y = 45, 90, 135, 180, 225`, x from 16 to 464) in 2 px steps. A sample is blocked if any lethal
hazard **within 1000 ms of going live** (or live) would hit a ship-sized circle there. The longest
free run plus the ship diameter (14) is the corridor; the maximum over all lines is returned. Only
the test build records the minimum over a fight.

## Respawn awareness (co-op)

`coop_respawn` rejects spots inside a lethal hazard (warning ≤ 1500 ms, ship radius + 6) and within
11 px of any shot, and prefers the largest clearance from body circles (11).
