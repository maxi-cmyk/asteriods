# Next steps

## Direction and priorities

Keep a simple side-scrolling Asteroids rendition on the existing ESP32/OLED,
with one joystick and one fire button. Rocks move right to left and the ship
always faces and shoots right.

Implement in this order: readable code → direct 2D movement → stable demo →
score multiplier → a small power-up set. Verify each stage before continuing.
These are planned changes; this file does not change the current firmware.

### Fixed requirements

- Use joystick X/Y for direct left/right and up/down movement.
- No thrust, rotation, inertia, or coasting. Release the stick to stop.
- One shot per debounced fire-button press, with no player firing cooldown.
  Holding fire must never repeat. Power-ups must use this same button.
- Keep three lives, splitting rocks, gradual waves, and missed rocks leaving
  without a life penalty. Keep the HUD compact and the playfield readable.
- Keep joystick double-click pause; freeze gameplay timers while paused.

## 1. Apply the CS101 coding style

Reference: [CS101 Coding Style.pdf](</Users/maxi/Downloads/CS101 Coding Style.pdf>).
The PDF supplies style guidance; project behavior remains defined by the user
requirements above.

### Rules from the reference

- [ ] Limit lines to 80 characters. Break after commas or before operators;
      align continuation lines, using an 8-space continuation when clearer.
- [ ] Use four spaces per indentation level, K&R braces, and braces for every
      conditional/loop body, including single-statement bodies.
- [ ] Put at most one statement per line and one variable declaration per
      line. Initialize variables and declare them close to first use.
- [ ] Use meaningful `snake_case` variable and function names. Avoid
      single-letter names except ordinary loop counters.
- [ ] Replace unexplained numeric literals with named constants.
- [ ] Separate logical chunks with blank lines. Space binary operators and
      write control statements as `if (condition) {` and
      `for (int i = 0; i < count; i++) {`.
- [ ] Explain intent and non-obvious reasoning in comments; remove redundant
      and outdated comments.
- [ ] Use direct boolean conditions, avoid empty branches and unnecessary
      nesting, and use `else if` for mutually exclusive branches.
- [ ] Keep loop setup focused on the loop counter and use explicit termination
      conditions. Move special first/last-iteration work outside loops where
      appropriate.
- [ ] Give each function one responsibility; aim for at most 50 lines and
      extract focused helpers from longer functions.

### Apply these rules to this Arduino C++ project

- [ ] Replace compressed one-line helpers, chained statements, cryptic names
      such as `s`, `d`, and `in`, and deeply nested ternaries with readable code.
- [ ] Prefer explicit types and straightforward indexed loops where they make
      the code more familiar. This is an additional readability choice, not
      an explicit requirement of the PDF.
- [ ] Keep Arduino's required `setup()` and `loop()` and library API names.
      Rename project-owned functions and variables consistently across
      headers, implementations, call sites, and host tests.
- [ ] Apply the style to `src/`, `include/`, and project-owned test code;
      leave third-party libraries and generated `.pio/` files alone.
- [ ] Keep the style pass separate from gameplay changes so behavioral
      regressions are easier to identify.

## 2. Add direct 2D movement

- [ ] Drive horizontal position with joystick X and vertical position with
      joystick Y, retaining analog speed control and the center deadzone.
- [ ] Keep the ship facing right and spawn shots from its actual nose position.
- [ ] Clamp the complete ship shape inside the playfield, below the HUD and
      within all four edges. Do not wrap the ship.
- [ ] Limit the combined movement magnitude so diagonals are no faster than
      straight movement. Do not amplify small diagonal stick deflections.
- [ ] Check that neutral input is steady; tune deadzone/smoothing only after
      reproducing drift or jitter, without introducing sluggish movement.
- [ ] Extend respawn selection to find a safe 2D position, favoring the left
      side and avoiding incoming rocks. Retain blinking invincibility.
- [ ] Start with full playfield movement. Test whether approaching the right
      edge leaves enough warning of incoming rocks; adjust spawn warning or
      spacing if needed instead of introducing thrust or rotation.

## 3. Fix and restore the demo

