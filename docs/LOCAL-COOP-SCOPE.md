# Task 6: local co-op implementation scope

Implemented 2026-10-25 from this reviewed scope. Automated evidence and
synthetic-controller browser checks are in `ACCEPTANCE.md`; physical two-person
and representative-browser performance acceptance remain open.

## Player experience and boundaries

Two ships share the entire fixed 480×270 arena, one camera and one world clock.
No split screen, camera tracking, zoom changes or changes to movement bounds.
Ships pass through each other without contact damage or pushing.
Support keyboard/mouse + controller and controller + controller. Two keyboards,
touch, LAN/server play, versus, revives and task 7 combo bonuses are outside this
milestone. Preserve solo, practice, demo and ESP32 behavior.

Play gains Solo / Local Co-op selection. Co-op opens two device/profile slots,
ready controls and a friendly-fire toggle (off initially). Roster, distinct
profiles, three starting lives each and run rules lock before launch. No
mid-run joins. Start only with two assigned supported devices, two ready slots
and released action buttons. A new ready action is required after lobby changes.

P1 and P2 use different colors and marker shapes plus persistent text labels.
Labels stay within the arena and separate on overlap; invincibility blink hides
the hull rather than the identity marker. Shots, beams and shields carry matching
owner cues, with a secondary pattern/shape cue rather than color alone.
Compact player HUD strips sit outside the arena at left/right; team score and
wave sit centrally. Show lives, score, combo, shield state, laser readiness and
timed pickups. Show respawning/eliminated status in the same player strip.
CPS/accuracy detail belongs in Results, keeping combat readable. Verify the
layout at 960×540, 1440×900, browser zoom and fullscreen without covering hazards.

## Source review: failure points in the first plan

| Current path | Risk if called twice | Required change |
| --- | --- | --- |
| `src/game.cpp`, `web/native/combat.h` | One ship, global death state, global resets and finalization | Explicit player slots and per-player lifecycle within one run |
| `src/powerup.cpp` | Pickup movement/cue advances twice; first player always collects | Separate world pickup update from collection and player effect clocks |
| `src/bullet.cpp` | Shared capacity and callback with no owner; separate passes can hit through nearer objects | Owned fixed pools and unified swept collision resolution |
| `src/scoring.cpp` | One global combo reset/award | Independent `ScoringState` using existing portable C functions |
| `web/native/boss.h` | Targets one ship; updates shots while checking that ship; global award | World boss update once, explicit target and owned damage events |
| `web/src/app/` | First-controller fallback can silently replace a lost device | Explicit assignments and reconnection workflow |
| `web/src/runtime/`, `web/src/state/records.mjs` | One profile/result; solo leaderboard binding; finalize on one death | Latched two-player context, shared completion and isolated persistence |
| `web/native/scene.h`, `web/src/render/renderer.mjs` | Fixed offsets and one ship/effect history | Versioned scene layout, decoded once for both players |

## Simulation and attribution rules

- Use two browser player slots containing ship, combat, scoring, statistics,
  lifecycle and input state. Advance one 20 ms world tick; never advance world
  time, waves, shared particles or pickup drift inside the player loop.
- Allocate each player the existing solo projectile allowance, without borrowing
  capacity from the other. Keep arrays and pending-input/echo queues bounded.
  Preserve multishot atomic allocation/single-shot fallback and 80 ms echo rules.
  Carry owner identity through bullets, lasers, effects and collision events.
- Specify tick phases before coding: pause/input guard, clock/timers and movement,
  weapon events, collision resolution, rewards/lifecycle, then run completion.
  Shared entities move once. Resolve damage against valid targets before applying
  terminal transitions; process a player's life loss at most once per tick.
- For each primary projectile, resolve the earliest swept intersection with an
  eligible enemy or friendly ship. Ignore its owner for the projectile's entire
  lifetime. With friendly fire off, ignore teammates. With it on, a teammate
  intercepts/consumes the projectile even when protected; shields/protection
  decide damage. Do not credit friendly interception as enemy accuracy.
- Lasers remain instantaneous piercing rays: at most one damage event per
  intersected eligible target per discharge. Their 400 ms visual causes no
  additional damage. Apply shield/invincibility normally to friendly laser hits.
- Sort simultaneous collision events by within-tick impact time, with a rotating
  player priority for exact ties and stable entity identity as the final tie
  breaker. An enemy transitions to destroyed once and generates rewards/drops
  once. New fragments cannot be hit until the next tick. Document these co-op
  ordering rules without silently changing the solo collision behavior.
- Move the pickup once, then choose one overlapping living collector by nearest
  distance; rotate player priority for exact ties. A full shield remains full
  and duplicate collection follows existing non-stacking rules. A player's death
  does not erase the world pickup or the teammate's effects.
- Ordinary asteroid kills credit the destroying player using that player's combo.
  Task 6 has no assist point split or assist combo progress; task 7 will define
  those. Team score equals the sum of the displayed individual scores. Preserve
  each player's existing score cap; allow the team total to represent their sum.
- Boss roster size is latched at run start to two, including after elimination or
  disconnect. At each warning, alternate among living players, skipping absent
  ships; lock the selected position through that attack. If both are respawning,
  retain the last target position until the next warning with a living target.
  Move boss projectiles
  once and resolve collisions with both ships. Respawn selection also considers
  the boss body and active/warned attack zones.
- A boss defeat produces one award to the destroying player using their combo,
  included once in the team sum; participation is a non-scoring result field.
  Boss damage increments primary accuracy at most once per consumed bullet;
  laser statistics remain separate. A team boss-kill count is not duplicated
  when both players participate.

## Death, pause and input ownership

