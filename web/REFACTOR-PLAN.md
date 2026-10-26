# Refactoring plan

Goal: smaller files, one reason to change per module, no behaviour change.
Every phase is a series of small commits that leave `npm test`, `sh tests/run_host.sh`
and the browser flow green. Nothing here changes gameplay, the saved-data formats,
or the WASM export names.

## 1. What is wrong today (measured)

| Hotspot | Size | Problem |
| --- | --- | --- |
| `web/application.mjs` | 1388 lines, ~50 top-level functions, ~40 module-level `let`s | Composition root *and* input router, game loop, menu focus engine, launch controller, settings glue, route lifecycle and HUD presenter. The `keydown` listener alone is 210 lines; `screenChanged` ~100; `draw` ~105. 57 `coop` branches. |
| `web/runtime.mjs` | one 250-line closure, 39 `coop` refs | WASM host, storage bridge, solo run/result bookkeeping, co-op run/result bookkeeping and the co-op initials editor share closure variables. |
| Scene ABI | 1408 floats read by bare index (`scene[19]`, `scene[610]`, `scene[61]`…) | 69 uses in `renderer.mjs` alone, ~110 across 13 files. Offsets are defined three times (bridge.cpp `web_scene`, `boss-scene.mjs`, tests). `web_scene()` is a 190-line function. |
| `web/renderer.mjs` | 384 lines | `world()` draws rocks, pickups, bullets, particles, lasers, ships, finale and cues in one 80-line method; `WIDTH/HEIGHT` are defined in 3 files. |
| `web/boss-render.mjs` | `body()` 99-line `switch` on kind | Per-boss drawing mixed with the dispatcher. |
| `web/boss-sound.mjs` | `voice()` is a 230-line closure; `observe()` has `kind === 2 \|\| kind === 8` style special cases | Synth primitives, the per-boss sound book and the scene-diff logic are one file. |
| `web/native/boss_fights.h` | 912 lines, 7 `switch (boss.kind)` dispatchers, 48 bare `aux[n]` and 33 `stamp[n]` uses | Six boss families plus six minis in one header. Slot meaning lives in the author's head. |
| `web/native/boss.h` | 828 lines | Pools, geometry, hit routing, scheduler, damage and lifecycle in one unity-build header. |
| `web/native/bridge.cpp` | 767 lines | Platform shims, ~40 exports, scene serialisation and `web_test_*` hooks. |
| `web/theme.css` | 2571 lines | One file for every screen. Later sections override earlier ones (“Home buttons: bigger”, “Less chrome, less copy”, “Gameplay: no dead bands”). Four CSS owners (`shell.css`, `theme.css`, `styles/*`). |
| `web/index.html` | 752 lines | Every screen's markup in one file. |
| `web/build.mjs` | hard-coded 60-file list | Forgetting to add a module caused two 404s this month. |
| Formatting | 2-space, 4-space and “compressed” (`if(runtime.coop){…}`) mixed, often in one file | Noisy diffs and hard reading. |
| `web/` root | 38 flat `.mjs` files | Game code, boss code, dev pages (`gallery`, `showcase`, `art-grade`, `boss-attacks`) and tools sit side by side. |
| `docs/ARCHITECTURE.md` | still describes a 576-float scene and “task 5” | Out of date. (`docs/` is git-ignored; see step 7.) |

Firmware (`src/`, 2.5k lines) is small and conventional C-style; it is **out of scope** except for
splitting the 1057-line `tests/host/game_test.cpp` (phase 6).

## 2. Ground rules

1. **No behaviour change in a refactor commit.** If a bug shows up, fix it in its own commit.
2. **Characterisation first** (phase 0). We do not move code that has no test or golden to catch drift.
3. One module per commit where possible; commit message states “move”, “extract” or “rename”, never mixed.
4. Dependencies point one way: `platform (dom/audio/storage) → services → controllers → screens`.
   Pure logic (navigation, settings, records, scene decoding, unlock rules) never touches `document`.
5. Replace option-bag mega-parameters (`renderPlayChrome({runtime, navigation, showResults, canvas, …13 keys})`)
   with one small injected context object per layer (see 3.2).
6. Constants over magic numbers: scene offsets, aux slots, screen names, element ids.

## 3. Target architecture

### 3.1 Folder layout (JS)

