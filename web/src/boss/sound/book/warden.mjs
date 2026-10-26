import { ATTACK, HAZARD, SHOT } from '../../scene.mjs';
import { boom } from '../shapes.mjs';
import { sentinel } from './sentinel.mjs';
import { ringwarden } from './ringwarden.mjs';
import { cinderforge } from './cinderforge.mjs';
import { bastion } from './bastion.mjs';
import { tidecaller } from './tidecaller.mjs';

// The Warden's own voice: cosmic drones and bent pitches...
const own = {
    sting: (v) => {
        v.tone({ f: 40, to: 90, type: 'sine', dur: 1.8, vol: 0.24, env: 'swell' });
        for (const d of [-9, 0, 9])
            v.tone({
                f: 220,
                to: 110,
                type: 'sawtooth',
                dur: 1.8,
                vol: 0.06,
                detune: d * 8,
                env: 'swell',
            });
        v.tone({ f: 1320, type: 'sine', at: 1.6, dur: 1.2, vol: 0.07 });
    },
    charge: {
        [ATTACK.spiral]: (v, d) => {
            for (const det of [-14, 0, 14])
                v.tone({
                    f: 160,
                    to: 480,
                    type: 'sawtooth',
                    dur: d,
                    vol: 0.045,
                    detune: det,
                    env: 'swell',
                    vib: { rate: 5, depth: 12 },
                });
        },
        [ATTACK.curve]: (v, d) => {
            v.tone({
                f: 300,
                to: 900,
                type: 'sine',
                dur: d,
                vol: 0.08,
                env: 'swell',
                vib: { rate: 12, depth: 40 },
            });
        },
        [ATTACK.accrete]: (v, d) => {
            v.tone({ f: 1500, to: 200, type: 'sine', dur: d, vol: 0.09 });
            v.tone({ f: 2250, to: 300, type: 'sine', dur: d, vol: 0.05 });
        },
        [ATTACK.blink]: (v, d) => {
            for (let i = 0; i < 9; i++)
                v.tone({
                    f: 900 + ((i * 331) % 1400),
                    type: 'square',
                    at: (i * d) / 9,
                    dur: 0.05,
                    vol: 0.04,
                });
            v.noise({ dur: d, vol: 0.05, f: 6000, type: 'highpass', env: 'swell' });
        },
        [ATTACK.pull]: (v, d) => {
            v.tone({ f: 30, to: 90, type: 'sine', dur: d, vol: 0.3, env: 'swell' });
            v.noise({ dur: d, vol: 0.1, f: 4000, to: 150, type: 'bandpass', q: 1 });
        },
    },
    live: {
        [HAZARD.ring]: (v) => {
            v.tone({ f: 600, to: 120, type: 'sine', dur: 0.8, vol: 0.1 });
            v.tone({ f: 70, to: 30, type: 'sine', dur: 0.8, vol: 0.2 });
        },
        [HAZARD.pull]: (v) => {
            v.tone({ f: 40, to: 28, type: 'sine', dur: 1.5, vol: 0.3, env: 'pulse' });
            v.noise({ dur: 1.5, vol: 0.12, f: 3000, to: 200, type: 'bandpass', env: 'pulse' });
        },
    },
    shot: {
        [SHOT.needle]: (v) => v.tone({ f: 1800, to: 700, type: 'sine', dur: 0.1, vol: 0.06 }),
        [SHOT.pellet]: (v) =>
            v.tone({
                f: 700 + Math.random() * 400,
                to: 500,
                type: 'sine',
                dur: 0.05,
                vol: 0.035,
            }),
        [SHOT.curve]: (v) => {
            v.tone({
                f: 500,
                to: 1200,
                type: 'sine',
                dur: 0.35,
                vol: 0.07,
                vib: { rate: 9, depth: 50 },
            });
        },
    },
    part: (v) => {
        v.tone({ f: 2200, to: 300, type: 'sine', dur: 0.4, vol: 0.1 });
        v.noise({ dur: 0.2, vol: 0.07, f: 6000, type: 'highpass' });
    },
    open: (v) => {
        for (const [i, f] of [1320, 1760, 2640].entries())
            v.tone({ f, type: 'sine', at: i * 0.07, dur: 1.4, vol: 0.08 });
    },
    phase: (v) => {
        v.tone({ f: 60, to: 30, type: 'sine', dur: 1.2, vol: 0.25 });
        v.tone({ f: 300, to: 1800, type: 'sine', dur: 0.8, vol: 0.08, env: 'swell' });
    },
    hit: (v) => v.tone({ f: 500, to: 300, type: 'sine', dur: 0.08, vol: 0.06 }),
    defeat: (v) => {
        // the lens collapses: a reversed swell, a silence, then the sub-bass
        v.tone({ f: 100, to: 1600, type: 'sawtooth', dur: 1.5, vol: 0.1, env: 'swell' });
        v.noise({ dur: 1.5, vol: 0.1, f: 200, to: 6000, type: 'bandpass', env: 'swell' });
        v.tone({ f: 55, to: 22, type: 'sine', at: 1.7, dur: 2.6, vol: 0.34 });
        boom(v, 2.6, 1.7);
        for (const [i, f] of [660, 880, 1320, 1760].entries())
            v.tone({ f, type: 'sine', at: 2.0 + i * 0.12, dur: 1.8, vol: 0.06 });
    },
};

// ...and, because it fights with every earlier boss's attacks, each of those keeps the sound it
// has in its own fight (the Warden's own entries win where both have one).
export const warden = {
    ...own,
    charge: {
        ...sentinel.charge,
        ...ringwarden.charge,
        ...cinderforge.charge,
        ...bastion.charge,
        ...tidecaller.charge,
        [ATTACK.ringBurst]: ringwarden.charge[ATTACK.burst],
        [ATTACK.fanJets]: cinderforge.charge[ATTACK.jets],
        [ATTACK.fireNova]: cinderforge.charge[ATTACK.nova],
        ...own.charge,
        [ATTACK.cloak]: own.charge[ATTACK.blink],
    },
    live: {
        ...sentinel.live,
        ...ringwarden.live,
        ...cinderforge.live,
        ...bastion.live,
        ...tidecaller.live,
        ...own.live,
    },
    shot: {
        ...sentinel.shot,
        ...ringwarden.shot,
        ...cinderforge.shot,
        ...bastion.shot,
        ...tidecaller.shot,
        ...own.shot,
    },
    // The mirror locking in: glass ringing high; it falling away again; the cloak.
    mirror: (v) => {
        for (const [i, f] of [2093, 3136, 4186].entries())
            v.tone({ f, to: f * 1.12, type: 'sine', at: i * 0.04, dur: 0.6, vol: 0.06 });
        v.noise({ dur: 0.25, vol: 0.05, f: 8000, type: 'highpass' });
    },
    unmirror: (v) => v.tone({ f: 3000, to: 900, type: 'sine', dur: 0.4, vol: 0.05 }),
    cloak: (v) => {
        v.noise({ dur: 0.7, vol: 0.09, f: 7000, to: 300, type: 'bandpass' });
        v.tone({ f: 900, to: 90, type: 'sine', dur: 0.7, vol: 0.1 });
    },
    uncloak: (v) => {
        v.noise({ dur: 0.5, vol: 0.07, f: 300, to: 7000, type: 'bandpass', env: 'swell' });
        v.tone({ f: 90, to: 900, type: 'sine', dur: 0.5, vol: 0.09, env: 'swell' });
    },
};
