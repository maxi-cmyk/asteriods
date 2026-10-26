// Boss scene ABI. The engine (native/bridge.cpp) writes the legacy boss header at
// 512..524 and the detail block at BOSS_AT; everything the UI knows about a fight
// is decoded here so no other module carries magic offsets.
export const SCENE_FLOATS = 1408;
export const BOSS_AT = 600;
const PARTS_AT = BOSS_AT + 32,
    PART_STRIDE = 8,
    PART_COUNT = 32;
const SHOTS_AT = BOSS_AT + 288,
    SHOT_STRIDE = 8,
    SHOT_COUNT = 48;
const HAZARDS_AT = BOSS_AT + 672,
    HAZARD_STRIDE = 12,
    HAZARD_COUNT = 10;

export const SHOT = Object.freeze({
    needle: 0,
    shard: 1,
    bolt: 2,
    sine: 3,
    pellet: 4,
    missile: 5,
    mine: 6,
    lob: 7,
    spore: 8,
    ember: 9,
    curve: 10,
    fast: 11,
});
export const HAZARD = Object.freeze({
    lane: 0,
    pool: 1,
    beam: 2,
    ring: 3,
    arm: 4,
    tell: 5,
    arc: 6,
    aim: 7,
    pull: 8,
});
export const PART = Object.freeze({ blade: 0, panel: 1, hard: 2, bubble: 3, star: 4 });
export const ATTACK = Object.freeze({
    lance: 1,
    fan: 2,
    volley: 3,
    cross: 4,
    burst: 10,
    prism: 11,
    pick: 12,
    collapse: 13,
    lob: 20,
    jets: 21,
    ember: 22,
    nova: 23,
    cannon: 30,
    missile: 31,
    mines: 32,
    broadside: 33,
    sine: 40,
    tendril: 41,
    spore: 42,
    pulse: 43,
    spiral: 50,
    curve: 51,
    accrete: 52,
    pull: 53,
    bolts: 60,
    shards: 61,
    curve1: 62,
    blink: 63,
    sine6: 64,
});

// kind order matches BossKind in boss.h: six region bosses, then their six minis.
// `phases` are the health fractions at which a new phase begins (for bar notches).
export const KINDS = Object.freeze([
    {
        id: 'sentinel',
        name: 'Sentinel',
        region: 'frontier',
        mini: false,
        size: [220, 220],
        phases: [0.6],
        hull: null,
    },
    {
        id: 'ringwarden',
        name: 'Ringwarden',
        region: 'violet',
        mini: false,
        size: [270, 270],
        phases: [0.66, 0.33],
        hull: null,
    },
    {
        id: 'cinderforge',
        name: 'Cinderforge',
        region: 'ember',
        mini: false,
        size: [300, 300],
        phases: [0.66, 0.33],
        hull: null,
    },
    {
        id: 'bastion',
        name: 'Bastion',
        region: 'ruins',
        mini: false,
        size: [340, 196],
        phases: [0.5],
        hull: null,
    },
    {
        id: 'tidecaller',
        name: 'Tidecaller',
        region: 'lunar',
        mini: false,
        size: [230, 290],
        phases: [0.7, 0.35],
        hull: null,
    },
    {
        id: 'warden',
        name: 'Horizon Warden',
        region: 'rift',
        mini: false,
        size: [330, 330],
        phases: [0.7, 0.35],
        hull: null,
    },
    {
        id: 'picket',
        name: 'Picket',
        region: 'frontier',
        mini: true,
        size: [150, 150],
        phases: [],
        hull: 'dart',
    },
    {
        id: 'shardling',
        name: 'Shardling',
        region: 'violet',
        mini: true,
        size: [170, 170],
        phases: [],
        hull: 'lancer',
    },
    {
        id: 'cinderling',
        name: 'Cinderling',
        region: 'ember',
        mini: true,
        size: [150, 150],
        phases: [],
        hull: 'wasp',
    },
    {
        id: 'gunnery',
        name: 'Gunnery',
        region: 'ruins',
        mini: true,
        size: [200, 108],
        phases: [],
        hull: 'hammer',
    },
    {
        id: 'moonjelly',
        name: 'Moonjelly',
        region: 'lunar',
        mini: true,
        size: [150, 190],
        phases: [],
        hull: 'moth',
    },
    {
        id: 'lensimp',
        name: 'Lens Imp',
        region: 'rift',
        mini: true,
        size: [170, 170],
        phases: [],
        hull: 'comet',
    },
]);
export const REGION_SHEETS = Object.freeze([
    'frontier',
    'violet',
    'ember',
    'ruins',
    'lunar',
    'rift',
]);
export const TIER_NAMES = Object.freeze(['I', 'II', 'III', 'IV']);
export const kindName = (kind) => KINDS[kind]?.name ?? 'Boss';
export const kindForWave = (wave) => {
    if (wave >= 5 && wave % 5 === 0) return (wave / 5 - 1) % 6;
    if (wave >= 3 && wave % 5 === 3) return 6 + (((wave - 3) / 5) % 6);
    return -1;
};
export const bossNames = (mask) => KINDS.filter((_, i) => mask & (1 << i)).map((kind) => kind.name);

