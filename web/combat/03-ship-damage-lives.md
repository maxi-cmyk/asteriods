# 03 · Ship, damage, lives

Source: `src/ship.cpp`, `combat_ship_hit` / `combat_collisions` in `native/combat.h`,
`src/game.cpp` (`update_death_animation`).

## Ship state (`struct Ship`)

`weapon.last_shot_ms`, `effects {multishot_left_ms, shield, double_fire_left_ms}`, `position_x/y`,
`alive`, `lives` (start `LIVES_START = 3`), `invincible_left` (ms).

- `ship_init`: lives 3, `ship_respawn` at `(SHIP_X 45, centre)`.
- `ship_respawn(x, y, game_ms)`: clears effects, clamps position to bounds, `alive = true`,
  `invincible_left = SHIP_INVINCIBLE_MS (2000)`.
- `ship_die`: `alive = false`, effects cleared, `lives--` (not below 0).

## What hurts the ship

| Source | Test | Where |
| --- | --- | --- |
| Rock | circle overlap, `distance² < (rock.radius + 7)²` | `asteroid_hits_ship` |
| Boss shot | `distance² < (shot radius + 7)²` | `bs_shots_update` |
| Lethal hazard | geometry per kind | `bs_hazard_hits` (08) |
| Burn (scorched ground) | inside radius `c + 4.2`, periodic | `bs_hazards_update` |
| Boss body | any body circle overlap | `bs_contact` |

All of them end in one rule.

## The hit rule — `combat_ship_hit` (solo)

```
if ship.invincible_left > 0:  return                 // blinking protection
if ship.effects.shield:       shield = false
                              invincible_left = SHIELD_PROTECTION_MS (800); return
if practice_mode:             return
ship_die(ship)                                       // lives--
if boss.active: bs_clear_threats()                   // all boss shots + hazards vanish
clear queued 2× shots; combat.chain = 0; charging = false; beam_left_ms = 0
shield_stored = false
powerups_init()                                      // removes the visible pickup too
scoring_reset()                                      // multiplier back to ×1
particles, sound, shake(3)
set_state(DEATH_ANIM)
```

Points worth knowing:
- Only **one** hit can land per `invincible_left` window; a held lance or a burn tick cannot kill
  twice. The shield grants 800 ms of protection so the pilot can leave an overlap.
- Dying **does not reset the boss** (design rule). Only its threats are cleared so the return is
  fair; health, phase and the attack sequence continue.
- `cooldown_left_ms` of the laser is **not** reset on death.
- In practice (`practice_mode`/boss practice) nothing is lost.

## Death animation and respawn (`update_death_animation`)

- `DEATH_ANIMATION_MS = 500` (browser clock). `game_ms` does not advance, so the boss is frozen.
- At the end: `bullets_init()` (all player bullets removed). With lives left:
  `asteroid_safe_respawn()` then `ship_respawn(...)`, back to PLAYING with 2000 ms protection.
  Otherwise: game over → `INITIALS` if the score qualifies, else `GAME_OVER`.
- `asteroid_safe_respawn`: start at `x = SHIP_X`, find the row with the best clearance from rocks
  (`respawn_clearance` = min over rocks of `distance − rock.radius − ship radius`). If the best is
  below `RESPAWN_SAFE_CLEARANCE (12)`, scan columns left to right in steps of 4 and take the first
  that reaches 12 (or the clearest overall).
- **Solo respawn ignores the boss** (rocks only). Co-op respawn also checks boss bodies, hazards
  and shots (see 11). The 2000 ms protection and the entrance rule are what keep the solo return
  fair.

## Invincibility display

`invincible_left` counts down inside `ship_update` (so only while alive and playing). The renderer
blinks the ship every 100 ms (`SHIP_BLINK_MS`) while it is non-zero.

## Lives and the boss "flawless" flag

`bs_setup` stores `lives_at_start = bs_lives_total()`. Each `boss_tick` compares it to the current
total; if lower, `boss.life_lost = true`. A shield absorbing a hit does not lower lives, so it
keeps the fight flawless. See 05 for the payout.
