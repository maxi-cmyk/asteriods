// The scene ABI: one table of float offsets shared by the engine and the UI.
// `build.mjs` turns it into native/scene_layout.h, so a field can only be moved here.
// Nothing outside this file (and the generated header) may use a bare scene offset.
export const SCENE_FLOATS = 1408;

// Single floats, in memory order. Names become SCENE_<NAME> in C++.
export const S = Object.freeze({
    STATE: 0,
    BROWSER_MS: 1,
    GAME_MS: 2,
    STATE_AGE_MS: 3,
    SHIP_X: 4,
    SHIP_Y: 5,
    SHIP_ALIVE: 6,
    LIVES: 7,
    INVINCIBLE_MS: 8,
    RESERVED_9: 9, // legacy heat/delay slots, always 0
    RESERVED_10: 10,
    LAST_SHOT_MS: 11,
    RESERVED_12: 12,
    RESERVED_13: 13,
    MULTISHOT_MS: 14,
    SHIELD: 15,
    SCORE: 16,
    MULTIPLIER: 17,
    CHAIN_MS: 18,
    WAVE: 19,
    PENDING_ROCKS: 20,
    SPAWN_Y: 21,
    SPAWN_WARNING: 22,
    WAVE_CUE: 23,
    COLLECT_CUE_MS: 24,
    COLLECT_X: 25,
    COLLECT_Y: 26,
    FINAL_SCORE: 27,
    SELECTED_INITIAL: 28,
    SAVED_RANK: 29,
    SAVE_FAILED: 30,
    SCORE_COUNT: 31,
    SHIP_RADIUS: 35,
    WAVE_SPEED: 36,
    VISUAL_MS: 37,
    SCREEN_W: 38,
    SCREEN_H: 39,
    SHIP_MAX_SPEED: 40,
    SHIP_MIN_X: 41,
    SHIP_MAX_X: 42,
    SHIP_MIN_Y: 43,
    SHIP_MAX_Y: 44,
    AIM_X: 45,
    AIM_Y: 46,
    CHARGING: 47,
    CHARGE_MS: 48,
    LASER_COOLDOWN_MS: 49,
    BEAM_MS: 50,
    BEAM_X: 51,
    BEAM_Y: 52,
    BEAM_DX: 53,
    BEAM_DY: 54,
    SHIELD_STORED: 55,
    PRECISION: 56,
    RUN_DESTROYED: 57,
    RUN_BEST_MULTIPLIER: 58,
    RUN_PRIOR_BEST: 59,
    PRACTICE: 60,
    SHAKE_OFFSET: 61,
    PRACTICE_GOALS: 62,
    PENDING_FAST: 63,
    PICKUP_ACTIVE: 478,
    PICKUP_X: 479,
    PICKUP_Y: 480,
    PICKUP_KIND: 481,
    // legacy boss header
    BOSS_ACTIVE: 512,
    BOSS_X: 513,
    BOSS_Y: 514,
    BOSS_HEALTH: 515,
    BOSS_MAXIMUM: 516,
    BOSS_STAGE: 517,
    BOSS_STAGE_MS: 518,
    BOSS_TARGET_Y: 519,
    BOSS_CYCLE: 520,
    BOSS_PLAYERS: 521,
    BOSS_WAVE: 522,
    BOSS_KILLS: 523,
    BOSS_TARGET_X: 524,
    // co-op player wrapper
    COOP_VERSION: 552,
    COOP_ID: 553,
    COOP_RESPAWN_AT: 554,
    COOP_PARTICIPATION: 555,
    COOP_TEAM_SCORE: 556,
    COOP_FRIENDLY_FIRE: 557,
});

// Arrays of records: first float, floats per record, record count.
export const BLOCKS = Object.freeze({
    INITIALS: { at: 32, stride: 1, count: 3 },
    ROCKS: { at: 64, stride: 8, count: 24 },
    BULLETS: { at: 256, stride: 6, count: 12 },
    PARTICLES: { at: 328, stride: 5, count: 30 },
    HIGHSCORES: { at: 486, stride: 5, count: 5 },
    COOP_STATS: { at: 560, stride: 1, count: 16 },
});

