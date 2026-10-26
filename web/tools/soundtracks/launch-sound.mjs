// The warp-jump sound between choosing a flight and the run starting. A low engine swell,
// rushing air and a rising major arpeggio build for 2.4 s, then the jump lands with a soft boom
// and a warm chord. It uses no fast pitch sweep, so it cannot read as a laser.
// Shapes follow Synth.tone / Synth.noise (boss/sound/synth.mjs).
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

export const LAUNCH_SECONDS = 3.2;
const IMPACT = 2.4;

export function launchSound() {
    const tones = [
        { at: 0, dur: IMPACT, f: 55, to: 110, type: 'sine', vol: 0.24, env: 'swell' },
        { at: 0.15, dur: IMPACT - 0.15, f: 82.4, to: 164.8, type: 'triangle', vol: 0.1, env: 'swell' },
    ];
    // A-major arpeggio that speeds up as it climbs.
    const climb = [
        [0.4, 57],
        [0.8, 61],
        [1.15, 64],
        [1.45, 69],
        [1.7, 73],
        [1.9, 76],
        [2.07, 81],
        [2.2, 85],
    ];
    climb.forEach(([at, n], i) =>
        tones.push({
            at,
            dur: 0.28,
            f: midi(n),
            type: 'square',
            vol: 0.035 + i * 0.006,
            atk: 0.004,
            echo: 0.5,
        }),
    );
    // The landing: an A-major chord that blooms and fades.
    for (const [n, vol] of [
        [45, 0.12],
        [57, 0.09],
        [61, 0.07],
        [64, 0.07],
        [69, 0.06],
        [73, 0.045],
        [76, 0.04],
    ])
        tones.push({ at: IMPACT, dur: 0.8, f: midi(n), type: 'triangle', vol, atk: 0.02, echo: 0.3 });
    tones.push({ at: IMPACT, dur: 0.5, f: 140, to: 38, type: 'sine', vol: 0.42, atk: 0.003 });
    const noises = [
        { at: 0, dur: IMPACT, f: 250, to: 3200, q: 1.1, type: 'bandpass', vol: 0.13, env: 'swell' },
        { at: IMPACT, dur: 0.55, f: 1100, to: 90, q: 0.8, type: 'lowpass', vol: 0.28, atk: 0.003 },
    ];
    return { seconds: LAUNCH_SECONDS, tones, noises, echo: { beats: 0.75, feedback: 0.35, mix: 0.3, bpm: 100 } };
}