```
web/
  src/
    main.mjs                  # was app.mjs: boots, nothing else
    app/                      # composition + lifecycle
      app.mjs                 # builds services, controllers, wires them (target ≤ 200 lines)
      game-loop.mjs           # GameLoop: rAF, 20 ms accumulator, suspend/resume
      input-hub.mjs           # InputHub: keys, pointer, pads, device tracking
      keyboard-router.mjs     # KeyboardRouter: settings | menu | play handlers
      menu-focus.mjs          # MenuFocus: d-pad/arrow focus engine, tab stepping, edit mode
      screen-router.mjs       # ScreenRouter: enter/leave hooks, titles, decision dialog, hash, focus restore
      launch-controller.mjs   # LaunchController: warp overlay + presentation clock
      layout.mjs              # fitCanvas / letterbox bars
      presenter.mjs           # Presenter: per-frame DOM + canvas updates (was draw())
      sessions.mjs            # SoloSession / CoopSession strategy (see 3.2)
    runtime/
      wasm-host.mjs           # WasmHost: instantiate, imports, score-storage bridge
      runtime.mjs             # Runtime: facade used by the app (state, step, scene, result)
      run-recorder.mjs        # RunRecorder: finishRun/finishCoop → result + records
      initials-editor.mjs     # InitialsEditor (co-op initials entry state machine)
      scene.mjs               # SceneView + generated layout constants (see 3.3)
    render/
      constants.mjs           # WIDTH, HEIGHT, COLOUR (one definition)
      art.mjs                 # loadArt, image cache
      pixel-canvas.mjs        # PixelCanvas: sprite/text/box/ray primitives
      renderer.mjs            # PixelRenderer: orchestrates layers only
      layers/                 # rocks, pickups, bullets, particles, laser, ships, finale, cues, boss
      backgrounds/            # raster.mjs, regions.mjs (per-region painters), fight-scenery.mjs, index.mjs
      fx.mjs  presentation.mjs
    boss/
      kinds.mjs               # KINDS table: the one place per-kind metadata lives
      scene.mjs  art.mjs  records.mjs  unlocks.mjs  ui.mjs
      bodies/                 # one painter per kind (sentinel.mjs … lensimp.mjs) + registry
      hazards.mjs  shots.mjs
      death/                  # fx.mjs (helpers) + scripts/{frontier,violet,ember,ruins,lunar,rift}.mjs
      sound/                  # synth.mjs, book/{group}.mjs, observer.mjs
    audio/  music.mjs  audio.mjs
    input/  controls.mjs  coop-input.mjs  coop-menu.mjs  calibration.mjs  menu-fields.mjs
    state/  settings.mjs  records.mjs  coop-records.mjs  hangar.mjs  navigation.mjs
    screens/                  # unchanged names; each exports createXScreen(ctx) with render()/open()/close()
  dev/                        # gallery, showcase, art-grade, boss-attacks, boss-guide (+ their html)
  styles/ (see 3.5)  html/ (see 3.6)  native/ (see 3.4)  tools/  tests/
```

Moves are done with `git mv` in one dedicated commit per folder (history follows), then the import
paths are fixed mechanically. `build.mjs` copies `src/**` by glob so a new module can never 404 again.

### 3.2 `application.mjs` → classes

