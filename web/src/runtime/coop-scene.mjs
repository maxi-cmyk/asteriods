import { S, BLOCKS, SCENE_FLOATS } from './scene-layout.mjs';
// Co-op scene ABI v1 wraps legacy read-only scenes (SCENE_FLOATS floats). Keep decoding
// here so UI controllers do not acquire another set of magic offsets.
export function decodeCoopPlayer(scene) {
    if (scene.length !== SCENE_FLOATS || scene[S.COOP_VERSION] !== 1)
        throw Error('Unsupported co-op scene');
    return {
        scene,
        id: scene[S.COOP_ID],
        x: scene[S.SHIP_X],
        y: scene[S.SHIP_Y],
        alive: !!scene[S.SHIP_ALIVE],
        lives: scene[S.LIVES],
        score: scene[S.SCORE],
        multiplier: scene[S.MULTIPLIER],
        chainMs: scene[S.CHAIN_MS],
        multishotMs: scene[S.MULTISHOT_MS],
        shield: scene[S.SHIELD] ? 'ARMED' : scene[S.SHIELD_STORED] ? 'STORED' : 'EMPTY',
        laserMs: scene[S.LASER_COOLDOWN_MS],
        charging: !!scene[S.CHARGING],
        chargeMs: scene[S.CHARGE_MS],
        respawnMs: Math.max(0, scene[S.COOP_RESPAWN_AT] - scene[S.GAME_MS]),
        participation: scene[S.COOP_PARTICIPATION],
        teamScore: scene[S.COOP_TEAM_SCORE],
        friendlyFire: !!scene[S.COOP_FRIENDLY_FIRE],
        stats: Object.fromEntries(
            [
                'cps',
                'peakCps',
                'spawned',
                'hits',
                'longestChain',
                'highestWave',
                'doubleFireMs',
                'laserShots',
                'laserKills',
                'presses',
                'pending',
            ].map((k, i) => [k, scene[BLOCKS.COOP_STATS.at + i]]),
        ),
    };
}
