# Web architecture

The gameplay engine is the firmware's C++ compiled to WebAssembly; everything else is plain
ES modules, CSS and HTML with no runtime dependencies. This page is the map. For the rules of
play see [COMBAT.md](COMBAT.md); for the contributor workflow see [README.md](README.md).

```
web/
  src/                 browser code (copied as-is to dist/src)
    main.mjs           boots the App
    app/               composition root, game loop, input, menus, routing
    runtime/           the engine as the UI sees it: WASM host, runs, scene layout
    render/            canvas rendering: renderer, layers, backgrounds, effects
    boss/              boss presentation: scene decoding, painters, death, sound, UI
    screens/           one module per screen (DOM rendering and wiring)
    state/             persisted state: settings, records, hangar, navigation
    input/             controllers, keyboard/pad bindings, co-op input, calibration
    audio/             sound effects and music
    demo/              the isolated Home demo run
  native/              C++ built into game.wasm (see "Engine" below)
  html/ index.html     page template and one partial per screen
  styles/ style.css    CSS (see "Styles" below); theme.css imports the theme files
  dev/                 preview pages and tools (not part of the game)
  tools/               asset generators (Python) and build helpers
  tests/               node --test suites, goldens and a browser smoke walk
  assets/              art, fonts, sprite manifests
  build.mjs serve.mjs  build to dist/, local static server
```

## Dependency direction

`app → screens → state/input/runtime`, and `render` and `boss` only read the scene. Pure
logic (navigation, settings, records, scene decoding, run recording, initials entry) never
touches `document`. Controllers receive what they need from the `App` instance when they run.

## The scene ABI

The engine publishes each frame as one `Float32Array` (1408 floats). Every offset is named in
[src/runtime/scene-layout.mjs](src/runtime/scene-layout.mjs); `build.mjs` generates
`dist/gen/scene_layout.h` from it, and [native/scene.h](native/scene.h) writes the array with
those names. No other module may use a bare scene number (a test enforces this). Boss detail
lives in a block starting at `BOSS_AT`, decoded by [src/boss/scene.mjs](src/boss/scene.mjs).
Add a field in `scene-layout.mjs`, write it in `scene.h`, read it by name.

## App (src/app)

| Module | Role |
| --- | --- |
| `app.mjs` | Builds services, screens and controllers; loads the engine; `App.session` picks solo or co-op rules |
| `bootstrap.mjs` | Storage-backed services (settings, hangar, unlocks, audio) |
| `game-loop.mjs` | One `requestAnimationFrame` loop, exact 20 ms ticks, suspend/resume |
| `input-hub.mjs` | Held keys and buttons, mouse aim, active controller, last device |
| `keyboard-router.mjs`, `key-rebinder.mjs` | Keys to a modal dialog, a menu (Settings has extras) or the flight; key re-binding |
| `menu-navigator.mjs`, `menu-focus.mjs` | Menu scope, arrow/d-pad focus movement, select-edit mode, controller menu buttons |
| `screen-router.mjs` | Reacts to navigation changes: views, titles, decision dialog, focus restore, URL hash |
| `sessions.mjs` | `SoloSession` / `CoopSession`: everything that differs between the two |
| `presenter.mjs` | Per-frame canvas and DOM updates |
| `launch-controller.mjs`, `home-backdrop.mjs`, `presentation-clock.mjs`, `layout.mjs` | Warp overlay, Home layer, menu animation clock, playfield fitting |
| `settings-controller.mjs`, `ui-actions.mjs`, `boss-unlock-toast.mjs` | Settings glue, plain button handlers, unlock toast |

## Runtime (src/runtime)

`createRuntime(bytes, options)` returns a `Runtime`: `WasmHost` instantiates the engine and
bridges leaderboard storage; `RunRecorder` turns the end of a run into a result and writes the
records; `CoopRun` and `InitialsEditor` hold the co-op end screens that live outside the
engine. `coop-scene.mjs` decodes a co-op player's scene.