| New unit | Takes from application.mjs | Notes |
| --- | --- | --- |
| `InputHub` | `physicalKeys`, `pointerButtons`, `pointerPosition`, `activePadIndex`, `connectedPads`, `findController`, the 4 ms poll, `menuDevice`, `gameplayReady`, pointer/keyup/gamepad listeners | Owns every raw-input listener. Exposes `pad()`, `held()`, `aim(canvasRect)`, `clear()`. |
| `KeyboardRouter` | the 210-line `keydown` listener | Three small handlers chosen by `ScreenRouter.mode` (`settings` / `menu` / `play`); rebind flow becomes `KeyRebinder` (a class with `begin(action)`, `handle(event)`, `cancel()`), removing the triplicated “cancel rebinding and refocus” code. |
| `MenuFocus` | `menuScope`, `moveMenuFocus`, `moveMenuFocusToward`, `scrollerOf`, `onScreen`, `stepMenuTab`, `handleMenuPad`, `menuEditing`, `consumeDemo` call sites | Pure DOM-focus logic with a `scope()` callback, so it is unit-testable with a fake DOM. |
| `GameLoop` | `frame`, `advanceSimulation`, accumulator, `suspended`, `suspend`, focus/blur/visibility listeners | Takes `{ session, navigation, presenter }`; knows nothing about DOM ids. |
| `SoloSession` / `CoopSession` | every `runtime.coop ? … : …` (57 branches) | Common interface: `sample(now)`, `step(dt)`, `keyboardControls()`, `ready()`, `canResume()`, `onPause()`, `onDisconnect()`, `bossUnlockProfiles()`. Branching happens once, when a run starts. |
| `ScreenRouter` | `screenChanged`, `navigate`, `focusOrigins`, hash/history, decision dialog, `titles` | Screens register `{ title, enter(prev), leave(next), scope }`; the 100-line `if (screen === …)` chain disappears. |
| `Presenter` | `draw()` | Holds ordered list of `{ render(frame) }` presenters (hud, results, records, practice, boss ui, coop, diagnostics); receives one `frame` object `{ scene, runtime, navigation, set(el, text) }` instead of 13-key bags. |
| `LaunchController` | `beginLaunch`, `launch`, `presentationTime`, warp canvas, skip button, capture-phase key listener | |
| `SettingsController` | `persistSettings`, `syncSettingsEffects`, `applyDraft`, reset, calibration glue | Merged into `screens/settings.mjs` factory where it already lives conceptually. |
| `BossUnlockTracker` | `trackBossUnlocks`, `lastBossMask`, toast timer | Into `boss/unlocks.mjs` + `boss/ui.mjs` (toast element belongs to the boss UI). |
| `bootstrap.mjs` | storage, profile store, hangar, unlocks, reduced-motion default | Returns one `services` object. |
| `dom.mjs` | `update(el, text)` helper copy-pasted into `draw()` | `setText(el, text)` exported once. Cached `ids` object so screens stop calling `element('…')` in per-frame code. |

`application.mjs` ends as roughly: `bootstrap()` → construct services → `new App(services).start()`.

`runtime.mjs`: `createRuntime` becomes `class Runtime` composed of `WasmHost`, `RunRecorder`, `InitialsEditor`;
solo and co-op share `RunRecorder.finish(summary)`; no shared closure variables.

### 3.3 One source of truth for the scene ABI

1. New `web/src/runtime/scene-layout.mjs` is a declarative table:
   `{ state: 0, browserMs: 1, gameMs: 2, … shipX: 4, … wave: 19, … boss: { base: 600, parts: { at: 32, stride: 8, count: 32 }, … } }`.
2. `build.mjs` generates `native/scene_layout.h` (`enum SceneField { SCENE_STATE = 0, … }`) from it before compiling, so C++ and JS cannot drift.
3. `SceneView` wraps the `Float32Array` with named getters (`scene.wave`, `scene.ship.x`, `scene.rocks()`, `scene.boss`) and replaces `record(scene, 64, 8, 24)`-style helpers and `decodeCoopPlayer`. All 110 bare `scene[n]` reads go through it.
4. C++: split `web_scene()` into `scene_export_core / entities / boss / highscores` in `native/scene.h` (each ≤ 40 lines), using the generated enum.
5. Golden test: a seeded 600-tick scripted run, hash of the scene at ticks 0/100/…/600 for solo, co-op and one boss practice per kind. Created **before** step 2–4 and asserted unchanged after.

### 3.4 Native engine

Constraint: single translation unit, no stdlib, firmware `.cpp` files `#include`d by `bridge.cpp`. Keep that; reorganise *inside* it.

```
native/
  bridge.cpp                # includes + platform shims (memcpy/memset/random) only (~120 lines)
  exports.h                 # web_* exports grouped by area
  scene.h  scene_layout.h   # serialisation (generated layout)
  test_exports.h            # web_test_* (#ifdef WEB_TEST)
  combat.h  coop.h          # unchanged boundaries
  boss/
    core.h                  # constants, enums, structs, boss state, small math (bs_clamp, bs_atan2…)
    shots.h  hazards.h      # pools, spawn helpers, update, telegraph enforcement
    hits.h                  # circles, bs_first_circle, bs_laser, damage/defeat, K table
    scheduler.h             # BossRow, bs_seq_pick, rest, frenzy
    lifecycle.h             # setup/begin/practice/tick/update, player-hit hooks
    ops.h                   # struct BossOps + registry
    fights/ sentinel.h ringwarden.h cinderforge.h bastion.h tidecaller.h warden.h minis.h
```

