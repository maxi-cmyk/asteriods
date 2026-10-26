import { ATTACK, HAZARD, SHOT } from '../../scene.mjs';
import { arp, boom } from '../shapes.mjs';

export const ringwarden = {
    sting: (v) => {
        for (let i = 0; i < 6; i++)
            v.tone({
                f: 880 * 1.5 ** (i % 3) * (1 + i * 0.02),
                type: 'sine',
                at: i * 0.09,
                dur: 1.2,
                vol: 0.07,
            });
        v.tone({ f: 220, to: 330, type: 'triangle', dur: 1.4, vol: 0.1, env: 'swell' });
    },
    charge: {
        [ATTACK.burst]: (v, d) => {
            for (let i = 0; i < 5; i++)
                v.tone({
                    f: 700 * (1 + i * 0.5),
                    to: 760 * (1 + i * 0.5),
                    type: 'sine',
                    dur: d,
                    vol: 0.045,
                    env: 'swell',
                    detune: i * 7,
                });
        },
        [ATTACK.prism]: (v, d) => {
            v.tone({ f: 500, to: 3000, type: 'sine', dur: d, vol: 0.09, env: 'swell' });
            v.tone({ f: 1000, to: 6000, type: 'sine', dur: d, vol: 0.03, env: 'swell' });
        },
        [ATTACK.pick]: (v, d) =>
            arp(v, [1760, 1760, 1760], d / 4, { type: 'sine', vol: 0.07, dur: 0.08 }),
        [ATTACK.collapse]: (v, d) => {
            v.tone({
                f: 2400,
                to: 160,
                type: 'sine',
                dur: d,
                vol: 0.1,
                env: 'decay',
                atk: 0.05,
            });
            v.tone({ f: 1200, to: 80, type: 'triangle', dur: d, vol: 0.08 });
        },
    },
    live: {
        [HAZARD.beam]: (v) => {
            v.tone({
                f: 1600,
                to: 1250,
                type: 'sine',
                dur: 1.7,
                vol: 0.09,
                env: 'pulse',
                vib: { rate: 6, depth: 60 },
            });
            v.tone({ f: 800, type: 'triangle', dur: 1.7, vol: 0.06, env: 'pulse' });
            v.noise({ dur: 1.7, vol: 0.04, f: 5000, type: 'highpass', env: 'pulse' });
        },
        [HAZARD.ring]: (v) => {
            boom(v, 0.9);
            v.tone({ f: 1760, to: 440, type: 'sine', dur: 0.9, vol: 0.08 });
        },
    },
    shot: {
        [SHOT.shard]: (v) => {
            v.tone({ f: 2400, to: 1800, type: 'sine', dur: 0.12, vol: 0.06 });
            v.tone({ f: 3600, type: 'sine', at: 0.02, dur: 0.1, vol: 0.04 });
        },
        [SHOT.fast]: (v) => {
            v.tone({ f: 4200, to: 1200, type: 'sine', dur: 0.09, vol: 0.07 });
        },
    },
    part: (v) => {
        v.noise({ dur: 0.16, vol: 0.13, f: 7000, type: 'highpass' });
        v.tone({ f: 3000, to: 1200, type: 'sine', dur: 0.1, vol: 0.06 });
        v.tone({ f: 4500, to: 2000, type: 'sine', at: 0.03, dur: 0.1, vol: 0.04 });
    },
    hit: (v) => v.tone({ f: 1800, to: 1400, type: 'sine', dur: 0.07, vol: 0.06 }),
    defeat: (v) => {
        // a cascade of shattering glass over a falling chord
        for (let i = 0; i < 14; i++) {
            v.noise({ at: i * 0.07, dur: 0.18, vol: 0.1, f: 8000 - i * 300, type: 'highpass' });
            v.tone({
                f: 4000 - i * 180,
                to: 1200,
                type: 'sine',
                at: i * 0.07,
                dur: 0.16,
                vol: 0.05,
            });
        }
        v.tone({ f: 660, to: 110, type: 'triangle', dur: 1.8, vol: 0.12 });
        v.tone({ f: 990, to: 165, type: 'sine', dur: 1.6, vol: 0.08 });
        boom(v, 1.4, 0.9);
        for (const [i, f] of [1320, 1760, 2640].entries())
            v.tone({ f, to: f * 0.6, type: 'sine', at: 1.2 + i * 0.1, dur: 1.2, vol: 0.04 });
    },
};
