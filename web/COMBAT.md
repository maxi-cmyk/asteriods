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

Local co-op now attributes every projectile/laser and statistic to a player.
Friendly hits do not count as enemy accuracy or scoring progress. See the
local co-op rules below.


## Bosses and mini-bosses (browser solo and co-op)

Design: `nextSteps.md` Part A. Engine: `native/boss.h` (shared framework) and
`native/boss_fights.h` (the twelve fights). Waves 5, 10, 15, 20, 25 and 30 close
their region with a boss (Sentinel, Ringwarden, Cinderforge, Bastion,
Tidecaller, Horizon Warden); the cycle then repeats as tiers (wave 35 is the
Sentinel again, tier II). Waves 3, 8, 13, 18, 23 and 28 carry a mini-boss
(Picket, Shardling, Cinderling, Gunnery, Moonjelly, Lens Imp) that shares the
wave with half the usual rocks and keeps the wave open until it is down.

Rules every fight obeys, measured by the test build (`web_test_boss_stats`):

- the 1.4 s entrance is harmless and cannot be shot;
- a lethal hazard never goes live without its warning (900 ms for lanes, beams,
  tendrils and pools; 700 ms for ring waves); telegraphs show a dashed amber line
  (lane or beam), a pulsing pink ring (landing area), a dotted arc (spread) or a
  thin red line (aimed shot);
- at most 48 hostile shots and 6 lethal hazards live at once, and a safe channel
  42 px wide always exists;
- the body stays in the right 55% of the field and touching it counts as a hit;
- dying never resets a boss: its attacks are cleared and you return protected;
- boss practice (Pause, practice only) loses no lives and reports hits taken.

Health is stated in design hits, `(18 + 6 * (min(10, wave / 5) - 1)) * players`
(minis `6 + 2 * region`), times 1.2 from tier II. The engine splits each design
hit into 3 to 8 sub-hits per fight (`BOSS_K`) so open windows, not raw fire rate,
set the fight length. A primary shot is one sub-hit and counts once toward
primary accuracy; the laser stays worth eight design hits and pierces. Shields,
multishot and 2× fire use the ordinary paths.

Each fight has a signature rule: Sentinel plates open only between attacks;
Ringwarden blades absorb shots and break (the laser pierces both rings);
Cinderforge's shell opens at vents or at panels broken with three hits; Bastion's
bridge takes half damage while a hardpoint lives; Tidecaller's bell is shielded
by bubbles (the laser pops all three); the Warden's core opens in a two-second
window every eight seconds or when all four S-stars are down.

Defeat awards `1500 + 250 * min(10, wave / 5)` (minis `400 + 100 * region`) as one
scoring event through the multiplier, +50% when no life was lost during the
fight. Boss kills are separate from asteroid kills and appear in Results and
Records by name. Defeating a mini-boss in a real run for the first time unlocks
its Hangar hull (`unlocks.mjs`); practice never unlocks. Co-op awards the killing
pilot, counts participation for every pilot who touched the boss, scales health by
two, and alternates its aim between the nearer and the farther pilot.

Every boss and mini-boss has its own defeat sequence (`boss-death.mjs`), played from a
frozen copy of its last frame: the Sentinel's plates blast off, the Ringwarden shears and
implodes, the Cinderforge splits on a column of fire, the Bastion breaks in two along a
chain of explosions, the Tidecaller dissolves into bubbles, the Warden collapses to a point
and rings out. Each has a matching defeat sound. Replay them on `/boss-attacks.html`.

Tier 3+ fights (wave 93 and later, or tier IV in boss practice) play in front of a
quasi-star, pulsar or magnetar; it is scenery only and never hurts the player.

Sound: each boss has its own timbre, a charge-up for every attack, a release sound
at the lethal moment and a distinct defeat sound (`boss-sound.mjs`). The
attack gallery (`boss-attacks.html`, linked from Pixel assets) lists every attack
with its warning and answer and plays its sounds.

Assists (Settings → Display): longer warnings add 30% to every telegraph; calm
forces remove the Warden's pull and straighten the lens shots.

## Local co-op

Play → Local Co-op opens device/profile assignment and ready checks. Use one
keyboard/mouse plus a standard-mapped controller, or two standard controllers.
Each player chooses a different local profile. Both ships share the fixed arena
and have independent three-life, weapon, pickup, combo and score state. Ships
pass through each other. P1 uses cyan/diamond cues, P2 amber/square cues.

Friendly fire is off by default and locks at launch. Enabled bullets hit the
first intersected enemy or teammate; protected teammates still intercept shots.
Lasers pierce and damage each intersected target once per discharge. Self-hits
are excluded. Friendly damage can consume shields/lives and reset the victim's
combo, but earns no points or enemy-hit accuracy.

A death clears only that pilot's bullets/echoes/effects and chain. Existing
spawned shots stay in the accuracy denominator. The shared world keeps moving;
a pilot with lives respawns after 500 active ms with two seconds of protection.
Eliminated players spectate. There are no revives; the run ends when both have
zero lives, and results are frozen/saved once.

Exact simultaneous impacts use rotating player priority, then entity identity.
New split fragments enter collision eligibility next tick. If splitting has no
capacity, the rock intercepts the bullet without damage/points/accuracy credit.
A shared pickup moves once and goes to the nearest overlapping living ship,
with rotating priority for ties. Ordinary kills credit their destroying player;
assist point splits and maximum-combo bonuses remain task 7 work.

Either player pauses everyone. Assigned-controller loss pauses and requires
explicit reassignment and a fresh Resume action; an unrelated controller loss
does not pause. Never auto-swap or auto-resume. Settings select the matching
profile for controls/calibration. Results show both players and team score;
team initials/records are separate from solo and from the other FF setting.
