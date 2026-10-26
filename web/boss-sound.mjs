// Boss sound design. Everything is synthesised (no samples), built from a handful
// of voices so each boss has its own timbre:
//   Sentinel / Picket     servo saws and square zaps (a machine)
//   Ringwarden / Shardling  glass: high sines, tinks and shatter noise
//   Cinderforge / Cinderling  fire: low filtered noise, roars and crackle
//   Bastion / Gunnery     ordnance: square thumps, launch whooshes, klaxons
//   Tidecaller / Moonjelly  water: gliding sines with vibrato, bloops and pops
//   Horizon Warden / Lens Imp  cosmic: detuned drones, bent pitches, sub swells
// Each attack has a CHARGE (played as its telegraph starts, as long as the
// warning) and a RELEASE (the lethal moment: hazard live, shot spawned). Every
// boss also has a distinct DEFEAT sound. The game plays them from the scene
// (`BossSound.observe`); the attack gallery plays them by name (`SOUNDS`).
import { ATTACK, BOSS_AT, HAZARD, SHOT, bossHazards, bossParts, bossShots } from './boss-scene.mjs';

const GROUPS = ['sentinel', 'ringwarden', 'cinderforge', 'bastion', 'tidecaller', 'warden'];
export const groupOf = (kind) => GROUPS[kind % 6];
export const isMini = (kind) => kind >= 6;

const noiseBuffers = new WeakMap();
function noiseBuffer(ctx) {
    let buffer = noiseBuffers.get(ctx);
    if (!buffer) {
        buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let seed = 12345;
        for (let i = 0; i < data.length; i++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            data[i] = seed / 2147483648 - 1;
        }
        noiseBuffers.set(ctx, buffer);
    }
    return buffer;
}

// A small synth: schedule tones and filtered noise relative to `t0`.
export function voice(ctx, dest, t0 = ctx.currentTime, { gain = 1, pitch = 1 } = {}) {
    const shape = (param, t, dur, vol, atk, env) => {
        const peak = Math.max(0.0002, vol * gain);
        param.setValueAtTime(0.0001, t);
        if (env === 'swell') {
            // builds to the end, then drops: charge-ups
            param.exponentialRampToValueAtTime(peak, t + dur * 0.92);
            param.exponentialRampToValueAtTime(0.0001, t + dur);
        } else if (env === 'pulse') {
            // held level with soft edges: hums
            param.exponentialRampToValueAtTime(peak, t + Math.min(0.06, dur * 0.2));
            param.setValueAtTime(peak, t + dur * 0.75);
            param.exponentialRampToValueAtTime(0.0001, t + dur);
        } else {
            // hit and decay
            param.exponentialRampToValueAtTime(peak, t + atk);
            param.exponentialRampToValueAtTime(0.0001, t + dur);
        }
    };
    const tone = ({
        f,
        to = f,
        type = 'sine',
        at = 0,
        dur = 0.2,
        vol = 0.1,
        atk = 0.004,
        env = 'decay',
        vib = null,
        detune = 0,
        lin = false,
    }) => {
        const osc = ctx.createOscillator(),
            amp = ctx.createGain(),
            t = t0 + at;
        osc.type = type;
        osc.frequency.setValueAtTime(f * pitch, t);
        if (to !== f)
            osc.frequency[lin ? 'linearRampToValueAtTime' : 'exponentialRampToValueAtTime'](
                Math.max(1, to * pitch),
                t + dur,
            );
        osc.detune.value = detune;
        if (vib) {
            const lfo = ctx.createOscillator(),
                depth = ctx.createGain();
            lfo.frequency.value = vib.rate;
            depth.gain.value = vib.depth * pitch;
            lfo.connect(depth).connect(osc.frequency);
            lfo.start(t);
            lfo.stop(t + dur + 0.05);
        }
        shape(amp.gain, t, dur, vol, atk, env);
        osc.connect(amp).connect(dest);
        osc.start(t);
        osc.stop(t + dur + 0.05);
        osc.onended = () => amp.disconnect();
    };
    const noise = ({
        at = 0,
        dur = 0.2,
        vol = 0.1,
        f = 1000,
        to = f,
        q = 1,
        type = 'lowpass',
        atk = 0.004,
        env = 'decay',
    }) => {
        const src = ctx.createBufferSource(),
            filter = ctx.createBiquadFilter(),
            amp = ctx.createGain(),
            t = t0 + at;
        src.buffer = noiseBuffer(ctx);
        src.loop = true;
        filter.type = type;
        filter.Q.value = q;
        filter.frequency.setValueAtTime(f, t);
        if (to !== f) filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        shape(amp.gain, t, dur, vol, atk, env);
        src.connect(filter).connect(amp).connect(dest);
        src.start(t);
        src.stop(t + dur + 0.05);
        src.onended = () => amp.disconnect();
    };
    return { tone, noise, ctx };
}

