import { ATTACK, HAZARD, SHOT } from '../../scene.mjs';
import { arp, boom } from '../shapes.mjs';

export const sentinel = {
    sting: (v) => {
        v.tone({ f: 70, to: 140, type: 'sawtooth', dur: 0.9, vol: 0.16, env: 'swell' });
        v.tone({ f: 140, to: 105, type: 'square', at: 0.9, dur: 0.5, vol: 0.1 });
        boom(v, 0.8, 0.9);
        arp(v, [196, 147, 98], 0.12);
    },
    charge: {
        [ATTACK.lance]: (v, d) => {
            v.tone({
                f: 180,
                to: 1500,
                type: 'sawtooth',
                dur: d,
                vol: 0.1,
                env: 'swell',
                vib: { rate: 9, depth: 18 },
            });
            v.tone({ f: 90, to: 400, type: 'square', dur: d, vol: 0.05, env: 'swell' });
        },
        [ATTACK.fan]: (v, d) => arp(v, [330, 392, 466], d / 4, { type: 'sawtooth', vol: 0.06 }),
        [ATTACK.volley]: (v, d) => {
            v.tone({
                f: 300,
                to: 900,
                type: 'square',
                dur: d,
                vol: 0.06,
                env: 'swell',
                vib: { rate: 22, depth: 25 },
            });
        },
        [ATTACK.cross]: (v, d) => {
            v.tone({ f: 180, to: 1400, type: 'sawtooth', dur: d, vol: 0.08, env: 'swell' });
            v.tone({
                f: 240,
                to: 1000,
                type: 'sawtooth',
                dur: d,
                vol: 0.07,
                env: 'swell',
                detune: 700,
            });
        },
    },
    live: {
        [HAZARD.lane]: (v) => {
            v.noise({ dur: 0.38, vol: 0.2, f: 6000, to: 400, type: 'bandpass', q: 1.2 });
            v.tone({ f: 1100, to: 70, type: 'square', dur: 0.34, vol: 0.12 });
        },
    },
    shot: {
        [SHOT.needle]: (v) => v.tone({ f: 1500, to: 600, type: 'square', dur: 0.07, vol: 0.05 }),
    },
    open: (v) => v.tone({ f: 80, to: 240, type: 'sawtooth', dur: 0.35, vol: 0.08 }),
    close: (v) => {
        v.tone({ f: 240, to: 70, type: 'sawtooth', dur: 0.22, vol: 0.08 });
        v.noise({ dur: 0.08, vol: 0.1, f: 3000, type: 'highpass' });
    },
    hit: (v) => v.tone({ f: 260, to: 180, type: 'square', dur: 0.06, vol: 0.06 }),
    defeat: (v) => {
        // servo winds down, then the hull comes apart
        v.tone({
            f: 600,
            to: 40,
            type: 'sawtooth',
            dur: 1.3,
            vol: 0.14,
            vib: { rate: 14, depth: 40 },
        });
        for (let i = 0; i < 6; i++) {
            v.noise({
                at: i * 0.16,
                dur: 0.14,
                vol: 0.13,
                f: 3000,
                to: 400,
                type: 'bandpass',
                q: 2,
            });
            v.tone({
                f: 300 - i * 30,
                to: 60,
                type: 'square',
                at: i * 0.16,
                dur: 0.12,
                vol: 0.07,
            });
        }
        boom(v, 1.8, 1.0);
        v.noise({ at: 1.1, dur: 1.0, vol: 0.12, f: 5000, to: 200, type: 'highpass' });
    },
};