* **Replace the 7 `switch (boss.kind)` dispatchers with a function-pointer table.**
  `struct BossOps { begin, update, pick, run, rest, circles, body, phase, hit; }` and `static const BossOps BOSS_OPS[BK_COUNT]`.
  Each `fights/*.h` defines its own ops and registers rows for its main kind and its mini. Adding a boss no longer touches framework code. (Function pointers/static tables work in the freestanding wasm build; no vtables or RTTI needed.)
* **Name every `aux[n]` and `stamp[n]`.** Per fight: `enum RingAux { RW_ROT, RW_OPEN, … }` next to the code that uses it; scene export keeps writing the same floats, and the JS side reads them through `KINDS[kind].aux` names (also used by sound cues, below).
* Move per-kind tables (`home`, `rest`, `BOSS_K`, sequences) into the fight that owns them.
* `bridge.cpp`: the ~40 `web_*` exports grouped by area in `exports.h`; test hooks isolated.
* Do **not** touch `src/*.cpp` firmware structure in this plan.

### 3.5 CSS

```
styles/
  tokens.css        # :root variables, fonts
  base.css          # reset, typography, controls (buttons, tabs, fields), panels
  shell.css         # viewport geometry (today's shell.css)
  hud.css           # play HUD, abilities, bars, practice tag
  screens/home.css mode.css hangar.css settings.css pause.css results.css records.css coop.css help.css
  boss.css          # boss HUD, picker, unlock toast
  index.css         # @imports in order (or a build-time concat; see below)
```

Method: cut `theme.css` by its existing section comments (22 sections) with no edits → then, per file, merge the “override” sections into the rule they override and delete the dead declarations. Check each merge with before/after screenshots of every screen at 3 viewports (1280×800, 800×600, 390×844) via the browser pane; no rule is deleted without a screenshot diff. If the ~15 `@import` requests that result matter for load time, `build.mjs` concatenates them into `dist/style.css` (no new dependency).

### 3.6 HTML

`index.html` is split into `html/<screen>.html` partials plus a small shell; `build.mjs` stitches `<!-- @include screens/home.html -->` markers into `dist/index.html`. Element ids stay identical so nothing in JS or tests changes.

### 3.7 Rendering and boss presentation

* `PixelRenderer.world()` → ordered **layers**: `RockLayer`, `PickupLayer`, `BulletLayer`, `ParticleLayer`, `LaserLayer`, `ShipLayer`, `FinaleLayer`, `CueLayer`, `BossLayer`, each `{ draw(ctx, view, time) }` and sharing a `PixelCanvas` instance (text/sprite/box). Co-op vs solo becomes “which players list the layers iterate”, not nested conditionals.
* `BossLayer.body()` → `BODY_PAINTERS[kind]` registry; each painter ≤ 30 lines in `boss/bodies/`. The hazard painters (`lane/pool/beam/ring/arm`) get the same registry by `HazardKind`.
* `boss-death.mjs`: helpers (`shake, fireball, rays, ring…`) → `death/fx.mjs`; the 12 scripts grouped by region file.
* `boss-sound.mjs`: `voice()` closure → `Synth` class (`tone`, `noise`, `envelope`) + the per-group books in `sound/book/*.mjs`; `observe()` becomes data-driven: `KINDS[k].cues = [{ aux: 1, edge: 'rise', sound: 'open' }, …]` replaces the `kind === 5 && aux(1) …` chain.
* `backgrounds.mjs`: `Raster` class → own file; region painters (`frontier…rift`) → table; scenery for fights → own module.
* `WIDTH/HEIGHT` → `render/constants.mjs`, imported everywhere.

### 3.8 Tooling and conventions (do first, mechanically)

