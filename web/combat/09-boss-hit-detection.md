# 09 · Boss hit detection, damage and defeat

Source: `native/boss/hits.h`; kind hooks in `kinds.h`; per-kind `circles/soak/hit` in
`boss/fights/*.h`. Solo resolution is `boss_player_hits` in `lifecycle.h`; co-op in `coop.h` (11).

## Hit circles

Everything the player can hit is a **circle** rebuilt every time it is needed
(`bs_build_circles`, after `boss_tick`, and again after each hit):

```
boss_circle_count = 0
if boss inactive or phase == 0: stop
ops.circles()                                   // the kind's circles
for each active shootable shot: bs_circle(x, y, radius + 1.5, BC_SHOT, index, flags 3)
```

`BossCircle { x, y, r, type, index, flags }`, capacity `BOSS_CIRCLES = 112`
(extras are dropped silently).

| Type | Meaning | Effect on a hit |
| --- | --- | --- |
| `BC_CORE` | the real health target | damage through `soak` |
| `BC_BLOCK` | armour that stops shots | shot consumed, **no damage** |
| `BC_PART` | a sub-target (blade, panel, hardpoint, bubble, S-star) | `ops.hit(part, …)` |
| `BC_SHOT` | a shootable hostile projectile | reduce hp or end (07) |
| `BC_DEFLECT` | mirror | throws the shot / laser back (below) |

`flags`: bit 1 = player **bullets** can hit it, bit 2 = the **laser** can. `flags 3` is both;
`1` = bullets only (the laser passes through); `2` = laser only (a bullet stops at the block in
front instead). Examples: Cinderforge shell is `BLOCK flags 1` with the core `flags 2`, so shots
bounce off the shell but the laser pierces it; open vents add a `flags 3` core.

## Bullets: swept test, earliest entry

`bs_first_circle(x0, y0, x1, y1)` walks every circle with flag 1 and finds the **smallest entry
time** `t ∈ [0, 1]` of the bullet segment into the circle (ray/circle solve; a segment starting
inside a circle has `t = 0`). The circle with the smallest `t` is the one hit, so a part in front of
the core is hit first. Ties go to the circle emitted first.

Solo `boss_player_hits`:
```
if laser fired this tick: bs_laser(0)
bs_build_circles()
for each active bullet:
    i = bs_first_circle(prev → pos);  if none: continue
    bullet.active = false                     // consumed even by a BLOCK
    bs_circle_hit(i, owner 0, damage 1, laser=false)
    bs_build_circles()                        // parts may have changed
```

## `bs_circle_hit(index, owner, damage, laser)`

```
BLOCK   → return (bullet already spent)
DEFLECT → bs_deflect(c, owner, laser); return
boss_stat_hook(owner)                          // hit counter for accuracy
CORE    → bs_core_damage(owner, laser ? damage × k : damage, laser)
SHOT    → hp / end (07)
PART    → ops.hit(part, owner, damage, laser)
```

`damage` is **1 sub-hit per bullet** and **8 × k** for the laser (`bs_laser` passes 8, the core case
multiplies by `ops.k`) — i.e. the laser is always worth eight *design* hits.

## Soak and sub-targets

`bs_core_damage` = `bs_damage(owner, ops.soak(damage, laser))`. A `soak` returns the damage that gets
through:

| Boss | `soak` |
| --- | --- |
| Bastion | laser: all. Primary: while any hardpoint stands, `armor += damage × 0.5` and 1 damage passes per 2 hits (hull armour); once all fall, full damage |
| Cinderforge | laser at half (`damage / 2`) unless the shell is open |
| Tidecaller | a laser touching the bell **pops all three bubbles** first |
| Others | none (full damage) |

`ops.hit` handlers:
- **Ringwarden blade:** breaks, regrows after 6000 ms.
- **Cinderforge panel:** closed (state 0) loses `damage` hp (3); at 0 → broken (state 2, permanent).
  Open or broken panels instead forward `bs_core_damage(owner, 1)` to the core. Lasers do nothing.
- **Bastion hardpoint:** hp 6 (7 after a revive in phase 2); 0 → `exists = false`, shake.
- **Tidecaller bubble:** hp 2; a laser pops all three at once.
- **Warden S-star:** hp 5; 0 → gone.

## Damage, phases, defeat — `bs_damage`, `bs_defeat`

```
bs_damage(owner, n):
   ignore if inactive, phase 0, or n == 0
   touched[owner] = true;  flash_until = now + 80
   health -= n  (floor 0)
   if health > 0: next = bs_phase_for(health); if next > phase → advance (06); return
   bs_defeat(owner)
```

`bs_defeat`: see 05 for the payout and 06 for the wave release. The killer is the owner of the blow
that took health to zero; `boss.touched[]` feeds co-op participation.

## The laser against the boss — `bs_laser(owner)`

1. Rebuild circles.
2. If any `BC_DEFLECT` circle with flag 2 intersects the beam, deflect and **stop** (nothing behind
   a mirror is touched).
3. Otherwise every circle with flag 2 (not BLOCK) intersecting the beam is hit with
   `bs_circle_hit(i, owner, 8, true)`. The beam test is `bs_beam_hits`: perpendicular distance to
   the beam line ≤ `r + 2` for points ahead of the origin, distance to the origin for points behind;
   the circle centre must be on screen.
4. The laser works against everything on its line, not just the first circle: it **pierces**.

## Mirror — `bs_deflect` (Horizon Warden, phases 2–3)

A `BC_DEFLECT` circle (radius 104) replaces the core while the mirror is up. A hit:
- Finds the pilot that fired it (`owner`) or the nearest if gone.
- Rate limit per pilot: `deflect_at[slot]` — a shot may return at most every **260 ms**, the laser
  every **1500 ms**; others are absorbed.
- A shot becomes `SF_FAST` at speed 2.6 aimed at the pilot, spawned just outside the circle.
- The laser becomes an `HK_BEAM` hazard with the usual **900 ms warning** and 650 ms live — never an
  instant hit (fairness rule 2 holds).

## Body contact — `bs_contact`

`ops.body(out)` returns circles `(x, y, r)`; if a pilot overlaps any (`dist < r + 7`), `bs_hit_pilot`.
Bodies are separate from hit circles (the ship can be hurt by parts of the boss that cannot be
shot). A cloaked Warden or a blinking Lens Imp returns no body.