### Reported problems

- The ship sometimes does not fire even when asteroids are directly in front
  of it, including when other asteroids surround it.
- The ship is extremely jittery.

These are reported symptoms, not yet confirmed causes.

### Establish the version being tested

- [ ] Check which firmware or preview exhibits the reported problems and
      reproduce them before changing behavior.
- [ ] The current working source has no demo mode: `src/demo.cpp`,
      `include/demo.h`, and `STATE_DEMO` were removed during simplification.
      Confirm whether the observed demo comes from an older flashed build or
      another preview. Record this so the correct behavior is investigated.
- [ ] Restore a small demo using the current side-scrolling gameplay modules.
      Do not restore the old saucers, match timer, or rotation/thrust logic. Add the new
      multiplier through the shared scoring system when that step is ready.

### Make firing reliable

- [ ] Select targets ahead of the ship, to its right, along the horizontal
      firing path. Do not let a nearer rock behind or beside the ship prevent
      firing at an eligible rock in front.
- [ ] Separate threat detection from shooting eligibility. A ship that is
      dodging should still be able to shoot a rock in its firing path.
- [ ] Define a small, explicit alignment tolerance using the target radius
      and ship's firing height. Check targets only inside the visible field.
- [ ] Verify the demo fires from the right-facing nose and uses rightward
      bullets and the current collision checks.
- [ ] Let the demo generate its own deliberate shot events; do not add
      hold-to-fire or a shot cooldown to player controls. The player must
      retain one shot per debounced press and be able to spam the button.

### Stop the jitter

- [ ] Check whether the controller switches targets or alternates between
      aiming and dodging on consecutive updates. Measure or trace decisions
      before assuming this is the cause.
- [ ] Keep a chosen target until it is destroyed, leaves, or becomes unsuitable.
- [ ] Add an aiming deadband: stop moving once aligned instead of constantly
      correcting small vertical differences.
- [ ] Use separate enter/exit thresholds for dodging so small changes do not
      repeatedly reverse the ship's decision. Commit briefly to a safe dodge
      direction, while respecting the full 2D playfield limits.
- [ ] Prefer a stable safe route when surrounded; avoid chasing every
      nearby asteroid or adding inertia to the player's direct movement.
- [ ] Adapt targeting and dodging to direct 2D movement. Keep a comfortable
      distance from right-edge spawns and avoid sitting against boundaries.
- [ ] Make any joystick/fire input leave the demo predictably. Consume that
      exit input so it cannot also accidentally start a run.

### Demo acceptance checks

- [ ] A rock directly ahead receives shots even with nearer rocks elsewhere.
- [ ] Rocks behind the ship do not become shooting targets.
- [ ] The ship can shoot while dodging, without rapid direction oscillation.
- [ ] Stable targets produce smooth aiming and a stationary ship once aligned.
- [ ] Splitting rocks, target disappearance, empty waves, crowded scenes, and
      all four playfield boundaries do not cause controller instability or lockups.
- [ ] Real player presses still fire individually; holding never repeats.

## 4. Restore the score multiplier

Suggested initial tuning, to be adjusted after playtesting:

- [ ] Start at x1. Every three asteroid destructions in a chain increase the
      multiplier by one, capped at x5.
- [ ] Keep the chain alive by destroying another asteroid within three seconds.
      Reset the chain and multiplier when the window expires or the ship dies.
- [ ] Count each destroyed asteroid separately, including fragments. A missed
      shot or a rock escaping does not immediately break the chain.
- [ ] Process hits individually, in a defined order. If one press destroys
      several rocks, each destruction must count; do not infer kills from
      summed points. Award each kill at the current multiplier, then advance
      the chain for subsequent kills.
- [ ] Show the multiplier beside the score and provide a subtle expiry cue.
      Keep lives readable and avoid another permanent text-heavy HUD row.
- [ ] Freeze the chain timer during pause and the frozen death animation.
      Clear its state on a new run.
- [ ] Use the same scoring rules for normal and powered-up shots. Check the
      persisted best-score rules when multiplier scoring is introduced; label
      or version the score key if old/new scores are no longer comparable.