// ---------------------------------------------------------------- shared shapes
// Each takes the voice `v` and the telegraph length `d` in seconds.
const arp = (v, notes, step, o = {}) =>
    notes.forEach((f, i) =>
        v.tone({
            f,
            at: i * step,
            dur: o.dur ?? step * 1.6,
            type: o.type ?? 'square',
            vol: o.vol ?? 0.07,
        }),
    );
const boom = (v, size = 1, at = 0) => {
    v.tone({ f: 120 * size, to: 34, type: 'sine', at, dur: 0.5 * size + 0.2, vol: 0.26 });
    v.noise({ at, dur: 0.45 * size + 0.15, vol: 0.18, f: 1800, to: 120, type: 'lowpass' });
};
const pop = (v, f = 700, at = 0, vol = 0.1) =>
    v.tone({ f, to: f * 2.4, type: 'sine', at, dur: 0.07, vol });

// ---------------------------------------------------------------- sound book
// charge: attack id -> (v, seconds). release: hazard kind or shot family -> (v).
const BOOK = {
    sentinel: {
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
            [SHOT.needle]: (v) =>
                v.tone({ f: 1500, to: 600, type: 'square', dur: 0.07, vol: 0.05 }),
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
    },
    ringwarden: {
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
    },
    cinderforge: {
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
    },
    bastion: {
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
            [SHOT.needle]: (v) =>
                v.tone({ f: 1100, to: 520, type: 'square', dur: 0.06, vol: 0.045 }),
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
    },
    tidecaller: {
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
    },
    warden: {
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
    },
};
// Mini-bosses borrow their parent's voice a fifth higher and a little shorter.
const MINI = { pitch: 1.5, gain: 0.85 };

// ---------------------------------------------------------------- generic fallbacks
const FALLBACK = {
    charge: (v, d) => v.tone({ f: 300, to: 900, type: 'square', dur: d, vol: 0.06, env: 'swell' }),
    live: (v) => v.noise({ dur: 0.3, vol: 0.12, f: 4000, to: 300, type: 'bandpass' }),
    shot: (v) => v.tone({ f: 1000, to: 500, type: 'square', dur: 0.06, vol: 0.04 }),
    part: (v) => boom(v, 0.6),
    hit: (v) => v.tone({ f: 200, to: 120, type: 'square', dur: 0.05, vol: 0.05 }),
    phase: (v) => {
        v.tone({ f: 90, to: 45, type: 'sawtooth', dur: 0.8, vol: 0.18 });
        boom(v, 1);
    },
    open: (v) => v.tone({ f: 500, to: 1000, type: 'sine', dur: 0.2, vol: 0.06 }),
    close: (v) => v.tone({ f: 800, to: 300, type: 'sine', dur: 0.15, vol: 0.05 }),
};
// Mini-boss attacks reuse the sound of the boss attack they preview.
const ALIAS = {
    [ATTACK.bolts]: ATTACK.cannon,
    [ATTACK.shards]: ATTACK.pick,
    [ATTACK.curve1]: ATTACK.curve,
    [ATTACK.sine6]: ATTACK.sine,
};
const entry = (kind, section, key) => {
    const book = BOOK[groupOf(kind)];
    const part = book?.[section];
    return key === undefined
        ? part
        : (part?.[key] ?? (section === 'charge' ? part?.[ALIAS[key]] : undefined));
};

