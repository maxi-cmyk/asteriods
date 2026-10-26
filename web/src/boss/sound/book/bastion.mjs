import { ATTACK, SHOT } from '../../scene.mjs';
import { arp, boom, pop } from '../shapes.mjs';

export const bastion = {
    sting: (v) => {
        for (let i = 0; i < 3; i++) {
            v.tone({ f: 620, type: 'square', at: i * 0.4, dur: 0.22, vol: 0.07 });
            v.tone({ f: 470, type: 'square', at: i * 0.4 + 0.2, dur: 0.22, vol: 0.07 });
        }
        v.tone({ f: 55, to: 40, type: 'sawtooth', dur: 1.6, vol: 0.16, env: 'pulse' });
        boom(v, 1, 1.2);
    },
    charge: {
        [ATTACK.cannon]: (v, d) => {
            v.tone({ f: 120, to: 700, type: 'sawtooth', dur: d, vol: 0.07, env: 'swell' });
            arp(v, [880, 880], d / 2, { type: 'square', vol: 0.04, dur: 0.05 });
        },
        [ATTACK.missile]: (v, d) => {
            arp(v, [1000, 1000, 1000, 1400], d / 4, { type: 'square', vol: 0.05, dur: 0.06 });
            v.noise({ dur: d, vol: 0.05, f: 500, to: 1400, type: 'bandpass', env: 'swell' });
        },
        [ATTACK.mines]: (v, d) => {
            v.tone({ f: 90, to: 60, type: 'square', dur: d, vol: 0.08, env: 'pulse' });
        },
        [ATTACK.broadside]: (v, d) => {
            v.tone({ f: 500, to: 900, type: 'square', dur: d * 0.5, vol: 0.06, env: 'pulse' });
            v.tone({
                f: 900,
                to: 500,
                type: 'square',
                at: d * 0.5,
                dur: d * 0.5,
                vol: 0.06,
                env: 'pulse',
            });
        },
    },
    shot: {
        [SHOT.bolt]: (v) => {
            boom(v, 0.55);
            v.tone({ f: 1400, to: 200, type: 'square', dur: 0.12, vol: 0.08 });
        },
        [SHOT.missile]: (v) => {
            v.noise({ dur: 0.6, vol: 0.14, f: 300, to: 3500, type: 'bandpass', q: 1.2 });
            v.tone({ f: 180, to: 700, type: 'sawtooth', dur: 0.5, vol: 0.06 });
        },
        [SHOT.mine]: (v) => {
            v.tone({ f: 140, to: 70, type: 'square', dur: 0.12, vol: 0.14 });
            v.noise({ dur: 0.06, vol: 0.1, f: 2500, type: 'highpass' });
            pop(v, 1200, 0.12, 0.05);
        },
        [SHOT.needle]: (v) => v.tone({ f: 1100, to: 520, type: 'square', dur: 0.06, vol: 0.045 }),
    },
    part: (v) => {
        boom(v, 1.1);
        v.noise({ at: 0.05, dur: 0.6, vol: 0.1, f: 5000, to: 300, type: 'highpass' });
    },
    gate: (v) => {
        v.tone({ f: 70, to: 160, type: 'square', dur: 0.4, vol: 0.08 });
    },
    phase: (v) => {
        for (let i = 0; i < 4; i++) {
            v.tone({ f: 740, type: 'square', at: i * 0.25, dur: 0.12, vol: 0.08 });
            v.tone({ f: 555, type: 'square', at: i * 0.25 + 0.12, dur: 0.12, vol: 0.08 });
        }
        boom(v, 1.3);
    },
    hit: (v) => v.tone({ f: 150, to: 90, type: 'square', dur: 0.07, vol: 0.08 }),
    defeat: (v) => {
        // chain explosions walk down the hull, then it groans and breaks
        for (let i = 0; i < 7; i++) boom(v, 0.7 + (i % 3) * 0.25, i * 0.22);
        v.tone({
            f: 80,
            to: 28,
            type: 'sawtooth',
            dur: 2.2,
            vol: 0.16,
            vib: { rate: 5, depth: 6 },
        });
        v.noise({ at: 1.5, dur: 1.4, vol: 0.14, f: 3000, to: 100, type: 'lowpass' });
        boom(v, 2.4, 1.6);
    },
};