* `.editorconfig` + Prettier (4 spaces, single quotes, 100 cols) for `web/**/*.{mjs,css,html}`; run once as an isolated commit and list it in `.git-blame-ignore-revs`.
* Minimal ESLint (`no-undef`, `no-unused-vars`, `no-shadow`) to surface dead exports left from earlier iterations (`loadSettings`/`saveSettings`, `PixelRenderer.comparison`, etc. — audit, don't assume).
* `npm run check` = prettier --check + eslint + tests. `npm test` stays as is.
* Python tools: move to `web/tools/art/`, shared `Canvas`/palettes stay in `boss_facets.py`; no logic change.

## 4. Phases (in order) with exit criteria

| # | Phase | Work | Exit criteria | Risk |
| --- | --- | --- | --- | --- |
| 0 | Safety net | Record baseline (`npm test` 183 + `tests/run_host.sh`); add the scene **golden hash test** (solo, co-op, 12 boss practices); add a fake-DOM smoke test that boots `application` far enough to `navigation.request('home')` if feasible, otherwise a scripted browser-pane checklist (Home → mode → launch → play → pause → settings → records → hangar → results); screenshots of every screen at 3 viewports kept in `assets/screenshots/baseline/` | Goldens pass on current HEAD | low |
| 1 | Formatting & tooling | `.editorconfig`, Prettier, ESLint, blame-ignore; dead-code report | One formatting-only commit; tests unchanged | low |
| 2 | Scene ABI | `scene-layout.mjs`, generated `scene_layout.h`, `SceneView`, `scene.h` split; migrate readers file by file (renderer, play HUD, runtime, audio, practice, results, coop-scene, gallery, tests) | No bare `scene[<number>]` left (grep gate); goldens identical | medium |
| 3 | Folder moves + glob build | `git mv` into `src/…`, `dev/…`; fix imports; `build.mjs` globbing | Build passes, preview pages load, no 404 in network log | low |
| 4 | `application.mjs` split | In this order: `bootstrap`, `layout`, `LaunchController`, `MenuFocus`, `KeyboardRouter`+`KeyRebinder`, `InputHub`, `ScreenRouter`, `Presenter`, `GameLoop`, `Solo/CoopSession`; `runtime.mjs` → `WasmHost/RunRecorder/InitialsEditor` | `application.mjs` ≤ 200 lines; no `runtime.coop` branch outside `sessions.mjs` and `screens/coop.mjs`; browser checklist passes (keyboard, mouse, pad, co-op) | **high** (input timing) – land one unit per commit and run the checklist each time |
| 5 | Render & boss presentation | layers, body/hazard painters, death scripts, synth/books, data-driven sound cues, `backgrounds` split | All files ≤ 400 lines, every function ≤ 60; gallery/attack/death sheets byte-identical to baseline PNGs | medium |
| 6 | Native engine | `BossOps` table, split `boss.h`/`boss_fights.h`, named aux/stamp, `bridge.cpp` split; split `tests/host/game_test.cpp` by module | Goldens + 22 boss tests + bot clears all 12 fights; wasm size ±2% | **high** – do one fight family per commit |
| 7 | CSS & HTML | stylesheet split without edits, then merge overrides; HTML partials | Screenshot diff ≤ tolerance on all screens/viewports; `theme.css` gone | medium |
| 8 | Docs | Rewrite `docs/ARCHITECTURE.md` (and un-ignore it or copy it to `web/ARCHITECTURE.md`), update `web/README.md`, `COMBAT.md` file references, `assets/README.md` preview paths | Docs match the tree | low |

Phases 4, 6 and 7 touch disjoint files, so after phases 0–3 they can run in parallel sessions/worktrees.

## 5. Size targets after the refactor

| Kind | Target |
| --- | --- |
| JS module | ≤ 300 lines (renderer-art scripts such as death/sound books ≤ 400) |
| JS function | ≤ 50 lines |
| C++ header | ≤ 400 lines |
| CSS file | ≤ 500 lines |
| `application.mjs` | ≤ 200 lines |
| Magic scene indexes | 0 |
| Per-kind `switch` in engine | 0 (table dispatch) |

## 6. Things deliberately *not* done

* No framework, bundler or TypeScript migration (JSDoc `@ts-check` on `SceneView` and the services objects is optional later).
* No firmware (`src/`, `include/`) restructuring; no change to the 42-byte leaderboard, storage keys, WASM exports or scene width.
* No visual or balance changes (including `BOSS_K`, rests, art).

## 7. Open decisions (defaults chosen; change if you disagree)

1. **Folder move to `web/src/`** (default: yes). Costs one noisy rename commit; breaks any bookmarks to `dist/` module paths.
2. **Prettier + ESLint** as dev dependencies (default: yes; they are dev-only, the shipped site stays dependency-free).
3. **Where architecture docs live**: `docs/` and `assets/` are in `.gitignore` (some files in them are tracked anyway). Default: keep `docs/ARCHITECTURE.md` and add a tracked `web/ARCHITECTURE.md` pointer so the map is versioned.
4. **CSS delivery**: native `@import` (today) vs build-time concat. Default: concat in `build.mjs`.