// name -> {play(ctx, dest, t0), seconds, text}: what the gallery lists and plays.
export function describeSounds() {
    const out = [];
    const names = {
        sentinel: 'Sentinel',
        ringwarden: 'Ringwarden',
        cinderforge: 'Cinderforge',
        bastion: 'Bastion',
        tidecaller: 'Tidecaller',
        warden: 'Horizon Warden',
    };
    for (const group of GROUPS) {
        const book = BOOK[group];
        out.push({
            id: `${group}.entrance`,
            label: `${names[group]} entrance`,
            seconds: 3,
            play: (v, o) => book.sting(v, o),
        });
        for (const [attack, fn] of Object.entries(book.charge || {}))
            out.push({
                id: `${group}.charge.${attack}`,
                label: `${names[group]} · attack ${attack} charge`,
                seconds: 1.2,
                play: (v) => fn(v, 0.9),
            });
        out.push({
            id: `${group}.defeat`,
            label: `${names[group]} defeated`,
            seconds: 4.5,
            play: (v) => book.defeat(v),
        });
    }
    return out;
}

// ---------------------------------------------------------------- playing from the scene
export class BossSound {
    // `audio` is GameAudio: it owns the context, master gain and the enabled checks.
    constructor(audio) {
        this.audio = audio;
        this.last = new Map();
    }
    get live() {
        const a = this.audio;
        return a.context && a.settings.soundEnabled && !a.suspended;
    }
    // Plays one named sound for a kind; `limit` ms stops a volley turning to noise.
    play(kind, section, key, { seconds = 0.9, limit = 0 } = {}) {
        if (!this.live) return;
        const id = `${section}:${key}`,
            now = performance.now();
        if (limit && now - (this.last.get(id) ?? -1e9) < limit) return;
        this.last.set(id, now);
        const fn = entry(kind, section, key) ?? FALLBACK[section];
        if (!fn) return;
        this.run(kind, (v) => fn(v, seconds), section === 'charge' ? 1.5 : 1);
    }
    run(kind, build, level = 1) {
        const ctx = this.audio.context,
            mini = isMini(kind);
        build(
            voice(ctx, this.audio.master, ctx.currentTime + 0.005, {
                gain: (mini ? MINI.gain : 1) * level,
                pitch: mini ? MINI.pitch : 1,
            }),
        );
    }
    sting(kind) {
        this.run(kind, (v) => BOOK[groupOf(kind)].sting(v), 0.9);
    }
    defeat(kind) {
        this.run(kind, (v) => BOOK[groupOf(kind)].defeat(v), 0.8);
    }
    // Compare two consecutive scenes and sound whatever just happened.
    observe(old, scene) {
        if (!this.live || !old) return;
        const was = old[512],
            is = scene[512],
            kind = scene[BOSS_AT] | 0;
        if (!was && is) {
            this.sting(kind);
            return;
        }
        if (was && !is) {
            this.defeat(old[BOSS_AT] | 0);
            return;
        }
        if (!is) return;
        const stage = scene[517],
            oldStage = old[517];
        // Attack begins: charge for the length of the first telegraph that follows.
        const attack = scene[BOSS_AT + 5],
            oldAttack = old[BOSS_AT + 5];
        if (attack && attack !== oldAttack)
            this.play(kind, 'charge', attack, { seconds: attackWarn(attack) });
        if (stage > oldStage && oldStage > 0) this.play(kind, 'phase', undefined, { limit: 500 });
        // Lethal hazards going live, and hazard telegraphs with their own cue.
        const before = new Map(bossHazards(old).map((h) => [h.index, h]));
        for (const h of bossHazards(scene)) {
            const prev = before.get(h.index);
            if (prev && prev.warn > 0 && h.warn === 0)
                this.play(kind, 'live', h.kind, { limit: 150 });
        }
        // New shots (age 0 this tick), one sound per family per tick.
        const families = new Set();
        for (const s of bossShots(scene)) if (s.age < 10) families.add(s.family);
        for (const family of families)
            this.play(kind, 'shot', family, {
                limit: family === SHOT.sine || family === SHOT.pellet ? 90 : 45,
            });
        // Sub-targets lost.
        const lost = bossParts(old).filter((p) => !bossPartNow(scene, p.index).exists);
        if (lost.length) this.play(kind, 'part', undefined, { limit: 120 });
        if (kind === 2 || kind === 8) {
            for (let i = 0; i < 8; i++)
                if (scene[BOSS_AT + 32 + i * 8 + 6] === 2 && old[BOSS_AT + 32 + i * 8 + 6] !== 2) {
                    this.play(kind, 'part', undefined, { limit: 120 });
                    break;
                }
        }
        // Windows and gates.
        const gate = scene[BOSS_AT + 7],
            oldGate = old[BOSS_AT + 7];
        if ((kind === 0 || kind === 6) && gate > 0.5 && oldGate <= 0.5) this.play(kind, 'open');
        if ((kind === 0 || kind === 6) && gate <= 0.5 && oldGate > 0.5) this.play(kind, 'close');
        const aux = (i) => scene[BOSS_AT + 16 + i],
            oldAux = (i) => old[BOSS_AT + 16 + i];
        if (kind === 5 && aux(1) > 0.5 && oldAux(1) <= 0.5) this.play(kind, 'open');
        if (kind === 2 && aux(1) > 0.5 && oldAux(1) <= 0.5) this.play(kind, 'open');
        if (kind === 4 && aux(2) > 0.5 && oldAux(2) <= 0.5) this.play(kind, 'open');
        if (kind === 3 && aux(1) > 0.5 && oldAux(1) <= 0.5) this.play(kind, 'gate');
        // A hit on the boss.
        if (scene[BOSS_AT + 4] > 0 && old[BOSS_AT + 4] === 0)
            this.play(kind, 'hit', undefined, { limit: 70 });
    }
}
const bossPartNow = (scene, index) => ({ exists: !!scene[BOSS_AT + 32 + index * 8] });
// Telegraph lengths (seconds) the charge sounds are shaped for.
const WARN = {
    [ATTACK.lance]: 0.9,
    [ATTACK.fan]: 0.7,
    [ATTACK.volley]: 0.6,
    [ATTACK.cross]: 0.9,
    [ATTACK.burst]: 0.7,
    [ATTACK.prism]: 0.9,
    [ATTACK.pick]: 0.5,
    [ATTACK.collapse]: 1.2,
    [ATTACK.lob]: 1.2,
    [ATTACK.jets]: 0.9,
    [ATTACK.ember]: 0.6,
    [ATTACK.nova]: 1.0,
    [ATTACK.cannon]: 0.5,
    [ATTACK.missile]: 0.6,
    [ATTACK.mines]: 0.4,
    [ATTACK.broadside]: 0.8,
    [ATTACK.sine]: 0.6,
    [ATTACK.tendril]: 0.9,
    [ATTACK.spore]: 0.3,
    [ATTACK.pulse]: 0.7,
    [ATTACK.spiral]: 0.7,
    [ATTACK.curve]: 0.5,
    [ATTACK.accrete]: 0.9,
    [ATTACK.pull]: 1.2,
    [ATTACK.bolts]: 0.5,
    [ATTACK.shards]: 0.5,
    [ATTACK.curve1]: 0.5,
    [ATTACK.blink]: 0.7,
    [ATTACK.sine6]: 0.6,
};
const attackWarn = (id) => WARN[id] ?? 0.8;
