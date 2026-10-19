# Browser combat controls

The browser's combat loop is implemented in `native/combat.h`. It reuses the
production ship, input, asteroid, bullet, scoring, and power-up modules.
The OLED game retains its original fixed-facing combat and automatic shield.

## Aiming and primary fire

- Left stick moves; right stick aims the ship and all weapons through 360°.
- Aim uses a configurable radial deadzone (25% by default) and keeps the last deliberate direction when
  the right stick returns to neutral. Movement never changes the aim.
- R2 / Cross fires once per debounced press, without heat or a primary cooldown.
- Aimed multishot rotates the complete spread. It retains atomic allocation
  and the single-shot fallback when fewer than three bullet slots are free.
- Bullet velocities, swept collisions, muzzle position, and left-edge cleanup
  follow the actual aim direction. Sixteen pixel orientations display the hull.
- Mouse movement or IJKL can aim; the right stick takes priority while deflected.
- Left click fires; hold right click to charge the laser. Mouse buttons release
  safely outside the canvas, and the game canvas suppresses the context menu.

## L2 charge laser

Hold L2 (or F / right mouse button) continuously for exactly 3,000 ms of active gameplay. Releasing
early cancels the windup without starting the cooldown.
The right stick can continue aiming during the windup. Normal firing is
suppressed while charging; rejected primary presses do not queue.

At full charge, fire one piercing ray in the current aim direction. The ray
hits every intersected, visible original rock once, awards its normal score,
and uses normal drop rules. Targets of every size are destroyed outright,
without fragments, even when the rock pool is full. Beam damage is instantaneous;
the 400 ms pixel beam is its visual after-effect, fixed at the firing position
and direction. A two-pixel half-width defines the damaging beam.

A fired laser starts a 7,000 ms cooldown measured from discharge. It does not
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