## Rendering (src/render)

`PixelRenderer.render(scene, players)` draws the region backdrop (`backgrounds*`), then an
ordered stack of layers (`layers/`: boss, rocks, spawn warning, pickups, bullets, particles,
players, effects, boss finale, cues) or a full-canvas screen. `SceneObserver` compares
consecutive scenes to create explosions and the boss finale; `PixelCanvas` draws sprites,
bitmap text, boxes and rays.

## Bosses (src/boss + native/boss)

| Presentation | |
| --- | --- |
| `scene.mjs` | `KINDS` (names, regions, sizes, phases, named `aux` slots), decoders |
| `render.mjs` + `body-painters.mjs`, `hazard-painters.mjs`, `shot-painters.mjs` | One painter per body, hazard kind and shot family |
| `death.mjs` + `death/` | Death sequences: shared effects in `fx.mjs`, scripts per region |
| `sound.mjs` + `sound/` | `Synth`, per-group sound books, window cues, `BossSound` observer |
| `ui.mjs`, `records.mjs`, `unlocks.mjs`, `guide.mjs`, `art.mjs` | Intro card and health bar, defeat counts, hull unlocks, field guide, sprite sheets |

## Engine (native)

`bridge.cpp` includes the firmware sources (`../src/*.cpp`) and the web layers into one
translation unit with no standard library. `exports/` holds the `web_*` functions grouped by
purpose (`game`, `practice`, `read`, `coop`, and `test` for the test build only).
`combat.h` and `coop.h` add the HD combat and two-player layers on top of the shared game.

Bosses: `boss/core.h` holds state and pools; `shots.h`, `hazards.h`, `hits.h`,
`scheduler.h`, `lifecycle.h` the framework. **The framework never switches on the boss kind.**
Each fight family (`boss/fights/*.h`: a boss and its mini) writes one `BossOps` row per kind
(home, health factor, phases, rests and hooks for begin, update, pick, run, circles, body,
phase, soak, hit); `boss/ops.h` collects them in `BossKind` order. Slots of `boss.aux` and
`boss.stamp` are named by `AUX_*` / `STAMP_*` enums at the top of each family file and by
`KINDS[kind].aux` in the UI.

Adding a boss: add its kind to `BossKind`, write its family header and `BossOps` row, add the
row to `BOSS_OPS`, add its entry to `KINDS`, its painter to `BODY_PAINTERS`, a sound group and a
death script, then its sprite sheet cells (`tools/`).

## Styles

`style.css` (shared primitives, screen controls) is the only sheet the dev pages load.
`index.html` additionally loads `styles/shell.css` (viewport geometry) and `theme.css`, which
imports `styles/theme/*.css` **in cascade order**: later files deliberately override earlier
ones, so keep the order. `node tools/prune-css.mjs` lists (and with `--write` removes)
declarations that a later same-selector rule always overrides.

## Verification

| Check | Command |
| --- | --- |
| All unit, golden and engine tests | `npm test` (from `web/`) |
| Format + lint + tests | `npm run check` |
| Firmware host tests | `sh tests/run_host.sh` (repository root) |
| Engine scene unchanged | `tests/scene-golden.test.mjs` (`UPDATE_GOLDEN=1` rewrites `tests/golden/`) |
| Rendering unchanged | `tests/render-golden.test.mjs` (recording canvas, `tests/render-harness.mjs`) |
| Boss sound unchanged | `tests/sound-golden.test.mjs` |
| Browser flow | serve, open the app, then `JSON.stringify(await (await import('/dev/smoke.mjs')).runSmoke())` |
| CSS unchanged | `dev/style-signature.mjs`: `walk('desktop', 'record')` before, `walk('desktop', 'compare')` after |

Goldens are characterisation tests: after a deliberate gameplay or art change, regenerate
them and review the diff; after a refactor they must not move.
