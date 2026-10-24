# Browser combat controls

The browser's combat loop is implemented in `native/combat.h`. It reuses the
production ship, input, asteroid, bullet, scoring, and power-up modules.
The OLED game retains its original fixed-facing combat and automatic shield.

## Aiming and primary fire

- Left stick moves; right stick aims the ship and all weapons through 360°.
- Aim uses a configurable radial deadzone (25% by default) and keeps the last deliberate direction when
  the right stick returns to neutral. Movement never changes the aim.
- R2 / Cross fires once per fresh press, without heat or a primary cooldown.
- Aimed multishot rotates the complete spread. It retains atomic allocation
  and the single-shot fallback when fewer than three bullet slots are free.
- Bullet velocities, swept collisions, muzzle position, and left-edge cleanup
  follow the actual aim direction. Sixteen pixel orientations display the hull.
- Mouse movement or IJKL can aim; the right stick takes priority while deflected.
- Left click fires; hold right click to charge the laser. Mouse buttons release
  safely outside the canvas, and the game canvas suppresses the context menu.

## L2 charge laser

Hold L2 (or F / right mouse button) continuously for exactly 1,500 ms of active gameplay. Releasing
early cancels the windup without starting the cooldown.
The right stick can continue aiming during the windup. Normal firing is
suppressed while charging; rejected primary presses do not queue.

At full charge, fire one piercing ray in the current aim direction. The ray
hits every intersected, visible original rock once, awards its normal score,
and uses normal drop rules. Targets of every size are destroyed outright,
without fragments, even when the rock pool is full. Beam damage is instantaneous;
the 400 ms pixel beam is its visual after-effect, fixed at the firing position
and direction. A two-pixel half-width defines the damaging beam.

A fired laser starts a 5,000 ms cooldown measured from discharge. It does not
allocate a projectile. Windup cannot start during the laser cooldown.
Rejected L2 presses do not queue. Holding L2 cannot repeat, even after cooldown: release and press
again for another charge.

Pause freezes charge, beam display, and cooldown. Releasing L2 while paused
cancels windup. Death cancels windup and beam display; cooldown freezes through
the death animation and persists through respawn. A new run resets it. Losing
focus or a controller pauses the game and clears browser input.

## R1 + L1 precision movement

Hold both shoulders together for 50% movement speed, applied after diagonal
normalization. This is in addition to the retained 25% lower web movement
response. Keyboard equivalent: hold Shift.

The chord never activates or consumes a shield, in either press/release order.
L1 alone activates on release so a player can form the chord without wasting
a stored shield. Releasing the chord does not create a delayed shield action.

## L1 manual shield

Collecting a shield pickup stores one charge, rather than immediately arming
it. Tap and release L1 alone (or Q) to arm the stored charge. It stays armed
until one asteroid collision consumes it and grants the existing 800 ms of
blinking protection. The shield preserves the life and score chain.

There is at most one charge in total: either stored or armed. Duplicate
pickups do not stack. L1 cannot generate a shield when none has been collected.
Death and new runs clear both stored and armed shields. Shield arming remains
available during a laser windup and does not affect the laser cooldown.

## Verification

`npm test` includes exact timing boundaries, pause and held-trigger guards,
real aimed projectile positions/velocities, rotated multishot and leftward
cleanup, per-pulse scoring and destruction without fragments, precise diagonal movement,
rapid primary fire, stored/armed shields, and shoulder chords in both orders.
The release WASM excludes test scenario and overlap exports.

## Settings and practice

Settings pause play and persist locally. Keyboard actions and controller ability
buttons can be reassigned; occupied bindings swap. Volume, radial controller
deadzone, angular aim response, and screen shake are adjustable. Closing settings
leaves gameplay paused so the player can resume deliberately.

