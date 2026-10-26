import { ATTACK, HAZARD, SHOT } from '../../scene.mjs';
import { boom } from '../shapes.mjs';

export const cinderforge = {
    sting: (v) => {
        v.noise({ dur: 1.6, vol: 0.2, f: 150, to: 900, type: 'lowpass', env: 'swell' });
        v.tone({ f: 45, to: 70, type: 'sawtooth', dur: 1.5, vol: 0.15, env: 'swell' });
        boom(v, 1.2, 1.4);
    },
    charge: {
        [ATTACK.lob]: (v, d) => {
            v.noise({
                dur: d,
                vol: 0.14,
                f: 200,
                to: 2200,
                type: 'bandpass',
                q: 1.5,
                env: 'swell',
            });
            v.tone({ f: 70, to: 150, type: 'sawtooth', dur: d, vol: 0.06, env: 'swell' });
        },
        [ATTACK.jets]: (v, d) => {
            v.noise({ dur: d, vol: 0.16, f: 800, to: 4500, type: 'highpass', env: 'swell' });
            v.tone({ f: 55, to: 110, type: 'sawtooth', dur: d, vol: 0.08, env: 'swell' });
        },
        [ATTACK.ember]: (v, d) => {
            for (let i = 0; i < 6; i++)
                v.noise({
                    at: (i * d) / 6,
                    dur: 0.05,
                    vol: 0.08,
                    f: 4000,
                    type: 'bandpass',
                    q: 3,
                });
        },
        [ATTACK.nova]: (v, d) => {
            v.tone({ f: 40, to: 160, type: 'sine', dur: d, vol: 0.22, env: 'swell' });
            v.noise({ dur: d, vol: 0.16, f: 100, to: 2000, type: 'lowpass', env: 'swell' });
        },
    },
    live: {
        [HAZARD.lane]: (v) => {
            v.noise({ dur: 0.55, vol: 0.26, f: 1500, to: 300, type: 'lowpass', atk: 0.03 });
            v.noise({ dur: 0.5, vol: 0.1, f: 4000, type: 'bandpass', q: 0.8 });
            v.tone({ f: 70, to: 45, type: 'sawtooth', dur: 0.5, vol: 0.12 });
        },
        [HAZARD.pool]: (v) => {
            v.tone({ f: 90, to: 40, type: 'sine', dur: 0.3, vol: 0.22 });
            v.noise({ dur: 0.4, vol: 0.16, f: 3000, to: 500, type: 'bandpass', q: 1 });
            for (let i = 0; i < 5; i++)
                v.noise({
                    at: 0.1 + i * 0.06,
                    dur: 0.03,
                    vol: 0.07,
                    f: 5000,
                    type: 'bandpass',
                    q: 4,
                });
        },
        [HAZARD.ring]: (v) => {
            boom(v, 1.5);
            v.noise({ dur: 1.2, vol: 0.12, f: 3000, to: 200, type: 'lowpass' });
        },
    },
    shot: {
        [SHOT.lob]: (v) => {
            v.noise({ dur: 0.3, vol: 0.13, f: 300, to: 1800, type: 'bandpass', q: 1.5 });
            v.tone({ f: 180, to: 90, type: 'sine', dur: 0.25, vol: 0.12 });
        },
        [SHOT.ember]: (v) => {
            v.noise({ dur: 0.05, vol: 0.09, f: 4500, type: 'bandpass', q: 3 });
            v.tone({ f: 900, to: 400, type: 'triangle', dur: 0.06, vol: 0.04 });
        },
    },
    part: (v) => {
        v.noise({ dur: 0.4, vol: 0.2, f: 2400, to: 200, type: 'lowpass' });
        v.tone({ f: 160, to: 50, type: 'square', dur: 0.3, vol: 0.12 });
    },
    open: (v) => v.noise({ dur: 0.6, vol: 0.14, f: 400, to: 3000, type: 'bandpass', q: 1.2 }),
    hit: (v) => v.noise({ dur: 0.06, vol: 0.09, f: 1200, type: 'lowpass' }),
    defeat: (v) => {
        // the sun inside swells, cracks the shell, and goes out in a roar
        v.tone({ f: 50, to: 200, type: 'sine', dur: 1.0, vol: 0.22, env: 'swell' });
        v.noise({ dur: 1.0, vol: 0.15, f: 200, to: 2500, type: 'lowpass', env: 'swell' });
        boom(v, 2.2, 1.0);
        v.noise({ at: 1.0, dur: 1.8, vol: 0.22, f: 2500, to: 100, type: 'lowpass' });
        for (let i = 0; i < 12; i++)
            v.noise({
                at: 1.2 + i * 0.1,
                dur: 0.04,
                vol: 0.09,
                f: 5000,
                type: 'bandpass',
                q: 4,
            });
    },
};
