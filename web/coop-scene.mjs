// Co-op scene ABI v1 wraps legacy 576-float read-only scenes. Keep decoding
// here so UI controllers do not acquire another set of magic offsets.
export function decodeCoopPlayer(scene) {
    if (scene.length !== 576 || scene[552] !== 1) throw Error('Unsupported co-op scene');
    return {
        scene, id:scene[553], x:scene[4], y:scene[5], alive:!!scene[6], lives:scene[7],
        score:scene[16], multiplier:scene[17], chainMs:scene[18],
        multishotMs:scene[14], shield:scene[15] ? 'ARMED' : scene[55] ? 'STORED' : 'EMPTY',
        laserMs:scene[49], charging:!!scene[47], chargeMs:scene[48],
        respawnMs:Math.max(0,scene[554]-scene[2]), participation:scene[555],
        teamScore:scene[556], friendlyFire:!!scene[557],
        stats:Object.fromEntries(['cps','peakCps','spawned','hits','longestChain','highestWave','doubleFireMs','laserShots','laserKills','presses','pending'].map((k,i)=>[k,scene[560+i]])),
    };
}
