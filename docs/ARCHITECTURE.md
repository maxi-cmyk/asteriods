# Ownership and dependency map

Baseline before task 5: 114 browser/WASM checks. The existing host harness
covers gameplay, difficulty, scoring and transactional leaderboard writes.

| Owner | Responsibility | Dependencies |
| --- | --- | --- |
| `web/src/main.mjs`, `web/src/app/` | Compose services, game loop, input, menus, routing, solo/co-op sessions | Screens, runtime, state, input |
| `web/src/screens/` | Home/demo, settings, records, help, play HUD and results DOM | Injected settings/runtime; no native mutation during rendering |
| `web/src/state/navigation.mjs` | Screen history, pause/resume, dirty/quit decisions | Runtime and draft callbacks |
| `web/src/input/` | Gameplay input, menu adjustment, co-op devices, calibration | Sanitized settings |
| `web/src/runtime/` | The engine as the UI sees it: WASM host, runs and results, scene layout and decoding | WASM, personal best storage |
| `web/src/state/settings.mjs`, `records.mjs` | Versioned persistence and rollback | Injected Storage |
| `web/src/audio/` | Effects and original procedural music | Web Audio, applied preferences |
| `web/src/demo/` | Explicit, isolated demonstration run | Separate WASM instance; no persistence/audio |
| `web/src/render/`, `web/src/boss/` | Pixel rendering, presentation clocks, boss painters, deaths and sound | Read-only scene; original assets |
| `src/core/*.c`, `include/core/*.h` | Portable scoring state, difficulty and score-table codec | C standard integer/boolean types only |
| `src/scoring.cpp`, `difficulty.cpp`, `highscore.cpp` | Preserve legacy gameplay APIs and platform storage | Portable C core; Arduino/Preferences |
| `web/native/` | Browser platform adapter, `web_*` exports, scene serialiser, HD combat, co-op and the boss engine | Shared C++ gameplay and linked C objects |

The web source tree, the scene ABI and the boss engine are described in
[web/ARCHITECTURE.md](../web/ARCHITECTURE.md).

Dependencies point inward: portable C never includes Arduino, Preferences, DOM
or rendering APIs. Remaining entity physics and orchestration are C++ and should
be extracted in later bounded changes rather than renamed to `.c`.

## Contributor conventions

New portable code follows the supplied CS101 guide: four spaces, attached
braces on every branch/loop, 80 columns, lower_snake_case, one initialized
variable and statement per line, constants instead of unexplained limits.
Keep functions focused (target 50 lines), declarations local, comments about
invariants and reasons. `sh tools/format-core.sh` formats only owned portable code;
vendor and generated `web/dist` are excluded. Do not mass-format legacy code in
a mechanics change. Browser controllers use explicit injected dependencies;
cache DOM nodes per controller, keep rendering separate from event wiring.

Settings retain `asteroids.web.settings-v1` (payload version 2). New optional
music preference defaults off when absent. Leaderboard keeps the exact 42-byte
version-1 layout, five entries and existing scores-v3 keys. Personal-best keys
and profile/rule scopes are unchanged. Refresh intentionally preserves records;
Clear this browser's records is the explicit confirmed removal operation.

## Verification

CSS ownership: `web/styles/shared.css` contains primitives/HUD;
`web/styles/screens.css` contains screen-specific controls; `web/styles/shell.css` owns
viewport geometry; `web/theme.css` imports `web/styles/theme/` (pixel identity and presentation).

Run `npm --prefix web test`, `npm --prefix web run build`,
`sh tests/run_host.sh`, and PlatformIO's ESP32 build. Host tests compile core
objects as strict C17 before linking the C++ harness; WASM does the same.
Check the browser flow Home → launch → play → pause → utility → resume →
results → initials/leaderboard → retry/Home, including storage denial, history,
blur and reduced motion. Synthetic fixtures are renderer checks, not evidence
of physical input or sustained device frame rate. Hardware/controller acceptance
remains explicit in `docs/ACCEPTANCE.md`.

## Local co-op (task 6)

Browser co-op is owned by `web/native/coop.h`. Two `CoopPlayer` slots own ships,
combat, portable C17 scoring states and fixed 12-projectile pools. Legacy shared
globals serve as a scratch context around existing player helpers; load/save
copies only player-owned state. Never run the solo world update once per player.
Co-op advances waves, boss phases/projectiles, pickup movement and the 20 ms
active clock once, then resolves owned damage, deferred fragments and completion.
Death/respawn is per player; no firmware gameplay source changes are required.

`web_coop_start`, `web_coop_input`, `web_coop_pause` and `web_coop_player` form
co-op ABI v1. The read-only snapshot wraps a legacy 576-float player scene;
`web/src/runtime/coop-scene.mjs` centrally decodes its version, identity, timers, team total
and statistics. Copy the WASM view before requesting another player's scene.
Solo scene offsets and storage formats are preserved.

`web/src/input/coop-input.mjs` owns distinct devices, profiles, fresh input queues, ready
and release guards. `web/screens/coop.mjs` owns lobby, HUD, reassignment and
result presentation. The renderer draws the world once and both owned combat
layers, labels and shape markers. Co-op HUD has layout space above the arena.

`web/src/state/coop-records.mjs` owns version-1 JSON team leaderboards, five stable-ranked
entries, with separate friendly-fire-off/on keys. Team score can reach 1,999,998
(the sum of individual 999,999 caps); it never enters the legacy solo codec.
Personal bests reuse existing co-op/friendly-fire contexts for distinct profiles.
Reset snapshots and rolls back all record keys; settings remain independent.

For synthetic browser flow checks, run the production build followed by
`node web/tests/prepare-coop-browser.mjs`, then visit `/coop-browser.html`.
This locally generated harness supplies two clearly labeled synthetic pads.
Every production build removes that QA page. Test-only native fixture exports
remain absent from release WASM; the server refuses test WASM URLs.