Practice keeps the full aiming, laser, shield, collision, and scoring paths,
but unshielded collisions never consume lives. Shields replenish when neither
stored nor armed. Stationary targets replenish 1.5 seconds after the last one is
destroyed; Reset targets is immediate. Try multishot grants the normal 6-second
effect. Five goals track movement, aiming, primary fire, laser discharge, and
shield arming. Practice has no leaderboard entry path and ends at the menu.

## 2× fire pickup

The outlined `2X` pickup doubles primary shot events for six active seconds.
Each fresh mouse, keyboard, or controller press emits one event now and one
80 ms later. Holding never repeats. Collecting another refreshes the timer;
it never adds another multiplier. Each event uses the current muzzle/aim and
multishot effect, including the existing one-shot fallback with fewer than
three free slots. The HUD shows remaining active time; practice has a Try 2×
fire button. The normal drop chance is unchanged; successful drops now choose
uniformly among multishot, shield, and 2× fire.

There are eight pending slots (at most four are needed with one processed
press per 20 ms tick). A full bullet pool drops an event without retrying.
Laser windup/discharge suppresses primary events, including due echoes; shields
and laser timings remain unchanged. Echoes earned before expiry still finish.
Pause freezes effect time and pending deadlines. Death, menu exit, and a new
run clear both effect and pending events. These rules apply only to WEB_HD.

## Run statistics

CPS counts primary input edges in `(active time − 1000 ms, active time]`.
It includes presses blocked by laser/pool capacity but excludes automatic
echoes, held repeats, menu actions, and paused input. Queued input edges are
counted when processed by the simulation (one per tick).

Accuracy counts enemy-hit primary projectiles / actually spawned primary
projectiles, including each multishot and echo projectile. No shot means `—`.
Each consumed projectile can count once; laser rays allocate no primary
projectiles and have separate discharge/kill counters. Final death freezes
the summary: all existing projectiles are already in the denominator, and
unresolved in-flight shots add no hits. Pending unspawned echoes add nothing.
A chain counts consecutive scoring kills within the existing three-second
combo window, including laser kills, and grows beyond the multiplier cap.
Death or expiry ends the chain; the longest value survives to the summary.

The current game is solo; simultaneous player attribution and friendly-fire
exclusion must be integrated when local multiplayer is implemented.


## Region-closing sentinel (browser solo)

Every fifth wave (5, 10, 15, ...) replaces ordinary asteroid pressure with one
sentinel. Its 1.2-second entrance is harmless. The orange core becomes vulnerable
when the entrance finishes. A locked lane/fan warns for 900 ms, attacks for
320 ms, then rests for 950 ms; the two patterns alternate. The lance has a
9-pixel half-width matching its rendered 18-pixel beam. Three fan projectiles
travel at 2.2 pixels/tick with ±0.28-radian spread. Movement bounds are unchanged.
Boss phase clocks freeze with gameplay, including Pause and utility visits.

Health is `(18 + 6 * (min(10, wave / 5) - 1)) * latched_players`; today's solo
runtime supplies one player. Tests exercise the two-player scaling input, but
there is no co-op implementation or network authority yet. A future co-op run
will latch its roster at entry; a disconnect must not resize the boss mid-fight.

A primary projectile deals one damage and counts once toward primary accuracy;
laser discharge deals eight damage once, without inflating primary statistics.
Shield protection and invulnerability use the existing collision path. Multishot
and 2× fire retain their projectile pools and 80 ms echo accounting.

Defeat awards `1500 + 250 * min(10, wave / 5)` base points as one scoring event
through the existing multiplier, capped at ×5. No per-hit farming. Boss defeats
are separate from asteroid kills and appear in Results. The defeat recovery is
at least 1.2 seconds, followed by the ordinary wave recovery. Since bosses close
regions, their entrance never overlaps the following region reveal.

Future co-op policy: one team award per boss; an assist records participation
without creating another point award. Attribution, friendly-fire interactions,
and host-authoritative replication are acceptance work for tasks 6–8, not
features of this solo release. Existing browser record keys are preserved;
old records are retained, with the new boss balance documented here.