export function bossState(scene) {
    const at = BOSS_AT;
    return {
        active: !!scene[512],
        x: scene[513],
        y: scene[514],
        health: scene[515],
        maximum: scene[516],
        stage: scene[517],
        wave: scene[522],
        kills: scene[523],
        kind: scene[at],
        mini: !!scene[at + 1],
        tier: scene[at + 2],
        damage: scene[at + 3],
        flash: scene[at + 4],
        attack: scene[at + 5],
        attackMs: scene[at + 6],
        gate: scene[at + 7],
        entrance: scene[at + 8],
        practice: !!scene[at + 9],
        defeated: scene[at + 10],
        hitsTaken: scene[at + 11],
        aux: scene.subarray(at + 16, at + 32),
    };
}
export function bossParts(scene) {
    const out = [];
    for (let i = 0; i < PART_COUNT; i++) {
        const at = PARTS_AT + i * PART_STRIDE;
        if (scene[at])
            out.push({
                index: i,
                kind: scene[at + 1],
                x: scene[at + 2],
                y: scene[at + 3],
                r: scene[at + 4],
                hp: scene[at + 5],
                state: scene[at + 6],
                slot: scene[at + 7],
            });
    }
    return out;
}
// Parts including broken ones (the forge's panels stay on the shell once blown out).
export function bossPart(scene, index) {
    const at = PARTS_AT + index * PART_STRIDE;
    return {
        index,
        exists: !!scene[at],
        kind: scene[at + 1],
        x: scene[at + 2],
        y: scene[at + 3],
        r: scene[at + 4],
        hp: scene[at + 5],
        state: scene[at + 6],
        slot: scene[at + 7],
    };
}
export function bossShots(scene) {
    const out = [];
    for (let i = 0; i < SHOT_COUNT; i++) {
        const at = SHOTS_AT + i * SHOT_STRIDE;
        if (scene[at])
            out.push({
                index: i,
                family: scene[at + 1],
                x: scene[at + 2],
                y: scene[at + 3],
                angle: scene[at + 4],
                hp: scene[at + 5],
                age: scene[at + 6],
                aux: scene[at + 7],
            });
    }
    return out;
}
export function bossHazards(scene) {
    const out = [];
    for (let i = 0; i < HAZARD_COUNT; i++) {
        const at = HAZARDS_AT + i * HAZARD_STRIDE;
        if (scene[at])
            out.push({
                index: i,
                kind: scene[at + 1],
                x: scene[at + 2],
                y: scene[at + 3],
                a: scene[at + 4],
                b: scene[at + 5],
                c: scene[at + 6],
                d: scene[at + 7],
                e: scene[at + 8],
                warn: scene[at + 9],
                warnTotal: scene[at + 10],
                live: scene[at + 11],
            });
    }
    return out;
}