Use per-player alive / respawning / eliminated states. On death, clear only that
player's bullets, pending echoes, charge/beam, pickup effects and chain; keep their
already-spawned shots in the accuracy denominator. Preserve laser cooldown,
freezing it while that player is dead as in solo. Existing 500 ms death delay
then safe respawn with two seconds of protection runs on active game time.
The teammate, waves and enemies continue. If both die with lives remaining,
both respawn; finish only when neither player has lives remaining. Snapshot
results once after resolving the whole tick; no scoring after finalization.

Keep one independent Controls instance per slot, including trigger hysteresis,
fresh-press queues, aim source and release guards. Route keyboard/pointer input
only to its owner. In co-op remove automatic first-controller fallback from both
the frame loop and fast controller polling. Match identical controller names by
assigned slot/index during connection, not by display name. A reconnect or index
change requires explicit reassignment while paused; never silently swap players.

Either player can pause; pause requests combine into one action per tick rather
than toggling twice. Blur/hidden page or loss of any assigned controller pauses
the whole run, including during launch/countdown. Reconnection never auto-resumes.
An unrelated controller disconnect does not interrupt play. Keep both slots
assigned before resume, consume pending actions, require neutral/released inputs
from both and one fresh Resume action. An eliminated player's controller may
still pause, and its loss follows the same assignment rule.

Shared menus have one navigation owner at a time; the invoking device owns
Pause and its utility screens. Lobby ready actions remain per slot. Coalesce
simultaneous pause/confirm actions and consume transitions so no second action
fires, resumes, starts a run or saves initials unexpectedly.
Settings explicitly select P1/P2 for controls and calibration. Audio/display are
shared preferences controlled by the menu owner; keep both profiles' personal
audio/display preferences intact. Profile identity cannot change during a run.

## Results and storage

Latch roster/profile/rules at launch; save each player's co-op personal bests
under the existing mode/friendly-fire rule context. Require distinct profile
slots to avoid merging two players into one personal best. Present both player
summaries plus team total, shared wave/time and team boss defeats.

Use a dedicated co-op team leaderboard key per friendly-fire setting; preserve
solo keys/format and records. Store one team entry with one team initials prompt.
Provide a versioned format capable of the team score range. Continue/Save has a
single menu owner and release guard. Completed results remain reviewable when
storage fails; no automatic retries or duplicate writes. Extend record reset
to cover the new keys with the existing deliberate confirmation/rollback policy.
Quit abandons the run without recording a completed result; Play Again returns
to the co-op lobby with assignments retained for a fresh ready check.

## Implementation sequence and tools

1. Document tick phases and versioned input/scene contracts; introduce decoded
   player snapshots rather than spreading more numeric offsets through callers.
2. Refactor player state and world/player update boundaries while running the
   existing solo/practice/OLED checks. Reuse C17 scoring; keep browser co-op
   orchestration separate from the firmware adapter.
3. Implement owned projectiles, collision ordering, pickups, death and boss rules
   with deterministic WASM fixtures before exposing a multiplayer menu.
4. Add explicit assignment/input routing and the lobby, then shared-screen HUD,
   marker overlap handling, pause/settings/reconnect and results/persistence.
5. Run regression, browser and physical acceptance; expose Local Co-op only when
   the end-to-end flow works. Update controls/rules and acceptance documentation.

Use the existing LLVM/wasm-ld build, C/C++ WebAssembly simulation, JavaScript
Gamepad API and keyboard/pointer events, Canvas 2D and HTML/CSS. No new engine,
backend or network dependency is needed. Build packaging must include extracted
modules. Run `npm --prefix web test`, `npm --prefix web run build` and
`sh tests/run_host.sh`; build ESP32 whenever shared production sources change.

## Stress-test acceptance matrix

This matrix defines acceptance requirements. Completed automated/rendered checks
and remaining physical checks are distinguished in `ACCEPTANCE.md`.

| Scenario | Required evidence |
| --- | --- |
| Both players hold multishot + 2× and laser | Independent caps/timers; bounded queues; no starvation; accurate per-owner counts |
| Both hit the same last-health target in one tick | One destruction/drop/award; stable tie rule; no duplicate team points |
| Friendly ship between shooter and rock; crossing high-speed shots | Earliest swept target consumes bullet; self never hit; FF-off passes through teammate |
| Friendly laser, shield and protection overlap | One damage attempt per discharge; no friendly score, chain or enemy-hit credit |
| Both overlap pickup or die on collection tick | One defined collector; no double drift/timer decrement; teammate/world state survives death |
| One death, both deaths, one/both eliminated | Local respawn only; no world freeze; pending events cleared only for victim; exactly-once completion |
| Boss target dies/disconnects during warning | Locked attack stays readable; no retarget jump; roster health unchanged |
| Identical controllers, unplug/replug, index changes | Explicit reclaim; no player swap or one device controlling two ships |
| Both pause/confirm; held triggers during transitions | One transition; fresh-action guards; no stray shots/saves/resume |
| Pause in respawn/echo/laser/boss phase; Settings and Back | Same world/player timers and state; profile editing affects intended player only |
| Storage denied/corrupt, retry, reload, reset | Solo records preserved; co-op contexts separate; retained results and no duplicate saves |
| Ships overlap at edges; zoom/fullscreen; dense boss scene | P1/P2 markers readable, no clipped essential HUD or obscured hazards |
| Sustained maximum supported combat load | Measure frame/tick time and queue bounds on target browser; no accumulating backlog |
| Real two-person sessions with both device combinations | Validate aim, simultaneous taps, pause, reconnect and readability with physical hardware |

Automated fixtures, rendered scenes, measured performance and physical two-person
acceptance must be recorded separately. A passing solo suite or two injected
input streams alone does not complete this milestone.
