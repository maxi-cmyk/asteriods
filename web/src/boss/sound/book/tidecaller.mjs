import { ATTACK, HAZARD, SHOT } from '../../scene.mjs';
import { boom, pop } from '../shapes.mjs';

export const tidecaller = {
    sting: (v) => {
        v.tone({
            f: 110,
            to: 330,
            type: 'sine',
            dur: 1.5,
            vol: 0.14,
            env: 'swell',
            vib: { rate: 4, depth: 10 },
        });
        v.tone({
            f: 165,
            to: 495,
            type: 'sine',
            dur: 1.5,
            vol: 0.08,
            env: 'swell',
            detune: 12,
        });
        for (let i = 0; i < 5; i++) pop(v, 500 + i * 160, 1.1 + i * 0.07, 0.08);
    },
    charge: {
        [ATTACK.sine]: (v, d) => {
            for (let i = 0; i < 6; i++) pop(v, 380 + i * 70, (i * d) / 6, 0.05);
            v.tone({
                f: 200,
                to: 400,
                type: 'sine',
                dur: d,
                vol: 0.06,
                env: 'swell',
                vib: { rate: 6, depth: 14 },
            });
        },
        [ATTACK.tendril]: (v, d) => {
            v.tone({
                f: 70,
                to: 150,
                type: 'sine',
                dur: d,
                vol: 0.14,
                env: 'swell',
                vib: { rate: 3, depth: 6 },
            });
            v.noise({ dur: d, vol: 0.06, f: 300, to: 1200, type: 'bandpass', env: 'swell' });
        },
        [ATTACK.spore]: (v, d) => {
            v.tone({
                f: 250,
                to: 500,
                type: 'triangle',
                dur: d,
                vol: 0.08,
                env: 'swell',
                vib: { rate: 10, depth: 20 },
            });
        },
        [ATTACK.pulse]: (v, d) => {
            v.tone({ f: 1100, type: 'sine', dur: 0.5, vol: 0.1 });
            v.tone({ f: 1100, type: 'sine', at: 0.35, dur: 0.5, vol: 0.06 });
        },
        [ATTACK.sine6]: (v, d) => {
            for (let i = 0; i < 4; i++) pop(v, 400 + i * 90, (i * d) / 4, 0.05);
        },
    },
    live: {
        [HAZARD.arm]: (v) => {
            v.noise({
                dur: 1.2,
                vol: 0.12,
                f: 400,
                to: 2000,
                type: 'bandpass',
                q: 0.8,
                env: 'pulse',
            });
            v.tone({
                f: 120,
                to: 90,
                type: 'sine',
                dur: 1.2,
                vol: 0.1,
                env: 'pulse',
                vib: { rate: 4, depth: 8 },
            });
        },
        [HAZARD.ring]: (v) => {
            v.tone({ f: 900, to: 450, type: 'sine', dur: 1.2, vol: 0.12 });
            v.tone({ f: 1350, to: 675, type: 'sine', at: 0.02, dur: 1.0, vol: 0.06 });
            boom(v, 0.7);
        },
    },
    shot: {
        [SHOT.sine]: (v) => pop(v, 420 + Math.random() * 60, 0, 0.07),
        [SHOT.spore]: (v) => {
            v.tone({ f: 200, to: 520, type: 'triangle', dur: 0.3, vol: 0.09 });
            v.noise({ dur: 0.15, vol: 0.05, f: 800, type: 'lowpass' });
        },
        [SHOT.needle]: (v) => pop(v, 900, 0, 0.04),
    },
    part: (v) => {
        pop(v, 900, 0, 0.12);
        pop(v, 1300, 0.04, 0.08);
        v.noise({ dur: 0.12, vol: 0.07, f: 4000, type: 'highpass' });
    },
    open: (v) => {
        v.tone({
            f: 600,
            to: 150,
            type: 'sine',
            dur: 0.7,
            vol: 0.12,
            vib: { rate: 8, depth: 20 },
        });
    },
    hit: (v) => pop(v, 300, 0, 0.07),
    defeat: (v) => {
        // the bell deflates with a long falling cry, bubbles escaping
        v.tone({
            f: 700,
            to: 55,
            type: 'sine',
            dur: 2.2,
            vol: 0.16,
            vib: { rate: 6, depth: 30 },
        });
        v.tone({ f: 1050, to: 80, type: 'sine', dur: 1.9, vol: 0.08, detune: 14 });
        for (let i = 0; i < 16; i++) pop(v, 400 + ((i * 97) % 700), 0.2 + i * 0.11, 0.07);
        boom(v, 1.2, 1.7);
    },
};
