# 07 · Boss projectiles

Source: `native/boss/core.h` (types, spawn helpers), `native/boss/shots.h` (update, endings).

## The pool

`BossShot boss.shots[48]` (`BOSS_SHOTS`). Fields:

| Field | Meaning |
| --- | --- |
| `active`, `family` | alive flag, `ShotFamily` |
| `hp` | player hits to destroy (shootable families only) |
| `link` | index of a hazard this shot is tied to (lobs → their pool), −1 none |
| `x,y` | position; `bx,by` sine baseline; `dx,dy` velocity per tick |
| `turn` | rad/tick (curve) or turn limit (missile) |
| `amp, phase` | sine amplitude (px) and phase (rad) |
| `born`, `life` | spawn `game_ms`, lifetime ms (0 = until it leaves the field) |

**Spawn:** `bs_shot(family, x, y, dx, dy, hp, life)` returns the first free slot, or `nullptr` if all
48 are in use — **a full pool drops the shot silently**, so callers that link shots to hazards check
the pointer (`bs_lob`). `bs_shot_at(family, x, y, angle, speed, …)` converts angle/speed with
`cosf/sinf`. `boss.max_shots` records the high-water mark for tests.

## Families

Radius is used for both ship collision (`radius + 7`) and the shootable circle (`radius + 1.5`).

| Family | Radius | Shootable | Typical speed | Behaviour |
| --- | --- | --- | --- | --- |
| `SF_NEEDLE` | 2 | no | 1.8–2.2 | straight |
| `SF_SHARD` | 3 | no | 1.6 | straight, slow wall (Ringwarden, Warden burst) |
| `SF_BOLT` | 3 | no | 3.0 | straight, always after a 500 ms aim line |
| `SF_SINE` | 4 | no | 1.6–2.2 | baseline moves straight; offset perpendicular by `amp·sin(2π·age/700 + phase)` |
| `SF_PELLET` | 2.5 | no | 1.45–1.7 | straight (walls, spirals) |
| `SF_MISSILE` | 4 | yes, hp 2 | 1.4 | homing: each tick turns toward the nearest pilot by at most `turn` (0.04) and keeps speed 1.4; life 4000 |
| `SF_MINE` | 5 | yes, hp 1 | −0.8 drift | straight slow; life 2000 then bursts |
| `SF_LOB` | 5 | yes, hp 1 | arc, 1200 ms | harmless in the air; ends at its marker |
| `SF_SPORE` | **18** | yes, hp 1 | 1.0–1.15 | big and slow; life ~2000–2300 then bursts |
| `SF_EMBER` | 2 | no | 1.0–2.4 | straight (lob split, vents, ember fan) |
| `SF_CURVE` | 2.5 | no | 2.0 | velocity vector rotated by `turn` each tick |
| `SF_FAST` | 3 | no | 2.6 | straight, used for pick-offs and deflections |

Every speed is below the ship's 3.66 so running always works (design rule).

## Per-tick update — `bs_shots_update`

For each active shot (index order):

1. `age = game_ms − born`.
2. **Move** by family: sine (above), missile (steer + move), curve (rotate velocity, move), others
   `x += dx; y += dy`.
3. **Lifetime** (`life != 0 && age ≥ life`): a lob just disappears (its pool goes live by its own
   timer); mines and spores call `bs_shot_end(…, false)` (burst); anything else disappears.
4. **Leaves the field** (more than 14 px outside 0…480 × 0…270): disappears.
5. Lobs in the air never hurt.
6. **Hit a pilot:** for every alive pilot, if `dist² < (shot radius + SHIP_RADIUS)²`: spores and
   mines burst, other shots vanish, and `bs_hit_pilot(p)` runs (03). One pilot per shot.

Order matters: a shot spawned this tick by the attack update is moved once immediately, because
`bs_scheduler` runs before `bs_shots_update` in `boss_tick`.

## Endings — `bs_shot_end(shot, by_player)`

The shot is copied first (children may reuse its slot), deactivated, and particles are spawned.

| Family | Result |
| --- | --- |
| Mine | 8 needles speed 1.8 around it, offset 0.3 rad |
| Spore | 4 needles speed 1.2 around it, random offset |
| Lob shot down by the player | its linked pool is cancelled; `bs_scorch(x, y, 13, 3000, 900)` marks that ground (900 ms warning ring, then burns 3 s); three slow embers fan to the left (`π ± 0.55`, speed 1.0) |
| Missile | pops (no children) |

A lob that is **not** shot lands: its pool hazard goes live and later burns down into scorched
ground (08).

## Player damage to shots

`bs_circle_hit` on a `BC_SHOT` circle: a primary shot with `shot.hp > damage` just reduces `hp`
(missiles survive the first hit); otherwise `bs_shot_end(…, true)`. The laser always ends the shot.
Shootable shots appear as circles every tick in `bs_build_circles`, after the kind's own circles,
so a boss part in front of a missile still takes the shot first (earliest entry wins).

## Co-op

`bs_nearest` (homing, aimed live shots) considers all alive pilots; the pilot hit hook is the
co-op one (`coop_hit(owner)`). Shot counts and the 48 cap do **not** double with two players.