// Boss detail block. Offsets inside it are relative to BOSS.at.
export const BOSS = Object.freeze({
    at: 600,
    KIND: 0,
    MINI: 1,
    TIER: 2,
    DAMAGE: 3,
    FLASH_MS: 4,
    ATTACK: 5,
    ATTACK_MS: 6,
    GATE: 7,
    ENTRANCE: 8,
    PRACTICE: 9,
    DEFEATED_MASK: 10,
    HITS_TAKEN: 11,
    VIOLATIONS: 12,
    MAX_SHOTS: 13,
    MAX_HAZARDS: 14,
    MIN_CORRIDOR: 15,
    AUX: 16, // 16 floats of per-boss state
    AUX_COUNT: 16,
    PARTS: { at: 32, stride: 8, count: 32 },
    SHOTS: { at: 288, stride: 8, count: 48 },
    HAZARDS: { at: 672, stride: 12, count: 10 },
});

export const BOSS_AT = BOSS.at;
/** Absolute index of a field inside the boss block, e.g. `boss(BOSS.KIND)`. */
export const boss = (field) => BOSS.at + field;

/** First float of record `i` in a block. */
export const recordAt = (block, i) => block.at + i * block.stride;
/** Every record of a block as a view into the scene. */
export const records = (scene, block) =>
    Array.from({ length: block.count }, (_, i) =>
        scene.subarray(recordAt(block, i), recordAt(block, i + 1)),
    );
/** The three initials stored at `at`, as text. */
export const initialsAt = (scene, at) => String.fromCharCode(...scene.subarray(at, at + 3));
/** Initials being edited on the score entry screen. */
export const enteredInitials = (scene) => initialsAt(scene, BLOCKS.INITIALS.at);
/** The saved leaderboard: [{ initials, score }] for the first `count` entries. */
export function leaderboardEntries(scene, count = scene[S.SCORE_COUNT]) {
    return Array.from({ length: Math.min(count, BLOCKS.HIGHSCORES.count) }, (_, i) => {
        const at = recordAt(BLOCKS.HIGHSCORES, i);
        return { score: scene[at], initials: initialsAt(scene, at + 1) };
    });
}

/** The C++ side of the table: `#define`-free enum text for native/scene_layout.h. */
export function sceneHeader() {
    const lines = [
        '// Generated from scene-layout.mjs by build.mjs. Do not edit.',
        '#pragma once',
        '',
    ];
    lines.push(`static const unsigned SCENE_FLOATS = ${SCENE_FLOATS};`);
    lines.push('enum SceneField {');
    for (const [name, at] of Object.entries(S)) lines.push(`    SCENE_${name} = ${at},`);
    lines.push('};');
    for (const [name, b] of Object.entries(BLOCKS))
        lines.push(
            `enum { SCENE_${name}_AT = ${b.at}, SCENE_${name}_STRIDE = ${b.stride}, SCENE_${name}_COUNT = ${b.count} };`,
        );
    lines.push('enum BossSceneField {', `    SCENE_BOSS_AT = ${BOSS.at},`);
    for (const [name, v] of Object.entries(BOSS)) {
        if (name === 'at' || typeof v !== 'number') continue;
        lines.push(`    SCENE_BOSS_${name} = ${v},`);
    }
    lines.push('};');
    for (const name of ['PARTS', 'SHOTS', 'HAZARDS']) {
        const b = BOSS[name];
        lines.push(
            `enum { SCENE_BOSS_${name}_AT = ${BOSS.at + b.at}, SCENE_BOSS_${name}_STRIDE = ${b.stride}, SCENE_BOSS_${name}_COUNT = ${b.count} };`,
        );
    }
    return lines.join('\n') + '\n';
}