## 5. Add a small power-up set

Start with **multishot and shield**. The remaining ideas are candidates for
later, not a requirement to add everything at once. All effects activate on
collection and require no extra button.

| Power-up | Proposed effect | Initial tuning / priority |
| --- | --- | --- |
| Multishot | One press fires straight plus two shallow diagonal shots | 6 seconds; first weapon upgrade |
| Shield | Absorb one asteroid collision without losing a life | One charge; first defensive upgrade |
| Piercing shot | A shot can hit two distinct rocks before disappearing | 6 seconds; later weapon alternative |
| Slow field | Temporarily slow asteroid movement, leaving the ship responsive | 4 seconds; later defensive alternative |
| Score bonus | Instantly award a small fixed bonus | Later simple collectible; no multiplier or chain extension |

### Shared pickup rules

- [ ] Drop pickups occasionally from destroyed rocks, with a bounded rate.
      Start around a 10% chance and cap at one visible pickup; tune on the OLED.
- [ ] Move pickups left slowly and remove them when they leave the screen.
      Spawn them inside the visible playfield where collection is possible.
- [ ] Use distinct small symbols and a brief collection cue. Show one compact
      weapon-duration indicator and a shield outline only while active.
- [ ] Allow one weapon effect at a time. A different weapon replaces the
      current one; collecting the same weapon refreshes its duration without
      stacking. Shield can coexist, but duplicate shields remain one charge.
- [ ] Pause timed effects with gameplay. Clear effects on death and new runs;
      expire weapon effects back to normal single-shot fire.
- [ ] Bound projectile/particle counts and make pool allocation predictable.
      Treat a multishot volley as one atomic spawn: if three projectile slots
      are not available, fire a normal shot if one slot is free.
- [ ] Preserve one volley per press and no hold-to-fire or shot cooldown.
- [ ] Ensure a shield collision cannot retrigger every update while overlapping
      the same rock. Consume the shield, preserve the life and score chain,
      and grant a short blinking protection window to leave the collision.

### Weapon-specific details for later implementation

- [ ] Give multishot bullets X/Y velocity and use general segment-circle
      collisions; the current horizontal-only sweep is insufficient.
- [ ] For piercing, count each rock once per projectile. Prevent a projectile
      from repeatedly scoring the same rock or instantly consuming its hit
      budget on newly spawned overlapping fragments.
- [ ] For slow field, apply a temporary movement factor rather than permanently
      editing velocities. Restore ordinary speed on expiry; keep input and
      firing responsive.
- [ ] Make the demo use shared pickup/effect rules after the first power-ups
      work reliably for the player; do not destabilize its aiming to chase loot.

## 6. Verify and document each stage

- [ ] Keep style-only changes separate from gameplay changes in reviewable
      diffs. Run the existing host checks after each stage.
- [ ] Add host checks for neutral input, diagonal speed, all movement bounds,
      nose-relative firing, and safe 2D respawns.
- [ ] Add demo checks for target selection, firing while dodging, stable
      decisions, target disappearance, and input-driven exit.
- [ ] Add scoring checks for multiplier thresholds, expiry, pause, death,
      simultaneous hits, and best-score persistence.
- [ ] Add power-up checks for collection, refresh/replacement, expiry, pause,
      death/reset, shield overlap, diagonal collisions, and full bullet pools.
- [ ] Run `sh tests/run_host.sh`, `pio run`, and `git diff --check`.
- [ ] On the ESP32, check smooth 2D movement, rapid fire presses, demo motion,
      readable pickups/HUD, fair spawn warning, and crowded powered-up scenes.
      Host checks alone do not establish physical gameplay quality.
- [ ] Update the README and game specification to match implemented controls,
      demo entry/exit, multiplier rules, and power-ups. Mark optional ideas as
      planned until they are implemented.

## Verification baseline

The side-scrolling firmware was built and flashed successfully, with flash
verification and an automatic board reset. Host gameplay checks with
UndefinedBehaviorSanitizer passed. AddressSanitizer hung on the development
Mac and has not passed. Physical gameplay feel/readability remain unverified.
