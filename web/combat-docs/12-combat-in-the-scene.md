# 12 · Combat state in the scene

The UI never calls into the combat code; it reads the scene (`Float32Array`, 1408 floats) written
once per tick by `native/scene.h`. Layout table: `src/runtime/scene-layout.mjs` (never use bare
numbers; names come from `S`, `BLOCKS`, `BOSS`). Decoder: `src/boss/scene.mjs`.

## Player combat fields (`S.*`, written in `scene_core`, web build only)

`AIM_X/Y`, `CHARGING`, `CHARGE_MS`, `LASER_COOLDOWN_MS`, `BEAM_MS`, `BEAM_X/Y`, `BEAM_DX/DY`,
`SHIELD_STORED`, `SHIELD` (armed), `MULTISHOT_MS`, `PRECISION`, `PRACTICE`, `PRACTICE_GOALS`,
plus shared state: `SHIP_X/Y`, `LIVES`, `INVINCIBLE_MS`, `SCORE`, `MULTIPLIER`, `CHAIN_MS`, `WAVE`.
Entity blocks: `ROCKS` (24 × 8), `BULLETS` (12 × 6), `PARTICLES` (30 × 5), `HIGHSCORES` (5 × 5).

## Boss header (`S.BOSS_*`, floats 512–524)

`BOSS_ACTIVE`, `BOSS_X/Y`, `BOSS_HEALTH`, `BOSS_MAXIMUM`, `BOSS_STAGE` (phase), `BOSS_STAGE_MS`
(ms in this phase), `BOSS_TARGET_X/Y`, `BOSS_CYCLE` (attack count mod 2), `BOSS_PLAYERS`, `BOSS_WAVE`,
`BOSS_KILLS`.

## Boss detail block (`BOSS`, starts at float 600; offsets relative to `BOSS.at`)

| Field | Source |
| --- | --- |
| `KIND`, `MINI`, `TIER` | `boss.kind`, `boss.mini`, `boss.tier` |
| `DAMAGE` | 0 healthy, 1 below ⅔ health, 2 below ⅓ (selects the sprite state) |
| `FLASH_MS` | remaining hit flash |
| `ATTACK`, `ATTACK_MS` | current attack id (0 resting) and its age |
| `GATE` | `aux[0]` shortcut (Sentinel gate) |
| `ENTRANCE` | 0…1 progress of the 1400 ms entrance |
| `PRACTICE`, `DEFEATED_MASK` | flags |
| `HITS_TAKEN`, `VIOLATIONS`, `MAX_SHOTS`, `MAX_HAZARDS`, `MIN_CORRIDOR` | fairness telemetry (08) |
| `AUX` ×16 | `boss.aux[0…15]`, meaning per kind (table below) |
| `PARTS` 32 × 8 | `exists, kind, x, y, r, hp, state, slot` |
| `SHOTS` 48 × 8 | `active, family, x, y, angle (atan2 of velocity), hp, age ms, amp (or life for lobs)` |
| `HAZARDS` 10 × 12 | `active, kind, x, y, a, b, c, d, e, warn_left, warn_total, live_left` |

The scene sizes are checked against the engine's pools by `static_assert`
(`BOSS_PARTS == SCENE_BOSS_PARTS_COUNT`, …).

`aux` holds only what the **painters need**; `stamp[]` and `scratch[]` are private to the engine
and not exported. The UI derives sound cues and effects by comparing consecutive scenes
(`src/boss/sound/observer.mjs`), not from events.

## `aux` slots by boss (enums at the top of each fight file)

| Boss | aux slot → meaning |
| --- | --- |
| Sentinel / Picket | 0 gate open (0…1), 1 busy |
| Ringwarden | 0 ring scale, 1 outer spin, 2 inner spin, 3 core charging |
| Shardling | 2 blade spin, 4 kite x |
| Cinderforge | 0 shell heat, 1 shell open |
| Cinderling | 0 glow, 1 open |
| Bastion | 0 cannon firing, 1 pods open, 2 armour shown, 8…15 queued bolts (2 × x, y, angle, fire time) |
| Gunnery | 0 firing, 8…15 bolts |
| Tidecaller | 0 clock, 2 bell exposed |
| Moonjelly | 0 clock |
| Horizon Warden | 0 clock, 1 core window open, 2 busy, 3 accretion pass, 4 cloak (0.25 tell, 1 gone, 0.75 returning), 5 mirror (0.5 forming, 1 up), 8…15 bolts |
| Lens Imp | 0 clock, 1 blink |

Private `stamp[]` slots (not exported): Cinderforge/Cinderling 0 open-until; Warden 1 next window,
3 cloak-until, 4 pull used; Tidecaller 0 bare-since, 2 reformed; Bastion 2 revived, 3 gunless-since;
Lens Imp 3 blink-until. `scratch[]`: per-attack random picks (Tidecaller streams and walls,
Cinderforge hammers/geysers/vents, Warden cloak fan angle).

## Enumerations the UI mirrors

`BossKind` (12), `ShotFamily` (12), `HazardKind` (10), `PartKind` (6), and attack ids
(`SA_*`, `RA_*`, `CA_*`, `BA_*`, `TA_*`, `WA_*`/`WX_*`, `MA_*`) are duplicated in
`src/boss/scene.mjs` as `KINDS`, `SHOT`, `HAZARD`, `PART`, `ATTACK`. If you add one in C++ you must
add it there too; `boss-sound.test.mjs` and the render golden catch a missing name.

## Co-op scene

`web_coop_player(owner)` swaps that pilot in (11), copies `web_scene()`, and fills the co-op header
(`COOP_VERSION` 1, `COOP_ID`, `COOP_RESPAWN_AT`, `COOP_PARTICIPATION`, `COOP_TEAM_SCORE`,
`COOP_FRIENDLY_FIRE`, and the stats block `COOP_STATS`). The world and boss fields are identical in
both pilots' scenes; only the pilot-owned fields differ.

## Adding a combat field to the scene

1. Add the name/offset to `scene-layout.mjs` in a free slot (never reuse reserved ones).
2. Write it in `scene_core` / `scene_boss` (`native/scene.h`).
3. Read it by name in JS. Update the scene golden (`npm test`, review the diff).
4. If it is a new array, add its size to the `static_assert`s.

## Why this matters for networking

A remote client needs only these floats to draw the fight. The engine decides, the scene describes;
the network design (`docs/NETWORK-AND-SECURITY.md`) sends compressed deltas of exactly this data.
