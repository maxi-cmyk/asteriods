# UI overhaul acceptance — 2026-10-24

Task 5's implementation is complete. The evidence below distinguishes builds,
simulated flows and browser rendering from physical-device acceptance.

| Check | Evidence / status |
| --- | --- |
| Browser + OLED/HD WASM regressions | 117 checks passed; navigation/history, drafts, pause snapshots, result-before-save ordering, retry/held-input guards, persistence/reset rollback, regions, boss/combat and isolated demo |
| Portable C boundary | Strict C17/pedantic/Werror + UBSan; independent scoring states, rollover, binary codec, stable ties, rejection without mutation and difficulty cap; linked with C++ gameplay harness, passed |
| Production | `npm --prefix web run build`, passed; served existing local preview with no-store headers |
| Firmware | PlatformIO ESP32 build passed; no upload or physical device claim |
| Sound regression | Real WASM game-over pattern finishes in 35 fixed ticks (700 ms including tick quantization); result, scene and simulation snapshot remain identical |
| Music | Original Home/flight two-voice chiptunes; independent opt-in preference; bounded scheduling and pause/hidden/off mute tests passed; warp cue ends on skip/cancel/blur |
| Browser rendering this pass | Safari: Home, Settings/Audio, utility reload, launch, play HUD, Practice, Pause, Help/Back, explicit quit, Practice Results/Home, Records with existing scores, increased zoom. Pause positioning correction rechecked visually |
| Earlier task 4 rendering | Home/launch, Display, fullscreen, zoom and busy synthetic transition/boss fixtures; this is prior evidence, not a new full visual sweep |
| Data compatibility | Same version-1 42-byte leaderboard; same settings key/payload version 2; missing music preference defaults off; reset/failure/migration tests passed |
| Design scanner | 27 findings remain, principally intentional pixel label sizes, tracking/leading and the deliberately dim utility backdrop; no claim of a clean lint audit |

## Remaining hands-on acceptance

- [ ] Physical keyboard/mouse and controller session: light trigger pulls,
      neutral drift, remaps, hold/release, reconnect while holding input,
      device disconnect, focus loss and recovery.
- [ ] Listen to sound/music balance on speakers/headphones and the ESP32 buzzer.
      Automated scheduling and duration checks do not prove listening quality.
- [ ] Full desktop/short-window/fullscreen matrix across all utility/run-end
      states, including storage failures and keyboard focus at high zoom.
- [ ] Sustained frame pacing on a representative laptop versus the original
      starfield; dense rocks, shields, laser and multishot/2x, all five transition
      peaks, missing/late assets, reduced motion and pause during a reveal.

## Refactor boundary

Portable scoring, difficulty and leaderboard state/codec now live in actual C
translation units, compiled as C17 for both host and WASM. Entity physics and
run orchestration still use the existing C++ implementation. This is the staged
extraction required by task 5, not a claim that all firmware is now C.

## Task 6 local co-op — 2026-10-25

Implementation is available in Play → Local Co-op. One shared 480×270 arena,
no split screen. Physical acceptance below remains open.

| Check | Evidence / status |
| --- | --- |
| OLED + HD WASM / browser logic regressions | 133 Node checks passed, including existing solo/practice/navigation/audio/records tests and 16 new co-op/input checks |
| Native co-op ownership and collision tests | Independent movement and fixed projectile pools, timers/echoes, swept friendly interception, protected/shielded hits, simultaneous single payout and pickup collection, local death/respawn, countdown pause and laser cancellation |
| Boss tests | Two-player health latch, alternating locked targets, one laser damage event, independent attribution and unchanged health after death |
| Stress fixture | 10,000 fixed 20 ms ticks (200 simulated seconds) with both players firing multishot/2× every tick; queues ≤4 pending echoes per player, ≤12 active primary projectiles each, hits never exceed spawned |
| Records | Isolated solo/co-op/FF contexts; two individual summaries; team score range, stable ties, save idempotency/failure/corruption, record reset and profile validation |
| Host boundary | `sh tests/run_host.sh` passed; shared production/ESP32 sources unchanged |
| Release build | HD production WASM build passed; test fixture exports remain test-only. Production build removes the optional synthetic-controller HTML harness |
| Browser flow (Helium) | Real application loaded with explicitly synthetic controller fixture: Play/mode selection, device assignment, both ready states, launch/countdown, two-ship shared arena with separate external HUD strips, keyboard movement/fire/pause, controller loss → shared pause → explicit reclaim → deliberate Resume; synthetic P2 move/fire/pause and keyboard Enter Resume |
| Design scan | Scanner run: 28 findings (mostly inherited pixel-font/contrast/leading warnings). No clean accessibility audit claimed. Co-op layout adjusted after rendered review to keep HUD outside arena |

Automated stress is simulation evidence, not a measured physical-controller or
sustained browser frame-rate result. The browser harness overrides Gamepad API
with clearly labeled synthetic pads and does not prove hardware connection.

- [ ] Two people with a physical keyboard/mouse + controller.
- [ ] Two people with two physical controllers, including identical models.
- [ ] Hardware drift/trigger/remapping/reconnect while controls remain held.
- [ ] Full 960×540 / 1440×900 / zoom/fullscreen matrix through Results, initials,
      save failure, utility visits and simultaneous deaths.
- [ ] Sustained frame pacing and CPU/memory measurements on a representative
      browser/laptop under dense combat, bosses, lasers and effects.
